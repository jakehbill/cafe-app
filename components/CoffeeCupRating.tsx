import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

type CoffeeCupRatingProps = {
  value: number;
  max?: number;
  onChange?: (next: number) => void;
  size?: number;
};

function normalizeToFive(raw: number): number {
  const n = Number.isFinite(raw) ? raw : 0;
  const base = n > 5 ? n / 2 : n;
  return Math.min(5, Math.max(0, base));
}

export function CoffeeCupRating({
  value,
  max = 5,
  onChange,
  size = 18,
}: CoffeeCupRatingProps) {
  const normalized = normalizeToFive(value);
  const filled = Math.round(normalized);
  const interactive = typeof onChange === 'function';

  return (
    <View style={[styles.row, interactive && styles.rowInteractive]}>
      <View style={styles.cupsRow}>
        {Array.from({ length: max }, (_, i) => {
          const cupNumber = i + 1;
          const isFilled = cupNumber <= filled;
          const organicTransform =
            i % 2 === 0
              ? [{ rotate: '-4deg' }, { translateY: i % 3 === 0 ? -0.5 : 0.5 }]
              : [{ rotate: '3deg' }, { translateY: i % 3 === 0 ? 0.5 : -0.5 }];
          return (
            <Pressable
              key={cupNumber}
              onPress={onChange ? () => onChange(cupNumber) : undefined}
              disabled={!interactive}
              accessibilityRole={interactive ? 'button' : undefined}
              accessibilityLabel={
                interactive
                  ? `${cupNumber} cup${cupNumber === 1 ? '' : 's'}`
                  : undefined
              }
              accessibilityState={
                interactive
                  ? { selected: isFilled }
                  : undefined
              }
              style={({ pressed, hovered }) => [
                styles.cupWrap,
                isFilled ? styles.cupWrapSelected : styles.cupWrapUnselected,
                interactive && hovered && styles.cupHover,
                interactive && pressed && styles.cupPressed,
              ]}
            >
              <MaterialCommunityIcons
                name={isFilled ? 'coffee' : 'coffee-outline'}
                size={size}
                style={[styles.cupIcon, { transform: organicTransform }]}
                color="#111111"
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowInteractive: {
    justifyContent: 'center',
    width: '100%',
  },
  cupsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cupWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#B8B1A7',
    backgroundColor: '#FFFFFF',
  },
  cupWrapSelected: {
    borderColor: '#111111',
    backgroundColor: '#F2F2F2',
  },
  cupWrapUnselected: {
    borderColor: '#B8B1A7',
    backgroundColor: '#FFFFFF',
    opacity: 0.5,
  },
  cupHover: {
    borderColor: '#111111',
    backgroundColor: '#F7F7F7',
    opacity: 0.85,
  },
  cupPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  cupIcon: {
    marginTop: 1,
  },
});
