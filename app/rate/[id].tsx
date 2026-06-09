import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Keyboard,
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

import { COLORS, FONTS } from '@/components/theme';
import { useCafeState } from '@/contexts/CafeStateContext';
import { type Cafe } from '@/data/cafes';
import { resolveLiveCafePrimaryImageUrl } from '@/lib/cafeLiveImages';
import { fetchCafeByIdFromSupabase } from '@/lib/cafeCatalogSupabase';
import { DesktopWebPageContainer } from '@/components/layout/DesktopWebPageContainer';
import { CoffeeRatingPicker } from '@/components/CoffeeRatingPicker';
import { EditorialTag } from '@/components/EditorialTag';
import { CafeFlowHeaderCard } from '@/components/visit/CafeFlowHeaderCard';
import { VisitPhotosSection } from '@/components/visit/VisitPhotosSection';
import { ALL_RATING_TAGS, TAG_SECTIONS } from '@/lib/cafeTags';
import { submitCafePhoto } from '@/lib/cafePhotoSubmissions';
import { quantizeCoffeeRatingForStorage } from '@/lib/coffeeRating';
import { useAuthRedirectIfNeeded } from '@/hooks/useAuthRedirectIfNeeded';
import { getUserCoffeeRating, rateCafe } from '@/lib/supabase';

function rateDebug(label: string, payload: Record<string, unknown>) {
  if (!__DEV__) return;
  try {
    console.log(`[RATE DEBUG] ${label}\n${JSON.stringify(payload, null, 2)}`);
  } catch {
    console.log(`[RATE DEBUG] ${label}`, payload);
  }
}

