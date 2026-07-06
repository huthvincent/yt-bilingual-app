"""字幕获取与切句：YouTube 字幕、yt-dlp 元数据、SRT 解析、Whisper 转写兜底。

产出统一的"片段"结构（text/start/duration 或 start/end），
供 translate.py 分批翻译。
"""
import datetime
import os
import re

import yt_dlp
from fastapi import HTTPException
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
    IpBlocked,
    RequestBlocked,
)


def extract_video_id(url: str) -> str:
    """Extract YouTube video ID from various URL formats"""
    patterns = [
        r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)',
        r'(?:https?:\/\/)?youtu\.be\/([^?]+)',
        r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)'
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    raise ValueError("Invalid YouTube URL")


def _split_at_sentence_boundaries(text: str) -> list:
    """Split text at sentence boundaries: .!? followed by a space and uppercase letter."""
    parts = []
    last = 0
    for m in re.finditer(r'[.!?]\s+(?=[A-Z])', text):
        end = m.start() + 1  # include the .!? character
        parts.append(text[last:end])
        last = m.end()  # skip the whitespace
    parts.append(text[last:])
    return [p for p in parts if p.strip()]


def group_transcript_blocks(transcript: list) -> list:
    """Group short transcript snippets into complete sentences.

    Two-phase approach:
    1. Split each raw snippet at internal sentence boundaries (e.g. "okay. Most" -> "okay." + "Most")
    2. Accumulate sub-snippets until we hit a sentence-ending boundary.
    3. Safety cutoff at 300 chars with intelligent clause-boundary splitting.
    """
    # Phase 1: Split raw snippets at internal sentence boundaries
    split_items = []

    for item in transcript:
        text = item.text.replace('\n', ' ') if hasattr(item, 'text') else item['text'].replace('\n', ' ')
        start = item.start if hasattr(item, 'start') else item['start']
        duration = item.duration if hasattr(item, 'duration') else item['duration']

        parts = _split_at_sentence_boundaries(text)

        if len(parts) <= 1:
            split_items.append({"text": text, "start": start, "duration": duration, "end": start + duration})
        else:
            total_chars = sum(len(p) for p in parts)
            current_start = start
            for p in parts:
                frac = len(p) / total_chars if total_chars > 0 else 1
                part_dur = duration * frac
                split_items.append({"text": p, "start": current_start, "duration": part_dur, "end": current_start + part_dur})
                current_start += part_dur

    # Phase 2: Accumulate split items into sentence blocks
    blocks = []
    current_block = None

    for i, item in enumerate(split_items):
        text = item["text"]

        if current_block is None:
            current_block = {"start": item["start"], "end": item["end"], "text": text}
        else:
            current_block["text"] += " " + text
            current_block["end"] = item["end"]

        text_so_far = current_block["text"].strip()
        text_len = len(text_so_far)

        # Primary: sentence-ending punctuation
        if re.search(r'[.!?]\s*$', text_so_far):
            blocks.append(current_block)
            current_block = None
            continue

        # Secondary: natural boundaries (only if enough text accumulated)
        has_long_pause = False
        if i + 1 < len(split_items):
            if split_items[i+1]["start"] - item["end"] > 1.2:
                has_long_pause = True

        starts_new_sentence = False
        if i + 1 < len(split_items):
            next_text = split_items[i+1]["text"].strip()
            if next_text and next_text[0].isupper():
                starts_new_sentence = True

        if text_len > 60 and (has_long_pause or starts_new_sentence):
            blocks.append(current_block)
            current_block = None
            continue

        # Safety cutoff at 300 chars
        if text_len > 300:
            best_break = -1
            for sep in [', and ', ', but ', ', so ', '; ', ', ']:
                pos = text_so_far.rfind(sep, text_len // 3)
                if pos > best_break:
                    best_break = pos + len(sep)

            if best_break > text_len // 3:
                first_part = text_so_far[:best_break].strip()
                remainder = text_so_far[best_break:].strip()
                blocks.append({"start": current_block["start"], "end": current_block["end"], "text": first_part})
                current_block = {"start": current_block["end"], "end": current_block["end"], "text": remainder} if remainder else None
            else:
                blocks.append(current_block)
                current_block = None

    if current_block:
        blocks.append(current_block)

    return blocks


def fetch_english_transcript(video_id: str):
    """Fetch the English transcript, mapping failures to actionable errors."""
    try:
        return YouTubeTranscriptApi().fetch(video_id, languages=['en'])
    except TranscriptsDisabled:
        raise HTTPException(status_code=422, detail="该视频关闭了字幕功能，无法获取英文字幕。")
    except NoTranscriptFound:
        raise HTTPException(status_code=422, detail="该视频没有英文字幕（包括自动生成字幕）。")
    except VideoUnavailable:
        raise HTTPException(status_code=404, detail="视频不可用：可能已删除、设为私密或有地区限制。")
    except (IpBlocked, RequestBlocked):
        raise HTTPException(status_code=429, detail="YouTube 暂时限制了当前 IP 的字幕请求，请稍后再试。")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"获取字幕失败：{e}")


