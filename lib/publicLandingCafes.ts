import type { Cafe } from '@/data/cafes';
import { getCafePhotoUrls } from '@/data/cafes';
import { hydrateCafesWithPublicScores, mapCafeRowToCafe } from '@/lib/cafeCatalogSupabase';
import { CAFE_PLACEHOLDER_IMAGE_URL } from '@/lib/cafeLiveImages';
import {
  rawPublicCoffeeToOutOf5,
  UNRATED_PUBLIC_COFFEE_DISPLAY_BASELINE,
} from '@/lib/publicCoffeeDisplay';
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

export type CuratedLandingPick = {
  cafe: Cafe;
  sortOrder: number;
};

/** Manual picks from `public_landing_cafe_picks` joined to `cafes`. */
export async function fetchCuratedLandingCafePicks(pageSlug: string): Promise<CuratedLandingPick[]> {
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

  const out: CuratedLandingPick[] = [];
  const seenIds = new Set<string>();

  for (const row of (res.data ?? []) as CuratedPickRow[]) {
    const joined = row.cafes;
    const cafeRow = Array.isArray(joined) ? joined[0] : joined;
    if (!cafeRow) continue;

    const cafe = mapCafeRowToCafe(cafeRow);
    if (!cafe || seenIds.has(cafe.id)) continue;
    seenIds.add(cafe.id);
    const sortOrder =
      typeof row.sort_order === 'number' && Number.isFinite(row.sort_order)
        ? row.sort_order
        : Number.MAX_SAFE_INTEGER;
    out.push({ cafe, sortOrder });
  }

  return out;
}

/** @deprecated Use fetchCuratedLandingCafePicks — kept for callers that only need café rows. */
export async function fetchCuratedLandingCafes(pageSlug: string): Promise<Cafe[]> {
  const picks = await fetchCuratedLandingCafePicks(pageSlug);
  return picks.map((pick) => pick.cafe);
}

/** Sort key for public landing lists — real `cafe_public_scores` average, else UI baseline 4.0. */
export function publicLandingRatingSortKey(cafe: Cafe): number {
  const ratingCount = Math.max(0, Math.floor(cafe.coffeeRatingCount ?? 0));
  if (ratingCount > 0) {
    const normalized = rawPublicCoffeeToOutOf5(cafe.publicCoffeeScore);
    if (normalized != null) return normalized;
  }
  return UNRATED_PUBLIC_COFFEE_DISPLAY_BASELINE;
}

/**
 * Order eligible landing-page cafés: public rating → rating count → manual sort_order → dynamic rank → name.
 */
export function sortLandingPageCafesByPublicRating(
  cafes: Cafe[],
  options: {
    manualSortOrderByCafeId: ReadonlyMap<string, number>;
    dynamicFallbackIndexByCafeId?: ReadonlyMap<string, number>;
  }
): Cafe[] {
  const { manualSortOrderByCafeId, dynamicFallbackIndexByCafeId } = options;

  return [...cafes].sort((a, b) => {
    const ratingA = publicLandingRatingSortKey(a);
    const ratingB = publicLandingRatingSortKey(b);
    if (ratingB !== ratingA) return ratingB - ratingA;

    const countA = Math.max(0, Math.floor(a.coffeeRatingCount ?? 0));
    const countB = Math.max(0, Math.floor(b.coffeeRatingCount ?? 0));
    if (countB !== countA) return countB - countA;

    const manualA = manualSortOrderByCafeId.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const manualB = manualSortOrderByCafeId.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (manualA !== manualB) return manualA - manualB;

    const dynamicA = dynamicFallbackIndexByCafeId?.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const dynamicB = dynamicFallbackIndexByCafeId?.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (dynamicA !== dynamicB) return dynamicA - dynamicB;

    return a.name.localeCompare(b.name);
  });
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

/** Tag-matched dynamic pool (photo/tag ranked) — eligibility only; final order is by public rating. */
async function fetchDynamicFallbackPool(
  pageSlug: string,
  config: LandingPageDynamicFallbackConfig
): Promise<Cafe[]> {
  const tagSlugs = resolveFallbackTagSlugs(pageSlug, config);
  if (tagSlugs.length === 0) return [];

  const sample = await fetchPublicCafeSample();
  const approvedPhotosByCafeId = await fetchApprovedCafePhotoUrlsByCafeIds(
    sample.map((cafe) => cafe.id)
  );

  return pickCafesForTagSlugs(sample, tagSlugs, {
    londonOnly: config.londonOnly,
    max: PUBLIC_SAMPLE_LIMIT,
    approvedPhotosByCafeId,
  });
}

/**
 * Landing page cafés: manual picks + dynamic fallback eligibility, then ordered by public rating.
 */
export async function getLandingPageCafes(
  pageSlug: string,
  fallback?: LandingPageDynamicFallbackConfig
): Promise<Cafe[]> {
  const max = fallback?.max ?? PUBLIC_LANDING_CAFE_MAX;
  const fallbackConfig = fallback ?? {};

  let curatedPicks: CuratedLandingPick[] = [];
  try {
    curatedPicks = await fetchCuratedLandingCafePicks(pageSlug);
  } catch (error) {
    console.error('[publicLanding] curated picks threw:', error);
  }

  const manualSortOrderByCafeId = new Map(
    curatedPicks.map((pick) => [pick.cafe.id, pick.sortOrder] as const)
  );

  let dynamicPool: Cafe[] = [];
  if (resolveFallbackTagSlugs(pageSlug, fallbackConfig).length > 0) {
    try {
      dynamicPool = await fetchDynamicFallbackPool(pageSlug, fallbackConfig);
    } catch (error) {
      console.error('[publicLanding] dynamic fallback threw:', error);
    }
  }

  const dynamicFallbackIndexByCafeId = new Map(
    dynamicPool.map((cafe, index) => [cafe.id, index] as const)
  );

  const eligibleById = new Map<string, Cafe>();
  for (const pick of curatedPicks) {
    eligibleById.set(pick.cafe.id, pick.cafe);
  }
  for (const cafe of dynamicPool) {
    if (!eligibleById.has(cafe.id)) {
      eligibleById.set(cafe.id, cafe);
    }
  }

  const eligible = Array.from(eligibleById.values());
  if (eligible.length === 0) return [];

  let hydrated: Cafe[];
  try {
    hydrated = await hydrateCafesWithPublicScores(eligible);
  } catch (error) {
    console.error('[publicLanding] public score hydration threw:', error);
    hydrated = eligible;
  }

  const sorted = sortLandingPageCafesByPublicRating(hydrated, {
    manualSortOrderByCafeId,
    dynamicFallbackIndexByCafeId,
  });

  return sorted.slice(0, max);
}
