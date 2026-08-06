/**
 * My Posts screen — shows all posts the current user has created.
 *
 * Active posts show a "لقد غادرت" button to manually close the spot.
 * Expired/closed posts are shown in a muted style.
 */

import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import EmptyState from "@/components/EmptyState";
import ParkingPostCard from "@/components/ParkingPostCard";
import { usePosts } from "@/context/PostsContext";
import { useUser } from "@/context/UserContext";
import { useColors } from "@/hooks/useColors";
import type { ParkingPost } from "@/types";

export default function MyPostsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { allPosts, markAsGone, refresh } = usePosts();
  const { userId } = useUser();

  // Refresh on focus so "مواقفي" is always up-to-date
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Filter to only the current user's posts
  const userPosts = useMemo(
    () => allPosts.filter((p) => p.userId === userId),
    [allPosts, userId]
  );

  const activePosts = useMemo(() => userPosts.filter((p) => p.isActive), [userPosts]);
  const expiredPosts = useMemo(() => userPosts.filter((p) => !p.isActive), [userPosts]);

  const handleGone = useCallback(
    (postId: string) => {
      markAsGone(postId);
    },
    [markAsGone]
  );

  const renderPost = useCallback(
    ({ item }: { item: ParkingPost }) => (
      <ParkingPostCard
        post={item}
        currentUserId={userId}
        showGoneButton={item.isActive}
        onGone={handleGone}
      />
    ),
    [userId, handleGone]
  );

  const renderExpiredPost = useCallback(
    ({ item }: { item: ParkingPost }) => (
      <View style={styles.expiredWrapper}>
        <View
          style={[styles.expiredOverlay, { backgroundColor: `${colors.muted}88` }]}
          pointerEvents="none"
        />
        <ParkingPostCard
          post={{ ...item, isActive: false }}
          currentUserId={userId}
          showGoneButton={false}
        />
        <View style={styles.expiredBadge}>
          <Text style={[styles.expiredText, { color: colors.mutedForeground }]}>
            انتهى
          </Text>
        </View>
      </View>
    ),
    [userId, colors]
  );

  const paddingBottom = Platform.OS === "web"
    ? insets.bottom + 34 + 84
    : insets.bottom + 84;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={userPosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: ParkingPost }) =>
          item.isActive ? renderPost({ item }) : renderExpiredPost({ item })
        }
        contentContainerStyle={[styles.listContent, { paddingBottom }]}
        ListHeaderComponent={
          <>
            {/* Active posts header */}
            {activePosts.length > 0 ? (
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  مواقفي المفتوحة
                </Text>
                <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
                  {activePosts.length}
                </Text>
              </View>
            ) : null}
            {/* Expired posts header */}
            {expiredPosts.length > 0 ? (
              <View style={[styles.sectionHeader, { marginTop: activePosts.length > 0 ? 16 : 0 }]}>
                <View style={[styles.sectionDot, { backgroundColor: colors.mutedForeground }]} />
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                  السابقة
                </Text>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="inbox"
            title="لم تنشر أي موقف بعد"
            subtitle="شارك موقفك مع زملائك — اضغط على علامة +"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    flex: 1,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  expiredWrapper: {
    position: "relative",
  },
  expiredOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    zIndex: 1,
  },
  expiredBadge: {
    position: "absolute",
    top: 18,
    left: 28,
    zIndex: 2,
  },
  expiredText: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
});
