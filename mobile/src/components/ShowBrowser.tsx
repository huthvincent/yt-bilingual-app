import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { api } from '../config/api';
import type { Show, SeasonData } from '../types';

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
    fetch(api.shows)
      .then((res) => res.json())
      .then((data) => {
        setShows(data.shows || []);
        setLoadingShows(false);
      })
      .catch(() => setLoadingShows(false));
  }, []);

  const handleShowSelect = async (show: Show) => {
    setSelectedShow(show);
    setSelectedSeason(null);
    setProcessedEpisodes(new Set());
    try {
      const [seasonsRes, processedRes] = await Promise.all([
        fetch(`${api.shows}/${show.id}/seasons`),
        fetch(`${api.shows}/${show.id}/processed`),
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
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={colors.purple[400]} />
      </View>
    );
  }

  if (shows.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="tv-outline" size={40} color={colors.text.disabled} />
        <Text style={styles.emptyText}>暂无本地剧集字幕</Text>
        <Text style={styles.emptySubtext}>将 SRT 文件放入 subtitles/ 目录即可添加</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Back button + title */}
      <View style={styles.header}>
        {selectedShow && (
          <TouchableOpacity
            onPress={() => {
              setSelectedShow(null);
              setSeasons([]);
              setSelectedSeason(null);
            }}
          >
            <Text style={styles.backText}>← 返回</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerTitle}>
          <Ionicons name="book-outline" size={18} color={colors.purple[400]} />
          <Text style={styles.titleText}>
            {selectedShow ? selectedShow.title_zh || selectedShow.title : '本地剧集'}
          </Text>
        </View>
      </View>

      {/* Show List */}
      {!selectedShow &&
        shows.map((show) => (
          <TouchableOpacity
            key={show.id}
            style={styles.showCard}
            onPress={() => handleShowSelect(show)}
            activeOpacity={0.7}
          >
            <View style={styles.showInfo}>
              <Text style={styles.showTitle}>{show.title_zh || show.title}</Text>
              <Text style={styles.showSubtitle}>{show.title}</Text>
              <Text style={styles.showMeta}>
                {Object.keys(show.seasons_available).length} 季 · {show.total_episodes} 集可用
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
          </TouchableOpacity>
        ))}

      {/* Season & Episode Selector */}
      {selectedShow && (
        <View style={styles.seasonSection}>
          {/* Season Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonTabs}>
            {seasons.map((s) => (
              <TouchableOpacity
                key={s.season}
                style={[
                  styles.seasonTab,
                  selectedSeason === s.season && styles.seasonTabActive,
                ]}
                onPress={() => setSelectedSeason(s.season)}
              >
                <Text
                  style={[
                    styles.seasonTabText,
                    selectedSeason === s.season && styles.seasonTabTextActive,
                  ]}
                >
                  第 {s.season} 季
                </Text>
                <Text style={styles.seasonEpCount}>({s.episode_count}集)</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Episode Grid */}
          {selectedSeason && (
            <View style={styles.episodeGrid}>
              {seasons
                .find((s) => s.season === selectedSeason)
                ?.episodes.map((ep) => {
                  const epKey = `S${selectedSeason.toString().padStart(2, '0')}E${ep
                    .toString()
                    .padStart(2, '0')}`;
                  const isProcessed = processedEpisodes.has(epKey);
                  return (
                    <TouchableOpacity
                      key={ep}
                      disabled={isLoading}
                      onPress={() => onSelectEpisode(selectedShow.id, selectedSeason, ep)}
                      style={[
                        styles.episodeBtn,
                        isProcessed && styles.episodeBtnProcessed,
                        isLoading && styles.episodeBtnDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.episodeBtnText,
                          isProcessed && styles.episodeBtnTextProcessed,
                        ]}
                      >
                        E{ep.toString().padStart(2, '0')}
                        {isProcessed ? ' ✓' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>
          )}

          {!selectedSeason && (
            <Text style={styles.promptText}>👆 选择一季开始学习</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.text.muted,
  },
  emptySubtext: {
    fontSize: fontSize.xs,
    color: colors.text.disabled,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  backText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  showCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(31, 41, 55, 0.6)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(55, 65, 81, 0.5)',
    gap: spacing.md,
  },
  showInfo: {
    flex: 1,
    gap: 2,
  },
  showTitle: {
    fontSize: fontSize.lg,
    fontWeight: '500',
    color: colors.text.primary,
  },
  showSubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  showMeta: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  seasonSection: {
    gap: spacing.md,
  },
  seasonTabs: {
    flexDirection: 'row',
  },
  seasonTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.tertiary,
    marginRight: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  seasonTabActive: {
    backgroundColor: colors.purple[600],
    shadowColor: colors.purple[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  seasonTabText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text.tertiary,
  },
  seasonTabTextActive: {
    color: '#fff',
  },
  seasonEpCount: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },
  episodeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  episodeBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: 'rgba(55, 65, 81, 0.5)',
    minWidth: 60,
    alignItems: 'center',
  },
  episodeBtnProcessed: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  episodeBtnDisabled: {
    opacity: 0.5,
  },
  episodeBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  episodeBtnTextProcessed: {
    color: colors.emerald[300],
  },
  promptText: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
