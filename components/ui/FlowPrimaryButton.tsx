import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
  /** Tighter padding for inline form CTAs */
  compact?: boolean;
};

/**
 * Primary CTA — black fill, light label. Shared across join, landing, onboarding, auth.
 */
export function FlowPrimaryButton({
  label,
  onPress,
  disabled,
  accessibilityLabel,
  style,
  compact = false,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
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
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    color: COLORS.buttonLabelOnAccent,
    fontSize: 17,
    fontFamily: FONTS.sans.bold,
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 14,
    fontFamily: FONTS.sans.semibold,
  },
});
