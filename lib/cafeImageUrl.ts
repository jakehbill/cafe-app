export type OptimizeCafeImageOptions = {
  width?: number;
  height?: number;
  resize?: 'cover' | 'contain';
};

/**
 * Returns the image URL for display without Supabase Image Transformations.
 * This project does not have `/storage/v1/render/image` enabled — using those
 * URLs returns 403. Public café images must use `/object/public/...` directly.
 * Layout sizing is handled by CSS / React Native, not CDN transforms.
 */
export function optimizeCafeImageUrl(
  url: string,
  _options: OptimizeCafeImageOptions | number = {}
): string {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname.includes('supabase.co')) return trimmed;

    // If a transform URL was ever stored/passed, fall back to the public object URL.
    const renderPrefix = '/storage/v1/render/image/public/';
    const renderIdx = parsed.pathname.indexOf(renderPrefix);
    if (renderIdx !== -1) {
      const objectPath = parsed.pathname.slice(renderIdx + renderPrefix.length);
      if (!objectPath) return trimmed;
      parsed.pathname = `/storage/v1/object/public/${objectPath}`;
      parsed.search = '';
      return parsed.toString();
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}
