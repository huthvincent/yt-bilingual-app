import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from youtube_transcript_api import YouTubeTranscriptApi
import asyncio
import yt_dlp
import json
import os
import datetime

app = FastAPI()

# Ensure history directory exists
HISTORY_DIR = "/Users/rui/Desktop/yt-bilingual-app/history"
os.makedirs(HISTORY_DIR, exist_ok=True)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VideoRequest(BaseModel):
    url: str

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

def group_transcript_blocks(transcript: list) -> list:
    """Group short transcript snippets into sentences based on punctuation or natural pauses."""
    blocks = []
    current_block = None
    
    for i, item in enumerate(transcript):
        # Normalize the text specifically for newline handling but don't strip yet 
        # because we want spaces between aggregated snippets
        text = item.text.replace('\n', ' ')
        
        if current_block is None:
            current_block = {
                "start": item.start,
                "end": item.start + item.duration,
                "text": text
            }
        else:
            # We append the text
            current_block["text"] += " " + text
            current_block["end"] = item.start + item.duration
            
        # Check if we should flush the block
        text_so_far = current_block["text"].strip()
        
        # A block ends if the text ends with punctuation, optionally followed by quotes or spaces
        ends_with_punctuation = bool(re.search(r'[.!?。！？][\'"”’]?\s*$', text_so_far))
        
        # For auto-generated captions without punctuation, break if too long
        # Increased from 90 to 160 to ensure enough context for a full sentence translation
        is_too_long = len(text_so_far) > 160 
        
        # Break if there's a natural pause speaking
        has_long_pause = False
        if i + 1 < len(transcript):
            next_start = transcript[i+1]['start'] if isinstance(transcript[i+1], dict) else transcript[i+1].start
            # If the next word is spoken more than 1.2s after the current word ends, it is very likely a sentence boundary
            if next_start - current_block["end"] > 1.2: 
                has_long_pause = True
        
        # Heuristic for auto-captions: If previous text is decent length, and next block starts with a Capital letter, it might be a new sentence.
        starts_new_sentence_cap = False
        if i + 1 < len(transcript):
            next_text = transcript[i+1]['text'] if isinstance(transcript[i+1], dict) else transcript[i+1].text
            if len(text_so_far) > 40 and next_text.strip() and next_text.strip()[0].isupper():
                starts_new_sentence_cap = True

        # If it looks like a complete sentence, or it's getting too long, or there's a pause
        if ends_with_punctuation or is_too_long or has_long_pause or starts_new_sentence_cap:
            blocks.append(current_block)
            current_block = None
                
    if current_block:
        blocks.append(current_block)
        
    return blocks

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

async def process_llm_batch(blocks: list) -> list:
    """Use Gemini API to return Chinese translations and highlights"""
    client = genai.Client()
    
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
    2. Identify 0 to 2 advanced words or phrases (idioms, phrasal verbs, hard vocabulary).
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
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        
        # Parse the response back into our block format
        result_data = json.loads(response.text)
        
        # Merge back with start/end times if necessary, though we asked LLM to keep IDs
        processed_blocks = []
        for orig, res in zip(input_data, result_data):
            # Ensure it matches
            processed_blocks.append({
                "id": orig["id"],
                "start": orig["start"],
                "end": orig["end"],
                "en_text": orig["text"],
                "zh_text": res.get("zh_text", "翻译失败"),
                "highlights": res.get("highlights", [])
            })
            
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

