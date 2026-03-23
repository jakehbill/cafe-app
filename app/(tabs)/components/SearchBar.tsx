import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { COLORS } from './theme';

type SearchBarProps = {
  placeholder?: string;
};

export function SearchBar({ placeholder = 'Search cafes...' }: SearchBarProps) {
  return (
    <View style={styles.searchWrap}>
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
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  searchInput: {
    height: 22,
    fontSize: 15,
    color: COLORS.text,
    padding: 0,
  },
});

