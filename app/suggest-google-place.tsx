import React, { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS, FONTS } from '@/components/theme';
import { submitGooglePlacesCafeSuggestion } from '@/lib/cafeSubmissions';
import {
  createPlacesSessionToken,
  fetchPlaceDetailsForSubmission,
  fetchPlacesTextSearch,
  getGooglePlacesApiKeyOrEmpty,
  type GooglePlaceDetailsForSubmission,
  type PlacesSearchListItem,
} from '@/lib/googlePlaces';

type Step = 'search' | 'preview';

const DEBOUNCE_MS = 350;

export default function SuggestGooglePlaceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ initialQuery?: string | string[] }>();
  const initialQueryParam = Array.isArray(params.initialQuery) ? params.initialQuery[0] : params.initialQuery;
  const initialQuery = String(initialQueryParam ?? '').trim();

  const [step, setStep] = useState<Step>('search');
  const [sessionToken, setSessionToken] = useState(createPlacesSessionToken);
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<PlacesSearchListItem[]>([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [autocompleteError, setAutocompleteError] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GooglePlaceDetailsForSubmission | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // REMOVEME after env works: diagnostic only (never logs the key value).
  useEffect(() => {
    if (!__DEV__) return;
    console.log("Google Places key exists:", !!process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY);
  }, []);

  const resolvedGooglePlacesKey = getGooglePlacesApiKeyOrEmpty();
  const hasApiKey = resolvedGooglePlacesKey.length > 0;

  const rotateSession = useCallback(() => {
    setSessionToken(createPlacesSessionToken());
  }, []);

  useEffect(() => {
    if (!hasApiKey) return;
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setAutocompleteError(null);
      setAutocompleteLoading(false);
      return;
    }

    let cancelled = false;
    setAutocompleteLoading(true);
    setAutocompleteError(null);

    const t = setTimeout(() => {
      void (async () => {
        try {
          const list = await fetchPlacesTextSearch(q);
          if (cancelled) return;
          setSuggestions(list);
        } catch (e) {
          if (cancelled) return;
          setSuggestions([]);
          setAutocompleteError(e instanceof Error ? e.message : 'Search failed.');
        } finally {
          if (!cancelled) setAutocompleteLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, hasApiKey]);

  const openUrl = (url: string) => {
    void Linking.openURL(url);
  };

  const onSelectSuggestion = async (item: PlacesSearchListItem) => {
    if (!hasApiKey) return;
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const details = await fetchPlaceDetailsForSubmission(item.placeId, sessionToken);
      rotateSession();
      setPreview(details);
      setStep('preview');
    } catch (e) {
      rotateSession();
      setDetailsError(e instanceof Error ? e.message : 'Could not load place details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const goBackToSearch = () => {
    setStep('search');
    setPreview(null);
    setSubmitError(null);
    setDetailsError(null);
    rotateSession();
  };

  const onSubmit = async () => {
    if (!preview) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await submitGooglePlacesCafeSuggestion({
        placeId: preview.placeId,
        cafeName: preview.cafeName,
        addressText: preview.formattedAddress,
        googleMapsUrl: preview.googleMapsUri,
        website: preview.websiteUri,
        phoneNumber: preview.nationalPhoneNumber,
        latitude: preview.latitude,
        longitude: preview.longitude,
      });
      if (!res.ok) {
        setSubmitError(res.error);
        return;
      }
      setSuccessMessage('Thanks — your suggestion is pending review.');
      setTimeout(() => {
        router.back();
      }, 1200);
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasApiKey) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Suggest from Google Maps</Text>
          <Text style={styles.bodyMuted}>
            Add EXPO_PUBLIC_GOOGLE_PLACES_API_KEY to your environment and restart Expo to use this flow.
            {'\n\n'}
            If it is already in your project root .env file, save the file (unsaved editor changes are not
            loaded) then run npx expo start --clear.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()} activeOpacity={0.88}>
            <Text style={styles.secondaryBtnText}>Go back</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'preview' && preview) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Preview</Text>
          <View style={styles.card}>
            <Text style={styles.previewName}>{preview.cafeName}</Text>
            <Text style={styles.previewAddress}>{preview.formattedAddress}</Text>
            {preview.websiteUri ? (
              <Pressable onPress={() => openUrl(preview.websiteUri!)} style={styles.linkRow}>
                <Text style={styles.linkText}>{preview.websiteUri}</Text>
              </Pressable>
            ) : (
              <Text style={styles.mutedSmall}>No website on file</Text>
            )}
            {preview.nationalPhoneNumber ? (
              <Text style={styles.previewLine}>{preview.nationalPhoneNumber}</Text>
            ) : (
              <Text style={styles.mutedSmall}>No phone on file</Text>
            )}
            {preview.googleMapsUri ? (
              <Pressable onPress={() => openUrl(preview.googleMapsUri!)} style={styles.linkRow}>
                <Text style={styles.linkText}>Open in Google Maps</Text>
              </Pressable>
            ) : null}
          </View>

          {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.btnDisabled]}
            onPress={onSubmit}
            disabled={submitting || successMessage != null}
            activeOpacity={0.88}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Submit for approval</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={goBackToSearch} disabled={submitting}>
            <Text style={styles.secondaryBtnText}>Choose a different place</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Suggest from Google Maps</Text>
        <Text style={styles.bodyMuted}>
          Search like Google Maps: use the café name plus area, street or postcode. Results are biased to London
          (not restricted). Food-related places are ranked first when types match.
        </Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. Drupe Bethnal Green"
          placeholderTextColor={COLORS.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        {autocompleteError ? <Text style={styles.errorText}>{autocompleteError}</Text> : null}
        {detailsError ? <Text style={styles.errorText}>{detailsError}</Text> : null}

        {autocompleteLoading ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator color={COLORS.accent} />
            <Text style={styles.loaderLabel}>Searching…</Text>
          </View>
        ) : null}

        {detailsLoading ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator color={COLORS.accent} />
            <Text style={styles.loaderLabel}>Loading place…</Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {suggestions.map((item) => (
            <TouchableOpacity
              key={item.placeId}
              style={styles.suggestionRow}
              onPress={() => onSelectSuggestion(item)}
              disabled={detailsLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.suggestionTitle}>{item.title}</Text>
              <Text style={styles.suggestionSubtitle}>{item.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {query.trim().length >= 2 && !autocompleteLoading && suggestions.length === 0 && !autocompleteError ? (
          <Text style={styles.bodyMuted}>
            No strong matches found. Try adding the area, postcode or street name.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollPad: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  bodyMuted: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    fontFamily: FONTS.sans.regular,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loaderLabel: {
    fontSize: 14,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  list: {
    gap: 0,
  },
  suggestionRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  suggestionTitle: {
    fontSize: 16,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
  },
  suggestionSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    padding: 14,
    gap: 8,
  },
  previewName: {
    fontSize: 18,
    fontFamily: FONTS.display.semibold,
    color: COLORS.text,
  },
  previewAddress: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONTS.sans.regular,
    color: COLORS.text,
  },
  previewLine: {
    fontSize: 14,
    fontFamily: FONTS.sans.regular,
    color: COLORS.text,
  },
  mutedSmall: {
    fontSize: 13,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
  },
  linkRow: {
    alignSelf: 'flex-start',
  },
  linkText: {
    fontSize: 14,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.accent,
  },
  errorText: {
    fontSize: 14,
    color: '#b42318',
    fontFamily: FONTS.sans.regular,
  },
  successText: {
    fontSize: 14,
    color: COLORS.accent,
    fontFamily: FONTS.sans.semibold,
  },
  primaryBtn: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: FONTS.sans.semibold,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  secondaryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.accent,
  },
});
