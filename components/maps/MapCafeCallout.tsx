import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/components/theme';

export type MapCafeCalloutProps = {
  cafeName: string;
  /** From `formatPublicCoffeeOutOf5` — numeric string or em dash when absent. */
  scoreDisplay: string;
};

/**
 * Minimal callout body for map markers: name, numeric score only, subtle forward affordance.
 */
export function MapCafeCallout({ cafeName, scoreDisplay }: MapCafeCalloutProps) {
  const hasScore = scoreDisplay !== '—';

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {cafeName}
          </Text>
          <Text style={hasScore ? styles.score : styles.scoreEmpty}>{hasScore ? scoreDisplay : '—'}</Text>
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
    gap: 3,
    paddingRight: 2,
  },
  title: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  score: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
  },
  scoreEmpty: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.muted,
  },
  arrow: {
    marginBottom: 1,
    opacity: 0.65,
  },
});
