// Run only against dedicated staging, with its public anon key. No push calls.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),Module=require('module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.join(root,name.slice(2)):name,...args);};
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const url='https://jrmiwmsgnztqwbigumlw.supabase.co',key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
for(const value of Object.values(process.env))assert(!value.includes(['opsy','vdsivxoqphkfdsbb'].join('')));
assert(key&&!key.startsWith('sb_secret_'));if(key.startsWith('eyJ')){const c=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));assert(c.ref==='jrmiwmsgnztqwbigumlw'&&c.role==='anon');}
process.env.NEXT_PUBLIC_SUPABASE_URL=url;
const {createClient}=require('@supabase/supabase-js'),scopes=require('../lib/sub-places.ts'),supabase=require('../lib/supabase.ts');let current;supabase.getSupabase=()=>current;
const {fetchParkingPosts}=require('../lib/posts.ts');
const context=process.argv[2];assert(path.isAbsolute(context));const ctx={project:'jrmiwmsgnztqwbigumlw',users:[],posts:[]};
const save=()=>fs.writeFileSync(context,JSON.stringify(ctx));let assertions=0;const check=(name,ok)=>{assert(ok,name);assertions++;console.log('PASS '+name);};
const data=async q=>{const r=await q;if(r.error)throw Error(r.error.message);return r.data;};
(async()=>{
 const clients=[];for(let i=0;i<3;i++){const c=createClient(url,key,{global:{headers:{'x-mawqifi-place-aware':'1'}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});clients.push(c);const r=await data(c.auth.signInAnonymously());ctx.users.push(r.user.id);save();await data(c.from('users').upsert({id:r.user.id,is_guest:true,username:'Compact scope staging test'},{onConflict:'id'}));}
 check('Three real anonymous sessions and profiles',ctx.users.length===3);
 const newScopes=scopes.paaetSubPlaces.filter(p=>!['basic_education_ardiya','basic_education_jahra','nursing_shuwaikh'].includes(p.id));
 for(let i=0;i<newScopes.length;i++){
  const owner=clients[Math.floor(i/4)],observer=clients[(Math.floor(i/4)+1)%3],scope=newScopes[i].id;
  const id=await data(owner.rpc('publish_parking_handoff',{payload:{place_id:'paaet',sub_place_id:scope,departure_minutes:10},latitude:29.3,longitude:47.9,accuracy_meters:5}));ctx.posts.push(id);save();
  const post=await data(owner.from('parking_posts').select('id,sub_place_id,college,zone,gate').eq('id',id).single());check('GPS scope persists '+scope,post.sub_place_id===scope&&post.college===null&&post.zone===null&&post.gate===null);
  current=observer;const feed=await fetchParkingPosts('paaet',scope);check('App discovers only selected scope '+scope,feed.some(p=>p.id===id)&&feed.every(p=>p.place_id==='paaet'&&p.sub_place_id===scope));
  check('Coordinates remain private '+scope,(await data(observer.from('parking_post_locations').select('post_id').eq('post_id',id))).length===0);
 }
 current=clients[0];check('No branch means zero posts',(await fetchParkingPosts('paaet',null)).length===0);
 const rejected=await clients[0].rpc('publish_parking_handoff',{payload:{place_id:'kuwait_university',sub_place_id:newScopes[0].id,departure_minutes:10},latitude:29.3,longitude:47.9,accuracy_meters:5});check('New PAAET scope rejected for KU',rejected.error?.message.includes('parking_posts_valid_sub_place'));
 ctx.assertions=assertions;save();console.log(JSON.stringify({status:'PASS',assertions,...ctx}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
