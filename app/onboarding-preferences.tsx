import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authStyles } from '@/components/auth/authStyles';
import { COLORS, FONTS, SPACING } from '@/components/theme';
import { FlowPrimaryButton } from '@/components/ui/FlowPrimaryButton';
import { useProfileGate } from '@/contexts/ProfileGateContext';
import {
  COFFEE_PREFERENCE_OPTIONS,
  INTENT_PREFERENCE_OPTIONS,
  updateProfilePreferences,
  VIBE_PREFERENCE_OPTIONS,
} from '@/data/profile';

const STEPS = 3;

function toggleInMaxTwo(current: string[], value: string, max: number): string[] {
  if (current.includes(value)) {
    return current.filter((v) => v !== value);
  }
  if (current.length >= max) {
    return [...current.slice(1), value];
  }
  return [...current, value];
}

export default function OnboardingPreferencesScreen() {
  const router = useRouter();
  const { refresh } = useProfileGate();
  const [step, setStep] = useState(0);
  const [coffee, setCoffee] = useState<string | null>(null);
  const [vibes, setVibes] = useState<string[]>([]);
  const [intents, setIntents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      const res = await updateProfilePreferences({
        coffee_preference: coffee,
        vibe_preferences: vibes.length ? vibes : null,
        intent_preferences: intents.length ? intents : null,
        onboarding_completed: true,
      });
      if (!res.ok) {
        console.warn('[onboarding-preferences]', res.error);
      }
      await refresh();
      router.replace('/(tabs)');
    } finally {
      setBusy(false);
    }
  }, [coffee, vibes, intents, refresh, router]);

  const skip = useCallback(async () => {
    setBusy(true);
    try {
      const res = await updateProfilePreferences({ onboarding_completed: true });
      if (!res.ok) {
        console.warn('[onboarding-preferences] skip', res.error);
      }
      await refresh();
      router.replace('/(tabs)');
    } finally {
      setBusy(false);
    }
  }, [refresh, router]);

  const onPrimary = useCallback(() => {
    if (step < STEPS - 1) {
      setStep((s) => s + 1);
      return;
    }
    void finish();
  }, [step, finish]);

  const canContinue =
    step === 0
      ? coffee != null
      : step === 1
        ? vibes.length > 0
        : intents.length > 0;

  const primaryLabel = step === STEPS - 1 ? 'Get started' : 'Continue';

  return (
    <SafeAreaView style={authStyles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={[authStyles.scrollContent, styles.scrollPad]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Text style={styles.stepKicker}>
            Step {step + 1} of {STEPS}
          </Text>
          <View style={styles.dots}>
            {Array.from({ length: STEPS }).map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>
        </View>

        {step === 0 && (
          <PreferenceStep
            title="What are you usually ordering?"
            options={[...COFFEE_PREFERENCE_OPTIONS]}
            mode="single"
            singleValue={coffee}
            onToggleSingle={setCoffee}
          />
        )}
        {step === 1 && (
          <PreferenceStep
            title="What kind of places do you gravitate toward?"
            subtitle="Pick one or two"
            options={[...VIBE_PREFERENCE_OPTIONS]}
            mode="multi"
            multiValue={vibes}
            onToggleMulti={(v) => setVibes((prev) => toggleInMaxTwo(prev, v, 2))}
          />
        )}
        {step === 2 && (
          <PreferenceStep
            title="What are you most often looking for?"
            subtitle="Pick one or two"
            options={[...INTENT_PREFERENCE_OPTIONS]}
            mode="multi"
            multiValue={intents}
            onToggleMulti={(v) => setIntents((prev) => toggleInMaxTwo(prev, v, 2))}
          />
        )}

        <View style={styles.actions}>
          <FlowPrimaryButton
            label={primaryLabel}
            onPress={onPrimary}
            disabled={!canContinue || busy}
            accessibilityLabel={primaryLabel}
          />
          {step > 0 && (
            <Pressable
              onPress={() => setStep((s) => Math.max(0, s - 1))}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backLink}
            >
              <Text style={styles.backLinkText}>Back</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => void skip()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Skip for now"
            style={styles.skipWrap}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </View>

        {busy && (
          <View style={styles.busyRow}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type PreferenceStepProps = {
  title: string;
  subtitle?: string;
  options: string[];
  mode: 'single' | 'multi';
  singleValue?: string | null;
  onToggleSingle?: (v: string) => void;
  multiValue?: string[];
  onToggleMulti?: (v: string) => void;
};

function PreferenceStep({
  title,
  subtitle,
  options,
  mode,
  singleValue,
  onToggleSingle,
  multiValue,
  onToggleMulti,
}: PreferenceStepProps) {
  return (
    <View style={styles.stepBlock}>
      <View style={authStyles.headerWrap}>
        <Text style={authStyles.title}>{title}</Text>
        {subtitle ? <Text style={authStyles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.optionList}>
        {options.map((opt) => {
          const selected =
            mode === 'single' ? singleValue === opt : (multiValue?.includes(opt) ?? false);
          return (
            <Pressable
              key={opt}
              onPress={() => {
                if (mode === 'single') {
                  onToggleSingle?.(opt);
                } else {
                  onToggleMulti?.(opt);
                }
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
    </View>
  );
}

const styles = StyleSheet.create({
  scrollPad: {
    paddingBottom: 48,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  topRow: {
    marginBottom: SPACING.sectionGap,
    gap: 14,
  },
  stepKicker: {
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
  stepBlock: {
    gap: SPACING.sectionGap,
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
  actions: {
    marginTop: 28,
    gap: 16,
    width: '100%',
  },
  backLink: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: 16,
    color: COLORS.accent,
    fontFamily: FONTS.sans.semibold,
  },
  skipWrap: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 15,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  busyRow: {
    marginTop: 12,
    alignItems: 'center',
  },
});
