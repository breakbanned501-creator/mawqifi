/**
 * Messages screen — inbox of all private parking chats.
 *
 * Shows every conversation the current user is part of,
 * sorted by most recent activity. Tap to open a chat.
 */

import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChat } from "@/context/ChatContext";
import { useUser } from "@/context/UserContext";
import { useColors } from "@/hooks/useColors";
import type { Chat } from "@/types";

/** Format a timestamp into a relative or absolute label. */
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `${minutes} د`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} س`;
  return new Date(iso).toLocaleDateString("ar-KW");
}

function ChatItem({
  chat,
  isMine,
  colors,
}: {
  chat: Chat;
  isMine: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const lastTime = chat.lastMessageAt ?? chat.createdAt;
  const title = chat.parkingArea ?? "محادثة موقف";

  const handlePress = () => {
    router.push(
      `/chat/${chat.id}?postId=${chat.postId}&ownerId=${chat.postOwnerId}&seekerId=${chat.seekerId}`
    );
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.chatItem,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`فتح محادثة ${title}`}
    >
      {/* Avatar circle */}
      <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
        <Feather name="map-pin" size={18} color={colors.accent} />
      </View>

      {/* Content */}
      <View style={styles.chatItemContent}>
        <View style={styles.chatItemHeader}>
          <Text style={[styles.chatTitle, { color: colors.foreground }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.chatTime, { color: colors.mutedForeground }]}>
            {formatRelativeTime(lastTime)}
          </Text>
        </View>

        <View style={styles.chatItemFooter}>
          <Text
            style={[styles.lastMessage, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {chat.lastMessage ?? "ابدأ المحادثة..."}
          </Text>

          {/* Role badge */}
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: isMine ? `${colors.accent}18` : `${colors.primary}18` },
            ]}
          >
            <Text
              style={[
                styles.roleBadgeText,
                { color: isMine ? colors.accent : colors.primary },
              ]}
            >
              {isMine ? "موقفك" : "طالب"}
            </Text>
          </View>
        </View>
      </View>

      <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId } = useUser();
  const { getUserChats } = useChat();

  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Reload chats every time this tab gains focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setIsLoading(true);
        const result = await getUserChats(userId);
        if (active) {
          setChats(result);
          setIsLoading(false);
        }
      })();
      return () => { active = false; };
    }, [userId, getUserChats])
  );

  const paddingBottom = Platform.OS === "web"
    ? insets.bottom + 34 + 84
    : insets.bottom + 84;

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom }]}
        renderItem={({ item }) => (
          <ChatItem
            chat={item}
            isMine={item.postOwnerId === userId}
            colors={colors}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={
          chats.length > 0 ? (
            <View style={styles.listHeader}>
              <View style={[styles.headerDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.headerText, { color: colors.mutedForeground }]}>
                {chats.length} محادثة نشطة
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.secondary }]}>
              <Feather name="message-circle" size={36} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              لا توجد محادثات بعد
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              تواصل مع أصحاب المواقف من الصفحة الرئيسية
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 16, paddingTop: 12, flexGrow: 1 },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  headerDot: { width: 7, height: 7, borderRadius: 4 },
  headerText: { fontSize: 13, fontWeight: "500" as const },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  chatItemContent: { flex: 1, gap: 4 },
  chatItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chatTitle: { fontSize: 14, fontWeight: "700" as const, flex: 1 },
  chatTime: { fontSize: 11, marginLeft: 8 },
  chatItemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lastMessage: { fontSize: 13, flex: 1 },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    marginLeft: 8,
  },
  roleBadgeText: { fontSize: 10, fontWeight: "700" as const },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 14,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" as const },
  emptySub: { fontSize: 14, textAlign: "center", paddingHorizontal: 40, lineHeight: 22 },
});
