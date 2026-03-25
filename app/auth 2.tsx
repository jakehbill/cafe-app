import React, { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '@/lib/supabase';

const COLORS = {
  background: '#F7F3EE',
  text: '#2E2A27',
  muted: '#6E6254',
  roastedBrown: '#8A6A4F',
  border: '#E6DCCB',
  input: '#EFE8DC',
} as const;

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }

    Alert.alert('Check your email', 'If email confirmation is enabled, verify your email to finish sign up.');
  }

  async function handleLogIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      Alert.alert('Log in failed', error.message);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign up or log in to continue</Text>

        <View style={styles.inputWrap}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={COLORS.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        <View style={styles.inputWrap}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={COLORS.muted}
            secureTextEntry
            style={styles.input}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.primaryButton}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>{loading ? 'Please wait...' : 'Sign Up'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.secondaryButton}
          onPress={handleLogIn}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>{loading ? 'Please wait...' : 'Log In'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 36,
    gap: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.4,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
    marginBottom: 8,
  },
  inputWrap: {
    backgroundColor: COLORS.input,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    fontSize: 16,
    color: COLORS.text,
    padding: 0,
    height: 24,
  },
  primaryButton: {
    marginTop: 6,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: COLORS.roastedBrown,
    borderWidth: 1,
    borderColor: 'rgba(138, 106, 79, 0.55)',
  },
  primaryButtonText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: COLORS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});

