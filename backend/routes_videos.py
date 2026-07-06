"""视频路由：估价、处理（经典/流式）、历史记录、频道更新。

流式端点是产品核心（详见 specs/001-streaming-pipeline/）：
英文字幕先到先给，翻译逐批推送并落盘，中断自愈。
"""
import asyncio
import datetime
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import HISTORY_DIR, MODEL_CATALOG, resolve_model
from transcripts import (
    extract_video_id,
    fetch_english_transcript,
    get_video_metadata,
    group_transcript_blocks,
    _asr_available,
    _transcribe_audio_with_whisper,
)
from translate import (
    UNTRANSLATED_MARKER,
    _stream_translate,
    find_history_file_for_video,
    mock_llm_processing,
    needs_retranslation,
    process_llm_batch,
    retranslate_marked_blocks,
    summarize_video_transcript,
)

router = APIRouter()


class VideoRequest(BaseModel):
    url: str
    model: str | None = None
    vocab_level: str | None = None


# Metadata + transcript fetched during cost estimation, reused on confirm
# so the user doesn't wait for yt-dlp twice.
_prefetch_cache: dict = {}  # video_id -> (fetched_at, metadata, transcript)
PREFETCH_CACHE_TTL_SECONDS = 600


@router.get("/api/estimate-cost")
def estimate_cost(url: str):
    try:
        video_id = extract_video_id(url)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的 YouTube 链接，请检查后重试。")

    try:
        metadata = get_video_metadata(url)
    except Exception as e:
        print(f"Failed to fetch metadata for estimate: {e}")
        metadata = {"title": "Unknown Title", "channel": "Unknown Channel", "thumbnail": ""}

    # Fetch English transcript to calculate length
    transcript = fetch_english_transcript(video_id)

    # Reuse this fetch when the user confirms processing right after
    _prefetch_cache[video_id] = (time.time(), metadata, transcript)

    # Calculate rough token estimate. (English word ~ 1.3 tokens).
    # We also have the system prompt and Chinese output.
    full_text = " ".join([t.text for t in transcript])
    word_count = len(full_text.split())

    # Rough estimates:
    input_tokens = int(word_count * 1.5)  # input text + prompt overhead
    output_tokens = int(word_count * 2.0)  # chinese translation + JSON overhead

    def calc_cost(model_id):
        rates = MODEL_CATALOG[model_id]
        in_cost = (input_tokens / 1_000_000) * rates["in"]
        out_cost = (output_tokens / 1_000_000) * rates["out"]
        return round(in_cost + out_cost, 6)

    models = [
        {
            "id": model_id,
            "name": spec["name"],
            "provider": spec["provider"],
            "estimatedCost": calc_cost(model_id),
            "available": True,
            "quotaInfo": spec["quotaInfo"],
        }
        for model_id, spec in MODEL_CATALOG.items()
    ]

    return {
        "videoId": video_id,
        "metadata": metadata,
        "transcriptStats": {
            "wordCount": word_count,
            "estimatedInputTokens": input_tokens,
            "estimatedOutputTokens": output_tokens
        },
        "models": models
    }


