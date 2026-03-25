import type { Cafe } from '@/data/cafes';
import { supabase } from '@/lib/supabase';

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

function tagsFromRow(row: Record<string, unknown>): string[] {
  const t = row.tags;
  if (Array.isArray(t)) return t.map((x) => String(x));
  return [];
}

/**
 * Maps a row from `public.cafes` to the app `Cafe` shape.
 * Supports snake_case (typical Supabase) or camelCase column names.
 */
export function mapCafeRowToCafe(row: Record<string, unknown>): Cafe | null {
  const idRaw = row.id ?? row.cafe_id;
  if (idRaw == null) return null;
  const id = String(idRaw);

  const saves = row.community_saves ?? row.communitySaves;
  const visits = row.community_visits ?? row.communityVisits;
  let communityStats: Cafe['communityStats'] | undefined;
  if (typeof saves === 'number' && typeof visits === 'number') {
    communityStats = { saves, visits };
  }

  return {
    id,
    name: str(row.name),
    neighborhood: str(row.neighborhood),
    latitude: num(row.latitude ?? row.lat),
    longitude: num(row.longitude ?? row.lng),
    coffeeScore: num(row.coffee_score ?? row.coffeeScore),
    workScore: num(row.work_score ?? row.workScore),
    vibeScore: num(row.vibe_score ?? row.vibeScore),
    tags: tagsFromRow(row),
    summary: str(row.summary),
    googleMapsUrl: str(row.google_maps_url ?? row.googleMapsUrl),
    communityStats,
  };
}

/** Full cafe catalog — Supabase `public.cafes` is the source of truth for listing metadata. */
export async function fetchAllCafesFromSupabase(): Promise<Cafe[]> {
  const res = await supabase.from('cafes').select('*');
  if (res.error) {
    console.error('fetchAllCafesFromSupabase failed:', res.error);
    return [];
  }
  const out: Cafe[] = [];
  for (const r of res.data ?? []) {
    const c = mapCafeRowToCafe(r as Record<string, unknown>);
    if (c) out.push(c);
  }
  return out;
}

export async function fetchCafeByIdFromSupabase(id: string): Promise<Cafe | null> {
  const res = await supabase.from('cafes').select('*').eq('id', id).maybeSingle();
  if (res.error) {
    console.error('fetchCafeByIdFromSupabase failed:', res.error);
    return null;
  }
  if (!res.data) return null;
  return mapCafeRowToCafe(res.data as Record<string, unknown>);
}

/** Preserves caller order (e.g. visited rank or saved order). */
export async function fetchCafesByIdsOrdered(ids: string[]): Promise<Cafe[]> {
  if (ids.length === 0) return [];
  const res = await supabase.from('cafes').select('*').in('id', ids);
  if (res.error) {
    console.error('fetchCafesByIdsOrdered failed:', res.error);
    return [];
  }
  const byId = new Map<string, Cafe>();
  for (const r of res.data ?? []) {
    const c = mapCafeRowToCafe(r as Record<string, unknown>);
    if (c) byId.set(c.id, c);
  }
  return ids.map((id) => byId.get(id)).filter((c): c is Cafe => c != null);
}
