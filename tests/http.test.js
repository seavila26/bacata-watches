import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import ExcelJS from 'exceljs';
import { commercialDefaults } from '../public/js/commercial-model.js';
import { fixture } from './fixtures.js';
test('HTTP complete workflow, cross-page export, public privacy, stale purchase rejection and admin actions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bacata-http-')),
    dbPath = join(dir, 'test.sqlite');
  const child = spawn(process.execPath, ['src/server.js'], {
    env: {
      ...process.env,
      PORT: '0',
      APP_ORIGIN: 'http://localhost',
      DB_PATH: dbPath,
      ADMIN_EMAIL: 'admin@test.local',
      ADMIN_PASSWORD: 'TemporaryTestPassword123',
      SESSION_SECRET: 'temporary-test-secret-at-least-32-chars',
      SEED_DEMO: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', b => stderr += b);
  try {
    const message = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Servidor no inició: ' + stderr)), 10000);
      child.stdout.once('data', b => {
        clearTimeout(timeout);
        resolve(b.toString());
      });
      child.once('error', reject);
      child.once('exit', code => {
        clearTimeout(timeout);
        reject(Error('Servidor terminó ' + code + ': ' + stderr));
      });
    });
    const base = `http://127.0.0.1:${message.match(/:(\d+)/)[1]}`;
    let cookie = '';
    const send = (path, data, method = 'POST') => fetch(base + path, {
      method,
      headers: {
        cookie,
        'content-type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    const raw = (path, b) => fetch(base + path, {
      method: 'POST',
      headers: {
        cookie,
        'content-type': 'application/octet-stream'
      },
      body: b.toString('base64')
    });
    const get = path => fetch(base + path, {
      headers: {
        cookie
      }
    }).then(r => r.json());
    assert.equal((await fetch(base + '/api/admin/overview')).status, 401);
    assert.deepEqual(await get('/api/payments/config'), {mode:'disabled',enabled:false});
    assert.equal((await send('/api/payments/checkout',{items:[{id:'p',quantity:1}],accepted:true,idempotency_key:'a'.repeat(64)})).status,503);
    assert.equal((await fetch(base+'/pago?token=not-secret')).status,200);
    assert.equal((await fetch(base + '/api/admin/orders')).status, 401);
    assert.equal((await fetch(base + '/api/admin/orders/AUR-private')).status, 401);
    assert.equal((await send('/api/admin/commercial', commercialDefaults, 'PUT')).status, 401);
    assert.equal((await get('/api/commercial')).commercial.whatsapp, '573246871623');
    assert.equal((await send('/api/admin/catalog/export', {
      ids: ['anything']
    })).status, 401);
    assert.equal((await fetch(base + '/api/admin/login', {
      method: 'POST',
      headers: {
        origin: 'https://other.example'
      },
      body: '{}'
    })).status, 403);
    const login = await send('/api/admin/login', {
      email: 'admin@test.local',
      password: 'TemporaryTestPassword123'
    });
    assert.equal(login.status, 200);
    cookie = login.headers.get('set-cookie').split(';')[0];
    const commercialBefore = (await get('/api/admin/overview')).settings;
    const commercial = { ...commercialDefaults, trade_name: 'Bacatá revisión', shipping: 'Envío sujeto a cotización individual.' };
    assert.equal((await send('/api/admin/commercial', { ...commercial, provisional: false }, 'PUT')).status, 400);
    assert.equal((await send('/api/admin/commercial', { ...commercial, private_key: 'no' }, 'PUT')).status, 400);
    const crossSiteCommercial = await fetch(base + '/api/admin/commercial', { method:'PUT', headers:{ cookie, origin:'https://other.example', 'content-type':'application/json' }, body:JSON.stringify(commercial) });
    assert.equal(crossSiteCommercial.status, 403);
    assert.equal((await send('/api/admin/commercial', commercial, 'PUT')).status, 200);
    assert.deepEqual((await get('/api/commercial')).commercial, commercial);
    const commercialOverview = await get('/api/admin/overview');
    assert.deepEqual(commercialOverview.settings, commercialBefore);
    assert.ok(commercialOverview.audit.some(row => row.action === 'commercial_updated'));
    const persistedProfile = new DatabaseSync(dbPath, { readOnly: true });
    assert.deepEqual(JSON.parse(persistedProfile.prepare('SELECT data_json FROM commercial_profile WHERE id=1').get().data_json), commercial);
    persistedProfile.close();

    const requestDb = new DatabaseSync(dbPath);
    requestDb.prepare('INSERT INTO orders(id,items_json,total_cop,created_at) VALUES(?,?,?,?)').run('AUR-review-test', JSON.stringify([{id:'old',reference:'OLD-01',name:'Pieza previa',quantity:1,unit_price_cop:123456}]),123456,new Date().toISOString());
    requestDb.close();
    const savedRequest = (await get('/api/admin/orders/AUR-review-test')).order;
    assert.equal((await get('/api/admin/orders?q=OLD-01')).total,1);
    assert.equal((await send('/api/admin/orders/AUR-review-test',{version:savedRequest.version,status:'reviewed',admin_note:'Validada'},'PATCH')).status,200);
    assert.equal((await send('/api/admin/orders/AUR-review-test',{version:savedRequest.version,status:'archived',admin_note:''},'PATCH')).status,409);
    assert.equal((await get('/api/admin/orders/AUR-review-test')).order.admin_note,'Validada');
    assert.equal((await get('/api/products')).orders,undefined);
    const preview = await (await raw('/api/admin/inventory/preview', await fixture({
      count: 55
    }))).json();
    assert.equal(preview.summary.total, 55);
    assert.equal((await get('/api/admin/overview')).products.length, 0);
    const template = await send('/api/admin/catalog/export', {
      token: preview.token,
      selection: preview.records.map(r => r.index)
    });
    assert.equal(template.status, 200);
    assert.match(template.headers.get('content-type'), /spreadsheet/);
    const w = new ExcelJS.Workbook();
    await w.xlsx.load(Buffer.from(await template.arrayBuffer()));
    const sheet = w.getWorksheet('catalogo');
    assert.equal(sheet.rowCount, 56);
    const committed = await send('/api/admin/inventory/commit', {
      token: preview.token,
      selection: preview.records.map(r => r.index)
    });
    assert.equal(committed.status, 200);
    assert.equal((await get('/api/admin/overview')).products.length, 55);
    // Only the first four references are enriched. No remote website is fetched.
    const catalogW = new ExcelJS.Workbook(),
      catalogSheet = catalogW.addWorksheet('catalogo');
    for (let n = 1; n <= 5; n++) catalogSheet.addRow(sheet.getRow(n).values.slice(1));
    for (let n = 2; n <= 5; n++) {
      for (const [c, v] of [[4, 'Colección'], [5, 'Cuarzo'], [6, 40], [7, 'Acero'], [8, 'Zafiro'], [9, '100 metros'], [10, 'Azul'], [13, 'Acero'], [14, 'https://example.com/photo.webp']]) catalogSheet.getRow(n).getCell(c).value = v;
    }
    const technical = await (await raw('/api/admin/catalog/preview', Buffer.from(await catalogW.xlsx.writeBuffer()))).json();
    assert.equal(technical.rows.length, 4);
    assert.equal((await get('/api/products')).products.length, 0);
    const saved = await (await send('/api/admin/catalog/commit', {
      token: technical.token
    })).json();
    assert.equal(saved.published, 4);
    let list = (await get('/api/products')).products;
    assert.equal(list.length, 4);
    const p = list[0];
    assert.equal(p.availability, 'available');
    assert.equal(p.delivery_days, '5 a 10 días hábiles');
    const allowed = ['id', 'brand', 'name', 'reference', 'variant', 'description', 'image_url', 'collection', 'movement', 'diameter_mm', 'style', 'condition', 'material', 'crystal', 'water_resistance', 'dial_color', 'case_color', 'strap_color', 'strap', 'package_contents', 'provenance', 'images', 'availability', 'price_cop', 'delivery_days', 'warranty', 'shipping_terms', 'is_demo'];
    assert.deepEqual(Object.keys(p).sort(), allowed.sort());
    assert.equal((await send('/api/orders', {
      items: [{
        id: p.id,
        quantity: 2
      }]
    })).status, 201);
    const db = new DatabaseSync(dbPath);
    db.prepare('UPDATE products SET last_confirmed_at=? WHERE id=?').run(new Date(Date.now() - 4 * 86400000).toISOString(), p.id);
    db.close();
    assert.equal((await get('/api/products')).products.length, 3);
    assert.equal((await send('/api/orders', {
      items: [{
        id: p.id,
        quantity: 1
      }]
    })).status, 409);
    let overview = await get('/api/admin/overview');
    assert.equal(overview.products.find(x => x.id === p.id).effective_status, 'requires_confirmation');
    assert.equal((await send('/api/admin/publications/action', {
      ids: [p.id],
      action: 'confirm'
    })).status, 200);
    assert.equal((await get('/api/products')).products.length, 4);
    const ids = overview.products.filter(p => p.published_at).map(p => p.id);
    const publicationFile = await send('/api/admin/publications/export', {
      ids
    });
    assert.equal(publicationFile.status, 200);
    const out = new ExcelJS.Workbook();
    await out.xlsx.load(Buffer.from(await publicationFile.arrayBuffer()));
    assert.equal(out.getWorksheet('publicaciones').rowCount, 5);
    await send('/api/admin/publications/action', {
      ids: ids.slice(0, 2),
      action: 'pause'
    });
    assert.equal((await get('/api/products')).products.length, 2);
    await send('/api/admin/publications/action', {
      ids: ids.slice(0, 2),
      action: 'reactivate'
    });
    assert.equal((await get('/api/products')).products.length, 4);
    assert.equal((await send('/api/admin/settings', {
      delivery_days: '7 a 12 días hábiles',
      warranty: '12 meses',
      shipping_terms: 'Envío nacional'
    }, 'PUT')).status, 200);
    list = (await get('/api/products')).products;
    assert.ok(list.every(p => p.delivery_days === '7 a 12 días hábiles' && p.warranty === '12 meses' && p.shipping_terms === 'Envío nacional'));
    await send('/api/admin/settings', {
      min_margin: .8
    }, 'PUT');
    assert.equal((await get('/api/products')).products.length, 0);
    overview = await get('/api/admin/overview');
    assert.ok(overview.products.filter(p => p.published_at).every(p => p.status === 'paused' && /Margen/.test(p.pause_reason)));
    const invalid = await send('/api/admin/images', {
      base64: Buffer.from('<svg>bad</svg>').toString('base64')
    });
    assert.equal(invalid.status, 400);
    for (const path of ['/api/admin/enrichment/start', '/api/admin/bulk/preview', '/api/admin/templates', '/api/admin/sync']) assert.equal((await send(path, {})).status, 404);
    assert.equal((await send('/api/admin/import', {})).status, 410);
    assert.equal((await send('/api/admin/logout', {})).status, 200);
    assert.equal((await fetch(base + '/api/admin/overview', {
      headers: {
        cookie
      }
    })).status, 401);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await once(child, 'exit');
    }
    await rm(dir, {
      recursive: true,
      force: true
    });
  }
});
