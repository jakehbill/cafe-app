import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, FONTS, SHADOWS } from '@/components/theme';

type HelpLine = { label: string; points: number };

type GamificationHelpModalProps = {
  visible: boolean;
  onClose: () => void;
  lines: HelpLine[];
};

export function GamificationHelpModal({ visible, onClose, lines }: GamificationHelpModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>How points work</Text>
          <Text style={styles.subtitle}>
            You earn points by contributing useful, high-quality information to Beaned.
          </Text>
          <View style={styles.list}>
            {lines.map((line) => (
              <View key={line.label} style={styles.row}>
                <Text style={styles.rowLabel}>{line.label}</Text>
                <Text style={styles.rowPoints}>+{line.points}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.footer}>
            The biggest rewards come from contributions that get approved.
          </Text>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  sheet: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 10,
    ...SHADOWS.card,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    color: COLORS.text,
    fontFamily: FONTS.display.semibold,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  list: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.text,
    fontFamily: FONTS.sans.regular,
  },
  rowPoints: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.accent,
    fontFamily: FONTS.sans.semibold,
  },
  footer: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  closeButton: {
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.accentSubtleBorder,
    backgroundColor: COLORS.accentSubtleFill,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 13,
    lineHeight: 17,
    color: COLORS.accent,
    fontFamily: FONTS.sans.semibold,
  },
});
