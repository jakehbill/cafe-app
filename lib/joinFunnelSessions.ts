import {
  getAnalyticsAttribution,
  getAnalyticsSessionId,
  type JoinAnalyticsStepKey,
} from '@/lib/analyticsEvents';
import { supabase } from '@/lib/supabase';

const STEP_NUMBERS: Record<JoinAnalyticsStepKey, number> = {
  persona: 1,
  frequency: 2,
  priorities: 3,
  drink: 4,
  email: 5,
  confirmation: 6,
};

type JoinFunnelSessionRow = {
  session_id: string;
  source: string;
  page_slug: string | null;
  furthest_step: JoinAnalyticsStepKey;
  furthest_step_number: number;
  viewed_persona: boolean;
  viewed_frequency: boolean;
  viewed_priorities: boolean;
  viewed_drink: boolean;
  viewed_email: boolean;
  viewed_confirmation: boolean;
  email_submitted: boolean;
  completed: boolean;
  updated_at: string;
};

type ExistingJoinFunnelSession = {
  furthest_step: string | null;
  furthest_step_number: number | null;
  viewed_persona: boolean | null;
  viewed_frequency: boolean | null;
  viewed_priorities: boolean | null;
  viewed_drink: boolean | null;
  viewed_email: boolean | null;
  viewed_confirmation: boolean | null;
  email_submitted: boolean | null;
  completed: boolean | null;
};

type FunnelUpdate = {
  step?: JoinAnalyticsStepKey;
  email_submitted?: boolean;
  completed?: boolean;
};

type PostgrestErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

/** In-memory merge state when SELECT is blocked by RLS or before first successful persist. */
const funnelSessionCache = new Map<string, JoinFunnelSessionRow>();

function isJoinAnalyticsStepKey(value: string): value is JoinAnalyticsStepKey {
  return value in STEP_NUMBERS;
}

function stepForNumber(n: number): JoinAnalyticsStepKey {
  const entries = Object.entries(STEP_NUMBERS) as [JoinAnalyticsStepKey, number][];
  for (const [key, num] of entries) {
    if (num === n) return key;
  }
  let best: JoinAnalyticsStepKey = 'persona';
  for (const [key, num] of entries) {
    if (num <= n) best = key;
  }
  return best;
}

function viewedFieldForStep(step: JoinAnalyticsStepKey): keyof Pick<
  JoinFunnelSessionRow,
  | 'viewed_persona'
  | 'viewed_frequency'
  | 'viewed_priorities'
  | 'viewed_drink'
  | 'viewed_email'
  | 'viewed_confirmation'
> {
  switch (step) {
    case 'persona':
      return 'viewed_persona';
    case 'frequency':
      return 'viewed_frequency';
    case 'priorities':
      return 'viewed_priorities';
    case 'drink':
      return 'viewed_drink';
    case 'email':
      return 'viewed_email';
    case 'confirmation':
      return 'viewed_confirmation';
  }
}

function isRlsOrPermissionError(error: PostgrestErrorLike): boolean {
  const message = error.message ?? '';
  return (
    error.code === '42501' ||
    /row-level security|permission denied|policy/i.test(message)
  );
}

function isDuplicateKeyError(error: PostgrestErrorLike): boolean {
  return error.code === '23505' || /duplicate|unique/i.test(error.message ?? '');
}

function isOnConflictConstraintError(error: PostgrestErrorLike): boolean {
  return /no unique|exclusion constraint|on conflict/i.test(error.message ?? '');
}

function warnJoinFunnel(
  message: string,
  error?: PostgrestErrorLike,
  operation?: 'select' | 'upsert' | 'insert' | 'update'
): void {
  if (!__DEV__) return;
  const parts = [`[join_funnel] ${message}`];
  if (operation) parts.push(`(operation: ${operation})`);
  if (error?.code) parts.push(`code=${error.code}`);
  if (error?.message) parts.push(error.message);
  if (error?.details) parts.push(String(error.details));
  if (error?.hint) parts.push(String(error.hint));
  console.warn(parts.join(' '));
}

function cachedAsExisting(session_id: string): ExistingJoinFunnelSession | null {
  const cached = funnelSessionCache.get(session_id);
  if (!cached) return null;
  return {
    furthest_step: cached.furthest_step,
    furthest_step_number: cached.furthest_step_number,
    viewed_persona: cached.viewed_persona,
    viewed_frequency: cached.viewed_frequency,
    viewed_priorities: cached.viewed_priorities,
    viewed_drink: cached.viewed_drink,
    viewed_email: cached.viewed_email,
    viewed_confirmation: cached.viewed_confirmation,
    email_submitted: cached.email_submitted,
    completed: cached.completed,
  };
}

async function fetchExistingJoinFunnelSession(
  session_id: string
): Promise<ExistingJoinFunnelSession | null> {
  const cached = cachedAsExisting(session_id);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('join_funnel_sessions')
    .select(
      'furthest_step, furthest_step_number, viewed_persona, viewed_frequency, viewed_priorities, viewed_drink, viewed_email, viewed_confirmation, email_submitted, completed'
    )
    .eq('session_id', session_id)
    .maybeSingle();

  if (error) {
    if (isRlsOrPermissionError(error)) {
      warnJoinFunnel(
        'SELECT blocked by RLS on public.join_funnel_sessions. Run supabase/join_funnel_sessions_rls.sql to add a SELECT policy. Using in-memory merge cache.',
        error,
        'select'
      );
    } else {
      warnJoinFunnel('Could not read existing join funnel session.', error, 'select');
    }
    return null;
  }

  return data;
}

