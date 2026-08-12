# 技术方案：字幕流式管线

**对应规格：** [spec.md](./spec.md)

---

## 总体思路
用 **SSE（Server-Sent Events）** 单向流：后端先推英文，再逐批推翻译。状态的"真相"是落盘的历史 JSON——每批翻译都写盘，所以续译/自愈天然成立。

## 接口：`POST /api/process-video-stream`
请求 `{ url, model?, vocab_level? }`，响应 `text/event-stream`，事件顺序：

| 事件 | 时机 | 数据 |
|---|---|---|
| `meta` | 英文字幕就绪 | `{ videoId, metadata, blocks, cached }` |
| `stage` | 进入某阶段 | `{ stage: "asr" \| "summary" }` |
| `batch` | 每翻完一批 | `{ blocks: 已译块[], progress: {done,total} }` |
| `summary` | 总结生成 | `{ summary }` |
| `done` | 结束 | `{ cached }` |
| `error` | 出错 | `{ detail }`（中文原因） |

## 关键设计
- **切句**：`group_transcript_blocks` 把零碎字幕片段合并成完整句子（按标点、停顿、长度切分）。
- **未翻标记**：新建的块 `zh_text` 先填 `[未翻译]`（`UNTRANSLATED_MARKER`）；前端 `isUntranslated` 据此显示"翻译中…"。
- **逐批落盘**：`_stream_translate` 每批 20 句，翻完即写整份 JSON，再 yield `batch`。
- **id 对齐合并**：`process_llm_batch` 按块 id 把模型返回映射回去，缺失/乱序不错位（[宪法原则 4](../../CONSTITUTION.md)）。
- **缓存与自愈**：`find_history_file_for_video` 命中则直接发 `meta`，再对 `needs_retranslation` 的块跑 `retranslate_marked_blocks` 补译；`GET /api/history/{file}` 加载时也会自愈。
- **前端**：`consumeSseStream` 解析事件流，`translationProgress` 驱动进度条与"停止"按钮（`AbortController`）。

## 涉及代码
| 位置 | 职责 |
|---|---|
| `backend/routes_videos.py · process_video_stream` | SSE 端点、缓存/新建分支 |
| `backend/translate.py · _stream_translate` | 逐批翻译 + 落盘 + yield |
| `backend/translate.py · retranslate_marked_blocks` | 补译未完成块（流式/历史加载共用） |
| `backend/translate.py · process_llm_batch` | 调 DeepSeek、按 id 合并、按水平挑生词 |
| `frontend/src/lib/transcript.ts` | `consumeSseStream` / `isUntranslated` / `UNTRANSLATED_MARKER` |
| `frontend/src/App.tsx` | 接流、进度、取消、续播衔接 |

## 取舍
- **为什么 SSE 而非 WebSocket**：只需服务端单向推送，SSE 更简单、自带断线重连语义、走普通 HTTP。
- **为什么逐批落盘而非内存累积**：用一点写盘开销换"任何中断都不丢、自愈零额外逻辑"。

## 风险与缓解
- **DeepSeek 限流（429）**：批间退避重试，仍失败则该批保留 `[未翻译]`，下次自愈。
- **大视频批次多、耗时长**：英文已先可用，用户无感等待；进度条 + 可取消。
