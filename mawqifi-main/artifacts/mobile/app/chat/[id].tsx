/**
 * Chat screen — private parking coordination chat.
 *
 * Features:
 * - Text messages + image sharing (camera or gallery)
 * - Images compressed to ≤800px wide, 60% quality before upload
 * - Tap any image to open fullscreen pinch-zoom viewer
 * - Arabic quick-reply chips shown before first message
 * - Polls for new messages every CHAT_POLL_INTERVAL_MS (3 s)
 * - WhatsApp-style bubble layout, RTL Arabic text
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FullscreenImageViewer from "@/components/FullscreenImageViewer";
import { CHAT_POLL_INTERVAL_MS } from "@/constants/config";
import { useChat } from "@/context/ChatContext";
import { useUser } from "@/context/UserContext";
import { useColors } from "@/hooks/useColors";
import type { ChatMessage } from "@/types";

/** Quick phrases for fast parking coordination. */
const QUICK_REPLIES = [
  "في الطريق",
  "وصلت",
  "أنا عند البوابة",
  "ادخل يسار",
  "ادخل يمين",
  "السيارة جنب العمود",
  "انتظرني",
  "خلص الموقف",
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ar-KW", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Single message bubble (text or image). */
function Bubble({
  message,
  isMine,
  colors,
  onImagePress,
}: {
  message: ChatMessage;
  isMine: boolean;
  colors: ReturnType<typeof useColors>;
  onImagePress: (uri: string) => void;
}) {
  return (
    <View
      style={[
        bubbleStyles.wrapper,
        isMine ? bubbleStyles.wrapperRight : bubbleStyles.wrapperLeft,
      ]}
    >
      <View
        style={[
          bubbleStyles.bubble,
          isMine
            ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
            : {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                borderBottomLeftRadius: 4,
              },
        ]}
      >
        {message.imageUri ? (
          <Pressable onPress={() => onImagePress(message.imageUri!)}>
            <Image
              source={{ uri: message.imageUri }}
              style={bubbleStyles.image}
              contentFit="cover"
              transition={200}
              placeholder={{ thumbhash: undefined }}
            />
            <View style={bubbleStyles.imageOverlay}>
              <Feather name="zoom-in" size={14} color="rgba(255,255,255,0.8)" />
            </View>
          </Pressable>
        ) : null}
        {message.text ? (
          <Text
            style={[
              bubbleStyles.text,
              { color: isMine ? "#fff" : colors.foreground },
            ]}
          >
            {message.text}
          </Text>
        ) : null}
      </View>
      <Text style={[bubbleStyles.time, { color: colors.mutedForeground }]}>
        {formatTime(message.timestamp)}
      </Text>
    </View>
  );
}

/** Horizontal quick-reply chips. */
function QuickReplies({
  onPress,
  colors,
}: {
  onPress: (text: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
    >
      {QUICK_REPLIES.map((r) => (
        <Pressable
          key={r}
          onPress={() => onPress(r)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
            borderWidth: 1,
            backgroundColor: colors.card,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.foreground, fontSize: 13 }}>{r}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Compress an image URI to ≤720px wide, 55% JPEG quality, return base64 data URI. */
async function compressAndEncode(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 720 } }],
    { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return `data:image/jpeg;base64,${result.base64 ?? ""}`;
}

/** Show platform-appropriate image source picker. */
async function pickImage(): Promise<string | null> {
  const MEDIA: ImagePicker.MediaTypeOptions = ImagePicker.MediaTypeOptions.Images;

  if (Platform.OS === "ios") {
    return new Promise((resolve) => {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["إلغاء", "الكاميرا", "الاستوديو"],
          cancelButtonIndex: 0,
        },
        async (idx) => {
          if (idx === 0) return resolve(null);
          const fn =
            idx === 1 ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
          const result = await fn({ mediaTypes: MEDIA, quality: 1 });
          resolve(result.canceled ? null : result.assets[0]?.uri ?? null);
        }
      );
    });
  }

  // Android / Web: show an Alert with two options
  return new Promise((resolve) => {
    Alert.alert("إرسال صورة", "اختر المصدر", [
      { text: "إلغاء", style: "cancel", onPress: () => resolve(null) },
      {
        text: "الكاميرا",
        onPress: async () => {
          const r = await ImagePicker.launchCameraAsync({ mediaTypes: MEDIA, quality: 1 });
          resolve(r.canceled ? null : r.assets[0]?.uri ?? null);
        },
      },
      {
        text: "الاستوديو",
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: MEDIA, quality: 1 });
          resolve(r.canceled ? null : r.assets[0]?.uri ?? null);
        },
      },
    ]);
  });
}

