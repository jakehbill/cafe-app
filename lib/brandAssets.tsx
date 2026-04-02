import React from 'react';
import { Image, type ImageStyle } from 'react-native';
import type { SvgProps } from 'react-native-svg';

import SvgRaw from '../assets/images/Beaned Logo .svg';

const PNG_LOGO = require('../assets/images/Beaned Logo .png');

/**
 * Metro/SVGR often exposes the component as `default` (sometimes nested). If the
 * import is still not a function (misconfigured transformer / platform quirk),
 * we fall back to the PNG so the header never crashes.
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
  accessibilityIgnoresInvertColors,
  ...rest
}: BeanedLogoProps) {
  if (SvgComponent) {
    return (
      <SvgComponent width={width} height={height} style={style} {...rest} />
    );
  }
  const w = typeof width === 'number' ? width : 135;
  const h = typeof height === 'number' ? height : 32;
  const imageStyle: ImageStyle[] = [{ width: w, height: h }];
  if (style) {
    imageStyle.push(style as ImageStyle);
  }
  return (
    <Image
      source={PNG_LOGO}
      style={imageStyle}
      resizeMode="contain"
      accessibilityIgnoresInvertColors={accessibilityIgnoresInvertColors}
    />
  );
}
