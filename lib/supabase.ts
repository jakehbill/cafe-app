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

const topTagsCache = new Map<string, string[]>();

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
 * Writes only `coffee_rating` on `public.ratings` (no `rating`, `work_rating`, or `vibe_rating`).
 * Replaces rows in `public.rating_tags` for that rating.
 */
export async function rateCafe(
  cafeId: string | number,
  input: {
    coffee: number;
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
  const coffeeRating = Math.round(clamp010(input.coffee));
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
    coffee_rating: coffeeRating,
  };

  logStep('step 1: upsert ratings', {
    onConflict: 'user_id,cafe_id',
    payload: ratingPayload,
  });

  const upsertRes = await supabase
    .from('ratings')
    .upsert(ratingPayload, { onConflict: 'user_id,cafe_id' })
    .select('id, user_id, cafe_id, coffee_rating')
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

  const normalizedTags = Array.from(new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean)));
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
 * Coffee-only helper for rate-screen prefill from `user_cafe_ratings` (no work/vibe blend).
 */
export async function getUserCoffeeRating(cafeId: number | string): Promise<number | null> {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('getUserCoffeeRating: auth getUser failed:', authError);
    return null;
  }

  const userId = data.user?.id;
  if (!userId) {
    return null;
  }

  const res = await supabase
    .from('user_cafe_ratings')
    .select('coffee')
    .eq('user_id', userId)
    .eq('cafe_id', String(cafeId))
    .maybeSingle();

  if (res.error) {
    console.error('getUserCoffeeRating: select failed:', res.error);
    return null;
  }

  const row = res.data;
  if (!row) return null;
  const c = typeof row.coffee === 'number' ? row.coffee : 0;
  return c > 0 ? c : null;
}

/**
 * Returns top tags for one cafe, aggregated from `rating_tags` joined through `ratings`.
 * Caches the full popularity-ordered list so different callers can request up to N tags.
 */
export async function getTopCafeTags(cafeId: string, limit = 3): Promise<string[]> {
  const cached = topTagsCache.get(cafeId);
  if (cached) return cached.slice(0, limit);

  const numericCafeId = Number.parseInt(cafeId, 10);
  if (!Number.isFinite(numericCafeId)) return [];

  const ratingsRes = await supabase
    .from('ratings')
    .select('id')
    .eq('cafe_id', numericCafeId);
  if (ratingsRes.error) {
    console.error('getTopCafeTags: ratings fetch failed:', ratingsRes.error);
    return [];
  }

  const ratingIds = (ratingsRes.data ?? []).map((row) => row.id).filter((id): id is number => typeof id === 'number');
  if (ratingIds.length === 0) return [];

  const tagsRes = await supabase
    .from('rating_tags')
    .select('tag,rating_id')
    .in('rating_id', ratingIds);
  if (tagsRes.error) {
    console.error('getTopCafeTags: rating_tags fetch failed:', tagsRes.error);
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of tagsRes.data ?? []) {
    const tag = typeof row.tag === 'string' ? row.tag.trim() : '';
    if (!tag) continue;
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  const sortedTags = [...counts.entries()]
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])))
    .map(([tag]) => tag);

  topTagsCache.set(cafeId, sortedTags);
  return sortedTags.slice(0, limit);
}

/** Community line: share of ratings that included the most-picked tag (real data from `rating_tags`). */
export type CafeCommunityTagInsight = {
  totalRatings: number;
  /** % of ratings that include at least one pick of this tag */
  percent: number;
  tag: string;
};

/**
 * Best tag for “X% of people rate this for Y” — uses the most common tag among
 * `rating_tags` rows for this cafe’s ratings; % = ratings that include that tag / total ratings.
 */
export async function getCafeCommunityTagInsight(cafeId: string): Promise<CafeCommunityTagInsight | null> {
  const numericCafeId = Number.parseInt(cafeId, 10);
  if (!Number.isFinite(numericCafeId)) return null;

  const ratingsRes = await supabase
    .from('ratings')
    .select('id')
    .eq('cafe_id', numericCafeId);
  if (ratingsRes.error) {
    console.error('getCafeCommunityTagInsight: ratings fetch failed:', ratingsRes.error);
    return null;
  }

  const ratingIds = (ratingsRes.data ?? []).map((row) => row.id).filter((id): id is number => typeof id === 'number');
  const totalRatings = ratingIds.length;
  if (totalRatings === 0) return null;

  const tagsRes = await supabase
    .from('rating_tags')
    .select('tag,rating_id')
    .in('rating_id', ratingIds);
  if (tagsRes.error) {
    console.error('getCafeCommunityTagInsight: rating_tags fetch failed:', tagsRes.error);
    return null;
  }

  const tagToRatings = new Map<string, Set<number>>();
  for (const row of tagsRes.data ?? []) {
    const rid = typeof row.rating_id === 'number' ? row.rating_id : null;
    const tag = typeof row.tag === 'string' ? row.tag.trim() : '';
    if (rid == null || !tag) continue;
    if (!tagToRatings.has(tag)) tagToRatings.set(tag, new Set());
    tagToRatings.get(tag)!.add(rid);
  }

  let bestTag = '';
  let bestCount = 0;
  for (const [tag, set] of tagToRatings) {
    if (set.size > bestCount) {
      bestCount = set.size;
      bestTag = tag;
    }
  }

  if (!bestTag || bestCount === 0) return null;

  const percent = Math.min(100, Math.max(0, Math.round((bestCount / totalRatings) * 100)));
  return { totalRatings, percent, tag: bestTag };
}

