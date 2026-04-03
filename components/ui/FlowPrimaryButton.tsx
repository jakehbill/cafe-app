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
 * Primary CTA — terracotta fill, white label. Matches rate/submit-style accent buttons app-wide.
 */
export function FlowPrimaryButton({ label, onPress, disabled, accessibilityLabel, style }: Props) {
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
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accentSubtleBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    color: '#ffffff',
    fontSize: 17,
    fontFamily: FONTS.sans.bold,
    textAlign: 'center',
  },
});
