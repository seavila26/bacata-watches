import { db, calculate } from './db.js';
import { isVisible } from './publications.js';
import { httpError } from './security.js';
export function quoteItems(input) {
  if (!Array.isArray(input) || input.length<1 || input.length>20) throw httpError(400,'Carrito inválido');
  let total=0; const items=[], ids=new Set();
  for(const item of input) {
    if (!item || typeof item.id!=='string' || item.id.length>200 || ids.has(item.id)) throw httpError(400,'Carrito inválido');
    ids.add(item.id);
    const quantity=Number(item.quantity);
    if(!Number.isInteger(quantity)||quantity<1||quantity>10)throw httpError(400,'Cantidad inválida');
    const p=db.prepare("SELECT * FROM products WHERE id=? AND status='published'").get(item.id);
    if(!p||!isVisible(p))throw httpError(409,'Producto no disponible');
    const price=calculate(p).price;
    if(!Number.isSafeInteger(price)||price<=0)throw httpError(409,'Precio no disponible');
    total+=price*quantity;
    items.push({id:p.id,reference:p.reference,name:p.name,quantity,unit_price_cop:price});
  }
  if(!Number.isSafeInteger(total*100))throw httpError(400,'Importe inválido');
  return {total,items};
}
