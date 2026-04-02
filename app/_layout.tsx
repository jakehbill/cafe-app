import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';
import 'react-native-reanimated';

import { COLORS, FONTS } from '@/components/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CafeStateProvider } from '@/contexts/CafeStateContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

SplashScreen.preventAutoHideAsync();

// Temporary testing toggle: set to true to force showing auth screen.
const FORCE_SHOW_AUTH_FOR_TESTING = false;

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  // Default body text: Inter (Playfair only on explicit heading/cafe name styles).
  const TextAny = Text as unknown as {
    defaultProps?: { style?: unknown };
  };
  TextAny.defaultProps = TextAny.defaultProps ?? {};
  TextAny.defaultProps.style = [
    { fontFamily: FONTS.sans.regular },
    TextAny.defaultProps.style,
  ];

  return (
    <AuthProvider>
      <CafeStateProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootNavigator />
          <StatusBar style="dark" />
        </ThemeProvider>
      </CafeStateProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingSafeArea}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  /** Native stack: chevron-only back on iOS (`minimal`); avoids "(tabs)" from the tab group route name. */
  const stackScreenOptions = {
    headerShown: true,
    headerBackButtonDisplayMode: 'minimal' as const,
    headerBackTitle: '',
    headerTintColor: COLORS.accent,
    headerStyle: { backgroundColor: COLORS.background },
    headerTitleStyle: {
      fontSize: 17,
      fontWeight: '600' as const,
      color: COLORS.text,
      fontFamily: FONTS.sans.semibold,
    },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: COLORS.background },
  };

  return (
    <Stack screenOptions={stackScreenOptions}>
      {user && !FORCE_SHOW_AUTH_FOR_TESTING ? (
        <>
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
              /** Shown as previous screen title if iOS ever falls back from `minimal` mode */
              title: 'Home',
            }}
          />
          <Stack.Screen name="cafe/[id]" options={{ title: 'Cafe' }} />
          <Stack.Screen name="rate/[id]" options={{ title: 'Rate Cafe' }} />
          <Stack.Screen name="saved" options={{ title: 'Saved' }} />
          <Stack.Screen name="ratings" options={{ title: 'Ratings' }} />
          <Stack.Screen name="my-cafes" options={{ title: 'Visited' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </>
      )}
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingSafeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: FONTS.sans.semibold,
  },
});
