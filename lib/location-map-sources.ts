// Verified official sources, retrieved 2026-10-02. Link-only: no republication licence found.
export const kuMapSource = 'https://engineering.ku.edu.kw/ar/sabah-alsalem-university-city';
export const gustMapSource = 'https://www.gust.edu.kw/about-us/gust-campus-map';
export const gustAccessibleMap = 'https://www.gust.edu.kw/static/e0d74832-2e51-4e8f-9ae5-f2dde6ae687d.pdf';
export const paaetMapSource = 'https://www.paaet.edu.kw/ar/call/';
// Supported subset from PAAET's own current contact/directions directory.
// Labels identify colleges at distinct locations, not invented parking zones.
export const paaetCampuses = [
  { id: 'basic_education_ardiya', name_ar: 'كلية التربية الأساسية — العارضية', name_en: 'Basic Education College — Ardiya', url: 'https://maps.app.goo.gl/3yVUsKXQWvufRLTS7' },
  { id: 'basic_education_jahra', name_ar: 'كلية التربية الأساسية — الجهراء', name_en: 'Basic Education College — Jahra', url: 'https://maps.app.goo.gl/Zt6p5bPZ9vCg6vrR9' },
  { id: 'nursing_shuwaikh', name_ar: 'كلية التمريض — الشويخ التعليمية', name_en: 'College of Nursing — Shuwaikh Educational', url: 'https://maps.app.goo.gl/W4YkirMetQvqtMzk8' },
] as const;
