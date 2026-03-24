import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SavedCafesContent } from '@/components/saved/SavedCafesContent';

import { COLORS } from './(tabs)/components/theme';

/**
 * Root stack route: `/saved`
 * Shown with a native header + back button when pushed (e.g. from Profile).
 * Content is shared with the Saved tab — see `app/(tabs)/saved.tsx`.
 */
export default function SavedStackScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <SavedCafesContent showPageTitle={false} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
