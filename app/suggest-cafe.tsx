import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { VenueTypePicker } from '@/components/VenueTypePicker';
import { DesktopWebPageContainer } from '@/components/layout/DesktopWebPageContainer';
import { StackHeaderBackButton } from '@/components/navigation/StackHeaderBackButton';
import { COLORS, FONTS } from '@/components/theme';
import {
  getMyCafeSubmissions,
  submitGooglePlacesCafeSuggestion,
  type CafeSubmissionStatus,
  type MyCafeSubmissionRow,
} from '@/lib/cafeSubmissions';
import {
  createPlacesSessionToken,
  fetchPlaceDetailsForSubmission,
  fetchPlacesTextSearch,
  getGooglePlacesApiKeyOrEmpty,
  placeHasValidCoordinates,
  type GooglePlaceDetailsForSubmission,
  type PlacesSearchListItem,
} from '@/lib/googlePlaces';
import { openExternalMapsUrl } from '@/lib/cafeMapsUrl';
import { useAuthRedirectIfNeeded } from '@/hooks/useAuthRedirectIfNeeded';
import { resolveSuggestCafeBackPath } from '@/lib/authGate';
import type { VenueTypeValue } from '@/lib/venueTypes';

const PLACES_SEARCH_DEBOUNCE_MS = 350;

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

/** File route options — ensures no native stack title when pushed from Search/tabs. */
export const options = {
  headerShown: false,
  title: '',
  headerTitle: '',
} as const;

