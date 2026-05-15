import { formatCoffeeRatingValue, quantizeCoffeeRatingForStorage } from '@/lib/coffeeRating';

/**
 * Format `public_coffee_score` (from `cafe_public_scores`) for display out of 5.
 * Matches legacy UI scale: values stored up to ~10 are treated like `CoffeeCupRating.normalizeToFive`.
 */
export function rawPublicCoffeeToOutOf5(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  const n = raw > 5 ? raw / 2 : raw;
  const clamped = Math.min(5, Math.max(0, n));
  if (clamped <= 0) return null;
  return quantizeCoffeeRatingForStorage(clamped);
}

/** Half-step aware label, or em dash when no score. */
export function formatPublicCoffeeOutOf5(raw: number | null | undefined): string {
  const n = rawPublicCoffeeToOutOf5(raw);
  if (n == null) return '—';
  return formatCoffeeRatingValue(n);
}

/** User-entered coffee (1–5) for detail “your rating” line. */
export function formatPrivateCoffeeOneDecimal(raw: number): string {
  if (!Number.isFinite(raw) || raw <= 0) return '—';
  return formatCoffeeRatingValue(raw);
}
