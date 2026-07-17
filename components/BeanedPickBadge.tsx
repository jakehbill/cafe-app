import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';

type Props = {
  /** `onDark` for photo overlays (home hero, thumbnails). */
  tone?: 'default' | 'onDark';
  /** Compact mark for tight rows (e.g. beside score). */
  size?: 'default' | 'inline';
  /** Optional meaning line under the badge. */
  subtitle?: string | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * Subtle editorial mark for certified spaces (“Beaned Pick”).
 */
export function BeanedPickBadge({ tone = 'default', size = 'default', subtitle, style }: Props) {
  const onDark = tone === 'onDark';
  const inline = size === 'inline';
  const subtitleText = String(subtitle ?? '').trim();
  return (
    <View style={[styles.column, style]} accessibilityLabel="Beaned Pick">
      <View style={[styles.wrap, inline && styles.wrapInline, onDark && styles.wrapOnDark]}>
        <Text
          style={[styles.label, inline && styles.labelInline, onDark && styles.labelOnDark]}
          numberOfLines={1}
        >
          ⭐ Beaned Pick
        </Text>
      </View>
      {subtitleText.length > 0 ? (
        <Text
          style={[styles.subtitle, onDark && styles.subtitleOnDark]}
          numberOfLines={2}
        >
          {subtitleText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignSelf: 'flex-start',
    alignItems: 'flex-end',
    maxWidth: 148,
    gap: 3,
  },
  wrap: {
    alignSelf: 'flex-end',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(107, 94, 82, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107, 94, 82, 0.22)',
  },
  wrapInline: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexShrink: 0,
  },
  wrapOnDark: {
    backgroundColor: 'rgba(0,0,0,0.26)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  label: {
    fontFamily: FONTS.sans.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: -0.08,
    color: COLORS.roastedBrown,
  },
  labelInline: {
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: -0.05,
  },
  labelOnDark: {
    color: 'rgba(255,255,255,0.93)',
    textShadowColor: 'transparent',
  },
  subtitle: {
    fontFamily: FONTS.sans.regular,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: -0.05,
    color: COLORS.muted,
    textAlign: 'right',
    opacity: 0.9,
  },
  subtitleOnDark: {
    color: 'rgba(250,248,245,0.78)',
    opacity: 1,
  },
});
