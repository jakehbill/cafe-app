import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { COLORS, FONTS } from '@/components/theme';
import { onboardingHapticSelection } from '@/lib/onboardingHaptics';

import { ONBOARDING_PRESS_SPRING, ONBOARDING_SPRING } from '@/components/onboarding/onboardingMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  label: string;
  emoji?: string;
  selected: boolean;
  onPress: () => void;
};

export function OnboardingSelectableChip({ label, emoji, selected, onPress }: Props) {
  const scale = useSharedValue(1);
  const selectedProgress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    selectedProgress.value = withSpring(selected ? 1 : 0, ONBOARDING_SPRING);
  }, [selected, selectedProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: interpolateColor(
      selectedProgress.value,
      [0, 1],
      [COLORS.cardBorder, COLORS.accentSubtleBorder]
    ),
    backgroundColor: interpolateColor(
      selectedProgress.value,
      [0, 1],
      [COLORS.inputBackground, COLORS.accentSubtleFill]
    ),
  }));

  return (
    <AnimatedPressable
      onPress={() => {
        onboardingHapticSelection();
        onPress();
      }}
      onPressIn={() => {
        scale.value = withSpring(0.96, ONBOARDING_PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, ONBOARDING_PRESS_SPRING);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, animatedStyle]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {emoji ? `${emoji} ` : ''}
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONTS.sans.medium,
    color: COLORS.text,
    letterSpacing: -0.1,
  },
  chipTextSelected: {
    fontFamily: FONTS.sans.semibold,
  },
});
