/** Private, WAL-aware database and upload backups. No credentials are copied. */
import { DatabaseSync } from 'node:sqlite';
import { mkdir, readdir, lstat, copyFile, chmod, writeFile, readFile, rename, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { resolve, join, sep, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const FORMAT = 'bacata-backup-v1';
const BACKUP_NAME = /^bacata-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9]{8}$/;
const inside = (root, path) => path === root || path.startsWith(root + sep);
async function digest(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
async function filesBelow(root, prefix = '') {
  const files = [];
  for (const item of await readdir(join(root, prefix), { withFileTypes: true })) {
    const name = join(prefix, item.name);
    if (item.isSymbolicLink()) throw Error('No se respaldan enlaces simbólicos: ' + name);
    if (item.isDirectory()) files.push(...await filesBelow(root, name));
    else if (item.isFile()) files.push(name);
    else throw Error('Archivo no regular en fotografías: ' + name);
  }
  return files.sort();
}
function inspectDatabase(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    if (db.prepare('PRAGMA integrity_check').all().some(row => row.integrity_check !== 'ok')) throw Error('Falló la integridad de SQLite');
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw Error('SQLite contiene referencias inconsistentes');
    const counts = {};
    for (const table of ['products', 'orders', 'audit']) {
      if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)) counts[table] = db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total;
    }
    if (counts.products === undefined) throw Error('La base no contiene el catálogo de Bacatá');
    const images = db.prepare('SELECT image_url, images_json FROM products').all().flatMap(row => {
      const extra = JSON.parse(row.images_json || '[]');
      if (!Array.isArray(extra)) throw Error('Galería de producto inválida');
      return [row.image_url, ...extra].filter(url => typeof url === 'string' && url.startsWith('/uploads/'));
    });
    return { counts, images: [...new Set(images)] };
  } finally { db.close(); }
}
export async function verifyBackup(directory) {
  const root = resolve(directory);
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
  if (manifest.format !== FORMAT || !Array.isArray(manifest.files)) throw Error('Formato de respaldo inválido');
  const seen = new Set();
  for (const file of manifest.files) {
    if (typeof file.path !== 'string' || seen.has(file.path)) throw Error('Archivo duplicado o inválido');
    seen.add(file.path);
    const path = resolve(root, file.path);
    if (!inside(root, path) || path === root || (file.path !== 'aurel.sqlite' && !file.path.startsWith('uploads/'))) throw Error('Ruta inválida en respaldo');
    const info = await lstat(path);
    if (!info.isFile() || info.size !== file.bytes || await digest(path) !== file.sha256) throw Error('Archivo alterado o incompleto: ' + file.path);
  }
  if (!seen.has('aurel.sqlite')) throw Error('Falta la base del respaldo');
  const db = inspectDatabase(join(root, 'aurel.sqlite'));
  if (JSON.stringify(db.counts) !== JSON.stringify(manifest.counts)) throw Error('Conteos de respaldo no coinciden');
  for (const url of db.images) {
    const name = 'uploads/' + url.slice('/uploads/'.length);
    if (!seen.has(name)) throw Error('Falta fotografía referenciada: ' + url);
  }
  return { ...db.counts, photos: manifest.files.length - 1, integrity: 'ok' };
}
export async function createBackup({ dbPath, uploadsDir, backupRoot, keep = 14, now = new Date() }) {
  if (!Number.isInteger(keep) || keep < 1 || keep > 365) throw Error('BACKUP_KEEP debe estar entre 1 y 365');
  const source = resolve(dbPath), uploads = resolve(uploadsDir), root = resolve(backupRoot);
  if (inside(uploads, root) || inside(root, uploads) || inside(root, source) || inside(resolve('public'), root)) throw Error('El respaldo debe quedar fuera de los archivos públicos y de los datos de origen');
  if (!(await lstat(source)).isFile()) throw Error('No existe una base regular para respaldar');
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(root, 0o700);
  const name = 'bacata-' + now.toISOString().replace(/[:.]/g, '-') + '-' + randomBytes(4).toString('hex');
  const partial = join(root, '.partial-' + name), destination = join(root, name);
  await mkdir(partial, { mode: 0o700 });
  try {
    const db = new DatabaseSync(source, { readOnly: true });
    try { db.prepare('VACUUM INTO ?').run(join(partial, 'aurel.sqlite')); } finally { db.close(); }
    await chmod(join(partial, 'aurel.sqlite'), 0o600);
    const data = inspectDatabase(join(partial, 'aurel.sqlite'));
    let photoNames = [];
    try {
      if (!(await lstat(uploads)).isDirectory()) throw Error('La ruta de fotografías debe ser una carpeta regular');
      photoNames = await filesBelow(uploads);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await mkdir(join(partial, 'uploads'), { mode: 0o700 });
    for (const name of photoNames) {
      const target = join(partial, 'uploads', name);
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      await copyFile(join(uploads, name), target);
      await chmod(target, 0o600);
    }
    const files = [];
    for (const name of ['aurel.sqlite', ...photoNames.map(name => join('uploads', name))]) {
      const path = join(partial, name);
      files.push({ path: name.split(sep).join('/'), bytes: (await lstat(path)).size, sha256: await digest(path) });
    }
    await writeFile(join(partial, 'manifest.json'), JSON.stringify({ format: FORMAT, created_at: now.toISOString(), counts: data.counts, files }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    const verification = await verifyBackup(partial);
    await rename(partial, destination);
    // Rotate only this tool's completed backups; unrelated directories are untouched.
    const previous = [];
    for (const item of await readdir(root, { withFileTypes: true })) {
      if (!item.isDirectory() || !BACKUP_NAME.test(item.name)) continue;
      try {
        const manifest = JSON.parse(await readFile(join(root, item.name, 'manifest.json'), 'utf8'));
        if (manifest.format === FORMAT) previous.push(item.name);
      } catch { /* Unknown or incomplete data is never deleted. */ }
    }
    previous.sort().reverse();
    for (const old of previous.slice(keep)) await rm(join(root, old), { recursive: true });
    return { path: destination, ...verification };
  } catch (error) {
    await rm(partial, { recursive: true, force: true });
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] === '--verify') {
      if (!process.argv[3]) throw Error('Uso: npm run backup:verify -- /ruta/del/respaldo');
      console.log(JSON.stringify(await verifyBackup(process.argv[3]), null, 2));
    } else {
      if (process.argv.length > 2) throw Error('Argumento desconocido');
      console.log(JSON.stringify(await createBackup({
        dbPath: process.env.DB_PATH || 'data/aurel.sqlite',
        uploadsDir: resolve('public/uploads'),
        backupRoot: process.env.BACKUP_DIR || resolve('../bacata-backups'),
        keep: Number(process.env.BACKUP_KEEP || 14)
      }), null, 2));
    }
  } catch (error) { console.error('Respaldo fallido: ' + error.message); process.exitCode = 1; }
}
