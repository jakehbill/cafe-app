import { useMemo } from 'react';

import { useDesktopWeb } from '@/hooks/use-desktop-web';
import {
  getDesktopGridColumnCount,
  getDesktopLayoutWidth,
  getDesktopPageMaxWidth,
  type DesktopPageVariant,
} from '@/lib/responsiveWebLayout';

export function useDesktopWebLayout(variant: DesktopPageVariant = 'list') {
  const { isWeb, isDesktopWeb, width } = useDesktopWeb();

  return useMemo(() => {
    const layoutWidth = getDesktopLayoutWidth(width, isDesktopWeb, variant);
    const gridColumns = getDesktopGridColumnCount(width, isDesktopWeb);
    const pageMaxWidth = getDesktopPageMaxWidth(variant);

    return {
      isWeb,
      isDesktopWeb,
      viewportWidth: width,
      layoutWidth,
      gridColumns,
      pageMaxWidth,
    };
  }, [isDesktopWeb, isWeb, variant, width]);
}
