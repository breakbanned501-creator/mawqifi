/**
 * Application-wide configuration constants.
 *
 * Centralizing these here means you never need to hunt through source files
 * to change a timeout, storage key, or display limit.
 */

/** AsyncStorage keys — all namespaced under "mawqifi:" to avoid collisions. */
export const STORAGE_KEYS = {
  USER_ID: "mawqifi:userId",
  USER_NAME: "mawqifi:userName",
  /** Local cache of posts (fallback when API is unreachable) */
  POSTS: "mawqifi:posts",
  /** Chat messages stored per chatId: `mawqifi:chat:<chatId>` */
  CHAT_PREFIX: "mawqifi:chat:",
  /** Chat index (list of all chats the user participates in) */
  CHATS_INDEX: "mawqifi:chatsIndex",
} as const;

/**
 * How often (ms) the feed auto-refreshes in the background.
 * On web, SSE gives instant updates so polling is just a safety-net.
 * On native (Expo Go), 3 s polling is the primary realtime mechanism.
 */
export const FEED_POLL_INTERVAL_MS = 3_000;

/** Max number of posts to show in the live feed. */
export const MAX_FEED_POSTS = 50;

/**
 * Quick departure presets shown on the Create Post screen.
 * `minutesFromNow` is added to the current time to compute `departureTime`.
 */
export const DEPARTURE_PRESETS = [
  { label: "بعد 10 دقائق", minutesFromNow: 10 },
  { label: "بعد 15 دقيقة", minutesFromNow: 15 },
  { label: "بعد 20 دقيقة", minutesFromNow: 20 },
  { label: "بعد 30 دقيقة", minutesFromNow: 30 },
  { label: "بعد ساعة", minutesFromNow: 60 },
] as const;

/** After how many minutes a post is considered expired (safety net). */
export const POST_MAX_LIFETIME_MINUTES = 180;

/** How often (ms) the chat screen polls for new messages. */
export const CHAT_POLL_INTERVAL_MS = 3_000;
