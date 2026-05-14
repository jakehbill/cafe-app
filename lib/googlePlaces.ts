/**
 * Google Places API (New) — text search + place details for café suggestions.
 * Uses EXPO_PUBLIC_GOOGLE_PLACES_API_KEY (client-side; restrict key by HTTP referrer in GCP).
 */

import Constants from 'expo-constants';

const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';

/** No spaces in field mask (Places API requirement). */
const TEXT_SEARCH_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri';

const PREFERRED_TYPES = new Set([
  'cafe',
  'coffee_shop',
  'bakery',
  'restaurant',
  'food',
]);

export function createPlacesSessionToken(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `sess_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`.slice(0, 36);
}

/** Prefer inlined `process.env`; fall back to `app.config.js` → `extra` when Metro omits the client env (web). */
function getApiKey(): string {
  const raw = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.length > 0) return t;
  }
  const fromExtra = Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (typeof fromExtra === 'string') {
    const t = fromExtra.trim();
    if (t.length > 0) return t;
  }
  return '';
}

export function getGooglePlacesApiKeyOrEmpty(): string {
  return getApiKey();
}

export type PlacesSearchListItem = {
  placeId: string;
  title: string;
  subtitle: string;
};

type TextSearchPlaceRow = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  types?: string[];
  primaryType?: string;
};

function normalizePlaceId(raw: string): string {
  const s = raw.trim();
  if (s.startsWith('places/')) return s.slice('places/'.length);
  return s;
}

function typePreferenceScore(primaryType: string | undefined, types: string[] | undefined): number {
  let score = 0;
  const pt = (primaryType ?? '').trim().toLowerCase();
  if (pt.length > 0 && PREFERRED_TYPES.has(pt)) {
    score += 6;
  }
  for (const t of types ?? []) {
    if (PREFERRED_TYPES.has(String(t).toLowerCase())) {
      score += 1;
    }
  }
  return score;
}

/**
 * Text Search (New): full query as `textQuery`, London circle bias, up to 10 results.
 * Prefers cafe / coffee_shop / bakery / restaurant / food via sort only (no API type restriction).
 */
export async function fetchPlacesTextSearch(textQuery: string): Promise<PlacesSearchListItem[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_GOOGLE_PLACES_API_KEY.');
  }
  const q = textQuery.trim();
  if (q.length < 2) {
    return [];
  }

  const body = {
    textQuery: q,
    pageSize: 10,
    languageCode: 'en-GB',
    regionCode: 'GB',
    locationBias: {
      circle: {
        center: { latitude: 51.5072, longitude: -0.1276 },
        radius: 25000,
      },
    },
  };

  const res = await fetch(SEARCH_TEXT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': TEXT_SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as {
    places?: TextSearchPlaceRow[];
    error?: { message?: string };
  };

  if (!res.ok) {
    const msg = json.error?.message ?? res.statusText ?? 'Text search request failed.';
    throw new Error(msg);
  }

  const rows = (json.places ?? []).map((p, index) => ({
    index,
    placeId: normalizePlaceId(typeof p.id === 'string' ? p.id : ''),
    title: p.displayName?.text?.trim() ?? '',
    subtitle: p.formattedAddress?.trim() ?? '',
    primaryType: p.primaryType,
    types: p.types,
  }));

  const filtered = rows.filter((r) => r.placeId.length > 0 && r.title.length > 0);

  filtered.sort((a, b) => {
    const sa = typePreferenceScore(a.primaryType, a.types);
    const sb = typePreferenceScore(b.primaryType, b.types);
    if (sb !== sa) return sb - sa;
    return a.index - b.index;
  });

  return filtered.map((r) => ({
    placeId: r.placeId,
    title: r.title,
    subtitle: r.subtitle.length > 0 ? r.subtitle : 'Address not listed',
  }));
}

export type GooglePlaceDetailsForSubmission = {
  /** Canonical place id (ChIJ…), without `places/` prefix */
  placeId: string;
  cafeName: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  websiteUri: string | null;
  nationalPhoneNumber: string | null;
  googleMapsUri: string | null;
};

export async function fetchPlaceDetailsForSubmission(
  placeId: string,
  sessionToken: string
): Promise<GooglePlaceDetailsForSubmission> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_GOOGLE_PLACES_API_KEY.');
  }
  const id = normalizePlaceId(placeId);
  if (!id) {
    throw new Error('Invalid place selection.');
  }

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?sessionToken=${encodeURIComponent(sessionToken)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'id,displayName,formattedAddress,location,websiteUri,nationalPhoneNumber,googleMapsUri',
    },
  });

  const json = (await res.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    websiteUri?: string;
    nationalPhoneNumber?: string;
    googleMapsUri?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(json.error?.message ?? res.statusText ?? 'Place details request failed.');
  }

  const rawId = typeof json.id === 'string' ? normalizePlaceId(json.id) : id;
  const cafeName = json.displayName?.text?.trim() ?? '';
  const formattedAddress = json.formattedAddress?.trim() ?? '';
  const lat = json.location?.latitude;
  const lng = json.location?.longitude;

  if (!cafeName) {
    throw new Error('This place has no display name.');
  }
  if (!formattedAddress) {
    throw new Error('This place has no formatted address.');
  }
  if (typeof lat !== 'number' || !Number.isFinite(lat) || typeof lng !== 'number' || !Number.isFinite(lng)) {
    throw new Error('This place has no usable coordinates.');
  }

  const websiteUri = json.websiteUri?.trim() || null;
  const nationalPhoneNumber = json.nationalPhoneNumber?.trim() || null;
  const googleMapsUri = json.googleMapsUri?.trim() || null;

  return {
    placeId: rawId,
    cafeName,
    formattedAddress,
    latitude: lat,
    longitude: lng,
    websiteUri,
    nationalPhoneNumber,
    googleMapsUri,
  };
}
