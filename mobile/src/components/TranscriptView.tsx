import React, { useEffect, useRef, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  onToggleVocabFavorite: (enWord: string, zhWord: string, contextEn: string, contextZh: string, start: number) => void;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  transcript,
  currentTime,
  videoId,
  favorites,
  onTranscriptClick,
  onToggleFavorite,
  onToggleVocabFavorite,
}) => {
  const flatListRef = useRef<FlatList>(null);
  const [isVocabOpen, setIsVocabOpen] = useState(false);

  const vocabItems = useMemo(() => {
    const seen = new Set<string>();
    const items: { en: string; zh: string; start: number; context_en: string; context_zh: string }[] = [];
    for (const block of transcript) {
      if (block.highlights) {
        for (const h of block.highlights) {
          const key = `${h.en_word}|||${h.zh_word}`;
          if (!seen.has(key)) {
            seen.add(key);
            items.push({ 
              en: h.en_word, 
              zh: h.zh_word, 
              start: block.start,
              context_en: block.en_text,
              context_zh: block.zh_text 
            });
          }
        }
      }
    }
    return items;
  }, [transcript]);

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

  const renderHeader = () => {
    if (vocabItems.length === 0) return null;

    return (
      <View style={styles.vocabContainer}>
        <TouchableOpacity
          style={styles.vocabHeader}
          activeOpacity={0.7}
          onPress={() => setIsVocabOpen(!isVocabOpen)}
        >
          <View style={styles.vocabHeaderLeft}>
            <Text style={styles.vocabTitle}>Vocabulary Summary</Text>
            <Text style={styles.vocabCount}>({vocabItems.length})</Text>
          </View>
          <Ionicons 
            name={isVocabOpen ? "chevron-up" : "chevron-down"} 
            size={20} 
            color={colors.text.muted} 
          />
        </TouchableOpacity>

        {isVocabOpen && (
          <View style={styles.vocabList}>
            {vocabItems.map((item, idx) => {
              const favId = `vocab-${videoId}-${item.en.replace(/\s+/g, '-')}`;
              const isFav = favorites.includes(favId);
              
              return (
                <View key={idx} style={styles.vocabItemContainer}>
                  <TouchableOpacity
                    style={styles.vocabItemRow}
                    activeOpacity={0.7}
                    onPress={() => onTranscriptClick(item.start)}
                  >
                    <Text style={styles.vocabEn}>{item.en}</Text>
                    <Text style={styles.vocabZh}>{item.zh}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.vocabFavBtn}
                    onPress={() => onToggleVocabFavorite(item.en, item.zh, item.context_en, item.context_zh, item.start)}
                  >
                    <Ionicons 
                      name={isFav ? "star" : "star-outline"} 
                      size={20} 
                      color={isFav ? colors.yellow[500] : colors.text.muted} 
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={transcript}
        ListHeaderComponent={renderHeader}
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
  vocabContainer: {
    marginBottom: spacing.lg,
    backgroundColor: colors.bg.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(55, 65, 81, 0.5)',
    overflow: 'hidden',
  },
  vocabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.bg.tertiary,
  },
  vocabHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  vocabTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  vocabCount: {
    fontSize: 14,
    color: colors.text.muted,
  },
  vocabList: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  vocabItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    backgroundColor: colors.bg.primary,
    borderRadius: 8,
  },
  vocabItemRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.md,
  },
  vocabEn: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.purple[400],
    flex: 1,
  },
  vocabZh: {
    fontSize: 14,
    color: colors.text.muted,
    flex: 1,
    textAlign: 'right',
  },
  vocabFavBtn: {
    padding: 4,
  },
});
