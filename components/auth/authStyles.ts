import { StyleSheet } from 'react-native';

import { COLORS as THEME_COLORS, FONTS, SPACING } from '@/components/theme';

/** Auth surfaces use the same canvas + inputs as the rest of the app. */
export const COLORS = {
  background: THEME_COLORS.background,
  text: THEME_COLORS.text,
  muted: THEME_COLORS.muted,
  border: THEME_COLORS.cardBorder,
  input: THEME_COLORS.inputBackground,
  link: THEME_COLORS.accent,
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
    paddingBottom: 36,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: SPACING.sectionGap,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    marginBottom: 8,
  },
  backArrow: {
    color: THEME_COLORS.muted,
    fontSize: 28,
    lineHeight: 32,
    width: 40,
    fontFamily: FONTS.sans.regular,
  },
  backArrowHidden: {
    opacity: 0,
  },
  headerWrap: {
    marginBottom: 4,
    gap: 12,
    alignItems: 'center',
  },
  /** Editorial display — Playfair, aligned with onboarding & cafe headings. */
  title: {
    fontSize: 36,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.7,
    lineHeight: 42,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: THEME_COLORS.muted,
    lineHeight: 24,
    fontFamily: FONTS.sans.regular,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  formBlock: {
    gap: 20,
    marginTop: 8,
  },
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 15,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
  },
  inputWrap: {
    backgroundColor: COLORS.input,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    fontSize: 17,
    color: COLORS.text,
    fontFamily: FONTS.sans.regular,
    padding: 0,
    minHeight: 24,
  },
  primaryButtonSlot: {
    marginTop: 8,
  },
  footerRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  footerText: {
    color: THEME_COLORS.muted,
    fontSize: 15,
    fontFamily: FONTS.sans.regular,
  },
  footerLink: {
    color: COLORS.link,
    fontSize: 15,
    fontFamily: FONTS.sans.semibold,
  },
});
