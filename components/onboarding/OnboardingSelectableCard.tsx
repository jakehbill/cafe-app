import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  leading?: string;
  compact?: boolean;
};

export function OnboardingSelectableCard({
  title,
  subtitle,
  selected,
  onPress,
  leading,
  compact = false,
}: Props) {
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
        scale.value = withSpring(0.985, ONBOARDING_PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, ONBOARDING_PRESS_SPRING);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.card, compact && styles.cardCompact, animatedStyle]}
    >
      <View style={styles.cardInner}>
        {leading ? <Text style={styles.cardLeading}>{leading}</Text> : null}
        <View style={styles.cardTextCol}>
          <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>{title}</Text>
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  cardCompact: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  cardLeading: {
    fontSize: 24,
    lineHeight: 28,
  },
  cardTextCol: {
    flex: 1,
    gap: 5,
  },
  cardTitle: {
    fontSize: 17,
    lineHeight: 24,
    color: COLORS.text,
    fontFamily: FONTS.sans.medium,
    letterSpacing: -0.2,
  },
  cardTitleSelected: {
    fontFamily: FONTS.sans.semibold,
  },
  cardSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
});
