import {
  CANONICAL_TAG_SLUGS,
  getCanonicalSlugsFromCafeTags,
  getTagDisplayLabel,
  getTagSections,
  resolveToCanonicalTagSlug,
  type CanonicalTagSlug,
} from '@/lib/tagRegistry';

/** Back-compat facade: Rate/Search/Saved should prefer `tagRegistry` directly. */
export const TAG_SECTIONS = getTagSections();
export const ALL_RATING_TAGS = CANONICAL_TAG_SLUGS;
export type RatingTag = CanonicalTagSlug;

/** UI label (single source of truth now lives in `tagRegistry`). */
export function formatTagLabel(tag: string): string {
  return getTagDisplayLabel(tag);
}

/**
 * Normalizes `cafes.tags` from Supabase (JS array, JSON string, or Postgres `{a,b}` text[] literal).
 * Single parser for catalog mapping and tag display fallbacks.
 */
export function parseCafeTagsField(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw !== 'string') return [];
  const s = raw.trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x).trim()).filter(Boolean);
    }
  } catch {
    /* not JSON */
  }
  if (s.startsWith('{') && s.endsWith('}')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(',')
      .map((part) => part.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  }
  return s
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Resolve any raw tag (slug/label/legacy) to a canonical slug. */
export function resolveCafeTagStringToCanonicalSlug(raw: string): string | null {
  return resolveToCanonicalTagSlug(raw);
}

/** All canonical slugs represented on a cafe's tag list (after resolving mixed formats). */
export function getCanonicalSlugsForCafeTags(cafeTags: string[] | undefined): Set<string> {
  return getCanonicalSlugsFromCafeTags(cafeTags) as unknown as Set<string>;
}

/** True if the cafe's tags resolve to include every required canonical slug (AND). */
export function cafeHasAllCanonicalTagSlugs(
  cafe: { tags?: string[] },
  requiredCanonicalSlugs: string[]
): boolean {
  if (requiredCanonicalSlugs.length === 0) return true;
  const present = getCanonicalSlugsFromCafeTags(cafe.tags);
  return requiredCanonicalSlugs.every((s) => {
    const slug = resolveToCanonicalTagSlug(s);
    return slug ? present.has(slug) : false;
  });
}
