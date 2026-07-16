import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';
import { formatVenueTypeBadge, type VenueTypeValue } from '@/lib/venueTypes';

type Props = {
  venueType?: VenueTypeValue | string | null;
  /** `onDark` for home hero overlays. */
  tone?: 'default' | 'onDark';
  style?: StyleProp<ViewStyle>;
};

/**
 * Understated category label for a space (e.g. "🏨 Hotel Lobby").
 */
export function VenueTypeBadge({ venueType, tone = 'default', style }: Props) {
  const label = formatVenueTypeBadge(venueType);
  return (
    <View style={[styles.wrap, style]} accessibilityLabel={label}>
      <Text style={[styles.label, tone === 'onDark' && styles.labelOnDark]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: FONTS.sans.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    color: COLORS.muted,
  },
  labelOnDark: {
    color: 'rgba(250,248,245,0.82)',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
