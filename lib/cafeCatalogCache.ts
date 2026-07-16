import type { Cafe } from '@/data/cafes';
import { fetchAllCafesFromSupabase } from '@/lib/cafeCatalogSupabase';

/** How long a cached catalog stays fresh before a background refetch. */
export const CAFE_CATALOG_STALE_MS = 15 * 60 * 1000;

type CacheEntry = {
  cafes: Cafe[];
  fetchedAt: number;
};

let cache: CacheEntry | null = null;
let inFlight: Promise<Cafe[]> | null = null;

export function getCachedCafeCatalog(): Cafe[] | null {
  return cache?.cafes ?? null;
}

export function isCafeCatalogStale(maxAgeMs: number = CAFE_CATALOG_STALE_MS): boolean {
  if (!cache) return true;
  return Date.now() - cache.fetchedAt > maxAgeMs;
}

export function invalidateCafeCatalogCache(): void {
  cache = null;
}

/**
 * Shared in-memory catalog loader (one network fetch per session / stale window).
 * List views skip per-row approved-photo hydration; cards use `image_urls` until
 * `useCafesWithApprovedPhotos` loads URLs for visible ids only.
 */
export async function loadCafeCatalogCached(options?: {
  force?: boolean;
}): Promise<Cafe[]> {
  if (!options?.force && cache && !isCafeCatalogStale()) {
    return cache.cafes;
  }

  if (!options?.force && inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    const cafes = await fetchAllCafesFromSupabase({ activeOnly: true });
    cache = { cafes, fetchedAt: Date.now() };
    inFlight = null;
    return cafes;
  })();

  try {
    return await inFlight;
  } catch (e) {
    inFlight = null;
    throw e;
  }
}
