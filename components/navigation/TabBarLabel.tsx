import React, { useEffect } from 'react';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { COLORS, FONTS } from '@/components/theme';

const TRANSITION_MS = 180;

type TabBarLabelProps = {
  focused: boolean;
  children: string;
};

/**
 * Tab label with a soft color transition and slightly stronger type when active.
 */
export function TabBarLabel({ focused, children }: TabBarLabelProps) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: TRANSITION_MS });
  }, [focused, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [COLORS.muted, COLORS.text]),
  }));

  return (
    <Animated.Text
      numberOfLines={1}
      style={[
        {
          fontSize: 11,
          marginTop: 2,
          fontFamily: focused ? FONTS.sans.semibold : FONTS.sans.medium,
        },
        animatedStyle,
      ]}
    >
      {children}
    </Animated.Text>
  );
}
