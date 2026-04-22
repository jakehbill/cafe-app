import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS, FONTS } from '@/components/theme';
import { useAuth } from '@/contexts/AuthContext';
import { isModerator } from '@/lib/moderator';
import {
  createCafeAndApproveSubmission,
  fetchCafeSubmissionById,
  findLikelyCafeDuplicates,
  type PendingCafeSuggestion,
} from '@/lib/moderationQueue';

function parseTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    )
  );
}

export default function ModerationCreateCafeScreen() {
  const router = useRouter();
  const { submissionId } = useLocalSearchParams<{ submissionId?: string }>();
  const { user } = useAuth();
  const allowed = isModerator(user?.id);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [submission, setSubmission] = React.useState<PendingCafeSuggestion | null>(null);
  const [name, setName] = React.useState('');
  const [neighborhood, setNeighborhood] = React.useState('');
  const [addressLine, setAddressLine] = React.useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [tagsText, setTagsText] = React.useState('');
  const [latitudeText, setLatitudeText] = React.useState('');
  const [longitudeText, setLongitudeText] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState('');

  React.useEffect(() => {
    const id = String(submissionId ?? '').trim();
    if (!id || !allowed) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const row = await fetchCafeSubmissionById(id);
      if (cancelled) return;
      setSubmission(row);
      if (row) {
        setName(row.cafe_name ?? '');
        setNeighborhood(row.area ?? '');
        setAddressLine(row.address_text ?? '');
        setGoogleMapsUrl(row.google_maps_url ?? '');
        setSummary(row.notes ?? '');
        setTagsText((row.selected_tags ?? []).join(', '));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionId, allowed]);

  if (!allowed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <Text style={styles.title}>Not authorized</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  async function continueSave(ignoreDuplicateWarning: boolean) {
    const submissionIdValue = String(submissionId ?? '').trim();
    const cleanedName = name.trim();
    const cleanedNeighborhood = neighborhood.trim();
    const latitude = Number.parseFloat(latitudeText.trim());
    const longitude = Number.parseFloat(longitudeText.trim());

    if (!submissionIdValue) {
      Alert.alert('Missing submission', 'No submission id was provided.');
      return;
    }
    if (!cleanedName || !cleanedNeighborhood) {
      Alert.alert('Required fields missing', 'Cafe name and neighbourhood are required.');
      return;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      Alert.alert('Coordinates required', 'Latitude and longitude must be valid numbers.');
      return;
    }

    if (!ignoreDuplicateWarning) {
      const duplicates = await findLikelyCafeDuplicates({
        name: cleanedName,
        neighborhood: cleanedNeighborhood,
        addressLine,
      });
      if (duplicates.length > 0) {
        const duplicateLines = duplicates
          .slice(0, 3)
          .map((dup) => `${dup.name}${dup.neighborhood ? ` · ${dup.neighborhood}` : ''}`)
          .join('\n');
        Alert.alert(
          'Possible duplicate',
          `Likely matches found:\n${duplicateLines}\n\nCreate anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Create anyway',
              style: 'destructive',
              onPress: () => void continueSave(true),
            },
          ]
        );
        return;
      }
    }

    setSaving(true);
    const res = await createCafeAndApproveSubmission({
      submissionId: submissionIdValue,
      name: cleanedName,
      neighborhood: cleanedNeighborhood,
      latitude,
      longitude,
      addressLine,
      googleMapsUrl,
      summary,
      tags: parseTags(tagsText),
      imageUrl,
    });
    setSaving(false);

    if (!res.ok) {
      Alert.alert('Could not create cafe', res.error);
      return;
    }

    Alert.alert('Success', 'Cafe created and submission approved', [
      {
        text: 'OK',
        onPress: () => router.back(),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Create cafe</Text>
            <Text style={styles.subtitle}>Prefilled from the selected suggestion. Review before saving.</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={COLORS.muted} />
          ) : !submission ? (
            <Text style={styles.emptyText}>Submission not found.</Text>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.label}>Cafe name</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} />

                <Text style={styles.label}>Area / neighbourhood</Text>
                <TextInput style={styles.input} value={neighborhood} onChangeText={setNeighborhood} />

                <Text style={styles.label}>Address</Text>
                <TextInput style={styles.input} value={addressLine} onChangeText={setAddressLine} />

                <Text style={styles.label}>Google Maps URL</Text>
                <TextInput
                  style={styles.input}
                  value={googleMapsUrl}
                  onChangeText={setGoogleMapsUrl}
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Summary</Text>
                <TextInput
                  style={styles.textArea}
                  value={summary}
                  onChangeText={setSummary}
                  multiline
                  textAlignVertical="top"
                />

                <Text style={styles.label}>Tags (comma-separated)</Text>
                <TextInput style={styles.input} value={tagsText} onChangeText={setTagsText} />

                <Text style={styles.label}>Latitude</Text>
                <TextInput
                  style={styles.input}
                  value={latitudeText}
                  onChangeText={setLatitudeText}
                  keyboardType="decimal-pad"
                  placeholder="Required"
                  placeholderTextColor={COLORS.muted}
                />

                <Text style={styles.label}>Longitude</Text>
                <TextInput
                  style={styles.input}
                  value={longitudeText}
                  onChangeText={setLongitudeText}
                  keyboardType="decimal-pad"
                  placeholder="Required"
                  placeholderTextColor={COLORS.muted}
                />

                <Text style={styles.label}>Primary image URL (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={imageUrl}
                  onChangeText={setImageUrl}
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.88}
                style={[styles.primaryButton, saving && styles.disabledButton]}
                disabled={saving}
                onPress={() => void continueSave(false)}
              >
                <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Create cafe & approve'}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
    gap: 14,
  },
  headerBlock: {
    gap: 4,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    color: COLORS.text,
    fontFamily: FONTS.display.bold,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    padding: 14,
    gap: 8,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
    fontFamily: FONTS.sans.semibold,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 11,
    paddingVertical: 9,
    color: COLORS.text,
    fontSize: 14,
    fontFamily: FONTS.sans.regular,
  },
  textArea: {
    minHeight: 92,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 11,
    paddingVertical: 9,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONTS.sans.regular,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.accentSubtleBorder,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#ffffff',
    fontFamily: FONTS.sans.semibold,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    fontSize: 13,
    lineHeight: 17,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
  },
  disabledButton: {
    opacity: 0.72,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
});

