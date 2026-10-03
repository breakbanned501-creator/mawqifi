import { kuColleges } from './university';
import type { Locale } from './i18n';

export type SubPlace = { id: string; nameAr: string; nameEn: string };
// Stable IDs follow the existing college list; labels remain its legacy contract.
const kuIds: Record<string, string> = {
  Education: 'education', Arts: 'arts', Science: 'science',
  'Administrative Sciences': 'administrative_sciences', 'Life Sciences': 'life_sciences',
  'Engineering & Petroleum': 'engineering_petroleum', Law: 'law', Sharia: 'sharia',
  'Social Sciences': 'social_sciences', Medicine: 'medicine', Pharmacy: 'pharmacy',
};
export const kuSubPlaces: SubPlace[] = kuColleges.map((college) => ({
  id: kuIds[college.nameEn], nameAr: college.nameAr, nameEn: college.nameEn,
}));
// Supported subset of the official directory, documented in location-map-sources.md.
export const paaetSubPlaces: SubPlace[] = [
  { id: 'basic_education_ardiya', nameAr: 'كلية التربية الأساسية — العارضية', nameEn: 'Basic Education — Ardiya' },
  { id: 'basic_education_jahra', nameAr: 'كلية التربية الأساسية — الجهراء', nameEn: 'Basic Education — Jahra' },
  { id: 'nursing_shuwaikh', nameAr: 'كلية التمريض — الشويخ التعليمية', nameEn: 'Nursing — Shuwaikh Educational' },
];
export function subPlacesFor(placeId: string | null): SubPlace[] {
  return placeId === 'kuwait_university' ? kuSubPlaces : placeId === 'paaet' ? paaetSubPlaces : [];
}
export function requiresSubPlace(placeId: string | null): boolean {
  return placeId === 'kuwait_university' || placeId === 'paaet';
}
export function validSubPlace(placeId: string | null, id: string | null): boolean {
  return subPlacesFor(placeId).some(item => item.id === id);
}
export function scopeReady(placeId: string | null, id: string | null): boolean {
  return Boolean(placeId) && (!requiresSubPlace(placeId) || validSubPlace(placeId, id));
}
export function subPlaceName(item: SubPlace, locale: Locale): string {
  return locale === 'ar' ? item.nameAr : item.nameEn;
}
const STORAGE_KEY = 'mawqifi_sub_places_v1';
export function readSubPlace(placeId: string | null): string | null {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    const id = saved && typeof saved === 'object' && placeId ? (saved as Record<string, unknown>)[placeId] : null;
    return typeof id === 'string' && validSubPlace(placeId, id) ? id : null;
  } catch { return null; }
}
export function persistSubPlace(placeId: string, id: string | null): void {
  try {
    const saved = Object.fromEntries(['kuwait_university', 'paaet'].map(place => [place, readSubPlace(place)]));
    saved[placeId] = validSubPlace(placeId, id) ? id : null;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch { /* Selection remains usable when storage is unavailable. */ }
}
