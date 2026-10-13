import http from 'node:http';
import { quoteItems } from './order-quote.js';
import { paymentConfig, createCheckout, paymentState, verifyPayment, receiveEvent } from './wompi.js';
import { requestList, requestDetail, reviewRequest } from './orders.js';
import { commercialProfile, saveCommercial } from './commercial.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { derivePassword, httpError, readBody as body, readJson, decodeBase64, clientAddress, RateLimiter, SessionStore } from './security.js';
import { WORKBOOK_LIMIT } from './workbook-archive.js';
import { prepareImage } from './image-upload.js';
import { db, settings, set, audit, decorate, calculate } from './db.js';
import { previewInventory, commitInventory } from './inventory-import.js';
import { editProduct } from './product-editor.js';
import { publicProduct } from './catalog-model.js';
import { exportCatalog, workbookBuffer } from './catalog-export.js';
import { previewCatalog, commitCatalog, exportPending } from './catalog-import.js';
import { publicationAction, reconcileAll, isVisible } from './publications.js';
const PORT = +(process.env.PORT || 3000),
  origin = process.env.APP_ORIGIN || `http://localhost:${PORT}`;
const email = process.env.ADMIN_EMAIL,
  password = process.env.ADMIN_PASSWORD,
  secret = process.env.SESSION_SECRET;
