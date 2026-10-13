import yauzl from 'yauzl';
import { httpError } from './security.js';
export const WORKBOOK_LIMIT = 15 * 1024 * 1024;
const inflatedLimit = 64 * 1024 * 1024, entryLimit = 20 * 1024 * 1024;
/** Stream all ZIP entries before parsing. Declared sizes alone are not trusted. */
export function validateWorkbookArchive(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return Promise.reject(httpError(400, 'Archivo XLSX inválido'));
  if (buffer.length > WORKBOOK_LIMIT) return Promise.reject(httpError(413, 'Excel de máximo 15 MB'));
  return new Promise((resolve, reject) => yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
    if (error) return reject(httpError(400, 'El archivo no es un XLSX válido'));
    let settled = false, total = 0, entries = 0; const names = new Set();
    const fail = error => { if (settled) return; settled = true; zip.close(); reject(error.status ? error : httpError(400, 'Archivo XLSX dañado o inválido')); };
    zip.on('error', fail);
    zip.on('end', () => {
      if (settled) return;
      settled = true; zip.close();
      if (!names.has('[Content_Types].xml') || !names.has('xl/workbook.xml')) return reject(httpError(400, 'El archivo no contiene un libro XLSX'));
      resolve();
    });
    zip.on('entry', entry => {
      if (settled) return;
      const name = entry.fileName;
      if (++entries > 2000 || entry.uncompressedSize > entryLimit || total + entry.uncompressedSize > inflatedLimit) return fail(httpError(413, 'Excel demasiado grande al descomprimir'));
      if (names.has(name) || entry.generalPurposeBitFlag & 1 || /(^|\/)vbaProject\.bin$/i.test(name) || ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000) return fail(httpError(400, 'XLSX con contenido no permitido'));
      names.add(name);
      zip.openReadStream(entry, (error, stream) => {
        if (error) return fail(error);
        if (settled) { stream.destroy(); return; }
        (async () => {
          let size = 0, tail = ''; const xml = /\.(xml|rels)$/i.test(name), decoder = xml && new TextDecoder('utf-8', { fatal: true });
          for await (const chunk of stream) {
            size += chunk.length; total += chunk.length;
            if (size > entryLimit || total > inflatedLimit) throw httpError(413, 'Excel demasiado grande al descomprimir');
            if (xml) {
              const text = tail + decoder.decode(chunk, { stream: true });
              if (text.includes('\0') || /<!\s*(DOCTYPE|ENTITY)/i.test(text)) throw httpError(400, 'XML con contenido no permitido');
              tail = text.slice(-64);
            }
          }
          if (decoder) decoder.decode();
          if (size !== entry.uncompressedSize) throw httpError(400, 'Tamaño interno de XLSX inválido');
          if (!settled) zip.readEntry();
        })().catch(fail);
      });
    });
    zip.readEntry();
  }));
}
