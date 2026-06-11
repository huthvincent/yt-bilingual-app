import React from 'react';
import { X, Play, Trash2, Star, Download, FileSpreadsheet } from 'lucide-react';
import { exportAnkiTsv, exportCsv } from '../lib/exporter';
import { motion, AnimatePresence } from 'framer-motion';

export interface FavoriteItem {
    id: string;
    videoId: string;
    start: number;
    en_text: string;
    zh_text: string;
    added_at?: number;
    highlights?: Array<{
        en_word: string;
        zh_word: string;
        color: string;
    }>;
    type?: 'sentence' | 'vocabulary';
    context_en?: string;
    context_zh?: string;
}

interface FavoritesModalProps {
    isOpen: boolean;
    onClose: () => void;
    favorites: FavoriteItem[];
    onRemoveFavorite: (id: string) => void;
    onPlayFavorite: (videoId: string, start: number) => void;
}
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { HighlightedText } from './TranscriptBlock';

// Help functions for grouping logic
const getGroupTitle = (timestamp?: number) => {
    if (!timestamp) return '更早';

    const now = new Date();
    const date = new Date(timestamp);
    
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    if (date >= today) return '今天';
    if (date >= yesterday && date < today) return '昨天';
    if (date >= lastWeek && date < yesterday) return '过去 7 天';
    
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
};

