// In-memory PostgreSQL only; no remote client, credentials, or production rows.
// node scripts/test-production-rehearsal.cjs <pglite-package-directory>
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {PGlite}=require(process.argv[2]);
const {pgcrypto}=require(path.join(process.argv[2],'dist/contrib/pgcrypto.cjs'));
const root=path.resolve(__dirname,'..'), folder=path.join(root,'supabase/production');
const read=name=>fs.readFileSync(path.join(folder,name),'utf8');
const order=JSON.parse(read('rehearsal/migration-order.json'));
const expectedHashes=JSON.parse(read('rehearsal/migration-hashes.json'));
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=uid(1),B=uid(2),C=uid(3);
let count=0;const check=(name,value)=>{assert(value,name);count++;console.log('PASS '+name);};
(async()=>{
 const db=new PGlite({extensions:{pgcrypto}});
 try{
  await db.exec(read('rehearsal/platform-mocks.sql'));
  await db.exec(read('rehearsal/observed-schema.sql'));
  // Synthetic counts match the reviewed snapshot; every ID/content is artificial.
  await db.exec(`alter table public.parking_posts disable trigger parking_posts_after_insert_app_notification;
   alter table public.messages disable trigger messages_after_insert;
   alter table public.messages disable trigger messages_after_insert_app_notification;`);
  for(let n=1;n<=975;n++)await db.query('insert into auth.users(id,is_anonymous) values($1,$2)',[uid(n),n<=968]);
  for(let n=1;n<=23;n++)await db.query(`insert into public.parking_posts(id,user_id,college,zone,gate,departure_minutes,expires_at,status,created_at)
   values($1,$2,'كلية التربية','A','Gate 5',60,now()+case when $3=1 then interval '1 hour' else interval '-1 day' end,
   case when $3=1 then 'active' else 'expired' end,now()-interval '2 days')`,[uid(1000+n),A,n]);
  for(let n=1;n<=16;n++)await db.query(`insert into public.conversations(id,post_id,owner_id,requester_id,created_at) values($1,$2,$3,$4,now()-interval '1 day')`,[uid(2000+n),uid(1000+n),A,B]);
  for(let n=1;n<=23;n++)await db.query(`insert into public.messages(id,conversation_id,sender_id,type,text,image_url,created_at)
   values($1,$2,$3,$4,$5,$6,now()-interval '1 hour')`,[uid(3000+n),uid(2001+(n-1)%16),n%2?A:B,n<=4?'image':'text',n<=4?null:'synthetic retained '+n,n<=4?'https://opsyvdsivxoqphkfdsbb.supabase.co/storage/v1/object/public/chat-images/chat/'+uid(2001+(n-1)%16)+'/'+uid(3000+n)+'.png':null]);
  for(let n=1;n<=4;n++)await db.query(`insert into storage.objects(id,bucket_id,name,owner_id,metadata) values($1,'chat-images',$2,$3,'{"mimetype":"image/png","size":12}')`,[uid(4000+n),'chat/'+uid(2001+(n-1)%16)+'/'+uid(3000+n)+'.png',n%2?A:B]);
  for(let n=1;n<=18;n++)await db.query(`insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values($1,$2,'synthetic-public-key','synthetic-auth')`,[uid(n),'https://push.invalid/'+n]);
  await db.exec(`alter table public.parking_posts enable trigger parking_posts_after_insert_app_notification;
   alter table public.messages enable trigger messages_after_insert;
   alter table public.messages enable trigger messages_after_insert_app_notification;`);
  const rows=async table=>(await db.query('select * from '+table+' order by id')).rows;
  const oldPosts=await rows('public.parking_posts'),oldChats=await rows('public.conversations'),oldMessages=await rows('public.messages'),oldImages=await rows('storage.objects');
  const hashes=[];
  for(const file of order){
   const sql=fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8');
   const hash=crypto.createHash('sha256').update(sql.replace(/\r\n/g,'\n')).digest('hex');
   assert.equal(hash,expectedHashes[file],'Reviewed migration changed: '+file);
   assert(/^begin;/m.test(sql)&&/commit;\s*$/.test(sql),'Transactional migration required: '+file);
   // Prove each migration can abort without its DDL/data mutations escaping.
   await db.exec(sql.replace(/commit;\s*$/,'rollback;'));
   await db.exec(sql);
   hashes.push({file,sha256:hash});
   check('Apply and rollback rehearsal '+file,true);
  }
  check('All 975 Auth-bound profiles retained',(await rows('public.users')).length===975);
  const migrated=await rows('public.parking_posts');
  check('All 23 legacy KU posts preserved',migrated.length===23&&migrated.every(p=>p.place_id==='kuwait_university'&&p.sub_place_id==='education'));
  check('No North/South scope guessed',migrated.every(p=>!p.sub_place_id.includes('_north')&&!p.sub_place_id.includes('_south')));
  check('Legacy post content/status preserved',migrated.every((p,i)=>Object.keys(oldPosts[i]).filter(k=>k!=='updated_at').every(k=>JSON.stringify(p[k])===JSON.stringify(oldPosts[i][k]))));
  check('Conversations unchanged',JSON.stringify(await rows('public.conversations'))===JSON.stringify(oldChats));
  check('Messages unchanged',JSON.stringify(await rows('public.messages'))===JSON.stringify(oldMessages));
  check('Image metadata unchanged',JSON.stringify(await rows('storage.objects'))===JSON.stringify(oldImages));
  check('Bucket transitioned private',(await db.query("select public from storage.buckets where id='chat-images'")).rows[0].public===false);
  check('No fabricated claims',(await rows('public.parking_claims')).length===0);
  check('No fabricated GPS',(await db.query('select * from public.parking_post_locations')).rows.length===0);
  check('No fabricated production contributor',(await db.query("select * from public.users where id='316c5406-be8a-4950-a0ce-d2c929c01c8d'")).rows.length===0);
  check('All public application tables have RLS',(await db.query("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity")).rows[0].n===0);
  check('Private arrival settings have no client SELECT grant',(await db.query("select has_table_privilege('authenticated','mawqifi_safety.handoff_settings','SELECT') v")).rows[0].v===false);
  check('Auth no longer cascades into profiles',(await db.query("select confdeltype from pg_constraint where conrelid='public.users'::regclass and confrelid='auth.users'::regclass")).rows.every(x=>x.confdeltype==='n'));
  check('Posts cannot cascade into history',(await db.query("select confdeltype from pg_constraint where conrelid='public.conversations'::regclass and confrelid='public.parking_posts'::regclass")).rows[0].confdeltype==='r');
  check('Conversation lifecycle not client-writable',(await db.query("select has_column_privilege('authenticated','public.conversations','closed','UPDATE') v")).rows[0].v===false);
  check('Read markers remain client-writable',(await db.query("select has_column_privilege('authenticated','public.conversations','owner_last_read_at','UPDATE') v")).rows[0].v===true);
  check('No managed Storage triggers copied',(await db.query("select 1 from pg_trigger where tgrelid='storage.objects'::regclass and not tgisinternal")).rows.length===0);
  const login=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role);};
  for(const [user,role,expected] of [[A,'authenticated',4],[B,'authenticated',4],[C,'authenticated',0],[null,'anon',0]]){
   await login(user,role);check('Historical image access '+role+'/'+(user||'none'),(await db.query('select * from storage.objects')).rows.length===expected);
  }
  // The actual upgraded image resolver consumes old public locators unchanged.
  const ts=require('typescript'),exports={};let requested;
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://opsyvdsivxoqphkfdsbb.supabase.co';
  const code=ts.transpileModule(fs.readFileSync(path.join(root,'lib/chat-images.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('require','exports',code)(()=>({getSupabase:()=>({storage:{from:()=>({download:async(p,options,fetchOptions)=>{requested={p,options,fetchOptions};return{data:new Blob(['synthetic image bytes'])};}})}})}),exports);
  await exports.downloadChatImage(oldMessages[0].image_url,oldMessages[0].conversation_id);
  check('Upgraded client resolves historical locator',requested.p===oldImages[0].name&&requested.options.cacheNonce&&requested.fetchOptions.cache==='no-store');
  await db.exec('reset role');
  const cutoff=(await db.query('select clock_timestamp() t')).rows[0].t;
  const sql=name=>read(name).replace(/:'rollout_cutoff'/g,"'"+new Date(cutoff).toISOString()+"'").replace(/:'approved_count'/g,"'15'");
  await db.exec(sql('legacy_conversation_read_only_cutover_preview.sql'));
  check('Exact reviewed synthetic candidate count',(await db.query('select count(*)::int n from legacy_cutover_candidates')).rows[0].n===15);
  // Drift is rejected atomically, then repaired solely in this disposable fixture.
  const prev=(await db.query('select updated_at from public.conversations where id=$1',[uid(2002)])).rows[0].updated_at;
  await db.query('update public.conversations set owner_last_read_at=clock_timestamp() where id=$1',[uid(2002)]);
  try{await db.exec(sql('legacy_conversation_read_only_cutover_apply.sql'));assert.fail('Drift accepted');}catch(e){assert(/CUTOVER_MANIFEST_CHANGED/.test(e.message));await db.exec('rollback');check('Manifest drift aborts entire cutover',true);}
  await db.exec('alter table public.conversations disable trigger conversations_updated_at');
  await db.query('update public.conversations set updated_at=$1 where id=$2',[prev,uid(2002)]);
  await db.exec('alter table public.conversations enable trigger conversations_updated_at');
  await db.exec(sql('legacy_conversation_read_only_cutover_apply.sql'));
  check('Only reviewed inactive legacy chats closed',(await db.query('select count(*)::int n from public.conversations where closed')).rows[0].n===15);
  check('Active legacy conversation stays open',(await db.query('select closed from public.conversations where id=$1',[uid(2001)])).rows[0].closed===false);
  check('Cutover preserves messages/images',JSON.stringify(await rows('public.messages'))===JSON.stringify(oldMessages)&&JSON.stringify(await rows('storage.objects'))===JSON.stringify(oldImages));
  await login(B);check('Closed history readable to participant',(await db.query('select * from public.messages')).rows.length===23);
  try{await db.query("insert into public.messages(conversation_id,sender_id,type,text) values($1,$2,'text','should fail')",[uid(2002),B]);assert.fail('Closed message accepted');}catch(e){check('Legacy closed chat enforces read-only',/Conversation unavailable|closed|expired|row-level security/i.test(e.message));}
  await db.exec('reset role');await db.exec(read('legacy_conversation_read_only_cutover_reverse.sql'));
  check('Guarded cutover reversal restores open state',(await db.query('select 1 from public.conversations where closed')).rows.length===0);
  const reject=async(name,request,pattern)=>{try{await request();assert.fail('Unexpected success');}catch(e){check(name,pattern.test(e.message));}};
  const publish=async(place,scope)=>(await db.query('select public.publish_parking_handoff($1,29.3,47.9,5) id',[{place_id:place,sub_place_id:scope,departure_minutes:60}])).rows[0].id;
  await login(A);
  const north=await publish('kuwait_university','education_north'),south=await publish('kuwait_university','education_south');
  const paaet=await publish('paaet','basic_education_ardiya'),gust=await publish('gust',null);
  check('Secure GPS RPC persists North/South scope',(await db.query('select sub_place_id from public.parking_posts where id in($1,$2)',[north,south])).rows.every(p=>['education_north','education_south'].includes(p.sub_place_id)));
  check('North query excludes South and unscoped legacy rows',(await db.query("select id from public.parking_posts where place_id='kuwait_university' and sub_place_id='education_north' and status='active' and expires_at>now()")).rows.every(p=>p.id===north));
  check('PAAET branch isolated',(await db.query("select id from public.parking_posts where place_id='paaet' and sub_place_id='basic_education_ardiya'")).rows[0].id===paaet);
  check('GUST remains single campus',(await db.query('select sub_place_id from public.parking_posts where id=$1',[gust])).rows[0].sub_place_id===null);
  await reject('Invalid scope rejected atomically',()=>publish('paaet','education_north'),/PLACE_INVALID_SUB_PLACE|parking_posts_valid_sub_place/);
  await reject('Arbitrary GPS-less insert not exempt',()=>db.query("insert into public.parking_posts(user_id,place_id,departure_minutes,expires_at) values($1,'gust',60,now()+interval '1 hour')",[A]),/PLACE_LOCATION_REQUIRED/);
  await login(B);check('Unclaimed GPS private',(await db.query('select * from public.parking_post_locations where post_id=$1',[north])).rows.length===0);
  const claim=(await db.query('select public.claim_parking_post($1) s',[north])).rows[0].s;
  const cid=claim.claim.conversation_id;
  check('Claim immediately resolves conversation',!!cid);
  check('Claimed GPS available to matched participant',(await db.query('select * from public.parking_post_locations where post_id=$1',[north])).rows.length===1);
  check('Repeated claim reuses same conversation',(await db.query('select public.claim_parking_post($1) s',[north])).rows[0].s.claim.conversation_id===cid);
  await login(C);check('Third party still cannot read GPS',(await db.query('select * from public.parking_post_locations where post_id=$1',[north])).rows.length===0);
  await reject('Second claimant denied',()=>db.query('select public.claim_parking_post($1)',[north]),/HANDOFF_ALREADY_CLAIMED/);
  await login(A);await db.query("insert into public.messages(conversation_id,sender_id,type,text) values($1,$2,'text','handoff fixture owner')",[cid,A]);
  await db.query("insert into public.content_reports(reporter_id,target_type,target_id,reason) values($1,'user',$2,'spam')",[A,B]);
  await db.query('insert into public.user_blocks(blocker_id,blocked_id) values($1,$2)',[A,B]);
  await reject('Owner blocked message denied',()=>db.query("insert into public.messages(conversation_id,sender_id,type,text) values($1,$2,'text','blocked owner')",[cid,A]),/SAFETY_BLOCKED/);
  await login(B);await reject('Peer blocked message denied',()=>db.query("insert into public.messages(conversation_id,sender_id,type,text) values($1,$2,'text','blocked peer')",[cid,B]),/SAFETY_BLOCKED/);
  await reject('Blocked claim denied',()=>db.query('select public.claim_parking_post($1)',[south]),/SAFETY_BLOCKED/);
  check('Reporter details private',(await db.query('select * from public.content_reports')).rows.length===0);
  check('Blocked history remains readable',(await db.query('select * from public.messages where conversation_id=$1',[cid])).rows.length===1);
  await login(A);await db.query('delete from public.user_blocks where blocker_id=$1 and blocked_id=$2',[A,B]);
  await login(B);await db.query("insert into public.messages(conversation_id,sender_id,type,text) values($1,$2,'text','handoff fixture peer')",[cid,B]);
  const arrived=(await db.query('select public.arrive_parking_handoff($1,true) s',[cid])).rows[0].s;
  const repeated=(await db.query('select public.arrive_parking_handoff($1,true) s',[cid])).rows[0].s;
  check('Manual arrival is idempotent',arrived.claim.chat_closes_at===repeated.claim.chat_closes_at);
  check('Server timer exactly 15 minutes',new Date(arrived.claim.chat_closes_at)-new Date(arrived.claim.arrived_at)===900000);
  await db.exec('reset role');check('Arrival radius remains 25m',(await db.query('select arrival_radius_meters from mawqifi_safety.handoff_settings')).rows[0].arrival_radius_meters===25);
  // Controlled disposable clock simulation, never a hosted data edit.
  await db.query("update public.parking_claims set arrived_at=now()-interval '16 minutes',chat_closes_at=now()-interval '1 minute' where conversation_id=$1",[cid]);
  await login(B);await reject('Elapsed server timer rejects inserts',()=>db.query("insert into public.messages(conversation_id,sender_id,type,text) values($1,$2,'text','late peer')",[cid,B]),/HANDOFF_CHAT_CLOSED/);
  check('Timed-out history retained',(await db.query('select * from public.messages where conversation_id=$1',[cid])).rows.length===2);
  await db.exec('reset role');check('All historical images still unchanged',JSON.stringify(await rows('storage.objects'))===JSON.stringify(oldImages));
  // Query lock catalogue inside a real PostgreSQL transaction (one session).
  await login(A);await db.exec('begin');await db.query('select public.begin_account_deletion()');
  await db.exec('reset role');
  check('Deletion acquires transaction advisory lock',(await db.query("select 1 from pg_locks where locktype='advisory' and granted")).rows.length>0);
  await db.exec('rollback');
  check('Advisory lock released on rollback',(await db.query("select 1 from pg_locks where locktype='advisory'")).rows.length===0);
  check('Deletion rollback preserves all history',(await rows('public.messages')).length===25);
  console.log(JSON.stringify({assertions:count,engine:'PGlite PostgreSQL; one session, no multi-session contention test',migrations:hashes,syntheticShape:{profiles:975,posts:23,conversations:16,messages:23,images:4,webSubscriptions:18},productionWrites:0},null,2));
 }finally{await db.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
