import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';
import {
  ActivityIndicator,
  Image,
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

import { TagWithOptionalIcon } from '@/components/TagWithOptionalIcon';
import { StackHeaderBackButton } from '@/components/navigation/StackHeaderBackButton';
import { COLORS, FONTS } from '@/components/theme';
import { TAG_SECTIONS } from '@/lib/cafeTags';
import {
  createCafeSuggestionWithId,
  getMyCafeSubmissions,
  isValidOptionalUrl,
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
import { uploadSubmissionPhotos } from '@/lib/cafeSubmissionPhotos';
import { saveUserCafeVisit } from '@/lib/userCafeVisits';

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

/** Same behaviour as `app/rate/[id].tsx` coffee slider (half steps 1–5). */
function SuggestCoffeeRatingSlider({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rating: number) => void;
}) {
  const current = value ?? 3;
  return (
    <View style={styles.suggestRatingSliderBlock}>
      <View style={styles.suggestRatingSliderMetaRow}>
        <Text style={styles.visitRatingValue}>
          {value == null ? 'Not rated' : `${value.toFixed(1)} / 5`}
        </Text>
        <Text style={styles.suggestRatingSliderHint}>out of 5</Text>
      </View>
      <Slider
        value={current}
        onValueChange={onChange}
        minimumValue={1}
        maximumValue={5}
        step={0.5}
        minimumTrackTintColor={COLORS.accent}
        maximumTrackTintColor="rgba(92, 86, 80, 0.22)"
        thumbTintColor={COLORS.accent}
        accessibilityLabel="Coffee rating slider"
      />
    </View>
  );
}

export default function SuggestCafeScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    prefillName?: string | string[];
    initialSearch?: string | string[];
    fromVisitLog?: string | string[];
    cafeId?: string | string[];
    visitRating?: string | string[];
    visitTags?: string | string[];
    visitNote?: string | string[];
    visitPhotoUri?: string | string[];
    visitPhotoMimeType?: string | string[];
    visitPhotoFileName?: string | string[];
  }>();
  const fromVisitLog = (Array.isArray(params.fromVisitLog) ? params.fromVisitLog[0] : params.fromVisitLog) === '1';
  const routeCafeId = (Array.isArray(params.cafeId) ? params.cafeId[0] : params.cafeId) ?? '';
  const existingCafeId = String(routeCafeId).trim();
  const isExistingCafeFlow = fromVisitLog && existingCafeId.length > 0;
  const isMissingCafeFlow = fromVisitLog && !isExistingCafeFlow;
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
  const initialVisitRatingRaw = Array.isArray(params.visitRating) ? params.visitRating[0] : params.visitRating;
  const initialVisitTagsRaw = Array.isArray(params.visitTags) ? params.visitTags[0] : params.visitTags;
  const initialVisitNote = Array.isArray(params.visitNote) ? params.visitNote[0] : params.visitNote;
  const initialVisitPhotoUri = Array.isArray(params.visitPhotoUri) ? params.visitPhotoUri[0] : params.visitPhotoUri;
  const initialVisitPhotoMimeType = Array.isArray(params.visitPhotoMimeType)
    ? params.visitPhotoMimeType[0]
    : params.visitPhotoMimeType;
  const initialVisitPhotoFileName = Array.isArray(params.visitPhotoFileName)
    ? params.visitPhotoFileName[0]
    : params.visitPhotoFileName;
  const [cafeName, setCafeName] = useState(initialName);
  const [area, setArea] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [visitRating, setVisitRating] = useState<number | null>(
    Number.isFinite(Number(initialVisitRatingRaw)) ? Number(initialVisitRatingRaw) : null
  );
  const [visitTags, setVisitTags] = useState<string[]>(
    String(initialVisitTagsRaw ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  );
  const [visitNote, setVisitNote] = useState(String(initialVisitNote ?? ''));
  const [visitPhoto, setVisitPhoto] = useState<{
    uri: string;
    mimeType?: string | null;
    fileName?: string | null;
  } | null>(
    initialVisitPhotoUri
      ? {
          uri: initialVisitPhotoUri,
          mimeType: initialVisitPhotoMimeType ?? null,
          fileName: initialVisitPhotoFileName ?? null,
        }
      : null
  );
  const [visitFlowStep, setVisitFlowStep] = useState<1 | 2>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [visitLogSuccessState, setVisitLogSuccessState] = useState<{
    hadPhoto: boolean;
    pendingReview: boolean;
  } | null>(null);
  const [mySubmissions, setMySubmissions] = useState<MyCafeSubmissionRow[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [selectedPhotos, setSelectedPhotos] = useState<({
    uri: string;
    mimeType?: string | null;
    fileName?: string | null;
  } | null)[]>([null, null, null]);
  const [suggestCoffeeRating, setSuggestCoffeeRating] = useState<number | null>(null);
  const redirectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [experienceInputY, setExperienceInputY] = useState(0);

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
    if (fromVisitLog) return;
    const s = googlePlacesSeedQuery.trim();
    if (s) setPlacesQuery(s);
  }, [fromVisitLog, googlePlacesSeedQuery]);

  useEffect(() => {
    if (fromVisitLog || !hasPlacesApiKey) return;
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
  }, [fromVisitLog, hasPlacesApiKey, placesQuery]);

  const visitTagSections = useMemo(() => TAG_SECTIONS.slice(0, 3), []);

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

  const submitDisabled = isExistingCafeFlow
    ? submitting || redirecting
    : fromVisitLog
      ? submitting || redirecting || !cafeName.trim() || !isValidOptionalUrl(googleMapsUrl)
      : submitting || redirecting || publicSuggestStep !== 'beaned_extras' || !selectedPlace;

  const continueFromPreviewDisabled =
    submitting || redirecting || !selectedPlace || placeDetailsLoading;

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((item) => item !== tag);
      return [...prev, tag];
    });
  }

  function toggleVisitTag(tag: string) {
    setVisitTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  }

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
    setCafeName('');
    setArea('');
    setGoogleMapsUrl('');
    setNotes('');
    setSelectedTags([]);
    setSuggestCoffeeRating(null);
    setSelectedPhotos([null, null, null]);
    if (!fromVisitLog) {
      resetPublicSuggest();
    }
  }

  function handleBack() {
    if (!fromVisitLog) {
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
    if (isMissingCafeFlow && visitFlowStep === 2) {
      setVisitFlowStep(1);
      return;
    }
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

  async function pickVisitPhoto() {
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
    setVisitPhoto({
      uri: asset.uri,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
    });
  }

  function removePhotoForSlot(index: number) {
    setSelectedPhotos((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
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

  async function handleSubmit() {
    setSubmitError(null);
    setSuccessMessage(null);

    if (isExistingCafeFlow) {
      setSubmitting(true);
      try {
        const linkedVisit = await saveUserCafeVisit({
          cafeId: existingCafeId,
          submissionId: null,
          rating: visitRating,
          tags: visitTags,
          note: visitNote,
          photoAsset: visitPhoto,
        });
        if (!linkedVisit.ok) {
          setSubmitError(linkedVisit.error);
          return;
        }
        setSuccessMessage('Visit saved');
        setVisitLogSuccessState({
          hadPhoto: Boolean(visitPhoto?.uri),
          pendingReview: false,
        });
        resetForm();
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!fromVisitLog) {
      if (!selectedPlace || publicSuggestStep !== 'beaned_extras') {
        setSubmitError('Select a place and continue to add details before submitting.');
        return;
      }
      if (!placeHasValidCoordinates(selectedPlace)) {
        setSubmitError(
          'This café is missing map coordinates from Google Places. Go back and choose the place again.'
        );
        return;
      }
      setSubmitting(true);
      try {
        const result = await submitGooglePlacesCafeSuggestion(selectedPlace, {
          notes,
          selectedTags,
          coffeeRating: suggestCoffeeRating,
        });
        if (!result.ok) {
          setSubmitError(result.error);
          return;
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
        redirectTimeoutRef.current = setTimeout(() => {
          router.replace('/');
        }, 600);
      } finally {
        setSubmitting(false);
      }
      return;
    }

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
    try {
      const result = await createCafeSuggestionWithId({
        cafeName: nameTrimmed,
        area,
        googleMapsUrl,
        notes: visitNote,
        selectedTags: visitTags,
      });

      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }

      const linkedVisit = await saveUserCafeVisit({
        cafeId: null,
        submissionId: result.submissionId,
        rating: visitRating,
        tags: visitTags,
        note: visitNote,
        photoAsset: visitPhoto,
      });
      if (!linkedVisit.ok) {
        setSuccessMessage(
          `Cafe details saved, but your visit draft was not linked yet: ${linkedVisit.error}. You can retry from Visit log.`
        );
        return;
      }

      setSuccessMessage('Visit saved');
      setVisitLogSuccessState({
        hadPhoto: Boolean(visitPhoto?.uri),
        pendingReview: true,
      });
      resetForm();
      const rows = await getMyCafeSubmissions(6);
      setMySubmissions(rows);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
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
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <StackHeaderBackButton
                canGoBack
                tintColor={COLORS.text}
                onPress={handleBack}
              />
            </View>
            <Text style={styles.headerTitle}>{fromVisitLog ? '' : 'Suggest a cafe'}</Text>
            <View style={styles.headerRight} />
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.pageTitle}>{fromVisitLog ? 'Log a cafe' : 'Suggest a cafe'}</Text>
            <Text style={styles.pageSubtitle}>
              {fromVisitLog
                ? visitFlowStep === 1
                  ? 'Add your visit details.'
                  : 'Add cafe details.'
                : publicSuggestStep === 'places_search'
                  ? 'Search Google Places, confirm the café, then add optional notes, photos, and tags.'
                  : publicSuggestStep === 'place_confirm'
                    ? 'Check the details, then continue to add Beaned-specific info.'
                    : 'Add optional notes, photos, and tags — everything goes to moderation before going live.'}
            </Text>
          </View>

          {fromVisitLog ? (
            <View style={styles.sectionCard}>
              {visitFlowStep === 1 ? (
                <>
                  <Text style={styles.fieldLabel}>Visit details</Text>
                  <Text style={styles.fieldLabel}>Add photo (optional)</Text>
                  <View style={styles.photoSlotsWrap}>
                    {['Exterior photo', 'Coffee / interior', 'Third photo'].map((label) => (
                      <View key={`visit-photo-prompt-${label}`} style={styles.photoSlotCard}>
                        <Text style={styles.photoSlotLabel}>{label}</Text>
                        <View style={styles.photoSlotActionsRow}>
                          <TouchableOpacity
                            activeOpacity={0.88}
                            style={styles.photoSlotButton}
                            onPress={() => void pickVisitPhoto()}
                            disabled={submitting || redirecting}
                          >
                            <Text style={styles.photoSlotButtonText}>{visitPhoto ? 'Replace photo' : 'Add photo'}</Text>
                          </TouchableOpacity>
                          {visitPhoto ? (
                            <TouchableOpacity
                              activeOpacity={0.88}
                              style={[styles.photoSlotButton, styles.photoSlotButtonSecondary]}
                              onPress={() => setVisitPhoto(null)}
                              disabled={submitting || redirecting}
                            >
                              <Text style={styles.photoSlotButtonSecondaryText}>Remove</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                  {visitPhoto ? (
                    <Image source={{ uri: visitPhoto.uri }} style={styles.photoPreview} resizeMode="cover" />
                  ) : null}

                  <Text style={styles.fieldLabel}>How was it?</Text>
                  <Text style={styles.visitRatingValue}>
                    {visitRating == null ? 'Not rated' : `${Math.round(visitRating)} / 5`}
                  </Text>
                  <Slider
                    value={visitRating ?? 3}
                    onValueChange={(v) => setVisitRating(v)}
                    minimumValue={1}
                    maximumValue={5}
                    step={1}
                    minimumTrackTintColor={COLORS.accent}
                    maximumTrackTintColor="rgba(92, 86, 80, 0.22)"
                    thumbTintColor={COLORS.accent}
                  />

                  <Text style={styles.fieldLabel}>What stood out?</Text>
                  {visitTagSections.map((section) => (
                    <View key={`visit-${section.title}`} style={styles.tagSection}>
                      <Text style={styles.tagSectionTitle}>{section.title}</Text>
                      <View style={styles.tagsWrap}>
                        {section.tags.map((tag) => {
                          const selected = visitTags.includes(tag);
                          return (
                            <TouchableOpacity
                              key={`visit-tag-${tag}`}
                              activeOpacity={0.85}
                              style={[styles.tagChip, selected && styles.tagChipSelected]}
                              onPress={() => toggleVisitTag(tag)}
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

                  <Text style={styles.fieldLabel}>Describe your experience</Text>
                  <View
                    onLayout={(event) => {
                      setExperienceInputY(event.nativeEvent.layout.y);
                    }}
                  >
                    <TextInput
                      style={styles.notesInput}
                      value={visitNote}
                      onChangeText={setVisitNote}
                      placeholder="What made this place worth remembering?"
                      placeholderTextColor={COLORS.muted}
                      multiline
                      textAlignVertical="top"
                      maxLength={180}
                      onFocus={() => {
                        const targetY = Math.max(0, experienceInputY - 24);
                        setTimeout(() => {
                          scrollRef.current?.scrollTo({ y: targetY, animated: true });
                        }, Platform.OS === 'ios' ? 90 : 60);
                      }}
                    />
                  </View>
                </>
              ) : isMissingCafeFlow ? (
                <>
                  <TextInput
                    style={styles.input}
                    value={cafeName}
                    onChangeText={setCafeName}
                    placeholder="Cafe name"
                    placeholderTextColor={COLORS.muted}
                    maxLength={120}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                  <TextInput
                    style={styles.input}
                    value={area}
                    onChangeText={setArea}
                    placeholder="Area (optional)"
                    placeholderTextColor={COLORS.muted}
                    maxLength={120}
                    autoCapitalize="words"
                  />
                  <TextInput
                    style={[styles.input, !urlLooksValid && styles.inputInvalid]}
                    value={googleMapsUrl}
                    onChangeText={setGoogleMapsUrl}
                    placeholder="Google Maps URL (optional)"
                    placeholderTextColor={COLORS.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                  {!urlLooksValid ? (
                    <Text style={styles.validationText}>Enter a valid URL with http:// or https://.</Text>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}

          {!fromVisitLog ? (
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
                  <Text style={styles.fieldLabel}>Find the café</Text>
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
                    <Pressable onPress={() => openExternalUrl(selectedPlace.googleMapsUri!)}>
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
                <>
                  <View style={styles.sectionCard}>
                    <Text style={styles.fieldLabel}>Coffee rating</Text>
                    <Text style={styles.tagHelperText}>Your score for this café (optional). Not from Google.</Text>
                    <SuggestCoffeeRatingSlider
                      value={suggestCoffeeRating}
                      onChange={(v) => setSuggestCoffeeRating(v)}
                    />
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => setSuggestCoffeeRating(null)}
                      disabled={submitting || redirecting}
                      style={styles.suggestClearRating}
                    >
                      <Text style={styles.suggestClearRatingText}>Clear rating</Text>
                    </TouchableOpacity>
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

                  <View style={styles.sectionCard}>
                    <Text style={styles.fieldLabel}>Add photos (recommended)</Text>
                    <View style={styles.photoSlotsWrap}>
                      {[
                        { label: 'Exterior photo', index: 0 },
                        { label: 'Coffee / interior', index: 1 },
                        { label: 'Third photo', index: 2 },
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
                </>
              ) : null}
            </>
          ) : null}

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

          {fromVisitLog && visitLogSuccessState ? (
            <View style={styles.sectionCard}>
              <Text style={styles.fieldLabel}>Visit saved</Text>
              <Text style={styles.tagHelperText}>Added to your personal cafe log.</Text>
              {visitLogSuccessState.hadPhoto ? (
                <Text style={styles.tagHelperText}>Your photo has been submitted for review.</Text>
              ) : null}
              {visitLogSuccessState.pendingReview ? (
                <>
                  <Text style={styles.tagHelperText}>Your cafe is pending review.</Text>
                  <Text style={styles.tagHelperText}>We’ll add it to Beaned if it fits.</Text>
                </>
              ) : null}
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.submitButton}
                onPress={() => router.replace('/my-cafes')}
              >
                <Text style={styles.submitButtonText}>View my visits</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.88}
                style={[styles.photoSlotButton, styles.photoSlotButtonSecondary]}
                onPress={() => router.replace('/')}
              >
                <Text style={styles.photoSlotButtonSecondaryText}>Find another cafe</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {isMissingCafeFlow && !visitLogSuccessState && visitFlowStep === 1 ? (
            <TouchableOpacity
              activeOpacity={0.88}
              style={[styles.submitButton, (submitting || redirecting) && styles.submitButtonDisabled]}
              onPress={() => setVisitFlowStep(2)}
              disabled={submitting || redirecting}
            >
              <Text style={styles.submitButtonText}>Next</Text>
            </TouchableOpacity>
          ) : !visitLogSuccessState &&
            !fromVisitLog &&
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
          ) : !visitLogSuccessState && !fromVisitLog && publicSuggestStep === 'places_search' ? null : !visitLogSuccessState ? (
            <TouchableOpacity
              activeOpacity={0.88}
              style={[styles.submitButton, submitDisabled && styles.submitButtonDisabled]}
              onPress={() => void handleSubmit()}
              disabled={submitDisabled || Boolean(visitLogSuccessState)}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isExistingCafeFlow ? 'Save visit' : fromVisitLog ? 'Add details' : 'Submit for review'}
                </Text>
              )}
            </TouchableOpacity>
          ) : null}

          {!fromVisitLog ? <View style={styles.sectionCard}>
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
          </View> : null}
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
