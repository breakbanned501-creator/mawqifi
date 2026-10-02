'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { fetchPlaces, persistPlace, readStoredPlace, type Place } from '@/lib/places';

type PlaceContextValue = {
  places: Place[];
  place: Place | null;
  loading: boolean;
  error: boolean;
  selectPlace: (id: string | null) => void;
  retry: () => void;
};
const PlaceContext = createContext<PlaceContextValue>({
  places: [], place: null, loading: true, error: false, selectPlace: () => {}, retry: () => {},
});
export const usePlace = () => useContext(PlaceContext);

export default function PlaceProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const hydrated = useRef(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void fetchPlaces().then(items => {
      if (cancelled) return;
      setPlaces(items);
      const stored = hydrated.current ? null : readStoredPlace();
      if (!hydrated.current) {
        setSelectedId(items.some(item => item.id === stored) ? stored : null);
        hydrated.current = true;
      } else {
        setSelectedId(current => items.some(item => item.id === current) ? current : null);
      }
    }).catch(() => {
      if (!cancelled) { setError(true); setPlaces([]); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt, userId]);
  const selectPlace = useCallback((id: string | null) => {
    const next = places.some(item => item.id === id) ? id : null;
    setSelectedId(next);
    persistPlace(next);
  }, [places]);
  const value = useMemo(() => ({
    places, place: places.find(item => item.id === selectedId) ?? null,
    loading, error, selectPlace, retry: () => setAttempt(current => current + 1),
  }), [places, selectedId, loading, error, selectPlace]);
  return <PlaceContext.Provider value={value}>{children}</PlaceContext.Provider>;
}
