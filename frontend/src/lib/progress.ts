// Per-video playback progress, persisted locally for resume & history cards.

const PROGRESS_KEY = 'yt_bilingual_progress';
const MAX_ENTRIES = 200;

export interface ProgressEntry {
    time: number;      // last playback position (seconds)
    duration: number;  // approx. video duration (last transcript block end)
    updated: number;   // epoch ms
}

type ProgressMap = Record<string, ProgressEntry>;

export function loadProgressMap(): ProgressMap {
    try {
        return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    } catch {
        return {};
    }
}

export function getProgress(videoId: string): ProgressEntry | null {
    return loadProgressMap()[videoId] ?? null;
}

export function saveProgress(videoId: string, time: number, duration: number) {
    const map = loadProgressMap();
    map[videoId] = { time, duration, updated: Date.now() };
    // Cap storage: drop the oldest entries beyond the limit
    const ids = Object.keys(map);
    if (ids.length > MAX_ENTRIES) {
        ids.sort((a, b) => map[a].updated - map[b].updated)
            .slice(0, ids.length - MAX_ENTRIES)
            .forEach(id => delete map[id]);
    }
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
}

export function progressPercent(videoId: string): number | null {
    const p = getProgress(videoId);
    if (!p || !p.duration || p.duration < 60) return null;
    const pct = Math.round((p.time / p.duration) * 100);
    return pct >= 1 ? Math.min(pct, 99) : null;
}
