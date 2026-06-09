import { Linking, Platform } from 'react-native';

import type { Cafe } from '@/data/cafes';

const MAPS_SEARCH_ORIGIN = 'https://www.google.com/maps/search/';

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
 * Opens a Google Maps (or maps) URL in a new browser tab on web.
 * Native: system handler via Linking.
 */
export async function openExternalMapsUrl(url: string): Promise<void> {
  const normalized = normalizeExternalMapsUrl(url);
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.open(normalized, '_blank', 'noopener,noreferrer');
    }
    return;
  }
  await Linking.openURL(normalized);
}

/** Name + address (or neighborhood) for Maps search / place-id query text. */
function buildCafeMapsSearchQuery(cafe: Cafe): string {
  const name = (cafe.name ?? '').trim();
  const address = (cafe.addressLine ?? '').trim();
  const neighborhood = (cafe.neighborhood ?? '').trim();

  if (name.length > 0 && address.length > 0) return `${name} ${address}`;
  if (address.length > 0) return address;
  if (name.length > 0 && neighborhood.length > 0) return `${name} ${neighborhood}`;
  if (name.length > 0) return name;
  if (neighborhood.length > 0) return neighborhood;
  return '';
}

function buildMapsSearchUrl(query: string, placeId?: string): string {
  const params = new URLSearchParams();
  params.set('api', '1');
  params.set('query', query);
  const pid = placeId?.trim();
  if (pid) params.set('query_place_id', pid);
  return `${MAPS_SEARCH_ORIGIN}?${params.toString()}`;
}

/**
 * Resolves the best Google Maps URL for a café listing.
 *
 * Priority:
 * 1. Stored `googleMapsUrl` (actual listing link when curated)
 * 2. Google Place ID + name/address search query
 * 3. Name + address (or neighborhood) text search
 * 4. Coordinates (last resort)
 */
export function resolveCafeMapsUrl(cafe: Cafe): string | null {
  const direct = cafe.googleMapsUrl?.trim();
  if (direct) return normalizeExternalMapsUrl(direct);

  const searchQuery = buildCafeMapsSearchQuery(cafe);
  const placeId = cafe.googlePlaceId?.trim();

  if (placeId) {
    const placeQuery =
      searchQuery.length > 0 ? searchQuery : (cafe.name ?? '').trim() || placeId;
    return buildMapsSearchUrl(placeQuery, placeId);
  }

  if (searchQuery.length > 0) {
    return buildMapsSearchUrl(searchQuery);
  }

  const { latitude, longitude } = cafe;
  if (hasValidCoordinatePair(latitude, longitude)) {
    return buildMapsSearchUrl(`${latitude},${longitude}`);
  }

  return null;
}

/** @deprecated Use `resolveCafeMapsUrl` — same priority order. */
export function resolveCafeGoogleMapsWebUrl(cafe: Cafe): string | null {
  return resolveCafeMapsUrl(cafe);
}
