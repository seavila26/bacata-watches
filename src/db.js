import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {identityKey,sourceFinance,publicationIssues} from './catalog-model.js';
const path=resolve(process.env.DB_PATH||'data/aurel.sqlite');mkdirSync(dirname(path),{recursive:true});
export const db=new DatabaseSync(path);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products(
 id TEXT PRIMARY KEY,brand TEXT NOT NULL,name TEXT NOT NULL,reference TEXT NOT NULL UNIQUE,
 variant TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',image_url TEXT NOT NULL DEFAULT '',
 supplier TEXT NOT NULL DEFAULT 'Importación autorizada',supplier_url TEXT NOT NULL DEFAULT '',
 price_usd REAL NOT NULL CHECK(price_usd>=0),shipping_usd REAL NOT NULL DEFAULT 0 CHECK(shipping_usd>=0),
 market_cop INTEGER NOT NULL DEFAULT 0 CHECK(market_cop>=0),stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0),
 delivery_days TEXT NOT NULL DEFAULT 'Por confirmar',status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','discarded','paused')),
 source_updated_at TEXT,reviewed_at TEXT,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,items_json TEXT NOT NULL,total_cop INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'payment_pending',created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,action TEXT NOT NULL,subject TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY AUTOINCREMENT,status TEXT NOT NULL,source TEXT NOT NULL,imported INTEGER NOT NULL DEFAULT 0,error TEXT,started_at TEXT NOT NULL,finished_at TEXT);
