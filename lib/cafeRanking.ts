import type { CafeRating } from '@/contexts/CafeStateContext';
import type { Cafe } from '@/data/cafes';

import {
  buildUserTasteProfile,
  personalizationBoost,
  type UserTasteProfile,
} from '@/lib/cafePersonalization';
import {
  computeOnboardingPreferenceBoost,
  type OnboardingPreferenceRankInput,
} from '@/lib/onboardingPreferenceRanking';

export type RankKey = 'work' | 'coffee' | 'atmosphere' | 'quick' | 'quiet';

// ---------------------------------------------------------------------------
// Base cafe ranking (search). Personalization is added on top when a profile exists.
//
// finalScore = computeBaseSearchRankScore(...)
//   + personalizationBoost(...) * PERSONALIZE_RANK_SCALE   (ratings / visits / saves — dominant)
//   + computeOnboardingPreferenceBoost(...)              (onboarding tags + tiny axis nudge; capped ~6)
//
// Base = balanced scores + tag coverage (no query/chip), or text + chip + quality when searching.
// Personalization = visit-rank tiers + saved bump + axis alignment + tags + reference similarity −
//   subtle low-axis penalty (see `lib/cafePersonalization.ts`).
//
// Tweak: `RANK`, `PERSONALIZE_RANK_SCALE` here, and `PERSONALIZE_WEIGHTS` / visit tiers in cafePersonalization.
// ---------------------------------------------------------------------------

const RANK = {
  balancedWork: 0.38,
  balancedCoffee: 0.31,
  balancedVibe: 0.31,
  balancedDefaultScale: 24,
  tagCoveragePerTag: 0.35,

  textWithQuery: 18,
  intentWithQuery: 13,
  qualityWithQuery: 2.4,

  intentNoQuery: 22,
  qualityNoQuery: 4,

  scoreEmphasis: 4,
  tagBoost: 72,
  quickTagNames: ['Quick', 'Fast Service'] as const,
  quietTagName: 'Quiet',

  nameContains: 125,
  nameStartsWith: 52,
  neighborhood: 38,
  summary: 11,
  tagWord: 18,
} as const;

/** Scale applied to the personalization add-on (tune vs base + chip weights) */
const PERSONALIZE_RANK_SCALE = 1.12;

export function scoresForCafe(cafe: Cafe, ratingsByCafeId: Record<string, CafeRating>) {
  const r = ratingsByCafeId[cafe.id];
  return {
    coffee: r ? r.coffee : cafe.coffeeScore,
    work: cafe.workScore,
    vibe: cafe.vibeScore,
  };
}

function avgScore(s: { coffee: number; work: number; vibe: number }) {
  return (s.coffee + s.work + s.vibe) / 3;
}

function balancedBaseScore(s: { coffee: number; work: number; vibe: number }) {
  return (
    s.work * RANK.balancedWork +
    s.coffee * RANK.balancedCoffee +
    s.vibe * RANK.balancedVibe
  );
}

function tagCoverageBonus(cafe: Cafe): number {
  return Math.min(cafe.tags.length, 6) * RANK.tagCoveragePerTag;
}

function hasQuickStyleTag(cafe: Cafe): boolean {
  return cafe.tags.some((t) =>
    RANK.quickTagNames.some((name) => t === name || t.toLowerCase() === name.toLowerCase())
  );
}

function hasQuietTag(cafe: Cafe): boolean {
  return cafe.tags.some(
    (t) => t === RANK.quietTagName || t.toLowerCase() === RANK.quietTagName.toLowerCase()
  );
}

/** Exported for Search “Trending nearby” + query reordering (same text signals as main search). */
export function textRelevancePoints(cafe: Cafe, queryLower: string): number {
  if (!queryLower) {
    return 0;
  }

  const name = cafe.name.toLowerCase();
  const area = cafe.neighborhood.toLowerCase();
  const summary = cafe.summary.toLowerCase();

  let pts = 0;
  if (name.includes(queryLower)) {
    pts += RANK.nameContains;
    if (name.startsWith(queryLower)) {
      pts += RANK.nameStartsWith;
    }
  }
  if (area.includes(queryLower)) {
    pts += RANK.neighborhood;
  }
  if (summary.includes(queryLower)) {
    pts += RANK.summary;
  }
  for (const tag of cafe.tags) {
    if (tag.toLowerCase().includes(queryLower)) {
      pts += RANK.tagWord;
    }
  }

  return pts;
}

