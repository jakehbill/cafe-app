import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Cafe } from '@/data/cafes';
import { subscribeCafeCatalogInvalidation } from '@/lib/cafeCatalogEvents';
import { fetchAllCafesFromSupabase } from '@/lib/cafeCatalogSupabase';

export type UseCafeCatalogOptions = {
  /**
   * Homepage curated feed — `status = active` AND `is_certified = true`.
   * Search/maps leave this false (active only).
   */
  certifiedOnly?: boolean;
};

/**
 * Loads the cafe catalog from Supabase once on mount.
 * Always restricted to `status = 'active'`. Optionally certified-only for Home.
 * Refetches when a workspace review notifies catalog invalidation.
 */
export function useCafeCatalog(options: UseCafeCatalogOptions = {}) {
  const certifiedOnly = options.certifiedOnly === true;
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    const list = await fetchAllCafesFromSupabase({
      activeOnly: true,
      certifiedOnly,
    });
    setCafes(list);
    setLoading(false);
    if (__DEV__) {
      const payload = {
        loading: false,
        certifiedOnly,
        finalCafeCountPassedToUI: list.length,
        firstCafeSample: list[0]
          ? { id: list[0].id, name: list[0].name, isCertified: list[0].isCertified }
          : null,
      };
      try {
        console.log(
          `[DEBUG useCafeCatalog → Home/Search/Map]\n${JSON.stringify(payload, null, 2)}`
        );
      } catch {
        console.log('[DEBUG useCafeCatalog → Home/Search/Map]', payload);
      }
    }
  }, [certifiedOnly]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await fetchAllCafesFromSupabase({
        activeOnly: true,
        certifiedOnly,
      });
      if (cancelled) return;
      setCafes(list);
      setLoading(false);
      if (__DEV__) {
        const payload = {
          loading: false,
          certifiedOnly,
          finalCafeCountPassedToUI: list.length,
          firstCafeSample: list[0]
            ? { id: list[0].id, name: list[0].name, isCertified: list[0].isCertified }
            : null,
        };
        try {
          console.log(
            `[DEBUG useCafeCatalog → Home/Search/Map]\n${JSON.stringify(payload, null, 2)}`
          );
        } catch {
          console.log('[DEBUG useCafeCatalog → Home/Search/Map]', payload);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [certifiedOnly]);

  useEffect(() => {
    return subscribeCafeCatalogInvalidation(() => {
      void loadCatalog();
    });
  }, [loadCatalog]);

  const byId = useMemo(() => {
    const next: Record<string, Cafe> = {};
    for (const c of cafes) {
      next[c.id] = c;
    }
    return next;
  }, [cafes]);

  return { cafes, loading, byId, refetch: loadCatalog };
}