`);
// Additive migration; preserve all existing records, orders and audit history.
const columns = new Set(db.prepare('PRAGMA table_info(products)').all().map(c => c.name));
const additions = {
 identity_key: 'TEXT', sale_mode: "TEXT NOT NULL DEFAULT 'available'", approved_price_cop: 'INTEGER',
 manual_cost_cop: 'REAL', cost_verified: 'INTEGER NOT NULL DEFAULT 0', supplier_confirmed_at: 'TEXT',
 source_snapshot_json: 'TEXT', collection: "TEXT NOT NULL DEFAULT ''", movement: "TEXT NOT NULL DEFAULT ''",
 diameter_mm: 'REAL', style: "TEXT NOT NULL DEFAULT ''", condition: "TEXT NOT NULL DEFAULT ''",
 material: "TEXT NOT NULL DEFAULT ''", crystal: "TEXT NOT NULL DEFAULT ''", water_resistance: "TEXT NOT NULL DEFAULT ''",
 dial_color: "TEXT NOT NULL DEFAULT ''", case_color: "TEXT NOT NULL DEFAULT ''", strap_color: "TEXT NOT NULL DEFAULT ''", strap: "TEXT NOT NULL DEFAULT ''", warranty: "TEXT NOT NULL DEFAULT ''",
 package_contents: "TEXT NOT NULL DEFAULT ''", provenance: "TEXT NOT NULL DEFAULT ''",
 shipping_terms: "TEXT NOT NULL DEFAULT ''", images_json: "TEXT NOT NULL DEFAULT '[]'"
};
db.exec('BEGIN IMMEDIATE');
try {
 // v0.3 made reference unique globally. Identity is now brand + exact reference.
 const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='products'").get().sql;
 if (/reference TEXT NOT NULL UNIQUE/.test(schema)) {
  db.exec(schema.replace('CREATE TABLE products','CREATE TABLE products_v4').replace('reference TEXT NOT NULL UNIQUE','reference TEXT NOT NULL'));
  db.exec('INSERT INTO products_v4 SELECT * FROM products; DROP TABLE products; ALTER TABLE products_v4 RENAME TO products;');
 }
 for (const [key, definition] of Object.entries(additions)) if (!columns.has(key)) db.exec(`ALTER TABLE products ADD COLUMN ${key} ${definition}`);
 for (const p of db.prepare('SELECT id,brand,reference FROM products WHERE identity_key IS NULL').all()) db.prepare('UPDATE products SET identity_key=? WHERE id=?').run(identityKey(p.brand,p.reference),p.id);
 db.exec('CREATE UNIQUE INDEX IF NOT EXISTS products_identity ON products(identity_key); COMMIT');
} catch (e) { db.exec('ROLLBACK'); throw e; }
db.exec(`
CREATE TABLE IF NOT EXISTS enrichment_jobs(id TEXT PRIMARY KEY,state TEXT NOT NULL,options_json TEXT NOT NULL,created_by TEXT NOT NULL,total INTEGER NOT NULL,created_at TEXT NOT NULL,finished_at TEXT);
CREATE TABLE IF NOT EXISTS enrichment_items(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES enrichment_jobs(id),product_id TEXT NOT NULL REFERENCES products(id),state TEXT NOT NULL,before_json TEXT NOT NULL,proposal_json TEXT,error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS enrichment_job_items ON enrichment_items(job_id,state);
CREATE TABLE IF NOT EXISTS catalog_templates(id TEXT PRIMARY KEY,name TEXT NOT NULL,fields_json TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS field_history(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id TEXT NOT NULL,field TEXT NOT NULL,value_json TEXT NOT NULL,source_url TEXT NOT NULL,method TEXT NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL);
`);
const set=db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
for(const [k,v] of Object.entries({fx:'4000',duty:'0.20',fee:'0.035',market_factor:'0.97',min_margin:'0.10',shipping_buffer_cop:'0',auto_publish:'false'}))db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').run(k,v);
export const settings=()=>Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]));
export function audit(actor,action,subject,details={}){db.prepare('INSERT INTO audit(actor,action,subject,details,created_at) VALUES(?,?,?,?,?)').run(actor,action,subject,JSON.stringify(details),new Date().toISOString())}
export function calculate(p,s=settings()){
 if (p.source_snapshot_json) {
  const a=sourceFinance(JSON.parse(p.source_snapshot_json),p.approved_price_cop,p.manual_cost_cop);
  return {...a,eligible:a.margin!=null&&a.margin>=+s.min_margin};
 }
 const fx=+s.fx,duty=+s.duty,fee=+s.fee,marketFactor=+s.market_factor;
 const supplier=Math.round(p.price_usd*fx),shipping=Math.round(p.shipping_usd*fx),importCost=Math.round((p.price_usd+p.shipping_usd)*fx*duty),buffer=+s.shipping_buffer_cop;
 const price=p.approved_price_cop??Math.round(p.market_cop*marketFactor/1000)*1000,commission=Math.round(price*fee);
 const cost=supplier+shipping+importCost+commission+buffer,profit=price-cost;
 return{supplier,shipping,importCost,commission,buffer,cost,price,profit,margin:price>0?profit/price:-1,eligible:price>0&&p.stock>0&&profit/price>=+s.min_margin};
}
export function decorate(p,s=settings()){
 const analysis=calculate(p,s);return{...p,images:JSON.parse(p.images_json||'[]'),source:p.source_snapshot_json?JSON.parse(p.source_snapshot_json):null,analysis,publication_issues:publicationIssues(p,analysis)};
}
const count=db.prepare('SELECT count(*) n FROM products').get().n;
if(!count&&process.env.SEED_DEMO!=='false'){
 const now=new Date().toISOString();
 const samples=[
 ['Norvane','Atlas 41','NV-4101-BLU','Azul medianoche, 41 mm',420,25,3200000,6,'published'],
 ['Halden','Chrono S','HD-2210-BLK','Negro carbón, 42 mm',610,30,4300000,3,'published'],
 ['Castellan','Heritage','CS-7788-CHP','Champaña, 39 mm',780,30,5900000,2,'published'],
 ['Solace','Slim','SL-1102-IVR','Marfil, 36 mm',300,20,2100000,9,'published'],
 ['Vantor','Diver 300','VT-3005-GRN','Verde bosque, 43 mm',540,30,3600000,5,'pending'],
 ['Meridian','Field GMT','MF-5520-GMT','Gris humo, 40 mm',690,30,4400000,4,'pending'],
 ['Norvane','Atlas 38','NV-3802-GRY','Gris pizarra, 38 mm',460,25,2900000,7,'pending'],
 ['Halden','Pilot','HD-9001-BRZ','Bronce, 44 mm',880,35,5100000,2,'pending'],
 ['Castellan','Regatta','CS-6100-RED','Rojo vino, 41 mm',1050,40,5900000,1,'discarded'],
 ['Solace','Sport Titanio','SL-2450-TIT','Titanio gris, 41 mm',650,30,3900000,4,'pending']];
 const ins=db.prepare(`INSERT INTO products(id,brand,name,reference,variant,description,price_usd,shipping_usd,market_cop,stock,status,source_updated_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`);
 for(const [brand,name,reference,variant,usd,ship,market,stock,status] of samples)ins.run(reference.toLowerCase(),brand,name,reference,variant,`Reloj ${name} en variante ${variant}. Ficha e ilustración de demostración.`,usd,ship,market,stock,status,now,now);
 audit('system','seed','products',{count:samples.length});
}
for(const p of db.prepare('SELECT id,brand,reference FROM products WHERE identity_key IS NULL').all())db.prepare('UPDATE products SET identity_key=? WHERE id=?').run(identityKey(p.brand,p.reference),p.id);
export {set};
