import { supabase } from '@/lib/supabase';
import { cafeHasAllCanonicalSlugs, getAllDbValuesForCanonicalTag, resolveToCanonicalTagSlug } from '@/lib/tagRegistry';

/**
 * Search tag filtering should require a meaningful signal:
 * - Either the cafe has the canonical tag as a curated catalog tag (cafe.tags → canonical slug),
 * - OR the tag appears on at least N distinct ratings for that cafe (rating_tags joined through ratings).
 */

export const TAG_SIGNAL = {
  /** Minimum distinct ratings that must include the tag to count as “meaningful”. */
  minRatingsPerTag: 3,
  /** Limit cafes considered for tag signal fetch (keeps the query bounded). */
  maxCafeIds: 250,
} as const;

// (No exported row types; Supabase responses are handled structurally.)

/**
 * Fetches which cafes qualify (meaningfully) for each selected canonical tag slug.
 * Returns a map: canonicalTagSlug -> set of cafe_id (string) that meet the threshold.
 */
export async function fetchMeaningfulCafeIdsByCanonicalTag(
  cafeIds: string[],
  selectedCanonicalSlugs: string[]
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  for (const slug of selectedCanonicalSlugs) {
    out.set(slug, new Set());
  }

  const uniqCafeIds = Array.from(new Set(cafeIds)).slice(0, TAG_SIGNAL.maxCafeIds);
  const uniqSelected = Array.from(new Set(selectedCanonicalSlugs.map((s) => s.trim().toLowerCase()))).filter(Boolean);
  if (uniqCafeIds.length === 0 || uniqSelected.length === 0) return out;

  const numericCafeIds = uniqCafeIds
    .map((id) => Number.parseInt(String(id), 10))
    .filter((n): n is number => Number.isFinite(n));
  if (numericCafeIds.length === 0) return out;

  // Two-step fetch (reliable + explainable):
  // 1) ratings for these cafes -> rating_ids
  // 2) rating_tags for those rating_ids + selected tag slugs -> count per cafe per tag
  const ratingsRes = await supabase
    .from('ratings')
    .select('id,cafe_id')
    .in('cafe_id', numericCafeIds);

  if (ratingsRes.error) {
    console.warn('[SearchTagSignal] fetch ratings failed:', ratingsRes.error.message);
    return out;
  }

  const ratingRows = ratingsRes.data ?? [];
  const ratingIds = ratingRows
    .map((r) => (typeof r.id === 'number' ? r.id : null))
    .filter((x): x is number => x != null);
  if (ratingIds.length === 0) return out;

  const ratingIdToCafeId = new Map<number, string>();
  for (const r of ratingRows) {
    const rid = typeof r.id === 'number' ? r.id : null;
    const cid = typeof r.cafe_id === 'number' ? r.cafe_id : null;
    if (rid != null && cid != null) {
      ratingIdToCafeId.set(rid, String(cid));
    }
  }

  const selectedDbValues = Array.from(
    new Set(
      uniqSelected.flatMap((s) => {
        const slug = resolveToCanonicalTagSlug(s);
        return slug ? getAllDbValuesForCanonicalTag(slug) : [s];
      })
    )
  );

  const tagsRes = await supabase
    .from('rating_tags')
    .select('tag,rating_id')
    .in('rating_id', ratingIds)
    .in('tag', selectedDbValues);

  if (tagsRes.error) {
    console.warn('[SearchTagSignal] fetch rating_tags failed:', tagsRes.error.message);
    return out;
  }

  // Count DISTINCT ratings that included each tag per cafe.
  const cafeToSlugToRatingIds = new Map<string, Map<string, Set<number>>>();

  for (const row of tagsRes.data ?? []) {
    const rid = typeof row.rating_id === 'number' ? row.rating_id : null;
    const rawTag = typeof row.tag === 'string' ? row.tag : '';
    if (rid == null || !rawTag) continue;
    const cafeId = ratingIdToCafeId.get(rid);
    if (!cafeId) continue;
    const slug = resolveToCanonicalTagSlug(rawTag);
    if (!slug) continue;
    if (!out.has(slug)) continue;

    if (!cafeToSlugToRatingIds.has(cafeId)) cafeToSlugToRatingIds.set(cafeId, new Map());
    const inner = cafeToSlugToRatingIds.get(cafeId)!;
    if (!inner.has(slug)) inner.set(slug, new Set());
    inner.get(slug)!.add(rid);
  }

  for (const [cafeId, slugMap] of cafeToSlugToRatingIds) {
    for (const [slug, set] of slugMap) {
      if (set.size >= TAG_SIGNAL.minRatingsPerTag) {
        out.get(slug)?.add(cafeId);
      }
    }
  }

  return out;
}

/**
 * True if a cafe matches all selected canonical tags with meaningful signal:
 * - curated catalog tag match (fast path) OR
 * - rating-derived count threshold.
 */
export function cafeMatchesSelectedCanonicalTagsMeaningfully(
  cafe: { id: string; tags?: string[] },
  selectedCanonicalSlugs: string[],
  meaningfulCafeIdsBySlug: Map<string, Set<string>>
): boolean {
  if (selectedCanonicalSlugs.length === 0) return true;

  // If the catalog already contains these canonical tags, treat that as meaningful.
  if (cafeHasAllCanonicalSlugs(cafe, selectedCanonicalSlugs)) {
    return true;
  }

  // Otherwise require rating-derived evidence.
  const id = String(cafe.id);
  return selectedCanonicalSlugs.every((slug) => meaningfulCafeIdsBySlug.get(slug)?.has(id) ?? false);
}

