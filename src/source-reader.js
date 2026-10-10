import {load} from 'cheerio';
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
const defaults=['www.jomashop.com','jomashop.com','cdn.jomashop.com','cdn2.jomashop.com','image.jomashop.com','cdn.jomashop.io'];
export const allowedHosts=()=>new Set([...defaults,...String(process.env.ENRICHMENT_ALLOWED_HOSTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)]);
export function sourceUrl(raw) {
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||isIP(u.hostname)||!allowedHosts().has(u.hostname.toLowerCase()))throw Error('Fuente HTTPS fuera de los dominios configurados');
  return u;
}
function publicIp(address) {
  if(isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a>=224);}
  return isIP(address)===6&&/^[23][0-9a-f]{3}:/i.test(address)&&!address.toLowerCase().startsWith('2001:db8:');
}
// Pin a validated public DNS address; redirects go through the same validation.
export async function readSource(raw,{maxBytes=4*1024*1024,redirects=0,timeoutMs=15000}={}) {
  if(redirects>3)throw Error('Demasiadas redirecciones');
  const u=sourceUrl(raw),addresses=await lookup(u.hostname,{all:true});
  if(!addresses.length||addresses.some(a=>!publicIp(a.address)))throw Error('La fuente no resuelve a una dirección pública');
  const address=addresses[0];
  const response=await new Promise((resolve,reject)=>{
    const req=https.get(u,{headers:{'user-agent':'BacataCatalog/0.5 (+catalog review)','accept':'text/html,application/json,image/webp,image/jpeg,image/png'},lookup:(_host,options,cb)=>options.all?cb(null,[address]):cb(null,address.address,address.family)},res=>{
      const chunks=[];let size=0;
      res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){res.destroy();reject(Error('Fuente supera el tamaño permitido'));}else chunks.push(chunk);});
      res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,buffer:Buffer.concat(chunks),url:u.href}));
    });req.setTimeout(timeoutMs,()=>req.destroy(Error('Tiempo de espera de la fuente agotado')));req.on('error',reject);
  });
  if(response.status>=300&&response.status<400&&response.headers.location)return readSource(new URL(response.headers.location,u).href,{maxBytes,redirects:redirects+1,timeoutMs});
  if(response.status!==200){const error=Error(`Fuente HTTP ${response.status}; no se obtuvo la ficha`);error.code='SOURCE_HTTP_ERROR';error.status=response.status;throw error;}
  return response;
}
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const canonical=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,'');
const norm=v=>clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const translations=new Map(Object.entries({'automatic':'Automático','swiss automatic':'Automático suizo','japanese automatic':'Automático japonés','swiss quartz':'Cuarzo suizo','japanese quartz':'Cuarzo japonés','self winding':'Automático','quartz':'Cuarzo','hand wind':'Cuerda manual','manual winding':'Cuerda manual','stainless steel':'Acero inoxidable','titanium':'Titanio','sapphire':'Zafiro','sapphire crystal':'Zafiro','scratch resistant sapphire':'Zafiro resistente a rayones','mineral':'Mineral','mineral crystal':'Mineral','blue':'Azul','black':'Negro','white':'Blanco','green':'Verde','silver':'Plateado','gold':'Dorado','grey':'Gris','gray':'Gris','brown':'Marrón','red':'Rojo','pink':'Rosa','orange':'Naranja','mother of pearl':'Nácar'}));
export const translate=v=>translations.get(clean(v).toLowerCase())||clean(v).replace(/\bmeters?\b/gi,'metros').replace(/\bfeet\b/gi,'pies');
const mapping={collection:['series','collection','collection name','coleccion'],movement:['movement','movimiento'],diameter_mm:['case size','case diameter','diameter','diametro'],material:['case material','material de caja'],crystal:['crystal','cristal'],water_resistance:['water resistance','resistencia al agua'],dial_color:['dial color','color de esfera'],case_color:['case color','color de caja'],strap_color:['band color','strap color','color de correa'],strap:['band material','strap material','bracelet material','material de correa']};
const aliases=new Map(Object.entries(mapping).flatMap(([key,labels])=>labels.map(label=>[norm(label),key])));
function exactReference(v,reference) {
  return canonical(v)===canonical(reference);
}
function containsReference(v,ref) {
  const escaped=ref.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`,'i').test(clean(v));
}
function productsIn(data) {
  if(Array.isArray(data))return data.flatMap(productsIn);
  if(!data||typeof data!=='object')return [];
  const type=Array.isArray(data['@type'])?data['@type']:[data['@type']];
  return [...(type.includes('Product')?[data]:[]),...(data['@graph']?productsIn(data['@graph']):[])];
}
export function extractProduct(html, expected, url) {
  const $=load(html),structured=[];
  const visible=clean($('body').clone().find('script,style,noscript').remove().end().text());
  if(/verify (?:that )?you are human|checking your browser|access denied|captcha required|just a moment/i.test(visible)||/just a moment|access denied/i.test($('title').text())) {
    const error=Error('La fuente presenta un bloqueo o verificación humana; no se intenta eludirlo');error.code='SOURCE_BLOCKED';throw error;
  }
  $('script[type="application/ld+json"]').each((_i,e)=>{try{structured.push(...productsIn(JSON.parse($(e).text())));}catch{}});
  const match=structured.find(p=>exactReference(p.mpn,expected.reference)||exactReference(p.model,expected.reference)||exactReference(p.sku,expected.reference)||containsReference(p.name,expected.reference));
  const heading=clean($('h1').first().text());
  const pageRef=clean($('[itemprop="mpn"]').first().attr('content')||$('[itemprop="mpn"]').first().text());
  if(!match&&!exactReference(pageRef,expected.reference)&&!containsReference(heading,expected.reference)) {
    if(!heading&&(/enable javascript|javascript.*(?:required|enabled)/i.test($('noscript').text())||$('[data-preload-product-name-wout-brand]').length)) {
      const error=Error('La ficha requiere JavaScript: el HTML recibido no contiene los datos del producto');error.code='SOURCE_NEEDS_RENDER';throw error;
    }
    throw Error('La página no acredita la referencia exacta; requiere revisión');
  }
  if(structured.length>1&&!containsReference(heading,expected.reference)&&!exactReference(pageRef,expected.reference))throw Error('La referencia solo aparece entre productos relacionados; requiere revisión');
  const product=match||{},brand=clean(typeof product.brand==='object'?product.brand.name:product.brand);
  if(!brand&&!containsReference(heading,expected.brand))throw Error('La página no acredita la marca de la referencia');
  if(brand&&norm(brand)!==norm(expected.brand))throw Error('La marca de la fuente no coincide');
  if(expected.condition==='Nuevo'&&/UsedCondition|RefurbishedCondition/i.test(String(product.itemCondition||'')))throw Error('La condición de la fuente no corresponde a una pieza nueva');
  const pairs=[];
  // Observed Jomashop product-details component. Accept only one primary
  // specification block whose own Model and Brand match the requested piece.
  if(['www.jomashop.com','jomashop.com'].includes(new URL(url).hostname)) {
    const bodies=$('.more-detail-body');
    if(bodies.length===1) {
      const rows=[];
      bodies.find('.more-detail-content').each((_i,e)=>{
        const labels=$(e).children('.more-label'),values=$(e).children('.more-value');
        if(labels.length===1&&values.length===1)rows.push([clean(labels.text()),clean(values.text())]);
      });
      const models=rows.filter(([label])=>norm(label)==='model'),brands=rows.filter(([label])=>norm(label)==='brand');
      if(models.length===1&&brands.length===1) {
        if(!exactReference(models[0][1],expected.reference)||norm(brands[0][1])!==norm(expected.brand))throw Error('La referencia o marca del bloque principal de especificaciones no coincide');
        pairs.push(...rows);
      }
    }
  }
  for(const prop of product.additionalProperty||[])if(prop?.name&&prop?.value!=null)pairs.push([clean(prop.name),clean(prop.value)]);
  $('table tr').each((_i,e)=>{const cells=$(e).find('th,td');if(cells.length===2)pairs.push([clean($(cells[0]).text()),clean($(cells[1]).text())]);});
  $('dt').each((_i,e)=>{const dd=$(e).next('dd');if(dd.length)pairs.push([clean($(e).text()),clean(dd.text())]);});
  const fields={},evidence={},warnings=[],conflicted=new Set();
  for(const [label,raw] of pairs) {
    const key=aliases.get(norm(label));if(!key||conflicted.has(key)||!raw||raw.length>500)continue;
    let value=translate(raw);
    if(key==='diameter_mm') {
      const m=raw.match(/^(\d+(?:[.,]\d+)?)\s*mm$/i);if(!m){warnings.push(`Diámetro no interpretable: ${raw}`);continue;}value=Number(m[1].replace(',','.'));
      if(value<1||value>100)continue;
    }
    if(key in fields&&fields[key]!==value){conflicted.add(key);delete fields[key];delete evidence[key];warnings.push(`Valores contradictorios: ${label}`);continue;}
    fields[key]=value;evidence[key]={url,label,raw,method:match?'structured/html':'html'};
  }
  if(product.name){fields.name=clean(product.name);evidence.name={url,label:'Product.name',raw:fields.name,method:'jsonld'};}
  const productImages=Array.isArray(product.image)?product.image:product.image?[product.image]:[];
  const rawImages=(productImages.length?productImages:[$('meta[property="og:image"]').attr('content')]).filter(Boolean);
  const images=[];
  for(const img of rawImages)try{const v=typeof img==='object'?(img.url||img.contentUrl):img;const u=new URL(v,url);if(u.protocol==='https:'&&allowedHosts().has(u.hostname)&&!images.includes(u.href))images.push(u.href);}catch{}
  return {fields,evidence,images:images.slice(0,9),warnings,reference_verified:true};
}
export function fallbackSpanish(p,fields) {
  const lines=[`${p.brand}${fields.collection?' '+fields.collection:''}, referencia ${p.reference}.`];
  for(const [key,label] of [['movement','Movimiento'],['diameter_mm','Diámetro de caja'],['material','Material de caja'],['crystal','Cristal'],['water_resistance','Resistencia al agua'],['dial_color','Esfera'],['case_color','Color de caja'],['strap_color','Color de correa'],['strap','Correa o brazalete']])if(fields[key]!=null&&fields[key]!=='')lines.push(`${label}: ${fields[key]}${key==='diameter_mm'?' mm':''}.`);
  return {name:`${p.brand}${fields.collection?' '+fields.collection:''} ${p.reference}`,description:lines.join(' '),method:'template'};
}
