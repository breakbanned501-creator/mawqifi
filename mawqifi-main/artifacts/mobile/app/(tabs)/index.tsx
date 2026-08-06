/**
 * Feed screen — live list of active parking posts.
 *
 * Displays all active spots sorted by newest first.
 * Polls in the background every FEED_POLL_INTERVAL_MS seconds.
 * Pull-to-refresh for manual updates.
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
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

export default function FeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { posts, isLoading, refresh } = usePosts();
  const { userId } = useUser();
  const [refreshing, setRefreshing] = useState(false);

  // Refresh the feed every time this tab gains focus (e.g. after creating a post).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const renderItem = useCallback(
    ({ item }: { item: ParkingPost }) => (
      <ParkingPostCard post={item} currentUserId={userId} />
    ),
    [userId]
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
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={
          posts.length > 0 ? (
            <View style={styles.listHeader}>
              {/* Live indicator */}
              <View style={styles.liveRow}>
                <View style={[styles.livePulse, { backgroundColor: colors.success }]} />
                <Text style={[styles.liveLabel, { color: colors.success }]}>مباشر</Text>
              </View>
              <Text style={[styles.countLabel, { color: colors.mutedForeground }]}>
                {posts.length} موقف متاح الآن
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="map-pin"
            title="لا توجد مواقف متاحة"
            subtitle="كن أول من يشارك موقفه — اضغط على + لإضافة موقفك"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { flexGrow: 1, paddingTop: 8 },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  livePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveLabel: {
    fontSize: 12,
    fontWeight: "700" as const,
    letterSpacing: 0.8,
  },
  countLabel: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
});
