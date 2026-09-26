# Mawqifi iOS foundation

This directory is a Capacitor iOS foundation generated on Windows. It has not been
built, signed, or archived with Xcode.

## Before opening in Xcode

1. Use macOS with current Xcode and CocoaPods/Swift Package Manager support.
2. Run `npm ci` and `npx cap sync ios` from the repository root.
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

The Capacitor configuration intentionally keeps Mawqifi's server-backed Next.js
application and its existing API routes. `server.url` is an integration bridge for
this foundation, not a final App Store delivery setting: Capacitor documents it for
live-reload development rather than production release use. Do not convert the web
app to a static export without a separate assessment of its authenticated API,
Supabase Realtime, and server-route requirements.