@router.post("/api/process-video")
async def process_video(request: VideoRequest):
    try:
        video_id = extract_video_id(request.url)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的 YouTube 链接，请检查后重试。")

    # Already processed? Serve the cached result (repairing any failed
    # translations) instead of re-fetching and re-paying for the whole video.
    cached_path = find_history_file_for_video(video_id)
    if cached_path:
        print(f"Serving cached result for {video_id}: {os.path.basename(cached_path)}")
        try:
            with open(cached_path, "r", encoding="utf-8") as f:
                cached_data = json.load(f)
            return await retranslate_marked_blocks(cached_data, cached_path)
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Cache file corrupt, reprocessing: {e}")

    try:
        metadata = get_video_metadata(request.url)
    except Exception as e:
        print(f"Failed to fetch metadata: {e}")
        metadata = {
            "title": "Unknown Title",
            "channel": "Unknown Channel",
            "upload_date": datetime.datetime.now().strftime("%Y%m%d"),
            "thumbnail": ""
        }

    # Fetch English transcript
    transcript = fetch_english_transcript(video_id)

    # Group transcript snippets into sentences/blocks
    blocks = group_transcript_blocks(transcript)

    # Assign global unique IDs
    for idx, b in enumerate(blocks):
        b["id"] = idx + 1

    # Process blocks in batches of 20 to stay within limits and ensure quality JSON
    processed_blocks = []
    batch_size = 20

    print(f"Processing {len(blocks)} blocks in batches of {batch_size}...")

    # Limit removed to allow processing of full-length videos
    blocks_to_process = blocks

    for i in range(0, len(blocks_to_process), batch_size):
        batch = blocks_to_process[i:i + batch_size]
        print(f"Processing batch {i//batch_size + 1}/{(len(blocks_to_process)-1)//batch_size + 1}")

        max_retries = 3
        retry_delay = 10  # Start with 10s delay if rate limited
        success = False

        for attempt in range(max_retries):
            try:
                batch_result = await process_llm_batch(batch)
                processed_blocks.extend(batch_result)
                await asyncio.sleep(4)  # Standard 15 RPM delay -> 1 req / 4s
                success = True
                break  # Break out of retry loop
            except Exception as e:
                error_msg = str(e).lower()
                if "429" in error_msg or "quota" in error_msg or "exhausted" in error_msg:
                    if attempt < max_retries - 1:
                        print(f"Rate limit hit (429). Retrying in {retry_delay}s... (Attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff: 10s, 20s, etc.
                    else:
                        print(f"Rate limit hit persistently. Falling back to mock for this batch. Error: {e}")
                else:
                    print(f"Batch {i//batch_size + 1} failed with non-retryable error: {e}")
                    break  # Don't retry for other types of errors (e.g. malformed JSON)

        if not success:
            mock_result = await mock_llm_processing(batch)
            processed_blocks.extend(mock_result)

    # Generate summary based on original English blocks
    print("Generating video summary...")
    summary_text = await summarize_video_transcript(blocks)

    # Save to history
    safe_channel = "".join([c for c in metadata["channel"] if c.isalpha() or c.isdigit() or c == ' ']).rstrip()
    if not safe_channel:
        safe_channel = "Unknown"
    date_str = metadata["upload_date"]
    filename = f"{safe_channel}_{date_str}_{video_id}.json".replace(" ", "_")

    result_payload = {
        "videoId": video_id,
        "metadata": metadata,
        "transcript": processed_blocks,
        "summary": summary_text
    }

    file_path = os.path.join(HISTORY_DIR, filename)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(result_payload, f, ensure_ascii=False, indent=2)

    return result_payload


# ====================================================
# Streaming processing (SSE) — English subtitles appear immediately,
# translations fill in batch by batch, partial progress is persisted so
# a cancelled run resumes (self-heals) on the next load.
# ====================================================

def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _history_filename(metadata: dict, video_id: str) -> str:
    safe_channel = "".join([c for c in metadata.get("channel", "") if c.isalpha() or c.isdigit() or c == ' ']).rstrip()
    if not safe_channel:
        safe_channel = "Unknown"
    return f"{safe_channel}_{metadata.get('upload_date', '')}_{video_id}.json".replace(" ", "_")


@router.post("/api/process-video-stream")
async def process_video_stream(request: VideoRequest):
    async def gen():
        try:
            try:
                video_id = extract_video_id(request.url)
            except ValueError:
                yield _sse("error", {"detail": "无效的 YouTube 链接，请检查后重试。"})
                return

            # --- Cached video: send everything we have, then repair gaps ---
            cached_path = find_history_file_for_video(video_id)
            cached = None
            if cached_path:
                try:
                    with open(cached_path, "r", encoding="utf-8") as f:
                        cached = json.load(f)
                except json.JSONDecodeError:
                    cached = None

            if cached and cached.get("transcript"):
                transcript = cached["transcript"]
                yield _sse("meta", {
                    "videoId": cached.get("videoId", video_id),
                    "metadata": cached.get("metadata", {}),
                    "blocks": transcript,
                    "cached": True,
                })
                pending = [i for i, b in enumerate(transcript) if needs_retranslation(b.get("zh_text", ""))]
                if pending:
                    async for update in _stream_translate(transcript, pending, cached, cached_path):
                        yield _sse("batch", update)
                yield _sse("summary", {"summary": cached.get("summary", "")})
                yield _sse("done", {"cached": True})
                return

            # --- Fresh video ---
            model = resolve_model(request.model)

            # Reuse the fetch from a just-run cost estimation when possible
            prefetched = _prefetch_cache.pop(video_id, None)
            if prefetched and time.time() - prefetched[0] < PREFETCH_CACHE_TTL_SECONDS:
                metadata, raw_transcript = prefetched[1], prefetched[2]
            else:
                try:
                    raw_transcript = fetch_english_transcript(video_id)
                except HTTPException as e:
                    # No captions? Fall back to local ASR when available.
                    if e.status_code == 422 and _asr_available():
                        yield _sse("stage", {"stage": "asr"})
                        try:
                            raw_transcript = await asyncio.to_thread(_transcribe_audio_with_whisper, request.url)
                        except Exception as asr_err:
                            yield _sse("error", {"detail": f"该视频无字幕，本地转写也失败了:{asr_err}"})
                            return
                        if not raw_transcript:
                            yield _sse("error", {"detail": "本地转写未识别出任何语音内容。"})
                            return
                    elif e.status_code == 422:
                        yield _sse("error", {
                            "detail": e.detail + " 提示：安装本地转写组件后可支持无字幕视频"
                                                "（backend 环境运行 pip install faster-whisper）。"
                        })
                        return
                    else:
                        yield _sse("error", {"detail": e.detail})
                        return

                try:
                    metadata = get_video_metadata(request.url)
                except Exception as e:
                    print(f"Failed to fetch metadata: {e}")
                    metadata = {
                        "title": "Unknown Title",
                        "channel": "Unknown Channel",
                        "upload_date": datetime.datetime.now().strftime("%Y%m%d"),
                        "thumbnail": ""
                    }
            if "upload_date" not in metadata or not metadata.get("upload_date"):
                metadata["upload_date"] = datetime.datetime.now().strftime("%Y%m%d")

            en_blocks = group_transcript_blocks(raw_transcript)
            transcript = []
            for idx, b in enumerate(en_blocks):
                transcript.append({
                    "id": idx + 1,
                    "start": b["start"],
                    "end": b["end"],
                    "en_text": b["text"].replace("\n", " ").strip(),
                    "zh_text": UNTRANSLATED_MARKER,
                    "highlights": [],
                })

            payload = {
                "videoId": video_id,
                "metadata": metadata,
                "transcript": transcript,
                "summary": "",
            }
            save_path = os.path.join(HISTORY_DIR, _history_filename(metadata, video_id))
            with open(save_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)

            # English is ready — let the user start watching now
            yield _sse("meta", {
                "videoId": video_id,
                "metadata": metadata,
                "blocks": transcript,
                "cached": False,
            })

            async for update in _stream_translate(transcript, list(range(len(transcript))), payload, save_path, model=model, vocab_level=request.vocab_level):
                yield _sse("batch", update)

            yield _sse("stage", {"stage": "summary"})
            summary_text = await summarize_video_transcript([{"text": b["en_text"]} for b in transcript], model=model)
            payload["summary"] = summary_text
            with open(save_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)

            yield _sse("summary", {"summary": summary_text})
            yield _sse("done", {"cached": False})

        except Exception as e:
            print(f"Stream processing error: {e}")
            yield _sse("error", {"detail": f"处理失败：{e}"})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/api/history")
def list_history():
    files = []
    if os.path.exists(HISTORY_DIR):
        for f in os.listdir(HISTORY_DIR):
            if f.endswith('.json') and f not in ["favorites.json", "subscriptions.json"]:
                file_path = os.path.join(HISTORY_DIR, f)
                try:
                    with open(file_path, "r", encoding="utf-8") as file:
                        data = json.load(file)
                        mtime = os.path.getmtime(file_path)
                        files.append({
                            "filename": f,
                            "videoId": data.get("videoId"),
                            "metadata": data.get("metadata", {}),
                            "mtime": mtime
                        })
                except Exception as e:
                    print(f"Error reading history file {f}: {e}")
                    files.append({"filename": f, "metadata": {}})

    # Sort files by the local processing time (mtime), descending
    files.sort(key=lambda x: x.get("mtime", 0), reverse=True)
    return files


@router.get("/api/history/{filename}")
async def get_history(filename: str):
    # Guard against path traversal — only bare filenames inside HISTORY_DIR
    if os.path.basename(filename) != filename:
        raise HTTPException(status_code=404, detail="History file not found")
    file_path = os.path.join(HISTORY_DIR, filename)
    if not os.path.exists(file_path) or not filename.endswith('.json'):
        raise HTTPException(status_code=404, detail="History file not found")

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Self-heal mock/failed translations left over from rate-limited runs
    if isinstance(data, dict) and data.get("transcript"):
        data = await retranslate_marked_blocks(data, file_path)
    return data


class ChannelUpdatesRequest(BaseModel):
    channels: list[str]


# Channel feeds change slowly; cache per-channel results so revisiting the
# dashboard doesn't re-run yt-dlp for every subscription.
_channel_cache: dict = {}  # channel_url -> (fetched_at, updates)
CHANNEL_CACHE_TTL_SECONDS = 900


def _fetch_channel_videos(channel_url: str) -> list:
    """Fetch the latest videos for one channel (blocking, run in a thread)."""
    import yt_dlp

    cached = _channel_cache.get(channel_url)
    if cached and time.time() - cached[0] < CHANNEL_CACHE_TTL_SECONDS:
        return cached[1]

    updates = []
    ydl_opts = {
        'extract_flat': 'in_playlist',
        'playlistend': 5,  # Top 5 recent videos per channel
        'quiet': True,
    }
    try:
        target_url = channel_url.rstrip("/") + "/videos" if not channel_url.endswith("/videos") else channel_url
        # One YoutubeDL instance per call: instances are not thread-safe
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(target_url, download=False)

        channel_name = info.get('uploader', info.get('title', 'Unknown Channel'))
        for entry in info.get('entries') or []:
            if not entry:
                continue
            video_id = entry.get('id')
            title = entry.get('title')
            if video_id and title:
                updates.append({
                    "videoId": video_id,
                    "title": title,
                    "channel": channel_name,
                    "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
                })
        _channel_cache[channel_url] = (time.time(), updates)
    except Exception as e:
        print(f"Error fetching updates for {channel_url}: {e}")
    return updates


@router.post("/api/channel-updates")
def get_channel_updates(request: ChannelUpdatesRequest):
    channels = [c for c in request.channels if c]
    if not channels:
        return {"updates": []}
    # Fetch all subscribed channels concurrently instead of one-by-one
    with ThreadPoolExecutor(max_workers=min(8, len(channels))) as pool:
        results = pool.map(_fetch_channel_videos, channels)
    return {"updates": [u for channel_updates in results for u in channel_updates]}
