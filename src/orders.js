import { db, audit } from './db.js';
import { paymentSummary } from './wompi.js';
import { httpError } from './security.js';
const columns = new Set(db.prepare('PRAGMA table_info(orders)').all().map(c => c.name));
db.exec('BEGIN IMMEDIATE');
try {
  if (!columns.has('admin_note')) db.exec("ALTER TABLE orders ADD COLUMN admin_note TEXT NOT NULL DEFAULT ''");
  if (!columns.has('version')) db.exec('ALTER TABLE orders ADD COLUMN version INTEGER NOT NULL DEFAULT 0');
  if (!columns.has('updated_at')) db.exec("ALTER TABLE orders ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
  db.exec('COMMIT');
} catch (e) { db.exec('ROLLBACK'); throw e; }
export const requestStates = ['payment_pending', 'reviewed', 'archived'];
function detail(row) {
  return { id:row.id, status:row.status, created_at:row.created_at, updated_at:row.updated_at || row.created_at, total_cop:row.total_cop, admin_note:row.admin_note, version:row.version, items:JSON.parse(row.items_json), payment:paymentSummary(row.id) };
}
export function requestDetail(id) {
  const row = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
  if (!row) throw httpError(404, 'Solicitud no encontrada');
  return detail(row);
}
export function requestList(query) {
  const search = (query.get('q') || '').trim();
  const status = query.get('status') || '';
  const raw = query.get('page') || '1';
  if (search.length > 100 || (status && !requestStates.includes(status)) || !/^[1-9]\d{0,5}$/.test(raw)) throw httpError(400, 'Filtros de solicitudes inválidos');
  const where = [], args = [];
  if (search) { where.push('(instr(lower(id),lower(?))>0 OR instr(lower(items_json),lower(?))>0)'); args.push(search,search); }
  if (status) { where.push('status=?'); args.push(status); }
  const condition = where.length ? ' WHERE '+where.join(' AND ') : '';
  const total = db.prepare('SELECT COUNT(*) AS total FROM orders'+condition).get(...args).total;
  const pages = Math.max(1,Math.ceil(total/25)), page = Math.min(Number(raw),pages);
  const rows = db.prepare('SELECT * FROM orders'+condition+' ORDER BY created_at DESC,id DESC LIMIT 25 OFFSET ?').all(...args,(page-1)*25);
  const counts = Object.fromEntries(requestStates.map(state => [state,0]));
  for (const row of db.prepare('SELECT status,COUNT(*) AS count FROM orders GROUP BY status').all()) counts[row.status]=row.count;
  return { rows:rows.map(detail),total,page,pages,counts };
}
export function reviewRequest(id,input,actor) {
  if (Object.keys(input).some(k=>!['status','admin_note','version'].includes(k)) || !requestStates.includes(input.status) || typeof input.admin_note !== 'string' || input.admin_note.length>4000 || !Number.isInteger(input.version) || input.version<0) throw httpError(400,'Estado o nota de solicitud inválidos');
  db.exec('BEGIN IMMEDIATE');
  try {
    const before = requestDetail(id);
    if (before.version!==input.version) throw httpError(409,'La solicitud cambió en otra sesión. Vuelve a abrirla antes de guardar.');
    db.prepare('UPDATE orders SET status=?,admin_note=?,version=version+1,updated_at=? WHERE id=?').run(input.status,input.admin_note.trim(),new Date().toISOString(),id);
    const after = requestDetail(id);
    audit(actor,'request_reviewed',id,{ before:{status:before.status,admin_note:before.admin_note}, after:{status:after.status,admin_note:after.admin_note} });
    db.exec('COMMIT'); return after;
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
