import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Cafe } from '@/data/cafes';
import { COLORS, FONTS } from '@/components/theme';
import { formatPublicCoffeeOutOf5 } from '@/lib/publicCoffeeDisplay';

type Props = {
  cafe: Cafe;
};

/**
 * Single-line public coffee score (`cafe.publicCoffeeScore` ← `public.cafe_public_scores`).
 * Used by CompactCafeCard and Home featured cards so Home and Search stay identical.
 */
export function PublicCoffeeScoreText({ cafe }: Props) {
  const publicCoffeeLabel = formatPublicCoffeeOutOf5(cafe.publicCoffeeScore);

  return (
    <View style={styles.row}>
      <Text
        style={styles.text}
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
  text: {
    fontSize: 13,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
    letterSpacing: -0.2,
  },
});
