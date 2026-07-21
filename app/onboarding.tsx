import { useAuth } from '@/contexts/AuthContext';
import { useProfileGate } from '@/contexts/ProfileGateContext';
import { Redirect } from 'expo-router';

/**
 * Legacy `/onboarding` URL — send users to signup or the current onboarding gate.
 * The old marketing carousel has been replaced by post-auth onboarding.
 */
export default function OnboardingRedirect() {
  const { user, loading: authLoading } = useAuth();
  const { profileLoading, needsOnboarding } = useProfileGate();

  if (authLoading || (user != null && profileLoading)) {
    return null;
  }

  if (!user) {
    return <Redirect href="/auth" />;
  }

  if (needsOnboarding) {
    return <Redirect href="/onboarding-preferences" />;
  }

  return <Redirect href="/(tabs)" />;
}
