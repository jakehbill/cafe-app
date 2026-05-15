/** Beaned coffee ratings: 1–5 inclusive, 0.5 increments only. */

export const COFFEE_RATING_MIN = 1;
export const COFFEE_RATING_MAX = 5;
export const COFFEE_RATING_STEP = 0.5;

/** Clamp to 1–5 and snap to nearest half step (e.g. 4.2 → 4, 4.3 → 4.5). */
export function quantizeCoffeeRatingForStorage(raw: number): number {
  if (!Number.isFinite(raw)) return COFFEE_RATING_MIN;
  const clamped = Math.min(COFFEE_RATING_MAX, Math.max(COFFEE_RATING_MIN, raw));
  return Math.round(clamped * 2) / 2;
}

/** Parse optional user input; returns null when empty/invalid. */
export function normalizeCoffeeRatingInput(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  return quantizeCoffeeRatingForStorage(raw);
}

/** True when value is already on the 1–5 half-step grid (within float tolerance). */
export function isHalfStepCoffeeRating(raw: number): boolean {
  if (!Number.isFinite(raw)) return false;
  if (raw < COFFEE_RATING_MIN || raw > COFFEE_RATING_MAX) return false;
  const doubled = raw * 2;
  return Math.abs(doubled - Math.round(doubled)) < 0.001;
}

/**
 * Display a coffee rating: whole numbers without “.0”, halves with one decimal (4.5).
 */
export function formatCoffeeRatingValue(raw: number | null | undefined): string {
  if (raw == null || !Number.isFinite(raw)) return '—';
  const q = quantizeCoffeeRatingForStorage(raw);
  return q % 1 === 0 ? String(q) : q.toFixed(1);
}

export function formatCoffeeRatingOutOf5(raw: number | null | undefined): string {
  if (raw == null || !Number.isFinite(raw)) return 'Not rated';
  return `${formatCoffeeRatingValue(raw)} / 5`;
}
