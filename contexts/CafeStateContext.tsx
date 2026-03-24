import React, { createContext, useContext, useMemo, useState } from 'react';

type CafeStateContextValue = {
  savedCafeIds: string[];
  visitedCafeIds: string[];
  toggleSaved: (id: string) => void;
  toggleVisited: (id: string) => void;
  isSaved: (id: string) => boolean;
  isVisited: (id: string) => boolean;
};

const CafeStateContext = createContext<CafeStateContextValue | undefined>(undefined);

export function CafeStateProvider({ children }: { children: React.ReactNode }) {
  const [savedCafeIds, setSavedCafeIds] = useState<string[]>([]);
  const [visitedCafeIds, setVisitedCafeIds] = useState<string[]>([]);

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

  const value = useMemo(
    () => ({
      savedCafeIds,
      visitedCafeIds,
      toggleSaved,
      toggleVisited,
      isSaved,
      isVisited,
    }),
    [savedCafeIds, visitedCafeIds]
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