def get_video_metadata(url: str):
    """Fetch video metadata using yt-dlp"""
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        return {
            "title": info.get('title', 'Unknown Title'),
            "channel": info.get('uploader', 'Unknown Channel'),
            "channel_url": info.get('channel_url', info.get('uploader_url', '')),
            "upload_date": info.get('upload_date', datetime.datetime.now().strftime("%Y%m%d")),
            "thumbnail": info.get('thumbnail', '')
        }


# ====================================================
# 本地 SRT 解析（供本地剧集使用）
# ====================================================

def parse_srt(content: str) -> list:
    """Parse SRT subtitle content into a list of blocks with start, end, text."""
    blocks = []
    # Split by double newline to get individual subtitle entries
    entries = re.split(r'\n\s*\n', content.strip())

    for entry in entries:
        lines = entry.strip().split('\n')
        if len(lines) < 3:
            continue

        # Parse timestamp line (format: 00:01:07,317 --> 00:01:09,194)
        time_match = re.match(
            r'(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})',
            lines[1]
        )
        if not time_match:
            continue

        h1, m1, s1, ms1, h2, m2, s2, ms2 = time_match.groups()
        start = int(h1) * 3600 + int(m1) * 60 + int(s1) + int(ms1) / 1000
        end = int(h2) * 3600 + int(m2) * 60 + int(s2) + int(ms2) / 1000

        # Join remaining lines as the subtitle text
        text = ' '.join(lines[2:]).strip()
        # Remove HTML tags sometimes found in SRT files
        text = re.sub(r'<[^>]+>', '', text)

        if text:
            blocks.append({"start": start, "end": end, "text": text})

    return blocks


def group_srt_blocks(blocks: list) -> list:
    """Group short SRT subtitle snippets into complete sentence-level blocks.

    Two-phase: split at internal sentence boundaries first, then accumulate.
    """
    # Phase 1: Split at internal sentence boundaries
    split_blocks = []
    for block in blocks:
        text = block["text"].strip()
        parts = _split_at_sentence_boundaries(text)

        if len(parts) <= 1:
            split_blocks.append(block)
        else:
            total_chars = sum(len(p) for p in parts)
            dur = block["end"] - block["start"]
            current_start = block["start"]
            for p in parts:
                frac = len(p) / total_chars if total_chars > 0 else 1
                part_dur = dur * frac
                split_blocks.append({"start": current_start, "end": current_start + part_dur, "text": p})
                current_start += part_dur

    # Phase 2: Accumulate
    grouped = []
    current = None

    for idx, block in enumerate(split_blocks):
        text = block["text"].strip()

        if current is None:
            current = {"start": block["start"], "end": block["end"], "text": text}
        else:
            current["text"] += " " + text
            current["end"] = block["end"]

        text_so_far = current["text"].strip()
        text_len = len(text_so_far)

        if re.search(r'[.!?]\s*$', text_so_far):
            grouped.append(current)
            current = None
            continue

        has_pause = False
        if idx + 1 < len(split_blocks):
            if split_blocks[idx + 1]["start"] - block["end"] > 1.5:
                has_pause = True

        if text_len > 40 and has_pause:
            grouped.append(current)
            current = None
            continue

        if text_len > 300:
            best_break = -1
            for sep in [', and ', ', but ', ', so ', '; ', ', ']:
                pos = text_so_far.rfind(sep, text_len // 3)
                if pos > best_break:
                    best_break = pos + len(sep)

            if best_break > text_len // 3:
                first_part = text_so_far[:best_break].strip()
                remainder = text_so_far[best_break:].strip()
                grouped.append({"start": current["start"], "end": current["end"], "text": first_part})
                current = {"start": current["end"], "end": current["end"], "text": remainder} if remainder else None
            else:
                grouped.append(current)
                current = None

    if current:
        grouped.append(current)

    return grouped


# ====================================================
# Whisper 转写兜底（可选依赖，无字幕视频用）
# ====================================================

def _asr_available() -> bool:
    """True if the optional faster-whisper dependency is installed."""
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


def _transcribe_audio_with_whisper(url: str) -> list:
    """Download the audio track and transcribe it locally with faster-whisper.

    Used as a fallback for videos without English captions. Returns snippet
    dicts compatible with group_transcript_blocks. Blocking — run in a thread.
    """
    import tempfile
    from faster_whisper import WhisperModel

    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.m4a")
        ydl_opts = {
            "format": "bestaudio[ext=m4a]/bestaudio",
            "outtmpl": audio_path,
            "quiet": True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        model_size = os.environ.get("WHISPER_MODEL", "base")
        model = WhisperModel(model_size, device="auto", compute_type="int8")
        segments, _info = model.transcribe(audio_path, language="en", vad_filter=True)
        return [
            {"text": seg.text.strip(), "start": seg.start, "duration": seg.end - seg.start}
            for seg in segments if seg.text.strip()
        ]
