import {db,audit,decorate} from './db.js';
import {publicationIssues} from './catalog-model.js';
const strings=['brand','name','variant','description','image_url','supplier_url','delivery_days','collection','movement','style','condition','material','crystal','water_resistance','dial_color','case_color','strap_color','strap','warranty','package_contents','provenance','shipping_terms'];
export function imageUrl(v) {
  if(/^\/(assets|uploads)\/[a-zA-Z0-9_/-]+\.(png|jpg|jpeg|webp)$/.test(v))return v;
  try {const u=new URL(v);if(u.protocol==='https:')return u.href;}catch{}
  throw Error('Usa una imagen HTTPS o un archivo subido al administrador');
}
export function planEditProduct(old,d) {
  const allowed=[...strings,'market_cop','stock','approved_price_cop','manual_cost_cop','diameter_mm','sale_mode','images','cost_verified','confirm_supplier'];
  if(Object.keys(d).some(k=>!allowed.includes(k)))throw Error('Campo no permitido');
  const next={...old};
  for(const k of strings)if(k in d) {
    if(typeof d[k]!=='string'||d[k].length>(['description','provenance','shipping_terms','warranty','package_contents'].includes(k)?4000:1000))throw Error(`Valor inválido: ${k}`);
    next[k]=d[k].trim();
  }
  if(!next.brand||!next.name)throw Error('Completa marca y nombre');
  // Identity is immutable after creation; prevents duplicate brand/reference pairs.
  if(next.brand!==old.brand)throw Error('La marca identifica la referencia y no se cambia desde la ficha');
  for(const k of ['market_cop','stock','approved_price_cop','manual_cost_cop','diameter_mm'])if(k in d) {
    const nullable=['approved_price_cop','manual_cost_cop','diameter_mm'].includes(k);
    if(nullable&&(d[k]===null||d[k]==='')){next[k]=null;continue;}
    if(typeof d[k]!=='number'||!Number.isFinite(d[k])||d[k]<0||d[k]>1e12||(['stock','market_cop','approved_price_cop'].includes(k)&&!Number.isInteger(d[k])))throw Error(`Número inválido: ${k}`);
    if(k==='manual_cost_cop'&&d[k]===0)throw Error('El costo confirmado debe ser mayor que cero');
    if(k==='diameter_mm'&&(d[k]<1||d[k]>100))throw Error('Diámetro fuera de rango');
    next[k]=d[k];
  }
  if('sale_mode'in d){if(!['available','on_order','quote'].includes(d.sale_mode))throw Error('Modalidad inválida');next.sale_mode=d.sale_mode;}
  if(next.image_url)next.image_url=imageUrl(next.image_url);
  if(next.supplier_url){const u=new URL(next.supplier_url);if(u.protocol!=='https:')throw Error('Proveedor requiere HTTPS');}
  if('images'in d){if(!Array.isArray(d.images)||d.images.length>8)throw Error('Máximo ocho fotografías adicionales');next.images_json=JSON.stringify(d.images.map(imageUrl));}
  for(const k of ['cost_verified','confirm_supplier'])if(k in d&&typeof d[k]!=='boolean')throw Error(`Confirmación inválida: ${k}`);
  if('cost_verified'in d)next.cost_verified=d.cost_verified?1:0;
  if('confirm_supplier'in d)next.supplier_confirmed_at=d.confirm_supplier?new Date().toISOString():null;
  const decorated=decorate(next);
  if(old.status==='published'&&publicationIssues(next,decorated.analysis).length)next.status='paused';
  next.updated_at=new Date().toISOString();
  return next;
}
export function editProduct(id,d,actor) {
  const old=db.prepare('SELECT * FROM products WHERE id=?').get(id);if(!old)throw Error('Referencia no encontrada');
  const next=planEditProduct(old,d);
  const keys=[...strings,'market_cop','stock','approved_price_cop','manual_cost_cop','diameter_mm','sale_mode','images_json','cost_verified','supplier_confirmed_at','status','updated_at'];
  db.prepare(`UPDATE products SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=?`).run(...keys.map(k=>next[k]),id);
  for(const [field,value] of Object.entries(d))if(!['cost_verified','confirm_supplier'].includes(field))db.prepare('INSERT INTO field_history(product_id,field,value_json,source_url,method,actor,created_at) VALUES(?,?,?,?,?,?,?)').run(id,field,JSON.stringify(value),'','manual',actor,new Date().toISOString());
  audit(actor,'product_edited',id,{fields:Object.keys(d),from_status:old.status,to_status:next.status});
  return decorate(db.prepare('SELECT * FROM products WHERE id=?').get(id));
}
