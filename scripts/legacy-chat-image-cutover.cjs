// Offline by default. Future production use requires explicit approval + write pause.
// Never import into browser code. No JWT invention or service-role impersonation.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const REF='opsyvdsivxoqphkfdsbb',URL='https://'+REF+'.supabase.co',BUCKET='chat-images';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function validate(m){
 assert.equal(m.project_ref,REF);assert.equal(m.entries.length,4);
 for(const e of m.entries){
  for(const id of [e.message_id,e.conversation_id,e.owner_id,e.source_object_id,...e.participants])assert(uuid.test(id));
  assert.equal(e.participants.length,2);assert.equal(new Set(e.participants).size,2);assert(e.participants.includes(e.owner_id));
  assert(e.old_path.startsWith('chat/'+e.conversation_id+'/')&&e.old_path.split('/').length===3&&!/[?\x00-\x1f\\]/.test(e.old_path));
  assert(e.old_path.split('/')[2]&&!['.','..'].includes(e.old_path.split('/')[2]));
  assert.equal(e.old_reference,URL+'/storage/v1/object/public/'+BUCKET+'/'+e.old_path);
  assert(e.new_path.startsWith('chat/'+e.conversation_id+'/')&&e.new_path.split('/').length===3&&uuid.test(e.new_path.split('/')[2]?.split('.')[0])&&/^[a-f0-9-]{36}\.(png|jpg|jpeg|webp|gif)$/.test(e.new_path.split('/')[2]));
  assert.notEqual(e.old_path,e.new_path);assert(/^[a-f0-9]{64}$/.test(e.sha256));
 }
 for(const field of ['message_id','source_object_id','old_path','new_path'])assert.equal(new Set(m.entries.map(e=>e[field])).size,4);
}
async function privateBucket(admin){const {data,error}=await admin.storage.getBucket(BUCKET);assert(!error&&data?.public===false,'Bucket must already be private');}
async function rpc(admin,name,args){const {data,error}=await admin.rpc(name,args);assert(!error,'Trusted inventory/commit failed');return data;}
async function download(client,p){const {data,error}=await client.storage.from(BUCKET).download(p,{cacheNonce:crypto.randomUUID()},{cache:'no-store'});assert(!error&&data,'Authenticated download failed');return Buffer.from(await data.arrayBuffer());}
async function prepare(admin,saveBackup){
 await privateBucket(admin);const rows=await rpc(admin,'legacy_chat_image_inventory');assert.equal(rows.length,4);
 const entries=[];
 for(const [i,e] of rows.entries()){
  const bytes=await download(admin,e.old_path);
  const mime=e.metadata?.mimetype;const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[mime];assert(ext,'Review unknown image MIME');
  const backup_file=String(i+1)+'.'+ext;await saveBackup(backup_file,bytes);
  entries.push({...e,backup_file,sha256:hash(bytes),new_path:'chat/'+e.conversation_id+'/'+crypto.randomUUID()+'.'+ext});
 }
 const m={project_ref:REF,version:1,cache_ttl:'Unknown / cannot guarantee immediate revocation of previously cached copies.',entries};validate(m);return m;
}
async function copy(admin,m,readBackup){
 validate(m);await privateBucket(admin);
 for(const e of m.entries){
  assert.equal(hash(await readBackup(e.backup_file)),e.sha256,'Backup mismatch');
  const existing=await admin.storage.from(BUCKET).download(e.new_path,{cacheNonce:crypto.randomUUID()},{cache:'no-store'});
  if(existing.data){assert.equal(hash(Buffer.from(await existing.data.arrayBuffer())),e.sha256,'Existing destination mismatch');continue;}
  assert(existing.error&&[400,404].includes(Number(existing.error.statusCode))&&/not found|NoSuchKey/i.test(existing.error.message),'Destination absence not verified');
  assert.equal(hash(await download(admin,e.old_path)),e.sha256,'Source bytes changed');
  const {error}=await admin.storage.from(BUCKET).copy(e.old_path,e.new_path);assert(!error,'Copy failed; never overwrite');
  assert.equal(hash(await download(admin,e.new_path)),e.sha256,'Copied bytes mismatch');
 }
}
async function verifyAccess(admin,m,clients){
 validate(m);await privateBucket(admin);
 for(const e of m.entries){
  for(const id of e.participants){
   const client=clients.participants[id];assert(client,'Real participant session required');
   const {data,error}=await client.auth.getUser();assert(!error&&data.user?.id===id,'Wrong/expired participant session');
   assert.equal(hash(await download(client,e.new_path)),e.sha256,'Participant bytes mismatch');
  }
  const user=await clients.unrelated.auth.getUser();assert(!user.error&&user.data.user&&!e.participants.includes(user.data.user.id),'Unrelated real session required');
  for(const client of [clients.unrelated,clients.anonymous]){
   const {data,error}=await client.storage.from(BUCKET).download(e.new_path,{cacheNonce:crypto.randomUUID()},{cache:'no-store'});
   assert(!data&&error&&[400,401,403,404].includes(Number(error.statusCode)),'Unauthorized denial not verified');
  }
 }
}
async function commit(admin,m,clients){
 await verifyAccess(admin,m,clients);
 await rpc(admin,'commit_legacy_chat_image_copies',{manifest:m.entries});
}
async function deleteOld(admin,m,clients){
 await verifyAccess(admin,m,clients);
 const status=await rpc(admin,'legacy_chat_image_copy_status');assert.equal(status.length,4);
 for(const e of m.entries){
  const saved=status.find(s=>s.message_id===e.message_id);
  assert(saved&&saved.owner_id===e.owner_id&&saved.old_path===e.old_path&&saved.new_path===e.new_path&&saved.sha256===e.sha256&&saved.old_reference===e.old_reference&&saved.current_reference===URL+'/storage/v1/object/authenticated/'+BUCKET+'/'+e.new_path,'Committed mapping drift');
 }
 const {error}=await admin.storage.from(BUCKET).remove(m.entries.map(e=>e.old_path));assert(!error,'Old-object removal failed; retry safely');
 // This is fresh origin absence evidence, never a claim that every CDN cache expired.
 for(const e of m.entries){
  const result=await admin.storage.from(BUCKET).download(e.old_path,{cacheNonce:crypto.randomUUID()},{cache:'no-store'});
  assert(!result.data&&result.error&&[400,404].includes(Number(result.error.statusCode)),'Old origin object still accessible');
 }
}
module.exports={validate,prepare,copy,verifyAccess,commit,deleteOld,hash};
if(require.main===module)(async()=>{
 const phase=process.argv[2],folder=path.resolve(process.argv[3]||'.'),tokenFile=process.argv[4];
 assert(['prepare','copy','verify','commit','delete-old'].includes(phase),'Explicit phase required');
 assert.equal(process.env.MAWQIFI_IMAGE_CUTOVER_APPROVED,REF,'Separate production approval required');
 assert.equal(process.env.MAWQIFI_IMAGE_WRITES_PAUSED,'yes','Image writes/deletion must be paused');
 assert.equal(process.env.SUPABASE_URL,URL,'Exact project required');
 assert(!folder.startsWith(path.resolve(__dirname,'..')+path.sep)&&folder!==path.resolve(__dirname,'..'),'Protected backup directory must be outside repository');
 const server=process.env.SUPABASE_SERVICE_ROLE_KEY,publicKey=process.env.SUPABASE_ANON_KEY;assert(server&&publicKey,'Server/public credentials required');
 for(const [key,role] of [[server,'service_role'],[publicKey,'anon']]){
  if(key.startsWith('eyJ')){const p=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));assert.equal(p.ref,REF);assert.equal(p.role,role);}
  else assert(key.startsWith(role==='anon'?'sb_publishable_':'sb_secret_'));
 }
 const {createClient}=require('@supabase/supabase-js'),options={auth:{persistSession:false,autoRefreshToken:false}};
 const admin=createClient(URL,server,options),manifestFile=path.join(folder,'manifest.json');
 if(phase==='prepare'){
  assert(!fs.existsSync(manifestFile),'Use existing manifest; never regenerate paths on retry');fs.mkdirSync(folder,{recursive:true,mode:0o700});
  const m=await prepare(admin,async(name,bytes)=>fs.writeFileSync(path.join(folder,name),bytes,{flag:'wx',mode:0o600}));
  fs.writeFileSync(manifestFile,JSON.stringify(m,null,2)+'\n',{flag:'wx',mode:0o600});
 }else{
  const m=JSON.parse(fs.readFileSync(manifestFile,'utf8'));validate(m);
  if(phase==='copy')await copy(admin,m,async name=>{assert(/^[1-4]\.(png|jpg|jpeg|webp|gif)$/.test(name));return fs.readFileSync(path.join(folder,name));});
  else{
   assert(tokenFile,'Private real-session file required');const tokens=JSON.parse(fs.readFileSync(tokenFile,'utf8'));
   const client=token=>createClient(URL,publicKey,{...options,...(token?{global:{headers:{Authorization:'Bearer '+token}}}:{})});
   const clients={participants:Object.fromEntries(Object.entries(tokens.participants).map(([id,token])=>[id,client(token)])),unrelated:client(tokens.unrelated),anonymous:client()};assert(tokens.unrelated);
   if(phase==='verify')await verifyAccess(admin,m,clients);
   else if(phase==='commit')await commit(admin,m,clients);
   else await deleteOld(admin,m,clients);
  }
 }
 console.log('Completed '+phase+' for reviewed four-object manifest. Cached-copy expiry remains unknown.');
})().catch(()=>{console.error('Cutover stopped. Preserve private copies/backups and review configuration, identity, bytes or mapping; no automatic rollback/public fallback.');process.exitCode=1;});
