import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Cafe } from '@/data/cafes';
import { COLORS, FONTS } from '@/components/theme';
import { formatPublicCoffeeOutOf5 } from '@/lib/publicCoffeeDisplay';
import { BeanCoffeeBackdrop, isBeanCoffeeSvgAvailable } from '@/components/BeanCoffeeBackdrop';

type Props = {
  cafe: Cafe;
  /**
   * Placement / density only — each screen wraps this component; visuals stay consistent.
   * `overlay` — Home hero. `overlaySearch` — Search card corner. `identity` — detail header.
   */
  variant?: 'default' | 'list' | 'identity' | 'overlay' | 'overlaySearch';
};

/** Bean size, type scale, and gap (bean → numerals) per context. */
const TOKENS = {
  list: { bean: 12, fontSize: 12, lineHeight: 16, gap: 3 },
  overlay: { bean: 15, fontSize: 14, lineHeight: 18, gap: 4 },
  overlaySearch: { bean: 12, fontSize: 12, lineHeight: 16, gap: 3 },
  default: { bean: 13, fontSize: 13, lineHeight: 17, gap: 4 },
  identity: { bean: 14, fontSize: 14, lineHeight: 18, gap: 5 },
} as const;

/**
 * Public coffee score (`cafe.publicCoffeeScore` ← `public.cafe_public_scores`).
 * Minimal lockup: small `Bean.svg` + accent numerals (placement controlled by parent / variant).
 */
export function PublicCoffeeScoreText({ cafe, variant = 'default' }: Props) {
  const publicCoffeeLabel = formatPublicCoffeeOutOf5(cafe.publicCoffeeScore);
  const t = TOKENS[variant];
  const hasScore = publicCoffeeLabel !== '—';
  const showBean = hasScore && isBeanCoffeeSvgAvailable();

  const accessibilityLabel =
    publicCoffeeLabel === '—'
      ? 'No public coffee score'
      : `Coffee score ${publicCoffeeLabel} out of 5`;

  return (
    <View
      style={[
        styles.lockup,
        { gap: t.gap },
        variant === 'list' && styles.rowList,
        (variant === 'overlay' || variant === 'overlaySearch') && styles.rowOverlay,
        variant === 'identity' && styles.rowIdentity,
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
    >
      {showBean ? (
        <BeanCoffeeBackdrop
          width={t.bean}
          height={t.bean}
          style={styles.beanIcon}
          accessibilityElementsHidden
        />
      ) : null}
      <Text
        style={[
          styles.scoreText,
          {
            fontSize: t.fontSize,
            lineHeight: t.lineHeight,
          },
          hasScore ? styles.scoreTextAccent : styles.scoreTextMuted,
          variant === 'list' && styles.scoreTextList,
          variant === 'overlay' && styles.scoreTextOverlay,
          variant === 'overlaySearch' && styles.scoreTextOverlaySearch,
          variant === 'identity' && styles.scoreTextIdentity,
        ]}
        numberOfLines={1}
      >
        {publicCoffeeLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  beanIcon: {
    flexShrink: 0,
  },
  rowList: {
    alignSelf: 'flex-start',
    marginTop: 1,
    marginRight: 4,
  },
  rowOverlay: {
    margin: 0,
    alignSelf: 'flex-start',
  },
  rowIdentity: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginRight: 2,
  },
  scoreText: {
    fontFamily: FONTS.sans.semibold,
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
  scoreTextAccent: {
    color: COLORS.accent,
  },
  scoreTextMuted: {
    color: COLORS.muted,
    fontFamily: FONTS.sans.medium,
    opacity: 0.92,
  },
  scoreTextList: {
    letterSpacing: 0.1,
  },
  scoreTextOverlay: {
    letterSpacing: -0.15,
  },
  scoreTextOverlaySearch: {
    letterSpacing: -0.1,
  },
  scoreTextIdentity: {
    letterSpacing: 0.05,
    textAlign: 'right',
    minWidth: 36,
  },
});
