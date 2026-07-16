import { Image as ExpoImage } from 'expo-image';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { COLORS } from '@/components/theme';

type Props = {
  uri: string;
  style?: StyleProp<ImageStyle>;
  /** Kept for call-site compatibility; sizing is handled by style / layout, not CDN. */
  displayWidth?: number;
  /** Kept for call-site compatibility; sizing is handled by style / layout, not CDN. */
  displayHeight?: number;
  lazy?: boolean;
  priority?: 'low' | 'normal' | 'high';
};

function CafeImageInner({
  uri,
  style,
  displayWidth: _displayWidth = 480,
  displayHeight: _displayHeight,
  lazy = Platform.OS === 'web',
  priority = 'normal',
}: Props) {
  const shouldLazy = lazy && Platform.OS === 'web';
  const [inView, setInView] = useState(!shouldLazy);
  const containerRef = useRef<View>(null);

  useEffect(() => {
    if (!shouldLazy) {
      setInView(true);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const node = containerRef.current as unknown as Element | null;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px', threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldLazy, uri]);

  const webUri = useMemo(() => {
    if (Platform.OS !== 'web' || !inView) return '';
    // Use the public object URL / signed URL as-is — no Supabase image transforms.
    return String(uri ?? '').trim();
  }, [uri, inView]);

  if (Platform.OS === 'web') {
    const frameStyle: StyleProp<ViewStyle> = [
      style,
      styles.webFrame,
      !inView && styles.webPlaceholder,
    ];

    return (
      <View ref={containerRef} style={frameStyle}>
        {inView && webUri ? (
          <ExpoImage
            source={{ uri: webUri }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            contentPosition="center"
            transition={150}
            cachePolicy="memory-disk"
            recyclingKey={webUri}
            priority={priority}
          />
        ) : null}
      </View>
    );
  }

  return <Image source={{ uri }} style={style} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  webFrame: {
    overflow: 'hidden',
    backgroundColor: COLORS.imagePlaceholder,
  },
  webPlaceholder: {
    backgroundColor: COLORS.imagePlaceholder,
  },
});

export const CafeImage = memo(CafeImageInner, (prev, next) => {
  return (
    prev.uri === next.uri &&
    prev.displayWidth === next.displayWidth &&
    prev.displayHeight === next.displayHeight &&
    prev.lazy === next.lazy &&
    prev.priority === next.priority
  );
});
