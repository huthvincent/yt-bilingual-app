import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import type { FavoriteItem } from '../types';
import { VideoPlayer } from './VideoPlayer';

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: FavoriteItem[];
  onRemoveFavorite: (id: string) => void;
  onPlayFavorite: (videoId: string, start: number) => void;
}

// Help functions for grouping logic
const getGroupTitle = (timestamp?: number) => {
  if (!timestamp) return '更早 (Older)';

  const now = new Date();
  const date = new Date(timestamp);
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  if (date >= today) return '今天 (Today)';
  if (date >= yesterday && date < today) return '昨天 (Yesterday)';
  if (date >= lastWeek && date < yesterday) return '过去7天 (Last 7 days)';
  
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
};

export const FavoritesModal: React.FC<FavoritesModalProps> = ({
  isOpen,
  onClose,
  favorites,
  onRemoveFavorite,
  onPlayFavorite,
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [playingFav, setPlayingFav] = useState<{ videoId: string, start: number } | null>(null);

  // Group the favorites
  const groups = useMemo(() => {
    const sorted = [...favorites].sort((a, b) => (b.added_at || 0) - (a.added_at || 0));
    const map: Record<string, typeof favorites> = {};
    
    sorted.forEach((fav) => {
      const title = getGroupTitle(fav.added_at);
      if (!map[title]) map[title] = [];
      map[title].push(fav);
    });

    return map;
  }, [favorites]);

  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>My Favorites</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {favorites.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="star-outline" size={48} color={colors.text.disabled} />
              <Text style={styles.emptyTitle}>No favorites yet.</Text>
              <Text style={styles.emptySubtitle}>
                Click the star icon next to a sentence to save it.
              </Text>
            </View>
          ) : (
            <ScrollView 
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {Object.entries(groups).map(([title, items]) => {
                const isCollapsed = collapsedGroups[title];
                return (
                  <View key={title} style={{ marginBottom: spacing.md }}>
                    <TouchableOpacity 
                      onPress={() => toggleGroup(title)}
                      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}
                    >
                      <Ionicons 
                        name={isCollapsed ? "chevron-forward" : "chevron-down"} 
                        size={20} 
                        color={isCollapsed ? colors.text.muted : colors.purple[400]} 
                      />
                      <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: colors.text.primary, marginLeft: spacing.xs }}>
                        {title}
                      </Text>
                      <View style={{ backgroundColor: colors.bg.card, paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.full, marginLeft: spacing.sm }}>
                        <Text style={{ color: colors.text.muted, fontSize: fontSize.xs }}>{items.length}</Text>
                      </View>
                    </TouchableOpacity>

                    {!isCollapsed && (
                      <View style={{ gap: spacing.md, paddingLeft: spacing.sm }}>
                        {items.map(fav => (
                          <View key={fav.id} style={styles.favCard}>
                            <View style={styles.favContent}>
                              <View style={styles.favMeta}>
                                <View style={styles.timePill}>
                                  <Text style={styles.timePillText}>{formatTime(fav.start)}</Text>
                                </View>
                                <Text style={styles.videoIdText}>
                                  Video: {fav.videoId.slice(0, 8)}...
                                </Text>
                              </View>
                              <Text style={styles.favEn}>{fav.en_text}</Text>
                              <Text style={styles.favZh}>{fav.zh_text}</Text>
                            </View>
                            <View style={styles.favActions}>
                              <TouchableOpacity
                                onPress={() => {
                                  if (fav.videoId.length > 11) {
                                    onClose();
                                    onPlayFavorite(fav.videoId, fav.start);
                                  } else {
                                    setPlayingFav({ videoId: fav.videoId, start: fav.start });
                                  }
                                }}
                                style={styles.playBtn}
                              >
                                <Ionicons name={fav.videoId.length > 11 ? "document-text" : "play"} size={16} color="#fff" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => onRemoveFavorite(fav.id)}
                                style={styles.deleteBtn}
                              >
                                <Ionicons name="trash-outline" size={16} color={colors.red[500]} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {playingFav && (
            <View style={styles.miniPlayerContainer}>
              <View style={styles.miniPlayerHeader}>
                <Text style={styles.miniPlayerTitle}>Playing Video</Text>
                <TouchableOpacity onPress={() => setPlayingFav(null)} style={styles.miniPlayerClose}>
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={{ height: 220, width: '100%' }}>
                <VideoPlayer
                  videoId={playingFav.videoId}
                  seekCommand={{ time: playingFav.start, timestamp: Date.now() }}
                  onTimeUpdate={() => {}}
                />
              </View>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  closeBtn: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    color: colors.text.muted,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.disabled,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  listContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  favCard: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(55, 65, 81, 0.5)',
    flexDirection: 'row',
    gap: spacing.md,
  },
  favContent: {
    flex: 1,
    gap: spacing.sm,
  },
  favMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  timePill: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  timePillText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.purple[400],
  },
  videoIdText: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },
  favEn: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.secondary,
    lineHeight: 20,
  },
  favZh: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    lineHeight: 18,
  },
  favActions: {
    justifyContent: 'center',
    gap: spacing.sm,
  },
  playBtn: {
    padding: spacing.sm,
    backgroundColor: colors.purple[600],
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    padding: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniPlayerContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.secondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  miniPlayerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.tertiary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  miniPlayerTitle: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  miniPlayerClose: {
    padding: spacing.xs,
  },
});
