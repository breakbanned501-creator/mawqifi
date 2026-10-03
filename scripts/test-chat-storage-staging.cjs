// Dedicated staging only, real anonymous JWTs. Never invokes push delivery APIs.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{createClient}=require('@supabase/supabase-js');
const url='https://jrmiwmsgnztqwbigumlw.supabase.co',key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,url);assert(key&&!key.startsWith('sb_secret_'));
for(const value of Object.values(process.env))assert(!value.includes(['opsy','vdsivxoqphkfdsbb'].join('')));
if(key.startsWith('eyJ')){const claim=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));assert.equal(claim.ref,'jrmiwmsgnztqwbigumlw');assert.equal(claim.role,'anon');}
const file=process.argv[3];assert(file&&path.isAbsolute(file));const results=[];
const check=(name,v)=>{assert(v,name);results.push({name,status:'PASS'});console.log('PASS '+name);};
const data=async q=>{const r=await q;if(r.error)throw Error(r.error.message);return r.data;};
const denied=async(name,q,expected)=>{const r=await q;check(name,!!r.error&&(!expected||r.error.message.includes(expected)));};
const clients=Array.from({length:3},()=>createClient(url,key,{global:{headers:{'x-mawqifi-place-aware':'1'}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
(async()=>{let ctx;
 if(['closed','finish-active'].includes(process.argv[2])){ctx=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(ctx.project,'jrmiwmsgnztqwbigumlw');for(let i=0;i<3;i++)await data(clients[i].auth.setSession(ctx.users[i].session));}
 else{ctx={project:'jrmiwmsgnztqwbigumlw',users:[],results:[]};for(const client of clients){const r=await data(client.auth.signInAnonymously());ctx.users.push({id:r.user.id,session:{access_token:r.session.access_token,refresh_token:r.session.refresh_token}});fs.writeFileSync(file,JSON.stringify(ctx));await data(client.from('users').upsert({id:r.user.id,username:'Private image audit fixture',is_guest:true},{onConflict:'id'}));}}
 const [a,b,c]=clients,[A,B,C]=ctx.users;const save=()=>fs.writeFileSync(file,JSON.stringify(ctx));
 if(process.argv[2]==='closed'){
  for(const [label,client] of [['A',a],['B',b]])check(label+' downloads historical image after timer',!!(await data(client.storage.from('chat-images').download(ctx.object))).size);
  await denied('Closed upload denied',b.storage.from('chat-images').upload('chat/'+ctx.cid+'/closed.png',new Blob(['test']),{contentType:'image/png'}));
  await denied('Server closes message inserts',b.from('messages').insert({conversation_id:ctx.cid,sender_id:B.id,type:'text',text:'after close'}),'HANDOFF_CHAT_CLOSED');
  for(const client of [a,b])check('Text/image history retained',(await data(client.from('messages').select('id').eq('conversation_id',ctx.cid))).length===2);
  await data(a.rpc('expire_old_parking_posts'));check('Expiry does not delete history',(await data(b.from('messages').select('id').eq('conversation_id',ctx.cid))).length===2);
  await data(a.from('parking_posts').update({status:'cancelled'}).eq('id',ctx.pid));
 }else if(process.argv[2]==='active'){
  ctx.pid=await data(a.rpc('publish_parking_handoff',{payload:{place_id:'gust',departure_minutes:60},latitude:29.3,longitude:47.9,accuracy_meters:5}));save();
  for(const client of [b,c])check('GPS private before claim',(await data(client.from('parking_post_locations').select('post_id').eq('post_id',ctx.pid))).length===0);
  await denied('Owner cannot self-claim',a.rpc('claim_parking_post',{post_id:ctx.pid}));
  const state=await data(b.rpc('claim_parking_post',{post_id:ctx.pid}));ctx.cid=state.claim.conversation_id;save();check('B gets immediate chat and exact location',!!ctx.cid&&state.location.latitude===29.3);
  await denied('C cannot claim reserved post',c.rpc('claim_parking_post',{post_id:ctx.pid}),'HANDOFF_ALREADY_CLAIMED');
  check('C cannot see GPS after claim',(await data(c.from('parking_post_locations').select('post_id').eq('post_id',ctx.pid))).length===0);
  ctx.object='chat/'+ctx.cid+'/'+A.id+'-privacy-audit.png';save();
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6M0AAAAASUVORK5CYII=','base64');
  await data(a.storage.from('chat-images').upload(ctx.object,png,{contentType:'image/png',cacheControl:'0',upsert:false}));check('A uploads image',true);
  const reference=url+'/storage/v1/object/authenticated/chat-images/'+ctx.object;
  ctx.image=(await data(a.from('messages').insert({conversation_id:ctx.cid,sender_id:A.id,type:'image',image_url:reference}).select('id').single())).id;save();
  check('New record contains no public/signed URL',!(await data(b.from('messages').select('image_url').eq('id',ctx.image).single())).image_url.includes('/public/'));
  check('B downloads image',!!(await data(b.storage.from('chat-images').download(ctx.object))).size);
  await denied('C download denied',c.storage.from('chat-images').download(ctx.object));
  check('C cannot list images',(await data(c.storage.from('chat-images').list('chat/'+ctx.cid))).length===0);
  await denied('C cannot overwrite image',c.storage.from('chat-images').upload(ctx.object,png,{contentType:'image/png',upsert:true}));
  const removed=await c.storage.from('chat-images').remove([ctx.object]);check('C deletion has no effect',!!removed.error||removed.data.length===0);
  check('B still reads after C delete attempt',!!(await data(b.storage.from('chat-images').download(ctx.object))).size);
  const pub=await fetch(url+'/storage/v1/object/public/chat-images/'+ctx.object);check('Direct public URL denied',!pub.ok);
  const unauth=await fetch(url+'/storage/v1/object/authenticated/chat-images/'+ctx.object,{headers:{apikey:key}});check('Unauthenticated download denied',!unauth.ok);
  check('C conversation hidden',(await data(c.from('conversations').select('id').eq('id',ctx.cid))).length===0);
  check('C message history hidden',(await data(c.from('messages').select('id').eq('conversation_id',ctx.cid))).length===0);
  await data(b.from('messages').insert({conversation_id:ctx.cid,sender_id:B.id,type:'text',text:'Private history fixture'}));check('Text unaffected',true);
  await data(a.from('user_blocks').insert({blocker_id:A.id,blocked_id:B.id}));
  await denied('Blocked upload denied',b.storage.from('chat-images').upload('chat/'+ctx.cid+'/blocked.png',png,{contentType:'image/png'}));
  await denied('Blocked message denied',b.from('messages').insert({conversation_id:ctx.cid,sender_id:B.id,type:'text',text:'Blocked fixture'}),'SAFETY_BLOCKED');
  check('Blocked history readable',!!(await data(b.storage.from('chat-images').download(ctx.object))).size);
  await data(a.from('user_blocks').delete().eq('blocker_id',A.id).eq('blocked_id',B.id));
  const first=await data(b.rpc('arrive_parking_handoff',{conversation_id:ctx.cid,manual:true}));const repeat=await data(b.rpc('arrive_parking_handoff',{conversation_id:ctx.cid,manual:true}));
  check('Server 15-minute timer',new Date(first.claim.chat_closes_at)-new Date(first.claim.arrived_at)===900000);check('Manual arrival cannot extend timer',first.claim.chat_closes_at===repeat.claim.chat_closes_at);
 }
 if(process.argv[2]!=='closed'){
  const target=(await data(a.from('messages').select('id').eq('conversation_id',ctx.cid).eq('sender_id',B.id).single())).id;
  ctx.report=(await data(a.from('content_reports').insert({reporter_id:A.id,target_type:'message',target_id:target,reason:'other',details:'Disposable staging privacy audit'}).select('id').single())).id;save();
  check('C cannot read report',(await data(c.from('content_reports').select('id').eq('reporter_id',A.id))).length===0);
  check('B cannot identify reporter',(await data(b.from('content_reports').select('id').eq('reporter_id',A.id))).length===0);
  for(const table of ['native_push_tokens','account_restrictions']){const r=await c.from(table).select('*');check(table+' inaccessible',!!r.error||r.data.length===0);}
  const push=await c.from('push_subscriptions').select('user_id').eq('user_id',A.id);check('Push subscription ownership',!!push.error||push.data.length===0);
 }
 ctx.results.push(...results);save();console.log('STAGING_FIXTURES '+JSON.stringify({users:ctx.users.map(u=>u.id),post:ctx.pid,conversation:ctx.cid,object:ctx.object}));console.log('Real storage/JWT assertions this phase: '+results.length);
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>Promise.all(clients.map(c=>c.removeAllChannels())));
