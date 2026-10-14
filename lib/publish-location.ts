import { isNativeCapacitor } from './capacitor';
import type { ParkingLocation } from './handoff';
import { publishTiming, publishGpsDiagnostics } from './publish-timing';

export type PublishLocation = ParkingLocation & { capturedAt: number; foregroundSession: number };
export const PUBLISH_GPS_WINDOW_MS = 12000;
let foregroundSession = 0;
let active = true;
let listening = false;
let cancellationVersion = 0;
type Acquisition = {
  session: number;
  controller: AbortController;
  watching: boolean;
  stopping: boolean;
  cleanupFailed: boolean;
  result: Promise<PublishLocation>;
  cleaned: Promise<void>;
  release: () => void;
};
let pending: Acquisition | null = null;

export function cancelPublishLocation(): void {
  cancellationVersion++;
  pending?.controller.abort();
}
export function publishAppState(isActive: boolean): void {
  active = isActive;
  if (!isActive) {
    foregroundSession++;
    // A permission sheet can temporarily inactivate iOS. Never start a watch
    // until permission has resolved and the application is foreground again.
    if (pending?.watching) cancelPublishLocation();
  }
}
function foreground(): boolean {
  return active && (typeof document === 'undefined' || document.visibilityState !== 'hidden');
}
function bounded<T>(promise: Promise<T>, milliseconds: number, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancelled = () => reject(new Error('PUBLISH_LOCATION_CANCELLED'));
    const timer = setTimeout(() => reject(new Error('PUBLISH_LOCATION_TIMEOUT')), milliseconds);
    signal.addEventListener('abort', cancelled, { once: true });
    if (signal.aborted) cancelled();
    promise.then(resolve, reject).finally(() => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancelled);
    });
  });
}
export function usablePublishLocation(fix: PublishLocation): boolean {
  const age = Date.now() - fix.capturedAt;
  return foreground() && fix.foregroundSession === foregroundSession && age >= -1000 && age <= 15000 &&
    Number.isFinite(fix.latitude) && Math.abs(fix.latitude) <= 90 && Number.isFinite(fix.longitude) && Math.abs(fix.longitude) <= 180 &&
    fix.accuracy_meters !== null && Number.isFinite(fix.accuracy_meters) && fix.accuracy_meters >= 0 && fix.accuracy_meters <= 25;
}
type Position = { timestamp: number; coords: { latitude: number; longitude: number; accuracy: number } };
type SampleCallback = (position: Position | null, error?: { code?: string | number }) => void;
type StartWatch = (callback: SampleCallback) => Promise<() => Promise<void>>;

function release(operation: Acquisition): void {
  if (pending === operation) pending = null;
  operation.release();
}
function watchForFix(operation: Acquisition, start: StartWatch): Promise<PublishLocation> {
  const startedAt = Date.now();
  operation.watching = true;
  return new Promise((resolve, reject) => {
    let finished = false;
    let sampleCount = 0;
    let firstAccuracy: number | null = null;
    let best: PublishLocation | null = null;
    let timer: ReturnType<typeof setTimeout>;
    // Start asynchronously so callbacks may fire before the native watch ID
    // arrives, without losing the cleanup handle.
    const handle = Promise.resolve().then(() => {
      if (operation.controller.signal.aborted) throw new Error('PUBLISH_LOCATION_CANCELLED');
      return start(sample);
    });
    const finish = (error: Error | null, fix: PublishLocation | null = null) => {
      if (finished) return;
      finished = true;
      operation.stopping = true;
      clearTimeout(timer);
      operation.controller.signal.removeEventListener('abort', cancelled);
      publishGpsDiagnostics({
        firstAccuracyMeters: firstAccuracy,
        bestAccuracyMeters: best?.accuracy_meters ?? null,
        sampleCount,
        elapsedMs: Date.now() - startedAt,
        timeToAcceptableMs: fix ? Date.now() - startedAt : null,
        outcome: fix ? 'accepted' : error?.message === 'PUBLISH_LOCATION_CANCELLED' ? 'cancelled' : 'failed',
      });
      if (error) reject(error); // Timeout UI does not wait for a late native ID.
      void handle.then(async stop => {
        await stop();
        release(operation);
        if (fix) { publishTiming('gps-ready'); resolve(fix); }
      }, () => {
        release(operation); // Registration failed: no watch exists to clear.
      }).catch(() => {
        // Keep the gate closed if native cleanup fails. Never overlap watches
        // or publish a fix while the previous watcher may still be running.
        operation.cleanupFailed = true;
        reject(new Error('PUBLISH_LOCATION_CLEANUP'));
      });
    };
    const cancelled = () => finish(new Error('PUBLISH_LOCATION_CANCELLED'));
    const sample: SampleCallback = (position, error) => {
      if (finished) return;
      if (!foreground() || operation.session !== foregroundSession) { cancelled(); return; }
      if (error) {
        if ([1, 'OS-PLUG-GLOC-0003', 'OS-PLUG-GLOC-0007', 'OS-PLUG-GLOC-0008', 'OS-PLUG-GLOC-0009'].includes(error.code ?? '')) {
          finish(new Error('HANDOFF_LOCATION_REQUIRED'));
        }
        // Transient unavailable/timeout callbacks can be followed by better fixes.
        return;
      }
      if (!position) return;
      if (Date.now() - startedAt >= PUBLISH_GPS_WINDOW_MS) {
        finish(new Error(best ? 'PUBLISH_LOCATION_INACCURATE' : 'PUBLISH_LOCATION_TIMEOUT'));
        return;
      }
      sampleCount++;
      const accuracy = position.coords.accuracy;
      if (sampleCount === 1 && Number.isFinite(accuracy) && accuracy >= 0) firstAccuracy = accuracy;
      const fix: PublishLocation = {
        latitude: position.coords.latitude, longitude: position.coords.longitude,
        accuracy_meters: accuracy, capturedAt: position.timestamp,
        foregroundSession: operation.session,
      };
      // maximumAge:0 is also requested, but never trust a cached callback from
      // before this acquisition, even if it claims excellent accuracy.
      if (fix.capturedAt < startedAt || fix.capturedAt > Date.now() + 1000 ||
          !Number.isFinite(fix.capturedAt) || !Number.isFinite(fix.latitude) || Math.abs(fix.latitude) > 90 ||
          !Number.isFinite(fix.longitude) || Math.abs(fix.longitude) > 180 ||
          !Number.isFinite(accuracy) || accuracy < 0) return;
      if (!best || accuracy < best.accuracy_meters!) best = fix;
      if (usablePublishLocation(fix)) finish(null, fix);
    };
    timer = setTimeout(() => finish(new Error(best ? 'PUBLISH_LOCATION_INACCURATE' : 'PUBLISH_LOCATION_TIMEOUT')), PUBLISH_GPS_WINDOW_MS);
    operation.controller.signal.addEventListener('abort', cancelled, { once: true });
    if (operation.controller.signal.aborted) cancelled();
    void handle.catch(error => finish(error instanceof Error ? error : new Error('HANDOFF_LOCATION_REQUIRED')));
  });
}

