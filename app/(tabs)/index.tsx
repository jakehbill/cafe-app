import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CafeCard } from './components/CafeCard';
import { FilterChip } from './components/FilterChip';
import { SearchBar } from './components/SearchBar';

const FILTER_CHIPS = ['Work', 'Quick', 'Specialty', 'Quiet', 'Social'] as const;

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topSection}>
          <Text style={styles.headerText}>Find your perfect cafe</Text>

          <SearchBar placeholder="Search cafes..." />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {FILTER_CHIPS.map((label) => (
              <FilterChip key={label} label={label} />
            ))}
          </ScrollView>

          <CafeCard />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F3EE',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  topSection: {
    gap: 16,
  },

  headerText: {
    fontSize: 28,
    color: '#2E2A27',
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 34,
    marginTop: 2,
  },

  chipsRow: {
    paddingTop: 2,
    gap: 10,
    paddingRight: 6,
  },
});