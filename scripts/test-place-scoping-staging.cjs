// Explicit staging only. Requires NEXT_PUBLIC_SUPABASE_ANON_KEY; never uses service_role.
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict'), Module = require('module');
const root = path.resolve(__dirname, '..');
const ts = require('typescript');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(root,request.slice(2)) : request, ...args);
};
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText,filename);
const { createClient } = require('@supabase/supabase-js');
const URL = 'https://jrmiwmsgnztqwbigumlw.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert(key && !key.startsWith('sb_secret_'));
for(const value of Object.values(process.env)) assert(!value.includes(['opsy','vdsivxoqphkfdsbb'].join('')));
if(key.startsWith('eyJ')) {
  const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());
  assert.equal(claims.ref,'jrmiwmsgnztqwbigumlw'); assert.equal(claims.role,'anon');
}
process.env.NEXT_PUBLIC_SUPABASE_URL=URL;
const supabaseModule=require('../lib/supabase.ts');
let current;
supabaseModule.getSupabase=()=>current;
const {fetchParkingPosts,createParkingPost,expireStalePosts}=require('../lib/posts.ts');
const {kuColleges}=require('../lib/university.ts');
const college=kuColleges[0];
const {fetchPlaces}=require('../lib/places.ts');
const {submitReport,setUserBlocked}=require('../lib/safety.ts');
const results=[],clients=[],users=[],posts=[]; let reportId;
let postRequests=0;
function check(name,ok,detail) { assert(ok,name+': '+JSON.stringify(detail)); results.push({name,status:'PASS',detail}); console.log('PASS '+name); }
async function data(p) {const r=await p;if(r.error)throw Error(r.error.message);return r.data;}
async function fails(name,p,expected) {const r=await p;check(name,Boolean(r.error)&&r.error.message.includes(expected),r.error?.message);}
const client=aware=>createClient(URL,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{headers:aware?{'x-mawqifi-place-aware':'1'}:{},fetch:(url,opts)=>{if(String(url).includes('/rest/v1/parking_posts'))postRequests++;return fetch(url,opts);}}});
async function main(){
 for(let i=0;i<3;i++){const c=client(true);clients.push(c);const a=await data(c.auth.signInAnonymously());users.push({id:a.user.id,session:a.session});await data(c.from('users').select('id').eq('id',a.user.id).single());}
 const [A,B,C]=users;current=clients[0];
 check('Catalogue seeded', (await fetchPlaces()).map(p=>p.id).join(',')==='kuwait_university,paaet,gust');
 const raw={user_id:A.id,college:college.nameAr,zone:college.zone,gate:college.gates[0],departure_minutes:60,expires_at:new Date(Date.now()+3600000).toISOString()};
 const old=(await data(current.from('parking_posts').insert(raw).select('id,place_id').single()));posts.push(old.id);
 check('Cached KU insert auto-classified',old.place_id==='kuwait_university');
 const create=async(placeId,description)=>{const p=await createParkingPost({userId:A.id,placeId,locationDescription:description,college:placeId==='kuwait_university'?college.nameAr:null,zone:placeId==='kuwait_university'?college.zone:null,gate:placeId==='kuwait_university'?college.gates[0]:null,carDesc:'Disposable scoped staging verification',departureMinutes:60,expiresAt:new Date(Date.now()+3600000).toISOString()});posts.push(p.id);check('New '+placeId+' persisted',p.place_id===placeId&&Boolean(p.place));return p;};
 await create('kuwait_university',null);
 await clients[1].realtime.setAuth(B.session.access_token);
 let resolveEvent; const realtimeEvent=new Promise(resolve=>{resolveEvent=resolve;});
 const channel=clients[1].channel('place-scoped-'+B.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'parking_posts',filter:'place_id=eq.paaet'},payload=>resolveEvent(payload));
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Realtime subscription timed out')),15000);channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve();}else if(status==='CHANNEL_ERROR'){clearTimeout(timer);reject(Error('Realtime subscription failed'));}});});
 await new Promise(resolve=>setTimeout(resolve,1500));
 await create('paaet','كلية ومعهد ومنطقة واضحة — وصف تجريبي للموقع');
 const event=await new Promise(resolve=>{const timer=setTimeout(()=>resolve(null),10000);realtimeEvent.then(value=>{clearTimeout(timer);resolve(value);});});
 check('PAAET realtime INSERT delivered',event?.new?.place_id==='paaet'&&event?.new?.user_id===A.id);
 await clients[1].removeChannel(channel);
 const gust=await create('gust','Mishref — disposable landmark description');
 for(const place of ['kuwait_university','paaet','gust']) {const found=await fetchParkingPosts(place);check('Only selected '+place,found.length>0&&found.every(p=>p.place_id===place));}
 const before=postRequests;check('No selection returns zero', (await fetchParkingPosts(null)).length===0&&postRequests===before);
 const cached=client(false);await data(cached.auth.setSession({access_token:A.session.access_token,refresh_token:A.session.refresh_token}));
 const cachedRows=await data(cached.from('parking_posts').select('id,college,zone,gate,place_id'));
 check('Cached unfiltered feed remains KU-only',cachedRows.length>0&&cachedRows.every(p=>p.place_id==='kuwait_university'&&p.college&&p.zone&&p.gate));
 await fails('Invalid missing place denied',current.from('parking_posts').insert({...raw,college:null,zone:null,gate:null,location_description:'Useful description'}),'PLACE_REQUIRED');
 await fails('Non-KU missing description denied',current.from('parking_posts').insert({...raw,place_id:'gust',college:null,zone:null,gate:null}),'PLACE_LOCATION_REQUIRED');
 await fails('Invisible location denied',current.from('parking_posts').insert({...raw,place_id:'gust',college:null,zone:null,gate:null,location_description:'\u200B \u200C \uFEFF'}),'PLACE_LOCATION_REQUIRED');
 await fails('Spoof author denied',current.from('parking_posts').insert({...raw,user_id:B.id,place_id:'kuwait_university'}),'Authentication required');
 await fails('Catalogue mutation denied',current.from('places').insert({id:'forbidden',name_ar:'test',name_en:'test'}),'permission denied');
 const n=await data(clients[1].from('app_notifications').select('data').eq('post_id',gust.id).single());check('Notification location snapshot',n.data.place_id==='gust'&&Boolean(n.data.location_description));
 const conv=await data(clients[1].from('conversations').insert({post_id:gust.id,owner_id:A.id,requester_id:B.id}).select('id').single());
 await data(clients[1].from('messages').insert({conversation_id:conv.id,sender_id:B.id,type:'text',text:'A real staging JWT scoped chat test.'}));check('New-place chat succeeds',true);
 current=clients[1];await submitReport('post',gust.id,'spam','Disposable staging verification');
 reportId=(await data(current.from('content_reports').select('id').eq('target_id',gust.id).single())).id;check('New-place reporting persists',true);
 const otherReports=await data(clients[2].from('content_reports').select('id').eq('id',reportId));check('Report privacy remains',otherReports.length===0);
 await setUserBlocked(A.id,true);
 await fails('Block enforces message rejection',current.from('messages').insert({conversation_id:conv.id,sender_id:B.id,type:'text',text:'Blocked attempt.'}),'SAFETY_BLOCKED');
 check('Blocked owner omitted from discovery',(await fetchParkingPosts('gust')).every(p=>p.user_id!==A.id));
 await setUserBlocked(A.id,false);check('Unblock restores feed',(await fetchParkingPosts('gust')).some(p=>p.id===gust.id));
 await data(clients[0].from('parking_posts').update({status:'closed'}).eq('id',old.id));check('Cached expiry/status update',true);
 current=clients[0];await expireStalePosts();check('Expiry RPC preserved',true);
}
main().catch(error=>{results.push({name:'Exception',status:'FAIL',detail:error.message});console.error(error.message);}).finally(async()=>{
 for(let i=0;i<clients.length;i++){await clients[i].removeAllChannels();if(users[i]){const r=await clients[i].from('parking_posts').delete().eq('user_id',users[i].id);if(r.error)results.push({name:'Cleanup',status:'FAIL',detail:r.error.message});}await clients[i].auth.signOut();}
 const output={project:'jrmiwmsgnztqwbigumlw',users:users.map(u=>u.id),posts,reportId,results};
 fs.writeFileSync(path.join(process.env.TEMP,'mawqifi-place-staging-results.json'),JSON.stringify(output,null,2));
 console.log('IDENTITIES '+JSON.stringify(output.users));console.log('REPORT_ID '+reportId);
 console.log('SUMMARY '+JSON.stringify({passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length}));
 process.exitCode=results.some(r=>r.status==='FAIL')?1:0;
});
