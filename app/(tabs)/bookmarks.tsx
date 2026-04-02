import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SavedCafesContent } from './components/saved/SavedCafesContent';
import { COLORS } from './components/theme';

/**
 * Bottom tab "Saved" — route URL is `/bookmarks` so it does not clash with
 * the root stack screen `app/saved.tsx` (`/saved`, e.g. from Profile).
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
