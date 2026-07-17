import type { Cafe } from '@/data/cafes';
import {
  getAllDbValuesForCanonicalTag,
  getCanonicalSlugsFromCafeTags,
  resolveToCanonicalTagSlug,
  type CanonicalTagSlug,
} from '@/lib/tagRegistry';
import {
  normalizeCafeSearchText,
  parseCafeSearchQuery,
  type ParsedCafeSearchQuery,
} from '@/lib/cafeSearchQuery';

/** Set true in dev to log search diagnostics for every debounced query. */
const SEARCH_DEBUG = false;

const QUERY_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'for',
  'with',
  'from',
  'near',
  'in',
  'at',
  'to',
  'of',
  'on',
]);

const WEAK_QUERY_TOKENS = new Set(['good', 'best', 'great', 'nice', 'really', 'very', 'top']);

const WORK_INTENT_SLUGS = new Set<CanonicalTagSlug>([
  'good_for_working',
  'good_wifi',
  'has_outlets',
  'quiet',
  'good_for_calls',
  'spacious',
  'open_late',
]);

/**
 * Search tiers — higher always outranks lower.
 * Fuzzy (1) can never outrank exact/prefix/whole-word/area/street.
 */
export const SEARCH_TIER = {
  none: 0,
  fuzzy: 1,
  street: 2,
  area: 3,
  wholeWordName: 4,
  prefixName: 5,
  exactName: 6,
} as const;

export type SearchTier = (typeof SEARCH_TIER)[keyof typeof SEARCH_TIER];

/** Within-tier relevance weights (never large enough to jump a tier). */
const REL = {
  exact: 100,
  prefix: 80,
  wholeWordPhrase: 70,
  wholeWordToken: 40,
  areaExact: 70,
  areaPhrase: 55,
  areaToken: 35,
  streetPhrase: 50,
  streetToken: 30,
  fuzzyNamePhrase: 45,
  fuzzyNameToken: 28,
  fuzzyAreaToken: 22,
  intentTag: 25,
  /** Multiplier so tier always dominates: tier * TIER_BASE + relevance */
  tierBase: 1000,
} as const;

/**
 * Confidence thresholds (final).
 * - Fuzzy name phrase: edit distance ≤ 2 and query length ≥ 5
 * - Fuzzy token: len≥4 → dist 1; len≥6 → dist 2
 * - Single-token queries never use area fuzzy (blocks “Bethwall” → random/area noise)
 * - Multi-token place queries require every significant token to match name/area/address
 */
export const SEARCH_THRESHOLDS = {
  fuzzyMinTokenLength: 4,
  fuzzyDistShort: 1,
  fuzzyDistLong: 2,
  fuzzyLongTokenLength: 6,
  fuzzyPhraseMinLength: 5,
  fuzzyPhraseMaxDistance: 2,
  allowSingleTokenAreaFuzzy: false,
} as const;

export type SearchableCafe = {
  cafe: Cafe;
  name: string;
  area: string;
  address: string;
  description: string;
  tagSlugs: Set<CanonicalTagSlug>;
  tagSearchText: string;
  nameWords: string[];
  areaWords: string[];
  addressWords: string[];
};

function stripQueryStopwords(normalized: string): string {
  return normalized
    .split(' ')
    .filter((t) => t.length > 0 && !QUERY_STOPWORDS.has(t))
    .join(' ')
    .trim();
}

function significantTokens(tokens: string[]): string[] {
  return tokens.filter((t) => !WEAK_QUERY_TOKENS.has(t));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fieldWords(field: string): string[] {
  return field.split(' ').filter(Boolean);
}

/** Whole-word match (word-boundary), not substring-inside-word. */
export function containsWholeWord(haystack: string, needle: string): boolean {
  const n = needle.trim();
  if (!haystack || !n) return false;
  if (haystack === n) return true;
  return new RegExp(`(?:^|\\s)${escapeRegex(n)}(?:\\s|$)`).test(haystack);
}

function allTokensAreWholeWords(field: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  return tokens.every((t) => containsWholeWord(field, t));
}

function buildTagSearchText(cafe: Cafe, tagSlugs: Set<CanonicalTagSlug>): string {
  const parts: string[] = [];
  for (const raw of cafe.tags) {
    const t = normalizeCafeSearchText(raw);
    if (t) parts.push(t);
  }
  for (const slug of tagSlugs) {
    for (const value of getAllDbValuesForCanonicalTag(slug)) {
      const t = normalizeCafeSearchText(value);
      if (t) parts.push(t);
    }
  }
  return Array.from(new Set(parts)).join(' ');
}

/** Levenshtein with early exit when above `max`. */
export function editDistanceAtMost(a: string, b: string, max: number): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return false;
  if (la === 0 || lb === 0) return Math.max(la, lb) <= max;

  let prev = new Array<number>(lb + 1);
  let curr = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      if (curr[j]! < rowMin) rowMin = curr[j]!;
    }
    if (rowMin > max) return false;
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[lb]! <= max;
}

