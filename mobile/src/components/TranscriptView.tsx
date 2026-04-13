import React, { useEffect, useRef, useMemo } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { TranscriptBlock } from './TranscriptBlock';
import { colors, spacing } from '../theme';
import type { TranscriptItem } from '../types';

interface TranscriptViewProps {
  transcript: TranscriptItem[];
  currentTime: number;
  videoId: string;
  favorites: string[];
  onTranscriptClick: (time: number) => void;
  onToggleFavorite: (item: TranscriptItem) => void;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  transcript,
  currentTime,
  videoId,
  favorites,
  onTranscriptClick,
  onToggleFavorite,
}) => {
  const flatListRef = useRef<FlatList>(null);

  // Add offset so highlight moves slightly before the rigid timestamp boundary
  const effectiveTime = currentTime + 0.8;

  const activeIndex = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < transcript.length; i++) {
      const item = transcript[i];
      if (effectiveTime >= item.start && effectiveTime < item.end) {
        idx = i;
        break;
      } else if (effectiveTime >= item.end) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [effectiveTime, transcript]);

  // Auto-scroll to active transcript block
  const lastScrolledIndex = useRef(-1);
  useEffect(() => {
    if (
      activeIndex !== -1 &&
      activeIndex !== lastScrolledIndex.current &&
      flatListRef.current
    ) {
      lastScrolledIndex.current = activeIndex;
      flatListRef.current.scrollToIndex({
        index: activeIndex,
        animated: true,
        viewPosition: 0.2, // Position near top of viewport
      });
    }
  }, [activeIndex]);

  const renderItem = ({ item, index }: { item: TranscriptItem; index: number }) => {
    const isActive = index === activeIndex;
    return (
      <TranscriptBlock
        id={item.id}
        start={item.start}
        end={item.end}
        enText={item.en_text}
        zhText={item.zh_text}
        highlights={item.highlights}
        isActive={isActive}
        isFavorited={favorites.includes(`${videoId}-${item.id}`)}
        onToggleFavorite={() => onToggleFavorite(item)}
        onPress={() => onTranscriptClick(item.start)}
      />
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={transcript}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={(info) => {
          // Fallback: scroll to approximate offset
          flatListRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: true,
          });
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: 120, // Extra space at bottom for safe area
  },
});
