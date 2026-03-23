import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { COLORS } from './theme';

type FilterChipProps = {
  label: string;
  onPress?: () => void;
};

export function FilterChip({ label, onPress }: FilterChipProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={styles.chip}
      onPress={onPress}
    >
      <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.chipBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
});

