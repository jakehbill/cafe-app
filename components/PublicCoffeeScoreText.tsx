import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Cafe } from '@/data/cafes';
import { COLORS, FONTS } from '@/components/theme';
import { formatPublicCoffeeOutOf5 } from '@/lib/publicCoffeeDisplay';
import { BeanCoffeeBackdrop, isBeanCoffeeSvgAvailable } from '@/components/BeanCoffeeBackdrop';

type Props = {
  cafe: Cafe;
  /**
   * Placement / density — shared lockup, tokens per context.
   * `homeTagsRow` — Home featured card tag row and cafe detail identity column (same lockup as Home).
   * `overlayThumb` — compact card image corner. `overlaySearch` — Search/Saved title row.
   */
  variant?: 'default' | 'list' | 'homeTagsRow' | 'overlayThumb' | 'overlaySearch';
};

/** Bean size, type scale, and gap (bean → numerals) per context — first-row alignment system. */
const TOKENS = {
  list: { bean: 12, fontSize: 12, lineHeight: 16, gap: 3 },
  /** Home tags row + cafe detail — lineHeight matches bean height for one clean inline row. */
  homeTagsRow: { bean: 16, fontSize: 15, lineHeight: 16, gap: 4 },
  /** Saved/Visited/etc. thumbnail corner — smaller than hero. */
  overlayThumb: { bean: 15, fontSize: 14, lineHeight: 18, gap: 4 },
  /** Search: title row with list card name. */
  overlaySearch: { bean: 15, fontSize: 15, lineHeight: 20, gap: 3 },
  default: { bean: 13, fontSize: 13, lineHeight: 17, gap: 4 },
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
        (variant === 'homeTagsRow' || variant === 'overlayThumb' || variant === 'overlaySearch') &&
          styles.rowOverlay,
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
          (variant === 'homeTagsRow' || variant === 'overlayThumb') && styles.scoreTextOverlay,
          variant === 'overlaySearch' && styles.scoreTextOverlaySearch,
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
});
