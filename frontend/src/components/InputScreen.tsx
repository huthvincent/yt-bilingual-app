import React, { useState, useEffect } from 'react';
import { Search, Loader2, Play, Youtube, Clock } from 'lucide-react';
import type { HistoryItem } from './ChannelVideoList';
import { ModelSelectionModal } from './ModelSelectionModal';
import type { EstimationData } from './ModelSelectionModal';

interface InputScreenProps {
    onSubmit: (url: string) => void;
    onLoadHistory: (filename: string) => void;
    isLoading: boolean;
    subscriptions?: { id: string; name: string }[];
}

export const InputScreen: React.FC<InputScreenProps> = ({ onSubmit, onLoadHistory, isLoading, subscriptions = [] }) => {
    const [url, setUrl] = useState('');
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [channelUpdates, setChannelUpdates] = useState<any[]>([]);

    const [isEstimating, setIsEstimating] = useState(false);
    const [estimationData, setEstimationData] = useState<EstimationData | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pendingUrl, setPendingUrl] = useState('');

    useEffect(() => {
        fetch('http://127.0.0.1:8000/api/history')
            .then(res => res.json())
            .then(data => setHistory(data))
            .catch(err => console.error("Failed to fetch history:", err));

        if (subscriptions.length > 0) {
            fetch('http://127.0.0.1:8000/api/channel-updates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channels: subscriptions.map(s => s.id) })
            })
                .then(res => res.json())
                .then(data => setChannelUpdates(data.updates || []))
                .catch(err => console.error("Failed to fetch channel updates:", err));
        }
    }, [subscriptions]);

    const handleInterceptSubmit = async (targetUrl: string) => {
        setIsEstimating(true);
        setPendingUrl(targetUrl);
        try {
            const urlToFetch = `http://127.0.0.1:8000/api/estimate-cost?url=${encodeURIComponent(targetUrl)}`;
            const response = await fetch(urlToFetch);

            if (!response.ok) {
                // Determine if it's a known backend failure or just an error
                throw new Error("Failed to estimate cost for this video");
            }
            const data = await response.json();
            setEstimationData(data);
            setIsModalOpen(true);
        } catch (err) {
            console.error("Estimation failed:", err);
            // Fallback directly to processing if estimation fails (e.g. backend issue)
            onSubmit(targetUrl);
        } finally {
            setIsEstimating(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url.trim()) {
            handleInterceptSubmit(url.trim());
        }
    };

    const handleConfirmModel = (_modelId: string) => {
        setIsModalOpen(false);
        onSubmit(pendingUrl); // Future: pass _modelId to backend
    };

    return (
        <div className="min-h-screen flex flex-col items-center bg-gray-900 p-8 pt-20 overflow-y-auto custom-scrollbar relative">
            {isLoading && !isEstimating && (
                <div className="fixed inset-0 z-50 bg-gray-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
                    <Loader2 className="w-16 h-16 text-purple-500 animate-spin mb-6" />
                    <h2 className="text-2xl font-bold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">Processing Video...</h2>
                    <p className="text-gray-300">This may take a minute or two for long videos</p>
                </div>
            )}

            {isEstimating && (
                <div className="fixed inset-0 z-50 bg-gray-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
                    <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-6" />
                    <h2 className="text-2xl font-bold text-white mb-2">Estimating Costs...</h2>
                    <p className="text-gray-400">Analyzing transcript length and models</p>
                </div>
            )}

            <ModelSelectionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirmModel}
                estimationData={estimationData}
            />

            <div className="max-w-xl w-full space-y-8 shrink-0">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold text-white">
                        Learn English with YouTube
                    </h2>
                    <p className="mt-2 text-sm text-gray-400">
                        Paste a YouTube video URL to get a bilingual interactive transcript.
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label htmlFor="video-url" className="sr-only">
                                YouTube URL
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </div>
                                <input
                                    id="video-url"
                                    name="url"
                                    type="url"
                                    disabled={isLoading}
                                    required
                                    className="appearance-none rounded-md relative block w-full px-3 py-4 pl-10 border border-gray-700 bg-gray-800 placeholder-gray-500 text-white focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-lg"
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading || !url.trim()}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                                    Processing Video & Transcript...
                                </>
                            ) : (
                                'Start Learning'
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {history.length > 0 && (
                <div className="w-full max-w-6xl opacity-0 animate-[fadeIn_0.5s_ease-out_0.3s_forwards] mt-12">
                    <div className="flex items-center gap-2 mb-6 text-gray-400 border-b border-gray-800 pb-2 pl-2">
                        <Clock className="w-5 h-5" />
                        <h3 className="font-semibold text-lg text-white">Your Learning History</h3>
                    </div>
                    {/* Horizontal scroll container for History */}
                    <div className="flex overflow-x-auto gap-4 pb-6 px-2 custom-scrollbar snap-x">
                        {history.map(item => (
                            <div
                                key={item.filename}
                                onClick={() => onLoadHistory(item.filename)}
                                className="bg-gray-800 shrink-0 min-w-[260px] w-[260px] snap-start hover:bg-gray-700 border border-gray-700 hover:border-purple-500/50 rounded-2xl overflow-hidden cursor-pointer transition-all group flex flex-col shadow-lg"
                            >
                                <div className="relative aspect-square bg-gray-950 overflow-hidden">
                                    {item.metadata?.thumbnail ? (
                                        <img
                                            src={item.metadata.thumbnail}
                                            alt={item.metadata.title}
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
                                    <h4 className="text-gray-200 font-medium line-clamp-2 text-sm leading-snug mb-2 group-hover:text-purple-300 transition-colors">
                                        {item.metadata?.title || 'Unknown Title'}
                                    </h4>
                                    <div className="mt-auto flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
                                            <Youtube className="w-3 h-3 text-purple-400" />
                                        </div>
                                        <p className="text-xs text-purple-400/80 font-medium truncate">
                                            {item.metadata?.channel || item.filename}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="w-full max-w-6xl opacity-0 animate-[fadeIn_0.5s_ease-out_0.5s_forwards] mt-8 pb-12">
                <div className="flex items-center gap-2 mb-6 text-gray-400 border-b border-gray-800 pb-2 pl-2">
                    <Youtube className="w-5 h-5 text-red-500" />
                    <h3 className="font-semibold text-lg text-white">Subscribed Channels Updates</h3>
                </div>

                {subscriptions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 bg-gray-800/30 rounded-2xl border border-gray-800 border-dashed text-center">
                        <Youtube className="w-12 h-12 text-gray-700 mb-4" />
                        <h4 className="text-gray-300 font-medium mb-2">No Subscriptions Yet</h4>
                        <p className="text-sm text-gray-500 max-w-md">
                            To see latest updates here, process any video and click the <span className="text-purple-400 border border-purple-500/50 rounded px-1">Subscribe +</span> button next to the YouTuber's name.
                        </p>
                    </div>
                ) : channelUpdates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 bg-gray-800/20 rounded-2xl border border-gray-800 text-center">
                        <Loader2 className="w-8 h-8 text-gray-600 animate-spin mb-4" />
                        <p className="text-sm text-gray-500">
                            Checking for latest videos from your subscribed channels...
                        </p>
                    </div>
                ) : (
                    <div className="flex overflow-x-auto gap-4 pb-6 px-2 custom-scrollbar snap-x">
                        {channelUpdates.map((update, idx) => (
                            <div
                                key={`${update.videoId}-${idx}`}
                                onClick={() => handleInterceptSubmit(`https://youtube.com/watch?v=${update.videoId}`)}
                                className="bg-gray-800 shrink-0 min-w-[260px] w-[260px] snap-start hover:bg-gray-700 border border-gray-700 hover:border-pink-500/50 rounded-2xl overflow-hidden cursor-pointer transition-all group flex flex-col shadow-lg"
                            >
                                <div className="relative aspect-video bg-gray-950 overflow-hidden">
                                    {update.thumbnail ? (
                                        <img
                                            src={update.thumbnail}
                                            alt={update.title}
                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-700">No Thumbnail</div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="bg-pink-600 p-3 rounded-full text-white shadow-lg shadow-pink-900/50">
                                            <Play className="w-6 h-6 ml-1" />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 flex flex-col flex-1">
                                    <h4 className="text-gray-200 font-medium line-clamp-2 text-sm leading-snug mb-2 group-hover:text-pink-300 transition-colors">
                                        {update.title}
                                    </h4>
                                    <div className="mt-auto flex items-center gap-2">
                                        <p className="text-xs text-pink-400/80 font-medium truncate">
                                            {update.channel}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div >
    );
};
