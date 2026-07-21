import { buildLoginPath, parseReturnToParam } from '@/lib/authGate';
import {
  normalizeSignupUsername,
  updateProfilePreferences,
  upsertSignupProfileForUser,
  validateSignupUsernameFormat,
} from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { COLORS as AUTH_COLORS, authStyles } from '@/components/auth/authStyles';
import { COLORS, FONTS, SPACING } from '@/components/theme';
import { useProfileGate } from '@/contexts/ProfileGateContext';
import { FlowPrimaryButton } from '@/components/ui/FlowPrimaryButton';

const TOTAL_STEPS = 2;

/** 0 account details, 1 username */
type SignupStepIndex = 0 | 1;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function devLogSignup(message: string, detail?: unknown) {
  if (!__DEV__) return;
  if (detail !== undefined) console.log(`[signup] ${message}`, detail);
  else console.log(`[signup] ${message}`);
}

function SignupProgress({ step }: { step: number }) {
  return (
    <View style={styles.progressWrap}>
      <Text style={styles.progressKicker}>
        Step {step + 1} of {TOTAL_STEPS}
      </Text>
      <View style={styles.dots}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

/**
 * Main auth entry: sign up (`/auth`).
 * Taste / workspace onboarding runs post-signup via ProfileGate → `/onboarding-preferences`.
 */
export default function AuthScreen() {
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = parseReturnToParam(returnToParam);
  const { refresh: refreshProfileGate } = useProfileGate();
  const [step, setStep] = useState<SignupStepIndex>(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { shellTitle, shellSubtitle } = useMemo(() => {
    if (step === 0) {
      return {
        shellTitle: 'Create your account',
        shellSubtitle: 'Sign up to discover and save workspaces.',
      };
    }
    return {
      shellTitle: 'Choose your username',
      shellSubtitle: 'This is how you’ll show up on Beaned.',
    };
  }, [step]);

  function validateAccount(): {
    first: string;
    last: string;
    mail: string;
  } | null {
    const first = firstName.trim();
    const last = lastName.trim();
    const mail = email.trim();

    if (!first) {
      setFormError('Please enter your first name.');
      return null;
    }
    if (!last) {
      setFormError('Please enter your last name.');
      return null;
    }
    if (!mail) {
      setFormError('Please enter your email.');
      return null;
    }
    if (!isValidEmail(mail)) {
      setFormError('Please enter a valid email address.');
      return null;
    }
    if (!password) {
      setFormError('Please create a password.');
      return null;
    }
    return { first, last, mail };
  }

  function validateCurrentStep(): boolean {
    setFormError(null);
    if (step === 0) {
      return validateAccount() != null;
    }
    return true;
  }

  function handleContinue() {
    if (!validateCurrentStep()) return;
    if (step < 1) setStep(1);
  }

  async function handleCreateAccount() {
    setFormError(null);

    const account = validateAccount();
    if (!account) {
      setStep(0);
      return;
    }

    const formatError = validateSignupUsernameFormat(username);
    if (formatError) {
      setFormError(formatError);
      return;
    }

    const handle = normalizeSignupUsername(username);
    const mail = account.mail.trim().toLowerCase();

    devLogSignup('submit values', {
      firstName: account.first,
      lastName: account.last,
      username: handle,
      email: mail,
    });

    setLoading(true);
    try {
      devLogSignup('signUp start', { email: mail, username: handle });

      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: {
          data: {
            first_name: account.first,
            last_name: account.last,
            display_name: handle,
            username: handle,
            email: mail,
          },
        },
      });

      if (error) {
        devLogSignup('signUp error', error);
        setFormError(error.message || 'Please check your details and try again.');
        return;
      }

      devLogSignup('signUp success', { userId: data.user?.id ?? null, hasSession: !!data.session });

      const userId = data.user?.id;
      if (!userId) {
        setFormError('Please check your details and try again.');
        return;
      }

      if (!data.session) {
        setFormError(
          'Account created. Confirm your email, then log in to finish setting up your profile.'
        );
        return;
      }

      devLogSignup('profile client fallback start', { userId });

      const profileRes = await upsertSignupProfileForUser(userId, {
        first_name: account.first,
        last_name: account.last,
        username: handle,
        email: mail,
        onboarding_completed: false,
      });

      if (!profileRes.ok) {
        if (__DEV__) {
          console.warn(
            '[signup] profile client fallback failed — auth user exists; DB trigger may have created the row',
            profileRes
          );
        }
      } else {
        devLogSignup('profile client fallback success', { userId });
      }

      // Ensure ProfileGate sends new users through workspace onboarding (trigger may default to true).
      const onboardingFlagRes = await updateProfilePreferences({ onboarding_completed: false });
      if (!onboardingFlagRes.ok && __DEV__) {
        console.warn('[signup] could not reset onboarding_completed', onboardingFlagRes.error);
      }

      await refreshProfileGate();
      devLogSignup('navigation start', { route: '/onboarding-preferences' });
      router.replace('/onboarding-preferences');
    } catch (e) {
      devLogSignup('signUp error', e);
      setFormError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleShellBack() {
    setFormError(null);
    if (step > 0) {
      setStep(0);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  }

  const primaryLabel =
    step === 1 ? (loading ? 'Creating account...' : 'Create account') : 'Continue';

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
      <SignupProgress step={step} />

      {formError ? (
        <View style={authStyles.feedbackBannerError}>
          <Text style={authStyles.feedbackErrorText}>{formError}</Text>
        </View>
      ) : null}

      {step === 0 ? (
        <>
          <View style={authStyles.fieldWrap}>
            <Text style={authStyles.fieldLabel}>First name</Text>
            <View style={authStyles.inputWrap}>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={AUTH_COLORS.muted}
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
                placeholderTextColor={AUTH_COLORS.muted}
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
                placeholderTextColor={AUTH_COLORS.muted}
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
                placeholderTextColor={AUTH_COLORS.muted}
                secureTextEntry
                style={authStyles.input}
              />
            </View>
          </View>
        </>
      ) : null}

      {step === 1 ? (
        <View style={authStyles.fieldWrap}>
          <Text style={authStyles.fieldLabel}>Username</Text>
          <View style={authStyles.inputWrap}>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor={AUTH_COLORS.muted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              style={authStyles.input}
            />
          </View>
        </View>
      ) : null}

      <View style={authStyles.primaryButtonSlot}>
        <FlowPrimaryButton
          label={primaryLabel}
          onPress={() => (step === 1 ? void handleCreateAccount() : handleContinue())}
          disabled={loading}
        />
      </View>

      {step === 1 ? (
        <Pressable
          onPress={() => setStep(0)}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={authStyles.stepBackLink}
        >
          <Text style={authStyles.stepBackLinkText}>Back</Text>
        </Pressable>
      ) : null}
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  progressWrap: {
    marginBottom: SPACING.sectionGap,
    gap: 14,
  },
  progressKicker: {
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.muted,
    fontFamily: FONTS.sans.semibold,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.cardBorder,
  },
  dotActive: {
    backgroundColor: COLORS.accent,
  },
});
