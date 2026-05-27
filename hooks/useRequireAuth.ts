import { useRouter, usePathname } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { buildLoginPath, sanitizeReturnTo } from '@/lib/authGate';

/**
 * Gate user-specific actions: redirects to `/login` with a return path when logged out.
 */
export function useRequireAuth() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const defaultReturnTo = sanitizeReturnTo(pathname) ?? '/(tabs)';

  const redirectToLogin = useCallback(
    (returnTo?: string) => {
      const target = sanitizeReturnTo(returnTo) ?? defaultReturnTo;
      router.push(buildLoginPath(target) as never);
    },
    [router, defaultReturnTo]
  );

  /** Returns user id when signed in; otherwise navigates to login and returns null. */
  const requireAuth = useCallback(
    (returnTo?: string): string | null => {
      if (loading) return null;
      if (user?.id) return user.id;
      redirectToLogin(returnTo);
      return null;
    },
    [user, loading, redirectToLogin]
  );

  return {
    userId: user?.id ?? null,
    isLoggedIn: Boolean(user?.id),
    authLoading: loading,
    defaultReturnTo,
    redirectToLogin,
    requireAuth,
  };
}
