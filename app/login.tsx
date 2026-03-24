import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AuthScreenShell } from './auth/AuthScreenShell';
import { COLORS, authStyles } from './auth/_styles';

export default function LogInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogIn() {
    console.log('LOG IN pressed');
    const trimmedEmail = email.trim();
    console.log('email:', trimmedEmail);

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      console.log('Supabase signInWithPassword response:', {
        error,
        user: data?.user ? { id: data.user.id, email: data.user.email } : null,
        hasSession: !!data?.session,
        expiresAt: data?.session?.expires_at ?? null,
      });

      if (error) {
        console.error('Log in failed (Supabase error):', error);
        Alert.alert('Log in failed', error.message);
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('Session after login:', {
        sessionError,
        hasSession: !!sessionData.session,
        userEmail: sessionData.session?.user?.email,
        expiresAt: sessionData.session?.expires_at,
      });

      if (!sessionData.session) {
        console.error('Login succeeded but no session in storage');
        Alert.alert('Log in failed', 'No session was created. Try again.');
        return;
      }

      router.replace('/');
    } catch (e) {
      console.error('Log in failed (unexpected):', e);
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
