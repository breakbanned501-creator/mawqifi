/*
 * Builds the archive-safe Capacitor web bundle. The normal Vercel build still
 * sees the Next.js route handlers; this static-only pass temporarily sets them
 * aside because the installed app calls those same handlers over HTTPS.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { requireServerApiOrigin } = require('../lib/server-api-origin');

const root = path.resolve(__dirname, '..');
const apiDir = path.join(root, 'app', 'api');
const apiStashDir = path.join(root, '.capacitor-build', 'app-api');
const outputDir = path.join(root, 'out');
const nativePwaArtifacts = ['sw.js', 'push-worker.js'];
const requiredPublicVariables = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SERVER_API_ORIGIN',
];
const forbiddenEnvironmentVariables = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'VAPID_PRIVATE_KEY',
  'APNS_PRIVATE_KEY',
  'APNS_AUTH_KEY',
];

function fail(message) {
  throw new Error(`[native-build] ${message}`);
}

function readPublicBuildEnvironmentFile() {
  const filePath = process.env.MAWQIFI_NATIVE_ENV_FILE;
  if (!filePath) return {};

  const contents = fs.readFileSync(filePath, 'utf8');
  const publicValues = {};

  for (const name of requiredPublicVariables) {
    const match = contents.match(new RegExp(`^${name}=(.*)$`, 'm'));
    if (!match) continue;

    const rawValue = match[1].trim();
    publicValues[name] = rawValue.replace(/^['\"]|['\"]$/g, '');
  }

  return publicValues;
}

function getBuildEnvironment() {
  const environment = {
    ...process.env,
    ...readPublicBuildEnvironmentFile(),
    MAWQIFI_CAPACITOR_BUILD: '1',
  };

  for (const name of forbiddenEnvironmentVariables) delete environment[name];
  return environment;
}

function ensureRequiredPublicEnvironment(environment) {
  const missing = requiredPublicVariables.filter((name) => !environment[name]?.trim());
  if (missing.length > 0) {
    fail(`Missing required public build variables: ${missing.join(', ')}.`);
  }
}

function restoreInterruptedApiMove() {
  const hasApiDir = fs.existsSync(apiDir);
  const hasStashDir = fs.existsSync(apiStashDir);

  if (hasApiDir && hasStashDir) {
    fail('Both app/api and the native-build API stash exist. Restore the stash before retrying.');
  }

  if (!hasApiDir && hasStashDir) {
    fs.mkdirSync(path.dirname(apiDir), { recursive: true });
    fs.renameSync(apiStashDir, apiDir);
    console.warn('[native-build] Restored API routes left by an interrupted previous build.');
  }
}

function moveApiRoutesAside() {
  if (!fs.existsSync(apiDir)) fail('Expected app/api route handlers are missing.');
  fs.mkdirSync(path.dirname(apiStashDir), { recursive: true });
  fs.renameSync(apiDir, apiStashDir);
}

function restoreApiRoutes() {
  if (!fs.existsSync(apiStashDir)) return;
  if (fs.existsSync(apiDir)) fail('Cannot restore app/api because the destination already exists.');
  fs.renameSync(apiStashDir, apiDir);
}

function clearNativeOutput() {
  if (path.relative(root, outputDir).startsWith('..')) fail('Refusing to clear an output directory outside the repository.');
  fs.rmSync(outputDir, { recursive: true, force: true });
}

function removeNativePwaArtifacts() {
  for (const fileName of nativePwaArtifacts) {
    fs.rmSync(path.join(outputDir, fileName), { force: true });
  }

  for (const fileName of fs.readdirSync(outputDir)) {
    if (/^workbox-[\w-]+\.js$/i.test(fileName)) {
      fs.rmSync(path.join(outputDir, fileName), { force: true });
    }
  }
}

function runNextBuild(environment) {
  const nextCli = require.resolve('next/dist/bin/next');

  const result = spawnSync(process.execPath, [nextCli, 'build'], {
    cwd: root,
    env: environment,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) fail(`Next.js native export failed with exit code ${result.status ?? 'unknown'}.`);
}

function verifyStaticOutput() {
  const expectedFiles = [
    path.join(outputDir, 'index.html'),
    path.join(outputDir, 'post', 'view', 'index.html'),
  ];

  for (const filePath of expectedFiles) {
    if (!fs.existsSync(filePath)) fail(`Expected native output is missing: ${path.relative(root, filePath)}.`);
  }

  for (const fileName of nativePwaArtifacts) {
    if (fs.existsSync(path.join(outputDir, fileName))) {
      fail(`Native output must not contain ${fileName}.`);
    }
  }
}

function main() {
  const environment = getBuildEnvironment();
  ensureRequiredPublicEnvironment(environment);
  environment.NEXT_PUBLIC_SERVER_API_ORIGIN = requireServerApiOrigin(environment.NEXT_PUBLIC_SERVER_API_ORIGIN);
  restoreInterruptedApiMove();
  clearNativeOutput();

  let movedApiRoutes = false;
  try {
    moveApiRoutesAside();
    movedApiRoutes = true;
    runNextBuild(environment);
  } finally {
    if (movedApiRoutes) restoreApiRoutes();
  }

  removeNativePwaArtifacts();
  verifyStaticOutput();
  fs.mkdirSync(path.join(root, '.capacitor-build'), { recursive: true });
  fs.writeFileSync(path.join(root, '.capacitor-build', 'server-api-origin.txt'), environment.NEXT_PUBLIC_SERVER_API_ORIGIN);
  console.log('[native-build] Created local archive bundle in out/.');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : '[native-build] Unknown failure.');
  process.exitCode = 1;
}
