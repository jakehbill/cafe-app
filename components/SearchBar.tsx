import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { COLORS } from '@/components/theme';

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
    borderColor: '#EAE0D0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  searchIcon: {
    color: '#7A6D5E',
    fontSize: 18,
    marginRight: 10,
    lineHeight: 20,
  },
  searchInput: {
    flex: 1,
    height: 24,
    fontSize: 18,
    color: COLORS.text,
    padding: 0,
  },
});

