// Disposable PostgreSQL only. Usage: node scripts/test-place-scoping.cjs <pglite-package> <validated-staging-bootstrap.sql>
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { PGlite } = require(process.argv[2]);
const { pgcrypto } = require(path.join(process.argv[2], 'dist/contrib/pgcrypto.cjs'));
const root = path.resolve(__dirname, '..');
const ts = require('typescript');
const Module = require('module');
const uni = new Module(path.join(root, 'lib/university.ts'));
uni._compile(ts.transpileModule(fs.readFileSync(path.join(root, 'lib/university.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, path.join(root, 'lib/university.ts'));
const college = uni.exports.kuColleges[0];
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261002094805_add_extensible_places.sql'), 'utf8');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
let assertions = 0;
function check(value, name) { assert(value, name); assertions++; console.log('PASS ' + name); }
async function reject(promise, message) {
  try { await promise; assert.fail('Expected ' + message); } catch (error) {
    check(error.message.includes(message), message + ' rejected');
  }
}
async function main() {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec([
      'create role anon; create role authenticated; create role service_role bypassrls;',
      'create schema auth; create schema storage;',
      "create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}'::jsonb, is_anonymous boolean default false);",
      "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
      'grant usage on schema auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;',
      'create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);',
      'create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text); alter table storage.objects enable row level security;',
      "create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;",
      'create publication supabase_realtime;',
    ].join('\n'));
    await db.exec(fs.readFileSync(process.argv[3], 'utf8'));
    for (const id of [A, B, C]) await db.query('insert into auth.users(id,is_anonymous) values($1,true)', [id]);
    const login = async id => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.exec('set role authenticated');
      await db.exec("select set_config('request.headers','{\"x-mawqifi-place-aware\":\"1\"}',false)");
    };
    const insert = async (id, place, description, structured = false) => db.query(
      "insert into public.parking_posts(user_id,college,zone,gate,place_id,location_description,departure_minutes,expires_at) values($1,$2,$3,$4,$5,$6,60,now()+interval '1 hour') returning id,place_id",
      [id, structured ? college.nameAr : null, structured ? college.zone : null, structured ? college.gates[0] : null, place, description]);


    await login(A);
    const existing=(await db.query("insert into public.parking_posts(user_id,college,zone,gate,departure_minutes,expires_at) values($1,$2,$3,$4,60,now()+interval '1 hour') returning id",[A,college.nameAr,college.zone,college.gates[0]])).rows[0].id;
    await login(B);
    const existingChat=(await db.query('insert into public.conversations(post_id,owner_id,requester_id) values($1,$2,$3) returning id',[existing,A,B])).rows[0].id;
    await db.query("insert into public.messages(conversation_id,sender_id,type,text) values($1,$2,'text','Existing history')",[existingChat,B]);
    await db.exec('reset role');
    for(const name of fs.readdirSync(path.join(root,'supabase/migrations')).filter(n=>n.startsWith('20261002')).sort()) await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'));


    // Roll back successful boundary fixtures so they don't consume post-rate capacity.
    await login(A);
    for(const place of ['kuwait_university','paaet','gust']){
      await db.exec('begin');
      const gps=(await db.query("select public.publish_parking_handoff($1::jsonb,29.3,47.9,5) id",[JSON.stringify({place_id:place,departure_minutes:10})])).rows[0].id;
      const row=(await db.query('select * from public.parking_posts where id=$1',[gps])).rows[0];
      check(row.place_id===place&&row.college===null&&row.zone===null&&row.gate===null&&row.location_description===null,'GPS-only publish without fabricated metadata '+place);
      check((await db.query('select post_id from public.parking_post_locations where post_id=$1',[gps])).rows.length===1,'Private GPS created atomically '+place);
      await db.exec('rollback');
      await reject(db.query("insert into public.parking_posts(user_id,place_id,handoff,departure_minutes,expires_at) values($1,$2,true,10,now()+interval '10 minutes')",[A,place]),place==='kuwait_university'?'PLACE_INVALID_KU_LOCATION':'PLACE_LOCATION_REQUIRED');
    }
    await reject(db.query("insert into public.parking_post_locations(post_id,owner_id,latitude,longitude) values(gen_random_uuid(),$1,29.3,47.9)",[A]),'permission denied');
    for(const coordinates of [[null,47.9],[91,47.9],[29.3,181],[NaN,47.9]]){
      await reject(db.query("select public.publish_parking_handoff($1::jsonb,$2,$3,5)",[JSON.stringify({place_id:'gust',departure_minutes:10}),...coordinates]),'HANDOFF_LOCATION_REQUIRED');
    }
    await reject(db.query("select public.publish_parking_handoff($1::jsonb,29.3,47.9,5)",[JSON.stringify({departure_minutes:10})]),'PLACE_REQUIRED');
    await reject(db.query("select public.publish_parking_handoff($1::jsonb,29.3,47.9,5)",[JSON.stringify({place_id:'unknown',departure_minutes:10})]),'PLACE_UNAVAILABLE');
    check((await db.query('select count(*)::int n from public.parking_post_locations')).rows[0].n===0,'Failed RPCs leave no orphan locations');
    await db.exec('reset role');
    const snapshot=async()=>JSON.stringify((await db.query('select (select jsonb_agg(p order by id) from public.parking_posts p) posts,(select jsonb_agg(m order by id) from public.messages m) messages')).rows);
    const rollbackUser='44444444-4444-4444-8444-444444444444';
    await db.query('insert into auth.users(id,is_anonymous) values($1,true)',[rollbackUser]);
    await login(rollbackUser);
    const rollbackGps=(await db.query("select public.publish_parking_handoff($1::jsonb,29.3,47.9,5) id",[JSON.stringify({place_id:'kuwait_university',departure_minutes:10})])).rows[0].id;
    await db.exec('reset role');
    const beforeRollback=await snapshot();
    await db.exec(fs.readFileSync(path.join(root,'supabase/rollback/revert_gps_minimal_publish.sql'),'utf8'));
    check(await snapshot()===beforeRollback,'Rollback preserves all existing data');
    await login(A);
    await reject(db.query("select public.publish_parking_handoff($1::jsonb,29.3,47.9,5)",[JSON.stringify({place_id:'gust',departure_minutes:10})]),'PLACE_LOCATION_REQUIRED');
    await db.exec('reset role');
    await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261002220823_gps_handoff_minimal_publish.sql'),'utf8'));
    check(await snapshot()===beforeRollback,'Reapplication preserves all existing data');
    check((await db.query('select post_id from public.parking_post_locations where post_id=$1',[rollbackGps])).rows.length===1,'Rollback retains GPS-only location');
    await db.exec("select set_config('request.jwt.claim.sub','',false)");
    await db.query('delete from public.parking_posts where id=$1',[rollbackGps]);
    await db.query('delete from auth.users where id=$1',[rollbackUser]);

    await login(B);
    check((await db.query('select * from public.messages where conversation_id=$1',[existingChat])).rows.length===1,'Migration preserves existing history');
    check((await db.query('select * from public.parking_claims where post_id=$1',[existing])).rows.length===0,'Migration does not invent historical claimants');
    await login(A);
    const publish=async()=> (await db.query("select public.publish_parking_handoff($1::jsonb,29.3,47.9,5) id",[JSON.stringify({place_id:'gust',location_description:'Near the entrance',departure_minutes:60})])).rows[0].id;
    const pid=await publish();
    check(Boolean(pid),'Atomic publication and private location');
    await login(B);
    check((await db.query('select * from public.parking_post_locations where post_id=$1',[pid])).rows.length===0,'B cannot read location before claim');
    await login(C);
    check((await db.query('select * from public.parking_post_locations where post_id=$1',[pid])).rows.length===0,'C cannot read location before claim');
    await login(A);
    await reject(db.query('select public.claim_parking_post($1)',[pid]),'HANDOFF_INVALID');
    await login(B);
    const state=(await db.query('select public.claim_parking_post($1) s',[pid])).rows[0].s;
    const cid=state.claim.conversation_id;
    check(state.claim.claimant_id===B && state.location.latitude===29.3,'B claim creates private conversation and exposes location');
    check(state.claim.chat_closes_at===null,'No timer at claim');
    check((await db.query('select public.claim_parking_post($1) s',[pid])).rows[0].s.claim.id===state.claim.id,'Repeated claim reuses conversation');
    await login(C);
    await reject(db.query('select public.claim_parking_post($1)',[pid]),'HANDOFF_ALREADY_CLAIMED');
    check((await db.query('select * from public.parking_post_locations where post_id=$1',[pid])).rows.length===0,'C cannot read location after claim');
    await reject(db.query('select public.get_parking_handoff($1)',[cid]),'Authentication required');
    await login(B);
    check((await db.query("select id from public.parking_posts where id=$1 and status='active'",[pid])).rows.length===0,'Claim removes available discovery');
    const send=async(id,text)=>db.query("insert into public.messages(conversation_id,sender_id,type,text) values($1,$2,'text',$3) returning id",[cid,id,text]);
    const message=(await send(B,'I am on my way')).rows[0].id;
    await reject(send(B,'I am on my way'),'SAFETY_DUPLICATE');
    await reject(send(B,'\u200B \u200C'),'SAFETY_INVALID_TEXT');
    await login(A);await send(A,'I will wait beside the car');
    check(true,'Both participants chat');
    await db.query('insert into public.user_blocks(blocker_id,blocked_id) values($1,$2)',[A,B]);
    await reject(send(A,'Blocked owner message'),'SAFETY_BLOCKED');
    await login(B);
    await reject(send(B,'Blocked message'),'SAFETY_BLOCKED');
    await reject(db.query('select public.claim_parking_post($1)',[pid]),'SAFETY_BLOCKED');
    check((await db.query('select * from public.messages where conversation_id=$1',[cid])).rows.length===2,'Blocked history remains readable');
    await login(A);await db.query('delete from public.user_blocks where blocker_id=$1',[A]);
    await login(B);
    await reject(db.query('select public.arrive_parking_handoff($1,false,30,48,5)',[cid]),'HANDOFF_NOT_NEAR');
    await reject(db.query('select public.arrive_parking_handoff($1,false,29.3,47.9,100)',[cid]),'HANDOFF_NOT_NEAR');
    const arrival=(await db.query('select public.arrive_parking_handoff($1,false,29.3,47.9,5) s',[cid])).rows[0].s;
    check(Date.parse(arrival.claim.chat_closes_at)-Date.parse(arrival.claim.arrived_at)===900000,'Server arrival starts exactly 15 minutes');
    const repeat=(await db.query('select public.arrive_parking_handoff($1,true) s',[cid])).rows[0].s;
    check(repeat.claim.chat_closes_at===arrival.claim.chat_closes_at,'Manual repeat cannot extend timer');
    await reject(db.query("update public.parking_claims set chat_closes_at=now()+interval '1 day'"),'permission denied');
    await reject(db.query("update public.conversations set closed=false where id=$1",[cid]),'permission denied');
    await login(A);
    await reject(db.query("update public.parking_posts set handoff=false where id=$1",[pid]),'HANDOFF_IMMUTABLE');
    await db.query("insert into public.content_reports(reporter_id,target_type,target_id,reason,details) values($1,'message',$2,'other','Handoff report')",[A,message]);
    check(true,'Reporting remains usable');
    await db.exec('reset role');
    await db.query("update public.parking_claims set arrived_at=now()-interval '16 minutes',chat_closes_at=now()-interval '1 minute' where id=$1",[state.claim.id]);

    await login(B);
    await reject(send(B,'After timer expiry'),'HANDOFF_CHAT_CLOSED');
    check((await db.query('select * from public.messages where conversation_id=$1',[cid])).rows.length===2,'Expired history remains readable');
    await db.query('select public.expire_old_parking_posts()');
    check((await db.query('select * from public.messages where conversation_id=$1',[cid])).rows.length===2,'Expiry RPC retains every message');
    await login(A);
    const cancelled=await publish();
    await login(B);
    const cancelledState=(await db.query('select public.claim_parking_post($1) s',[cancelled])).rows[0].s;
    await login(A);await db.query("update public.parking_posts set status='cancelled' where id=$1",[cancelled]);
    await login(B);
    check((await db.query('select public.get_parking_handoff($1) s',[cancelledState.claim.conversation_id])).rows[0].s.claim.status==='cancelled','Creator cancellation notifies retained handoff state');

    await login(A);
    const manualPost=await publish();
    await login(B);
    const manualClaim=(await db.query('select public.claim_parking_post($1) s',[manualPost])).rows[0].s;
    const manualArrival=(await db.query('select public.arrive_parking_handoff($1,true) s',[manualClaim.claim.conversation_id])).rows[0].s;
    check(Boolean(manualArrival.claim.arrived_at),'Manual first arrival works without GPS');
    check((await db.query('select public.arrive_parking_handoff($1,true) s',[manualClaim.claim.conversation_id])).rows[0].s.claim.chat_closes_at===manualArrival.claim.chat_closes_at,'Repeated manual first arrival is idempotent');
    await login(C);
    const legacy=(await db.query("insert into public.parking_posts(user_id,college,zone,gate,departure_minutes,expires_at) values($1,$2,$3,$4,60,now()+interval '1 hour') returning id,place_id",[C,college.nameAr,college.zone,college.gates[0]])).rows[0];
    check(legacy.place_id==='kuwait_university','Old-style KU insert retains verified place');
    await login(A);
    const oldConversation=(await db.query('insert into public.conversations(post_id,owner_id,requester_id) values($1,$2,$3) returning id',[legacy.id,C,A])).rows[0];
    check(Boolean(oldConversation.id),'Cached conversation insertion is also atomically reserved');
    await login(B);
    await reject(db.query('insert into public.conversations(post_id,owner_id,requester_id) values($1,$2,$3)',[legacy.id,C,B]),'HANDOFF_ALREADY_CLAIMED');
    await login(C);
    await db.query("delete from public.parking_posts where id=$1",[legacy.id]);
    check((await db.query('select status from public.parking_posts where id=$1',[legacy.id])).rows[0].status==='cancelled','Cached Delete becomes safe cancellation');
    check((await db.query('select count(*)::int n from public.conversations where id=$1',[oldConversation.id])).rows[0].n===1,'Cached cancellation retains conversation');
    await db.exec('reset role');
    await db.query('update public.conversations set closed=true where id=$1',[existingChat]);
    await login(B);
    await reject(db.query('select public.claim_parking_post($1)',[existing]),'HANDOFF_CHAT_CLOSED');
    await login(A);
    check(Boolean(await publish()),'Fifth post in five minutes succeeds with private publication');
    await reject(publish(),'SAFETY_RATE_LIMIT');
    await login(C);
    await reject(db.query("select public.publish_parking_handoff($1::jsonb,29.3,47.9,5)",[JSON.stringify({place_id:'gust',location_description:'Clear location',car_desc:'x'.repeat(501),departure_minutes:60})]),'SAFETY_INVALID_TEXT');

    const expiredPost=await publish();
    await db.query("update public.parking_posts set expires_at=now()-interval '1 second' where id=$1",[expiredPost]);
    await login(A);await reject(db.query('select public.claim_parking_post($1)',[expiredPost]),'SAFETY_POST_EXPIRED');
    await login(C);const closedPost=await publish();await db.query("update public.parking_posts set status='closed' where id=$1",[closedPost]);
    await login(A);await reject(db.query('select public.claim_parking_post($1)',[closedPost]),'SAFETY_POST_EXPIRED');
    await login(C);
    const notePost=(await db.query("select public.publish_parking_handoff($1::jsonb,29.3,47.9,5) id",[JSON.stringify({place_id:'gust',location_description:'Clear location',car_desc:'x'.repeat(500),departure_minutes:60})])).rows[0].id;
    check(Boolean(notePost),'500-character parking note remains valid');
    await login(A);
    const longChat=(await db.query('select public.claim_parking_post($1) s',[notePost])).rows[0].s.claim.conversation_id;
    await db.query("insert into public.messages(conversation_id,sender_id,type,text) values($1,$2,'text',$3)",[longChat,A,'Long paragraph '.repeat(160)]);
    check(true,'No artificial 2000-character message cap');
    for(let n=0;n<18;n++)await db.query("insert into public.messages(conversation_id,sender_id,type,text) values($1,$2,'text',$3)",[longChat,A,'Boundary message '+n]);
    check(true,'Twenty messages in one minute remain allowed');
    await reject(db.query("insert into public.messages(conversation_id,sender_id,type,text) values($1,$2,'text','Over rate boundary')",[longChat,A]),'SAFETY_RATE_LIMIT');
    console.log('Handoff SQL/RLS assertions: '+assertions);


  } finally {await db.close();}
}
main().catch(error=>{console.error(error);process.exit(1);});
