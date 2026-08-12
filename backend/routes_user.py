"""用户数据路由：点查词典、收藏、订阅。

词典释义按小写单词落盘缓存（每词只调一次 DeepSeek）；
收藏与订阅是简单的整存整取 JSON 文件。
"""
import asyncio
import json
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import DEFAULT_MODEL, HISTORY_DIR
from llm import chat_complete

router = APIRouter()

# ====================================================
# Click-to-define dictionary
# ====================================================

DICT_CACHE_FILE = os.path.join(HISTORY_DIR, "dictionary_cache.json")
DICT_MODEL = DEFAULT_MODEL  # DeepSeek V4 Flash — fast + cheap for lookups


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


@router.post("/api/define")
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
        content = await asyncio.to_thread(
            chat_complete,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an English-Chinese dictionary for Chinese learners. "
                        "Return ONLY valid JSON matching the schema in the user message."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            model=DICT_MODEL,
            json_mode=True,
            max_tokens=1024,
        )
        result = json.loads(content)
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


@router.get("/api/favorites")
def get_favorites():
    if os.path.exists(FAVORITES_FILE):
        with open(FAVORITES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


@router.put("/api/favorites")
async def save_favorites(request: dict):
    favorites = request.get("favorites", [])
    with open(FAVORITES_FILE, "w", encoding="utf-8") as f:
        json.dump(favorites, f, ensure_ascii=False, indent=2)
    return {"status": "ok", "count": len(favorites)}


# --- Subscriptions persistence ---
SUBS_FILE = os.path.join(HISTORY_DIR, "subscriptions.json")


@router.get("/api/subscriptions")
def get_subscriptions():
    if os.path.exists(SUBS_FILE):
        with open(SUBS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


@router.put("/api/subscriptions")
async def save_subscriptions(request: dict):
    subs = request.get("subscriptions", [])
    with open(SUBS_FILE, "w", encoding="utf-8") as f:
        json.dump(subs, f, ensure_ascii=False, indent=2)
    return {"status": "ok", "count": len(subs)}