function maxTypoDistance(token: string): number {
  if (token.length >= SEARCH_THRESHOLDS.fuzzyLongTokenLength) {
    return SEARCH_THRESHOLDS.fuzzyDistLong;
  }
  if (token.length >= SEARCH_THRESHOLDS.fuzzyMinTokenLength) {
    return SEARCH_THRESHOLDS.fuzzyDistShort;
  }
  return 0;
}

/** Exact whole-word or high-confidence typo against any word in the list. */
function fuzzyMatchWord(words: string[], token: string): boolean {
  if (!token) return false;
  if (words.includes(token)) return true;
  const maxDist = maxTypoDistance(token);
  if (maxDist <= 0) return false;
  for (const word of words) {
    if (editDistanceAtMost(token, word, maxDist)) return true;
  }
  return false;
}

function fuzzyMatchPhrase(field: string, phrase: string): boolean {
  if (!field || !phrase) return false;
  if (field === phrase || field.includes(phrase)) return true;
  if (phrase.length < SEARCH_THRESHOLDS.fuzzyPhraseMinLength) return false;
  return editDistanceAtMost(field, phrase, SEARCH_THRESHOLDS.fuzzyPhraseMaxDistance);
}

export function buildSearchableCafe(cafe: Cafe): SearchableCafe {
  const tagSlugs = getCanonicalSlugsFromCafeTags(cafe.tags);
  const name = normalizeCafeSearchText(cafe.name);
  const area = normalizeCafeSearchText(cafe.neighborhood);
  const address = normalizeCafeSearchText(cafe.addressLine ?? '');
  const description = normalizeCafeSearchText(cafe.short_description);
  const tagSearchText = buildTagSearchText(cafe, tagSlugs);

  return {
    cafe,
    name,
    area,
    address,
    description,
    tagSlugs,
    tagSearchText,
    nameWords: fieldWords(name),
    areaWords: fieldWords(area),
    addressWords: fieldWords(address),
  };
}

function isWorkIntentQuery(intentSlugs: Set<CanonicalTagSlug>): boolean {
  for (const slug of intentSlugs) {
    if (WORK_INTENT_SLUGS.has(slug)) return true;
  }
  return false;
}

function isIntentHeavyQuery(sigTokens: string[], intentSlugs: Set<CanonicalTagSlug>): boolean {
  if (intentSlugs.size === 0) return false;
  if (sigTokens.length === 0) return true;
  const mapped = sigTokens.filter((t) => resolveToCanonicalTagSlug(t) != null).length;
  return mapped >= Math.ceil(sigTokens.length / 2);
}

export type CafeSearchScore = {
  tier: SearchTier;
  relevance: number;
  /** Sort key: tier * tierBase + relevance (tier always wins). */
  score: number;
};

/**
 * Tiered café search score.
 *
 * 6 Exact name → 5 Prefix name → 4 Whole-word name → 3 Area → 2 Street → 1 Fuzzy → 0 none
 */
