/**
 * Create Post screen — students fill in their parking details and publish.
 *
 * Design goals: tap-to-select (no typing required for area/time),
 * optional text fields for extra details, submit within seconds.
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEPARTURE_PRESETS } from "@/constants/config";
import { NEARBY_BUILDINGS, PARKING_AREAS } from "@/constants/parkingAreas";
import { usePosts } from "@/context/PostsContext";
import { useUser } from "@/context/UserContext";
import { useColors } from "@/hooks/useColors";

export default function CreateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId } = useUser();
  const { createPost, refresh } = usePosts();

  const [selectedArea, setSelectedArea] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [carDescription, setCarDescription] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customNote, setCustomNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = selectedArea.length > 0 && selectedPreset !== null;

  const handleSubmit = useCallback(async () => {
    if (!isValid || isSubmitting) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSubmitting(true);

    try {
      const preset = DEPARTURE_PRESETS[selectedPreset!];
      const departureTime = new Date(
        Date.now() + preset.minutesFromNow * 60_000
      ).toISOString();

      await createPost({
        userId,
        parkingArea: selectedArea,
        nearbyBuilding: selectedBuilding || undefined,
        carDescription: carDescription.trim() || undefined,
        departureTime,
        departureNote: customNote.trim() || preset.label,
      });

      // Refresh feed so the new post appears immediately on the home tab
      await refresh();

      // Reset form
      setSelectedArea("");
      setSelectedBuilding("");
      setCarDescription("");
      setSelectedPreset(null);
      setCustomNote("");

      router.replace("/(tabs)");
    } catch (err) {
      console.error("[Create] Failed to publish post:", err);
      Alert.alert(
        "تعذّر النشر",
        "لم نتمكن من نشر موقفك. تحقق من اتصالك بالإنترنت وحاول مجدداً.",
        [{ text: "حسناً" }]
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [isValid, isSubmitting, selectedPreset, selectedArea, selectedBuilding, carDescription, customNote, createPost, refresh, userId]);

  const paddingBottom = Platform.OS === "web"
    ? insets.bottom + 34 + 100
    : insets.bottom + 100;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Parking Area — grouped by zone ─────────────── */}
        <SectionLabel label="اختر منطقة الموقف" required colors={colors} />
        {(
          [
            { zone: "A",       label: "Zone A",      desc: "الآداب · التربية",               color: "#F59E0B" },
            { zone: "B",       label: "Zone B",      desc: "الهندسة · العلوم · الإدارية",   color: "#8B5CF6" },
            { zone: "gate",    label: "البوابات",    desc: "Gate 2 – 7",                      color: colors.accent },
            { zone: "general", label: "مواقف عامة", desc: "",                                 color: colors.mutedForeground },
          ] as const
        ).map(({ zone, label, desc, color }) => {
          const areas = PARKING_AREAS.filter((a) => a.zone === zone);
          if (areas.length === 0) return null;
          return (
            <View key={zone}>
              {/* Zone header label */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                  marginTop: 4,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: color,
                  }}
                />
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 13,
                    fontWeight: "700" as const,
                  }}
                >
                  {label}
                </Text>
                {desc ? (
                  <Text
                    style={{ color: colors.mutedForeground, fontSize: 11 }}
                  >
                    {desc}
                  </Text>
                ) : null}
              </View>

              {/* Zone chips */}
              <View style={[styles.chipGrid, { marginBottom: 14 }]}>
                {areas.map((area) => {
                  const active = selectedArea === area.name;
                  return (
                    <Pressable
                      key={area.id}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? color : colors.card,
                          borderColor: active ? color : colors.border,
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedArea(active ? "" : area.name);
                      }}
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: active
                              ? zone === "A"
                                ? "#1a0800"
                                : "#fff"
                              : colors.foreground,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {area.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* ─── Nearby College ────────────────────────────────── */}
        <SectionLabel label="الكلية / المبنى القريب" colors={colors} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalRow}
        >
          {NEARBY_BUILDINGS.map((building) => {
            const active = selectedBuilding === building;
            return (
              <Pressable
                key={building}
                style={[
                  styles.hChip,
                  {
                    backgroundColor: active ? colors.secondary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedBuilding(active ? "" : building);
                }}
              >
                <Text
                  style={[
                    styles.hChipText,
                    { color: active ? colors.secondaryForeground : colors.mutedForeground },
                  ]}
                >
                  {building}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ─── Car Description ───────────────────────────────── */}
        <SectionLabel label="وصف السيارة (اختياري)" colors={colors} />
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.foreground,
            },
          ]}
          placeholder="مثال: جيب أسود، كامري فضي"
          placeholderTextColor={colors.mutedForeground}
          value={carDescription}
          onChangeText={setCarDescription}
          returnKeyType="done"
          maxLength={60}
        />

        {/* ─── Departure Time ────────────────────────────────── */}
        <SectionLabel label="وقت المغادرة" required colors={colors} />
        <View style={styles.presetGrid}>
          {DEPARTURE_PRESETS.map((preset, index) => {
            const active = selectedPreset === index;
            return (
              <Pressable
                key={preset.label}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedPreset(active ? null : index);
                }}
              >
                <Feather
                  name="clock"
                  size={13}
                  color={active ? "#fff" : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.presetText,
                    { color: active ? "#fff" : colors.foreground },
                  ]}
                >
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ─── Extra Note ────────────────────────────────────── */}
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.foreground,
              marginTop: 12,
            },
          ]}
          placeholder="ملاحظة إضافية (اختياري)"
          placeholderTextColor={colors.mutedForeground}
          value={customNote}
          onChangeText={setCustomNote}
          returnKeyType="done"
          maxLength={80}
        />

        {/* ─── Submit ─────────────────────────────────────────── */}
        <Pressable
          style={[
            styles.submitBtn,
            {
              backgroundColor: isValid ? colors.primary : colors.muted,
              opacity: isValid ? 1 : 0.5,
            },
          ]}
          onPress={handleSubmit}
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="send" size={16} color="#fff" />
              <Text style={styles.submitText}>نشر الموقف</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Reusable section label with optional required star. */
function SectionLabel({
  label,
  required,
  colors,
}: {
  label: string;
  required?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={sectionStyles.row}>
      <Text style={[sectionStyles.text, { color: colors.foreground }]}>{label}</Text>
      {required ? (
        <Text style={[sectionStyles.star, { color: colors.accent }]}>*</Text>
      ) : null}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10, marginTop: 22 },
  text: { fontSize: 14, fontWeight: "700" as const },
  star: { fontSize: 14, fontWeight: "700" as const },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 160,
  },
  chipText: { fontSize: 12, fontWeight: "600" as const },
  horizontalRow: { gap: 8, paddingRight: 8 },
  hChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  hChipText: { fontSize: 12, fontWeight: "500" as const },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  presetText: { fontSize: 13, fontWeight: "600" as const },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 28,
    paddingVertical: 16,
    borderRadius: 16,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" as const },
});
