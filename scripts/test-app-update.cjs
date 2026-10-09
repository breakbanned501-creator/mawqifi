const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const fileName = path.join(root, 'lib/app-update.ts');
const source = fs.readFileSync(fileName, 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  fileName,
}).outputText;
const loaded = new Module(fileName, module);
loaded.filename = fileName;
loaded.paths = Module._nodeModulePaths(path.dirname(fileName));
loaded._compile(output, fileName);

async function main() {
  const update = loaded.exports;
  assert.equal(update.MAWQIFI_APP_STORE_URL, 'https://apps.apple.com/app/id6818279551');
  assert.equal(update.MAWQIFI_VERSION, '1.0.1');
  assert.equal(update.isNewerVersion('1.0', '1.0.1'), true);
  assert.equal(update.isNewerVersion('1.0.1', '1.0.1'), false);
  assert.equal(update.isNewerVersion('1.1', '1.0.9'), false);
  assert.equal(update.isNewerVersion('invalid', '2.0'), false);

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      resultCount: 1,
      results: [{ trackId: 6818279551, bundleId: 'com.mawqifi.app', version: '1.0.2' }],
    }),
  });
  assert.equal(await update.fetchPublishedIOSVersion(), '1.0.2');
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      resultCount: 1,
      results: [{ trackId: 6818279551, bundleId: 'com.example.other', version: '9.0' }],
    }),
  });
  assert.equal(await update.fetchPublishedIOSVersion(), null);
  global.fetch = originalFetch;

  const notice = fs.readFileSync(path.join(root, 'components/UpdateAvailableNotice.tsx'), 'utf8');
  assert.ok(notice.includes("new Set(['/', '/about', '/settings'])"));
  assert.ok(!notice.includes("'/post/view'"));
  assert.ok(notice.includes("App.addListener('appStateChange'"));
  assert.ok(notice.includes('window.sessionStorage'));
  assert.ok(notice.includes('catch {'));
  const translations = fs.readFileSync(path.join(root, 'lib/i18n/index.ts'), 'utf8');
  assert.ok(translations.includes('🚀 تحديث جديد لموقفي!'));
  assert.ok(translations.includes('يتوفر إصدار جديد من تطبيق موقفي يتضمن تحسينات وإصلاحات مهمة. حدّث التطبيق الآن واستمتع بأفضل تجربة.'));
  console.log('[app-update] Version comparison, trusted lookup response, foreground checks, session dismissal, passive routes, and graceful failure passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
