/**
 * Capacitor's local iOS origin. Keep this in one shared module so the native
 * release configuration and Vercel's narrow CORS policy cannot drift apart.
 */
export const MAWQIFI_CAPACITOR_IOS_SCHEME = 'capacitor';
export const MAWQIFI_CAPACITOR_HOSTNAME = 'localhost';
export const MAWQIFI_CAPACITOR_IOS_ORIGIN = `${MAWQIFI_CAPACITOR_IOS_SCHEME}://${MAWQIFI_CAPACITOR_HOSTNAME}`;
