/**
 * ChatContext — manages private chat threads with cloud persistence.
 *
 * Chats and messages are stored in PostgreSQL via the API.
 * An in-memory cache minimizes repeated network calls within a session.
 * Falls back to AsyncStorage for offline scenarios.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef } from "react";

import { STORAGE_KEYS } from "@/constants/config";
import { apiFetch } from "@/lib/api";
import { sanitizeMessage } from "@/lib/security";
import type { Chat, ChatMessage } from "@/types";

/** Maximum number of chat message caches to keep in memory. */
const MAX_CACHED_CHATS = 20;

/** Build a consistent chatId from the post and participant IDs. */
export function buildChatId(postId: string, seekerId: string, ownerId: string): string {
  return `${postId}-${seekerId}-${ownerId}`;
}

interface ChatContextValue {
  /**
   * Start or retrieve a chat thread.
   * Pass `parkingArea` so the Messages tab shows the area name without a post lookup.
   */
  getOrCreateChat: (
    postId: string,
    seekerId: string,
    ownerId: string,
    parkingArea?: string
  ) => Promise<Chat>;
  /** Fetch all messages for a chatId. */
  getMessages: (chatId: string) => Promise<ChatMessage[]>;
  /** Force reload from API (use for polling). Pass optional `since` ISO timestamp for delta polling. */
  refreshMessages: (chatId: string, since?: string) => Promise<ChatMessage[]>;
  /** Send a text message. */
  sendMessage: (chatId: string, senderId: string, text: string) => Promise<ChatMessage>;
  /**
   * Send an image message.
   * `imageData` should be a full base64 data URI: "data:image/jpeg;base64,..."
   */
  sendImage: (chatId: string, senderId: string, imageData: string) => Promise<ChatMessage>;
  /** Get all chats the user participates in, newest first. */
  getUserChats: (userId: string) => Promise<Chat[]>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  // Session-scoped message cache to avoid redundant fetches
  const messageCache = useRef<Map<string, ChatMessage[]>>(new Map());

  // Cleanup old cache entries when cache size exceeds limit
  const cleanupCache = useCallback(() => {
    if (messageCache.current.size > MAX_CACHED_CHATS) {
      const entries: [string, ChatMessage[]][] = [];
      messageCache.current.forEach((value: ChatMessage[], key: string) => entries.push([key, value]));
      // Remove oldest entries (first in array)
      entries.slice(0, entries.length - MAX_CACHED_CHATS).forEach(([chatId]) => {
        messageCache.current.delete(chatId);
      });
    }
  }, []);

  // Cleanup cache periodically
  useEffect(() => {
    const interval = setInterval(cleanupCache, 60000); // Every minute
    return () => clearInterval(interval);
  }, [cleanupCache]);

