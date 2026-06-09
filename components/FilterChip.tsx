import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';

type FilterChipProps = {
  label: string;
  /** Optional Ionicons glyph (search / filter chips). */
  icon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
  onPress?: () => void;
};

export function FilterChip({ label, icon, selected = false, onPress }: FilterChipProps) {
  const iconColor = selected ? COLORS.accent : COLORS.text;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <View style={styles.chipInner}>
        {icon ? (
          <Ionicons name={icon} size={15} color={iconColor} style={styles.chipIcon} />
        ) : null}
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: COLORS.chipBackground,
    borderWidth: 1,
    borderColor: COLORS.tagSecondaryBorder,
    justifyContent: 'center',
  },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipIcon: {
    marginTop: 0,
  },
  chipSelected: {
    backgroundColor: COLORS.accentSubtleFill,
    borderColor: COLORS.text,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 15,
    fontFamily: FONTS.sans.semibold,
  },
  chipTextSelected: {
    color: COLORS.accent,
  },
});

