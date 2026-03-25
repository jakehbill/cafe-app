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
 * Writes to `public.user_cafe_ratings` (same table as `CafeStateContext.setCafeRating`), not a legacy `ratings` table.
 * Columns match `supabase/schema_all_tables.sql`: cafe_id text, coffee/work/vibe smallint, tags, notes.
 */
export async function rateCafe(
  cafeId: string | number,
  rating: {
    coffee: number;
    work: number;
    vibe: number;
    tags?: string[];
    notes?: string;
  }
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

  const clamp010 = (n: number) => Math.min(10, Math.max(0, n));
  const coffee = Math.round(clamp010(rating.coffee));
  const work = Math.round(clamp010(rating.work));
  const vibe = Math.round(clamp010(rating.vibe));

  const payload = {
    user_id: userId,
    cafe_id: String(cafeId),
    coffee,
    work,
    vibe,
    tags: rating.tags ?? [],
    notes: rating.notes ?? '',
  };

  if (__DEV__) {
    console.log(`[rateCafe] upsert → user_cafe_ratings\n${JSON.stringify(payload, null, 2)}`);
    console.log(`[rateCafe] onConflict: user_id,cafe_id`);
  }

  const res = await supabase.from('user_cafe_ratings').upsert(payload, {
    onConflict: 'user_id,cafe_id',
  });

  if (res.error) {
    const err = res.error;
    if (__DEV__) {
      console.log(
        `[rateCafe] Supabase error\n${JSON.stringify(
          {
            message: err.message,
            code: err.code,
            details: err.details,
            hint: err.hint,
          },
          null,
          2
        )}`
      );
    }
    console.error('rateCafe: upsert failed:', err);
    return { ok: false, error: err.message };
  }

  return { ok: true };
}

/**
 * Read the current user's overall score for one cafe (average of coffee/work/vibe from `user_cafe_ratings`).
 */
export async function getUserRating(cafeId: number | string): Promise<number | null> {
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
    .from('user_cafe_ratings')
    .select('coffee, work, vibe')
    .eq('user_id', userId)
    .eq('cafe_id', String(cafeId))
    .maybeSingle();

  if (res.error) {
    console.error('getUserRating: select failed:', res.error);
    return null;
  }

  const row = res.data;
  if (!row) return null;
  const c = typeof row.coffee === 'number' ? row.coffee : 0;
  const w = typeof row.work === 'number' ? row.work : 0;
  const v = typeof row.vibe === 'number' ? row.vibe : 0;
  if (c === 0 && w === 0 && v === 0) return null;
  return (c + w + v) / 3;
}

