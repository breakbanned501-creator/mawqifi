const assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
let count=0;
function check(name,ok){assert(ok,name);count++;console.log('PASS '+name);}
function load(p,modules){
 const code=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
 const exports={};new Function('require','exports',code)(name=>{if(name in modules)return modules[name];throw Error('Unexpected module '+name);},exports);return exports;
}
const i18n=load('lib/i18n/index.ts',{});
const safety=load('lib/safety.ts',{'./supabase':{}});
let native=false,opened;
const handoff=load('lib/handoff.ts',{
 './supabase':{},'./capacitor':{isNativeCapacitor:()=>native},'./native-media':{},
 '@capacitor/app-launcher':{AppLauncher:{openUrl:async options=>{opened=options.url;}}},
});
const rendered=(locale,key)=>renderToStaticMarkup(React.createElement(React.Fragment,null,i18n.translate(locale,key)));
async function main(){
 const errors={'HANDOFF_ALREADY_CLAIMED':'handoff.alreadyClaimed','HANDOFF_CHAT_CLOSED':'handoff.closed','HANDOFF_LOCATION_REQUIRED':'handoff.locationRequired','HANDOFF_NOT_NEAR':'handoff.notNear'};
 for(const locale of ['ar','en']){
  for(const [error,key] of Object.entries(errors)){check('Localized handoff error '+locale+' '+error,safety.safetyErrorKey({message:error})===key&&i18n.translate(locale,key)!==key&&!i18n.translate(locale,key).includes(error));}
  for(const status of ['claimed','arrived','completed','cancelled']){
   let slot=0;const state={claim:{id:'fixture',post_id:'fixture',owner_id:'A',claimant_id:'B',conversation_id:'fixture',status,arrived_at:status==='claimed'?null:'2026-10-02T12:00:00Z',chat_closes_at:status==='claimed'?null:'2026-10-02T12:15:00Z'},location:{latitude:29.3,longitude:47.9,accuracy_meters:5},server_now:'2026-10-02T12:00:00Z',arrival_radius_meters:25};
   const panel=load('components/HandoffPanel.tsx',{
    react:{...React,useState:initial=>{const index=slot++;return [index===0?state:index===1?(status==='arrived'?899:null):initial,()=>undefined];}},
    'react/jsx-runtime':require('react/jsx-runtime'),
    './LocaleProvider':{useLocale:()=>({t:(k,v)=>i18n.translate(locale,k,v),dir:locale==='ar'?'rtl':'ltr'})},
    './ErrorBanner':{default:()=>null},'@/lib/handoff':handoff,'@/lib/capacitor':{isNativeCapacitor:()=>false},'@/lib/safety':safety,
   }).default;
   const html=renderToStaticMarkup(React.createElement(panel,{conversationId:'fixture',userId:'B',blocked:false,onClosed:()=>undefined}));
   check('Handoff state direction '+locale+' '+status,html.includes('dir="'+(locale==='ar'?'rtl':'ltr')+'"'));
   if(status==='claimed')check('Private navigation/manual arrival render '+locale,html.includes(rendered(locale,'handoff.maps'))&&html.includes(rendered(locale,'handoff.manualArrival')));
   if(status==='arrived')check('15-minute countdown renders '+locale,html.includes('14:59')&&html.includes(rendered(locale,'handoff.arrived')));
   if(['completed','cancelled'].includes(status))check('Closed state removes navigation/arrival '+locale+' '+status,!html.includes(rendered(locale,'handoff.maps'))&&!html.includes(rendered(locale,'handoff.manualArrival')));
  }
 }
 const a={latitude:29.3,longitude:47.9,accuracy_meters:5};
 check('Zero-distance location',handoff.distanceMeters(a,a)===0);
 check('24m inside radius',handoff.distanceMeters(a,{...a,latitude:a.latitude+24/6371000*180/Math.PI})<25);
 check('26m outside radius',handoff.distanceMeters(a,{...a,latitude:a.latitude+26/6371000*180/Math.PI})>25);
 global.window={open:(...args)=>{opened=args;}};
 await handoff.openParkingNavigation(a);
 check('Web system navigation has no opener',opened[0].startsWith('https://www.google.com/maps/dir/')&&opened[2]==='noopener,noreferrer');
 native=true;await handoff.openParkingNavigation(a);
 check('iOS delegates to Apple Maps through AppLauncher',opened==='https://maps.apple.com/?daddr=29.3%2C47.9');
 await assert.rejects(handoff.openParkingNavigation({...a,latitude:NaN}));count++;
 console.log('Handoff UI/helper assertions: '+count);
}
main().catch(e=>{console.error(e);process.exit(1);});
