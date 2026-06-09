/**
 * Shared TypeScript shape for cafe rows.
 * Listing data is stored in Supabase `public.cafes` and loaded via `lib/cafeCatalogSupabase.ts`.
 */
export type Cafe = {
  id: string;
  name: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  /**
   * Coffee axis for internal ranking (~0–10), derived from `public.cafe_public_scores.public_coffee_score`
   * after load — not from `cafes.coffee_score` / avg fallbacks. For visible coffee use `publicCoffeeScore`.
   */
  coffeeScore: number;
  workScore: number;
  vibeScore: number;
  /**
   * Canonical community coffee score from `public.cafe_public_scores` (aggregated `coffee_rating` only).
   * `null` when the cafe has no qualifying rows in the view.
   */
  publicCoffeeScore: number | null;
  /** Number of user ratings included in `publicCoffeeScore` (from the view). */
  coffeeRatingCount: number;
  tags: string[];
  short_description: string;
  /**
   * Google Maps URL from Supabase `google_maps_url` (optional when absent in the row).
   */
  googleMapsUrl?: string;
  /** Google Place ID from Supabase `google_place_id` when present. */
  googlePlaceId?: string;
  /**
   * Primary photo for list cards — always `imageUrls[0]` when available.
   * Legacy single-image columns are still accepted as fallback while migrating.
   */
  imageUrl?: string;
  /**
   * Ordered gallery URLs when the backend exposes multiple (e.g. `cafes.image_urls`).
   * Omitted when only a single legacy `image_url` exists.
   */
  imageUrls?: string[];
  /** Full street / formatted address when the catalog exposes it (optional). */
  addressLine?: string;
  /** Optional community counts when exposed by the backend (e.g. for trending). */
  communityStats?: {
    saves: number;
    visits: number;
  };
  /** Derived client-side from user location when available. */
  distanceMiles?: number | null;
  /** Preformatted display label, e.g. "0.4 mi". */
  distanceLabel?: string | null;
};

function sanitizeImageUrl(url: string | undefined | null): string {
  return String(url ?? '').trim();
}

function uniqueValidImageUrls(urls: Array<string | undefined | null>): string[] {
  return Array.from(new Set(urls.map(sanitizeImageUrl).filter((url) => url.length > 0)));
}

/** All photo URLs for a cafe (gallery or single legacy `imageUrl`). */
export function getCafePhotoUrls(cafe: Cafe): string[] {
  if (cafe.imageUrls && cafe.imageUrls.length > 0) {
    return uniqueValidImageUrls(cafe.imageUrls);
  }
  if (cafe.imageUrl) {
    return uniqueValidImageUrls([cafe.imageUrl]);
  }
  return [];
}

/** Single image for Home / Search / Saved cards — first in the gallery. */
export function getPrimaryPhotoUrl(cafe: Cafe): string | undefined {
  const urls = getCafePhotoUrls(cafe);
  return urls[0];
}
