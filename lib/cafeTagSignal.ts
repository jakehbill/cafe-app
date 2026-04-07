import { supabase } from '@/lib/supabase';
import { resolveToCanonicalTagSlug } from '@/lib/tagRegistry';

/**
 * Search tag filtering uses **rating_tags** joined through **ratings** → `cafe_id` only.
 * Does **not** use `cafes.tags`.
 *
 * Flow:
 * 1) `ratings` where `cafe_id` in (search result cafe ids) → `rating.id`
 * 2) `rating_tags` where `rating_id` in those ids → `tag` strings
 * 3) Map `rating_tags.tag` → canonical slug via `resolveToCanonicalTagSlug`
 * 4) Count distinct `rating_id` per cafe per selected slug; threshold per `TAG_SIGNAL`
 */

export const TAG_SIGNAL = {
  /** Minimum distinct ratings that must include the tag (1 = at least one rating tagged). */
  minDistinctRatingsPerTag: 1,
  maxCafeIds: 250,
  /** PostgREST `.in()` batch size for `rating_id` lists. */
  ratingIdChunkSize: 400,
} as const;

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function fetchRatingTagsForRatingIds(ratingIds: number[]): Promise<{ tag: string; rating_id: number }[]> {
  const out: { tag: string; rating_id: number }[] = [];
  const chunk = TAG_SIGNAL.ratingIdChunkSize;
  for (let i = 0; i < ratingIds.length; i += chunk) {
    const slice = ratingIds.slice(i, i + chunk);
    const tagsRes = await supabase.from('rating_tags').select('tag,rating_id').in('rating_id', slice);
    if (tagsRes.error) {
      console.warn('[SearchTagSignal] fetch rating_tags failed:', tagsRes.error.message);
      continue;
    }
    for (const row of tagsRes.data ?? []) {
      const rid = toFiniteNumber(row.rating_id);
      const rawTag = typeof row.tag === 'string' ? row.tag : '';
      if (rid == null || !rawTag.trim()) continue;
      out.push({ tag: rawTag, rating_id: rid });
    }
  }
  return out;
}

/**
 * Fetches which cafes qualify for each selected canonical tag slug (rating_tags → ratings.cafe_id).
 * Does not filter `rating_tags` by tag in SQL — resolves all rows client-side so legacy DB strings still match.
 */
export async function fetchMeaningfulCafeIdsByCanonicalTag(
  cafeIds: string[],
  selectedCanonicalSlugs: string[]
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  const selectedSet = new Set<string>();
  for (const s of selectedCanonicalSlugs) {
    const slug = resolveToCanonicalTagSlug(s);
    if (!slug) continue;
    selectedSet.add(slug);
    out.set(slug, new Set());
  }
  if (selectedSet.size === 0) return out;

  const uniqCafeIds = Array.from(new Set(cafeIds)).slice(0, TAG_SIGNAL.maxCafeIds);
  if (uniqCafeIds.length === 0) return out;

  const numericCafeIds = uniqCafeIds
    .map((id) => toFiniteNumber(id))
    .filter((n): n is number => n != null);
  if (numericCafeIds.length === 0) return out;

  const ratingsRes = await supabase.from('ratings').select('id,cafe_id').in('cafe_id', numericCafeIds);

  if (ratingsRes.error) {
    console.warn('[SearchTagSignal] fetch ratings failed:', ratingsRes.error.message);
    return out;
  }

  const ratingRows = ratingsRes.data ?? [];
  const ratingIds: number[] = [];
  const ratingIdToCafeId = new Map<number, string>();

  for (const r of ratingRows) {
    const rid = toFiniteNumber(r.id);
    const cid = toFiniteNumber(r.cafe_id);
    if (rid == null || cid == null) continue;
    ratingIds.push(rid);
    ratingIdToCafeId.set(rid, String(cid));
  }

  if (ratingIds.length === 0) return out;

  const tagRows = await fetchRatingTagsForRatingIds(ratingIds);

  const cafeToSlugToRatingIds = new Map<string, Map<string, Set<number>>>();

  for (const { tag: rawTag, rating_id: rid } of tagRows) {
    const cafeId = ratingIdToCafeId.get(rid);
    if (!cafeId) continue;
    const slug = resolveToCanonicalTagSlug(rawTag);
    if (!slug || !selectedSet.has(slug)) continue;

    if (!cafeToSlugToRatingIds.has(cafeId)) cafeToSlugToRatingIds.set(cafeId, new Map());
    const inner = cafeToSlugToRatingIds.get(cafeId)!;
    if (!inner.has(slug)) inner.set(slug, new Set());
    inner.get(slug)!.add(rid);
  }

  for (const [cafeId, slugMap] of cafeToSlugToRatingIds) {
    for (const [slug, set] of slugMap) {
      if (set.size >= TAG_SIGNAL.minDistinctRatingsPerTag) {
        out.get(slug)?.add(cafeId);
      }
    }
  }

  return out;
}

export function cafeMatchesSelectedCanonicalTagsMeaningfully(
  cafeId: string,
  selectedCanonicalSlugs: string[],
  meaningfulCafeIdsBySlug: Map<string, Set<string>>
): boolean {
  if (selectedCanonicalSlugs.length === 0) return true;
  const id = String(cafeId);
  return selectedCanonicalSlugs.every((raw) => {
    const canon = resolveToCanonicalTagSlug(raw);
    if (!canon) return false;
    return meaningfulCafeIdsBySlug.get(canon)?.has(id) ?? false;
  });
}
