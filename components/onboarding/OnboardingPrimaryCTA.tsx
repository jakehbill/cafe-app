import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { COLORS, FONTS } from '@/components/theme';
import { onboardingHapticLight } from '@/lib/onboardingHaptics';

import { ONBOARDING_PRESS_SPRING } from '@/components/onboarding/onboardingMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
};

export function OnboardingPrimaryCTA({
  label,
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel,
}: Props) {
  const scale = useSharedValue(1);
  const isDisabled = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePressIn() {
    if (isDisabled) return;
    scale.value = withSpring(0.976, ONBOARDING_PRESS_SPRING);
  }

  function handlePressOut() {
    scale.value = withSpring(1, ONBOARDING_PRESS_SPRING);
  }

  function handlePress() {
    if (isDisabled) return;
    onboardingHapticLight();
    onPress();
  }

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={[styles.base, animatedStyle, isDisabled && styles.disabled]}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={COLORS.buttonLabelOnAccent} size="small" />
          <Text style={styles.label}>{label}</Text>
        </View>
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 22,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  disabled: {
    opacity: 0.42,
  },
  label: {
    color: COLORS.buttonLabelOnAccent,
    fontSize: 17,
    fontFamily: FONTS.sans.bold,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
