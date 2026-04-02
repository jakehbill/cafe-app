import { StyleSheet } from 'react-native';

import { COLORS as THEME_COLORS, FONTS, SHADOWS } from '@/components/theme';

/** Auth screens — aligned with global theme tokens */
export const COLORS = {
  background: THEME_COLORS.background,
  text: THEME_COLORS.text,
  muted: THEME_COLORS.muted,
  border: THEME_COLORS.cardBorder,
  input: THEME_COLORS.inputBackground,
} as const;

export const authStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 28,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    gap: 14,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
  },
  backArrow: {
    color: THEME_COLORS.muted,
    fontSize: 26,
    lineHeight: 30,
    width: 30,
  },
  backArrowHidden: {
    opacity: 0,
  },
  headerWrap: {
    marginTop: 12,
    marginBottom: 10,
    gap: 6,
  },
  title: {
    fontSize: 44,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.8,
    lineHeight: 50,
  },
  subtitle: {
    fontSize: 17,
    color: THEME_COLORS.muted,
    lineHeight: 22,
    fontFamily: FONTS.sans.regular,
  },
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 16,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
  },
  inputWrap: {
    backgroundColor: THEME_COLORS.inputBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME_COLORS.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    fontSize: 18,
    color: COLORS.text,
    fontFamily: FONTS.sans.regular,
    padding: 0,
    height: 28,
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 16,
    paddingVertical: 18,
    backgroundColor: THEME_COLORS.text,
    borderWidth: 1,
    borderColor: 'rgba(26, 26, 26, 0.2)',
    ...SHADOWS.none,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: FONTS.sans.bold,
    textAlign: 'center',
  },
  footerRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  footerText: {
    color: THEME_COLORS.muted,
    fontSize: 16,
    fontFamily: FONTS.sans.regular,
  },
  footerLink: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: FONTS.sans.bold,
  },
});