function mergeJoinFunnelSession(
  existing: ExistingJoinFunnelSession | null,
  session_id: string,
  source: string,
  page_slug: string | null,
  updates: FunnelUpdate
): JoinFunnelSessionRow {
  const viewed = {
    viewed_persona: !!existing?.viewed_persona,
    viewed_frequency: !!existing?.viewed_frequency,
    viewed_priorities: !!existing?.viewed_priorities,
    viewed_drink: !!existing?.viewed_drink,
    viewed_email: !!existing?.viewed_email,
    viewed_confirmation: !!existing?.viewed_confirmation,
  };

  if (updates.step) {
    viewed[viewedFieldForStep(updates.step)] = true;
  }
  if (updates.email_submitted) {
    viewed.viewed_email = true;
  }
  if (updates.completed) {
    viewed.viewed_confirmation = true;
  }

  let furthestNumber = existing?.furthest_step_number ?? 0;
  const applyFurthest = (step: JoinAnalyticsStepKey) => {
    const n = STEP_NUMBERS[step];
    if (n > furthestNumber) {
      furthestNumber = n;
    }
  };

  if (updates.step) applyFurthest(updates.step);
  if (updates.email_submitted) applyFurthest('email');
  if (updates.completed) applyFurthest('confirmation');

  const existingFurthestStep =
    existing?.furthest_step && isJoinAnalyticsStepKey(existing.furthest_step)
      ? existing.furthest_step
      : 'persona';
  let furthestStep = existingFurthestStep;
  if (STEP_NUMBERS[furthestStep] < furthestNumber) {
    furthestStep = stepForNumber(furthestNumber);
  }

  return {
    session_id,
    source,
    page_slug,
    furthest_step: furthestStep,
    furthest_step_number: furthestNumber,
    ...viewed,
    email_submitted: !!(existing?.email_submitted || updates.email_submitted),
    completed: !!(existing?.completed || updates.completed),
    updated_at: new Date().toISOString(),
  };
}

function rowForUpdate(row: JoinFunnelSessionRow): Omit<JoinFunnelSessionRow, 'session_id'> {
  const { session_id: _sessionId, ...rest } = row;
  return rest;
}

async function persistJoinFunnelSession(row: JoinFunnelSessionRow): Promise<boolean> {
  const { error: upsertError } = await supabase
    .from('join_funnel_sessions')
    .upsert(row, { onConflict: 'session_id' });

  if (!upsertError) {
    funnelSessionCache.set(row.session_id, row);
    return true;
  }

  if (__DEV__) {
    if (isRlsOrPermissionError(upsertError)) {
      warnJoinFunnel(
        'UPSERT blocked by RLS on public.join_funnel_sessions. Run supabase/join_funnel_sessions_rls.sql to add INSERT and UPDATE policies.',
        upsertError,
        'upsert'
      );
    } else if (isOnConflictConstraintError(upsertError)) {
      warnJoinFunnel(
        'UPSERT failed: session_id may not be UNIQUE. Run supabase/join_funnel_sessions_rls.sql to add the unique index.',
        upsertError,
        'upsert'
      );
    } else {
      warnJoinFunnel('UPSERT failed.', upsertError, 'upsert');
    }
  }

  const { error: insertError } = await supabase.from('join_funnel_sessions').insert(row);
  if (!insertError) {
    funnelSessionCache.set(row.session_id, row);
    return true;
  }

  if (__DEV__) {
    if (isRlsOrPermissionError(insertError)) {
      warnJoinFunnel(
        'INSERT blocked by RLS on public.join_funnel_sessions. Run supabase/join_funnel_sessions_rls.sql.',
        insertError,
        'insert'
      );
    } else if (!isDuplicateKeyError(insertError)) {
      warnJoinFunnel('INSERT failed.', insertError, 'insert');
    }
  }

  if (!isDuplicateKeyError(insertError)) {
    return false;
  }

  const { error: updateError } = await supabase
    .from('join_funnel_sessions')
    .update(rowForUpdate(row))
    .eq('session_id', row.session_id);

  if (!updateError) {
    funnelSessionCache.set(row.session_id, row);
    return true;
  }

  if (__DEV__) {
    if (isRlsOrPermissionError(updateError)) {
      warnJoinFunnel(
        'UPDATE blocked by RLS on public.join_funnel_sessions. Run supabase/join_funnel_sessions_rls.sql.',
        updateError,
        'update'
      );
    } else {
      warnJoinFunnel('UPDATE failed.', updateError, 'update');
    }
  }

  return false;
}

async function upsertJoinFunnelSessionAsync(updates: FunnelUpdate): Promise<void> {
  try {
    const session_id = await getAnalyticsSessionId();
    const { source, page_slug } = await getAnalyticsAttribution();
    const existing = await fetchExistingJoinFunnelSession(session_id);
    const row = mergeJoinFunnelSession(existing, session_id, source, page_slug, updates);

    funnelSessionCache.set(session_id, row);

    const ok = await persistJoinFunnelSession(row);
    if (!ok && __DEV__) {
      console.warn(
        '[join_funnel] Could not persist join funnel session. Check browser console for RLS/upsert errors and run supabase/join_funnel_sessions_rls.sql in Supabase.'
      );
    }
  } catch (err) {
    if (__DEV__) {
      console.warn('[join_funnel] Unexpected error:', err);
    }
  }
}

/** Fire-and-forget — one row per session in `public.join_funnel_sessions`. */
export function trackJoinFunnelStepViewed(step: JoinAnalyticsStepKey): void {
  void upsertJoinFunnelSessionAsync({ step });
}

export function trackJoinFunnelEmailSubmitted(): void {
  void upsertJoinFunnelSessionAsync({ email_submitted: true });
}

export function trackJoinFunnelCompleted(): void {
  void upsertJoinFunnelSessionAsync({ completed: true });
}
