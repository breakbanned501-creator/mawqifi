const fs=require('fs'),assert=require('node:assert/strict'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
let assertions=0;const check=(name,value)=>{assert(value,name);assertions++;console.log('PASS '+name);};
function load(file,modules={}){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;const out={};new Function('require','exports',code)(n=>{if(n in modules)return modules[n];throw Error('Unexpected '+n);},out);return out;}
const uni=load('lib/university.ts'),scope=load('lib/sub-places.ts',{'./university':uni}),i18n=load('lib/i18n/index.ts');
check('Exactly existing 11 KU colleges',scope.kuSubPlaces.length===11&&scope.kuSubPlaces.every((p,i)=>p.nameAr===uni.kuColleges[i].nameAr&&p.nameEn===uni.kuColleges[i].nameEn));
check('Stable IDs are distinct',new Set(scope.kuSubPlaces.map(p=>p.id)).size===11&&scope.kuSubPlaces.every(p=>p.id));
check('Full official contact-directory educational set',scope.paaetInstitutions.length===12&&scope.paaetSubPlaces.length===15);
check('Existing PAAET IDs preserved', ['basic_education_ardiya','basic_education_jahra','nursing_shuwaikh'].every(id=>scope.validSubPlace('paaet',id)));
check('Every PAAET leaf belongs to one institution', new Set(scope.paaetSubPlaces.map(p=>p.id)).size===15&&scope.paaetInstitutions.every(p=>p.campuses.length));
check('GUST has no sub-place',scope.subPlacesFor('gust').length===0&&scope.scopeReady('gust',null));
for(const place of [null,'kuwait_university','paaet'])check('Missing scope gated '+place,!scope.scopeReady(place,null));
check('KU rejects PAAET scope',!scope.scopeReady('kuwait_university','basic_education_ardiya'));
check('PAAET rejects KU scope',!scope.scopeReady('paaet','education'));
const memory=new Map();global.window={localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)}};
scope.persistSubPlace('kuwait_university','education');scope.persistSubPlace('paaet','basic_education_jahra');
check('KU restored after switching institutions',scope.readSubPlace('kuwait_university')==='education');
check('PAAET restored after switching institutions',scope.readSubPlace('paaet')==='basic_education_jahra');
check('GUST never restores incompatible selection',scope.readSubPlace('gust')===null);
const reloaded=load('lib/sub-places.ts',{'./university':uni});check('Selections survive module/app reload',reloaded.readSubPlace('kuwait_university')==='education'&&reloaded.readSubPlace('paaet')==='basic_education_jahra');
scope.persistSubPlace('paaet','arts');check('Incompatible stored selection cleared',scope.readSubPlace('paaet')===null&&scope.readSubPlace('kuwait_university')==='education');
memory.set('mawqifi_sub_places_v1','invalid JSON');check('Corrupted storage safely ignored',scope.readSubPlace('kuwait_university')===null);
window.localStorage.getItem=()=>{throw Error('Unavailable');};check('Denied storage safely ignored',scope.readSubPlace('kuwait_university')===null);delete global.window;
const places=[{id:'kuwait_university',name_ar:'جامعة الكويت',name_en:'Kuwait University'},{id:'paaet',name_ar:'التطبيقي',name_en:'PAAET'},{id:'gust',name_ar:'GUST',name_en:'GUST'}];
for(const locale of ['ar','en'])for(const place of places){
 let chosen=null;
 const component=load('components/PlaceSelector.tsx',{react:React,'react/jsx-runtime':require('react/jsx-runtime'),'./LocaleProvider':{useLocale:()=>({locale,dir:locale==='ar'?'rtl':'ltr',t:(k,v)=>i18n.translate(locale,k,v)})},'./PlaceProvider':{usePlace:()=>({places,place,loading:false,error:false,subPlaceId:chosen,selectPlace:()=>{},selectSubPlace:()=>{}})},'@/lib/places':{placeName:(p,l)=>l==='ar'?p.name_ar:p.name_en},'@/lib/sub-places':scope}).default;
 const html=renderToStaticMarkup(React.createElement(component));
 check('Selector direction '+locale+'/'+place.id,html.includes('dir="'+(locale==='ar'?'rtl':'ltr')+'"'));
 check('Selectors do not invoke keyboard '+locale+'/'+place.id,!/<input|<textarea/.test(html));
 check('Compact progressive controls '+locale+'/'+place.id,(html.match(/<select/g)||[]).length <= 3 && !html.includes('aria-pressed'));
 const prefix=place.id==='kuwait_university'?'ku':place.id==='paaet'?'paaet':null;
 check('Correct second-level selector '+locale+'/'+place.id,prefix?html.includes(i18n.translate(locale,'subPlace.'+prefix+'Title')):!html.includes(i18n.translate(locale,'subPlace.kuTitle'))&&!html.includes(i18n.translate(locale,'subPlace.paaetTitle')));
 if(prefix){chosen=scope.subPlacesFor(place.id)[0].id;const selected=renderToStaticMarkup(React.createElement(component));check('Selected scope label interpolates '+locale+'/'+place.id,!selected.includes('{name}')&&selected.includes(scope.subPlaceName(scope.subPlacesFor(place.id)[0],locale)));}
}
const migration=fs.readFileSync('supabase/migrations/20261003113052_expand_verified_paaet_scopes.sql','utf8');
check('UI IDs match migration validation',scope.kuSubPlaces.concat(scope.paaetSubPlaces).every(p=>migration.includes("'"+p.id+"'")));
console.log('Sub-place UI/persistence assertions: '+assertions);
