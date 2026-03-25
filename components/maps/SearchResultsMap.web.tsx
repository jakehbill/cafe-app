import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Cafe } from '@/data/cafes';
import { COLORS } from '@/components/theme';

/**
 * Web fallback for Search map view.
 * `react-native-maps` is native-only, so web must NOT import it.
 */
export default function SearchResultsMap(_props: {
  results: Cafe[];
  initialRegion: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  onPressCafe: (cafeId: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Map not available on web yet</Text>
      <Text style={styles.subtitle}>Use the list view to browse cafes.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: '#F7F3EE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
    textAlign: 'center',
  },
});