export default function RateCafeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const { setCafeRating, getCafeRating } = useCafeState();
  const cafeId = Array.isArray(id) ? id[0] : id;
  const targetCafeId = cafeId ?? '1';
  const { authReady, authLoading } = useAuthRedirectIfNeeded(`/rate/${targetCafeId}`);
  const [cafe, setCafe] = useState<Cafe | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const row = await fetchCafeByIdFromSupabase(String(targetCafeId));
      if (!cancelled) setCafe(row);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetCafeId]);

  const existingRating = getCafeRating(targetCafeId);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    router.replace(`/cafe/${targetCafeId}`);
  }, [navigation, router, targetCafeId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
      title: cafe?.name ? `Rate · ${cafe.name}` : 'Rate Cafe',
    });
  }, [cafe?.name, navigation]);

  const [coffeeScore, setCoffeeScore] = useState<number | null>(() => {
    if (typeof existingRating?.coffee === 'number' && existingRating.coffee > 0) {
      return quantizeCoffeeRatingForStorage(existingRating.coffee);
    }
    return null;
  });
  const [selectedTags, setSelectedTags] = useState<string[]>(
    (existingRating?.tags ?? []).filter((tag) =>
      ALL_RATING_TAGS.includes(tag as (typeof ALL_RATING_TAGS)[number])
    )
  );
  const [notes, setNotes] = useState(existingRating?.notes ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [visitPhotoPreviewUri, setVisitPhotoPreviewUri] = useState<string | null>(null);
  const scrollRef = React.useRef<ScrollView>(null);
  const [notesSectionY, setNotesSectionY] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadPreviousRating() {
      const numericCafeId = Number.parseInt(targetCafeId, 10);
      if (!Number.isFinite(numericCafeId)) return;

      const prev = await getUserCoffeeRating(numericCafeId);
      if (cancelled || prev === null) return;

      if (coffeeScore != null) return;
      if (existingRating) return;

      setCoffeeScore(prev);
    }

    void loadPreviousRating();
    return () => {
      cancelled = true;
    };
  }, [targetCafeId, existingRating, coffeeScore]);

  const hasAnyRating = coffeeScore != null && coffeeScore >= 1;

  const submitDisabled = !hasAnyRating || submitted || submitting;

  React.useEffect(() => {
    if (!submitted) return;
    const t = setTimeout(() => {
      router.replace(`/cafe/${targetCafeId}`);
    }, 2000);
    return () => clearTimeout(t);
  }, [submitted, targetCafeId, router]);

  React.useEffect(() => {
    if (!__DEV__) return;
    rateDebug('submit button state', {
      platform: Platform.OS,
      hasAnyRating,
      submitted,
      submitDisabled,
      coffeeScore,
      targetCafeId,
    });
  }, [hasAnyRating, submitted, submitDisabled, coffeeScore, targetCafeId]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((item) => item !== tag);
      return [...prev, tag];
    });
  }

  async function handleAddPhoto() {
    if (photoUploading) return;

    setPhotoError(null);
    setPhotoSuccess(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError('Please allow photo library access to submit a photo.');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.86,
    });

    if (pickerResult.canceled) {
      return;
    }

    const asset = pickerResult.assets?.[0];
    if (!asset?.uri) {
      setPhotoError('No image selected. Please try again.');
      return;
    }

    setVisitPhotoPreviewUri(asset.uri);
    setPhotoUploading(true);
    try {
      const uploadResult = await submitCafePhoto({
        cafeId: targetCafeId,
        asset: {
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileName: asset.fileName,
        },
      });
      if (!uploadResult.ok) {
        setPhotoError(uploadResult.error);
        return;
      }
      setPhotoSuccess('Your visit photo was submitted for review.');
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleSubmit() {
    rateDebug('handleSubmit invoked', {
      platform: Platform.OS,
      targetCafeId,
      coffeeScore,
      submitDisabledExpected: !hasAnyRating || submitted,
    });

    const ratingData = {
      coffee: coffeeScore ?? 0,
      tags: selectedTags,
      notes: notes.trim(),
    };

    rateDebug('computed payload', {
      ...ratingData,
      coffeeRatingSentToRatings: coffeeScore,
    });

    if (!hasAnyRating) {
      rateDebug('early exit: validation', {
        reason: 'no dimension > 0 — submit should have been disabled',
      });
      return;
    }
    if (submitted) {
      rateDebug('early exit: already submitted', {});
      return;
    }
    if (submitting) {
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      rateDebug('calling rateCafe', { targetCafeId });
      const rateRes = await rateCafe(targetCafeId, {
        coffee: coffeeScore ?? 0,
        tags: selectedTags,
        notes: notes.trim(),
      });
      rateDebug('rateCafe result', { ok: rateRes.ok, error: rateRes.ok ? null : rateRes.error });
      if (!rateRes.ok) {
        throw new Error(rateRes.error);
      }

      rateDebug('calling setCafeRating (context refresh)', { targetCafeId });
      await setCafeRating(targetCafeId, ratingData);
      setSubmitted(true);
      rateDebug('submit success', { targetCafeId });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Your rating could not be saved. Try again.';
      rateDebug('submit error', { message });
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const ratePreviewPhoto = cafe ? resolveLiveCafePrimaryImageUrl({ cafe }) : undefined;
  const visitPhotoPreviews = visitPhotoPreviewUri
    ? [{ uri: visitPhotoPreviewUri, key: 'visit-upload' }]
    : [];

  /** Full street address when catalog has it; else area/neighborhood. */
  const rateLocationLine =
    (cafe?.addressLine && cafe.addressLine.trim().length > 0
      ? cafe.addressLine.trim()
      : cafe?.neighborhood?.trim()) || 'Neighborhood';

  if (authLoading || !authReady) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.authLoading}>
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.heroBackRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.heroBackHit}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(32, keyboardHeight + 40) },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentInset={{ bottom: Math.max(0, keyboardHeight) }}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={styles.titleBlock}>
            <Text style={styles.pageTitle}>Rate this cafe</Text>
            <Text style={styles.pageSubtitle}>Help others find great cafes</Text>
          </View>

        <CafeFlowHeaderCard
          name={cafe?.name ?? 'Cafe'}
          subtitle={rateLocationLine}
          imageUri={ratePreviewPhoto}
        />

        <VisitPhotosSection
          photos={visitPhotoPreviews}
          maxPhotos={1}
          onPressAdd={() => void handleAddPhoto()}
          onPressRemove={() => {
            setVisitPhotoPreviewUri(null);
            setPhotoSuccess(null);
            setPhotoError(null);
          }}
          uploading={photoUploading}
          disabled={submitting || submitted}
          error={photoError}
          success={photoSuccess}
        />

        <View style={styles.sectionCard}>
          <CoffeeRatingPicker
            value={coffeeScore}
            onChange={setCoffeeScore}
            disabled={submitting || submitted}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>What stood out?</Text>
          {TAG_SECTIONS.map((section) => (
            <View key={section.title} style={styles.tagSection}>
              <Text style={styles.tagSectionTitle}>{section.title}</Text>
              <View style={styles.tagsWrap}>
                {section.tags.map((tag) => (
                  <EditorialTag
                    key={tag}
                    tag={tag}
                    variant="selectable"
                    selected={selectedTags.includes(tag)}
                    onPress={() => toggleTag(tag)}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>

        <View
          style={styles.sectionCard}
          onLayout={(e) => {
            setNotesSectionY(e.nativeEvent.layout.y);
          }}
        >
          <Text style={styles.sectionTitle}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Anything to note?"
            placeholderTextColor={COLORS.muted}
            multiline
            textAlignVertical="top"
            numberOfLines={2}
            maxLength={180}
            value={notes}
            onChangeText={setNotes}
            onFocus={() => {
              const targetY = Math.max(0, notesSectionY - 20);
              setTimeout(() => {
                scrollRef.current?.scrollTo({ y: targetY, animated: true });
              }, 60);
            }}
          />
        </View>

        {submitError ? (
          <View style={styles.feedbackBanner} accessibilityLiveRegion="polite">
            <Text style={styles.feedbackErrorText}>{submitError}</Text>
          </View>
        ) : null}

        {submitted ? (
          <View style={styles.feedbackBannerSuccess} accessibilityLiveRegion="polite">
            <Text style={styles.feedbackSuccessTitle}>Rating saved</Text>
            <Text style={styles.feedbackSuccessSub}>Returning to the cafe page…</Text>
          </View>
        ) : null}

          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.submitButton,
              submitDisabled && styles.submitButtonDisabled,
              submitted && styles.submitButtonSuccess,
            ]}
            onPress={() => void handleSubmit()}
            disabled={submitDisabled}
          >
            <Text style={styles.submitButtonText}>
              {submitted ? 'Rating saved' : submitting ? 'Saving…' : 'Submit'}
            </Text>
          </TouchableOpacity>
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
  authLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  heroBackRow: {
    alignSelf: 'stretch',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  heroBackHit: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 20,
  },
  titleBlock: {
    gap: 8,
    marginBottom: 2,
  },
  pageTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
    letterSpacing: -0.1,
  },

  sectionCard: {
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  ratingPrompt: {
    fontSize: 15,
    fontFamily: FONTS.sans.medium,
    color: COLORS.text,
    letterSpacing: -0.1,
    marginBottom: 2,
  },

  ratingRowsWrap: {
    marginTop: 4,
  },
  ratingSliderBlock: {
    gap: 10,
  },
  ratingSliderMetaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  ratingSliderValue: {
    fontSize: 28,
    fontFamily: FONTS.sans.bold,
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  ratingSliderHint: {
    fontSize: 14,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
  },
  notesInput: {
    minHeight: 68,
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
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  tagSection: {
    gap: 8,
  },
  tagSectionTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.2,
  },
  feedbackBanner: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(180, 80, 80, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(180, 80, 80, 0.28)',
  },
  feedbackErrorText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#8B4A4A',
    textAlign: 'center',
  },
  feedbackBannerSuccess: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(163, 177, 138, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(163, 177, 138, 0.45)',
    gap: 4,
  },
  feedbackSuccessTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A5A49',
    textAlign: 'center',
  },
  feedbackSuccessSub: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5F6B58',
    textAlign: 'center',
  },
  submitButton: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accent,
    marginTop: 2,
  },
  submitButtonDisabled: {
    opacity: 0.88,
  },
  submitButtonSuccess: {
    backgroundColor: 'rgba(163, 177, 138, 0.45)',
    borderColor: 'rgba(163, 177, 138, 0.8)',
  },
  submitButtonText: {
    color: COLORS.buttonLabelOnAccent,
    fontSize: 14,
    fontFamily: FONTS.sans.semibold,
    textAlign: 'center',
  },
});

