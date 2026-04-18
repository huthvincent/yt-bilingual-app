import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { api } from '../config/api';
import type { HistoryItem } from '../types';
import { ChannelVideoListModal } from './ChannelVideoListModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.6;

interface InputScreenProps {
  onSubmit: (url: string) => void;
  onLoadHistory: (filename: string) => void;
  onSelectEpisode: (showId: string, season: number, episode: number) => void;
  isLoading: boolean;
  subscriptions?: { id: string; name: string }[];
}

export const InputScreen: React.FC<InputScreenProps> = ({
  onSubmit,
  onLoadHistory,
  onSelectEpisode,
  isLoading,
  subscriptions = [],
}) => {
  const [url, setUrl] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [channelUpdates, setChannelUpdates] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  useEffect(() => {
    fetch(api.history)
      .then((res) => res.json())
      .then((data) => setHistory(data))
      .catch((err) => console.error('Failed to fetch history:', err));

    if (subscriptions.length > 0) {
      fetch(api.channelUpdates, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: subscriptions.map((s) => s.id) }),
      })
        .then((res) => res.json())
        .then((data) => setChannelUpdates(data.updates || []))
        .catch((err) => console.error('Failed to fetch updates:', err));
    }
  }, [subscriptions]);

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Loading Overlay — handled in parent App */}

      {/* Hero Section */}
      <View style={styles.hero}>
        <Ionicons name="language" size={48} color={colors.purple[400]} />
        <Text style={styles.heroTitle}>Learn English with YouTube</Text>
        <Text style={styles.heroSubtitle}>
          Paste a YouTube video URL to get a bilingual interactive transcript.
        </Text>
      </View>

      {/* URL Input */}
      <View style={styles.inputSection}>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="search"
            size={20}
            color={colors.text.tertiary}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="https://www.youtube.com/watch?v=..."
            placeholderTextColor={colors.text.muted}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            editable={!isLoading}
          />
        </View>
        <TouchableOpacity
          style={[styles.submitBtn, (!url.trim() || isLoading) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!url.trim() || isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.submitBtnText}>Processing...</Text>
            </View>
          ) : (
            <Text style={styles.submitBtnText}>Start Learning</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* My YouTubers Library */}
      {subscriptions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="logo-youtube" size={20} color={colors.purple[400]} />
            <Text style={styles.sectionTitle}>My YouTubers Library</Text>
          </View>
          <FlatList
            data={subscriptions}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.youtuberCard}
                onPress={() => setSelectedChannel(item.name)}
                activeOpacity={0.7}
              >
                <View style={styles.youtuberAvatar}>
                  <Text style={styles.youtuberAvatarText}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.youtuberInfo}>
                  <Text style={styles.youtuberName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.youtuberSubtext}>View collection</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* History Section */}
      {history.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={20} color={colors.text.muted} />
            <Text style={styles.sectionTitle}>Your Learning History</Text>
          </View>
          <FlatList
            data={history}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            keyExtractor={(item) => item.filename}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.historyCard}
                onPress={() => onLoadHistory(item.filename)}
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
                  <View style={styles.cardMeta}>
                    <Ionicons name="logo-youtube" size={12} color={colors.purple[400]} />
                    <Text style={styles.cardChannel} numberOfLines={1}>
                      {item.metadata?.channel || item.filename}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Subscribed Channel Updates */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="logo-youtube" size={20} color="#ef4444" />
          <Text style={styles.sectionTitle}>Subscribed Channels Updates</Text>
        </View>
        {subscriptions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="logo-youtube" size={40} color={colors.text.disabled} />
            <Text style={styles.emptyTitle}>No Subscriptions Yet</Text>
            <Text style={styles.emptySubtext}>
              Process any video and tap "Subscribe +" next to the YouTuber's name.
            </Text>
          </View>
        ) : channelUpdates.length === 0 ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator size="small" color={colors.text.disabled} />
            <Text style={styles.emptySubtext}>Checking for latest videos...</Text>
          </View>
        ) : (
          <FlatList
            data={channelUpdates}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            keyExtractor={(item, idx) => `${item.videoId}-${idx}`}
            renderItem={({ item: update }) => (
              <TouchableOpacity
                style={styles.historyCard}
                onPress={() => onSubmit(`https://youtube.com/watch?v=${update.videoId}`)}
                activeOpacity={0.7}
              >
                {update.thumbnail ? (
                  <Image
                    source={{ uri: update.thumbnail }}
                    style={[styles.cardImage, { aspectRatio: 16 / 9 }]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.cardImage, styles.noThumb]}>
                    <Ionicons name="film-outline" size={32} color={colors.text.disabled} />
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {update.title}
                  </Text>
                  <View style={styles.cardMeta}>
                    <Text style={[styles.cardChannel, { color: colors.pink[400] }]} numberOfLines={1}>
                      {update.channel}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <View style={{ height: 40 }} />

      <ChannelVideoListModal
        isOpen={!!selectedChannel}
        onClose={() => setSelectedChannel(null)}
        channelName={selectedChannel}
        onLoadHistory={onLoadHistory}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  heroTitle: {
    fontSize: fontSize.xxxl,
    fontWeight: '800',
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  heroSubtitle: {
    fontSize: fontSize.md,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputSection: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.secondary,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.lg,
    fontSize: fontSize.lg,
    color: colors.text.primary,
  },
  submitBtn: {
    backgroundColor: colors.purple[600],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  section: {
    marginTop: spacing.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  horizontalList: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  youtuberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginRight: spacing.md,
    gap: spacing.md,
    minWidth: 180,
  },
  youtuberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtuberAvatarText: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  youtuberInfo: {
    flex: 1,
  },
  youtuberName: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
  },
  youtuberSubtext: {
    fontSize: fontSize.xs,
    color: colors.purple[400],
    marginTop: 2,
  },
  historyCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.secondary,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 1,
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
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text.secondary,
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardChannel: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: 'rgba(192, 132, 252, 0.8)',
    flex: 1,
  },
  emptyCard: {
    marginHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    backgroundColor: 'rgba(31, 41, 55, 0.3)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
