import React from 'react';
import { X, Play, Trash2 } from 'lucide-react';

export interface FavoriteItem {
    id: string;
    videoId: string;
    start: number;
    en_text: string;
    zh_text: string;
}

interface FavoritesModalProps {
    isOpen: boolean;
    onClose: () => void;
    favorites: FavoriteItem[];
    onRemoveFavorite: (id: string) => void;
    onPlayFavorite: (videoId: string, start: number) => void;
}

export const FavoritesModal: React.FC<FavoritesModalProps> = ({ isOpen, onClose, favorites, onRemoveFavorite, onPlayFavorite }) => {
    if (!isOpen) return null;

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <h2 className="text-2xl font-bold text-white">My Favorites</h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
                    {favorites.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <p>No favorites yet.</p>
                            <p className="text-sm mt-2">Click the star icon next to a sentence to save it.</p>
                        </div>
                    ) : (
                        favorites.map(fav => (
                            <div key={fav.id} className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50 flex gap-4 group">
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-xs font-medium text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md">
                                            {formatTime(fav.start)}
                                        </span>
                                        <span className="text-xs text-gray-500">Video ID: {fav.videoId}</span>
                                    </div>
                                    <p className="text-gray-200 font-medium">{fav.en_text}</p>
                                    <p className="text-gray-400 text-sm">{fav.zh_text}</p>
                                </div>
                                <div className="flex flex-col gap-2 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            onClose();
                                            onPlayFavorite(fav.videoId, fav.start);
                                        }}
                                        className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                                        title="Play Video"
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
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
