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
 * Subtle venue pill under the space name (e.g. "🏨 Hotel Lobby").
 */
export function VenueTypeBadge({ venueType, tone = 'default', style }: Props) {
  const label = formatVenueTypeBadge(venueType);
  return (
    <View
      style={[styles.wrap, tone === 'onDark' && styles.wrapOnDark, style]}
      accessibilityLabel={label}
    >
      <Text style={[styles.label, tone === 'onDark' && styles.labelOnDark]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.tagSecondaryBorder,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  wrapOnDark: {
    borderColor: 'rgba(250,248,245,0.28)',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  label: {
    fontFamily: FONTS.sans.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.15,
    color: COLORS.muted,
  },
  labelOnDark: {
    color: 'rgba(250,248,245,0.88)',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
