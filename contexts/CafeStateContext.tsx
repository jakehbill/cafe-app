import React, { createContext, useContext, useMemo, useState } from 'react';

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
  toggleSaved: (id: string) => void;
  toggleVisited: (id: string) => void;
  isSaved: (id: string) => boolean;
  isVisited: (id: string) => boolean;
  setCafeRating: (id: string, ratingData: CafeRating) => void;
  getCafeRating: (id: string) => CafeRating | undefined;
};

const CafeStateContext = createContext<CafeStateContextValue | undefined>(undefined);

export function CafeStateProvider({ children }: { children: React.ReactNode }) {
  const [savedCafeIds, setSavedCafeIds] = useState<string[]>([]);
  const [visitedCafeIds, setVisitedCafeIds] = useState<string[]>([]);
  const [ratingsByCafeId, setRatingsByCafeId] = useState<Record<string, CafeRating>>({});

  function toggleSaved(id: string) {
    setSavedCafeIds((prev) =>
      prev.includes(id) ? prev.filter((cafeId) => cafeId !== id) : [...prev, id]
    );
  }

  function toggleVisited(id: string) {
    setVisitedCafeIds((prev) =>
      prev.includes(id) ? prev.filter((cafeId) => cafeId !== id) : [...prev, id]
    );
  }

  function isSaved(id: string) {
    return savedCafeIds.includes(id);
  }

  function isVisited(id: string) {
    return visitedCafeIds.includes(id);
  }

  function setCafeRating(id: string, ratingData: CafeRating) {
    setRatingsByCafeId((prev) => ({
      ...prev,
      [id]: ratingData,
    }));
  }

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
    [savedCafeIds, visitedCafeIds, ratingsByCafeId]
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

