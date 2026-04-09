import React from 'react';

import { CoffeeScoreBadge, type CoffeeScoreBadgeSize } from '@/components/CoffeeScoreBadge';
import type { Cafe } from '@/data/cafes';
import { formatPublicCoffeeOutOf5 } from '@/lib/publicCoffeeDisplay';

type Props = {
  cafe: Cafe;
  /**
   * `badge` — outlined circle (default). `text` — hero typography only (cafe detail).
   */
  presentation?: 'badge' | 'text';
  /**
   * Placement / density — maps to `CoffeeScoreBadge` size when `presentation` is `badge`.
   * `homeTagsRow` — Home featured card tag row (not cafe detail; use `presentation="text"` there).
   * `overlayThumb` — compact card image corner / Visited content column.
   * `overlaySearch` — Search/Saved title row.
   */
  variant?: 'default' | 'list' | 'homeTagsRow' | 'overlayThumb' | 'overlaySearch';
};

const VARIANT_TO_SIZE: Record<NonNullable<Props['variant']>, CoffeeScoreBadgeSize> = {
  list: 'small',
  default: 'medium',
  overlayThumb: 'small',
  overlaySearch: 'medium',
  homeTagsRow: 'large',
};

/**
 * Public coffee score (`cafe.publicCoffeeScore` ← `public.cafe_public_scores`).
 * Delegates to `CoffeeScoreBadge` (editorial outlined badge or detail hero text).
 */
export function PublicCoffeeScoreText({
  cafe,
  variant = 'default',
  presentation = 'badge',
}: Props) {
  const publicCoffeeLabel = formatPublicCoffeeOutOf5(cafe.publicCoffeeScore);
  const size = VARIANT_TO_SIZE[variant];

  return (
    <CoffeeScoreBadge
      scoreLabel={publicCoffeeLabel}
      variant={presentation === 'text' ? 'text' : 'badge'}
      size={presentation === 'text' ? undefined : size}
    />
  );
}
