import { StyleSheet } from 'react-native';

export const COLORS = {
  background: '#F7F3EE',
  text: '#2E2A27',
  muted: '#6E6254',
  roastedBrown: '#8A6A4F',
  border: '#E6DCCB',
  input: '#EFE8DC',
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
    color: '#6E6254',
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
    fontSize: 48,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.8,
    lineHeight: 54,
  },
  subtitle: {
    fontSize: 17,
    color: '#3F3934',
    lineHeight: 20,
  },
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 16,
    color: '#2E2A27',
    fontWeight: '600',
  },
  inputWrap: {
    backgroundColor: '#F0ECE6',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7DECF',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    fontSize: 18,
    color: COLORS.text,
    padding: 0,
    height: 28,
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 16,
    paddingVertical: 18,
    backgroundColor: COLORS.roastedBrown,
    borderWidth: 1,
    borderColor: 'rgba(138, 106, 79, 0.65)',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  primaryButtonText: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: '700',
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
    color: '#3F3934',
    fontSize: 16,
  },
  footerLink: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
