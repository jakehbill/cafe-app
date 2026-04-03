import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

/**
 * Outline secondary — accent border + accent text (e.g. Log in on onboarding).
 */
export function FlowSecondaryButton({ label, onPress, disabled, accessibilityLabel, style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: COLORS.accent,
    fontSize: 17,
    fontFamily: FONTS.sans.bold,
    textAlign: 'center',
  },
});
