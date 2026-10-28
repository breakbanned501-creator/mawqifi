// Offline guards + current Codemagic schema. No cloud writes/build/upload.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),os=require('node:os');
const yaml=require('js-yaml'),Ajv=require('ajv');
const {verify}=require('./verify-production-build-env.cjs'),{inspectText,scan}=require('./scan-production-archive.cjs');
let count=0;const check=(name,f)=>{f();count++;console.log('PASS '+name);};
const source=fs.readFileSync('codemagic.yaml','utf8'),doc=yaml.load(source);
const schema=JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''));
const ajv=new Ajv({allErrors:true,strict:false,unknownFormats:'ignore'});
check('Current official Codemagic schema',()=>assert(ajv.validate(schema,doc),JSON.stringify(ajv.errors)));
const before=yaml.load(cp.execFileSync('git',['show','HEAD:codemagic.yaml'],{encoding:'utf8'}));
check('Staging workflow preserved',()=>assert.deepEqual(doc.workflows['ios-testflight-staging'],before.workflows['ios-testflight-staging']));
const w=doc.workflows['ios-app-store-production'];
check('Dedicated production environment group',()=>assert.deepEqual(w.environment.groups,['mawqifi_app_store_production']));
check('Explicit production push profile and existing certificate',()=>assert.deepEqual(w.environment.ios_signing,{
  provisioning_profiles:[{profile:'mawqifi_app_store_push',environment_variable:'MAWQIFI_PROVISIONING_PROFILE_PATH'}],
  certificates:['Mawqifi Codemagic'],
}));
check('Production profile APNs entitlement gate',()=>{
  const signing=w.scripts.find(s=>s.name.includes('production push provisioning profile')).script;
  assert(signing.includes('MAWQIFI_PROVISIONING_PROFILE_PATH'));
  assert(signing.includes("Print :Entitlements:aps-environment"));
  assert(signing.includes('= "production"'));
  assert(signing.includes('*.com.mawqifi.app'));
});
check('No triggers / review / release / beta review',()=>{
  assert(!w.triggering);assert.deepEqual(w.publishing.app_store_connect,{auth:'integration',submit_to_testflight:false,submit_to_app_store:false});
  assert(!JSON.stringify(w).includes('testFlightInternalTestingOnly'));
});
check('Build numbering preserved',()=>assert.equal(w.scripts.find(s=>s.name.includes('incrementing')).script,doc.workflows['ios-testflight-staging'].scripts.find(s=>s.name.includes('incrementing')).script));
check('Archive scan precedes publishing',()=>assert(w.scripts.at(-1).script.includes('scan-production-archive.cjs')&&w.scripts.at(-1).script.includes('unzip -q')));
check('Production archive is pinned to marketing version 1.0.2',()=>{
  const archive=w.scripts.find(s=>s.name==='Build signed App Store IPA').script;
  const scan=w.scripts.find(s=>s.name.includes('Scan expanded signed IPA')).script;
  assert(archive.includes('MARKETING_VERSION=1.0.2'));
  assert(scan.includes('CFBundleShortVersionString'));
  assert(scan.includes('= "1.0.2"'));
});
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
for(const workflow of Object.values(doc.workflows))for(const s of workflow.scripts)check('Bash syntax '+workflow.name+'/'+s.name,()=>assert.equal(cp.spawnSync(bash,['-n'],{input:s.script,encoding:'utf8'}).status,0));
const commit='a'.repeat(40),tag='mawqifi-production-approved-fixture';
const env={CM_BRANCH:'ios-release-hardening',APPROVED_RELEASE_COMMIT:commit,APPROVED_RELEASE_TAG:tag,NEXT_PUBLIC_SUPABASE_URL:'https://opsyvdsivxoqphkfdsbb.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_abcdefghijklmnopqrstuvwxyz',NEXT_PUBLIC_SERVER_API_ORIGIN:'https://mawqifiapp.vercel.app',NEXT_PUBLIC_REVERSE_MATCHING:'1',APP_STORE_APPLE_ID:'123456789',NEXT_PUBLIC_PUBLISH_TIMING:'',MAWQIFI_NATIVE_ENV_FILE:''};
const git=args=>args[0]==='merge-base'?'':commit;
check('Approved environment accepted offline',()=>verify(env,git,[]));
check('Valid multi-commit release branch accepted',()=>verify({...env,CM_BRANCH:'mawqifi-production-release-1.0.2'},args=>{
  if(args[0]==='rev-parse' && args[1]==='HEAD') return 'c'.repeat(40);
  if(args[0]==='diff' && args[1]==='--name-only') return 'codemagic.yaml\nscripts/verify-production-build-env.cjs\nscripts/test-production-workflow.cjs';
  return args[0]==='merge-base'?'':commit;
},[]));
check('All approved CI-only paths are excluded from strict diff',()=>{
  const calls=[];
  verify({...env,CM_BRANCH:'mawqifi-production-release-1.0.2'},args=>{
   calls.push(args);
   if(args[0]==='rev-parse' && args[1]==='HEAD') return 'c'.repeat(40);
   if(args[0]==='diff' && args[1]==='--name-only') return 'codemagic.yaml\nscripts/verify-production-build-env.cjs\nscripts/test-production-workflow.cjs';
   return args[0]==='merge-base'?'':commit;
  },[]);
  const strict=calls.find(args=>args[0]==='diff'&&args[1]==='--quiet');
  assert.deepEqual(strict.slice(-3),[':(exclude)codemagic.yaml',':(exclude)scripts/test-production-workflow.cjs',':(exclude)scripts/verify-production-build-env.cjs']);
});
check('Application path still rejected',()=>assert.throws(()=>verify({...env,CM_BRANCH:'mawqifi-production-release-1.0.2'},args=>{
  if(args[0]==='rev-parse'&&args[1]==='HEAD') return 'c'.repeat(40);
  if(args[0]==='diff'&&args[1]==='--name-only') return 'src/app.tsx';
  return args[0]==='merge-base'?'':commit;
},[])));
for(const [name,changes] of Object.entries({branch:{CM_BRANCH:'main'},commit:{APPROVED_RELEASE_COMMIT:''},tag:{APPROVED_RELEASE_TAG:''},supabase:{NEXT_PUBLIC_SUPABASE_URL:'https://jrmiwmsgnztqwbigumlw.supabase.co'},api:{NEXT_PUBLIC_SERVER_API_ORIGIN:'https://mawqifi-testflight-staging.vercel.app'},reverse:{NEXT_PUBLIC_REVERSE_MATCHING:'0'},apple:{APP_STORE_APPLE_ID:'abc'},localenv:{MAWQIFI_NATIVE_ENV_FILE:'1'},secret:{SUPABASE_SERVICE_ROLE_KEY:'secret'},publishable:{NEXT_PUBLIC_SUPABASE_ANON_KEY:'not-a-key'},privatekey:{APNS_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----'}})){
  check('Bad '+name+' rejected',()=>assert.throws(()=>verify({...env,...changes},git,[])));
}
check('Stale local tag is ignored in favor of fetched CI ref',()=>{
  const staleGit=args=>args[0]==='rev-parse'&&args[1]&&args[1].startsWith('refs/codemagic/')?commit:(args[0]==='rev-parse'?'b'.repeat(40):git(args));
  verify(env,staleGit,[]);
});
check('Fetched ref rejects the prior 1.0.1 stale-tag commit',()=>assert.throws(()=>verify(env,args=>{
  if(args[0]==='rev-parse'&&args[1]&&args[1].startsWith('refs/codemagic/')) return '4e492733163b1ba68b4f58c89ba8d84c25bf98e1';
  return git(args);
},[]),/Approved tag does not resolve to approved commit/));
check('Fetched tag mismatch rejected',()=>assert.throws(()=>verify(env,args=>args[0]==='rev-parse'&&args[1]&&args[1].startsWith('refs/codemagic/')?'b'.repeat(40):git(args),[])));
check('Invalid ancestry rejected',()=>assert.throws(()=>verify(env,args=>args[0]==='merge-base'?(()=>{throw Error('not an ancestor')})():'',[])));
check('Local env override rejected',()=>assert.throws(()=>verify(env,git,['.env.local'])));
for(const text of ['jrmiwmsgnztqwbigumlw','https://mawqifi-testflight-staging.vercel.app','sb_secret_'+ 'a'.repeat(30),'-----BEGIN '+ 'PRIVATE KEY-----','APNS_PRIVATE_KEY'])check('Archive forbids '+text,()=>assert.throws(()=>inspectText('secret-'+ 'x'.repeat(30),{BUILD_SECRET:'secret-'+ 'x'.repeat(30)})));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mawqifi-production-scan-'));
const app=path.join(tmp,'App.app'),out=path.join(tmp,'out');fs.mkdirSync(app);fs.mkdirSync(out);
const publicConfig=env.NEXT_PUBLIC_SUPABASE_URL+' '+env.NEXT_PUBLIC_SERVER_API_ORIGIN;
fs.writeFileSync(path.join(app,'app.js'),publicConfig);fs.writeFileSync(path.join(out,'app.js'),publicConfig);
fs.writeFileSync(path.join(app,'capacitor.config.json'),JSON.stringify({appId:'com.mawqifi.app',webDir:'out'}));
check('Expanded native app + out scan passes',()=>assert.equal(scan([app,out],{}),3));
fs.writeFileSync(path.join(app,'sw.js'),'');check('Native service worker rejected',()=>assert.throws(()=>scan([app,out],{})));fs.unlinkSync(path.join(app,'sw.js'));
fs.writeFileSync(path.join(app,'capacitor.config.json'),JSON.stringify({appId:'com.mawqifi.app',webDir:'out',server:{url:env.NEXT_PUBLIC_SERVER_API_ORIGIN}}));check('Remote server.url rejected',()=>assert.throws(()=>scan([app,out],{})));
console.log('Production workflow/guard assertions: '+count);
