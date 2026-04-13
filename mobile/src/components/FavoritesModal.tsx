import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import type { FavoriteItem } from '../types';

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: FavoriteItem[];
  onRemoveFavorite: (id: string) => void;
  onPlayFavorite: (videoId: string, start: number) => void;
}

export const FavoritesModal: React.FC<FavoritesModalProps> = ({
  isOpen,
  onClose,
  favorites,
  onRemoveFavorite,
  onPlayFavorite,
}) => {
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
            <FlatList
              data={favorites}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: fav }) => (
                <View style={styles.favCard}>
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
                        onClose();
                        onPlayFavorite(fav.videoId, fav.start);
                      }}
                      style={styles.playBtn}
                    >
                      <Ionicons name="play" size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onRemoveFavorite(fav.id)}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.red[500]} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    marginTop: 60,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    overflow: 'hidden',
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
});
