import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS, FONTS } from '@/components/theme';
import {
  VENUE_TYPE_OPTIONS,
  formatVenueTypeBadge,
  type VenueTypeValue,
} from '@/lib/venueTypes';

type Props = {
  value: VenueTypeValue | null;
  onChange: (value: VenueTypeValue) => void;
  disabled?: boolean;
  error?: string | null;
};

/**
 * Required venue-type selector for Suggest a Space (dropdown-style list).
 */
export function VenueTypePicker({ value, onChange, disabled = false, error }: Props) {
  const [open, setOpen] = useState(false);
  const summary = value != null ? formatVenueTypeBadge(value) : 'Select a type…';

  return (
    <View>
      <Text style={styles.fieldLabel}>What type of space is this?</Text>
      <TouchableOpacity
        activeOpacity={0.88}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.trigger, error ? styles.triggerError : null, disabled && styles.triggerDisabled]}
        accessibilityRole="button"
        accessibilityLabel="What type of space is this?"
        accessibilityHint="Opens a list of venue types"
      >
        <Text style={[styles.triggerText, value == null && styles.triggerPlaceholder]} numberOfLines={1}>
          {summary}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>What type of space is this?</Text>
            <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
              {VENUE_TYPE_OPTIONS.map((opt) => {
                const selected = value === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    activeOpacity={0.85}
                    style={[styles.optionRow, selected && styles.optionRowSelected]}
                    onPress={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {opt.emoji} {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity activeOpacity={0.88} style={styles.cancelButton} onPress={() => setOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontFamily: FONTS.sans.semibold,
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 8,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  triggerError: {
    borderColor: '#B42318',
  },
  triggerDisabled: {
    opacity: 0.55,
  },
  triggerText: {
    flex: 1,
    fontFamily: FONTS.sans.regular,
    fontSize: 15,
    color: COLORS.text,
  },
  triggerPlaceholder: {
    color: COLORS.muted,
  },
  chevron: {
    fontFamily: FONTS.sans.regular,
    fontSize: 12,
    color: COLORS.muted,
  },
  errorText: {
    marginTop: 6,
    fontFamily: FONTS.sans.regular,
    fontSize: 12,
    color: '#B42318',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,16,12,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    maxHeight: '72%',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingTop: 16,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sheetTitle: {
    fontFamily: FONTS.sans.semibold,
    fontSize: 16,
    color: COLORS.text,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sheetList: {
    paddingHorizontal: 8,
  },
  optionRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
  },
  optionRowSelected: {
    backgroundColor: COLORS.accentSubtleFill,
  },
  optionText: {
    fontFamily: FONTS.sans.regular,
    fontSize: 15,
    color: COLORS.text,
  },
  optionTextSelected: {
    fontFamily: FONTS.sans.semibold,
    color: COLORS.accent,
  },
  cancelButton: {
    marginTop: 4,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: FONTS.sans.medium,
    fontSize: 14,
    color: COLORS.muted,
  },
});
