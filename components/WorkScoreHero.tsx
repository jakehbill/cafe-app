import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';
import type { Cafe } from '@/data/cafes';
import {
  cafeHasPublicWorkScore,
  formatPublicCoffeeForCafe,
} from '@/lib/publicCoffeeDisplay';

type Props = {
  cafe: Pick<Cafe, 'publicCoffeeScore' | 'coffeeRatingCount'>;
  /** `onDark` for home hero overlays. */
  tone?: 'default' | 'onDark';
  /** `hero` = detail; `card` kept for API compat — prefer `WorkScoreMetaRow` on cards. */
  size?: 'hero' | 'card';
  style?: StyleProp<ViewStyle>;
};

/**
 * Numeric Work Score only (no qualitative labels).
 * Prefer {@link WorkScoreMetaRow} on list/home cards.
 */
export function WorkScoreHero({ cafe, tone = 'default', size = 'card', style }: Props) {
  const hasScore = cafeHasPublicWorkScore(cafe);
  const score = hasScore ? formatPublicCoffeeForCafe(cafe).trim() : '';
  const onDark = tone === 'onDark';
  const isHero = size === 'hero';

  if (!hasScore || !score) {
    return (
      <View
        accessibilityLabel="No Work Score yet"
        accessibilityRole="text"
        style={[styles.wrap, style]}
      >
        <Text
          style={[
            isHero ? styles.emptyHero : styles.emptyCard,
            onDark && styles.emptyOnDark,
          ]}
          numberOfLines={1}
        >
          No Work Score yet
        </Text>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={`Work Score ${score} out of 10`}
      accessibilityRole="text"
      style={[styles.wrap, style]}
    >
      <Text
        style={[
          isHero ? styles.scoreHero : styles.scoreCard,
          onDark && styles.scoreOnDark,
        ]}
        numberOfLines={1}
      >
        {score}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreHero: {
    fontFamily: FONTS.sans.bold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.45,
    color: COLORS.text,
  },
  scoreCard: {
    fontFamily: FONTS.sans.regular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.05,
    color: COLORS.muted,
  },
  scoreOnDark: {
    color: 'rgba(250,248,245,0.98)',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  emptyHero: {
    fontFamily: FONTS.sans.medium,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.15,
    color: COLORS.muted,
  },
  emptyCard: {
    fontFamily: FONTS.sans.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.1,
    color: COLORS.muted,
  },
  emptyOnDark: {
    color: 'rgba(250,248,245,0.72)',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
