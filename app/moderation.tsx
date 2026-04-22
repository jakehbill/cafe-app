import { useRouter } from 'expo-router';
import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS, FONTS } from '@/components/theme';
import { useAuth } from '@/contexts/AuthContext';
import { isModerator } from '@/lib/moderator';
import {
  fetchPendingCafeSuggestions,
  fetchPendingPhotoSubmissions,
  reviewCafeSuggestion,
  reviewPhotoSubmission,
  type PendingCafeSuggestion,
  type PendingPhotoSubmission,
} from '@/lib/moderationQueue';

type ModerationTab = 'cafes' | 'photos';

function formatCreatedAt(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ModerationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState<ModerationTab>('cafes');
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [cafeItems, setCafeItems] = React.useState<PendingCafeSuggestion[]>([]);
  const [photoItems, setPhotoItems] = React.useState<PendingPhotoSubmission[]>([]);
  const [workingItemId, setWorkingItemId] = React.useState<string | null>(null);

  const allowed = isModerator(user?.id);

  const loadQueues = React.useCallback(async (asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [cafes, photos] = await Promise.all([
        fetchPendingCafeSuggestions(),
        fetchPendingPhotoSubmissions(),
      ]);
      setCafeItems(cafes);
      setPhotoItems(photos);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    if (!allowed) return;
    void loadQueues(false);
  }, [allowed, loadQueues]);

  useFocusEffect(
    React.useCallback(() => {
      if (!allowed) return;
      void loadQueues(false);
    }, [allowed, loadQueues])
  );

  async function handleCafeDecision(id: string, decision: 'approved' | 'rejected') {
    if (workingItemId) return;
    setWorkingItemId(id);
    const res = await reviewCafeSuggestion(id, decision);
    setWorkingItemId(null);
    if (!res.ok) {
      Alert.alert('Could not update submission', res.error);
      return;
    }
    setCafeItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function handlePhotoDecision(id: string, decision: 'approved' | 'rejected') {
    if (workingItemId) return;
    setWorkingItemId(id);
    const res = await reviewPhotoSubmission(id, decision);
    setWorkingItemId(null);
    if (!res.ok) {
      Alert.alert('Could not update photo submission', res.error);
      return;
    }
    setPhotoItems((prev) => prev.filter((item) => item.id !== id));
  }

  if (!allowed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerCard}>
          <Text style={styles.title}>Not authorized</Text>
          <Text style={styles.subtitle}>You do not have access to moderation tools.</Text>
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.button}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadQueues(true)} />}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Moderation</Text>
          <Text style={styles.subtitle}>Review pending submissions before anything goes live.</Text>
        </View>

        <View style={styles.segmentRow}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.segmentButton, activeTab === 'cafes' && styles.segmentButtonActive]}
            onPress={() => setActiveTab('cafes')}
          >
            <Text style={[styles.segmentButtonText, activeTab === 'cafes' && styles.segmentButtonTextActive]}>
              Cafe suggestions ({cafeItems.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.segmentButton, activeTab === 'photos' && styles.segmentButtonActive]}
            onPress={() => setActiveTab('photos')}
          >
            <Text style={[styles.segmentButtonText, activeTab === 'photos' && styles.segmentButtonTextActive]}>
              Photo submissions ({photoItems.length})
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? <ActivityIndicator color={COLORS.muted} style={{ marginTop: 20 }} /> : null}

        {!loading && activeTab === 'cafes' ? (
          cafeItems.length === 0 ? (
            <Text style={styles.emptyText}>No pending cafe suggestions</Text>
          ) : (
            <View style={styles.listWrap}>
              {cafeItems.map((item) => (
                <View key={item.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{item.cafe_name}</Text>
                  {item.address_text ? <Text style={styles.metaText}>{item.address_text}</Text> : null}
                  {item.area ? <Text style={styles.metaText}>Area: {item.area}</Text> : null}
                  {item.google_maps_url ? <Text style={styles.metaText}>{item.google_maps_url}</Text> : null}
                  {item.notes ? <Text style={styles.bodyText}>{item.notes}</Text> : null}
                  {item.selected_tags && item.selected_tags.length > 0 ? (
                    <Text style={styles.tagsText}>Tags: {item.selected_tags.join(', ')}</Text>
                  ) : null}
                  <Text style={styles.dateText}>{formatCreatedAt(item.created_at)}</Text>
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      style={[styles.actionButton, styles.createButton]}
                      disabled={workingItemId === item.id}
                      onPress={() =>
                        router.push({
                          pathname: '/moderation-create-cafe',
                          params: { submissionId: item.id },
                        })
                      }
                    >
                      <Text style={[styles.actionButtonText, styles.createButtonText]}>
                        Create cafe
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      style={[styles.actionButton, styles.approveButton]}
                      disabled={workingItemId === item.id}
                      onPress={() => void handleCafeDecision(item.id, 'approved')}
                    >
                      <Text style={[styles.actionButtonText, styles.approveButtonText]}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      style={[styles.actionButton, styles.rejectButton]}
                      disabled={workingItemId === item.id}
                      onPress={() => void handleCafeDecision(item.id, 'rejected')}
                    >
                      <Text style={styles.actionButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : null}

        {!loading && activeTab === 'photos' ? (
          photoItems.length === 0 ? (
            <Text style={styles.emptyText}>No pending photo submissions</Text>
          ) : (
            <View style={styles.listWrap}>
              {photoItems.map((item) => (
                <View key={item.id} style={styles.card}>
                  {item.preview_url ? (
                    <Image source={{ uri: item.preview_url }} style={styles.photoPreview} resizeMode="cover" />
                  ) : (
                    <View style={[styles.photoPreview, styles.photoPreviewFallback]}>
                      <Text style={styles.photoPreviewFallbackText}>Preview unavailable</Text>
                    </View>
                  )}
                  <Text style={styles.metaText}>Cafe #{item.cafe_id}</Text>
                  {item.caption ? <Text style={styles.bodyText}>{item.caption}</Text> : null}
                  <Text style={styles.dateText}>{formatCreatedAt(item.created_at)}</Text>
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      style={[styles.actionButton, styles.approveButton]}
                      disabled={workingItemId === item.id}
                      onPress={() => void handlePhotoDecision(item.id, 'approved')}
                    >
                      <Text style={[styles.actionButtonText, styles.approveButtonText]}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      style={[styles.actionButton, styles.rejectButton]}
                      disabled={workingItemId === item.id}
                      onPress={() => void handlePhotoDecision(item.id, 'rejected')}
                    >
                      <Text style={styles.actionButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : null}
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
    paddingTop: 20,
    paddingBottom: 28,
    gap: 14,
  },
  headerBlock: {
    gap: 4,
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
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    borderColor: COLORS.accentSubtleBorder,
    backgroundColor: COLORS.accentSubtleFill,
  },
  segmentButtonText: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
    fontFamily: FONTS.sans.semibold,
    textAlign: 'center',
  },
  segmentButtonTextActive: {
    color: COLORS.accent,
  },
  listWrap: {
    gap: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 24,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
    fontFamily: FONTS.sans.regular,
  },
  tagsText: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.accent,
    fontFamily: FONTS.sans.semibold,
  },
  dateText: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  actionsRow: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButton: {
    borderColor: COLORS.accentSubtleBorder,
    backgroundColor: COLORS.accentSubtleFill,
  },
  createButton: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
  },
  rejectButton: {
    backgroundColor: COLORS.inputBackground,
  },
  actionButtonText: {
    fontSize: 13,
    lineHeight: 17,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
  },
  approveButtonText: {
    color: COLORS.accent,
  },
  createButtonText: {
    color: '#ffffff',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  photoPreview: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: 10,
    backgroundColor: COLORS.imagePlaceholder,
  },
  photoPreviewFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  photoPreviewFallbackText: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
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

