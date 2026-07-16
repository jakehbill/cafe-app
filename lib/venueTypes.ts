/**
 * Venue types for Beaned spaces (`cafes.venue_type` / `cafe_submissions.venue_type`).
 * Labels are user-facing; `value` matches the database enum/text values.
 */

export const DEFAULT_VENUE_TYPE = 'cafe' as const;

export const VENUE_TYPE_OPTIONS = [
  { value: 'cafe', emoji: '☕', label: 'Café' },
  { value: 'coworking', emoji: '🏢', label: 'Coworking' },
  { value: 'hotel_lobby', emoji: '🏨', label: 'Hotel Lobby' },
  { value: 'library', emoji: '📚', label: 'Library' },
  { value: 'restaurant', emoji: '🍽', label: 'Restaurant' },
  { value: 'airport_lounge', emoji: '✈️', label: 'Airport Lounge' },
  { value: 'airport_restaurant', emoji: '🥪', label: 'Airport Restaurant' },
  { value: 'museum', emoji: '🏛', label: 'Museum' },
  { value: 'university_space', emoji: '🎓', label: 'University Space' },
  { value: 'beach_club', emoji: '🏖', label: 'Beach Club' },
  { value: 'surf_cafe', emoji: '🏄', label: 'Surf Café' },
  { value: 'yoga_studio', emoji: '🧘', label: 'Yoga Studio' },
  { value: 'climbing_gym', emoji: '🧗', label: 'Climbing Gym' },
  { value: 'community_space', emoji: '🏛', label: 'Community Space' },
  { value: 'other', emoji: '📍', label: 'Other' },
] as const;

export type VenueTypeValue = (typeof VENUE_TYPE_OPTIONS)[number]['value'];

export type VenueTypeOption = (typeof VENUE_TYPE_OPTIONS)[number];

const VENUE_TYPE_SET = new Set<string>(VENUE_TYPE_OPTIONS.map((o) => o.value));

const VENUE_TYPE_BY_VALUE = new Map<VenueTypeValue, VenueTypeOption>(
  VENUE_TYPE_OPTIONS.map((o) => [o.value, o])
);

/** Normalize DB / form values; missing or unknown → `cafe`. */
export function normalizeVenueType(raw: unknown): VenueTypeValue {
  if (raw == null) return DEFAULT_VENUE_TYPE;
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, '_');
  if (VENUE_TYPE_SET.has(s)) return s as VenueTypeValue;
  return DEFAULT_VENUE_TYPE;
}

export function getVenueTypeOption(raw: unknown): VenueTypeOption {
  return VENUE_TYPE_BY_VALUE.get(normalizeVenueType(raw)) ?? VENUE_TYPE_BY_VALUE.get(DEFAULT_VENUE_TYPE)!;
}

/** e.g. "🏨 Hotel Lobby" */
export function formatVenueTypeBadge(raw: unknown): string {
  const opt = getVenueTypeOption(raw);
  return `${opt.emoji} ${opt.label}`;
}

export function isVenueTypeValue(raw: unknown): raw is VenueTypeValue {
  if (raw == null) return false;
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, '_');
  return VENUE_TYPE_SET.has(s);
}
