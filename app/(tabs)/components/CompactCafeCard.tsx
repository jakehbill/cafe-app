import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Cafe } from '@/data/cafes';

import { COLORS } from './theme';

export type CompactCafeCardProps = {
  cafe: Cafe;
  onPress: () => void;
  /**
   * Optional score overrides (e.g. user rating from context).
   * If omitted, uses `cafe.coffeeScore`, `cafe.workScore`, and `cafe.vibeScore`.
   */
  scores?: { coffee: number; work: number; vibe: number };
};

export function CompactCafeCard({ cafe, onPress, scores }: CompactCafeCardProps) {
  const coffee = scores?.coffee ?? cafe.coffeeScore;
  const work = scores?.work ?? cafe.workScore;
  const vibe = scores?.vibe ?? cafe.vibeScore;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${cafe.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.thumbnail} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {cafe.name}
        </Text>
        <Text style={styles.location} numberOfLines={1}>
          {cafe.neighborhood}
        </Text>
        <Text style={styles.scoresLine}>
          <Text style={styles.scoreWord}>Coffee </Text>
          <Text style={styles.scoreNum}>{coffee.toFixed(1)}</Text>
          <Text style={styles.scorePipe}> | </Text>
          <Text style={styles.scoreWord}>Work </Text>
          <Text style={styles.scoreNum}>{work.toFixed(1)}</Text>
          <Text style={styles.scorePipe}> | </Text>
          <Text style={styles.scoreWord}>Vibe </Text>
          <Text style={styles.scoreNum}>{vibe.toFixed(1)}</Text>
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F7F3EE',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EDE3D5',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: COLORS.imagePlaceholder,
    borderWidth: 1,
    borderColor: '#E4D9C8',
  },
  body: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  location: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 16,
  },
  scoresLine: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    flexWrap: 'wrap',
  },
  scoreWord: {
    color: COLORS.muted,
    fontWeight: '600',
  },
  scoreNum: {
    color: COLORS.roastedBrown,
    fontWeight: '700',
  },
  scorePipe: {
    color: '#C9BEAF',
    fontWeight: '500',
  },
});
