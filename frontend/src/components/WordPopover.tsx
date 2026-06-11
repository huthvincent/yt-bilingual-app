import { useEffect, useState } from 'react';
import { X, Volume2, Star, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiFetch } from '../lib/api';
import { describeApiError } from '../lib/toast';
import { speak } from '../lib/tts';

export interface WordDefinition {
    word: string;
    lemma?: string;
    ipa?: string;
    pos?: string;
    zh: string;
    definition_en?: string;
    example?: string;
}

interface WordPopoverProps {
    word: string;
    context: string;
    x: number;
    y: number;
    onClose: () => void;
    onToggleFavorite: (def: WordDefinition) => void;
    isFavorited: boolean;
}

const CARD_WIDTH = 320;
const CARD_EST_HEIGHT = 240;

export const WordPopover: React.FC<WordPopoverProps> = ({ word, context, x, y, onClose, onToggleFavorite, isFavorited }) => {
    const [definition, setDefinition] = useState<WordDefinition | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setDefinition(null);
        setError(null);
        (async () => {
            try {
                const res = await apiFetch('/api/define', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ word, context }),
                });
                if (!res.ok) throw new Error(await describeApiError(res));
                const data = await res.json();
                if (!cancelled) setDefinition(data);
            } catch (e) {
                if (!cancelled) setError(await describeApiError(e));
            }
        })();
        return () => { cancelled = true; };
    }, [word, context]);

    // Keep the card inside the viewport
    const left = Math.max(12, Math.min(x - CARD_WIDTH / 2, window.innerWidth - CARD_WIDTH - 12));
    const top = y + CARD_EST_HEIGHT + 24 > window.innerHeight
        ? Math.max(12, y - CARD_EST_HEIGHT - 12)
        : y + 12;

    return (
        <>
            {/* click-away layer */}
            <div className="fixed inset-0 z-[80]" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="fixed z-[90] w-80 rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 p-4"
                style={{ left, top }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                        <span className="text-lg font-bold text-zinc-100 break-all">{definition?.word || word}</span>
                        {definition?.ipa && <span className="text-xs text-zinc-400 font-mono">{definition.ipa}</span>}
                        {definition?.pos && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 font-medium">{definition.pos}</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={() => speak(definition?.word || word)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 transition-colors"
                            title="朗读"
                        >
                            <Volume2 className="w-4 h-4" />
                        </button>
                        {definition && (
                            <button
                                onClick={() => onToggleFavorite(definition)}
                                className={`p-1.5 rounded-lg transition-colors hover:bg-zinc-800 ${isFavorited ? 'text-amber-400' : 'text-zinc-400 hover:text-amber-400'}`}
                                title={isFavorited ? '移出生词本' : '加入生词本'}
                            >
                                <Star className="w-4 h-4" fill={isFavorited ? 'currentColor' : 'none'} />
                            </button>
                        )}
                        <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {!definition && !error && (
                    <div className="flex items-center gap-2 py-4 text-zinc-500 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> 查询中…
                    </div>
                )}

                {error && <p className="py-3 text-sm text-red-400">{error}</p>}

                {definition && (
                    <div className="space-y-2 mt-1">
                        <p className="text-base text-zinc-100 font-medium">{definition.zh}</p>
                        {definition.definition_en && (
                            <p className="text-xs text-zinc-400 leading-relaxed">{definition.definition_en}</p>
                        )}
                        {definition.example && (
                            <button
                                onClick={() => speak(definition.example!)}
                                className="w-full text-left text-xs text-zinc-500 italic leading-relaxed border-l-2 border-zinc-700 pl-2 hover:text-zinc-300 transition-colors"
                                title="点击朗读例句"
                            >
                                {definition.example}
                            </button>
                        )}
                        {definition.lemma && definition.lemma.toLowerCase() !== (definition.word || word).toLowerCase() && (
                            <p className="text-[11px] text-zinc-600">原形：{definition.lemma}</p>
                        )}
                    </div>
                )}
            </motion.div>
        </>
    );
};
