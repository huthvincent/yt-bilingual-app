import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  SafeAreaView,
  Image,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import type { HistoryItem } from '../types';
import { api } from '../config/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ChannelVideoListModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelName: string | null;
  onLoadHistory: (filename: string) => void;
}

export const ChannelVideoListModal: React.FC<ChannelVideoListModalProps> = ({
  isOpen,
  onClose,
  channelName,
  onLoadHistory,
}) => {
  const [videos, setVideos] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && channelName) {
      setIsLoading(true);
      fetch(api.history)
        .then((res) => res.json())
        .then((data: HistoryItem[]) => {
          const filtered = data.filter((item) => item.metadata?.channel === channelName);
          filtered.sort((a, b) => {
            const dateA = a.metadata?.upload_date || "";
            const dateB = b.metadata?.upload_date || "";
            return dateB.localeCompare(dateA); // Descending order
          });
          setVideos(filtered);
        })
        .catch((err) => console.error('Failed to fetch channel history:', err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, channelName]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr || 'Unknown Date';
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  };

  const handleSelectVideo = (filename: string) => {
    onClose();
    onLoadHistory(filename);
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>{channelName}</Text>
            <Text style={styles.headerSubtitle}>From your local learning history</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.purple[400]} />
            <Text style={styles.loadingText}>Loading videos...</Text>
          </View>
        ) : videos.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="film-outline" size={48} color={colors.text.disabled} />
            <Text style={styles.loadingText}>No older videos found.</Text>
          </View>
        ) : (
          <FlatList
            data={videos}
            keyExtractor={(item) => item.filename}
            contentContainerStyle={styles.listContent}
            numColumns={SCREEN_WIDTH > 600 ? 2 : 1}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => handleSelectVideo(item.filename)}
                activeOpacity={0.7}
              >
                {item.metadata?.thumbnail ? (
                  <Image
                    source={{ uri: item.metadata.thumbnail }}
                    style={styles.cardImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.cardImage, styles.noThumb]}>
                    <Ionicons name="film-outline" size={32} color={colors.text.disabled} />
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.metadata?.title || 'Unknown Title'}
                  </Text>
                  <Text style={styles.cardDate}>Uploaded: {formatDate(item.metadata?.upload_date)}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
    backgroundColor: colors.bg.primary,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: spacing.lg,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.sm,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.secondary,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.bg.primary,
  },
  noThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
    lineHeight: 20,
  },
  cardDate: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
});
