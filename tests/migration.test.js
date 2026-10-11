import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
test('legacy migration removes retired schema while preserving products, photos, approved prices and history', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bacata-migrate-')),
    path = join(dir, 'old.sqlite');
  try {
    const db = new DatabaseSync(path);
    db.exec(`CREATE TABLE products(id TEXT PRIMARY KEY,brand TEXT NOT NULL,name TEXT NOT NULL,reference TEXT NOT NULL UNIQUE,variant TEXT NOT NULL,description TEXT,images_json TEXT,image_url TEXT,price_usd REAL,shipping_usd REAL,market_cop INTEGER,approved_price_cop INTEGER,stock INTEGER,sale_mode TEXT,manual_cost_cop REAL,cost_verified INTEGER,supplier_confirmed_at TEXT,delivery_days TEXT,status TEXT,source_updated_at TEXT,updated_at TEXT);
 CREATE TABLE enrichment_jobs(id TEXT PRIMARY KEY);CREATE TABLE enrichment_items(id TEXT PRIMARY KEY,job_id TEXT REFERENCES enrichment_jobs(id),product_id TEXT REFERENCES products(id));CREATE TABLE catalog_templates(id TEXT);
 CREATE TABLE audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT,action TEXT,subject TEXT,details TEXT,created_at TEXT);INSERT INTO audit(actor,action,subject,details,created_at) VALUES('admin','old_action','legacy','{}','2026-10-10');
 CREATE TABLE orders(id TEXT PRIMARY KEY,items_json TEXT,total_cop INTEGER,status TEXT,created_at TEXT);INSERT INTO orders VALUES('old-order','[]',100,'payment_pending','2026-10-10');`);
    db.prepare('INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('old', 'Bulova', 'Nombre conservado', 'REF / 1-2.3', 'Azul', 'Texto conservado', '["https://example.com/back.webp"]', 'https://example.com/main.webp', 100, 35, 3000000, 2900000, 4, 'on_order', 500000, 1, '2026-10-10', '20 días', 'published', '2026-10-10', '2026-10-10');
    db.close();
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', "import './src/db.js';"], {
      env: {
        ...process.env,
        DB_PATH: path,
        SEED_DEMO: 'false'
      },
      encoding: 'utf8'
    });
    assert.equal(run.status, 0, run.stderr);
    const migrated = new DatabaseSync(path),
      p = migrated.prepare('SELECT * FROM products').get();
    assert.equal(p.id, 'old');
    assert.equal(p.name, 'Nombre conservado');
    assert.equal(p.description, 'Texto conservado');
    assert.equal(p.approved_price_cop, 2900000);
    assert.equal(p.images_json, '["https://example.com/back.webp"]');
    assert.equal(p.identity_key, '["BULOVA","REF / 1-2.3"]');
    assert.equal(p.published_at, '2026-10-10');
    assert.equal(p.last_confirmed_at, '2026-10-10');
    const columns = migrated.prepare('PRAGMA table_info(products)').all().map(c => c.name);
    for (const k of ['stock', 'sale_mode', 'manual_cost_cop', 'cost_verified', 'supplier_confirmed_at', 'delivery_days']) assert.equal(columns.includes(k), false);
    for (const k of ['enrichment_jobs', 'enrichment_items', 'catalog_templates']) assert.equal(migrated.prepare('SELECT name FROM sqlite_master WHERE name=?').get(k), undefined);
    assert.equal(migrated.prepare('SELECT count(*) n FROM audit').get().n, 1);
    assert.equal(migrated.prepare('SELECT count(*) n FROM orders').get().n, 1);
    migrated.close();
    const again = spawnSync(process.execPath, ['--input-type=module', '-e', "import './src/db.js';"], {
      env: {
        ...process.env,
        DB_PATH: path,
        SEED_DEMO: 'false'
      },
      encoding: 'utf8'
    });
    assert.equal(again.status, 0, again.stderr);
  } finally {
    await rm(dir, {
      recursive: true,
      force: true
    });
  }
});
