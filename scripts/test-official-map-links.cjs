const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
let native = false, completed = true, launchCalls = [], browserCalls = [];
const code = ts.transpileModule(fs.readFileSync('lib/official-map-links.ts','utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exportsObject = {};
new Function('require','exports',code)(name => {
  if(name==='./capacitor') return {isNativeCapacitor:()=>native};
  if(name==='@capacitor/app-launcher') return {AppLauncher:{openUrl:async options=>{launchCalls.push(options);return {completed};}}};
  throw Error('Unexpected import '+name);
},exportsObject);
const {openOfficialMapUrl} = exportsObject;
let assertions = 0;
const check = (value,label)=>{assert(value,label);assertions++;};
const reject = async (url,pattern)=>{await assert.rejects(openOfficialMapUrl(url),pattern);assertions++;};
async function main() {
  const url='https://www.gust.edu.kw/about-us/gust-campus-map';
  global.window={open:(...args)=>browserCalls.push(args)};
  await openOfficialMapUrl(url);
  check(browserCalls.length===1&&browserCalls[0][0]===url,'Web opens original official URL');
  check(browserCalls[0][1]==='_blank'&&browserCalls[0][2]==='noopener,noreferrer','Web source cannot control opener');
  check(launchCalls.length===0,'Web does not use native plugin');
  native=true;
  delete global.window;
  await openOfficialMapUrl(url);
  check(launchCalls.at(-1).url===url,'Native hands original HTTPS source to OS, without local WebView navigation');
  const before=launchCalls.length;
  for(const bad of ['http://www.gust.edu.kw/about-us/gust-campus-map','javascript:alert(1)','https://www.gust.edu.kw.attacker.example/','https://attacker.example/','https://user:secret@www.gust.edu.kw/']){
    await reject(bad,/Unsupported official map source/);
  }
  check(launchCalls.length===before,'Rejected URLs never reach OS handler');
  completed=false;
  await reject(url,/Could not open the official map source/);
  console.log('Official map link contract passed ('+assertions+' assertions).');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});