import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { COLORS, authStyles } from '@/components/auth/authStyles';
import { FlowPrimaryButton } from '@/components/ui/FlowPrimaryButton';

/**
 * Main auth entry: sign up (`/auth`).
 * Log in lives at `/login` — no duplicate `app/auth/` folder.
 */
export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        Alert.alert('Sign up failed', error.message);
        return;
      }

      if (data.session) {
        return;
      }

      Alert.alert(
        'Check your email',
        'If email confirmation is enabled, verify your email to finish sign up.'
      );
    } catch (e) {
      Alert.alert('Sign up failed', e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenShell
      title="Create your account"
      subtitle="Start discovering cafes that fit how you work and unwind"
      onBackPress={() => router.replace('/onboarding')}
      footer={
        <View style={authStyles.footerRow}>
          <Text style={authStyles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/login')} disabled={loading}>
            <Text style={authStyles.footerLink}>{loading ? 'Please wait…' : 'Log in'}</Text>
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
            placeholder="Create a password"
            placeholderTextColor={COLORS.muted}
            secureTextEntry
            style={authStyles.input}
          />
        </View>
      </View>

      <View style={authStyles.primaryButtonSlot}>
        <FlowPrimaryButton
          label={loading ? 'Please wait…' : 'Sign up'}
          onPress={handleSignUp}
          disabled={loading}
        />
      </View>
    </AuthScreenShell>
  );
}
