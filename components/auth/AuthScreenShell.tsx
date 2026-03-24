import React, { ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { authStyles } from '@/components/auth/authStyles';

type AuthScreenShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  onBackPress?: () => void;
};

export function AuthScreenShell({ title, subtitle, children, footer, onBackPress }: AuthScreenShellProps) {
  return (
    <SafeAreaView style={authStyles.safeArea}>
      <KeyboardAvoidingView style={authStyles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
                <Text style={authStyles.title}>{title}</Text>
                <Text style={authStyles.subtitle}>{subtitle}</Text>
              </View>

              {children}

              {footer}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
