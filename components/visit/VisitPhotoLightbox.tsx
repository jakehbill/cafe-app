import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '@/components/theme';

type Props = {
  visible: boolean;
  /** Single-image mode (backward compatible). */
  imageUri?: string;
  /** Multi-image mode for visit galleries. */
  imageUris?: string[];
  initialIndex?: number;
  onClose: () => void;
  /** Optional caption (e.g. café name). */
  title?: string;
};

/**
 * Full-screen visit photo preview — visited cafés list only.
 */
export function VisitPhotoLightbox({
  visible,
  imageUri,
  imageUris,
  initialIndex = 0,
  onClose,
  title,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const maxImageWidth = Math.min(windowWidth - 40, 560);
  const maxImageHeight = Math.max(200, windowHeight - insets.top - insets.bottom - 120);

  const uris = useMemo(() => {
    const fromList = (imageUris ?? []).map((uri) => String(uri).trim()).filter(Boolean);
    if (fromList.length > 0) return fromList;
    const single = String(imageUri ?? '').trim();
    return single ? [single] : [];
  }, [imageUri, imageUris]);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const clamped = Math.min(Math.max(0, initialIndex), Math.max(0, uris.length - 1));
    setActiveIndex(clamped);
  }, [visible, initialIndex, uris.length]);

  const activeUri = uris[activeIndex] ?? null;
  const hasMultiple = uris.length > 1;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close photo preview"
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={[styles.closeButton, { top: insets.top + 12 }]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={22} color="#ffffff" />
        </Pressable>

        <Pressable style={styles.content} onPress={(event) => event.stopPropagation()}>
          {title ? (
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          {hasMultiple ? (
            <Text style={styles.counter}>
              {activeIndex + 1} of {uris.length}
            </Text>
          ) : null}
          <View style={[styles.imageFrame, { width: maxImageWidth, height: maxImageHeight }]}>
            {activeUri ? (
              <Image
                source={{ uri: activeUri }}
                style={StyleSheet.absoluteFillObject}
                contentFit="contain"
                transition={120}
                accessibilityLabel={title ? `Visit photo for ${title}` : 'Visit photo'}
              />
            ) : null}
          </View>
          {hasMultiple ? (
            <View style={styles.navRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous photo"
                disabled={activeIndex <= 0}
                onPress={() => setActiveIndex((index) => Math.max(0, index - 1))}
                style={[styles.navButton, activeIndex <= 0 && styles.navButtonDisabled]}
              >
                <Ionicons name="chevron-back" size={20} color="#ffffff" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next photo"
                disabled={activeIndex >= uris.length - 1}
                onPress={() => setActiveIndex((index) => Math.min(uris.length - 1, index + 1))}
                style={[styles.navButton, activeIndex >= uris.length - 1 && styles.navButtonDisabled]}
              >
                <Ionicons name="chevron-forward" size={20} color="#ffffff" />
              </Pressable>
            </View>
          ) : null}
          <Text style={styles.hint}>Tap outside to close</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: FONTS.sans.semibold,
    color: '#f5f2ed',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  counter: {
    fontSize: 13,
    fontFamily: FONTS.sans.medium,
    color: 'rgba(245, 242, 237, 0.8)',
  },
  imageFrame: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 8,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.35,
  },
  hint: {
    fontSize: 12,
    fontFamily: FONTS.sans.regular,
    color: 'rgba(245, 242, 237, 0.65)',
  },
});
