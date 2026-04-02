import React, { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Cafe } from '@/data/cafes';
import { formatTagLabel } from '@/lib/cafeTags';
import { formatPublicCoffeeOutOf5 } from '@/lib/publicCoffeeDisplay';
import { getTopCafeTags } from '@/lib/supabase';

import { COLORS, FONTS, SHADOWS } from '@/components/theme';

export type CompactCafeCardProps = {
  cafe: Cafe;
  onPress: () => void;
  /** 1-based rank label (e.g. favorite = 1). */
  rank?: number;
  /** Optional tags (e.g. from a saved rating); up to `maxTags` shown. */
  tags?: string[];
  maxTags?: number;
  /** One short line from taste / tags (Home + Search). */
  recommendationReason?: string;
  /**
   * Rendered inside the white card row (e.g. visited reorder arrows).
   * Not part of the main press target — use `TouchableOpacity` children.
   */
  trailing?: ReactNode;
  /**
   * When false, the tag row under the coffee score is omitted and tag fetch is skipped.
   * Use on Visited only; default true everywhere else.
   */
  showTagsUI?: boolean;
};

export function CompactCafeCard({
  cafe,
  onPress,
  rank,
  tags,
  maxTags = 3,
  recommendationReason,
  trailing,
  showTagsUI = true,
}: CompactCafeCardProps) {
  const publicCoffeeLabel = formatPublicCoffeeOutOf5(cafe.publicCoffeeScore);
  /** Visited list (with trailing): when tags are shown, cap count and lighter styling. */
  const effectiveMaxTags = trailing != null ? Math.min(maxTags, 2) : maxTags;
  const [topTags, setTopTags] = useState<string[]>([]);
  const tagSlice = useMemo(() => {
    if (!showTagsUI) return [];
    if (tags && tags.length > 0) return tags.slice(0, effectiveMaxTags);
    return topTags.slice(0, effectiveMaxTags);
  }, [showTagsUI, tags, topTags, effectiveMaxTags]);
  const showTagRow = showTagsUI && tagSlice.length > 0;
  const tagsSubtle = trailing != null && showTagsUI;

  useEffect(() => {
    if (!showTagsUI) return;
    let cancelled = false;
    if (tags && tags.length > 0) {
      setTopTags([]);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const fetched = await getTopCafeTags(cafe.id, effectiveMaxTags);
      if (!cancelled) setTopTags(fetched);
    })();
    return () => {
      cancelled = true;
    };
  }, [cafe.id, effectiveMaxTags, tags, showTagsUI]);

  return (
    <View style={styles.card}>
      {rank != null ? (
        <View style={styles.rankBadge} accessibilityElementsHidden>
          <Text style={styles.rankBadgeText}>#{rank}</Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${cafe.name}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.cardMainPressable,
          showTagRow && styles.cardMainPressableAlignStart,
          pressed && styles.cardPressed,
        ]}
      >
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
            <Text
              style={styles.publicCoffeeText}
              accessibilityLabel={
                publicCoffeeLabel === '—'
                  ? 'No public coffee score'
                  : `Coffee score ${publicCoffeeLabel} out of 5`
              }
            >
              {publicCoffeeLabel}
            </Text>
          </View>
          {showTagRow ? (
            <View style={[styles.tagsRow, tagsSubtle && styles.tagsRowSubtle]}>
              {tagSlice.map((tag) => (
                <View key={tag} style={[styles.tagChip, tagsSubtle && styles.tagChipSubtle]}>
                  <Text style={[styles.tagChipText, tagsSubtle && styles.tagChipTextSubtle]}>
                    {formatTagLabel(tag)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>
      {trailing != null ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rankBadge: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingRight: 10,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.card,
    gap: 8,
  },
  cardMainPressable: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardMainPressableAlignStart: {
    alignItems: 'flex-start',
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  trailing: {
    flexShrink: 0,
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingLeft: 2,
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
    flexShrink: 1,
    minWidth: 0,
  },
  publicCoffeeText: {
    fontSize: 13,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
    letterSpacing: -0.2,
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
  tagsRowSubtle: {
    gap: 4,
    marginTop: 4,
    maxWidth: '100%',
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.chipBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tagChipSubtle: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'transparent',
    borderColor: COLORS.cardBorder,
  },
  tagChipText: {
    fontSize: 10,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
  },
  tagChipTextSubtle: {
    fontSize: 9,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
    opacity: 0.88,
  },
});

