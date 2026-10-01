const assert = require('node:assert/strict'), fs = require('fs'), path = require('path'), { spawnSync } = require('node:child_process');
const ts = require('typescript'), { NextResponse } = require('next/server');
const { requireServerApiOrigin } = require('../lib/server-api-origin');
const root = path.resolve(__dirname, '..');
let tests = 0;
const check = (value, label) => { assert.ok(value, label); tests++; };
function load(file, modules = {}) {
    const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const exports = {};
    new Function('require', 'exports', code)(name => { if (name in modules)
        return modules[name]; throw Error('Unexpected import ' + name); }, exports);
    return exports;
}
async function main() {
    for (const origin of ['https://preview.example', 'https://preview.example/', 'https://preview.example:8443'])
        check(requireServerApiOrigin(origin) === new URL(origin).origin, 'Valid HTTPS origin');
    for (const origin of [undefined, '', 'http://preview.example', 'capacitor://localhost', 'not-a-url', 'https://user:secret@preview.example', 'https://preview.example/api', 'https://preview.example?key=secret', 'https://preview.example/#token']) {
        assert.throws(() => requireServerApiOrigin(origin), /NEXT_PUBLIC_SERVER_API_ORIGIN/);
        tests++;
    }
    let native = false;
    const api = load('lib/server-api.ts', { './capacitor': { isNativeCapacitor: () => native }, './server-api-origin': { requireServerApiOrigin } });
    delete process.env.NEXT_PUBLIC_SERVER_API_ORIGIN;
    check(api.getMawqifiServerApiUrl('/api/push/native-token') === '/api/push/native-token', 'Web is same-origin without native config');
    native = true;
    assert.throws(() => api.getMawqifiServerApiUrl('/api/push/native-token'), /required/);
    tests++;
    process.env.NEXT_PUBLIC_SERVER_API_ORIGIN = 'https://native-preview.example';
    for (const p of ['/api/push/subscribe', '/api/push/native-token', '/api/push/notify-new-post', '/api/push/notify-chat-message'])
        check(api.getMawqifiServerApiUrl(p) === 'https://native-preview.example' + p, 'Native explicit backend ' + p);
    assert.throws(() => api.getMawqifiServerApiUrl('/api/other'), /Unsupported/);
    tests++;
    let sent;
    const oldFetch = global.fetch;
    global.fetch = async (url, init) => { sent = { url, init }; return new Response('{}'); };
    await api.fetchMawqifiServerApi('/api/push/native-token', { method: 'POST', headers: { Authorization: 'Bearer test-token' }, credentials: 'include' });
    check(sent.init.credentials === 'omit', 'Native omits cookies');
    check(sent.init.headers.Authorization === 'Bearer test-token', 'Bearer forwarded unchanged');
    native = false;
    await api.fetchMawqifiServerApi('/api/push/subscribe', { method: 'POST' });
    check(sent.url === '/api/push/subscribe' && sent.init.credentials === 'same-origin', 'Web same-origin credentials');
    global.fetch = oldFetch;
    const constants = load('lib/capacitor-origin.ts');
    const cors = load('lib/native-api-cors.ts', { 'next/server': { NextResponse }, '@/lib/capacitor-origin': constants });
    const preflight = new Request('https://preview.example/api/push/native-token', { method: 'OPTIONS', headers: { Origin: 'capacitor://localhost', 'Access-Control-Request-Headers': 'authorization,content-type' } });
    const allowed = cors.nativeApiOptions(preflight);
    check(allowed.status === 204, 'Native preflight accepted');
    check(allowed.headers.get('access-control-allow-origin') === 'capacitor://localhost', 'Exact origin only');
    check(allowed.headers.get('access-control-allow-headers').includes('Authorization'), 'Bearer header allowed');
    check(!allowed.headers.has('access-control-allow-credentials'), 'No cookie credentials grant');
    for (const origin of ['https://evil.example', 'null', 'capacitor://evil', 'http://localhost:3000']) {
        const req = new Request('https://preview.example/api/push/native-token', { method: 'OPTIONS', headers: { Origin: origin } });
        const response = cors.nativeApiOptions(req);
        check(response.status === 403 && !response.headers.has('access-control-allow-origin'), 'Foreign origin denied ' + origin);
    }
    const failure = cors.withNativeApiCors(preflight, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    check(failure.status === 401 && failure.headers.get('access-control-allow-origin') === 'capacitor://localhost', 'CORS never bypasses auth');
    const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'https://staging.example', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key' };
    for (const origin of [undefined, 'http://preview.example', 'https://preview.example/api']) {
        if (origin === undefined)
            delete env.NEXT_PUBLIC_SERVER_API_ORIGIN;
        else
            env.NEXT_PUBLIC_SERVER_API_ORIGIN = origin;
        const run = spawnSync(process.execPath, ['scripts/build-native.cjs'], { cwd: root, env, encoding: 'utf8' });
        check(run.status !== 0 && (run.stderr + run.stdout).includes('NEXT_PUBLIC_SERVER_API_ORIGIN'), 'Invalid archive configuration fails before build');
        check(fs.existsSync(path.join(root, 'app/api')), 'API routes untouched by failed configuration');
    }
    // Render the real safety UI with React 19, without a browser or database.
    const React = require('react');
    const { renderToStaticMarkup } = require('react-dom/server');
    const i18n = load('lib/i18n/index.ts');
    for (const locale of ['ar', 'en']) {
        const dir = i18n.getTextDirection(locale);
        check(dir === (locale === 'ar' ? 'rtl' : 'ltr'), 'Locale direction ' + locale);
        const localeModule = { useLocale: () => ({ dir, t: (key, values) => i18n.translate(locale, key, values) }) };
        const modal = load('components/ReportModal.tsx', {
            'react': React, 'react/jsx-runtime': require('react/jsx-runtime'),
            'lucide-react': require('lucide-react'), '@/components/LocaleProvider': localeModule,
            '@/lib/security': { sanitizeInput: value => value },
        }).default;
        for (const targetType of ['post', 'message', 'user']) {
            const html = renderToStaticMarkup(React.createElement(modal, {
                isOpen: true, targetType, onClose: () => {}, onSubmit: async () => {},
            }));
            check(html.includes('role="dialog"') && html.includes('dir="' + dir + '"'), 'Report dialog renders ' + locale + ' ' + targetType);
            check(html.includes(i18n.translate(locale, 'report.reasonSpam')), 'Localized report reasons ' + locale + ' ' + targetType);
        }
        check(renderToStaticMarkup(React.createElement(modal, { isOpen: false, targetType: 'user' })) === '', 'Closed report modal is hidden ' + locale);
        const actions = load('components/UserSafetyActions.tsx', {
            'react': React, 'react/jsx-runtime': require('react/jsx-runtime'),
            './ReportModal': { default: modal }, './LocaleProvider': localeModule,
            '@/lib/safety': { setUserBlocked: async () => {}, submitReport: async () => {} },
        }).default;
        const html = renderToStaticMarkup(React.createElement(actions, { userId: 'disposable-ui-fixture' }));
        check(html.includes(i18n.translate(locale, 'safety.block')) && html.includes(i18n.translate(locale, 'safety.reportUser')), 'Report/block controls render ' + locale);
    }
    check(fs.readFileSync(path.join(root, 'app/settings/page.tsx'), 'utf8').includes('href="/settings/blocked"'), 'Blocked users screen reachable from Settings');
    check(fs.readFileSync(path.join(root, 'app/settings/blocked/page.tsx'), 'utf8').includes('setUserBlocked(id, false)'), 'Unblock action connected to safety helper');
    console.log('Release hardening checks passed (' + tests + ' assertions).');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
