import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { TouchableOpacity } from 'react-native';

import { COLORS } from '@/components/theme';

type Props = {
  tintColor?: string;
  canGoBack?: boolean;
  onPress: () => void;
};

/**
 * Left header control for root stack screens (cafe, rate, saved, …).
 * Matches Ionicons usage elsewhere; uses navigation tint when provided.
 */
export function StackHeaderBackButton({ tintColor, canGoBack, onPress }: Props) {
  if (!canGoBack) {
    return null;
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={{ paddingLeft: 4, paddingVertical: 4, marginRight: 2 }}
    >
      <Ionicons name="chevron-back" size={24} color={tintColor ?? COLORS.accent} />
    </TouchableOpacity>
  );
}
