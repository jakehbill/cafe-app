import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { CafeStateProvider } from '@/contexts/CafeStateContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// Temporary testing toggle: set to true to force showing auth screen.
const FORCE_SHOW_AUTH_FOR_TESTING = false;

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <CafeStateProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootNavigator />
          <StatusBar style="auto" />
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
    headerTintColor: '#8A6A4F',
    headerStyle: { backgroundColor: '#F7F3EE' },
    headerTitleStyle: { fontSize: 17, fontWeight: '700' as const, color: '#2E2A27' },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: '#F7F3EE' },
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
    backgroundColor: '#F7F3EE',
  },
  loadingText: {
    color: '#2E2A27',
    fontSize: 16,
    fontWeight: '600',
  },
});
