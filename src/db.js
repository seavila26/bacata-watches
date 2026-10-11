import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { identityKey, sourceFinance, publicationIssues, publicationState, GLOBAL_DEFAULTS } from './catalog-model.js';
const path = resolve(process.env.DB_PATH || 'data/aurel.sqlite');
mkdirSync(dirname(path), {
  recursive: true
});
export const db = new DatabaseSync(path);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,items_json TEXT NOT NULL,total_cop INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'payment_pending',created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,action TEXT NOT NULL,subject TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY AUTOINCREMENT,status TEXT NOT NULL,source TEXT NOT NULL,imported INTEGER NOT NULL DEFAULT 0,error TEXT,started_at TEXT NOT NULL,finished_at TEXT);
CREATE TABLE IF NOT EXISTS field_history(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id TEXT NOT NULL,field TEXT NOT NULL,value_json TEXT NOT NULL,source_url TEXT NOT NULL,method TEXT NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL);
`);
const fields = {
  id: 'TEXT PRIMARY KEY',
  identity_key: 'TEXT NOT NULL UNIQUE',
  brand: 'TEXT NOT NULL',
  reference: 'TEXT NOT NULL',
  name: "TEXT NOT NULL DEFAULT ''",
  variant: "TEXT NOT NULL DEFAULT ''",
  description: "TEXT NOT NULL DEFAULT ''",
  image_url: "TEXT NOT NULL DEFAULT ''",
  images_json: "TEXT NOT NULL DEFAULT '[]'",
  supplier: "TEXT NOT NULL DEFAULT 'Jomashop'",
  supplier_url: "TEXT NOT NULL DEFAULT ''",
  price_usd: 'REAL CHECK(price_usd>=0)',
  shipping_usd: 'REAL NOT NULL DEFAULT 0 CHECK(shipping_usd>=0)',
  market_cop: 'INTEGER NOT NULL DEFAULT 0 CHECK(market_cop>=0)',
  approved_price_cop: 'INTEGER',
  source_snapshot_json: 'TEXT',
  source_updated_at: 'TEXT',
  reviewed_at: 'TEXT',
  status: "TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','paused'))",
  published_at: 'TEXT',
  last_confirmed_at: 'TEXT',
  pause_reason: "TEXT NOT NULL DEFAULT ''",
  updated_at: 'TEXT NOT NULL',
  diameter_mm: 'REAL',
  ...Object.fromEntries(['collection', 'movement', 'style', 'condition', 'material', 'crystal', 'water_resistance', 'dial_color', 'case_color', 'strap_color', 'strap', 'package_contents', 'provenance'].map(k => [k, "TEXT NOT NULL DEFAULT ''"]))
};
const create = name => `CREATE TABLE ${name}(${Object.entries(fields).map(([k, v]) => `${k} ${v}`).join(',')})`;
// The migration is atomic: retain product identity, merchandising, photos, prices,
// orders and audit history; remove only the retired workflow's tables/columns.
db.exec('BEGIN IMMEDIATE');
try {
  db.exec('DROP TABLE IF EXISTS enrichment_items; DROP TABLE IF EXISTS enrichment_jobs; DROP TABLE IF EXISTS catalog_templates;');
  const exists = db.prepare("SELECT sql FROM sqlite_master WHERE name='products' AND type='table'").get();
  if (!exists) db.exec(create('products'));else {
    const oldColumns = new Set(db.prepare('PRAGMA table_info(products)').all().map(c => c.name));
    if (Object.keys(fields).some(k => !oldColumns.has(k)) || [...oldColumns].some(k => !(k in fields)) || exists.sql.includes("'discarded'")) {
      db.exec(create('products_next'));
      const insert = db.prepare(`INSERT INTO products_next(${Object.keys(fields).join(',')}) VALUES(${Object.keys(fields).map(() => '?').join(',')})`);
      for (const p of db.prepare('SELECT * FROM products').all()) {
        const row = {
          ...p,
          identity_key: identityKey(p.brand, p.reference),
          status:p.status==='discarded'?'paused':p.status,
          published_at: p.published_at || (p.status === 'published' ? p.reviewed_at || p.updated_at : null),
          last_confirmed_at: p.last_confirmed_at || p.source_updated_at || null,
          pause_reason: p.pause_reason || (['paused','discarded'].includes(p.status) ? 'Pausa manual' : '')
        };
        insert.run(...Object.keys(fields).map(k => row[k] ?? (fields[k].includes("DEFAULT '[]'") ? '[]' : fields[k].includes("DEFAULT '") ? k === 'supplier' ? 'Jomashop' : '' : fields[k].includes('DEFAULT 0') ? 0 : null)));
      }
      db.exec('DROP TABLE products; ALTER TABLE products_next RENAME TO products;');
    }
  }
  db.exec("DELETE FROM settings WHERE key IN ('market_factor','shipping_buffer_cop','auto_publish'); COMMIT");
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}
export const set = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
for (const [k, v] of Object.entries(GLOBAL_DEFAULTS)) db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').run(k, v);
export const settings = () => Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x => [x.key, x.value]));
export function audit(actor, action, subject, details = {}) {
  db.prepare('INSERT INTO audit(actor,action,subject,details,created_at) VALUES(?,?,?,?,?)').run(actor, action, subject, JSON.stringify(details), new Date().toISOString());
}
export function calculate(p, s = settings()) {
  const source = p.source_snapshot_json ? JSON.parse(p.source_snapshot_json) : {
    price_usd: p.price_usd,
    shipping_usd: p.shipping_usd,
    market_cop: p.market_cop,
    evidence: p.market_cop > 0
  };
  return sourceFinance(source, p.approved_price_cop, s);
}
export function decorate(p, s = settings()) {
  const analysis = calculate(p, s);
  return {
    ...p,
    effective_status: publicationState(p, Date.now(), analysis),
    pause_reason: p.status === 'published' && publicationIssues(p, analysis).length ? publicationIssues(p, analysis).join('; ') : p.pause_reason,
    images: JSON.parse(p.images_json || '[]'),
    source: p.source_snapshot_json ? JSON.parse(p.source_snapshot_json) : null,
    analysis,
    publication_issues: publicationIssues(p, analysis)
  };
}
if (!db.prepare('SELECT count(*) n FROM products').get().n && process.env.SEED_DEMO === 'true') {
  const now = new Date().toISOString();
  for (let i = 0; i < 10; i++) db.prepare('INSERT INTO products(id,identity_key,brand,reference,name,price_usd,shipping_usd,market_cop,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(`demo-${i}`, identityKey('Demo', `DEMO-${i}`), 'Demo', `DEMO-${i}`, `Reloj de demostración ${i}`, 100, 25, 2000000, now);
  audit('system', 'seed', 'products', {
    count: 10
  });
}
