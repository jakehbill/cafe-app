import type { Cafe } from '@/data/cafes';
import { parseCafeTagsField } from '@/lib/cafeTags';
import { resolveToCanonicalTagSlug } from '@/lib/tagRegistry';
import { getCafeTagPopularityOrdered } from '@/lib/supabase';

/** Max tags on compact cards and café detail “Features” row. */
export const CAFE_FEATURED_TAG_COUNT = 3;

function tagKey(raw: string): string {
  return resolveToCanonicalTagSlug(raw) ?? raw.trim().toLowerCase();
}

/**
 * Merges editorial catalog tags with community popularity order.
 * Sort: highest community usage first; ties use catalog order, then slug order.
 */
export function orderCafeTagsByPopularity(
  catalogTags: string[],
  communityTagsByPopularity: string[]
): string[] {
  const communityIndex = new Map<string, number>();
  for (let i = 0; i < communityTagsByPopularity.length; i++) {
    const key = tagKey(communityTagsByPopularity[i]);
    if (!communityIndex.has(key)) communityIndex.set(key, i);
  }

  const catalogIndex = new Map<string, number>();
  for (let i = 0; i < catalogTags.length; i++) {
    const key = tagKey(catalogTags[i]);
    if (!catalogIndex.has(key)) catalogIndex.set(key, i);
  }

  const entries: { key: string; display: string }[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key = tagKey(trimmed);
    if (!key || seen.has(key)) return;
    seen.add(key);
    entries.push({ key, display: trimmed });
  };

  for (const t of catalogTags) push(t);
  for (const t of communityTagsByPopularity) push(t);

  entries.sort((a, b) => {
    const ra = communityIndex.has(a.key) ? communityIndex.get(a.key)! : Number.MAX_SAFE_INTEGER;
    const rb = communityIndex.has(b.key) ? communityIndex.get(b.key)! : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    const ca = catalogIndex.has(a.key) ? catalogIndex.get(a.key)! : Number.MAX_SAFE_INTEGER;
    const cb = catalogIndex.has(b.key) ? catalogIndex.get(b.key)! : Number.MAX_SAFE_INTEGER;
    if (ca !== cb) return ca - cb;
    return a.key.localeCompare(b.key);
  });

  return entries.map((e) => e.display);
}

export type CafeTagDisplaySets = {
  featured: string[];
  remaining: string[];
  allOrdered: string[];
};

export async function resolveCafeTagDisplaySets(
  cafe: Cafe,
  featuredLimit = CAFE_FEATURED_TAG_COUNT
): Promise<CafeTagDisplaySets> {
  const catalogTags = parseCafeTagsField(cafe.tags);
  const communityOrdered = await getCafeTagPopularityOrdered(cafe.id);
  const allOrdered = orderCafeTagsByPopularity(catalogTags, communityOrdered);
  return {
    featured: allOrdered.slice(0, featuredLimit),
    remaining: allOrdered.slice(featuredLimit),
    allOrdered,
  };
}

/** Top N featured tags for cards and detail header (same ranking as `resolveCafeTagDisplaySets`). */
export async function resolveCafeDisplayTags(
  cafe: Cafe,
  limit = CAFE_FEATURED_TAG_COUNT
): Promise<string[]> {
  const { featured } = await resolveCafeTagDisplaySets(cafe, limit);
  return featured;
}
