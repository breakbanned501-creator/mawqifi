# iOS push release checklist

Mawqifi uses the native APNs token returned by `@capacitor/push-notifications`. The app sends that token to the authenticated `/api/push/native-token` route; the token table remains inaccessible to client roles. The notification APIs select eligible recipients, apply preferences and block filtering, and send native alerts through APNs without logging device tokens.

Before producing an App Store build:

1. In Apple Developer → Certificates, Identifiers & Profiles → Identifiers → `com.mawqifi.app`, enable **Push Notifications**.
2. Regenerate the App Store distribution provisioning profile for `com.mawqifi.app`. Replace the Codemagic profile referenced as `mawqifi_app_store` if the existing profile predates the capability.
3. Configure these server-only variables in the Vercel **Production** environment: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_TOPIC=com.mawqifi.app`, and `APNS_ENVIRONMENT=production`. Never add them to `NEXT_PUBLIC_*` or the Codemagic native build group.
4. Deploy the server changes to the production backend before testing the new app build.
5. Build through the production Codemagic workflow. Its signed-IPA gate verifies that both the embedded profile and signed app contain `aps-environment=production` and that the application identifier ends in `com.mawqifi.app`.
6. On a physical iPhone, grant permission, confirm the settings screen reports enabled only after server persistence, and test parking and private-message notifications in the background and after normal app termination. Apple does not deliver remote notifications to an app the user force-quits until it is opened again.

Do not release if the provisioning profile check fails, the server variables are incomplete, token persistence fails, or the physical-device delivery tests have not passed.
