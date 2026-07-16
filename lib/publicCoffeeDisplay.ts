import type { Cafe } from '@/data/cafes';

/**
 * Normalize `public_coffee_score` from `cafe_public_scores` to a 0–5 average.
 * Legacy rows may store ~0–10; values already on 1–5 are left as-is.
 * Does not round to integers — public averages may be 4.5, 4.7, etc.
 */
export function rawPublicCoffeeToOutOf5(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  const n = raw > 5 ? raw / 2 : raw;
  const clamped = Math.min(5, Math.max(0, n));
  if (clamped <= 0) return null;
  return Math.round(clamped * 10) / 10;
}

/** UI-only fallback when a café has no community ratings (`coffee_rating_count` is 0). */
export const UNRATED_PUBLIC_COFFEE_DISPLAY_BASELINE = 4.0;

function normalizeCoffeeRatingCount(ratingCount?: number | null): number {
  if (ratingCount == null || !Number.isFinite(ratingCount)) return 0;
  return Math.max(0, Math.floor(ratingCount));
}

/**
 * Public café score for cards/detail — one decimal (e.g. 4.5, 5.0).
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
 * Numeric Work Score out of 5 for a café (same rules as {@link formatPublicCoffeeForCafe}).
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
 * Editorial qualitative band for a Work Score.
 * Product bands are defined on a 0–10 scale; UI scores are out of 5, so we compare `outOf5 * 2`.
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
  outOf5: number | null | undefined
): WorkScoreQualitativeLabel | null {
  if (outOf5 == null || !Number.isFinite(outOf5) || outOf5 <= 0) return null;
  const on10 = outOf5 * 2;
  if (on10 >= 9.8) return 'Outstanding';
  if (on10 >= 9.3) return 'Excellent';
  if (on10 >= 8.7) return 'Great';
  if (on10 >= 8.0) return 'Solid';
  if (on10 >= 7.0) return 'Okay';
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

/** User-entered coffee (1–5) for detail “your rating” line. */
export function formatPrivateCoffeeOneDecimal(raw: number): string {
  if (!Number.isFinite(raw) || raw <= 0) return '—';
  return Number(raw).toFixed(1);
}
