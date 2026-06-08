import type { Cafe } from '@/data/cafes';
import { getCafePhotoUrls } from '@/data/cafes';
import { hydrateCafesWithPublicScores, mapCafeRowToCafe } from '@/lib/cafeCatalogSupabase';
import { CAFE_PLACEHOLDER_IMAGE_URL } from '@/lib/cafeLiveImages';
import {
  fetchApprovedCafePhotoUrlsByCafeIds,
  isUnusableCafePhotoImageUrl,
} from '@/lib/cafePhotoSubmissions';
import {
  CANONICAL_TAG_SLUGS,
  getCanonicalSlugsFromCafeTags,
  TAG_REGISTRY,
  type CanonicalTagSlug,
} from '@/lib/tagRegistry';
import { supabase } from '@/lib/supabase';

const PUBLIC_SAMPLE_LIMIT = 100;
export const PUBLIC_LANDING_CAFE_MAX = 8;

export type LandingPageDynamicFallbackConfig = {
  tagSlugs?: readonly CanonicalTagSlug[];
  londonOnly?: boolean;
  max?: number;
};

/** Broader work-related slugs for `/working-from-cafes` dynamic fallback (registry Work + natural light). */
export const WORK_LANDING_FALLBACK_TAG_SLUGS: readonly CanonicalTagSlug[] = [
  ...CANONICAL_TAG_SLUGS.filter((slug) => TAG_REGISTRY[slug].category === 'Work'),
  'good_natural_light',
];

function isPlaceholderImageUrl(url: string): boolean {
  const normalized = url.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === CAFE_PLACEHOLDER_IMAGE_URL.toLowerCase()) return true;
  return normalized.includes('beaned image placeholder') || normalized.includes('beaned%20image%20placeholder');
}

/**
 * True when the café has a non-placeholder public image (approved `cafe_photos` and/or `cafes.image_urls`).
 */
export function cafeHasRealPublicPhoto(cafe: Cafe, approvedPhotoUrls?: string[]): boolean {
  const candidates = [
    ...(approvedPhotoUrls ?? []),
    ...getCafePhotoUrls(cafe),
  ];
  return candidates.some((url) => {
    const s = String(url ?? '').trim();
    if (!s || isPlaceholderImageUrl(s) || isUnusableCafePhotoImageUrl(s)) return false;
    return /^https?:\/\//i.test(s);
  });
}

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
  options?: {
    londonOnly?: boolean;
    max?: number;
    excludeCafeIds?: ReadonlySet<string>;
    approvedPhotosByCafeId?: ReadonlyMap<string, string[]>;
  }
): Cafe[] {
  const max = options?.max ?? PUBLIC_LANDING_CAFE_MAX;
  const exclude = options?.excludeCafeIds;
  const approvedMap = options?.approvedPhotosByCafeId;

  const ranked = cafes
    .map((cafe) => {
      const present = getCanonicalSlugsFromCafeTags(cafe.tags);
      const matchCount = tagSlugs.filter((slug) => present.has(slug)).length;
      if (matchCount <= 0) return null;

      let tagScore = matchCount;
      if (options?.londonOnly) {
        const area = `${cafe.neighborhood} ${cafe.name}`.toLowerCase();
        if (area.includes('london')) tagScore += 0.5;
      }

      const hasRealPhoto = cafeHasRealPublicPhoto(cafe, approvedMap?.get(cafe.id));
      return { cafe, tagScore, hasRealPhoto };
    })
    .filter((row): row is { cafe: Cafe; tagScore: number; hasRealPhoto: boolean } => {
      if (!row) return false;
      return !exclude?.has(row.cafe.id);
    })
    .sort((a, b) => {
      if (a.hasRealPhoto !== b.hasRealPhoto) return a.hasRealPhoto ? -1 : 1;
      if (b.tagScore !== a.tagScore) return b.tagScore - a.tagScore;
      return a.cafe.name.localeCompare(b.cafe.name);
    });

  return ranked.slice(0, max).map((row) => row.cafe);
}

function resolveFallbackTagSlugs(
  pageSlug: string,
  config: LandingPageDynamicFallbackConfig
): readonly CanonicalTagSlug[] {
  if (pageSlug === 'working-from-cafes') {
    return WORK_LANDING_FALLBACK_TAG_SLUGS;
  }
  return config.tagSlugs ?? [];
}

async function fetchDynamicFallbackCafes(
  pageSlug: string,
  config: LandingPageDynamicFallbackConfig,
  options: { remainingSlots: number; excludeCafeIds: ReadonlySet<string> }
): Promise<Cafe[]> {
  const { remainingSlots, excludeCafeIds } = options;
  if (remainingSlots <= 0) return [];

  const tagSlugs = resolveFallbackTagSlugs(pageSlug, config);
  if (tagSlugs.length === 0) return [];

  const sample = await fetchPublicCafeSample();
  const approvedPhotosByCafeId = await fetchApprovedCafePhotoUrlsByCafeIds(
    sample.map((cafe) => cafe.id)
  );

  return pickCafesForTagSlugs(sample, tagSlugs, {
    londonOnly: config.londonOnly,
    max: remainingSlots,
    excludeCafeIds,
    approvedPhotosByCafeId,
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
      dynamic = await fetchDynamicFallbackCafes(pageSlug, fallback, {
        remainingSlots,
        excludeCafeIds: curatedIds,
      });
    } catch (error) {
      console.error('[publicLanding] dynamic fallback threw:', error);
    }
  }

  const combined = [...curatedTrimmed, ...dynamic].slice(0, max);
  try {
    return await hydrateCafesWithPublicScores(combined);
  } catch (error) {
    console.error('[publicLanding] public score hydration threw:', error);
    return combined;
  }
}
