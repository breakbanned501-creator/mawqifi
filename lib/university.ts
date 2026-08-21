import type { Locale } from '@/lib/i18n';

export type College = {
  nameAr: string;
  nameEn: string;
  zone: 'A' | 'B';
  gates: string[];
  parking: string[];
};

export type CampusZone = {
  id: 'A' | 'B';
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  landmarkAr: string;
  landmarkEn: string;
};

export const gateLabels: Record<string, string> = {
  'Gate 2': 'البوابة ٢',
  'Gate 3': 'البوابة ٣',
  'Gate 4': 'البوابة ٤',
  'Gate 5': 'البوابة ٥',
  'Gate 6': 'البوابة ٦',
  'Gate 7': 'البوابة ٧',
};

const parkingAreaLabels: Record<string, { ar: string; en: string }> = {
  'مواقف كلية الآداب والتربية': {
    ar: 'مواقف كلية الآداب والتربية',
    en: 'Arts & Education parking',
  },
  'مواقف الطلاب A3': { ar: 'مواقف الطلاب A3', en: 'Student parking A3' },
  'مواقف الطلاب A4': { ar: 'مواقف الطلاب A4', en: 'Student parking A4' },
  'مواقف الطلاب A5': { ar: 'مواقف الطلاب A5', en: 'Student parking A5' },
  'مواقف كلية الهندسة والبترول': {
    ar: 'مواقف كلية الهندسة والبترول',
    en: 'Engineering & Petroleum parking',
  },
  'مواقف الطلاب B2': { ar: 'مواقف الطلاب B2', en: 'Student parking B2' },
  'مواقف الطلاب B3': { ar: 'مواقف الطلاب B3', en: 'Student parking B3' },
  'مواقف الطلاب B4': { ar: 'مواقف الطلاب B4', en: 'Student parking B4' },
  'مواقف الطلاب B5': { ar: 'مواقف الطلاب B5', en: 'Student parking B5' },
  'مواقف الزوار B': { ar: 'مواقف الزوار B', en: 'Visitor parking B' },
  'مواقف الطلاب B6': { ar: 'مواقف الطلاب B6', en: 'Student parking B6' },
};

export function formatGate(gate: string, locale: Locale = 'ar'): string {
  return locale === 'en' ? gate : gateLabels[gate] ?? gate;
}

export function formatZone(zone: 'A' | 'B', locale: Locale = 'ar'): string {
  if (locale === 'en') return `Zone ${zone}`;
  return zone === 'A' ? 'المنطقة أ' : 'المنطقة ب';
}

/** The database continues to store the official Arabic college value. */
export function getCollegeName(college: College | string, locale: Locale = 'ar'): string {
  const match = typeof college === 'string'
    ? kuColleges.find((item) => item.nameAr === college)
    : college;

  if (!match) return typeof college === 'string' ? college : college.nameAr;
  return locale === 'en' ? match.nameEn : match.nameAr;
}

export function formatParkingArea(parkingArea: string, locale: Locale = 'ar'): string {
  const label = parkingAreaLabels[parkingArea];
  return label ? label[locale] : parkingArea;
}

export function getZoneDescription(zone: CampusZone, locale: Locale = 'ar'): string {
  return locale === 'en' ? zone.descriptionEn : zone.descriptionAr;
}

export function getZoneLandmark(zone: CampusZone, locale: Locale = 'ar'): string {
  return locale === 'en' ? zone.landmarkEn : zone.landmarkAr;
}

export const kuZones: CampusZone[] = [
  {
    id: 'A',
    nameAr: 'المنطقة أ — الجنوب',
    nameEn: 'Zone A — South',
    descriptionAr: 'قرب كليات التربية والآداب والعلوم في الجنوب',
    descriptionEn: 'Near the Colleges of Education, Arts, and Science in the south.',
    landmarkAr: 'قرب مبنى الإدارة والمكتبة المركزية',
    landmarkEn: 'Near the Administration Building and Central Library.',
  },
  {
    id: 'B',
    nameAr: 'المنطقة ب — الشمال',
    nameEn: 'Zone B — North',
    descriptionAr: 'قرب كليات الهندسة والحقوق والشريعة في الشمال',
    descriptionEn: 'Near the Colleges of Engineering, Law, and Sharia in the north.',
    landmarkAr: 'قرب ساحة الهندسة والمواقف B',
    landmarkEn: 'Near the Engineering plaza and Zone B parking.',
  },
];

export const kuColleges: College[] = [
  { nameAr: 'كلية التربية', nameEn: 'Education', zone: 'A', gates: ['Gate 5'], parking: ['مواقف كلية الآداب والتربية'] },
  { nameAr: 'كلية الآداب', nameEn: 'Arts', zone: 'A', gates: ['Gate 2', 'Gate 3'], parking: ['مواقف كلية الآداب والتربية'] },
  { nameAr: 'كلية العلوم', nameEn: 'Science', zone: 'A', gates: ['Gate 4', 'Gate 5'], parking: ['مواقف الطلاب A3'] },
  { nameAr: 'كلية العلوم الإدارية', nameEn: 'Administrative Sciences', zone: 'A', gates: ['Gate 5'], parking: ['مواقف الطلاب A4'] },
  { nameAr: 'كلية العلوم الحياتية', nameEn: 'Life Sciences', zone: 'A', gates: ['Gate 4'], parking: ['مواقف الطلاب A5'] },
  { nameAr: 'كلية الهندسة والبترول', nameEn: 'Engineering & Petroleum', zone: 'B', gates: ['Gate 6', 'Gate 7'], parking: ['مواقف كلية الهندسة والبترول'] },
  { nameAr: 'كلية الحقوق', nameEn: 'Law', zone: 'B', gates: ['Gate 7'], parking: ['مواقف الطلاب B2'] },
  { nameAr: 'كلية الشريعة', nameEn: 'Sharia', zone: 'B', gates: ['Gate 6'], parking: ['مواقف الطلاب B3'] },
  { nameAr: 'كلية العلوم الاجتماعية', nameEn: 'Social Sciences', zone: 'B', gates: ['Gate 6', 'Gate 7'], parking: ['مواقف الطلاب B4'] },
  { nameAr: 'كلية الطب', nameEn: 'Medicine', zone: 'B', gates: ['Gate 6'], parking: ['مواقف الطلاب B5', 'مواقف الزوار B'] },
  { nameAr: 'كلية الصيدلة', nameEn: 'Pharmacy', zone: 'B', gates: ['Gate 7'], parking: ['مواقف الطلاب B6'] },
];

export const departurePresets = [5, 10, 15, 30];

export function collegesByZone(zone: 'A' | 'B') {
  return kuColleges.filter((college) => college.zone === zone);
}
