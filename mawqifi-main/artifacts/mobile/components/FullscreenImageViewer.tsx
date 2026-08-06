/**
 * FullscreenImageViewer — modal overlay for viewing a single chat image.
 *
 * Features:
 * - Dark overlay, image fills the screen with contain fit
 * - Native pinch-to-zoom via ScrollView.maximumZoomScale on iOS
 * - Tap anywhere outside or press the close button to dismiss
 * - Fade-in animation using Reanimated
 */

import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  uri: string | null;
  onClose: () => void;
}

export default function FullscreenImageViewer({ uri, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (uri) {
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      opacity.value = 0;
    }
  }, [uri, opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!uri) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, animStyle]}>
        {/* Close button */}
        <Pressable
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          onPress={onClose}
          hitSlop={16}
          accessibilityLabel="إغلاق"
        >
          <View style={styles.closeBtnInner}>
            <Feather name="x" size={20} color="#fff" />
          </View>
        </Pressable>

        {/* Image with pinch-zoom on iOS via ScrollView */}
        {Platform.OS === "ios" ? (
          <ScrollView
            style={styles.fill}
            contentContainerStyle={styles.fill}
            minimumZoomScale={1}
            maximumZoomScale={4}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            centerContent
          >
            <Image
              source={{ uri }}
              style={styles.image}
              contentFit="contain"
              transition={150}
              accessibilityLabel="صورة مشتركة"
            />
          </ScrollView>
        ) : (
          <Pressable style={styles.fill} onPress={onClose}>
            <Image
              source={{ uri }}
              style={styles.image}
              contentFit="contain"
              transition={150}
              accessibilityLabel="صورة مشتركة"
            />
          </Pressable>
        )}

        {/* Tap-to-close hint at the bottom */}
        <Text style={[styles.hint, { bottom: insets.bottom + 16 }]}>
          اضغط للإغلاق
        </Text>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  fill: { flex: 1, width: "100%" },
  image: { flex: 1, width: "100%", height: "100%" },
  closeBtn: {
    position: "absolute",
    right: 16,
    zIndex: 10,
  },
  closeBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    position: "absolute",
    alignSelf: "center",
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
  },
});
