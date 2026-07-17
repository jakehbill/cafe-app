import { invalidateCafeCatalogCache } from '@/lib/cafeCatalogCache';
import { clearTopTagsCache } from '@/lib/supabase';

type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribe to catalog invalidation (e.g. after a workspace review is saved). */
export function subscribeCafeCatalogInvalidation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Drop in-memory catalog + tag caches and ask list screens to refetch.
 * Call after a visit/review write so Home/Search cards leave "New".
 */
export function notifyCafeCatalogChanged(): void {
  invalidateCafeCatalogCache();
  clearTopTagsCache();
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (e) {
      console.warn('[notifyCafeCatalogChanged] listener failed', e);
    }
  }
}
