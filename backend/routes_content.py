"""内容路由：本地剧集（SRT）+ 句子精背。

本地剧集复用与 YouTube 完全相同的翻译/缓存/自愈逻辑；
句子精背只读 content/sentences/ 下的静态 JSON（specs/009）。
"""
import asyncio
import json
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import HISTORY_DIR, SENTENCES_DIR, SUBTITLES_DIR
from transcripts import group_srt_blocks, parse_srt
from translate import mock_llm_processing, process_llm_batch, retranslate_marked_blocks

router = APIRouter()

# ====================================================
# Local Subtitle (SRT) Integration
# ====================================================

# Show metadata for display purposes
SHOW_METADATA = {
    "house-of-cards": {
        "title": "House of Cards",
        "title_zh": "纸牌屋",
        "thumbnail": "/images/house-of-cards.png",
        "seasons": {1: 13, 2: 13, 3: 13, 4: 13, 5: 13, 6: 8}
    }
}


@router.get("/api/shows")
def list_shows():
    """List available local shows with subtitles."""
    shows = []
    if os.path.exists(SUBTITLES_DIR):
        for show_dir in sorted(os.listdir(SUBTITLES_DIR)):
            show_path = os.path.join(SUBTITLES_DIR, show_dir)
            if os.path.isdir(show_path):
                meta = SHOW_METADATA.get(show_dir, {
                    "title": show_dir.replace("-", " ").title(),
                    "title_zh": show_dir,
                    "thumbnail": "",
                    "seasons": {}
                })

                # Count actual available seasons and episodes
                seasons_available = {}
                for season_dir in sorted(os.listdir(show_path)):
                    season_path = os.path.join(show_path, season_dir)
                    if os.path.isdir(season_path) and season_dir.startswith("S"):
                        season_num = int(season_dir[1:])
                        episodes = [f for f in os.listdir(season_path) if f.endswith('.srt')]
                        if episodes:
                            seasons_available[season_num] = len(episodes)

                if seasons_available:
                    shows.append({
                        "id": show_dir,
                        "title": meta["title"],
                        "title_zh": meta["title_zh"],
                        "thumbnail": meta["thumbnail"],
                        "seasons_available": seasons_available,
                        "total_episodes": sum(seasons_available.values())
                    })

    return {"shows": shows}


@router.get("/api/shows/{show_id}/seasons")
def list_seasons(show_id: str):
    """List available seasons for a show."""
    show_path = os.path.join(SUBTITLES_DIR, show_id)
    if not os.path.exists(show_path):
        raise HTTPException(status_code=404, detail="Show not found")

    meta = SHOW_METADATA.get(show_id, {})
    seasons = []

    for season_dir in sorted(os.listdir(show_path)):
        season_path = os.path.join(show_path, season_dir)
        if os.path.isdir(season_path) and season_dir.startswith("S"):
            season_num = int(season_dir[1:])
            episodes = sorted([f for f in os.listdir(season_path) if f.endswith('.srt')])
            seasons.append({
                "season": season_num,
                "episode_count": len(episodes),
                "episodes": [int(e.replace("E", "").replace(".srt", "")) for e in episodes]
            })

    return {
        "show_id": show_id,
        "title": meta.get("title", show_id),
        "title_zh": meta.get("title_zh", ""),
        "seasons": seasons
    }


class SubtitleRequest(BaseModel):
    show_id: str
    season: int
    episode: int


