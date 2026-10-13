import { fulfillmentStates, nextFulfillment } from '../public/js/fulfillment-model.js';
import { db, audit } from './db.js';
import { customerDetails } from './checkout-customer.js';
import { deliveryDetails } from './shipping.js';
import { paymentSummary } from './wompi.js';
import { httpError } from './security.js';
const columns = new Set(db.prepare('PRAGMA table_info(orders)').all().map(c => c.name));
db.exec('BEGIN IMMEDIATE');
try {
  if (!columns.has('admin_note')) db.exec("ALTER TABLE orders ADD COLUMN admin_note TEXT NOT NULL DEFAULT ''");
  if (!columns.has('version')) db.exec('ALTER TABLE orders ADD COLUMN version INTEGER NOT NULL DEFAULT 0');
  if (!columns.has('updated_at')) db.exec("ALTER TABLE orders ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
  for(const [name,definition] of Object.entries({fulfillment_status:"TEXT NOT NULL DEFAULT 'pending'",carrier:"TEXT NOT NULL DEFAULT ''",tracking_number:"TEXT NOT NULL DEFAULT ''",shipped_at:"TEXT NOT NULL DEFAULT ''",delivered_at:"TEXT NOT NULL DEFAULT ''"})) if(!columns.has(name))db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${definition}`);
  db.exec(`CREATE TABLE IF NOT EXISTS order_fulfillment_history (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL REFERENCES orders(id),from_status TEXT NOT NULL,to_status TEXT NOT NULL,carrier TEXT NOT NULL,tracking_number TEXT NOT NULL,note TEXT NOT NULL,actor TEXT NOT NULL,simulation INTEGER NOT NULL,created_at TEXT NOT NULL)`);
  db.exec('COMMIT');
} catch (e) { db.exec('ROLLBACK'); throw e; }
export const requestStates = ['payment_pending', 'reviewed', 'archived'];
function detail(row) {
  return { id:row.id, status:row.status, created_at:row.created_at, updated_at:row.updated_at || row.created_at, total_cop:row.total_cop, admin_note:row.admin_note, version:row.version, items:JSON.parse(row.items_json), payment:paymentSummary(row.id), delivery:deliveryDetails(row.id), customer:customerDetails(row.id), fulfillment:{status:row.fulfillment_status,carrier:row.carrier,tracking_number:row.tracking_number,shipped_at:row.shipped_at || null,delivered_at:row.delivered_at || null,history:db.prepare('SELECT * FROM order_fulfillment_history WHERE order_id=? ORDER BY id DESC LIMIT 100').all(row.id),history_total:db.prepare('SELECT COUNT(*) AS count FROM order_fulfillment_history WHERE order_id=?').get(row.id).count} };
}
export function requestDetail(id) {
  const row = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
  if (!row) throw httpError(404, 'Solicitud no encontrada');
  return detail(row);
}
export function requestList(query) {
  const search = (query.get('q') || '').trim();
  const status = query.get('status') || '';
  const fulfillment=query.get('fulfillment') || '';
  const payment=query.get('payment') || '';
  if((fulfillment&&!fulfillmentStates.includes(fulfillment)) || (payment&&!['PENDING','APPROVED','DECLINED','ERROR','VOIDED','none'].includes(payment)))throw httpError(400,'Filtros de gestión inválidos');
  const raw = query.get('page') || '1';
  if (search.length > 100 || (status && !requestStates.includes(status)) || !/^[1-9]\d{0,5}$/.test(raw)) throw httpError(400, 'Filtros de solicitudes inválidos');
  const where = [], args = [];
  if (search) { where.push('(instr(lower(id),lower(?))>0 OR instr(lower(items_json),lower(?))>0 OR instr(lower(tracking_number),lower(?))>0 OR instr(lower(carrier),lower(?))>0)'); args.push(search,search,search,search); }
  if (status) { where.push('status=?'); args.push(status); }
  if(fulfillment){where.push('fulfillment_status=?');args.push(fulfillment);}
  if(payment==='none')where.push('NOT EXISTS(SELECT 1 FROM payment_attempts p WHERE p.reference=orders.id)');
  else if(payment){where.push('EXISTS(SELECT 1 FROM payment_attempts p WHERE p.reference=orders.id AND p.status=?)');args.push(payment);}
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

export function manageFulfillment(id,input,actor) {
 if(Object.keys(input).some(key=>!['status','carrier','tracking_number','note','version','simulate'].includes(key)) || !fulfillmentStates.includes(input.status) || !Number.isInteger(input.version) || input.version<0 || typeof input.simulate!=='boolean')throw httpError(400,'Datos de gestión inválidos');
 for(const [key,max] of Object.entries({carrier:120,tracking_number:120,note:4000}))if(typeof input[key]!=='string' || input[key].length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input[key]))throw httpError(400,'Revisa transportadora, guía y nota');
 const carrier=input.carrier.trim(),tracking=input.tracking_number.trim(),note=input.note.trim();
 db.exec('BEGIN IMMEDIATE');
 try {
  const before=requestDetail(id),current=before.fulfillment.status;
  if(input.version!==before.version)throw httpError(409,'El pedido cambió en otra sesión. Vuelve a abrirlo antes de guardar.');
  const changes=input.status!==current || carrier!==before.fulfillment.carrier || tracking!==before.fulfillment.tracking_number || !!note;
  if(changes && before.payment?.environment==='test' && !input.simulate)throw httpError(409,'Activa la simulación para gestionar este pedido sandbox');
  if(input.status!==current && input.status!==nextFulfillment(current))throw httpError(409,'Avanza en orden: confirmar, preparar, enviar y entregar.');
  if(input.status!==current) {
   if(before.status==='archived')throw httpError(409,'Reabre la solicitud archivada antes de avanzar su gestión');
   if(before.payment?.status!=='APPROVED')throw httpError(409,'Se requiere un pago aprobado por Wompi para avanzar el pedido');
   if(!before.customer)throw httpError(409,'El pedido no tiene datos de contacto y dirección registrados');
   if(before.payment.environment==='test'&&!input.simulate)throw httpError(409,'Activa la simulación para gestionar este pedido sandbox');
   if(note.length<3)throw httpError(400,'Describe la confirmación o el cambio de etapa');
  }
  if(['shipped','delivered'].includes(input.status)&&(!carrier||!tracking))throw httpError(400,'Para enviar o entregar registra transportadora y número de guía');
  if((carrier!==before.fulfillment.carrier || tracking!==before.fulfillment.tracking_number)&&note.length<3)throw httpError(400,'Describe el cambio de transportadora o guía');
  if(input.status===current&&carrier===before.fulfillment.carrier&&tracking===before.fulfillment.tracking_number&&!note){db.exec('COMMIT');return before;}
  const now=new Date().toISOString(),simulation=before.payment?.environment==='test';
  const shippedAt=input.status==='shipped'&&current!=='shipped'?now:before.fulfillment.shipped_at || '';
  const deliveredAt=input.status==='delivered'&&current!=='delivered'?now:before.fulfillment.delivered_at || '';
  const reviewStatus=current==='pending' && input.status==='confirmed' && before.status==='payment_pending' ? 'reviewed' : before.status;
  db.prepare('UPDATE orders SET fulfillment_status=?,carrier=?,tracking_number=?,shipped_at=?,delivered_at=?,status=?,version=version+1,updated_at=? WHERE id=?').run(input.status,carrier,tracking,shippedAt,deliveredAt,reviewStatus,now,id);
  db.prepare('INSERT INTO order_fulfillment_history(order_id,from_status,to_status,carrier,tracking_number,note,actor,simulation,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,current,input.status,carrier,tracking,note,actor,simulation?1:0,now);
  audit(actor,'order_fulfillment_updated',id,{from:current,to:input.status,carrier,tracking_number:tracking,note,simulation,review_before:before.status,review_after:reviewStatus});
  const after=requestDetail(id);db.exec('COMMIT');return after;
 }catch(e){db.exec('ROLLBACK');throw e;}
}
