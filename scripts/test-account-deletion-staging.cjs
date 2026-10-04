// Explicit dedicated staging only. Real anonymous Auth/JWT/Storage requests.
// No push delivery APIs or private keys. Session context must live outside Git.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{createClient}=require('@supabase/supabase-js');
const url='https://jrmiwmsgnztqwbigumlw.supabase.co',key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,url);assert(key&&!key.startsWith('sb_secret_'));
for(const value of Object.values(process.env))assert(!value.includes(['opsy','vdsivxoqphkfdsbb'].join('')));
if(key.startsWith('eyJ')){const c=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));assert.equal(c.ref,'jrmiwmsgnztqwbigumlw');assert.equal(c.role,'anon');}
const file=process.argv[3];assert(file&&path.isAbsolute(file));const results=[];
const check=(name,value,detail)=>{assert(value,name);results.push({name,status:'PASS',...(detail?{detail}:{})});console.log('PASS '+name+(detail?' '+detail:''));};
const data=async q=>{const r=await q;if(r.error)throw Error(r.error.message);return r.data;};
const clients=Array.from({length:3},()=>createClient(url,key,{global:{headers:{'x-mawqifi-place-aware':'1'}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6M0AAAAASUVORK5CYII=','base64');
(async()=>{let ctx;
 if(process.argv[2]==='prepare'){
  ctx={project:'jrmiwmsgnztqwbigumlw',users:[],results:[]};
  for(const c of clients){const r=await data(c.auth.signInAnonymously());ctx.users.push({id:r.user.id,session:{access_token:r.session.access_token,refresh_token:r.session.refresh_token}});fs.writeFileSync(file,JSON.stringify(ctx));await data(c.from('users').upsert({id:r.user.id,username:'Deletion staging fixture',is_guest:true},{onConflict:'id'}));}
 }else {ctx=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(ctx.project,'jrmiwmsgnztqwbigumlw');for(let i=0;i<3;i++){// Keep the original JWT after Auth deletion; do not refresh or invent one.
   if(i===0){clients[i]=createClient(url,key,{global:{headers:{Authorization:'Bearer '+ctx.users[i].session.access_token,'x-mawqifi-place-aware':'1'}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
   else {
    const current = await data(clients[i].auth.setSession(ctx.users[i].session));
    ctx.users[i].session = { access_token: current.session.access_token, refresh_token: current.session.refresh_token };
   }
  }}
 const [a,b,c]=clients,[A,B,C]=ctx.users,save=()=>fs.writeFileSync(file,JSON.stringify(ctx));
 save();
 const endpoint=async(user,body={},origin='capacitor://localhost')=>fetch(url+'/functions/v1/delete-account',{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.session.access_token}:{}),...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
 const publish=client=>data(client.rpc('publish_parking_handoff',{payload:{place_id:'gust',departure_minutes:60},latitude:29.3,longitude:47.9,accuracy_meters:5}));
 if(process.argv[2]==='prepare'){
  check('Unauthenticated deletion denied',(await endpoint(null)).status===401);
  check('Spoofed target deletion denied',(await endpoint(B,{user_id:A.id})).status===400);
  check('Unapproved origin denied',(await endpoint(A,{},'https://evil.example')).status===403);
  const pre=await fetch(url+'/functions/v1/delete-account',{method:'OPTIONS',headers:{Origin:'capacitor://localhost','Access-Control-Request-Headers':'authorization,apikey,content-type'}});
  check('Native CORS is exact origin',pre.status===204&&pre.headers.get('access-control-allow-origin')==='capacitor://localhost');
  ctx.pid=await publish(a);ctx.active=await publish(a);ctx.unrelated=await publish(c);save();
  check('GPS hidden before claim',(await data(b.from('parking_post_locations').select('post_id').eq('post_id',ctx.pid))).length===0);
  ctx.cid=(await data(b.rpc('claim_parking_post',{post_id:ctx.pid}))).claim.conversation_id;save();
  check('Atomic claim creates immediate chat',!!ctx.cid);
  check('C cannot claim twice',(await c.rpc('claim_parking_post',{post_id:ctx.pid})).error?.message.includes('HANDOFF_ALREADY_CLAIMED'));
  await data(a.from('messages').insert({conversation_id:ctx.cid,sender_id:A.id,type:'text',text:'private authored content to erase'}));
  await data(b.from('messages').insert({conversation_id:ctx.cid,sender_id:B.id,type:'text',text:'peer history must remain'}));
  for(const [label,client,user] of [['own',a,A],['peer',b,B]]){
   ctx[label+'Object']=`chat/${ctx.cid}/${user.id}-deletion.png`;save();
   await data(client.storage.from('chat-images').upload(ctx[label+'Object'],png,{contentType:'image/png',cacheControl:'0',upsert:false}));
   await data(client.from('messages').insert({conversation_id:ctx.cid,sender_id:user.id,type:'image',image_url:url+'/storage/v1/object/authenticated/chat-images/'+ctx[label+'Object']}));
  }
  await data(a.from('messages').insert({conversation_id:ctx.cid,sender_id:A.id,type:'location',latitude:29.3,longitude:47.9}));
  await data(a.from('content_reports').insert({reporter_id:A.id,target_type:'user',target_id:B.id,reason:'other',details:'private report content'}));
  await data(b.from('content_reports').insert({reporter_id:B.id,target_type:'user',target_id:A.id,reason:'other',details:'private counterparty report content'}));
  await data(a.from('user_blocks').insert({blocker_id:A.id,blocked_id:C.id}));
  check('Blocked message enforcement',(await c.rpc('claim_parking_post',{post_id:ctx.active})).error?.message.includes('SAFETY_BLOCKED'));
  check('Peer image works before deletion',!!(await data(b.storage.from('chat-images').download(ctx.ownObject))).size);
  const arrival=await data(b.rpc('arrive_parking_handoff',{conversation_id:ctx.cid,manual:true}));
  const again=await data(b.rpc('arrive_parking_handoff',{conversation_id:ctx.cid,manual:true}));
  check('Arrival remains idempotent 15-minute server timer',new Date(arrival.claim.chat_closes_at)-new Date(arrival.claim.arrived_at)===900000&&arrival.claim.chat_closes_at===again.claim.chat_closes_at);
  // Begin DB phase separately to prove a still-live Auth token loses access
  // before the Storage/Auth phases; invoking the endpoint then resumes it.
  const manifest=await data(a.rpc('begin_account_deletion'));ctx.manifest=manifest;save();
  check('Only own Storage objects scheduled',manifest.objects.length===1&&manifest.objects[0].name===ctx.ownObject);
  check('Retry does not mutate manifest',JSON.stringify(manifest)===JSON.stringify(await data(a.rpc('begin_account_deletion'))));
  check('Auth identity still exists during interrupted cleanup',!!(await data(a.auth.getUser())).user);
 }else if(process.argv[2]==='finish'){
  for(const table of ['users','messages','conversations','parking_posts','parking_post_locations','parking_claims','user_blocks','content_reports','push_subscriptions']){
   const r=await a.from(table).select('*');check('Original JWT denies '+table,!!r.error||r.data.length===0,r.error?'error '+r.error.code:'200 []');
  }
  check('Original JWT cannot publish',!!(await a.rpc('publish_parking_handoff',{payload:{place_id:'gust',departure_minutes:60},latitude:29.3,longitude:47.9,accuracy_meters:5})).error);
  check('Original JWT cannot read GPS RPC',!!(await a.rpc('get_parking_handoff',{conversation_id:ctx.cid})).error);
  check('Original JWT cannot recreate profile',!!(await a.from('users').upsert({id:A.id,username:'attempted recreation'})).error);
  check('Fresh image request denied immediately by RLS',!!(await b.storage.from('chat-images').download(ctx.ownObject,{cacheNonce:crypto.randomUUID()},{cache:'no-store'})).error);
  check('Original JWT Storage access rejected',!!(await a.storage.from('chat-images').download(ctx.peerObject)).error);
  const response=await endpoint(A);ctx.endpointStatus=response.status;ctx.endpointCode=(await response.json()).code;save();
  check('Actual anonymous Auth + Storage deletion completes',response.status===200&&ctx.endpointCode==='ACCOUNT_DELETED');
  check('Endpoint keeps native CORS',response.headers.get('access-control-allow-origin')==='capacitor://localhost');
  const auth=await a.auth.getUser(A.session.access_token);check('Deleted Auth identity rejected',!!auth.error&&!auth.data.user);
  const repeat=await endpoint(A);check('Repeat deletion safely rejected',repeat.status===401);
  check('Lost response completion acknowledged',(await data(a.rpc('account_deletion_status'))).completed===true);
  const history=await data(b.from('messages').select('*').eq('conversation_id',ctx.cid));
  check('All five shared history rows retained',history.length===5);
  check('Deleted text/image/location replaced',history.filter(m=>m.sender_id===A.id).every(m=>m.type==='text'&&m.text==='[deleted message]'&&m.image_url===null&&m.latitude===null&&m.longitude===null));
  check('Peer-authored text unchanged',history.some(m=>m.sender_id===B.id&&m.text==='peer history must remain'));
  check('Peer image still private and readable',!!(await data(b.storage.from('chat-images').download(ctx.peerObject))).size);
  const profile=await data(b.from('users').select('username,avatar_url,deleted_at,auth_user_id').eq('id',A.id).single());
  check('Deleted identity neutral and detached',profile.username==='Deleted User'&&!profile.avatar_url&&!!profile.deleted_at&&profile.auth_user_id===null);
  check('Conversation read-only',(await data(b.from('conversations').select('closed').eq('id',ctx.cid).single())).closed);
  check('New peer message denied',!!(await b.from('messages').insert({conversation_id:ctx.cid,sender_id:B.id,type:'text',text:'after deletion'})).error);
  const handoff=await data(b.rpc('get_parking_handoff',{conversation_id:ctx.cid}));check('No orphan active handoff',handoff.claim.status==='cancelled'&&!handoff.location);
  const ownPosts=await data(b.from('parking_posts').select('status').in('id',[ctx.pid,ctx.active]));check('Owner posts no longer discoverable',ownPosts.length===2&&ownPosts.every(p=>p.status==='cancelled'));
  check('C cannot read retained history',(await data(c.from('messages').select('*').eq('conversation_id',ctx.cid))).length===0);
  check('C cannot read retained image',!!(await c.storage.from('chat-images').download(ctx.peerObject)).error);
  check('Report minimized safely',(await data(b.from('content_reports').select('details').eq('target_id',A.id).single())).details==='');
  check('C cannot read peer report',(await data(c.from('content_reports').select('*').eq('reporter_id',B.id))).length===0);
  check('Unrelated C post unchanged',(await data(c.from('parking_posts').select('status').eq('id',ctx.unrelated).single())).status==='active');
  check('Unrelated C Auth unchanged',!!(await data(c.auth.getUser())).user);
 }else if(process.argv[2]==='tokens'){
  // Deliberately invalid fixture destinations. This only registers metadata;
  // no delivery endpoint is invoked and no real device token is used.
  const backend='https://mawqifi-testflight-staging.vercel.app';
  const api=async(user,route,body)=>fetch(backend+route,{method:'POST',headers:{Authorization:'Bearer '+user.session.access_token,Origin:'capacitor://localhost','Content-Type':'application/json'},body:JSON.stringify(body)});
  const native=await api(B,'/api/push/native-token',{platform:'ios',token:'staging-deletion-fixture-'+B.id});
  check('Disposable native token registered through Bearer server API (HTTP '+native.status+')',native.status===200);
  const push=await api(B,'/api/push/subscribe',{endpoint:'https://example.invalid/staging-deletion/'+B.id,p256dh:'not-a-real-push-key',auth:'not-a-real-push-auth'});
  check('Disposable Web Push metadata registered without delivery',push.status===200);
  const denied=await api(A,'/api/push/native-token',{platform:'ios',token:'staging-deletion-fixture-'+A.id});
  check('Deleted Auth rejected by staging server API',denied.status===401);
  check('Rejected deleted user response keeps exact native CORS',denied.headers.get('access-control-allow-origin')==='capacitor://localhost');
 }else if(process.argv[2]==='cleanup'){
  for(const user of [B,C])check('Cleanup disposable identity '+user.id,(await endpoint(user)).status===200);
 }
 ctx.results.push(...results);save();
 fs.writeFileSync(file+'.results.json',JSON.stringify({project:ctx.project,users:ctx.users.map(u=>u.id),post:ctx.pid,conversation:ctx.cid,results:ctx.results},null,2));
 console.log('STAGING_FIXTURES '+JSON.stringify({users:ctx.users.map(u=>u.id),post:ctx.pid,conversation:ctx.cid}));
 console.log('Real deletion/JWT assertions this phase: '+results.length);
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>Promise.all(clients.map(c=>c.removeAllChannels())));
