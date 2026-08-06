/**
 * PostsContext — manages parking posts with cloud-first persistence.
 *
 * Realtime strategy:
 *   • Web     : SSE (Server-Sent Events) via the /posts/stream endpoint.
 *               New posts arrive instantly without polling.
 *   • Native  : Polling every FEED_POLL_INTERVAL_MS (3 s).
 *               Also triggers a refresh whenever the app comes back to
 *               the foreground (AppState "active").
 *
 * Both paths share the same API (PostgreSQL via Express) so all devices
 * see the same data in near-real-time.
 *
 * Fallback: if the API is unreachable the last-known AsyncStorage cache
 * is displayed, but nothing is written locally only.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";

import { FEED_POLL_INTERVAL_MS, MAX_FEED_POSTS, STORAGE_KEYS } from "@/constants/config";
import { apiFetch, getApiUrl } from "@/lib/api";
import { sanitizeCarDescription, sanitizeInput, sanitizeParkingArea } from "@/lib/security";
import type { ParkingPost } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreatePostInput {
  userId: string;
  parkingArea: string;
  nearbyBuilding?: string;
  carDescription?: string;
  departureTime: string;
  departureNote?: string;
}

interface PostsContextValue {
  posts: ParkingPost[];
  allPosts: ParkingPost[];
  isLoading: boolean;
  createPost: (input: CreatePostInput) => Promise<ParkingPost>;
  markAsGone: (postId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const PostsContext = createContext<PostsContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PostsProvider({ children }: { children: React.ReactNode }) {
  const [allPosts, setAllPosts] = useState<ParkingPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Core fetch ─────────────────────────────────────────────────────────────

  const loadPosts = useCallback(async () => {
    try {
      const remote = await apiFetch<ParkingPost[]>("/posts");
      console.log(`[PostsContext] ✓ Fetched ${remote.length} posts from API`);
      setAllPosts(remote);
      await AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(remote));
    } catch (err) {
      console.warn("[PostsContext] API unavailable, loading from cache:", err);
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.POSTS);
        if (raw) {
          const cached: ParkingPost[] = JSON.parse(raw);
          const now = Date.now();
          const active = cached.filter(
            (p) => p.isActive && new Date(p.departureTime).getTime() > now
          );
          setAllPosts(active);
        }
      } catch {
        /* cache also failed — show empty state */
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Initial load + polling fallback ───────────────────────────────────────

  useEffect(() => {
    loadPosts();
    pollingRef.current = setInterval(() => {
      loadPosts();
    }, FEED_POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ── AppState listener (native) — refresh when app returns to foreground ───

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: string) => {
      if (nextState === "active") {
        console.log("[PostsContext] App became active — refreshing feed");
        loadPosts();
      }
    });
    return () => subscription.remove();
  }, []);

  // ── SSE listener (web only) — instant push for new posts ──────────────────

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const streamUrl = `${getApiUrl()}/posts/stream`;
    console.log("[PostsContext] SSE: connecting to", streamUrl);

    let es: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 5;
    const INITIAL_RETRY_DELAY = 1000;

    const connect = () => {
      try {
        es = new EventSource(streamUrl);

        es.addEventListener("connected", () => {
          console.log("[PostsContext] SSE: ✓ subscription connected");
          retryCount = 0; // Reset retry count on successful connection
        });

        es.addEventListener("new_post", (e: Event) => {
          const post = JSON.parse((e as MessageEvent).data) as ParkingPost;
          console.log("[PostsContext] SSE: ✓ realtime INSERT received:", post.id, post.parkingArea);
          setAllPosts((prev) => {
            // Avoid duplicates
            if (prev.some((p) => p.id === post.id)) return prev;
            const updated = [post, ...prev].slice(0, MAX_FEED_POSTS * 2);
            AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updated)).catch(() => {});
            return updated;
          });
        });

        es.onerror = (err) => {
          console.warn("[PostsContext] SSE: connection error", err);
          if (es) {
            es.close();
            es = null;
          }

          // Exponential backoff reconnection
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount - 1);
            console.log(`[PostsContext] SSE: retrying in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
            reconnectTimeout = setTimeout(() => {
              connect();
            }, delay);
          } else {
            console.error("[PostsContext] SSE: max retries reached, giving up");
          }
        };
      } catch (err) {
        console.warn("[PostsContext] SSE: EventSource not available:", err);
      }
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (es) {
        console.log("[PostsContext] SSE: closing connection");
        es.close();
      }
    };
  }, []);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createPost = useCallback(
    async (input: CreatePostInput): Promise<ParkingPost> => {
      // Sanitize inputs before sending to API
      const sanitizedInput = {
        ...input,
        parkingArea: sanitizeParkingArea(input.parkingArea),
        nearbyBuilding: input.nearbyBuilding ? sanitizeInput(input.nearbyBuilding) : undefined,
        carDescription: input.carDescription ? sanitizeCarDescription(input.carDescription) : undefined,
        departureNote: input.departureNote ? sanitizeInput(input.departureNote) : undefined,
      };

      // Always try the API first — never write locally-only
      const created = await apiFetch<ParkingPost>("/posts", {
        method: "POST",
        body: JSON.stringify(sanitizedInput),
      });
      console.log("[PostsContext] ✓ Post created in DB:", created.id, "—", created.parkingArea);

      // Optimistic local update so the creator sees it immediately
      setAllPosts((prev) => {
        if (prev.some((p) => p.id === created.id)) return prev;
        return [created, ...prev].slice(0, MAX_FEED_POSTS * 2);
      });

      return created;
    },
    []
  );

  const markAsGone = useCallback(async (postId: string) => {
    // Optimistically hide from UI
    setAllPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, isActive: false } : p))
    );
    try {
      await apiFetch(`/posts/${postId}/close`, { method: "PATCH" });
      console.log("[PostsContext] ✓ Post closed in DB:", postId);
    } catch (err) {
      console.warn("[PostsContext] API close failed:", err);
      // Revert optimistic update on failure
      loadPosts();
    }
  }, [loadPosts]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const posts = useMemo(
    () =>
      allPosts
        .filter((p) => p.isActive)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, MAX_FEED_POSTS),
    [allPosts]
  );

  return (
    <PostsContext.Provider
      value={{ posts, allPosts, isLoading, createPost, markAsGone, refresh: loadPosts }}
    >
      {children}
    </PostsContext.Provider>
  );
}

export function usePosts(): PostsContextValue {
  const ctx = useContext(PostsContext);
  if (!ctx) throw new Error("usePosts must be used within <PostsProvider>");
  return ctx;
}
