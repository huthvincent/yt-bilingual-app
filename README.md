<div align="center">

<img src="docs/images/readme_octopus.png" alt="Lingua Nova" width="120" />

# Lingua Nova

### Turn any YouTube video into an immersive English lesson.

AI bilingual subtitles that stream in live · click any word for an instant dictionary · listening drills built in.<br/>
Designed for Chinese learners. Built like Apple would.

<br/>

[![Stars](https://img.shields.io/github/stars/huthvincent/yt-bilingual-app?style=for-the-badge&color=0A84FF)](https://github.com/huthvincent/yt-bilingual-app/stargazers)
[![License](https://img.shields.io/github/license/huthvincent/yt-bilingual-app?style=for-the-badge&color=34C759)](LICENSE)
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![DeepSeek](https://img.shields.io/badge/DeepSeek_V4-4D6BFE?style=for-the-badge&logo=deepseek&logoColor=white)

[Demo](#see-it-in-action) · [On your phone](#learn-on-the-go) · [Quick Start](#-quick-start) · [中文文档](README_zh.md)

<br/>

<img src="docs/images/hero.gif" alt="Lingua Nova home — living aurora, shimmering title, and a vocabulary-level axis" width="860" />

</div>

<br/>

## Why Lingua Nova

Most language apps make you study *their* content. Lingua Nova flips that: paste a link to **any YouTube video you actually want to watch**, and it becomes a complete lesson — synchronized bilingual subtitles, vocabulary highlighted *at your level*, a tap-to-define dictionary, and listening drills. The friction of looking things up disappears; only the input remains.

| | | |
|:---:|:---:|:---:|
| **⚡ Instant** | **🎯 Personal** | **🔁 Complete** |
| English subtitles appear the moment they're fetched — translations stream in live while you watch. Stop anytime; it resumes where it left off. | Set your level on a single axis — Liftoff to Supernova — and the AI highlights only words *above* it. Reopen any video and continue from your last position. | Watch → look up → collect → drill → export to Anki. The whole learning loop, not just a player. |

<br/>

## See it in action

### A transcript that moves with the video

The active sentence glides with playback like Apple Music lyrics — buttery even on a 90-minute podcast. Click any sentence to jump the video there. AI-picked vocabulary carries its Chinese gloss as ruby text above the word — visible at a glance, ignorable at speed.

<div align="center">
<img src="docs/images/learning.gif" alt="Synchronized bilingual transcript following video playback, with click-to-seek" width="860" />
</div>

<br/>

### Click any word. Any word.

One click on any word in the transcript opens a dictionary card: IPA, part of speech, a context-aware Chinese gloss, an English definition, and an example sentence — with one-tap pronunciation and one-tap save to your vocabulary book. Definitions are cached on disk, so each word costs an API call exactly once, ever. Or flip on **dictation mode** to blur the English and check yourself by ear.

<table align="center">
<tr>
<td align="center" width="50%">
<img src="docs/images/dictionary.gif" alt="Click-to-define dictionary with IPA and Chinese gloss" width="420" /><br/>
<sub><b>Tap-to-define dictionary</b> — IPA · 释义 · TTS · 生词本</sub>
</td>
<td align="center" width="50%">
<img src="docs/images/dictation.gif" alt="Dictation mode blurs the English until you reveal it" width="420" /><br/>
<sub><b>Dictation mode</b> — listen first, reveal to check yourself</sub>
</td>
</tr>
</table>

<br/>

## Learn on the go

The interface is fully responsive — the same synced bilingual transcript, tap-to-define dictionary, and listening tools, sized for a phone. A companion Expo React Native client also ships in [`mobile/`](mobile).

<div align="center">
<img src="docs/images/mobile.gif" alt="Lingua Nova running on a phone — video on top, bilingual transcript scrolling below" width="300" />
</div>

<br/>

## 🚀 Quick Start

> **Prereqs:** Node 18+, Python 3.10+, and a [DeepSeek API key](https://platform.deepseek.com/api_keys).

```bash
git clone https://github.com/huthvincent/yt-bilingual-app.git
cd yt-bilingual-app

./setup.sh                       # installs frontend + backend deps
cp .env.example .env             # then paste your DEEPSEEK_API_KEY

./start_app.command              # macOS one-click (or run the two commands below)
```

<details>
<summary>Manual start</summary>

```bash
# terminal 1 — backend
cd backend && source venv/bin/activate && uvicorn main:app --port 8000

# terminal 2 — frontend
cd frontend && npm run dev
```
</details>

Open **http://localhost:5173**, paste a YouTube link, set your level on the axis, and press **Start Learning**.

### Configuration

| Variable | Where | Purpose |
|---|---|---|
| `DEEPSEEK_API_KEY` | `.env` | **Required.** Translation, summaries, dictionary. |
| `DEEPSEEK_BASE_URL` | `.env` | Optional. Defaults to `https://api.deepseek.com`. |
| `WHISPER_MODEL` | `.env` | Whisper size for the no-captions ASR fallback (`base` default). |
| `CORS_ORIGINS` | `.env` | Comma-separated allowed origins — set before deploying publicly. |
| `API_AUTH_KEY` | `.env` | When set, every API call must send `X-API-Key`. Protects your DeepSeek quota on public deployments. |
| `VITE_API_BASE` / `VITE_API_KEY` | frontend env | Point the web app at a remote backend / send its API key. |
| `HISTORY_DIR` / `SUBTITLES_DIR` | env | Relocate the JSON cache / local-show subtitles. |

<br/>

## 🗺 Roadmap

- [x] Progressive SSE pipeline with resume & self-healing translations
- [x] Tap-to-define dictionary with IPA, TTS, and vocabulary book
- [x] Dictation mode, sentence loop, playback speed, keyboard control
- [x] Vocabulary highlighting on a Liftoff → Supernova level axis
- [x] Anki / CSV export
- [x] Whisper ASR fallback for caption-less videos
- [ ] AI pronunciation assessment (speak the sentence, get scored)
- [ ] In-app spaced-repetition review
- [ ] Chrome extension — start a lesson from any YouTube page
- [ ] Mobile parity with the streaming pipeline

<br/>

## 🤝 Contributing

Issues and PRs welcome. Fork → `git checkout -b feature/amazing` → commit → PR.

Architecture, design language, and per-feature specs (spec-kit style) live in [`docs/`](docs/) and [`specs/`](specs/), with project principles in [`CONSTITUTION.md`](CONSTITUTION.md). These docs are in Chinese.

## 📄 License

MIT — see [LICENSE](LICENSE).

---

<div align="center">
<sub>Crafted with ❤️ for language learners. README media is reproducible: <code>cd scripts && APP_URL=http://localhost:5173 node capture.mjs all</code>.</sub>
</div>
