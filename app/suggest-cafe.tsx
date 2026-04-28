import React, { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Image,
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

import { TagWithOptionalIcon } from '@/components/TagWithOptionalIcon';
import { StackHeaderBackButton } from '@/components/navigation/StackHeaderBackButton';
import { COLORS, FONTS } from '@/components/theme';
import { TAG_SECTIONS } from '@/lib/cafeTags';
import {
  createCafeSuggestionWithId,
  getMyCafeSubmissions,
  isValidOptionalUrl,
  type CafeSubmissionStatus,
  type MyCafeSubmissionRow,
} from '@/lib/cafeSubmissions';
import { uploadSubmissionPhotos } from '@/lib/cafeSubmissionPhotos';
import { saveUserCafeVisit } from '@/lib/userCafeVisits';

const STATUS_LABEL: Record<CafeSubmissionStatus, string> = {
  pending: 'Pending review',
  approved: 'Reviewed',
  rejected: 'Not added',
};

function formatDate(dateIso: string): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SuggestCafeScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    prefillName?: string | string[];
    fromVisitLog?: string | string[];
    visitRating?: string | string[];
    visitTags?: string | string[];
    visitNote?: string | string[];
    visitIsPublic?: string | string[];
    visitPhotoUri?: string | string[];
    visitPhotoMimeType?: string | string[];
    visitPhotoFileName?: string | string[];
  }>();
  const fromVisitLog = (Array.isArray(params.fromVisitLog) ? params.fromVisitLog[0] : params.fromVisitLog) === '1';
  const initialName = Array.isArray(params.prefillName) ? params.prefillName[0] : params.prefillName;
  const initialVisitRatingRaw = Array.isArray(params.visitRating) ? params.visitRating[0] : params.visitRating;
  const initialVisitTagsRaw = Array.isArray(params.visitTags) ? params.visitTags[0] : params.visitTags;
  const initialVisitNote = Array.isArray(params.visitNote) ? params.visitNote[0] : params.visitNote;
  const initialVisitIsPublic =
    (Array.isArray(params.visitIsPublic) ? params.visitIsPublic[0] : params.visitIsPublic) === '1';
  const initialVisitPhotoUri = Array.isArray(params.visitPhotoUri) ? params.visitPhotoUri[0] : params.visitPhotoUri;
  const initialVisitPhotoMimeType = Array.isArray(params.visitPhotoMimeType)
    ? params.visitPhotoMimeType[0]
    : params.visitPhotoMimeType;
  const initialVisitPhotoFileName = Array.isArray(params.visitPhotoFileName)
    ? params.visitPhotoFileName[0]
    : params.visitPhotoFileName;
  const [cafeName, setCafeName] = useState('');
  const [addressText, setAddressText] = useState('');
  const [area, setArea] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mySubmissions, setMySubmissions] = useState<MyCafeSubmissionRow[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [selectedPhotos, setSelectedPhotos] = useState<({
    uri: string;
    mimeType?: string | null;
    fileName?: string | null;
  } | null)[]>([null, null, null]);
  const redirectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!initialName) return;
    setCafeName(String(initialName).trim());
  }, [initialName]);

  const urlLooksValid = useMemo(
    () => isValidOptionalUrl(googleMapsUrl),
    [googleMapsUrl]
  );

  React.useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await getMyCafeSubmissions(6);
      if (cancelled) return;
      setMySubmissions(rows);
      setSubmissionsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submitDisabled =
    submitting || redirecting || cafeName.trim().length === 0 || !isValidOptionalUrl(googleMapsUrl);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((item) => item !== tag);
      return [...prev, tag];
    });
  }

  function resetForm() {
    setCafeName('');
    setAddressText('');
    setArea('');
    setGoogleMapsUrl('');
    setNotes('');
    setSelectedTags([]);
    setSelectedPhotos([null, null, null]);
  }

  function handleBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    router.replace('/(tabs)/profile');
  }

  async function pickPhotoForSlot(index: number) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setSubmitError('Please allow photo library access to add photos.');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.86,
    });

    if (pickerResult.canceled) return;
    const asset = pickerResult.assets?.[0];
    if (!asset?.uri) return;

    setSelectedPhotos((prev) => {
      const next = [...prev];
      next[index] = {
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
      };
      return next;
    });
  }

  function removePhotoForSlot(index: number) {
    setSelectedPhotos((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  async function handleSubmit() {
    const nameTrimmed = cafeName.trim();
    if (!nameTrimmed) {
      setSubmitError('Cafe name is required.');
      return;
    }
    if (!isValidOptionalUrl(googleMapsUrl)) {
      setSubmitError('Please enter a valid URL (including https://).');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const result = await createCafeSuggestionWithId({
        cafeName: nameTrimmed,
        addressText,
        area,
        googleMapsUrl,
        notes,
        selectedTags,
      });

      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }

      if (fromVisitLog) {
        const parsedRating = Number(initialVisitRatingRaw);
        const visitTags = String(initialVisitTagsRaw ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        const linkedVisit = await saveUserCafeVisit({
          cafeId: null,
          submissionId: result.submissionId,
          rating: Number.isFinite(parsedRating) ? parsedRating : null,
          tags: visitTags,
          note: String(initialVisitNote ?? ''),
          isPublic: initialVisitIsPublic,
          photoAsset: initialVisitPhotoUri
            ? {
                uri: initialVisitPhotoUri,
                mimeType: initialVisitPhotoMimeType ?? null,
                fileName: initialVisitPhotoFileName ?? null,
              }
            : null,
        });
        if (!linkedVisit.ok) {
          setSuccessMessage(
            `Cafe suggestion saved, but your visit draft was not linked yet: ${linkedVisit.error}. You can retry from Visit log.`
          );
        }
      }

      const imagesToUpload = selectedPhotos.filter(
        (photo): photo is { uri: string; mimeType?: string | null; fileName?: string | null } => photo != null
      );

      let uploadSummary: { uploadedCount: number; failedCount: number } | null = null;
      if (imagesToUpload.length > 0) {
        uploadSummary = await uploadSubmissionPhotos({
          userId: result.userId,
          submissionId: result.submissionId,
          images: imagesToUpload,
        });
      }

      if (uploadSummary && uploadSummary.failedCount > 0) {
        setSuccessMessage(
          `Thanks — we’ll review this before adding it to Beaned. (${uploadSummary.uploadedCount}/${imagesToUpload.length} photos uploaded)`
        );
      } else {
        setSuccessMessage('Thanks — we’ll review this before adding it to Beaned.');
      }
      resetForm();
      const rows = await getMyCafeSubmissions(6);
      setMySubmissions(rows);
      setRedirecting(true);
      // Briefly show success feedback before returning to the homepage.
      redirectTimeoutRef.current = setTimeout(() => {
        router.replace(fromVisitLog ? '/my-cafes' : '/');
      }, 600);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <StackHeaderBackButton
                canGoBack
                tintColor={COLORS.text}
                onPress={handleBack}
              />
            </View>
            <Text style={styles.headerTitle}>Suggest a cafe</Text>
            <View style={styles.headerRight} />
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.pageTitle}>Suggest a cafe</Text>
            <Text style={styles.pageSubtitle}>
              {fromVisitLog
                ? 'Log your visit somewhere new by adding this cafe for review.'
                : 'Know a spot we&apos;ve missed? Send it in for review.'}
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>Cafe name</Text>
            <TextInput
              style={styles.input}
              value={cafeName}
              onChangeText={setCafeName}
              placeholder="Required"
              placeholderTextColor={COLORS.muted}
              maxLength={120}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <Text style={styles.fieldLabel}>Address / location</Text>
            <TextInput
              style={styles.input}
              value={addressText}
              onChangeText={setAddressText}
              placeholder="Optional"
              placeholderTextColor={COLORS.muted}
              maxLength={180}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Area / neighbourhood</Text>
            <TextInput
              style={styles.input}
              value={area}
              onChangeText={setArea}
              placeholder="Optional"
              placeholderTextColor={COLORS.muted}
              maxLength={120}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Google Maps URL</Text>
            <TextInput
              style={[styles.input, !urlLooksValid && styles.inputInvalid]}
              value={googleMapsUrl}
              onChangeText={setGoogleMapsUrl}
              placeholder="Optional"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {!urlLooksValid ? (
              <Text style={styles.validationText}>Enter a valid URL with http:// or https://.</Text>
            ) : null}

            <Text style={styles.fieldLabel}>Note</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything helpful for review?"
              placeholderTextColor={COLORS.muted}
              multiline
              textAlignVertical="top"
              maxLength={400}
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>Add photos (recommended)</Text>
            <View style={styles.photoSlotsWrap}>
              {[
                { label: 'Front / exterior', index: 0 },
                { label: 'Coffee or interior', index: 1 },
                { label: 'Optional third photo', index: 2 },
              ].map((slot) => {
                const photo = selectedPhotos[slot.index];
                return (
                  <View key={`suggest-photo-slot-${slot.index}`} style={styles.photoSlotCard}>
                    <Text style={styles.photoSlotLabel}>{slot.label}</Text>
                    {photo ? (
                      <Image source={{ uri: photo.uri }} style={styles.photoPreview} resizeMode="cover" />
                    ) : (
                      <View style={styles.photoEmptyState}>
                        <Text style={styles.photoEmptyStateText}>No photo selected</Text>
                      </View>
                    )}
                    <View style={styles.photoSlotActionsRow}>
                      <TouchableOpacity
                        activeOpacity={0.88}
                        style={styles.photoSlotButton}
                        onPress={() => void pickPhotoForSlot(slot.index)}
                        disabled={submitting || redirecting}
                      >
                        <Text style={styles.photoSlotButtonText}>{photo ? 'Replace' : 'Add photo'}</Text>
                      </TouchableOpacity>
                      {photo ? (
                        <TouchableOpacity
                          activeOpacity={0.88}
                          style={[styles.photoSlotButton, styles.photoSlotButtonSecondary]}
                          onPress={() => removePhotoForSlot(slot.index)}
                          disabled={submitting || redirecting}
                        >
                          <Text style={styles.photoSlotButtonSecondaryText}>Remove</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>Tags</Text>
            <Text style={styles.tagHelperText}>Help us understand the space before we review it.</Text>
            {TAG_SECTIONS.map((section) => (
              <View key={section.title} style={styles.tagSection}>
                <Text style={styles.tagSectionTitle}>{section.title}</Text>
                <View style={styles.tagsWrap}>
                  {section.tags.map((tag) => {
                    const selected = selectedTags.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        activeOpacity={0.85}
                        style={[styles.tagChip, selected && styles.tagChipSelected]}
                        onPress={() => toggleTag(tag)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <TagWithOptionalIcon
                          tag={tag}
                          iconSize={14}
                          color={selected ? COLORS.accent : COLORS.text}
                          textStyle={[styles.tagChipText, selected && styles.tagChipTextSelected]}
                          gap={5}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          {submitError ? (
            <View style={styles.feedbackBannerError}>
              <Text style={styles.feedbackErrorText}>{submitError}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View style={styles.feedbackBannerSuccess}>
              <Text style={styles.feedbackSuccessText}>{successMessage}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.submitButton, submitDisabled && styles.submitButtonDisabled]}
            onPress={() => void handleSubmit()}
            disabled={submitDisabled}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit for review</Text>
            )}
          </TouchableOpacity>

          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>Your recent suggestions</Text>
            {submissionsLoading ? (
              <ActivityIndicator color={COLORS.muted} style={{ paddingVertical: 6 }} />
            ) : mySubmissions.length === 0 ? (
              <Text style={styles.mutedText}>No submissions yet.</Text>
            ) : (
              <View style={styles.submissionsList}>
                {mySubmissions.map((submission) => (
                  <View key={submission.id} style={styles.submissionRow}>
                    <View style={styles.submissionTextWrap}>
                      <Text style={styles.submissionName}>{submission.cafe_name}</Text>
                      <Text style={styles.submissionMeta}>
                        {[submission.area, formatDate(submission.created_at)].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={styles.submissionStatus}>{STATUS_LABEL[submission.status]}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
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
    paddingTop: 10,
    paddingBottom: 36,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    marginBottom: 2,
  },
  headerLeft: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 22,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
  },
  headerRight: {
    width: 40,
  },
  titleBlock: {
    gap: 6,
  },
  pageTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  sectionCard: {
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 16,
    gap: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
    fontFamily: FONTS.sans.regular,
  },
  inputInvalid: {
    borderColor: 'rgba(180, 80, 80, 0.5)',
  },
  notesInput: {
    minHeight: 92,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONTS.sans.regular,
  },
  validationText: {
    fontSize: 12,
    color: '#8B4A4A',
    fontFamily: FONTS.sans.medium,
    marginTop: -4,
  },
  tagHelperText: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
    marginTop: -2,
    marginBottom: 2,
  },
  tagSection: {
    gap: 8,
    marginTop: 2,
  },
  tagSectionTitle: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
    fontFamily: FONTS.sans.semibold,
    letterSpacing: 0.2,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tagChipSelected: {
    borderColor: COLORS.accentSubtleBorder,
    backgroundColor: COLORS.accentSubtleFill,
  },
  tagChipText: {
    color: COLORS.text,
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
  },
  tagChipTextSelected: {
    color: COLORS.accent,
  },
  photoSlotsWrap: {
    gap: 10,
  },
  photoSlotCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    padding: 10,
    gap: 8,
  },
  photoSlotLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
    fontFamily: FONTS.sans.semibold,
  },
  photoPreview: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: 10,
    backgroundColor: COLORS.imagePlaceholder,
  },
  photoEmptyState: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmptyStateText: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  photoSlotActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  photoSlotButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  photoSlotButtonSecondary: {
    backgroundColor: COLORS.inputBackground,
  },
  photoSlotButtonText: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
  },
  photoSlotButtonSecondaryText: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
    fontFamily: FONTS.sans.semibold,
  },
  submitButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accentSubtleBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.75,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: FONTS.sans.semibold,
    textAlign: 'center',
  },
  feedbackBannerError: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(180, 80, 80, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(180, 80, 80, 0.24)',
  },
  feedbackErrorText: {
    fontSize: 14,
    lineHeight: 19,
    color: '#8B4A4A',
    fontFamily: FONTS.sans.medium,
    textAlign: 'center',
  },
  feedbackBannerSuccess: {
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(163, 177, 138, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(163, 177, 138, 0.45)',
  },
  feedbackSuccessText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4A5A49',
    fontFamily: FONTS.sans.semibold,
    textAlign: 'center',
  },
  mutedText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.sans.regular,
  },
  submissionsList: {
    gap: 10,
  },
  submissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  submissionTextWrap: {
    flex: 1,
    gap: 2,
  },
  submissionName: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: FONTS.sans.semibold,
  },
  submissionMeta: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONTS.sans.regular,
  },
  submissionStatus: {
    color: COLORS.accent,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.semibold,
    textAlign: 'right',
  },
});
