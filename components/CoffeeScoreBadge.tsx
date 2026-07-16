import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';

export type CoffeeScoreBadgeSize = 'small' | 'medium' | 'large';

/** Outlined circle: light neutral fill, thin accent ring, charcoal Playfair numerals. */
const BADGE_TOKENS: Record<CoffeeScoreBadgeSize, { diameter: number; fontSize: number }> = {
  /** ~12% larger than prior 24 / 12; font scales ~with diameter for balance. */
  small: { diameter: 27, fontSize: 14 },
  medium: { diameter: 31, fontSize: 15 },
  large: { diameter: 36, fontSize: 16 },
};

/** Detail screen: typography-only hero score (Playfair, black accent). */
const DETAIL_TEXT = {
  fontSize: 26,
  lineHeight: 30,
};

const BADGE_BORDER_WIDTH = 1.5;

export type CoffeeScoreDisplayVariant = 'badge' | 'text';

export type CoffeeScoreBadgeProps = {
  /** Output of `formatPublicCoffeeOutOf5` / `formatPublicCoffeeForCafe` — one decimal (e.g. 4.0, 4.5). */
  scoreLabel: string;
  /**
   * `badge` — outlined circle (default everywhere except cafe detail).
   * `text` — bare score next to title on cafe detail only.
   */
  variant?: CoffeeScoreDisplayVariant;
  size?: CoffeeScoreBadgeSize;
  accessibilityLabel?: string;
};

/**
 * Shared public coffee score UI: editorial outlined badge, or hero text on detail.
 */
export function CoffeeScoreBadge({
  scoreLabel,
  variant = 'badge',
  size = 'medium',
  accessibilityLabel: accessibilityLabelProp,
}: CoffeeScoreBadgeProps) {
  const hasScore = scoreLabel !== '—';

  const accessibilityLabel =
    accessibilityLabelProp ??
    (hasScore ? `Work Score ${scoreLabel} out of 10` : 'No public Work Score');

  if (variant === 'text') {
    return (
      <Text
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="text"
        style={[
          styles.detailScore,
          {
            fontSize: DETAIL_TEXT.fontSize,
            lineHeight: DETAIL_TEXT.lineHeight,
            color: hasScore ? COLORS.accent : COLORS.muted,
          },
        ]}
        numberOfLines={1}
      >
        {scoreLabel}
      </Text>
    );
  }

  const { diameter, fontSize } = BADGE_TOKENS[size];

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      style={[
        styles.badgeCircle,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: COLORS.inputBackground,
          borderWidth: BADGE_BORDER_WIDTH,
          borderColor: hasScore ? COLORS.accent : COLORS.cardBorder,
        },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          {
            fontSize,
            lineHeight: fontSize,
            color: hasScore ? COLORS.text : COLORS.muted,
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.74}
      >
        {scoreLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    padding: 0,
  },
  badgeText: {
    fontFamily: FONTS.display.bold,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    paddingVertical: 0,
    margin: 0,
    letterSpacing: -0.28,
  },
  detailScore: {
    fontFamily: FONTS.display.bold,
    includeFontPadding: false,
    letterSpacing: -0.4,
  },
});
