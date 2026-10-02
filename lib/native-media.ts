import { Capacitor } from '@capacitor/core';
import { isNativeCapacitor } from './capacitor';

export type NativeChatImageSource = 'camera' | 'photos';

function isUserCancellation(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : '';
  const message = error instanceof Error ? error.message : '';
  return code === 'OS-PLUG-CAMR-0006' || /cancel/i.test(message);
}

async function toUploadFile(result: { uri?: string; webPath?: string; metadata?: { format?: string } }): Promise<File> {
  const resourceUrl = result.webPath ?? (result.uri ? Capacitor.convertFileSrc(result.uri) : null);
  if (!resourceUrl) throw new Error('The selected image could not be read.');

  const response = await fetch(resourceUrl);
  if (!response.ok) throw new Error('The selected image could not be read.');

  const blob = await response.blob();
  const format = result.metadata?.format?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpeg';
  const type = blob.type || `image/${format === 'jpg' ? 'jpeg' : format}`;
  return new File([blob], `mawqifi-chat-${Date.now()}.${format}`, { type });
}

/**
 * Uses the iOS camera/photo picker only after the student taps the existing
 * chat control. Browser callers continue using the file inputs unchanged.
 */
export async function selectNativeChatImage(source: NativeChatImageSource): Promise<File | null> {
  if (!isNativeCapacitor()) return null;

  try {
    const { Camera, MediaTypeSelection } = await import('@capacitor/camera');
    const result =
      source === 'camera'
        ? await Camera.takePhoto({ quality: 85, correctOrientation: true })
        : (await Camera.chooseFromGallery({
            mediaType: MediaTypeSelection.Photo,
            allowMultipleSelection: false,
            quality: 85,
          })).results[0];

    if (!result) return null;
    return toUploadFile(result);
  } catch (error) {
    if (isUserCancellation(error)) return null;
    throw error;
  }
}

/** Reads one current location only when the student explicitly taps send location. */
export async function getNativeCurrentLocation(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  if (!isNativeCapacitor()) throw new Error('Native location is unavailable.');

  const { Geolocation } = await import('@capacitor/geolocation');
  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 15_000,
    maximumAge: 0,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };
}
