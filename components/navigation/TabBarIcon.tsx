import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { COLORS } from '@/components/theme';

const TRANSITION_MS = 180;
const BASE_SIZE = 24;
const ACTIVE_SIZE = 25;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type TabBarIconProps = {
  focused: boolean;
  outline: IoniconName;
  filled: IoniconName;
};

/**
 * Bottom-tab icon with a subtle active weight (filled + 1px) and a short crossfade.
 */
export function TabBarIcon({ focused, outline, filled }: TabBarIconProps) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: TRANSITION_MS });
  }, [focused, progress]);

  const inactiveStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }));

  const activeStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.layer, inactiveStyle]}>
        <Ionicons name={outline} size={BASE_SIZE} color={COLORS.muted} />
      </Animated.View>
      <Animated.View style={[styles.layer, activeStyle]}>
        <Ionicons name={filled} size={ACTIVE_SIZE} color={COLORS.text} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: ACTIVE_SIZE,
    height: ACTIVE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
