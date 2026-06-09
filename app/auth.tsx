import { buildLoginPath, navigateAfterAuth, parseReturnToParam } from '@/lib/authGate';
import {
  createProfileIfMissing,
  isUsernameAvailable,
  normalizeSignupUsername,
  updateProfile,
  validateSignupUsernameFormat,
} from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { COLORS, authStyles } from '@/components/auth/authStyles';
import { FlowPrimaryButton } from '@/components/ui/FlowPrimaryButton';

type SignupStep = 1 | 2;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Main auth entry: sign up (`/auth`).
 * Log in lives at `/login` — no duplicate `app/auth/` folder.
 */
export default function AuthScreen() {
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = parseReturnToParam(returnToParam);
  const [step, setStep] = useState<SignupStep>(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function persistSignupProfile(first: string, last: string, handle: string) {
    const created = await createProfileIfMissing();
    if (created.error) {
      console.warn('[auth] createProfileIfMissing', created.error);
      return;
    }
    const fullName = `${first} ${last}`;
    const profileRes = await updateProfile({
      first_name: first,
      last_name: last,
      username: handle,
      display_name: fullName,
    });
    if (!profileRes.ok) {
      console.warn('[auth] updateProfile after signup', profileRes.error);
    }
  }

  function validateStepOne(): {
    first: string;
    last: string;
    mail: string;
  } | null {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirst) {
      Alert.alert('First name required', 'Please enter your first name.');
      return null;
    }
    if (!trimmedLast) {
      Alert.alert('Last name required', 'Please enter your last name.');
      return null;
    }
    if (!trimmedEmail) {
      Alert.alert('Email required', 'Please enter your email.');
      return null;
    }
    if (!isValidEmail(trimmedEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return null;
    }
    if (!password) {
      Alert.alert('Password required', 'Please create a password.');
      return null;
    }
    if (!confirmPassword) {
      Alert.alert('Confirm your password', 'Please confirm your password.');
      return null;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Make sure both password fields match.');
      return null;
    }

    return { first: trimmedFirst, last: trimmedLast, mail: trimmedEmail };
  }

  function handleContinue() {
    const valid = validateStepOne();
    if (!valid) return;
    setStep(2);
  }

  async function handleCreateAccount() {
    const account = validateStepOne();
    if (!account) {
      setStep(1);
      return;
    }

    const formatError = validateSignupUsernameFormat(username);
    if (formatError) {
      Alert.alert('Username', formatError);
      return;
    }

    const normalizedUsername = normalizeSignupUsername(username);

    setLoading(true);
    try {
      const availability = await isUsernameAvailable(normalizedUsername);
      if (!availability.available) {
        Alert.alert('Username unavailable', availability.error ?? 'That username is already taken.');
        return;
      }

      const fullName = `${account.first} ${account.last}`;
      const { data, error } = await supabase.auth.signUp({
        email: account.mail,
        password,
        options: {
          data: {
            first_name: account.first,
            last_name: account.last,
            display_name: fullName,
            username: normalizedUsername,
          },
        },
      });

      if (error) {
        Alert.alert('Sign up failed', error.message);
        return;
      }

      if (data.session) {
        await persistSignupProfile(account.first, account.last, normalizedUsername);
        navigateAfterAuth(router, returnTo);
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

  function handleShellBack() {
    if (step === 2) {
      setStep(1);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  }

  const shellTitle = step === 1 ? 'Create your account' : 'Choose your username';
  const shellSubtitle =
    step === 1
      ? 'Start discovering cafes that fit how you work and unwind'
      : 'This is how you’ll show up on Beaned.';

  return (
    <AuthScreenShell
      brandAccent
      title={shellTitle}
      subtitle={shellSubtitle}
      onBackPress={handleShellBack}
      footer={
        <View style={authStyles.footerRow}>
          <Text style={authStyles.footerText}>Already have an account?</Text>
          <TouchableOpacity
            onPress={() => router.push(buildLoginPath(returnTo) as never)}
            disabled={loading}
          >
            <Text style={authStyles.footerLink}>{loading ? 'Please wait…' : 'Log in'}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      {step === 1 ? (
        <>
          <View style={authStyles.fieldWrap}>
            <Text style={authStyles.fieldLabel}>First name</Text>
            <View style={authStyles.inputWrap}>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={COLORS.muted}
                autoCapitalize="words"
                autoCorrect={false}
                style={authStyles.input}
              />
            </View>
          </View>

          <View style={authStyles.fieldWrap}>
            <Text style={authStyles.fieldLabel}>Last name</Text>
            <View style={authStyles.inputWrap}>
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={COLORS.muted}
                autoCapitalize="words"
                autoCorrect={false}
                style={authStyles.input}
              />
            </View>
          </View>

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

          <View style={authStyles.fieldWrap}>
            <Text style={authStyles.fieldLabel}>Confirm password</Text>
            <View style={authStyles.inputWrap}>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                placeholderTextColor={COLORS.muted}
                secureTextEntry
                style={authStyles.input}
              />
            </View>
          </View>

          <View style={authStyles.primaryButtonSlot}>
            <FlowPrimaryButton
              label="Continue"
              onPress={handleContinue}
              disabled={loading}
            />
          </View>
        </>
      ) : (
        <>
          <View style={authStyles.fieldWrap}>
            <Text style={authStyles.fieldLabel}>Username</Text>
            <View style={authStyles.inputWrap}>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="username"
                placeholderTextColor={COLORS.muted}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                style={authStyles.input}
              />
            </View>
          </View>

          <View style={authStyles.primaryButtonSlot}>
            <FlowPrimaryButton
              label={loading ? 'Please wait…' : 'Create account'}
              onPress={() => void handleCreateAccount()}
              disabled={loading}
            />
          </View>

          <Pressable
            onPress={() => setStep(1)}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Back to account details"
            style={authStyles.stepBackLink}
          >
            <Text style={authStyles.stepBackLinkText}>Back</Text>
          </Pressable>
        </>
      )}
    </AuthScreenShell>
  );
}
