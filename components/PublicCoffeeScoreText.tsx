import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import type { Cafe } from '@/data/cafes';
import { COLORS, FONTS } from '@/components/theme';
import { formatPublicCoffeeOutOf5 } from '@/lib/publicCoffeeDisplay';
import { BeanCoffeeBackdrop, isBeanCoffeeSvgAvailable } from '@/components/BeanCoffeeBackdrop';

type Props = {
  cafe: Cafe;
  /**
   * `list` — legacy inline row (unused on cards when overlaid on image).
   * `overlay` — floating on image (featured Home cards, list cards bottom-right).
   * `overlaySearch` — Search list thumbnails; ~12% smaller than `overlay`, stronger shadow.
   * `default` / `identity` — other contexts.
   */
  variant?: 'default' | 'list' | 'identity' | 'overlay' | 'overlaySearch';
};

/** Outer badge size (includes 2px inner padding around the bean). ~25% larger than prior 30/32. */
const BADGE = {
  list: {
    outer: 42,
    borderRadius: 15,
    fontSize: 12,
    lineHeight: 15,
  },
  /** Image overlay on cards: slightly larger shell + padding for readability. */
  overlay: {
    outer: 48,
    borderRadius: 17,
    fontSize: 13,
    lineHeight: 17,
    /** ~25% more than base `SHELL_PAD` (2 → 2.5). */
    shellPad: 2.5,
  },
  /** Search compact cards: scaled down ~12% vs `overlay`, proportions preserved. */
  overlaySearch: {
    outer: 42,
    borderRadius: 15,
    fontSize: 12,
    lineHeight: 15,
    shellPad: 2,
  },
  default: {
    outer: 44,
    borderRadius: 16,
    fontSize: 13,
    lineHeight: 16,
  },
  identity: {
    outer: 44,
    borderRadius: 16,
    fontSize: 13,
    lineHeight: 16,
  },
} as const;

const SHELL_PAD = 2;

function shellPadFor(spec: (typeof BADGE)[keyof typeof BADGE]): number {
  return 'shellPad' in spec && typeof spec.shellPad === 'number' ? spec.shellPad : SHELL_PAD;
}

/**
 * Public coffee score (`cafe.publicCoffeeScore` ← `public.cafe_public_scores`).
 * When a score exists and the bean SVG loads, shows a compact bean badge with white numerals.
 */
export function PublicCoffeeScoreText({ cafe, variant = 'default' }: Props) {
  const publicCoffeeLabel = formatPublicCoffeeOutOf5(cafe.publicCoffeeScore);
  const spec = BADGE[variant];
  const shellPad = shellPadFor(spec);
  const innerSize = spec.outer - shellPad * 2;
  const useBean =
    publicCoffeeLabel !== '—' && isBeanCoffeeSvgAvailable();

  const accessibilityLabel =
    publicCoffeeLabel === '—'
      ? 'No public coffee score'
      : `Coffee score ${publicCoffeeLabel} out of 5`;

  if (!useBean) {
    return (
      <View
        style={[
          styles.row,
          variant === 'list' && styles.rowList,
          (variant === 'overlay' || variant === 'overlaySearch') && styles.rowOverlay,
          variant === 'identity' && styles.rowIdentity,
        ]}
      >
        <Text
          style={[
            styles.fallbackText,
            variant === 'list' && styles.fallbackTextList,
            variant === 'overlay' && styles.fallbackTextOverlay,
            variant === 'overlaySearch' && styles.fallbackTextOverlaySearch,
            variant === 'identity' && styles.fallbackTextIdentity,
          ]}
          accessibilityLabel={accessibilityLabel}
        >
          {publicCoffeeLabel}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.badgeOuter,
        variant === 'overlaySearch' && styles.badgeOuterSearch,
        {
          width: spec.outer,
          height: spec.outer,
          borderRadius: spec.borderRadius,
          padding: shellPad,
        },
        variant === 'list' && styles.rowList,
        (variant === 'overlay' || variant === 'overlaySearch') && styles.rowOverlay,
        variant === 'identity' && styles.rowIdentity,
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
    >
      <View
        style={[
          styles.badgeInner,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: Math.max(0, spec.borderRadius - shellPad),
          },
        ]}
      >
        <BeanCoffeeBackdrop width={innerSize} height={innerSize} style={styles.beanLayer} />
        <Text
          style={[
            styles.badgeText,
            {
              fontSize: spec.fontSize,
              lineHeight: spec.lineHeight,
            },
          ]}
          numberOfLines={1}
        >
          {publicCoffeeLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: 18,
  },
  rowList: {
    alignSelf: 'flex-start',
    minHeight: 16,
    marginTop: 1,
    /** Pulls badge slightly inward from the card / row edge so it feels anchored to content. */
    marginRight: 4,
  },
  rowOverlay: {
    margin: 0,
  },
  rowIdentity: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginRight: 2,
  },
  fallbackText: {
    fontSize: 13,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
    letterSpacing: -0.2,
  },
  fallbackTextList: {
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    letterSpacing: 0.15,
    opacity: 0.92,
  },
  fallbackTextOverlay: {
    fontSize: 13,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    letterSpacing: 0.15,
    opacity: 0.92,
  },
  fallbackTextOverlaySearch: {
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    letterSpacing: 0.12,
    opacity: 0.92,
  },
  fallbackTextIdentity: {
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    letterSpacing: 0.2,
    textAlign: 'right',
    minWidth: 52,
  },
  badgeOuter: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#1a1a1a',
        shadowOpacity: 0.12,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 3,
      },
      default: {},
    }),
  },
  /** Search thumbnail badge: slightly stronger lift for readability on varied photos. */
  badgeOuterSearch: {
    ...Platform.select({
      ios: {
        shadowColor: '#1a1a1a',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 5,
      },
      default: {},
    }),
  },
  badgeInner: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  beanLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 0,
  },
  badgeText: {
    zIndex: 1,
    fontFamily: FONTS.sans.bold,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 2,
    includeFontPadding: false,
  },
});