@router.post("/api/process-subtitle")
async def process_subtitle(request: SubtitleRequest):
    """Process a local SRT subtitle file through DeepSeek translation."""
    srt_path = os.path.join(
        SUBTITLES_DIR, request.show_id,
        f"S{request.season:02d}", f"E{request.episode:02d}.srt"
    )

    if not os.path.exists(srt_path):
        raise HTTPException(status_code=404, detail="Subtitle file not found")

    # Check if already processed (cached in history)
    cache_filename = f"{request.show_id}_S{request.season:02d}E{request.episode:02d}.json"
    cache_path = os.path.join(HISTORY_DIR, cache_filename)

    if os.path.exists(cache_path):
        print(f"Loading cached subtitles: {cache_filename}")
        with open(cache_path, "r", encoding="utf-8") as f:
            cached_data = json.load(f)
        return await retranslate_marked_blocks(cached_data, cache_path)

    # Parse SRT file
    with open(srt_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    raw_blocks = parse_srt(content)
    blocks = group_srt_blocks(raw_blocks)

    # Assign IDs
    for idx, b in enumerate(blocks):
        b["id"] = idx + 1

    # Get show metadata
    meta = SHOW_METADATA.get(request.show_id, {})
    show_title = meta.get("title", request.show_id)
    show_title_zh = meta.get("title_zh", "")

    metadata = {
        "title": f"{show_title} S{request.season:02d}E{request.episode:02d}",
        "channel": show_title_zh or show_title,
        "upload_date": "",
        "thumbnail": meta.get("thumbnail", ""),
        "is_local_subtitle": True
    }

    # Process through DeepSeek translation (same batching as YouTube)
    processed_blocks = []
    batch_size = 20
    has_mock_fallback = False  # Track if any batch used mock

    print(f"Processing {len(blocks)} subtitle blocks for {show_title} S{request.season:02d}E{request.episode:02d}...")

    for i in range(0, len(blocks), batch_size):
        batch = blocks[i:i + batch_size]
        print(f"Processing batch {i//batch_size + 1}/{(len(blocks)-1)//batch_size + 1}")

        max_retries = 5
        retry_delay = 15
        success = False

        for attempt in range(max_retries):
            try:
                batch_result = await process_llm_batch(batch)
                processed_blocks.extend(batch_result)
                await asyncio.sleep(6)  # Longer delay between batches
                success = True
                break
            except Exception as e:
                error_msg = str(e).lower()
                if "429" in error_msg or "quota" in error_msg or "exhausted" in error_msg:
                    if attempt < max_retries - 1:
                        print(f"Rate limit hit. Retrying in {retry_delay}s... (Attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        print(f"Rate limit hit persistently. Falling back to mock.")
                else:
                    print(f"Batch failed: {e}")
                    break

        if not success:
            has_mock_fallback = True
            mock_result = await mock_llm_processing(batch)
            processed_blocks.extend(mock_result)

    result_payload = {
        "videoId": f"{request.show_id}-S{request.season:02d}E{request.episode:02d}",
        "metadata": metadata,
        "transcript": processed_blocks,
        "summary": f"📺 {show_title_zh} 第{request.season}季 第{request.episode}集"
    }

    # Only cache if all batches succeeded (no mock fallback)
    if not has_mock_fallback:
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(result_payload, f, ensure_ascii=False, indent=2)
        print(f"Cached result: {cache_filename}")
    else:
        print(f"⚠️ Result contains mock translations, NOT caching. Retry later for full translation.")

    return result_payload


# --- Processed episodes lookup ---
@router.get("/api/shows/{show_id}/processed")
def get_processed_episodes(show_id: str):
    """Return a list of processed episode keys like ['S02E01', 'S04E03'] for a show."""
    prefix = f"{show_id}_S"
    processed = []
    for filename in os.listdir(HISTORY_DIR):
        if filename.startswith(prefix) and filename.endswith(".json"):
            # e.g. "house-of-cards_S02E01.json" -> "S02E01"
            key = filename[len(show_id) + 1:].replace(".json", "")
            processed.append(key)
    return {"processed": processed}


# ====================================================
# Sentence Packs（句子精背）— 静态精选句子，按级提供
# 详见 specs/009-sentence-packs/
# ====================================================

@router.get("/api/sentences/levels")
def list_sentence_levels():
    """各级索引：[{ id, title, subtitle, count, days }]"""
    index_path = os.path.join(SENTENCES_DIR, "index.json")
    if not os.path.exists(index_path):
        return []
    with open(index_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/api/sentences/level/{level_id}")
def get_sentence_level(level_id: int):
    """某一级的全部句子。"""
    path = os.path.join(SENTENCES_DIR, f"level-{int(level_id)}.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="该级句子不存在。")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
