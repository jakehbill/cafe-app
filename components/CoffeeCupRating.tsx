import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';

type CoffeeCupRatingProps = {
  value: number;
  max?: number;
  onChange?: (next: number) => void;
  size?: number;
  /** Read-only: show a small number next to the bar (default true). */
  showNumeric?: boolean;
};

function normalizeToFive(raw: number): number {
  const n = Number.isFinite(raw) ? raw : 0;
  const base = n > 5 ? n / 2 : n;
  return Math.min(5, Math.max(0, base));
}

function formatRatingLabel(n: number): string {
  const r = Math.round(n * 10) / 10;
  return r % 1 === 0 ? String(r) : r.toFixed(1);
}

export function CoffeeCupRating({
  value,
  max = 5,
  onChange,
  size = 18,
  showNumeric = true,
}: CoffeeCupRatingProps) {
  const normalized = normalizeToFive(value);
  const filled = Math.round(normalized);
  const interactive = typeof onChange === 'function';

  /** Tighter wraps + gap for small sizes so a row of 5 fits on narrow screens. */
  const wrapSize = Math.min(34, Math.max(20, Math.round(size + 10)));
  const gapBetween = size <= 14 ? 2 : size <= 17 ? 4 : 6;

  if (!interactive) {
    const pct = max > 0 ? Math.min(100, (normalized / max) * 100) : 0;
    const barHeight = Math.max(3, Math.round(size * 0.22));
    const labelSize = Math.max(10, Math.min(13, Math.round(size * 0.72)));

    return (
      <View
        style={[styles.row, styles.rowDisplay]}
        accessibilityRole="progressbar"
        accessibilityLabel={`Work Score ${formatRatingLabel(normalized)} out of ${max}`}
        accessibilityValue={{ min: 0, max, now: normalized }}
      >
        <View style={[styles.barTrack, { height: barHeight }]}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
        {showNumeric ? (
          <Text style={[styles.barNumeric, { fontSize: labelSize }]}>
            {formatRatingLabel(normalized)}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.row, interactive && styles.rowInteractive]}>
      <View style={[styles.cupsRow, { gap: gapBetween }]}>
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
                { width: wrapSize, height: wrapSize },
                isFilled ? styles.cupWrapSelected : styles.cupWrapUnselected,
                interactive && hovered && styles.cupHover,
                interactive && pressed && styles.cupPressed,
              ]}
            >
              <MaterialCommunityIcons
                name={isFilled ? 'coffee' : 'coffee-outline'}
                size={size}
                style={[styles.cupIcon, { transform: organicTransform }]}
                color={isFilled ? COLORS.accent : COLORS.muted}
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
  rowDisplay: {
    minWidth: 0,
    width: '100%',
    gap: 8,
  },
  barTrack: {
    flex: 1,
    minWidth: 48,
    borderRadius: 999,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.accent,
    opacity: 0.88,
  },
  barNumeric: {
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
    letterSpacing: -0.2,
    minWidth: 22,
    textAlign: 'right',
  },
  rowInteractive: {
    justifyContent: 'center',
    width: '100%',
  },
  cupsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cupWrap: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
  },
  cupWrapSelected: {
    borderColor: COLORS.accentSubtleBorder,
    backgroundColor: COLORS.accentSubtleFill,
    opacity: 1,
  },
  cupWrapUnselected: {
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    opacity: 0.5,
  },
  cupHover: {
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.background,
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
