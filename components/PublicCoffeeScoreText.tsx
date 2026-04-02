import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Cafe } from '@/data/cafes';
import { COLORS, FONTS } from '@/components/theme';
import { formatPublicCoffeeOutOf5 } from '@/lib/publicCoffeeDisplay';

type Props = {
  cafe: Cafe;
  /** `list` — calmer, smaller numeric for dense rows (Search / Saved / lists). */
  variant?: 'default' | 'list';
};

/**
 * Single-line public coffee score (`cafe.publicCoffeeScore` ← `public.cafe_public_scores`).
 * Used by CompactCafeCard and Home featured cards so Home and Search stay identical.
 */
export function PublicCoffeeScoreText({ cafe, variant = 'default' }: Props) {
  const publicCoffeeLabel = formatPublicCoffeeOutOf5(cafe.publicCoffeeScore);
  const textStyle = variant === 'list' ? styles.textList : styles.text;

  return (
    <View style={[styles.row, variant === 'list' && styles.rowList]}>
      <Text
        style={textStyle}
        accessibilityLabel={
          publicCoffeeLabel === '—'
            ? 'No public coffee score'
            : `Coffee score ${publicCoffeeLabel} out of 5`
        }
      >
        {publicCoffeeLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: 18,
  },
  rowList: {
    alignSelf: 'flex-end',
    minHeight: 16,
  },
  text: {
    fontSize: 13,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
    letterSpacing: -0.2,
  },
  textList: {
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    letterSpacing: 0.15,
    opacity: 0.92,
  },
});
