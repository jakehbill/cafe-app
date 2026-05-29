import {
  resolveToCanonicalTagSlug,
  type CanonicalTagSlug,
} from '@/lib/tagRegistry';

/** Common stopwords — excluded from area/token matching (not from full-phrase intent). */
const SEARCH_STOPWORDS = new Set([
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

/**
 * Normalize free-text search: lowercase, unify wifi spellings, strip punctuation.
 */
export function normalizeCafeSearchText(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/\bwi[\s-]*fi\b/g, 'wifi');
  s = s.replace(/[^\w\s]+/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

export function tokenizeCafeSearchText(normalized: string): string[] {
  if (!normalized) return [];
  return normalized
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !SEARCH_STOPWORDS.has(t));
}

/**
 * Natural-language phrases → canonical tag slugs (longest phrases first at runtime).
 * Complements per-tag aliases in `tagRegistry`.
 */
const SEARCH_INTENT_PHRASES: ReadonlyArray<{
  phrase: string;
  slugs: readonly CanonicalTagSlug[];
}> = [
  { phrase: 'good for working', slugs: ['good_for_working', 'good_wifi', 'has_outlets'] },
  { phrase: 'good to work from', slugs: ['good_for_working', 'good_wifi', 'has_outlets'] },
  { phrase: 'good for work', slugs: ['good_for_working', 'good_wifi', 'has_outlets'] },
  { phrase: 'work friendly', slugs: ['good_for_working', 'has_outlets'] },
  { phrase: 'work-friendly', slugs: ['good_for_working', 'has_outlets'] },
  { phrase: 'remote work', slugs: ['good_for_working', 'good_wifi', 'has_outlets'] },
  { phrase: 'laptop friendly', slugs: ['good_for_working', 'has_outlets', 'good_wifi'] },
  { phrase: 'laptop', slugs: ['good_for_working', 'has_outlets'] },
  { phrase: 'working', slugs: ['good_for_working', 'good_wifi'] },
  { phrase: 'fast wifi', slugs: ['good_wifi', 'good_for_working'] },
  { phrase: 'good wifi', slugs: ['good_wifi', 'good_for_working'] },
  { phrase: 'great espresso', slugs: ['great_espresso', 'specialty_coffee'] },
  { phrase: 'flat white', slugs: ['great_espresso', 'specialty_coffee'] },
  { phrase: 'coffee quality', slugs: ['specialty_coffee', 'great_espresso'] },
  { phrase: 'specialty coffee', slugs: ['specialty_coffee'] },
  { phrase: 'specialty beans', slugs: ['specialty_coffee'] },
  { phrase: 'cold brew', slugs: ['cold_brew'] },
  { phrase: 'iced coffee', slugs: ['cold_brew', 'good_iced_drinks'] },
  { phrase: 'single origin', slugs: ['single_origin'] },
  { phrase: 'decaf', slugs: ['good_decaf'] },
  { phrase: 'matcha', slugs: ['matcha'] },
  { phrase: 'iced drinks', slugs: ['good_iced_drinks', 'cold_brew'] },
  { phrase: 'vegan', slugs: ['vegan_friendly'] },
  { phrase: 'vegan friendly', slugs: ['vegan_friendly'] },
  { phrase: 'natural light', slugs: ['good_natural_light'] },
  { phrase: 'sunlight', slugs: ['good_natural_light'] },
  { phrase: 'neighborhood', slugs: ['neighborhood_feel'] },
  { phrase: 'neighbourhood', slugs: ['neighborhood_feel'] },
  { phrase: 'local feel', slugs: ['neighborhood_feel'] },
  { phrase: 'community feel', slugs: ['neighborhood_feel'] },
  { phrase: 'filter coffee', slugs: ['great_filter', 'specialty_coffee'] },
  { phrase: 'pour over', slugs: ['great_filter'] },
  { phrase: 'pour-over', slugs: ['great_filter'] },
  { phrase: 'great coffee', slugs: ['specialty_coffee', 'great_espresso', 'great_filter'] },
  { phrase: 'outside seating', slugs: ['outdoor_seating'] },
  { phrase: 'outdoor seating', slugs: ['outdoor_seating'] },
  { phrase: 'dog friendly', slugs: ['pet_friendly'] },
  { phrase: 'pet friendly', slugs: ['pet_friendly'] },
  { phrase: 'design led', slugs: ['aesthetic'] },
  { phrase: 'design-led', slugs: ['aesthetic'] },
  { phrase: 'instagrammable', slugs: ['aesthetic', 'cosy'] },
  { phrase: 'peaceful', slugs: ['quiet'] },
  { phrase: 'relaxed', slugs: ['quiet', 'cosy'] },
  { phrase: 'good for calls', slugs: ['good_for_calls', 'quiet'] },
  { phrase: 'open late', slugs: ['open_late'] },
  { phrase: 'fast service', slugs: ['quick_stop'] },
  { phrase: 'quick stop', slugs: ['quick_stop'] },
  { phrase: 'settle in', slugs: ['good_for_working', 'quiet'] },
  { phrase: 'top coffee', slugs: ['specialty_coffee', 'great_espresso'] },
  { phrase: 'espresso', slugs: ['great_espresso', 'specialty_coffee'] },
  { phrase: 'pastries', slugs: ['great_pastries'] },
  { phrase: 'pastry', slugs: ['great_pastries'] },
  { phrase: 'croissant', slugs: ['great_pastries'] },
  { phrase: 'brunch', slugs: ['good_food'] },
  { phrase: 'lunch', slugs: ['good_food'] },
  { phrase: 'food', slugs: ['good_food'] },
  { phrase: 'terrace', slugs: ['outdoor_seating'] },
  { phrase: 'outdoor', slugs: ['outdoor_seating'] },
  { phrase: 'aesthetic', slugs: ['aesthetic'] },
  { phrase: 'pretty', slugs: ['aesthetic', 'cosy'] },
  { phrase: 'minimal', slugs: ['aesthetic'] },
  { phrase: 'trendy', slugs: ['aesthetic', 'busy'] },
  { phrase: 'design', slugs: ['aesthetic'] },
  { phrase: 'quiet', slugs: ['quiet'] },
  { phrase: 'calm', slugs: ['quiet'] },
  { phrase: 'cosy', slugs: ['cosy'] },
  { phrase: 'cozy', slugs: ['cosy'] },
  { phrase: 'focus', slugs: ['quiet', 'good_for_working'] },
  { phrase: 'bright', slugs: ['good_natural_light', 'aesthetic', 'spacious'] },
  { phrase: 'wifi', slugs: ['good_wifi'] },
  { phrase: 'dog', slugs: ['pet_friendly'] },
  { phrase: 'v60', slugs: ['great_filter'] },
  { phrase: 'filter', slugs: ['great_filter'] },
];

const PHRASES_BY_LENGTH = [...SEARCH_INTENT_PHRASES].sort(
  (a, b) => b.phrase.length - a.phrase.length
);

export type ParsedCafeSearchQuery = {
  normalized: string;
  tokens: string[];
  intentSlugs: Set<CanonicalTagSlug>;
  areaTerms: Set<string>;
};

export function parseCafeSearchQuery(queryRaw: string): ParsedCafeSearchQuery {
  const normalized = normalizeCafeSearchText(queryRaw);
  const tokens = tokenizeCafeSearchText(normalized);
  const intentSlugs = new Set<CanonicalTagSlug>();

  const fullSlug = resolveToCanonicalTagSlug(normalized);
  if (fullSlug) intentSlugs.add(fullSlug);

  for (const token of tokens) {
    const tokenSlug = resolveToCanonicalTagSlug(token);
    if (tokenSlug) intentSlugs.add(tokenSlug);
  }

  for (const mapping of PHRASES_BY_LENGTH) {
    if (normalized.includes(mapping.phrase)) {
      for (const slug of mapping.slugs) intentSlugs.add(slug);
    }
  }

  const areaTerms = new Set(tokens.filter((t) => t.length >= 3));
  return { normalized, tokens, intentSlugs, areaTerms };
}
