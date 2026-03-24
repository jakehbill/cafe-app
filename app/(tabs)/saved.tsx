import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import { SavedCafesContent } from '@/components/saved/SavedCafesContent';

import { COLORS } from './components/theme';

/**
 * Saved tab: same list as `app/saved.tsx` but no stack header (tab bar only).
 */
export default function SavedTabScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <SavedCafesContent showPageTitle />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
