import { apiFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import { Search, Loader2, Play, Youtube, Clock, Tv, Bell, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import type { HistoryItem } from './ChannelVideoList';
import { ModelSelectionModal } from './ModelSelectionModal';
import type { EstimationData } from './ModelSelectionModal';
import { ShowBrowser } from './ShowBrowser';
import { VOCAB_LEVELS, loadVocabLevel, saveVocabLevel, type VocabLevelId } from '../lib/settings';
import { AuroraBackground } from './AuroraBackground';
import { progressPercent } from '../lib/progress';

interface InputScreenProps {
    onSubmit: (url: string, model?: string) => void;
    onLoadHistory: (filename: string) => void;
    onSelectEpisode: (showId: string, season: number, episode: number) => void;
    isLoading?: boolean;
    loadingState?: 'processing' | 'loading' | 'asr' | null;
    subscriptions?: { id: string; name: string }[];
    onSelectChannel: (channelName: string) => void;
    onUnsubscribe?: (channelId: string) => void;
}

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.06 }
    }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 340, damping: 30, mass: 0.9 } }
};

export const InputScreen: React.FC<InputScreenProps> = ({ onSubmit, onLoadHistory, onSelectEpisode, isLoading, loadingState, subscriptions = [], onSelectChannel }) => {
    const [url, setUrl] = useState('');
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [channelUpdates, setChannelUpdates] = useState<any[]>([]);
    const [isEstimating, setIsEstimating] = useState(false);
    const [estimationData, setEstimationData] = useState<EstimationData | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pendingUrl, setPendingUrl] = useState('');
    const [vocabLevel, setVocabLevel] = useState<VocabLevelId>(loadVocabLevel);

    const handleVocabLevelChange = (level: VocabLevelId) => {
        setVocabLevel(level);
        saveVocabLevel(level);
    };

    useEffect(() => {
        apiFetch('/api/history')
            .then(res => res.json())
            .then(data => setHistory(data))
            .catch(err => console.error("Failed to fetch history:", err));

        if (subscriptions.length > 0) {
            apiFetch('/api/channel-updates', {
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
            const response = await apiFetch(`/api/estimate-cost?url=${encodeURIComponent(targetUrl)}`);

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

    const handleConfirmModel = (modelId: string) => {
        setIsModalOpen(false);
        onSubmit(pendingUrl, modelId);
    };

    return (
        <div className="min-h-screen flex flex-col items-center p-8 pt-20 overflow-y-auto custom-scrollbar relative bg-[#09090b]">
            {/* Layered animated background: aurora, halo, grid, particles, spotlight */}
            <AuroraBackground />

            <AnimatePresence>
                {((isLoading || loadingState) && !isEstimating) && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-md flex flex-col items-center justify-center"
                    >
                        <Loader2 className="w-12 h-12 text-zinc-300 animate-spin mb-6" />
                        <h2 className="text-xl font-semibold tracking-tight text-zinc-100 mb-2">
                            {loadingState === 'asr' ? 'Transcribing locally…' : loadingState === 'processing' ? 'Fetching subtitles…' : 'Loading…'}
                        </h2>
                        {loadingState === 'processing' && (
                            <p className="text-zinc-400">English appears first — translations stream in while you watch</p>
                        )}
                        {loadingState === 'asr' && (
                            <p className="text-zinc-400">No captions on this video — transcribing the audio with local Whisper (first run downloads the model, hang tight)</p>
                        )}
                    </motion.div>
                )}

                {isEstimating && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-md flex flex-col items-center justify-center"
                    >
                        <Loader2 className="w-12 h-12 text-zinc-300 animate-spin mb-6" />
                        <h2 className="text-xl font-semibold tracking-tight text-zinc-100 mb-2">Analyzing video…</h2>
                        <p className="text-zinc-400">Counting words and estimating processing cost</p>
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
                    <h2 className="text-5xl md:text-6xl font-semibold text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400 tracking-[-0.015em] mb-4">
                        Watch YouTube. Learn English.
                    </h2>
                    <p className="text-lg text-zinc-400 font-normal leading-relaxed max-w-2xl mx-auto">
                        Paste a link — get synced bilingual subtitles, vocabulary picked for your level, and an AI summary. Instantly.
                    </p>
                </motion.div>

                {/* Search Bar - Floating Arc Style */}
                <motion.form variants={itemVariants} className="max-w-3xl mx-auto w-full relative" onSubmit={handleSubmit}>
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/15 to-purple-500/15 rounded-full blur opacity-25 group-focus-within:opacity-60 transition-opacity duration-300 ease-apple"></div>
                        <div className="relative flex items-center glass-card rounded-full p-2 pl-6 pr-2 border border-white/10 hover:border-white/20 focus-within:border-brand/60 focus-within:ring-4 focus-within:ring-brand/15 transition-[border-color,box-shadow] duration-200 ease-apple">
                            <Search className="w-5 h-5 text-zinc-400" />
                            <input
                                id="video-url"
                                name="url"
                                type="url"
                                disabled={isLoading}
                                required
                                className="w-full bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-500 px-4 py-3 text-lg"
                                placeholder="Paste a YouTube link…"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !url.trim()}
                                className="inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 h-12 px-6 rounded-full bg-zinc-100 text-zinc-900 text-sm font-semibold hover:bg-white active:scale-[0.98] transition-[background-color,transform,opacity] duration-200 ease-apple disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Start Learning'}
                                {!isLoading && <ArrowRight className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </motion.form>

                {/* Learner level: calibrates which words get highlighted */}
                <motion.div variants={itemVariants} className="max-w-3xl mx-auto w-full flex items-center justify-center gap-2 -mt-6">
                    <span className="text-xs text-zinc-500">Vocabulary level</span>
                    <div className="inline-flex items-center rounded-lg bg-zinc-800/80 p-0.5 border border-white/5">
                        {VOCAB_LEVELS.map(level => (
                            <button
                                key={level.id}
                                type="button"
                                onClick={() => handleVocabLevelChange(level.id)}
                                className={`relative px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                                    vocabLevel === level.id
                                        ? 'text-zinc-900'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                {vocabLevel === level.id && (
                                    <motion.span
                                        layoutId="vocabLevelThumb"
                                        className="absolute inset-0 bg-zinc-100 rounded-md shadow-sm"
                                        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                                    />
                                )}
                                <span className="relative z-10">{level.label}</span>
                            </button>
                        ))}
                    </div>
                    <span className="text-[11px] text-zinc-600 hidden sm:inline">AI highlights only words above your level</span>
                </motion.div>

                {/* Bento Grid */}
                <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-8">
                    
                    {/* Left Column: Recent Learning */}
                    <div className="md:col-span-7 flex flex-col gap-6">
                        {/* History Card */}
                        <div className="glass-panel rounded-3xl p-6 h-full relative overflow-hidden group">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2 text-zinc-100">
                                    <Clock className="w-5 h-5" />
                                    <h3 className="text-[17px] font-semibold tracking-tight">Continue Learning</h3>
                                </div>
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div>
                                </div>
                            </div>

                            {history.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <Clock className="w-10 h-10 text-zinc-700 mb-3" />
                                    <p className="text-sm font-medium text-zinc-400">Nothing here yet — paste a link above to begin</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {history.slice(0, 3).map((item) => (
                                        <motion.div
                                            key={item.filename}
                                            whileTap={{ scale: 0.98 }}
                                            transition={{ type: "spring", stiffness: 550, damping: 35 }}
                                            onClick={() => onLoadHistory(item.filename)}
                                            data-testid="history-card"
                                            className="group/card flex items-center gap-4 p-3 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/60 border border-white/5 hover:border-white/10 transition-colors cursor-pointer"
                                        >
                                            <div className="relative w-24 aspect-video rounded-lg overflow-hidden bg-zinc-900 shrink-0">
                                                {item.metadata?.thumbnail && (
                                                    <img src={item.metadata.thumbnail} alt="thumb" className="w-full h-full object-cover" />
                                                )}
                                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="bg-white/15 backdrop-blur-md p-3 rounded-full">
                                                        <Play className="w-5 h-5 text-white fill-current" />
                                                    </span>
                                                </div>
                                                {item.videoId && progressPercent(item.videoId) !== null && (
                                                    <div className="absolute bottom-0 inset-x-0 h-1 bg-black/60">
                                                        <div
                                                            className="h-full bg-emerald-500"
                                                            style={{ width: `${progressPercent(item.videoId)}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col overflow-hidden">
                                                <h4 className="text-zinc-200 font-medium truncate text-sm mb-1">{item.metadata?.title || 'Unknown Video'}</h4>
                                                <p className="text-zinc-500 text-xs flex items-center gap-1">
                                                    <Youtube className="w-3 h-3" /> {item.metadata?.channel || 'Local File'}
                                                    {item.videoId && progressPercent(item.videoId) !== null && (
                                                        <span className="ml-1 text-emerald-500/90">· {progressPercent(item.videoId)}% watched</span>
                                                    )}
                                                </p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Local Shows Section */}
                        <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
                             <div className="flex items-center gap-2 mb-6 text-zinc-100">
                                <Tv className="w-5 h-5 text-blue-400" />
                                <h3 className="text-[17px] font-semibold tracking-tight">Local Shows</h3>
                            </div>
                            <ShowBrowser onSelectEpisode={onSelectEpisode} isLoading={!!isLoading} />
                        </div>
                    </div>

                    {/* Right Column: Subscriptions & Updates */}
                    <div className="md:col-span-5 flex flex-col gap-6">
                        
                        {/* Channels Bento */}
                        {subscriptions && subscriptions.length > 0 && (
                            <div className="glass-panel rounded-3xl p-6">
                                <div className="flex items-center gap-2 mb-6 text-zinc-100">
                                    <Youtube className="w-5 h-5 text-red-500" />
                                    <h3 className="text-[17px] font-semibold tracking-tight">Subscriptions</h3>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {subscriptions.slice(0, 6).map(sub => (
                                        <motion.div
                                            whileTap={{ scale: 0.98 }}
                                            transition={{ type: "spring", stiffness: 550, damping: 35 }}
                                            key={sub.id}
                                            onClick={() => onSelectChannel(sub.name)}
                                            className="inline-flex items-center h-8 px-3 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 border border-white/5 text-sm font-medium text-zinc-300 hover:text-zinc-100 cursor-pointer transition-colors"
                                        >
                                            {sub.name}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Updates Bento */}
                        <div className="glass-panel rounded-3xl p-6 flex-1 flex flex-col">
                            <div className="flex items-center gap-2 mb-6 text-zinc-100">
                                <Bell className="w-5 h-5 text-amber-400" />
                                <h3 className="text-[17px] font-semibold tracking-tight">Latest Videos</h3>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                                {channelUpdates.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <p className="text-sm font-medium text-zinc-400">No new uploads yet</p>
                                    </div>
                                ) : (
                                    channelUpdates.map((update, idx) => (
                                        <motion.div
                                            whileTap={{ scale: 0.98 }}
                                            transition={{ type: "spring", stiffness: 550, damping: 35 }}
                                            key={`${update.videoId}-${idx}`}
                                            onClick={() => handleInterceptSubmit(`https://youtube.com/watch?v=${update.videoId}`)}
                                            className="flex gap-4 p-3 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/60 border border-white/5 hover:border-white/10 transition-colors cursor-pointer group"
                                        >
                                            <div className="w-24 aspect-video rounded-lg bg-zinc-800 overflow-hidden shrink-0 relative">
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
