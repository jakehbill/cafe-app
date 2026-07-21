import { useEffect, useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { COLORS, FONTS } from '@/components/theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  autoFocus?: boolean;
};

export function OnboardingSearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  autoFocus = false,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const focused = useSharedValue(0);

  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 280);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  const wrapStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focused.value,
      [0, 1],
      [COLORS.cardBorder, COLORS.accent]
    ),
    backgroundColor: interpolateColor(
      focused.value,
      [0, 1],
      [COLORS.inputBackground, COLORS.background]
    ),
    shadowOpacity: focused.value * 0.08,
  }));

  return (
    <Animated.View style={[styles.wrap, wrapStyle]}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={accessibilityLabel}
        onFocus={() => {
          focused.value = withTiming(1, { duration: 180 });
        }}
        onBlur={() => {
          focused.value = withTiming(0, { duration: 200 });
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  input: {
    fontSize: 17,
    lineHeight: 22,
    color: COLORS.text,
    fontFamily: FONTS.sans.regular,
    padding: 0,
    margin: 0,
  },
});
