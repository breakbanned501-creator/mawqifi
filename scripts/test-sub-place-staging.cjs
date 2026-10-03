// Explicit staging only. Requires NEXT_PUBLIC_SUPABASE_ANON_KEY; never uses service_role.
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict'), Module = require('module');
const root = path.resolve(__dirname, '..');
const ts = require('typescript');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(root,request.slice(2)) : request, ...args);
};
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText,filename);
const { createClient } = require('@supabase/supabase-js');
const URL = 'https://jrmiwmsgnztqwbigumlw.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert(key && !key.startsWith('sb_secret_'));
for(const value of Object.values(process.env)) assert(!value.includes(['opsy','vdsivxoqphkfdsbb'].join('')));
if(key.startsWith('eyJ')) {
  const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());
  assert.equal(claims.ref,'jrmiwmsgnztqwbigumlw'); assert.equal(claims.role,'anon');
}
process.env.NEXT_PUBLIC_SUPABASE_URL=URL;
const supabaseModule=require('../lib/supabase.ts');
let current;
supabaseModule.getSupabase=()=>current;
const {fetchParkingPosts}=require('../lib/posts.ts');
const {kuColleges}=require('../lib/university.ts');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,URL);
const contextFile=process.argv[2];assert(path.isAbsolute(contextFile));
const ctx={project:'jrmiwmsgnztqwbigumlw',users:[],posts:[],conversations:[],messages:[],reports:[]};
const save=()=>fs.writeFileSync(contextFile,JSON.stringify(ctx));
let assertions=0,requests=0;
const check=(name,ok)=>{assert(ok,name);assertions++;console.log('PASS '+name);};
const data=async q=>{const r=await q;if(r.error)throw Error(r.error.message);return r.data;};
const deny=async(name,q,expected)=>{const r=await q;check(name,!!r.error&&r.error.message.includes(expected));};
const client=()=>createClient(URL,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{'x-mawqifi-place-aware':'1'},fetch:(u,o)=>{if(String(u).includes('/rest/v1/parking_posts'))requests++;return fetch(u,o);}}});
async function main(){
 const clients=[client(),client(),client()];
 for(const c of clients){const s=await data(c.auth.signInAnonymously());ctx.users.push({id:s.user.id,session:{access_token:s.session.access_token,refresh_token:s.session.refresh_token}});save();await data(c.from('users').upsert({id:s.user.id,username:'Sub-place staging test',is_guest:true},{onConflict:'id'}));}
 const [a,b,c]=clients,[A,B,C]=ctx.users;check('Three real anonymous Auth sessions and profiles',ctx.users.length===3);
 const publish=async(cl,place,scope)=>{const id=await data(cl.rpc('publish_parking_handoff',{payload:{place_id:place,sub_place_id:scope,departure_minutes:60},latitude:29.3,longitude:47.9,accuracy_meters:5}));ctx.posts.push(id);save();const p=await data(cl.from('parking_posts').select('*').eq('id',id).single());check('Secure GPS scope saved '+place+'/'+scope,p.sub_place_id===scope&&p.college===null&&p.zone===null&&p.gate===null&&p.location_description===null);return id;};
 const edu=await publish(a,'kuwait_university','education'),arts=await publish(a,'kuwait_university','arts');
 const ardiya=await publish(a,'paaet','basic_education_ardiya'),jahra=await publish(a,'paaet','basic_education_jahra');
 const gust=await publish(a,'gust',null),nursing=await publish(c,'paaet','nursing_shuwaikh');
 current=b;
 for(const [place,scope,pid] of [['kuwait_university','education',edu],['kuwait_university','arts',arts],['paaet','basic_education_ardiya',ardiya],['paaet','basic_education_jahra',jahra],['paaet','nursing_shuwaikh',nursing],['gust',null,gust]]){
  const feed=await fetchParkingPosts(place,scope);check('Actual app scoped discovery '+place+'/'+scope,feed.some(p=>p.id===pid)&&feed.every(p=>p.place_id===place&&(place==='gust'||p.sub_place_id===scope)));
  check('No exact coordinates in feed '+place+'/'+scope,feed.every(p=>!('latitude' in p)&&!('longitude'in p)));
 }
 check('Switch KU college hides previous posts',!(await fetchParkingPosts('kuwait_university','arts')).some(p=>p.id===edu));
 const before=requests;for(const place of [null,'kuwait_university','paaet'])check('Missing selection returns zero '+place,(await fetchParkingPosts(place)).length===0);check('Missing selection makes no post requests',before===requests);
 const unscoped=await publish(b,'kuwait_university',null);check('Legacy GPS still accepted but excluded from new feed',!(await fetchParkingPosts('kuwait_university','education')).some(p=>p.id===unscoped));
 const college=kuColleges[0];const cached=await data(b.from('parking_posts').insert({user_id:B.id,college:college.nameAr,zone:college.zone,gate:college.gates[0],departure_minutes:60,expires_at:new Date(Date.now()+3600000).toISOString()}).select('id,place_id,sub_place_id').single());ctx.posts.push(cached.id);save();check('Cached KU insert remains compatible and proven',cached.place_id==='kuwait_university'&&cached.sub_place_id==='education');
 for(const [place,scope] of [['kuwait_university','basic_education_ardiya'],['paaet','education'],['gust','education'],['paaet','invented_branch']])await deny('Institution rejects invalid scope '+place+'/'+scope,b.rpc('publish_parking_handoff',{payload:{place_id:place,sub_place_id:scope,departure_minutes:60},latitude:29.3,longitude:47.9,accuracy_meters:5}),'parking_posts_valid_sub_place');
 await deny('Scoped arbitrary non-GPS KU insert remains rejected',b.from('parking_posts').insert({user_id:B.id,place_id:'kuwait_university',sub_place_id:'education',handoff:true,departure_minutes:60,expires_at:new Date(Date.now()+3600000).toISOString()}),'PLACE_INVALID_KU_LOCATION');
 await deny('Scoped arbitrary non-GPS PAAET insert remains rejected',b.from('parking_posts').insert({user_id:B.id,place_id:'paaet',sub_place_id:'basic_education_ardiya',handoff:true,departure_minutes:60,expires_at:new Date(Date.now()+3600000).toISOString()}),'PLACE_LOCATION_REQUIRED');
 for(const cl of [b,c])check('GPS private before claim',(await data(cl.from('parking_post_locations').select('*').eq('post_id',gust))).length===0);
 const race=await Promise.all([b.rpc('claim_parking_post',{post_id:gust}),c.rpc('claim_parking_post',{post_id:gust})]);
 check('Concurrent atomic claim permits exactly one winner',race.filter(r=>!r.error).length===1&&race.filter(r=>r.error?.message.includes('HANDOFF_ALREADY_CLAIMED')).length===1);
 const win=race.findIndex(r=>!r.error),winner=[b,c][win],loser=[b,c][1-win],W=[B,C][win];
 const claimed=race[win].data,cid=claimed.claim.conversation_id;ctx.conversations.push(cid);save();
 check('Claim creates immediate private conversation',!!cid&&claimed.location.latitude===29.3);
 check('Losing claimant still cannot read GPS',(await data(loser.from('parking_post_locations').select('*').eq('post_id',gust))).length===0);
 check('Winning claimant reads private GPS',(await data(winner.from('parking_post_locations').select('*').eq('post_id',gust))).length===1);
 check('Repeat claim reuses conversation',(await data(winner.rpc('claim_parking_post',{post_id:gust}))).claim.conversation_id===cid);
 await deny('Scope immutable after claim',a.from('parking_posts').update({sub_place_id:'education'}).eq('id',gust),'HANDOFF_IMMUTABLE');
 const send=async(cl,uid,text)=>{const m=await data(cl.from('messages').insert({conversation_id:cid,sender_id:uid,type:'text',text}).select('id').single());ctx.messages.push(m.id);save();};
 await send(a,A.id,'Parking handoff scope test');await send(winner,W.id,'أنا قريب من الموقف');check('Both participants still chat',ctx.messages.length===2);
 await data(a.from('user_blocks').insert({blocker_id:A.id,blocked_id:W.id}));
 await deny('Blocked participant cannot message',winner.from('messages').insert({conversation_id:cid,sender_id:W.id,type:'text',text:'Blocked test'}),'SAFETY_BLOCKED');
 await deny('Blocked relationship cannot claim another scoped post',winner.rpc('claim_parking_post',{post_id:arts}),'SAFETY_BLOCKED');
 check('Blocking keeps saved chat readable',(await data(winner.from('messages').select('id').eq('conversation_id',cid))).length===2);
 await data(a.from('user_blocks').delete().eq('blocker_id',A.id).eq('blocked_id',W.id));
 const report=await data(loser.from('content_reports').insert({reporter_id:ctx.users[win===0?2:1].id,target_type:'post',target_id:edu,reason:'spam'}).select('id').single());ctx.reports.push(report.id);save();check('Reporting scoped post remains functional',!!report.id);
 check('Reported owner cannot read report',(await data(a.from('content_reports').select('id').eq('id',report.id))).length===0);
 const arrived=await data(winner.rpc('arrive_parking_handoff',{conversation_id:cid,manual:false,latitude:29.3,longitude:47.9,accuracy_meters:5}));
 check('25m foreground arrival starts exact server 15-minute timer',arrived.arrival_radius_meters===25&&Date.parse(arrived.claim.chat_closes_at)-Date.parse(arrived.claim.arrived_at)===900000);
 const repeated=await data(winner.rpc('arrive_parking_handoff',{conversation_id:cid,manual:true,latitude:null,longitude:null,accuracy_meters:null}));check('Manual arrival cannot restart timer',repeated.claim.chat_closes_at===arrived.claim.chat_closes_at);
 check('Nonparticipant conversation remains private',(await data(loser.from('messages').select('id').eq('conversation_id',cid))).length===0);
 await deny('Client cannot fabricate private location',loser.from('parking_post_locations').insert({post_id:edu,owner_id:ctx.users[win===0?2:1].id,latitude:29.3,longitude:47.9}),'permission denied');
 ctx.assertions=assertions;save();console.log(JSON.stringify({status:'PASS',assertions,project:ctx.project,users:ctx.users.map(u=>u.id),posts:ctx.posts,conversations:ctx.conversations}));
}
async function verifyClosed(){
 const existing=JSON.parse(fs.readFileSync(contextFile,'utf8'));const clients=[client(),client(),client()];
 for(let i=0;i<3;i++)await data(clients[i].auth.setSession(existing.users[i].session));
 const a=clients[0],cid=existing.conversations[0];const state=await data(a.rpc('get_parking_handoff',{conversation_id:cid}));
 const i=existing.users.findIndex(u=>u.id===state.claim.claimant_id);const winner=clients[i];
 await deny('Server rejects new message after controlled timer expiry',winner.from('messages').insert({conversation_id:cid,sender_id:existing.users[i].id,type:'text',text:'After deadline scope test'}),'HANDOFF_CHAT_CLOSED');
 for(const cl of [a,winner])check('Closed conversation retains readable history',(await data(cl.from('messages').select('id').eq('conversation_id',cid))).length===2);
 existing.closedAssertions=assertions;fs.writeFileSync(contextFile,JSON.stringify(existing));console.log(JSON.stringify({status:'PASS',assertions,project:existing.project}));
}
(process.argv[3]==='--verify-closed'?verifyClosed():main()).catch(e=>{console.error(e.message);process.exitCode=1;});
