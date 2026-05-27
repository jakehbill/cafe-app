import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { buildLoginPath, sanitizeReturnTo } from '@/lib/authGate';

/**
 * For screens that require a session (log visit, suggest cafe, rate).
 * Replaces the route with login when there is no user after auth bootstrap.
 */
export function useAuthRedirectIfNeeded(returnTo: string) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const safeReturnTo = sanitizeReturnTo(returnTo) ?? '/(tabs)';

  useEffect(() => {
    if (loading) return;
    if (user) return;
    router.replace(buildLoginPath(safeReturnTo) as never);
  }, [loading, user, router, safeReturnTo]);

  return {
    authReady: !loading && Boolean(user),
    authLoading: loading,
  };
}
