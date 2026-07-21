import { AuthBrandBean } from '@/components/auth/AuthBrandBean';
import {
  onboardingListItemEntering,
  onboardingRevealEntering,
  onboardingStepEntering,
  onboardingStepExiting,
  onboardingWelcomeEntering,
} from '@/components/onboarding/onboardingMotion';
import { OnboardingPrimaryCTA } from '@/components/onboarding/OnboardingPrimaryCTA';
import { OnboardingProgressBar } from '@/components/onboarding/OnboardingProgressBar';
import { OnboardingSearchField } from '@/components/onboarding/OnboardingSearchField';
import { OnboardingSelectableCard } from '@/components/onboarding/OnboardingSelectableCard';
import { OnboardingSelectableChip } from '@/components/onboarding/OnboardingSelectableChip';
import { COLORS, FONTS, SPACING } from '@/components/theme';
import { useProfileGate } from '@/contexts/ProfileGateContext';
import {
  filterOnboardingCities,
  ONBOARDING_CHALLENGE_OPTIONS,
  ONBOARDING_STEP_ORDER,
  ONBOARDING_TOTAL_STEPS,
  ONBOARDING_WORK_STYLE_OPTIONS,
  ONBOARDING_WORKSPACE_TYPE_OPTIONS,
  onboardingStepIndex,
  toggleMultiValue,
  type LocationMode,
  type OnboardingStepId,
  type WorkStyleId,
} from '@/lib/onboardingConfig';
import {
  onboardingHapticLight,
  onboardingHapticSuccess,
} from '@/lib/onboardingHaptics';
import {
  getCurrentUserProfile,
  markOnboardingComplete,
  saveOnboardingAndComplete,
  type OnboardingAnswersInput,
} from '@/lib/profile';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

