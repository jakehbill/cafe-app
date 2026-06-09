import { buildLoginPath, parseReturnToParam } from '@/lib/authGate';
import {
  COFFEE_PREFERENCE_OPTIONS,
  INTENT_PREFERENCE_OPTIONS,
  normalizeSignupUsername,
  upsertSignupProfileForUser,
  validateSignupUsernameFormat,
  VIBE_PREFERENCE_OPTIONS,
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

const TOTAL_STEPS = 5;

/** 0–2 taste questions, 3 account details, 4 username */
type SignupStepIndex = 0 | 1 | 2 | 3 | 4;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function devLogSignup(message: string, detail?: unknown) {
  if (!__DEV__) return;
  if (detail !== undefined) console.log(`[signup] ${message}`, detail);
  else console.log(`[signup] ${message}`);
}

function toggleInMaxTwo(current: string[], value: string, max: number): string[] {
  if (current.includes(value)) return current.filter((v) => v !== value);
  if (current.length >= max) return [...current.slice(1), value];
  return [...current, value];
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

type PreferenceOptionsProps = {
  options: string[];
  mode: 'single' | 'multi';
  singleValue?: string | null;
  onToggleSingle?: (v: string) => void;
  multiValue?: string[];
  onToggleMulti?: (v: string) => void;
};

/** Options only — title/subtitle come from AuthScreenShell. */
function PreferenceOptions({
  options,
  mode,
  singleValue,
  onToggleSingle,
  multiValue,
  onToggleMulti,
}: PreferenceOptionsProps) {
  return (
    <View style={styles.optionList}>
      {options.map((opt) => {
        const selected =
          mode === 'single' ? singleValue === opt : (multiValue?.includes(opt) ?? false);
        return (
          <Pressable
            key={opt}
            onPress={() => {
              if (mode === 'single') onToggleSingle?.(opt);
              else onToggleMulti?.(opt);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.optionRow,
              selected && styles.optionRowSelected,
              pressed && styles.optionRowPressed,
            ]}
          >
            <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Main auth entry: sign up (`/auth`).
 * Log in lives at `/login`.
 */
export default function AuthScreen() {
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = parseReturnToParam(returnToParam);
  const { refresh: refreshProfileGate } = useProfileGate();
  const [step, setStep] = useState<SignupStepIndex>(0);
  const [coffee, setCoffee] = useState<string | null>(null);
  const [vibes, setVibes] = useState<string[]>([]);
  const [intents, setIntents] = useState<string[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { shellTitle, shellSubtitle } = useMemo(() => {
    switch (step) {
      case 0:
        return {
          shellTitle: 'What are you usually ordering?',
          shellSubtitle: 'Help us understand your coffee style.',
        };
      case 1:
        return {
          shellTitle: 'What kind of places do you gravitate toward?',
          shellSubtitle: 'Pick one or two.',
        };
      case 2:
        return {
          shellTitle: 'What are you most often looking for?',
          shellSubtitle: 'Pick one or two.',
        };
      case 3:
        return {
          shellTitle: 'Create your account',
          shellSubtitle: 'Almost there — just your details to sign up.',
        };
      case 4:
        return {
          shellTitle: 'Choose your username',
          shellSubtitle: 'This is how you’ll show up on Beaned.',
        };
      default:
        return { shellTitle: 'Create your account', shellSubtitle: '' };
    }
  }, [step]);

  function validatePreferences(): boolean {
    if (!coffee) {
      setFormError('Please pick what you usually order.');
      return false;
    }
    if (vibes.length === 0) {
      setFormError('Please pick at least one vibe.');
      return false;
    }
    if (intents.length === 0) {
      setFormError('Please pick at least one intent.');
      return false;
    }
    return true;
  }

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
      if (!coffee) {
        setFormError('Please pick what you usually order.');
        return false;
      }
      return true;
    }
    if (step === 1) {
      if (vibes.length === 0) {
        setFormError('Please pick at least one vibe.');
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (intents.length === 0) {
        setFormError('Please pick at least one intent.');
        return false;
      }
      return true;
    }
    if (step === 3) {
      return validateAccount() != null;
    }
    return true;
  }

  function handleContinue() {
    if (!validateCurrentStep()) return;
    if (step < 4) setStep((s) => (s + 1) as SignupStepIndex);
  }

  async function handleCreateAccount() {
    setFormError(null);

    if (!validatePreferences()) return;
    const account = validateAccount();
    if (!account) {
      setStep(3);
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
        coffee_preference: coffee,
        vibe_preferences: vibes,
        intent_preferences: intents,
        onboarding_completed: true,
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

      await refreshProfileGate();
      devLogSignup('navigation start', { route: '/(tabs)' });
      router.replace('/(tabs)');
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
      setStep((s) => (s - 1) as SignupStepIndex);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  }

  const primaryLabel =
    step === 4 ? (loading ? 'Creating account...' : 'Create account') : 'Continue';

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
        <PreferenceOptions
          options={[...COFFEE_PREFERENCE_OPTIONS]}
          mode="single"
          singleValue={coffee}
          onToggleSingle={setCoffee}
        />
      ) : null}

      {step === 1 ? (
        <PreferenceOptions
          options={[...VIBE_PREFERENCE_OPTIONS]}
          mode="multi"
          multiValue={vibes}
          onToggleMulti={(v) => setVibes((prev) => toggleInMaxTwo(prev, v, 2))}
        />
      ) : null}

      {step === 2 ? (
        <PreferenceOptions
          options={[...INTENT_PREFERENCE_OPTIONS]}
          mode="multi"
          multiValue={intents}
          onToggleMulti={(v) => setIntents((prev) => toggleInMaxTwo(prev, v, 2))}
        />
      ) : null}

      {step === 3 ? (
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

      {step === 4 ? (
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
          onPress={() => (step === 4 ? void handleCreateAccount() : handleContinue())}
          disabled={loading}
        />
      </View>

      {step > 0 && step < 4 ? (
        <Pressable
          onPress={() => setStep((s) => (s - 1) as SignupStepIndex)}
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
  optionList: {
    gap: 12,
  },
  optionRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  optionRowSelected: {
    borderColor: COLORS.accentSubtleBorder,
    backgroundColor: COLORS.accentSubtleFill,
  },
  optionRowPressed: {
    opacity: 0.92,
  },
  optionLabel: {
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.text,
    fontFamily: FONTS.sans.regular,
  },
  optionLabelSelected: {
    fontFamily: FONTS.sans.semibold,
  },
});