function intentPoints(
  cafe: Cafe,
  key: RankKey,
  s: { coffee: number; work: number; vibe: number }
): number {
  const avg = avgScore(s);

  switch (key) {
    case 'work':
      return s.work * RANK.scoreEmphasis + avg * 0.35;
    case 'coffee':
      return s.coffee * RANK.scoreEmphasis + avg * 0.35;
    case 'atmosphere':
      return s.vibe * RANK.scoreEmphasis + avg * 0.35;
    case 'quiet':
      return (hasQuietTag(cafe) ? RANK.tagBoost : 0) + avg * RANK.scoreEmphasis;
    case 'quick':
      return (hasQuickStyleTag(cafe) ? RANK.tagBoost : 0) + avg * RANK.scoreEmphasis;
  }
}

export function computeBaseSearchRankScore(
  cafe: Cafe,
  queryTrimmedLower: string,
  selectedChip: RankKey | null,
  ratingsByCafeId: Record<string, CafeRating>
): number {
  const s = scoresForCafe(cafe, ratingsByCafeId);
  const textPts = textRelevancePoints(cafe, queryTrimmedLower);
  const qualityPts = avgScore(s);
  const hasQuery = queryTrimmedLower.length > 0;
  const intentPts = selectedChip !== null ? intentPoints(cafe, selectedChip, s) : 0;

  if (hasQuery) {
    const chipPart = selectedChip !== null ? intentPts * RANK.intentWithQuery : 0;
    return textPts * RANK.textWithQuery + chipPart + qualityPts * RANK.qualityWithQuery;
  }

  if (selectedChip !== null) {
    return intentPts * RANK.intentNoQuery + qualityPts * RANK.qualityNoQuery;
  }

  return (balancedBaseScore(s) + tagCoverageBonus(cafe)) * RANK.balancedDefaultScale;
}

export function computeSearchRankScore(
  cafe: Cafe,
  queryTrimmedLower: string,
  selectedChip: RankKey | null,
  ratingsByCafeId: Record<string, CafeRating>,
  tasteProfile: UserTasteProfile | null,
  onboardingPrefs: OnboardingPreferenceRankInput | null = null
): number {
  const base = computeBaseSearchRankScore(cafe, queryTrimmedLower, selectedChip, ratingsByCafeId);
  const s = scoresForCafe(cafe, ratingsByCafeId);
  const behaviorBoost =
    tasteProfile === null ? 0 : personalizationBoost(cafe, tasteProfile, s) * PERSONALIZE_RANK_SCALE;
  const onboardingBoost = computeOnboardingPreferenceBoost(cafe, onboardingPrefs);
  return base + behaviorBoost + onboardingBoost;
}

export function rankCafesForSearch(
  list: Cafe[],
  queryTrimmedLower: string,
  selectedChip: RankKey | null,
  ratingsByCafeId: Record<string, CafeRating>,
  tasteProfile: UserTasteProfile | null,
  onboardingPrefs: OnboardingPreferenceRankInput | null = null
): Cafe[] {
  const copy = [...list];
  copy.sort(
    (a, b) =>
      computeSearchRankScore(b, queryTrimmedLower, selectedChip, ratingsByCafeId, tasteProfile, onboardingPrefs) -
      computeSearchRankScore(a, queryTrimmedLower, selectedChip, ratingsByCafeId, tasteProfile, onboardingPrefs)
  );
  return copy;
}

/** Home “Top picks” uses the same ordering as Search with no query and no chip. */
export function rankCafesForHome(
  list: Cafe[],
  ratingsByCafeId: Record<string, CafeRating>,
  tasteProfile: UserTasteProfile | null,
  onboardingPrefs: OnboardingPreferenceRankInput | null = null
): Cafe[] {
  return rankCafesForSearch(list, '', null, ratingsByCafeId, tasteProfile, onboardingPrefs);
}

export function buildTasteProfileFromState(
  ratingsByCafeId: Record<string, CafeRating>,
  allCafes: Cafe[],
  visitedCafeIdsOrdered: string[],
  savedCafeIds: string[]
): UserTasteProfile | null {
  const cafesById = Object.fromEntries(allCafes.map((c) => [c.id, c]));
  return buildUserTasteProfile(ratingsByCafeId, cafesById, visitedCafeIdsOrdered, savedCafeIds);
}
