// Run against a supplier file without changing the application's database.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const path = process.argv[2];
if (!path) {
  console.error('Uso: npm run test:inventory -- ruta/al/inventario.xlsx');
  process.exit(1);
}
const dir = await mkdtemp(join(tmpdir(), 'bacata-inventory-'));
process.env.DB_PATH = join(dir, 'test.sqlite');
process.env.SEED_DEMO = 'false';
const {
  db
} = await import('../src/db.js');
const {
  previewInventory,
  commitInventory
} = await import('../src/inventory-import.js');
try {
  const p = await previewInventory(await readFile(path), 'verification');
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n, 0);
  const rows = p.records.filter(r => !r.errors.length);
  const c = commitInventory(p.token, rows.map(r => r.index), 'verification');
  const counts = db.prepare('SELECT count(*) n FROM products').get();
  assert.equal(counts.n, c.imported);
  assert.equal(db.prepare("SELECT count(*) n FROM products WHERE status!='pending'").get().n, 0);
  console.log(JSON.stringify({
    summary: p.summary,
    duplicates: p.duplicates,
    formula_errors: p.formula_errors,
    saved: c
  }, null, 2));
} finally {
  db.close();
  await rm(dir, {
    recursive: true,
    force: true
  });
}
