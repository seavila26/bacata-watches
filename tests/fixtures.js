import ExcelJS from 'exceljs';
export async function fixture({
  price = 544,
  date = '2026-10-07',
  count = 1,
  invalid = false,
  lux = false
} = {}) {
  const w = new ExcelJS.Workbook(),
    a = w.addWorksheet('Supuestos');
  [3216.01, .03, 35, 100, .01, 0, .1, .1, .19, .19, 1, .03, .02, 25000, 35000, 250000, .1, 1].forEach((v, i) => a.getCell(i + 6, 2).value = v);
  const s = w.addWorksheet('Base comparada');
  const headers = ['Marca', 'Referencia', 'Joma promo USD', 'Joma sin cupón USD', 'Precio Colombia COP', 'Mensaje despacho Joma', 'Enlace compra Jomashop', 'Fecha consulta', 'SKU Jomashop', 'Condición Joma', 'Referencia Colombia', 'Enlace comparable Colombia', 'Código cupón', 'Grupo al corte', 'Elegible comparable (1/0)'];
  s.getRow(5).values = headers;
  for (let i = 0; i < count; i++) s.getRow(i + 6).values = ['Bulova', i ? `CODE / SPACE ${i + 1}` : '96B349', invalid ? -1 : price, price, 3792000, 'In Stock.', 'https://www.jomashop.com/watch.html', new Date(date), 'SKU', 'Nuevo', '96B349', 'https://example.com/watch', '', '10–20%', 1];
  if (lux) {
    const l = w.addWorksheet('Base lujo');
    l.getRow(5).values = ['Marca', 'Referencia Jomashop', 'Nombre del reloj', 'Joma promoción USD', 'Joma sin cupón USD', 'Precio local original', 'Moneda local original', 'Cotización COP (editar)', 'Disponibilidad Joma', 'URL compra Jomashop', 'Fecha consulta', 'SKU Jomashop', 'Condición Joma', 'Referencia local', 'URL comparable local', 'Cupón', 'Oferta local COP exacta con stock (1/0)'];
    l.getRow(6).values = ['Bulova', '96B349', 'Repeated', price, price, 3792000, 'COP', null, 'In Stock.', 'https://www.jomashop.com/watch.html', new Date(date), 'SKU', 'Nuevo', '96B349', '', '', 1];
    l.getRow(7).values = ['Rolex', 'TEST/REF', 'Rolex Test', 10000, 10000, null, null, null, 'In Stock.', 'https://www.jomashop.com/test.html', new Date(date), 'RLX', 'Nuevo', null, null, null, 0];
    l.getCell('R7').value = {
      formula: '1+""',
      result: {
        error: '#VALUE!'
      }
    };
  }
  return Buffer.from(await w.xlsx.writeBuffer());
}
