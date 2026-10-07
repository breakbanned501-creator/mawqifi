# App Review Demo Mode

Mawqifi 1.0 includes a deterministic, isolated demonstration for App Store Review. It requires no credentials, second device, second installation, or developer intervention.

## Access

1. Launch Mawqifi and wait for the normal anonymous session initialization.
2. On Home, tap **App Review Demo** / **وضع مراجعة App Store**. The same entry is also visible in **Account / Settings**.
3. The amber notice confirms that the page uses synthetic data only.

## Suggested review walkthrough

1. Select Kuwait University, PAAET, or GUST.
2. Review the synthetic available spot. Its exact location remains hidden until it is claimed.
3. Tap **Publish a demo spot** to exercise the leaving/publishing state without collecting device location or writing to production.
4. Tap **Claim and open chat**. The synthetic counterpart, private chat, and private synthetic parking location become visible.
5. Send text and a bundled synthetic image.
6. Tap **Open in Maps** to hand the predefined synthetic Kuwait City coordinate to the system Maps application.
7. Tap **I've arrived**, observe the 15-minute countdown, then use **Preview timer completion** to verify the retained read-only conversation state immediately.
8. Report the synthetic user or message using the normal report dialog. Block and unblock the synthetic counterpart; history remains visible.
9. Review the synthetic account/profile section.
10. Tap **Delete demo account**, confirm deletion, then tap **Recreate demo account** to reset the reusable environment.

The reset button in the page header restores the complete demonstration at any time.

## Isolation guarantees

- The demo route has no Supabase, server API, Storage, Realtime, GPS, camera-library, or push-notification calls.
- All demo state lives in page memory and is discarded when the route reloads or resets.
- The counterpart, messages, image, identifiers, report, block state, coordinate, and account are synthetic.
- The demo image is bundled at `public/review-demo-parking.svg` and is never uploaded.
- The predefined location is not derived from a Mawqifi user.
- Account deletion removes only the in-memory demo state and can recreate it immediately.
- Normal anonymous authentication and every production workflow remain unchanged outside this route.

## App Review notes text

> No login credentials are required. Launch the app and tap **App Review Demo** on the Home screen. This isolated single-device demonstration uses only synthetic data and provides place selection, parking publish/discovery/claim, private chat, text/image messaging, private location and Maps handoff, arrival/countdown/read-only completion, reporting, blocking, profile, and reusable account deletion. Tap the reset icon at any time to restore the demo.

