"""把 YouTube 视频离线解析成 history/ 缓存（字幕走 yt-dlp，不走 youtube-transcript-api）。

什么时候用它：`youtube-transcript-api` 被 YouTube 限流（RequestBlocked / TranscriptsDisabled）
时，流式端点拿不到英文字幕。yt-dlp 走的是另一条通路，通常仍能取到官方字幕轨。

产出与 `/api/process-video-stream` 完全同构的 history JSON —— 同样的分句
（复用 backend/transcripts.py 的 `group_transcript_blocks`）、同样的文件名规则、
zh_text 先标 `[未翻译]`。之后由翻译环节把 zh_text / highlights / summary 填满，
App 里打开即命中缓存（`find_history_file_for_video`），秒开。

用法：
    backend/venv/bin/python scripts/ingest_youtube.py <url> [<url> ...]
    可选 --chunk-size 60   # 同时把翻译工单切到 history/.work/<videoId>/in_XXX.json
    可选 --allow-auto      # 没有人工字幕时退回自动生成字幕
"""
import argparse
import glob
import json
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_ROOT, "backend"))

import yt_dlp  # noqa: E402

from config import HISTORY_DIR  # noqa: E402
from transcripts import (  # noqa: E402
    extract_video_id,
    get_video_metadata,
    group_transcript_blocks,
)
from translate import UNTRANSLATED_MARKER  # noqa: E402

CAPTION_CACHE_DIR = os.path.join(HISTORY_DIR, ".work", "captions")
WORK_DIR = os.path.join(HISTORY_DIR, ".work")


# ----------------------------------------------------
# 字幕下载与解析
# ----------------------------------------------------

