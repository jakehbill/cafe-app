import { AuthBrandBean } from '@/components/auth/AuthBrandBean';
import { FlowPrimaryButton } from '@/components/ui/FlowPrimaryButton';
import { COLORS, FONTS } from '@/components/theme';
import {
  BETA_DRINK_OPTIONS,
  BETA_PERSONA_OPTIONS,
  BETA_PRIORITY_OPTIONS,
  BETA_VISIT_FREQUENCY_OPTIONS,
  DEFAULT_BETA_SIGNUP_CITY,
  isValidBetaSignupEmail,
  normalizeBetaSignupSource,
  submitBetaSignup,
} from '@/lib/betaSignup';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type StepId = 'intro' | 'persona' | 'frequency' | 'priorities' | 'drink' | 'email' | 'success';

const QUESTION_STEPS: StepId[] = ['persona', 'frequency', 'priorities', 'drink', 'email'];
const TOTAL_PROGRESS_STEPS = QUESTION_STEPS.length;

function ProgressBar({ stepIndex }: { stepIndex: number }) {
  const progress = (stepIndex + 1) / TOTAL_PROGRESS_STEPS;
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        Step {stepIndex + 1} of {TOTAL_PROGRESS_STEPS}
      </Text>
    </View>
  );
}

function OptionRow({
  label,
  selected,
  onPress,
  multi,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
      {multi ? (
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Standalone beta waitlist UI — no auth, no map, no app onboarding.
 * Used only by `/join`.
 */
export function BetaWaitlistFlow() {
  const { source: sourceParam } = useLocalSearchParams<{ source?: string | string[] }>();
  const source = useMemo(() => {
    const raw = Array.isArray(sourceParam) ? sourceParam[0] : sourceParam;
    return normalizeBetaSignupSource(raw);
  }, [sourceParam]);

  const [step, setStep] = useState<StepId>('intro');
  const [persona, setPersona] = useState<string | null>(null);
  const [visitFrequency, setVisitFrequency] = useState<string | null>(null);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [drinkChoice, setDrinkChoice] = useState<string | null>(null);
  const [drinkOther, setDrinkOther] = useState('');
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateSignup, setDuplicateSignup] = useState(false);

  const progressIndex = QUESTION_STEPS.indexOf(step);
  const showProgress = progressIndex >= 0;
  const showBack = step !== 'intro' && step !== 'success';

  const resolvedDrink =
    drinkChoice === 'Something else'
      ? drinkOther.trim() || 'Something else'
      : drinkChoice ?? '';

  function goBack() {
    setFieldError(null);
    const idx = QUESTION_STEPS.indexOf(step);
    if (idx <= 0) {
      setStep('intro');
      return;
    }
    setStep(QUESTION_STEPS[idx - 1]);
  }

  function goNext() {
    setFieldError(null);
    if (step === 'intro') {
      setStep('persona');
      return;
    }
    const idx = QUESTION_STEPS.indexOf(step);
    if (idx >= 0 && idx < QUESTION_STEPS.length - 1) {
      setStep(QUESTION_STEPS[idx + 1]);
    }
  }

  function validateStep(): boolean {
    switch (step) {
      case 'persona':
        if (!persona) {
          setFieldError('Pick the one that sounds most like you.');
          return false;
        }
        return true;
      case 'frequency':
        if (!visitFrequency) {
          setFieldError('Pick how often you visit cafés.');
          return false;
        }
        return true;
      case 'priorities':
        if (priorities.length === 0) {
          setFieldError('Pick at least one thing you care about.');
          return false;
        }
        return true;
      case 'drink':
        if (!drinkChoice) {
          setFieldError('Choose your go-to order.');
          return false;
        }
        return true;
      case 'email':
        if (!isValidBetaSignupEmail(email)) {
          setFieldError('Enter a valid email address.');
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  async function handlePrimary() {
    if (step === 'success') return;
    if (step === 'email') {
      if (!validateStep() || !persona || !visitFrequency) return;
      setSubmitting(true);
      setFieldError(null);
      const result = await submitBetaSignup({
        email: email.trim(),
        persona,
        visit_frequency: visitFrequency,
        priorities,
        city: DEFAULT_BETA_SIGNUP_CITY,
        favorite_drink: resolvedDrink,
        source,
        completed: true,
      });
      setSubmitting(false);
      if (result.ok || result.duplicate) {
        setDuplicateSignup(!!result.duplicate);
        setStep('success');
        return;
      }
      setFieldError(result.error);
      return;
    }
    if (!validateStep()) return;
    goNext();
  }

  const questionTitle =
    step === 'persona'
      ? 'What best describes you?'
      : step === 'frequency'
        ? 'How often do you visit cafés?'
        : step === 'priorities'
          ? 'What do you care about most?'
          : step === 'drink'
            ? "What's your go-to order?"
            : step === 'email'
              ? 'Where should we send your beta invite?'
              : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'web' ? undefined : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inner}>
            <View style={styles.topBar}>
              {showBack ? (
                <Pressable accessibilityLabel="Back" onPress={goBack} hitSlop={12}>
                  <Text style={styles.back}>←</Text>
                </Pressable>
              ) : (
                <View style={styles.backSpacer} />
              )}
            </View>

            {showProgress ? <ProgressBar stepIndex={progressIndex} /> : null}

            {step === 'intro' ? (
              <View style={styles.hero}>
                <AuthBrandBean />
                <Text style={styles.displayTitle}>
                  Find cafés you&apos;ll actually want to come back to.
                </Text>
                <Text style={styles.displaySubtitle}>
                  Answer a few quick questions so we can make Beaned better for early users.
                </Text>
              </View>
            ) : null}

            {step === 'success' ? (
              <View style={styles.hero}>
                <AuthBrandBean />
                <Text style={styles.displayTitle}>You&apos;re in.</Text>
                <Text style={styles.displaySubtitle}>
                  {duplicateSignup
                    ? "You're already on the list."
                    : "We'll send early access soon. We're inviting early testers in small batches."}
                </Text>
                <Text style={styles.successExtra}>
                  Want to help test the beta sooner? Reply to our latest post or DM us &apos;BEANED&apos;.
                </Text>
                <Text style={styles.successInbox}>Keep an eye on your inbox.</Text>
              </View>
            ) : null}

            {questionTitle ? (
              <View style={styles.qBlock}>
                <Text style={styles.qTitle}>{questionTitle}</Text>
                {step === 'priorities' ? (
                  <Text style={styles.qHint}>Choose all that apply.</Text>
                ) : step === 'email' ? (
                  <Text style={styles.qHint}>We only use this for your invite.</Text>
                ) : null}
              </View>
            ) : null}

            {step === 'persona' ? (
              <View style={styles.optionList}>
                {BETA_PERSONA_OPTIONS.map((opt) => (
                  <OptionRow
                    key={opt}
                    label={opt}
                    selected={persona === opt}
                    onPress={() => {
                      setPersona(opt);
                      setFieldError(null);
                    }}
                  />
                ))}
              </View>
            ) : null}

            {step === 'frequency' ? (
              <View style={styles.optionList}>
                {BETA_VISIT_FREQUENCY_OPTIONS.map((opt) => (
                  <OptionRow
                    key={opt}
                    label={opt}
                    selected={visitFrequency === opt}
                    onPress={() => {
                      setVisitFrequency(opt);
                      setFieldError(null);
                    }}
                  />
                ))}
              </View>
            ) : null}

            {step === 'priorities' ? (
              <View style={styles.optionList}>
                {BETA_PRIORITY_OPTIONS.map((opt) => (
                  <OptionRow
                    key={opt}
                    label={opt}
                    selected={priorities.includes(opt)}
                    multi
                    onPress={() => {
                      setPriorities((p) =>
                        p.includes(opt) ? p.filter((x) => x !== opt) : [...p, opt]
                      );
                      setFieldError(null);
                    }}
                  />
                ))}
              </View>
            ) : null}

            {step === 'drink' ? (
              <View style={styles.optionList}>
                {BETA_DRINK_OPTIONS.map((opt) => (
                  <OptionRow
                    key={opt}
                    label={opt}
                    selected={drinkChoice === opt}
                    onPress={() => {
                      setDrinkChoice(opt);
                      setFieldError(null);
                    }}
                  />
                ))}
                {drinkChoice === 'Something else' ? (
                  <TextInput
                    value={drinkOther}
                    onChangeText={setDrinkOther}
                    placeholder="What do you usually order?"
                    placeholderTextColor={COLORS.muted}
                    style={styles.input}
                  />
                ) : null}
              </View>
            ) : null}

            {step === 'email' ? (
              <View style={styles.emailStep}>
                <TextInput
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    setFieldError(null);
                  }}
                  placeholder="you@email.com"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                />
                <Text style={styles.consentFinePrint}>
                  By clicking “Join the beta”, you agree to receive emails from Beaned about beta
                  access, café recommendations, product updates, and early tester opportunities.
                  You can unsubscribe at any time.
                </Text>
              </View>
            ) : null}

            {fieldError ? <Text style={styles.error}>{fieldError}</Text> : null}

            {step !== 'success' ? (
              <View style={styles.footer}>
                <FlowPrimaryButton
                  label={
                    step === 'intro'
                      ? 'Get started'
                      : step === 'email'
                        ? submitting
                          ? 'Joining…'
                          : 'Join the beta'
                        : 'Continue'
                  }
                  onPress={() => void handlePrimary()}
                  disabled={submitting}
                />
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 28 },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 14,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: { minHeight: 40 },
  back: { fontSize: 28, color: COLORS.muted, fontFamily: FONTS.sans.regular },
  backSpacer: { height: 28 },
  progressWrap: { gap: 6, marginBottom: 4 },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 999 },
  progressLabel: { fontSize: 12, fontFamily: FONTS.sans.medium, color: COLORS.muted },
  hero: { alignItems: 'center', gap: 12, marginVertical: 12 },
  displayTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  displaySubtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  successExtra: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FONTS.sans.regular,
    color: COLORS.text,
    textAlign: 'center',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  successInbox: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  qBlock: { gap: 6, marginTop: 4 },
  qTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: FONTS.display.semibold,
    color: COLORS.text,
    letterSpacing: -0.35,
  },
  qHint: { fontSize: 15, fontFamily: FONTS.sans.regular, color: COLORS.muted },
  optionList: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 10,
  },
  optionSelected: {
    backgroundColor: COLORS.accentSubtleFill,
    borderColor: COLORS.accentSubtleBorder,
  },
  optionPressed: { opacity: 0.92 },
  optionText: { flex: 1, fontSize: 16, fontFamily: FONTS.sans.semibold, color: COLORS.text },
  optionTextSelected: { color: COLORS.accent },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  checkOn: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  checkMark: { color: '#fff', fontSize: 12, fontFamily: FONTS.sans.bold },
  emailStep: { gap: 12 },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    fontFamily: FONTS.sans.regular,
    color: COLORS.text,
    marginTop: 4,
  },
  consentFinePrint: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  error: {
    fontSize: 14,
    fontFamily: FONTS.sans.medium,
    color: COLORS.accent,
    textAlign: 'center',
  },
  footer: { marginTop: 'auto', paddingTop: 8 },
});
