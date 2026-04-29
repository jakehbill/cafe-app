import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TagWithOptionalIcon } from '@/components/TagWithOptionalIcon';
import { StackHeaderBackButton } from '@/components/navigation/StackHeaderBackButton';
import { COLORS, FONTS } from '@/components/theme';
import { useCafeState } from '@/contexts/CafeStateContext';
import { type Cafe } from '@/data/cafes';
import { fetchCafeByIdFromSupabase } from '@/lib/cafeCatalogSupabase';
import { resolveLiveCafePrimaryImageUrl } from '@/lib/cafeLiveImages';
import { TAG_SECTIONS } from '@/lib/cafeTags';
import { POINTS } from '@/lib/profileGamification';
import { getUserCafeVisitById, saveUserCafeVisit, updateUserCafeVisit } from '@/lib/userCafeVisits';

export default function LogVisitScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id, visitId } = useLocalSearchParams<{ id?: string | string[]; visitId?: string | string[] }>();
  const cafeId = Array.isArray(id) ? id[0] : id;
  const editingVisitId = Array.isArray(visitId) ? visitId[0] : visitId;
  const targetCafeId = cafeId ?? '';
  const { isSaved } = useCafeState();
  const guessedCafeName = decodeURIComponent(targetCafeId).replace(/[-_]+/g, ' ').trim();

  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [cafeLoading, setCafeLoading] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [photoAsset, setPhotoAsset] = useState<{
    uri: string;
    mimeType?: string | null;
    fileName?: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [redirectingMissingCafe, setRedirectingMissingCafe] = useState(false);
  const [existingPendingName, setExistingPendingName] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<{
    movedFromSaved: boolean;
    hadPhoto: boolean;
  } | null>(null);

  React.useEffect(() => {
    if (!targetCafeId) {
      setCafeLoading(false);
      return;
    }
    let cancelled = false;
    setCafeLoading(true);
    void (async () => {
      const row = await fetchCafeByIdFromSupabase(targetCafeId);
      if (!cancelled) {
        setCafe(row);
        setCafeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetCafeId]);

  React.useEffect(() => {
    if (!editingVisitId) return;
    let cancelled = false;
    setLoadingExisting(true);
    void (async () => {
      const existing = await getUserCafeVisitById(editingVisitId);
      if (!existing || cancelled) {
        if (!cancelled) setLoadingExisting(false);
        return;
      }
      setRating(existing.rating);
      setSelectedTags(existing.tags);
      setNote(existing.note);
      setExistingPendingName(existing.submissionCafeName);
      if (!targetCafeId && existing.cafeId) {
        const resolvedCafe = await fetchCafeByIdFromSupabase(existing.cafeId);
        if (!cancelled) setCafe(resolvedCafe);
      }
      if (!cancelled) setLoadingExisting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [editingVisitId, targetCafeId]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/');
    }
  }, [navigation, router]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handlePickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo access to add a visit photo.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.86,
    });
    if (picked.canceled) return;
    const asset = picked.assets?.[0];
    if (!asset?.uri) return;
    setPhotoAsset({
      uri: asset.uri,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
    });
  }

  async function handleSaveVisit() {
    if ((!targetCafeId && !editingVisitId) || saving) return;
    setError(null);
    setSaving(true);
    try {
      const res = editingVisitId
        ? await updateUserCafeVisit(editingVisitId, {
            rating,
            tags: selectedTags,
            note,
            photoAsset,
          })
        : await saveUserCafeVisit({
            cafeId: targetCafeId,
            rating,
            tags: selectedTags,
            note,
            photoAsset,
          });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const movedFromSaved = !editingVisitId && Boolean(targetCafeId) && isSaved(targetCafeId);
      if (!editingVisitId) {
        setSuccessState({ movedFromSaved, hadPhoto: Boolean(photoAsset?.uri) });
      } else {
        router.replace('/my-cafes');
      }
    } finally {
      setSaving(false);
    }
  }

  const coverImage = useMemo(() => {
    if (photoAsset?.uri) return photoAsset.uri;
    if (!cafe) return undefined;
    return resolveLiveCafePrimaryImageUrl({ cafe });
  }, [cafe, photoAsset?.uri]);
  const canRenderVisitForm = Boolean(cafe) || Boolean(editingVisitId);

  function openSuggestPrefilled() {
    router.push({
      pathname: '/suggest-cafe',
      params: {
        prefillName: guessedCafeName,
        fromVisitLog: '1',
        visitRating: rating != null ? String(rating) : '',
        visitTags: selectedTags.join(','),
        visitNote: note,
        visitPhotoUri: photoAsset?.uri ?? '',
        visitPhotoMimeType: photoAsset?.mimeType ?? '',
        visitPhotoFileName: photoAsset?.fileName ?? '',
      },
    });
  }

  React.useEffect(() => {
    if (successState || editingVisitId) return;
    if (!targetCafeId) return;
    if (cafeLoading) return;
    if (cafe) return;
    setRedirectingMissingCafe(true);
    openSuggestPrefilled();
  }, [successState, editingVisitId, targetCafeId, cafeLoading, cafe]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.heroBackRow}>
          <StackHeaderBackButton canGoBack tintColor={COLORS.text} onPress={handleBack} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {successState ? (
            <View style={styles.sectionCard}>
              <Text style={styles.pageTitle}>Visit saved</Text>
              <Text style={styles.pageSubtitle}>
                {successState.movedFromSaved
                  ? 'Moved from Saved for later to Visited.'
                  : 'Added to your personal cafe log.'}
              </Text>
              <Text style={styles.successPointsText}>+{POINTS.perVisited} points for logging a visit</Text>
              {successState.hadPhoto ? (
                <Text style={styles.successHintText}>Your photo has been submitted for review.</Text>
              ) : null}
              {successState.movedFromSaved ? (
                <Text style={styles.successHintText}>Moved to Visited</Text>
              ) : null}
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.submitButton}
                onPress={() =>
                  router.replace({
                    pathname: '/my-cafes',
                    params: successState.movedFromSaved ? { movedFromSaved: '1' } : undefined,
                  })
                }
              >
                <Text style={styles.submitButtonText}>View my visits</Text>
              </TouchableOpacity>
              {targetCafeId ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.photoButton, styles.secondaryButton]}
                  onPress={() => router.replace(`/cafe/${targetCafeId}`)}
                >
                  <Text style={styles.secondaryButtonText}>Back to cafe</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.photoButton, styles.secondaryButton]}
                onPress={() => router.replace('/')}
              >
                <Text style={styles.secondaryButtonText}>Find another cafe</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!successState ? (
          <View style={styles.titleBlock}>
            <Text style={styles.pageTitle}>{editingVisitId ? 'Edit visit log' : 'Log your visit'}</Text>
            <Text style={styles.pageSubtitle}>
              Save a few notes from this cafe so you can remember where you&apos;ve been.
            </Text>
          </View>
          ) : null}

          {!successState && !canRenderVisitForm ? (
            <View style={styles.sectionCard}>
              <ActivityIndicator color={COLORS.accent} />
              <Text style={styles.pageSubtitle}>
                {redirectingMissingCafe ? 'Opening Log a cafe flow...' : 'Loading cafe...'}
              </Text>
            </View>
          ) : null}

          {!successState && canRenderVisitForm ? <View style={styles.previewCard}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={[styles.previewImage, styles.previewImagePlaceholder]} />
            )}
            <View style={styles.previewTextWrap}>
              <Text style={styles.previewName}>{cafe?.name ?? existingPendingName ?? 'Cafe'}</Text>
              <Text style={styles.previewNeighborhood} numberOfLines={1}>
                {cafe?.neighborhood ?? existingPendingName ?? 'Neighborhood'}
              </Text>
            </View>
          </View> : null}

          {!successState && canRenderVisitForm ? <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Add a memory</Text>
            <Text style={styles.sectionHelperText}>
              A coffee, the space, or anything you want to remember.
            </Text>
            <TouchableOpacity style={styles.photoButton} activeOpacity={0.9} onPress={() => void handlePickPhoto()}>
              <Text style={styles.photoButtonText}>{photoAsset ? 'Change photo' : 'Add photo'}</Text>
            </TouchableOpacity>
          </View> : null}

          {!successState && canRenderVisitForm ? <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>How was it?</Text>
            <Text style={styles.ratingValue}>{rating == null ? 'Not rated' : `${rating.toFixed(1)} / 5`}</Text>
            <Slider
              value={rating ?? 3}
              onValueChange={(v) => setRating(v)}
              minimumValue={1}
              maximumValue={5}
              step={0.5}
              minimumTrackTintColor={COLORS.accent}
              maximumTrackTintColor="rgba(92, 86, 80, 0.22)"
              thumbTintColor={COLORS.accent}
            />
            <TouchableOpacity onPress={() => setRating(null)}>
              <Text style={styles.clearRatingText}>Clear rating</Text>
            </TouchableOpacity>
          </View> : null}

          {!successState && canRenderVisitForm ? <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>What stood out?</Text>
            {TAG_SECTIONS.map((section) => (
              <View key={section.title} style={styles.tagSection}>
                <Text style={styles.tagSectionTitle}>{section.title}</Text>
                <View style={styles.tagsWrap}>
                  {section.tags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.tagChip, selectedTags.includes(tag) && styles.tagChipSelected]}
                      onPress={() => toggleTag(tag)}
                      activeOpacity={0.85}
                    >
                      <TagWithOptionalIcon
                        tag={tag}
                        iconSize={14}
                        color={selectedTags.includes(tag) ? COLORS.accent : COLORS.text}
                        textStyle={[
                          styles.tagChipText,
                          selectedTags.includes(tag) && styles.tagChipTextSelected,
                        ]}
                        gap={5}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View> : null}

          {!successState && canRenderVisitForm ? <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Describe your experience</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="What made this place worth remembering?"
              placeholderTextColor={COLORS.muted}
              numberOfLines={2}
              multiline
              maxLength={180}
              value={note}
              onChangeText={setNote}
            />
          </View> : null}

          {!successState && error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!successState && canRenderVisitForm ? <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.submitButton, saving && styles.submitButtonDisabled]}
            onPress={() => void handleSaveVisit()}
            disabled={saving || loadingExisting}
          >
            <Text style={styles.submitButtonText}>
              {saving ? 'Saving…' : editingVisitId ? 'Save changes' : 'Save to my diary'}
            </Text>
          </TouchableOpacity> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  keyboardAvoid: { flex: 1 },
  heroBackRow: { marginBottom: 8, paddingHorizontal: 20 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 36, gap: 16 },
  titleBlock: { gap: 8 },
  pageTitle: { fontSize: 28, lineHeight: 34, fontFamily: FONTS.display.bold, color: COLORS.text },
  pageSubtitle: { fontSize: 14, lineHeight: 20, color: COLORS.muted, fontFamily: FONTS.sans.regular },
  previewCard: {
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 12,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  previewImage: { width: 80, height: 80, borderRadius: 14, backgroundColor: COLORS.imagePlaceholder },
  previewImagePlaceholder: { backgroundColor: COLORS.imagePlaceholder },
  previewTextWrap: { flex: 1, gap: 4 },
  previewName: { fontSize: 18, color: COLORS.text, fontFamily: FONTS.sans.semibold, lineHeight: 24 },
  previewNeighborhood: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  sectionCard: {
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 13, fontFamily: FONTS.sans.semibold, color: COLORS.text },
  sectionHelperText: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
    marginTop: -4,
  },
  photoButton: {
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
  },
  photoButtonText: { fontSize: 14, fontFamily: FONTS.sans.semibold, color: COLORS.text },
  secondaryButton: {
    backgroundColor: COLORS.background,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    textAlign: 'center',
  },
  ratingValue: { fontSize: 20, fontFamily: FONTS.sans.bold, color: COLORS.text },
  clearRatingText: { fontSize: 13, color: COLORS.muted, fontFamily: FONTS.sans.medium },
  tagSection: { gap: 8 },
  tagSectionTitle: { fontSize: 12, color: COLORS.muted, fontFamily: FONTS.sans.semibold },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tagChipSelected: { backgroundColor: COLORS.accentSubtleFill, borderColor: COLORS.accentSubtleBorder },
  tagChipText: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  tagChipTextSelected: { color: COLORS.accent },
  notesInput: {
    minHeight: 60,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  notePrivacyRow: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notePrivacyTextWrap: {
    flex: 1,
    gap: 2,
  },
  notePrivacyLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
  },
  notePrivacyHint: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  errorText: { fontSize: 13, lineHeight: 18, color: '#8B4A4A', fontFamily: FONTS.sans.medium },
  successPointsText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.accent,
    fontFamily: FONTS.sans.semibold,
  },
  successHintText: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  submitButton: {
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accentSubtleBorder,
  },
  submitButtonDisabled: { opacity: 0.8 },
  submitButtonText: { color: '#ffffff', fontSize: 14, fontFamily: FONTS.sans.semibold, textAlign: 'center' },
});
