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



    const files=fs.readdirSync(path.join(root,'supabase/migrations')).filter(n=>n.startsWith('20261002')).sort();
    await db.exec('reset role');
    for(const name of files)await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'));
    const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261003004823_add_parking_sub_place_scope.sql'),'utf8');
    const publish=async(place,scope)=> (await db.query('select public.publish_parking_handoff($1::jsonb,29.3,47.9,5) id',[JSON.stringify({place_id:place,sub_place_id:scope,departure_minutes:60})])).rows[0].id;
    await login(A);
    const proven=(await db.query("insert into public.parking_posts(user_id,college,zone,gate,departure_minutes,expires_at) values($1,$2,$3,$4,60,now()+interval '1 hour') returning id",[A,college.nameAr,college.zone,college.gates[0]])).rows[0].id;
    const unknown=await publish('kuwait_university',null);
    await login(B);
    const claim=(await db.query('select public.claim_parking_post($1) r',[proven])).rows[0].r;
    const cid=claim.claim.conversation_id;
    await db.query("insert into public.messages(conversation_id,sender_id,type,text) values($1,$2,'text','History before scope migration')",[cid,B]);
    await db.exec('reset role');
    const before=(await db.query("select (to_jsonb(p)-'updated_at') r from public.parking_posts p order by id")).rows;
    const history=(await db.query('select * from public.messages')).rows;
    await db.exec(migration);
    const preservedBefore=(await db.query("select to_jsonb(p) r from public.parking_posts p order by id")).rows;
    await db.exec(fs.readFileSync(path.join(root,"supabase/migrations/20261003113052_expand_verified_paaet_scopes.sql"),"utf8"));
    check(JSON.stringify(preservedBefore)===JSON.stringify((await db.query("select to_jsonb(p) r from public.parking_posts p order by id")).rows),"Catalogue migration preserves all rows");
    const after=(await db.query("select (to_jsonb(p)-'updated_at'-'sub_place_id') r from public.parking_posts p order by id")).rows;
    check(JSON.stringify(before)===JSON.stringify(after),'All original post fields preserved');
    check(JSON.stringify(history)===JSON.stringify((await db.query('select * from public.messages')).rows),'Existing chat history preserved');
    check((await db.query('select sub_place_id from public.parking_posts where id=$1',[proven])).rows[0].sub_place_id==='education','Proven claimed legacy KU row backfilled');
    check((await db.query('select sub_place_id from public.parking_posts where id=$1',[unknown])).rows[0].sub_place_id===null,'Unclassified GPS row remains NULL');
    check((await db.query("select column_default,is_nullable from information_schema.columns where table_name='parking_posts' and column_name='sub_place_id'")).rows.every(r=>r.column_default===null&&r.is_nullable==='YES'),'Nullable scope without default');
    await login(C);
    for(const [place,scope] of [['kuwait_university','education'],['kuwait_university','arts'],['paaet','basic_education_ardiya'],['paaet','basic_education_jahra'],['paaet','nursing_shuwaikh'],['gust',null], ...['health_sciences_shuwaikh','technological_studies_shuwaikh','business_studies_ardiya','communications_navigation_shuwaikh','energy_shuwaikh','industrial_shuwaikh','industrial_sabah_al_salem','nursing_institute_shuwaikh','administrative_services_hawally_girls','administrative_services_hawally_boys','construction_south_sabahiya','vocational_sharq'].map(id=>['paaet',id])]){
      await db.exec('begin');const pid=await publish(place,scope);
      check((await db.query('select sub_place_id from public.parking_posts where id=$1',[pid])).rows[0].sub_place_id===scope,'GPS scope persisted '+place+'/'+scope);
      check((await db.query('select post_id from public.parking_post_locations where post_id=$1',[pid])).rows.length===1,'GPS private row atomic '+place+'/'+scope);
      await db.exec('rollback');
    }
    for(const [place,scope] of [['kuwait_university','basic_education_ardiya'],['paaet','education'],['gust','education'],['paaet','invented_branch'],['kuwait_university','']]){
      await reject(publish(place,scope),'parking_posts_valid_sub_place');
    }
    await db.exec('reset role');
    check((await db.query('select count(*)::int n from public.parking_post_locations')).rows[0].n===1,'Rejected scope creates no orphan GPS');
    await login(C);
    await reject(db.query("insert into public.parking_posts(user_id,place_id,sub_place_id,handoff,departure_minutes,expires_at) values($1,'kuwait_university','education',true,60,now()+interval '1 hour')",[C]),'PLACE_INVALID_KU_LOCATION');
    await reject(db.query("insert into public.parking_posts(user_id,place_id,sub_place_id,handoff,departure_minutes,expires_at) values($1,'paaet','basic_education_ardiya',true,60,now()+interval '1 hour')",[C]),'PLACE_LOCATION_REQUIRED');
    await db.exec('begin');
    const legacy=(await db.query("insert into public.parking_posts(user_id,college,zone,gate,departure_minutes,expires_at) values($1,$2,$3,$4,60,now()+interval '1 hour') returning sub_place_id",[C,college.nameAr,college.zone,college.gates[0]])).rows[0];
    check(legacy.sub_place_id==='education','Cached valid KU insert remains accepted and proven');await db.exec('rollback');
    await login(A);
    await reject(db.query("update public.parking_posts set sub_place_id='arts' where id=$1",[proven]),'HANDOFF_IMMUTABLE');
    await db.exec('reset role');
    const scopeSnapshot=(await db.query('select id,sub_place_id from public.parking_posts order by id')).rows;
    await db.exec(fs.readFileSync(path.join(root,'supabase/rollback/revert_parking_sub_place_scope.sql'),'utf8'));
    check(JSON.stringify(scopeSnapshot)===JSON.stringify((await db.query('select id,sub_place_id from public.parking_posts order by id')).rows),'Compatibility rollback retains scope data');
    check(JSON.stringify(history)===JSON.stringify((await db.query('select * from public.messages')).rows),'Rollback retains messages');
    await login(C);await db.exec('begin');check(Boolean(await publish('gust',null)),'Previous GPS RPC works after rollback');await db.exec('rollback');
    console.log(JSON.stringify({status:'PASS',assertions,engine:'Disposable PGlite PostgreSQL'}));
  }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
