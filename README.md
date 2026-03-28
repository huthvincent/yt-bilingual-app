# YT Bilingual 🎓

A full-stack bilingual learning app that helps you learn English through YouTube videos and local subtitle files. It plays the original video on the left while synchronizing bilingual subtitles on the right, with advanced vocabulary highlighted and annotated.

## ✨ Features

- **Bilingual Subtitles**: AI-powered English-to-Chinese translation synced with video playback
- **Vocabulary Highlighting**: Advanced words, phrases, and idioms are highlighted in purple with Chinese annotations `(中文释义)` inline
- **Click-to-Seek**: Click any subtitle block to jump to that point in the video
- **Auto-Scroll**: Subtitles scroll automatically to follow the current playback position
- **Video Summary**: AI-generated summary of the video content in Chinese
- **Local Subtitle Support**: Load `.srt` files for TV shows (e.g., House of Cards) with bilingual display
- **External Video Linking**: Link external video sources alongside local subtitles
- **Favorites**: Save interesting sentences for later review
- **Channel Subscriptions**: Track your favorite YouTube channels
- **History**: Previously processed videos are saved for quick access

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Python FastAPI + Google Gemini API
- **Transcript**: youtube-transcript-api + yt-dlp

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- A Google Gemini API Key ([Get one here](https://aistudio.google.com/apikey))

### Setup (New Machine)

1. Clone the repo:
   ```bash
   git clone https://github.com/huthvincent/yt-bilingual-app.git
   cd yt-bilingual-app
   ```

2. Run the setup script (installs all dependencies):
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

3. Edit `.env` and add your Gemini API Key:
   ```
   GEMINI_API_KEY="your_gemini_api_key_here"
   ```

4. Start the app:
   ```bash
   ./start_app.command
   ```
   Or double-click `start_app.command` in Finder.

5. Open **http://localhost:5173** in your browser.

### Manual Setup

If you prefer to set up manually:

```bash
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

## 💡 Usage

### YouTube Videos
1. Paste a YouTube video URL and click **Start Learning**
2. The video plays on the left; bilingual subtitles sync on the right
3. Advanced vocabulary is highlighted in purple with Chinese translations in parentheses
4. Click any subtitle to jump to that timestamp
5. Star ⭐ sentences you want to review later

### Local Subtitles (TV Shows)
1. Place `.srt` files in `subtitles/<show-name>/S<XX>/E<XX>.srt`
2. Select the show, season, and episode from the app UI
3. Click a subtitle block to start auto-scrolling from that timestamp
4. Optionally paste an external video URL to watch alongside

## 📁 Project Structure

```
yt-bilingual-app/
├── backend/           # FastAPI Python backend
│   ├── main.py        # API endpoints & subtitle processing
│   ├── requirements.txt
│   └── venv/          # Python virtual environment (git-ignored)
├── frontend/          # React + Vite frontend
│   ├── src/
│   └── package.json
├── history/           # Cached processed videos & subtitles (synced)
├── subtitles/         # Local SRT subtitle files (synced)
│   └── house-of-cards/
│       ├── S01/ ... S06/
├── .env               # API keys (git-ignored, create manually)
├── setup.sh           # One-click dependency installer
├── start_app.command  # One-click app launcher (macOS)
└── README.md
```

## 📄 License

MIT
