import { apiFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import { X, Play, RefreshCw, Film } from 'lucide-react';

export interface HistoryMetadata {
    title: string;
    channel: string;
    upload_date: string;
    thumbnail: string;
    is_local_subtitle?: boolean;
}

export interface HistoryItem {
    filename: string;
    videoId?: string;
    metadata: HistoryMetadata;
}

interface ChannelVideoListProps {
    isOpen: boolean;
    onClose: () => void;
    channelName: string | null;
    onLoadHistory: (filename: string) => void;
    onReprocess: (videoId: string) => void;
}

export const ChannelVideoList: React.FC<ChannelVideoListProps> = ({ isOpen, onClose, channelName, onLoadHistory, onReprocess }) => {
    const [videos, setVideos] = useState<HistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && channelName) {
            setIsLoading(true);
            apiFetch('/api/history')
                .then(res => res.json())
                .then((data: HistoryItem[]) => {
                    // Filter by the selected channel name and sort by upload date (newest first)
                    const filtered = data.filter(item => item.metadata?.channel === channelName);
                    filtered.sort((a, b) => {
                        const dateA = a.metadata?.upload_date || "";
                        const dateB = b.metadata?.upload_date || "";
                        return dateB.localeCompare(dateA); // Descending order
                    });
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-md p-4 animate-[fadeIn_0.25s_ease-out]">
            <div className="bg-zinc-900/90 backdrop-blur-2xl border border-white/10 w-full max-w-4xl rounded-2xl shadow-2xl shadow-black/60 flex flex-col max-h-[85vh] overflow-hidden animate-[slideUp_0.32s_cubic-bezier(0.25,1,0.5,1)]">
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight text-zinc-100">{channelName} <span className="text-zinc-500 font-normal">的视频</span></h2>
                        <p className="text-sm text-zinc-400 mt-0.5">来自你的本地学习记录</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {isLoading ? (
                        <div className="text-center py-12 text-zinc-500">加载中…</div>
                    ) : videos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Film className="w-10 h-10 text-zinc-700 mb-3" />
                            <p className="text-sm font-medium text-zinc-400">该频道还没有其他已处理的视频</p>
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
                                    className="p-3 bg-zinc-800/30 rounded-xl border border-white/5 cursor-pointer hover:border-white/10 hover:bg-zinc-800/60 transition-[background-color,border-color] duration-200 group flex flex-col"
                                >
                                    <div className="relative aspect-video bg-zinc-950 overflow-hidden rounded-lg">
                                        {video.metadata.thumbnail ? (
                                            <img
                                                src={video.metadata.thumbnail}
                                                alt={video.metadata.title}
                                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-[1.04] transition-[transform,opacity] duration-300 ease-apple"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-700">无封面</div>
                                        )}
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="bg-white/20 backdrop-blur-md backdrop-saturate-150 p-3 rounded-full text-white shadow-lg shadow-black/40 scale-90 group-hover:scale-100 transition-transform duration-300 ease-apple">
                                                <Play className="w-5 h-5 ml-0.5 fill-current" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-3 flex flex-col flex-1">
                                        <h3 className="text-zinc-200 font-medium line-clamp-2 text-sm leading-snug mb-2 group-hover:text-white transition-colors">
                                            {video.metadata.title || '未知标题'}
                                        </h3>
                                        <div className="mt-auto flex items-center justify-between">
                                            <span className="text-xs text-zinc-500 tabular-nums">上传于 {formatDate(video.metadata.upload_date)}</span>
                                            {video.videoId && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onClose();
                                                        onReprocess(video.videoId!);
                                                    }}
                                                    className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors z-10"
                                                    title="重新处理"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                </button>
                                            )}
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
