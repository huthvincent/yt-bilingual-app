import React, { useMemo } from 'react';
import { Star } from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Highlight logic: Exact substring replacement with optional annotation (e.g. Chinese translation in parentheses)
const HighlightedText: React.FC<{ text: string; highlights: Array<{ word: string; color: string; annotation?: string }> }> = ({ text, highlights }) => {
    if (!highlights || highlights.length === 0) return <span>{text}</span>;

    const parts: React.ReactNode[] = [];
    let currentIndex = 0;

    // Sort highlights by their position in the text (left to right)
    const matches = highlights.map(hl => {
        const idx = text.indexOf(hl.word);
        return { ...hl, index: idx, length: hl.word.length };
    }).filter(m => m.index !== -1).sort((a, b) => a.index - b.index);

    // Remove overlapping matches (keep first)
    const validMatches: typeof matches = [];
    let lastEnd = 0;
    for (const match of matches) {
        if (match.index >= lastEnd) {
            validMatches.push(match);
            lastEnd = match.index + match.length;
        }
    }

    if (validMatches.length === 0) return <span>{text}</span>;

    validMatches.forEach((match, i) => {
        if (match.index > currentIndex) {
            parts.push(<span key={`text-${i}`}>{text.slice(currentIndex, match.index)}</span>);
        }
        parts.push(
            <span key={`hl-${i}`} className={match.color}>
                {text.slice(match.index, match.index + match.length)}
            </span>
        );
        // Show Chinese annotation in parentheses after the highlighted word
        if (match.annotation) {
            parts.push(
                <span key={`ann-${i}`} className="text-xs text-purple-300/70 ml-0.5">
                    ({match.annotation})
                </span>
            );
        }
        currentIndex = match.index + match.length;
    });

    if (currentIndex < text.length) {
        parts.push(<span key={`text-end`}>{text.slice(currentIndex)}</span>);
    }

    return <>{parts}</>;
};


interface TranscriptBlockProps {
    id: number;
    start: number;
    end: number;
    enText: string;
    zhText: string;
    highlights: Array<{
        en_word: string;
        zh_word: string;
        color: string;
    }>;
    isActive: boolean;
    isFavorited?: boolean;
    onToggleFavorite?: (e: React.MouseEvent) => void;
}

export const TranscriptBlock: React.FC<TranscriptBlockProps> = ({ start, end, enText, zhText, highlights, isActive, isFavorited, onToggleFavorite }) => {
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // English highlights include annotation (zh_word shown in parentheses after the word)
    const enHighlights = useMemo(() => highlights.map(h => ({ word: h.en_word, color: h.color, annotation: h.zh_word })), [highlights]);
    // Chinese highlights: no annotation needed
    const zhHighlights = useMemo(() => highlights.map(h => ({ word: h.zh_word, color: h.color })), [highlights]);

    return (
        <div
            className={cn(
                "p-5 rounded-xl border border-transparent transition-all duration-300 ease-in-out cursor-pointer hover:bg-gray-800/80 group",
                isActive ? "bg-gray-800/90 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/20" : ""
            )}
        >
            <div className="flex items-center justify-between mb-3">
                <span className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-full bg-gray-900 ring-1",
                    isActive ? "text-purple-400 ring-purple-500/50" : "text-gray-400 ring-white/10"
                )}>
                    {formatTime(start)} - {formatTime(end)}
                </span>

                <button
                    onClick={(e) => {
                        e.stopPropagation(); // prevent seek click
                        onToggleFavorite?.(e);
                    }}
                    className="p-1.5 rounded-md hover:bg-gray-700 transition-colors"
                >
                    <Star
                        className={cn("w-5 h-5 transition-colors", isFavorited ? "fill-yellow-500 text-yellow-500" : "text-gray-500 hover:text-gray-300")}
                    />
                </button>
            </div>

            <div className="space-y-4">
                <p className={cn(
                    "text-lg font-medium leading-relaxed tracking-wide",
                    isActive ? "text-white" : "text-gray-200"
                )}>
                    <HighlightedText text={enText} highlights={enHighlights} />
                </p>
                <p className={cn(
                    "text-[15px] leading-relaxed",
                    isActive ? "text-purple-50" : "text-gray-400"
                )}>
                    <HighlightedText text={zhText} highlights={zhHighlights} />
                </p>
            </div>
        </div>
    );
};
