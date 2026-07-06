# lib/ — 纯逻辑模块

无 UI、无 React 依赖（除类型），是行为的"真相"所在。改行为先看这里。

| 模块 | 职责 |
|---|---|
| `api.ts` | `API_BASE`（`VITE_API_BASE` 可覆盖）与 `apiFetch`（自动带 `X-API-Key`） |
| `transcript.ts` | 字幕核心逻辑：`findActiveIndex`（当前句判定，含 0.8s 前瞻）、SSE 流解析（`consumeSseStream`）、`[未翻译]` 标记判定、译文显示模式（全显/当前句/隐藏）持久化 |
| `sentences.ts` | 句子精背：类型、拉取、四色语块配色、按册×天的背诵/复习进度持久化 |
| `settings.ts` | 词汇水平（六站轴），含旧考试制存档迁移 |
| `progress.ts` | 每视频播放进度记忆（续播 + "已学 N%"），上限 200 条 |
| `exporter.ts` | 收藏导出：Anki TSV（front/back/tags）与完整 CSV |
| `tts.ts` | 浏览器朗读（speechSynthesis，偏好英语音色） |
| `toast.ts` | 轻提示总线 + `describeApiError`（把后端/网络错误转成可读中文） |

约定：localStorage key 全部带 `yt_bilingual_` 或 `sentence-` 前缀；新增持久化跟随此约定。
