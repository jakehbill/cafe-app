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
 * Secondary CTA — cream/white surface, black text, warm neutral border.
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
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.9,
    backgroundColor: COLORS.chipBackground,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: COLORS.text,
    fontSize: 17,
    fontFamily: FONTS.sans.bold,
    textAlign: 'center',
  },
});
