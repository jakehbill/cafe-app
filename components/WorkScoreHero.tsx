import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';
import type { Cafe } from '@/data/cafes';
import {
  formatPublicCoffeeForCafe,
  workScoreQualitativeLabelForCafe,
} from '@/lib/publicCoffeeDisplay';

type Props = {
  cafe: Pick<Cafe, 'publicCoffeeScore' | 'coffeeRatingCount'>;
  /** `onDark` for home hero overlays. */
  tone?: 'default' | 'onDark';
  /** `hero` = home/detail; `card` = compact list rows. */
  size?: 'hero' | 'card';
  style?: StyleProp<ViewStyle>;
};

/**
 * Work Score figure + optional qualitative band inline: `9.4 · Excellent`.
 * Number stays bold; label is lighter hairline secondary text, vertically centered with the score.
 */
export function WorkScoreHero({ cafe, tone = 'default', size = 'card', style }: Props) {
  const score = formatPublicCoffeeForCafe(cafe).trim() || '—';
  const qualitative = score === '—' ? null : workScoreQualitativeLabelForCafe(cafe);
  const onDark = tone === 'onDark';
  const isHero = size === 'hero';

  const a11y =
    score === '—'
      ? 'No public Work Score'
      : qualitative
        ? `Work Score ${score} out of 10, ${qualitative}`
        : `Work Score ${score} out of 10`;

  return (
    <View
      accessibilityLabel={a11y}
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
      {qualitative ? (
        <>
          <Text
            style={[
              isHero ? styles.dotHero : styles.dotCard,
              onDark && styles.metaOnDark,
            ]}
          >
            ·
          </Text>
          <Text
            style={[
              isHero ? styles.labelHero : styles.labelCard,
              onDark && styles.metaOnDark,
            ]}
            numberOfLines={1}
          >
            {qualitative}
          </Text>
        </>
      ) : null}
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
    fontFamily: FONTS.sans.bold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.35,
    color: COLORS.text,
  },
  scoreOnDark: {
    color: 'rgba(250,248,245,0.98)',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  dotHero: {
    marginHorizontal: 6,
    fontFamily: FONTS.sans.regular,
    fontSize: 16,
    lineHeight: 16,
    color: 'rgba(92,83,72,0.4)',
  },
  dotCard: {
    marginHorizontal: 5,
    fontFamily: FONTS.sans.regular,
    fontSize: 13,
    lineHeight: 13,
    color: 'rgba(92,83,72,0.4)',
  },
  /** Hairline secondary — regular Inter, quieter color + slight tracking (no light weight loaded). */
  labelHero: {
    fontFamily: FONTS.sans.regular,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.35,
    color: 'rgba(92,83,72,0.62)',
  },
  labelCard: {
    fontFamily: FONTS.sans.regular,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.3,
    color: 'rgba(92,83,72,0.62)',
  },
  metaOnDark: {
    color: 'rgba(250,248,245,0.98)',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
});
