import ExcelJS from 'exceljs';
import {randomUUID} from 'node:crypto';
import {db,audit} from './db.js';
import {identityKey,sourceFinance} from './catalog-model.js';
const previews = new Map();
const text = v => String(v ?? '').trim();
function value(cell) {
  const v = cell.value;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('formula' in v || 'sharedFormula' in v) return v.result && typeof v.result === 'object' && v.result.error ? null : v.result ?? null;
    if ('error' in v) return null;
    if ('text' in v) return v.text;
    if (v.richText) return v.richText.map(t => t.text).join('');
  }
  return v;
}
function number(v, field, optional = false) {
  if (v === null || v === undefined || v === '') {if (optional) return null; throw Error(`Falta ${field}`);}
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e12) throw Error(`Número inválido: ${field}`);
  return v;
}
function url(v) {
  if (!v) return '';
  try {const u=new URL(text(v));if(u.protocol==='https:')return u.href;}catch{}
  throw Error('Enlace de proveedor inválido (requiere HTTPS)');
}
function readAssumptions(sheet) {
  if (!sheet) throw Error('Falta la hoja Supuestos');
  const names=['fx','fxFee','freightLow','freightHigh','insurance','dutySmall','dutyLow','dutyHigh','importVat','saleVat','recoverVat','fee','warranty','nationalShipping','managementLow','managementHigh','discount','usePromo'];
  const a = Object.fromEntries(names.map((name,i)=>[name,number(value(sheet.getCell(i+6,2)),name)]));
  if (a.fx < 100 || a.fx > 20000) throw Error('Tasa COP/USD fuera del rango permitido');
  for (const key of ['fxFee','insurance','dutySmall','dutyLow','dutyHigh','importVat','saleVat','fee','warranty','discount']) if(a[key]>1)throw Error(`Supuesto fuera de rango: ${key}`);
  for (const key of ['recoverVat','usePromo']) if(![0,1].includes(a[key]))throw Error(`Supuesto inválido: ${key}`);
  if(1/(1+a.saleVat)-a.fee-a.warranty<=0)throw Error('Comisiones incompatibles con los supuestos');
  return a;
}
export async function parseInventory(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const assumptions = readAssumptions(workbook.getWorksheet('Supuestos'));
  const layouts = [
    ['Base comparada',{brand:'Marca',reference:'Referencia',promo:'Joma promo USD',regular:'Joma sin cupón USD',market:'Precio Colombia COP',availability:'Mensaje despacho Joma',supplier_url:'Enlace compra Jomashop',date:'Fecha consulta',sku:'SKU Jomashop',condition:'Condición Joma',local_ref:'Referencia Colombia',local_url:'Enlace comparable Colombia',coupon:'Código cupón',group:'Grupo al corte',eligible:'Elegible comparable (1/0)'}],
    ['Base lujo',{brand:'Marca',reference:'Referencia Jomashop',name:'Nombre del reloj',promo:'Joma promoción USD',regular:'Joma sin cupón USD',market:'Precio local original',currency:'Moneda local original',manual_market:'Cotización COP (editar)',availability:'Disponibilidad Joma',supplier_url:'URL compra Jomashop',date:'Fecha consulta',sku:'SKU Jomashop',condition:'Condición Joma',local_ref:'Referencia local',local_url:'URL comparable local',coupon:'Cupón',evidence:'Oferta local COP exacta con stock (1/0)'}]
  ];
  const records=[], seen=new Map();let duplicates=0, formulaErrors=0;
  for (const [sheetName,mapping] of layouts) {
    const sheet=workbook.getWorksheet(sheetName);if(!sheet)continue;
    if(sheet.rowCount>10005)throw Error('Máximo 10.000 filas por hoja');
    const headers=new Map();sheet.getRow(5).eachCell((c,i)=>headers.set(text(value(c)),i));
    for(const label of Object.values(mapping))if(!headers.has(label))throw Error(`Falta columna ${label} en ${sheetName}`);
    for(let n=6;n<=sheet.rowCount;n++) {
      const row=sheet.getRow(n), r=Object.fromEntries(Object.entries(mapping).map(([k,h])=>[k,value(row.getCell(headers.get(h)))]));
      if(!r.brand&&!r.reference)continue;
      const warnings=[],errors=[];let source=null, key='';
      row.eachCell(c=>{const v=c.value;if(v&&typeof v==='object'&&((v.result&&v.result.error)||v.error))formulaErrors++;});
      try {
        const brand=text(r.brand),reference=text(r.reference);
        if(!brand||!reference||brand.length>100||reference.length>150||/[\u0000-\u001f]/.test(reference))throw Error('Marca o referencia inválida');
        key=identityKey(brand,reference);
        const date=r.date instanceof Date?r.date.toISOString():new Date(text(r.date)).toISOString();
        if(!Number.isFinite(Date.parse(date)))throw Error('Fecha de origen inválida');
        let market=number(r.market,'precio local',true);
        if(r.currency==='USD'&&market!=null){market*=assumptions.fx;warnings.push('Comparable convertido de USD; no cotización firme COP');}
        if(r.manual_market!=null)market=number(r.manual_market,'cotización manual');
        if(market===0)market=null;
        source={brand,reference,name:text(r.name),sheet:sheetName,row:n,date,
          promo_usd:number(r.promo,'precio promocional USD'),regular_usd:number(r.regular,'precio sin cupón USD'),
          market_cop:market,availability:text(r.availability),supplier_url:url(r.supplier_url),sku:text(r.sku),
          condition:text(r.condition),local_ref:text(r.local_ref),local_url:text(r.local_url),coupon:text(r.coupon),
          evidence:sheetName==='Base lujo'?r.evidence===1:r.eligible===1,assumptions};
        if(source.promo_usd<=0||source.regular_usd<=0)throw Error('Precio de compra debe ser positivo');
        if(!market)warnings.push('Sin comparable local: requiere cotización');
        if(!source.evidence)warnings.push('Comparable local pendiente de validación');
        if(source.local_ref&&source.local_ref!==reference)warnings.push('Revisar equivalencia de referencia colombiana');
        if(source.availability!=='In Stock.')warnings.push('Disponibilidad del proveedor sin confirmar');
        if((assumptions.usePromo?source.promo_usd:source.regular_usd)>2000)warnings.push('Cotizar importación ordinaria');
        if(source.coupon)warnings.push(`Confirmar cupón ${source.coupon}`);
        const old=seen.get(key);
        if(old) {duplicates++;old.warnings.push(`También aparece en ${sheetName}, fila ${n}; se conserva ${old.sheet}`);continue;}
      }catch(e){errors.push(e.message);}
      const analysis=source?sourceFinance(source,null,null):null;
      if(analysis?.margin_without_vat_credit!=null&&analysis.margin_without_vat_credit<0)warnings.push('Contribución negativa sin IVA descontable en el modelo');
      const group=analysis?.margin==null?'pending':!source.evidence?'review':analysis.margin>.2?'high':analysis.margin>=.1?'priority':analysis.margin>=.02?'low':'outside';
      const record={index:records.length,key,brand:text(r.brand),reference:text(r.reference),sheet:sheetName,row:n,source,analysis,group,warnings,errors};
      records.push(record);if(key&&!errors.length)seen.set(key,record);
    }
  }
  if(!records.length)throw Error('No se encontraron Base comparada o Base lujo con referencias');
  return {records,duplicates,formulaErrors,assumptions};
}
export async function previewInventory(buffer, actor) {
  const parsed=await parseInventory(buffer);
  for (const r of parsed.records) {
    const old=r.key?db.prepare('SELECT * FROM products WHERE identity_key=?').get(r.key):null;
    r.existing_id=old?.id??null;r.baseline=old?JSON.stringify(old):null;r.action=old?'update':'create';
    if(old?.source_updated_at&&r.source&&Date.parse(r.source.date)<Date.parse(old.source_updated_at)) {r.errors.push('El corte es anterior al dato guardado');r.action='blocked';}
  }
  for(const [token,p] of previews)if(p.expires<Date.now())previews.delete(token);
  if(previews.size>=5)previews.delete(previews.keys().next().value);
  const token=randomUUID(),expires=Date.now()+15*60000;
  previews.set(token,{...parsed,actor,expires});
  const {records,duplicates,formulaErrors,assumptions}=parsed;
  return {token,expires_at:new Date(expires).toISOString(),duplicates,formula_errors_ignored:formulaErrors,assumptions,
    summary:{total:records.length,create:records.filter(r=>r.action==='create'&&!r.errors.length).length,update:records.filter(r=>r.action==='update'&&!r.errors.length).length,blocked:records.filter(r=>r.errors.length).length},
    records:records.map(({source,baseline,key,...r})=>({...r,availability:source?.availability??'',date:source?.date??'',sku:source?.sku??''}))};
}
export function commitInventory(token, selection, actor) {
  const p=previews.get(token);
  if(!p||p.actor!==actor||p.expires<Date.now())throw Error('La vista previa venció. Vuelve a analizar el archivo.');
  if(!Array.isArray(selection)||!selection.length||selection.length>10000||new Set(selection).size!==selection.length)throw Error('Selecciona referencias válidas sin repetir');
  const rows=selection.map(i=>{const r=p.records[i];if(!Number.isInteger(i)||!r||r.errors.length)throw Error('Selección inválida o con errores');return r;});
  let created=0,updated=0,paused=0;const now=new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    for(const r of rows) {
      const old=db.prepare('SELECT * FROM products WHERE identity_key=?').get(r.key);
      if((old?JSON.stringify(old):null)!==r.baseline)throw Error(`La referencia ${r.reference} cambió. Genera otra vista previa.`);
      const source=r.source, snapshot=JSON.stringify(source),usd=source.assumptions.usePromo?source.promo_usd:source.regular_usd;
      if(old) {
        const changed=old.source_snapshot_json!==snapshot;
        const status=old.status==='published'&&changed?'paused':old.status;
        if(status!==old.status)paused++;
        db.prepare('UPDATE products SET price_usd=?,shipping_usd=?,market_cop=?,supplier_url=?,source_snapshot_json=?,source_updated_at=?,cost_verified=?,supplier_confirmed_at=?,status=?,updated_at=? WHERE id=?')
          .run(usd,usd<=2000?source.assumptions.freightLow:source.assumptions.freightHigh,Math.round(source.market_cop??0),source.supplier_url,snapshot,source.date,changed?0:old.cost_verified,changed?null:old.supplier_confirmed_at,status,now,old.id);
        updated++;
      } else {
        db.prepare(`INSERT INTO products(id,identity_key,brand,name,reference,variant,condition,supplier,supplier_url,price_usd,shipping_usd,market_cop,stock,status,sale_mode,source_snapshot_json,source_updated_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(randomUUID(),r.key,r.brand,source.name||`${r.brand} ${r.reference}`,r.reference,'',source.condition,'Jomashop',source.supplier_url,usd,usd<=2000?source.assumptions.freightLow:source.assumptions.freightHigh,Math.round(source.market_cop??0),0,'pending','quote',snapshot,source.date,now);
        created++;
      }
    }
    db.prepare('INSERT INTO jobs(status,source,imported,started_at,finished_at) VALUES(?,?,?,?,?)').run('success','xlsx/manual',rows.length,now,now);
    audit(actor,'inventory_import','products',{created,updated,paused,selected:rows.length});db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  previews.delete(token);return {imported:rows.length,created,updated,paused};
}
