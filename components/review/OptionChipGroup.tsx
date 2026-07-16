import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';

export type ChipOption = {
  value: string;
  label: string;
};

type Props = {
  options: readonly ChipOption[];
  /** Single-select: selected value or null. Multi: selected values. */
  value: string | null | readonly string[];
  onChange: (next: string | null | string[]) => void;
  multi?: boolean;
  disabled?: boolean;
};

/**
 * Fast tap chips for review questions (single or multi).
 */
export function OptionChipGroup({
  options,
  value,
  onChange,
  multi = false,
  disabled = false,
}: Props) {
  const selectedSet = new Set(
    multi
      ? ((value as readonly string[] | null | undefined) ?? []).map(String)
      : value != null && value !== ''
        ? [String(value)]
        : []
  );

  function handlePress(optionValue: string) {
    if (disabled) return;
    if (multi) {
      const prev = [...selectedSet];
      const next = selectedSet.has(optionValue)
        ? prev.filter((v) => v !== optionValue)
        : [...prev, optionValue];
      onChange(next);
      return;
    }
    onChange(selectedSet.has(optionValue) ? null : optionValue);
  }

  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const selected = selectedSet.has(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={option.label}
            disabled={disabled}
            onPress={() => handlePress(option.value)}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && !disabled && styles.chipPressed,
              disabled && styles.chipDisabled,
            ]}
          >
            <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]} numberOfLines={2}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  chipSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
  },
  chipPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  chipDisabled: {
    opacity: 0.55,
  },
  chipLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
    letterSpacing: -0.1,
  },
  chipLabelSelected: {
    fontFamily: FONTS.sans.semibold,
    color: COLORS.buttonLabelOnAccent,
  },
});
