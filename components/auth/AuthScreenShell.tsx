import React, { ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Web: do not wrap the form in TouchableWithoutFeedback — it often steals pointer events so
 * TextInputs and buttons never receive clicks/focus (RN Web). Native keeps tap-to-dismiss.
 */

import { AuthBrandBean } from '@/components/auth/AuthBrandBean';
import { authStyles } from '@/components/auth/authStyles';

type AuthScreenShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  onBackPress?: () => void;
  /** Subtle `Bean.svg` above the main heading (auth / sign-up surfaces). */
  brandAccent?: boolean;
};

export function AuthScreenShell({
  title,
  subtitle,
  children,
  footer,
  onBackPress,
  brandAccent = false,
}: AuthScreenShellProps) {
  const scroll = (
    <ScrollView
      contentContainerStyle={authStyles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={authStyles.content}>
        <View style={authStyles.backRow}>
          {onBackPress ? (
            <TouchableOpacity onPress={onBackPress} accessibilityRole="button" accessibilityLabel="Back">
              <Text style={authStyles.backArrow}>←</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[authStyles.backArrow, authStyles.backArrowHidden]}>←</Text>
          )}
        </View>

        <View style={authStyles.headerWrap}>
          {brandAccent ? <AuthBrandBean /> : null}
          <Text style={authStyles.title}>{title}</Text>
          <Text style={authStyles.subtitle}>{subtitle}</Text>
        </View>

        <View style={authStyles.formBlock}>
          {children}
        </View>

        {footer}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={authStyles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={authStyles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'web' ? undefined : 'height'}
      >
        {Platform.OS === 'web' ? (
          scroll
        ) : (
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            {scroll}
          </TouchableWithoutFeedback>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
