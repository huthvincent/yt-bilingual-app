import React, { useState, useEffect } from 'react';
import { X, Play } from 'lucide-react';

export interface HistoryMetadata {
    title: string;
    channel: string;
    upload_date: string;
    thumbnail: string;
}

export interface HistoryItem {
    filename: string;
    metadata: HistoryMetadata;
}

interface ChannelVideoListProps {
    isOpen: boolean;
    onClose: () => void;
    channelName: string | null;
    onLoadHistory: (filename: string) => void;
}

export const ChannelVideoList: React.FC<ChannelVideoListProps> = ({ isOpen, onClose, channelName, onLoadHistory }) => {
    const [videos, setVideos] = useState<HistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && channelName) {
            setIsLoading(true);
            fetch('http://127.0.0.1:8000/api/history')
                .then(res => res.json())
                .then((data: HistoryItem[]) => {
                    // Filter by the selected channel name
                    const filtered = data.filter(item => item.metadata?.channel === channelName);
                    setVideos(filtered);
                })
                .catch(err => console.error("Failed to fetch channel history:", err))
                .finally(() => setIsLoading(false));
        }
    }, [isOpen, channelName]);

    if (!isOpen || !channelName) return null;

    const formatDate = (dateStr: string) => {
        if (!dateStr || dateStr.length !== 8) return dateStr;
        return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{channelName} <span className="text-gray-400 font-normal">Videos</span></h2>
                        <p className="text-sm text-gray-500 mt-1">From your local learning history</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {isLoading ? (
                        <div className="text-center py-12 text-gray-500">Loading videos...</div>
                    ) : videos.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <p>No other videos found for this channel.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {videos.map(video => (
                                <div
                                    key={video.filename}
                                    onClick={() => {
                                        onClose();
                                        onLoadHistory(video.filename);
                                    }}
                                    className="bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden cursor-pointer hover:border-purple-500/50 hover:bg-gray-800/80 transition-all group flex flex-col"
                                >
                                    <div className="relative aspect-video bg-gray-950 overflow-hidden">
                                        {video.metadata.thumbnail ? (
                                            <img
                                                src={video.metadata.thumbnail}
                                                alt={video.metadata.title}
                                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-700">No Thumbnail</div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="bg-purple-600 p-3 rounded-full text-white shadow-lg shadow-purple-900/50">
                                                <Play className="w-6 h-6 ml-1" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 flex flex-col flex-1">
                                        <h3 className="text-gray-200 font-medium line-clamp-2 text-sm leading-snug mb-2 group-hover:text-purple-300 transition-colors">
                                            {video.metadata.title || 'Unknown Title'}
                                        </h3>
                                        <div className="mt-auto text-xs text-gray-500">
                                            Uploaded: {formatDate(video.metadata.upload_date)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
