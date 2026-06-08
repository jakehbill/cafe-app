import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
  fetchApprovedCafePhotosForCafe,
  setCafePrimaryPhoto,
  type ApprovedCafePhotoForModeration,
} from '@/lib/moderationQueue';

export default function ModerationCafePhotosScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ cafeId?: string | string[] }>();
  const initialCafeId = Array.isArray(params.cafeId) ? params.cafeId[0] : params.cafeId;

  const allowed = isModerator(user?.id);
  const [cafeIdInput, setCafeIdInput] = React.useState(String(initialCafeId ?? '').trim());
  const [loadedCafeId, setLoadedCafeId] = React.useState(String(initialCafeId ?? '').trim());
  const [photos, setPhotos] = React.useState<ApprovedCafePhotoForModeration[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [workingPhotoId, setWorkingPhotoId] = React.useState<string | null>(null);

  const loadPhotos = React.useCallback(async (cafeId: string) => {
    const key = cafeId.trim();
    if (!key) {
      setPhotos([]);
      setLoadedCafeId('');
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchApprovedCafePhotosForCafe(key);
      setPhotos(rows);
      setLoadedCafeId(key);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!allowed) return;
    const seed = String(initialCafeId ?? '').trim();
    if (seed) void loadPhotos(seed);
  }, [allowed, initialCafeId, loadPhotos]);

  async function handleSetPrimary(photoId: string) {
    if (workingPhotoId) return;
    setWorkingPhotoId(photoId);
    try {
      const res = await setCafePrimaryPhoto(photoId);
      if (!res.ok) {
        Alert.alert('Could not set primary photo', res.error);
        return;
      }
      if (loadedCafeId) {
        await loadPhotos(loadedCafeId);
      }
      Alert.alert('Primary photo updated', 'Cards and café detail will show this image first.');
    } finally {
      setWorkingPhotoId(null);
    }
  }

  if (!allowed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerCard}>
          <Text style={styles.title}>Not authorized</Text>
          <Text style={styles.subtitle}>You do not have access to moderation tools.</Text>
          <TouchableOpacity activeOpacity={0.88} style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Café photos</Text>
          <Text style={styles.subtitle}>
            Choose which approved photo is primary for a café. Only approved photos are shown publicly.
          </Text>
        </View>

        <View style={styles.searchCard}>
          <Text style={styles.fieldLabel}>Café ID</Text>
          <TextInput
            style={styles.input}
            value={cafeIdInput}
            onChangeText={setCafeIdInput}
            placeholder="e.g. 42"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.loadButton}
            onPress={() => void loadPhotos(cafeIdInput)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.loadButtonText}>Load approved photos</Text>
            )}
          </TouchableOpacity>
        </View>

        {loadedCafeId ? (
          <Text style={styles.loadedHint}>
            {photos.length === 0
              ? `No approved photos for café #${loadedCafeId} yet.`
              : `${photos.length} approved photo${photos.length === 1 ? '' : 's'} for café #${loadedCafeId}`}
          </Text>
        ) : null}

        <View style={styles.listWrap}>
          {photos.map((photo) => (
            <View key={photo.id} style={styles.card}>
              {photo.previewUrl ? (
                <Image source={{ uri: photo.previewUrl }} style={styles.photoPreview} resizeMode="cover" />
              ) : null}
              <View style={styles.cardMetaRow}>
                {photo.isPrimary ? (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>Primary</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={styles.setPrimaryButton}
                    disabled={workingPhotoId != null}
                    onPress={() => void handleSetPrimary(photo.id)}
                  >
                    {workingPhotoId === photo.id ? (
                      <ActivityIndicator color={COLORS.accent} size="small" />
                    ) : (
                      <Text style={styles.setPrimaryButtonText}>Set as Primary</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.backLink}
          onPress={() => router.push('/moderation')}
        >
          <Text style={styles.backLinkText}>Back to moderation queue</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 14,
  },
  centerCard: {
    margin: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    padding: 20,
    gap: 10,
  },
  headerBlock: {
    gap: 4,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    color: COLORS.text,
    fontFamily: FONTS.display.semibold,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  searchCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    padding: 14,
    gap: 10,
  },
  fieldLabel: {
    fontSize: 13,
    color: COLORS.muted,
    fontFamily: FONTS.sans.semibold,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
    fontFamily: FONTS.sans.regular,
  },
  loadButton: {
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  loadButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontFamily: FONTS.sans.semibold,
  },
  loadedHint: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  listWrap: {
    gap: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    padding: 12,
    gap: 10,
  },
  photoPreview: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: 10,
    backgroundColor: COLORS.imagePlaceholder,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: COLORS.accentSubtleFill,
    borderWidth: 1,
    borderColor: COLORS.accentSubtleBorder,
  },
  primaryBadgeText: {
    fontSize: 12,
    color: COLORS.accent,
    fontFamily: FONTS.sans.semibold,
  },
  setPrimaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 130,
    alignItems: 'center',
  },
  setPrimaryButtonText: {
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
  },
  backLink: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  backLinkText: {
    fontSize: 14,
    color: COLORS.accent,
    fontFamily: FONTS.sans.semibold,
  },
  button: {
    marginTop: 6,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
  },
});
