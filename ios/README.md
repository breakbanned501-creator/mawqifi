# Mawqifi iOS foundation

This directory is a Capacitor iOS foundation generated on Windows. It has not been
built, signed, or archived with Xcode.

## Archive-safe local bundle

Release preparation uses a local Next.js static export in `out/`; it does not use
`server.url`. The bundled UI talks directly to Supabase for anonymous auth,
database, Realtime, and Storage. Only the existing server-authoritative push APIs
remain remote on `https://mawqifiapp.vercel.app`, using a Supabase bearer token.

Before a release build, provide only these public build variables through the
environment (never commit their values):

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

If the public values are stored in a temporary environment file, set
`MAWQIFI_NATIVE_ENV_FILE` to that file path. The build script reads only the two
listed public values and removes server-only variables from the child build
environment.

Then run:

```bash
npm run cap:ios:archive
```

This builds `out/`, syncs it into the iOS project, and fails if the generated
native configuration contains `server.url`, if native PWA workers are copied, or
if an obvious server-only secret marker reaches the static bundle.

For local development on macOS, use the explicit live-reload command instead:

```bash
npm run cap:ios:dev
```

Capacitor temporarily configures live reload for that run and reverts it when the
process exits. Always run `npm run cap:ios:archive` again before archiving so the
generated iOS configuration is rewritten to the local production bundle.

## Before opening in Xcode

1. Use macOS with current Xcode and CocoaPods/Swift Package Manager support.
2. Run `npm ci` and `npm run cap:ios:archive` from the repository root.
3. Open `ios/App/App.xcworkspace` when present, otherwise `ios/App/App.xcodeproj`.
4. Change the provisional `com.mawqifi.app` bundle identifier if the registered
   Apple Developer identifier differs.
5. Select the Mawqifi team and configure signing. Never commit certificates,
   provisioning profiles, APNs keys, or `xcuserdata`.
6. Add the **Push Notifications** capability and configure an APNs key in the
   server environment before enabling native delivery. Browser VAPID push remains
   separate from native APNs tokens.
7. Replace the generated App Icon and splash artwork with approved Mawqifi brand
   artwork, including a source 1024x1024 App Store icon. The current repository
   has no verified production-quality native icon source.
8. Test anonymous-session persistence, camera/photo and explicit location prompts,
   deep links such as `mawqifi://notifications`, and lifecycle/realtime recovery on
   physical iOS devices.

## Delivery architecture

The browser/PWA build remains the normal server-backed Next.js deployment. The
native export temporarily excludes the local `app/api` directory only while
building, because those authenticated Vercel handlers are intentionally remote in
the installed app. The build script restores the directory in a `finally` block
and repairs an interrupted move before the next run. No API source is removed from
the repository or from the Vercel build.
