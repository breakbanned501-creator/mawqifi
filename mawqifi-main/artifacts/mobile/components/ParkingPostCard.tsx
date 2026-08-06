/**
 * ParkingPostCard — a single parking post card for the feed.
 *
 * Design: dark card with left cyan accent strip, bold area name,
 * countdown timer, optional car/note details, and action button.
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { ParkingPost } from "@/types";
import CountdownTimer from "./CountdownTimer";

interface Props {
  post: ParkingPost;
  currentUserId: string;
  /** Show a "غادرت" button for the owner's own active posts. */
  showGoneButton?: boolean;
  onGone?: (postId: string) => void;
}

export default function ParkingPostCard({
  post,
  currentUserId,
  showGoneButton,
  onGone,
}: Props) {
  const colors = useColors();
  const isOwner = post.userId === currentUserId;

  const handlePress = useCallback(() => {
    if (isOwner) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/post/${post.id}`);
  }, [isOwner, post.id]);

  const handleGone = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onGone?.(post.id);
  }, [post.id, onGone]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed && !isOwner ? 0.88 : 1,
        },
      ]}
      onPress={handlePress}
      accessibilityRole={isOwner ? "none" : "button"}
      accessibilityLabel={`موقف في ${post.parkingArea}`}
    >
      {/* Left cyan accent bar */}
      <View style={[styles.accentBar, { backgroundColor: colors.accent }]} />

      <View style={styles.body}>
        {/* Top row: area name + active badge */}
        <View style={styles.topRow}>
          <Text style={[styles.areaName, { color: colors.foreground }]} numberOfLines={1}>
            {post.parkingArea}
          </Text>
          <View style={[styles.activeBadge, { backgroundColor: `${colors.success}20` }]}>
            <View style={[styles.activeDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.activeBadgeText, { color: colors.success }]}>متاح</Text>
          </View>
        </View>

        {/* Nearby building */}
        {post.nearbyBuilding ? (
          <Text style={[styles.building, { color: colors.mutedForeground }]}>
            {post.nearbyBuilding}
          </Text>
        ) : null}

        {/* Car + note row */}
        <View style={styles.metaRow}>
          {post.carDescription ? (
            <View style={styles.metaChip}>
              <Feather name="truck" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {post.carDescription}
              </Text>
            </View>
          ) : null}

          {post.departureNote ? (
            <View style={styles.metaChip}>
              <Feather name="clock" size={12} color={colors.accent} />
              <Text style={[styles.metaText, { color: colors.accent }]}>
                {post.departureNote}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Footer: countdown + action */}
        <View style={styles.footer}>
          <CountdownTimer departureTime={post.departureTime} />

          {isOwner && showGoneButton ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: `${colors.success}20`, borderColor: `${colors.success}40` }]}
              onPress={handleGone}
            >
              <Feather name="check" size={13} color={colors.success} />
              <Text style={[styles.actionBtnText, { color: colors.success }]}>غادرت</Text>
            </Pressable>
          ) : !isOwner ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={handlePress}
            >
              <Feather name="message-circle" size={13} color="#fff" />
              <Text style={[styles.actionBtnText, { color: "#fff" }]}>تواصل</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  accentBar: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  areaName: {
    fontSize: 15,
    fontWeight: "700" as const,
    flex: 1,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: "700" as const,
  },
  building: {
    fontSize: 12,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#162235",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "transparent",
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
});
