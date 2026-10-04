// Reuse the approved vector artwork; do not generate a new logo.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'public/icon.svg'), 'utf8');
const square = source.replace('width="512" height="512" rx="112"', 'width="512" height="512"');
const mark = source
  .replace(/  <rect width="512"[^\n]+\n/, '')
  .replace(/  <rect x="48"[^\n]+\n/, '');
async function png(svg, width, destination, opaque = false) {
  let image = sharp(Buffer.from(svg), { density: 192 }).resize(width, width);
  if (opaque) image = image.flatten({ background: '#0a1128' }).removeAlpha();
  await image.png().toFile(path.join(root, destination));
}
async function startup(width, height, destination) {
  const logo = await sharp(Buffer.from(mark), { density: 192 }).resize(Math.round(width * 0.45)).png().toBuffer();
  await sharp({ create: { width, height, channels: 3, background: '#0a1128' } })
    .composite([{ input: logo, gravity: 'centre' }]).removeAlpha().png().toFile(path.join(root, destination));
}
(async () => {
  await png(square, 1024, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', true);
  for (const size of [192, 512]) await png(square, size, `public/icon-${size}.png`, true);
  await png(square, 180, 'public/apple-touch-icon.png', true);
  for (const scale of [1, 2, 3]) await png(mark, 240 * scale, `ios/App/App/Assets.xcassets/Splash.imageset/mawqifi-mark-${scale}x.png`);
  await startup(1170, 2532, 'public/splash-iphone.png');
  await startup(1284, 2778, 'public/splash-iphone-large.png');
  await startup(1080, 1920, 'public/splash-android.png');
  await startup(1200, 630, 'public/og-image.png');
  console.log('Generated native/PWA assets from public/icon.svg (existing artwork).');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
