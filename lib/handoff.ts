import { getSupabase } from './supabase';
import { isNativeCapacitor } from './capacitor';
import { getNativeCurrentLocation } from './native-media';

export type ParkingLocation = { latitude: number; longitude: number; accuracy_meters: number | null };
export type ParkingClaim = { id: string; post_id: string; owner_id: string; claimant_id: string; conversation_id: string; status: 'claimed' | 'arrived' | 'completed' | 'cancelled'; arrived_at: string | null; chat_closes_at: string | null };
export type HandoffState = { claim: ParkingClaim | null; location?: ParkingLocation | null; server_now: string; arrival_radius_meters?: number };
export async function loadHandoff(conversationId: string): Promise<HandoffState> {
 const { data,error }=await getSupabase().rpc('get_parking_handoff',{conversation_id:conversationId});
 if(error) throw error;
 return data as HandoffState;
}
export async function arriveHandoff(conversationId: string, manual: boolean, location?: ParkingLocation): Promise<HandoffState> {
 const {data,error}=await getSupabase().rpc('arrive_parking_handoff',{conversation_id:conversationId,manual,
 latitude:location?.latitude??null,longitude:location?.longitude??null,accuracy_meters:location?.accuracy_meters??null});
 if(error) throw error; return data as HandoffState;
}
export async function currentParkingLocation(): Promise<ParkingLocation> {
 if(isNativeCapacitor()) {
  const location=await getNativeCurrentLocation();
  return {...location,accuracy_meters:location.accuracy};
 }
 if(!navigator.geolocation) throw new Error('HANDOFF_LOCATION_REQUIRED');
 return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(
  position=>resolve({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy_meters:position.coords.accuracy}),
  reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
}
export function distanceMeters(a: ParkingLocation,b: ParkingLocation): number {
 const rad=(n:number)=>n*Math.PI/180;
 const h=Math.sin(rad(a.latitude-b.latitude)/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(a.longitude-b.longitude)/2)**2;
 return 6371000*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export async function openParkingNavigation(location: ParkingLocation): Promise<void> {
 if(!Number.isFinite(location.latitude)||!Number.isFinite(location.longitude)||Math.abs(location.latitude)>90||Math.abs(location.longitude)>180) throw new Error('Invalid location');
 const coordinates=encodeURIComponent(location.latitude+','+location.longitude);
 if(isNativeCapacitor()) {
  const {AppLauncher}=await import('@capacitor/app-launcher');
  await AppLauncher.openUrl({url:'https://maps.apple.com/?daddr='+coordinates});
 } else window.open('https://www.google.com/maps/dir/?api=1&destination='+coordinates,'_blank','noopener,noreferrer');
}
