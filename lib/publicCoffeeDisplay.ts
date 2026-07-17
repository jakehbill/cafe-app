import type { Cafe } from '@/data/cafes';

/**
 * Normalize `public_coffee_score` from `cafe_public_scores` to a 0–10 Work Score average.
 * After Sprint 4 / schema v2, `ratings.coffee_rating` is 1–10.
 * Does not invent scores when a space has never been reviewed.
 */
export function rawPublicCoffeeToOutOf5(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  const clamped = Math.min(10, Math.max(0, raw));
  if (clamped <= 0) return null;
  return Math.round(clamped * 10) / 10;
}

/** Alias — Work Score is stored/displayed on a 0–10 scale. */
export const rawPublicWorkScoreToOutOf10 = rawPublicCoffeeToOutOf5;

/**
 * @deprecated Removed in Sprint 6 — unrated spaces must not show a fake score.
 * Kept as `null` so accidental imports fail closed.
 */
export const UNRATED_PUBLIC_COFFEE_DISPLAY_BASELINE: null = null;

function normalizeCoffeeRatingCount(ratingCount?: number | null): number {
  if (ratingCount == null || !Number.isFinite(ratingCount)) return 0;
  return Math.max(0, Math.floor(ratingCount));
}

/** True when the café has at least one public Work Score contribution. */
export function cafeHasPublicWorkScore(
  cafe: Pick<Cafe, 'publicCoffeeScore' | 'coffeeRatingCount'>
): boolean {
  if (normalizeCoffeeRatingCount(cafe.coffeeRatingCount) <= 0) return false;
  return rawPublicCoffeeToOutOf5(cafe.publicCoffeeScore) != null;
}

/**
 * Public Work Score for cards/detail — one decimal on a 0–10 scale (e.g. 8.5, 9.0).
 * Empty string when never reviewed (no baseline / no legacy 5.0).
 */
export function formatPublicCoffeeOutOf5(
  raw: number | null | undefined,
  ratingCount?: number | null
): string {
  if (normalizeCoffeeRatingCount(ratingCount) <= 0) {
    return '';
  }
  const normalized = rawPublicCoffeeToOutOf5(raw);
  if (normalized != null) {
    return normalized.toFixed(1);
  }
  return '';
}

/** Same as `formatPublicCoffeeOutOf5` using a café row’s score + count. */
export function formatPublicCoffeeForCafe(
  cafe: Pick<Cafe, 'publicCoffeeScore' | 'coffeeRatingCount'>
): string {
  return formatPublicCoffeeOutOf5(cafe.publicCoffeeScore, cafe.coffeeRatingCount);
}

/**
 * Numeric Work Score out of 10, or `null` when never reviewed.
 */
export function publicCoffeeOutOf5ForCafe(
  cafe: Pick<Cafe, 'publicCoffeeScore' | 'coffeeRatingCount'>
): number | null {
  if (!cafeHasPublicWorkScore(cafe)) return null;
  return rawPublicCoffeeToOutOf5(cafe.publicCoffeeScore);
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

/** Qualitative label, or `null` when unrated / below 7.0. */
export function workScoreQualitativeLabelForCafe(
  cafe: Pick<Cafe, 'publicCoffeeScore' | 'coffeeRatingCount'>
): WorkScoreQualitativeLabel | null {
  return workScoreQualitativeLabel(publicCoffeeOutOf5ForCafe(cafe));
}

/**
 * Card / detail meta — numeric Work Score, or empty when never reviewed.
 */
export function formatWorkScoreCardLabel(
  cafe: Pick<Cafe, 'publicCoffeeScore' | 'coffeeRatingCount'>
): string {
  return formatPublicCoffeeForCafe(cafe).trim();
}

/** User-entered Work Score (1–10) for detail “your rating” line. */
export function formatPrivateCoffeeOneDecimal(raw: number): string {
  if (!Number.isFinite(raw) || raw <= 0) return '—';
  return Number(raw).toFixed(1);
}
