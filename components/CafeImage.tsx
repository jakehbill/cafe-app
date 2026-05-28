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
import { optimizeCafeImageUrl } from '@/lib/cafeImageUrl';

type Props = {
  uri: string;
  style?: StyleProp<ImageStyle>;
  /** Target width in px (× device scale handled by caller). */
  displayWidth?: number;
  /** When set with width, enables CDN resize matching the frame aspect ratio. */
  displayHeight?: number;
  lazy?: boolean;
  priority?: 'low' | 'normal' | 'high';
};

function CafeImageInner({
  uri,
  style,
  displayWidth = 480,
  displayHeight,
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
    return optimizeCafeImageUrl(uri, {
      width: displayWidth,
      height: displayHeight,
      resize: displayHeight != null ? 'cover' : undefined,
    });
  }, [uri, displayWidth, displayHeight, inView]);

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
