// Shared transcript helpers for the streaming translation pipeline.

// Must match UNTRANSLATED_MARKER in backend/main.py
export const UNTRANSLATED_MARKER = '[未翻译]';

export const isUntranslated = (zh?: string): boolean =>
    !zh || zh.startsWith(UNTRANSLATED_MARKER) || zh.includes('模拟中文翻译');

// Global display policy for the Chinese translation line.
//   all    — every sentence shows its translation
//   active — only the currently playing sentence shows it (best for learning)
//   hidden — translations hidden unless toggled per sentence
export type TranslationMode = 'all' | 'active' | 'hidden';

export const TRANSLATION_MODE_KEY = 'yt_bilingual_translation_mode';

export function loadTranslationMode(): TranslationMode {
    const saved = localStorage.getItem(TRANSLATION_MODE_KEY);
    return saved === 'all' || saved === 'active' || saved === 'hidden' ? saved : 'active';
}

// Lookahead so the highlight moves slightly before the rigid timestamp
// boundary — YouTube transcripts are padded and humans read ahead.
export const ACTIVE_LOOKAHEAD_SECONDS = 0.8;

/** Index of the sentence being spoken at currentTime (-1 before the first). */
export function findActiveIndex(
    transcript: Array<{ start: number; end: number }>,
    currentTime: number,
): number {
    const effectiveTime = currentTime + ACTIVE_LOOKAHEAD_SECONDS;
    let activeIndex = -1;
    for (let i = 0; i < transcript.length; i++) {
        const item = transcript[i];
        if (effectiveTime >= item.start && effectiveTime < item.end) {
            return i;
        } else if (effectiveTime >= item.end) {
            // Inside a gap — the previous block stays active until the next starts
            activeIndex = i;
        } else {
            break;
        }
    }
    return activeIndex;
}

export interface SseEvent {
    event: string;
    data: any;
}

/** Parse one raw SSE event chunk ("event: x\ndata: {...}"). */
export function parseSseEvent(raw: string): SseEvent | null {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return null;
    try {
        return { event, data: JSON.parse(dataLines.join('\n')) };
    } catch {
        return null;
    }
}

/** Read an SSE response body, invoking onEvent for each complete event. */
export async function consumeSseStream(
    body: ReadableStream<Uint8Array>,
    onEvent: (evt: SseEvent) => void,
): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
            const rawEvent = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const evt = parseSseEvent(rawEvent);
            if (evt) onEvent(evt);
        }
    }
}
