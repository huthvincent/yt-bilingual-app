# YT Bilingual 🎓

A full-stack bilingual learning app that helps you learn English through YouTube videos. It plays the original video on the left while synchronizing bilingual subtitles on the right, with advanced vocabulary highlighted and annotated.

## ✨ Features

- **Bilingual Subtitles**: AI-powered English-to-Chinese translation synced with video playback
- **Vocabulary Highlighting**: Advanced words, phrases, and idioms are highlighted in purple with Chinese annotations `(中文释义)` inline
- **Click-to-Seek**: Click any subtitle block to jump to that point in the video
- **Auto-Scroll**: Subtitles scroll automatically to follow the current playback position
- **Video Summary**: AI-generated summary of the video content in Chinese
- **Favorites**: Save interesting sentences for later review
- **Channel Subscriptions**: Track your favorite YouTube channels
- **History**: Previously processed videos are saved for quick access

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Python FastAPI + Google Gemini API
- **Transcript**: youtube-transcript-api + yt-dlp

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- A Google Gemini API Key

### Setup

1. Clone the repo and create a `.env` file in the project root:
   ```
   GEMINI_API_KEY="your_gemini_api_key_here"
   ```

2. **One-click start** (macOS):
   ```bash
   chmod +x start_app.command
   ./start_app.command
   ```

   Or start manually:

   ```bash
   # Terminal 1 - Backend
   cd backend
   source venv/bin/activate
   uvicorn main:app --port 8000

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

3. Open **http://localhost:5173** in your browser.

## 💡 Usage

1. Paste a YouTube video URL and click **Start Learning**
2. The video plays on the left; bilingual subtitles sync on the right
3. Advanced vocabulary is highlighted in purple with Chinese translations in parentheses
4. Click any subtitle to jump to that timestamp
5. Star ⭐ sentences you want to review later

## 📄 License

MIT
