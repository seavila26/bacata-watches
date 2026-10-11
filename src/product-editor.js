import { db, audit, decorate, calculate } from './db.js';
import { reconcileProduct } from './publications.js';
const strings = ['brand', 'name', 'variant', 'description', 'image_url', 'supplier_url', 'collection', 'movement', 'style', 'condition', 'material', 'crystal', 'water_resistance', 'dial_color', 'case_color', 'strap_color', 'strap', 'package_contents', 'provenance'];
export function imageUrl(v) {
  if (/^\/(assets|uploads)\/[a-zA-Z0-9_/-]+\.(png|jpg|jpeg|webp)$/.test(v)) return v;
  try {
    const u = new URL(v);
    if (u.protocol === 'https:' && !u.username && !u.password) return u.href;
  } catch {}
  throw Error('Usa una imagen HTTPS o un archivo subido al administrador');
}
export function planEditProduct(old, d) {
  const allowed = [...strings, 'approved_price_cop', 'diameter_mm', 'images'];
  if (Object.keys(d).some(k => !allowed.includes(k))) throw Error('Campo no permitido');
  const next = {
    ...old
  };
  for (const k of strings) if (k in d) {
    if (typeof d[k] !== 'string' || d[k].length > 4000) throw Error(`Valor inválido: ${k}`);
    next[k] = d[k].trim();
  }
  if (next.brand !== old.brand) throw Error('La marca identifica la referencia y no se cambia');
  if (!next.name) throw Error('Completa nombre');
  for (const k of ['approved_price_cop', 'diameter_mm']) if (k in d) {
    if (d[k] === null || d[k] === '') {
      next[k] = null;
      continue;
    }
    if (typeof d[k] !== 'number' || !Number.isFinite(d[k]) || d[k] <= 0 || d[k] > 1e12 || k === 'diameter_mm' && d[k] > 100 || k === 'approved_price_cop' && !Number.isInteger(d[k])) throw Error(`Número inválido: ${k}`);
    next[k] = d[k];
  }
  if (next.image_url) next.image_url = imageUrl(next.image_url);
  if (next.supplier_url) {
    const u = new URL(next.supplier_url);
    if (u.protocol !== 'https:' || u.username || u.password) throw Error('Proveedor requiere HTTPS');
  }
  if ('images' in d) {
    if (!Array.isArray(d.images) || d.images.length > 8) throw Error('Máximo ocho fotografías adicionales');
    next.images_json = JSON.stringify(d.images.map(imageUrl));
  }
  return next;
}
export function editProduct(id, d, actor) {
  const old = db.prepare('SELECT * FROM products WHERE id=?').get(id);
  if (!old) throw Error('Referencia no encontrada');
  const next = planEditProduct(old, d);
  const keys = [...strings, 'approved_price_cop', 'diameter_mm', 'images_json'];
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE products SET ${keys.map(k => `${k}=?`).join(',')},updated_at=? WHERE id=?`).run(...keys.map(k => next[k]), new Date().toISOString(), id);
    for (const [field, value] of Object.entries(d)) db.prepare('INSERT INTO field_history(product_id,field,value_json,source_url,method,actor,created_at) VALUES(?,?,?,?,?,?,?)').run(id, field, JSON.stringify(value), '', 'manual', actor, new Date().toISOString());
    reconcileProduct(db.prepare('SELECT * FROM products WHERE id=?').get(id), {
      actor
    });
    audit(actor, 'product_edited', id, {
      fields: Object.keys(d)
    });
    if ('approved_price_cop' in d) audit(actor, 'price_changed', id, {
      before: calculate(old).price,
      after: calculate(next).price
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return decorate(db.prepare('SELECT * FROM products WHERE id=?').get(id));
}
