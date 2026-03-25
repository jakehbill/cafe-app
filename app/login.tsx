import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { COLORS, authStyles } from '@/components/auth/authStyles';

function authDebug(label: string, payload: Record<string, unknown>) {
  if (!__DEV__) return;
  try {
    console.log(`[WEB AUTH DEBUG] ${label}\n${JSON.stringify(payload, null, 2)}`);
  } catch {
    console.log(`[WEB AUTH DEBUG] ${label}`, payload);
  }
}

export default function LogInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogIn() {
    const trimmedEmail = email.trim();
    authDebug('handleLogIn fired', {
      platform: Platform.OS,
      method: 'emailPassword',
      currentEmail: trimmedEmail,
      passwordLength: password.length,
      loadingBefore: loading,
    });

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      authDebug('signInWithPassword response', {
        errorMessage: error?.message ?? null,
        errorCode: (error as { code?: string } | null)?.code ?? null,
        userId: data?.user?.id ?? null,
        userEmail: data?.user?.email ?? null,
        hasSession: !!data?.session,
        expiresAt: data?.session?.expires_at ?? null,
      });

      if (error) {
        console.error('[WEB AUTH DEBUG] Supabase auth error:', error.message);
        Alert.alert('Log in failed', error.message);
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      authDebug('getSession after login (persistence check)', {
        sessionError: sessionError?.message ?? null,
        hasSession: !!sessionData.session,
        userEmail: sessionData.session?.user?.email ?? null,
        expiresAt: sessionData.session?.expires_at ?? null,
      });

      if (!sessionData.session) {
        console.error('[WEB AUTH DEBUG] Login OK but no session in storage — session not persisting?');
        Alert.alert('Log in failed', 'No session was created. Try again.');
        return;
      }

      authDebug('navigating after login', { to: '/' });
      router.replace('/');
    } catch (e) {
      console.error('[WEB AUTH DEBUG] handleLogIn threw:', e);
      Alert.alert(
        'Log in failed',
        e instanceof Error ? e.message : 'Something went wrong'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenShell
      title="Welcome back"
      subtitle="Sign in to keep exploring cafes"
      onBackPress={() => router.push('/auth')}
      footer={
        <View style={authStyles.footerRow}>
          <Text style={authStyles.footerText}>{"Don't have an account?"}</Text>
          <TouchableOpacity onPress={() => router.push('/auth')} disabled={loading}>
            <Text style={authStyles.footerLink}>{loading ? ' Please wait…' : ' Sign up'}</Text>
          </TouchableOpacity>
        </View>
      }
    >
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

      <TouchableOpacity activeOpacity={0.9} style={authStyles.primaryButton} onPress={handleLogIn} disabled={loading}>
        <Text style={authStyles.primaryButtonText}>{loading ? 'Please wait…' : 'Log in'}</Text>
      </TouchableOpacity>
    </AuthScreenShell>
  );
}
