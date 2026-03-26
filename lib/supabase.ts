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
 * Create or update a cafe rating for the current user.
 * Submit flow writes to `public.ratings` and fully replaces rows in `public.rating_tags`.
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
  const logStep = (step: string, payload?: Record<string, unknown>) => {
    if (!__DEV__) return;
    if (payload) {
      console.log(`[rateCafe] ${step}\n${JSON.stringify(payload, null, 2)}`);
      return;
    }
    console.log(`[rateCafe] ${step}`);
  };

  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) {
    logStep('auth.getUser failed', {
      message: authError.message,
      code: authError.code,
    });
    console.error('rateCafe: auth getUser failed:', authError);
    return { ok: false, error: authError.message };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { ok: false, error: 'You must be signed in to rate a cafe.' };
  }

  const clamp010 = (n: number) => Math.min(10, Math.max(0, n));
  const coffeeRating = Math.round(clamp010(rating.coffee));
  const workRating = Math.round(clamp010(rating.work));
  const vibeRating = Math.round(clamp010(rating.vibe));
  const normalizedCafeId = Number.parseInt(String(cafeId), 10);

  if (!Number.isFinite(normalizedCafeId)) {
    const message = `Invalid cafe_id for ratings submit: ${String(cafeId)}`;
    logStep('invalid cafe_id', { cafeId });
    console.error('rateCafe:', message);
    return { ok: false, error: message };
  }

  const ratingPayload = {
    user_id: userId,
    cafe_id: normalizedCafeId,
    rating: coffeeRating,
    coffee_rating: coffeeRating,
    work_rating: workRating,
    vibe_rating: vibeRating,
  };

  logStep('step 1: upsert ratings', {
    onConflict: 'user_id,cafe_id',
    payload: ratingPayload,
  });

  const upsertRes = await supabase
    .from('ratings')
    .upsert(ratingPayload, { onConflict: 'user_id,cafe_id' })
    .select('id, user_id, cafe_id, coffee_rating, work_rating, vibe_rating')
    .single();

  if (upsertRes.error) {
    const err = upsertRes.error;
    logStep('step 1 failed: upsert ratings error', {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint,
    });
    console.error('rateCafe: upsert failed:', err);
    return { ok: false, error: err.message };
  }

  const savedRating = upsertRes.data;
  logStep('step 2: saved rating row', { savedRating });

  const ratingId = savedRating?.id;
  if (typeof ratingId !== 'number') {
    const message = 'Ratings upsert did not return a valid numeric rating id.';
    logStep('step 2 failed: missing rating id', { savedRating });
    console.error('rateCafe:', message);
    return { ok: false, error: message };
  }

  logStep('step 3: delete existing rating_tags', { rating_id: ratingId });
  const deleteTagsRes = await supabase.from('rating_tags').delete().eq('rating_id', ratingId);
  if (deleteTagsRes.error) {
    const err = deleteTagsRes.error;
    logStep('step 3 failed: delete rating_tags error', {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint,
      rating_id: ratingId,
    });
    console.error('rateCafe: delete rating_tags failed:', err);
    return { ok: false, error: err.message };
  }

  const normalizedTags = Array.from(new Set((rating.tags ?? []).map((t) => t.trim()).filter(Boolean)));
  logStep('step 4: insert rating_tags', {
    rating_id: ratingId,
    tagCount: normalizedTags.length,
    tags: normalizedTags,
  });

  if (normalizedTags.length > 0) {
    const tagRows = normalizedTags.map((tag) => ({ rating_id: ratingId, tag }));
    const insertTagsRes = await supabase.from('rating_tags').insert(tagRows);
    if (insertTagsRes.error) {
      const err = insertTagsRes.error;
      logStep('step 4 failed: insert rating_tags error', {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint,
        rating_id: ratingId,
      });
      console.error('rateCafe: insert rating_tags failed:', err);
      return { ok: false, error: err.message };
    }
  }

  logStep('submit flow complete', { rating_id: ratingId });
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

