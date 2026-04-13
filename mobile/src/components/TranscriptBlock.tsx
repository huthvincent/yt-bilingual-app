import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, fontSize } from '../theme';
import type { Highlight } from '../types';

// Highlighted text rendering — matches web version's exact substring replacement
const HighlightedText: React.FC<{
  text: string;
  highlights: Array<{ word: string; color: string; annotation?: string }>;
  baseStyle: any;
}> = ({ text, highlights, baseStyle }) => {
  if (!highlights || highlights.length === 0) {
    return <Text style={baseStyle}>{text}</Text>;
  }

  // Find matches and sort by position
  const matches = highlights
    .map((hl) => {
      const idx = text.indexOf(hl.word);
      return { ...hl, index: idx, length: hl.word.length };
    })
    .filter((m) => m.index !== -1)
    .sort((a, b) => a.index - b.index);

  // Remove overlapping matches
  const validMatches: typeof matches = [];
  let lastEnd = 0;
  for (const match of matches) {
    if (match.index >= lastEnd) {
      validMatches.push(match);
      lastEnd = match.index + match.length;
    }
  }

  if (validMatches.length === 0) {
    return <Text style={baseStyle}>{text}</Text>;
  }

  const parts: React.ReactNode[] = [];
  let currentIndex = 0;

  validMatches.forEach((match, i) => {
    if (match.index > currentIndex) {
      parts.push(
        <Text key={`t-${i}`} style={baseStyle}>
          {text.slice(currentIndex, match.index)}
        </Text>
      );
    }
    parts.push(
      <Text key={`hl-${i}`} style={[baseStyle, styles.highlightedWord]}>
        {text.slice(match.index, match.index + match.length)}
      </Text>
    );
    if (match.annotation) {
      parts.push(
        <Text key={`ann-${i}`} style={styles.annotation}>
          ({match.annotation})
        </Text>
      );
    }
    currentIndex = match.index + match.length;
  });

  if (currentIndex < text.length) {
    parts.push(
      <Text key="t-end" style={baseStyle}>
        {text.slice(currentIndex)}
      </Text>
    );
  }

  return <Text>{parts}</Text>;
};

interface TranscriptBlockProps {
  id: number;
  start: number;
  end: number;
  enText: string;
  zhText: string;
  highlights: Highlight[];
  isActive: boolean;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  onPress?: () => void;
}

export const TranscriptBlock: React.FC<TranscriptBlockProps> = ({
  start,
  end,
  enText,
  zhText,
  highlights,
  isActive,
  isFavorited,
  onToggleFavorite,
  onPress,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const enHighlights = useMemo(
    () => highlights.map((h) => ({ word: h.en_word, color: h.color, annotation: h.zh_word })),
    [highlights]
  );
  const zhHighlights = useMemo(
    () => highlights.map((h) => ({ word: h.zh_word, color: h.color })),
    [highlights]
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.container, isActive && styles.containerActive]}
    >
      <View style={styles.header}>
        <View style={[styles.timeBadge, isActive && styles.timeBadgeActive]}>
          <Text style={[styles.timeText, isActive && styles.timeTextActive]}>
            {formatTime(start)} - {formatTime(end)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation?.();
            onToggleFavorite?.();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.starButton}
        >
          <Ionicons
            name={isFavorited ? 'star' : 'star-outline'}
            size={16}
            color={isFavorited ? colors.yellow[500] : colors.text.muted}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.textContainer}>
        <HighlightedText
          text={enText}
          highlights={enHighlights}
          baseStyle={[styles.enText, isActive && styles.enTextActive]}
        />
        <HighlightedText
          text={zhText}
          highlights={zhHighlights}
          baseStyle={[styles.zhText, isActive && styles.zhTextActive]}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: spacing.xs,
  },
  containerActive: {
    backgroundColor: 'rgba(31, 41, 55, 0.9)',
    borderColor: 'rgba(168, 85, 247, 0.4)',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  timeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  timeBadgeActive: {
    borderColor: 'rgba(168, 85, 247, 0.5)',
  },
  timeText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.text.tertiary,
    fontVariant: ['tabular-nums'],
  },
  timeTextActive: {
    color: colors.purple[400],
  },
  starButton: {
    padding: 6,
    borderRadius: borderRadius.sm,
  },
  textContainer: {
    gap: 2,
  },
  enText: {
    fontSize: fontSize.md,
    fontWeight: '500',
    lineHeight: 20,
    color: colors.text.secondary,
  },
  enTextActive: {
    color: colors.text.primary,
  },
  zhText: {
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: colors.text.tertiary,
  },
  zhTextActive: {
    color: 'rgba(245, 208, 254, 1)',
  },
  highlightedWord: {
    color: colors.purple[400],
    textDecorationLine: 'underline',
    textDecorationStyle: 'dashed',
    textDecorationColor: colors.purple[400],
  },
  annotation: {
    fontSize: fontSize.xs,
    color: 'rgba(192, 132, 252, 0.7)',
    marginLeft: 2,
  },
});
