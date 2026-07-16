import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';

type Props = {
  /** `onDark` for home hero overlays. */
  tone?: 'default' | 'onDark';
  style?: StyleProp<ViewStyle>;
};

/**
 * Subtle editorial mark for certified spaces (“Beaned Pick”).
 */
export function BeanedPickBadge({ tone = 'default', style }: Props) {
  return (
    <View
      style={[styles.wrap, tone === 'onDark' && styles.wrapOnDark, style]}
      accessibilityLabel="Beaned Pick"
    >
      <Text style={[styles.label, tone === 'onDark' && styles.labelOnDark]} numberOfLines={1}>
        ⭐ Beaned Pick
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
  },
  wrapOnDark: {},
  label: {
    fontFamily: FONTS.sans.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.15,
    color: COLORS.roastedBrown,
  },
  labelOnDark: {
    color: 'rgba(250,248,245,0.88)',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