  const getOrCreateChat = useCallback(
    async (
      postId: string,
      seekerId: string,
      ownerId: string,
      parkingArea?: string
    ): Promise<Chat> => {
      try {
        const chat = await apiFetch<Chat>("/chats", {
          method: "POST",
          body: JSON.stringify({ postId, postOwnerId: ownerId, seekerId, parkingArea }),
        });
        // Cache in AsyncStorage so the Messages tab works offline
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHATS_INDEX).catch(() => null);
        const chats: Chat[] = raw ? JSON.parse(raw) : [];
        const existing = chats.findIndex((c) => c.id === chat.id);
        if (existing === -1) {
          await AsyncStorage.setItem(
            STORAGE_KEYS.CHATS_INDEX,
            JSON.stringify([chat, ...chats])
          );
        }
        return chat;
      } catch (err) {
        // Offline fallback
        console.warn("[ChatContext] getOrCreateChat API failed:", err);
        const chatId = buildChatId(postId, seekerId, ownerId);
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHATS_INDEX).catch(() => null);
        const chats: Chat[] = raw ? JSON.parse(raw) : [];
        const existing = chats.find((c) => c.id === chatId);
        if (existing) return existing;
        const newChat: Chat = {
          id: chatId,
          postId,
          parkingArea,
          postOwnerId: ownerId,
          seekerId,
          createdAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(
          STORAGE_KEYS.CHATS_INDEX,
          JSON.stringify([newChat, ...chats])
        );
        return newChat;
      }
    },
    []
  );

  const fetchMessages = useCallback(async (chatId: string, since?: string): Promise<ChatMessage[]> => {
    const path = since ? `/messages/${chatId}?since=${encodeURIComponent(since)}` : `/messages/${chatId}`;
    const fetched = await apiFetch<ChatMessage[]>(path);
    if (since) {
      const existing = messageCache.current.get(chatId) || [];
      if (fetched.length === 0) return existing;
      const map = new Map<string, ChatMessage>();
      existing.forEach((m) => map.set(m.id, m));
      fetched.forEach((m) => map.set(m.id, m));
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      messageCache.current.set(chatId, merged);
      return merged;
    } else {
      messageCache.current.set(chatId, fetched);
      return fetched;
    }
  }, []);

  const getMessages = useCallback(
    async (chatId: string): Promise<ChatMessage[]> => {
      // Serve from cache first for instant display
      const cached = messageCache.current.get(chatId);
      if (cached) return cached;
      try {
        return await fetchMessages(chatId);
      } catch {
        // Offline: try local storage
        const key = `${STORAGE_KEYS.CHAT_PREFIX}${chatId}`;
        const raw = await AsyncStorage.getItem(key).catch(() => null);
        return raw ? JSON.parse(raw) : [];
      }
    },
    [fetchMessages]
  );

  const refreshMessages = useCallback(
    async (chatId: string, since?: string): Promise<ChatMessage[]> => {
      try {
        return await fetchMessages(chatId, since);
      } catch {
        return messageCache.current.get(chatId) ?? [];
      }
    },
    [fetchMessages]
  );

  const sendMessage = useCallback(
    async (chatId: string, senderId: string, text: string): Promise<ChatMessage> => {
      const sanitizedText = sanitizeMessage(text);

      const msg = await apiFetch<ChatMessage>("/messages", {
        method: "POST",
        body: JSON.stringify({ chatId, senderId, text: sanitizedText }),
      });

      // Update cache
      const cached = messageCache.current.get(chatId) || [];
      messageCache.current.set(chatId, [...cached, msg]);

      return msg;
    },
    []
  );

  const sendImage = useCallback(
    async (chatId: string, senderId: string, imageData: string): Promise<ChatMessage> => {
      const msg = await apiFetch<ChatMessage>("/messages", {
        method: "POST",
        body: JSON.stringify({ chatId, senderId, imageData }),
      });
      const existing = messageCache.current.get(chatId) ?? [];
      messageCache.current.set(chatId, [...existing, msg]);
      return msg;
    },
    []
  );

  const getUserChats = useCallback(async (userId: string): Promise<Chat[]> => {
    try {
      const chats = await apiFetch<Chat[]>(`/chats/${userId}`);
      // Sync to local cache
      await AsyncStorage.setItem(STORAGE_KEYS.CHATS_INDEX, JSON.stringify(chats)).catch(
        () => {}
      );
      return chats;
    } catch {
      // Offline fallback
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHATS_INDEX).catch(() => null);
      const chats: Chat[] = raw ? JSON.parse(raw) : [];
      return chats
        .filter((c) => c.seekerId === userId || c.postOwnerId === userId)
        .sort((a, b) => {
          const ta = a.lastMessageAt ?? a.createdAt;
          const tb = b.lastMessageAt ?? b.createdAt;
          return new Date(tb).getTime() - new Date(ta).getTime();
        });
    }
  }, []);

  return (
    <ChatContext.Provider
      value={{
        getOrCreateChat,
        getMessages,
        refreshMessages,
        sendMessage,
        sendImage,
        getUserChats,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within <ChatProvider>");
  return ctx;
}
