# backend/ — FastAPI 后端

启动：`source venv/bin/activate && uvicorn main:app --port 8000`（入口永远是 `main:app`）。
验证：`venv/bin/python -m py_compile *.py`。环境变量见 [开发指南](../docs/开发指南.md)。

## 文件说明

| 文件 | 职责 |
|---|---|
| `main.py` | 应用装配：CORS、`X-API-Key` 鉴权中间件、挂载三个路由模块、`/health`。**不放业务逻辑** |
| `config.py` | 所有配置：`.env` 加载、数据目录（HISTORY/SUBTITLES/SENTENCES）、安全开关、`MODEL_CATALOG`（可选 Gemini 模型与价格）、`VOCAB_LEVELS`（词汇水平→prompt 描述） |
| `transcripts.py` | 拿到"待翻译的句子"：YouTube 字幕抓取（失败→清晰中文错误）、切句算法、SRT 解析、yt-dlp 元数据、Whisper 本地转写兜底（可选依赖） |
| `translate.py` | AI 翻译核心：`process_llm_batch`（Gemini 批翻 + **按 id 对齐**防错位 + 按水平挑生词）、`UNTRANSLATED_MARKER` 自愈约定、`retranslate_marked_blocks`（补译）、`_stream_translate`（逐批落盘的流式生成器）、视频总结 |
| `routes_videos.py` | `/api/estimate-cost`、`/api/process-video`（经典，移动端用）、`/api/process-video-stream`（SSE，产品核心）、`/api/history*`、`/api/channel-updates` |
| `routes_content.py` | `/api/shows*`、`/api/process-subtitle`（本地剧集）、`/api/sentences*`（句子精背） |
| `routes_user.py` | `/api/define`（词典，`dictionary_cache.json` 每词只调一次）、`/api/favorites`、`/api/subscriptions` |
| `requirements.txt` | Python 依赖（faster-whisper 为可选，见文件内注释） |

## 关键约定

- 所有持久化都是 `history/` 下的 JSON 文件（无数据库）。
- 翻译失败的句子标 `[未翻译]`，下次加载自动补译——改动翻译逻辑时**不要破坏这个自愈闭环**。
- 对应规格：流式管线见 [specs/001](../specs/001-streaming-pipeline/spec.md)，各路由的行为定义见 [specs/](../specs/README.md)。
