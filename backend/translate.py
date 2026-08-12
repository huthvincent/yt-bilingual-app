"""AI 翻译核心：DeepSeek 分批翻译、按 id 对齐、自愈续译、流式生成、总结。

关键约定：
- 翻译失败/缺失的句子 zh_text 标为 UNTRANSLATED_MARKER，
  下次加载时 retranslate_marked_blocks 自动补译（自愈）。
- 结果按块 id 对齐合并，模型漏返/乱序也不会错位。
"""
import asyncio
import json
import os

from config import DEFAULT_MODEL, HISTORY_DIR, VOCAB_LEVELS
from llm import chat_complete

# Marker for blocks whose translation is missing/failed; such blocks are
# re-translated automatically the next time the video is loaded.
UNTRANSLATED_MARKER = "[未翻译]"


def _norm_id(v):
    """Normalize block ids for matching (models sometimes return '1' for 1)."""
    try:
        return int(v)
    except (TypeError, ValueError):
        return v


def _parse_blocks_json(text: str) -> list:
    """Parse model JSON that may be a list or {"blocks": [...]}."""
    data = json.loads(text)
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        blocks = data.get("blocks")
        if isinstance(blocks, list):
            return blocks
    return []


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
    """Use DeepSeek API to return Chinese translations and highlights"""
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

    system_prompt = """You are an expert bilingual English-Chinese teacher.
Return ONLY valid JSON of the form {"blocks": [...]} — no markdown fences."""

    user_prompt = f"""
    I will provide a JSON list of transcript blocks.
    For each block, you must:
    1. Provide a natural Chinese translation.
    2. Identify 0 to 2 advanced words or phrases (idioms, phrasal verbs, hard vocabulary).{level_instruction}
    3. Return the exact substring of the advanced word in English, and its exact translated substring in the Chinese sentence.

    CRITICAL: YOU MUST return a JSON object with a "blocks" array. Each item keeps the same id and adds:
    - en_text: the original text
    - zh_text: the Chinese translation
    - highlights: list of objects with 'en_word', 'zh_word', and 'color'. The color MUST be exactly "text-purple-400 border-b border-dashed border-purple-400"

    EXAMPLE JSON OUTPUT:
    {{"blocks": [{{"id": 1, "en_text": "Hello world", "zh_text": "你好世界", "highlights": []}}]}}

    Input data:
    {json.dumps(input_data, ensure_ascii=False)}
    """

    try:
        # OpenAI SDK is sync; run in a thread so the event loop stays responsive.
        content = await asyncio.to_thread(
            chat_complete,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            model=model,
            json_mode=True,
            max_tokens=8192,
        )

        results_list = _parse_blocks_json(content)
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
        print(f"DeepSeek API Error: {e}")
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
    """Use DeepSeek API to generate a summary of the video based on the transcript"""
    full_text = " ".join([b["text"] for b in blocks])
    # If it's too long, truncate it to save tokens (approx 20 mins of speech)
    if len(full_text) > 20000:
        full_text = full_text[:20000] + "..."

    summary_prompt = f"""
    Please read the following English transcript from a YouTube video and provide a concise summary in Chinese.
    Focus on extracting the core knowledge points and main ideas.
    Use bullet points to organize the summary. Keep it brief and educational.

    Transcript:
    {full_text}
    """

    try:
        return await asyncio.to_thread(
            chat_complete,
            messages=[
                {"role": "system", "content": "You summarize YouTube transcripts for Chinese learners of English."},
                {"role": "user", "content": summary_prompt},
            ],
            model=model,
            max_tokens=2048,
        )
    except Exception as e:
        print(f"Summary Gen Error: {e}")
        return "无法生成总结，请稍后再试或检查 API 配额。"


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
            await asyncio.sleep(1)  # mild pacing between batches
