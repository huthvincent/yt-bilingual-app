import React, { useEffect, useRef } from 'react';
import { TranscriptBlock } from './TranscriptBlock';

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
    currentTime: number;
    videoId: string;
    favorites: string[];
    onTranscriptClick: (time: number) => void;
    onToggleFavorite: (item: TranscriptItem) => void;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
    transcript,
    currentTime,
    videoId,
    favorites,
    onTranscriptClick,
    onToggleFavorite
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Add an offset so the text moves slightly before the rigid timestamp boundary.
    // YouTube transcripts can be slightly padded, and humans read ahead of the spoken word.
    const effectiveTime = currentTime + 0.8;

    let activeIndex = -1;
    for (let i = 0; i < transcript.length; i++) {
        const item = transcript[i];
        if (effectiveTime >= item.start && effectiveTime < item.end) {
            // Exact match inside the block
            activeIndex = i;
            break;
        } else if (effectiveTime >= item.end) {
            // Video has passed this block, it might be a gap, keep it as the active one until the next one starts
            activeIndex = i;
        } else {
            // We have reached a block that starts in the future, stop searching
            break;
        }
    }

    useEffect(() => {
        // Page-by-page scroll: only scroll when active block is outside the visible area
        if (activeIndex !== -1 && containerRef.current) {
            const container = containerRef.current;
            const activeElement = container.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
            if (activeElement) {
                const containerRect = container.getBoundingClientRect();
                const activeRect = activeElement.getBoundingClientRect();

                // Check if the active element is below the visible area
                const isBelow = activeRect.bottom > containerRect.bottom - 40;
                // Check if the active element is above the visible area
                const isAbove = activeRect.top < containerRect.top + 40;

                if (isBelow || isAbove) {
                    // Scroll so the active element appears near the top of the container
                    const scrollTarget = activeElement.offsetTop - container.offsetTop - 20;
                    container.scrollTo({
                        top: scrollTarget,
                        behavior: 'smooth'
                    });
                }
            }
        }
    }, [activeIndex]);

    return (
        <div
            ref={containerRef}
            className="h-full overflow-y-auto bg-transparent border-l border-white/5 custom-scrollbar px-6 py-6 relative"
        >
            <div className="space-y-1.5 pb-32">
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
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
