import type { Cafe } from '@/data/cafes';
import { mapCafeRowToCafe } from '@/lib/cafeCatalogSupabase';
import { getCanonicalSlugsFromCafeTags } from '@/lib/tagRegistry';
import type { CanonicalTagSlug } from '@/lib/tagRegistry';
import { supabase } from '@/lib/supabase';

const PUBLIC_SAMPLE_LIMIT = 100;
export const PUBLIC_LANDING_CAFE_MAX = 8;

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

export function pickCafesForTagSlugs(
  cafes: Cafe[],
  tagSlugs: readonly CanonicalTagSlug[],
  options?: { londonOnly?: boolean; max?: number }
): Cafe[] {
  const max = options?.max ?? PUBLIC_LANDING_CAFE_MAX;
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
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.cafe.name.localeCompare(b.cafe.name));

  return ranked.slice(0, max).map((row) => row.cafe);
}
