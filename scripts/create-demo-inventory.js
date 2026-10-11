// Synthetic fixtures for a development database; not commercial watch facts.
import ExcelJS from 'exceljs';
import { mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const dir = resolve(process.argv[2] || 'data/piloto');
await mkdir(dir, {
  recursive: true
});
const w = new ExcelJS.Workbook(),
  a = w.addWorksheet('Supuestos');
[4000, 0, 35, 100, 0, 0, .2, .2, 0, 0, 0, .035, 0, 0, 0, 0, .03, 1].forEach((v, i) => a.getCell(i + 6, 2).value = v);
const s = w.addWorksheet('Base comparada');
s.getRow(5).values = ['Marca', 'Referencia', 'Joma promo USD', 'Joma sin cupón USD', 'Precio Colombia COP', 'Mensaje despacho Joma', 'Enlace compra Jomashop', 'Fecha consulta', 'SKU Jomashop', 'Condición Joma', 'Referencia Colombia', 'Enlace comparable Colombia', 'Código cupón', 'Grupo al corte', 'Elegible comparable (1/0)'];
for (let i = 1; i <= 4; i++) {
  const ref = `PRUEBA-0${i}`;
  s.getRow(i + 5).values = ['PRUEBA', ref, i === 4 ? 900 : 100, i === 4 ? 900 : 100, i === 3 ? null : 2000000, 'In Stock.', `https://example.com/${ref}`, new Date(), ref, 'Prueba ficticia', ref, i === 3 ? '' : `https://example.com/local/${ref}`, '', '', i === 3 ? 0 : 1];
}
await w.xlsx.writeFile(join(dir, 'base-cruda.xlsx'));
const c = new ExcelJS.Workbook(),
  cs = c.addWorksheet('catalogo');
cs.addRow(['brand', 'reference', 'source_url', 'collection', 'movement', 'diameter_mm', 'material', 'crystal', 'water_resistance', 'dial_color', 'case_color', 'strap_color', 'strap', 'image_1', 'image_2', 'image_3']);
for (let i = 1; i <= 4; i++) cs.addRow(['PRUEBA', `PRUEBA-0${i}`, '', 'Ejemplo técnico', 'Cuarzo', 40, 'Acero', i === 2 ? '' : 'Zafiro', '100 metros', 'Azul', '', '', 'Acero', '', '', '']);
await c.xlsx.writeFile(join(dir, 'fichas-completadas.xlsx'));
console.log(`Generados ${join(dir, 'base-cruda.xlsx')} y ${join(dir, 'fichas-completadas.xlsx')}. Añade una foto propia en image_1 antes de importar las fichas.`);
