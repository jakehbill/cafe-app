import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { COLORS, FONTS, SHADOWS } from '@/components/theme';

type SearchBarProps = {
  placeholder?: string;
};

export function SearchBar({ placeholder = 'Search cafes...' }: SearchBarProps) {
  return (
    <View style={styles.searchWrap}>
      <Text style={styles.searchIcon}>⌕</Text>
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        returnKeyType="search"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.none,
  },
  searchIcon: {
    color: COLORS.muted,
    fontSize: 18,
    marginRight: 10,
    lineHeight: 20,
  },
  searchInput: {
    flex: 1,
    height: 24,
    fontSize: 18,
    color: COLORS.text,
    fontFamily: FONTS.sans.regular,
    padding: 0,
  },
});

