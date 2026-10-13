import { readWorkbook } from './workbook-reader.js';
import { randomUUID } from 'node:crypto';
import { db, settings, calculate, audit } from './db.js';
import { COLUMNS, catalogRow, workbookBuffer } from './catalog-export.js';
import { identityKey, normalizeIdentity, publicationIssues } from './catalog-model.js';
import { imageUrl } from './product-editor.js';
import { reconcileProduct } from './publications.js';
const previews = new Map(),
  reports = new Map();
function value(c) {
  const v = c.value;
  if (v && typeof v === 'object') {
    if ('error' in v || v.result?.error) throw Error('Error de fórmula');
    if ('formula' in v || 'sharedFormula' in v) {
      if (v.result == null) throw Error('Fórmula sin resultado');
      return v.result;
    }
    if (v.richText) return v.richText.map(x => x.text).join('');
    if ('text' in v) return v.text;
    throw Error('Celda inválida');
  }
  return v;
}
export async function previewCatalog(buffer, actor) {
  const w = await readWorkbook(buffer);
  const s = w.getWorksheet('catalogo');
  if (!s) throw Error('Falta la hoja catalogo');
  if (s.rowCount > 10001) throw Error('Máximo 10.000 filas');
  const headers = Array.from({
    length: Math.max(s.columnCount, 16)
  }, (_, i) => value(s.getRow(1).getCell(i + 1)) ?? '');
  if (headers.length !== 16 || headers.some((v, i) => v !== COLUMNS[i])) throw Error('La plantilla requiere las 16 columnas exactas, en su orden');
  const rows = [],
    seen = new Set();
  for (let n = 2; n <= s.rowCount; n++) {
    const row = s.getRow(n);
    if (!row.hasValues) continue;
    let data = {},
      old = null,
      changes = {},
      issues = [];
    try {
      data = Object.fromEntries(COLUMNS.map((k, i) => [k, value(row.getCell(i + 1)) ?? '']));
      data.brand = normalizeIdentity(data.brand);
      data.reference = normalizeIdentity(data.reference);
      if (!data.brand || !data.reference) throw Error('Falta marca o referencia');
      const key = identityKey(data.brand, data.reference);
      if (seen.has(key)) throw Error('Referencia duplicada en archivo');
      seen.add(key);
      old = db.prepare('SELECT * FROM products WHERE identity_key=? AND source_snapshot_json IS NOT NULL').get(key);
      if (!old) throw Error('Referencia inexistente en oportunidades guardadas');
      for (const k of COLUMNS.slice(2)) {
        const raw = data[k];
        if (raw == null || String(raw).trim() === '') continue;
        if (k === 'diameter_mm') {
          const v = Number(raw);
          if (!Number.isFinite(v) || v < 1 || v > 100) throw Error('Diámetro inválido');
          changes[k] = v;
        } else if (k.startsWith('image_')) changes[k] = imageUrl(String(raw).trim());else {
          if (typeof raw !== 'string' || raw.length > 4000) throw Error(`Valor inválido: ${k}`);
          const v = raw.trim();
          if (k === 'source_url') {
            const u = new URL(v);
            if (u.protocol !== 'https:' || u.username || u.password) throw Error('source_url requiere HTTPS');
            changes.supplier_url = u.href;
          } else changes[k] = v;
        }
      }
      const next = merge(old, changes);
      issues = publicationIssues(next, calculate(next));
    } catch (e) {
      rows.push({
        row: n,
        brand: data.brand || '',
        reference: data.reference || '',
        data,
        rejected: true,
        reason: e.message
      });
      continue;
    }
    rows.push({
      row: n,
      brand: old.brand,
      reference: old.reference,
      data,
      changes,
      baseline: JSON.stringify(old),
      id: old.id,
      issues,
      status: issues.length ? ['paused', 'published'].includes(old.status) ? 'paused' : 'pending' : old.status === 'paused' && old.pause_reason === 'Pausa manual' ? 'paused' : 'published'
    });
  }
  if (!rows.length) throw Error('La plantilla no contiene referencias');
  const token = randomUUID(),
    expires = Date.now() + 15 * 60000;
  prune(previews);
  previews.set(token, {
    rows,
    actor,
    expires,
    settingsBaseline: JSON.stringify(settings())
  });
  return {
    token,
    expires_at: new Date(expires).toISOString(),
    rows: rows.map(({
      baseline,
      ...r
    }) => r)
  };
}
function merge(old, changes) {
  const next = {
      ...old,
      ...Object.fromEntries(Object.entries(changes).filter(([k]) => !k.startsWith('image_')))
    },
    images = JSON.parse(old.images_json || '[]');
  if (changes.image_1) next.image_url = changes.image_1;
  if (changes.image_2) images[0] = changes.image_2;
  if (changes.image_3) images[1] = changes.image_3;
  next.images_json = JSON.stringify(images);
  return next;
}
function prune(map) {
  for (const [k, p] of map) if (p.expires < Date.now()) map.delete(k);
  if (map.size >= 10) map.delete(map.keys().next().value);
}
export function commitCatalog(token, actor) {
  const p = previews.get(token);
  if (!p || p.actor !== actor || p.expires < Date.now()) throw Error('Vista previa vencida');
  if (p.settingsBaseline !== JSON.stringify(settings())) throw Error('Las reglas cambiaron. Analiza otra vez');
  const result = {
      published: 0,
      pending: 0,
      low_margin: 0,
      rejected: 0,
      rows: []
    },
    now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const r of p.rows) {
      if (r.rejected) {
        result.rejected++;
        result.rows.push({
          ...r,
          category: 'rejected'
        });
        continue;
      }
      const old = db.prepare('SELECT * FROM products WHERE id=?').get(r.id);
      if (JSON.stringify(old) !== r.baseline) throw Error(`La referencia ${r.reference} cambió. Analiza otra vez`);
      const next = merge(old, r.changes),
        keys = [...new Set([...Object.keys(r.changes).filter(k => !k.startsWith('image_')), 'image_url', 'images_json'])];
      db.prepare(`UPDATE products SET ${keys.map(k => `${k}=?`).join(',')},last_confirmed_at=?,updated_at=? WHERE id=?`).run(...keys.map(k => next[k]), now, now, r.id);
      for (const [field, v] of Object.entries(r.changes)) db.prepare('INSERT INTO field_history(product_id,field,value_json,source_url,method,actor,created_at) VALUES(?,?,?,?,?,?,?)').run(r.id, field, JSON.stringify(v), r.data.source_url || '', 'catalog_xlsx', actor, now);
      const saved = db.prepare('SELECT * FROM products WHERE id=?').get(r.id),
        out = reconcileProduct(saved, {
          automatic: true,
          confirmed: true,
          actor,
          now
        });
      const category = out.status === 'published' ? 'published' : out.analysis.margin != null && !out.analysis.eligible ? 'low_margin' : 'pending';
      result[category]++;
      result.rows.push({
        ...catalogRow(saved),
        category,
        reason: out.status === 'paused' && old.pause_reason === 'Pausa manual' ? 'Pausa manual: reactivar desde Publicaciones' : out.reason || out.issues.join('; ')
      });
    }
    audit(actor, 'catalog_import', 'products', {
      published: result.published,
      pending: result.pending,
      low_margin: result.low_margin,
      rejected: result.rejected
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  previews.delete(token);
  const report_token = randomUUID();
  prune(reports);
  reports.set(report_token, {
    actor,
    expires: Date.now() + 24 * 3600000,
    rows: result.rows
  });
  return {
    ...result,
    report_token
  };
}
export async function exportPending(token, actor) {
  const p = reports.get(token);
  if (!p || p.actor !== actor || p.expires < Date.now()) throw Error('Resumen vencido');
  return workbookBuffer(p.rows.filter(r => r.category !== 'published').map(r => ({
    ...r,
    ...r.data
  })), [...COLUMNS, 'category', 'reason'], 'pendientes');
}
