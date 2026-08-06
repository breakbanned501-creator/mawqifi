/**
 * Map screen — Kuwait University Al-Shadadiya campus maps.
 *
 * Displays two official campus maps as static, zoomable images:
 *   1. Campus overview showing all gate locations
 *   2. Parking zones map (Zone A, Zone B) with college colour coding
 *
 * No live GPS is used — these are the university's official map images.
 * Pinch-to-zoom is enabled via ScrollView on iOS/Android.
 */

import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const SCREEN_WIDTH = Dimensions.get("window").width;

// Static campus map images
const campusMapImage = require("../../assets/images/map_campus.png");
const zonesMapImage = require("../../assets/images/map_zones.png");

type MapView = "campus" | "zones";

const GATES = [
  { id: "2", label: "بوابة 2", desc: "المدخل الرئيسي — الجانب الشرقي", kind: "main" },
  { id: "3", label: "بوابة 3", desc: "مدخل طلاب — الشمال الشرقي", kind: "main" },
  { id: "4", label: "بوابة 4", desc: "مدخل شاحنات — الجنوب", kind: "truck" },
  { id: "5", label: "بوابة 5", desc: "بوابة الطلاب الرئيسية — الجنوب", kind: "main" },
  { id: "6", label: "بوابة 6", desc: "بوابة طلاب — الجنوب الغربي", kind: "main" },
  { id: "7", label: "بوابة 7", desc: "بوابة طلاب — الغرب", kind: "main" },
  { id: "9", label: "بوابة 9", desc: "مدخل شاحنات — الشمال الغربي", kind: "truck" },
];

const ZONES = [
  {
    label: "Zone A",
    color: "#F59E0B",
    title: "مواقف كلية الآداب والتربية",
    gates: "بوابة 4 · بوابة 5",
    colleges: ["كلية الآداب", "كلية التربية"],
  },
  {
    label: "Zone B",
    color: "#8B5CF6",
    title: "مواقف الهندسة، العلوم، الإدارية",
    gates: "بوابة 5 · بوابة 6 · بوابة 7",
    colleges: [
      "كلية الهندسة والبترول",
      "كلية العلوم",
      "كلية العلوم الحياتية",
      "كلية العلوم الإدارية",
      "كلية العلوم الاجتماعية",
      "كلية الشريعة والدراسات الإسلامية",
      "كلية الحقوق",
    ],
  },
];

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeView, setActiveView] = useState<MapView>("campus");
  const [imageError, setImageError] = useState(false);

  const mapH = Math.round(SCREEN_WIDTH * 0.85);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Tab switcher */}
      <View
        style={[
          styles.switcher,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {(["campus", "zones"] as MapView[]).map((tab) => {
          const active = activeView === tab;
          const label = tab === "campus" ? "خريطة الحرم" : "مناطق المواقف";
          return (
            <Pressable
              key={tab}
              style={[styles.switchBtn, active && { backgroundColor: colors.accent }]}
              onPress={() => setActiveView(tab)}
            >
              <Text
                style={[
                  styles.switchText,
                  {
                    color: active ? colors.accentForeground : colors.mutedForeground,
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Map image — zoomable via ScrollView on iOS/Android */}
      <View
        style={[
          styles.mapWrapper,
          { borderColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <ScrollView
          style={{ height: mapH }}
          contentContainerStyle={{ height: mapH }}
          minimumZoomScale={1}
          maximumZoomScale={4}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          centerContent
          scrollEnabled={Platform.OS !== "web"}
        >
          {imageError ? (
            <View style={[styles.errorContainer, { backgroundColor: `${colors.muted}20` }]}>
              <Feather name="image" size={32} color={colors.mutedForeground} />
              <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
                تعذر تحميل الخريطة
              </Text>
            </View>
          ) : (
            <Image
              source={activeView === "campus" ? campusMapImage : zonesMapImage}
              style={{ width: SCREEN_WIDTH - 32, height: mapH }}
              contentFit="contain"
              transition={200}
              onError={() => setImageError(true)}
            />
          )}
        </ScrollView>

        <View style={[styles.zoomHintRow]}>
          <Feather name="zoom-in" size={11} color={colors.mutedForeground} />
          <Text style={[styles.zoomHint, { color: colors.mutedForeground }]}>
            {Platform.OS === "ios" || Platform.OS === "android"
              ? "اضغط مطولاً للتكبير بإصبعين"
              : "خريطة مكبّرة — استخدم عجلة الفأرة للتكبير"}
          </Text>
        </View>
      </View>

      {/* Info section */}
      <View style={styles.infoSection}>
        {activeView === "campus" ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              البوابات
            </Text>
            {GATES.map((g) => (
              <View
                key={g.id}
                style={[
                  styles.gateRow,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.gatePill,
                    {
                      backgroundColor:
                        g.kind === "main"
                          ? `${colors.primary}20`
                          : `${colors.warning}20`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.gatePillText,
                      {
                        color:
                          g.kind === "main" ? colors.primary : colors.warning,
                      },
                    ]}
                  >
                    {g.label}
                  </Text>
                </View>
                <Text
                  style={[styles.gateDesc, { color: colors.mutedForeground }]}
                >
                  {g.desc}
                </Text>
              </View>
            ))}
          </>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              مناطق المواقف
            </Text>
            {ZONES.map((z) => (
              <View
                key={z.label}
                style={[
                  styles.zoneCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                {/* Zone header */}
                <View style={styles.zoneCardHeader}>
                  <View
                    style={[styles.zoneColorDot, { backgroundColor: z.color }]}
                  />
                  <Text
                    style={[styles.zoneCardLabel, { color: colors.foreground }]}
                  >
                    {z.label}
                  </Text>
                  <Text
                    style={[
                      styles.zoneCardTitle,
                      { color: colors.mutedForeground },
                    ]}
                    numberOfLines={1}
                  >
                    {z.title}
                  </Text>
                </View>

                {/* Gates row */}
                <View
                  style={[
                    styles.zoneGatesRow,
                    { borderTopColor: colors.border },
                  ]}
                >
                  <Feather name="map-pin" size={12} color={z.color} />
                  <Text style={[styles.zoneGatesText, { color: z.color }]}>
                    {z.gates}
                  </Text>
                </View>

                {/* Colleges */}
                <View style={styles.collegeWrap}>
                  {z.colleges.map((c) => (
                    <View
                      key={c}
                      style={[
                        styles.collegeChip,
                        {
                          backgroundColor: `${z.color}18`,
                          borderColor: `${z.color}40`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.collegeChipText,
                          { color: colors.foreground },
                        ]}
                      >
                        {c}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  switcher: {
    flexDirection: "row",
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  switchText: { fontSize: 13, fontWeight: "700" as const },
  mapWrapper: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  zoomHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
  },
  zoomHint: { fontSize: 11 },
  infoSection: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700" as const, marginBottom: 4 },
  gateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  gatePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    minWidth: 72,
    alignItems: "center",
  },
  gatePillText: { fontSize: 12, fontWeight: "700" as const },
  gateDesc: { fontSize: 13, flex: 1 },
  zoneCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  zoneCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  zoneColorDot: { width: 12, height: 12, borderRadius: 6 },
  zoneCardLabel: { fontSize: 15, fontWeight: "700" as const },
  zoneCardTitle: { fontSize: 12, flex: 1 },
  zoneGatesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
  },
  zoneGatesText: { fontSize: 12, fontWeight: "600" as const },
  collegeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 12,
  },
  collegeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  collegeChipText: { fontSize: 11 },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 40,
  },
  errorText: { fontSize: 14, textAlign: "center" },
});
