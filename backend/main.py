"""应用装配（入口不变：uvicorn main:app --port 8000）。

模块分工见 backend/README.md：
- config.py          环境、路径、安全、模型目录、词汇水平
- transcripts.py     字幕获取与切句（YouTube / SRT / Whisper 兜底）
- translate.py       DeepSeek 翻译、id 对齐、自愈续译、流式生成、总结
- llm.py             DeepSeek（OpenAI 兼容）客户端
- routes_videos.py   估价 / 处理 / 流式 / 历史 / 频道更新
- routes_content.py  本地剧集 + 句子精背
- routes_user.py     词典 / 收藏 / 订阅
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import ALLOWED_ORIGINS, API_AUTH_KEY
import routes_content
import routes_user
import routes_videos

app = FastAPI()

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


app.include_router(routes_videos.router)
app.include_router(routes_content.router)
app.include_router(routes_user.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
