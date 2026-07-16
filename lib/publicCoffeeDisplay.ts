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
 * Card / detail meta label — Work Score is the primary visible metric.
 * Calculation unchanged; presentation only.
 */
export function formatWorkScoreCardLabel(
  cafe: Pick<Cafe, 'publicCoffeeScore' | 'coffeeRatingCount'>
): string {
  const score = formatPublicCoffeeForCafe(cafe).trim();
  if (!score || score === '—') return 'Work Score —';
  return `Work Score ${score}`;
}

/** User-entered coffee (1–5) for detail “your rating” line. */
export function formatPrivateCoffeeOneDecimal(raw: number): string {
  if (!Number.isFinite(raw) || raw <= 0) return '—';
  return Number(raw).toFixed(1);
}
