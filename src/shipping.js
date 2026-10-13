import { db } from './db.js';
import { commercialProfile } from './commercial.js';
import { quoteItems } from './order-quote.js';
import { httpError } from './security.js';
import { normalizeCity, bogotaNames, shippingEstimate } from '../public/js/shipping-model.js';
db.exec(`CREATE TABLE IF NOT EXISTS order_delivery (
  order_id TEXT PRIMARY KEY REFERENCES orders(id), zone TEXT NOT NULL,
  city TEXT NOT NULL, subtotal_cop INTEGER NOT NULL, shipping_cop INTEGER NOT NULL
)`);
export function destination(input) {
  if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(key=>!['zone','city'].includes(key)) || !['bogota','national'].includes(input.zone))throw httpError(400,'Selecciona el destino del envío');
  if(input.zone==='bogota') {
    if(input.city && (typeof input.city!=='string' || !bogotaNames.has(normalizeCity(input.city))))throw httpError(400,'La ciudad no corresponde al destino Bogotá');
    return {zone:'bogota',city:'Bogotá'};
  }
  if(typeof input.city!=='string' || input.city.trim().length<2 || input.city.length>100 || !/^[\p{L}\p{M} .'-]+$/u.test(input.city.trim()))throw httpError(400,'Escribe una ciudad válida de Colombia');
  if(bogotaNames.has(normalizeCity(input.city)))throw httpError(400,'Para Bogotá selecciona el destino Bogotá');
  return {zone:'national',city:input.city.trim()};
}
export function quoteDelivery(items,input) {
  const dest=destination(input), quote=quoteItems(items);
  const shipping=shippingEstimate(dest.zone,commercialProfile());
  if(!Number.isSafeInteger(shipping) || shipping<0 || shipping>1000000)throw httpError(503,'Revisa las tarifas de envío del comercio');
  if(!Number.isSafeInteger((quote.total+shipping)*100))throw httpError(400,'Importe total inválido');
  return {...quote,subtotal:quote.total,shipping,total:quote.total+shipping,destination:dest};
}
export function assertTotal(input,quote) {
  if(!Number.isSafeInteger(input) || input!==quote.total)throw Object.assign(httpError(409,'El total cambió. Revisa los precios y el envío antes de continuar.'),{code:'quote_changed'});
}
export function storeDelivery(orderId,quote) {
  db.prepare('INSERT INTO order_delivery(order_id,zone,city,subtotal_cop,shipping_cop) VALUES(?,?,?,?,?)').run(orderId,quote.destination.zone,quote.destination.city,quote.subtotal,quote.shipping);
}
export function deliveryDetails(orderId) {
  return db.prepare('SELECT zone,city,subtotal_cop,shipping_cop FROM order_delivery WHERE order_id=?').get(orderId) || null;
}
