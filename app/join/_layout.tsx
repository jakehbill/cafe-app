import { Stack } from 'expo-router';

import { COLORS } from '@/components/theme';

/** Isolated layout for the public beta waitlist — no tabs, no app headers. */
export default function JoinLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
