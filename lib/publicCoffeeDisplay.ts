/**
 * Format `public_coffee_score` (from `cafe_public_scores`) for display out of 5.
 * Matches legacy UI scale: values stored up to ~10 are treated like `CoffeeCupRating.normalizeToFive`.
 */
export function rawPublicCoffeeToOutOf5(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  const n = raw > 5 ? raw / 2 : raw;
  return Math.min(5, Math.max(0, n));
}

/** One decimal, or em dash when no score. */
export function formatPublicCoffeeOutOf5(raw: number | null | undefined): string {
  const n = rawPublicCoffeeToOutOf5(raw);
  if (n == null) return '—';
  return n.toFixed(1);
}

/** User-entered coffee (1–5) for detail “your rating” line — one decimal. */
export function formatPrivateCoffeeOneDecimal(raw: number): string {
  if (!Number.isFinite(raw) || raw <= 0) return '—';
  return Math.min(5, Math.max(0, raw)).toFixed(1);
}
