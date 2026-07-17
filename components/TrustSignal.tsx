import React, { useMemo } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';
import type { Cafe } from '@/data/cafes';
import type { UserTasteProfile } from '@/lib/cafePersonalization';
import { resolveTrustSignal } from '@/lib/trustSignal';

type Props = {
  cafe: Cafe;
  tasteProfile?: UserTasteProfile | null;
  tone?: 'default' | 'onDark';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

/**
 * Subtle secondary trust line under card identity.
 * Renders nothing when no signal qualifies (no placeholder / empty gap).
 */
export function TrustSignal({
  cafe,
  tasteProfile = null,
  tone = 'default',
  style,
  numberOfLines = 1,
}: Props) {
  const signal = useMemo(
    () => resolveTrustSignal({ cafe, tasteProfile }),
    [cafe, tasteProfile]
  );

  if (!signal) return null;

  return (
    <Text
      accessibilityRole="text"
      accessibilityLabel={signal.label}
      numberOfLines={numberOfLines}
      style={[styles.text, tone === 'onDark' && styles.textOnDark, style]}
    >
      {signal.label}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    letterSpacing: -0.05,
    opacity: 0.9,
  },
  textOnDark: {
    color: 'rgba(250,248,245,0.72)',
    opacity: 1,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
