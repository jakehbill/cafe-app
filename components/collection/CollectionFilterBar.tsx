import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { Cafe } from '@/data/cafes';
import { COLORS, FONTS, SHADOWS } from '@/components/theme';
import {
  type CollectionFilterState,
  uniqueSortedAreas,
  uniqueVenueTypesInCollection,
} from '@/lib/collectionFilters';
import { formatVenueTypeBadge, type VenueTypeValue } from '@/lib/venueTypes';

type FilterKey = 'area' | 'type' | 'beaned';

type Option = {
  key: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
};

type CollectionFilterBarProps = {
  cafes: Cafe[];
  filters: CollectionFilterState;
  onChange: (next: CollectionFilterState) => void;
};

/**
 * Shared Area / Type / Beaned Pick filters — Search-style category pills + expand panel.
 * Used on Saved Spaces and Visited Spaces.
 */
export function CollectionFilterBar({ cafes, filters, onChange }: CollectionFilterBarProps) {
  const [expanded, setExpanded] = useState<FilterKey | null>(null);

  const areaOptions = useMemo(() => uniqueSortedAreas(cafes), [cafes]);
  const venueTypeOptions = useMemo(() => uniqueVenueTypesInCollection(cafes), [cafes]);
  const showBeanedPick = useMemo(() => cafes.some((c) => c.isCertified), [cafes]);

  if (cafes.length === 0) return null;
  if (areaOptions.length === 0 && venueTypeOptions.length === 0 && !showBeanedPick) {
    return null;
  }

  const setArea = (area: string | null) => {
    onChange({ ...filters, area });
    setExpanded(null);
  };
  const setVenueType = (venueType: VenueTypeValue | null) => {
    onChange({ ...filters, venueType });
    setExpanded(null);
  };
  const setBeanedPicksOnly = (beanedPicksOnly: boolean) => {
    onChange({ ...filters, beanedPicksOnly });
    setExpanded(null);
  };

  const pills: Array<{
    key: FilterKey;
    defaultLabel: string;
    displayLabel: string;
    active: boolean;
  }> = [];

  if (areaOptions.length > 0) {
    pills.push({
      key: 'area',
      defaultLabel: 'Area',
      displayLabel: filters.area ?? 'Area',
      active: filters.area != null,
    });
  }
  if (venueTypeOptions.length > 0) {
    pills.push({
      key: 'type',
      defaultLabel: 'Type',
      displayLabel:
        filters.venueType != null ? formatVenueTypeBadge(filters.venueType) : 'Type',
      active: filters.venueType != null,
    });
  }
  if (showBeanedPick) {
    pills.push({
      key: 'beaned',
      defaultLabel: 'Beaned Pick',
      displayLabel: filters.beanedPicksOnly ? 'Beaned Picks only' : 'Beaned Pick',
      active: filters.beanedPicksOnly,
    });
  }

  let panelOptions: Option[] = [];
  if (expanded === 'area') {
    panelOptions = [
      {
        key: 'area-all',
        label: 'All',
        selected: filters.area === null,
        onSelect: () => setArea(null),
      },
      ...areaOptions.map((area) => ({
        key: `area-${area}`,
        label: area,
        selected: filters.area === area,
        onSelect: () => setArea(area),
      })),
    ];
  } else if (expanded === 'type') {
    panelOptions = [
      {
        key: 'type-all',
        label: 'All',
        selected: filters.venueType === null,
        onSelect: () => setVenueType(null),
      },
      ...venueTypeOptions.map((value) => ({
        key: `type-${value}`,
        label: formatVenueTypeBadge(value),
        selected: filters.venueType === value,
        onSelect: () => setVenueType(value),
      })),
    ];
  } else if (expanded === 'beaned') {
    panelOptions = [
      {
        key: 'beaned-all',
        label: 'All',
        selected: !filters.beanedPicksOnly,
        onSelect: () => setBeanedPicksOnly(false),
      },
      {
        key: 'beaned-only',
        label: 'Beaned Picks only',
        selected: filters.beanedPicksOnly,
        onSelect: () => setBeanedPicksOnly(true),
      },
    ];
  }

  const hasActive = pills.some((p) => p.active);

  return (
    <View style={styles.wrap}>
      <View style={styles.pillRow}>
        {pills.map((pill) => {
          const open = expanded === pill.key;
          return (
            <Pressable
              key={pill.key}
              accessibilityRole="button"
              accessibilityLabel={`${pill.defaultLabel} filter${pill.active ? `, ${pill.displayLabel}` : ''}`}
              onPress={() => setExpanded((prev) => (prev === pill.key ? null : pill.key))}
              style={({ pressed }) => [
                styles.pill,
                open && styles.pillOpen,
                pill.active && styles.pillActive,
                pressed && styles.pillPressed,
              ]}
            >
              <Text
                style={[styles.pillText, (pill.active || open) && styles.pillTextActive]}
                numberOfLines={1}
              >
                {pill.displayLabel}
              </Text>
              <Ionicons
                name={open ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={pill.active || open ? COLORS.accent : COLORS.muted}
              />
            </Pressable>
          );
        })}
      </View>

      {expanded && panelOptions.length > 0 ? (
        <View style={styles.panel}>
          <View style={styles.panelInner}>
            {panelOptions.map((opt) => (
              <Pressable
                key={opt.key}
                accessibilityRole="button"
                accessibilityState={{ selected: opt.selected }}
                onPress={opt.onSelect}
                style={({ pressed }) => [
                  styles.optionChip,
                  opt.selected && styles.optionChipSelected,
                  pressed && styles.optionChipPressed,
                ]}
              >
                <Text
                  style={[styles.optionChipText, opt.selected && styles.optionChipTextSelected]}
                  numberOfLines={1}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {hasActive ? (
        <TouchableOpacity
          onPress={() => {
            onChange({
              area: null,
              venueType: null,
              beanedPicksOnly: false,
            });
            setExpanded(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="Clear filters"
          style={styles.clearRow}
          hitSlop={{ top: 8, bottom: 8 }}
        >
          <Text style={styles.clearText}>Clear filters</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

type CollectionFilterEmptyProps = {
  collectionLabel: 'saved' | 'visited';
  onClear: () => void;
};

/** Empty state when filters exclude every space in the collection. */
export function CollectionFilterEmpty({ collectionLabel, onClear }: CollectionFilterEmptyProps) {
  const title =
    collectionLabel === 'saved' ? 'No saved spaces match' : 'No visited spaces match';

  return (
    <View style={styles.emptyFilterWrap}>
      <Text style={styles.emptyFilterTitle}>{title}</Text>
      <Text style={styles.emptyFilterSubtitle}>Try changing or clearing your filters.</Text>
      <TouchableOpacity activeOpacity={0.85} style={styles.clearFiltersButton} onPress={onClear}>
        <Text style={styles.clearFiltersText}>Clear filters</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginBottom: 2,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    maxWidth: '48%',
  },
  pillOpen: {
    borderColor: COLORS.accentSubtleBorder,
    backgroundColor: COLORS.accentSubtleFill,
  },
  pillActive: {
    borderColor: COLORS.accentSubtleBorder,
  },
  pillPressed: {
    opacity: 0.92,
  },
  pillText: {
    fontSize: 13,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    flexShrink: 1,
  },
  pillTextActive: {
    color: COLORS.accent,
  },
  panel: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    padding: 10,
  },
  panelInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.tagSecondaryBorder,
    backgroundColor: COLORS.chipBackground,
  },
  optionChipSelected: {
    backgroundColor: COLORS.accentSubtleFill,
    borderColor: COLORS.text,
  },
  optionChipPressed: {
    opacity: 0.9,
  },
  optionChipText: {
    fontSize: 13,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
  },
  optionChipTextSelected: {
    color: COLORS.accent,
  },
  clearRow: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  clearText: {
    fontSize: 13,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.accent,
  },
  emptyFilterWrap: {
    marginTop: 8,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 18,
    paddingVertical: 22,
    gap: 8,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  emptyFilterTitle: {
    fontSize: 16,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  emptyFilterSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
    textAlign: 'center',
  },
  clearFiltersButton: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  clearFiltersText: {
    fontSize: 14,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.accent,
  },
});
