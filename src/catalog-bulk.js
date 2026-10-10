import {randomUUID} from 'node:crypto';
import {db,audit,decorate} from './db.js';
import {editProduct,planEditProduct} from './product-editor.js';
const previews=new Map();
const templateKeys=['sale_mode','delivery_days','warranty','package_contents','provenance','shipping_terms'];
export function selectedProducts(ids) {
  if(!Array.isArray(ids)||!ids.length||ids.length>250||new Set(ids).size!==ids.length||ids.some(i=>typeof i!=='string'))throw Error('Selecciona de 1 a 250 referencias sin repetir');
  return ids.map(id=>{const p=db.prepare('SELECT * FROM products WHERE id=?').get(id);if(!p)throw Error('Referencia no encontrada');return p;});
}
export function saveTemplate(data,actor) {
  if(!data||typeof data.name!=='string'||!data.name.trim()||data.name.length>100)throw Error('Nombre de plantilla inválido');
  const fields=data.fields;
  if(!fields||typeof fields!=='object'||Object.keys(fields).some(k=>!templateKeys.includes(k)))throw Error('La plantilla solo admite condiciones comerciales');
  for(const [k,v] of Object.entries(fields))if(typeof v!=='string'||v.length>4000||k==='sale_mode'&&!['quote','on_order','available'].includes(v))throw Error('Valor de plantilla inválido');
  const id=data.id||randomUUID();
  if(data.id&&!db.prepare('SELECT id FROM catalog_templates WHERE id=?').get(id))throw Error('Plantilla no encontrada');
  db.prepare('INSERT INTO catalog_templates(id,name,fields_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,fields_json=excluded.fields_json,updated_at=excluded.updated_at').run(id,data.name.trim(),JSON.stringify(fields),new Date().toISOString());
  audit(actor,'template_saved',id,{name:data.name});return {id};
}
export function bulkOverview() {
  return {templates:db.prepare('SELECT * FROM catalog_templates ORDER BY name').all().map(p=>({...p,fields:JSON.parse(p.fields_json)})),
    jobs:db.prepare('SELECT * FROM enrichment_jobs ORDER BY created_at DESC LIMIT 10').all().map(j=>({...j,counts:db.prepare('SELECT state,count(*) n FROM enrichment_items WHERE job_id=? GROUP BY state').all()})),
    proposals:db.prepare("SELECT i.*,p.brand,p.reference FROM enrichment_items i JOIN products p ON p.id=i.product_id WHERE i.state IN ('proposed','failed') ORDER BY i.created_at DESC LIMIT 500").all().map(({before_json,proposal_json,...r})=>({...r,proposal:proposal_json?JSON.parse(proposal_json):null}))};
}
export function previewBulk(data,actor) {
  const products=selectedProducts(data.ids);
  for(const key of ['overwrite','approve_suggested','confirm_costs','confirm_supplier'])if(key in data&&typeof data[key]!=='boolean')throw Error('Confirmación de lote inválida');
  let template={};if(data.template_id){const t=db.prepare('SELECT * FROM catalog_templates WHERE id=?').get(data.template_id);if(!t)throw Error('Plantilla no encontrada');template=JSON.parse(t.fields_json);}
  for(const [k,p] of previews)if(p.expires<Date.now())previews.delete(k);if(previews.size>10)previews.delete(previews.keys().next().value);
  const items=products.map(old=>{
    const changes={};for(const [k,v] of Object.entries(template))if(v&&(data.overwrite===true||!old[k]||k==='sale_mode'&&old[k]==='quote'||k==='delivery_days'&&old[k]==='Por confirmar'))changes[k]=v;
    if(data.approve_suggested===true&&!old.approved_price_cop){const a=decorate(old).analysis;if(a.suggested>0)changes.approved_price_cop=a.suggested;}
    if(data.confirm_costs===true)changes.cost_verified=true;
    if(data.confirm_supplier===true)changes.confirm_supplier=true;
    const next=planEditProduct(old,changes),d=decorate(next);
    return {id:old.id,brand:old.brand,reference:old.reference,changes,issues:d.publication_issues,can_publish:d.publication_issues.length===0,before:JSON.stringify(old),price:next.approved_price_cop};
  });
  const token=randomUUID();previews.set(token,{items,actor,expires:Date.now()+15*60000});
  return {token,total:items.length,ready:items.filter(i=>i.can_publish).length,items:items.map(({before,...i})=>i)};
}
export function applyBulk(token,publish,actor) {
  const p=previews.get(token);if(!p||p.actor!==actor||p.expires<Date.now())throw Error('Vista previa vencida; vuelve a preparar el lote');
  if(typeof publish!=='boolean')throw Error('Acción de publicación inválida');
  let updated=0,published=0;const blocked=[];
  db.exec('BEGIN IMMEDIATE');
  try {
    for(const item of p.items) {
      const old=db.prepare('SELECT * FROM products WHERE id=?').get(item.id);
      if(JSON.stringify(old)!==item.before)throw Error(`Cambió ${item.reference}; vuelve a preparar el lote`);
      const next=Object.keys(item.changes).length?editProduct(item.id,item.changes,actor):decorate(old);updated+=Object.keys(item.changes).length?1:0;
      if(publish) {
        if(next.publication_issues.length)blocked.push({id:item.id,reference:item.reference,issues:next.publication_issues});
        else {db.prepare("UPDATE products SET status='published',reviewed_at=?,updated_at=? WHERE id=?").run(new Date().toISOString(),new Date().toISOString(),item.id);published++;}
      }
      for(const [field,v] of Object.entries(item.changes))db.prepare('INSERT INTO field_history(product_id,field,value_json,source_url,method,actor,created_at) VALUES(?,?,?,?,?,?,?)').run(item.id,field,JSON.stringify(v),'','bulk/template',actor,new Date().toISOString());
    }
    audit(actor,'bulk_applied','products',{updated,published,blocked:blocked.length});db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  previews.delete(token);return {updated,published,blocked};
}
