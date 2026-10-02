import { getSupabase } from './supabase';
import type { Locale } from './i18n';

export const PLACE_STORAGE_KEY = 'mawqifi_place';
export const LOCATION_DESCRIPTION_MAX = 500;
export type Place = {
  id: string;
  name_ar: string;
  name_en: string;
  place_type: string | null;
  active: boolean;
  sort_order: number;
};
export function placeName(place: Pick<Place, 'name_ar' | 'name_en'>, locale: Locale): string {
  return locale === 'ar' ? place.name_ar : place.name_en;
}
export async function fetchPlaces(): Promise<Place[]> {
  const { data, error } = await getSupabase().from('places')
    .select('id,name_ar,name_en,place_type,active,sort_order')
    .eq('active', true).order('sort_order').order('id');
  if (error) throw error;
  return data ?? [];
}
export function usefulLocationDescription(value: string): boolean {
  const visible = value.replace(/[\s\u200B-\u200F\uFEFF]/g, '');
  return Array.from(visible).length >= 3 && Array.from(value).length <= LOCATION_DESCRIPTION_MAX;
}
export function readStoredPlace(): string | null {
  try { return window.localStorage.getItem(PLACE_STORAGE_KEY); } catch { return null; }
}
export function persistPlace(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(PLACE_STORAGE_KEY, id);
    else window.localStorage.removeItem(PLACE_STORAGE_KEY);
  } catch { /* Selection still works when device storage is unavailable. */ }
}
