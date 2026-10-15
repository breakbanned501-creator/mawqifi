'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from './LocaleProvider';
import ErrorBanner from './ErrorBanner';
import { arriveHandoff,currentParkingLocation,distanceMeters,loadHandoff,openParkingNavigation,type HandoffState } from '@/lib/handoff';
import { isNativeCapacitor } from '@/lib/capacitor';
import { safetyErrorKey } from '@/lib/safety';
import { useRouter } from 'next/navigation';

export default function HandoffPanel({conversationId,userId,blocked,onClosed}:{conversationId:string;userId:string;blocked:boolean;onClosed:(closed:boolean)=>void}) {
 const {t,dir}=useLocale();
 const router=useRouter();
 const [state,setState]=useState<HandoffState|null>(null);
 const [remaining,setRemaining]=useState<number|null>(null);
 const [monitor,setMonitor]=useState(false);
 const [busy,setBusy]=useState(false);
 const [confirmArrival,setConfirmArrival]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const clock=useRef<{server:number;local:number}|null>(null);
 const active=useRef(true);
 const registerRef=useRef<(manual:boolean)=>Promise<void>>(async()=>undefined);
 const readVersion=useRef(0);
 const accept=useCallback((next:HandoffState)=>{
  setState(next);clock.current={server:Date.parse(next.server_now),local:performance.now()};
 },[]);
 useEffect(()=>{
  let disposed=false;
  const refresh=async()=>{
   if(document.visibilityState==='hidden'||!active.current)return;
   const version=++readVersion.current;
   try{const next=await loadHandoff(conversationId);if(!disposed&&version===readVersion.current)accept(next);}
   catch{if(!disposed){onClosed(true);setError(t('common.error'));}}
  };
  void refresh();const timer=setInterval(()=>void refresh(),5000);
  document.addEventListener('visibilitychange',refresh);
  let removeNative:(()=>Promise<void>)|undefined;
  if(isNativeCapacitor())void import('@capacitor/app').then(async({App})=>{
   const result=await App.addListener('appStateChange',({isActive})=>{active.current=isActive;if(isActive)void refresh();});
   if(disposed)void result.remove();else removeNative=()=>result.remove();
  });
  return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);void removeNative?.();};
 },[conversationId,accept,onClosed,t]);
 useEffect(()=>{
  const tick=()=>{
   const claim=state?.claim;
   const serverNow=clock.current?clock.current.server+performance.now()-clock.current.local:0;
   const seconds=claim?.chat_closes_at?Math.max(0,Math.ceil((Date.parse(claim.chat_closes_at)-serverNow)/1000)):null;
   setRemaining(seconds);
   onClosed(Boolean(claim&&(claim.status==='cancelled'||claim.status==='completed'||seconds===0)));
  };
  tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);
 },[state,onClosed]);
 const register=useCallback(async(manual:boolean)=>{
  if(!state?.claim||busy||blocked)return;
  setBusy(true);setError(null);
  try{
   const position=manual?undefined:await currentParkingLocation();
   if(!manual&&state.location&&position&&(position.accuracy_meters==null||position.accuracy_meters>(state.arrival_radius_meters??25)||distanceMeters(position,state.location)>(state.arrival_radius_meters??25)))return;
   if(!manual&&(document.visibilityState!=="visible"||!active.current))return;
   readVersion.current++;accept(await arriveHandoff(conversationId,manual,position));setMonitor(false);setConfirmArrival(false);
  }catch(err){setMonitor(false);setError(t(safetyErrorKey(err)));}
  finally{setBusy(false);}
 },[state,busy,blocked,conversationId,accept,t]);
 useEffect(()=>{registerRef.current=register;},[register]);
 useEffect(()=>{
  if(!monitor||blocked||state?.claim?.status!=='claimed')return;
  const check=()=>{if(document.visibilityState==='visible'&&active.current)void registerRef.current(false);};
  // Explicit opt-in, foreground polling only. No background/Always tracking.
  check();const timer=setInterval(check,15000);return()=>clearInterval(timer);
 },[monitor,blocked,state?.claim?.status]);
 if(!state?.claim)return null;
 const closed=state.claim.status==='cancelled'||state.claim.status==='completed'||remaining===0;
 const claimant=state.claim.claimant_id===userId;
 return <aside className="mx-auto w-full max-w-2xl space-y-3 px-4 py-3" dir={dir}>
  <div className="glass-card p-4 text-sm leading-7" role="status">
   <p>{t(state.claim.status==='cancelled'?'handoff.cancelled':closed?'handoff.closed':state.claim.arrived_at?'handoff.arrived':'handoff.reserved')}</p>
   {remaining!==null&&!closed&&<p className="mt-2 text-2xl font-black tabular-nums" dir="ltr">{String(Math.floor(remaining/60)).padStart(2,'0')}:{String(remaining%60).padStart(2,'0')}</p>}
  </div>
  {state.location&&!closed&&!blocked&&<div className="glass-card space-y-3 p-4">
   <h2 className="font-bold">{t('handoff.location')}</h2>
   <button type="button" className="btn btn-primary w-full" onClick={()=>void openParkingNavigation(state.location!).catch(()=>setError(t('common.error')))}>{t('handoff.maps')}</button>
   {claimant&&!state.claim.arrived_at&&<>
    <p className="text-xs leading-6 text-white/60">{t('handoff.radius',{meters:state.arrival_radius_meters??25})}</p>
    <button type="button" disabled={busy} className="btn btn-secondary w-full" onClick={()=>setMonitor(value=>!value)}>{t(monitor?'handoff.stopArrival':'handoff.detectArrival')}</button>
   </>}
  </div>}
  {claimant&&!closed&&!state.claim.arrived_at&&!blocked&&<button type="button" disabled={busy} className="btn btn-secondary w-full" onClick={()=>setConfirmArrival(true)}>{t('handoff.manualArrival')}</button>}
  {confirmArrival&&<div role="dialog" aria-modal="true" aria-labelledby="arrival-confirm-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
   <div className="glass-card max-w-md space-y-4 p-5"><h2 id="arrival-confirm-title" className="font-bold">{t('handoff.confirmArrival')}</h2>
    <button autoFocus type="button" disabled={busy} className="btn btn-primary w-full" onClick={()=>void register(true)}>{t('handoff.manualArrival')}</button>
    <button type="button" className="btn btn-secondary w-full" onClick={()=>setConfirmArrival(false)}>{t('common.cancel')}</button>
   </div>
  </div>}
  {!closed&&(state.reverse_match||state.claim.owner_id===userId)&&<button type="button" disabled={busy} className="btn btn-danger w-full" onClick={async()=>{
   if(!window.confirm(t('handoff.cancelConfirm')))return;
   setBusy(true);setError(null);
   const supabase=(await import('@/lib/supabase')).getSupabase();
   if(state.reverse_match){
    const {error:matchError}=await supabase.rpc('cancel_reverse_match',{p_conversation_id:conversationId});
    if(matchError){setError(t(safetyErrorKey(matchError)));setBusy(false);return;}
   }else if(state.claim!.owner_id===userId){
    const {error:cancelError}=await supabase.from('parking_posts').update({status:'cancelled'}).eq('id',state.claim!.post_id);
    if(cancelError){setError(t(safetyErrorKey(cancelError)));setBusy(false);return;}
   }else{setBusy(false);return;}
   router.replace('/');
  }}>{t('handoff.cancel')}</button>}
  {error&&<ErrorBanner message={error}/>}
 </aside>;
}
