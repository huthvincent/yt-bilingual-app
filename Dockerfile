FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/main.py .

# Create data directories
RUN mkdir -p /app/history /app/subtitles

# Copy history data (cached translations) and subtitles
COPY history/ /app/history/
COPY subtitles/ /app/subtitles/

# Tell the app where to find data (since main.py is at /app/, not /app/backend/)
ENV HISTORY_DIR=/app/history
ENV SUBTITLES_DIR=/app/subtitles
ENV PORT=8000

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
