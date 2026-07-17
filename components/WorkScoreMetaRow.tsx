import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';
import type { Cafe } from '@/data/cafes';
import { cafeHasPublicWorkScore, formatPublicCoffeeForCafe } from '@/lib/publicCoffeeDisplay';

type Props = {
  cafe: Pick<Cafe, 'publicCoffeeScore' | 'coffeeRatingCount'>;
  /** Area / neighborhood (optional). */
  area?: string | null;
  /** Distance label e.g. "0.2 mi" (optional). */
  distance?: string | null;
  /** Dark hero overlays on homepage cards. */
  tone?: 'default' | 'onDark';
  style?: StyleProp<TextStyle>;
};

/**
 * Compact card metadata: `★ 9.4 • Soho` or `★ New • Soho`.
 * Numeric Work Score only — no qualitative labels.
 */
export function WorkScoreMetaRow({
  cafe,
  area,
  distance,
  tone = 'default',
  style,
}: Props) {
  const hasScore = cafeHasPublicWorkScore(cafe);
  const scoreText = hasScore ? formatPublicCoffeeForCafe(cafe).trim() : 'New';
  const areaText = String(area ?? '').trim();
  const distanceText = String(distance ?? '').trim();
  const onDark = tone === 'onDark';

  const a11yParts = [
    hasScore ? `Work Score ${scoreText} out of 10` : 'New space, no Work Score yet',
    areaText || null,
    distanceText || null,
  ].filter(Boolean);

  return (
    <Text
      accessibilityLabel={a11yParts.join(', ')}
      accessibilityRole="text"
      style={[styles.row, onDark && styles.rowOnDark, style]}
      numberOfLines={1}
    >
      <Text style={[styles.star, onDark && styles.starOnDark]}>★</Text>
      <Text style={[styles.score, onDark && styles.scoreOnDark]}> {scoreText}</Text>
      {areaText ? (
        <>
          <Text style={[styles.dot, onDark && styles.dotOnDark]}> {'\u2022'} </Text>
          <Text style={[styles.meta, onDark && styles.metaOnDark]}>{areaText}</Text>
        </>
      ) : null}
      {distanceText ? (
        <>
          <Text style={[styles.dot, onDark && styles.dotOnDark]}> {'\u2022'} </Text>
          <Text style={[styles.meta, onDark && styles.metaOnDark]}>{distanceText}</Text>
        </>
      ) : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    letterSpacing: -0.05,
    opacity: 0.88,
  },
  rowOnDark: {
    color: 'rgba(250,248,245,0.82)',
    opacity: 1,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  star: {
    fontSize: 10,
    lineHeight: 16,
    fontFamily: FONTS.sans.regular,
    color: COLORS.text,
    opacity: 1,
  },
  starOnDark: {
    color: '#FFFFFF',
  },
  score: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.regular,
    color: COLORS.text,
    letterSpacing: -0.05,
  },
  scoreOnDark: {
    color: '#FFFFFF',
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    letterSpacing: -0.05,
  },
  metaOnDark: {
    color: 'rgba(250,248,245,0.82)',
  },
  dot: {
    color: COLORS.muted,
    opacity: 0.7,
  },
  dotOnDark: {
    color: 'rgba(250,248,245,0.55)',
    opacity: 1,
  },
});
