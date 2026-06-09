import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';

import { DesktopWebPageContainer } from '@/components/layout/DesktopWebPageContainer';
import type { DesktopPageVariant } from '@/lib/responsiveWebLayout';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  maxWidth?: number;
  variant?: DesktopPageVariant;
};

/** @deprecated Use DesktopWebPageContainer with a variant instead. */
export function WebMaxWidthContainer({ children, style, variant = 'form' }: Props) {
  return (
    <DesktopWebPageContainer variant={variant} style={style}>
      {children}
    </DesktopWebPageContainer>
  );
}
