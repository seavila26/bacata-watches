import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {db,audit} from './db.js';
import {selectedProducts} from './catalog-bulk.js';
import {editProduct,planEditProduct} from './product-editor.js';
import {readSource,extractProduct,sourceUrl,translate} from './source-reader.js';
import {identityKey} from './catalog-model.js';
import {spanishCopy} from './spanish-copy.js';
const facts=['collection','movement','diameter_mm','material','crystal','water_resistance','dial_color','case_color','strap_color','strap'];
let active=false;
// Jobs are persisted. A restart marks unfinished work explicitly instead of pretending success.
db.prepare("UPDATE enrichment_jobs SET state='interrupted',finished_at=? WHERE state IN ('queued','running')").run(new Date().toISOString());
db.prepare("UPDATE enrichment_items SET state='failed',error='Proceso interrumpido por reinicio; vuelve a seleccionar estas referencias' WHERE state IN ('queued','running')").run();
async function downloadImages(urls,warnings,reader) {
  const saved=[];
  for(const url of urls.slice(0,3)) {
    try {
      sourceUrl(url);const response=await reader(url,{maxBytes:5*1024*1024});const b=response.buffer;
      let extension='';
      if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))extension='.png';
      else if(b[0]===255&&b[1]===216&&b[2]===255)extension='.jpg';
      else if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')extension='.webp';
      if(!extension)throw Error('Formato no compatible (PNG/JPEG/WebP)');
      await mkdir('public/uploads',{recursive:true});const name=randomUUID()+extension;
      await writeFile('public/uploads/'+name,b,{flag:'wx'});saved.push({local:'/uploads/'+name,source:url});
    }catch(e){warnings.push(`Foto pendiente: ${e.message}`);}
  }
  return saved;
}
export async function prepareProposal(product,extracted,{download_images=false,use_ai=false,reader=readSource}={}) {
  const warnings=[...(extracted.warnings||[])],fields={},evidence={...extracted.evidence};
  for(const k of facts)if(k in extracted.fields&&extracted.fields[k]!==''&&extracted.fields[k]!=null)fields[k]=extracted.fields[k];
  if(!Object.keys(fields).length&&!extracted.images.length)throw Error('La fuente no ofrece características o imágenes reconocibles; usar catálogo autorizado');
  let copy;
  try{copy=await spanishCopy(product,fields,use_ai);}catch(e){warnings.push(e.message);copy=await spanishCopy(product,fields,false);}
  fields.name=copy.name;fields.description=copy.description;
  evidence.name={url:extracted.url||product.supplier_url,method:copy.method,raw:copy.name};
  evidence.description={url:extracted.url||product.supplier_url,method:copy.method,raw:copy.description};
  const variant=[fields.dial_color,fields.diameter_mm?`${fields.diameter_mm} mm`:null].filter(Boolean).join(', ');
  if(variant){fields.variant=variant;evidence.variant={url:extracted.url||product.supplier_url,method:'derived_verified_fields',raw:variant};}
  if(copy.method==='ai')warnings.push('Texto preparado con IA: revisar antes de aprobar');
  const images=download_images?await downloadImages(extracted.images,warnings,reader):[];
  if(images.length){fields.image_url=images[0].local;fields.images=images.slice(1).map(x=>x.local);evidence.image_url={url:images[0].source,method:'downloaded',raw:images[0].source};evidence.images={url:extracted.url||product.supplier_url,method:'downloaded',raw:images.slice(1).map(x=>x.source)};}
  else if(extracted.images.length)warnings.push('Fotografías encontradas: no descargadas en este lote');
  const missing=facts.filter(k=>fields[k]==null||fields[k]==='');
  // Existing, manually approved values always survive automatic preparation.
  const proposed={};
  const manuallyNamed=db.prepare("SELECT id FROM field_history WHERE product_id=? AND field='name' AND method='manual' LIMIT 1").get(product.id);
  for(const [key,v] of Object.entries(fields)) {
    const current=key==='images'?JSON.parse(product.images_json||'[]'):product[key];
    if(current==null||current===''||Array.isArray(current)&&!current.length||key==='name'&&!manuallyNamed&&current===`${product.brand} ${product.reference}`)proposed[key]=v;
  }
  planEditProduct(product,proposed);
  return {fields:proposed,extracted_fields:fields,evidence,warnings,missing,source_url:extracted.url||product.supplier_url,fetched_at:new Date().toISOString(),copy_method:copy.method,image_candidates:extracted.images};
}
export function startEnrichment(data,actor) {
  const products=selectedProducts(data.ids);
  if(active)throw Error('Hay un lote en curso. Espera o cancélalo antes de iniciar otro.');
  if(data.download_images!==undefined&&typeof data.download_images!=='boolean'||data.use_ai!==undefined&&typeof data.use_ai!=='boolean')throw Error('Opciones inválidas');
  if(data.use_ai&&!process.env.OPENAI_API_KEY)throw Error('Configura OPENAI_API_KEY o desactiva redacción IA');
  const id=randomUUID(),now=new Date().toISOString();
  const options={download_images:!!data.download_images,use_ai:!!data.use_ai};
  db.exec('BEGIN IMMEDIATE');try{
    db.prepare('INSERT INTO enrichment_jobs(id,state,options_json,created_by,total,created_at) VALUES(?,?,?,?,?,?)').run(id,'queued',JSON.stringify(options),actor,products.length,now);
    for(const p of products)db.prepare('INSERT INTO enrichment_items(id,job_id,product_id,state,before_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),id,p.id,'queued',JSON.stringify(p),now,now);
    audit(actor,'enrichment_started',id,{count:products.length,...options});db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  active=true;setTimeout(()=>runJob(id,options).catch(e=>{db.prepare("UPDATE enrichment_jobs SET state='interrupted',finished_at=? WHERE id=?").run(new Date().toISOString(),id);console.error('Enriquecimiento interrumpido:',e.message);}).finally(()=>{active=false;}),0);
  return {id,total:products.length};
}
async function runJob(id,options) {
  db.prepare("UPDATE enrichment_jobs SET state='running' WHERE id=?").run(id);
  for(const item of db.prepare('SELECT * FROM enrichment_items WHERE job_id=? ORDER BY created_at,id').all(id)) {
    if(db.prepare('SELECT state FROM enrichment_jobs WHERE id=?').get(id).state==='cancelled')break;
    db.prepare("UPDATE enrichment_items SET state='running',updated_at=? WHERE id=?").run(new Date().toISOString(),item.id);
    try {
      const p=JSON.parse(item.before_json);
      if(!p.supplier_url)throw Error('Falta URL del proveedor');
      const response=await readSource(p.supplier_url);
      const extracted=extractProduct(response.buffer.toString('utf8'),p,response.url);extracted.url=response.url;
      const proposal=await prepareProposal(p,extracted,options);
      db.prepare("UPDATE enrichment_items SET state='proposed',proposal_json=?,error=NULL,updated_at=? WHERE id=?").run(JSON.stringify(proposal),new Date().toISOString(),item.id);
    }catch(e){db.prepare("UPDATE enrichment_items SET state='failed',error=?,updated_at=? WHERE id=?").run(e.message.slice(0,1000),new Date().toISOString(),item.id);}
    await new Promise(resolve=>setTimeout(resolve,750));
  }
  const job=db.prepare('SELECT state FROM enrichment_jobs WHERE id=?').get(id);
  if(job.state==='cancelled')db.prepare("UPDATE enrichment_items SET state='failed',error='Lote cancelado antes de procesar' WHERE job_id=? AND state='queued'").run(id);
  else db.prepare("UPDATE enrichment_jobs SET state='completed',finished_at=? WHERE id=?").run(new Date().toISOString(),id);
}
export function cancelEnrichment(id,actor) {
  const j=db.prepare('SELECT * FROM enrichment_jobs WHERE id=?').get(id);if(!j)throw Error('Lote no encontrado');
  if(!['queued','running'].includes(j.state))throw Error('El lote ya terminó');
  db.prepare("UPDATE enrichment_jobs SET state='cancelled',finished_at=? WHERE id=?").run(new Date().toISOString(),id);audit(actor,'enrichment_cancelled',id,{});return {ok:true};
}
export async function importAuthorizedCatalog(data,actor) {
  if(!Array.isArray(data.records)||!data.records.length||data.records.length>250)throw Error('Catálogo de 1 a 250 registros');
  if(data.use_ai&&!process.env.OPENAI_API_KEY)throw Error('Configura OPENAI_API_KEY o desactiva redacción IA');
  for(const key of ['download_images','use_ai'])if(key in data&&typeof data[key]!=='boolean')throw Error('Opciones inválidas');
  const id=randomUUID(),now=new Date().toISOString(),seen=new Set();
  const planned=[];
  for(const r of data.records) {
    if(!r||typeof r.brand!=='string'||typeof r.reference!=='string'||!r.source_url||!r.fields||typeof r.fields!=='object')throw Error('Cada registro necesita marca, referencia, fuente y características');
    const key=identityKey(r.brand,r.reference);if(seen.has(key))throw Error('Referencia duplicada en catálogo');seen.add(key);
    const p=db.prepare('SELECT * FROM products WHERE identity_key=?').get(key);
    if(!p)throw Error(`Importa primero la referencia ${r.reference}`);
    sourceUrl(r.source_url);
    if(Object.keys(r.fields).some(k=>!facts.includes(k)))throw Error('El catálogo contiene campos no permitidos');
    const fields={},evidence={};
    for(const [k,v] of Object.entries(r.fields)) {
      if(k==='diameter_mm'){if(typeof v!=='number'||v<1||v>100)throw Error('Diámetro debe ser numérico en mm');fields[k]=v;}
      else {if(typeof v!=='string'||v.length>500)throw Error(`Dato inválido: ${k}`);fields[k]=translate(v.trim());}
      evidence[k]={url:r.source_url,method:'authorized_catalog',raw:v};
    }
    const images=r.images||[];if(!Array.isArray(images)||images.length>9)throw Error('Máximo nueve enlaces de imagen por registro');images.forEach(sourceUrl);
    const proposal=await prepareProposal(p,{fields,evidence,images,url:r.source_url,warnings:['Datos aportados por catálogo: revisar correspondencia de la referencia']},{download_images:!!data.download_images,use_ai:!!data.use_ai});
    planned.push({p,proposal});
  }
  db.exec('BEGIN IMMEDIATE');try {
    db.prepare('INSERT INTO enrichment_jobs(id,state,options_json,created_by,total,created_at,finished_at) VALUES(?,?,?,?,?,?,?)').run(id,'completed',JSON.stringify({source:'authorized_catalog'}),actor,planned.length,now,now);
    for(const {p,proposal} of planned) {
      const current=db.prepare('SELECT * FROM products WHERE id=?').get(p.id);if(JSON.stringify(current)!==JSON.stringify(p))throw Error('Una ficha cambió durante la preparación. Vuelve a cargar el catálogo.');
      db.prepare('INSERT INTO enrichment_items(id,job_id,product_id,state,before_json,proposal_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),id,p.id,'proposed',JSON.stringify(p),JSON.stringify(proposal),now,now);
    }
    audit(actor,'authorized_catalog_prepared',id,{count:planned.length});db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  return {id,total:planned.length};
}
export function applyProposals(data,actor) {
  if(!Array.isArray(data.ids)||!data.ids.length||data.ids.length>250||new Set(data.ids).size!==data.ids.length)throw Error('Selecciona propuestas sin repetir');
  const edits=data.edits||{};let applied=0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for(const id of data.ids) {
      const item=db.prepare('SELECT * FROM enrichment_items WHERE id=?').get(id);if(!item||item.state!=='proposed')throw Error('Propuesta no disponible');
      const old=db.prepare('SELECT * FROM products WHERE id=?').get(item.product_id);if(JSON.stringify(old)!==item.before_json)throw Error(`Cambió ${old.reference}; vuelve a preparar su ficha`);
      const proposal=JSON.parse(item.proposal_json),changes={...proposal.fields};
      const custom=edits[id]||{};
      if(Object.keys(custom).some(k=>![...facts,'name','variant','description'].includes(k)))throw Error('Campo no permitido en revisión');
      for(const [k,v] of Object.entries(custom))changes[k]=v;
      // Empty cells in the review never erase approved values.
      for(const [k,v] of Object.entries(changes))if(v===''||v===null)delete changes[k];
      if(Object.keys(changes).length)editProduct(old.id,changes,actor);
      for(const [field,v] of Object.entries(changes)) {
        const e=proposal.evidence[field];db.prepare('INSERT INTO field_history(product_id,field,value_json,source_url,method,actor,created_at) VALUES(?,?,?,?,?,?,?)').run(old.id,field,JSON.stringify(v),e?.url||proposal.source_url,field in custom?'manual':e?.method||'extracted',actor,new Date().toISOString());
      }
      db.prepare("UPDATE enrichment_items SET state='applied',updated_at=? WHERE id=?").run(new Date().toISOString(),id);applied++;
    }
    audit(actor,'enrichment_approved','products',{applied});db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  return {applied};
}
