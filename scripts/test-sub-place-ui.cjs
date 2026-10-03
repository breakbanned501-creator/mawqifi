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
check('KU all 22 parking scopes valid and ready',scope.kuParkingScopes.length===22&&scope.kuParkingScopes.every(p=>scope.validSubPlace('kuwait_university',p.id)&&scope.scopeReady('kuwait_university',p.id)));
check('Legacy KU college stays valid but not discoverable without side',scope.validSubPlace('kuwait_university','education')&&!scope.scopeReady('kuwait_university','education'));
check('Invalid parking side rejected',!scope.validSubPlace('kuwait_university','education_east'));
check('College changes preserve compatible North',scope.kuParkingScope('arts',scope.kuParkingSide('education_north'))==='arts_north');
check('Side cannot decode a PAAET/GUST scope',scope.kuParkingSide('basic_education_jahra')===null&&scope.kuCollegeId('gust')===null);
check('GUST has no sub-place',scope.subPlacesFor('gust').length===0&&scope.scopeReady('gust',null));
for(const place of [null,'kuwait_university','paaet'])check('Missing scope gated '+place,!scope.scopeReady(place,null));
check('KU rejects PAAET scope',!scope.scopeReady('kuwait_university','basic_education_ardiya'));
check('PAAET rejects KU scope',!scope.scopeReady('paaet','education'));
const memory=new Map();global.window={localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)}};
scope.persistSubPlace('kuwait_university','education_north');scope.persistSubPlace('paaet','basic_education_jahra');
check('KU restored after switching institutions',scope.readSubPlace('kuwait_university')==='education_north');
check('PAAET restored after switching institutions',scope.readSubPlace('paaet')==='basic_education_jahra');
check('GUST never restores incompatible selection',scope.readSubPlace('gust')===null);
const reloaded=load('lib/sub-places.ts',{'./university':uni});check('Selections survive module/app reload',reloaded.readSubPlace('kuwait_university')==='education_north'&&reloaded.readSubPlace('paaet')==='basic_education_jahra');
scope.persistSubPlace('paaet','arts');check('Incompatible stored selection cleared',scope.readSubPlace('paaet')===null&&scope.readSubPlace('kuwait_university')==='education_north');
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
 if(place.id==='kuwait_university'){for(const side of scope.kuParkingSides){chosen='education_'+side.id;const selected=renderToStaticMarkup(React.createElement(component));check('KU compact side and summary '+locale+'/'+side.id,(selected.match(/<select/g)||[]).length===3&&selected.includes(scope.subPlaceName(side,locale))&&!selected.includes(i18n.translate(locale,'subPlace.kuParkingHelper')));}}
}
const migration=fs.readFileSync('supabase/migrations/20261003120418_add_ku_parking_side_scopes.sql','utf8');
check('KU parking controls bilingual', ['ar','en'].every(locale=>scope.kuParkingSides.every(p=>scope.subPlaceName(p,locale).length>0)));
check('UI IDs match migration validation',scope.kuSubPlaces.concat(scope.kuParkingScopes,scope.paaetSubPlaces).every(p=>migration.includes("'"+p.id+"'")));
console.log('Sub-place UI/persistence assertions: '+assertions);
