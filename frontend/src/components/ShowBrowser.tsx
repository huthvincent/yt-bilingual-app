import { apiFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Tv, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface Show {
    id: string;
    title: string;
    title_zh: string;
    thumbnail: string;
    seasons_available: { [key: number]: number };
    total_episodes: number;
}

interface SeasonData {
    season: number;
    episode_count: number;
    episodes: number[];
}

interface ShowBrowserProps {
    onSelectEpisode: (showId: string, season: number, episode: number) => void;
    isLoading: boolean;
}

export const ShowBrowser: React.FC<ShowBrowserProps> = ({ onSelectEpisode, isLoading }) => {
    const [shows, setShows] = useState<Show[]>([]);
    const [selectedShow, setSelectedShow] = useState<Show | null>(null);
    const [seasons, setSeasons] = useState<SeasonData[]>([]);
    const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
    const [loadingShows, setLoadingShows] = useState(true);
    const [processedEpisodes, setProcessedEpisodes] = useState<Set<string>>(new Set());

    useEffect(() => {
        apiFetch('/api/shows')
            .then(res => res.json())
            .then(data => {
                setShows(data.shows || []);
                setLoadingShows(false);
            })
            .catch(err => {
                console.error('Failed to load shows:', err);
                setLoadingShows(false);
            });
    }, []);

    const handleShowSelect = async (show: Show) => {
        setSelectedShow(show);
        setSelectedSeason(null);
        setProcessedEpisodes(new Set());
        try {
            const [seasonsRes, processedRes] = await Promise.all([
                apiFetch(`/api/shows/${show.id}/seasons`),
                apiFetch(`/api/shows/${show.id}/processed`)
            ]);
            const seasonsData = await seasonsRes.json();
            setSeasons(seasonsData.seasons || []);
            const processedData = await processedRes.json();
            setProcessedEpisodes(new Set(processedData.processed || []));
        } catch (err) {
            console.error('Failed to load seasons:', err);
        }
    };

    if (loadingShows) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
            </div>
        );
    }

    if (shows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <Tv className="w-10 h-10 text-zinc-700 mb-3" />
                <p className="text-sm font-medium text-zinc-400">No local shows yet</p>
                <p className="text-xs text-zinc-600 mt-1">
                    Drop .srt files into subtitles/ to add one
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                {selectedShow && (
                    <button
                        onClick={() => { setSelectedShow(null); setSeasons([]); setSelectedSeason(null); }}
                        className="inline-flex items-center gap-1 h-7 px-2 -ml-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back
                    </button>
                )}
                <h3 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                    {selectedShow ? selectedShow.title_zh || selectedShow.title : 'Local Shows'}
                </h3>
            </div>

            {/* Show List */}
            {!selectedShow && (
                <div className="grid gap-3">
                    {shows.map(show => (
                        <button
                            key={show.id}
                            onClick={() => handleShowSelect(show)}
                            className="flex items-center gap-4 p-3 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/60 border border-white/5 hover:border-white/10 transition-colors cursor-pointer group text-left"
                        >
                            {show.thumbnail && (
                                <img
                                    src={show.thumbnail}
                                    alt={show.title}
                                    className="w-16 h-24 object-cover rounded-lg flex-shrink-0"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <h4 className="text-white font-medium text-base group-hover:text-white transition-colors">
                                    {show.title_zh || show.title}
                                </h4>
                                <p className="text-zinc-400 text-sm mt-0.5">{show.title}</p>
                                <p className="text-zinc-500 text-xs mt-2">
                                    {Object.keys(show.seasons_available).length} seasons · {show.total_episodes} episodes
                                </p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-300 transition-colors flex-shrink-0" />
                        </button>
                    ))}
                </div>
            )}

            {/* Season & Episode Selector */}
            {selectedShow && (
                <div className="space-y-3">
                    {/* Season Tabs */}
                    <div className="inline-flex items-center rounded-lg bg-zinc-800/80 p-0.5 border border-white/5">
                        {seasons.map(s => (
                            <button
                                key={s.season}
                                onClick={() => setSelectedSeason(s.season)}
                                className={`relative px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                                    selectedSeason === s.season
                                        ? 'text-zinc-900'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                {selectedSeason === s.season && (
                                    <motion.span
                                        layoutId="seasonThumb"
                                        className="absolute inset-0 bg-zinc-100 rounded-md shadow-sm"
                                        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                                    />
                                )}
                                <span className="relative z-10">
                                    Season {s.season}
                                    <span className="ml-1.5 text-xs opacity-70">({s.episode_count} ep)</span>
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Episode Grid */}
                    {selectedSeason && (
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mt-3">
                            {seasons
                                .find(s => s.season === selectedSeason)
                                    ?.episodes.map(ep => {
                                        const epKey = `S${selectedSeason.toString().padStart(2, '0')}E${ep.toString().padStart(2, '0')}`;
                                        const isProcessed = processedEpisodes.has(epKey);
                                        return (
                                    <button
                                        key={ep}
                                        disabled={isLoading}
                                        onClick={() => onSelectEpisode(selectedShow.id, selectedSeason, ep)}
                                        className={`py-3 px-2 rounded-lg text-sm font-medium transition-[background-color,border-color,color,transform] duration-200 ease-apple active:scale-[0.98] ${
                                            isLoading
                                                ? 'bg-zinc-800/50 text-zinc-600 border border-transparent cursor-wait'
                                                : isProcessed
                                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20'
                                                    : 'bg-zinc-800/60 text-zinc-300 border border-white/5 hover:bg-zinc-700/60 hover:text-zinc-100 hover:border-white/10'
                                        }`}
                                    >
                                        E{ep.toString().padStart(2, '0')}
                                        {isProcessed && <span className="ml-1 text-[10px] opacity-70">✓</span>}
                                    </button>
                                    );
                                    })}
                        </div>
                    )}

                    {!selectedSeason && (
                        <p className="text-zinc-600 text-xs text-center py-4">
                            Pick a season to start
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};
