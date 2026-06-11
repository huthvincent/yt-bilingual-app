import React, { useMemo, useState } from 'react';
import { Star, Languages } from 'lucide-react';
import { isUntranslated } from '../lib/transcript';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { motion } from 'framer-motion';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const HighlightedText: React.FC<{ text: string; highlights: Array<{ word: string; color: string; annotation?: string }> }> = ({ text, highlights }) => {
    if (!highlights || highlights.length === 0) return <span>{text}</span>;

    const parts: React.ReactNode[] = [];
    let currentIndex = 0;

    const matches = highlights.map(hl => {
        const idx = text.indexOf(hl.word);
        return { ...hl, index: idx, length: hl.word.length };
    }).filter(m => m.index !== -1).sort((a, b) => a.index - b.index);

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

export const TranscriptBlock: React.FC<TranscriptBlockProps> = ({ start, enText, zhText, highlights, isActive, isFavorited, onToggleFavorite }) => {
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const [showTranslation, setShowTranslation] = useState(false);

    const enHighlights = useMemo(() => highlights.map(h => ({ word: h.en_word, color: h.color, annotation: h.zh_word })), [highlights]);
    const zhHighlights = useMemo(() => highlights.map(h => ({ word: h.zh_word, color: h.color })), [highlights]);

    return (
        <div
            className={cn(
                "relative px-4 py-3 rounded-2xl transition-colors duration-300 ease-in-out cursor-pointer group",
                !isActive && "hover:bg-zinc-800/40"
            )}
        >
            {isActive && (
                <motion.div
                    layoutId="activeTranscript"
                    className="absolute inset-0 bg-zinc-800/60 rounded-2xl border border-zinc-700/50 shadow-lg shadow-black/20"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            )}
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <span className={cn(
                            "text-xs font-mono tracking-wider",
                            isActive ? "text-blue-400" : "text-zinc-500"
                        )}>
                            [{formatTime(start)}]
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowTranslation(prev => !prev);
                            }}
                            className={cn(
                                "p-1 rounded-md transition-colors",
                                showTranslation ? "bg-blue-500/10 text-blue-400" : "hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
                            )}
                            title="Toggle Translation"
                        >
                            <Languages className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite?.(e);
                        }}
                        className="p-1.5 rounded-md hover:bg-zinc-700/50 transition-colors opacity-0 group-hover:opacity-100"
                    >
                        <Star
                            className={cn("w-4 h-4 transition-colors", isFavorited ? "fill-amber-400 text-amber-400 opacity-100" : "text-zinc-500 hover:text-zinc-300")}
                        />
                    </button>
                </div>

                <div className="space-y-1">
                    <p className={cn(
                        "text-base leading-relaxed tracking-wide transition-colors",
                        isActive ? "text-zinc-100 font-medium" : "text-zinc-400"
                    )}>
                        <HighlightedText text={enText} highlights={enHighlights} />
                    </p>
                    <div className={cn(
                        "grid transition-all duration-300 ease-in-out",
                        showTranslation ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 mt-0"
                    )}>
                        <div className="overflow-hidden">
                            {isUntranslated(zhText) ? (
                                <p className="text-sm leading-relaxed text-zinc-600 italic animate-pulse">
                                    翻译中…
                                </p>
                            ) : (
                                <p className={cn(
                                    "text-sm leading-relaxed transition-colors",
                                    isActive ? "text-zinc-300" : "text-zinc-500"
                                )}>
                                    <HighlightedText text={zhText} highlights={zhHighlights} />
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
