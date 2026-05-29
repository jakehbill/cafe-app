import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS } from '@/components/theme';

const SKELETON_FILL = COLORS.imagePlaceholder;
const SKELETON_LINE = '#e0dbd3';

const COMPACT_THUMB = 72;

function SkeletonBlock({
  style,
  rounded = 6,
}: {
  style?: StyleProp<ViewStyle>;
  rounded?: number;
}) {
  return <View style={[{ backgroundColor: SKELETON_FILL, borderRadius: rounded }, style]} />;
}

function SkeletonLine({
  width,
  height = 12,
  style,
}: {
  width: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SkeletonBlock
      style={[{ width, height, backgroundColor: SKELETON_LINE, borderRadius: height / 2 }, style]}
      rounded={height / 2}
    />
  );
}

/** Matches `CompactCafeCard` list row layout. */
export function CompactCafeCardSkeleton() {
  return (
    <View style={compactStyles.card} accessibilityLabel="Loading café">
      <SkeletonBlock style={compactStyles.thumb} rounded={14} />
      <View style={compactStyles.body}>
        <SkeletonLine width="72%" height={15} />
        <SkeletonLine width="48%" height={12} style={compactStyles.lineGap} />
        <View style={compactStyles.tagRow}>
          <SkeletonBlock style={compactStyles.tag} rounded={999} />
          <SkeletonBlock style={[compactStyles.tag, compactStyles.tagWide]} rounded={999} />
        </View>
      </View>
      <SkeletonBlock style={compactStyles.bookmark} rounded={14} />
    </View>
  );
}

export function SearchResultListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <CompactCafeCardSkeleton key={`search-skeleton-${i}`} />
      ))}
    </>
  );
}

/** Matches home carousel `HomeCafeCard` (hero + body). */
export function HomeCafeCardSkeleton() {
  return (
    <View style={homeStyles.card} accessibilityLabel="Loading café">
      <SkeletonBlock style={homeStyles.hero} rounded={0} />
      <View style={homeStyles.heroOverlay}>
        <SkeletonLine width="78%" height={18} style={homeStyles.heroLine} />
        <SkeletonLine width="52%" height={12} />
      </View>
      <View style={homeStyles.body}>
        <View style={homeStyles.tagRow}>
          <SkeletonBlock style={homeStyles.tag} rounded={999} />
          <SkeletonBlock style={homeStyles.tag} rounded={999} />
          <SkeletonBlock style={homeStyles.tagNarrow} rounded={999} />
        </View>
        <SkeletonLine width="100%" height={12} />
        <SkeletonLine width="88%" height={12} style={homeStyles.lineGap} />
        <SkeletonLine width="64%" height={12} style={homeStyles.lineGap} />
      </View>
    </View>
  );
}

export function HomeCafeCarouselSkeleton({
  cardWidth,
  gap,
  count = 3,
  rowStyle,
  contentContainerStyle,
}: {
  cardWidth: number;
  gap: number;
  count?: number;
  rowStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      style={rowStyle}
      contentContainerStyle={contentContainerStyle}
    >
      {Array.from({ length: count }, (_, index) => (
        <View
          key={`home-carousel-skeleton-${index}`}
          style={{
            width: cardWidth,
            marginRight: index === count - 1 ? 0 : gap,
          }}
        >
          <HomeCafeCardSkeleton />
        </View>
      ))}
    </ScrollView>
  );
}

const compactStyles = StyleSheet.create({
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
    gap: 14,
    position: 'relative',
  },
  thumb: {
    width: COMPACT_THUMB,
    height: COMPACT_THUMB,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  lineGap: {
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  tag: {
    width: 56,
    height: 22,
  },
  tagWide: {
    width: 72,
  },
  bookmark: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 28,
    height: 28,
    opacity: 0.55,
  },
});

const homeStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  hero: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  heroOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    gap: 8,
  },
  heroLine: {
    backgroundColor: 'rgba(224, 219, 211, 0.92)',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 10,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    width: 64,
    height: 24,
  },
  tagNarrow: {
    width: 48,
    height: 24,
  },
  lineGap: {
    marginTop: 0,
  },
});
