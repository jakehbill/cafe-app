import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { StackHeaderBackButton } from '@/components/navigation/StackHeaderBackButton';
import { COLORS, FONTS } from '@/components/theme';
import { isPublicStandaloneRoute } from '@/lib/publicRoutes';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CafeStateProvider } from '@/contexts/CafeStateContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ProfileGateProvider, useProfileGate } from '@/contexts/ProfileGateContext';
import { UserLocationProvider } from '@/contexts/UserLocationContext';

SplashScreen.preventAutoHideAsync();

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ProfileGateProvider>
          <UserLocationProvider>
            <CafeStateProvider>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <RootNavigator />
                <StatusBar style="dark" />
              </ThemeProvider>
            </CafeStateProvider>
          </UserLocationProvider>
        </ProfileGateProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const navigationReady = rootNavigationState?.key != null;
  const { user, session, loading } = useAuth();
  const { profileLoading, needsOnboarding } = useProfileGate();
  const prevSessionRef = useRef<typeof session>(null);
  const isPublicRoute = isPublicStandaloneRoute(segments[0]);
  const showBootstrapOverlay =
    !isPublicRoute && (loading || (user != null && profileLoading));

  useEffect(() => {
    if (!navigationReady || loading) return;
    const hadSession = prevSessionRef.current != null;
    prevSessionRef.current = session;
    if (hadSession && session == null) {
      router.replace('/(tabs)');
    }
  }, [navigationReady, loading, session, router]);

  /**
   * Route signed-in users through taste preferences until `onboarding_completed` is true.
   * When complete, leave the preferences screen for the tab root.
   */
  useEffect(() => {
    if (!navigationReady || loading) return;
    if (!user) return;
    if (profileLoading) return;

    const top = segments[0];
    if (isPublicStandaloneRoute(top)) return;

    // Signup/login handle their own flow — do not append legacy onboarding.
    if (top === 'auth' || top === 'login' || top === 'onboarding') return;

    const onPreferences = top === 'onboarding-preferences';

    if (needsOnboarding && !onPreferences) {
      router.replace('/onboarding-preferences');
      return;
    }

    if (!needsOnboarding && onPreferences) {
      router.replace('/(tabs)');
    }
  }, [navigationReady, loading, user, profileLoading, needsOnboarding, segments, router]);

  /**
   * Default: no stack header. Expo Router + nested Tabs otherwise inherit `headerShown: true`
   * from native-stack defaults and can show the raw route group name "(tabs)" as the title.
   * Headers are enabled only on stack screens that need them (cafe, rate, saved, …).
   *
   * Custom `headerLeft` ensures a visible Ionicons back control on pushed screens (minimal
   * native mode can hide the default chevron on some iOS versions; web benefits from explicit control).
   */
  const stackScreenBase = {
    headerShown: false,
    headerBackTitle: '',
    headerBackButtonMenuEnabled: false,
    headerTintColor: COLORS.text,
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

  const stackHeaderOn = { headerShown: true as const };

  return (
    <View style={styles.root}>
    <View style={styles.stackHost}>
    <Stack
      screenOptions={({ navigation }) => ({
        ...stackScreenBase,
        headerLeft: ({ canGoBack, tintColor }) => (
          <StackHeaderBackButton
            canGoBack={canGoBack}
            tintColor={tintColor}
            onPress={() => navigation.goBack()}
          />
        ),
      })}
    >
      <Stack.Screen
        name="(tabs)"
        options={{
          headerShown: false,
          title: '',
          headerTitle: '',
        }}
      />
      <Stack.Screen
        name="rate/[id]"
        options={{
          ...stackHeaderOn,
          title: 'Rate Cafe',
          headerTitle: 'Rate Cafe',
        }}
      />
      <Stack.Screen
        name="log-visit/[id]"
        options={{
          ...stackHeaderOn,
          title: 'Log visit',
          headerTitle: 'Log visit',
        }}
      />
      <Stack.Screen
        name="saved"
        options={{
          ...stackHeaderOn,
          title: 'Saved',
          headerTitle: 'Saved',
        }}
      />
      <Stack.Screen
        name="ratings"
        options={{
          ...stackHeaderOn,
          title: 'Ratings',
          headerTitle: 'Ratings',
        }}
      />
      <Stack.Screen
        name="suggest-cafe"
        options={{
          headerShown: false,
          title: '',
          headerTitle: '',
        }}
      />
      <Stack.Screen
        name="moderation"
        options={{
          ...stackHeaderOn,
          title: 'Moderation',
          headerTitle: 'Moderation',
        }}
      />
      <Stack.Screen
        name="moderation-create-cafe"
        options={{
          ...stackHeaderOn,
          title: 'Create cafe',
          headerTitle: 'Create cafe',
        }}
      />
      <Stack.Screen
        name="moderation-cafe-photos"
        options={{
          ...stackHeaderOn,
          title: 'Café photos',
          headerTitle: 'Café photos',
        }}
      />
      <Stack.Screen
        name="onboarding-preferences"
        options={{
          headerShown: false,
          title: '',
          headerTitle: '',
        }}
      />
      <Stack.Screen
        name="modal"
        options={{
          presentation: 'modal',
          ...stackHeaderOn,
          title: 'Modal',
          headerTitle: 'Modal',
        }}
      />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
    </Stack>
    </View>
    {showBootstrapOverlay ? (
      <View style={styles.bootstrapOverlay} pointerEvents="auto">
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    ) : null}
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
  bootstrapOverlay: {
    ...StyleSheet.absoluteFillObject,
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
