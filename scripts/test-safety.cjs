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

async function createTestDatabase(beforeMigration) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, is_anonymous boolean not null default true);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create table public.users(id uuid primary key references auth.users, username text);
    create table public.parking_posts(id uuid primary key default gen_random_uuid(),user_id uuid references public.users,car_desc text,status text default 'active',expires_at timestamptz default now()+interval '1 hour',created_at timestamptz default now(),updated_at timestamptz default now());
    create table public.conversations(id uuid primary key default gen_random_uuid(),post_id uuid references public.parking_posts,owner_id uuid references public.users,requester_id uuid references public.users,closed boolean default false,last_message_text text,last_message_at timestamptz,updated_at timestamptz default now(),owner_last_read_at timestamptz default now());
    create table public.messages(id uuid primary key default gen_random_uuid(),conversation_id uuid references public.conversations,sender_id uuid references public.users,type text,text text,image_url text,latitude float8,longitude float8,created_at timestamptz default now());
    create table public.app_notifications(id uuid primary key default gen_random_uuid(), user_id uuid, actor_id uuid);
    alter table public.app_notifications enable row level security;
    create policy notifications_own on public.app_notifications for select to authenticated using(user_id=auth.uid());
    alter table public.parking_posts enable row level security;
    create policy posts_read on public.parking_posts for select to authenticated using(true);
    create policy posts_insert on public.parking_posts for insert to authenticated with check(user_id=auth.uid());
    create policy posts_update on public.parking_posts for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    alter table public.conversations enable row level security;
    create policy conv_read on public.conversations for select to authenticated using(auth.uid() in (owner_id,requester_id));
    create policy conv_insert on public.conversations for insert to authenticated with check(requester_id=auth.uid());
    create policy conv_update on public.conversations for update to authenticated using(auth.uid() in (owner_id,requester_id)) with check(auth.uid() in (owner_id,requester_id));
    alter table public.messages enable row level security;
    create policy msg_read on public.messages for select to authenticated using(exists(select 1 from public.conversations c where c.id=conversation_id));
    create policy msg_insert on public.messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.conversations c where c.id=conversation_id and not c.closed));
    grant usage on schema public to authenticated,service_role;
    grant select,insert,update,delete on all tables in schema public to authenticated;
    insert into auth.users(id) values('${A}'),('${B}'),('${C}');
    insert into public.users values ('${A}','طالب'),('${B}','Student'),('${C}','Other');
    insert into public.parking_posts(id,user_id) values('${post}','${A}');
    insert into public.conversations(id,post_id,owner_id,requester_id,closed) values('${chat}','${post}','${A}','${B}',false);
    insert into public.messages(id,conversation_id,sender_id,type,text) values('${message}','${chat}','${A}','text','مرحبا Hello');
  `);
  // Use the repository's actual expiry/preview functions rather than no-op mocks.
  const schema = fs.readFileSync(path.join(root,'supabase/schema.sql'),'utf8');
  for (const name of ['set_updated_at','expire_old_parking_posts','on_message_insert']) {
    const definition = schema.match(new RegExp(`create or replace function public\\.${name}\\(\\)[\\s\\S]*?\\$\\$;`, 'i'));
    assert.ok(definition, `Missing schema function ${name}`);
    await db.exec(definition[0]);
  }
  await db.exec(`create trigger parking_posts_updated_at before update on public.parking_posts for each row execute function public.set_updated_at(); create trigger conversations_updated_at before update on public.conversations for each row execute function public.set_updated_at(); create trigger messages_after_insert after insert on public.messages for each row execute function public.on_message_insert();`);
  if (beforeMigration) await beforeMigration(db);
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261001031918_app_store_safety.sql'),'utf8'));
  return db;
}

async function main() {
  const db = await createTestDatabase();
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
  const compatibility = await compatibilityChecks();
  const databaseTests = tests + compatibility.databaseTests;
  console.log(`Safety checks passed (${databaseTests} SQL/RLS + ${compatibility.helperTests} helper assertions). Anonymous UUIDs use the authenticated role.`);
}
async function compatibilityChecks() {
  const legacy = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const db = await createTestDatabase(db => db.exec(`insert into public.parking_posts(id,user_id,car_desc,expires_at) values('${legacy}','${C}',repeat('n',500),now()-interval '1 hour');`));
  let tests = 0;
  const asUser = id => db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`);
  const ok = async sql => { await db.exec(sql); tests++; };
  const bad = async (sql, marker) => {
    let failure;
    try { await db.exec(sql); } catch(error) { failure=error; }
    assert.ok(failure,'Expected database rejection'); assert.match(failure.message,new RegExp(marker)); tests++;
  };
  const check = async (sql, expected) => { const {rows}=await db.query(sql); assert.equal(rows[0].value,expected); tests++; };
  await asUser(A);
  for (const length of [200,201,500]) {
    await ok(`insert into public.parking_posts(user_id,car_desc) values('${A}',repeat('n',${length}));`);
    await ok(`update public.parking_posts set car_desc=repeat('n',${length}) where id='${post}';`);
    await check(`select length(car_desc) as value from public.parking_posts where id='${post}'`,length);
  }
  await bad(`insert into public.parking_posts(user_id,car_desc) values('${A}',repeat('n',501))`,'SAFETY_INVALID_TEXT');
  await bad(`update public.parking_posts set car_desc=repeat('n',501) where id='${post}'`,'SAFETY_INVALID_TEXT');
  await check(`select length(car_desc) as value from public.parking_posts where id='${post}'`,500);
  await check(`select count(*)::int as value from public.parking_posts where user_id='${A}'`,4);
  await asUser(B);
  await ok('select public.expire_old_parking_posts()');
  await check(`select status as value from public.parking_posts where id='${legacy}'`,'expired');
  await check(`select length(car_desc) as value from public.parking_posts where id='${legacy}'`,500);
  await ok(`update public.conversations set owner_last_read_at=now() where id='${chat}'`);
  await check(`select count(*)::int as value from auth.users where is_anonymous`,3).catch(async error => {
    // Auth schema is intentionally not exposed to the client; verify as admin.
    if (!error.message.includes('permission denied')) throw error;
    await db.exec('reset role'); await check(`select count(*)::int as value from auth.users where is_anonymous`,3); await asUser(B);
  });
  // No main UI maxLength: preserve the former boundary and values beyond it.
  for (const length of [1999,2000,2001,10000]) {
    await ok(`insert into public.messages(conversation_id,sender_id,type,text) values('${chat}','${B}','text',left(repeat('ab',${length}),${length}));`);
    await check(`select length(last_message_text) as value from public.conversations where id='${chat}'`,length);
  }
  await ok(`insert into public.messages(conversation_id,sender_id,type,image_url) values('${chat}','${B}','image','https://example.com/photo.jpg')`);
  await ok(`insert into public.messages(conversation_id,sender_id,type,latitude,longitude) values('${chat}','${B}','location',29.3,47.9)`);
  await bad(`insert into public.messages(conversation_id,sender_id,type,text) values('${chat}','${B}','text',U&'\\200B')`,'SAFETY_INVALID_TEXT');
  await asUser(C);
  await ok(`insert into public.conversations(post_id,owner_id,requester_id) values('${post}','${A}','${C}')`);
  const gracePosts=[];
  for (const [status,age] of [['active',10],['expired',10],['expired',31],['closed',-60]]) {
    const {rows}=await db.query(`insert into public.parking_posts(user_id,status,expires_at) values('${C}','${status}',clock_timestamp()-interval '${age} seconds') returning id`);
    gracePosts.push(rows[0].id);
  }
  await asUser(B);
  for(const id of gracePosts.slice(0,2)) await ok(`insert into public.conversations(post_id,owner_id,requester_id) values('${id}','${C}','${B}')`);
  for(const id of [...gracePosts.slice(2),legacy]) await bad(`insert into public.conversations(post_id,owner_id,requester_id) values('${id}','${C}','${B}')`,'SAFETY_POST_EXPIRED');
  await asUser(A);
  await ok(`insert into public.user_blocks(blocker_id,blocked_id) values('${A}','${B}')`);
  await bad(`insert into public.messages(conversation_id,sender_id,type,text) values('${chat}','${A}','text','blocked A')`,'SAFETY_BLOCKED');
  await asUser(B);
  await bad(`insert into public.messages(conversation_id,sender_id,type,text) values('${chat}','${B}','text','blocked B')`,'SAFETY_BLOCKED');
  await check(`select count(*)>0 as value from public.messages where conversation_id='${chat}'`,true);
  await bad(`insert into public.conversations(post_id,owner_id,requester_id) values('${post}','${A}','${B}')`,'SAFETY_BLOCKED');
  await asUser(A);
  await ok(`delete from public.user_blocks where blocked_id='${B}'`);
  await ok(`insert into public.messages(conversation_id,sender_id,type,text) values('${chat}','${A}','text','unblocked مرحبا')`);
  // Reverse twice: no moderation data is lost and original grants return.
  await asUser(B);
  await ok(`insert into public.content_reports(reporter_id,target_type,target_id,reason) values('${B}','user','${A}','abuse')`);
  await db.exec(`reset role; insert into public.account_restrictions(user_id,reason) values('${A}','preserve'); select set_config('request.jwt.claim.sub','${A}',false); set role authenticated; insert into public.user_blocks(blocker_id,blocked_id) values('${A}','${B}'); reset role;`);
  const reverse=fs.readFileSync(path.join(root,'supabase/rollback/20261001031918_app_store_safety.sql'),'utf8');
  await ok(reverse); await ok(reverse);
  for(const table of ['content_reports','user_blocks','account_restrictions']) await check(`select count(*)::int as value from public.${table}`,1);
  await check("select has_table_privilege('authenticated','public.messages','UPDATE') as value",true);
  await check("select has_table_privilege('anon','public.messages','DELETE') as value",true);
  await asUser(B);
  await ok(`insert into public.messages(conversation_id,sender_id,type,text) values('${chat}','${B}','text','rollback restores sending')`);
  await check('select count(*)::int as value from public.content_reports',1);
  await asUser(A); await check('select count(*)::int as value from public.content_reports',0);
  await bad("update public.content_reports set status='resolved'",'permission denied');
  await db.close();
  const databaseTests=tests;
  // Exercise the same pure relationship helper used by the push server.
  const ts=require('typescript');
  const load = file => {
    const output=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
    const exports={}; new Function('require','exports',output)(()=>({}),exports); return exports;
  };
  const {blockedRecipientIds}=load('lib/push-safety.ts');
  assert.equal(blockedRecipientIds(A,[]).size,0); tests++;
  assert.equal(blockedRecipientIds(A,[{blocker_id:A,blocked_id:B}]).has(B),true); tests++;
  assert.equal(blockedRecipientIds(A,[{blocker_id:B,blocked_id:A}]).has(B),true); tests++;
  assert.equal(blockedRecipientIds(A,[{blocker_id:B,blocked_id:C}]).has(C),false); tests++;
  const {validateMessageText,safetyErrorKey,canStartConversation}=load('lib/safety.ts');
  for(const length of [1999,2000,2001,10000]) { validateMessageText('ab'.repeat(length).slice(0,length)); tests++; }
  for(const [marker,key] of [['SAFETY_RATE_LIMIT','safety.rateLimited'],['SAFETY_DUPLICATE','safety.duplicate'],['SAFETY_POST_EXPIRED','safety.postExpired']]) { assert.equal(safetyErrorKey({message:marker}),key); tests++; }
  const now=Date.now();
  for(const [status,age,expected] of [['active',-1000,true],['expired',29999,true],['expired',30000,false],['expired',31000,false],['closed',-1000,false]]) {
    assert.equal(canStartConversation({status,expires_at:new Date(now-age).toISOString()},now),expected); tests++;
  }
  return {databaseTests,helperTests:tests-databaseTests};
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
