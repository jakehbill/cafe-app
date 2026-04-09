import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CoffeeScoreBadge } from '@/components/CoffeeScoreBadge';
import { COLORS } from '@/components/theme';

export type MapCafeCalloutProps = {
  cafeName: string;
  /** From `formatPublicCoffeeOutOf5` — numeric string or em dash when absent. */
  scoreDisplay: string;
};

/**
 * Minimal callout body for map markers: name, score badge, subtle forward affordance.
 */
export function MapCafeCallout({ cafeName, scoreDisplay }: MapCafeCalloutProps) {
  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {cafeName}
          </Text>
          <CoffeeScoreBadge scoreLabel={scoreDisplay} size="small" />
        </View>
        <Ionicons
          name="chevron-forward"
          size={15}
          color={COLORS.muted}
          style={styles.arrow}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minWidth: 160,
    maxWidth: 220,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6DCCB',
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingRight: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
  },
  textBlock: {
    flex: 1,
    gap: 6,
    paddingRight: 2,
  },
  title: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  arrow: {
    marginBottom: 1,
    opacity: 0.65,
  },
});
