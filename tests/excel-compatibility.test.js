import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

test('patched UUID dependency supports ExcelJS extended conditional formatting and XLSX roundtrip', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('catalogo');
  sheet.addRows([[10], [20], [30]]);
  sheet.addConditionalFormatting({ ref: 'A1:A3', rules: [{
    type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }],
    color: { argb: 'FF0B1D3A' }, gradient: false
  }] });
  const bytes = await workbook.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(bytes);
  assert.equal(restored.getWorksheet('catalogo').getCell('A3').value, 30);
  const rule = restored.getWorksheet('catalogo').conditionalFormattings[0].rules[0];
  assert.equal(rule.type, 'dataBar');
  assert.match(rule.x14Id, /^\{[A-F0-9-]{36}\}$/);
});
