import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { createProfileIfMissing } from '@/data/profile';

type ProfileGateContextValue = {
  /** True while resolving profile / onboarding for the signed-in user. */
  profileLoading: boolean;
  /** True when `onboarding_completed` is not strictly `true` (null counts as incomplete). */
  needsOnboarding: boolean;
  /** Re-fetch profile after updates (e.g. onboarding finished). */
  refresh: () => Promise<void>;
};

const ProfileGateContext = createContext<ProfileGateContextValue | undefined>(undefined);

export function ProfileGateProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profileLoading, setProfileLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfileLoading(false);
      setNeedsOnboarding(false);
      return;
    }

    setProfileLoading(true);
    try {
      const created = await createProfileIfMissing();
      if (created.error || !created.data) {
        console.warn('[ProfileGate] createProfileIfMissing:', created.error);
        setNeedsOnboarding(false);
        return;
      }

      const completed = created.data.onboarding_completed === true;
      setNeedsOnboarding(!completed);
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfileLoading(false);
      setNeedsOnboarding(false);
      return;
    }
    refresh();
  }, [authLoading, user, refresh]);

  const value = useMemo(
    () => ({
      profileLoading,
      needsOnboarding,
      refresh,
    }),
    [profileLoading, needsOnboarding, refresh]
  );

  return <ProfileGateContext.Provider value={value}>{children}</ProfileGateContext.Provider>;
}

export function useProfileGate() {
  const ctx = useContext(ProfileGateContext);
  if (!ctx) {
    throw new Error('useProfileGate must be used within ProfileGateProvider');
  }
  return ctx;
}
