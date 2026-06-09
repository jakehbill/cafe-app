import { supabase } from '@/lib/supabase';

export const BETA_PERSONA_OPTIONS = [
  'I care about great coffee',
  'I need good places to work',
  'I love finding hidden gems',
  'A bit of everything',
] as const;

export const BETA_VISIT_FREQUENCY_OPTIONS = [
  'Almost every day',
  'A few times a week',
  'Once a week',
  'Every now and then',
] as const;

export const BETA_PRIORITY_OPTIONS = [
  'Coffee quality',
  'Atmosphere',
  'Work friendliness',
  'Food',
  'Hidden gems',
  'Location',
] as const;

/** Default when the join flow no longer asks for city (London-only beta). */
export const DEFAULT_BETA_SIGNUP_CITY = 'London';

export const BETA_DRINK_OPTIONS = [
  'Flat white',
  'Latte',
  'Espresso',
  'Filter coffee',
  'Matcha',
  'Something else',
] as const;

export type BetaSignupInsert = {
  email: string;
  persona: string;
  visit_frequency: string;
  priorities: string[];
  city: string;
  favorite_drink: string;
  source: string;
  completed: boolean;
};

export function normalizeBetaSignupSource(raw: string | undefined | null): string {
  const t = (raw ?? '').trim();
  return t.length > 0 ? t.slice(0, 120) : 'direct';
}

export function isValidBetaSignupEmail(email: string): boolean {
  const t = email.trim();
  if (!t || t.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function isDuplicateSignupError(message: string, code?: string): boolean {
  if (code === '23505') return true;
  return /duplicate|unique|already exists/i.test(message);
}

/** Inserts into `beta_signups` via the existing Supabase client (no Auth). */
export async function submitBetaSignup(
  payload: BetaSignupInsert
): Promise<{ ok: true } | { ok: false; error: string; duplicate?: boolean }> {
  const res = await supabase.from('beta_signups').insert({
    email: payload.email.trim().toLowerCase(),
    persona: payload.persona,
    visit_frequency: payload.visit_frequency,
    priorities: payload.priorities,
    city: payload.city,
    favorite_drink: payload.favorite_drink,
    source: payload.source,
    completed: payload.completed,
  });

  if (res.error) {
    if (isDuplicateSignupError(res.error.message, res.error.code)) {
      return { ok: false, error: "You're already on the list.", duplicate: true };
    }
    return { ok: false, error: res.error.message || 'Could not save your signup. Please try again.' };
  }

  return { ok: true };
}
