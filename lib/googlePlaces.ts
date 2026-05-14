/**
 * Google Places API (New) — autocomplete + place details for café suggestions.
 * Uses EXPO_PUBLIC_GOOGLE_PLACES_API_KEY (client-side; restrict key by HTTP referrer in GCP).
 */

import Constants from 'expo-constants';

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';

const LONDON_VIEWPORT = {
  low: { latitude: 51.25, longitude: -0.52 },
  high: { latitude: 51.72, longitude: 0.22 },
} as const;

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

export type PlacesAutocompleteItem = {
  placeId: string;
  title: string;
  subtitle: string;
};

type AutocompletePrediction = {
  place?: string;
  placeId?: string;
  text?: { text?: string };
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
};

function normalizePlaceId(raw: string): string {
  const s = raw.trim();
  if (s.startsWith('places/')) return s.slice('places/'.length);
  return s;
}

export async function fetchPlacesAutocomplete(
  input: string,
  sessionToken: string
): Promise<PlacesAutocompleteItem[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_GOOGLE_PLACES_API_KEY.');
  }
  const q = input.trim();
  if (q.length < 2) {
    return [];
  }

  const body = {
    input: q,
    sessionToken,
    includedRegionCodes: ['GB'],
    includedPrimaryTypes: ['cafe', 'coffee_shop'],
    languageCode: 'en-GB',
    regionCode: 'GB',
    locationBias: {
      rectangle: {
        low: LONDON_VIEWPORT.low,
        high: LONDON_VIEWPORT.high,
      },
    },
  };

  const res = await fetch(AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.place,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as {
    suggestions?: { placePrediction?: AutocompletePrediction }[];
    error?: { message?: string; status?: string };
  };

  if (!res.ok) {
    const msg = json.error?.message ?? res.statusText ?? 'Autocomplete request failed.';
    throw new Error(msg);
  }

  const out: PlacesAutocompleteItem[] = [];
  for (const s of json.suggestions ?? []) {
    const p = s.placePrediction;
    if (!p) continue;
    const placeId =
      (typeof p.placeId === 'string' && p.placeId.trim()) ||
      (typeof p.place === 'string' ? normalizePlaceId(p.place) : '');
    if (!placeId) continue;

    const main = p.structuredFormat?.mainText?.text?.trim() ?? '';
    const secondary = p.structuredFormat?.secondaryText?.text?.trim() ?? '';
    const fallbackTitle = p.text?.text?.trim() ?? '';
    const title = main || fallbackTitle || placeId;
    const subtitle = secondary;

    out.push({ placeId, title, subtitle });
  }
  return out;
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
