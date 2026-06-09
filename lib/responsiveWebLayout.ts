import type { ViewStyle } from 'react-native';

/** Viewport width at which web layout switches to desktop-enhanced mode. */
export const DESKTOP_WEB_BREAKPOINT = 768;

/** Browsing / list screens on desktop web. */
export const DESKTOP_LIST_MAX_WIDTH = 1080;

/** Focused forms and auth flows on desktop web. */
export const DESKTOP_FORM_MAX_WIDTH = 520;

/** Café detail on desktop web. */
export const DESKTOP_DETAIL_MAX_WIDTH = 760;

/** Sensible cap for individual café cards in desktop grids. */
export const DESKTOP_CARD_MAX_WIDTH = 360;

/** Use a third grid column when the viewport is wide enough. */
export const DESKTOP_GRID_3COL_MIN_WIDTH = 1040;

export type DesktopPageVariant = 'list' | 'form' | 'detail';

export function getDesktopPageMaxWidth(variant: DesktopPageVariant): number {
  switch (variant) {
    case 'form':
      return DESKTOP_FORM_MAX_WIDTH;
    case 'detail':
      return DESKTOP_DETAIL_MAX_WIDTH;
    case 'list':
    default:
      return DESKTOP_LIST_MAX_WIDTH;
  }
}

export function getDesktopGridColumnCount(viewportWidth: number, isDesktopWeb: boolean): number {
  if (!isDesktopWeb) return 1;
  const safeWidth =
    typeof viewportWidth === 'number' && Number.isFinite(viewportWidth) && viewportWidth > 0
      ? viewportWidth
      : 0;
  if (safeWidth >= DESKTOP_GRID_3COL_MIN_WIDTH) return 3;
  if (safeWidth >= DESKTOP_WEB_BREAKPOINT) return 2;
  return 1;
}

/** Width used for carousel / hero sizing — caps to page max on desktop web. */
export function getDesktopLayoutWidth(
  viewportWidth: number,
  isDesktopWeb: boolean,
  variant: DesktopPageVariant = 'list'
): number {
  const safeWidth =
    typeof viewportWidth === 'number' && Number.isFinite(viewportWidth) && viewportWidth > 0
      ? viewportWidth
      : 0;
  if (!isDesktopWeb) return safeWidth;
  return Math.min(safeWidth, getDesktopPageMaxWidth(variant));
}

/** Full-width shell — centers the inner column on desktop web only. */
export function getDesktopWebOuterShellStyle(): ViewStyle {
  return {
    alignItems: 'center',
  };
}

/** Inner page column — applied via DesktopWebPageContainer, not Stack contentStyle. */
export function getDesktopWebInnerColumnStyle(maxWidth: number): ViewStyle {
  return {
    maxWidth,
  };
}
