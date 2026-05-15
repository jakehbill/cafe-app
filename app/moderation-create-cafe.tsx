import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  Image,
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
  fetchSubmissionPhotosForSubmission,
  findLikelyCafeDuplicates,
  type PendingCafeSuggestion,
  type SubmissionPhotoForModeration,
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
  const [submissionPhotos, setSubmissionPhotos] = React.useState<SubmissionPhotoForModeration[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = React.useState<Set<string>>(new Set());
  const [photoOrderIds, setPhotoOrderIds] = React.useState<string[]>([]);
  const [name, setName] = React.useState('');
  const [area, setArea] = React.useState('');
  const [addressLine, setAddressLine] = React.useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = React.useState('');
  const [shortDescription, setShortDescription] = React.useState('');
  const [tagsText, setTagsText] = React.useState('');
  const [latitudeText, setLatitudeText] = React.useState('');
  const [longitudeText, setLongitudeText] = React.useState('');
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [createdCafeId, setCreatedCafeId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const id = String(submissionId ?? '').trim();
    if (!id || !allowed) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [row, photos] = await Promise.all([
        fetchCafeSubmissionById(id),
        fetchSubmissionPhotosForSubmission(id),
      ]);
      if (cancelled) return;
      setSubmission(row);
      setSubmissionPhotos(photos);
      setSelectedPhotoIds(new Set(photos.map((photo) => photo.id)));
      setPhotoOrderIds(photos.map((photo) => photo.id));
      if (row) {
        setName(row.cafe_name ?? '');
        setArea(row.area ?? '');
        setAddressLine(row.address_text ?? '');
        setGoogleMapsUrl(row.google_maps_url ?? '');
        setShortDescription(row.notes ?? '');
        setTagsText((row.selected_tags ?? []).join(', '));
        if (typeof row.latitude === 'number' && Number.isFinite(row.latitude)) {
          setLatitudeText(String(row.latitude));
        }
        if (typeof row.longitude === 'number' && Number.isFinite(row.longitude)) {
          setLongitudeText(String(row.longitude));
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionId, allowed]);

  function toggleSelectedPhoto(photoId: string) {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }

  function movePhoto(photoId: string, direction: 'left' | 'right') {
    setPhotoOrderIds((prev) => {
      const index = prev.indexOf(photoId);
      if (index < 0) return prev;
      const delta = direction === 'left' ? -1 : 1;
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function setAsPrimary(photoId: string) {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      next.add(photoId);
      return next;
    });
    setPhotoOrderIds((prev) => {
      const index = prev.indexOf(photoId);
      if (index <= 0) return prev;
      const next = [...prev];
      next.splice(index, 1);
      next.unshift(photoId);
      return next;
    });
  }

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
    const cleanedArea = area.trim();
    const latitude = Number.parseFloat(latitudeText.trim());
    const longitude = Number.parseFloat(longitudeText.trim());

    if (!submissionIdValue) {
      Alert.alert('Missing submission', 'No submission id was provided.');
      return;
    }
    if (!cleanedName || !cleanedArea) {
      Alert.alert('Required fields missing', 'Cafe name and area are required.');
      return;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      Alert.alert('Coordinates required', 'Latitude and longitude must be valid numbers.');
      return;
    }

    if (!ignoreDuplicateWarning) {
      const duplicates = await findLikelyCafeDuplicates({
        name: cleanedName,
        area: cleanedArea,
        addressLine,
      });
      if (duplicates.length > 0) {
        const duplicateLines = duplicates
          .slice(0, 3)
          .map((dup) => `${dup.name}${dup.area ? ` · ${dup.area}` : ''}`)
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

    setSaveError(null);
    setSaveSuccess(false);
    setCreatedCafeId(null);
    setSaving(true);

    try {
      const photoById = new Map(submissionPhotos.map((photo) => [photo.id, photo] as const));
      const orderedSelectedSubmissionPhotos = photoOrderIds
        .filter((photoId) => selectedPhotoIds.has(photoId))
        .map((photoId) => photoById.get(photoId))
        .filter((photo): photo is SubmissionPhotoForModeration => Boolean(photo));

      const res = await createCafeAndApproveSubmission({
        submissionId: submissionIdValue,
        name: cleanedName,
        area: cleanedArea,
        latitude,
        longitude,
        addressLine,
        googleMapsUrl,
        shortDescription,
        tags: parseTags(tagsText),
        moderatorUserId: user?.id ?? '',
        selectedSubmissionPhotos: orderedSelectedSubmissionPhotos,
      });

      if (!res.ok) {
        console.error('[moderation-create-cafe] createCafeAndApproveSubmission failed:', res.error);
        setSaveError("Couldn't create café. Please try again.");
        return;
      }

      setSaveSuccess(true);
      setCreatedCafeId(res.cafeId);
    } catch (e) {
      console.error('[moderation-create-cafe] createCafeAndApproveSubmission threw:', e);
      setSaveError("Couldn't create café. Please try again.");
    } finally {
      setSaving(false);
    }
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

                <Text style={styles.label}>Area</Text>
                <TextInput style={styles.input} value={area} onChangeText={setArea} />

                <Text style={styles.label}>Address</Text>
                <TextInput style={styles.input} value={addressLine} onChangeText={setAddressLine} />

                <Text style={styles.label}>Google Maps URL</Text>
                <TextInput
                  style={styles.input}
                  value={googleMapsUrl}
                  onChangeText={setGoogleMapsUrl}
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Short description</Text>
                <TextInput
                  style={styles.textArea}
                  value={shortDescription}
                  onChangeText={setShortDescription}
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

              </View>

              {submissionPhotos.length > 0 ? (
                <View style={styles.card}>
                  <Text style={styles.label}>Photos for this cafe</Text>
                  <Text style={styles.helperText}>
                    Choose which photos to include. The first included photo is used as the primary image in
                    the app.
                  </Text>
                  <View style={styles.photoGrid}>
                    {photoOrderIds.map((photoId, index) => {
                      const photo = submissionPhotos.find((item) => item.id === photoId);
                      if (!photo) return null;
                      const selected = selectedPhotoIds.has(photo.id);
                      const isPrimary =
                        selected && index === photoOrderIds.findIndex((id) => selectedPhotoIds.has(id));
                      return (
                        <View
                          key={photo.id}
                          style={[
                            styles.photoTile,
                            selected ? styles.photoTileSelected : styles.photoTileUnselected,
                          ]}
                        >
                          {photo.preview_url ? (
                            <Image source={{ uri: photo.preview_url }} style={styles.photoTileImage} />
                          ) : (
                            <View style={[styles.photoTileImage, styles.photoTileFallback]} />
                          )}
                          <View style={styles.photoTileBody}>
                            <View style={styles.photoTileHeaderRow}>
                              <Text style={styles.photoOrderLabel}>#{index + 1}</Text>
                              {isPrimary ? (
                                <View style={styles.primaryBadge}>
                                  <Text style={styles.primaryBadgeText}>Primary</Text>
                                </View>
                              ) : null}
                            </View>
                            <View style={styles.photoTileActionsRow}>
                              <TouchableOpacity
                                style={styles.photoActionButton}
                                onPress={() => toggleSelectedPhoto(photo.id)}
                              >
                                <Text style={styles.photoActionText}>
                                  {selected ? 'Remove' : 'Include'}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.photoActionButton}
                                onPress={() => setAsPrimary(photo.id)}
                                disabled={!selected}
                              >
                                <Text
                                  style={[
                                    styles.photoActionText,
                                    !selected ? styles.photoActionTextDisabled : null,
                                  ]}
                                >
                                  Set as primary
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <View style={styles.photoTileActionsRow}>
                              <TouchableOpacity
                                style={styles.photoActionButton}
                                onPress={() => movePhoto(photo.id, 'left')}
                                disabled={index === 0}
                              >
                                <Text
                                  style={[
                                    styles.photoActionText,
                                    index === 0 ? styles.photoActionTextDisabled : null,
                                  ]}
                                >
                                  ← Left
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.photoActionButton}
                                onPress={() => movePhoto(photo.id, 'right')}
                                disabled={index === photoOrderIds.length - 1}
                              >
                                <Text
                                  style={[
                                    styles.photoActionText,
                                    index === photoOrderIds.length - 1
                                      ? styles.photoActionTextDisabled
                                      : null,
                                  ]}
                                >
                                  Right →
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {saveError ? (
                <View style={styles.feedbackBannerError}>
                  <Text style={styles.feedbackErrorText}>{saveError}</Text>
                </View>
              ) : null}

              {saveSuccess ? (
                <View style={styles.feedbackBannerSuccess}>
                  <Text style={styles.feedbackSuccessText}>Café created successfully.</Text>
                  <Text style={styles.feedbackSuccessSubtext}>
                    This submission is marked approved and will no longer appear in the pending queue.
                  </Text>
                </View>
              ) : null}

              {saveSuccess ? (
                <View style={styles.postSuccessActions}>
                  {createdCafeId ? (
                    <TouchableOpacity
                      activeOpacity={0.88}
                      style={styles.primaryButton}
                      onPress={() => router.push(`/cafe/${createdCafeId}`)}
                    >
                      <Text style={styles.primaryButtonText}>View café</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={styles.secondaryButton}
                    onPress={() => router.back()}
                  >
                    <Text style={styles.secondaryButtonText}>Back to moderation queue</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={[styles.primaryButton, (saving || saveSuccess) && styles.disabledButton]}
                  disabled={saving || saveSuccess}
                  onPress={() => void continueSave(false)}
                >
                  {saving ? (
                    <View style={styles.primaryButtonInner}>
                      <ActivityIndicator color="#ffffff" size="small" />
                      <Text style={styles.primaryButtonText}>Creating...</Text>
                    </View>
                  ) : (
                    <Text style={styles.primaryButtonText}>Create café</Text>
                  )}
                </TouchableOpacity>
              )}
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
  primaryButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  postSuccessActions: {
    gap: 10,
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
    gap: 4,
  },
  feedbackSuccessText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4A5A49',
    fontFamily: FONTS.sans.semibold,
    textAlign: 'center',
  },
  feedbackSuccessSubtext: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
    textAlign: 'center',
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
  helperText: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
    marginBottom: 2,
  },
  photoGrid: {
    gap: 10,
  },
  photoTile: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: COLORS.inputBackground,
  },
  photoTileSelected: {
    borderColor: COLORS.accentSubtleBorder,
  },
  photoTileUnselected: {
    borderColor: COLORS.cardBorder,
    opacity: 0.72,
  },
  photoTileImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: COLORS.imagePlaceholder,
  },
  photoTileFallback: {
    backgroundColor: COLORS.imagePlaceholder,
  },
  photoTileBody: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 8,
  },
  photoTileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoOrderLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: COLORS.muted,
    fontFamily: FONTS.sans.semibold,
  },
  primaryBadge: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: COLORS.accent,
  },
  primaryBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    color: '#ffffff',
    fontFamily: FONTS.sans.semibold,
  },
  photoTileActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  photoActionButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  photoActionText: {
    fontSize: 11,
    lineHeight: 14,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
  },
  photoActionTextDisabled: {
    color: COLORS.muted,
  },
});

