import { isNativeCapacitor } from './capacitor';
import type { ParkingLocation } from './handoff';
import { publishTiming } from './publish-timing';
export type PublishLocation = ParkingLocation & { capturedAt: number; foregroundSession: number };
let foregroundSession = 0;
let active = true;
let listening = false;
let pending: { session: number; result: Promise<PublishLocation> } | null = null;
export function publishAppState(isActive: boolean): void {
  active = isActive;
  if (!isActive) foregroundSession++;
}
function foreground(): boolean { return active && (typeof document === 'undefined' || document.visibilityState !== 'hidden'); }
function bounded<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve,reject) => {
    const timeout=setTimeout(()=>reject(new Error('PUBLISH_LOCATION_TIMEOUT')),milliseconds);
    promise.then(resolve,reject).finally(()=>clearTimeout(timeout));
  });
}
export function usablePublishLocation(fix: PublishLocation): boolean {
  const age = Date.now() - fix.capturedAt;
  return foreground() && fix.foregroundSession === foregroundSession && age >= -1000 && age <= 15000 &&
    Number.isFinite(fix.latitude) && Math.abs(fix.latitude) <= 90 && Number.isFinite(fix.longitude) && Math.abs(fix.longitude) <= 180 &&
    fix.accuracy_meters !== null && Number.isFinite(fix.accuracy_meters) && fix.accuracy_meters >= 0 && fix.accuracy_meters <= 25;
}
/** No settled-position cache. Share only an outstanding foreground acquisition. */
export function acquirePublishLocation(): Promise<PublishLocation> {
  if (!listening && typeof document !== 'undefined') {
    listening=true;
    document.addEventListener('visibilitychange',()=>publishAppState(document.visibilityState !== 'hidden'));
  }
  if (!foreground()) return Promise.reject(new Error('HANDOFF_LOCATION_REQUIRED'));
  if (pending) return pending.result;
  const operation = { session: foregroundSession, result: Promise.resolve(null as unknown as PublishLocation) };
  const raw = (async()=>{
    let position: { timestamp: number; coords: { latitude: number; longitude: number; accuracy: number } };
    if (isNativeCapacitor()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      let permission = await bounded(Geolocation.checkPermissions(),30000);
      if (permission.location !== 'granted') permission = await bounded(Geolocation.requestPermissions({permissions:['location']}),30000);
      if (permission.location !== 'granted') throw new Error('HANDOFF_LOCATION_REQUIRED');
      publishTiming('permission-resolved');
      // Permission UI can temporarily inactivate iOS; start the GPS epoch afterwards.
      operation.session=foregroundSession;
      position = await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:15000,maximumAge:0});
    } else {
      if (!navigator.geolocation) throw new Error('HANDOFF_LOCATION_REQUIRED');
      // Browsers may combine permission and GPS. Do not invent a permission timestamp.
      const permission = await navigator.permissions?.query({name:'geolocation'}).catch(()=>null);
      if (permission?.state === 'granted') publishTiming('permission-resolved');
      if (permission) permission.onchange=()=>{ if(permission.state==='granted') publishTiming('permission-resolved'); };
      try {
        position = await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
      } finally { if(permission) permission.onchange=null; }
    }
    const fix: PublishLocation = {latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy_meters:position.coords.accuracy,capturedAt:position.timestamp,foregroundSession:operation.session};
    if(!usablePublishLocation(fix)) throw new Error('PUBLISH_LOCATION_INACCURATE');
    publishTiming('gps-ready');
    return fix;
  })();
  // Keep the raw operation registered until it settles, even if the UI watchdog
  // expires: a retry must not overlap a still-running native GPS request.
  operation.result=bounded(raw,isNativeCapacitor()?46000:16000);
  pending=operation;
  void raw.finally(()=>{if(pending===operation)pending=null;}).catch(()=>{});
  return operation.result;
}