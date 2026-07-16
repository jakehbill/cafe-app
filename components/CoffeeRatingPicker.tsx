import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';
import { COFFEE_RATING_MAX, quantizeCoffeeRatingForStorage } from '@/lib/coffeeRating';

const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

export type CoffeeRatingPickerProps = {
  value: number | null;
  onChange: (rating: number) => void;
  onClear?: () => void;
  title?: string;
  helperText?: string | null;
  showClear?: boolean;
  disabled?: boolean;
};

export function CoffeeRatingPicker({
  value,
  onChange,
  onClear,
  title = 'How was the workspace?',
  helperText = null,
  showClear = false,
  disabled = false,
}: CoffeeRatingPickerProps) {
  const selected =
    value != null && Number.isFinite(value) ? quantizeCoffeeRatingForStorage(value) : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
      <View style={styles.row} accessibilityRole="radiogroup">
        {RATING_OPTIONS.map((option) => {
          const isSelected = selected === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={`${option} out of ${COFFEE_RATING_MAX}`}
              disabled={disabled}
              onPress={() => onChange(option)}
              style={({ pressed, hovered }) => [
                styles.pill,
                isSelected && styles.pillSelected,
                !disabled && pressed && styles.pillPressed,
                !disabled && hovered && !isSelected && styles.pillHovered,
                disabled && styles.pillDisabled,
              ]}
            >
              <Text style={[styles.pillLabel, isSelected && styles.pillLabelSelected]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      {showClear && onClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear rating"
          disabled={disabled || selected == null}
          onPress={onClear}
          style={styles.clearHit}
        >
          <Text style={[styles.clearText, (disabled || selected == null) && styles.clearTextMuted]}>
            Clear rating
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    marginTop: -4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  pill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillHovered: {
    borderColor: COLORS.accentSubtleBorder,
    backgroundColor: COLORS.inputBackground,
  },
  pillPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  pillSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
  },
  pillDisabled: {
    opacity: 0.55,
  },
  pillLabel: {
    fontSize: 16,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
    letterSpacing: -0.2,
  },
  pillLabelSelected: {
    fontFamily: FONTS.sans.bold,
    color: COLORS.buttonLabelOnAccent,
  },
  clearHit: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  clearText: {
    fontSize: 13,
    fontFamily: FONTS.sans.medium,
    color: COLORS.roastedBrown,
  },
  clearTextMuted: {
    color: COLORS.muted,
    opacity: 0.6,
  },
});
