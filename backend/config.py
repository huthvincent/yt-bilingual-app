"""环境与配置：路径、安全开关、模型目录、词汇水平。

所有模块都从这里取配置；load_dotenv 在首次 import 时执行，
保证 DEEPSEEK_API_KEY 等在任何 LLM 调用之前就已加载。
"""
import os
from dotenv import load_dotenv

# Load .env file (for DEEPSEEK_API_KEY etc.)
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

# --- 数据目录（都可用环境变量覆盖） ---
HISTORY_DIR = os.environ.get("HISTORY_DIR", os.path.join(_BACKEND_DIR, "..", "history"))
os.makedirs(HISTORY_DIR, exist_ok=True)

SUBTITLES_DIR = os.environ.get("SUBTITLES_DIR", os.path.join(_BACKEND_DIR, "..", "subtitles"))

SENTENCES_DIR = os.environ.get(
    "SENTENCES_DIR",
    os.path.join(_BACKEND_DIR, "..", "content", "sentences"),
)

# --- Security configuration ---
# CORS_ORIGINS: comma-separated allowed origins. Defaults to "*" for local
# use; ALWAYS set this when deploying publicly.
_cors_env = os.environ.get("CORS_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()] or ["*"]

# API_AUTH_KEY: when set, every /api request must carry a matching X-API-Key
# header. Without it a public deployment is an open proxy for your DeepSeek key.
API_AUTH_KEY = os.environ.get("API_AUTH_KEY", "")

if ALLOWED_ORIGINS == ["*"] and not API_AUTH_KEY:
    print("⚠️  Running fully open (CORS * / no API key) — fine locally, "
          "set CORS_ORIGINS and API_AUTH_KEY before deploying publicly.")

# --- Learner level -> description used to calibrate which words get highlighted.
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

# --- Real, selectable models. Prices are USD per 1M tokens (cache-miss input /
# output). See https://api-docs.deepseek.com/quick_start/pricing
MODEL_CATALOG = {
    "deepseek-v4-flash": {
        "name": "DeepSeek V4 Flash", "provider": "DeepSeek",
        "in": 0.14, "out": 0.28, "quotaInfo": "Default · fast & affordable",
    },
    "deepseek-v4-pro": {
        "name": "DeepSeek V4 Pro", "provider": "DeepSeek",
        "in": 0.435, "out": 0.87, "quotaInfo": "Highest quality · slower",
    },
}
DEFAULT_MODEL = "deepseek-v4-flash"


def resolve_model(model: str | None) -> str:
    return model if model in MODEL_CATALOG else DEFAULT_MODEL
