import { api } from '../lib/api';
import React, { useState, useEffect } from 'react';
import { Search, Loader2, Play, Youtube, Clock, Tv, BellOff, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HistoryItem } from './ChannelVideoList';
import { ModelSelectionModal } from './ModelSelectionModal';
import type { EstimationData } from './ModelSelectionModal';
import { ShowBrowser } from './ShowBrowser';

interface InputScreenProps {
    onSubmit: (url: string) => void;
    onLoadHistory: (filename: string) => void;
    onSelectEpisode: (showId: string, season: number, episode: number) => void;
    isLoading?: boolean;
    loadingState?: 'processing' | 'loading' | null;
    subscriptions?: { id: string; name: string }[];
    onSelectChannel: (channelName: string) => void;
    onUnsubscribe?: (channelId: string) => void;
}

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export const InputScreen: React.FC<InputScreenProps> = ({ onSubmit, onLoadHistory, onSelectEpisode, isLoading, loadingState, subscriptions = [], onSelectChannel, onUnsubscribe }) => {
    const [url, setUrl] = useState('');
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [channelUpdates, setChannelUpdates] = useState<any[]>([]);
    const [isEstimating, setIsEstimating] = useState(false);
    const [estimationData, setEstimationData] = useState<EstimationData | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pendingUrl, setPendingUrl] = useState('');

    useEffect(() => {
        fetch(api('/api/history'))
            .then(res => res.json())
            .then(data => setHistory(data))
            .catch(err => console.error("Failed to fetch history:", err));

        if (subscriptions.length > 0) {
            fetch(api('/api/channel-updates'), {
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
            const urlToFetch = api(`/api/estimate-cost?url=${encodeURIComponent(targetUrl)}`);
            const response = await fetch(urlToFetch);

            if (!response.ok) {
                throw new Error("Failed to estimate cost");
            }
            const data = await response.json();
            setEstimationData(data);
            setIsModalOpen(true);
        } catch (err) {
            console.error("Estimation failed:", err);
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
        onSubmit(pendingUrl);
    };

    return (
        <div className="min-h-screen flex flex-col items-center p-8 pt-20 overflow-y-auto custom-scrollbar relative bg-[#09090b]">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
            <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

            <AnimatePresence>
                {((isLoading || loadingState) && !isEstimating) && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-md flex flex-col items-center justify-center"
                    >
                        <Loader2 className="w-12 h-12 text-zinc-300 animate-spin mb-6" />
                        <h2 className="text-2xl font-bold text-zinc-100 mb-2">
                            {loadingState === 'processing' ? 'Processing Video...' : 'Loading...'}
                        </h2>
                        {loadingState === 'processing' && (
                            <p className="text-zinc-400">Extracting high-quality bilingual insights</p>
                        )}
                    </motion.div>
                )}

                {isEstimating && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-md flex flex-col items-center justify-center"
                    >
                        <Loader2 className="w-12 h-12 text-zinc-300 animate-spin mb-6" />
                        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Estimating Profile...</h2>
                        <p className="text-zinc-400">Analyzing content length and complexity</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <ModelSelectionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirmModel}
                estimationData={estimationData}
            />

            <motion.div 
                className="max-w-5xl w-full space-y-12 shrink-0 z-10"
                variants={containerVariants}
                initial="hidden"
                animate="show"
            >
                {/* Hero Section */}
                <motion.div variants={itemVariants} className="text-center mt-12 mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full glass-card text-xs font-medium text-zinc-300">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        Lingua Nova Engine
                    </div>
                    <h2 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-500 tracking-tight mb-4">
                        Immersive Language Learning
                    </h2>
                    <p className="text-lg text-zinc-400 font-medium max-w-2xl mx-auto">
                        Paste any YouTube or media link to generate a tailored, cinematic bilingual learning experience.
                    </p>
                </motion.div>

                {/* Search Bar - Floating Arc Style */}
                <motion.form variants={itemVariants} className="max-w-3xl mx-auto w-full relative" onSubmit={handleSubmit}>
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-[32px] blur opacity-50 group-hover:opacity-100 transition duration-500"></div>
                        <div className="relative flex items-center glass-card rounded-[32px] p-2 pl-6 pr-2 border border-zinc-700/50 hover:border-zinc-500/50 transition-colors">
                            <Search className="w-5 h-5 text-zinc-400" />
                            <input
                                id="video-url"
                                name="url"
                                type="url"
                                disabled={isLoading}
                                required
                                className="w-full bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-500 px-4 py-3 text-lg"
                                placeholder="Paste any webpage, video, or content link..."
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !url.trim()}
                                className="flex items-center gap-2 bg-zinc-100 text-zinc-900 px-6 py-3 rounded-full font-semibold hover:bg-white hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Analyze'}
                                {!isLoading && <ArrowRight className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </motion.form>

                {/* Bento Grid */}
                <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-8">
                    
                    {/* Left Column: Recent Learning */}
                    <div className="md:col-span-7 flex flex-col gap-6">
                        {/* History Card */}
                        <div className="glass-panel rounded-3xl p-6 h-full border border-zinc-800/50 relative overflow-hidden group">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2 text-zinc-100">
                                    <Clock className="w-5 h-5" />
                                    <h3 className="font-semibold text-lg">Recent Learning</h3>
                                </div>
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div>
                                </div>
                            </div>

                            {history.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
                                    <p>No recent videos found.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {history.slice(0, 3).map((item, i) => (
                                        <motion.div
                                            key={item.filename}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => onLoadHistory(item.filename)}
                                            className="flex items-center gap-4 bg-zinc-800/30 hover:bg-zinc-800/60 p-3 rounded-2xl cursor-pointer transition-colors border border-zinc-700/30"
                                        >
                                            <div className="relative w-24 h-16 rounded-xl overflow-hidden bg-zinc-900 shrink-0">
                                                {item.metadata?.thumbnail && (
                                                    <img src={item.metadata.thumbnail} alt="thumb" className="w-full h-full object-cover" />
                                                )}
                                                <div className="absolute inset-0 bg-black/20 group-hover/card:bg-black/40 flex items-center justify-center transition-colors">
                                                    <Play className="w-5 h-5 text-white opacity-80" />
                                                </div>
                                            </div>
                                            <div className="flex flex-col overflow-hidden">
                                                <h4 className="text-zinc-200 font-medium truncate text-sm mb-1">{item.metadata?.title || 'Unknown Video'}</h4>
                                                <p className="text-zinc-500 text-xs flex items-center gap-1">
                                                    <Youtube className="w-3 h-3" /> {item.metadata?.channel || 'Local File'}
                                                </p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Local Shows Section */}
                        <div className="glass-panel rounded-3xl p-6 border border-zinc-800/50 relative overflow-hidden">
                             <div className="flex items-center gap-2 mb-6 text-zinc-100">
                                <Tv className="w-5 h-5 text-blue-400" />
                                <h3 className="font-semibold text-lg">Local Shows</h3>
                            </div>
                            <ShowBrowser onSelectEpisode={onSelectEpisode} isLoading={!!isLoading} />
                        </div>
                    </div>

                    {/* Right Column: Subscriptions & Updates */}
                    <div className="md:col-span-5 flex flex-col gap-6">
                        
                        {/* Channels Bento */}
                        {subscriptions && subscriptions.length > 0 && (
                            <div className="glass-panel rounded-3xl p-6 border border-zinc-800/50">
                                <div className="flex items-center gap-2 mb-6 text-zinc-100">
                                    <Youtube className="w-5 h-5 text-red-500" />
                                    <h3 className="font-semibold text-lg">Subscriptions</h3>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {subscriptions.slice(0, 6).map(sub => (
                                        <motion.div 
                                            whileHover={{ scale: 1.05 }}
                                            key={sub.id}
                                            onClick={() => onSelectChannel(sub.name)}
                                            className="px-4 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/50 hover:bg-zinc-700/50 text-sm text-zinc-300 font-medium cursor-pointer transition-colors"
                                        >
                                            {sub.name}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Updates Bento */}
                        <div className="glass-panel rounded-3xl p-6 flex-1 border border-zinc-800/50 flex flex-col">
                            <div className="flex items-center gap-2 mb-6 text-zinc-100">
                                <BellOff className="w-5 h-5 text-amber-400" />
                                <h3 className="font-semibold text-lg">New Updates</h3>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                                {channelUpdates.length === 0 ? (
                                    <p className="text-zinc-500 text-sm">No new updates from your channels.</p>
                                ) : (
                                    channelUpdates.map((update, idx) => (
                                        <motion.div
                                            whileHover={{ x: 4 }}
                                            key={`${update.videoId}-${idx}`}
                                            onClick={() => handleInterceptSubmit(`https://youtube.com/watch?v=${update.videoId}`)}
                                            className="flex gap-4 cursor-pointer group"
                                        >
                                            <div className="w-20 h-12 rounded-lg bg-zinc-800 overflow-hidden shrink-0 relative">
                                                {update.thumbnail && <img src={update.thumbnail} className="w-full h-full object-cover" alt="" />}
                                            </div>
                                            <div className="flex flex-col justify-center">
                                                <h4 className="text-zinc-300 text-sm font-medium line-clamp-2 group-hover:text-white transition-colors">{update.title}</h4>
                                                <p className="text-zinc-500 text-xs mt-1">{update.channel}</p>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
};
