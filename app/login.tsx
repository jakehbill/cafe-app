import { buildAuthPath, navigateAfterAuth, parseReturnToParam } from '@/lib/authGate';
import { supabase } from '@/lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { COLORS, authStyles } from '@/components/auth/authStyles';
import { FlowPrimaryButton } from '@/components/ui/FlowPrimaryButton';

/** Temporary login audit logs — always print so Vercel/web consoles show them. */
function loginLog(step: string, detail?: Record<string, unknown>) {
  if (detail !== undefined) {
    console.log(`[login] ${step}`, detail);
    return;
  }
  console.log(`[login] ${step}`);
}

export default function LogInScreen() {
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = parseReturnToParam(returnToParam);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function showError(message: string) {
    setFormError(message);
    if (Platform.OS !== 'web') {
      Alert.alert('Log in failed', message);
    }
  }

  async function handleLogIn() {
    loginLog('Login button pressed', {
      platform: Platform.OS,
      emailLength: email.trim().length,
      passwordLength: password.length,
    });

    setFormError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      loginLog('Validation failed', { reason: 'empty email' });
      showError('Please enter your email.');
      return;
    }
    if (!password) {
      loginLog('Validation failed', { reason: 'empty password' });
      showError('Please enter your password.');
      return;
    }

    loginLog('Validation passed');

    setLoading(true);
    try {
      loginLog('Calling signInWithPassword', { email: trimmedEmail });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      loginLog('signIn response', {
        userId: data?.user?.id ?? null,
        userEmail: data?.user?.email ?? null,
        hasSession: !!data?.session,
        errorMessage: error?.message ?? null,
        errorCode: (error as { code?: string } | null)?.code ?? null,
      });

      if (error) {
        loginLog('signIn error', { message: error.message });
        showError(error.message || 'Log in failed. Please try again.');
        return;
      }

      // Use the session from signIn — do not await getSession() here.
      // A second auth storage call can hang on web and leave "Please wait..." forever.
      if (!data.session) {
        loginLog('signIn error', { message: 'No session returned from signInWithPassword' });
        showError('No session was created. Try again.');
        return;
      }

      loginLog('Navigating after login', { returnTo: returnTo ?? '/(tabs)' });
      navigateAfterAuth(router, returnTo);
    } catch (e) {
      loginLog('signIn error', {
        thrown: e instanceof Error ? e.message : String(e),
      });
      showError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      loginLog('finally() reached');
      setLoading(false);
    }
  }

  return (
    <AuthScreenShell
      brandAccent
      title="Welcome back"
      subtitle="Sign in to pick up where you left off"
      onBackPress={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }
        router.replace(buildAuthPath(returnTo) as never);
      }}
      footer={
        <View style={authStyles.footerRow}>
          <Text style={authStyles.footerText}>{"Don't have an account?"}</Text>
          <TouchableOpacity
            onPress={() => router.push(buildAuthPath(returnTo) as never)}
            disabled={loading}
          >
            <Text style={authStyles.footerLink}>{loading ? 'Please wait…' : 'Sign up'}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      {formError ? (
        <View style={authStyles.feedbackBannerError}>
          <Text style={authStyles.feedbackErrorText}>{formError}</Text>
        </View>
      ) : null}

      <View style={authStyles.fieldWrap}>
        <Text style={authStyles.fieldLabel}>Email</Text>
        <View style={authStyles.inputWrap}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={COLORS.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={authStyles.input}
          />
        </View>
      </View>

      <View style={authStyles.fieldWrap}>
        <Text style={authStyles.fieldLabel}>Password</Text>
        <View style={authStyles.inputWrap}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={COLORS.muted}
            secureTextEntry
            style={authStyles.input}
          />
        </View>
      </View>

      <View style={authStyles.primaryButtonSlot}>
        <FlowPrimaryButton
          label={loading ? 'Please wait…' : 'Log in'}
          onPress={() => void handleLogIn()}
          disabled={loading}
        />
      </View>
    </AuthScreenShell>
  );
}
