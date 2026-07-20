import React from 'react';
import type { SvgProps } from 'react-native-svg';

import SvgRaw from '../assets/images/Beaned Logo .svg';

/**
 * Metro/SVGR often exposes the component as `default` (sometimes nested).
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

const SvgComponent = unwrapSvgComponent(SvgRaw);

export type BeanedLogoProps = SvgProps;

export function BeanedLogo({
  width = 135,
  height = 32,
  style,
  ...rest
}: BeanedLogoProps) {
  if (!SvgComponent) return null;
  return <SvgComponent width={width} height={height} style={style} {...rest} />;
}
