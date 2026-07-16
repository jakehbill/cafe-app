import type { Cafe } from '@/data/cafes';
import { parseCafeTagsField } from '@/lib/cafeTags';
import {
  TAG_REGISTRY,
  resolveToCanonicalTagSlug,
  type CanonicalTagSlug,
} from '@/lib/tagRegistry';
import { getCafeTagPopularityOrdered } from '@/lib/supabase';

/** Max tags on compact cards and café detail “Features” row. */
export const CAFE_FEATURED_TAG_COUNT = 3;

/** Café detail page: featured (3) + “Also good for” (5) = 8 visible tags max. */
export const CAFE_DETAIL_MAX_VISIBLE_TAGS = 8;
export const CAFE_DETAIL_ALSO_GOOD_FOR_MAX =
  CAFE_DETAIL_MAX_VISIBLE_TAGS - CAFE_FEATURED_TAG_COUNT;

/**
 * Work-first tag order for cards (“Would I work here today?”).
 * Prefer these when present; do not invent empty placeholders.
 */
export const WORK_CARD_PRIORITY_SLUGS: readonly CanonicalTagSlug[] = [
  'good_for_calls',
  'quiet',
  'good_wifi',
  'has_outlets',
  'comfortable_seating',
  'spacious',
  'good_natural_light',
  'long_stays_welcome',
  'air_conditioning',
  'good_for_working',
  'open_late',
  'friendly_staff',
];

function tagKey(raw: string): string {
  return resolveToCanonicalTagSlug(raw) ?? raw.trim().toLowerCase();
}

function isWorkOrientedTag(raw: string): boolean {
  const slug = resolveToCanonicalTagSlug(raw);
  if (!slug) return false;
  if ((WORK_CARD_PRIORITY_SLUGS as readonly string[]).includes(slug)) return true;
  return TAG_REGISTRY[slug]?.category === 'Work';
}

/**
 * Reorder an already-deduped tag list so work attributes come first.
 * Relative order within work / non-work groups is preserved.
 */
export function prioritizeWorkTagsForCards(orderedTags: string[]): string[] {
  if (orderedTags.length <= 1) return orderedTags;

  const bySlug = new Map<string, string>();
  for (const raw of orderedTags) {
    const key = tagKey(raw);
    if (!key || bySlug.has(key)) continue;
    bySlug.set(key, raw.trim());
  }

  const workFirst: string[] = [];
  const seen = new Set<string>();

  for (const slug of WORK_CARD_PRIORITY_SLUGS) {
    const display = bySlug.get(slug);
    if (!display) continue;
    workFirst.push(display);
    seen.add(slug);
  }

  for (const raw of orderedTags) {
    const key = tagKey(raw);
    if (!key || seen.has(key)) continue;
    if (isWorkOrientedTag(raw)) {
      workFirst.push(raw.trim());
      seen.add(key);
    }
  }

  const rest: string[] = [];
  for (const raw of orderedTags) {
    const key = tagKey(raw);
    if (!key || seen.has(key)) continue;
    rest.push(raw.trim());
    seen.add(key);
  }

  return [...workFirst, ...rest];
}

/**
 * Merges editorial catalog tags with community popularity order.
 * Sort: highest community usage first; ties use catalog order, then slug order.
 * Then work-oriented tags are promoted for card hierarchy.
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

  return prioritizeWorkTagsForCards(entries.map((e) => e.display));
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
