import type { Cafe } from '@/data/cafes';
import { supabase } from '@/lib/supabase';

/** Set to false to silence temporary catalog debug logs after fixing Supabase. */
const DEBUG_CAFE_CATALOG = true;

function debugCatalog(label: string, payload: Record<string, unknown>) {
  if (!DEBUG_CAFE_CATALOG || !__DEV__) return;
  try {
    console.log(`[DEBUG cafeCatalog] ${label}\n${JSON.stringify(payload, null, 2)}`);
  } catch {
    console.log(`[DEBUG cafeCatalog] ${label}`, payload);
  }
}

function debugCatalogFlow(payload: Record<string, unknown>) {
  if (!__DEV__) return;
  try {
    console.log(`[DEBUG catalog flow: cafes → map → UI]\n${JSON.stringify(payload, null, 2)}`);
  } catch {
    console.log('[DEBUG catalog flow: cafes → map → UI]', payload);
  }
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

function tagsFromRow(row: Record<string, unknown>): string[] {
  const t = row.tags ?? row.tag_list ?? row.tag_slugs;
  if (Array.isArray(t)) return t.map((x) => String(x));
  if (typeof t === 'string' && t.trim().length > 0) {
    try {
      const p = JSON.parse(t) as unknown;
      if (Array.isArray(p)) return p.map((x) => String(x));
    } catch {
      /* not JSON — ignore */
    }
  }
  return [];
}

function scoreTriple(row: Record<string, unknown>): { coffee: number; work: number; vibe: number } {
  const c = num(
    row.coffee_score ?? row.coffeeScore ?? row.coffee_rating ?? row.avg_coffee
  );
  const w = num(row.work_score ?? row.workScore ?? row.work_rating ?? row.avg_work);
  const v = num(
    row.vibe_score ??
      row.vibeScore ??
      row.vibe_rating ??
      row.atmosphere_score ??
      row.avg_vibe
  );
  const avg = num(row.avg_rating ?? row.overall_rating ?? row.rating);
  if (c === 0 && w === 0 && v === 0 && avg > 0) {
    return { coffee: avg, work: avg, vibe: avg };
  }
  return { coffee: c, work: w, vibe: v };
}

/**
 * Maps a row from `public.cafes` to the app `Cafe` shape.
 * Supports snake_case (typical Supabase) or camelCase column names.
 */
export function mapCafeRowToCafe(row: Record<string, unknown>): Cafe | null {
  const idRaw = row.id ?? row.cafe_id;
  if (idRaw == null) return null;
  const id = String(idRaw);

  const saves = row.community_saves ?? row.communitySaves ?? row.saves_count ?? row.save_count;
  const visits = row.community_visits ?? row.communityVisits ?? row.visits_count ?? row.visit_count;
  let communityStats: Cafe['communityStats'] | undefined;
  if (typeof saves === 'number' && typeof visits === 'number') {
    communityStats = { saves, visits };
  }

  const { coffee, work, vibe } = scoreTriple(row);
  const imageRaw = row.image_url ?? row.photo_url ?? row.cover_image_url ?? row.image ?? row.thumbnail_url;
  const imageUrl = str(imageRaw).trim();

  return {
    id,
    name: str(row.name ?? row.title),
    neighborhood: str(row.neighborhood ?? row.area ?? row.location ?? row.district),
    latitude: num(row.latitude ?? row.lat),
    longitude: num(row.longitude ?? row.lng),
    coffeeScore: coffee,
    workScore: work,
    vibeScore: vibe,
    publicCoffeeScore: null,
    coffeeRatingCount: 0,
    tags: tagsFromRow(row),
    summary: str(row.summary ?? row.short_description ?? row.description),
    googleMapsUrl: str(
      row.google_maps_url ?? row.googleMapsUrl ?? row.google_maps_link ?? row.maps_url
    ),
    ...(imageUrl.length > 0 ? { imageUrl } : {}),
    communityStats,
  };
}

export type CafePublicScoreRow = {
  publicCoffeeScore: number | null;
  coffeeRatingCount: number;
};

function parsePublicScoreRow(row: unknown): CafePublicScoreRow | null {
  if (row == null || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = r.cafe_id;
  if (id == null) return null;
  const raw = r.public_coffee_score ?? r.publicCoffeeScore;
  let publicCoffeeScore: number | null = null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    publicCoffeeScore = raw;
  } else if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) publicCoffeeScore = n;
  }
  const cntRaw = r.coffee_rating_count ?? r.coffeeRatingCount;
  const coffeeRatingCount =
    typeof cntRaw === 'number' && Number.isFinite(cntRaw) ? Math.max(0, Math.floor(cntRaw)) : 0;

  return { publicCoffeeScore, coffeeRatingCount };
}

