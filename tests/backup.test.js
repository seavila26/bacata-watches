import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createBackup, verifyBackup } from '../scripts/backup.mjs';

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'bacata-backup-test-'));
  const uploadsDir = join(dir, 'uploads');
  await mkdir(uploadsDir);
  const dbPath = join(dir, 'live.sqlite');
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE products(id TEXT PRIMARY KEY,image_url TEXT,images_json TEXT); CREATE TABLE orders(id TEXT); CREATE TABLE audit(id INTEGER); INSERT INTO products VALUES('first','/uploads/watch.jpg','[]'); INSERT INTO orders VALUES('order-1');");
  await writeFile(join(uploadsDir, 'watch.jpg'), Buffer.from('photo-content'));
  return { dir, db, dbPath, uploadsDir, backupRoot: join(dir, 'backups') };
}
test('backup reads committed WAL, restores independently, verifies images and detects altered files', async () => {
  const f = await fixture();
  try {
    // Keep the live connection open so the new row remains in the WAL.
    f.db.exec("INSERT INTO products VALUES('from-wal','','[]')");
    const result = await createBackup(f);
    assert.equal(result.products, 2);
    assert.equal(result.photos, 1);
    assert.equal(result.integrity, 'ok');
    const restore = join(f.dir, 'restored.sqlite');
    await writeFile(restore, await readFile(join(result.path, 'aurel.sqlite')));
    const db = new DatabaseSync(restore, { readOnly: true });
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products').get().n, 2);
    db.close();
    await writeFile(join(result.path, 'uploads/watch.jpg'), 'tampered');
    await assert.rejects(verifyBackup(result.path), /alterado o incompleto/);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM products').get().n, 2);
  } finally { f.db.close(); await rm(f.dir, { recursive: true, force: true }); }
});
test('missing referenced photograph aborts backup without pruning older successful copies', async () => {
  const f = await fixture();
  try {
    const first = await createBackup({ ...f, keep: 1 });
    await rm(join(f.uploadsDir, 'watch.jpg'));
    await assert.rejects(createBackup({ ...f, keep: 1 }), /Falta fotografía/);
    assert.deepEqual(await readdir(f.backupRoot), [first.path.split('/').pop()]);
    assert.equal((await verifyBackup(first.path)).products, 1);
  } finally { f.db.close(); await rm(f.dir, { recursive: true, force: true }); }
});
test('rotation retains requested complete backups and preserves unrelated directories', async () => {
  const f = await fixture();
  try {
    await mkdir(f.backupRoot);
    await mkdir(join(f.backupRoot, 'manual-archive'));
    for (let day = 1; day <= 3; day++) await createBackup({ ...f, keep: 2, now: new Date(`2026-10-0${day}T08:00:00Z`) });
    const names = await readdir(f.backupRoot);
    assert.equal(names.length, 3);
    assert.ok(names.includes('manual-archive'));
    assert.ok(!names.some(name => name.startsWith('bacata-2026-10-01')));
    await assert.rejects(createBackup({ ...f, backupRoot: join(f.uploadsDir, 'unsafe') }), /fuera/);
  } finally { f.db.close(); await rm(f.dir, { recursive: true, force: true }); }
});
