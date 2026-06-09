import type { ViewStyle } from 'react-native';

/** Viewport width at which web layout switches to centered desktop column. */
export const DESKTOP_WEB_BREAKPOINT = 768;

/** Max width for core in-app screens on desktop web (mobile-app column). */
export const DESKTOP_APP_MAX_WIDTH = 480;

/** Full-width shell — centers the inner column on desktop web only. */
export function getDesktopWebOuterShellStyle(): ViewStyle {
  return {
    alignItems: 'center',
  };
}

/** Inner app column — never applied to Stack contentStyle (avoids RN Web collapse). */
export function getDesktopWebInnerColumnStyle(
  maxWidth: number = DESKTOP_APP_MAX_WIDTH
): ViewStyle {
  return {
    maxWidth,
  };
}
