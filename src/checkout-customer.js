import { db } from './db.js';
import { commercialProfile } from './commercial.js';
import { validateCustomer, customerDestination } from '../public/js/checkout-model.js';
import { httpError } from './security.js';
db.exec(`CREATE TABLE IF NOT EXISTS order_customer (
 order_id TEXT PRIMARY KEY REFERENCES orders(id), customer_json TEXT NOT NULL,
 accepted_at TEXT NOT NULL, policy_json TEXT NOT NULL
)`);
export function checkoutCustomer(input,privacyAccepted) {
  if(privacyAccepted!==true)throw httpError(400,'Autoriza el tratamiento de datos para gestionar el pedido');
  try{return validateCustomer(input);}catch(e){throw httpError(400,e.message);}
}
export function checkCustomerDestination(customer,dest) {
  const expected=customerDestination(customer);
  if(dest.zone!==expected.zone||dest.city!==expected.city)throw httpError(400,'El destino no coincide con los datos de entrega');
}
export function storeCustomer(id,customer) {
 const profile=commercialProfile();
 db.prepare('INSERT INTO order_customer(order_id,customer_json,accepted_at,policy_json) VALUES(?,?,?,?)').run(id,JSON.stringify(customer),new Date().toISOString(),JSON.stringify({seller:{trade_name:profile.trade_name,legal_name:profile.legal_name,tax_id:profile.tax_id,address:profile.address,email:profile.email,whatsapp:profile.whatsapp},trade_name:profile.trade_name,returns:profile.returns,warranty:profile.warranty,shipping:profile.shipping,delivery:profile.delivery,privacy:profile.privacy,provisional:profile.provisional,advertising_authorized:false,terms_path:'#/condiciones',privacy_path:'#/privacidad'}));
}
export function customerDetails(id) {
 const row=db.prepare('SELECT customer_json,accepted_at FROM order_customer WHERE order_id=?').get(id);
 return row ? {...JSON.parse(row.customer_json),accepted_at:row.accepted_at} : null;
}

export function deliveryPromise(id) {
 const row=db.prepare('SELECT policy_json FROM order_customer WHERE order_id=?').get(id);
 return row ? JSON.parse(row.policy_json).delivery : null;
}
