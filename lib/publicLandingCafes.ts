import type { Cafe } from '@/data/cafes';
import { mapCafeRowToCafe } from '@/lib/cafeCatalogSupabase';
import { getCanonicalSlugsFromCafeTags } from '@/lib/tagRegistry';
import type { CanonicalTagSlug } from '@/lib/tagRegistry';
import { supabase } from '@/lib/supabase';

const PUBLIC_SAMPLE_LIMIT = 100;
export const PUBLIC_LANDING_CAFE_MAX = 8;

export type LandingPageDynamicFallbackConfig = {
  tagSlugs?: readonly CanonicalTagSlug[];
  londonOnly?: boolean;
  max?: number;
};

/** Lightweight public sample — capped row count, no full-catalog hydration. */
export async function fetchPublicCafeSample(): Promise<Cafe[]> {
  const res = await supabase.from('cafes').select('*').limit(PUBLIC_SAMPLE_LIMIT);
  if (res.error) {
    console.error('[publicLanding] cafe sample fetch failed:', res.error.message);
    return [];
  }
  const out: Cafe[] = [];
  for (const row of res.data ?? []) {
    const cafe = mapCafeRowToCafe(row as Record<string, unknown>);
    if (cafe) out.push(cafe);
  }
  return out;
}

type CuratedPickRow = {
  sort_order: number | null;
  cafe_id: number | string;
  cafes: Record<string, unknown> | Record<string, unknown>[] | null;
};

/** Manual picks from `public_landing_cafe_picks` joined to `cafes`, ordered by sort_order. */
export async function fetchCuratedLandingCafes(pageSlug: string): Promise<Cafe[]> {
  const slug = String(pageSlug ?? '').trim();
  if (!slug) return [];

  const res = await supabase
    .from('public_landing_cafe_picks')
    .select('sort_order, cafe_id, cafes(*)')
    .eq('page_slug', slug)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (res.error) {
    console.error('[publicLanding] curated picks fetch failed:', res.error.message);
    return [];
  }

  const out: Cafe[] = [];
  const seenIds = new Set<string>();

  for (const row of (res.data ?? []) as CuratedPickRow[]) {
    const joined = row.cafes;
    const cafeRow = Array.isArray(joined) ? joined[0] : joined;
    if (!cafeRow) continue;

    const cafe = mapCafeRowToCafe(cafeRow);
    if (!cafe || seenIds.has(cafe.id)) continue;
    seenIds.add(cafe.id);
    out.push(cafe);
  }

  return out;
}

export function pickCafesForTagSlugs(
  cafes: Cafe[],
  tagSlugs: readonly CanonicalTagSlug[],
  options?: { londonOnly?: boolean; max?: number; excludeCafeIds?: ReadonlySet<string> }
): Cafe[] {
  const max = options?.max ?? PUBLIC_LANDING_CAFE_MAX;
  const exclude = options?.excludeCafeIds;

  const ranked = cafes
    .map((cafe) => {
      const present = getCanonicalSlugsFromCafeTags(cafe.tags);
      let score = tagSlugs.filter((slug) => present.has(slug)).length;
      if (options?.londonOnly) {
        const area = `${cafe.neighborhood} ${cafe.name}`.toLowerCase();
        if (area.includes('london')) score += 0.5;
      }
      return { cafe, score };
    })
    .filter((row) => row.score > 0 && !exclude?.has(row.cafe.id))
    .sort((a, b) => b.score - a.score || a.cafe.name.localeCompare(b.cafe.name));

  return ranked.slice(0, max).map((row) => row.cafe);
}

async function fetchDynamicFallbackCafes(
  config: LandingPageDynamicFallbackConfig,
  options: { remainingSlots: number; excludeCafeIds: ReadonlySet<string> }
): Promise<Cafe[]> {
  const { remainingSlots, excludeCafeIds } = options;
  if (remainingSlots <= 0) return [];
  if (!config.tagSlugs?.length) return [];

  const sample = await fetchPublicCafeSample();
  return pickCafesForTagSlugs(sample, config.tagSlugs, {
    londonOnly: config.londonOnly,
    max: remainingSlots,
    excludeCafeIds,
  });
}

/**
 * Landing page cafés: manual `public_landing_cafe_picks` first, then tag-based fallback.
 * Deduplicates by café id; manual order is preserved.
 */
export async function getLandingPageCafes(
  pageSlug: string,
  fallback?: LandingPageDynamicFallbackConfig
): Promise<Cafe[]> {
  const max = fallback?.max ?? PUBLIC_LANDING_CAFE_MAX;

  let curated: Cafe[] = [];
  try {
    curated = await fetchCuratedLandingCafes(pageSlug);
  } catch (error) {
    console.error('[publicLanding] curated picks threw:', error);
  }

  const curatedTrimmed = curated.slice(0, max);
  const curatedIds = new Set(curatedTrimmed.map((cafe) => cafe.id));
  const remainingSlots = Math.max(0, max - curatedTrimmed.length);

  let dynamic: Cafe[] = [];
  if (remainingSlots > 0 && fallback?.tagSlugs?.length) {
    try {
      dynamic = await fetchDynamicFallbackCafes(fallback, {
        remainingSlots,
        excludeCafeIds: curatedIds,
      });
    } catch (error) {
      console.error('[publicLanding] dynamic fallback threw:', error);
    }
  }

  return [...curatedTrimmed, ...dynamic].slice(0, max);
}
