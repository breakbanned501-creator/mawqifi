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
    // Before the new migration: emulate one verified and one unknown legacy row.
    await login(A);
    const legacy = (await db.query("insert into public.parking_posts(user_id,college,zone,gate,departure_minutes,expires_at) values($1,$2,$3,$4,60,now()+interval '1 hour') returning id", [A, college.nameAr, college.zone, college.gates[0]])).rows[0].id;
    await login(B);
    const unknown = (await db.query("insert into public.parking_posts(user_id,college,zone,gate,departure_minutes,expires_at) values($1,'Unknown legacy location','A','Unknown',60,now()+interval '1 hour') returning id", [B])).rows[0].id;
    await db.exec('reset role');
    await db.exec(process.argv[4] === '--corrupt-transport' ? migration.replace(/[^\x00-\x7F]/g, '?') : migration);
    await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261002100839_repair_place_catalogue_unicode.sql'),'utf8'));
    await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261002102714_make_place_location_filter_transport_safe.sql'),'utf8'));
    await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261002112650_preserve_place_feed_realtime.sql'),'utf8'));
    check((await db.query('select place_id from public.parking_posts where id=$1',[legacy])).rows[0].place_id === 'kuwait_university','Verified legacy backfill');
    check((await db.query('select place_id from public.parking_posts where id=$1',[unknown])).rows[0].place_id === null,'Unknown legacy remains unclassified');
    await login(B);
    await db.query("update public.parking_posts set status='expired' where id=$1",[unknown]);
    check(true,'Unknown legacy status-only expiry remains valid');
    await db.exec('reset role; set role anon');
    check((await db.query('select count(*)::int n from public.places')).rows[0].n === 3,'Anon catalogue read');
    await reject(db.exec("insert into public.places(id,name_ar,name_en) values('not_allowed','test','test')"),'permission denied');
    await login(A);
    check((await db.query('select count(*)::int n from public.places')).rows[0].n === 3,'Authenticated catalogue read');
    await reject(db.exec("update public.places set active=false"),'permission denied');
    check((await insert(A,null,null,true)).rows[0].place_id === 'kuwait_university','Cached old-client insert');
    check((await insert(A,'kuwait_university',null,true)).rows[0].place_id === 'kuwait_university','Explicit new KU insert');
    const paaet = (await insert(A,'paaet','College and area; near the entrance')).rows[0].id;
    const gust = (await insert(A,'gust','Mishref; beside a visible landmark')).rows[0].id;
    check(Boolean(paaet && gust),'PAAET/GUST nullable structured fields');
    await db.exec("select set_config('request.headers','',false)");
    check((await db.query("select id from public.parking_posts where place_id='paaet'")).rows.length>0,'Realtime no-HTTP context retains new-place visibility');
    await db.exec("select set_config('request.headers','{}',false)");
    check((await db.query('select place_id from public.parking_posts')).rows.every(row=>row.place_id==='kuwait_university'),'Cached KU-only feed hides nullable other places');
    await login(A);
    await reject(insert(A,null,'Unclassified parking'),'PLACE_REQUIRED');
    await reject(insert(A,'paaet','​ ​'),'PLACE_LOCATION_REQUIRED');
    await reject(insert(A,'gust','x'.repeat(501)),'PLACE_LOCATION_TOO_LONG');
    await reject(insert(A,'gust','Clear location',true),'PLACE_UNEXPECTED_KU_FIELDS');
    await reject(insert(A,'kuwait_university',null,false),'PLACE_INVALID_KU_LOCATION');
    await reject(insert(A,'missing_place','Clear location'),'PLACE_UNAVAILABLE');
    for (const place of ['kuwait_university','paaet','gust']) {
      const rows = (await db.query("select place_id from public.parking_posts where place_id=$1 and status='active' and expires_at>now()",[place])).rows;
      check(rows.length > 0 && rows.every(r=>r.place_id===place),'Scoped discovery '+place);
    }
    await db.exec('reset role');
    await db.exec("insert into public.places(id,name_ar,name_en,place_type) values('test_future','Disposable test destination','Disposable test destination','test');");
    await login(C);
    check((await insert(C,'test_future','A useful descriptive location')).rows[0].place_id === 'test_future','Future place works without enum change');
    const spoof = insert(A,'gust','Useful but wrong author');
    await reject(spoof,'Authentication required');
    await db.exec('reset role');
    await db.exec("update public.places set active=false where id='test_future'");
    await login(C);
    await reject(insert(C,'test_future','Useful location'),'PLACE_UNAVAILABLE');
    check((await db.query("select count(*)::int n from public.places where id='test_future'")).rows[0].n===0,'Inactive place hidden');
    const bPost = (await insert(C,'gust','Different owner clear location')).rows[0].id;
    await login(B);
    await db.query("insert into public.content_reports(reporter_id,target_type,target_id,reason) values($1,'post',$2,'spam')",[B,bPost]);
    check(true,'Reporting new-place post');
    await login(C);
    check((await db.query('select count(*)::int n from public.content_reports')).rows[0].n===0,'Report privacy preserved');
    await login(B);
    await db.query('insert into public.user_blocks(blocker_id,blocked_id) values($1,$2)',[B,C]);
    check((await db.query('select id from public.parking_posts where id=$1',[bPost])).rows.length===0,'Blocked new-place feed hidden');
    await db.exec("select set_config('request.headers','',false)");
    check((await db.query('select id from public.parking_posts where id=$1',[bPost])).rows.length===0,'Realtime context retains block enforcement');
    await login(B);
    await db.query('delete from public.user_blocks where blocker_id=$1 and blocked_id=$2',[B,C]);
    check((await db.query('select id from public.parking_posts where id=$1',[bPost])).rows.length===1,'Unblock restores post');
    await db.exec('reset role');
    check((await db.query("select relrowsecurity from pg_class where oid='public.places'::regclass")).rows[0].relrowsecurity,'Places RLS enabled');
    check((await db.query("select count(*)::int n from pg_trigger where tgrelid='public.parking_posts'::regclass and tgname in ('place_post_guard','safety_post_guard')")).rows[0].n===2,'Safety trigger preserved');
    console.log(JSON.stringify({status:'PASS',assertions,engine:'Disposable PGlite PostgreSQL; full validated staging bootstrap'}));
  } finally { await db.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