/** No settled-position cache. One current foreground acquisition, including cleanup. */
export function acquirePublishLocation(): Promise<PublishLocation> {
  if (!listening && typeof document !== 'undefined') {
    listening = true;
    document.addEventListener('visibilitychange', () => publishAppState(document.visibilityState !== 'hidden'));
  }
  if (!foreground()) return Promise.reject(new Error('HANDOFF_LOCATION_REQUIRED'));
  if (pending?.cleanupFailed) return Promise.reject(new Error('PUBLISH_LOCATION_CLEANUP'));
  if (pending) {
    if (!pending.stopping && !pending.controller.signal.aborted) return pending.result;
    const version = cancellationVersion;
    // A delayed native ID/cleanup must neither allow overlapping watches nor
    // leave retry UI spinning forever. Navigation invalidates queued retries.
    return bounded(pending.cleaned, PUBLISH_GPS_WINDOW_MS, new AbortController().signal).then(() => {
      if (version !== cancellationVersion) throw new Error('PUBLISH_LOCATION_CANCELLED');
      return acquirePublishLocation();
    });
  }
  let done!: () => void;
  const operation: Acquisition = {
    session: foregroundSession, controller: new AbortController(), watching: false, stopping: false, cleanupFailed: false,
    result: Promise.resolve(null as unknown as PublishLocation),
    cleaned: new Promise(resolve => { done = resolve; }), release: () => done(),
  };
  pending = operation;
  operation.result = (async () => {
    try {
      let start: StartWatch;
      if (isNativeCapacitor()) {
        const { Geolocation } = await import('@capacitor/geolocation');
        const signal = operation.controller.signal;
        const permission = await bounded((async () => {
          let status = await Geolocation.checkPermissions();
          if (signal.aborted) throw new Error('PUBLISH_LOCATION_CANCELLED');
          if (status.location !== 'granted') status = await Geolocation.requestPermissions({ permissions: ['location'] });
          return status;
        })(), 30000, signal);
        if (permission.location !== 'granted') throw new Error('HANDOFF_LOCATION_REQUIRED');
        publishTiming('permission-resolved');
        operation.session = foregroundSession;
        start = async callback => {
          const id = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: PUBLISH_GPS_WINDOW_MS, maximumAge: 0 }, callback);
          return () => Geolocation.clearWatch({ id });
        };
      } else {
        if (!navigator.geolocation) throw new Error('HANDOFF_LOCATION_REQUIRED');
        start = async callback => {
          const id = navigator.geolocation.watchPosition(position => callback(position), error => callback(null, error),
            { enableHighAccuracy: true, timeout: PUBLISH_GPS_WINDOW_MS, maximumAge: 0 });
          return async () => { navigator.geolocation.clearWatch(id); };
        };
      }
      if (operation.controller.signal.aborted || !foreground()) throw new Error('PUBLISH_LOCATION_CANCELLED');
      return await watchForFix(operation, start);
    } catch (error) {
      operation.stopping = true;
      if (!operation.watching) { operation.controller.abort(); release(operation); }
      throw error;
    }
  })();
  return operation.result;
}

/** Checks an existing grant without opening a browser or iOS permission prompt. */
export async function hasGrantedLocationPermission(): Promise<boolean> {
  if (isNativeCapacitor()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    const status = await Geolocation.checkPermissions();
    return status.location === 'granted';
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation || !navigator.permissions) return false;
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state === 'granted';
  } catch {
    return false;
  }
}
