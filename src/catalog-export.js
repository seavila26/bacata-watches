import ExcelJS from 'exceljs';
import { db } from './db.js';
import { identityKey } from './catalog-model.js';
import { previews } from './inventory-import.js';
export const COLUMNS = ['brand', 'reference', 'source_url', 'collection', 'movement', 'diameter_mm', 'material', 'crystal', 'water_resistance', 'dial_color', 'case_color', 'strap_color', 'strap', 'image_1', 'image_2', 'image_3'];
export function catalogRow(p) {
  const images = JSON.parse(p.images_json || '[]');
  return Object.fromEntries(COLUMNS.map(k => [k, k === 'source_url' ? p.supplier_url || '' : k === 'image_1' ? p.image_url || '' : k === 'image_2' ? images[0] || '' : k === 'image_3' ? images[1] || '' : p[k] ?? '']));
}
export async function workbookBuffer(rows, columns = COLUMNS, sheet = 'catalogo') {
  const w = new ExcelJS.Workbook(),
    s = w.addWorksheet(sheet);
  s.columns = columns.map(key => ({
    header: key,
    key,
    width: key.includes('image') || key.includes('url') ? 48 : 24
  }));
  rows.forEach(r => s.addRow(r));
  s.getRow(1).font = {
    bold: true
  };
  s.views = [{
    state: 'frozen',
    ySplit: 1
  }];
  s.autoFilter = {
    from: {
      row: 1,
      column: 1
    },
    to: {
      row: 1,
      column: columns.length
    }
  };
  return Buffer.from(await w.xlsx.writeBuffer());
}
export async function exportCatalog({
  ids,
  token,
  selection
}, actor) {
  let rows;
  if (token) {
    const p = previews.get(token);
    if (!p || p.actor !== actor || p.expires < Date.now()) throw Error('Vista previa vencida');
    if (!Array.isArray(selection) || !selection.length || selection.length > 10000) throw Error('Selecciona referencias');
    rows = selection.map(i => {
      const r = p.records[i];
      if (!Number.isInteger(i) || !r || !r.key) throw Error('Referencia inválida');
      const old = db.prepare('SELECT * FROM products WHERE identity_key=?').get(r.key);
      return catalogRow(old || {
        brand: r.brand,
        reference: r.reference,
        supplier_url: r.source?.supplier_url || ''
      });
    });
  } else {
    if (!Array.isArray(ids) || !ids.length || ids.length > 10000) throw Error('Selecciona referencias');
    rows = ids.map(id => {
      const p = db.prepare('SELECT * FROM products WHERE id=?').get(id);
      if (!p) throw Error('Referencia no encontrada');
      return catalogRow(p);
    });
  }
  const seen = new Set();
  rows = rows.filter(r => {
    const k = identityKey(r.brand, r.reference);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return workbookBuffer(rows);
}