function mergePublicIntoCafe(cafe: Cafe, row: CafePublicScoreRow | null): Cafe {
  if (row == null) {
    return { ...cafe, publicCoffeeScore: null, coffeeRatingCount: 0 };
  }
  return {
    ...cafe,
    publicCoffeeScore: row.publicCoffeeScore,
    coffeeRatingCount: row.coffeeRatingCount,
  };
}

/** Full map of `cafe_id` → public coffee stats (from `public.cafe_public_scores`). */
export async function fetchCafePublicScoresMap(): Promise<Map<string, CafePublicScoreRow>> {
  const res = await supabase.from('cafe_public_scores').select('cafe_id, public_coffee_score, coffee_rating_count');
  if (res.error) {
    console.error('fetchCafePublicScoresMap failed:', res.error);
    return new Map();
  }
  const map = new Map<string, CafePublicScoreRow>();
  for (const row of res.data ?? []) {
    const parsed = parsePublicScoreRow(row);
    if (parsed == null) continue;
    const id = String((row as { cafe_id?: unknown }).cafe_id ?? '');
    if (id.length === 0) continue;
    map.set(id, parsed);
  }
  return map;
}

export async function fetchCafePublicScoresForIds(ids: string[]): Promise<Map<string, CafePublicScoreRow>> {
  if (ids.length === 0) return new Map();
  const res = await supabase
    .from('cafe_public_scores')
    .select('cafe_id, public_coffee_score, coffee_rating_count')
    .in('cafe_id', ids);
  if (res.error) {
    console.error('fetchCafePublicScoresForIds failed:', res.error);
    return new Map();
  }
  const map = new Map<string, CafePublicScoreRow>();
  for (const row of res.data ?? []) {
    const parsed = parsePublicScoreRow(row);
    if (parsed == null) continue;
    const id = String((row as { cafe_id?: unknown }).cafe_id ?? '');
    if (id.length === 0) continue;
    map.set(id, parsed);
  }
  return map;
}

export async function fetchCafePublicScoreForId(id: string): Promise<CafePublicScoreRow | null> {
  const res = await supabase
    .from('cafe_public_scores')
    .select('cafe_id, public_coffee_score, coffee_rating_count')
    .eq('cafe_id', id)
    .maybeSingle();
  if (res.error) {
    console.error('fetchCafePublicScoreForId failed:', res.error);
    return null;
  }
  return parsePublicScoreRow(res.data ?? null);
}

/** Full cafe catalog — Supabase `public.cafes` is the source of truth for listing metadata. */
export async function fetchAllCafesFromSupabase(): Promise<Cafe[]> {
  const [res, pubMap] = await Promise.all([
    supabase.from('cafes').select('*'),
    fetchCafePublicScoresMap(),
  ]);
  const rawCount = res.data?.length ?? 0;

  debugCatalog('fetchAllCafesFromSupabase', {
    loading: false,
    error: res.error ? { message: res.error.message, code: res.error.code, details: res.error.details } : null,
    rowCount: rawCount,
    firstRowKeys: res.data?.[0] != null ? Object.keys(res.data[0] as object) : [],
    hint:
      !res.error && rawCount === 0
        ? 'Empty result with no error often means RLS has no SELECT policy for anon/authenticated, or the table has no rows.'
        : undefined,
  });

  if (res.error) {
    console.error('fetchAllCafesFromSupabase failed:', res.error);
    return [];
  }
  const out: Cafe[] = [];
  for (const r of res.data ?? []) {
    const base = mapCafeRowToCafe(r as Record<string, unknown>);
    if (!base) continue;
    out.push(mergePublicIntoCafe(base, pubMap.get(base.id) ?? null));
  }
  if (rawCount > 0 && out.length === 0) {
    debugCatalog('fetchAllCafesFromSupabase: rows dropped by mapper', {
      rawCount,
      mappedCount: out.length,
      hint: 'Check that each row has id or cafe_id set; mapper returns null only when both are missing.',
    });
  }

  debugCatalogFlow({
    step: 'fetchAllCafesFromSupabase',
    supabaseError: res.error,
    rawRowCount: res.data?.length ?? 0,
    firstRawRow: res.data?.[0] ?? null,
    mappedCafeCount: out.length,
    firstMappedCafe: out[0] ? { id: out[0].id, name: out[0].name } : null,
    diagnosis:
      rawCount > 0 && out.length === 0
        ? 'MAPPING_FAIL: rows returned but no Cafe after mapCafeRowToCafe'
        : rawCount === 0 && !res.error
          ? 'EMPTY_QUERY: 0 rows (often RLS or empty table from client)'
          : null,
  });

  return out;
}

