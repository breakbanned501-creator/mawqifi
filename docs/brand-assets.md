# Mawqifi approved panel assets

## Source and extraction

The user approved extraction from the supplied 2048×683 raster on 2026-10-04. Its unchanged source is committed as `resources/branding/approved-concept.png`. No logo was generated or redrawn. The previous car-shaped SVG is superseded by this approved parking-pin identity.

`node scripts/generate-brand-assets.cjs` reproducibly extracts source pixels:

- App icon: pin/road and yellow accents from the left panel, using silhouette masks to discard the rounded cyan tile, surrounding white area and outer tile shadow. The retained artwork is centered on solid `#00cfea`, with safe padding. Export: `resources/branding/app-icon.png`, opaque RGB 1024×1024, no text or outer corner mask.
- Splash: central panel at x=676, width=663, height=683, without phone frame, presentation labels or controls. Export: `resources/branding/splash-artwork.png` at 1326×1366. It preserves the approved pin, Arabic/English name, both subtitles and skyline.
- Profile/share: right panel's white circle and complete Arabic/English logo; black outer panel removed with an alpha mask. Export: `public/mawqifi-profile.png` at 1024×1024. Only profile/share contexts use the circular full-text composition.

The supplied source is raster, roughly 650px per panel. Higher-resolution exports are upscaled; no additional vector detail is claimed. The script and original are retained so future original-resolution exports can replace this source reproducibly.

## Native assets

The existing `AppIcon.appiconset/AppIcon-512@2x.png` is now the approved opaque 1024px icon. Both Debug and Release already select `AppIcon`; its catalog and Resources membership remain unchanged.

The three `Splash.imageset/mawqifi-mark-{1,2,3}x.png` files now contain approved splash artwork at 330×340, 660×680 and 990×1020. The existing LaunchScreen uses aspect-fit and safe-area centering; width is preferably 95% of the safe width, capped at 420pt, with height capped at 85% of the safe height. Aspect ratio is 33:34. The navy root surrounds the artwork. No screenshots, buttons or loading bar are added. Plugin hide timing is unchanged.

Display name remains the approved existing `Mawqifi`; bundle ID remains `com.mawqifi.app`. There is no selected Capacitor default graphic.

## Web/PWA consistency

The approved no-text icon replaces 192px/512px manifest icons and the 180px apple-touch icon. `public/icon.svg` wraps the same 512px raster for the existing favicon URL; it is a container, not a new vector drawing. Install URLs and manifest behavior are unchanged.

Approved splash artwork replaces the 1170×2532 and 1284×2778 iPhone startup images and 1080×1920 startup asset, centered on navy. The 1200×630 social preview uses the approved full logo on its white circle. Profile branding is available as an asset, without replacing personal account avatars.

## Verification

Source panels and exported icon/splash/profile were visually inspected. Verify real PNG signatures/dimensions, opaque marketing icon and uniform corner pixels, all referenced catalog files, XML safe-area/aspect-fit constraints, selected AppIcon and native copied assets.

Passed: typecheck, lint, web build, native static archive preparation, standalone iOS sync and staging/no-secret verification. Release-hardening (65) and deletion-client (33) regression assertions passed. SHA-256 checks confirmed five branding files copied unchanged into the native bundle. The 60px icon preview was inspected for readability. Physical iPhone launch appearance and signed Xcode asset compilation remain final TestFlight checks; Windows archive preparation is not a signed IPA.

No database, GPS, claim/chat, deletion, arrival/timer, push, place-scoping or environment changes. No main, production or Codemagic operation.

References: [Apple icon asset catalogs](https://developer.apple.com/documentation/xcode/configuring-your-app-icon), [Apple icon masking](https://developer.apple.com/design/human-interface-guidelines/app-icons), [Apple launch-screen asset guidance](https://developer.apple.com/documentation/technotes/tn3118-debugging-your-apps-launch-screen).
