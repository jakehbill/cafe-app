import React from 'react';
import type { SvgProps } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

import BeanRoundSvgRaw from '../../assets/images/Beaned Round.svg';
import { COLORS } from '@/components/theme';

/** Map marker size — visible on mobile without dominating the map. */
export const BEAN_MAP_MARKER_SIZE = 28;

function unwrapSvgComponent(mod: unknown): React.ComponentType<SvgProps> | null {
  let cur: unknown = mod;
  for (let i = 0; i < 5 && cur != null; i++) {
    if (typeof cur === 'function') {
      return cur as React.ComponentType<SvgProps>;
    }
    if (typeof cur === 'object' && 'default' in cur) {
      cur = (cur as { default: unknown }).default;
      continue;
    }
    break;
  }
  return null;
}

const SvgComponent = unwrapSvgComponent(BeanRoundSvgRaw);

export function isBeanRoundMapSvgAvailable(): boolean {
  return SvgComponent != null;
}

/**
 * Custom map marker: round brand bean only (no score on the pin).
 * Parent `Marker` should set `anchor={{ x: 0.5, y: 1 }}` so the bottom of the icon aligns with the coordinate.
 */
export function BeanMapMarkerContent() {
  if (!SvgComponent) {
    return (
      <View style={[styles.beanWrap, { width: BEAN_MAP_MARKER_SIZE }]}>
        <View style={[styles.beanFallback, { width: BEAN_MAP_MARKER_SIZE, height: BEAN_MAP_MARKER_SIZE }]} />
      </View>
    );
  }

  return (
    <View style={[styles.beanWrap, { width: BEAN_MAP_MARKER_SIZE }]} pointerEvents="none">
      <SvgComponent
        width={BEAN_MAP_MARKER_SIZE}
        height={BEAN_MAP_MARKER_SIZE}
        preserveAspectRatio="xMidYMid meet"
        accessibilityElementsHidden
      />
    </View>
  );
}

const styles = StyleSheet.create({
  beanWrap: {
    alignItems: 'center',
    position: 'relative',
  },
  beanFallback: {
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
});
