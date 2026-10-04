// Focused disposable ownership/RLS test; no remote project or real users.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PGlite}=require(process.argv[2]),{pgcrypto}=require(path.join(process.argv[2],'dist/contrib/pgcrypto.cjs'));
const helper=require('./legacy-chat-image-cutover.cjs');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),A=id(1),B=id(2),C=id(3),CID=id(10);
let count=0;const check=(name,v)=>{assert(v,name);count++;console.log('PASS '+name);};
const read=file=>fs.readFileSync('supabase/production/'+file,'utf8');
(async()=>{const db=new PGlite({extensions:{pgcrypto}});try{
 await db.exec(read('rehearsal/platform-mocks.sql'));await db.exec(read('rehearsal/observed-schema.sql'));
 for(const u of [A,B,C])await db.query('insert into auth.users(id) values($1)',[u]);
 await db.query("insert into public.parking_posts(id,user_id,college,zone,gate,departure_minutes,expires_at) values($1,$2,'كلية التربية','A','Gate 5',60,now()+interval '1 hour')",[id(11),A]);
 await db.query('insert into public.conversations(id,post_id,owner_id,requester_id) values($1,$2,$3,$4)',[CID,id(11),A,B]);
 for(let i=1;i<=4;i++){
  const owner=i===4?B:A,p='chat/'+CID+'/'+id(20+i)+'.png';
  await db.query("insert into storage.objects(id,bucket_id,name,owner_id,metadata) values($1,'chat-images',$2,$3,'{\"mimetype\":\"image/png\"}')",[id(40+i),p,owner]);
  await db.query("insert into public.messages(id,conversation_id,sender_id,type,image_url) values($1,$2,$3,'image',$4)",[id(20+i),CID,owner,'https://opsyvdsivxoqphkfdsbb.supabase.co/storage/v1/object/public/chat-images/'+p]);
 }
 for(const file of JSON.parse(read('rehearsal/migration-order.json')))await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 await db.exec(read('free_plan_chat_image_ownership.sql'));
 const old=(await db.query('select * from public.messages order by id')).rows;
 const inventory=(await db.query('select public.legacy_chat_image_inventory() s')).rows[0].s;
 const objects=new Map(inventory.map(e=>[e.old_path,Buffer.from('synthetic '+e.message_id)])),backups=new Map();let copied=0,removed=[],commits=0;
 const admin={storage:{getBucket:async()=>({data:{public:false}}),from:()=>({
  download:async p=>objects.has(p)?{data:new Blob([objects.get(p)])}:{error:{statusCode:400,message:'Object not found'}},
  copy:async(src,dst)=>{assert(!objects.has(dst));objects.set(dst,objects.get(src));copied++;
   await db.query("insert into storage.objects(bucket_id,name,metadata) values('chat-images',$1,'{\"mimetype\":\"image/png\"}')",[dst]);return{};},
  remove:async names=>{removed.push(...names);for(const n of names){objects.delete(n);await db.query('delete from storage.objects where name=$1',[n]);}return{};}
 })},rpc:async(name,args)=>{await db.exec('reset role');try{const r=await db.query('select public.'+name+(args?'($1)':'()')+' s',args?[args.manifest]:[]);if(name==='commit_legacy_chat_image_copies')commits++;return{data:r.rows[0].s};}catch(e){return{error:e};}}};
 const login=async(user,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec('set role '+role);};
 const client=(user,role='authenticated')=>({auth:{getUser:async()=>({data:{user:{id:user}}})},storage:{from:()=>({download:async p=>{
  await login(user,role);const allowed=(await db.query('select name from storage.objects where name=$1',[p])).rows.length;
  return allowed&&objects.has(p)?{data:new Blob([objects.get(p)])}:{error:{statusCode:403,message:'denied'}};
 }})}});
 const clients={participants:{[A]:client(A),[B]:client(B)},unrelated:client(C),anonymous:client(null,'anon')};
 const manifest=await helper.prepare(admin,async(n,bytes)=>backups.set(n,bytes));
 check('Four private backups hashed',backups.size===4&&manifest.entries.every(e=>e.sha256===helper.hash(backups.get(e.backup_file))));
 await helper.copy(admin,manifest,async n=>backups.get(n));await helper.copy(admin,manifest,async n=>backups.get(n));
 check('Random paths copied once; retry never overwrites',copied===4&&new Set(manifest.entries.map(e=>e.new_path)).size===4);
 await helper.verifyAccess(admin,manifest,clients);check('Two participants read; unrelated and anonymous denied',true);
 await db.exec('reset role');const bad=structuredClone(manifest.entries);bad[3].owner_id=A;
 try{await db.query('select public.commit_legacy_chat_image_copies($1)',[bad]);assert.fail('Spoof allowed');}catch(e){check('Spoofed ownership aborts entire transaction',/IMAGE_MESSAGE_CHANGED/.test(e.message));}
 check('Failed batch leaves zero mappings',(await db.query('select * from mawqifi_safety.legacy_chat_image_copies')).rows.length===0);
 await helper.commit(admin,manifest,clients);await helper.commit(admin,manifest,clients);
 await db.exec('reset role');const rows=(await db.query('select * from public.messages order by id')).rows;
 check('IDs/senders/timestamps/history unchanged',rows.every((r,i)=>Object.keys(old[i]).filter(k=>k!=='image_url').every(k=>JSON.stringify(r[k])===JSON.stringify(old[i][k]))));
 check('Only image references changed to authenticated paths',rows.every(r=>r.image_url.includes('/object/authenticated/')));
 check('Service copies remain NULL-owned in managed Storage',(await db.query("select owner_id from storage.objects where name=any($1)",[manifest.entries.map(e=>e.new_path)])).rows.every(o=>o.owner_id===null));
 check('Private mapping preserves three A/one B original owners',(await db.query('select * from mawqifi_safety.legacy_chat_image_copies where owner_id=$1',[A])).rows.length===3);
 await login(C);for(const query of ['select * from mawqifi_safety.legacy_chat_image_copies','select public.legacy_chat_image_inventory()',"select public.commit_legacy_chat_image_copies('[]')"]){try{await db.query(query);assert.fail('Client access allowed');}catch(e){check('Client cannot access/change ownership mapping',/permission denied/.test(e.message));}}
 await helper.deleteOld(admin,manifest,clients);check('Delete originals only after verified committed references',removed.length===4&&removed.every(n=>manifest.entries.some(e=>e.old_path===n))&&commits===2);
 check('No private copy deleted',manifest.entries.every(e=>objects.has(e.new_path)));
 await login(A);const cleanup=(await db.query('select public.begin_account_deletion() s')).rows[0].s.objects;
 check('Deletion includes mapped NULL-owned copies',cleanup.length===3&&cleanup.every(e=>manifest.entries.some(x=>x.new_path===e.name&&x.owner_id===A)));
 check('Peer-owned mapped image excluded',!cleanup.some(e=>e.name===manifest.entries[3].new_path));
 check('Deleted JWT identity cannot read private images',(await db.query('select * from storage.objects')).rows.length===0);
 await login(B);check('Peer image and redacted history retained',(await db.query('select * from public.messages')).rows.length===4&&(await db.query('select * from storage.objects')).rows.length===1);
 const drift=structuredClone(manifest);drift.entries[0].new_path=drift.entries[0].old_path;assert.throws(()=>helper.validate(drift));check('Original path reuse rejected',true);
 console.log('Focused Free-plan ownership/helper/RLS assertions: '+count);
}finally{await db.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
