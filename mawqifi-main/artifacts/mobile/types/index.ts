/**
 * Core domain types for the Mawqifi parking-sharing platform.
 * All shared data structures live here — one source of truth.
 */

/** A parking availability post created by a student about to leave. */
export interface ParkingPost {
  id: string;
  userId: string;
  /** Arabic/English parking area name (e.g. "مواقف الهندسة") */
  parkingArea: string;
  /** Nearby building or college (optional) */
  nearbyBuilding?: string;
  /** Car description (optional, e.g. "جيب أسود") */
  carDescription?: string;
  /** ISO string of expected departure time */
  departureTime: string;
  /** Free-text note like "بعد 15 دقيقة" */
  departureNote?: string;
  /** ISO string of post creation time */
  createdAt: string;
  /** Whether the spot is still available */
  isActive: boolean;
}

/** A private chat between a spot seeker and the post owner. */
export interface Chat {
  id: string;
  /** The parking post this chat is about */
  postId: string;
  /** Parking area name — stored here for display in Messages tab */
  parkingArea?: string;
  /** Owner of the parking post */
  postOwnerId: string;
  /** Student seeking the spot */
  seekerId: string;
  createdAt: string;
  lastMessage?: string;
  lastMessageAt?: string;
}

/** A single message in a private chat. */
export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  text?: string;
  imageUri?: string;
  timestamp: string;
}

/** Zone classification used to group parking areas in the UI. */
export type ParkingZone = "A" | "B" | "gate" | "general";

/** A parking area on Kuwait University Al-Shadadiya campus. */
export interface ParkingArea {
  id: string;
  /** Arabic display name — shown in chips and feed cards. */
  name: string;
  nameEn: string;
  zone: ParkingZone;
  /** Nearest gate labels (e.g. ["Gate 5", "Gate 6"]). */
  gates?: string[];
  /** Optional coordinates for future live-map integration. */
  coordinate?: { latitude: number; longitude: number };
}

/** Quick departure preset (e.g. "بعد 15 دقيقة"). */
export interface DeparturePreset {
  label: string;
  minutesFromNow: number;
}
