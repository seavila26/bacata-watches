import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import http from 'node:http';
import sharp from 'sharp';

test('HTTP protects login, JSON/origin, cookies, uploads, private files and request limits behind Nginx', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bacata-security-http-'));
  const child = spawn(process.execPath, ['src/server.js'], { env: {
    ...process.env, PORT: '0', HOST: '127.0.0.1', TRUST_PROXY: 'loopback', APP_ORIGIN: 'https://relojeriabacata.store',
    DB_PATH: join(dir, 'test.sqlite'), ADMIN_EMAIL: 'admin@test.local', ADMIN_PASSWORD: 'TemporaryTestPassword123', SESSION_SECRET: 'temporary-test-secret-at-least-32-chars'
  }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '', uploaded;
  child.stderr.on('data', b => stderr += b);
  try {
    const output = await new Promise((ok, no) => {
      const timer = setTimeout(() => no(Error('No inició servidor: ' + stderr)), 10000);
      child.stdout.once('data', b => { clearTimeout(timer); ok(b.toString()); });
      child.once('error', no);
      child.once('exit', () => { clearTimeout(timer); no(Error('Servidor terminó: ' + stderr)); });
    });
    const base = `http://127.0.0.1:${output.match(/:(\d+)/)[1]}`;
    const send = (path, data, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '192.0.2.10', ...headers }, body: JSON.stringify(data) });
    for (const path of ['/api/admin/overview', '/api/admin/products/unknown/history']) {
      const res = await fetch(base + path); assert.equal(res.status, 401); assert.equal(res.headers.get('cache-control'), 'no-store');
    }
    for (const path of ['/.env', '/data/aurel.sqlite', '/backups/snapshot.sqlite', '/js/missing.js']) assert.equal((await fetch(base + path)).status, 404);
    const badCookie = await fetch(base + '/api/admin/overview', { headers: { cookie: 'aurel_session=' + 'a'.repeat(64) + '.' + encodeURIComponent('é'.repeat(64)) } });
    assert.equal(badCookie.status, 401);
    assert.equal((await send('/api/admin/login', {}, { origin: 'https://evil.example' })).status, 403);
    assert.equal((await send('/api/orders', {}, { 'sec-fetch-site': 'cross-site' })).status, 403);
    const credentials = { email: 'admin@test.local', password: 'TemporaryTestPassword123' };
    const login = await send('/api/admin/login', credentials, { origin: 'https://relojeriabacata.store' }); assert.equal(login.status, 200);
    const setCookie = login.headers.get('set-cookie');
    for (const property of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(setCookie.includes(property));
    assert.ok(!setCookie.includes('Domain='));
    assert.ok(login.headers.get('strict-transport-security').startsWith('max-age='));
    const cookie = setCookie.split(';')[0];
    const old = cookie;
    const relogin = await send('/api/admin/login', credentials, { cookie });
    const newCookie = relogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(base + '/api/admin/overview', { headers: { cookie: old } })).status, 401);
    assert.equal((await send('/api/admin/images', {}, { cookie: newCookie, 'content-type': 'text/plain' })).status, 415);
    assert.equal((await send('/api/admin/images', { base64: '%%%%' }, { cookie: newCookie })).status, 400);
    assert.equal((await send('/api/admin/images', { base64: Buffer.from([255, 216, 255]).toString('base64') }, { cookie: newCookie })).status, 400);
    const image = await sharp({ create: { width: 80, height: 100, channels: 3, background: '#0B1D3A' } }).jpeg().toBuffer();
    const picture = await send('/api/admin/images', { base64: image.toString('base64') }, { cookie: newCookie }); assert.equal(picture.status, 201);
    const data = await picture.json(); assert.match(data.url, /^\/uploads\/[a-f0-9]{32}\.webp$/); uploaded = join('public', data.url.slice(1));
    assert.equal((await sharp(await readFile(uploaded)).metadata()).format, 'webp');
    const response = await fetch(base + data.url); assert.equal(response.status, 200); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const excel = await fetch(base + '/api/admin/inventory/preview', { method: 'POST', headers: { cookie: newCookie, 'content-type': 'application/octet-stream' }, body: Buffer.from('bad zip').toString('base64') }); assert.equal(excel.status, 400);
    assert.ok(!(await excel.text()).includes(dir));
    assert.equal((await send('/api/admin/logout', {}, { cookie: newCookie })).status, 200);
    assert.equal((await fetch(base + '/api/admin/overview', { headers: { cookie: newCookie } })).status, 401);
    for (let n = 0; n < 10; n++) assert.equal((await send('/api/admin/login', { email: credentials.email, password: 'incorrect-password' }, { 'x-real-ip': '192.0.2.99' })).status, 401);
    const blocked = await send('/api/admin/login', credentials, { 'x-real-ip': '192.0.2.99' }); assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get('retry-after')) > 0);
    assert.equal((await send('/api/admin/login', credentials, { 'x-real-ip': '192.0.2.100' })).status, 200);
    // Chunked UTF-8 body: reject by bytes without destroying the HTTP response socket.
    const tooLarge = await new Promise((ok, no) => {
      const req = http.request(base + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '192.0.2.101' } }, res => { const chunks = []; res.on('data', b => chunks.push(b)); res.on('end', () => ok({ status: res.statusCode, body: Buffer.concat(chunks).toString() })); });
      req.on('error', no); req.write(Buffer.from('{"password":"' + '🕰'.repeat(3000))); req.end('"}');
    });
    assert.equal(tooLarge.status, 413); assert.ok(!tooLarge.body.includes('🕰'));
    assert.equal((await fetch(base + '/api/products')).status, 200);
  } finally {
    if (child.exitCode === null) { child.kill(); await once(child, 'exit'); }
    if (uploaded) await rm(uploaded, { force: true });
    await rm(dir, { recursive: true, force: true });
  }
});