if (!email || !password || !secret || password.length < 16 || secret.length < 32) {
  console.error('Configura ADMIN_EMAIL, ADMIN_PASSWORD (>=16) y SESSION_SECRET (>=32).');
  process.exit(1);
}
const trustProxy = process.env.TRUST_PROXY === 'loopback';
if (process.env.TRUST_PROXY && !['loopback', 'none'].includes(process.env.TRUST_PROXY)) throw Error('TRUST_PROXY debe ser loopback o none');
const digest = scryptSync(password, 'aurel-admin-v1', 64), sessions = new SessionStore(secret);
const loginLimits = new RateLimiter({ limit: 10, windowMs: 15 * 60000 });
const globalLoginLimit = new RateLimiter({ limit: 60, windowMs: 60000 });
const orderLimits = new RateLimiter({ limit: 20, windowMs: 10 * 60000 });
const globalOrderLimit = new RateLimiter({ limit: 120, windowMs: 60000 });
const paymentVerifyLimits = new RateLimiter({ limit:20, windowMs:60000 });
const globalPaymentLimit = new RateLimiter({ limit:120, windowMs:60000 });
let loginWorkers = 0;
function limited(req, res, perAddress, global) {
  const result = perAddress.consume(clientAddress(req, trustProxy));
  const globalResult = result.allowed ? global.consume('all') : result;
  if (result.allowed && globalResult.allowed) return false;
  res.setHeader('Retry-After', String(globalResult.retryAfter));
  const wait = globalResult.retryAfter >= 60 ? `${Math.ceil(globalResult.retryAfter / 60)} minuto(s)` : `${globalResult.retryAfter} segundo(s)`;
  error(res, 429, `Demasiados intentos. Vuelve a intentarlo en ${wait}.`); return true;
}
const sweepSessions = setInterval(() => sessions.sweep(), 60000); sweepSessions.unref();
const cookie = (token, maxAge) => `aurel_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${origin.startsWith('https:') ? '; Secure' : ''}`;
const validationMessage = e => e.status || (e.constructor === Error && !e.code) ? e.message : 'No se pudo procesar la solicitud';
function json(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(data));
}
function error(res, status, message) {
  json(res, status, {
    error: message
  });
}
function auth(req) { return sessions.authenticate(req); }
function guard(req, res) {
  if (!auth(req)) {
    error(res, 401, 'Inicia sesión como administrador');
    return false;
  }
  return true;
}
function csrf(req, res) {
  const u = req.headers.origin;
  if ((u && u !== origin) || req.headers['sec-fetch-site'] === 'cross-site') {
    error(res, 403, 'Origen no permitido');
    return false;
  }
  return true;
}
function clean(x) {
  return String(x ?? '').trim();
}
function validSettings(input) {
  const ranges = {
    fx: [100, 20000],
    duty: [0, 1],
    fee: [0, 0.3],
    discount: [0, 0.99],
    min_margin: [0, 0.8],
    logistics_rate: [0, 1]
  };
  for (const [k, [lo, hi]] of Object.entries(ranges)) {
    if (!(k in input)) continue;
    if (!['number', 'string'].includes(typeof input[k]) || input[k] === '' || input[k] === null) throw Error(`Valor inválido: ${k}`);
    const n = Number(input[k]);
    if (!Number.isFinite(n) || n < lo || n > hi) throw Error(`Valor inválido: ${k}`);
  }
  for (const k of ['delivery_days', 'warranty', 'shipping_terms']) if (k in input && (typeof input[k] !== 'string' || !input[k].trim() || input[k].length > 4000)) throw Error(`Valor inválido: ${k}`);
  if (Object.keys(input).some(k => !Object.keys(settings()).includes(k))) throw Error('Parámetro no permitido');
}
function xlsx(res, buffer, name) {
  res.writeHead(200, {
    'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'content-disposition': `attachment; filename="${name}"`,
    'cache-control': 'no-store'
  });
  res.end(buffer);
}
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff': 'font/woff'
};
async function workbookBody(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/octet-stream') throw httpError(415, 'La carga requiere un archivo XLSX');
  return decodeBase64(await body(req, 4 * Math.ceil(WORKBOOK_LIMIT / 3)), WORKBOOK_LIMIT);
}
async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (origin.startsWith('https:')) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  try {
    const u = new URL(req.url, origin),
      path = u.pathname,
      method = req.method;
    if (path === '/api/admin/login' && method === 'POST') {
      if (!csrf(req, res)) return;
      if (limited(req, res, loginLimits, globalLoginLimit)) return;
      if (loginWorkers >= 2) { res.setHeader('Retry-After', '3'); return error(res, 429, 'Verificación en curso. Espera unos segundos.'); }
      const data = await readJson(req, 8192);
      if (typeof data.email !== 'string' || data.email.length > 320 || typeof data.password !== 'string' || Buffer.byteLength(data.password) > 1024) return error(res, 401, 'Credenciales incorrectas');
      loginWorkers++;
      let submitted;
      try { submitted = await derivePassword(data.password, 'aurel-admin-v1', 64); } finally { loginWorkers--; }
      if (!timingSafeEqual(digest, submitted) || clean(data.email).toLowerCase() !== email.toLowerCase()) return error(res, 401, 'Credenciales incorrectas');
      loginLimits.reset(clientAddress(req, trustProxy));
      res.setHeader('Set-Cookie', cookie(sessions.create(req), 28800));
      return json(res, 200, {
        ok: true
      });
    }
    if (path === '/api/admin/logout' && method === 'POST') {
      if (!csrf(req, res)) return;
      sessions.revoke(req);
      res.setHeader('Set-Cookie', cookie('', 0));
      return json(res, 200, {
        ok: true
      });
    }
    if (path === '/api/admin/session' && method === 'GET') return json(res, 200, {
      authenticated: auth(req)
    });
    if (path === '/api/payments/config' && method === 'GET') return json(res,200,{mode:paymentConfig.mode,enabled:paymentConfig.enabled});
    if (path === '/api/payments/wompi/events' && method === 'POST') {
      if (limited(req,res,paymentVerifyLimits,globalPaymentLimit)) return;
      return json(res,200,await receiveEvent(await readJson(req,65536),req.headers['x-event-checksum']));
    }
    if (path === '/api/payments/checkout' && method === 'POST') {
      if (!csrf(req,res) || limited(req,res,orderLimits,globalOrderLimit)) return;
      return json(res,201,createCheckout(await readJson(req,16384),origin));
    }
    const paymentRoute = path.match(/^\/api\/payments\/([a-f0-9]{64})(\/verify)?$/);
    if (paymentRoute && !paymentRoute[2] && method === 'GET') return json(res,200,{payment:paymentState(paymentRoute[1])});
    if (paymentRoute?.[2] && method === 'POST') {
      if (!csrf(req,res) || limited(req,res,paymentVerifyLimits,globalPaymentLimit)) return;
      const data=await readJson(req,1024);
      return json(res,200,{payment:await verifyPayment(paymentRoute[1],data.transaction_id)});
    }
    if (path === '/api/commercial' && method === 'GET') return json(res, 200, { commercial: commercialProfile() });
    if (path === '/api/products' && method === 'GET') {
      const rows = db.prepare("SELECT * FROM products WHERE status='published' ORDER BY updated_at DESC").all().filter(p => isVisible(p)).map(p => publicProduct(p, calculate(p), settings()));
      return json(res, 200, {
        products: rows
      });
    }
    if (path === '/api/orders' && method === 'POST') {
      if (!csrf(req, res)) return;
      if (limited(req, res, orderLimits, globalOrderLimit)) return;
      const d = await readJson(req, 16384);
      const { total, items } = quoteItems(d.items);
      const id = 'AUR-' + randomBytes(5).toString('hex').toUpperCase();
      db.prepare('INSERT INTO orders(id,items_json,total_cop,created_at) VALUES(?,?,?,?)').run(id, JSON.stringify(items), total, new Date().toISOString());
      audit('customer', 'order_created', id, {
        total
      });
      return json(res, 201, {
        id,
        total_cop: total,
        status: 'payment_pending',
        message: 'Solicitud de prueba creada. Sin cobro ni reserva de inventario.'
      });
    }
    if (path.startsWith('/api/admin/')) {
      if (!guard(req, res)) return;
      if (method !== 'GET' && !csrf(req, res)) return;
      if (path === '/api/admin/orders' && method === 'GET') return json(res, 200, requestList(u.searchParams));
      const orderRoute = path.match(/^\/api\/admin\/orders\/([^/]+)$/);
      if (orderRoute && method === 'GET') return json(res, 200, { order: requestDetail(decodeURIComponent(orderRoute[1])) });
      if (orderRoute && method === 'PATCH') return json(res, 200, { order: reviewRequest(decodeURIComponent(orderRoute[1]), await readJson(req, 32768), email) });
      if (path === '/api/admin/overview' && method === 'GET') {
        const rows = db.prepare('SELECT * FROM products ORDER BY updated_at DESC').all().map(p => decorate(p));
        const jobs = db.prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT 10').all();
        return json(res, 200, {
          products: rows,
          commercial: commercialProfile(),
          payments: {mode:paymentConfig.mode,enabled:paymentConfig.enabled},
          settings: settings(),
          jobs,
          orders: db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 30').all(),
          audit: db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 30').all()
        });
      }
      if (path === '/api/admin/commercial' && method === 'PUT') {
        const data = await readJson(req, 65536);
        try { return json(res, 200, { commercial: saveCommercial(data, email) }); }
        catch (e) { if (e.constructor === Error && !e.code) return error(res, 400, e.message); throw e; }
      }
      if (path === '/api/admin/settings' && method === 'PUT') {
        const d = await readJson(req);
        try { validSettings(d); } catch (error) { throw httpError(400, validationMessage(error)); }
        const prev = settings();
        const prices = new Map(db.prepare('SELECT * FROM products').all().map(p => [p.id, calculate(p).price]));
        db.exec('BEGIN IMMEDIATE');
        try {
          for (const k of Object.keys(prev)) if (k in d) set.run(k, String(d[k]));
          reconcileAll(email);
          for (const p of db.prepare('SELECT * FROM products').all()) {
            const after = calculate(p).price;
            if (prices.get(p.id) !== after) audit(email, 'price_changed', p.id, {
              before: prices.get(p.id),
              after
            });
          }
          audit(email, 'settings_updated', 'settings', {
            before: prev,
            after: settings()
          });
          db.exec('COMMIT');
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
        return json(res, 200, {
          settings: settings()
        });
      }
      if (path === '/api/admin/catalog/export' && method === 'POST') return xlsx(res, await exportCatalog(await readJson(req), email), 'plantilla-fichas.xlsx');
      if (path === '/api/admin/catalog/preview' && method === 'POST') {
        try { return json(res, 200, await previewCatalog(await workbookBody(req), email)); }
        catch (e) { return error(res, e.status || 400, validationMessage(e)); }
      }
      if (path === '/api/admin/catalog/commit' && method === 'POST') {
        try {
          return json(res, 200, commitCatalog((await readJson(req)).token, email));
        } catch (e) {
          return error(res, e.status || 409, validationMessage(e));
        }
      }
      if (path === '/api/admin/catalog/pending' && method === 'POST') return xlsx(res, await exportPending((await readJson(req)).token, email), 'pendientes-fichas.xlsx');
      if (path === '/api/admin/publications/action' && method === 'POST') {
        const d = await readJson(req);
        return json(res, 200, publicationAction(d.ids, d.action, email));
      }
      if (path === '/api/admin/publications/export' && method === 'POST') {
        const {
          ids
        } = await readJson(req);
        if (!Array.isArray(ids) || ids.length > 10000) throw Error('Selección inválida');
        const rows = ids.map(id => {
          const raw = db.prepare('SELECT * FROM products WHERE id=?').get(id);
          if (!raw) throw Error('Referencia no encontrada');
          const p = decorate(raw),
            a = p.analysis;
          return {
            brand: p.brand,
            reference: p.reference,
            status: p.effective_status,
            published_at: p.published_at,
            last_confirmed_at: p.last_confirmed_at,
            approved_price_cop:p.approved_price_cop,
            price: a.price,
            margin: a.margin,
            ...a,
            pause_reason: p.pause_reason
          };
        });
        return xlsx(res, await workbookBuffer(rows, ['brand', 'reference', 'status', 'published_at', 'last_confirmed_at', 'price', 'approved_price_cop', 'margin', 'price_usd', 'shipping_usd', 'fx', 'supplier', 'shipping', 'importCost', 'commission', 'buffer', 'cost', 'market', 'suggested', 'profit', 'pause_reason'], 'publicaciones'), 'publicaciones.xlsx');
      }
      const history = path.match(/^\/api\/admin\/products\/([^/]+)\/history$/);
      if (history && method === 'GET') return json(res, 200, {
        history: db.prepare('SELECT * FROM field_history WHERE product_id=? ORDER BY id DESC LIMIT 100').all(decodeURIComponent(history[1]))
      });
      const edit = path.match(/^\/api\/admin\/products\/([^/]+)$/);
      if (edit && method === 'PATCH') {
        try {
          return json(res, 200, {
            product: editProduct(decodeURIComponent(edit[1]), await readJson(req), email)
          });
        } catch (e) {
          return error(res, e.status || 400, validationMessage(e));
        }
      }
      const status = path.match(/^\/api\/admin\/products\/([^/]+)\/status$/);
      if (status && method === 'PATCH') {
        const d = await readJson(req);
        if (!['paused', 'published'].includes(d.status)) return error(res, 400, 'Estado inválido');
        const result = publicationAction([decodeURIComponent(status[1])], d.status === 'paused' ? 'pause' : 'reactivate', email);
        if (!result.results[0].ok) return json(res, 409, {
          error: result.results[0].issues.join('; ')
        });
        return json(res, 200, result);
      }
      if (path === '/api/admin/inventory/preview' && method === 'POST') {
        const file = await workbookBody(req);
        try {
          return json(res, 200, await previewInventory(file, email));
        } catch (e) {
          return error(res, e.status || 400, validationMessage(e));
        }
      }
      if (path === '/api/admin/inventory/commit' && method === 'POST') {
        const d = await readJson(req);
        try {
          return json(res, 200, commitInventory(d.token, d.selection, email));
        } catch (e) {
          return error(res, e.status || 409, validationMessage(e));
        }
      }
      if (path === '/api/admin/images' && method === 'POST') {
        const d = await readJson(req, 7 * 1024 * 1024);
        const input = decodeBase64(d.base64, 5 * 1024 * 1024);
        const bytes = await prepareImage(input);
        const filename = randomBytes(16).toString('hex') + '.webp';
        await mkdir('public/uploads', {
          mode: 0o700,
          recursive: true
        });
        await writeFile(resolve('public/uploads', filename), bytes, {
          mode: 0o600,
          flag: 'wx'
        });
        audit(email, 'image_uploaded', filename, {
          bytes: bytes.length
        });
        return json(res, 201, {
          url: '/uploads/' + filename
        });
      }
      if (path === '/api/admin/import' && method === 'POST') return error(res, 410, 'La carga manual ahora requiere vista previa XLSX en Importar inventario');
      return error(res, 404, 'Ruta no encontrada');
    }
    if (path.startsWith('/api/')) return error(res, 404, 'Ruta no encontrada');
    const f = path === '/' || path === '/pago' ? 'index.html' : path.slice(1);
    if (!/^(index\.html|app\.js|style\.css|(?:js|css|assets|uploads)\/[a-zA-Z0-9_/-]+\.(?:js|css|png|jpg|jpeg|webp|svg|woff))$/.test(f)) return error(res, 404, 'No encontrado');
    const data = await readFile(resolve('public', f));
    res.writeHead(200, {
      'content-type': (mime[extname(f)] || 'text/plain') + '; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self'; font-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    });
    res.end(data);
  } catch (e) {
    const status = e.status || (e.code === 'ENOENT' ? 404 : 500);
    console.error('Solicitud fallida:', req.method, (req.url || '').split('?')[0], status);
    if (res.destroyed || res.writableEnded) return;
    if (status === 429 && !res.hasHeader('Retry-After')) res.setHeader('Retry-After', '3');
    error(res, status, e.status ? e.message : status === 404 ? 'No encontrado' : 'No se pudo procesar la solicitud');
  }
}
// Align inherited publication flags with the same requirements used by the store.
db.exec('BEGIN IMMEDIATE');
try { reconcileAll('system'); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
const server = http.createServer(handler);
server.requestTimeout = 60000;
server.headersTimeout = 15000;
server.listen(PORT, process.env.HOST || '127.0.0.1', () => console.log(`Bacatá disponible en http://localhost:${server.address().port}`));