export default function ChatScreen() {
  const { id: chatId, postId, ownerId, seekerId } = useLocalSearchParams<{
    id: string;
    postId: string;
    ownerId: string;
    seekerId: string;
  }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId } = useUser();
  const { getOrCreateChat, getMessages, refreshMessages, sendMessage, sendImage } = useChat();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fullscreenUri, setFullscreenUri] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(true);

  const flatListRef = useRef<FlatList>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize chat + start polling
  useEffect(() => {
    let isMounted = true;

    const initAndPoll = async () => {
      if (postId && ownerId && seekerId) {
        try {
          await getOrCreateChat(postId, seekerId, ownerId);
        } catch (err) {
          console.warn("[ChatScreen] getOrCreateChat warning:", err);
        }
      }

      if (!isMounted) return;

      try {
        const msgs = await getMessages(chatId);
        if (isMounted) {
          setMessages(msgs);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("[ChatScreen] getMessages error:", err);
        if (isMounted) setIsLoading(false);
      }

      // Start interval polling only after initial setup completes
      pollingRef.current = setInterval(async () => {
        if (!isMounted) return;
        const fresh = await refreshMessages(chatId);
        if (!isMounted) return;

        setMessages((prev) => {
          if (
            prev.length === fresh.length &&
            prev.every((m, i) => m.id === fresh[i]?.id)
          ) {
            return prev; // Return unchanged reference to prevent re-render
          }
          const map = new Map<string, ChatMessage>();
          prev.forEach((m) => map.set(m.id, m));
          fresh.forEach((m) => map.set(m.id, m));
          return Array.from(map.values()).sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        });
      }, CHAT_POLL_INTERVAL_MS);
    };

    initAndPoll();

    return () => {
      isMounted = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [chatId, postId, ownerId, seekerId, getOrCreateChat, getMessages, refreshMessages]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const handleSendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;
      Keyboard.dismiss();
      setInputText("");
      setShowQuickReplies(false);
      setIsSending(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        const msg = await sendMessage(chatId, userId, trimmed);
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      } catch (err) {
        Alert.alert("خطأ", "فشل إرسال الرسالة. حاول مجدداً.");
        console.error("[Chat] sendMessage failed:", err);
      } finally {
        setIsSending(false);
      }
    },
    [chatId, userId, isSending, sendMessage, scrollToBottom]
  );

  const handlePickImage = useCallback(async () => {
    const uri = await pickImage();
    if (!uri) return;

    setIsSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const imageData = await compressAndEncode(uri);
      const msg = await sendImage(chatId, userId, imageData);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setShowQuickReplies(false);
      scrollToBottom();
    } catch (err) {
      Alert.alert("خطأ", "فشل إرسال الصورة. تأكد من اتصالك.");
      console.error("[Chat] sendImage failed:", err);
    } finally {
      setIsSending(false);
    }
  }, [chatId, userId, sendImage, scrollToBottom]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <Bubble
        message={item}
        isMine={item.senderId === userId}
        colors={colors}
        onImagePress={setFullscreenUri}
      />
    ),
    [userId, colors]
  );

  const bottomPadding = Platform.OS === "web" ? insets.bottom + 34 : insets.bottom;

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {/* Disclaimer banner */}
        <View style={[styles.banner, { backgroundColor: colors.secondary }]}>
          <Feather name="lock" size={12} color={colors.mutedForeground} />
          <Text style={[styles.bannerText, { color: colors.mutedForeground }]}>
            محادثة مؤقتة • تنتهي عند انتهاء الموقف
          </Text>
        </View>

        {/* Messages list */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messages}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToBottom}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Feather name="message-circle" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyChatText, { color: colors.mutedForeground }]}>
                ابدأ المحادثة
              </Text>
            </View>
          }
        />

        {/* Quick replies — shown until first message sent */}
        {showQuickReplies && messages.length === 0 ? (
          <View style={styles.quickReplies}>
            <QuickReplies onPress={handleSendText} colors={colors} />
          </View>
        ) : null}

        {/* Input toolbar */}
        <View
          style={[
            styles.toolbar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: bottomPadding + 8,
            },
          ]}
        >
          {/* Image button */}
          <Pressable
            style={[styles.iconBtn, { backgroundColor: colors.muted }]}
            onPress={handlePickImage}
            disabled={isSending}
            accessibilityLabel="إرسال صورة"
          >
            <Feather name="image" size={18} color={isSending ? colors.mutedForeground : colors.accent} />
          </Pressable>

          {/* Text input */}
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.muted,
                color: colors.foreground,
              },
            ]}
            placeholder="اكتب رسالة..."
            placeholderTextColor={colors.mutedForeground}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSendText(inputText)}
            returnKeyType="send"
            multiline
            maxLength={500}
          />

          {/* Send button */}
          <Pressable
            style={[
              styles.sendBtn,
              {
                backgroundColor:
                  inputText.trim() && !isSending ? colors.primary : colors.muted,
              },
            ]}
            onPress={() => handleSendText(inputText)}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Feather
                name="send"
                size={16}
                color={inputText.trim() ? "#fff" : colors.mutedForeground}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Fullscreen image viewer */}
      <FullscreenImageViewer
        uri={fullscreenUri}
        onClose={() => setFullscreenUri(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bannerText: { fontSize: 11, flex: 1 },
  messages: { paddingHorizontal: 16, paddingTop: 12, flexGrow: 1, gap: 6, paddingBottom: 8 },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyChatText: { fontSize: 15 },
  quickReplies: { paddingVertical: 10 },
  toolbar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});

const bubbleStyles = StyleSheet.create({
  wrapper: { marginVertical: 2, maxWidth: "78%", gap: 3 },
  wrapperRight: { alignSelf: "flex-end", alignItems: "flex-end" },
  wrapperLeft: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { borderRadius: 18, overflow: "hidden" },
  text: { fontSize: 14, lineHeight: 21, paddingHorizontal: 14, paddingVertical: 10 },
  image: { width: 200, height: 160 },
  imageOverlay: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 10,
    padding: 3,
  },
  time: { fontSize: 10, marginHorizontal: 4 },
});
