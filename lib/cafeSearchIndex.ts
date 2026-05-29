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

/** Weak tokens — skipped for description/haystack matching (still used for names). */
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

const SCORE = {
  exactName: 200,
  prefixName: 140,
  containsFullName: 100,
  allNameTokens: 90,
  nameToken: 28,
  haystackPhrase: 70,
  haystackToken: 18,
  intentTag: 42,
  tagToken: 14,
  areaPhrase: 55,
  areaToken: 28,
  addressToken: 22,
  descriptionToken: 8,
  workAxisFallback: 32,
  qualityWeight: 1.2,
} as const;

export type SearchableCafe = {
  cafe: Cafe;
  name: string;
  area: string;
  address: string;
  description: string;
  tagSlugs: Set<CanonicalTagSlug>;
  /** Labels, slugs, and registry aliases for substring fallback. */
  tagSearchText: string;
  fullText: string;
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

/** Normalize a café row into searchable fields (call once per café per search pass). */
export function buildSearchableCafe(cafe: Cafe): SearchableCafe {
  const tagSlugs = getCanonicalSlugsFromCafeTags(cafe.tags);
  const name = normalizeCafeSearchText(cafe.name);
  const area = normalizeCafeSearchText(cafe.neighborhood);
  const address = normalizeCafeSearchText(cafe.addressLine ?? '');
  const description = normalizeCafeSearchText(cafe.short_description);
  const tagSearchText = buildTagSearchText(cafe, tagSlugs);
  const fullText = [name, area, address, description, tagSearchText].filter(Boolean).join(' ');

  return {
    cafe,
    name,
    area,
    address,
    description,
    tagSlugs,
    tagSearchText,
    fullText,
  };
}

function isWorkIntentQuery(intentSlugs: Set<CanonicalTagSlug>): boolean {
  for (const slug of intentSlugs) {
    if (WORK_INTENT_SLUGS.has(slug)) return true;
  }
  return false;
}

export function scoreSearchableCafe(
  searchable: SearchableCafe,
  parsed: ParsedCafeSearchQuery
): { relevance: number; score: number } {
  const { normalized, tokens, intentSlugs, areaTerms } = parsed;
  if (!normalized) return { relevance: 0, score: 0 };

  const coreNormalized = stripQueryStopwords(normalized);
  const sigTokens = significantTokens(tokens);
  const { name, area, address, description, fullText, tagSlugs, cafe } = searchable;

  let relevance = 0;

  // --- Name (highest priority) ---
  if (coreNormalized.length > 0) {
    if (name === coreNormalized || name === normalized) {
      relevance += SCORE.exactName;
    } else if (name.startsWith(coreNormalized) || name.startsWith(normalized)) {
      relevance += SCORE.prefixName;
    } else if (name.includes(coreNormalized) || name.includes(normalized)) {
      relevance += SCORE.containsFullName;
    }
  }

  if (sigTokens.length > 0) {
    const matchedInName = sigTokens.filter((t) => name.includes(t));
    if (matchedInName.length === sigTokens.length) {
      relevance += SCORE.allNameTokens;
    }
    relevance += matchedInName.length * SCORE.nameToken;
  }

  // --- Broad phrase / token haystack (name, area, address, tags, description) ---
  if (coreNormalized.length >= 3 && fullText.includes(coreNormalized)) {
    relevance += SCORE.haystackPhrase;
  }
  for (const token of sigTokens) {
    if (fullText.includes(token)) relevance += SCORE.haystackToken;
  }

  // --- Tags / intent synonyms ---
  for (const slug of intentSlugs) {
    if (tagSlugs.has(slug)) relevance += SCORE.intentTag;
  }
  for (const token of sigTokens) {
    const slug = resolveToCanonicalTagSlug(token);
    if (slug && tagSlugs.has(slug)) relevance += SCORE.tagToken;
  }

  // --- Area / address ---
  const locationHaystack = `${area} ${address}`.trim();
  if (
    coreNormalized.length > 0 &&
    (area === coreNormalized ||
      area.includes(coreNormalized) ||
      address.includes(coreNormalized) ||
      locationHaystack.includes(coreNormalized))
  ) {
    relevance += SCORE.areaPhrase;
  }
  for (const areaToken of areaTerms) {
    if (area.includes(areaToken)) relevance += SCORE.areaToken;
    if (address.includes(areaToken)) relevance += SCORE.addressToken;
  }

  // --- Description (weak tokens only) ---
  for (const token of sigTokens) {
    if (description.includes(token)) relevance += SCORE.descriptionToken;
  }

  // --- Axis fallback when work intent query but café tags are missing/unresolved ---
  if (intentSlugs.size > 0 && isWorkIntentQuery(intentSlugs)) {
    const hasWorkTag = [...WORK_INTENT_SLUGS].some((slug) => tagSlugs.has(slug));
    if (!hasWorkTag && cafe.workScore >= 5.5) {
      relevance += SCORE.workAxisFallback;
    }
  }

  const quality = (cafe.coffeeScore + cafe.workScore + cafe.vibeScore) / 3;
  const score = relevance + quality * SCORE.qualityWeight;
  return { relevance, score };
}

export type CafeSearchRankResult = {
  cafe: Cafe;
  relevance: number;
  score: number;
};

/**
 * Rank cafés for Search using in-memory catalog only.
 * Returns any café with non-zero relevance, sorted by score.
 */
export function rankCafesBySearchQuery(list: Cafe[], queryRaw: string): CafeSearchRankResult[] {
  const parsed = parseCafeSearchQuery(queryRaw);
  if (!parsed.normalized) return [];

  const index = list.map(buildSearchableCafe);
  const results: CafeSearchRankResult[] = [];

  for (const searchable of index) {
    const { relevance, score } = scoreSearchableCafe(searchable, parsed);
    if (relevance <= 0) continue;
    results.push({ cafe: searchable.cafe, relevance, score });
  }

  results.sort((a, b) => b.score - a.score || b.relevance - a.relevance);

  if (SEARCH_DEBUG && __DEV__) {
    debugCafeSearch(queryRaw, parsed, list, index, results);
  }

  return results;
}

export function rankCafesForSearchFromIndex(
  list: Cafe[],
  queryRaw: string
): Cafe[] {
  return rankCafesBySearchQuery(list, queryRaw).map((r) => r.cafe);
}

/** Dev-only diagnostics for search QA (Hoxton, intent phrases, tag coverage). */
export function debugCafeSearch(
  queryRaw: string,
  parsed: ParsedCafeSearchQuery,
  list: Cafe[],
  index: SearchableCafe[],
  results: CafeSearchRankResult[]
): void {
  const needle = stripQueryStopwords(normalizeCafeSearchText(queryRaw));
  const hoxtonHits = list.filter((c) => normalizeCafeSearchText(c.name).includes('hoxton'));
  const workTagSlugs = WORK_INTENT_SLUGS;
  const withWorkTags = list.filter((c) => {
    const slugs = getCanonicalSlugsFromCafeTags(c.tags);
    for (const s of workTagSlugs) if (slugs.has(s)) return true;
    return false;
  });

  const sampleTags = list.slice(0, 5).map((c) => ({
    name: c.name,
    rawTags: c.tags,
    resolved: Array.from(getCanonicalSlugsFromCafeTags(c.tags)),
  }));

  console.log('[DEBUG cafeSearch]', {
    queryRaw,
    parsed: {
      normalized: parsed.normalized,
      core: stripQueryStopwords(parsed.normalized),
      tokens: parsed.tokens,
      intentSlugs: Array.from(parsed.intentSlugs),
      areaTerms: Array.from(parsed.areaTerms),
    },
    totalCafes: list.length,
    resultCount: results.length,
    topResults: results.slice(0, 5).map((r) => ({
      name: r.cafe.name,
      relevance: r.relevance,
      tags: r.cafe.tags,
      resolvedTags: Array.from(getCanonicalSlugsFromCafeTags(r.cafe.tags)),
    })),
    hoxtonNameMatches: hoxtonHits.map((c) => ({
      name: c.name,
      neighborhood: c.neighborhood,
      tags: c.tags,
    })),
    cafesWithWorkRelatedTags: withWorkTags.length,
    workTaggedSample: withWorkTags.slice(0, 5).map((c) => c.name),
    tagShapeSample: sampleTags,
  });
}

export function cafeMatchesSearchQueryFromIndex(cafe: Cafe, queryRaw: string): boolean {
  const parsed = parseCafeSearchQuery(queryRaw);
  if (!parsed.normalized) return false;
  const { relevance } = scoreSearchableCafe(buildSearchableCafe(cafe), parsed);
  return relevance > 0;
}
