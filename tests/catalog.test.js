import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
const temp = await mkdtemp(join(tmpdir(), 'bacata-test-'));
process.env.DB_PATH = join(temp, 'test.sqlite');
process.env.SEED_DEMO = 'false';
const {
  db,
  decorate,
  calculate,
  set,
  settings
} = await import('../src/db.js');
const {
  previewInventory,
  commitInventory
} = await import('../src/inventory-import.js');
const {
  editProduct
} = await import('../src/product-editor.js');
const {
  identityKey,
  publicProduct,
  publicationState,
  publicationIssues
} = await import('../src/catalog-model.js');
const {
  COLUMNS,
  exportCatalog,
  catalogRow,
  workbookBuffer
} = await import('../src/catalog-export.js');
const {
  previewCatalog,
  commitCatalog,
  exportPending
} = await import('../src/catalog-import.js');
const {
  publicationAction,
  isVisible,
  reconcileAll
} = await import('../src/publications.js');
after(async () => {
  db.close();
  await rm(temp, {
    recursive: true,
    force: true
  });
});
import { fixture } from './fixtures.js';
let firstId;
const complete = {
  collection: 'Marine Star',
  movement: 'Automático',
  diameter_mm: 43,
  material: 'Acero',
  crystal: 'Mineral',
  water_resistance: '200 metros',
  dial_color: 'Azul',
  strap: 'Acero',
  image_1: 'https://example.com/photo.webp'
};
async function sheet(rows) {
  return workbookBuffer(rows.map(r => ({
    ...Object.fromEntries(COLUMNS.map(k => [k, ''])),
    ...r
  })));
}
async function importSheet(rows) {
  const p = await previewCatalog(await sheet(rows), 'admin');
  return commitCatalog(p.token, 'admin');
}
function product() {
  return db.prepare('SELECT * FROM products WHERE id=?').get(firstId);
}
test('exact identity normalizes case and whitespace without losing punctuation', () => {
  assert.equal(identityKey('  Raymond   Weil ', ' ref / 1-2.3 '), identityKey('RAYMOND WEIL', 'REF / 1-2.3'));
  assert.notEqual(identityKey('A', '1.2'), identityKey('A', '12'));
  assert.notEqual(identityKey('A', 'A/B'), identityKey('A', 'A-B'));
  assert.notEqual(identityKey('A', '1'), identityKey('B', '1'));
});
test('raw preview is read-only, merges duplicates, uses global costs and keeps formula errors unquotable', async () => {
  const p = await previewInventory(await fixture({
    lux: true
  }), 'admin');
  assert.equal(p.summary.total, 2);
  assert.equal(p.duplicates, 1);
  assert.equal(p.formula_errors, 1);
  assert.equal(p.records[1].analysis.margin, null);
  assert.equal(p.records[1].analysis.cost, null);
  assert.equal(p.records[1].analysis.suggested, null);
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n, 0);
  const a = p.records[0].analysis;
  assert.equal(a.fx, 4000);
  assert.equal(a.supplier, 544 * 4000);
  assert.equal(a.cost, a.supplier + a.shipping + a.importCost + a.commission + a.buffer);
  assert.equal(a.profit, a.price - a.cost);
  assert.equal(a.margin, a.profit / a.price);
  const c = commitInventory(p.token, [0, 1], 'admin');
  assert.equal(c.created, 2);
  firstId = db.prepare("SELECT id FROM products WHERE reference='96B349'").get().id;
  assert.ok(db.prepare('SELECT * FROM products').all().every(p => p.status === 'pending' && p.last_confirmed_at));
  assert.throws(() => commitInventory(p.token, [0], 'admin'), /venció/);
});
test('invalid raw values and a changed global model cannot bypass preview', async () => {
  let p = await previewInventory(await fixture({
    invalid: true
  }), 'admin');
  assert.equal(p.summary.blocked, 1);
  assert.throws(() => commitInventory(p.token, [0], 'admin'), /errores/);
  p = await previewInventory(await fixture(), 'admin');
  set.run('fee', '0.04');
  assert.throws(() => commitInventory(p.token, [0], 'admin'), /reglas cambiaron/);
  set.run('fee', '0.035');
});
test('template export has exact columns and only stored values, works before raw commit', async () => {
  const before = db.prepare('SELECT count(*) n FROM products').get().n;
  const p = await previewInventory(await fixture({
    count: 2
  }), 'admin');
  const buffer = await exportCatalog({
    token: p.token,
    selection: [0, 1]
  }, 'admin');
  const w = new ExcelJS.Workbook();
  await w.xlsx.load(buffer);
  const s = w.getWorksheet('catalogo');
  assert.equal(s.rowCount, 3);
  assert.deepEqual(s.getRow(1).values.slice(1), COLUMNS);
  assert.equal(s.getRow(2).getCell(3).value, 'https://www.jomashop.com/watch.html');
  assert.equal(s.getRow(2).getCell(4).value, '');
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n, before);
  assert.throws(() => db.prepare('UPDATE products SET identity_key=? WHERE id=?').run(identityKey('ROLEX', 'TEST/REF'), firstId), /UNIQUE/);
});
test('catalog preview is read-only; completed rows auto-publish and unknown identities are rejected', async () => {
  const p = await previewCatalog(await sheet([{
    brand: ' bulova ',
    reference: '96b349',
    ...complete
  }, {
    brand: 'Missing',
    reference: 'NO-SUCH',
    ...complete
  }]), 'admin');
  assert.equal(product().collection, '');
  assert.equal(p.rows[0].status, 'published');
  assert.equal(p.rows[1].rejected, true);
  const r = commitCatalog(p.token, 'admin');
  assert.equal(r.published, 1);
  assert.equal(r.rejected, 1);
  assert.equal(product().status, 'published');
  assert.ok(product().published_at);
  assert.ok(isVisible(product()));
  assert.equal(calculate(product()).price, Math.round(3792000 * .97));
  const report = new ExcelJS.Workbook();
  await report.xlsx.load(await exportPending(r.report_token, 'admin'));
  assert.equal(report.getWorksheet('pendientes').rowCount, 2);
});
test('empty cells preserve fields, photos, names, descriptions, financial data and approved price', async () => {
  editProduct(firstId, {
    name: 'Nombre manual',
    description: 'Descripción manual',
    approved_price_cop: 3700000,
    images: ['https://example.com/back.webp', 'https://example.com/side.webp']
  }, 'admin');
  const old = product();
  const r = await importSheet([{
    brand: 'Bulova',
    reference: '96B349',
    movement: 'Cuarzo',
    image_3: 'https://example.com/new-side.webp'
  }]);
  assert.equal(r.published, 1);
  const p = product();
  for (const k of ['name', 'description', 'approved_price_cop', 'price_usd', 'market_cop', 'source_snapshot_json', 'collection', 'image_url']) assert.equal(p[k], old[k]);
  assert.equal(p.movement, 'Cuarzo');
  assert.deepEqual(JSON.parse(p.images_json), ['https://example.com/back.webp', 'https://example.com/new-side.webp']);
  assert.equal(calculate(p).price, 3700000);
  const w = new ExcelJS.Workbook();
  await w.xlsx.load(await exportCatalog({
    ids: [firstId]
  }, 'admin'));
  assert.equal(w.getWorksheet('catalogo').getRow(2).getCell(16).value, 'https://example.com/new-side.webp');
});
test('missing technical fields and no comparable stay draft with explicit reasons', async () => {
  const r = await importSheet([{
    brand: 'Rolex',
    reference: 'TEST/REF',
    ...complete
  }]);
  assert.equal(r.pending, 1);
  assert.match(r.rows[0].reason, /Verificar precio/);
  assert.equal(db.prepare("SELECT status FROM products WHERE reference='TEST/REF'").get().status, 'pending');
  const p = await previewInventory(await fixture({
    count: 2
  }), 'admin');
  commitInventory(p.token, [1], 'admin');
  const missing = await importSheet([{
    brand: 'Bulova',
    reference: 'CODE / SPACE 2',
    collection: 'Test'
  }]);
  assert.equal(missing.pending, 1);
  assert.match(missing.rows[0].reason, /Completar movimiento/);
});
test('raw reimport confirms dates, keeps manual content and price, pauses only when margin falls', async () => {
  let p = await previewInventory(await fixture({
    price: 600,
    date: '2026-10-08'
  }), 'admin');
  let r = commitInventory(p.token, [0], 'admin');
  assert.equal(r.paused, 0);
  assert.equal(product().status, 'published');
  assert.equal(product().name, 'Nombre manual');
  assert.equal(product().approved_price_cop, 3700000);
  p = await previewInventory(await fixture({
    price: 900,
    date: '2026-10-09'
  }), 'admin');
  r = commitInventory(p.token, [0], 'admin');
  assert.equal(r.paused, 1);
  assert.match(product().pause_reason, /Margen/);
  assert.equal(product().movement, 'Cuarzo');
  assert.equal(product().image_url, complete.image_1);
  const low = await importSheet([{
    brand: 'Bulova',
    reference: '96B349'
  }]);
  assert.equal(low.low_margin, 1);
  const older = await previewInventory(await fixture(), 'admin');
  assert.equal(older.summary.blocked, 1);
  p = await previewInventory(await fixture({
    price: 544,
    date: '2026-10-10'
  }), 'admin');
  commitInventory(p.token, [0], 'admin');
  const recovered=await importSheet([{brand:'Bulova',reference:'96B349'}]);
  assert.equal(recovered.published,1);
  assert.equal(product().status, 'published');
});
test('three-day threshold hides expired publications and requires explicit confirmation', () => {
  const p = product(),
    at = Date.parse(p.last_confirmed_at);
  assert.equal(publicationState(p, at + 3 * 86400000), 'published');
  assert.equal(publicationState(p, at + 3 * 86400000 + 1), 'requires_confirmation');
  assert.equal(isVisible(p, at + 3 * 86400000 + 1), false);
  db.prepare('UPDATE products SET last_confirmed_at=? WHERE id=?').run(new Date(Date.now() - 4 * 86400000).toISOString(), firstId);
  assert.equal(decorate(product()).effective_status, 'requires_confirmation');
  assert.equal(publicationAction([firstId], 'confirm', 'admin').results[0].ok, true);
  assert.equal(isVisible(product()), true);
});
test('manual pause survives both imports; absent references are preserved', async () => {
  publicationAction([firstId], 'pause', 'admin');
  const publishedAt = product().published_at;
  const r = await importSheet([{
    brand: 'Bulova',
    reference: '96B349',
    movement: 'Automático'
  }]);
  assert.equal(r.pending, 1);
  assert.equal(product().status, 'paused');
  assert.match(r.rows[0].reason, /Pausa manual/);
  const p = await previewInventory(await fixture({
    price: 550,
    date: '2026-10-11'
  }), 'admin');
  commitInventory(p.token, [0], 'admin');
  assert.equal(product().status, 'paused');
  assert.equal(product().published_at, publishedAt);
  assert.ok(db.prepare("SELECT * FROM products WHERE reference='TEST/REF'").get());
  publicationAction([firstId], 'reactivate', 'admin');
});
test('global rule changes recalculate and pause with audit; all public fields follow allowlist', () => {
  const p = product(),
    publicP = publicProduct(p, calculate(p), settings());
  assert.equal(publicP.availability, 'available');
  assert.equal(publicP.delivery_days, '5 a 10 días hábiles');
  for (const k of ['stock', 'sale_mode', 'supplier_url', 'price_usd', 'shipping_usd', 'market_cop', 'source_snapshot_json', 'analysis', 'approved_price_cop', 'margin', 'cost', 'pause_reason']) assert.equal(k in publicP, false);
  set.run('min_margin', '0.8');
  reconcileAll('admin');
  assert.equal(product().status, 'paused');
  assert.match(product().pause_reason, /Margen/);
  assert.ok(db.prepare("SELECT * FROM audit WHERE action='product_paused'").all().length);
  set.run('min_margin', '0.10');
});
test('concurrent edits rollback complete raw and technical batches', async () => {
  let p = await previewInventory(await fixture({
    date: '2026-10-12',
    count: 2
  }), 'admin');
  const second = db.prepare("SELECT * FROM products WHERE reference='CODE / SPACE 2'").get();
  editProduct(firstId, {
    description: 'Cambio concurrente'
  }, 'admin');
  assert.throws(() => commitInventory(p.token, [1, 0], 'admin'), /cambió/);
  assert.equal(db.prepare('SELECT updated_at FROM products WHERE id=?').get(second.id).updated_at, second.updated_at);
  const old = product();
  const c = await previewCatalog(await sheet([{
    brand: 'Bulova',
    reference: 'CODE / SPACE 2',
    movement: 'Cambio'
  }, {
    brand: 'Bulova',
    reference: '96B349',
    movement: 'Cambio'
  }]), 'admin');
  editProduct(firstId, {
    description: 'Otro cambio'
  }, 'admin');
  assert.throws(() => commitCatalog(c.token, 'admin'), /cambió/);
  assert.equal(db.prepare('SELECT movement FROM products WHERE id=?').get(second.id).movement, second.movement);
  assert.equal(product().movement, old.movement);
});
test('catalog rejects wrong headers, duplicates and unsafe images without downloading URLs', async () => {
  const w = new ExcelJS.Workbook();
  w.addWorksheet('catalogo').addRow([...COLUMNS, 'price']);
  const p = await previewCatalog(await sheet([{
    brand: 'Bulova',
    reference: '96B349',
    image_1: 'javascript:alert(1)'
  }, {
    brand: 'Bulova',
    reference: '96B349'
  }]), 'admin');
  assert.equal(p.rows[0].rejected, true);
  assert.equal(p.rows[1].rejected, true);
  await assert.rejects(previewCatalog(Buffer.from(await w.xlsx.writeBuffer()), 'admin'), /16 columnas/);
  assert.throws(() => editProduct(firstId, {
    stock: 1
  }, 'admin'), /Campo/);
  assert.throws(() => editProduct(firstId, {
    image_url: 'javascript:alert(1)'
  }, 'admin'), /imagen/);
});
