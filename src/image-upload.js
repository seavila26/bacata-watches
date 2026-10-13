import sharp from 'sharp';
import { httpError } from './security.js';
sharp.concurrency(1);
sharp.cache({ memory: 16, files: 0, items: 16 });
let busy = false;
/** Decode and rewrite images, rather than trusting magic bytes or filenames. */
export async function prepareImage(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 5 * 1024 * 1024) throw httpError(413, 'Fotografía de máximo 5 MB');
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!png && !jpeg && !webp) throw httpError(400, 'Solo fotografías PNG, JPEG o WebP');
  if (busy) throw httpError(429, 'Hay una fotografía en procesamiento. Espera unos segundos.');
  busy = true;
  try {
    const input = sharp(bytes, { limitInputPixels: 24_000_000, failOn: 'warning' }).timeout({ seconds: 15 });
    const info = await input.metadata();
    if (!['jpeg', 'png', 'webp'].includes(info.format) || (info.pages || 1) > 1) throw httpError(400, 'Solo fotografías PNG, JPEG o WebP sin animación');
    const data = await input.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
    return data;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(400, 'Fotografía inválida, dañada o con dimensiones demasiado grandes');
  } finally { busy = false; }
}
