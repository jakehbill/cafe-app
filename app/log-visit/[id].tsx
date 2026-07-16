import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

import { DesktopWebPageContainer } from '@/components/layout/DesktopWebPageContainer';
import { CoffeeRatingPicker } from '@/components/CoffeeRatingPicker';
import { OptionChipGroup } from '@/components/review/OptionChipGroup';
import { CafeFlowHeaderCard } from '@/components/visit/CafeFlowHeaderCard';
import { VisitPhotosSection } from '@/components/visit/VisitPhotosSection';
import { StackHeaderBackButton } from '@/components/navigation/StackHeaderBackButton';
import { COLORS, FONTS } from '@/components/theme';
import { useCafeState } from '@/contexts/CafeStateContext';
import { type Cafe } from '@/data/cafes';
import { fetchCafeByIdFromSupabase } from '@/lib/cafeCatalogSupabase';
import { resolveLiveCafePrimaryImageUrl } from '@/lib/cafeLiveImages';
import { normalizeCoffeeRatingInput } from '@/lib/coffeeRating';
import { useAuthRedirectIfNeeded } from '@/hooks/useAuthRedirectIfNeeded';
import {
  getUserCafeVisitById,
  saveUserCafeVisit,
  updateUserCafeVisit,
  type VisitPhotoAsset,
} from '@/lib/userCafeVisits';
import { MAX_VISIT_PHOTOS, VISIT_PHOTO_MAX_MESSAGE } from '@/lib/visitPhotoLimits';
import { pickVisitPhotoFromLibrary } from '@/lib/visitPhotoPicker';
import {
  COST_TO_WORK_OPTIONS,
  QUALITY_OPTIONS,
  SEAT_FINDING_OPTIONS,
  STAY_DURATION_OPTIONS,
  WIFI_RELIABILITY_OPTIONS,
  WORKSPACE_REVIEW_TAGS,
  type CostToWorkValue,
  type QualityValue,
  type SeatFindingValue,
  type StayDurationValue,
  type WifiReliabilityValue,
} from '@/lib/workReview';

