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
  coffeeScore: number;
  workScore: number;
  vibeScore: number;
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
