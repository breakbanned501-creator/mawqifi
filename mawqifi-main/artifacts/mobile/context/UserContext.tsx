/**
 * UserContext — manages anonymous user identity.
 *
 * On first launch a random ID is generated and persisted in AsyncStorage.
 * Students can optionally set a display name shown in their posts and chats.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { STORAGE_KEYS } from "@/constants/config";

/** Generate a lightweight unique ID without external dependencies. */
function generateUserId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

interface UserContextValue {
  userId: string;
  userName: string;
  /** Update the user's display name and persist it. */
  setUserName: (name: string) => Promise<void>;
  isLoaded: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState("");
  const [userName, setUserNameState] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load or generate user identity on mount
  useEffect(() => {
    (async () => {
      try {
        let id = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
        if (!id) {
          id = generateUserId();
          await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, id);
        }
        setUserId(id);

        const name = await AsyncStorage.getItem(STORAGE_KEYS.USER_NAME);
        if (name) setUserNameState(name);
      } catch (e) {
        console.error("[UserContext] AsyncStorage error:", e);
        // Fallback: use in-memory ID for this session
        setUserId(generateUserId());
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const setUserName = useCallback(async (name: string) => {
    setUserNameState(name);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_NAME, name);
    } catch (e) {
      console.error("[UserContext] Failed to save user name:", e);
    }
  }, []);

  return (
    <UserContext.Provider value={{ userId, userName, setUserName, isLoaded }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within <UserProvider>");
  return ctx;
}
