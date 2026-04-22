import React from 'react';
import { X, Play, Trash2 } from 'lucide-react';

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
    if (!timestamp) return '更早 (Older)';

    const now = new Date();
    const date = new Date(timestamp);
    
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    if (date >= today) return '今天 (Today)';
    if (date >= yesterday && date < today) return '昨天 (Yesterday)';
    if (date >= lastWeek && date < yesterday) return '过去7天 (Last 7 days)';
    
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

    if (!isOpen) return null;

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
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-900 w-full h-full overflow-hidden">
            <div className="w-full flex flex-col h-full mx-auto max-w-5xl">
                <div className="flex items-center justify-between p-6 border-b border-gray-800 shrink-0">
                    <h2 className="text-2xl font-bold text-white">My Favorites</h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                    {favorites.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <p>No favorites yet.</p>
                            <p className="text-sm mt-2">Click the star icon next to a sentence to save it.</p>
                        </div>
                    ) : (
                        Object.entries(groups).map(([title, items]) => {
                            const isCollapsed = collapsedGroups[title];
                            return (
                                <div key={title} className="space-y-3">
                                    <button 
                                        onClick={() => toggleGroup(title)}
                                        className="flex items-center gap-2 text-white font-semibold text-lg hover:text-purple-400 transition-colors w-full text-left"
                                    >
                                        {isCollapsed ? <ChevronRight className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-purple-400" />}
                                        {title} <span className="text-sm font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{items.length}</span>
                                    </button>
                                    
                                    {!isCollapsed && (
                                        <div className="space-y-3 pl-2 sm:pl-7 border-l-2 border-transparent">
                                            {items.map((fav) => (
                                                <div key={fav.id} className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50 flex gap-4 group hover:bg-gray-800 transition-colors">
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <span className="text-xs font-medium text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md">
                                                                {formatTime(fav.start)}
                                                            </span>
                                                            <span className="text-xs text-gray-500">Video ID: {fav.videoId}</span>
                                                        </div>
                                                        <p className="text-gray-200 font-medium leading-relaxed">
                                                            <HighlightedText 
                                                                text={fav.en_text} 
                                                                highlights={(fav.highlights || []).map(h => ({ 
                                                                    word: h.en_word, 
                                                                    color: h.color, 
                                                                    annotation: h.zh_word 
                                                                }))} 
                                                            />
                                                        </p>
                                                        <p className="text-gray-400 text-sm leading-relaxed">{fav.zh_text}</p>
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
                                                            className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                                                            title={fav.videoId.length > 11 ? "Go to Transcript" : "Play Video"}
                                                        >
                                                            <Play className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => onRemoveFavorite(fav.id)}
                                                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                                                            title="Remove"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {playingFav && (
                <div className="fixed bottom-8 right-8 w-96 aspect-video bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-700 z-[60] group cursor-move">
                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => setPlayingFav(null)} 
                            className="p-1.5 text-white bg-black/60 rounded-full hover:bg-red-500 transition-colors backdrop-blur-md"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <VideoPlayer
                        videoId={playingFav.videoId}
                        seekCommand={{ time: playingFav.start, timestamp: Date.now() }}
                        onTimeUpdate={() => {}}
                    />
                </div>
            )}
        </div>
    );
};
