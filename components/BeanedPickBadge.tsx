import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';

type Props = {
  /** `onDark` for photo overlays (home hero, thumbnails). */
  tone?: 'default' | 'onDark';
  style?: StyleProp<ViewStyle>;
};

/**
 * Subtle editorial mark for certified spaces (“Beaned Pick”).
 */
export function BeanedPickBadge({ tone = 'default', style }: Props) {
  const onDark = tone === 'onDark';
  return (
    <View
      style={[styles.wrap, onDark && styles.wrapOnDark, style]}
      accessibilityLabel="Beaned Pick"
    >
      <Text style={[styles.label, onDark && styles.labelOnDark]} numberOfLines={1}>
        ⭐ Beaned Pick
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(107, 94, 82, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107, 94, 82, 0.22)',
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
  labelOnDark: {
    color: 'rgba(255,255,255,0.93)',
    textShadowColor: 'transparent',
  },
});
