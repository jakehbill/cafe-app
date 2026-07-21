import { Easing, FadeIn, FadeInDown, SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';

export const ONBOARDING_SPRING = {
  damping: 22,
  stiffness: 260,
  mass: 0.85,
} as const;

export const ONBOARDING_PRESS_SPRING = {
  damping: 18,
  stiffness: 420,
  mass: 0.6,
} as const;

export const ONBOARDING_PROGRESS_TIMING = {
  duration: 480,
  easing: Easing.bezier(0.22, 1, 0.36, 1),
} as const;

export function onboardingStepEntering(direction: 'forward' | 'back') {
  if (direction === 'forward') {
    return SlideInRight.springify()
      .damping(26)
      .stiffness(200)
      .mass(0.85)
      .restDisplacementThreshold(0.5);
  }
  return SlideInLeft.springify()
    .damping(26)
    .stiffness(200)
    .mass(0.85)
    .restDisplacementThreshold(0.5);
}

export function onboardingStepExiting(direction: 'forward' | 'back') {
  if (direction === 'forward') {
    return SlideOutLeft.duration(220);
  }
  return SlideOutRight.duration(220);
}

export function onboardingRevealEntering(delayMs = 0) {
  return FadeInDown.springify()
    .damping(24)
    .stiffness(240)
    .delay(delayMs);
}

export function onboardingListItemEntering(index: number) {
  return FadeInDown.duration(260)
    .delay(Math.min(index * 36, 180))
    .springify()
    .damping(22)
    .stiffness(280);
}

export function onboardingWelcomeEntering() {
  return FadeIn.duration(420);
}
