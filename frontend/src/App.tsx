import { useState, useEffect, useRef } from 'react';
import { Star } from 'lucide-react';
import { InputScreen } from './components/InputScreen';
import { VideoPlayer } from './components/VideoPlayer';
import { TranscriptView } from './components/TranscriptView';
import { FavoritesModal, type FavoriteItem } from './components/FavoritesModal';
import { ChannelVideoList } from './components/ChannelVideoList';
import ReactMarkdown from 'react-markdown';

interface TranscriptItem {
  id: number;
  start: number;
  end: number;
  en_text: string;
  zh_text: string;
  highlights: Array<{
    en_word: string;
    zh_word: string;
    color: string;
  }>;
}

function App() {
  const [videoId, setVideoId] = useState('');
  const [loadingState, setLoadingState] = useState<'processing' | 'loading' | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [metadata, setMetadata] = useState<any>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekCommand, setSeekCommand] = useState<{ time: number, timestamp: number } | null>(null);


  // Local subtitle playback timer
  const subtitleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isSubtitlePlaying, setIsSubtitlePlaying] = useState(false);

  const startSubtitleTimer = (fromTime: number) => {
    // Stop any existing timer
    if (subtitleTimerRef.current) clearInterval(subtitleTimerRef.current);
    setCurrentTime(fromTime);
    setIsSubtitlePlaying(true);
    const startWall = Date.now();
    const startOffset = fromTime;
    subtitleTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startWall) / 1000;
      setCurrentTime(startOffset + elapsed);
    }, 100);
  };

  const pauseSubtitleTimer = () => {
    if (subtitleTimerRef.current) clearInterval(subtitleTimerRef.current);
    subtitleTimerRef.current = null;
    setIsSubtitlePlaying(false);
  };



  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subtitleTimerRef.current) clearInterval(subtitleTimerRef.current);
    };
  }, []);

  // Favorites logic — load from backend, sync to backend
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const favoritesLoaded = useRef(false);

  // Channel History Logic
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  // Channel Subscriptions logic — load from backend, sync to backend
  const [subscriptions, setSubscriptions] = useState<{ id: string, name: string }[]>([]);
  const subsLoaded = useRef(false);

  // Load favorites & subscriptions from backend on mount
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/favorites')
      .then(r => r.json())
      .then(data => { setFavorites(data); favoritesLoaded.current = true; })
      .catch(() => {
        // Fallback to localStorage
        const saved = localStorage.getItem('yt_bilingual_favorites');
        if (saved) setFavorites(JSON.parse(saved));
        favoritesLoaded.current = true;
      });
    fetch('http://127.0.0.1:8000/api/subscriptions')
      .then(r => r.json())
      .then(data => { setSubscriptions(data); subsLoaded.current = true; })
      .catch(() => {
        const saved = localStorage.getItem('yt_bilingual_subs');
        if (saved) setSubscriptions(JSON.parse(saved));
        subsLoaded.current = true;
      });
  }, []);

  // Sync favorites to backend + localStorage whenever they change
  useEffect(() => {
    if (!favoritesLoaded.current) return; // Don't save on initial load
    localStorage.setItem('yt_bilingual_favorites', JSON.stringify(favorites));
    fetch('http://127.0.0.1:8000/api/favorites', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorites })
    }).catch(() => {});
  }, [favorites]);

  // Sync subscriptions to backend + localStorage whenever they change
  useEffect(() => {
    if (!subsLoaded.current) return;
    localStorage.setItem('yt_bilingual_subs', JSON.stringify(subscriptions));
    fetch('http://127.0.0.1:8000/api/subscriptions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptions })
    }).catch(() => {});
  }, [subscriptions]);

  const handleToggleSubscription = () => {
    if (!metadata?.channel_url || !metadata?.channel) return;
    const isSubbed = subscriptions.some(s => s.id === metadata.channel_url);
    if (isSubbed) {
      setSubscriptions(prev => prev.filter(s => s.id !== metadata.channel_url));
    } else {
      setSubscriptions(prev => [...prev, { id: metadata.channel_url, name: metadata.channel }]);
    }
  };

  const handleToggleFavorite = (item: TranscriptItem) => {
    const id = `${videoId}-${item.id}`;
    setFavorites(prev => {
      const exists = prev.find(f => f.id === id);
      if (exists) {
        return prev.filter(f => f.id !== id);
      } else {
        return [...prev, {
          id,
          videoId,
          start: item.start,
          en_text: item.en_text,
          zh_text: item.zh_text,
          added_at: Date.now()
        }];
      }
    });
  };

  const handleRemoveFavorite = (id: string) => {
    setFavorites(prev => prev.filter(fav => fav.id !== id));
  };

  const handlePlayFavorite = (favVideoId: string, start: number) => {
    if (favVideoId.length > 11) {
      // Local Subtitle: Extract showId, season, episode from string like "house-of-cards_S03E03"
      const match = favVideoId.match(/^(.+)_S(\d+)E(\d+)$/);
      if (match) {
        handleSelectEpisode(match[1], parseInt(match[2]), parseInt(match[3])).then(() => {
          setTimeout(() => startSubtitleTimer(start), 1000);
        });
      }
    } else {
      if (favVideoId !== videoId) {
        handleUrlSubmit(`https://youtube.com/watch?v=${favVideoId}`).then(() => {
          setTimeout(() => setSeekCommand({ time: start, timestamp: Date.now() }), 1000); // Wait for load
        });
      } else {
        setSeekCommand({ time: start, timestamp: Date.now() });
      }
    }
    setIsFavoritesOpen(false);
  };

  const handleUrlSubmit = async (url: string) => {
    // Basic extraction
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    const id = match ? match[1] : null;

    if (!id) {
      alert("Invalid YouTube URL");
      return;
    }

    setLoadingState('processing');

    try {
      // Connect to FastAPI Backend
      const response = await fetch('http://127.0.0.1:8000/api/process-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error("Failed to process video");
      }

      const data = await response.json();
      setTranscript(data.transcript);
      setSummary(data.summary || '');
      setMetadata(data.metadata || null);
      setVideoId(id);

    } catch (error) {
      console.error(error);
      alert("Failed to process video. Please check the backend is running and the video has closed captions.");
    } finally {
      setLoadingState(null);
    }
  };

  const handleSelectEpisode = async (showId: string, season: number, episode: number) => {
    setLoadingState('loading');
    try {
      // Try loading from history cache first (already processed episodes)
      const cacheFilename = `${showId}_S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}.json`;
      const cacheResponse = await fetch(`http://127.0.0.1:8000/api/history/${cacheFilename}`);
      
      if (cacheResponse.ok) {
        // Already processed — load directly from cache
        const data = await cacheResponse.json();
        setTranscript(data.transcript);
        setSummary(data.summary || '');
        setMetadata({ ...data.metadata, is_local_subtitle: true });
        setVideoId(data.videoId);
      } else {
        setLoadingState('processing');
        // Not yet processed — run the full processing pipeline
        const response = await fetch('http://127.0.0.1:8000/api/process-subtitle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ show_id: showId, season, episode }),
        });

        if (!response.ok) throw new Error('Failed to process subtitle');

        const data = await response.json();
        setTranscript(data.transcript);
        setSummary(data.summary || '');
        setMetadata({ ...data.metadata, is_local_subtitle: true });
        setVideoId(data.videoId);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to process subtitle file.');
    } finally {
      setLoadingState(null);
    }
  };

  const handleLoadHistory = async (filename: string) => {
    setLoadingState('loading');
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/history/${filename}`);
      if (!response.ok) throw new Error("Failed to load history");

      const data = await response.json();
      setTranscript(data.transcript);
      setSummary(data.summary || '');
      setMetadata(data.metadata || null);
      setVideoId(data.videoId);
    } catch (error) {
      console.error(error);
      alert("Failed to load history file.");
    } finally {
      setLoadingState(null);
    }
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const handleGoHome = () => {
    setVideoId('');
    setTranscript([]);
    setSummary('');
    setMetadata(null);
    setCurrentTime(0);
    setSeekCommand(null);
  };

  const renderTopBar = () => (
    <div className="flex-none h-16 bg-gray-900 border-b border-gray-800 px-6 flex items-center justify-between z-20">
      <h1
        className="text-xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 cursor-pointer"
        onClick={handleGoHome}
      >
        YT Bilingual
      </h1>
      <button
        onClick={() => setIsFavoritesOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"
      >
        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
        <span>Favorites ({favorites.length})</span>
      </button>
    </div>
  );

  return (
    <div className="h-screen w-full flex flex-col bg-gray-950 overflow-hidden">
      {renderTopBar()}

      {!videoId || transcript.length === 0 ? (
        <div className="flex-1 overflow-auto custom-scrollbar">
          <InputScreen
            onSubmit={handleUrlSubmit}
            onLoadHistory={handleLoadHistory}
            onSelectEpisode={handleSelectEpisode}
            isLoading={loadingState !== null}
            loadingState={loadingState}
            subscriptions={subscriptions}
            onSelectChannel={setSelectedChannel}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* Left Column: Video (hidden in subtitle-only mode) */}
          {!metadata?.is_local_subtitle && (
          <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col pt-4 md:pt-0">
            <div className="flex-1 min-h-0 relative">
              <VideoPlayer
                videoId={videoId}
                seekCommand={seekCommand}
                onTimeUpdate={handleTimeUpdate}
              />
            </div>
            {metadata?.channel && (
              <div className="bg-gray-900 border-t border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm">YouTuber:</span>
                  <button
                    onClick={() => setSelectedChannel(metadata.channel)}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-purple-400 text-sm font-medium rounded-lg border border-gray-700 hover:border-purple-500/50 transition-colors"
                  >
                    {metadata.channel}
                  </button>
                  {metadata.channel_url && (
                    <button
                      onClick={handleToggleSubscription}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${subscriptions.some(s => s.id === metadata.channel_url)
                        ? 'bg-purple-600/20 text-purple-400 border-purple-500/50 hover:bg-purple-600/30'
                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white hover:border-gray-500'
                        }`}
                    >
                      {subscriptions.some(s => s.id === metadata.channel_url) ? 'Subscribed ✓' : 'Subscribe +'}
                    </button>
                  )}
                </div>
                <h3 className="text-white font-medium text-sm truncate ml-4 max-w-[40%] opacity-80" title={metadata.title}>
                  {metadata.title}
                </h3>
              </div>
            )}
            <div className="p-6 flex-1 min-h-0 bg-gray-900 border-t border-gray-800 hidden md:block overflow-y-auto custom-scrollbar">
              {summary ? (
                <>
                  <button
                    onClick={() => setIsSummaryOpen(prev => !prev)}
                    className="flex items-center justify-between w-full sticky top-0 bg-gray-900 pb-2 z-10 backdrop-blur-sm bg-opacity-90 cursor-pointer group"
                  >
                    <h2 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">Video Summary</h2>
                    <svg
                      className={`w-5 h-5 text-gray-400 group-hover:text-purple-400 transition-transform duration-300 ${isSummaryOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isSummaryOpen ? 'max-h-[2000px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}
                  >
                    <div className="text-gray-300 text-sm leading-relaxed space-y-2">
                      <ReactMarkdown
                        components={{
                          h1: ({ node, ...props }) => <h1 className="text-lg font-bold text-white mt-4 mb-2" {...props} />,
                          h2: ({ node, ...props }) => <h2 className="text-base font-bold text-pink-400 mt-4 mb-2" {...props} />,
                          h3: ({ node, ...props }) => <h3 className="text-sm font-bold text-purple-400 mt-3 mb-2" {...props} />,
                          p: ({ node, ...props }) => <p className="text-gray-300 leading-relaxed" {...props} />,
                          ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1 text-gray-300 marker:text-pink-500" {...props} />,
                          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1 text-gray-300 marker:text-pink-500" {...props} />,
                          li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                          strong: ({ node, ...props }) => <strong className="font-semibold text-white tracking-wide" {...props} />,
                          code: ({ node, className, children, ...props }: any) => {
                            const isInline = !className && !String(children).includes('\n');
                            return isInline
                              ? <code className="bg-gray-800 text-pink-300 px-1.5 py-0.5 rounded text-xs border border-gray-700 font-mono" {...props}>{children}</code>
                              : <code className="block bg-gray-800 text-gray-300 p-3 rounded-lg text-xs overflow-x-auto my-2 border border-gray-700 font-mono" {...props}>{children}</code>;
                          }
                        }}
                      >
                        {summary}
                      </ReactMarkdown>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-white mb-2 sticky top-0 bg-gray-900 pb-2 z-10 w-full backdrop-blur-sm bg-opacity-90">Instructions</h2>
                  <ul className="text-gray-400 space-y-2 list-disc list-inside">
                    <li>Video playback syncs directly with the interactive transcript on the right.</li>
                    <li>Advanced keywords are highlighted with their Chinese translations underneath.</li>
                    <li>The backend currently uses a mock LLM logic for quick local testing without token limits.</li>
                  </ul>
                </>
              )}
            </div>
          </div>
          )}

          {/* Transcript Column: full-width for local subtitles, half-width for YouTube videos */}
          <div className={`w-full ${metadata?.is_local_subtitle ? '' : 'md:w-1/2'} h-1/2 md:h-full flex flex-col relative border-t md:border-t-0 border-gray-800`}>

            {/* Local subtitle playback controls */}
            {metadata?.is_local_subtitle && (
              <div className="flex-none flex items-center justify-between px-4 py-2 bg-gray-900/95 border-b border-gray-800 z-20">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (isSubtitlePlaying) {
                        pauseSubtitleTimer();
                      } else {
                        startSubtitleTimer(currentTime);
                      }
                    }}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      isSubtitlePlaying
                        ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 ring-1 ring-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 ring-1 ring-emerald-500/40'
                    }`}
                  >
                    {isSubtitlePlaying ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                  <span className="text-gray-400 text-xs font-medium">
                    {metadata?.title || 'Local Subtitle'}
                  </span>
                </div>
                <span className="text-gray-500 text-xs font-mono tabular-nums">
                  {Math.floor(currentTime / 60).toString().padStart(2, '0')}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}

            <div className="relative flex-1 min-h-0">
              <div className="absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-gray-900 to-transparent z-10 pointer-events-none"></div>
            <TranscriptView
              transcript={transcript}
              currentTime={currentTime}
              videoId={videoId}
              favorites={favorites.map(f => f.id)}
              onTranscriptClick={(time) => {
                if (metadata?.is_local_subtitle) {
                  startSubtitleTimer(time);
                } else {
                  setSeekCommand({ time, timestamp: Date.now() });
                }
              }}
              onToggleFavorite={handleToggleFavorite}
            />
            <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-gray-900 to-transparent z-10 pointer-events-none"></div>
            </div>
          </div>
        </div>
      )}

      <FavoritesModal
        isOpen={isFavoritesOpen}
        onClose={() => setIsFavoritesOpen(false)}
        favorites={favorites}
        onRemoveFavorite={handleRemoveFavorite}
        onPlayFavorite={handlePlayFavorite}
      />

      <ChannelVideoList
        isOpen={!!selectedChannel}
        onClose={() => setSelectedChannel(null)}
        channelName={selectedChannel}
        onLoadHistory={handleLoadHistory}
      />
    </div>
  );
}

export default App;
