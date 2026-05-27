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

/** Public café score for cards/detail — one decimal (e.g. 4.5, 5.0). */
export function formatPublicCoffeeOutOf5(raw: number | null | undefined): string {
  const n = rawPublicCoffeeToOutOf5(raw);
  if (n == null) return '—';
  return n.toFixed(1);
}

/** User-entered coffee (1–5) for detail “your rating” line. */
export function formatPrivateCoffeeOneDecimal(raw: number): string {
  if (!Number.isFinite(raw) || raw <= 0) return '—';
  return Number(raw).toFixed(1);
}
