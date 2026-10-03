// Real staging anonymous Auth/JWT requests only. No push APIs, fabricated JWTs or service-role.
const fs=require('fs'),assert=require('node:assert/strict'),path=require('path');
const {createClient}=require('@supabase/supabase-js');
const URL='https://jrmiwmsgnztqwbigumlw.supabase.co';
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,URL);
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert(key&&!key.startsWith('sb_secret_'));
for(const value of Object.values(process.env))assert(!value.includes(['opsy','vdsivxoqphkfdsbb'].join('')));
if(key.startsWith('eyJ')){const p=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));assert.equal(p.ref,'jrmiwmsgnztqwbigumlw');assert.equal(p.role,'anon');}
const contextFile=process.argv[3];assert(contextFile&&path.isAbsolute(contextFile));
const results=[];
function check(name,ok){assert(ok,name);results.push({name,status:'PASS'});console.log('PASS '+name);}
async function data(query){const r=await query;if(r.error)throw Error(r.error.message);return r.data;}
async function deny(name,query,expected){const r=await query;check(name,!!r.error&&r.error.message.includes(expected));}
const newClient=()=>createClient(URL,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{'x-mawqifi-place-aware':'1'}}});
async function main(){
 const clients=[newClient(),newClient(),newClient()];let context;
 if(process.argv[2]==='verify-closed'){
  context=JSON.parse(fs.readFileSync(contextFile,'utf8'));
  for(let i=0;i<3;i++)await data(clients[i].auth.setSession(context.users[i].session));
 }else{
  context={project:'jrmiwmsgnztqwbigumlw',users:[],posts:[],conversations:[],messages:[],reports:[]};
  for(const c of clients){
   const session=await data(c.auth.signInAnonymously());
   context.users.push({id:session.user.id,session:{access_token:session.session.access_token,refresh_token:session.session.refresh_token}});
   fs.writeFileSync(contextFile,JSON.stringify(context));
   await data(c.from('users').upsert({id:session.user.id,username:'Handoff staging test',is_guest:true},{onConflict:'id'}));
  }
 }
 const [a,b,c]=clients,[A,B,C]=context.users;
 const save=()=>fs.writeFileSync(contextFile,JSON.stringify(context));
 const publish=async(client,place='gust')=>{
  const id=await data(client.rpc('publish_parking_handoff',{payload:{place_id:place,departure_minutes:60},latitude:29.3,longitude:47.9,accuracy_meters:5}));
  context.posts.push(id);save();return id;
 };
 const send=async(client,uid,cid,text)=>{
  const m=await data(client.from('messages').insert({conversation_id:cid,sender_id:uid,type:'text',text}).select('id').single());
  context.messages.push(m.id);save();return m.id;
 };
 if(process.argv[2]==='verify-closed'){
  const cid=context.conversations[0],pid=context.posts[0];
  await deny('Server clock rejects messages after controlled close',b.from('messages').insert({conversation_id:cid,sender_id:B.id,type:'text',text:'After close test'}),'HANDOFF_CHAT_CLOSED');
  for(const client of [a,b])check('Participant reads retained history after close',(await data(client.from('messages').select('id').eq('conversation_id',cid))).length===2);
  await data(a.rpc('expire_old_parking_posts'));
  check('Expiry RPC does not delete history',(await data(b.from('messages').select('id').eq('conversation_id',cid))).length===2);
  await data(a.from('parking_posts').update({status:'cancelled'}).eq('id',pid));
  check('Cancellation persists and history stays',(await data(b.rpc('get_parking_handoff',{conversation_id:cid}))).claim.status==='completed');
 }else{
  check('Three real anonymous sessions and profiles',context.users.length===3);
  console.log('Staging-only identities: '+JSON.stringify(context.users.map((u,i)=>({label:'ABC'[i],id:u.id}))));
  for(const place of ['kuwait_university','paaet','gust']){
   await deny('Direct metadata-free insert denied '+place,a.from('parking_posts').insert({user_id:A.id,place_id:place,handoff:true,departure_minutes:10,expires_at:new Date(Date.now()+600000).toISOString()}),place==='kuwait_university'?'PLACE_INVALID_KU_LOCATION':'PLACE_LOCATION_REQUIRED');
  }
  await deny('Ordinary client cannot fabricate private GPS',a.from('parking_post_locations').insert({post_id:'11111111-1111-4111-8111-111111111111',owner_id:A.id,latitude:29.3,longitude:47.9}),'permission denied');
  const kuPost=await publish(a,'kuwait_university');
  const ku=await data(a.from('parking_posts').select('place_id,college,zone,gate,location_description').eq('id',kuPost).single());
  check('KU GPS-only publication stores no fabricated fields',ku.place_id==='kuwait_university'&&ku.college===null&&ku.zone===null&&ku.gate===null&&ku.location_description===null);
  await data(a.from('parking_posts').update({status:'cancelled'}).eq('id',kuPost));
  const pid=await publish(a);
  for(const client of [b,c])check('Preclaim precise location denied',(await data(client.from('parking_post_locations').select('*').eq('post_id',pid))).length===0);
  const feed=await data(b.from('parking_posts').select('*').eq('place_id','gust').eq('status','active'));
  check('Public feed contains no coordinate columns',feed.length>0&&feed.every(p=>!('latitude'in p)&&!('longitude'in p)));
  const claim=await data(b.rpc('claim_parking_post',{post_id:pid}));
  const cid=claim.claim.conversation_id;context.conversations.push(cid);save();
  check('B claim returns private location and immediate conversation',claim.claim.claimant_id===B.id&&claim.location.latitude===29.3);
  check('Claim does not start countdown',claim.claim.arrived_at===null&&claim.claim.chat_closes_at===null);
  check('Repeated tap reuses conversation',(await data(b.rpc('claim_parking_post',{post_id:pid}))).claim.id===claim.claim.id);
  await deny('C cannot claim reserved post',c.rpc('claim_parking_post',{post_id:pid}),'HANDOFF_ALREADY_CLAIMED');
  check('C location still denied',(await data(c.from('parking_post_locations').select('*').eq('post_id',pid))).length===0);
  await deny('C cannot access matched RPC',c.rpc('get_parking_handoff',{conversation_id:cid}),'Authentication required');
  check('Claimed post disappears from availability',(await data(c.from('parking_posts').select('id').eq('id',pid).eq('status','active'))).length===0);
  await send(a,A.id,cid,'I am waiting beside my car');
  const msg=await send(b,B.id,cid,'أنا قريب من الموقف، دقيقة وأوصل');
  await data(a.from('user_blocks').insert({blocker_id:A.id,blocked_id:B.id}));
  await deny('Blocked participant cannot claim',b.rpc('claim_parking_post',{post_id:pid}),'SAFETY_BLOCKED');
  await deny('Blocked participant cannot message',b.from('messages').insert({conversation_id:cid,sender_id:B.id,type:'text',text:'Blocked test'}),'SAFETY_BLOCKED');
  check('Blocked history remains readable',(await data(b.from('messages').select('id').eq('conversation_id',cid))).length===2);
  await data(a.from('user_blocks').delete().eq('blocker_id',A.id).eq('blocked_id',B.id));
  const report=await data(a.from('content_reports').insert({reporter_id:A.id,target_type:'message',target_id:msg,reason:'other',details:'Disposable handoff verification'}).select('id').single());
  context.reports.push(report.id);save();
  check('Reporting works and is private',(await data(c.from('content_reports').select('id').eq('id',report.id))).length===0);
  await deny('Far GPS cannot start timer',b.rpc('arrive_parking_handoff',{conversation_id:cid,latitude:30,longitude:48,accuracy_meters:5}),'HANDOFF_NOT_NEAR');
  const arrival=await data(b.rpc('arrive_parking_handoff',{conversation_id:cid,latitude:29.3,longitude:47.9,accuracy_meters:5}));
  check('Arrival closes exactly 15 minutes later',Date.parse(arrival.claim.chat_closes_at)-Date.parse(arrival.claim.arrived_at)===900000);
  check('Repeated manual arrival cannot extend timer',(await data(b.rpc('arrive_parking_handoff',{conversation_id:cid,manual:true}))).claim.chat_closes_at===arrival.claim.chat_closes_at);
  await deny('Owner cannot register claimant arrival',a.rpc('arrive_parking_handoff',{conversation_id:cid,manual:true}),'Authentication required');
  await deny('Client cannot rewrite claim clock',b.from('parking_claims').update({chat_closes_at:new Date(Date.now()+86400000).toISOString()}).eq('id',claim.claim.id),'permission denied');
  await deny('Client cannot reopen closed flag',b.from('conversations').update({closed:false}).eq('id',cid),'permission denied');
  const racePost=await publish(a,'paaet');
  const race=await Promise.all([b.rpc('claim_parking_post',{post_id:racePost}),c.rpc('claim_parking_post',{post_id:racePost})]);
  check('Actual concurrent claim has exactly one winner',race.filter(r=>!r.error).length===1&&race.filter(r=>r.error?.message.includes('HANDOFF_ALREADY_CLAIMED')).length===1);
  const winner=race.find(r=>!r.error).data;context.conversations.push(winner.claim.conversation_id);save();
  const winnerClient=winner.claim.claimant_id===B.id?b:c;
  const manual=await data(winnerClient.rpc('arrive_parking_handoff',{conversation_id:winner.claim.conversation_id,manual:true}));
  check('First manual fallback starts server timer',!!manual.claim.arrived_at);
  await data(a.from('parking_posts').update({status:'cancelled'}).eq('id',racePost));
  check('Creator cancellation visible to claimant',(await data(winnerClient.rpc('get_parking_handoff',{conversation_id:winner.claim.conversation_id}))).claim.status==='cancelled');
 }
 context.results=[...(context.results??[]),...results];save();
 console.log('Real JWT assertions this phase: '+results.length);
 console.log('Fixture IDs: '+JSON.stringify({users:context.users.map(u=>u.id),posts:context.posts,conversations:context.conversations,reports:context.reports}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
