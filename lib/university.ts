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
  description: string;
  landmark: string;
};

export const gateLabels: Record<string, string> = {
  'Gate 2': 'البوابة ٢',
  'Gate 3': 'البوابة ٣',
  'Gate 4': 'البوابة ٤',
  'Gate 5': 'البوابة ٥',
  'Gate 6': 'البوابة ٦',
  'Gate 7': 'البوابة ٧',
};

export function formatGate(gate: string): string {
  return gateLabels[gate] ?? gate;
}

export function formatZone(zone: 'A' | 'B'): string {
  return zone === 'A' ? 'المنطقة أ' : 'المنطقة ب';
}

export const kuZones: CampusZone[] = [
  {
    id: 'A',
    nameAr: 'المنطقة أ — الجنوب',
    nameEn: 'Zone A — South',
    description: 'قرب كليات التربية والآداب والعلوم في الجنوب',
    landmark: 'قرب مبنى الإدارة والمكتبة المركزية',
  },
  {
    id: 'B',
    nameAr: 'المنطقة ب — الشمال',
    nameEn: 'Zone B — North',
    description: 'قرب كليات الهندسة والحقوق والشريعة في الشمال',
    landmark: 'قرب ساحة الهندسة والمواقف B',
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
