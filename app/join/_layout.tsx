import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { COLORS } from '@/components/theme';
import { useDesktopWeb } from '@/hooks/use-desktop-web';
import {
  DESKTOP_APP_MAX_WIDTH,
  getDesktopWebInnerColumnStyle,
  getDesktopWebOuterShellStyle,
} from '@/lib/responsiveWebLayout';

/** Isolated layout for the public beta waitlist — no tabs, no app headers. */
export default function JoinLayout() {
  const { isDesktopWeb } = useDesktopWeb();

  return (
    <View style={[styles.root, isDesktopWeb ? getDesktopWebOuterShellStyle() : null]}>
      <View
        style={[
          styles.stackHost,
          isDesktopWeb ? getDesktopWebInnerColumnStyle(DESKTOP_APP_MAX_WIDTH) : null,
        ]}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.background },
          }}
        >
          <Stack.Screen name="index" />
        </Stack>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  stackHost: {
    flex: 1,
    width: '100%',
  },
});
