import type { Cafe } from '@/data/cafes';

import { supabase } from '@/lib/supabase';
import { textRelevancePoints } from '@/lib/cafeRanking';
import { getNearbyCafes, type UserCoords } from '@/lib/cafeNearby';

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
