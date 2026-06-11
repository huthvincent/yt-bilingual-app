// Shared transcript helpers for the streaming translation pipeline.

// Must match UNTRANSLATED_MARKER in backend/main.py
export const UNTRANSLATED_MARKER = '[未翻译]';

export const isUntranslated = (zh?: string): boolean =>
    !zh || zh.startsWith(UNTRANSLATED_MARKER) || zh.includes('模拟中文翻译');

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