export async function fetchCafeByIdFromSupabase(id: string): Promise<Cafe | null> {
  const res = await supabase.from('cafes').select('*').eq('id', id).maybeSingle();

  debugCatalog('fetchCafeByIdFromSupabase (eq id)', {
    id,
    error: res.error ? { message: res.error.message, code: res.error.code } : null,
    hasData: res.data != null,
  });

  if (res.error) {
    console.error('fetchCafeByIdFromSupabase failed:', res.error);
    return null;
  }
  if (res.data) {
    const base = mapCafeRowToCafe(res.data as Record<string, unknown>);
    if (!base) return null;
    const pub = await fetchCafePublicScoreForId(base.id);
    return mergePublicIntoCafe(base, pub);
  }

  // Safe fallback: some schemas use cafe_id as the primary column name, not id.
  const resByCafeId = await supabase.from('cafes').select('*').eq('cafe_id', id).maybeSingle();
  debugCatalog('fetchCafeByIdFromSupabase (eq cafe_id fallback)', {
    id,
    error: resByCafeId.error ? { message: resByCafeId.error.message, code: resByCafeId.error.code } : null,
    hasData: resByCafeId.data != null,
  });
  if (resByCafeId.error) {
    console.error('fetchCafeByIdFromSupabase cafe_id fallback failed:', resByCafeId.error);
    return null;
  }
  if (!resByCafeId.data) return null;
  const base = mapCafeRowToCafe(resByCafeId.data as Record<string, unknown>);
  if (!base) return null;
  const pub = await fetchCafePublicScoreForId(base.id);
  return mergePublicIntoCafe(base, pub);
}

/** Preserves caller order (e.g. visited rank or saved order). */
export async function fetchCafesByIdsOrdered(ids: string[]): Promise<Cafe[]> {
  if (ids.length === 0) return [];
  const [res, pubMap] = await Promise.all([
    supabase.from('cafes').select('*').in('id', ids),
    fetchCafePublicScoresForIds(ids),
  ]);

  debugCatalog('fetchCafesByIdsOrdered (in id)', {
    requestedIds: ids.length,
    error: res.error ? { message: res.error.message, code: res.error.code } : null,
    matchedRows: res.data?.length ?? 0,
  });

  if (res.error) {
    console.error('fetchCafesByIdsOrdered failed:', res.error);
    return [];
  }

  let rows = res.data ?? [];

  // If nothing matched, try cafe_id column (same id strings as user_saved_cafes.cafe_id).
  if (rows.length === 0 && ids.length > 0) {
    const res2 = await supabase.from('cafes').select('*').in('cafe_id', ids);
    debugCatalog('fetchCafesByIdsOrdered (in cafe_id fallback)', {
      requestedIds: ids.length,
      error: res2.error ? { message: res2.error.message, code: res2.error.code } : null,
      matchedRows: res2.data?.length ?? 0,
    });
    if (res2.error) {
      console.error('fetchCafesByIdsOrdered cafe_id fallback failed:', res2.error);
      return [];
    }
    rows = res2.data ?? [];
  }

  if (rows.length > 0 && rows.length < ids.length) {
    debugCatalog('fetchCafesByIdsOrdered: partial match', {
      requestedIds: ids.length,
      matchedRows: rows.length,
      hint: 'Some cafe_id values in user tables may not exist in public.cafes, or id type (uuid vs text) may not match.',
    });
  }

  const byId = new Map<string, Cafe>();
  for (const r of rows) {
    const base = mapCafeRowToCafe(r as Record<string, unknown>);
    if (!base) continue;
    byId.set(base.id, mergePublicIntoCafe(base, pubMap.get(base.id) ?? null));
  }
  return ids.map((id) => byId.get(id)).filter((c): c is Cafe => c != null);
}