export function scoreSearchableCafe(
  searchable: SearchableCafe,
  parsed: ParsedCafeSearchQuery
): CafeSearchScore {
  const empty: CafeSearchScore = { tier: SEARCH_TIER.none, relevance: 0, score: 0 };
  const { normalized, tokens, intentSlugs } = parsed;
  if (!normalized) return empty;

  const core = stripQueryStopwords(normalized);
  const sigTokens = significantTokens(tokens);
  const { name, area, address, nameWords, areaWords, addressWords, tagSlugs } = searchable;

  let tier: SearchTier = SEARCH_TIER.none;
  let relevance = 0;

  const bump = (next: SearchTier, rel: number) => {
    if (next > tier) {
      tier = next;
      relevance = rel;
    } else if (next === tier) {
      relevance = Math.max(relevance, rel);
    }
  };

  // --- Tier 6: exact name ---
  if (core.length > 0 && (name === core || name === normalized)) {
    bump(SEARCH_TIER.exactName, REL.exact);
  }

  // --- Tier 5: name starts with query ---
  if (
    core.length > 0 &&
    (name.startsWith(core) ||
      name.startsWith(`${core} `) ||
      name.startsWith(normalized) ||
      name.startsWith(`${normalized} `))
  ) {
    bump(SEARCH_TIER.prefixName, REL.prefix + Math.min(20, core.length));
  }

  // --- Tier 4: whole-word name ---
  if (core.length > 0 && containsWholeWord(name, core)) {
    bump(SEARCH_TIER.wholeWordName, REL.wholeWordPhrase + Math.min(15, core.length));
  } else if (sigTokens.length > 0 && allTokensAreWholeWords(name, sigTokens)) {
    bump(SEARCH_TIER.wholeWordName, REL.wholeWordToken * sigTokens.length);
  }

  // --- Tier 3: neighbourhood / area ---
  if (core.length > 0 && (area === core || area === normalized)) {
    bump(SEARCH_TIER.area, REL.areaExact);
  } else if (core.length > 0 && (area.startsWith(core) || containsWholeWord(area, core) || area.includes(core))) {
    const rel = containsWholeWord(area, core) || area.startsWith(core) ? REL.areaPhrase : REL.areaToken;
    bump(SEARCH_TIER.area, rel);
  } else if (sigTokens.length > 0 && allTokensAreWholeWords(area, sigTokens)) {
    bump(SEARCH_TIER.area, REL.areaToken * sigTokens.length);
  }

  // --- Tier 2: street / address ---
  if (core.length > 0 && (containsWholeWord(address, core) || address.includes(core))) {
    bump(
      SEARCH_TIER.street,
      containsWholeWord(address, core) ? REL.streetPhrase : REL.streetToken
    );
  } else if (sigTokens.length > 0 && allTokensAreWholeWords(address, sigTokens)) {
    bump(SEARCH_TIER.street, REL.streetToken * sigTokens.length);
  }

  // --- Intent tags: boost within an existing geo/name tier, or allow intent-heavy queries ---
  let intentHits = 0;
  for (const slug of intentSlugs) {
    if (tagSlugs.has(slug)) intentHits += 1;
  }
  if (intentHits > 0) {
    if (tier >= SEARCH_TIER.street) {
      relevance += intentHits * REL.intentTag;
    } else if (isIntentHeavyQuery(sigTokens, intentSlugs)) {
      bump(SEARCH_TIER.area, intentHits * REL.intentTag + (isWorkIntentQuery(intentSlugs) ? 10 : 0));
    }
  }

  // --- Tier 1: high-confidence fuzzy (only if nothing stronger matched) ---
  if (tier === SEARCH_TIER.none && core.length > 0) {
    if (fuzzyMatchPhrase(name, core)) {
      bump(SEARCH_TIER.fuzzy, REL.fuzzyNamePhrase);
    } else if (sigTokens.length > 0) {
      const nameFuzzyCount = sigTokens.filter((t) => fuzzyMatchWord(nameWords, t)).length;
      const areaFuzzyCount = sigTokens.filter((t) => fuzzyMatchWord(areaWords, t)).length;
      const addressFuzzyCount = sigTokens.filter((t) => fuzzyMatchWord(addressWords, t)).length;

      if (sigTokens.length === 1) {
        // Single token: name fuzzy only (no area fuzzy → blocks “Bethwall” alone).
        if (nameFuzzyCount === 1) {
          bump(SEARCH_TIER.fuzzy, REL.fuzzyNameToken);
        }
      } else {
        // Multi-token place query: every token must match name/area/address (exact word or fuzzy).
        const covered = sigTokens.every(
          (t) =>
            containsWholeWord(name, t) ||
            containsWholeWord(area, t) ||
            containsWholeWord(address, t) ||
            fuzzyMatchWord(nameWords, t) ||
            fuzzyMatchWord(areaWords, t) ||
            fuzzyMatchWord(addressWords, t)
        );
        if (covered) {
          const rel =
            nameFuzzyCount * REL.fuzzyNameToken +
            areaFuzzyCount * REL.fuzzyAreaToken +
            addressFuzzyCount * REL.streetToken;
          // Prefer classifying as area/street when exact whole-words exist.
          const exactArea = allTokensAreWholeWords(area, sigTokens);
          const exactStreet = allTokensAreWholeWords(address, sigTokens);
          if (exactArea) bump(SEARCH_TIER.area, REL.areaToken * sigTokens.length);
          else if (exactStreet) bump(SEARCH_TIER.street, REL.streetToken * sigTokens.length);
          else bump(SEARCH_TIER.fuzzy, Math.max(rel, REL.fuzzyNameToken));
        }
      }
    }
  }

  // Multi-token place queries with only a partial exact match (e.g. only “green”) → drop.
  const isPlaceLike = intentSlugs.size === 0 || !isIntentHeavyQuery(sigTokens, intentSlugs);
  if (isPlaceLike && sigTokens.length >= 2 && tier > SEARCH_TIER.none) {
    const covered = sigTokens.every(
      (t) =>
        containsWholeWord(name, t) ||
        containsWholeWord(area, t) ||
        containsWholeWord(address, t) ||
        name.includes(t) ||
        area.includes(t) ||
        address.includes(t) ||
        fuzzyMatchWord(nameWords, t) ||
        fuzzyMatchWord(areaWords, t) ||
        fuzzyMatchWord(addressWords, t)
    );
    const phraseHit =
      name.includes(core) ||
      area.includes(core) ||
      address.includes(core) ||
      fuzzyMatchPhrase(name, core) ||
      fuzzyMatchPhrase(area, core);
    if (!covered && !phraseHit) {
      return empty;
    }
  }

  if (tier === SEARCH_TIER.none) return empty;

  return {
    tier,
    relevance,
    score: tier * REL.tierBase + relevance,
  };
}

