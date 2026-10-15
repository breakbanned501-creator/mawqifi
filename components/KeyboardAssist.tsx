'use client';
import { useEffect } from 'react';
export default function KeyboardAssist(){
 useEffect(()=>{
  const editable=(target:EventTarget|null)=>target instanceof HTMLTextAreaElement||(target instanceof HTMLInputElement&&!['file','checkbox','radio','button'].includes(target.type));
  const focus=(event:FocusEvent)=>{if(editable(event.target)){document.documentElement.classList.add('keyboard-editing');setTimeout(()=>{if(event.target instanceof HTMLElement)event.target.scrollIntoView({block:'nearest',behavior:'smooth'});},250);}};
  const blur=()=>setTimeout(()=>document.documentElement.classList.toggle('keyboard-editing',editable(document.activeElement)),0);
  const outside=(event:PointerEvent)=>{if(event.target instanceof Element&&!event.target.closest('input,textarea,button,a,select,label,[role="dialog"]')){if(document.activeElement instanceof HTMLElement)document.activeElement.blur();}};
  document.addEventListener('focusin',focus);document.addEventListener('focusout',blur);document.addEventListener('pointerdown',outside);
  return()=>{document.documentElement.classList.remove('keyboard-editing');document.removeEventListener('focusin',focus);document.removeEventListener('focusout',blur);document.removeEventListener('pointerdown',outside);};
 },[]);
 return null;
}
