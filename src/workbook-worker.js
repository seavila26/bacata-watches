import { parentPort, workerData } from 'node:worker_threads';
import ExcelJS from 'exceljs';
import { validateWorkbookArchive } from './workbook-archive.js';
try {
  const bytes = Buffer.from(workerData);
  await validateWorkbookArchive(bytes);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  if (workbook.worksheets.length > 32 || workbook.worksheets.some(sheet => sheet.rowCount > 10005 || sheet.columnCount > 200)) throw Object.assign(Error('Excel excede el límite de hojas, filas o columnas'), { status: 413 });
  parentPort.postMessage({ model: workbook.model });
} catch (error) { parentPort.postMessage({ error: error.status ? error.message : 'Archivo XLSX inválido', status: error.status || 400 }); }
