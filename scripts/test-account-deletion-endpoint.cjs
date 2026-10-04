const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
const production=process.argv.includes('--production');
const source=fs.readFileSync(production?'supabase/production/functions/delete-account/index.ts':'supabase/functions/delete-account/index.ts','utf8');
const approvedUrl=production?'https://opsyvdsivxoqphkfdsbb.supabase.co':'https://jrmiwmsgnztqwbigumlw.supabase.co';
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const own={bucket_id:'chat-images',name:'chat/conversation/deleting-user.png'},peer={bucket_id:'chat-images',name:'chat/conversation/peer.png'};
let count=0;const check=(name,v)=>{assert(v,name);count++;console.log('PASS '+name);};
async function setup({authFailure=false,purgeFailure=false,storageFailure=false,scopeFailure=false,staging=true,probeStatus=403}={}){
 let handler;const removed=[],requests=[],delays=[],authDeletes=[],rpcCalls=[];
 const createClient=(url,key,options)=>({
  auth:{getUser:async token=>{check('Actual bearer passed to Auth verifier',token==='real-session-token');return authFailure?{data:{user:null},error:{}}:{data:{user:{id:'verified-self'}},error:null};},admin:{signOut:async()=>({error:null}),deleteUser:async uid=>{authDeletes.push(uid);return{error:null};}}},
  rpc:async(name,args)=>{rpcCalls.push({name,args,key});if(name==='begin_account_deletion'){check('DB cleanup uses caller public client',key==='public-fixture'&&options.global.headers.Authorization==='Bearer real-session-token');return{data:{objects:[own]},error:null};}
   check('Cache probes use server role only',key==='server-fixture'&&args.account_id==='verified-self');return scopeFailure?{data:null,error:{}}:{data:[own,peer],error:null};},
  storage:{from:bucket=>({remove:async names=>{removed.push({bucket,names});return{error:storageFailure?{}:null};}})},
 });
 const env={SUPABASE_URL:staging?approvedUrl:'https://unapproved.example',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'server-fixture'};
 new Function('require','exports','Deno','fetch','setTimeout',code)(()=>({createClient}),{}, {env:{get:key=>env[key]},serve:h=>{handler=h;}},async(url,options)=>{requests.push({url,method:options.method??'GET',options});return new Response(probeStatus===400?JSON.stringify({code:'NoSuchKey'}):null,{status:options.method==='DELETE'?(purgeFailure?403:200):probeStatus});},(fn,ms)=>{delays.push(ms);fn();});
 const invoke=(body={},bearer=true,origin='capacitor://localhost')=>handler(new Request('https://staging.example/delete-account',{method:'POST',headers:{'Content-Type':'application/json',...(bearer?{Authorization:'Bearer real-session-token'}:{}),Origin:origin},body:JSON.stringify(body)}));
 return{invoke,removed,requests,delays,authDeletes,rpcCalls};
}
(async()=>{
 let test=await setup();const response=await test.invoke();check('Self deletion succeeds',response.status===200);
 check('Only owned objects are deleted',test.removed.length===1&&test.removed[0].names.length===1&&test.removed[0].names[0]===own.name);
 check('Peer image NEVER deleted',!test.removed.some(r=>r.names.includes(peer.name)));
 check('No paid purge calls',!test.requests.some(r=>r.url.includes('/cdn/')||r.method==='DELETE'));
 check('Revocation probes do not alter peer content',test.requests.filter(r=>r.method==='GET').length===2);
 check('Fresh denied probes precede Auth deletion without paid wait',test.delays.length===0&&test.authDeletes[0]==='verified-self'&&test.requests.every(r=>r.url.includes('?cacheNonce=')&&r.options.cache==='no-store'));
 check('Native exact CORS',response.headers.get('access-control-allow-origin')==='capacitor://localhost');
 check('SDK place-aware header permitted by exact-origin CORS',response.headers.get('access-control-allow-headers').includes('x-mawqifi-place-aware'));
 test=await setup({purgeFailure:true});check('Free plan unavailable purge does not block deletion',(await test.invoke()).status===200&&test.authDeletes.length===1&&!test.requests.some(r=>r.url.includes('/cdn/')));
 for(const probeStatus of [200,500,429]){test=await setup({probeStatus});check('Unsafe/unverified access keeps Auth retryable '+probeStatus,(await test.invoke()).status===503&&test.authDeletes.length===0);}
 test=await setup({probeStatus:400});check('Storage NoSuchKey denial accepted',(await test.invoke()).status===200);
 test=await setup({scopeFailure:true});check('Missing trusted probe scope stops deletion',(await test.invoke()).status===503&&test.authDeletes.length===0);
 test=await setup({storageFailure:true});check('Storage failure is retryable, Auth retained',(await test.invoke()).status===503&&test.authDeletes.length===0);
 test=await setup({authFailure:true});check('Deleted/invalid token denied',(await test.invoke()).status===401&&test.rpcCalls.length===0);
 test=await setup();check('Spoofed target denied',(await test.invoke({user_id:'peer'})).status===400&&test.rpcCalls.length===0);
 check('No authorization denied',(await test.invoke({},false)).status===401);
 check('Unapproved origin denied',(await test.invoke({},true,'https://evil.example')).status===403);
 test=await setup({staging:false});check('Unapproved project configuration denied',(await test.invoke()).status===503&&test.rpcCalls.length===0);
 test=await setup();check('Approved web origin permitted',(await test.invoke({},true,production?'https://mawqifiapp.vercel.app':'https://mawqifi-testflight-staging.vercel.app')).status===200);
 check('Other environment web origin denied',(await test.invoke({},true,production?'https://mawqifi-testflight-staging.vercel.app':'https://mawqifiapp.vercel.app')).status===403);
 if(production){
  const expected=fs.readFileSync('supabase/functions/delete-account/index.ts','utf8').replace('jrmiwmsgnztqwbigumlw','opsyvdsivxoqphkfdsbb').replace('https://mawqifi-testflight-staging.vercel.app','https://mawqifiapp.vercel.app');
  check('Production behavior identical apart from reviewed guard/origin/comments',source.slice(source.indexOf('const url'))===expected.slice(expected.indexOf('const url')));
 }
 console.log('Account deletion endpoint assertions: '+count);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