async def summarize_video_transcript(blocks: list) -> str:
    """Use Gemini API to generate a summary of the video based on the transcript"""
    full_text = " ".join([b["text"] for b in blocks])
    # If it's too long, truncate it to save tokens (approx 20 mins of speech)
    if len(full_text) > 20000:
        full_text = full_text[:20000] + "..."
        
    client = genai.Client()
    prompt = f"""
    Please read the following English transcript from a YouTube video and provide a concise summary in Chinese.
    Focus on extracting the core knowledge points and main ideas. 
    Use bullet points to organize the summary. Keep it brief and educational.
    
    Transcript:
    {full_text}
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return response.text
    except Exception as e:
        print(f"Summary Gen Error: {e}")
        return "无法生成总结，请稍后再试或检查 API 配额。"

@app.get("/api/estimate-cost")
def estimate_cost(url: str):
    try:
        video_id = extract_video_id(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    try:
        metadata = get_video_metadata(url)
    except Exception as e:
        print(f"Failed to fetch metadata for estimate: {e}")
        metadata = {"title": "Unknown Title", "channel": "Unknown Channel", "thumbnail": ""}

    try:
        # Fetch English transcript to calculate length
        api = YouTubeTranscriptApi()
        transcript = api.fetch(video_id, languages=['en'])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch English transcript: {str(e)}")
        
    # Calculate rough token estimate. (English word ~ 1.3 tokens).
    # We also have the system prompt and Chinese output.
    # Chinese output is usually roughly similar token count to English input in some tokenizers, or slightly more.
    full_text = " ".join([t.text for t in transcript])
    char_count = len(full_text)
    word_count = len(full_text.split())
    
    # Rough estimates:
    input_tokens = int(word_count * 1.5)  # input text + prompt overhead
    output_tokens = int(word_count * 2.0) # chinese translation + JSON overhead

    # Costs per 1M tokens
    costs = {
        "gemini-2.5-flash": {"in": 0.075, "out": 0.30},
        "claude-3-5-haiku": {"in": 0.25, "out": 1.25},
        "gpt-4o-mini": {"in": 0.150, "out": 0.600}
    }
    
    def calc_cost(model_id):
        rates = costs[model_id]
        in_cost = (input_tokens / 1_000_000) * rates["in"]
        out_cost = (output_tokens / 1_000_000) * rates["out"]
        return round(in_cost + out_cost, 6)

    models = [
        {
            "id": "gemini-2.5-flash",
            "name": "Gemini 2.5 Flash",
            "provider": "Google",
            "estimatedCost": calc_cost("gemini-2.5-flash"),
            "available": True,
            "quotaInfo": "15 RPM Free Tier"
        },
        {
            "id": "claude-3-5-haiku",
            "name": "Claude 3.5 Haiku",
            "provider": "Anthropic",
            "estimatedCost": calc_cost("claude-3-5-haiku"),
            "available": False,
            "quotaInfo": "Coming Soon"
        },
        {
            "id": "gpt-4o-mini",
            "name": "GPT-4o-mini",
            "provider": "OpenAI",
            "estimatedCost": calc_cost("gpt-4o-mini"),
            "available": False,
            "quotaInfo": "Coming Soon"
        }
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

@app.post("/api/process-video")
async def process_video(request: VideoRequest):
    try:
        video_id = extract_video_id(request.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
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

    try:
        # Fetch English transcript
        api = YouTubeTranscriptApi()
        transcript = api.fetch(video_id, languages=['en'])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch English transcript: {str(e)}")
        
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

@app.get("/api/history")
def list_history():
    files = []
    if os.path.exists(HISTORY_DIR):
        for f in os.listdir(HISTORY_DIR):
            if f.endswith('.json'):
                file_path = os.path.join(HISTORY_DIR, f)
                try:
                    with open(file_path, "r", encoding="utf-8") as file:
                        data = json.load(file)
                        files.append({
                            "filename": f,
                            "metadata": data.get("metadata", {})
                        })
                except Exception as e:
                    print(f"Error reading history file {f}: {e}")
                    files.append({"filename": f, "metadata": {}})
                    
    # Sort files by the upload_date in metadata if available, descending
    files.sort(key=lambda x: x["metadata"].get("upload_date", ""), reverse=True)
    return files

@app.get("/api/history/{filename}")
def get_history(filename: str):
    file_path = os.path.join(HISTORY_DIR, filename)
    if not os.path.exists(file_path) or not filename.endswith('.json'):
        raise HTTPException(status_code=404, detail="History file not found")
        
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data

class ChannelUpdatesRequest(BaseModel):
    channels: list[str]

@app.post("/api/channel-updates")
def get_channel_updates(request: ChannelUpdatesRequest):
    updates = []
    ydl_opts = {
        'extract_flat': 'in_playlist',
        'playlistend': 5, # Top 5 recent videos per channel
        'quiet': True,
        'dateafter': 'now-7days'
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for channel_url in request.channels:
            if not channel_url:
                continue
            try:
                target_url = channel_url.rstrip("/") + "/videos" if not channel_url.endswith("/videos") else channel_url
                info = ydl.extract_info(target_url, download=False)
                
                channel_name = info.get('uploader', info.get('title', 'Unknown Channel'))
                if 'entries' in info:
                    for entry in info['entries']:
                        if not entry: continue
                        video_id = entry.get('id')
                        # Sometimes title is None in flat extract depending on YT layout, try to fetch it
                        title = entry.get('title')
                        if video_id and title:
                            updates.append({
                                "videoId": video_id,
                                "title": title,
                                "channel": channel_name,
                                "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
                            })
            except Exception as e:
                print(f"Error fetching updates for {channel_url}: {e}")
                
    return {"updates": updates}

@app.get("/health")
def health_check():
    return {"status": "ok"}
