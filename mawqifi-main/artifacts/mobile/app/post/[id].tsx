/**
 * Post Detail screen — full view of a parking post with a chat CTA.
 *
 * When the "ابدأ محادثة" button is tapped, a chat thread is created
 * with the parking area stored so the Messages tab can show it.
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CountdownTimer from "@/components/CountdownTimer";
import { buildChatId, useChat } from "@/context/ChatContext";
import { usePosts } from "@/context/PostsContext";
import { useUser } from "@/context/UserContext";
import { useColors } from "@/hooks/useColors";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { posts, allPosts } = usePosts();
  const { userId } = useUser();
  const { getOrCreateChat } = useChat();

  const post = useMemo(
    () => [...posts, ...allPosts].find((p) => p.id === id),
    [posts, allPosts, id]
  );

  const isOwner = post?.userId === userId;

  const handleChat = useCallback(async () => {
    if (!post) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Store parking area in chat so Messages tab can display it
    await getOrCreateChat(post.id, userId, post.userId, post.parkingArea);

    const chatId = buildChatId(post.id, userId, post.userId);
    router.push(
      `/chat/${chatId}?postId=${post.id}&ownerId=${post.userId}&seekerId=${userId}`
    );
  }, [post, userId, getOrCreateChat]);

  if (!post) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={36} color={colors.mutedForeground} />
        <Text style={[styles.notFound, { color: colors.mutedForeground }]}>
          الموقف غير موجود أو انتهت صلاحيته
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
    >
      {/* Main card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Status row */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: `${colors.success}18` }]}>
            <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.statusText, { color: colors.success }]}>
              {post.isActive ? "متاح الآن" : "انتهى"}
            </Text>
          </View>
          <CountdownTimer departureTime={post.departureTime} />
        </View>

        {/* Detail rows */}
        <DetailRow
          icon="map-pin"
          label="منطقة الموقف"
          value={post.parkingArea}
          iconBg={`${colors.primary}15`}
          iconColor={colors.primary}
          colors={colors}
        />
        {post.nearbyBuilding ? (
          <DetailRow
            icon="home"
            label="الكلية / المبنى"
            value={post.nearbyBuilding}
            iconBg={colors.secondary}
            iconColor={colors.primary}
            colors={colors}
            bordered
          />
        ) : null}
        {post.carDescription ? (
          <DetailRow
            icon="truck"
            label="السيارة"
            value={post.carDescription}
            iconBg={colors.muted}
            iconColor={colors.mutedForeground}
            colors={colors}
            bordered
          />
        ) : null}
        {post.departureNote ? (
          <DetailRow
            icon="clock"
            label="وقت المغادرة"
            value={post.departureNote}
            iconBg={`${colors.accent}18`}
            iconColor={colors.accent}
            colors={colors}
            bordered
          />
        ) : null}
      </View>

      {/* Chat CTA */}
      {!isOwner && post.isActive ? (
        <View style={styles.ctaSection}>
          <Text style={[styles.ctaHint, { color: colors.mutedForeground }]}>
            تواصل مع صاحب الموقف لتأكيد الاستلام
          </Text>
          <Pressable
            style={[styles.chatBtn, { backgroundColor: colors.primary }]}
            onPress={handleChat}
          >
            <Feather name="message-circle" size={20} color="#fff" />
            <Text style={styles.chatBtnText}>ابدأ محادثة</Text>
          </Pressable>
        </View>
      ) : null}

      {isOwner ? (
        <View style={[styles.ownerNote, { backgroundColor: colors.secondary }]}>
          <Feather name="info" size={15} color={colors.accent} />
          <Text style={[styles.ownerNoteText, { color: colors.secondaryForeground }]}>
            هذا موقفك — يمكن للطلاب الآخرين التواصل معك عبر هذا الإعلان
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function DetailRow({
  icon,
  label,
  value,
  iconBg,
  iconColor,
  colors,
  bordered,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  iconBg: string;
  iconColor: string;
  colors: ReturnType<typeof useColors>;
  bordered?: boolean;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        bordered && { borderTopWidth: 1, borderTopColor: colors.border },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={17} color={iconColor} />
      </View>
      <View style={styles.detailText}>
        <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  notFound: { fontSize: 15, textAlign: "center" },
  scroll: { padding: 16, gap: 16 },
  card: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingBottom: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: "700" as const },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16, paddingVertical: 14 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  detailText: { flex: 1, gap: 3 },
  detailLabel: { fontSize: 11, fontWeight: "500" as const },
  detailValue: { fontSize: 15, fontWeight: "600" as const },
  ctaSection: { gap: 12, alignItems: "center" },
  ctaHint: { fontSize: 13, textAlign: "center" },
  chatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
  },
  chatBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" as const },
  ownerNote: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 14 },
  ownerNoteText: { fontSize: 13, flex: 1, lineHeight: 20 },
});
