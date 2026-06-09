import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { DESKTOP_WEB_BREAKPOINT } from '@/lib/responsiveWebLayout';

export function useDesktopWeb() {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    const isWeb = Platform.OS === 'web';
    const safeWidth = typeof width === 'number' && Number.isFinite(width) && width > 0 ? width : 0;
    const isDesktopWeb = isWeb && safeWidth >= DESKTOP_WEB_BREAKPOINT;
    return { isWeb, isDesktopWeb, width: safeWidth };
  }, [width]);
}
