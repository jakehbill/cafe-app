import OnboardingPreferencesFlow from '@/components/onboarding/OnboardingPreferencesFlow';

/** Post-auth onboarding — gated by ProfileGate until `onboarding_completed` is true. */
export default function OnboardingPreferencesScreen() {
  return <OnboardingPreferencesFlow />;
}
