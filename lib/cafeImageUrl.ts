export type OptimizeCafeImageOptions = {
  width?: number;
  height?: number;
  /**
   * Supabase resize mode. Use `contain` when only downsizing for bandwidth;
   * use `cover` only when both width and height match the display frame.
   */
  resize?: 'cover' | 'contain';
};

/**
 * Smaller Supabase render URLs on web.
 * Skips transform when only one dimension is known — width-only transforms
 * crop aggressively server-side and look overly zoomed in the app.
 */
export function optimizeCafeImageUrl(
  url: string,
  options: OptimizeCafeImageOptions | number = {}
): string {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) return trimmed;

  const opts: OptimizeCafeImageOptions =
    typeof options === 'number' ? { width: options } : options;
  const width = Math.max(1, Math.round(opts.width ?? 480));
  const height = opts.height != null ? Math.max(1, Math.round(opts.height)) : null;
  const resize = opts.resize ?? (height != null ? 'cover' : 'contain');

  // Width-only (or height-only) render URLs crop on the CDN — keep full image for client cover.
  if (height == null) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname.includes('supabase.co')) return trimmed;

    if (parsed.pathname.includes('/storage/v1/render/image/')) {
      parsed.searchParams.set('width', String(width));
      parsed.searchParams.set('height', String(height));
      parsed.searchParams.set('resize', resize);
      parsed.searchParams.set('quality', '80');
      return parsed.toString();
    }

    const objectPrefix = '/storage/v1/object/public/';
    const idx = parsed.pathname.indexOf(objectPrefix);
    if (idx === -1) return trimmed;

    const objectPath = parsed.pathname.slice(idx + objectPrefix.length);
    if (!objectPath) return trimmed;

    parsed.pathname = `/storage/v1/render/image/public/${objectPath}`;
    parsed.search = '';
    parsed.searchParams.set('width', String(width));
    parsed.searchParams.set('height', String(height));
    parsed.searchParams.set('resize', resize);
    parsed.searchParams.set('quality', '80');
    return parsed.toString();
  } catch {
    return trimmed;
  }
}
