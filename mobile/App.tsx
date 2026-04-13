import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from './src/theme';
import { api } from './src/config/api';
import type { TranscriptItem, FavoriteItem, VideoMetadata } from './src/types';

// Components
import { InputScreen } from './src/components/InputScreen';
import { VideoPlayer } from './src/components/VideoPlayer';
import { TranscriptView } from './src/components/TranscriptView';
import { FavoritesModal } from './src/components/FavoritesModal';

export default function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoId, setVideoId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekCommand, setSeekCommand] = useState<{ time: number; timestamp: number } | null>(null);

  // Local subtitle playback timer
  const subtitleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isSubtitlePlaying, setIsSubtitlePlaying] = useState(false);

  const startSubtitleTimer = useCallback((fromTime: number) => {
    if (subtitleTimerRef.current) clearInterval(subtitleTimerRef.current);
    setCurrentTime(fromTime);
    setIsSubtitlePlaying(true);
    const startWall = Date.now();
    const startOffset = fromTime;
    subtitleTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startWall) / 1000;
      setCurrentTime(startOffset + elapsed);
    }, 100);
  }, []);

  const pauseSubtitleTimer = useCallback(() => {
    if (subtitleTimerRef.current) clearInterval(subtitleTimerRef.current);
    subtitleTimerRef.current = null;
    setIsSubtitlePlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      if (subtitleTimerRef.current) clearInterval(subtitleTimerRef.current);
    };
  }, []);

  // Favorites
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const favoritesLoaded = useRef(false);

  // Subscriptions
  const [subscriptions, setSubscriptions] = useState<{ id: string; name: string }[]>([]);
  const subsLoaded = useRef(false);

  // Load favorites & subscriptions from backend (with AsyncStorage fallback)
  useEffect(() => {
    fetch(api.favorites)
      .then((r) => r.json())
      .then((data) => {
        setFavorites(data);
        favoritesLoaded.current = true;
      })
      .catch(async () => {
        const saved = await AsyncStorage.getItem('yt_bilingual_favorites');
        if (saved) setFavorites(JSON.parse(saved));
        favoritesLoaded.current = true;
      });

    fetch(api.subscriptions)
      .then((r) => r.json())
      .then((data) => {
        setSubscriptions(data);
        subsLoaded.current = true;
      })
      .catch(async () => {
        const saved = await AsyncStorage.getItem('yt_bilingual_subs');
        if (saved) setSubscriptions(JSON.parse(saved));
        subsLoaded.current = true;
      });
  }, []);

  // Sync favorites
  useEffect(() => {
    if (!favoritesLoaded.current) return;
    AsyncStorage.setItem('yt_bilingual_favorites', JSON.stringify(favorites));
    fetch(api.favorites, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorites }),
    }).catch(() => {});
  }, [favorites]);

  // Sync subscriptions
  useEffect(() => {
    if (!subsLoaded.current) return;
    AsyncStorage.setItem('yt_bilingual_subs', JSON.stringify(subscriptions));
    fetch(api.subscriptions, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptions }),
    }).catch(() => {});
  }, [subscriptions]);

  const handleToggleSubscription = () => {
    if (!metadata?.channel_url || !metadata?.channel) return;
    const isSubbed = subscriptions.some((s) => s.id === metadata.channel_url);
    if (isSubbed) {
      setSubscriptions((prev) => prev.filter((s) => s.id !== metadata.channel_url));
    } else {
      setSubscriptions((prev) => [
        ...prev,
        { id: metadata.channel_url!, name: metadata.channel },
      ]);
    }
  };

  const handleToggleFavorite = (item: TranscriptItem) => {
    const id = `${videoId}-${item.id}`;
    setFavorites((prev) => {
      const exists = prev.find((f) => f.id === id);
      if (exists) {
        return prev.filter((f) => f.id !== id);
      } else {
        return [
          ...prev,
          {
            id,
            videoId,
            start: item.start,
            en_text: item.en_text,
            zh_text: item.zh_text,
          },
        ];
      }
    });
  };

  const handleRemoveFavorite = (id: string) => {
    setFavorites((prev) => prev.filter((fav) => fav.id !== id));
  };

  const handlePlayFavorite = (favVideoId: string, start: number) => {
    if (favVideoId !== videoId) {
      handleUrlSubmit(`https://youtube.com/watch?v=${favVideoId}`).then(() => {
        setTimeout(() => setSeekCommand({ time: start, timestamp: Date.now() }), 1000);
      });
    } else {
      setSeekCommand({ time: start, timestamp: Date.now() });
    }
    setIsFavoritesOpen(false);
  };

  const handleUrlSubmit = async (url: string) => {
    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/
    );
    const id = match ? match[1] : null;

    if (!id) {
      Alert.alert('Error', 'Invalid YouTube URL');
      return;
    }

    setIsLoading(true);
    setVideoUrl(url);

    try {
      const response = await fetch(api.processVideo, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) throw new Error('Failed to process video');

      const data = await response.json();
      setTranscript(data.transcript);
      setSummary(data.summary || '');
      setMetadata(data.metadata || null);
      setVideoId(id);
    } catch (error) {
      console.error(error);
      Alert.alert(
        'Error',
        'Failed to process video. Please check the backend is running and the video has closed captions.'
      );
      setVideoUrl('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectEpisode = async (showId: string, season: number, episode: number) => {
    setIsLoading(true);
    try {
      const cacheFilename = `${showId}_S${season.toString().padStart(2, '0')}E${episode
        .toString()
        .padStart(2, '0')}.json`;
      const cacheResponse = await fetch(`${api.history}/${cacheFilename}`);

      if (cacheResponse.ok) {
        const data = await cacheResponse.json();
        setTranscript(data.transcript);
        setSummary(data.summary || '');
        setMetadata({ ...data.metadata, is_local_subtitle: true });
        setVideoId(data.videoId);
        setVideoUrl('');
      } else {
        const response = await fetch(api.processSubtitle, {
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
        setVideoUrl('');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to process subtitle file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadHistory = async (filename: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${api.history}/${filename}`);
      if (!response.ok) throw new Error('Failed to load history');

      const data = await response.json();
      setTranscript(data.transcript);
      setSummary(data.summary || '');
      setMetadata(data.metadata || null);
      setVideoId(data.videoId);
      setVideoUrl(`https://youtube.com/watch?v=${data.videoId}`);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load history file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleGoHome = () => {
    pauseSubtitleTimer();
    setVideoId('');
    setVideoUrl('');
    setTranscript([]);
    setSummary('');
    setMetadata(null);
    setCurrentTime(0);
    setSeekCommand(null);
  };

  const isPlayerView = videoId && transcript.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleGoHome} activeOpacity={0.7}>
          <Text style={styles.brandText}>YT Bilingual</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setIsFavoritesOpen(true)}
          style={styles.favButton}
          activeOpacity={0.7}
        >
          <Ionicons name="star" size={16} color={colors.yellow[500]} />
          <Text style={styles.favButtonText}>Favorites ({favorites.length})</Text>
        </TouchableOpacity>
      </View>

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.purple[500]} />
          <Text style={styles.loadingTitle}>Processing...</Text>
          <Text style={styles.loadingSubtitle}>This may take a minute or two for long videos</Text>
        </View>
      )}

      {/* Content */}
      {!isPlayerView ? (
        <InputScreen
          onSubmit={handleUrlSubmit}
          onLoadHistory={handleLoadHistory}
          onSelectEpisode={handleSelectEpisode}
          isLoading={isLoading}
          subscriptions={subscriptions}
        />
      ) : (
        <View style={styles.playerLayout}>
          {/* Video Player (hidden for local subtitle mode) */}
          {!metadata?.is_local_subtitle && (
            <VideoPlayer
              videoId={videoId}
              seekCommand={seekCommand}
              onTimeUpdate={handleTimeUpdate}
            />
          )}

          {/* Channel Info Bar */}
          {!metadata?.is_local_subtitle && metadata?.channel && (
            <View style={styles.channelBar}>
              <Text style={styles.channelName} numberOfLines={1}>
                {metadata.channel}
              </Text>
              {metadata.channel_url && (
                <TouchableOpacity
                  onPress={handleToggleSubscription}
                  style={[
                    styles.subBtn,
                    subscriptions.some((s) => s.id === metadata.channel_url) &&
                      styles.subBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.subBtnText,
                      subscriptions.some((s) => s.id === metadata.channel_url) &&
                        styles.subBtnTextActive,
                    ]}
                  >
                    {subscriptions.some((s) => s.id === metadata.channel_url)
                      ? 'Subscribed ✓'
                      : 'Subscribe +'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Local subtitle playback controls */}
          {metadata?.is_local_subtitle && (
            <View style={styles.subtitleControls}>
              <TouchableOpacity
                onPress={() => {
                  if (isSubtitlePlaying) {
                    pauseSubtitleTimer();
                  } else {
                    startSubtitleTimer(currentTime);
                  }
                }}
                style={[
                  styles.playPauseBtn,
                  isSubtitlePlaying ? styles.pauseBtn : styles.playBtn,
                ]}
              >
                <Ionicons
                  name={isSubtitlePlaying ? 'pause' : 'play'}
                  size={16}
                  color={isSubtitlePlaying ? colors.amber[400] : colors.emerald[400]}
                />
              </TouchableOpacity>
              <Text style={styles.subtitleTitle} numberOfLines={1}>
                {metadata?.title || 'Local Subtitle'}
              </Text>
              <Text style={styles.timeDisplay}>
                {Math.floor(currentTime / 60)
                  .toString()
                  .padStart(2, '0')}
                :{Math.floor(currentTime % 60)
                  .toString()
                  .padStart(2, '0')}
              </Text>
            </View>
          )}

          {/* Transcript */}
          <View style={styles.transcriptContainer}>
            <TranscriptView
              transcript={transcript}
              currentTime={currentTime}
              videoId={videoId}
              favorites={favorites.map((f) => f.id)}
              onTranscriptClick={(time) => {
                if (metadata?.is_local_subtitle) {
                  startSubtitleTimer(time);
                } else {
                  setSeekCommand({ time, timestamp: Date.now() });
                }
              }}
              onToggleFavorite={handleToggleFavorite}
            />
          </View>
        </View>
      )}

      {/* Favorites Modal */}
      <FavoritesModal
        isOpen={isFavoritesOpen}
        onClose={() => setIsFavoritesOpen(false)}
        favorites={favorites}
        onRemoveFavorite={handleRemoveFavorite}
        onPlayFavorite={handlePlayFavorite}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  topBar: {
    height: 56,
    backgroundColor: colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandText: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.purple[400],
  },
  favButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
  },
  favButtonText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.purple[400],
  },
  loadingSubtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
  playerLayout: {
    flex: 1,
  },
  channelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  channelName: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.purple[400],
    flex: 1,
  },
  subBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.secondary,
    backgroundColor: colors.bg.tertiary,
  },
  subBtnActive: {
    backgroundColor: 'rgba(147, 51, 234, 0.2)',
    borderColor: 'rgba(168, 85, 247, 0.5)',
  },
  subBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.text.tertiary,
  },
  subBtnTextActive: {
    color: colors.purple[400],
  },
  subtitleControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
    gap: spacing.md,
  },
  playPauseBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  pauseBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  subtitleTitle: {
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.text.tertiary,
  },
  timeDisplay: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.text.muted,
    fontVariant: ['tabular-nums'],
  },
  transcriptContainer: {
    flex: 1,
  },
});