// ... inside the component
export const FavoritesModal: React.FC<FavoritesModalProps> = ({ isOpen, onClose, favorites, onRemoveFavorite, onPlayFavorite }) => {
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const [playingFav, setPlayingFav] = useState<{ videoId: string, start: number } | null>(null);

    // Group the favorites
    const groups = useMemo(() => {
        const sorted = [...favorites].sort((a, b) => (b.added_at || 0) - (a.added_at || 0));
        const map: Record<string, typeof favorites> = {};
        
        sorted.forEach(fav => {
            const title = getGroupTitle(fav.added_at);
            if (!map[title]) map[title] = [];
            map[title].push(fav);
        });

        return map;
    }, [favorites]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleGroup = (title: string) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [title]: !prev[title]
        }));
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex flex-col bg-zinc-950/80 backdrop-blur-2xl w-full h-full overflow-hidden"
                >
                    <motion.div 
                        initial={{ y: 50, scale: 0.98, opacity: 0 }}
                        animate={{ y: 0, scale: 1, opacity: 1 }}
                        exit={{ y: 20, scale: 0.98, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="w-full flex flex-col h-full mx-auto max-w-5xl bg-[#09090b]/50 shadow-2xl"
                    >
                        <div className="flex items-center justify-between p-8 border-b border-white/5 shrink-0">
                            <h2 className="text-3xl font-extrabold text-zinc-100 tracking-tight">我的收藏</h2>
                            <div className="flex items-center gap-2">
                                {favorites.length > 0 && (
                                    <>
                                        <button
                                            onClick={() => exportAnkiTsv(favorites)}
                                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800/60 hover:bg-zinc-700/60 border border-white/5 rounded-xl transition-colors"
                                            title="导出为 Anki 可导入的 TSV 文件（前面：英文，背面：中文+例句）"
                                        >
                                            <Download className="w-4 h-4" /> 导出 Anki
                                        </button>
                                        <button
                                            onClick={() => exportCsv(favorites)}
                                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800/60 hover:bg-zinc-700/60 border border-white/5 rounded-xl transition-colors"
                                            title="导出为 CSV 表格（含完整上下文）"
                                        >
                                            <FileSpreadsheet className="w-4 h-4" /> 导出 CSV
                                        </button>
                                    </>
                                )}
                                <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar space-y-8">
                            {favorites.length === 0 ? (
                                <div className="text-center py-20 text-zinc-500">
                                    <Star className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
                                    <p className="text-lg font-medium">还没有收藏</p>
                                    <p className="text-sm mt-2">观看时点击句子旁的星标收藏句子，查词后点星号加入生词本。</p>
                                </div>
                            ) : (
                                Object.entries(groups).map(([title, items]) => {
                                    const isCollapsed = collapsedGroups[title];
                                    return (
                                        <div key={title} className="space-y-4">
                                            <button 
                                                onClick={() => toggleGroup(title)}
                                                className="flex items-center gap-2 text-zinc-100 font-bold text-xl hover:text-blue-400 transition-colors w-full text-left"
                                            >
                                                {isCollapsed ? <ChevronRight className="w-5 h-5 text-zinc-500" /> : <ChevronDown className="w-5 h-5 text-blue-400" />}
                                                {title} <span className="text-sm font-normal text-zinc-500 bg-zinc-800 px-3 py-0.5 rounded-full">{items.length}</span>
                                            </button>
                                            
                                            <AnimatePresence>
                                                {!isCollapsed && (
                                                    <motion.div 
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="space-y-4 pl-2 sm:pl-7 border-l border-white/5 overflow-hidden"
                                                    >
                                                        {items.map((fav) => (
                                                            <motion.div 
                                                                layout
                                                                initial={{ opacity: 0, x: -10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                key={fav.id} 
                                                                className="glass-card rounded-2xl p-6 flex gap-4 group hover:bg-zinc-800/60 transition-colors"
                                                            >
                                                                <div className="flex-1 space-y-3">
                                                                    <div className="flex items-center gap-3 mb-2">
                                                                        <span className="text-xs font-mono font-medium text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md">
                                                                            {formatTime(fav.start)}
                                                                        </span>
                                                                        {fav.type === 'vocabulary' && (
                                                                            <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md">生词</span>
                                                                        )}
                                                                    </div>
                                                                    {fav.type === 'vocabulary' && fav.en_text && fav.zh_text ? (
                                                                        <div className="mb-3 p-4 bg-zinc-900/80 rounded-xl border border-white/5 inline-block shadow-inner">
                                                                            <div className="flex items-center gap-3">
                                                                                <span className="text-xl font-bold text-amber-400">{fav.en_text}</span>
                                                                                <span className="text-sm text-zinc-400 font-medium">{fav.zh_text}</span>
                                                                            </div>
                                                                        </div>
                                                                    ) : null}
                                                                    <div className={fav.type === 'vocabulary' ? 'opacity-70 text-sm' : ''}>
                                                                        <p className="text-zinc-200 font-medium leading-relaxed mb-2 text-lg">
                                                                            <HighlightedText 
                                                                                text={fav.type === 'vocabulary' ? (fav.context_en || '') : fav.en_text} 
                                                                                highlights={(fav.highlights || []).map(h => ({ 
                                                                                    word: h.en_word, 
                                                                                    color: h.color, 
                                                                                    annotation: h.zh_word 
                                                                                }))} 
                                                                            />
                                                                        </p>
                                                                        <p className="text-zinc-400 text-sm leading-relaxed">{fav.type === 'vocabulary' ? fav.context_zh : fav.zh_text}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col gap-2 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={() => {
                                                                            if (fav.videoId.length > 11) {
                                                                                onClose();
                                                                                onPlayFavorite(fav.videoId, fav.start);
                                                                            } else {
                                                                                setPlayingFav({ videoId: fav.videoId, start: fav.start });
                                                                            }
                                                                        }}
                                                                        className="p-3 bg-zinc-100 hover:bg-white text-zinc-900 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-md"
                                                                        title={fav.videoId.length > 11 ? "跳转到原文" : "播放片段"}
                                                                    >
                                                                        <Play className="w-4 h-4 fill-current" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => onRemoveFavorite(fav.id)}
                                                                        className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors"
                                                                        title="删除"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>

                    {playingFav && (
                        <div className="fixed bottom-8 right-8 w-[480px] aspect-video bg-black rounded-2xl shadow-2xl overflow-hidden border border-white/10 z-[60] group cursor-move">
                            <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => setPlayingFav(null)} 
                                    className="p-2 text-white bg-black/60 rounded-full hover:bg-red-500 transition-colors backdrop-blur-md"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <VideoPlayer
                                videoId={playingFav.videoId}
                                seekCommand={{ time: playingFav.start, timestamp: Date.now() }}
                                onTimeUpdate={() => {}}
                            />
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};
