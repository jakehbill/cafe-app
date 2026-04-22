import { supabase } from '@/lib/supabase';

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateCafeSlug(name: string, area?: string | null): string {
  const namePart = slugPart(name);
  const areaPart = slugPart(area ?? '');
  const base = [namePart, areaPart].filter(Boolean).join('-');
  return base.length > 0 ? base : 'cafe';
}

export async function generateUniqueCafeSlug(name: string, area?: string | null): Promise<string> {
  const base = generateCafeSlug(name, area);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const res = await supabase.from('cafes').select('id').eq('slug', candidate).limit(1);
    if (res.error) {
      throw new Error(res.error.message);
    }
    if (!res.data || res.data.length === 0) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
