import { useEffect, useMemo, useState } from 'react';

import type { Cafe } from '@/data/cafes';
import { fetchAllCafesFromSupabase } from '@/lib/cafeCatalogSupabase';

/**
 * Loads the full cafe catalog from Supabase once on mount.
 * Used by Home, Search, and map when the full list is needed for ranking or markers.
 */
export function useCafeCatalog() {
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await fetchAllCafesFromSupabase();
      if (!cancelled) {
        setCafes(list);
        setLoading(false);
        if (__DEV__) {
          const payload = {
            loading: false,
            finalCafeCountPassedToUI: list.length,
            firstCafeSample: list[0] ? { id: list[0].id, name: list[0].name } : null,
          };
          try {
            console.log(
              `[DEBUG useCafeCatalog → Home/Search/Map]\n${JSON.stringify(payload, null, 2)}`
            );
          } catch {
            console.log('[DEBUG useCafeCatalog → Home/Search/Map]', payload);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useMemo(() => {
    const next: Record<string, Cafe> = {};
    for (const c of cafes) {
      next[c.id] = c;
    }
    return next;
  }, [cafes]);

  return { cafes, loading, byId };
}
