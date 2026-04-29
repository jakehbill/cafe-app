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

  const clamp015 = (n: number) => Math.min(5, Math.max(1, n));
  const quantizeHalf = (n: number) => Math.round(n * 2) / 2;
  const coffeeRating = quantizeHalf(clamp015(input.coffee));
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
    .select('id');

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

  const rows = upsertRes.data;
  let ratingId: number | string | undefined = rows?.[0]?.id;

  if (ratingId == null) {
    const fetchRes = await supabase
      .from('ratings')
      .select('id')
      .eq('user_id', userId)
      .eq('cafe_id', normalizedCafeId)
      .maybeSingle();
    ratingId = fetchRes.data?.id;
    if (fetchRes.error) {
      logStep('step 2 fallback select failed', { message: fetchRes.error.message });
      console.error('rateCafe: fallback select ratings id failed:', fetchRes.error);
      return { ok: false, error: fetchRes.error.message };
    }
  }

  logStep('step 2: resolved rating id', { ratingId });

  if (ratingId == null) {
    const message = 'Ratings upsert did not return a rating id.';
    logStep('step 2 failed: missing rating id', {});
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
 * Coffee-only helper for rate-screen prefill from `user_cafe_ratings`.
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

export type CafeRecentReview = {
  note: string;
  createdAt: string | null;
  displayName: string | null;
};

export type PublicVisitNote = {
  cafeId: string | null;
  cafeName: string;
  cafeArea: string | null;
  note: string;
  createdAt: string;
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

/**
 * Most recent user-written notes for one cafe (UGC review snippets).
 * Pulls from `user_cafe_ratings` and returns up to `limit` non-empty notes.
 */
export async function getRecentCafeReviews(cafeId: string, limit = 5): Promise<CafeRecentReview[]> {
  const id = String(cafeId).trim();
  if (!id) return [];

  let rows: Array<{ user_id?: string | null; notes?: string | null; created_at?: string | null }> = [];

  // Preferred path: newest-first by created_at (when column exists in this project schema).
  const byCreatedAtRes = await supabase
    .from('user_cafe_ratings')
    .select('user_id, notes, created_at')
    .eq('cafe_id', id)
    .not('notes', 'is', null)
    .neq('notes', '')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!byCreatedAtRes.error) {
    rows = (byCreatedAtRes.data ?? []) as Array<{
      user_id?: string | null;
      notes?: string | null;
      created_at?: string | null;
    }>;
  } else if (byCreatedAtRes.error.code === '42703') {
    // Backward-compatible fallback for older setups without created_at on user_cafe_ratings.
    const fallbackRes = await supabase
      .from('user_cafe_ratings')
      .select('user_id, notes')
      .eq('cafe_id', id)
      .not('notes', 'is', null)
      .neq('notes', '')
      .limit(limit);
    if (fallbackRes.error) {
      console.error('getRecentCafeReviews fallback failed:', fallbackRes.error);
      return [];
    }
    rows = (fallbackRes.data ?? []) as Array<{ user_id?: string | null; notes?: string | null }>;
  } else {
    console.error('getRecentCafeReviews failed:', byCreatedAtRes.error);
    return [];
  }

  const userIds = Array.from(
    new Set(
      rows
        .map((row) => (row.user_id ? String(row.user_id).trim() : ''))
        .filter((v) => v.length > 0)
    )
  );
  let profileMap = new Map<string, { displayName: string | null }>();
  if (userIds.length > 0) {
    // Prefer schema with `profiles.user_id`; fall back to `profiles.id` when older schemas differ.
    let profileRows:
      | Array<{ user_id?: string | null; id?: string | null; display_name?: string | null }>
      | null = null;

    const profByUserIdRes = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', userIds);

    if (!profByUserIdRes.error) {
      profileRows = (profByUserIdRes.data ?? []) as Array<{
        user_id?: string | null;
        display_name?: string | null;
      }>;
    } else if (profByUserIdRes.error.code === '42703') {
      const profByIdRes = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds);
      if (profByIdRes.error) {
        console.error('getRecentCafeReviews profiles fetch failed:', profByIdRes.error);
      } else {
        profileRows = (profByIdRes.data ?? []) as Array<{
          id?: string | null;
          display_name?: string | null;
        }>;
      }
    } else {
      console.error('getRecentCafeReviews profiles fetch failed:', profByUserIdRes.error);
    }

    if (profileRows) {
      profileMap = new Map(
        profileRows
          .map((row) => {
            const key = String(row.user_id ?? row.id ?? '').trim();
            if (!key) return null;
            const displayName = typeof row.display_name === 'string' ? row.display_name.trim() : '';
            return [
              key,
              {
                displayName: displayName.length > 0 ? displayName : null,
              },
            ] as const;
          })
          .filter((entry): entry is readonly [string, { displayName: string | null }] => entry != null)
      );
    }
  }

  const cleaned = rows
    .map((row) => {
      const note = (row.notes ?? '').trim();
      if (!note) return null;
      const uid = row.user_id ? String(row.user_id).trim() : '';
      const profile = uid ? profileMap.get(uid) : undefined;
      return {
        note,
        createdAt: row.created_at ?? null,
        displayName: profile?.displayName ?? null,
      } satisfies CafeRecentReview;
    })
    .filter((row): row is CafeRecentReview => row != null)
    .sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });

  return cleaned.slice(0, limit);
}

