/**
 * Admin analytics dashboard.
 *
 * Protected by a 4-digit PIN before showing any data.
 * Shows real platform statistics fetched from the API.
 * Accessible via the 🔒 icon in the Map tab header.
 *
 * PIN: 7777  (change ADMIN_PIN here and ADMIN_KEY in the API server env)
 */

import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const ADMIN_PIN = "7777";
const REFRESH_INTERVAL_MS = 30_000;

interface AdminStats {
  activePosts: number;
  postsToday: number;
  totalChats: number;
  totalMessages: number;
  topAreas: Array<{ area: string; count: number }>;
  generatedAt: string;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  icon,
  color,
  colors,
}: {
  value: number;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  color: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        statStyles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[statStyles.iconBox, { backgroundColor: `${color}22` }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <Text style={[statStyles.value, { color: colors.foreground }]}>
        {value}
      </Text>
      <Text style={[statStyles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 130,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    alignItems: "center",
    gap: 8,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { fontSize: 34, fontWeight: "700" as const },
  label: { fontSize: 12, textAlign: "center" },
});

// ─── PIN dots ─────────────────────────────────────────────────────────────────

function PinDots({
  pin,
  error,
  colors,
}: {
  pin: string;
  error: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 18, justifyContent: "center" }}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor:
              error
                ? colors.destructive
                : i < pin.length
                ? colors.accent
                : colors.border,
          }}
        />
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiFetch<AdminStats>("/admin/stats", {
        headers: { Authorization: `Bearer mawqifi${ADMIN_PIN}` },
      });
      setStats(data);
      setLastUpdated(
        new Date(data.generatedAt).toLocaleTimeString("ar-KW", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch (err) {
      console.error("[Admin] fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    setIsLoading(true);
    loadStats();
    timerRef.current = setInterval(loadStats, REFRESH_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAuthed, loadStats]);

  // ── PIN input ──────────────────────────────────────────────────────────────

  const handleDigit = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setPinError(false);
    if (next.length === 4) {
      if (next === ADMIN_PIN) {
        setIsAuthed(true);
      } else {
        setPinError(true);
        setTimeout(() => setPin(""), 700);
      }
    }
  };

  const handleDelete = () => setPin((p) => p.slice(0, -1));

  // ── PIN screen ─────────────────────────────────────────────────────────────

  if (!isAuthed) {
    return (
      <View
        style={[
          styles.pinScreen,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={22} color={colors.foreground} />
        </Pressable>

        <View style={{ alignItems: "center", gap: 8, marginBottom: 32 }}>
          <View
            style={[
              styles.lockIcon,
              { backgroundColor: `${colors.accent}22` },
            ]}
          >
            <Feather name="lock" size={28} color={colors.accent} />
          </View>
          <Text style={[styles.pinTitle, { color: colors.foreground }]}>
            لوحة الإدارة
          </Text>
          <Text style={[styles.pinSub, { color: colors.mutedForeground }]}>
            أدخل رمز الدخول
          </Text>
        </View>

        <PinDots pin={pin} error={pinError} colors={colors} />

        {pinError && (
          <Text style={[styles.pinErrText, { color: colors.destructive }]}>
            رمز غير صحيح — حاول مجدداً
          </Text>
        )}

        {/* Numpad */}
        <View style={styles.numpad}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(
            (d, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [
                  styles.numKey,
                  {
                    backgroundColor: d
                      ? pressed
                        ? colors.secondary
                        : colors.card
                      : "transparent",
                    borderColor: d ? colors.border : "transparent",
                    opacity: d || d === "⌫" ? 1 : 0,
                  },
                ]}
                onPress={() =>
                  d === "⌫" ? handleDelete() : d ? handleDigit(d) : undefined
                }
                disabled={!d && d !== "⌫"}
              >
                <Text
                  style={[
                    styles.numKeyText,
                    {
                      color:
                        d === "⌫" ? colors.accent : colors.foreground,
                    },
                  ]}
                >
                  {d}
                </Text>
              </Pressable>
            )
          )}
        </View>
      </View>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={[styles.dashboard, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        padding: 20,
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 80,
        gap: 20,
      }}
    >
      {/* Header */}
      <View style={styles.dashHeader}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-right" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={[styles.dashTitle, { color: colors.foreground }]}>
            لوحة الإدارة
          </Text>
          {lastUpdated ? (
            <Text style={[styles.dashSub, { color: colors.mutedForeground }]}>
              آخر تحديث: {lastUpdated}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={() => { setIsLoading(true); loadStats(); }}>
          {isLoading ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : (
            <Feather name="refresh-cw" size={20} color={colors.accent} />
          )}
        </Pressable>
      </View>

      {!stats && isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            جارٍ تحميل البيانات…
          </Text>
        </View>
      ) : stats ? (
        <>
          {/* Stats 2×2 grid */}
          <View style={styles.statsRow}>
            <StatCard
              value={stats.activePosts}
              label={"مواقف نشطة\nالآن"}
              icon="map-pin"
              color={colors.success}
              colors={colors}
            />
            <StatCard
              value={stats.postsToday}
              label={"مواقف\nاليوم (24س)"}
              icon="trending-up"
              color={colors.accent}
              colors={colors}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              value={stats.totalChats}
              label={"محادثات\nإجمالية"}
              icon="message-circle"
              color={colors.primary}
              colors={colors}
            />
            <StatCard
              value={stats.totalMessages}
              label={"رسائل\nإجمالية"}
              icon="send"
              color={colors.warning}
              colors={colors}
            />
          </View>

          {/* Top areas */}
          {stats.topAreas.length > 0 && (
            <View
              style={[
                styles.topCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text
                style={[styles.topTitle, { color: colors.foreground }]}
              >
                المناطق الأكثر نشاطاً
              </Text>
              {stats.topAreas.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.topRow,
                    { borderTopColor: colors.border },
                  ]}
                >
                  <Text
                    style={[styles.topRank, { color: colors.accent }]}
                  >
                    #{idx + 1}
                  </Text>
                  <Text
                    style={[styles.topAreaName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {item.area}
                  </Text>
                  <View
                    style={[
                      styles.countBadge,
                      { backgroundColor: `${colors.primary}22` },
                    ]}
                  >
                    <Text
                      style={[styles.countText, { color: colors.primary }]}
                    >
                      {item.count}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pinScreen: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  backBtn: { alignSelf: "flex-start", padding: 8, marginBottom: 8 },
  lockIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  pinTitle: { fontSize: 22, fontWeight: "700" as const },
  pinSub: { fontSize: 14 },
  pinErrText: { fontSize: 13, fontWeight: "600" as const, marginTop: 4 },
  numpad: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 24,
    justifyContent: "center",
  },
  numKey: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  numKeyText: { fontSize: 24, fontWeight: "600" as const },

  dashboard: { flex: 1 },
  dashHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  dashTitle: { fontSize: 20, fontWeight: "700" as const },
  dashSub: { fontSize: 12, marginTop: 2 },
  loadingBox: {
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: { fontSize: 14 },
  statsRow: { flexDirection: "row", gap: 12 },
  topCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  topTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    padding: 16,
    paddingBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  topRank: { fontSize: 14, fontWeight: "700" as const, width: 30 },
  topAreaName: { flex: 1, fontSize: 13 },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: { fontSize: 12, fontWeight: "700" as const },
});
