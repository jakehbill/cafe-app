import type { Cafe } from '@/data/cafes';

/**
 * Normalize `public_coffee_score` from `cafe_public_scores` to a 0–10 Work Score average.
 * After Sprint 4, `ratings.coffee_rating` is 1–10 (legacy 1–5 rows should be migrated ×2).
 * Does not round to integers — public averages may be 8.5, 9.2, etc.
 */
export function rawPublicCoffeeToOutOf5(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  const clamped = Math.min(10, Math.max(0, raw));
  if (clamped <= 0) return null;
  return Math.round(clamped * 10) / 10;
}

/** Alias — Work Score is stored/displayed on a 0–10 scale. */
export const rawPublicWorkScoreToOutOf10 = rawPublicCoffeeToOutOf5;

/** UI-only fallback when a café has no community ratings (`coffee_rating_count` is 0). */
export const UNRATED_PUBLIC_COFFEE_DISPLAY_BASELINE = 8.0;

function normalizeCoffeeRatingCount(ratingCount?: number | null): number {
  if (ratingCount == null || !Number.isFinite(ratingCount)) return 0;
  return Math.max(0, Math.floor(ratingCount));
}

/**
 * Public Work Score for cards/detail — one decimal on a 0–10 scale (e.g. 8.5, 9.0).
 * When `ratingCount` is 0 and there is no stored average, shows {@link UNRATED_PUBLIC_COFFEE_DISPLAY_BASELINE}.
 * Does not modify Supabase data or averages.
 */
export function formatPublicCoffeeOutOf5(
  raw: number | null | undefined,
  ratingCount?: number | null
): string {
  const normalized = rawPublicCoffeeToOutOf5(raw);
  if (normalized != null) {
    return normalized.toFixed(1);
  }

  if (normalizeCoffeeRatingCount(ratingCount) <= 0) {
    return UNRATED_PUBLIC_COFFEE_DISPLAY_BASELINE.toFixed(1);
  }

  return '—';
}

/** Same as `formatPublicCoffeeOutOf5` using a café row’s score + count. */
export function formatPublicCoffeeForCafe(
  cafe: Pick<Cafe, 'publicCoffeeScore' | 'coffeeRatingCount'>
): string {
  return formatPublicCoffeeOutOf5(cafe.publicCoffeeScore, cafe.coffeeRatingCount);
}

/**
 * Numeric Work Score out of 10 for a café (same rules as {@link formatPublicCoffeeForCafe}).
 * `null` when there is nothing to show (including no baseline).
 */
export function publicCoffeeOutOf5ForCafe(
  cafe: Pick<Cafe, 'publicCoffeeScore' | 'coffeeRatingCount'>
): number | null {
  const normalized = rawPublicCoffeeToOutOf5(cafe.publicCoffeeScore);
  if (normalized != null) return normalized;
  if (normalizeCoffeeRatingCount(cafe.coffeeRatingCount) <= 0) {
    return UNRATED_PUBLIC_COFFEE_DISPLAY_BASELINE;
  }
  return null;
}

/**
 * Editorial qualitative band for a Work Score (0–10 scale).
 *
 * | 0–10 | Label |
 * |------|-------|
 * | 9.8–10.0 | Outstanding |
 * | 9.3–9.7 | Excellent |
 * | 8.7–9.2 | Great |
 * | 8.0–8.6 | Solid |
 * | 7.0–7.9 | Okay |
 * | below 7.0 | none |
 */
export type WorkScoreQualitativeLabel =
  | 'Outstanding'
  | 'Excellent'
  | 'Great'
  | 'Solid'
  | 'Okay';

export function workScoreQualitativeLabel(
  outOf10: number | null | undefined
): WorkScoreQualitativeLabel | null {
  if (outOf10 == null || !Number.isFinite(outOf10) || outOf10 <= 0) return null;
  if (outOf10 >= 9.8) return 'Outstanding';
  if (outOf10 >= 9.3) return 'Excellent';
  if (outOf10 >= 8.7) return 'Great';
  if (outOf10 >= 8.0) return 'Solid';
  if (outOf10 >= 7.0) return 'Okay';
  return null;
}

/** Qualitative label for a café’s displayed Work Score, or `null` below 7.0 / missing. */
export function workScoreQualitativeLabelForCafe(
  cafe: Pick<Cafe, 'publicCoffeeScore' | 'coffeeRatingCount'>
): WorkScoreQualitativeLabel | null {
  return workScoreQualitativeLabel(publicCoffeeOutOf5ForCafe(cafe));
}

/**
 * Card / detail meta — numeric Work Score only (caption lives in `WorkScoreHero`).
 * Calculation unchanged; presentation only.
 */
export function formatWorkScoreCardLabel(
  cafe: Pick<Cafe, 'publicCoffeeScore' | 'coffeeRatingCount'>
): string {
  return formatPublicCoffeeForCafe(cafe).trim() || '—';
}

/** User-entered Work Score (1–10) for detail “your rating” line. */
export function formatPrivateCoffeeOneDecimal(raw: number): string {
  if (!Number.isFinite(raw) || raw <= 0) return '—';
  return Number(raw).toFixed(1);
}
