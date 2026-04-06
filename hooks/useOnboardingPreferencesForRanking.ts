import { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { getCurrentUserProfile } from '@/data/profile';
import type { OnboardingPreferenceRankInput } from '@/lib/onboardingPreferenceRanking';

/**
 * Loads stored profile taste fields for soft ranking (Home / Search). No-op when signed out
 * or when the user skipped onboarding without selecting any options.
 */
export function useOnboardingPreferencesForRanking(): OnboardingPreferenceRankInput | null {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<OnboardingPreferenceRankInput | null>(null);

  useEffect(() => {
    if (!user) {
      setPrefs(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error } = await getCurrentUserProfile();
      if (cancelled) return;
      if (error || !data) {
        setPrefs(null);
        return;
      }

      const hasAny =
        !!data.coffee_preference ||
        (data.vibe_preferences && data.vibe_preferences.length > 0) ||
        (data.intent_preferences && data.intent_preferences.length > 0);

      if (!hasAny) {
        setPrefs(null);
        return;
      }

      setPrefs({
        coffee_preference: data.coffee_preference,
        vibe_preferences: data.vibe_preferences,
        intent_preferences: data.intent_preferences,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return prefs;
}
