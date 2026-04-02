import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Cafe } from '@/data/cafes';
import { CoffeeCupRating } from '@/components/CoffeeCupRating';
import { formatTagLabel } from '@/lib/cafeTags';
import { getTopCafeTags } from '@/lib/supabase';

import { COLORS, FONTS, SHADOWS } from '@/components/theme';

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
  const [topTags, setTopTags] = useState<string[]>([]);
  const tagSlice = useMemo(() => {
    if (tags && tags.length > 0) return tags.slice(0, maxTags);
    return topTags.slice(0, maxTags);
  }, [tags, topTags, maxTags]);
  const showTags = tagSlice.length > 0;

  useEffect(() => {
    let cancelled = false;
    if (tags && tags.length > 0) {
      setTopTags([]);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const fetched = await getTopCafeTags(cafe.id, maxTags);
      if (!cancelled) setTopTags(fetched);
    })();
    return () => {
      cancelled = true;
    };
  }, [cafe.id, maxTags, tags]);

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
        <View style={styles.scoresLine}>
          <CoffeeCupRating value={coffee} size={14} />
        </View>
        {showTags ? (
          <View style={styles.tagsRow}>
            {tagSlice.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagChipText}>{formatTagLabel(tag)}</Text>
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
    fontFamily: FONTS.sans.bold,
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.card,
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
    borderColor: COLORS.cardBorder,
  },
  body: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  name: {
    fontSize: 17,
    fontFamily: FONTS.display.semibold,
    color: COLORS.text,
    letterSpacing: -0.25,
    lineHeight: 22,
  },
  recommendationReason: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
    fontFamily: FONTS.sans.medium,
  },
  location: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 16,
    fontFamily: FONTS.sans.regular,
  },
  scoresLine: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreWord: {
    color: COLORS.muted,
    fontFamily: FONTS.sans.semibold,
    fontSize: 12,
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
    backgroundColor: COLORS.chipBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tagChipText: {
    fontSize: 10,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
  },
});

