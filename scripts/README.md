# scripts/ — 开发者工具

与产品运行无关的辅助脚本。首次使用先 `npm install`。

| 文件 | 用途 |
|---|---|
| `capture.mjs` | 重录 README 的全部动图与截图：`APP_URL=http://localhost:5173 node capture.mjs all`（可单录 `hero/learning/dictionary/dictation/mobile/stills`）。Playwright 驱动系统 Chrome 截帧 + gifenc 纯 JS 编码，无需 ffmpeg。注意：YouTube 播放依赖系统 Chrome（Playwright 自带 Chromium 缺编解码器） |
| `download_subtitles.py` | 从 OpenSubtitles 批量下载剧集 SRT 到 `subtitles/`（需 API key，见文件头注释） |
| `ingest_youtube.py` | 离线把 YouTube 视频解析进 `history/`：字幕走 yt-dlp（`youtube-transcript-api` 被限流时的备用通路），复用后端的 `group_transcript_blocks` 分句，产出与流式端点同构的英文骨架 + 翻译工单。用法见文件头注释 |
| `merge_translations.py` | 把 `history/.work/<videoId>/out_*.json` 的译文按 id 合并回 history 缓存，顺带体检：高亮必须是精确子串，可疑译文退回 `[未翻译]` 让 App 自动补译 |
| `package.json` | 本目录的独立依赖（playwright / gifenc / pngjs） |
