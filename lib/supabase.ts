import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Cross-platform auth storage:
    // - native: AsyncStorage
    // - web: localStorage (AsyncStorage is not available on web)
    storage:
      Platform.OS === 'web'
        ? {
            getItem: async (key: string) => {
              if (typeof window === 'undefined') return null;
              return window.localStorage.getItem(key);
            },
            setItem: async (key: string, value: string) => {
              if (typeof window === 'undefined') return;
              window.localStorage.setItem(key, value);
            },
            removeItem: async (key: string) => {
              if (typeof window === 'undefined') return;
              window.localStorage.removeItem(key);
            },
          }
        : // Import lazily so web bundles don't try to load native storage.
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('@react-native-async-storage/async-storage').default,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type SupabaseActionResult = { ok: true } | { ok: false; error: string };

/**
 * Save a cafe for the current user (writes 1 row to `saves`).
 * Returns a simple success/failure result so UI can react.
 */
export async function saveCafe(cafeId: number): Promise<SupabaseActionResult> {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('saveCafe: auth getUser failed:', authError);
    return { ok: false, error: authError.message };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { ok: false, error: 'You must be signed in to save a cafe.' };
  }

  const res = await supabase.from('saves').insert({ cafe_id: cafeId, user_id: userId });
  if (res.error) {
    console.error('saveCafe: insert failed:', res.error);
    return { ok: false, error: res.error.message };
  }

  return { ok: true };
}

/**
 * Unsave a cafe for the current user (deletes from `saves` by cafe_id + user_id).
 * Returns a simple success/failure result so UI can react.
 */
export async function unsaveCafe(cafeId: number): Promise<SupabaseActionResult> {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('unsaveCafe: auth getUser failed:', authError);
    return { ok: false, error: authError.message };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { ok: false, error: 'You must be signed in to unsave a cafe.' };
  }

  const res = await supabase.from('saves').delete().eq('user_id', userId).eq('cafe_id', cafeId);
  if (res.error) {
    console.error('unsaveCafe: delete failed:', res.error);
    return { ok: false, error: res.error.message };
  }

  return { ok: true };
}

/**
 * Create or update a cafe rating (0–10) for the current user.
 * Uses an upsert so repeated ratings update the same row.
 */
export async function rateCafe(
  cafeId: number,
  rating: { coffee: number; work: number; vibe: number; overall?: number }
): Promise<SupabaseActionResult> {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('rateCafe: auth getUser failed:', authError);
    return { ok: false, error: authError.message };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { ok: false, error: 'You must be signed in to rate a cafe.' };
  }

  // Clamp each score into 0–10 to keep data clean.
  const clamp010 = (n: number) => Math.min(10, Math.max(0, n));
  const coffee = clamp010(rating.coffee);
  const work = clamp010(rating.work);
  const vibe = clamp010(rating.vibe);
  // Overall rating is always the average of coffee/work/vibe.
  const overall = (coffee + work + vibe) / 3;

  const res = await supabase
    .from('ratings')
    .upsert(
      {
        cafe_id: cafeId,
        user_id: userId,
        // rating = overall (0–10)
        rating: overall,
        // category ratings (0–10)
        coffee_rating: coffee,
        work_rating: work,
        vibe_rating: vibe,
      },
      { onConflict: 'user_id,cafe_id' }
    );

  if (res.error) {
    console.error('rateCafe: upsert failed:', res.error);
    return { ok: false, error: res.error.message };
  }

  return { ok: true };
}

/**
 * Read the current user's rating for one cafe.
 * Returns null when the user isn't signed in or no rating exists.
 */
export async function getUserRating(cafeId: number): Promise<number | null> {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('getUserRating: auth getUser failed:', authError);
    return null;
  }

  const userId = data.user?.id;
  if (!userId) {
    return null;
  }

  const res = await supabase
    .from('ratings')
    .select('rating')
    .eq('user_id', userId)
    .eq('cafe_id', cafeId)
    .maybeSingle();

  if (res.error) {
    console.error('getUserRating: select failed:', res.error);
    return null;
  }

  const v = res.data?.rating;
  return typeof v === 'number' ? v : null;
}