def download_captions(url: str, video_id: str, allow_auto: bool = False) -> str:
    """Download the English caption track as json3, return the file path.

    Cached on disk — a second run reuses the file instead of hitting YouTube.
    """
    os.makedirs(CAPTION_CACHE_DIR, exist_ok=True)
    existing = sorted(glob.glob(os.path.join(CAPTION_CACHE_DIR, f"{video_id}.en*.json3")))
    if existing:
        return existing[0]

    ydl_opts = {
        "skip_download": True,
        "writesubtitles": True,
        "writeautomaticsub": allow_auto,
        "subtitleslangs": ["en", "en-US", "en-GB", "en-orig"],
        "subtitlesformat": "json3",
        "outtmpl": os.path.join(CAPTION_CACHE_DIR, "%(id)s"),
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    files = sorted(glob.glob(os.path.join(CAPTION_CACHE_DIR, f"{video_id}.en*.json3")))
    if not files:
        raise RuntimeError(
            f"{video_id}: yt-dlp 没拿到英文字幕轨"
            + ("" if allow_auto else "（可加 --allow-auto 退回自动生成字幕）")
        )
    return files[0]


def parse_json3(path: str) -> list:
    """Convert a YouTube json3 caption file into transcript snippets.

    Returns dicts shaped like youtube-transcript-api's output
    ({text, start, duration}), which is what group_transcript_blocks eats.
    """
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    snippets = []
    for event in data.get("events") or []:
        segs = event.get("segs") or []
        text = "".join(seg.get("utf8", "") for seg in segs)
        text = text.replace("\n", " ").strip()
        if not text:
            continue
        start = event.get("tStartMs", 0) / 1000.0
        duration = event.get("dDurationMs", 0) / 1000.0
        snippets.append({"text": text, "start": start, "duration": duration})
    if not snippets:
        raise RuntimeError(f"{path}: 字幕文件里没有可用文本")
    return snippets


# ----------------------------------------------------
# 入库
# ----------------------------------------------------

def history_filename(metadata: dict, video_id: str) -> str:
    """Same rule as routes_videos._history_filename — keep the two in sync."""
    safe_channel = "".join(
        c for c in metadata.get("channel", "") if c.isalpha() or c.isdigit() or c == " "
    ).rstrip()
    if not safe_channel:
        safe_channel = "Unknown"
    return f"{safe_channel}_{metadata.get('upload_date', '')}_{video_id}.json".replace(" ", "_")


def ingest(url: str, chunk_size: int = 0, allow_auto: bool = False) -> dict:
    video_id = extract_video_id(url)
    metadata = get_video_metadata(url)
    caption_path = download_captions(url, video_id, allow_auto=allow_auto)
    blocks = group_transcript_blocks(parse_json3(caption_path))

    transcript = [
        {
            "id": idx + 1,
            "start": b["start"],
            "end": b["end"],
            "en_text": b["text"].replace("\n", " ").strip(),
            "zh_text": UNTRANSLATED_MARKER,
            "highlights": [],
        }
        for idx, b in enumerate(blocks)
    ]

    payload = {
        "videoId": video_id,
        "metadata": metadata,
        "transcript": transcript,
        "summary": "",
    }
    save_path = os.path.join(HISTORY_DIR, history_filename(metadata, video_id))
    with open(save_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    plain_path = write_plain_text(video_id, metadata, transcript)
    chunks = write_chunks(video_id, transcript, chunk_size) if chunk_size else []

    return {
        "plainText": os.path.relpath(plain_path, _ROOT),
        "videoId": video_id,
        "title": metadata.get("title"),
        "channel": metadata.get("channel"),
        "captionFile": os.path.relpath(caption_path, _ROOT),
        "historyFile": os.path.relpath(save_path, _ROOT),
        "blocks": len(transcript),
        "words": sum(len(b["en_text"].split()) for b in transcript),
        "lastEnd": round(transcript[-1]["end"], 1),
        "chunks": chunks,
    }


def write_plain_text(video_id: str, metadata: dict, transcript: list) -> str:
    """Dump the English side as one `[id] MM:SS text` line per block.

    A whole-episode view the block chunks can't give: the terminology brief and
    the summary both need the full arc, and one flat file is one read.
    """
    out_dir = os.path.join(WORK_DIR, video_id)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "en_full.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"# {metadata.get('title', '')} — {metadata.get('channel', '')}\n")
        f.write(f"# videoId={video_id} blocks={len(transcript)}\n\n")
        for b in transcript:
            mins, secs = divmod(int(b["start"]), 60)
            f.write(f"[{b['id']}] {mins:02d}:{secs:02d} {b['en_text']}\n")
    return path


def write_chunks(video_id: str, transcript: list, chunk_size: int) -> list:
    """Split the English blocks into translation work orders on disk.

    One file per chunk so each translator reads exactly its own slice, and a
    partially finished run can resume by looking at which out_*.json exist.
    """
    out_dir = os.path.join(WORK_DIR, video_id)
    os.makedirs(out_dir, exist_ok=True)
    chunks = []
    for i in range(0, len(transcript), chunk_size):
        slice_ = transcript[i:i + chunk_size]
        index = i // chunk_size + 1
        path = os.path.join(out_dir, f"in_{index:03d}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "videoId": video_id,
                    "chunk": index,
                    "blocks": [
                        {"id": b["id"], "start": b["start"], "end": b["end"], "en_text": b["en_text"]}
                        for b in slice_
                    ],
                },
                f,
                ensure_ascii=False,
                indent=2,
            )
        chunks.append({
            "chunk": index,
            "inPath": os.path.relpath(path, _ROOT),
            "outPath": os.path.relpath(os.path.join(out_dir, f"out_{index:03d}.json"), _ROOT),
            "count": len(slice_),
            "firstId": slice_[0]["id"],
            "lastId": slice_[-1]["id"],
        })
    return chunks


def main():
    ap = argparse.ArgumentParser(description="离线把 YouTube 视频解析进 history/")
    ap.add_argument("urls", nargs="+")
    ap.add_argument("--chunk-size", type=int, default=0, help="同时切出翻译工单，每份多少句")
    ap.add_argument("--allow-auto", action="store_true", help="没有人工字幕时用自动生成字幕")
    args = ap.parse_args()

    results = []
    for url in args.urls:
        try:
            results.append(ingest(url, chunk_size=args.chunk_size, allow_auto=args.allow_auto))
        except Exception as e:
            results.append({"url": url, "error": f"{type(e).__name__}: {e}"})
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
