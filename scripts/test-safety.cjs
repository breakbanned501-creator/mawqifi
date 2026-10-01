// Run with: node scripts/test-safety.cjs <path-to-pglite-package>
// Disposable database only. Never connects to production or uses real users.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite');
const root = path.resolve(__dirname, '..');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const post = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const chat = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const message = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

async function main() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create table public.users(id uuid primary key, username text);
    create table public.parking_posts(id uuid primary key default gen_random_uuid(),user_id uuid references public.users,car_desc text,status text default 'active',expires_at timestamptz default now()+interval '1 hour',created_at timestamptz default now());
    create table public.conversations(id uuid primary key default gen_random_uuid(),post_id uuid references public.parking_posts,owner_id uuid references public.users,requester_id uuid references public.users,closed boolean default false);
    create table public.messages(id uuid primary key default gen_random_uuid(),conversation_id uuid references public.conversations,sender_id uuid references public.users,type text,text text,image_url text,latitude float8,longitude float8,created_at timestamptz default now());
    create table public.app_notifications(id uuid primary key default gen_random_uuid(), user_id uuid, actor_id uuid);
    alter table public.app_notifications enable row level security;
    create policy notifications_own on public.app_notifications for select to authenticated using(user_id=auth.uid());
    alter table public.parking_posts enable row level security;
    create policy posts_read on public.parking_posts for select to authenticated using(true);
    create policy posts_insert on public.parking_posts for insert to authenticated with check(user_id=auth.uid());
    alter table public.conversations enable row level security;
    create policy conv_read on public.conversations for select to authenticated using(auth.uid() in (owner_id,requester_id));
    create policy conv_insert on public.conversations for insert to authenticated with check(requester_id=auth.uid());
    create policy conv_update on public.conversations for update to authenticated using(auth.uid() in (owner_id,requester_id)) with check(auth.uid() in (owner_id,requester_id));
    alter table public.messages enable row level security;
    create policy msg_read on public.messages for select to authenticated using(exists(select 1 from public.conversations c where c.id=conversation_id));
    create policy msg_insert on public.messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.conversations c where c.id=conversation_id));
    grant usage on schema public to authenticated,service_role;
    grant select,insert,update,delete on all tables in schema public to authenticated;
    insert into public.users values ('${A}','طالب'),('${B}','Student'),('${C}','Other');
    insert into public.parking_posts(id,user_id) values('${post}','${A}');
    insert into public.conversations values('${chat}','${post}','${A}','${B}',false);
    insert into public.messages(id,conversation_id,sender_id,type,text) values('${message}','${chat}','${A}','text','مرحبا Hello');
  `);
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261001031918_app_store_safety.sql'),'utf8'));
  let tests = 0;
  const asUser = async id => db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`);
  const reject = async (sql, marker) => {
    let failure;
    try { await db.exec(sql); }
    catch (error) { failure = error; }
    assert.ok(failure, 'Expected database rejection');
    if (marker) assert.match(failure.message,new RegExp(marker));
    tests++;
  };
  const count = async (sql,n) => { const {rows} = await db.query(sql); assert.equal(Number(rows[0].count),n); tests++; };
  await asUser(B);
  for (const [type,id] of [['post',post],['message',message],['user',A]]) {
    await db.exec(`insert into public.content_reports(reporter_id,target_type,target_id,reason) values('${B}','${type}','${id}','abuse')`); tests++;
  }
  await reject(`insert into public.content_reports(reporter_id,target_type,target_id,reason) values('${B}','post','${post}','spam')`,'Duplicate');
  await reject(`insert into public.content_reports(reporter_id,target_type,target_id,reason) values('${A}','user','${C}','spam')`,'Authentication');
  await reject(`update public.content_reports set status='resolved'`,'permission denied');
  await asUser(A); await count('select count(*) from public.content_reports',0);
  await asUser(C); await reject(`insert into public.content_reports(reporter_id,target_type,target_id,reason) values('${C}','message','${message}','abuse')`,'Invalid report target');
  await asUser(B);
  await reject(`update public.conversations set owner_id='${C}' where id='${chat}'`,'immutable');
  await db.exec(`insert into public.user_blocks(blocker_id,blocked_id) values('${B}','${A}')`); tests++;
  await count(`select count(*) from public.parking_posts where id='${post}'`,1); // Preserve conversation history.
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${A}',false); insert into public.parking_posts(user_id) values('${A}'); insert into public.app_notifications(user_id,actor_id) values('${B}','${A}'); select set_config('request.jwt.claim.sub','${B}',false); set role authenticated;`);
  await count('select count(*) from public.parking_posts',1); // Unrelated blocked content is hidden.
  await count('select count(*) from public.app_notifications',0);
  assert.equal((await db.query(`select public.is_user_blocked('${A}') as blocked`)).rows[0].blocked,true); tests++;
  await reject('select * from mawqifi_safety.post_submission_times','permission denied');
  await reject(`insert into public.messages(conversation_id,sender_id,type,text) values('${chat}','${B}','text','hello')`,'SAFETY_BLOCKED');
  await asUser(A);
  await count('select count(*) from public.user_blocks',0);
  await reject(`insert into public.messages(conversation_id,sender_id,type,text) values('${chat}','${A}','text','hello')`,'SAFETY_BLOCKED');
  await reject(`insert into public.conversations(post_id,owner_id,requester_id) values('${post}','${B}','${A}')`,'Invalid post');
  await asUser(B);
  await reject(`insert into public.conversations(post_id,owner_id,requester_id) values('${post}','${A}','${B}')`,'SAFETY_BLOCKED');
  await reject(`insert into public.user_blocks(blocker_id,blocked_id) values('${A}','${C}')`,'Authentication');
  await reject(`insert into public.user_blocks(blocker_id,blocked_id) values('${B}','${B}')`,'check constraint');
  await db.exec(`delete from public.user_blocks where blocked_id='${A}'`); tests++;
  await db.exec(`insert into public.messages(conversation_id,sender_id,type,text) values('${chat}','${B}','text','هلا وصلت عند الموقف https://example.com')`); tests++;
  await reject(`insert into public.messages(conversation_id,sender_id,type,text) values('${chat}','${B}','text','هلا وصلت عند الموقف https://example.com')`,'SAFETY_DUPLICATE');
  await reject(`insert into public.messages(conversation_id,sender_id,type,text) values('${chat}','${B}','text','   ')`,'SAFETY_INVALID_TEXT');
  await reject(`insert into public.messages(conversation_id,sender_id,type,text) values('${chat}','${B}','text',repeat('a',2001))`,'SAFETY_INVALID_TEXT');
  await reject(`insert into public.messages(conversation_id,sender_id,type,text) values('${chat}','${B}','text',repeat('a',40))`,'SAFETY_INVALID_TEXT');
  for(let i=0;i<19;i++) await db.exec(`insert into public.messages(conversation_id,sender_id,type,text) values('${chat}','${B}','text','unique ${i}')`);
  await reject(`insert into public.messages(conversation_id,sender_id,type,text) values('${chat}','${B}','text','rate limited')`,'SAFETY_RATE_LIMIT');
  await db.exec(`reset role; insert into public.account_restrictions(user_id,reason) values('${B}','test restriction'); set role authenticated;`);
  await reject(`insert into public.parking_posts(user_id) values('${B}')`,'SAFETY_RESTRICTED');
  await reject(`insert into public.messages(conversation_id,sender_id,type,text) values('${chat}','${B}','text','restricted')`,'SAFETY_RESTRICTED');
  await reject('select * from public.account_restrictions','permission denied');
  await db.exec('reset role; delete from public.account_restrictions; set role authenticated;');
  await db.exec(`insert into public.content_reports(reporter_id,target_type,target_id,reason) values('${B}','user','${C}','spam'); insert into public.content_reports(reporter_id,target_type,target_id,reason) select '${B}','message',id,'spam' from public.messages where sender_id='${A}' and id<>'${message}' limit 1;`);
  // Separate user targets/post targets reach the five-report limit without duplicate targets.
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${A}',false); insert into public.parking_posts(id,user_id) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','${A}'); select set_config('request.jwt.claim.sub','${B}',false); set role authenticated;`);
  await db.exec(`insert into public.content_reports(reporter_id,target_type,target_id,reason) values('${B}','post','dddddddd-dddd-4ddd-8ddd-dddddddddddd','spam')`);
  await reject(`insert into public.content_reports(reporter_id,target_type,target_id,reason) select '${B}','message',id,'spam' from public.messages where sender_id='${B}' limit 1`,'SAFETY_RATE_LIMIT');
  await asUser(C);
  for(let i=0;i<5;i++) { await db.exec(`insert into public.parking_posts(user_id) values('${C}'); delete from public.parking_posts where user_id='${C}';`); }
  await reject(`insert into public.parking_posts(user_id) values('${C}')`,'SAFETY_RATE_LIMIT');
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false); set role anon;`);
  await reject('select * from public.content_reports','permission denied');
  await reject('select * from public.user_blocks','permission denied');
  await db.close();
  console.log(`Safety database checks passed (${tests} assertions). Anonymous UUIDs use the authenticated role.`);
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
