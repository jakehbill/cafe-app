import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Cafe } from '@/data/cafes';

import { COLORS } from '@/components/theme';

export type CompactCafeCardProps = {
  cafe: Cafe;
  onPress: () => void;
  /** 1-based rank label (e.g. favorite = 1). */
  rank?: number;
  /**
   * Optional score overrides (e.g. user rating from context).
   * If omitted, uses `cafe.coffeeScore`, `cafe.workScore`, and `cafe.vibeScore`.
   */
  scores?: { coffee: number; work: number; vibe: number };
  /** Optional tags (e.g. from a saved rating); up to `maxTags` shown. */
  tags?: string[];
  maxTags?: number;
  /** One short line from taste / tags (Home + Search). */
  recommendationReason?: string;
};

export function CompactCafeCard({
  cafe,
  onPress,
  rank,
  scores,
  tags,
  maxTags = 3,
  recommendationReason,
}: CompactCafeCardProps) {
  const coffee = scores?.coffee ?? cafe.coffeeScore;
  const work = scores?.work ?? cafe.workScore;
  const vibe = scores?.vibe ?? cafe.vibeScore;
  const showTags = tags && tags.length > 0;
  const tagSlice = showTags ? tags!.slice(0, maxTags) : [];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${cafe.name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        showTags && styles.cardWithTags,
        pressed && styles.cardPressed,
      ]}
    >
      {rank != null ? (
        <View style={styles.rankBadge} accessibilityElementsHidden>
          <Text style={styles.rankBadgeText}>#{rank}</Text>
        </View>
      ) : null}
      {cafe.imageUrl ? (
        <Image source={{ uri: cafe.imageUrl }} style={styles.thumbnail} resizeMode="cover" />
      ) : (
        <View style={styles.thumbnail} />
      )}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {cafe.name}
        </Text>
        {recommendationReason ? (
          <Text style={styles.recommendationReason} numberOfLines={1}>
            {recommendationReason}
          </Text>
        ) : null}
        <Text style={styles.location} numberOfLines={1}>
          {cafe.neighborhood}
        </Text>
        <Text style={styles.scoresLine}>
          <Text style={styles.scoreWord}>Coffee </Text>
          <Text style={styles.scoreNum}>{coffee.toFixed(1)}</Text>
          <Text style={styles.scorePipe}> | </Text>
          <Text style={styles.scoreWord}>Work </Text>
          <Text style={styles.scoreNum}>{work.toFixed(1)}</Text>
          <Text style={styles.scorePipe}> | </Text>
          <Text style={styles.scoreWord}>Vibe </Text>
          <Text style={styles.scoreNum}>{vibe.toFixed(1)}</Text>
        </Text>
        {showTags ? (
          <View style={styles.tagsRow}>
            {tagSlice.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagChipText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rankBadge: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.roastedBrown,
    letterSpacing: -0.3,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F7F3EE',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EDE3D5',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardWithTags: {
    alignItems: 'flex-start',
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: COLORS.imagePlaceholder,
    borderWidth: 1,
    borderColor: '#E4D9C8',
  },
  body: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  recommendationReason: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
    fontWeight: '500',
  },
  location: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 16,
  },
  scoresLine: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    flexWrap: 'wrap',
  },
  scoreWord: {
    color: COLORS.muted,
    fontWeight: '600',
  },
  scoreNum: {
    color: COLORS.roastedBrown,
    fontWeight: '700',
  },
  scorePipe: {
    color: '#C9BEAF',
    fontWeight: '500',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F0E8DC',
    borderWidth: 1,
    borderColor: '#E4D9C8',
  },
  tagChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#5E5348',
  },
});

