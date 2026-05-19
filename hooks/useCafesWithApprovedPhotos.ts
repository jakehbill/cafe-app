import { useEffect, useMemo, useState } from 'react';

import type { Cafe } from '@/data/cafes';
import {
  fetchApprovedCafePhotoUrlsByCafeIds,
  mergeApprovedPhotosIntoCafes,
} from '@/lib/cafePhotoSubmissions';

/**
 * Refreshes approved `cafe_photos` URLs onto café rows for list/search/bulletin cards.
 * Detail pages still call `getApprovedCafePhotoUrls` directly; this keeps catalog cards in sync.
 */
export function useCafesWithApprovedPhotos(cafes: Cafe[]): Cafe[] {
  const [photoMap, setPhotoMap] = useState<Map<string, string[]>>(new Map());

  const cafeIdsKey = useMemo(
    () =>
      cafes
        .map((cafe) => cafe.id)
        .sort()
        .join('|'),
    [cafes]
  );

  useEffect(() => {
    let cancelled = false;
    const ids = cafes.map((cafe) => cafe.id);
    void fetchApprovedCafePhotoUrlsByCafeIds(ids).then((map) => {
      if (!cancelled) setPhotoMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [cafeIdsKey, cafes]);

  return useMemo(
    () => mergeApprovedPhotosIntoCafes(cafes, photoMap),
    [cafes, photoMap]
  );
}
