import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { SessionStore, RateLimiter, clientAddress, readBody, readJson, decodeBase64 } from '../src/security.js';
import { prepareImage } from '../src/image-upload.js';
import { validateWorkbookArchive } from '../src/workbook-archive.js';
import { readWorkbook } from '../src/workbook-reader.js';
import sharp from 'sharp';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
const request = token => ({ headers: { cookie: 'aurel_session=' + token } });
test('sessions reject malformed signatures, expire on inactivity/absolute age, rotate and revoke', () => {
  let now = 100;
  const sessions = new SessionStore('test-secret', { ttl: 1000, idle: 200, max: 2, clock: () => now });
  const first = request(sessions.create(request('')));
  assert.equal(sessions.authenticate(first), true);
  for (const token of ['a'.repeat(64) + '.' + 'é'.repeat(64), 'a'.repeat(64) + '.' + 'f'.repeat(64), '..', 'x', sessions.token(first) + '.extra']) assert.equal(sessions.authenticate(request(token)), false);
  now += 201; assert.equal(sessions.authenticate(first), false);
  const active = request(sessions.create(request('')));
  for (let i = 0; i < 6; i++) { now += 150; assert.equal(sessions.authenticate(active), true); }
  now += 101; assert.equal(sessions.authenticate(active), false);
  const old = request(sessions.create(request('')));
  const current = request(sessions.create(old));
  assert.equal(sessions.authenticate(old), false); assert.equal(sessions.authenticate(current), true);
  sessions.revoke(current); assert.equal(sessions.authenticate(current), false);
  for (let i = 0; i < 10; i++) sessions.create(request(''));
  assert.equal(sessions.entries.size, 2);
});
test('login throttling has a finite window/capacity and forwarded IP requires trusted loopback', () => {
  let now = 1000;
  const limits = new RateLimiter({ limit: 2, windowMs: 10000, maxKeys: 2, clock: () => now });
  assert.ok(limits.consume('a').allowed); assert.ok(limits.consume('a').allowed);
  assert.deepEqual(limits.consume('a'), { allowed: false, retryAfter: 10 });
  assert.ok(limits.consume('b').allowed); assert.equal(limits.consume('c').allowed, false);
  now += 10001; assert.ok(limits.consume('a').allowed);
  limits.reset('a'); assert.ok(limits.consume('a').allowed);
  const req = { socket: { remoteAddress: '198.51.100.10' }, headers: { 'x-real-ip': '192.0.2.1', 'x-forwarded-for': '192.0.2.2' } };
  assert.equal(clientAddress(req, true), '198.51.100.10');
  req.socket.remoteAddress = '127.0.0.1';
  assert.equal(clientAddress(req), '127.0.0.1'); assert.equal(clientAddress(req, true), '192.0.2.1');
  req.headers['x-real-ip'] = '192.0.2.1, 192.0.2.2'; assert.equal(clientAddress(req, true), '127.0.0.1');
});
test('body limits count UTF-8 bytes and JSON/base64 inputs reject malformed types or encodings', async () => {
  const req = Readable.from([Buffer.from('🕰🕰')]); req.headers = {};
  await assert.rejects(readBody(req, 7), error => error.status === 413);
  const json = value => { const req = Readable.from([Buffer.from(value)]); req.headers = { 'content-type': 'application/json' }; return req; };
  for (const value of ['null', '[]', '{bad']) await assert.rejects(readJson(json(value)), error => error.status === 400);
  const form = json('{}'); form.headers['content-type'] = 'text/plain'; await assert.rejects(readJson(form), error => error.status === 415);
  for (const value of ['%%%=', 'YW Jj', 'YQ=', 'YR==']) assert.throws(() => decodeBase64(value, 10), error => error.status === 400);
  assert.throws(() => decodeBase64(Buffer.alloc(20).toString('base64'), 10), error => error.status === 413);
  assert.equal(decodeBase64('YQ==', 10).toString(), 'a');
});
async function workbook() { const w = new ExcelJS.Workbook(); w.addWorksheet('catalogo').addRow(['reference', new Date('2026-10-13'), 10]); return Buffer.from(await w.xlsx.writeBuffer()); }
test('XLSX validates actual decompression and rejects non-workbooks, oversized entries and XML declarations', async () => {
  const original = await workbook(); await validateWorkbookArchive(original);
  await assert.rejects(validateWorkbookArchive(Buffer.from('not-a-zip')), error => error.status === 400);
  const notWorkbook = new JSZip(); notWorkbook.file('readme.txt', 'test'); await assert.rejects(validateWorkbookArchive(await notWorkbook.generateAsync({ type: 'nodebuffer' })), /libro XLSX/);
  const huge = await JSZip.loadAsync(original); huge.file('extra.bin', Buffer.alloc(21 * 1024 * 1024));
  await assert.rejects(validateWorkbookArchive(await huge.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })), error => error.status === 413);
  const dtd = await JSZip.loadAsync(original); dtd.file('extra.xml', '<!DOCTYPE data [<!ENTITY example SYSTEM "file:///etc/passwd">]><data/>');
  await assert.rejects(validateWorkbookArchive(await dtd.generateAsync({ type: 'nodebuffer' })), /XML con contenido no permitido/);
});
test('isolated workbook processing retains dates/values and rejects concurrent processing', async () => {
  const bytes = await workbook(); const pending = readWorkbook(bytes);
  await assert.rejects(readWorkbook(bytes), error => error.status === 429);
  const w = await pending;
  assert.equal(w.getWorksheet('catalogo').getCell('B1').value.toISOString(), '2026-10-13T00:00:00.000Z');
  assert.equal(w.getWorksheet('catalogo').getCell('C1').value, 10);
});
test('photographs are fully decoded, bounded and rewritten without SVG or truncated-image acceptance', async () => {
  const valid = await sharp({ create: { width: 2500, height: 2, channels: 3, background: '#0B1D3A' } }).png().toBuffer();
  const output = await prepareImage(valid), info = await sharp(output).metadata();
  assert.equal(info.format, 'webp'); assert.ok(info.width <= 2400); assert.ok(!info.exif);
  for (const input of [Buffer.from('<svg/>'), Buffer.from([255, 216, 255]), Buffer.from('RIFFxxxxWEBPinvalid')]) await assert.rejects(prepareImage(input), error => error.status === 400);
  const enormous = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: 'white' } }).png().toBuffer();
  await assert.rejects(prepareImage(enormous), error => error.status === 400);
});
