/** Beaned Work Score (recommendation): integers 1–10 only. */

export const COFFEE_RATING_MIN = 1;
export const COFFEE_RATING_MAX = 10;
export const COFFEE_RATING_STEP = 1;

const ALLOWED_COFFEE_RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Clamp to 1–10 and round to nearest integer for storage/API. */
export function quantizeCoffeeRatingForStorage(raw: number): number {
  if (!Number.isFinite(raw)) return COFFEE_RATING_MIN;
  const clamped = Math.min(COFFEE_RATING_MAX, Math.max(COFFEE_RATING_MIN, raw));
  return Math.round(Number(clamped));
}

/** Parse optional user input; returns null when empty/invalid. */
export function normalizeCoffeeRatingInput(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  return quantizeCoffeeRatingForStorage(raw);
}

export function isAllowedCoffeeRating(raw: number): boolean {
  const n = quantizeCoffeeRatingForStorage(raw);
  return ALLOWED_COFFEE_RATINGS.includes(n as (typeof ALLOWED_COFFEE_RATINGS)[number]);
}

/** Display with one decimal place (9 → 9.0); storage remains integer. */
export function formatCoffeeRatingValue(raw: number | null | undefined): string {
  if (raw == null || !Number.isFinite(raw)) return '—';
  const q = quantizeCoffeeRatingForStorage(raw);
  return Number(q).toFixed(1);
}

export function formatCoffeeRatingOutOf5(raw: number | null | undefined): string {
  if (raw == null || !Number.isFinite(raw)) return 'Not rated';
  return `${formatCoffeeRatingValue(raw)} / 10`;
}
