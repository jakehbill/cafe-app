import type { Cafe } from '@/data/cafes';

const MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/?api=1&query=';

function hasValidCoordinatePair(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function hasValidCafeCoordinates(cafe: Cafe): boolean {
  return hasValidCoordinatePair(cafe.latitude, cafe.longitude);
}

/** Ensures `Linking.openURL` receives an absolute https URL on mobile. */
export function normalizeExternalMapsUrl(url: string): string {
  const t = url.trim();
  if (t.startsWith('//')) return `https:${t}`;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/**
 * Resolves a Google Maps URL for opening or sharing.
 * 1. Search URL from coordinates (preferred source of truth when valid)
 * 2. `googleMapsUrl` from Supabase when present
 * 3. Search URL from street / formatted address when present
 * 4. Search URL from name + neighborhood
 */
export function resolveCafeMapsUrl(cafe: Cafe): string | null {
  const { latitude, longitude } = cafe;
  if (hasValidCoordinatePair(latitude, longitude)) {
    // Google Maps query expects latitude,longitude ordering.
    return `${MAPS_SEARCH_BASE}${encodeURIComponent(`${latitude},${longitude}`)}`;
  }

  const direct = cafe.googleMapsUrl?.trim();
  if (direct) return normalizeExternalMapsUrl(direct);

  const addr = (cafe.addressLine ?? '').trim();
  if (addr.length > 0) {
    return `${MAPS_SEARCH_BASE}${encodeURIComponent(addr)}`;
  }

  const q = `${cafe.name} ${cafe.neighborhood}`.trim();
  if (q.length > 0) {
    return `${MAPS_SEARCH_BASE}${encodeURIComponent(q)}`;
  }

  return null;
}

/**
 * Google Maps link for web cafe detail (no in-app Beaned map).
 * 1. Stored `googleMapsUrl` from Supabase
 * 2. Search URL from cafe name + street address
 */
export function resolveCafeGoogleMapsWebUrl(cafe: Cafe): string | null {
  const direct = cafe.googleMapsUrl?.trim();
  if (direct) return normalizeExternalMapsUrl(direct);

  const addr = (cafe.addressLine ?? '').trim();
  const name = (cafe.name ?? '').trim();
  if (addr.length > 0 && name.length > 0) {
    return `${MAPS_SEARCH_BASE}${encodeURIComponent(`${name} ${addr}`)}`;
  }

  return null;
}
