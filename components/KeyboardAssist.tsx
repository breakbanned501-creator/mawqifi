'use client';
import { useEffect,useState } from 'react';
import { useLocale } from './LocaleProvider';
import { isNativeCapacitor } from '@/lib/capacitor';
export default function KeyboardAssist(){
 const {t}=useLocale();const [editing,setEditing]=useState(false);
 useEffect(()=>{
  const editable=(target:EventTarget|null)=>target instanceof HTMLTextAreaElement||(target instanceof HTMLInputElement&&!['file','checkbox','radio','button'].includes(target.type));
  const focus=(event:FocusEvent)=>{if(editable(event.target)){setEditing(true);setTimeout(()=>{if(event.target instanceof HTMLElement)event.target.scrollIntoView({block:'center',behavior:'smooth'});},250);}};
  const blur=()=>setTimeout(()=>setEditing(editable(document.activeElement)),0);
  const outside=(event:PointerEvent)=>{if(event.target instanceof Element&&!event.target.closest('input,textarea,button,a,select,label,[role="dialog"]')){if(document.activeElement instanceof HTMLElement)document.activeElement.blur();}};
  document.addEventListener('focusin',focus);document.addEventListener('focusout',blur);document.addEventListener('pointerdown',outside);
  return()=>{document.removeEventListener('focusin',focus);document.removeEventListener('focusout',blur);document.removeEventListener('pointerdown',outside);};
 },[]);
 useEffect(()=>{document.documentElement.classList.toggle("keyboard-editing",editing);return()=>document.documentElement.classList.remove("keyboard-editing");},[editing]);
 return editing?<div className="keyboard-done fixed inset-x-0 bottom-0 z-[60] flex justify-end bg-navy-900 px-4 py-2">
  <button type="button" className="rounded-xl bg-white/10 px-5 py-2 font-bold" onClick={()=>{
   if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
   if(isNativeCapacitor())void import('@capacitor/keyboard').then(({Keyboard})=>Keyboard.hide()).catch(()=>undefined);
  }}>{t('handoff.done')}</button>
 </div>:null;
}
