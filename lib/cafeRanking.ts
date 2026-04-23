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
import {
  getCanonicalSlugsFromCafeTags,
  resolveToCanonicalTagSlug,
  type CanonicalTagSlug,
} from '@/lib/tagRegistry';

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
  shortDescription: 11,
  tagWord: 18,

  // Query-specific search weights (keep intentional and easy to tune).
  searchExactName: 160,
  searchPrefixName: 120,
  searchContainsName: 80,
  searchNameTokenMatch: 26,
  searchTagIntentMatch: 38,
  searchTagTokenMatch: 12,
  searchAreaExact: 34,
  searchAreaTokenMatch: 16,
  searchDescriptionTokenMatch: 6,
  searchQualityWeight: 1.4,
  searchPersonalizationWeight: 3.2,
  searchOnboardingWeight: 2,
  searchMinRelevance: 36,
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
  const shortDescription = cafe.short_description.toLowerCase();

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
  if (shortDescription.includes(queryLower)) {
    pts += RANK.shortDescription;
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

type ParsedSearchQuery = {
  normalized: string;
  tokens: string[];
  intentSlugs: Set<CanonicalTagSlug>;
  areaTerms: Set<string>;
};

function normalizeSearchText(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^\w\s-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenizeSearchText(normalized: string): string[] {
  return normalized.split(' ').map((t) => t.trim()).filter((t) => t.length >= 2);
}

const INTENT_PHRASE_TO_TAGS: ReadonlyArray<{
  phrase: string;
  slugs: readonly CanonicalTagSlug[];
}> = [
  { phrase: 'good to work from', slugs: ['good_for_working', 'good_wifi', 'has_outlets'] },
  { phrase: 'good for work', slugs: ['good_for_working', 'good_wifi'] },
  { phrase: 'work friendly', slugs: ['good_for_working'] },
  { phrase: 'laptop friendly', slugs: ['good_for_working', 'has_outlets', 'good_wifi'] },
  { phrase: 'settle in', slugs: ['good_for_working', 'quiet'] },
  { phrase: 'great coffee', slugs: ['specialty_coffee', 'great_espresso', 'great_filter'] },
  { phrase: 'specialty coffee', slugs: ['specialty_coffee'] },
  { phrase: 'top coffee', slugs: ['specialty_coffee', 'great_espresso'] },
  { phrase: 'quiet', slugs: ['quiet'] },
  { phrase: 'calm', slugs: ['quiet'] },
  { phrase: 'focus', slugs: ['quiet', 'good_for_working'] },
  { phrase: 'cosy', slugs: ['cosy'] },
  { phrase: 'cozy', slugs: ['cosy'] },
  { phrase: 'bright', slugs: ['aesthetic', 'spacious'] },
];

function parseSearchQuery(queryTrimmedLower: string): ParsedSearchQuery {
  const normalized = normalizeSearchText(queryTrimmedLower);
  const tokens = tokenizeSearchText(normalized);
  const intentSlugs = new Set<CanonicalTagSlug>();

  // Direct canonical/alias resolution by token and full query phrase.
  const fullSlug = resolveToCanonicalTagSlug(normalized);
  if (fullSlug) intentSlugs.add(fullSlug);
  for (const token of tokens) {
    const tokenSlug = resolveToCanonicalTagSlug(token);
    if (tokenSlug) intentSlugs.add(tokenSlug);
  }

  // Natural language phrase mapping to intent tags.
  for (const mapping of INTENT_PHRASE_TO_TAGS) {
    if (normalized.includes(mapping.phrase)) {
      for (const slug of mapping.slugs) intentSlugs.add(slug);
    }
  }

  // Area terms are discovered from longer tokens (single-word area names like "soho", "camden").
  const areaTerms = new Set(tokens.filter((t) => t.length >= 3));
  return { normalized, tokens, intentSlugs, areaTerms };
}

function computeQueryIntentionalScore(
  cafe: Cafe,
  parsedQuery: ParsedSearchQuery,
  ratingsByCafeId: Record<string, CafeRating>,
  tasteProfile: UserTasteProfile | null,
  onboardingPrefs: OnboardingPreferenceRankInput | null
): { score: number; relevance: number } {
  const { normalized, tokens, intentSlugs, areaTerms } = parsedQuery;
  if (!normalized) return { score: 0, relevance: 0 };

  const name = normalizeSearchText(cafe.name);
  const neighborhood = normalizeSearchText(cafe.neighborhood);
  const description = normalizeSearchText(cafe.short_description);
  const cafeTagSlugs = getCanonicalSlugsFromCafeTags(cafe.tags);
  const scores = scoresForCafe(cafe, ratingsByCafeId);
  const quality = avgScore(scores);

  let relevance = 0;

  // Name matching is intentionally strongest.
  if (name === normalized) {
    relevance += RANK.searchExactName;
  } else if (name.startsWith(normalized)) {
    relevance += RANK.searchPrefixName;
  } else if (name.includes(normalized)) {
    relevance += RANK.searchContainsName;
  }

  for (const token of tokens) {
    if (name.includes(token)) relevance += RANK.searchNameTokenMatch;
    if (description.includes(token)) relevance += RANK.searchDescriptionTokenMatch;
    for (const rawTag of cafe.tags) {
      const normTag = normalizeSearchText(rawTag);
      if (normTag.includes(token)) relevance += RANK.searchTagTokenMatch;
    }
  }

  // Intent tags from natural language sit below name matches, above area.
  for (const slug of intentSlugs) {
    if (cafeTagSlugs.has(slug)) {
      relevance += RANK.searchTagIntentMatch;
    }
  }

  // Area is a boost, not a hard filter.
  if (neighborhood === normalized || neighborhood.includes(normalized)) {
    relevance += RANK.searchAreaExact;
  } else {
    for (const areaToken of areaTerms) {
      if (neighborhood.includes(areaToken)) relevance += RANK.searchAreaTokenMatch;
    }
  }

  const behaviorBoost =
    tasteProfile === null ? 0 : personalizationBoost(cafe, tasteProfile, scores) * RANK.searchPersonalizationWeight;
  const onboardingBoost = computeOnboardingPreferenceBoost(cafe, onboardingPrefs) * RANK.searchOnboardingWeight;

  const score = relevance + quality * RANK.searchQualityWeight + behaviorBoost + onboardingBoost;
  return { score, relevance };
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
  const parsedQuery = parseSearchQuery(queryTrimmedLower);
  const hasQuery = parsedQuery.normalized.length > 0;

  if (hasQuery) {
    return list
      .map((cafe) => ({
        cafe,
        ...computeQueryIntentionalScore(cafe, parsedQuery, ratingsByCafeId, tasteProfile, onboardingPrefs),
      }))
      .filter((entry) => entry.relevance >= RANK.searchMinRelevance)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.cafe);
  }

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
