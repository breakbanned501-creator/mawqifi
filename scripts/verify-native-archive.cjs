const fs = require('fs');
const path = require('path');
const { requireServerApiOrigin } = require('../lib/server-api-origin');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'out');
const iosConfigPath = path.join(root, 'ios', 'App', 'App', 'capacitor.config.json');
const iosEntitlementsPath = path.join(root, 'ios', 'App', 'App', 'App.entitlements');
const iosProjectPath = path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
const forbiddenText = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'VAPID_PRIVATE_KEY',
  'APNS_PRIVATE_KEY',
  'BEGIN PRIVATE KEY',
];
// `@supabase/gotrue-js` includes an internal localhost default in its source.
// It is inert when the public Supabase URL is configured, so detect actual
// app-server development URLs rather than treating that package default as a
// false positive.
const forbiddenDevelopmentUrls = [
  'http://localhost:3000',
  'https://localhost:3000',
  'http://127.0.0.1',
  'https://127.0.0.1',
];
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.txt']);

function fail(message) {
  throw new Error(`[native-verify] ${message}`);
}

function findTextFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findTextFiles(entryPath);
    return textExtensions.has(path.extname(entry.name).toLowerCase()) ? [entryPath] : [];
  });
}

function verifyNativeWebOutput() {
  if (!fs.existsSync(outputDir)) fail('Missing local native output directory out/.');
  if (!fs.existsSync(path.join(outputDir, 'post', 'view', 'index.html'))) {
    fail('The static post route is missing from out/.');
  }

  for (const fileName of ['sw.js', 'push-worker.js']) {
    if (fs.existsSync(path.join(outputDir, fileName))) {
      fail(`Native output unexpectedly contains ${fileName}.`);
    }
  }

  const expectedOrigin = requireServerApiOrigin(fs.readFileSync(path.join(root, '.capacitor-build', 'server-api-origin.txt'), 'utf8'));
  let foundApiOrigin = false;
  for (const filePath of findTextFiles(outputDir)) {
    const contents = fs.readFileSync(filePath, 'utf8');
    if (contents.includes(expectedOrigin)) foundApiOrigin = true;
    for (const forbidden of forbiddenText) {
      if (contents.includes(forbidden)) {
        fail(`Forbidden server-only material was found in ${path.relative(root, filePath)}.`);
      }
    }

    for (const forbidden of forbiddenDevelopmentUrls) {
      if (contents.includes(forbidden)) {
        fail(`A development server URL was found in ${path.relative(root, filePath)}.`);
      }
    }
  }
  if (!foundApiOrigin) fail('The explicit native API origin is missing from the client bundle.');
}

function verifyGeneratedCapacitorConfig() {
  if (!fs.existsSync(iosConfigPath)) fail('Missing generated iOS capacitor.config.json; run npx cap sync ios.');
  const config = JSON.parse(fs.readFileSync(iosConfigPath, 'utf8'));

  if (config.server?.url) fail('Generated iOS configuration contains server.url.');
  if (config.server?.hostname !== 'localhost' || config.server?.iosScheme !== 'capacitor') {
    fail('Generated iOS configuration does not use the expected local Capacitor origin.');
  }
}

function verifyPushEntitlementConfiguration() {
  if (!fs.existsSync(iosEntitlementsPath)) fail('Missing iOS App.entitlements.');
  const entitlements = fs.readFileSync(iosEntitlementsPath, 'utf8');
  if (!entitlements.includes('<key>aps-environment</key>') || !entitlements.includes('$(APS_ENVIRONMENT)')) {
    fail('iOS push entitlement is missing or is not configuration-specific.');
  }
  const project = fs.readFileSync(iosProjectPath, 'utf8');
  if ((project.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g) || []).length !== 2) {
    fail('Debug and Release must both use App.entitlements.');
  }
  if (!project.includes('APS_ENVIRONMENT = development;') || !project.includes('APS_ENVIRONMENT = production;')) {
    fail('Debug/Release APNs environments are incomplete.');
  }
}

try {
  verifyNativeWebOutput();
  verifyGeneratedCapacitorConfig();
  verifyPushEntitlementConfiguration();
  console.log('[native-verify] Local bundle, iOS configuration, push entitlement, and secret scan passed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : '[native-verify] Unknown failure.');
  process.exitCode = 1;
}
