import React from 'react';
import { StyleSheet, View } from 'react-native';

import { BeanCoffeeBackdrop, isBeanCoffeeSvgAvailable } from '@/components/BeanCoffeeBackdrop';

/**
 * Shared hero-scale bean for auth + onboarding CTA.
 * SVG uses brand orange fills (`#e15c31`); size is consistent across surfaces.
 */
export const AUTH_BRAND_BEAN_SIZE = 52;

export function AuthBrandBean() {
  if (!isBeanCoffeeSvgAvailable()) {
    return null;
  }

  return (
    <View style={styles.wrap} accessibilityElementsHidden>
      <BeanCoffeeBackdrop width={AUTH_BRAND_BEAN_SIZE} height={AUTH_BRAND_BEAN_SIZE} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
  },
});
