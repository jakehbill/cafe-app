import React from 'react';
import type { SvgProps } from 'react-native-svg';

import BeanSvgRaw from '../assets/images/Bean.svg';

/**
 * Metro/SVGR exposes the SVG as default (sometimes nested). Mirrors `lib/brandAssets` unwrap logic.
 */
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

const SvgComponent = unwrapSvgComponent(BeanSvgRaw);

export function isBeanCoffeeSvgAvailable(): boolean {
  return SvgComponent != null;
}

/** `Bean.svg` for public coffee score lockups (icon beside numerals). */
export function BeanCoffeeBackdrop(props: SvgProps) {
  if (!SvgComponent) {
    return null;
  }
  return <SvgComponent {...props} preserveAspectRatio="xMidYMid meet" accessibilityElementsHidden />;
}
