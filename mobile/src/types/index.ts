// Shared types mirrored from the web frontend

export interface TranscriptItem {
  id: number;
  start: number;
  end: number;
  en_text: string;
  zh_text: string;
  highlights: Highlight[];
}

export interface Highlight {
  en_word: string;
  zh_word: string;
  color: string;
}

export interface FavoriteItem {
  id: string;
  videoId: string;
  start: number;
  en_text: string;
  zh_text: string;
  added_at?: number;
}

export interface HistoryMetadata {
  title: string;
  channel: string;
  channel_url?: string;
  upload_date: string;
  thumbnail: string;
  is_local_subtitle?: boolean;
}

export interface HistoryItem {
  filename: string;
  metadata: HistoryMetadata;
}

export interface VideoMetadata extends HistoryMetadata {}

export interface Show {
  id: string;
  title: string;
  title_zh: string;
  thumbnail: string;
  seasons_available: { [key: number]: number };
  total_episodes: number;
}

export interface SeasonData {
  season: number;
  episode_count: number;
  episodes: number[];
}
