import { createHmac, randomBytes, timingSafeEqual, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { isIP } from 'node:net';
export const derivePassword = promisify(scrypt);
export function httpError(status, message) { return Object.assign(Error(message), { status }); }
export async function readBody(req, max = 1024 * 1024) {
  const length = Number(req.headers['content-length']);
  if (Number.isFinite(length) && length > max) { req.resume(); throw httpError(413, 'Archivo o solicitud demasiado grande'); }
  const chunks = []; let total = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.length;
    if (total > max) { req.resume(); throw httpError(413, 'Archivo o solicitud demasiado grande'); }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString('utf8');
}
export async function readJson(req, max) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw httpError(415, 'La solicitud requiere JSON');
  let data;
  try { data = JSON.parse(await readBody(req, max)); } catch (error) {
    if (error.status) throw error;
    throw httpError(400, 'JSON inválido');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw httpError(400, 'Objeto JSON inválido');
  return data;
}
export function decodeBase64(value, maxBytes) {
  if (typeof value !== 'string' || !value.length || value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw httpError(400, 'Archivo base64 inválido');
  if (value.length > 4 * Math.ceil(maxBytes / 3)) throw httpError(413, 'Archivo demasiado grande');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw httpError(400, 'Archivo base64 inválido');
  if (bytes.length > maxBytes) throw httpError(413, 'Archivo demasiado grande');
  return bytes;
}
export function clientAddress(req, trustProxy = false) {
  const address = req.socket.remoteAddress || 'unknown';
  const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
  const forwarded = req.headers['x-real-ip'];
  if (trustProxy && loopback && typeof forwarded === 'string' && isIP(forwarded)) return forwarded;
  return address;
}
export class RateLimiter {
  constructor({ limit, windowMs, maxKeys = 10000, clock = Date.now }) { Object.assign(this, { limit, windowMs, maxKeys, clock }); this.entries = new Map(); this.nextSweep = 0; }
  consume(key) {
    const now = this.clock();
    if (now >= this.nextSweep) { for (const [id, item] of this.entries) if (item.until <= now) this.entries.delete(id); this.nextSweep = now + 60000; }
    let item = this.entries.get(key);
    if (!item || item.until <= now) {
      if (!item && this.entries.size >= this.maxKeys) return { allowed: false, retryAfter: 60 };
      item = { count: 0, until: now + this.windowMs }; this.entries.set(key, item);
    }
    if (item.count >= this.limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((item.until - now) / 1000)) };
    item.count++; return { allowed: true };
  }
  reset(key) { this.entries.delete(key); }
}
export class SessionStore {
  constructor(secret, { ttl = 8 * 3600000, idle = 3600000, max = 100, clock = Date.now } = {}) {
    Object.assign(this, { secret, ttl, idle, max, clock }); this.entries = new Map();
  }
  sign(id) { return createHmac('sha256', this.secret).update(id).digest('hex'); }
  token(req) { return (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('aurel_session='))?.slice('aurel_session='.length); }
  id(req) {
    const token = this.token(req);
    if (typeof token !== 'string' || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)) return null;
    const [id, signature] = token.split('.');
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(this.sign(id), 'hex')) ? id : null;
  }
  sweep() { const now = this.clock(); for (const [id, item] of this.entries) if (item.until <= now || item.last + this.idle <= now) this.entries.delete(id); }
  authenticate(req) {
    this.sweep(); const id = this.id(req), item = id && this.entries.get(id);
    if (!item) return false;
    item.last = this.clock(); return true;
  }
  create(req) {
    this.sweep(); this.revoke(req);
    while (this.entries.size >= this.max) this.entries.delete(this.entries.keys().next().value);
    const id = randomBytes(32).toString('hex'), now = this.clock();
    this.entries.set(id, { until: now + this.ttl, last: now }); return `${id}.${this.sign(id)}`;
  }
  revoke(req) { const id = this.id(req); if (id) this.entries.delete(id); }
}