export type CafeSearchRankResult = {
  cafe: Cafe;
  tier: SearchTier;
  relevance: number;
  score: number;
};

/**
 * Rank cafés for a typed query (tiered precision).
 * Returns [] when nothing clears the confidence / tier gates.
 */
export function rankCafesBySearchQuery(list: Cafe[], queryRaw: string): CafeSearchRankResult[] {
  const parsed = parseCafeSearchQuery(queryRaw);
  if (!parsed.normalized) return [];

  const index = list.map(buildSearchableCafe);
  const results: CafeSearchRankResult[] = [];

  for (const searchable of index) {
    const { tier, relevance, score } = scoreSearchableCafe(searchable, parsed);
    if (tier === SEARCH_TIER.none || relevance <= 0) continue;
    results.push({ cafe: searchable.cafe, tier, relevance, score });
  }

  results.sort(compareSearchResults);

  if (SEARCH_DEBUG && __DEV__) {
    debugCafeSearch(queryRaw, parsed, list, index, results);
  }

  return results;
}

/** Tie-break: tier → relevance → Beaned Pick → Work Score → distance. */
export function compareSearchResults(a: CafeSearchRankResult, b: CafeSearchRankResult): number {
  if (b.tier !== a.tier) return b.tier - a.tier;
  if (b.relevance !== a.relevance) return b.relevance - a.relevance;
  const cert = Number(b.cafe.isCertified) - Number(a.cafe.isCertified);
  if (cert !== 0) return cert;
  const scoreA = a.cafe.publicCoffeeScore ?? a.cafe.coffeeScore ?? 0;
  const scoreB = b.cafe.publicCoffeeScore ?? b.cafe.coffeeScore ?? 0;
  if (scoreB !== scoreA) return scoreB - scoreA;
  const distA = a.cafe.distanceMiles ?? Number.POSITIVE_INFINITY;
  const distB = b.cafe.distanceMiles ?? Number.POSITIVE_INFINITY;
  return distA - distB;
}

export function rankCafesForSearchFromIndex(list: Cafe[], queryRaw: string): Cafe[] {
  return rankCafesBySearchQuery(list, queryRaw).map((r) => r.cafe);
}

export function cafeMatchesSearchQueryFromIndex(cafe: Cafe, queryRaw: string): boolean {
  const parsed = parseCafeSearchQuery(queryRaw);
  if (!parsed.normalized) return false;
  const { tier, relevance } = scoreSearchableCafe(buildSearchableCafe(cafe), parsed);
  return tier > SEARCH_TIER.none && relevance > 0;
}

/** Dev-only diagnostics for search QA. */
export function debugCafeSearch(
  queryRaw: string,
  parsed: ParsedCafeSearchQuery,
  list: Cafe[],
  _index: SearchableCafe[],
  results: CafeSearchRankResult[]
): void {
  console.log('[DEBUG cafeSearch]', {
    queryRaw,
    parsed: {
      normalized: parsed.normalized,
      core: stripQueryStopwords(parsed.normalized),
      tokens: parsed.tokens,
      intentSlugs: Array.from(parsed.intentSlugs),
    },
    totalCafes: list.length,
    resultCount: results.length,
    topResults: results.slice(0, 5).map((r) => ({
      name: r.cafe.name,
      tier: r.tier,
      relevance: r.relevance,
      neighborhood: r.cafe.neighborhood,
    })),
  });
}
