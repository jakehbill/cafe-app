import type { Cafe } from '@/data/cafes';
import type { UserCoords } from '@/contexts/UserLocationContext';

import { supabase } from '@/lib/supabase';
import { textRelevancePoints } from '@/lib/cafeRanking';
import { getNearbyCafes } from '@/lib/cafeNearby';

/**
 * “Trending nearby” — non-personalized ranking (MVP).
 * Uses listing quality + optional local community stats (saves / visits).
 * No user profile, no taste model.
 *
 * Tweak relative strength via `TRENDING_WEIGHTS`.
 */

export const TRENDING_WEIGHTS = {
  /** Weight on mean(coffee, work, vibe) — same 1–10 scale as listings */
  listingScore: 1,
  /** Per save (communityStats.saves or stable fallback) */
  saves: 0.085,
  /** Per visit (communityStats.visits or stable fallback) */
  visits: 0.065,
} as const;

/**
 * Server-powered trending nearby list (RPC).
 *
 * Calls Supabase function `get_trending_nearby(user_lat, user_lng, radius_miles)`.
 * Returns the raw RPC rows (shape depends on your SQL function).
 */
export async function fetchTrendingNearby(params: {
  userLat: number;
  userLng: number;
  radiusMiles?: number;
}) {
  const { userLat, userLng, radiusMiles = 0.5 } = params;

  const res = await supabase.rpc('get_trending_nearby', {
    user_lat: userLat,
    user_lng: userLng,
    radius_miles: radiusMiles,
  });

  if (res.error) {
    console.error('fetchTrendingNearby RPC failed:', res.error);
    throw res.error;
  }

  return res.data ?? [];
}

function meanListingScore(cafe: Cafe): number {
  return (cafe.coffeeScore + cafe.workScore + cafe.vibeScore) / 3;
}

/**
 * Deterministic pseudo counts when `communityStats` is omitted (stable across reloads).
 */
function stablePseudoCount(id: string, kind: 'saves' | 'visits'): number {
  const salt = kind === 'saves' ? 928_371 : 482_910;
  let h = salt;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return 18 + (h % 210);
}

function saveCount(cafe: Cafe): number {
  return cafe.communityStats?.saves ?? stablePseudoCount(cafe.id, 'saves');
}

function visitCount(cafe: Cafe): number {
  return cafe.communityStats?.visits ?? stablePseudoCount(cafe.id, 'visits');
}

export function computeTrendingScore(cafe: Cafe): number {
  const q = meanListingScore(cafe);
  return (
    q * TRENDING_WEIGHTS.listingScore +
    saveCount(cafe) * TRENDING_WEIGHTS.saves +
    visitCount(cafe) * TRENDING_WEIGHTS.visits
  );
}

export function rankCafesForTrending(list: Cafe[]): Cafe[] {
  const copy = [...list];
  copy.sort((a, b) => computeTrendingScore(b) - computeTrendingScore(a));
  return copy;
}

/** Share of nearby picks that should be cafés the user has not engaged with yet (logged in). */
export const TRENDING_NEARBY_UNVISITED_SHARE = 0.75;

export function isKnownCafeForTrendingNearby(cafeId: string, knownCafeIds: Set<string>): boolean {
  const key = String(cafeId ?? '').trim();
  return key.length > 0 && knownCafeIds.has(key);
}

/**
 * Same distance + trending sort used on Home “Trending nearby” (quality preserved within each bucket).
 */
export function rankNearbyPoolForTrending(pool: Cafe[], activeRadiusMiles: number): Cafe[] {
  const copy = [...pool];
  copy.sort((a, b) => {
    const aDistBonus =
      a.distanceMiles == null ? 0 : Math.max(0, activeRadiusMiles - a.distanceMiles) * 1.8;
    const bDistBonus =
      b.distanceMiles == null ? 0 : Math.max(0, activeRadiusMiles - b.distanceMiles) * 1.8;
    const aScore = computeTrendingScore(a) + aDistBonus;
    const bScore = computeTrendingScore(b) + bDistBonus;
    return bScore - aScore;
  });
  return copy;
}

/**
 * Compose final carousel: ~75% unvisited/unrated, ~25% known (visited/rated/saved/logged).
 * When `knownCafeIds` is empty (logged out), returns the ranked pool unchanged.
 */
export function composeTrendingNearbyForUser(
  rankedPool: Cafe[],
  options: {
    limit?: number;
    knownCafeIds?: Set<string>;
    unvisitedShare?: number;
  } = {}
): Cafe[] {
  const limit = options.limit ?? 5;
  const known = options.knownCafeIds;
  if (!known || known.size === 0) {
    return rankedPool.slice(0, limit);
  }

  const unvisitedShare = options.unvisitedShare ?? TRENDING_NEARBY_UNVISITED_SHARE;
  const fresh: Cafe[] = [];
  const knownList: Cafe[] = [];
  for (const cafe of rankedPool) {
    if (isKnownCafeForTrendingNearby(cafe.id, known)) {
      knownList.push(cafe);
    } else {
      fresh.push(cafe);
    }
  }

  const freshTarget = Math.ceil(limit * unvisitedShare);
  const picks: Cafe[] = [...fresh.slice(0, freshTarget)];

  const knownSlots = limit - picks.length;
  if (knownSlots > 0) {
    picks.push(...knownList.slice(0, knownSlots));
  }

  if (picks.length < limit) {
    picks.push(...fresh.slice(freshTarget, freshTarget + (limit - picks.length)));
  }

  return picks.slice(0, limit);
}

/**
 * Search screen: same nearby pool + trending sort as Home when query is empty.
 * With a query, reorders by trending score + a light text-relevance term (no personalization).
 *
 * Tweak `TREND_QUERY_TEXT_WEIGHT` to change how much typing affects order.
 */
const TREND_QUERY_TEXT_WEIGHT = 0.018;

export function rankTrendingNearbyForSearch(
  allCafes: Cafe[],
  queryTrimmedLower: string,
  userLocation: UserCoords
): Cafe[] {
  const pool = getNearbyCafes(allCafes, userLocation);
  const q = queryTrimmedLower.trim();
  if (!q) {
    return rankCafesForTrending(pool);
  }

  const copy = [...pool];
  copy.sort((a, b) => {
    const sa = computeTrendingScore(a) + textRelevancePoints(a, q) * TREND_QUERY_TEXT_WEIGHT;
    const sb = computeTrendingScore(b) + textRelevancePoints(b, q) * TREND_QUERY_TEXT_WEIGHT;
    return sb - sa;
  });
  return copy;
}

export const TREND_SEARCH_WEIGHTS = {
  queryText: TREND_QUERY_TEXT_WEIGHT,
} as const;
