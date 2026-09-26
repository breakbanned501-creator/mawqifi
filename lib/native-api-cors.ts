import { NextResponse } from 'next/server';
import { MAWQIFI_CAPACITOR_IOS_ORIGIN } from '@/lib/capacitor-origin';

const ALLOWED_METHODS = 'POST, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'Authorization, Content-Type';
const PREFLIGHT_MAX_AGE_SECONDS = '600';

function isCapacitorNativeOrigin(origin: string | null): origin is typeof MAWQIFI_CAPACITOR_IOS_ORIGIN {
  return origin === MAWQIFI_CAPACITOR_IOS_ORIGIN;
}

/**
 * Adds CORS only for the exact local origin used by the bundled iOS app.
 * Web/PWA callers remain same-origin and do not receive a permissive policy.
 */
export function withNativeApiCors<T extends NextResponse>(request: Request, response: T): T {
  const origin = request.headers.get('origin');
  response.headers.append('Vary', 'Origin');

  if (!isCapacitorNativeOrigin(origin)) return response;

  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  response.headers.set('Access-Control-Max-Age', PREFLIGHT_MAX_AGE_SECONDS);
  return response;
}

export async function withNativeApiCorsHandler(
  request: Request,
  handler: () => NextResponse | Promise<NextResponse>,
): Promise<NextResponse> {
  return withNativeApiCors(request, await handler());
}

/** Answers only the Capacitor iOS preflight; all other origins remain denied. */
export function nativeApiOptions(request: Request): NextResponse {
  if (!isCapacitorNativeOrigin(request.headers.get('origin'))) {
    return NextResponse.json({ error: 'Origin is not allowed.' }, { status: 403 });
  }

  return withNativeApiCors(request, new NextResponse(null, { status: 204 }));
}
