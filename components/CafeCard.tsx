import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { CoffeeScoreBadge } from '@/components/CoffeeScoreBadge';
import { COLORS, FONTS, SHADOWS } from '@/components/theme';
import { formatPublicCoffeeOutOf5 } from '@/lib/publicCoffeeDisplay';

type CafeCardProps = {
  cafeName?: string;
  neighborhood?: string;
  /** Canonical public coffee from `cafe_public_scores` (merged on `Cafe.publicCoffeeScore`). */
  publicCoffeeScore?: number | null;
  tags?: string[];
  summary?: string;
  onPress?: () => void;
};

export function CafeCard({
  cafeName = 'Moss & Co. Coffee',
  neighborhood = 'Downtown • Elm Street',
  publicCoffeeScore = 4.3,
  tags = ['Specialty', 'Fast Wi‑Fi', 'Quiet corners'],
  summary = 'Cozy light-filled seating with consistently great pour-overs.',
  onPress,
}: CafeCardProps) {
  const coffeeLabel = formatPublicCoffeeOutOf5(publicCoffeeScore);

  return (
    <TouchableOpacity activeOpacity={0.92} style={styles.featuredCard} onPress={onPress}>
      <View style={styles.imagePlaceholder} />

      <View style={styles.cardBody}>
        <View style={styles.headerBlock}>
          <Text style={styles.cafeName}>{cafeName}</Text>
          <Text style={styles.neighborhoodText}>{neighborhood}</Text>
        </View>

        <CoffeeScoreBadge scoreLabel={coffeeLabel} size="medium" />

        <View style={styles.tagsRow}>
          {tags.slice(0, 5).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryDivider} />
        <Text numberOfLines={2} style={styles.summaryText}>
          {summary}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  featuredCard: {
    marginTop: 6,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.none,
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: COLORS.imagePlaceholder,
  },
  cardBody: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 12,
  },
  headerBlock: {
    gap: 4,
  },
  cafeName: {
    fontSize: 22,
    fontFamily: FONTS.display.semibold,
    color: COLORS.text,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  neighborhoodText: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
    fontFamily: FONTS.sans.regular,
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.tagBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tagText: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: FONTS.sans.medium,
    letterSpacing: -0.05,
  },
  summaryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    marginTop: 2,
  },

  summaryText: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: FONTS.sans.regular,
  },
});
