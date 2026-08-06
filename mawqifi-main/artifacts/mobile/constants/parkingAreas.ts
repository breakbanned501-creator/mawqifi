/**
 * Kuwait University Al-Shadadiya — parking areas and college list.
 *
 * Areas are organised by the two student parking zones shown on the official
 * campus map (Zone A and Zone B), individual gate entries, and general lots.
 *
 * Zone A  — مواقف كلية الآداب والتربية          (أقرب البوابات: 4, 5)
 * Zone B  — مواقف الهندسة / العلوم / الإدارية   (أقرب البوابات: 5, 6, 7)
 * Gates   — إدخالات سريعة بالبوابة المحددة
 * General — مواقف عامة وأماكن مشتركة
 */

import type { ParkingArea } from "@/types";

/** All parking areas at KU Al-Shadadiya, grouped by zone. */
export const PARKING_AREAS: ParkingArea[] = [
  // ── Zone A ── مواقف كلية الآداب والتربية ──────────────────────────────
  {
    id: "zone-a-arts",
    name: "Zone A — كلية الآداب",
    nameEn: "Zone A — Arts",
    zone: "A",
    gates: ["Gate 4", "Gate 5"],
    coordinate: { latitude: 29.3108, longitude: 47.9208 },
  },
  {
    id: "zone-a-edu",
    name: "Zone A — كلية التربية",
    nameEn: "Zone A — Education",
    zone: "A",
    gates: ["Gate 4", "Gate 5"],
    coordinate: { latitude: 29.3115, longitude: 47.9200 },
  },

  // ── Zone B ── مواقف الهندسة / العلوم / الإدارية ───────────────────────
  {
    id: "zone-b-eng",
    name: "Zone B — الهندسة والبترول",
    nameEn: "Zone B — Engineering & Petroleum",
    zone: "B",
    gates: ["Gate 5", "Gate 6"],
    coordinate: { latitude: 29.3112, longitude: 47.9218 },
  },
  {
    id: "zone-b-sci",
    name: "Zone B — كلية العلوم",
    nameEn: "Zone B — Science",
    zone: "B",
    gates: ["Gate 5", "Gate 6"],
    coordinate: { latitude: 29.3120, longitude: 47.9210 },
  },
  {
    id: "zone-b-bio",
    name: "Zone B — العلوم الحياتية",
    nameEn: "Zone B — Life Sciences",
    zone: "B",
    gates: ["Gate 5", "Gate 6"],
    coordinate: { latitude: 29.3122, longitude: 47.9198 },
  },
  {
    id: "zone-b-biz",
    name: "Zone B — العلوم الإدارية",
    nameEn: "Zone B — Business",
    zone: "B",
    gates: ["Gate 6", "Gate 7"],
    coordinate: { latitude: 29.3130, longitude: 47.9200 },
  },
  {
    id: "zone-b-social",
    name: "Zone B — العلوم الاجتماعية",
    nameEn: "Zone B — Social Sciences",
    zone: "B",
    gates: ["Gate 6", "Gate 7"],
    coordinate: { latitude: 29.3128, longitude: 47.9188 },
  },
  {
    id: "zone-b-sharia",
    name: "Zone B — كلية الشريعة",
    nameEn: "Zone B — Sharia",
    zone: "B",
    gates: ["Gate 6", "Gate 7"],
    coordinate: { latitude: 29.3135, longitude: 47.9215 },
  },
  {
    id: "zone-b-law",
    name: "Zone B — كلية الحقوق",
    nameEn: "Zone B — Law",
    zone: "B",
    gates: ["Gate 6", "Gate 7"],
    coordinate: { latitude: 29.3140, longitude: 47.9205 },
  },

  // ── Gates ── إدخالات سريعة بالبوابة ──────────────────────────────────
  {
    id: "gate2",
    name: "عند بوابة 2",
    nameEn: "Gate 2 Area",
    zone: "gate",
    gates: ["Gate 2"],
    coordinate: { latitude: 29.3145, longitude: 47.9225 },
  },
  {
    id: "gate3",
    name: "عند بوابة 3",
    nameEn: "Gate 3 Area",
    zone: "gate",
    gates: ["Gate 3"],
    coordinate: { latitude: 29.3148, longitude: 47.9215 },
  },
  {
    id: "gate5",
    name: "عند بوابة 5",
    nameEn: "Gate 5 Area",
    zone: "gate",
    gates: ["Gate 5"],
    coordinate: { latitude: 29.3095, longitude: 47.9202 },
  },
  {
    id: "gate6",
    name: "عند بوابة 6",
    nameEn: "Gate 6 Area",
    zone: "gate",
    gates: ["Gate 6"],
    coordinate: { latitude: 29.3092, longitude: 47.9195 },
  },
  {
    id: "gate7",
    name: "عند بوابة 7",
    nameEn: "Gate 7 Area",
    zone: "gate",
    gates: ["Gate 7"],
    coordinate: { latitude: 29.3100, longitude: 47.9182 },
  },

  // ── General ── مواقف عامة ─────────────────────────────────────────────
  {
    id: "south-lot",
    name: "مواقف الحرم الجنوبي",
    nameEn: "South Campus Lot",
    zone: "general",
    coordinate: { latitude: 29.3090, longitude: 47.9200 },
  },
  {
    id: "north-lot",
    name: "مواقف الحرم الشمالي",
    nameEn: "North Campus Lot",
    zone: "general",
    coordinate: { latitude: 29.3150, longitude: 47.9200 },
  },
  {
    id: "shared",
    name: "المواقف المشتركة",
    nameEn: "Shared Lot",
    zone: "general",
    coordinate: { latitude: 29.3117, longitude: 47.9204 },
  },
];

/** All Kuwait University colleges for the "Nearby Building" picker. */
export const NEARBY_BUILDINGS: string[] = [
  "كلية الآداب",
  "كلية التربية",
  "كلية الهندسة والبترول",
  "كلية العلوم",
  "كلية العلوم الحياتية",
  "كلية العلوم الإدارية",
  "كلية العلوم الاجتماعية",
  "كلية الشريعة والدراسات الإسلامية",
  "كلية الحقوق",
  "المبنى الإداري",
  "المكتبة المركزية",
  "الكافيتيريا المركزية",
  "المسجد الجامعي",
];

/** Convenience lookup: parking area by id. */
export function getParkingAreaById(id: string): ParkingArea | undefined {
  return PARKING_AREAS.find((a) => a.id === id);
}
