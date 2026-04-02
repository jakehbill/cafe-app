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
  summary: string;
  googleMapsUrl: string;
  /** When set from Supabase `image_url` / `photo_url` / etc. */
  imageUrl?: string;
  /** Optional community counts when exposed by the backend (e.g. for trending). */
  communityStats?: {
    saves: number;
    visits: number;
  };
};
