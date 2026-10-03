'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { fetchPlaces, persistPlace, readStoredPlace, type Place } from '@/lib/places';
import { persistSubPlace, readSubPlace, scopeReady, validSubPlace } from '@/lib/sub-places';

type PlaceContextValue = {
  places: Place[];
  place: Place | null;
  loading: boolean;
  error: boolean;
  selectPlace: (id: string | null) => void;
  retry: () => void;
  subPlaceId: string | null;
  ready: boolean;
  selectSubPlace: (id: string | null) => void;
};
const PlaceContext = createContext<PlaceContextValue>({
  places: [], place: null, loading: true, error: false, selectPlace: () => {}, retry: () => {},
  subPlaceId: null, ready: false, selectSubPlace: () => {},
});
export const usePlace = () => useContext(PlaceContext);

export default function PlaceProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subPlaceId, setSubPlaceId] = useState<string | null>(null);
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
        setSubPlaceId(items.some(item => item.id === stored) ? readSubPlace(stored) : null);
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
    setSubPlaceId(readSubPlace(next));
    persistPlace(next);
  }, [places]);
  const selectSubPlace = useCallback((id: string | null) => {
    const next = validSubPlace(selectedId, id) ? id : null;
    setSubPlaceId(next);
    if (selectedId) persistSubPlace(selectedId, next);
  }, [selectedId]);
  const activePlace = places.find(item => item.id === selectedId) ?? null;
  const value = useMemo(() => ({
    places, place: activePlace, subPlaceId,
    ready: scopeReady(activePlace?.id ?? null, subPlaceId), selectSubPlace,
    loading, error, selectPlace, retry: () => setAttempt(current => current + 1),
  }), [places, activePlace, subPlaceId, selectSubPlace, loading, error, selectPlace]);
  return <PlaceContext.Provider value={value}>{children}</PlaceContext.Provider>;
}
