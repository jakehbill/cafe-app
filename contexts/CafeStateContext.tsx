import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { supabase } from '@/lib/supabase';

import { useAuth } from './AuthContext';

export type CafeRating = {
  coffee: number;
  work: number;
  vibe: number;
  tags: string[];
  notes: string;
};

type CafeStateContextValue = {
  savedCafeIds: string[];
  visitedCafeIds: string[];
  ratingsByCafeId: Record<string, CafeRating>;
  toggleSaved: (id: string) => Promise<void>;
  toggleVisited: (id: string) => Promise<void>;
  isSaved: (id: string) => boolean;
  isVisited: (id: string) => boolean;
  setCafeRating: (id: string, ratingData: CafeRating) => Promise<void>;
  getCafeRating: (id: string) => CafeRating | undefined;
};

const CafeStateContext = createContext<CafeStateContextValue | undefined>(undefined);

function rowsToRatingsMap(rows: { cafe_id: string; coffee: number; work: number; vibe: number; tags: string[] | null; notes: string | null }[]) {
  const next: Record<string, CafeRating> = {};
  for (const row of rows) {
    next[row.cafe_id] = {
      coffee: row.coffee,
      work: row.work,
      vibe: row.vibe,
      tags: row.tags ?? [],
      notes: row.notes ?? '',
    };
  }
  return next;
}

export function CafeStateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [savedCafeIds, setSavedCafeIds] = useState<string[]>([]);
  const [visitedCafeIds, setVisitedCafeIds] = useState<string[]>([]);
  const [ratingsByCafeId, setRatingsByCafeId] = useState<Record<string, CafeRating>>({});

  const savedRef = useRef<string[]>([]);
  const visitedRef = useRef<string[]>([]);
  savedRef.current = savedCafeIds;
  visitedRef.current = visitedCafeIds;

  const refreshUserCafeData = useCallback(async () => {
    if (!userId) {
      setSavedCafeIds([]);
      setVisitedCafeIds([]);
      setRatingsByCafeId({});
      return;
    }

    const [savedRes, visitedRes, ratingsRes] = await Promise.all([
      supabase.from('user_saved_cafes').select('cafe_id').eq('user_id', userId),
      supabase.from('user_visited_cafes').select('cafe_id').eq('user_id', userId),
      supabase
        .from('user_cafe_ratings')
        .select('cafe_id, coffee, work, vibe, tags, notes')
        .eq('user_id', userId),
    ]);

    if (savedRes.error) {
      console.error('Failed to load saved cafes', savedRes.error);
    } else {
      setSavedCafeIds((savedRes.data ?? []).map((row) => row.cafe_id));
    }

    if (visitedRes.error) {
      console.error('Failed to load visited cafes', visitedRes.error);
    } else {
      setVisitedCafeIds((visitedRes.data ?? []).map((row) => row.cafe_id));
    }

    if (ratingsRes.error) {
      console.error('Failed to load ratings', ratingsRes.error);
    } else {
      setRatingsByCafeId(rowsToRatingsMap(ratingsRes.data ?? []));
    }
  }, [userId]);

  useEffect(() => {
    void refreshUserCafeData();
  }, [refreshUserCafeData]);

  const toggleSaved = useCallback(
    async (id: string) => {
      console.log('current cafe id (toggleSaved):', id);
      console.log('current logged-in user id (toggleSaved):', userId ?? '(none)');

      if (!userId) {
        console.warn('Save: no logged-in user — cannot write to user_saved_cafes');
        return;
      }

      const currently = savedRef.current.includes(id);
      if (currently) {
        const deleteRes = await supabase
          .from('user_saved_cafes')
          .delete()
          .eq('user_id', userId)
          .eq('cafe_id', id)
          .select();
        console.log('Supabase delete (unsave) response:', {
          data: deleteRes.data,
          error: deleteRes.error,
        });
        if (deleteRes.error) {
          console.error('RLS / permission error (unsave):', deleteRes.error.message, deleteRes.error);
          return;
        }
      } else {
        const insertRes = await supabase
          .from('user_saved_cafes')
          .insert({ user_id: userId, cafe_id: id })
          .select();
        console.log('Supabase insert response:', {
          data: insertRes.data,
          error: insertRes.error,
        });
        if (insertRes.error) {
          console.error('RLS / permission error (save):', insertRes.error.message, insertRes.error);
          return;
        }
      }

      await refreshUserCafeData();
    },
    [userId, refreshUserCafeData]
  );

  const toggleVisited = useCallback(
    async (id: string) => {
      if (!userId) return;

      const currently = visitedRef.current.includes(id);
      if (currently) {
        const { error } = await supabase
          .from('user_visited_cafes')
          .delete()
          .eq('user_id', userId)
          .eq('cafe_id', id);
        if (error) {
          console.error('Failed to unmark visited', error);
          return;
        }
      } else {
        const { error } = await supabase.from('user_visited_cafes').insert({
          user_id: userId,
          cafe_id: id,
        });
        if (error) {
          console.error('Failed to mark visited', error);
          return;
        }
      }

      await refreshUserCafeData();
    },
    [userId, refreshUserCafeData]
  );

  function isSaved(id: string) {
    return savedCafeIds.includes(id);
  }

  function isVisited(id: string) {
    return visitedCafeIds.includes(id);
  }

  const setCafeRating = useCallback(
    async (id: string, ratingData: CafeRating) => {
      if (!userId) {
        throw new Error('You must be signed in to save a rating');
      }

      const { error } = await supabase.from('user_cafe_ratings').upsert(
        {
          user_id: userId,
          cafe_id: id,
          coffee: ratingData.coffee,
          work: ratingData.work,
          vibe: ratingData.vibe,
          tags: ratingData.tags,
          notes: ratingData.notes,
        },
        { onConflict: 'user_id,cafe_id' }
      );

      if (error) {
        console.error('Failed to save rating', error);
        throw error;
      }

      await refreshUserCafeData();
    },
    [userId, refreshUserCafeData]
  );

  function getCafeRating(id: string) {
    return ratingsByCafeId[id];
  }

  const value = useMemo(
    () => ({
      savedCafeIds,
      visitedCafeIds,
      ratingsByCafeId,
      toggleSaved,
      toggleVisited,
      isSaved,
      isVisited,
      setCafeRating,
      getCafeRating,
    }),
    [savedCafeIds, visitedCafeIds, ratingsByCafeId, toggleSaved, toggleVisited, setCafeRating]
  );

  return <CafeStateContext.Provider value={value}>{children}</CafeStateContext.Provider>;
}

export function useCafeState() {
  const context = useContext(CafeStateContext);

  if (!context) {
    throw new Error('useCafeState must be used within a CafeStateProvider');
  }

  return context;
}
