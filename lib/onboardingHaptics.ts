import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function onboardingHapticLight() {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function onboardingHapticSelection() {
  if (Platform.OS === 'web') return;
  void Haptics.selectionAsync();
}

export function onboardingHapticSuccess() {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
