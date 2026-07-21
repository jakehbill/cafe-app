import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { COLORS } from '@/components/theme';

import { ONBOARDING_PROGRESS_TIMING } from '@/components/onboarding/onboardingMotion';

type Props = {
  stepIndex: number;
  totalSteps: number;
};

export function OnboardingProgressBar({ stepIndex, totalSteps }: Props) {
  const progress = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    const target = Math.min(1, Math.max(0, (stepIndex + 1) / totalSteps));
    progress.value = withTiming(target, ONBOARDING_PROGRESS_TIMING);
    pulse.value = withSequence(
      withTiming(1.04, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })
    );
  }, [stepIndex, totalSteps, progress, pulse]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    transform: [{ scaleY: pulse.value }],
  }));

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: totalSteps,
        now: stepIndex + 1,
        text: `Step ${stepIndex + 1} of ${totalSteps}`,
      }}
    >
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.cardBorder,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.accent,
    transformOrigin: 'left center',
  },
});
