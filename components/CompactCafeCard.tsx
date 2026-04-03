import React, { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';

import { getPrimaryPhotoUrl, type Cafe } from '@/data/cafes';
import { PublicCoffeeScoreText } from '@/components/PublicCoffeeScoreText';
import { TagWithOptionalIcon } from '@/components/TagWithOptionalIcon';
import { getTopCafeTags } from '@/lib/supabase';

import { COLORS, FONTS, SHADOWS } from '@/components/theme';

const THUMB = 72;

/** Bottom scrim on list thumbnails so the coffee score badge stays readable on any photo. */
function CompactThumbnailBottomFade({ cafeId }: { cafeId: string }) {
  const gid = `ct_${cafeId.replace(/[^a-zA-Z0-9_]/g, '_')}_bf`;
  const w = THUMB;
  const h = 38;
  return (
    <Svg width={w} height={h} pointerEvents="none" style={styles.thumbnailBottomFade}>
      <Defs>
        <SvgLinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0a0a0a" stopOpacity="0" />
          <Stop offset="0.55" stopColor="#0a0a0a" stopOpacity="0.22" />
          <Stop offset="1" stopColor="#0a0a0a" stopOpacity="0.5" />
        </SvgLinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill={`url(#${gid})`} />
    </Svg>
  );
}

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
  /**
   * Where the public coffee score appears (compact list cards only).
   * `bottomRight` (default) — on the thumbnail; Saved, Visited, etc.
   * `cardTopRight` — top-right of the full card (Search only); not on the image.
   */
  scorePosition?: 'bottomRight' | 'cardTopRight';
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
  scorePosition = 'bottomRight',
}: CompactCafeCardProps) {
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
  const primaryPhoto = getPrimaryPhotoUrl(cafe);
  const scoreOnCardTopRight = scorePosition === 'cardTopRight';

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
    <View style={[styles.card, scoreOnCardTopRight && styles.cardWithCornerScore]}>
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
        <View style={styles.thumbnailWrap}>
          {primaryPhoto ? (
            <Image source={{ uri: primaryPhoto }} style={styles.thumbnailImage} resizeMode="cover" />
          ) : (
            <View style={styles.thumbnailImage} />
          )}
          {!scoreOnCardTopRight ? (
            <>
              <CompactThumbnailBottomFade cafeId={cafe.id} />
              <View style={styles.thumbnailScoreWrap} pointerEvents="none">
                <PublicCoffeeScoreText cafe={cafe} variant="overlay" />
              </View>
            </>
          ) : null}
        </View>
        <View style={[styles.body, scoreOnCardTopRight && styles.bodyWithCardCornerScore]}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={2}>
              {cafe.name}
            </Text>
          </View>
          {recommendationReason ? (
            <Text style={styles.recommendationReason} numberOfLines={1}>
              {recommendationReason}
            </Text>
          ) : null}
          <Text style={styles.location} numberOfLines={1}>
            {cafe.neighborhood}
          </Text>
          {showTagRow ? (
            <View style={[styles.tagsRow, tagsSubtle && styles.tagsRowSubtle]}>
              {tagSlice.map((tag) => (
                <View key={tag} style={[styles.tagChip, tagsSubtle && styles.tagChipSubtle]}>
                  <TagWithOptionalIcon
                    tag={tag}
                    iconSize={tagsSubtle ? 11 : 12}
                    color={COLORS.muted}
                    textStyle={[styles.tagChipText, tagsSubtle && styles.tagChipTextSubtle]}
                    gap={4}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>
      {trailing != null ? <View style={styles.trailing}>{trailing}</View> : null}
      {scoreOnCardTopRight ? (
        <View style={styles.cardScoreWrapTopRight} pointerEvents="none">
          <PublicCoffeeScoreText cafe={cafe} variant="overlaySearch" />
        </View>
      ) : null}
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
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingRight: 12,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.none,
    gap: 12,
  },
  /** Anchor absolute score badge; keeps rounded rect clipping predictable. */
  cardWithCornerScore: {
    position: 'relative',
  },
  cardMainPressable: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardMainPressableAlignStart: {
    alignItems: 'flex-start',
  },
  cardPressed: {
    opacity: 0.94,
  },
  trailing: {
    flexShrink: 0,
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingLeft: 2,
  },
  thumbnailWrap: {
    width: THUMB,
    height: THUMB,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: COLORS.imagePlaceholder,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  thumbnailImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  thumbnailBottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  thumbnailScoreWrap: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    zIndex: 2,
  },
  /** Search: score on card chrome, above row content; inset within 12–16px band. */
  cardScoreWrapTopRight: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 4,
  },
  body: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  /** Reserve space so the title line does not sit under the corner badge. */
  bodyWithCardCornerScore: {
    paddingRight: 52,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    fontFamily: FONTS.display.semibold,
    color: COLORS.text,
    letterSpacing: -0.35,
    lineHeight: 24,
  },
  recommendationReason: {
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.roastedBrown,
    fontFamily: FONTS.sans.regular,
    opacity: 0.9,
    fontStyle: 'italic',
  },
  location: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 16,
    fontFamily: FONTS.sans.regular,
    letterSpacing: -0.05,
    opacity: 0.88,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tagsRowSubtle: {
    gap: 6,
    marginTop: 3,
    maxWidth: '100%',
  },
  tagChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.tagBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagChipSubtle: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'transparent',
    borderColor: COLORS.cardBorder,
  },
  tagChipText: {
    fontSize: 11,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
    letterSpacing: -0.05,
  },
  tagChipTextSubtle: {
    fontSize: 10,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    opacity: 0.85,
  },
});

