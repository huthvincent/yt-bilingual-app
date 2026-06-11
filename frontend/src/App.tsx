import { apiFetch } from './lib/api';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Star, ChevronLeft, ChevronRight, ExternalLink, Loader2, XCircle } from 'lucide-react';
import { InputScreen } from './components/InputScreen';
import { VideoPlayer } from './components/VideoPlayer';
import { TranscriptView } from './components/TranscriptView';
import { FavoritesModal, type FavoriteItem } from './components/FavoritesModal';
import { ChannelVideoList } from './components/ChannelVideoList';
import { Toaster } from './components/Toaster';
import { toast, describeApiError } from './lib/toast';
import { consumeSseStream, isUntranslated } from './lib/transcript';
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
  const [isVocabOpen, setIsVocabOpen] = useState(false);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const fullscreenWrapperRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekCommand, setSeekCommand] = useState<{ time: number, timestamp: number } | null>(null);

  // Streaming translation: progress info + abort handle + deferred seek
  const [translationProgress, setTranslationProgress] = useState<{ done: number; total: number; stage?: string } | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const pendingSeekRef = useRef<number | null>(null);

  const cancelTranslationStream = () => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setTranslationProgress(null);
  };

  const togglePipMode = async () => {
    if (pipWindow) {
      pipWindow.close();
      return;
    }

    if (!('documentPictureInPicture' in window)) {
      toast.error('当前浏览器不支持画中画窗口（Document PiP），请使用 Chrome / Edge 116+。');
      return;
    }

    try {
      const dpip = (window as any).documentPictureInPicture;
      const newPipWindow = await dpip.requestWindow({
        width: 450,
        height: 800
      });

      // Copy styles
      [...document.styleSheets].forEach((styleSheet) => {
        try {
          if (styleSheet.href) {
            const newLinkEl = document.createElement('link');
            newLinkEl.rel = 'stylesheet';
            newLinkEl.href = styleSheet.href;
            newPipWindow.document.head.appendChild(newLinkEl);
          } else if (styleSheet.cssRules) {
            const newStyleEl = document.createElement('style');
            [...styleSheet.cssRules].forEach((cssRule) => {
              newStyleEl.appendChild(document.createTextNode(cssRule.cssText));
            });
            newPipWindow.document.head.appendChild(newStyleEl);
          }
        } catch (e) {
          console.warn('Cannot copy stylesheet rules due to CORS', e);
        }
      });

      newPipWindow.addEventListener('pagehide', () => {
        setPipWindow(null);
      });

      newPipWindow.document.body.className = "bg-gray-950 overflow-hidden m-0 p-0 h-screen flex flex-col";
      setPipWindow(newPipWindow);
    } catch (err) {
      console.error(err);
      toast.error('打开悬浮窗失败，请重试。');
    }
  };


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
    apiFetch('/api/favorites')
      .then(r => r.json())
      .then(data => { setFavorites(data); favoritesLoaded.current = true; })
      .catch(() => {
        // Fallback to localStorage
        const saved = localStorage.getItem('yt_bilingual_favorites');
        if (saved) setFavorites(JSON.parse(saved));
        favoritesLoaded.current = true;
      });
    apiFetch('/api/subscriptions')
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
    apiFetch('/api/favorites', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorites })
    }).catch(() => {});
  }, [favorites]);

  // Sync subscriptions to backend + localStorage whenever they change
  useEffect(() => {
    if (!subsLoaded.current) return;
    localStorage.setItem('yt_bilingual_subs', JSON.stringify(subscriptions));
    apiFetch('/api/subscriptions', {
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
          added_at: Date.now(),
          highlights: item.highlights,
          type: 'sentence'
        }];
      }
    });
  };

  const handleToggleVocabFavorite = (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    const id = `vocab-${videoId}-${item.en.replace(/\s+/g, '-')}`;
    setFavorites(prev => {
      const exists = prev.find(f => f.id === id);
      if (exists) {
        return prev.filter(f => f.id !== id);
      } else {
        return [...prev, {
          id,
          videoId,
          start: item.start,
          en_text: item.en,
          zh_text: item.zh,
          context_en: item.en_text,
          context_zh: item.zh_text,
          added_at: Date.now(),
          highlights: item.highlights,
          type: 'vocabulary'
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
        // Seek as soon as the stream's meta event arrives (don't wait for full translation)
        pendingSeekRef.current = start;
        handleUrlSubmit(`https://youtube.com/watch?v=${favVideoId}`);
      } else {
        setSeekCommand({ time: start, timestamp: Date.now() });
      }
    }
    setIsFavoritesOpen(false);
  };

  const handleUrlSubmit = async (url: string, model?: string) => {
    // Basic extraction
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    const id = match ? match[1] : null;

    if (!id) {
      toast.error('无效的 YouTube 链接，请检查后重试。');
      return;
    }

    // Replace any in-flight stream
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    setLoadingState('processing');

    try {
      const response = await apiFetch('/api/process-video-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, model }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(await describeApiError(response));
      }

      await consumeSseStream(response.body, (evt) => {
        switch (evt.event) {
          case 'meta': {
            const blocks = evt.data.blocks || [];
            setTranscript(blocks);
            setMetadata(evt.data.metadata || null);
            setSummary('');
            setVideoId(evt.data.videoId || id);
            setCurrentTime(0);
            setLoadingState(null); // English is visible — drop the overlay
            const untranslated = blocks.filter((b: TranscriptItem) => isUntranslated(b.zh_text)).length;
            setTranslationProgress(untranslated > 0 ? { done: 0, total: untranslated } : null);
            if (pendingSeekRef.current != null) {
              const t = pendingSeekRef.current;
              pendingSeekRef.current = null;
              setTimeout(() => setSeekCommand({ time: t, timestamp: Date.now() }), 1000);
            }
            break;
          }
          case 'batch': {
            const byId = new Map<number, TranscriptItem>((evt.data.blocks || []).map((b: TranscriptItem) => [b.id, b]));
            setTranscript(prev => prev.map(b => byId.get(b.id) ?? b));
            if (evt.data.progress) setTranslationProgress(prev => ({ ...prev, ...evt.data.progress }));
            break;
          }
          case 'stage':
            setTranslationProgress(prev => prev ? { ...prev, stage: evt.data.stage } : { done: 0, total: 0, stage: evt.data.stage });
            break;
          case 'summary':
            setSummary(evt.data.summary || '');
            break;
          case 'error':
            throw new Error(evt.data.detail || '处理失败，请重试。');
          case 'done':
            setTranslationProgress(null);
            break;
        }
      });
      setTranslationProgress(null);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setTranslationProgress(null);
        return;
      }
      console.error(error);
      toast.error(await describeApiError(error));
      setTranslationProgress(null);
    } finally {
      setLoadingState(null);
    }
  };

  const handleSelectEpisode = async (showId: string, season: number, episode: number) => {
    setLoadingState('loading');
    try {
      // Try loading from history cache first (already processed episodes)
      const cacheFilename = `${showId}_S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}.json`;
      const cacheResponse = await apiFetch(`/api/history/${cacheFilename}`);
      
      if (cacheResponse.ok) {
        // Already processed — load directly from cache
        const data = await cacheResponse.json();
        setTranscript(data.transcript);
        setSummary(data.summary || '');
        setMetadata({ ...data.metadata, is_local_subtitle: true });
        setVideoId(data.videoId);
        setCurrentTime(0);
      } else {
        setLoadingState('processing');
        // Not yet processed — run the full processing pipeline
        const response = await apiFetch('/api/process-subtitle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ show_id: showId, season, episode }),
        });

        if (!response.ok) throw new Error(await describeApiError(response));

        const data = await response.json();
        setTranscript(data.transcript);
        setSummary(data.summary || '');
        setMetadata({ ...data.metadata, is_local_subtitle: true });
        setVideoId(data.videoId);
        setCurrentTime(0);
      }
    } catch (error) {
      console.error(error);
      toast.error(await describeApiError(error));
    } finally {
      setLoadingState(null);
    }
  };

  const handleLoadHistory = async (filename: string) => {
    setLoadingState('loading');
    try {
      const response = await apiFetch(`/api/history/${filename}`);
      if (!response.ok) throw new Error(await describeApiError(response));

      const data = await response.json();
      setTranscript(data.transcript);
      setSummary(data.summary || '');
      setMetadata(data.metadata || null);
      setVideoId(data.videoId);
      setCurrentTime(0);
    } catch (error) {
      console.error(error);
      toast.error(await describeApiError(error));
    } finally {
      setLoadingState(null);
    }
  };

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleGoHome = () => {
    cancelTranslationStream();
    setVideoId('');
    setTranscript([]);
    setSummary('');
    setMetadata(null);
    setCurrentTime(0);
    setSeekCommand(null);
  };

  const renderTopBar = () => (
    <div className="flex-none h-16 bg-zinc-950/60 backdrop-blur-xl border-b border-white/5 px-6 flex items-center justify-between z-20">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-lg shadow-purple-500/30 cursor-pointer flex-shrink-0" onClick={handleGoHome}>
            <img src="/hero_icon.png" alt="Logo" className="w-full h-full object-cover" />
        </div>
        <h1
          className="text-xl font-extrabold text-zinc-100 cursor-pointer tracking-tight hover:text-white transition-colors"
          onClick={handleGoHome}
        >
          Lingua Nova
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsFavoritesOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 border border-white/5 text-zinc-300 hover:text-zinc-100 rounded-xl transition-colors shadow-sm"
        >
          <Star className="w-4 h-4 text-amber-400 fill-amber-400/20" />
          <span className="font-medium text-sm">Favorites ({favorites.length})</span>
        </button>
        {videoId && transcript.length > 0 && (
          <button
            onClick={togglePipMode}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-xl transition-colors shadow-sm shadow-blue-900/10"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="font-medium text-sm">{pipWindow ? 'Close Popup' : 'Pop Out'}</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full flex flex-col bg-[#09090b] overflow-hidden text-zinc-100 selection:bg-purple-500/30">
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
            onUnsubscribe={(channelId) => setSubscriptions(prev => prev.filter(s => s.id !== channelId))}
          />
        </div>
      ) : (
        <div ref={fullscreenWrapperRef} className="flex-1 flex flex-col md:flex-row overflow-hidden relative bg-transparent group/wrapper">
          {/* Left Column: Video/Summary */}
          <div className={`w-full ${metadata?.is_local_subtitle ? 'hidden md:flex' : ''} ${
            pipWindow ? 'md:w-full' : (isLeftCollapsed && metadata?.is_local_subtitle ? 'md:w-0 md:opacity-0 md:overflow-hidden' : 'md:w-1/2')
          } transition-all duration-300 h-1/2 md:h-full flex flex-col shrink-0`}>
            {!metadata?.is_local_subtitle && (
              <>
            <div className="flex-1 min-h-0 relative bg-transparent">
              <VideoPlayer
                videoId={videoId}
                seekCommand={seekCommand}
                onTimeUpdate={handleTimeUpdate}
                wrapperRef={fullscreenWrapperRef}
              />
            </div>
            {metadata?.channel && (
              <div className="glass-panel border-t-0 border-r border-white/5 px-6 py-4 flex items-center justify-between shrink-0 z-10">
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400 text-sm">YouTuber:</span>
                  <button
                    onClick={() => setSelectedChannel(metadata.channel)}
                    className="px-3 py-1.5 bg-zinc-800/50 hover:bg-zinc-700/50 text-blue-400 text-sm font-medium rounded-lg border border-white/5 hover:border-blue-500/30 transition-colors"
                  >
                    {metadata.channel}
                  </button>
                  {metadata.channel_url && (
                    <button
                      onClick={handleToggleSubscription}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors shadow-sm ${subscriptions.some(s => s.id === metadata.channel_url)
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-zinc-800/50 text-zinc-400 border-white/5 hover:text-white hover:bg-zinc-700/50'
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
            </>
          )}
            <div className={`p-6 flex-1 min-h-0 bg-gray-900 border-gray-800 overflow-y-auto custom-scrollbar ${metadata?.is_local_subtitle ? 'border-none' : 'border-t hidden md:block'}`}>
              {summary ? (
                <>
                  <button
                    onClick={() => setIsSummaryOpen(prev => !prev)}
                    className="flex items-center justify-between w-full pb-2 cursor-pointer group"
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
                  <h2 className="text-xl font-bold text-white mb-2 pb-2">Instructions</h2>
                  <ul className="text-gray-400 space-y-2 list-disc list-inside">
                    <li>Video playback syncs directly with the interactive transcript on the right.</li>
                    <li>Advanced keywords are highlighted with their Chinese translations underneath.</li>
                    <li>The backend currently uses a mock LLM logic for quick local testing without token limits.</li>
                  </ul>
                </>
              )}

              {/* Vocabulary Summary Accordion */}
              {transcript.length > 0 && (() => {
                const seen = new Set<string>();
                const vocabItems: { en: string; zh: string; start: number; en_text: string; zh_text: string; highlights: any[] }[] = [];
                for (const block of transcript) {
                  if (block.highlights) {
                    for (const h of block.highlights) {
                      const key = `${h.en_word}|||${h.zh_word}`;
                      if (!seen.has(key)) {
                        seen.add(key);
                        vocabItems.push({ 
                          en: h.en_word, 
                          zh: h.zh_word, 
                          start: block.start,
                          en_text: block.en_text,
                          zh_text: block.zh_text,
                          highlights: block.highlights
                        });
                      }
                    }
                  }
                }
                if (vocabItems.length === 0) return null;
                return (
                  <div className="mt-6 pt-6 border-t border-gray-800">
                    <button
                      onClick={() => setIsVocabOpen(prev => !prev)}
                      className="flex items-center justify-between w-full cursor-pointer group"
                    >
                      <h2 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">
                        Vocabulary Summary
                        <span className="ml-2 text-sm font-normal text-gray-500">({vocabItems.length})</span>
                      </h2>
                      <svg
                        className={`w-5 h-5 text-gray-400 group-hover:text-purple-400 transition-transform duration-300 ${isVocabOpen ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div
                      className={`transition-all duration-300 ease-in-out ${isVocabOpen ? 'max-h-[20000px] opacity-100 mt-3' : 'max-h-0 opacity-0 overflow-hidden'}`}
                    >
                      <div className="space-y-1">
                        {vocabItems.map((item, idx) => {
                          const vocabId = `vocab-${videoId}-${item.en.replace(/\s+/g, '-')}`;
                          const isFav = favorites.some(f => f.id === vocabId);
                          return (
                            <button
                              key={idx}
                              onClick={() => setSeekCommand({ time: item.start, timestamp: Date.now() })}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-800/80 transition-colors group/row cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            >
                              <span className="text-purple-300 font-medium text-sm text-left group-hover/row:text-purple-200 transition-colors flex-1">{item.en}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-gray-400 text-sm text-right group-hover/row:text-gray-300 transition-colors">{item.zh}</span>
                                <div 
                                  onClick={(e) => handleToggleVocabFavorite(e, item)}
                                  className={`p-1.5 rounded-md hover:bg-gray-700 transition-colors ${isFav ? 'text-yellow-500' : 'text-gray-500 opacity-0 group-hover/row:opacity-100 hover:text-yellow-500'}`}
                                >
                                  <Star className="w-4 h-4" fill={isFav ? "currentColor" : "none"} />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Transcript Column: fixed to right half, or floating popup */}
          {(() => {
            const transcriptContent = (
              <>
                {/* Collapse Toggle Button for Local Subtitles (only in split mode) */}
                {!pipWindow && metadata?.is_local_subtitle && (
                  <button
                    onClick={() => setIsLeftCollapsed(prev => !prev)}
                    className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-50 p-1.5 bg-gray-800 border border-gray-700 border-l-0 rounded-r-xl hover:bg-gray-700 hover:text-purple-400 text-gray-400 transition-colors shadow-lg shadow-black/50"
                    title={isLeftCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                  >
                    {isLeftCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                  </button>
                )}

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

                {/* Streaming translation progress */}
                {translationProgress && (
                  <div className="flex-none flex items-center gap-3 px-4 py-2 bg-blue-500/10 border-b border-blue-500/20 z-20">
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                    <span className="text-xs text-blue-300 font-medium flex-1 truncate">
                      {translationProgress.stage === 'summary'
                        ? 'AI 正在生成视频总结…'
                        : `字幕翻译中 ${translationProgress.done}/${translationProgress.total} 句 — 可以先开始观看`}
                    </span>
                    {translationProgress.total > 0 && (
                      <div className="w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden shrink-0">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.round((translationProgress.done / translationProgress.total) * 100)}%` }}
                        />
                      </div>
                    )}
                    <button
                      onClick={() => {
                        cancelTranslationStream();
                        toast.info('已停止翻译；已完成的部分已保存，下次打开会自动续译。');
                      }}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-red-400 transition-colors shrink-0"
                      title="停止翻译"
                    >
                      <XCircle className="w-3.5 h-3.5" /> 停止
                    </button>
                  </div>
                )}

                <div className="relative flex-1 min-h-0 bg-transparent">
                  <div className="absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-[#09090b] to-transparent z-10 pointer-events-none"></div>
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
                  <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-[#09090b] to-transparent z-10 pointer-events-none"></div>
                </div>
              </>
            );

            if (pipWindow) {
              return createPortal(
                <div className="w-full h-full flex flex-col relative bg-[#09090b]">
                  {transcriptContent}
                </div>,
                pipWindow.document.body
              );
            }

            return (
              <div className={`w-full ${isLeftCollapsed && metadata?.is_local_subtitle ? 'md:w-full' : 'md:w-1/2'} transition-all duration-300 h-1/2 md:h-full flex flex-col relative border-t md:border-t-0 border-white/5 bg-transparent`}>
                {transcriptContent}
              </div>
            );
          })()}
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
        onReprocess={(videoId) => handleUrlSubmit(`https://www.youtube.com/watch?v=${videoId}`)}
      />

      <Toaster />
    </div>
  );
}

export default App;
