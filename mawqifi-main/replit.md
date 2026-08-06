# Mawqifi — موقفي

A realtime parking-sharing platform for Kuwait University Al-Shadadiya. Students about to leave a parking spot post their info so other students can claim it.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/mobile run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (SDK 54) + Expo Router (file-based routing)
- State: React Context + AsyncStorage (local-first)
- Maps: react-native-maps@1.18.0 (Expo Go compatible, NOT in app.json plugins)
- UI Icons: @expo/vector-icons (Feather)
- Fonts: Inter (400/500/600/700) via @expo-google-fonts/inter
- API: Express 5 (api-server artifact)
- DB: PostgreSQL + Drizzle ORM (not used in v1 — AsyncStorage only)

## Where Things Live

```
artifacts/mobile/
├── app/
│   ├── _layout.tsx          # Root layout — all providers + Stack config
│   ├── (tabs)/
│   │   ├── _layout.tsx      # 4-tab layout (NativeTabs on iOS 26+)
│   │   ├── index.tsx        # Feed screen (live parking posts)
│   │   ├── create.tsx       # Create post screen
│   │   ├── map.tsx          # Map tab (delegates to KuMap component)
│   │   └── myPosts.tsx      # User's own posts
│   ├── post/[id].tsx        # Post detail + chat CTA
│   └── chat/[id].tsx        # Private chat screen
├── components/
│   ├── ParkingPostCard.tsx  # Card shown in feed & my-posts
│   ├── CountdownTimer.tsx   # Urgency-colored countdown
│   ├── EmptyState.tsx       # Reusable empty state
│   ├── KuMap.tsx            # Campus map — native (react-native-maps)
│   └── KuMap.web.tsx        # Campus map — web fallback (area list)
├── constants/
│   ├── colors.ts            # Design tokens (blue + gold theme)
│   ├── parkingAreas.ts      # KU parking area data + coordinates
│   └── config.ts            # Storage keys, poll interval, presets
├── context/
│   ├── UserContext.tsx      # Anonymous user ID + display name
│   ├── PostsContext.tsx     # Parking posts CRUD + auto-expiry + polling
│   └── ChatContext.tsx      # Chat messages per post
└── types/index.ts           # All TypeScript interfaces
```

## Architecture Decisions

- **AsyncStorage-first**: All data is persisted locally. No backend calls in v1 — designed to add a real backend later by replacing context reads with API hooks.
- **Auto-expiry**: Posts are marked inactive when `departureTime` passes, handled in `PostsContext.loadPosts()` on every poll cycle.
- **Platform-split maps**: `KuMap.tsx` (native) and `KuMap.web.tsx` (web) are Metro-resolved at build time — this is the only way to use `react-native-maps` without web bundling errors.
- **react-native-maps pinned to 1.18.0**: This is the only version compatible with Expo Go. Do NOT change this version without testing in Expo Go first.
- **No OpenAPI/codegen in v1**: The app is frontend-only. To add a backend, write routes in `artifacts/api-server`, update `lib/api-spec/openapi.yaml`, run codegen, and replace AsyncStorage reads with the generated hooks.

## Product

Students approaching a spot can post: parking area, optional car description, and departure time (from presets or custom). Other students see a live feed sorted by newest posts, with color-coded countdown timers. Tapping a post opens a private chat where students coordinate using text, images, and quick-reply phrases.

## User Preferences

- Clean, readable code with comments
- Reusable components in `components/`
- No hardcoded values — use `constants/`
- Scalable, production-style architecture
- Easy for developers to expand later

## Gotchas

- **react-native-maps**: pin to `1.18.0`, never add to `app.json` plugins
- **Platform-specific files**: `KuMap.web.tsx` must exist alongside `KuMap.tsx` to prevent web bundling errors
- **Expo Go HMR**: only restart the workflow when changing dependencies — code changes hot-reload automatically
- **User ID**: generated once on first launch and stored in AsyncStorage under `mawqifi:userId`
- **Arabic RTL text**: React Native renders Arabic text correctly without `I18nManager` changes — individual `Text` components handle RTL automatically
