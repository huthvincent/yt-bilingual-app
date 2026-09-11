"""把 history/.work/<videoId>/out_*.json 的译文合并回 history 缓存，并严格校验。

`ingest_youtube.py` 只落英文骨架（zh_text 全是 `[未翻译]`）。翻译环节按块产出
`out_XXX.json`，本脚本负责合并 + 体检，保证写进 history 的东西 App 能直接吃：

- **按 id 对齐**（不是按下标），漏返/乱序都不会错位 —— 和 translate.py 同一套约定。
- **高亮必须是精确子串**：前端 `HighlightedText` 用 `text.indexOf(word)` 定位，
  对不上的高亮会被静默丢掉，所以这里先验后写，并报告丢了几个。
- **可疑译文退回 `[未翻译]`**（空的、没有汉字的、和英文一模一样的），
  这样 App 下次加载会自动补译（`retranslate_marked_blocks`），而不是显示脏数据。

用法：
    backend/venv/bin/python scripts/merge_translations.py            # 合并全部
    backend/venv/bin/python scripts/merge_translations.py <videoId>  # 只合并一个
"""
import glob
import json
import os
import re
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_ROOT, "backend"))

from config import HISTORY_DIR  # noqa: E402
from translate import UNTRANSLATED_MARKER, find_history_file_for_video  # noqa: E402

WORK_DIR = os.path.join(HISTORY_DIR, ".work")

# Must match the color string process_llm_batch asks Gemini for.
HIGHLIGHT_COLOR = "text-purple-400 border-b border-dashed border-purple-400"

MAX_HIGHLIGHTS = 2
_CJK = re.compile(r"[一-鿿]")

# An all-caps token, optionally plural ("GRATs", "IRS", "A.I.", "401k").
_ACRONYM = re.compile(r"^[A-Z0-9][A-Z0-9.&/'-]*s?$")


def _has_translatable_prose(en_text: str) -> bool:
    """True if the English has words that must turn into Chinese characters.

    Caption blocks are sometimes a bare acronym ("GRATs.") or a number, where
    a faithful translation legitimately contains no Chinese at all. Requiring
    CJK there would reject correct work, so only demand it once the sentence
    has real words left after acronyms/digits/punctuation come out.
    """
    for token in re.split(r"[\s]+", en_text):
        word = token.strip(".,!?;:\"'()[]—–-…")
        if not word or word.isdigit() or _ACRONYM.match(word):
            continue
        if any(c.isalpha() for c in word):
            return True
    return False


def _load_chunk_outputs(video_id: str) -> tuple:
    """Read every out_*.json for a video into {id: entry}, plus a per-file report."""
    by_id = {}
    files = []
    for path in sorted(glob.glob(os.path.join(WORK_DIR, video_id, "out_*.json"))):
        name = os.path.basename(path)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            files.append({"file": name, "error": f"{type(e).__name__}: {e}"})
            continue

        # Accept either a bare list or {"blocks": [...]} — translators write both.
        entries = data if isinstance(data, list) else (data.get("blocks") or data.get("translations") or [])
        kept = 0
        for entry in entries:
            if not isinstance(entry, dict) or entry.get("id") is None:
                continue
            try:
                bid = int(entry["id"])
            except (TypeError, ValueError):
                continue
            by_id[bid] = entry
            kept += 1
        files.append({"file": name, "entries": kept})
    return by_id, files


def _clean_highlights(raw, en_text: str, zh_text: str) -> tuple:
    """Keep only highlights whose words really occur in both sentences."""
    kept, dropped = [], 0
    for hl in (raw or [])[: MAX_HIGHLIGHTS * 3]:
        if not isinstance(hl, dict):
            dropped += 1
            continue
        en_word = (hl.get("en_word") or "").strip()
        zh_word = (hl.get("zh_word") or "").strip()
        if not en_word or not zh_word or en_word not in en_text or zh_word not in zh_text:
            dropped += 1
            continue
        kept.append({"en_word": en_word, "zh_word": zh_word, "color": HIGHLIGHT_COLOR})
        if len(kept) >= MAX_HIGHLIGHTS:
            break
    return kept, dropped


def _suspicious(zh_text: str, en_text: str) -> str:
    """Return a reason string if this translation shouldn't be trusted."""
    if not zh_text or not zh_text.strip():
        return "empty"
    if zh_text.startswith(UNTRANSLATED_MARKER) or "模拟中文翻译" in zh_text:
        return "marker"
    if zh_text.strip() == en_text.strip():
        return "identical-to-english"
    if not _CJK.search(zh_text) and _has_translatable_prose(en_text):
        return "no-chinese-characters"
    return ""


def merge(video_id: str) -> dict:
    history_path = find_history_file_for_video(video_id)
    if not history_path:
        return {"videoId": video_id, "error": "history 里找不到这个视频，先跑 ingest_youtube.py"}

    with open(history_path, "r", encoding="utf-8") as f:
        payload = json.load(f)
    transcript = payload.get("transcript") or []

    by_id, files = _load_chunk_outputs(video_id)

    applied = 0
    dropped_highlights = 0
    highlighted_blocks = 0
    missing, rejected = [], []

    for block in transcript:
        entry = by_id.pop(int(block["id"]), None)
        if entry is None:
            if block.get("zh_text", "").startswith(UNTRANSLATED_MARKER):
                missing.append(block["id"])
            continue

        en_text = block["en_text"]
        zh_text = (entry.get("zh_text") or "").replace("\n", " ").strip()
        reason = _suspicious(zh_text, en_text)
        if reason:
            rejected.append({"id": block["id"], "reason": reason})
            missing.append(block["id"])
            continue

        highlights, dropped = _clean_highlights(entry.get("highlights"), en_text, zh_text)
        dropped_highlights += dropped
        if highlights:
            highlighted_blocks += 1

        block["zh_text"] = zh_text
        block["highlights"] = highlights
        applied += 1

    summary_path = os.path.join(WORK_DIR, video_id, "summary.md")
    if os.path.exists(summary_path):
        with open(summary_path, "r", encoding="utf-8") as f:
            summary = f.read().strip()
        if summary:
            payload["summary"] = summary

    payload["transcript"] = transcript
    with open(history_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    still_marked = [b["id"] for b in transcript if b["zh_text"].startswith(UNTRANSLATED_MARKER)]
    return {
        "videoId": video_id,
        "historyFile": os.path.relpath(history_path, _ROOT),
        "blocks": len(transcript),
        "applied": applied,
        "coverage": f"{(applied / len(transcript) * 100):.1f}%" if transcript else "n/a",
        "stillUntranslated": len(still_marked),
        "stillUntranslatedIds": still_marked[:20],
        "rejected": rejected[:20],
        "rejectedCount": len(rejected),
        "unmatchedChunkIds": sorted(by_id)[:20],
        "blocksWithHighlights": highlighted_blocks,
        "droppedHighlights": dropped_highlights,
        "summaryChars": len(payload.get("summary") or ""),
        "chunkFiles": files,
    }


def main():
    if len(sys.argv) > 1:
        video_ids = sys.argv[1:]
    else:
        video_ids = [
            os.path.basename(d)
            for d in sorted(glob.glob(os.path.join(WORK_DIR, "*")))
            if os.path.isdir(d) and os.path.basename(d) != "captions"
        ]
    print(json.dumps([merge(v) for v in video_ids], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