function StepHeader({
  title,
  subtitle,
  align = 'center',
}: {
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
}) {
  const isLeft = align === 'left';
  return (
    <View style={[styles.headerWrap, isLeft ? styles.headerWrapLeft : styles.headerWrapCenter]}>
      <Text style={[isLeft ? styles.sectionLabel : styles.headline, isLeft && styles.titleFullWidth]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subhead, isLeft && styles.subheadLeft, isLeft && styles.titleFullWidth]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function CitySearchPanel({
  placeholder,
  accessibilityLabel,
  autoFocus,
  cityQuery,
  onCityQueryChange,
  city,
  onSelectCity,
  cityMatches,
}: {
  placeholder: string;
  accessibilityLabel: string;
  autoFocus?: boolean;
  cityQuery: string;
  onCityQueryChange: (q: string) => void;
  city: string | null;
  onSelectCity: (city: string) => void;
  cityMatches: string[];
}) {
  return (
    <Animated.View entering={onboardingRevealEntering()} style={styles.searchBlock}>
      <OnboardingSearchField
        value={cityQuery}
        onChangeText={onCityQueryChange}
        placeholder={placeholder}
        accessibilityLabel={accessibilityLabel}
        autoFocus={autoFocus}
      />
      {cityMatches.length > 0 ? (
        <View style={styles.cardList}>
          {cityMatches.map((match, index) => (
            <Animated.View key={match} entering={onboardingListItemEntering(index)}>
              <OnboardingSelectableCard
                title={match}
                selected={city === match}
                compact
                onPress={() => onSelectCity(match)}
              />
            </Animated.View>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

function nextStep(current: OnboardingStepId): OnboardingStepId {
  const idx = onboardingStepIndex(current);
  if (idx < 0 || idx >= ONBOARDING_STEP_ORDER.length - 1) return current;
  return ONBOARDING_STEP_ORDER[idx + 1]!;
}

function previousStep(current: OnboardingStepId): OnboardingStepId {
  const idx = onboardingStepIndex(current);
  if (idx <= 0) return 'welcome';
  return ONBOARDING_STEP_ORDER[idx - 1]!;
}

export default function OnboardingPreferencesFlow() {
  const insets = useSafeAreaInsets();
  const { refresh } = useProfileGate();
  const scrollRef = useRef<ScrollView>(null);
  const transitionDirection = useRef<'forward' | 'back'>('forward');

  const [step, setStep] = useState<OnboardingStepId>('welcome');
  const [busy, setBusy] = useState(false);
  const [transitionKey, setTransitionKey] = useState(0);

  const [workspaceTypes, setWorkspaceTypes] = useState<string[]>([]);
  const [workStyle, setWorkStyle] = useState<WorkStyleId | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [city, setCity] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const contentOpacity = useSharedValue(1);

  const contentFadeStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await getCurrentUserProfile();
      if (cancelled || !data) return;
      if (data.current_city) {
        setCity(data.current_city);
        setCityQuery(data.current_city);
      }
      if (data.is_digital_nomad === true) setLocationMode('nomad');
      else if (data.current_city) setLocationMode('based');
      if (data.workspace_type_preferences?.length) {
        setWorkspaceTypes(data.workspace_type_preferences);
      }
      if (data.work_style) setWorkStyle(data.work_style as WorkStyleId);
      if (data.workspace_frustration) setChallenge(data.workspace_frustration);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const resolvedCity = useMemo(
    () => city ?? (cityQuery.trim() || null),
    [city, cityQuery]
  );

  const cityMatches = useMemo(() => filterOnboardingCities(cityQuery), [cityQuery]);

  const canContinue = useMemo(() => {
    switch (step) {
      case 'welcome':
        return true;
      case 'preferences':
        return workspaceTypes.length > 0 && workStyle != null;
      case 'location':
        if (locationMode == null) return false;
        return resolvedCity != null && resolvedCity.length > 0;
      case 'challenge':
        return challenge != null;
      default:
        return false;
    }
  }, [step, workspaceTypes.length, workStyle, locationMode, resolvedCity, challenge]);

  const setBusyState = useCallback(
    (next: boolean) => {
      contentOpacity.value = withTiming(next ? 0.55 : 1, { duration: 220 });
      setBusy(next);
    },
    [contentOpacity]
  );

  const buildOnboardingAnswers = useCallback(
    (): OnboardingAnswersInput => ({
      current_city: resolvedCity,
      is_digital_nomad: locationMode === 'nomad',
      workspace_type_preferences: workspaceTypes.length ? workspaceTypes : null,
      work_style: workStyle,
      workspace_frustration: challenge,
    }),
    [resolvedCity, locationMode, workspaceTypes, workStyle, challenge]
  );

  const enterApp = useCallback(async () => {
    Keyboard.dismiss();
    setSaveError(null);
    setBusyState(true);
    try {
      const res = await saveOnboardingAndComplete(buildOnboardingAnswers());
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }

      onboardingHapticSuccess();

      const gate = await refresh();
      if (gate.error) {
        setSaveError(gate.error);
        return;
      }
      if (gate.needsOnboarding) {
        setSaveError('Onboarding could not be confirmed. Please try again.');
        return;
      }

      // ProfileGate + RootNavigator redirect off onboarding-preferences once needsOnboarding is false.
    } finally {
      setBusyState(false);
    }
  }, [buildOnboardingAnswers, refresh, setBusyState]);

  const skip = useCallback(async () => {
    Keyboard.dismiss();
    setSaveError(null);
    setBusyState(true);
    try {
      const res = await markOnboardingComplete();
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }

      const gate = await refresh();
      if (gate.error) {
        setSaveError(gate.error);
        return;
      }
      if (gate.needsOnboarding) {
        setSaveError('Could not skip onboarding. Please try again.');
        return;
      }

      // ProfileGate + RootNavigator redirect off onboarding-preferences once needsOnboarding is false.
    } finally {
      setBusyState(false);
    }
  }, [refresh, setBusyState]);

  const advanceStep = useCallback(
    (next: OnboardingStepId) => {
      transitionDirection.current = 'forward';
      setTransitionKey((k) => k + 1);
      setStep(next);
    },
    []
  );

  const goNext = useCallback(() => {
    setSaveError(null);
    onboardingHapticLight();
    if (step === 'challenge') {
      void enterApp();
      return;
    }
    Keyboard.dismiss();
    advanceStep(nextStep(step));
  }, [step, enterApp, advanceStep]);

  const goBack = useCallback(() => {
    if (busy) return;
    onboardingHapticLight();
    Keyboard.dismiss();
    transitionDirection.current = 'back';
    setTransitionKey((k) => k + 1);
    setStep((current) => previousStep(current));
  }, [busy]);

  const stepIndex = onboardingStepIndex(step);
  const primaryLabel =
    step === 'welcome' ? 'Get started' : step === 'challenge' ? 'Enter Beaned' : 'Continue';
  const direction = transitionDirection.current;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}
      >
        <Animated.View style={[styles.flex, contentFadeStyle]}>
          <View style={styles.shell}>
            <View style={styles.topBar}>
              {step !== 'welcome' ? (
                <Pressable
                  onPress={goBack}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  hitSlop={14}
                  style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
                >
                  <Text style={styles.backArrow}>‹</Text>
                </Pressable>
              ) : (
                <View style={styles.backPlaceholder} />
              )}
              <View style={styles.progressHost}>
                <OnboardingProgressBar stepIndex={stepIndex} totalSteps={ONBOARDING_TOTAL_STEPS} />
              </View>
            </View>

            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
            >
              <Animated.View
                key={`${step}-${transitionKey}`}
                entering={onboardingStepEntering(direction)}
                exiting={onboardingStepExiting(direction)}
                style={styles.stepContent}
              >
                {step === 'welcome' ? (
                  <Animated.View entering={onboardingWelcomeEntering()} style={styles.welcomeBlock}>
                    <Animated.View entering={FadeIn.duration(520).delay(80)}>
                      <AuthBrandBean />
                    </Animated.View>
                    <StepHeader
                      title="Find workspaces you'll actually enjoy working from."
                      subtitle="A few quick questions to tailor your Beaned experience."
                    />
                  </Animated.View>
                ) : null}

                {step === 'preferences' ? (
                  <View style={styles.sectionStack}>
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>What kind of workspaces do you use?</Text>
                      <View style={styles.chipWrap}>
                        {ONBOARDING_WORKSPACE_TYPE_OPTIONS.map((opt, index) => (
                          <Animated.View
                            key={opt.value}
                            entering={onboardingListItemEntering(index)}
                          >
                            <OnboardingSelectableChip
                              emoji={opt.emoji}
                              label={opt.label}
                              selected={workspaceTypes.includes(opt.value)}
                              onPress={() =>
                                setWorkspaceTypes((prev) => toggleMultiValue(prev, opt.value))
                              }
                            />
                          </Animated.View>
                        ))}
                      </View>
                    </View>

                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>What's your work style?</Text>
                      <View style={styles.cardList}>
                        {ONBOARDING_WORK_STYLE_OPTIONS.map((opt, index) => (
                          <Animated.View key={opt.id} entering={onboardingListItemEntering(index)}>
                            <OnboardingSelectableCard
                              title={opt.title}
                              subtitle={opt.subtitle}
                              selected={workStyle === opt.id}
                              onPress={() => setWorkStyle(opt.id)}
                            />
                          </Animated.View>
                        ))}
                      </View>
                    </View>
                  </View>
                ) : null}

                {step === 'location' ? (
                  <View style={styles.sectionStack}>
                    <StepHeader align="left" title="Are you currently based in one city?" />
                    <View style={styles.cardList}>
                      <OnboardingSelectableCard
                        leading="📍"
                        title="Yes, I'm based in one city"
                        selected={locationMode === 'based'}
                        onPress={() => {
                          setLocationMode('based');
                          setCity(null);
                          setCityQuery('');
                        }}
                      />
                      <OnboardingSelectableCard
                        leading="🌍"
                        title="I'm a digital nomad"
                        selected={locationMode === 'nomad'}
                        onPress={() => {
                          setLocationMode('nomad');
                          setCity(null);
                          setCityQuery('');
                        }}
                      />
                    </View>

                    {locationMode === 'based' ? (
                      <CitySearchPanel
                        placeholder="Search for your city..."
                        accessibilityLabel="Search for your city"
                        autoFocus
                        cityQuery={cityQuery}
                        onCityQueryChange={(q) => {
                          setCityQuery(q);
                          setCity(null);
                        }}
                        city={city}
                        onSelectCity={(match) => {
                          setCity(match);
                          setCityQuery(match);
                          Keyboard.dismiss();
                        }}
                        cityMatches={cityMatches}
                      />
                    ) : null}

                    {locationMode === 'nomad' ? (
                      <CitySearchPanel
                        placeholder="Which city are you in today?"
                        accessibilityLabel="Which city are you in today"
                        autoFocus
                        cityQuery={cityQuery}
                        onCityQueryChange={(q) => {
                          setCityQuery(q);
                          setCity(null);
                        }}
                        city={city}
                        onSelectCity={(match) => {
                          setCity(match);
                          setCityQuery(match);
                          Keyboard.dismiss();
                        }}
                        cityMatches={cityMatches}
                      />
                    ) : null}
                  </View>
                ) : null}

                {step === 'challenge' ? (
                  <View style={styles.sectionStack}>
                    <StepHeader
                      align="left"
                      title="What's your biggest challenge finding somewhere to work?"
                    />
                    <View style={styles.cardList}>
                      {ONBOARDING_CHALLENGE_OPTIONS.map((opt, index) => (
                        <Animated.View key={opt} entering={onboardingListItemEntering(index)}>
                          <OnboardingSelectableCard
                            title={opt}
                            selected={challenge === opt}
                            onPress={() => setChallenge(opt)}
                          />
                        </Animated.View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </Animated.View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              {saveError ? (
                <View style={styles.errorBanner} accessibilityRole="alert">
                  <Text style={styles.errorText}>{saveError}</Text>
                </View>
              ) : null}
              <OnboardingPrimaryCTA
                label={busy && step === 'challenge' ? 'Entering Beaned…' : primaryLabel}
                onPress={goNext}
                disabled={!canContinue}
                loading={busy && step === 'challenge'}
                accessibilityLabel={primaryLabel}
              />
              {step !== 'welcome' ? (
                <Pressable
                  onPress={() => void skip()}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Skip for now"
                  style={({ pressed }) => [styles.skipWrap, pressed && !busy && styles.skipPressed]}
                >
                  <Text style={styles.skipText}>Skip for now</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  shell: {
    flex: 1,
    paddingHorizontal: 28,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 10,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  backButtonPressed: {
    backgroundColor: COLORS.inputBackground,
  },
  backPlaceholder: {
    width: 40,
  },
  backArrow: {
    fontSize: 34,
    lineHeight: 36,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  progressHost: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  stepContent: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
  welcomeBlock: {
    alignItems: 'center',
    gap: 32,
    paddingTop: 40,
    paddingBottom: 20,
  },
  headerWrap: {
    gap: 16,
  },
  headerWrapCenter: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
  },
  headerWrapLeft: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    width: '100%',
  },
  headline: {
    fontSize: 32,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.7,
    lineHeight: 38,
    textAlign: 'center',
  },
  subhead: {
    fontSize: 17,
    color: COLORS.muted,
    lineHeight: 26,
    fontFamily: FONTS.sans.regular,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  subheadLeft: {
    textAlign: 'left',
    paddingHorizontal: 0,
    width: '100%',
  },
  sectionStack: {
    gap: SPACING.sectionGap + 12,
    paddingTop: 8,
    width: '100%',
    alignSelf: 'stretch',
  },
  section: {
    gap: 18,
  },
  sectionLabel: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.5,
    width: '100%',
    textAlign: 'left',
  },
  titleFullWidth: {
    width: '100%',
    alignSelf: 'stretch',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardList: {
    gap: 12,
  },
  searchBlock: {
    gap: 14,
    paddingTop: 4,
  },
  footer: {
    paddingTop: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.cardBorder,
    backgroundColor: COLORS.background,
  },
  errorBanner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8B4B4',
    backgroundColor: '#FDF3F3',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#8B2E2E',
    fontFamily: FONTS.sans.medium,
    textAlign: 'center',
  },
  skipWrap: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  skipPressed: {
    opacity: 0.65,
  },
  skipText: {
    fontSize: 15,
    color: COLORS.muted,
    fontFamily: FONTS.sans.medium,
    letterSpacing: -0.1,
  },
});
