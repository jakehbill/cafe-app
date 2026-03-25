import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/components/theme';

/**
 * Default fallback MapView.
 *
 * The route (`app/(tabs)/map.tsx`) imports this file, which must stay web-safe.
 * Native platforms will use `MapView.native.tsx` automatically.
 */
export default function MapViewFallback() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrap}>
        <Text style={styles.title}>Map coming soon on web</Text>
        <Text style={styles.subtitle}>For now, use the Search tab to browse cafes.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  wrap: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    marginTop: 12,
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
    fontSize: 16,
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

