const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
let count=0;const check=(name,value)=>{assert(value,name);count++;console.log('PASS '+name);};
function load(file,mocks={}){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const out={};new Function('require','exports',code)(n=>n in mocks?mocks[n]:require(n),out);return out;}
const i18n=load('lib/i18n/index.ts'),memory=new Map();global.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
async function main(){
 const empty=()=>null;
 for(const locale of ['ar','en']){
  const t=k=>i18n.translate(locale,k);
  const modules={
   'next/link':{default:({children,...props})=>React.createElement('a',props,children)},
   '@/components/BottomNav':{default:empty},'@/components/ErrorBanner':{default:empty},'@/components/PageHeader':{default:({title})=>React.createElement('h1',null,title)},
   '@/components/PushNotificationControl':{default:empty},'@/components/AuthProvider':{useAuth:()=>({userId:'own',profile:{id:'own',username:'Guest'},isGuest:true,deleteAccount:async()=>{},refreshProfile:async()=>{}})},
   '@/components/LocaleProvider':{useLocale:()=>({locale,dir:locale==='ar'?'rtl':'ltr',t,setLocale:()=>{}})},'@/components/TutorialProvider':{useTutorial:()=>({replayTutorial:()=>{}})},
   '@/lib/auth':{signOut:async()=>{},updateUsername:async()=>{}},'@/lib/links':{MAWQIFI_WHATSAPP_CHANNEL_URL:'https://example.invalid'},'@/lib/capacitor':{},'@/lib/notification-preferences':{DEFAULT_NOTIFICATION_PREFERENCES:{}},'@/lib/supabase':{},
  };
  const Settings=load('app/settings/page.tsx',modules).default;
  const html=renderToStaticMarkup(React.createElement(Settings));
  check('Guest can discover deletion '+locale,html.includes(t('deletion.title')));
  check('Explicit permanent confirmation '+locale,html.includes(t('deletion.confirm').split('\n')[1]));
  check('Accessible dialog labels '+locale,html.includes('aria-labelledby="delete-account-title"')&&html.includes('aria-describedby="delete-account-description"'));
  check('Localized cancel button '+locale,html.includes(t('common.cancel')));
  check('Retained-history disclosure '+locale,html.includes(t('deletion.summary')));
  check('Neutral deleted name '+locale,t('deletion.user')===(locale==='ar'?'مستخدم محذوف':'Deleted User'));
  check('No internal text in placeholder '+locale,!t('deletion.message').includes('[deleted message]'));
 }
 // Exercise the actual provider handler with controlled hooks and a delayed API.
 let state=['own',{id:'own',username:'Guest'},true,true,null,false,false],index=0,calls=0,clears=0,resolve,reject;
 const lock={current:false},fakeReact={...React,useState:()=>{const at=index++;return[state[at],v=>{state[at]=typeof v==='function'?v(state[at]):v;}];},useRef:()=>lock,useCallback:f=>f,useMemo:f=>f(),useEffect:()=>{}};
 let pending=new Promise((ok,no)=>{resolve=ok;reject=no;});
 const Provider=load('components/AuthProvider.tsx',{
  react:fakeReact,'@/lib/auth':{},'@/lib/supabase':{isSupabaseConfigured:true},'./LoadingScreen':{default:empty},'./ConfigError':{default:empty},
  '@/lib/account-deletion':{DELETION_PENDING_KEY:'mawqifi_account_deletion_pending',deleteOwnAccount:()=>{calls++;return pending;},clearDeletedAccountSession:async()=>{clears++;}},
  '@/lib/i18n':{...i18n,readStoredLocale:()=> 'ar'},
 }).default;
 const render=()=>{index=0;return Provider({children:React.createElement('p',null,'PRIVATE SCREEN')});};
 const start=render().props.value.deleteAccount;const first=start();void start();
 check('Rapid deletion taps issue one API call',calls===1);
 check('Recovery marker saved',memory.get('mawqifi_account_deletion_pending')==='true');
 check('Authenticated children unmounted during deletion',render().type==='main'&&!renderToStaticMarkup(render()).includes('PRIVATE SCREEN'));
 check('Progress is localized',renderToStaticMarkup(render()).includes(i18n.translate('ar','deletion.progress')));
 reject(Error('offline'));await first;
 check('Failure keeps private navigation closed',render().type==='main');
 check('Failure offers localized retry',renderToStaticMarkup(render()).includes(i18n.translate('ar','common.retry')));
 pending=new Promise(ok=>{resolve=ok;});const retry=start();resolve();await retry;
 check('Retry uses same handler safely',calls===2&&clears===1);
 check('Provider clears private profile/user memory',state[0]===null&&state[1]===null);
 let acknowledgement=false,success=false;
 const own=load('lib/account-deletion.ts',{'./capacitor':{isNativeCapacitor:()=>false},'./supabase':{getSupabase:()=>({functions:{invoke:async()=>({data:success?{code:'ACCOUNT_DELETED'}:null,error:success?null:Error('lost response')})},rpc:async()=>({data:{completed:acknowledgement}})})}});
 success=true;await own.deleteOwnAccount();check('Client accepts completed server response',true);
 success=false;acknowledgement=true;await own.deleteOwnAccount();check('Lost HTTP success recovered by self-only flag',true);
 acknowledgement=false;await assert.rejects(own.deleteOwnAccount(),/DELETION_RETRY_REQUIRED/);check('Incomplete deletion never claimed as success',true);
 const stored={mawqifi_place:'gust',mawqifi_locale:'en','mawqifi.native-push-device.v1':'private fixture','sb-staging-auth-token':'private session'};
 global.localStorage=stored;Object.defineProperty(stored,'removeItem',{value:key=>delete stored[key],enumerable:false});
 let subscriptions=0,notifications=0,channels=0,localSignouts=0,redirect='',cacheDeletes=0;
 global.sessionStorage={clear:()=>{}};global.window={location:{replace:path=>{redirect=path;}}};
 Object.defineProperty(global,'navigator',{configurable:true,value:{serviceWorker:{getRegistrations:async()=>[{pushManager:{getSubscription:async()=>({unsubscribe:async()=>{subscriptions++;}})},getNotifications:async()=>[{close:()=>{notifications++;}}]}]}}});
 global.caches={keys:async()=>['private-cache'],delete:async()=>{cacheDeletes++;return true;}};window.caches=global.caches;
 const cleanup=load('lib/account-deletion.ts',{'./capacitor':{isNativeCapacitor:()=>false},'./supabase':{getSupabase:()=>({removeAllChannels:async()=>{channels++;},auth:{signOut:async opts=>{check('Only local logout requested',opts.scope==='local');localSignouts++;}}})}});
 await cleanup.clearDeletedAccountSession();
 check('Web subscription removed without server request',subscriptions===1&&notifications===1);
 check('Realtime and local auth discarded',channels===1&&localSignouts===1);
 check('Private persisted keys removed, locale retained',Object.keys(stored).length===1&&stored.mawqifi_locale==='en');
 check('Private caches evicted',cacheDeletes===1);
 check('Fresh guest/onboarding navigation',redirect==='/');
 let removedKey='',unregisters=0,delivered=0;
 const native=load('lib/native-push.ts',{'./capacitor':{isNativeCapacitor:()=>true},'./auth':{},'./server-api':{fetchMawqifiServerApi:()=>{throw Error('Unexpected server call');}},'./supabase':{},
  '@capacitor/preferences':{Preferences:{remove:async({key})=>{removedKey=key;}}},'@capacitor/push-notifications':{PushNotifications:{unregister:async()=>{unregisters++;},removeAllDeliveredNotifications:async()=>{delivered++;}}}});
 await native.clearDeletedAccountNativePush();
 check('Capacitor private token/user binding removed',removedKey==='mawqifi.native-push-device.v1');
 check('Native OS registration/notifications cleared without delivery',unregisters===1&&delivered===1);
 console.log('Account deletion client/UI assertions: '+count);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
