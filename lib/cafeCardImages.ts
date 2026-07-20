import { useEffect, useMemo, useState } from 'react';

import type { Cafe } from '@/data/cafes';
import { fetchCafesByIdsOrdered } from '@/lib/cafeCatalogSupabase';
import {
  CAFE_PLACEHOLDER_IMAGE_URL,
  resolveLiveCafePrimaryImageUrl,
} from '@/lib/cafeLiveImages';
import {
  fetchApprovedCafePhotoUrlsByCafeIds,
  mergeApprovedPhotosIntoCafes,
} from '@/lib/cafePhotoSubmissions';

/**
 * Hydrate café rows the same way list/search cards do:
 * catalog row + approved `cafe_photos` (primary / sort_order) merged into `imageUrls`.
 */
export async function loadCafesWithCardImages(ids: string[]): Promise<Cafe[]> {
  const uniqueIds = Array.from(
    new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))
  );
  if (uniqueIds.length === 0) return [];

  const cafes = await fetchCafesByIdsOrdered(uniqueIds);
  const photoMap = await fetchApprovedCafePhotoUrlsByCafeIds(cafes.map((cafe) => cafe.id));
  return mergeApprovedPhotosIntoCafes(cafes, photoMap);
}

/**
 * Single image URL for workspace cards and Beaned Bulletin.
 * Prefer approved primary cafe_photos (already merged onto `cafe`), else listing `image_urls`, else placeholder.
 */
export function resolveWorkspaceCardImageUrl(
  cafe: Cafe | null | undefined,
  overrideImageUrl?: string | null
): string {
  if (!cafe) return CAFE_PLACEHOLDER_IMAGE_URL;
  return resolveLiveCafePrimaryImageUrl({ cafe, overrideImageUrl }) || CAFE_PLACEHOLDER_IMAGE_URL;
}

/**
 * Load cafés by id with card-image hydration (not limited to Beaned Picks / certified).
 * Use for Bulletin thumbs so they match Search/Saved cards for newly created spaces.
 */
export function useCafesByIdsWithCardImages(ids: readonly string[]): Cafe[] {
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const idsKey = useMemo(
    () =>
      Array.from(new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean)))
        .sort()
        .join('|'),
    [ids]
  );

  useEffect(() => {
    let cancelled = false;
    if (!idsKey) {
      setCafes([]);
      return;
    }
    void loadCafesWithCardImages(idsKey.split('|')).then((rows) => {
      if (!cancelled) setCafes(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return cafes;
}