export default function SuggestCafeScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    prefillName?: string | string[];
    initialSearch?: string | string[];
    fromVisitLog?: string | string[];
    cafeId?: string | string[];
    returnTo?: string | string[];
    source?: string | string[];
  }>();
  const fromVisitLog = (Array.isArray(params.fromVisitLog) ? params.fromVisitLog[0] : params.fromVisitLog) === '1';
  const routeCafeId = (Array.isArray(params.cafeId) ? params.cafeId[0] : params.cafeId) ?? '';
  const existingCafeId = String(routeCafeId).trim();
  const isExistingCafeFlow = fromVisitLog && existingCafeId.length > 0;
  /** Google Places create path — also used when Log Visit opens Suggest without a cafe id. */
  const showPlacesCreateFlow = !isExistingCafeFlow;
  const { authReady, authLoading } = useAuthRedirectIfNeeded('/suggest-cafe');
  const initialNameParam = Array.isArray(params.prefillName) ? params.prefillName[0] : params.prefillName;
  const initialName = (() => {
    const candidate = String(initialNameParam ?? '').trim();
    if (!candidate) return '';
    if (candidate.toLowerCase() === 'undefined' || candidate.toLowerCase() === 'null') return '';
    return candidate;
  })();
  const googlePlacesSeedQuery = useMemo(() => {
    const initialSearchParam = Array.isArray(params.initialSearch)
      ? params.initialSearch[0]
      : params.initialSearch;
    const s = String(initialSearchParam ?? '').trim();
    if (s && s.toLowerCase() !== 'undefined' && s.toLowerCase() !== 'null') return s;
    return initialName;
  }, [params.initialSearch, initialName]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<MyCafeSubmissionRow[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [suggestVenueType, setSuggestVenueType] = useState<VenueTypeValue | null>(null);
  const [venueTypeError, setVenueTypeError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  type PublicSuggestStep = 'places_search' | 'place_confirm' | 'beaned_extras';
  const [publicSuggestStep, setPublicSuggestStep] = useState<PublicSuggestStep>('places_search');
  const [placesSessionToken, setPlacesSessionToken] = useState(createPlacesSessionToken);
  const [placesQuery, setPlacesQuery] = useState(googlePlacesSeedQuery);
  const [placesSuggestions, setPlacesSuggestions] = useState<PlacesSearchListItem[]>([]);
  const [placesSearchLoading, setPlacesSearchLoading] = useState(false);
  const [placesSearchError, setPlacesSearchError] = useState<string | null>(null);
  const [placeDetailsLoading, setPlaceDetailsLoading] = useState(false);
  const [placeDetailsError, setPlaceDetailsError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<GooglePlaceDetailsForSubmission | null>(null);

  const hasPlacesApiKey = useMemo(() => getGooglePlacesApiKeyOrEmpty().length > 0, []);

  const rotatePlacesSession = useCallback(() => {
    setPlacesSessionToken(createPlacesSessionToken());
  }, []);

  useEffect(() => {
    if (!isExistingCafeFlow || !existingCafeId) return;
    router.replace(`/log-visit/${existingCafeId}` as never);
  }, [isExistingCafeFlow, existingCafeId, router]);

  useEffect(() => {
    if (!showPlacesCreateFlow) return;
    const s = googlePlacesSeedQuery.trim();
    if (s) setPlacesQuery(s);
  }, [showPlacesCreateFlow, googlePlacesSeedQuery]);

  useEffect(() => {
    if (!showPlacesCreateFlow || !hasPlacesApiKey) return;
    const q = placesQuery.trim();
    if (q.length < 2) {
      setPlacesSuggestions([]);
      setPlacesSearchError(null);
      setPlacesSearchLoading(false);
      return;
    }
    let cancelled = false;
    setPlacesSearchLoading(true);
    setPlacesSearchError(null);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const list = await fetchPlacesTextSearch(q);
          if (cancelled) return;
          setPlacesSuggestions(list);
        } catch (e) {
          if (cancelled) return;
          setPlacesSuggestions([]);
          setPlacesSearchError(e instanceof Error ? e.message : 'Search failed.');
        } finally {
          if (!cancelled) setPlacesSearchLoading(false);
        }
      })();
    }, PLACES_SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [showPlacesCreateFlow, hasPlacesApiKey, placesQuery]);

  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
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
    submitting ||
    redirecting ||
    publicSuggestStep !== 'beaned_extras' ||
    !selectedPlace ||
    suggestVenueType == null;

  const continueFromPreviewDisabled =
    submitting || redirecting || !selectedPlace || placeDetailsLoading;

  function resetPublicSuggest() {
    setPublicSuggestStep('places_search');
    setPlacesQuery(googlePlacesSeedQuery);
    setPlacesSuggestions([]);
    setPlacesSearchError(null);
    setPlaceDetailsError(null);
    setSelectedPlace(null);
    setPlacesSessionToken(createPlacesSessionToken());
  }

  function resetForm() {
    setSuggestVenueType(null);
    setVenueTypeError(null);
    resetPublicSuggest();
  }

  const suggestBackPath = resolveSuggestCafeBackPath({
    returnTo: params.returnTo,
    source: params.source,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
      title: '',
      headerTitle: '',
    });
  }, [navigation]);

  function handleBack() {
    if (showPlacesCreateFlow) {
      if (publicSuggestStep === 'beaned_extras') {
        setPublicSuggestStep('place_confirm');
        return;
      }
      if (publicSuggestStep === 'place_confirm') {
        setPublicSuggestStep('places_search');
        setSelectedPlace(null);
        setPlaceDetailsError(null);
        return;
      }
    }
    if (suggestBackPath) {
      router.replace(suggestBackPath as never);
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    router.replace('/(tabs)/profile');
  }

  async function pickPlaceFromSearchResult(item: PlacesSearchListItem) {
    if (!hasPlacesApiKey) return;
    setPlaceDetailsError(null);
    setPlaceDetailsLoading(true);
    try {
      const fallbackCoords =
        typeof item.latitude === 'number' &&
        Number.isFinite(item.latitude) &&
        typeof item.longitude === 'number' &&
        Number.isFinite(item.longitude)
          ? { latitude: item.latitude, longitude: item.longitude }
          : undefined;
      const details = await fetchPlaceDetailsForSubmission(
        item.placeId,
        placesSessionToken,
        fallbackCoords
      );
      rotatePlacesSession();
      setSelectedPlace(details);
      setPublicSuggestStep('place_confirm');
    } catch (e) {
      rotatePlacesSession();
      setPlaceDetailsError(e instanceof Error ? e.message : 'Could not load place details.');
    } finally {
      setPlaceDetailsLoading(false);
    }
  }

  function openExternalUrl(url: string) {
    void Linking.openURL(url);
  }

  function openGoogleMapsUrl(url: string) {
    void openExternalMapsUrl(url).catch(() => {
      Alert.alert('Cannot open link', 'This maps link could not be opened on your device.');
    });
  }

  async function handleSubmit() {
    setSubmitError(null);

    if (!showPlacesCreateFlow) return;

    if (!selectedPlace || publicSuggestStep !== 'beaned_extras') {
      setSubmitError('Select a place and continue to add details before submitting.');
      return;
    }
    if (suggestVenueType == null) {
      setVenueTypeError('Please choose a space type.');
      setSubmitError('Please choose what type of space this is.');
      return;
    }
    setVenueTypeError(null);
    if (!placeHasValidCoordinates(selectedPlace)) {
      setSubmitError(
        'This place is missing map coordinates from Google Places. Go back and choose it again.'
      );
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitGooglePlacesCafeSuggestion(selectedPlace, {
        venueType: suggestVenueType,
      });
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }

      router.replace({
        pathname: '/log-visit/[id]',
        params: {
          id: 'pending',
          submissionId: result.submissionId,
          name: selectedPlace.cafeName,
          area: selectedPlace.formattedAddress,
        },
      } as never);
      resetForm();
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !authReady) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.authLoading}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <DesktopWebPageContainer variant="form" style={styles.pageContainer}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(36, keyboardHeight + 32) }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentInset={{ bottom: Math.max(0, keyboardHeight) }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.backRow}>
            <StackHeaderBackButton canGoBack tintColor={COLORS.text} onPress={handleBack} />
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.pageTitle}>Suggest a Space</Text>
            <Text style={styles.pageSubtitle}>
              {publicSuggestStep === 'places_search'
                ? 'Search Google Places, confirm the space, then choose a workspace type.'
                : publicSuggestStep === 'place_confirm'
                  ? 'Check the details, then continue to choose a workspace type.'
                  : 'Choose the workspace type, then add your visit review — the same review flow as any other space.'}
            </Text>
          </View>

          {showPlacesCreateFlow ? (
            <>
              {!hasPlacesApiKey ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.tagHelperText}>
                    Add EXPO_PUBLIC_GOOGLE_PLACES_API_KEY to your environment and restart Expo. If it is already in your
                    project .env file, save the file (unsaved editor changes are not loaded) then run npx expo start
                    --clear.
                  </Text>
                </View>
              ) : null}

              {hasPlacesApiKey && publicSuggestStep === 'places_search' ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.fieldLabel}>Find the space</Text>
                  <Text style={styles.tagHelperText}>
                    Search by name plus area, street or postcode. Results are biased to London (not restricted).
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={placesQuery}
                    onChangeText={setPlacesQuery}
                    placeholder="e.g. Drupe Bethnal Green"
                    placeholderTextColor={COLORS.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {placesSearchError ? <Text style={styles.validationText}>{placesSearchError}</Text> : null}
                  {placeDetailsError ? <Text style={styles.validationText}>{placeDetailsError}</Text> : null}
                  {placesSearchLoading ? (
                    <View style={styles.placesLoaderRow}>
                      <ActivityIndicator color={COLORS.accent} />
                      <Text style={styles.placesLoaderLabel}>Searching…</Text>
                    </View>
                  ) : null}
                  {placeDetailsLoading ? (
                    <View style={styles.placesLoaderRow}>
                      <ActivityIndicator color={COLORS.accent} />
                      <Text style={styles.placesLoaderLabel}>Loading place…</Text>
                    </View>
                  ) : null}
                  <View style={styles.placesSuggestionsList}>
                    {placesSuggestions.map((item) => (
                      <TouchableOpacity
                        key={item.placeId}
                        style={styles.placesSuggestionRow}
                        onPress={() => void pickPlaceFromSearchResult(item)}
                        disabled={placeDetailsLoading}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.placesSuggestionTitle}>{item.title}</Text>
                        <Text style={styles.placesSuggestionSubtitle}>{item.subtitle}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {placesQuery.trim().length >= 2 &&
                  !placesSearchLoading &&
                  placesSuggestions.length === 0 &&
                  !placesSearchError ? (
                    <Text style={styles.tagHelperText}>
                      No strong matches found. Try adding the area, postcode or street name.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {hasPlacesApiKey && publicSuggestStep === 'place_confirm' && selectedPlace ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.fieldLabel}>Confirm</Text>
                  <Text style={styles.placesPreviewName}>{selectedPlace.cafeName}</Text>
                  <Text style={styles.placesPreviewAddress}>{selectedPlace.formattedAddress}</Text>
                  {selectedPlace.googleMapsUri ? (
                    <Pressable onPress={() => openGoogleMapsUrl(selectedPlace.googleMapsUri!)}>
                      <Text style={styles.placesLinkText}>Open in Google Maps</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.tagHelperText}>No Maps link returned for this place.</Text>
                  )}
                  {selectedPlace.websiteUri ? (
                    <Pressable onPress={() => openExternalUrl(selectedPlace.websiteUri!)}>
                      <Text style={styles.placesLinkText} numberOfLines={2}>
                        {selectedPlace.websiteUri}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.tagHelperText}>No website on file</Text>
                  )}
                  {selectedPlace.nationalPhoneNumber ? (
                    <Text style={styles.mutedText}>{selectedPlace.nationalPhoneNumber}</Text>
                  ) : (
                    <Text style={styles.tagHelperText}>No phone on file</Text>
                  )}
                </View>
              ) : null}

              {hasPlacesApiKey && publicSuggestStep === 'beaned_extras' ? (
                <View style={styles.sectionCard}>
                  <VenueTypePicker
                    value={suggestVenueType}
                    onChange={(next) => {
                      setSuggestVenueType(next);
                      setVenueTypeError(null);
                    }}
                    disabled={submitting || redirecting}
                    error={venueTypeError}
                  />
                  <Text style={styles.tagHelperText}>
                    Next you&apos;ll add your visit review — Work Score, highlights, photos, and more — just like
                    reviewing any existing space.
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.sectionCard}>
              <ActivityIndicator color={COLORS.accent} />
              <Text style={styles.tagHelperText}>Opening review…</Text>
            </View>
          )}

          {submitError ? (
            <View style={styles.feedbackBannerError}>
              <Text style={styles.feedbackErrorText}>{submitError}</Text>
            </View>
          ) : null}

          {showPlacesCreateFlow &&
          hasPlacesApiKey &&
          publicSuggestStep === 'place_confirm' ? (
            <TouchableOpacity
              activeOpacity={0.88}
              style={[styles.submitButton, continueFromPreviewDisabled && styles.submitButtonDisabled]}
              onPress={() => setPublicSuggestStep('beaned_extras')}
              disabled={continueFromPreviewDisabled}
            >
              {placeDetailsLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          ) : showPlacesCreateFlow && publicSuggestStep === 'beaned_extras' ? (
            <TouchableOpacity
              activeOpacity={0.88}
              style={[styles.submitButton, submitDisabled && styles.submitButtonDisabled]}
              onPress={() => void handleSubmit()}
              disabled={submitDisabled}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Continue to review</Text>
              )}
            </TouchableOpacity>
          ) : null}

          {showPlacesCreateFlow ? (
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 36,
    gap: 16,
  },
  backRow: {
    alignSelf: 'stretch',
    marginBottom: 4,
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
  notePrivacyRow: {
    marginTop: 8,
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
  visitRatingValue: {
    fontSize: 19,
    lineHeight: 24,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
  },
  suggestRatingSliderBlock: {
    gap: 8,
  },
  suggestRatingSliderMetaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  suggestRatingSliderHint: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  suggestClearRating: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  suggestClearRatingText: {
    fontSize: 13,
    color: COLORS.accent,
    fontFamily: FONTS.sans.semibold,
  },
  submitButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.75,
  },
  submitButtonText: {
    color: COLORS.buttonLabelOnAccent,
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
  placesLoaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  placesLoaderLabel: {
    fontSize: 14,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  placesSuggestionsList: {
    gap: 0,
  },
  placesSuggestionRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  placesSuggestionTitle: {
    fontSize: 16,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
  },
  placesSuggestionSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
  },
  placesPreviewName: {
    fontSize: 18,
    fontFamily: FONTS.display.semibold,
    color: COLORS.text,
  },
  placesPreviewAddress: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONTS.sans.regular,
    color: COLORS.text,
  },
  placesLinkText: {
    fontSize: 14,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.accent,
    alignSelf: 'flex-start',
  },
});
