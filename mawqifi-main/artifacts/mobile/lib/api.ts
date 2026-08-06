/**
 * Lightweight API client for the Mawqifi backend.
 *
 * URL resolution order (native / Expo Go):
 *   1. EXPO_PUBLIC_DOMAIN  — set automatically by the Expo workflow as
 *      `EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN`.  Constructs
 *      `https://<domain>/api` which routes through the Replit reverse proxy
 *      to the API server.  This is the path used by ALL real devices.
 *   2. EXPO_PUBLIC_API_URL — explicit override for custom deployments.
 *   3. localhost:8080       — last resort, only works on the same machine.
 *
 * On web:
 *   Uses `window.location.origin + "/api"` so the Replit proxy handles
 *   /api → api-server routing automatically.
 */

import { Platform } from "react-native";

export function getApiUrl(): string {
  // ── Web ───────────────────────────────────────────────────────────────────
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const origin = window.location.origin;
    console.log("[api] web origin →", origin + "/api");
    return `${origin}/api`;
  }

  // ── Native (Expo Go / standalone) ─────────────────────────────────────────
  // EXPO_PUBLIC_DOMAIN is injected by the mobile workflow:
  //   EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN
  // It resolves to the shared Replit proxy host that all devices can reach.

  if (process.env.EXPO_PUBLIC_DOMAIN) {
    const url = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
    console.log("[api] EXPO_PUBLIC_DOMAIN →", url);
    return url;
  }

  // Fallback to explicit API URL
  if (process.env.EXPO_PUBLIC_API_URL) {
    console.log("[api] EXPO_PUBLIC_API_URL →", process.env.EXPO_PUBLIC_API_URL);
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Last resort - localhost (only works on same machine)
  console.log("[api] fallback → localhost:8080");
  return "http://localhost:8080";
}

interface ApiRequestInit extends RequestInit {
  body?: string;
}

// Simple request deduplication cache
const pendingRequests = new Map<string, Promise<any>>();

function getRequestKey(path: string, init: ApiRequestInit): string {
  return `${path}:${init.method || 'GET'}:${init.body || ''}`;
}

export async function apiFetch<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const url = `${getApiUrl()}${path}`;
  const requestKey = getRequestKey(path, init);

  // Check if there's already a pending request for the same data
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey) as Promise<T>;
  }

  const requestPromise = (async () => {
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...init.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } finally {
      // Remove from cache when done (success or failure)
      pendingRequests.delete(requestKey);
    }
  })();

  // Store the promise for deduplication
  pendingRequests.set(requestKey, requestPromise);

  return requestPromise;
}
