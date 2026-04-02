import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';

type FilterChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function FilterChip({ label, selected = false, onPress }: FilterChipProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#EFE9DF',
    borderWidth: 1,
    borderColor: '#E8DECE',
  },
  chipSelected: {
    backgroundColor: COLORS.accent,
    borderColor: 'rgba(225, 92, 49, 0.35)',
  },
  chipText: {
    color: COLORS.text,
    fontSize: 15,
    fontFamily: FONTS.sans.semibold,
  },
  chipTextSelected: {
    color: '#ffffff',
  },
});

