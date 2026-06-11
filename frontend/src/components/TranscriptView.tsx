import React, { useEffect, useRef } from 'react';
import { TranscriptBlock } from './TranscriptBlock';
import type { TranslationMode } from '../lib/transcript';

interface TranscriptItem {
    id: number;
    start: number;
    end: number;
    en_text: string;
    zh_text: string;
    highlights: Array<{
        en_word: string;
        zh_word: string;
        color: string;
    }>;
}

interface TranscriptViewProps {
    transcript: TranscriptItem[];
    /** Index of the sentence being spoken — computed upstream so this
     *  component only re-renders when the active sentence changes, not on
     *  every 100ms time tick. */
    activeIndex: number;
    videoId: string;
    favorites: string[];
    onTranscriptClick: (time: number) => void;
    onToggleFavorite: (item: TranscriptItem) => void;
    translationMode?: TranslationMode;
    dictation?: boolean;
    onWordLookup?: (word: string, sentence: string, start: number, e: React.MouseEvent) => void;
}

// How long auto-follow stays suspended after the user scrolls manually
const USER_SCROLL_GRACE_MS = 4000;

const TranscriptViewInner: React.FC<TranscriptViewProps> = ({
    transcript,
    activeIndex,
    videoId,
    favorites,
    onTranscriptClick,
    onToggleFavorite,
    translationMode,
    dictation,
    onWordLookup
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const lastUserScrollRef = useRef(0);

    // Detect manual scrolling so auto-follow doesn't fight the reader
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const mark = () => { lastUserScrollRef.current = Date.now(); };
        el.addEventListener('wheel', mark, { passive: true });
        el.addEventListener('touchmove', mark, { passive: true });
        return () => {
            el.removeEventListener('wheel', mark);
            el.removeEventListener('touchmove', mark);
        };
    }, []);

    // Apple-Music-style lyric follow: keep the active sentence ~1/3 from the
    // top, scrolling one small step per sentence instead of page jumps.
    useEffect(() => {
        if (activeIndex < 0) return;
        const container = containerRef.current;
        if (!container) return;
        if (Date.now() - lastUserScrollRef.current < USER_SCROLL_GRACE_MS) return;

        const el = container.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
        if (!el) return;

        const cRect = container.getBoundingClientRect();
        const eRect = el.getBoundingClientRect();
        const target = container.scrollTop + (eRect.top - cRect.top) - container.clientHeight * 0.32;

        // Skip sub-pixel adjustments; smooth-scroll the rest. Reduced-motion
        // users (and browsers that no-op smooth programmatic scrolls under it)
        // get an instant jump instead.
        if (Math.abs(target - container.scrollTop) < 4) return;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        container.scrollTo({ top: Math.max(0, target), behavior: reduceMotion ? 'auto' : 'smooth' });
    }, [activeIndex]);

    return (
        <div
            ref={containerRef}
            className="h-full overflow-y-auto bg-transparent border-l border-white/5 custom-scrollbar px-6 py-6 relative"
        >
            <div className="space-y-1.5 pb-[45vh]">
                {transcript.map((item, index) => {
                    const isActive = index === activeIndex;
                    return (
                        <div
                            key={`${item.id}-${index}`}
                            data-index={index}
                            data-active={isActive}
                            onClick={() => onTranscriptClick(item.start)}
                        >
                            <TranscriptBlock
                                id={item.id}
                                start={item.start}
                                end={item.end}
                                enText={item.en_text}
                                zhText={item.zh_text}
                                highlights={item.highlights}
                                isActive={isActive}
                                isFavorited={favorites.includes(`${videoId}-${item.id}`)}
                                onToggleFavorite={() => onToggleFavorite(item)}
                                translationMode={translationMode}
                                dictation={dictation}
                                onWordLookup={onWordLookup}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Re-render only when the active sentence (or actual content/props) change —
// never on raw playback time ticks.
export const TranscriptView = React.memo(TranscriptViewInner);
