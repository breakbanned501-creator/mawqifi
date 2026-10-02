import type { Locale } from './i18n';
import { getCollegeName, formatGate, formatZone } from './university';

type Location = {
  place_id: string | null;
  place?: { name_ar: string; name_en: string } | null;
  college: string | null;
  zone: 'A' | 'B' | null;
  gate: string | null;
  location_description: string | null;
};
export function postLocationTitle(post: Location, locale: Locale): string {
  if (post.place_id === 'kuwait_university' && post.college) return getCollegeName(post.college, locale);
  return post.place?.[locale === 'ar' ? 'name_ar' : 'name_en'] ?? post.place_id ?? '';
}
export function postLocationDetails(post: Location, locale: Locale): string {
  if (post.place_id === 'kuwait_university') {
    return [post.zone ? formatZone(post.zone, locale) : '', post.gate ? formatGate(post.gate, locale) : ''].filter(Boolean).join(' — ');
  }
  return post.location_description ?? '';
}