/**
 * Recent anonymous community notes from public visit logs.
 * Source of truth: non-empty notes in `user_cafe_visits`.
 */
export async function getRecentPublicVisitNotes(limit = 5): Promise<PublicVisitNote[]> {
  const safeLimit = Math.max(1, Math.min(10, Math.floor(limit)));
  const visitsRes = await supabase
    .from('user_cafe_visits')
    .select('cafe_id, submission_id, note, created_at')
    .not('note', 'is', null)
    .order('created_at', { ascending: false })
    .limit(Math.max(safeLimit * 4, safeLimit));
  if (visitsRes.error) {
    console.error('getRecentPublicVisitNotes failed (visits):', visitsRes.error);
    return [];
  }

  const normalized = (visitsRes.data ?? [])
    .map((row) => {
      const cafeIdRaw = String((row as { cafe_id?: unknown }).cafe_id ?? '').trim();
      const submissionIdRaw = String((row as { submission_id?: unknown }).submission_id ?? '').trim();
      const note = String((row as { note?: unknown }).note ?? '').trim();
      const createdAt = String((row as { created_at?: unknown }).created_at ?? '').trim();
      if (!note || !createdAt) return null;
      return {
        cafeId: cafeIdRaw || null,
        submissionId: submissionIdRaw || null,
        note,
        createdAt,
      };
    })
    .filter((row): row is { cafeId: string | null; submissionId: string | null; note: string; createdAt: string } => row != null);

  const uniqueCafeIds = Array.from(new Set(normalized.map((row) => row.cafeId).filter((id): id is string => Boolean(id))));
  const uniqueSubmissionIds = Array.from(
    new Set(normalized.map((row) => row.submissionId).filter((id): id is string => Boolean(id)))
  );

  const cafeMeta = new Map<string, { name: string; area: string | null }>();
  await Promise.all(
    uniqueCafeIds.map(async (cafeId) => {
      const cafeRes = await supabase.from('cafes').select('id, name, neighborhood').eq('id', cafeId).maybeSingle();
      if (cafeRes.error) {
        console.error('getRecentPublicVisitNotes failed (cafe lookup):', { cafeId, error: cafeRes.error });
        return;
      }
      if (!cafeRes.data) return;
      const row = cafeRes.data as { name?: unknown; neighborhood?: unknown };
      const name = String(row.name ?? '').trim();
      if (!name) return;
      const area = String(row.neighborhood ?? '').trim() || null;
      cafeMeta.set(cafeId, { name, area });
    })
  );

  const submissionMeta = new Map<string, { name: string; area: string | null }>();
  if (uniqueSubmissionIds.length > 0) {
    const submissionsRes = await supabase
      .from('cafe_submissions')
      .select('id, cafe_name, area, approved_cafe_id')
      .in('id', uniqueSubmissionIds);
    if (submissionsRes.error) {
      console.error('getRecentPublicVisitNotes failed (submission lookup):', submissionsRes.error);
    } else {
      for (const row of submissionsRes.data ?? []) {
        const id = String((row as { id?: unknown }).id ?? '').trim();
        if (!id) continue;
        const name = String((row as { cafe_name?: unknown }).cafe_name ?? '').trim();
        const area = String((row as { area?: unknown }).area ?? '').trim() || null;
        if (!name) continue;
        submissionMeta.set(id, { name, area });
      }
    }
  }

  const rows = normalized
    .map((item) => {
      const cafeMetaRow = item.cafeId ? cafeMeta.get(item.cafeId) : null;
      const submissionMetaRow = item.submissionId ? submissionMeta.get(item.submissionId) : null;
      const cafeName = cafeMetaRow?.name || submissionMetaRow?.name || 'Cafe pending review';
      return {
        cafeId: item.cafeId,
        cafeName,
        cafeArea: cafeMetaRow?.area ?? submissionMetaRow?.area ?? null,
        note: item.note,
        createdAt: item.createdAt,
      } satisfies PublicVisitNote;
    })
    .slice(0, safeLimit);
  if (__DEV__) {
    console.log('[NoticeBoard] fetched notes:', rows.length);
  }
  return rows;
}

