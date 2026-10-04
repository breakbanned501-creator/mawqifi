# Mawqifi native and web branding

Source: existing `public/icon.svg`, the repository's scalable cyan/navy Mawqifi artwork. The drawing, Arabic title, gradients and proportions are preserved. No new logo was commissioned or generated. The older blue P/car image under `mawqifi-main/artifacts/mobile/assets/images/icon.png` is an unused legacy artifact and was left untouched.

The audit found Capacitor's default blue mark on the selected native AppIcon and three native launch PNGs. The five public files named PNG were actually green placeholder SVG text. Those selected placeholders are now replaced.

## Native assets

- `AppIcon.appiconset/AppIcon-512@2x.png`: real 1024×1024 RGB PNG, fully opaque. The original outer background's rounded clipping is removed; the artwork's inner decorative outline remains. iOS applies the outer icon mask. Existing catalog filename and AppIcon build selection are preserved.
- `Splash.imageset/mawqifi-mark-{1,2,3}x.png`: transparent mark at 240/480/720 pixels, extracted from the same SVG by omitting only its background and decorative outline. All three former default Capacitor splash files are removed.
- `LaunchScreen.storyboard`: solid `#0a1128` root view, mark centered relative to the safe-area guide with aspect-fit. Preferred width is 45% of safe width, capped at 240 points and 60% of safe height. These constraints adapt to narrow phones, notches, Dynamic Island, landscape and larger screens without top offsets or artwork cropping. No buttons or loading UI.
- Display name remains the approved existing `Mawqifi`; bundle ID remains `com.mawqifi.app`. Both Debug and Release select `AppIcon`; the asset catalog and LaunchScreen are already included in Resources. The existing Capacitor SplashScreen plugin loads this storyboard; hide timing and app logic are unchanged.

## Web/PWA assets

Real opaque PNGs replace `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180×180), `splash-iphone.png` (1170×2532), and `splash-android.png` (1080×1920). The new `splash-iphone-large.png` (1284×2778) matches the existing 428×926 @3x startup media entry. The previously referenced but missing `og-image.png` now contains the same mark on navy at 1200×630. Manifest/icon URLs, native/PWA separation, favicon SVG and service-worker behavior remain unchanged.

Reproduce the committed artwork with `node scripts/generate-brand-assets.cjs` using the existing installed Sharp dependency. SVG text rendering requires an installed font supporting Arabic (the source requests Arial); inspect the output if regenerating on a different machine. Raster assets are committed, so CI need not regenerate them. The local font-cache warning did not prevent rendering; Arabic shaping was visually inspected.

## Verification

2026-10-04: verified PNG signatures, dimensions and alpha metadata for eleven native/web assets (48 checks including the selected AppIcon and bundle ID); parsed storyboard XML and verified safe-area/aspect-fit constraints. Visually inspected the 1024px icon, launch mark and 60px Home Screen approximation. No selected native asset retains the default Capacitor mark. Runtime Capacitor code and dependencies remain intact.

Typecheck, lint, web build, native static archive preparation and standalone iOS sync passed; release-hardening (65) and account-deletion client (33) regression assertions passed. Native verification confirms local assets, no remote `server.url`, no native service worker and no private secrets. SHA-256 comparisons confirm six repaired web branding files were copied unchanged into the native bundle. Staging backend configuration is preserved. Windows validates static native archive preparation; signed Xcode asset compilation and physical-device launch appearance remain the final TestFlight checks. No Codemagic build, production operation or database change is part of this task.

References: [Apple icon asset catalogs](https://developer.apple.com/documentation/xcode/configuring-your-app-icon), [Apple icon masking guidance](https://developer.apple.com/design/human-interface-guidelines/app-icons), [Apple launch-screen asset catalog guidance](https://developer.apple.com/documentation/technotes/tn3118-debugging-your-apps-launch-screen).
