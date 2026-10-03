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
export type PaaetInstitution = SubPlace & { campuses: SubPlace[] };
// Official contact directory, checked 2026-10-03. Existing scope IDs stay stable.
// Shared directory entries (e.g. Health Sciences boys/girls) are not split by inference.
export const paaetInstitutions: PaaetInstitution[] = [
  { id: 'basic_education', nameAr: 'كلية التربية الأساسية', nameEn: 'Basic Education', campuses: [
    { id: 'basic_education_ardiya', nameAr: 'العارضية', nameEn: 'Ardiya' },
    { id: 'basic_education_jahra', nameAr: 'الجهراء', nameEn: 'Jahra' },
  ] },
  { id: 'nursing_college', nameAr: 'كلية التمريض', nameEn: 'Nursing College', campuses: [
    { id: 'nursing_shuwaikh', nameAr: 'الشويخ التعليمية', nameEn: 'Shuwaikh Educational' },
  ] },
  { id: 'health_sciences', nameAr: 'كلية العلوم الصحية', nameEn: 'Health Sciences', campuses: [
    { id: 'health_sciences_shuwaikh', nameAr: 'الشويخ التعليمية — بنات وبنين', nameEn: 'Shuwaikh Educational — girls and boys' },
  ] },
  { id: 'technological_studies', nameAr: 'كلية الدراسات التكنولوجية', nameEn: 'Technological Studies', campuses: [
    { id: 'technological_studies_shuwaikh', nameAr: 'الشويخ التعليمية', nameEn: 'Shuwaikh Educational' },
  ] },
  { id: 'business_studies', nameAr: 'كلية الدراسات التجارية', nameEn: 'Business Studies', campuses: [
    { id: 'business_studies_ardiya', nameAr: 'العارضية', nameEn: 'Ardiya' },
  ] },
  { id: 'communications_navigation', nameAr: 'المعهد العالي للاتصالات والملاحة', nameEn: 'Higher Institute of Communications and Navigation', campuses: [
    { id: 'communications_navigation_shuwaikh', nameAr: 'الشويخ التعليمية', nameEn: 'Shuwaikh Educational' },
  ] },
  { id: 'energy', nameAr: 'المعهد العالي للطاقة', nameEn: 'Higher Institute of Energy', campuses: [
    { id: 'energy_shuwaikh', nameAr: 'الشويخ التعليمية', nameEn: 'Shuwaikh Educational' },
  ] },
  { id: 'industrial_training', nameAr: 'المعهد الصناعي', nameEn: 'Industrial Training Institute', campuses: [
    { id: 'industrial_shuwaikh', nameAr: 'الشويخ التعليمية', nameEn: 'Shuwaikh Educational' },
    { id: 'industrial_sabah_al_salem', nameAr: 'صباح السالم', nameEn: 'Sabah Al-Salem' },
  ] },
  { id: 'nursing_institute', nameAr: 'معهد التمريض', nameEn: 'Nursing Institute', campuses: [
    { id: 'nursing_institute_shuwaikh', nameAr: 'الشويخ التعليمية — شارع الجاحظ', nameEn: 'Shuwaikh Educational — Al-Jahiz Street' },
  ] },
  { id: 'administrative_services', nameAr: 'المعهد العالي للخدمات الإدارية', nameEn: 'Higher Institute of Administrative Services', campuses: [
    { id: 'administrative_services_hawally_girls', nameAr: 'حولي — بنات — شارع 133', nameEn: 'Hawally — girls — Street 133' },
    { id: 'administrative_services_hawally_boys', nameAr: 'حولي — بنين — شارع بيروت', nameEn: 'Hawally — boys — Beirut Street' },
  ] },
  { id: 'construction_training', nameAr: 'معهد التدريب الإنشائي', nameEn: 'Construction Training Institute', campuses: [
    { id: 'construction_south_sabahiya', nameAr: 'جنوب الصباحية', nameEn: 'South Sabahiya' },
  ] },
  { id: 'vocational_training', nameAr: 'معهد التدريب المهني', nameEn: 'Vocational Training Institute', campuses: [
    { id: 'vocational_sharq', nameAr: 'شرق', nameEn: 'Sharq' },
  ] },
];
export const paaetSubPlaces: SubPlace[] = paaetInstitutions.flatMap(institution =>
  institution.campuses.map(campus => ({
    id: campus.id, nameAr: `${institution.nameAr} — ${campus.nameAr}`,
    nameEn: `${institution.nameEn} — ${campus.nameEn}`,
  })));
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
