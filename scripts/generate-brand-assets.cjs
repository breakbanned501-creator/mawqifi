const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),file=n=>path.join(root,n),source=file('resources/branding/approved-concept.png'),cyan='#00cfea',navy='#0a1128';
// User-approved extraction only: the mask retains source pixels and discards
// the rounded tile/shadow. Nothing inside the pin/road is redrawn.
const mask='<svg width="676" height="683" xmlns="http://www.w3.org/2000/svg"><path fill="white" d="M255 174 H355 Q442 174 442 259 V334 Q442 381 402 414 L322 508 Q305 527 290 509 L199 396 Q174 365 174 329 V259 Q174 174 255 174Z"/><path fill="white" d="M190 459 H194 L185 475 H205 L219 453 Q241 431 261 452 L304 506 L321 507 L387 451 Q412 429 433 455 L443 475 H462 L447 459 H461 Q477 459 487 478 L520 556 Q537 595 499 595 H139 Q102 595 115 558 L159 480 Q175 458 190 459Z"/><ellipse fill="white" cx="450" cy="168" rx="16" ry="30"/><ellipse fill="white" cx="498" cy="185" rx="41" ry="20" transform="rotate(-36 498 185)"/><ellipse fill="white" cx="492" cy="232" rx="31" ry="15" transform="rotate(15 492 232)"/></svg>';
async function png(b,w,h,n){await sharp(b).resize(w,h).png().toFile(file(n));}
(async()=>{
const panel=await sharp(source).extract({left:0,top:0,width:676,height:683}).ensureAlpha().composite([{input:Buffer.from(mask),blend:'dest-in'}]).png().toBuffer();
const mark=await sharp(panel).extract({left:96,top:128,width:448,height:480}).resize(768,822).png().toBuffer();
const icon=await sharp({create:{width:1024,height:1024,channels:3,background:cyan}}).composite([{input:mark,gravity:'centre'}]).removeAlpha().png().toBuffer();
await png(icon,1024,1024,'resources/branding/app-icon.png');
await png(icon,1024,1024,'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
for(const s of [192,512])await png(icon,s,s,'public/icon-'+s+'.png');
fs.writeFileSync(file('public/icon.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><image width="512" height="512" href="data:image/png;base64,'+fs.readFileSync(file('public/icon-512.png')).toString('base64')+'"/></svg>');
await png(icon,180,180,'public/apple-touch-icon.png');
const splash=await sharp(source).extract({left:676,top:0,width:663,height:683}).removeAlpha().png().toBuffer();
await png(splash,1326,1366,'resources/branding/splash-artwork.png');
for(const s of [1,2,3])await png(splash,330*s,340*s,'ios/App/App/Assets.xcassets/Splash.imageset/mawqifi-mark-'+s+'x.png');
for(const [w,h,n] of [[1170,2532,'splash-iphone.png'],[1284,2778,'splash-iphone-large.png'],[1080,1920,'splash-android.png']]){
const art=await sharp(splash).resize(Math.round(w*.95)).png().toBuffer();
await sharp({create:{width:w,height:h,channels:3,background:navy}}).composite([{input:art,gravity:'centre'}]).removeAlpha().png().toFile(file('public/'+n));
}
const profile=await sharp(source).extract({left:1380,top:35,width:646,height:642}).ensureAlpha().composite([{input:Buffer.from('<svg width="646" height="642" xmlns="http://www.w3.org/2000/svg"><ellipse cx="323" cy="321" rx="321" ry="320" fill="white"/></svg>'),blend:'dest-in'}]).png().toBuffer();
await png(profile,1024,1024,'public/mawqifi-profile.png');
const share=await sharp(profile).resize(540,540).png().toBuffer();
await sharp({create:{width:1200,height:630,channels:3,background:navy}}).composite([{input:share,gravity:'centre'}]).removeAlpha().png().toFile(file('public/og-image.png'));
console.log('Approved panel extraction complete. Upscaling adds no source detail.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
