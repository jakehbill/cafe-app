import { useEffect, useMemo, useState } from 'react';

import type { Cafe } from '@/data/cafes';
import {
  fetchApprovedCafePhotoUrlsByCafeIds,
  mergeApprovedPhotosIntoCafes,
} from '@/lib/cafePhotoSubmissions';

/**
 * Merges approved `cafe_photos` onto existing café rows (Home certified catalog, etc.).
 * Bulletin thumbs use `useCafesByIdsWithCardImages` instead so they are not limited to Beaned Picks.
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