export default function LogVisitScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id, visitId } = useLocalSearchParams<{ id?: string | string[]; visitId?: string | string[] }>();
  const cafeId = Array.isArray(id) ? id[0] : id;
  const editingVisitId = Array.isArray(visitId) ? visitId[0] : visitId;
  const targetCafeId = cafeId ?? '';
  const visitReturnTo = editingVisitId
    ? `/log-visit/${targetCafeId}?visitId=${encodeURIComponent(editingVisitId)}`
    : `/log-visit/${targetCafeId}`;
  const { authReady, authLoading } = useAuthRedirectIfNeeded(visitReturnTo);
  const { isSaved } = useCafeState();
  const guessedCafeName = decodeURIComponent(targetCafeId).replace(/[-_]+/g, ' ').trim();

  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [stayDuration, setStayDuration] = useState<StayDurationValue | null>(null);
  const [costToWork, setCostToWork] = useState<CostToWorkValue | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [wifiReliability, setWifiReliability] = useState<WifiReliabilityValue | null>(null);
  const [seatFinding, setSeatFinding] = useState<SeatFindingValue | null>(null);
  const [coffeeQuality, setCoffeeQuality] = useState<QualityValue | null>(null);
  const [foodQuality, setFoodQuality] = useState<QualityValue | null>(null);
  const [note, setNote] = useState('');
  const [existingPhotoPreviews, setExistingPhotoPreviews] = useState<{ uri: string; key: string }[]>([]);
  const [newPhotoAssets, setNewPhotoAssets] = useState<VisitPhotoAsset[]>([]);
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
    if (!targetCafeId) return;
    let cancelled = false;
    void (async () => {
      const row = await fetchCafeByIdFromSupabase(targetCafeId);
      if (!cancelled) {
        setCafe(row);
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
      setRating(normalizeCoffeeRatingInput(existing.rating));
      setStayDuration(existing.stayDuration);
      setCostToWork(existing.costToWork);
      setSelectedTags(existing.tags);
      setWifiReliability(existing.wifiReliability);
      setSeatFinding(existing.busyness);
      setCoffeeQuality(existing.coffeeQuality);
      setFoodQuality(existing.foodQuality);
      setNote(existing.note);
      setExistingPendingName(existing.submissionCafeName);
      setExistingPhotoPreviews(
        existing.imageUrls.map((uri, index) => ({
          uri,
          key: `existing-${index}`,
        }))
      );
      setNewPhotoAssets([]);
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

  const totalPhotoCount = existingPhotoPreviews.length + newPhotoAssets.length;

  async function handlePickPhoto() {
    if (totalPhotoCount >= MAX_VISIT_PHOTOS) {
      setError(VISIT_PHOTO_MAX_MESSAGE);
      return;
    }
    setError(null);
    try {
      const asset = await pickVisitPhotoFromLibrary();
      if (!asset) return;
      if (totalPhotoCount >= MAX_VISIT_PHOTOS) {
        setError(VISIT_PHOTO_MAX_MESSAGE);
        return;
      }
      setNewPhotoAssets((prev) => [...prev, asset]);
    } catch (pickError) {
      setError(pickError instanceof Error ? pickError.message : 'Could not add photo.');
    }
  }

  function handleRemovePhoto(index: number) {
    if (index < existingPhotoPreviews.length) return;
    const newIndex = index - existingPhotoPreviews.length;
    setNewPhotoAssets((prev) => prev.filter((_, i) => i !== newIndex));
    setError(null);
  }

  function validateRequired(): string | null {
    if (rating == null) return 'Please add a Work Score (1–10).';
    if (!stayDuration) return 'Please choose how long you could work here.';
    if (selectedTags.length === 0) return 'Please select at least one thing that stood out.';
    return null;
  }

  async function handleSaveVisit() {
    if ((!targetCafeId && !editingVisitId) || saving) return;
    const validationError = validateRequired();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        rating,
        tags: selectedTags,
        note,
        stayDuration,
        costToWork,
        wifiReliability,
        busyness: seatFinding,
        coffeeQuality,
        foodQuality,
        photoAssets: newPhotoAssets,
      };
      const res = editingVisitId
        ? await updateUserCafeVisit(editingVisitId, payload)
        : await saveUserCafeVisit({
            cafeId: targetCafeId,
            ...payload,
          });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const movedFromSaved = !editingVisitId && Boolean(targetCafeId) && isSaved(targetCafeId);
      if (!editingVisitId) {
        setSuccessState({ movedFromSaved, hadPhoto: totalPhotoCount > 0 });
      } else {
        router.replace('/my-cafes');
      }
    } finally {
      setSaving(false);
    }
  }

  const cafeListingImageUri = useMemo(() => {
    if (!cafe) return undefined;
    return resolveLiveCafePrimaryImageUrl({ cafe });
  }, [cafe]);
  const visitPhotoPreviews = useMemo(
    () => [
      ...existingPhotoPreviews,
      ...newPhotoAssets.map((asset, index) => ({
        uri: asset.uri,
        key: `new-${index}`,
      })),
    ],
    [existingPhotoPreviews, newPhotoAssets]
  );
  const canRenderVisitForm = Boolean(targetCafeId) || Boolean(cafe) || Boolean(editingVisitId);
  const workspaceTagOptions = useMemo(
    () => WORKSPACE_REVIEW_TAGS.map((t) => ({ value: t.slug, label: t.label })),
    []
  );

  function openSuggestPrefilled() {
    router.push({
      pathname: '/suggest-cafe',
      params: {
        prefillName: guessedCafeName,
        fromVisitLog: '1',
        visitRating: rating != null ? String(rating) : '',
        visitTags: selectedTags.join(','),
        visitNote: note,
        visitPhotoUri: newPhotoAssets[0]?.uri ?? '',
        visitPhotoMimeType: newPhotoAssets[0]?.mimeType ?? '',
        visitPhotoFileName: newPhotoAssets[0]?.fileName ?? '',
      },
    });
  }

  React.useEffect(() => {
    console.log('cafeId:', cafeId ?? '');
    console.log('flow type:', cafeId ? 'existing' : 'new');
    if (successState || editingVisitId) return;
    if (cafeId) return;
    setRedirectingMissingCafe(true);
    openSuggestPrefilled();
  }, [successState, editingVisitId, cafeId]);

  if (authLoading || !authReady) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <DesktopWebPageContainer variant="form" style={styles.pageContainer}>
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
                    ? 'Moved from Saved Spaces to Spaces You\'ve Worked From.'
                    : "Added to Spaces You've Worked From."}
                </Text>
                <Text style={styles.successProgressText}>
                  Logged. Your Beaned progress has been updated.
                </Text>
                {successState.hadPhoto ? (
                  <Text style={styles.successHintText}>Your photos have been submitted for review.</Text>
                ) : null}
                {successState.movedFromSaved ? (
                  <Text style={styles.successHintText}>Moved to Spaces You&apos;ve Worked From</Text>
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
                    <Text style={styles.secondaryButtonText}>Back to space</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.photoButton, styles.secondaryButton]}
                  onPress={() => router.replace('/')}
                >
                  <Text style={styles.secondaryButtonText}>Find another space</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {!successState ? (
              <View style={styles.titleBlock}>
                <Text style={styles.pageTitle}>{editingVisitId ? 'Edit review' : 'Log workspace'}</Text>
                <Text style={styles.pageSubtitle}>
                  Quick taps — help someone decide if they should work here today.
                </Text>
              </View>
            ) : null}

            {!successState && !canRenderVisitForm ? (
              <View style={styles.sectionCard}>
                <ActivityIndicator color={COLORS.accent} />
                <Text style={styles.pageSubtitle}>
                  {redirectingMissingCafe ? 'Opening Log a space flow...' : 'Loading space...'}
                </Text>
              </View>
            ) : null}

            {!successState && canRenderVisitForm ? (
              <CafeFlowHeaderCard
                name={cafe?.name ?? existingPendingName ?? 'Space'}
                subtitle={cafe?.neighborhood ?? 'Neighborhood'}
                imageUri={cafeListingImageUri}
              />
            ) : null}

            {!successState && canRenderVisitForm ? (
              <View style={styles.sectionCard}>
                <CoffeeRatingPicker
                  value={rating}
                  onChange={setRating}
                  disabled={saving}
                  showClear={false}
                />
              </View>
            ) : null}

            {!successState && canRenderVisitForm ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>⏱️ Work Session</Text>
                <Text style={styles.sectionHint}>How long could you comfortably work here?</Text>
                <OptionChipGroup
                  options={STAY_DURATION_OPTIONS}
                  value={stayDuration}
                  disabled={saving}
                  onChange={(next) => setStayDuration(next as StayDurationValue | null)}
                />
              </View>
            ) : null}

            {!successState && canRenderVisitForm ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>✨ What stood out?</Text>
                <Text style={styles.sectionHint}>Tap anything that fits today</Text>
                <OptionChipGroup
                  options={workspaceTagOptions}
                  value={selectedTags}
                  multi
                  disabled={saving}
                  onChange={(next) => setSelectedTags(next as string[])}
                />
              </View>
            ) : null}

            {!successState && canRenderVisitForm ? (
              <View style={styles.sectionCard}>
                <Text style={styles.optionalEyebrow}>Optional</Text>
                <Text style={styles.sectionTitle}>📶 Wi-Fi</Text>
                <Text style={styles.sectionHint}>How reliable was it?</Text>
                <OptionChipGroup
                  options={WIFI_RELIABILITY_OPTIONS}
                  value={wifiReliability}
                  disabled={saving}
                  onChange={(next) => setWifiReliability(next as WifiReliabilityValue | null)}
                />
                <Text style={[styles.sectionTitle, styles.quickFollowUp]}>👥 Finding a Seat</Text>
                <Text style={styles.sectionHint}>How easy was it to find a seat?</Text>
                <OptionChipGroup
                  options={SEAT_FINDING_OPTIONS}
                  value={seatFinding}
                  disabled={saving}
                  onChange={(next) => setSeatFinding(next as SeatFindingValue | null)}
                />
                <Text style={[styles.sectionTitle, styles.quickFollowUp]}>💰 Cost to Work</Text>
                <Text style={styles.sectionHint}>
                  What would someone typically spend to work here comfortably for a few hours?
                </Text>
                <OptionChipGroup
                  options={COST_TO_WORK_OPTIONS}
                  value={costToWork}
                  disabled={saving}
                  onChange={(next) => setCostToWork(next as CostToWorkValue | null)}
                />
                <Text style={[styles.sectionTitle, styles.quickFollowUp]}>☕ Coffee</Text>
                <Text style={styles.sectionHint}>How was the coffee?</Text>
                <OptionChipGroup
                  options={QUALITY_OPTIONS}
                  value={coffeeQuality}
                  disabled={saving}
                  onChange={(next) => setCoffeeQuality(next as QualityValue | null)}
                />
                <Text style={[styles.sectionTitle, styles.quickFollowUp]}>🍔 Food</Text>
                <Text style={styles.sectionHint}>How was the food?</Text>
                <OptionChipGroup
                  options={QUALITY_OPTIONS}
                  value={foodQuality}
                  disabled={saving}
                  onChange={(next) => setFoodQuality(next as QualityValue | null)}
                />
                <Text style={[styles.sectionTitle, styles.quickFollowUp]}>💬 Notes</Text>
                <Text style={styles.sectionHint}>Anything other remote workers should know?</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Noise, seating quirks, best hours…"
                  placeholderTextColor={COLORS.muted}
                  numberOfLines={2}
                  multiline
                  maxLength={180}
                  value={note}
                  onChangeText={setNote}
                />
              </View>
            ) : null}

            {!successState && canRenderVisitForm ? (
              <VisitPhotosSection
                photos={visitPhotoPreviews}
                onPressAdd={() => void handlePickPhoto()}
                onPressRemove={handleRemovePhoto}
                disabled={saving || loadingExisting}
                error={error && totalPhotoCount >= MAX_VISIT_PHOTOS ? error : null}
              />
            ) : null}

            {!successState && error ? <Text style={styles.errorText}>{error}</Text> : null}

            {!successState && canRenderVisitForm ? (
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={() => void handleSaveVisit()}
                disabled={saving || loadingExisting}
              >
                <Text style={styles.submitButtonText}>
                  {saving ? 'Saving…' : editingVisitId ? 'Save changes' : 'Save review'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </DesktopWebPageContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  keyboardAvoid: { flex: 1 },
  heroBackRow: { marginBottom: 8, paddingHorizontal: 20 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 36, gap: 16 },
  titleBlock: { gap: 8 },
  pageTitle: { fontSize: 28, lineHeight: 34, fontFamily: FONTS.display.bold, color: COLORS.text },
  pageSubtitle: { fontSize: 14, lineHeight: 20, color: COLORS.muted, fontFamily: FONTS.sans.regular },
  sectionCard: {
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 13, fontFamily: FONTS.sans.semibold, color: COLORS.text, lineHeight: 18 },
  sectionHint: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
    marginTop: -6,
  },
  optionalEyebrow: {
    fontSize: 11,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  quickFollowUp: {
    marginTop: 8,
  },
  photoButton: {
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: COLORS.background,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    textAlign: 'center',
  },
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
  errorText: { fontSize: 13, lineHeight: 18, color: '#8B4A4A', fontFamily: FONTS.sans.medium },
  successProgressText: {
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
    borderColor: COLORS.accent,
  },
  submitButtonDisabled: { opacity: 0.8 },
  submitButtonText: {
    color: COLORS.buttonLabelOnAccent,
    fontSize: 14,
    fontFamily: FONTS.sans.semibold,
    textAlign: 'center',
  },
});
