import type { Cafe } from '@/data/cafes';

const MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/?api=1&query=';

/** Ensures `Linking.openURL` receives an absolute https URL on mobile. */
export function normalizeExternalMapsUrl(url: string): string {
  const t = url.trim();
  if (t.startsWith('//')) return `https:${t}`;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/**
 * Resolves a Google Maps URL for opening or sharing.
 * 1. `googleMapsUrl` from Supabase when present
 * 2. Search URL from street / formatted address when present
 * 3. Search URL from coordinates (listing cafes always have lat/lng)
 * 4. Search URL from name + neighborhood
 */
export function resolveCafeMapsUrl(cafe: Cafe): string | null {
  const direct = cafe.googleMapsUrl?.trim();
  if (direct) return normalizeExternalMapsUrl(direct);

  const addr = (cafe.addressLine ?? '').trim();
  if (addr.length > 0) {
    return `${MAPS_SEARCH_BASE}${encodeURIComponent(addr)}`;
  }

  const { latitude, longitude } = cafe;
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `${MAPS_SEARCH_BASE}${encodeURIComponent(`${latitude},${longitude}`)}`;
  }

  const q = `${cafe.name} ${cafe.neighborhood}`.trim();
  if (q.length > 0) {
    return `${MAPS_SEARCH_BASE}${encodeURIComponent(q)}`;
  }

  return null;
}
