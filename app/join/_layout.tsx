import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DesktopWebPageContainer } from '@/components/layout/DesktopWebPageContainer';
import { COLORS } from '@/components/theme';

/** Isolated layout for the public beta waitlist — no tabs, no app headers. */
export default function JoinLayout() {
  return (
    <DesktopWebPageContainer variant="form" style={styles.root}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
    </DesktopWebPageContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
});
