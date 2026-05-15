/** Display-only precision for lat/lng in moderation UI (storage uses full IEEE number). */
export const COORDINATE_DISPLAY_DECIMALS = 8;

export function formatCoordinateForDisplay(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(COORDINATE_DISPLAY_DECIMALS);
}

/** Parse coordinate text without rounding (full float precision from input). */
export function parseCoordinateInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}
