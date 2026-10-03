// Exercise the actual Home handlers with controlled GPS/network promises.
const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
let assertions=0;const check=(name,value)=>{assert(value,name);assertions++;console.log('PASS '+name);};
function harness(){
 const slots=[],effects=[];let index=0;const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const memo=(f,deps)=>{const n=index++;if(!slots[n]||!same(slots[n].deps,deps))slots[n]={deps,value:f()};return slots[n].value;};
 const hooks={useState:init=>{const n=index++;if(!(n in slots))slots[n]=typeof init==='function'?init():init;return [slots[n],v=>{slots[n]=typeof v==='function'?v(slots[n]):v;}];},useRef:v=>{const n=index++;return slots[n]??(slots[n]={current:v});},useMemo:memo,useCallback:(f,d)=>memo(()=>f,d),useEffect:(f,d)=>{const n=index++;if(!slots[n]||!same(slots[n].deps,d)){const prev=slots[n];slots[n]={deps:d};effects.push(()=>{prev?.cleanup?.();slots[n].cleanup=f();});}}};
 const scope={place:{id:'kuwait_university',name_ar:'جامعة الكويت',name_en:'Kuwait University'},subPlaceId:'education_north',ready:true};
 let cache=null,gpsCalls=0,rpcCalls=0,cancelCalls=0,reads=0,blockedRead=null,postPayload;
 const gps=deferred(),rpc=deferred(),routes=[];const t=k=>k;const child=()=>null;
 const modules={react:hooks,'next/navigation':{useRouter:()=>({push:p=>routes.push(p)})},'lucide-react':{PlusCircle:child},
  '@/components/LocaleProvider':{useLocale:()=>({t,dir:'rtl'})},'@/components/AuthProvider':{useAuth:()=>({userId:'A'})},
  '@/components/PlaceProvider':{usePlace:()=>scope},'@/components/NotificationProvider':{useNotifications:()=>({unreadCount:0})},
  '@/lib/sub-places':{requiresSubPlace:p=>p==='kuwait_university'||p==='paaet'},
  '@/lib/conversations':{getOrCreateConversation:async()=>{throw Error('Unexpected claim');}},'@/lib/capacitor':{getMawqifiPostHref:()=>'/chat'},
  '@/lib/safety':{safetyErrorKey:()=> 'common.error'},'@/lib/publish-timing':{publishTiming:()=>{}},
  '@/lib/publish-location':{acquirePublishLocation:()=>{gpsCalls++;return gps.promise;},usablePublishLocation:f=>f.accuracy_meters<=25,cancelPublishLocation:()=>cancelCalls++},
  '@/lib/published-post':{takePublishedPost:()=>cache,rememberPublishedPost:p=>cache=p,clearPublishedPost:()=>cache=null},
  '@/lib/posts':{filterActivePosts:p=>p,expireStalePosts:async()=>{},fetchParkingPosts:()=>{reads++;return blockedRead?blockedRead.promise:Promise.resolve([]);}},
  '@/lib/server-api':{fetchMawqifiServerApi:()=>{throw Error('No real push in tests');}},
  '@/lib/supabase':{getSupabase:()=>({rpc:(name,p)=>{assert.equal(name,'publish_parking_handoff');postPayload=p;rpcCalls++;return rpc.promise;},auth:{getSession:async()=>({data:{session:null}})},channel:()=>{const ch={on:()=>ch,subscribe:()=>ch};return ch;},removeChannel:async()=>{}})},
 };
 for(const name of ['BottomNav','ErrorBanner','PlaceSelector','ParkingCard','WhatsAppChannelCta','Toast','HomeHeader'])modules['@/components/'+name]={default:child};
 const out={};new Function('require','exports',ts.transpileModule(fs.readFileSync('app/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText)(n=>n in modules?modules[n]:require(n),out);
 const render=()=>{index=0;const tree=out.default();while(effects.length)effects.shift()();return tree;};
 const walk=node=>Array.isArray(node)?node.flatMap(walk):node&&typeof node==='object'?[node,...walk(node.props?.children)]:[];
 const button=tree=>walk(tree).find(n=>n.type==='button'&&n.props['data-tutorial-target']==='publish');
 const toast=(tree,key)=>walk(tree).some(n=>n.props?.message===key&&n.props.visible);
 return {scope,gps,rpc,render,button,toast,walk,routes,get gpsCalls(){return gpsCalls;},get rpcCalls(){return rpcCalls;},get cancelCalls(){return cancelCalls;},get payload(){return postPayload;},get cache(){return cache;},get reads(){return reads;},blockFeed:()=>blockedRead=deferred(),close:()=>{for(const slot of slots)slot?.cleanup?.();}};
}
global.document={getElementById:()=>({scrollIntoView(){},focus(){}})};
const fix={latitude:29.3,longitude:47.9,accuracy_meters:5};
(async()=>{
 for(const missing of [null,'kuwait_university','paaet']){const h=harness();h.scope.place=missing?{id:missing}:null;h.scope.ready=false;h.render();await tick();h.button(h.render()).props.onClick();check('Missing scope stays Home '+missing,h.routes.length===0&&h.gpsCalls===0&&h.rpcCalls===0&&h.toast(h.render(),'handoff.chooseLocation'));h.close();}
 for(const [place,sub] of [['kuwait_university','education_north'],['kuwait_university','education_south'],['paaet','basic_education_ardiya'],['gust',null]]){
  const h=harness();h.scope.place={id:place,name_ar:place,name_en:place};h.scope.subPlaceId=sub;h.render();await tick();const btn=h.button(h.render());btn.props.onClick();btn.props.onClick();check('One GPS on rapid taps '+place+'/'+sub,h.gpsCalls===1&&h.rpcCalls===0&&h.button(h.render()).props.disabled);
  h.gps.resolve(fix);await tick();check('One existing RPC '+place+'/'+sub,h.rpcCalls===1&&h.payload.payload.place_id===place&&h.payload.payload.sub_place_id===sub);h.button(h.render()).props.onClick();check('Publishing blocks extra tap '+place,h.rpcCalls===1);
  const feed=h.blockFeed();h.rpc.resolve({data:'new-post',error:null});await tick();let tree=h.render();check('Immediate Home success before feed '+place,h.toast(tree,'handoff.published')&&h.routes.length===0);check('Owner card has no coordinates '+place,!!h.cache&&!('latitude'in h.cache)&&h.walk(tree).some(n=>n.props?.post?.id==='new-post'));
  feed.resolve([h.cache]);await tick();tree=h.render();check('Canonical refresh preserves card '+place,h.walk(tree).some(n=>n.props?.post?.id==='new-post'));h.close();
 }
 for(const code of ['PUBLISH_LOCATION_TIMEOUT','PUBLISH_LOCATION_INACCURATE','PUBLISH_LOCATION_DENIED']){const h=harness();h.render();await tick();h.button(h.render()).props.onClick();h.gps.reject(Error(code));await tick();const tree=h.render();check('GPS error retries without post '+code,h.rpcCalls===0&&h.routes.length===0&&!h.button(tree).props.disabled&&h.walk(tree).some(n=>n.props?.onRetry));h.close();}
 const changed=harness();changed.render();await tick();changed.button(changed.render()).props.onClick();changed.scope.subPlaceId='education_south';changed.render();changed.gps.resolve(fix);await tick();check('Scope change cancels pending publish',changed.rpcCalls===0&&changed.cancelCalls>0);changed.close();
 const failure=harness();failure.render();await tick();failure.button(failure.render()).props.onClick();failure.gps.resolve(fix);await tick();failure.rpc.resolve({data:null,error:{message:'SAFETY_POST_RATE'}});await tick();const failedTree=failure.render();check('RPC failure shows error toast and restores retry without optimism',failure.cache===null&&!failure.button(failedTree).props.disabled&&failure.routes.length===0&&failure.toast(failedTree,'common.error'));failure.close();
 const stale=harness(),oldRead=stale.blockFeed();stale.render();await tick();stale.button(stale.render()).props.onClick();stale.gps.resolve(fix);await tick();const freshRead=stale.blockFeed();stale.rpc.resolve({data:'new-post',error:null});await tick();oldRead.resolve([]);await tick();check('Pre-publication read cannot remove immediate owner card',stale.walk(stale.render()).some(n=>n.props?.post?.id==='new-post'));freshRead.resolve([]);await tick();check('Fresh canonical unavailable state removes optimistic card',!stale.walk(stale.render()).some(n=>n.props?.post?.id==='new-post'));stale.close();
 check('Bottom Publish compatibility retained',fs.readFileSync('components/BottomChrome.tsx','utf8').includes("href: '/create'")&&fs.existsSync('app/create/page.tsx'));
 console.log('Home direct-publish assertions: '+assertions);
})().catch(e=>{console.error(e);process.exitCode=1;});
