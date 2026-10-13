import { Worker } from 'node:worker_threads';
import ExcelJS from 'exceljs';
import { httpError } from './security.js';
let busy = false;
export async function readWorkbook(buffer) {
  if (busy) throw httpError(429, 'Hay un Excel en procesamiento. Espera unos segundos.');
  busy = true;
  try {
    const model = await new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./workbook-worker.js', import.meta.url), { workerData: buffer, execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32 } });
      let done = false;
      const finish = (error, model) => { if (done) return; done = true; clearTimeout(timer); worker.terminate().catch(() => {}); if (error) reject(error); else resolve(model); };
      const timer = setTimeout(() => finish(httpError(413, 'Excel excedió el tiempo de procesamiento')), 30000);
      worker.once('message', message => finish(message.error ? httpError(message.status, message.error) : null, message.model));
      worker.once('error', () => finish(httpError(413, 'Excel excedió los recursos permitidos o es inválido')));
      worker.once('exit', () => { if (!done) finish(httpError(400, 'No se pudo procesar el Excel')); });
    });
    const workbook = new ExcelJS.Workbook(); workbook.model = model; return workbook;
  } finally { busy = false; }
}
