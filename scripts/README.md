# scripts/ — 开发者工具

与产品运行无关的辅助脚本。首次使用先 `npm install`。

| 文件 | 用途 |
|---|---|
| `capture.mjs` | 重录 README 的全部动图与截图：`APP_URL=http://localhost:5173 node capture.mjs all`（可单录 `hero/learning/dictionary/dictation/mobile/stills`）。Playwright 驱动系统 Chrome 截帧 + gifenc 纯 JS 编码，无需 ffmpeg。注意：YouTube 播放依赖系统 Chrome（Playwright 自带 Chromium 缺编解码器） |
| `download_subtitles.py` | 从 OpenSubtitles 批量下载剧集 SRT 到 `subtitles/`（需 API key，见文件头注释） |
| `package.json` | 本目录的独立依赖（playwright / gifenc / pngjs） |
