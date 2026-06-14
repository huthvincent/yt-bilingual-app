import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
    IpBlocked,
    RequestBlocked,
)
import asyncio
import yt_dlp
import json
import os
import time
import datetime
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

# Load .env file (for GEMINI_API_KEY etc.)
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

app = FastAPI()

# Ensure history directory exists
# In Docker/cloud, override via env var; locally uses relative path from backend/
HISTORY_DIR = os.environ.get("HISTORY_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "history"))
os.makedirs(HISTORY_DIR, exist_ok=True)

# --- Security configuration ---
# CORS_ORIGINS: comma-separated allowed origins. Defaults to "*" for local
# use; ALWAYS set this when deploying publicly.
_cors_env = os.environ.get("CORS_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()] or ["*"]

# API_AUTH_KEY: when set, every /api request must carry a matching X-API-Key
# header. Without it a public deployment is an open proxy for your Gemini key.
API_AUTH_KEY = os.environ.get("API_AUTH_KEY", "")

if ALLOWED_ORIGINS == ["*"] and not API_AUTH_KEY:
    print("⚠️  Running fully open (CORS * / no API key) — fine locally, "
          "set CORS_ORIGINS and API_AUTH_KEY before deploying publicly.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def require_api_key(request, call_next):
    if (
        API_AUTH_KEY
        and request.url.path.startswith("/api")
        and request.method != "OPTIONS"  # let CORS preflight through
        and request.headers.get("x-api-key") != API_AUTH_KEY
    ):
        return JSONResponse(status_code=401, content={"detail": "缺少或错误的 API Key。"})
    return await call_next(request)

class VideoRequest(BaseModel):
    url: str
    model: str | None = None
    vocab_level: str | None = None


# Learner level -> description used to calibrate which words get highlighted.
# UI shows metaphors only; the vocabulary sizes live here for the prompt.
VOCAB_LEVELS = {
    "liftoff": "~4,000-word vocabulary (CEFR A2-B1). Highlight anything beyond everyday conversational basics.",
    "orbit": "~6,000-word vocabulary (CEFR B1+). Highlight words beyond common conversational English.",
    "moonwalk": "~8,000-word vocabulary (CEFR B2). Highlight lower-frequency words, idioms and phrasal verbs.",
    "interstellar": "~12,000-word vocabulary (CEFR C1). Highlight genuinely advanced or idiomatic usage only.",
    "deep-space": "~16,000-word vocabulary (CEFR C1+). Highlight only rare words, subtle idioms, cultural references.",
    "supernova": "~20,000+ word vocabulary (near-native, CEFR C2). Only the rarest idioms, slang or specialist jargon.",
    # Legacy ids from earlier releases
    "cet4": "~4,500-word vocabulary (CEFR B1). Highlight words above this level.",
    "cet6": "~6,000-word vocabulary (CEFR B2). Highlight words above this level.",
    "kaoyan": "~8,000-word vocabulary (CEFR B2+). Highlight low-frequency words, idioms and phrasal verbs.",
    "ielts": "~12,000-word vocabulary (CEFR C1). Only highlight genuinely advanced or idiomatic usage.",
    "advanced": "near-native (CEFR C2). Only highlight rare idioms, slang, or cultural references.",
}


# Real, selectable models. Prices are USD per 1M tokens (approximate,
# check https://ai.google.dev/pricing for current numbers).
MODEL_CATALOG = {
    "gemini-2.5-flash": {
        "name": "Gemini 2.5 Flash", "provider": "Google",
        "in": 0.30, "out": 2.50, "quotaInfo": "Default · balanced quality & speed",
    },
    "gemini-2.5-flash-lite": {
        "name": "Gemini 2.5 Flash-Lite", "provider": "Google",
        "in": 0.10, "out": 0.40, "quotaInfo": "Cheapest · great for long videos",
    },
    "gemini-2.5-pro": {
        "name": "Gemini 2.5 Pro", "provider": "Google",
        "in": 1.25, "out": 10.00, "quotaInfo": "Highest quality · slower",
    },
}
DEFAULT_MODEL = "gemini-2.5-flash"


def resolve_model(model: str | None) -> str:
    return model if model in MODEL_CATALOG else DEFAULT_MODEL

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

from google import genai
from google.genai import types
import json
import os

# Marker for blocks whose translation is missing/failed; such blocks are
# re-translated automatically the next time the video is loaded.
UNTRANSLATED_MARKER = "[未翻译]"

def _norm_id(v):
    """Normalize block ids for matching (models sometimes return '1' for 1)."""
    try:
        return int(v)
    except (TypeError, ValueError):
        return v

def needs_retranslation(zh_text: str) -> bool:
    """True if a stored zh_text is a mock/failed translation placeholder."""
    if not zh_text:
        return True
    return (
        "模拟中文翻译" in zh_text
        or zh_text == "翻译失败"
        or zh_text.startswith(UNTRANSLATED_MARKER)
    )

async def process_llm_batch(blocks: list, model: str = DEFAULT_MODEL, vocab_level: str | None = None) -> list:
    """Use Gemini API to return Chinese translations and highlights"""
    client = genai.Client()

    level_instruction = ""
    if vocab_level in VOCAB_LEVELS:
        level_instruction = (
            f"\n    The learner's English level: {VOCAB_LEVELS[vocab_level]}"
            "\n    Only highlight words/phrases likely ABOVE this level; skip anything they already know."
        )
    
    # We will format the prompt to request a JSON response
    # We pass the strings we want translated
    input_data = []
    for block in blocks:
        en_text = block["text"].replace("\n", " ").strip()
        input_data.append({
            "id": block.get("id"),
            "text": en_text,
            "start": block["start"],
            "end": block["end"]
        })
        
    prompt = f"""
    You are an expert bilingual English-Chinese teacher.
    I will provide a JSON list of transcript blocks.
    For each block, you must:
    1. Provide a natural Chinese translation.
    2. Identify 0 to 2 advanced words or phrases (idioms, phrasal verbs, hard vocabulary).{level_instruction}
    3. Return the exact substring of the advanced word in English, and its exact translated substring in the Chinese sentence.
    
    CRITICAL: YOU MUST Return a JSON list with exactly the same IDs, adding these fields:
    - en_text: the original text
    - zh_text: the Chinese translation
    - highlights: list of objects with 'en_word', 'zh_word', and 'color'. The color MUST be exactly "text-purple-400 border-b border-dashed border-purple-400"
    
    Input data:
    {json.dumps(input_data, ensure_ascii=False)}
    """
    
    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        
        # Parse the response back into our block format
        result_data = json.loads(response.text)

        # Match results back by id — models occasionally drop or reorder items,
        # and a positional zip would silently attach translations to the wrong
        # sentences (and truncate the batch when items are missing).
        results_list = result_data if isinstance(result_data, list) else []
        by_id = {}
        for res in results_list:
            if isinstance(res, dict) and res.get("id") is not None:
                by_id[_norm_id(res["id"])] = res
        use_positional = not by_id  # model dropped ids entirely

        processed_blocks = []
        for i, orig in enumerate(input_data):
            if use_positional:
                res = results_list[i] if i < len(results_list) and isinstance(results_list[i], dict) else {}
            else:
                res = by_id.get(_norm_id(orig["id"]), {})
            processed_blocks.append({
                "id": orig["id"],
                "start": orig["start"],
                "end": orig["end"],
                "en_text": orig["text"],
                "zh_text": res.get("zh_text") or UNTRANSLATED_MARKER,
                "highlights": res.get("highlights") or []
            })

        missing = sum(1 for b in processed_blocks if b["zh_text"] == UNTRANSLATED_MARKER)
        if missing:
            print(f"Warning: {missing}/{len(input_data)} blocks came back untranslated in this batch")

        return processed_blocks
        
    except Exception as e:
        print(f"Gemini API Error: {e}")
        # Fallback to mock if API fails or parsing fails
        return await mock_llm_processing(blocks)

async def mock_llm_processing(blocks: list) -> list:
    """Fallback Mock LLM processing"""
    await asyncio.sleep(0.5)
    processed_blocks = []
    for block in blocks:
        en_text = block["text"].replace("\n", " ").strip()
        processed_blocks.append({
            "id": block.get("id"),
            "start": block["start"],
            "end": block["end"],
            "en_text": en_text,
            "zh_text": f"这是对英文句子“{en_text[:10]}...”的一句模拟中文翻译。",
            "highlights": []
        })
    return processed_blocks

async def summarize_video_transcript(blocks: list, model: str = DEFAULT_MODEL) -> str:
    """Use Gemini API to generate a summary of the video based on the transcript"""
    full_text = " ".join([b["text"] for b in blocks])
    # If it's too long, truncate it to save tokens (approx 20 mins of speech)
    if len(full_text) > 20000:
        full_text = full_text[:20000] + "..."
        
    client = genai.Client()
    summary_prompt = f"""
    Please read the following English transcript from a YouTube video and provide a concise summary in Chinese.
    Focus on extracting the core knowledge points and main ideas. 
    Use bullet points to organize the summary. Keep it brief and educational.
    
    Transcript:
    {full_text}
    """
    
    try:
        response = client.models.generate_content(
            model=model,
            contents=summary_prompt,
        )
        return response.text
    except Exception as e:
        print(f"Summary Gen Error: {e}")
        return "无法生成总结，请稍后再试或检查 API 配额。"

@app.get("/api/estimate-cost")
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

# Metadata + transcript fetched during cost estimation, reused on confirm
# so the user doesn't wait for yt-dlp twice.
_prefetch_cache: dict = {}  # video_id -> (fetched_at, metadata, transcript)
PREFETCH_CACHE_TTL_SECONDS = 600


def find_history_file_for_video(video_id: str):
    """Locate an existing history file for a YouTube video id, if any."""
    if not os.path.exists(HISTORY_DIR):
        return None
    suffix = f"_{video_id}.json"
    for f in os.listdir(HISTORY_DIR):
        if f.endswith(suffix):
            return os.path.join(HISTORY_DIR, f)
    return None


async def retranslate_marked_blocks(data: dict, cache_path: str) -> dict:
    """Re-translate mock/failed blocks in a cached payload, saving progress.

    Shared by the YouTube and local-subtitle flows so partially translated
    results self-heal whenever they are loaded again.
    """
    transcript = data.get("transcript", [])
    mock_indices = [i for i, b in enumerate(transcript) if needs_retranslation(b.get("zh_text", ""))]
    if not mock_indices:
        return data

    print(f"Re-translating {len(mock_indices)} blocks in {os.path.basename(cache_path)}...")
    batch_size = 20
    for batch_start in range(0, len(mock_indices), batch_size):
        batch_indices = mock_indices[batch_start:batch_start + batch_size]
        batch_blocks = [{
            "id": transcript[idx].get("id"),
            "start": transcript[idx]["start"],
            "end": transcript[idx]["end"],
            "text": transcript[idx]["en_text"],
        } for idx in batch_indices]

        max_retries = 5
        retry_delay = 15
        for attempt in range(max_retries):
            try:
                batch_result = await process_llm_batch(batch_blocks)
                for j, idx in enumerate(batch_indices):
                    if j < len(batch_result):
                        transcript[idx] = batch_result[j]
                await asyncio.sleep(6)
                break
            except Exception as e:
                error_msg = str(e).lower()
                if "429" in error_msg or "quota" in error_msg or "exhausted" in error_msg:
                    if attempt < max_retries - 1:
                        print(f"Rate limit. Retrying in {retry_delay}s... ({attempt+1}/{max_retries})")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        print("Still rate limited; remaining blocks stay marked for next load.")
                else:
                    print(f"Re-translation batch failed: {e}")
                    break

    data["transcript"] = transcript
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return data


@app.post("/api/process-video")
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
        retry_delay = 10 # Start with 10s delay if rate limited
        success = False
        
        for attempt in range(max_retries):
            try:
                batch_result = await process_llm_batch(batch)
                processed_blocks.extend(batch_result)
                await asyncio.sleep(4) # Standard 15 RPM delay -> 1 req / 4s
                success = True
                break # Break out of retry loop
            except Exception as e:
                error_msg = str(e).lower()
                if "429" in error_msg or "quota" in error_msg or "exhausted" in error_msg:
                    if attempt < max_retries - 1:
                        print(f"Rate limit hit (429). Retrying in {retry_delay}s... (Attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2 # Exponential backoff: 10s, 20s, etc.
                    else:
                        print(f"Rate limit hit persistently. Falling back to mock for this batch. Error: {e}")
                else:
                    print(f"Batch {i//batch_size + 1} failed with non-retryable error: {e}")
                    break # Don't retry for other types of errors (e.g. malformed JSON)
        
        if not success:
            mock_result = await mock_llm_processing(batch)
            processed_blocks.extend(mock_result)
            
    # Generate summary based on original English blocks
    print("Generating video summary...")
    summary_text = await summarize_video_transcript(blocks)
            
    # Save to history
    safe_channel = "".join([c for c in metadata["channel"] if c.isalpha() or c.isdigit() or c==' ']).rstrip()
    if not safe_channel: safe_channel = "Unknown"
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


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _history_filename(metadata: dict, video_id: str) -> str:
    safe_channel = "".join([c for c in metadata.get("channel", "") if c.isalpha() or c.isdigit() or c == ' ']).rstrip()
    if not safe_channel:
        safe_channel = "Unknown"
    return f"{safe_channel}_{metadata.get('upload_date', '')}_{video_id}.json".replace(" ", "_")


async def _stream_translate(transcript: list, indices: list, payload: dict, save_path: str, model: str = DEFAULT_MODEL, vocab_level: str | None = None):
    """Translate the given transcript indices batch by batch.

    Yields a dict per batch with the freshly translated blocks and overall
    progress. Persists the payload after every batch so interrupted runs
    keep their progress (untranslated blocks stay marked and self-heal).
    """
    total = len(indices)
    done = 0
    batch_size = 20
    for batch_start in range(0, total, batch_size):
        batch_indices = indices[batch_start:batch_start + batch_size]
        batch_blocks = [{
            "id": transcript[i].get("id"),
            "start": transcript[i]["start"],
            "end": transcript[i]["end"],
            "text": transcript[i]["en_text"],
        } for i in batch_indices]

        try:
            result = await process_llm_batch(batch_blocks, model=model, vocab_level=vocab_level)
            for j, idx in enumerate(batch_indices):
                if j < len(result):
                    transcript[idx] = result[j]
        except Exception as e:
            print(f"Streaming batch failed (blocks stay marked for retry): {e}")

        done += len(batch_indices)
        payload["transcript"] = transcript
        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

        yield {
            "blocks": [transcript[i] for i in batch_indices],
            "progress": {"done": done, "total": total},
        }
        if batch_start + batch_size < total:
            await asyncio.sleep(4)  # free-tier 15 RPM pacing


@app.post("/api/process-video-stream")
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


@app.get("/api/history")
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

@app.get("/api/history/{filename}")
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


@app.post("/api/channel-updates")
def get_channel_updates(request: ChannelUpdatesRequest):
    channels = [c for c in request.channels if c]
    if not channels:
        return {"updates": []}
    # Fetch all subscribed channels concurrently instead of one-by-one
    with ThreadPoolExecutor(max_workers=min(8, len(channels))) as pool:
        results = pool.map(_fetch_channel_videos, channels)
    return {"updates": [u for channel_updates in results for u in channel_updates]}

# ====================================================
# Local Subtitle (SRT) Integration
# ====================================================

SUBTITLES_DIR = os.environ.get("SUBTITLES_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "subtitles"))

# Show metadata for display purposes
SHOW_METADATA = {
    "house-of-cards": {
        "title": "House of Cards",
        "title_zh": "纸牌屋",
        "thumbnail": "/images/house-of-cards.png",
        "seasons": {1: 13, 2: 13, 3: 13, 4: 13, 5: 13, 6: 8}
    }
}

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



@app.get("/api/shows")
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


@app.get("/api/shows/{show_id}/seasons")
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


@app.post("/api/process-subtitle")
async def process_subtitle(request: SubtitleRequest):
    """Process a local SRT subtitle file through Gemini translation."""
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
    
    # Process through Gemini translation (same batching as YouTube)
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
@app.get("/api/shows/{show_id}/processed")
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
# Click-to-define dictionary
# ====================================================

DICT_CACHE_FILE = os.path.join(HISTORY_DIR, "dictionary_cache.json")
DICT_MODEL = "gemini-2.5-flash-lite"  # fast + cheap for single-word lookups


class DefineRequest(BaseModel):
    word: str
    context: str | None = None


def _load_dict_cache() -> dict:
    if os.path.exists(DICT_CACHE_FILE):
        try:
            with open(DICT_CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass
    return {}


@app.post("/api/define")
async def define_word(request: DefineRequest):
    word = request.word.strip()
    if not word or len(word) > 100:
        raise HTTPException(status_code=400, detail="无效的查询词。")

    # Cache by lowercase word; first lookup wins (context only refines the
    # initial generation — good enough and keeps repeat lookups free).
    cache = _load_dict_cache()
    key = word.lower()
    if key in cache:
        return cache[key]

    context_part = f'It appears in this sentence: "{request.context.strip()}"' if request.context else ""
    prompt = f"""You are an English-Chinese dictionary for Chinese learners of English.
Explain the English word or phrase "{word}". {context_part}
Return ONLY a JSON object with exactly these fields:
{{
  "word": "{word}",
  "lemma": "base/dictionary form",
  "ipa": "IPA pronunciation like /ˈwɜːrd/",
  "pos": "part of speech abbreviation (n. / v. / adj. / adv. / phrase ...)",
  "zh": "简明中文释义，优先该语境下的含义，不超过 20 字",
  "definition_en": "concise English definition (one sentence)",
  "example": "one short, natural example sentence in English"
}}"""

    try:
        client = genai.Client()
        response = client.models.generate_content(
            model=DICT_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        result = json.loads(response.text)
        if isinstance(result, list):
            result = result[0] if result else {}
        result.setdefault("word", word)
    except Exception as e:
        print(f"Dictionary lookup failed for '{word}': {e}")
        raise HTTPException(status_code=502, detail="查词失败，请稍后重试。")

    cache[key] = result
    try:
        with open(DICT_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    except OSError as e:
        print(f"Failed to persist dictionary cache: {e}")
    return result


# --- Favorites persistence ---
FAVORITES_FILE = os.path.join(HISTORY_DIR, "favorites.json")

@app.get("/api/favorites")
def get_favorites():
    if os.path.exists(FAVORITES_FILE):
        with open(FAVORITES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

@app.put("/api/favorites")
async def save_favorites(request: dict):
    favorites = request.get("favorites", [])
    with open(FAVORITES_FILE, "w", encoding="utf-8") as f:
        json.dump(favorites, f, ensure_ascii=False, indent=2)
    return {"status": "ok", "count": len(favorites)}


# --- Subscriptions persistence ---
SUBS_FILE = os.path.join(HISTORY_DIR, "subscriptions.json")

@app.get("/api/subscriptions")
def get_subscriptions():
    if os.path.exists(SUBS_FILE):
        with open(SUBS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

@app.put("/api/subscriptions")
async def save_subscriptions(request: dict):
    subs = request.get("subscriptions", [])
    with open(SUBS_FILE, "w", encoding="utf-8") as f:
        json.dump(subs, f, ensure_ascii=False, indent=2)
    return {"status": "ok", "count": len(subs)}


# ====================================================
# Sentence Packs（句子精背）— 静态精选句子，按级提供
# 详见 specs/009-sentence-packs/
# ====================================================

SENTENCES_DIR = os.environ.get(
    "SENTENCES_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "content", "sentences"),
)


@app.get("/api/sentences/levels")
def list_sentence_levels():
    """各级索引：[{ id, title, subtitle, count, days }]"""
    index_path = os.path.join(SENTENCES_DIR, "index.json")
    if not os.path.exists(index_path):
        return []
    with open(index_path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/sentences/level/{level_id}")
def get_sentence_level(level_id: int):
    """某一级的全部句子。"""
    path = os.path.join(SENTENCES_DIR, f"level-{int(level_id)}.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="该级句子不存在。")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/health")
def health_check():
    return {"status": "ok"}

