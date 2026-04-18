import React, { useState, useEffect } from 'react';
import { ChevronRight, BookOpen, Tv, Loader2 } from 'lucide-react';

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
        fetch('http://127.0.0.1:8000/api/shows')
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
                fetch(`http://127.0.0.1:8000/api/shows/${show.id}/seasons`),
                fetch(`http://127.0.0.1:8000/api/shows/${show.id}/processed`)
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
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
        );
    }

    if (shows.length === 0) {
        return (
            <div className="text-center py-8">
                <Tv className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">暂无本地剧集字幕</p>
                <p className="text-gray-600 text-xs mt-1">
                    将 SRT 文件放入 subtitles/ 目录即可添加
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
                        className="text-gray-400 hover:text-white text-sm transition-colors"
                    >
                        ← 返回
                    </button>
                )}
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-purple-400" />
                    {selectedShow ? selectedShow.title_zh || selectedShow.title : '本地剧集'}
                </h3>
            </div>

            {/* Show List */}
            {!selectedShow && (
                <div className="grid gap-3">
                    {shows.map(show => (
                        <button
                            key={show.id}
                            onClick={() => handleShowSelect(show)}
                            className="flex items-center gap-4 p-4 bg-gray-800/60 hover:bg-gray-800 rounded-xl border border-gray-700/50 hover:border-purple-500/30 transition-all group text-left"
                        >
                            {show.thumbnail && (
                                <img
                                    src={show.thumbnail}
                                    alt={show.title}
                                    className="w-16 h-24 object-cover rounded-lg flex-shrink-0"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <h4 className="text-white font-medium text-base group-hover:text-purple-300 transition-colors">
                                    {show.title_zh || show.title}
                                </h4>
                                <p className="text-gray-400 text-sm mt-0.5">{show.title}</p>
                                <p className="text-gray-500 text-xs mt-2">
                                    {Object.keys(show.seasons_available).length} 季 · {show.total_episodes} 集可用
                                </p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-purple-400 transition-colors flex-shrink-0" />
                        </button>
                    ))}
                </div>
            )}

            {/* Season & Episode Selector */}
            {selectedShow && (
                <div className="space-y-3">
                    {/* Season Tabs */}
                    <div className="flex flex-wrap gap-2">
                        {seasons.map(s => (
                            <button
                                key={s.season}
                                onClick={() => setSelectedSeason(s.season)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    selectedSeason === s.season
                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                                        : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                                }`}
                            >
                                第 {s.season} 季
                                <span className="ml-1.5 text-xs opacity-70">({s.episode_count}集)</span>
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
                                        className={`py-3 px-2 rounded-lg text-sm font-medium transition-all ${
                                            isLoading
                                                ? 'bg-gray-800/50 text-gray-600 cursor-wait'
                                                : isProcessed
                                                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 hover:shadow-lg hover:shadow-emerald-500/10'
                                                    : 'bg-gray-800 text-gray-300 hover:bg-purple-600/20 hover:text-purple-300 hover:border-purple-500/30 border border-gray-700/50 hover:shadow-lg hover:shadow-purple-500/10'
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
                        <p className="text-gray-500 text-sm text-center py-4">
                            👆 选择一季开始学习
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};
