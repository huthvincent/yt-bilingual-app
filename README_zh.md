<div align="center">

<img src="docs/images/readme_octopus.png" alt="Lingua Nova" width="120" />

# Lingua Nova

### 把任何 YouTube 视频，变成一堂沉浸式英语课。

AI 双语字幕实时流式生成 · 点击任意单词即查词典 · 内置精听训练<br/>
为中文学习者设计，以苹果的设计标准打磨。

<br/>

[![Stars](https://img.shields.io/github/stars/huthvincent/yt-bilingual-app?style=for-the-badge&color=0A84FF)](https://github.com/huthvincent/yt-bilingual-app/stargazers)
[![License](https://img.shields.io/github/license/huthvincent/yt-bilingual-app?style=for-the-badge&color=34C759)](LICENSE)
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_2.5-4285F4?style=for-the-badge&logo=googlegemini&logoColor=white)

[功能演示](#实际效果) · [手机端](#随时随地学习) · [快速开始](#-快速开始) · [English](README.md)

<br/>

<img src="docs/images/hero.gif" alt="Lingua Nova 首页 — 流动极光、流光标题与词汇水平轴" width="860" />

</div>

<br/>

## 为什么是 Lingua Nova

大多数语言应用让你学*它们*准备的内容。Lingua Nova 反过来：粘贴一条**你真正想看的 YouTube 视频**链接，它就变成一堂完整的课——同步双语字幕、按你的水平高亮生词、点击即查的词典、随手可用的精听训练。查词与翻译的摩擦被彻底消除，剩下的只有输入。

| | | |
|:---:|:---:|:---:|
| **⚡ 即时** | **🎯 个性化** | **🔁 完整闭环** |
| 英文字幕秒出，翻译边看边流式填充；随时中断，下次打开自动续译。 | 在一条轴上设定水平——Liftoff 到 Supernova——AI 只高亮超出水平的词；每个视频自动续播。 | 看 → 查 → 收藏 → 精听 → 导出 Anki。完整的学习闭环，不只是个播放器。 |

<br/>

## 实际效果

### 跟着视频走的字幕

当前句像 Apple Music 歌词一样随播放平滑滑动——即使 90 分钟的播客也丝般顺滑。点击任意句子，视频立刻跳转。AI 选出的生词以 ruby 注音形式把中文释义放在单词上方——想看一眼就懂，不想看也不挡路。

<div align="center">
<img src="docs/images/learning.gif" alt="双语字幕跟随视频播放，点句即跳转" width="860" />
</div>

<br/>

### 点击任何一个单词

字幕里的每个单词都可以点：音标、词性、贴合语境的中文释义、英文释义、例句，外加一键发音和一键加入生词本。释义在本地缓存——每个词的 API 成本一生只花一次。或者打开**听写模式**，把英文模糊，用耳朵核对自己。

<table align="center">
<tr>
<td align="center" width="50%">
<img src="docs/images/dictionary.gif" alt="点查词典：音标与中文释义" width="420" /><br/>
<sub><b>点查词典</b> — 音标 · 释义 · 发音 · 生词本</sub>
</td>
<td align="center" width="50%">
<img src="docs/images/dictation.gif" alt="听写模式：英文模糊，点击揭示" width="420" /><br/>
<sub><b>听写模式</b> — 先听后看，点击核对</sub>
</td>
</tr>
</table>

<br/>

## 随时随地学习

界面完全自适应——同样的同步双语字幕、点查词典与精听工具，为手机屏幕优化排布。仓库中还附带一个 Expo React Native 客户端（[`mobile/`](mobile)）。

<div align="center">
<img src="docs/images/mobile.gif" alt="Lingua Nova 手机端 — 视频在上，双语字幕在下滚动" width="300" />
</div>

<br/>

## 🚀 快速开始

> **环境要求：** Node 18+、Python 3.10+、一个免费的 [Gemini API key](https://aistudio.google.com/apikey)。

```bash
git clone https://github.com/huthvincent/yt-bilingual-app.git
cd yt-bilingual-app

./setup.sh                       # 安装前后端依赖
cp .env.example .env             # 填入你的 GEMINI_API_KEY

./start_app.command              # macOS 一键启动（或手动起两个服务，见下）
```

<details>
<summary>手动启动</summary>

```bash
# 终端 1 — 后端
cd backend && source venv/bin/activate && uvicorn main:app --port 8000

# 终端 2 — 前端
cd frontend && npm run dev
```
</details>

打开 **http://localhost:5173**，粘贴 YouTube 链接，在轴上设定你的水平，点「Start Learning」。

### 配置项

| 变量 | 位置 | 用途 |
|---|---|---|
| `GEMINI_API_KEY` | `.env` | **必填。** 翻译、总结、词典。 |
| `WHISPER_MODEL` | `.env` | 无字幕 ASR 回退使用的 Whisper 模型大小（默认 `base`）。 |
| `CORS_ORIGINS` | `.env` | 允许的跨域来源（逗号分隔）——公网部署前务必设置。 |
| `API_AUTH_KEY` | `.env` | 设置后所有 API 调用必须携带 `X-API-Key`，保护你的 Gemini 配额。 |
| `VITE_API_BASE` / `VITE_API_KEY` | 前端环境 | 让 Web 端指向远程后端 / 发送其 API key。 |
| `HISTORY_DIR` / `SUBTITLES_DIR` | 环境变量 | 自定义 JSON 缓存 / 本地剧集字幕目录。 |

<br/>

## 🗺 路线图

- [x] SSE 渐进式管线（断点续译 + 自动修复）
- [x] 点查词典（音标 / 发音 / 生词本）
- [x] 听写模式、单句循环、倍速、键盘操作
- [x] Liftoff → Supernova 词汇水平轴高亮生词
- [x] Anki / CSV 导出
- [x] 无字幕视频的 Whisper 转写回退
- [ ] AI 发音评测（跟读打分）
- [ ] 应用内间隔重复复习
- [ ] Chrome 扩展——在任意 YouTube 页面一键开课
- [ ] 移动端接入流式管线

<br/>

## 🤝 参与贡献

欢迎 Issue 和 PR。Fork → `git checkout -b feature/amazing` → 提交 → PR。

项目按 [spec-kit](https://github.com/github/spec-kit) 的规格驱动方式管理：架构、设计规范、各功能规格在 [`docs/`](docs/) 与 [`specs/`](specs/)，项目原则见 [`.specify/memory/constitution.md`](.specify/memory/constitution.md)。

## 📄 许可

MIT — 见 [LICENSE](LICENSE)。

---

<div align="center">
<sub>为语言学习者用 ❤️ 打造。README 媒体可一键复现：<code>cd scripts && APP_URL=http://localhost:5173 node capture.mjs all</code></sub>
</div>
