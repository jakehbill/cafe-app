import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const SESSION_ID_KEY = 'beaned_analytics_session_id';
const ATTRIBUTION_KEY = 'beaned_analytics_attribution';

export type AnalyticsAttribution = {
  source: string;
  page_slug: string | null;
};

export type AnalyticsEventPayload = {
  event_name: string;
  step_key?: string | null;
  metadata?: Record<string, unknown>;
  source?: string | null;
  page_slug?: string | null;
};

export type JoinAnalyticsStepKey =
  | 'persona'
  | 'frequency'
  | 'priorities'
  | 'drink'
  | 'email'
  | 'confirmation';

let cachedSessionId: string | null = null;
let cachedAttribution: AnalyticsAttribution | null = null;

async function readStorage(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  }
  return AsyncStorage.getItem(key);
}

async function writeStorage(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function normalizeAnalyticsSource(raw: string | undefined | null): string {
  const t = (raw ?? '').trim().slice(0, 120);
  return t.length > 0 ? t : 'direct';
}

function normalizePageSlug(raw: string | undefined | null): string | null {
  const t = (raw ?? '').trim().slice(0, 120);
  return t.length > 0 ? t : null;
}

function firstParam(value: string | string[] | undefined | null): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

export function parseAnalyticsAttribution(params: {
  source?: string | string[] | null;
  page?: string | string[] | null;
}): AnalyticsAttribution {
  return {
    source: normalizeAnalyticsSource(firstParam(params.source)),
    page_slug: normalizePageSlug(firstParam(params.page)),
  };
}

export async function getAnalyticsSessionId(): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  let id = await readStorage(SESSION_ID_KEY);
  if (!id) {
    id = generateSessionId();
    await writeStorage(SESSION_ID_KEY, id);
  }
  cachedSessionId = id;
  return id;
}

export async function setAnalyticsAttribution(attribution: AnalyticsAttribution): Promise<void> {
  cachedAttribution = attribution;
  await writeStorage(ATTRIBUTION_KEY, JSON.stringify(attribution));
}

export async function getAnalyticsAttribution(): Promise<AnalyticsAttribution> {
  if (cachedAttribution) return cachedAttribution;
  const raw = await readStorage(ATTRIBUTION_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as AnalyticsAttribution;
      if (parsed && typeof parsed.source === 'string') {
        cachedAttribution = {
          source: normalizeAnalyticsSource(parsed.source),
          page_slug:
            typeof parsed.page_slug === 'string' ? normalizePageSlug(parsed.page_slug) : null,
        };
        return cachedAttribution;
      }
    } catch {
      // Ignore corrupt attribution cache.
    }
  }
  return { source: 'direct', page_slug: null };
}

/** Fire-and-forget analytics insert — never blocks UI. */
export function trackAnalyticsEvent(payload: AnalyticsEventPayload): void {
  void trackAnalyticsEventAsync(payload);
}

async function trackAnalyticsEventAsync(payload: AnalyticsEventPayload): Promise<void> {
  try {
    const session_id = await getAnalyticsSessionId();
    const attribution = await getAnalyticsAttribution();
    const source =
      payload.source != null && payload.source !== ''
        ? normalizeAnalyticsSource(payload.source)
        : attribution.source;
    const page_slug =
      payload.page_slug !== undefined ? payload.page_slug : attribution.page_slug;

    const { error } = await supabase.from('analytics_events').insert({
      event_name: payload.event_name,
      session_id,
      source,
      page_slug,
      step_key: payload.step_key ?? null,
      metadata: payload.metadata ?? {},
    });

    if (error && __DEV__) {
      console.warn('[analytics]', error.message);
    }
  } catch (err) {
    if (__DEV__) {
      console.warn('[analytics]', err);
    }
  }
}
