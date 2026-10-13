import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { checkoutCustomer, checkCustomerDestination, storeCustomer, deliveryPromise } from './checkout-customer.js';
import { db, audit } from './db.js';
import { quoteDelivery, assertTotal, storeDelivery, deliveryDetails } from './shipping.js';
import { httpError } from './security.js';
export function wompiConfig(env=process.env) {
  const mode=env.WOMPI_MODE || 'disabled';
  if(mode==='disabled')return {mode,enabled:false};
  if(mode!=='sandbox')throw Error('WOMPI_MODE admite disabled o sandbox. Los cobros reales aún no están habilitados.');
  const keys=[['publicKey','WOMPI_PUBLIC_KEY','pub_test_'],['privateKey','WOMPI_PRIVATE_KEY','prv_test_'],['integritySecret','WOMPI_INTEGRITY_SECRET','test_integrity_'],['eventsSecret','WOMPI_EVENTS_SECRET','test_events_']];
  const config={mode,enabled:true,apiBase:'https://sandbox.wompi.co/v1'};
  for(const [field,key,prefix] of keys) {
    const value=env[key];
    if(typeof value!=='string'||!value.startsWith(prefix)||value.length<=prefix.length||value.length>512||/\s/.test(value))throw Error(`Configura ${key} con la clave sandbox de Bacatá`);
    config[field]=value;
  }
  return config;
}
export const paymentConfig=wompiConfig();
db.exec(`CREATE TABLE IF NOT EXISTS payment_attempts (
  reference TEXT PRIMARY KEY REFERENCES orders(id), token TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE, cart_json TEXT NOT NULL,
  amount_in_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'COP',
  environment TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING',
  transaction_id TEXT UNIQUE, payment_method TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT NOT NULL
)`);
const sha=value=>createHash('sha256').update(value).digest('hex');
export function integritySignature(reference,amount,currency,expiration,secret) {
  return sha(reference+String(amount)+currency+expiration+secret);
}
function requireEnabled(config) {if(!config.enabled)throw httpError(503,'Wompi está pendiente de configuración en el servidor');}
function publicAttempt(row) {
 const delivery=deliveryDetails(row.reference);
 const order=db.prepare('SELECT items_json FROM orders WHERE id=?').get(row.reference);
 return {reference:row.reference,total_cop:row.amount_in_cents/100,subtotal_cop:delivery?.subtotal_cop ?? row.amount_in_cents/100,shipping_cop:delivery?.shipping_cop ?? null,currency:row.currency,status:row.status,environment:row.environment,transaction_id:row.transaction_id,updated_at:row.updated_at,expires_at:row.expires_at,city:delivery?.city || null,delivery_terms:deliveryPromise(row.reference),items:order?JSON.parse(order.items_json):[]};
}
export function paymentSummary(reference) {
  const row=db.prepare('SELECT * FROM payment_attempts WHERE reference=?').get(reference);
  return row ? publicAttempt(row) : null;
}
export function paymentState(token) {
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw httpError(404,'Pago no encontrado');
  const row=db.prepare('SELECT * FROM payment_attempts WHERE token=?').get(token);
  if(!row)throw httpError(404,'Pago no encontrado');
  return publicAttempt(row);
}
function checkoutResult(row,origin,config) {
  const signature=integritySignature(row.reference,row.amount_in_cents,'COP',row.expires_at,config.integritySecret);
  const url=new URL('https://checkout.wompi.co/p/');
  const params={'public-key':config.publicKey,currency:'COP','amount-in-cents':String(row.amount_in_cents),reference:row.reference,'signature:integrity':signature,'expiration-time':row.expires_at,'redirect-url':origin+'/pago?token='+row.token};
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  return { ...publicAttempt(row),token:row.token,checkout_url:url.toString() };
}
export function createCheckout(input,origin,config=paymentConfig) {
  requireEnabled(config);
  if(Object.keys(input).some(key=>!['items','accepted','idempotency_key','destination','expected_total_cop','customer','privacy_accepted'].includes(key)))throw httpError(400,'Campo de pago no permitido');
  if(input.accepted!==true||typeof input.idempotency_key!=='string'||!/^[a-f0-9]{64}$/.test(input.idempotency_key))throw httpError(400,'Acepta las condiciones y vuelve a preparar el pago');
  if(!Array.isArray(input.items)||!input.items.length||input.items.length>20)throw httpError(400,'Carrito inválido');
  const customer=checkoutCustomer(input.customer,input.privacy_accepted);
  const quote=quoteDelivery(input.items,input.destination);
  checkCustomerDestination(customer,quote.destination);
  assertTotal(input.expected_total_cop,quote);
  const cart=JSON.stringify({items:input.items.map(item=>({id:item?.id,quantity:item?.quantity})).sort((a,b)=>String(a.id).localeCompare(String(b.id))),destination:quote.destination,customer_hash:createHmac('sha256',config.integritySecret).update(JSON.stringify(customer)).digest('hex')});
  const existing=db.prepare('SELECT * FROM payment_attempts WHERE idempotency_key=?').get(input.idempotency_key);
  if(existing) {
    if(existing.cart_json!==cart||existing.environment!=='test')throw httpError(409,'La selección cambió. Prepara un nuevo pago.');
    if(existing.status!=='PENDING'||Date.parse(existing.expires_at)<=Date.now())throw httpError(409,'Este intento terminó o venció. Consulta su estado antes de crear otro.');
    // Recheck publication, quantities and current prices before reusing an unpaid checkout.
    if(quote.total*100!==existing.amount_in_cents)throw httpError(409,'El precio cambió. Prepara un nuevo pago.');
    return checkoutResult(existing,origin,config);
  }
  const now=new Date().toISOString();
  const reference='BAC-'+randomBytes(12).toString('hex').toUpperCase(),token=randomBytes(32).toString('hex');
  const expiration=new Date(Date.now()+30*60000).toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO orders(id,items_json,total_cop,created_at) VALUES(?,?,?,?)').run(reference,JSON.stringify(quote.items),quote.total,now);
    storeDelivery(reference,quote);
    storeCustomer(reference,customer);
    db.prepare('INSERT INTO payment_attempts(reference,token,idempotency_key,cart_json,amount_in_cents,environment,created_at,updated_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)').run(reference,token,input.idempotency_key,cart,quote.total*100,'test',now,now,expiration);
    audit('customer','sandbox_checkout_created',reference,{amount_in_cents:quote.total*100,environment:'test'});
    db.exec('COMMIT');
  } catch(e){db.exec('ROLLBACK');throw e;}
  return checkoutResult(db.prepare('SELECT * FROM payment_attempts WHERE reference=?').get(reference),origin,config);
}
export function validateEvent(event,header,config=paymentConfig) {
  requireEnabled(config);
  const properties=event.signature?.properties,checksum=header || event.signature?.checksum;
  if(event.environment!=='test'||!Number.isSafeInteger(event.timestamp)||!Array.isArray(properties)||!properties.length||properties.length>30||typeof checksum!=='string'||!/^[a-f0-9]{64}$/i.test(checksum))throw httpError(401,'Evento Wompi inválido');
  let values='';
  for(const property of properties) {
    if(typeof property!=='string'||property.length>150||!/^\w+(?:\.\w+)*$/.test(property))throw httpError(401,'Firma Wompi inválida');
    let value=event.data;
    for(const key of property.split('.')) {
      if(['__proto__','prototype','constructor'].includes(key)||!value||!Object.hasOwn(value,key))throw httpError(401,'Firma Wompi inválida');
      value=value[key];
    }
    if(!['string','number'].includes(typeof value))throw httpError(401,'Firma Wompi inválida');
    values+=String(value);
  }
  const expected=sha(values+String(event.timestamp)+config.eventsSecret);
  if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(checksum,'hex')))throw httpError(401,'Firma Wompi inválida');
  if(event.event==='transaction.updated'&&!properties.includes('transaction.id'))throw httpError(401,'Firma Wompi incompleta');
}
const inFlight=new Map();
export async function fetchTransaction(id,config=paymentConfig,fetcher=fetch) {
  requireEnabled(config);
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,150}$/.test(id))throw httpError(400,'Identificador de transacción inválido');
  if(inFlight.has(id))return inFlight.get(id);
  if(inFlight.size>=8)throw httpError(503,'Verificación de pagos ocupada. Reintenta en unos segundos.');
  const task=(async()=>{
    try {
      const response=await fetcher(config.apiBase+'/transactions/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+config.privateKey,Accept:'application/json'},signal:AbortSignal.timeout(10000),redirect:'error'});
      if(!response.ok)throw httpError(503,'Wompi no pudo confirmar la transacción. Reintenta.');
      const result=await response.json();
      if(result.data?.id!==id)throw httpError(503,'Respuesta de Wompi inválida');
      return result.data;
    } catch(e) {if(e.status)throw e;throw httpError(503,'No fue posible consultar Wompi. El pago sigue pendiente de verificación.');}
  })();
  inFlight.set(id,task);
  try{return await task;}finally{inFlight.delete(id);}
}
export function applyTransaction(transaction,expectedReference) {
  const row=db.prepare('SELECT * FROM payment_attempts WHERE reference=?').get(transaction.reference);
  if(!row||(expectedReference&&row.reference!==expectedReference))throw httpError(409,'La transacción no corresponde a este pedido');
  if(transaction.currency!==row.currency||transaction.amount_in_cents!==row.amount_in_cents||!['PENDING','APPROVED','DECLINED','ERROR','VOIDED'].includes(transaction.status))throw httpError(409,'Monto, moneda o estado del pago no coinciden');
  if(row.transaction_id&&row.transaction_id!==transaction.id)throw httpError(409,'El pedido ya tiene otra transacción');
  const bound=db.prepare('SELECT reference FROM payment_attempts WHERE transaction_id=?').get(transaction.id);
  if(bound&&bound.reference!==row.reference)throw httpError(409,'Transacción ya asociada a otro pedido');
  // Terminal states never regress due to delayed requests. A void can follow approval.
  if(row.status==='VOIDED'||(row.status==='APPROVED'&&transaction.status!=='VOIDED')||(['DECLINED','ERROR'].includes(row.status)))return publicAttempt(row);
  if(row.status===transaction.status&&row.transaction_id===transaction.id)return publicAttempt(row);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE payment_attempts SET status=?,transaction_id=?,payment_method=?,updated_at=? WHERE reference=?').run(transaction.status,transaction.id,String(transaction.payment_method_type || '').slice(0,40),new Date().toISOString(),row.reference);
    audit('wompi','sandbox_payment_verified',row.reference,{before:row.status,after:transaction.status,transaction_id:transaction.id,amount_in_cents:row.amount_in_cents});
    db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  return paymentSummary(row.reference);
}
export async function verifyPayment(token,id,config=paymentConfig,fetcher=fetch) {
  const current=paymentState(token);
  const transaction=await fetchTransaction(id,config,fetcher);
  return applyTransaction(transaction,current.reference);
}
export async function receiveEvent(event,header,config=paymentConfig,fetcher=fetch) {
  validateEvent(event,header,config);
  if(event.event!=='transaction.updated')return {ok:true,ignored:true};
  const transaction=await fetchTransaction(event.data?.transaction?.id,config,fetcher);
  if(!db.prepare('SELECT 1 FROM payment_attempts WHERE reference=?').get(transaction.reference))return {ok:true,ignored:true};
  applyTransaction(transaction);
  return {ok:true};
}
