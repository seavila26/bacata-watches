import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
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
const hash = s => createHmac('sha256', secret).update(s).digest('hex');
const digest = scryptSync(password, 'aurel-admin-v1', 64),
  sessions = new Map();
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
async function body(req, max = 1024 * 1024) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > max) throw Object.assign(new Error('Archivo demasiado grande'), {
      status: 413
    });
  }
  return raw;
}
function auth(req) {
  const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('aurel_session='))?.split('=')[1];
  if (!token) return false;
  const [id, sig] = token.split('.');
  if (!id || !sig || sig.length !== 64) return false;
  const expected = hash(id);
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const until = sessions.get(id);
  if (!until || until < Date.now()) {
    sessions.delete(id);
    return false;
  }
  return true;
}
function guard(req, res) {
  if (!auth(req)) {
    error(res, 401, 'Inicia sesión como administrador');
    return false;
  }
  return true;
}
function csrf(req, res) {
  const u = req.headers.origin;
  if (u && u !== origin) {
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
async function handler(req, res) {
  try {
    const u = new URL(req.url, origin),
      path = u.pathname,
      method = req.method;
    if (path === '/api/admin/login' && method === 'POST') {
      if (!csrf(req, res)) return;
      const data = JSON.parse(await body(req));
      const submitted = scryptSync(String(data.password || ''), 'aurel-admin-v1', 64);
      if (clean(data.email).toLowerCase() !== email.toLowerCase() || !timingSafeEqual(digest, submitted)) return error(res, 401, 'Credenciales incorrectas');
      const id = randomBytes(32).toString('hex');
      sessions.set(id, Date.now() + 8 * 3600000);
      res.setHeader('Set-Cookie', `aurel_session=${id}.${hash(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${origin.startsWith('https:') ? '; Secure' : ''}`);
      return json(res, 200, {
        ok: true
      });
    }
    if (path === '/api/admin/logout' && method === 'POST') {
      if (!csrf(req, res)) return;
      sessions.delete((req.headers.cookie || '').match(/aurel_session=([a-f0-9]{64})/)?.[1]);
      res.setHeader('Set-Cookie', 'aurel_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      return json(res, 200, {
        ok: true
      });
    }
    if (path === '/api/admin/session') return json(res, 200, {
      authenticated: auth(req)
    });
    if (path === '/api/products' && method === 'GET') {
      const rows = db.prepare("SELECT * FROM products WHERE status='published' ORDER BY updated_at DESC").all().filter(p => isVisible(p)).map(p => publicProduct(p, calculate(p), settings()));
      return json(res, 200, {
        products: rows
      });
    }
    if (path === '/api/orders' && method === 'POST') {
      if (!csrf(req, res)) return;
      const d = JSON.parse(await body(req));
      if (!Array.isArray(d.items) || d.items.length < 1 || d.items.length > 20) return error(res, 400, 'Carrito inválido');
      let total = 0;
      const items = [];
      for (const item of d.items) {
        const quantity = +item.quantity;
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return error(res, 400, 'Cantidad inválida');
        const p = db.prepare("SELECT * FROM products WHERE id=? AND status='published'").get(item.id);
        if (!p || !isVisible(p)) return error(res, 409, 'Producto no disponible');
        const price = calculate(p).price;
        if (price <= 0) return error(res, 409, 'Precio no disponible');
        total += price * quantity;
        items.push({
          id: p.id,
          reference: p.reference,
          name: p.name,
          quantity,
          unit_price_cop: price
        });
      }
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
      if (path === '/api/admin/overview') {
        const rows = db.prepare('SELECT * FROM products ORDER BY updated_at DESC').all().map(p => decorate(p));
        const jobs = db.prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT 10').all();
        return json(res, 200, {
          products: rows,
          settings: settings(),
          jobs,
          orders: db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 30').all(),
          audit: db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 30').all()
        });
      }
      if (path === '/api/admin/settings' && method === 'PUT') {
        const d = JSON.parse(await body(req));
        validSettings(d);
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
      if (path === '/api/admin/catalog/export' && method === 'POST') return xlsx(res, await exportCatalog(JSON.parse(await body(req)), email), 'plantilla-fichas.xlsx');
      if (path === '/api/admin/catalog/preview' && method === 'POST') return json(res, 200, await previewCatalog(Buffer.from(await body(req, 24 * 1024 * 1024), 'base64'), email));
      if (path === '/api/admin/catalog/commit' && method === 'POST') {
        try {
          return json(res, 200, commitCatalog(JSON.parse(await body(req)).token, email));
        } catch (e) {
          return error(res, 409, e.message);
        }
      }
      if (path === '/api/admin/catalog/pending' && method === 'POST') return xlsx(res, await exportPending(JSON.parse(await body(req)).token, email), 'pendientes-fichas.xlsx');
      if (path === '/api/admin/publications/action' && method === 'POST') {
        const d = JSON.parse(await body(req));
        return json(res, 200, publicationAction(d.ids, d.action, email));
      }
      if (path === '/api/admin/publications/export' && method === 'POST') {
        const {
          ids
        } = JSON.parse(await body(req));
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
            product: editProduct(decodeURIComponent(edit[1]), JSON.parse(await body(req)), email)
          });
        } catch (e) {
          return error(res, 400, e.message);
        }
      }
      const status = path.match(/^\/api\/admin\/products\/([^/]+)\/status$/);
      if (status && method === 'PATCH') {
        const d = JSON.parse(await body(req));
        if (!['paused', 'published'].includes(d.status)) return error(res, 400, 'Estado inválido');
        const result = publicationAction([decodeURIComponent(status[1])], d.status === 'paused' ? 'pause' : 'reactivate', email);
        if (!result.results[0].ok) return json(res, 409, {
          error: result.results[0].issues.join('; ')
        });
        return json(res, 200, result);
      }
      if (path === '/api/admin/inventory/preview' && method === 'POST') {
        const file = await body(req, 24 * 1024 * 1024);
        try {
          return json(res, 200, await previewInventory(Buffer.from(file, 'base64'), email));
        } catch (e) {
          return error(res, 400, e.message);
        }
      }
      if (path === '/api/admin/inventory/commit' && method === 'POST') {
        const d = JSON.parse(await body(req));
        try {
          return json(res, 200, commitInventory(d.token, d.selection, email));
        } catch (e) {
          return error(res, 409, e.message);
        }
      }
      if (path === '/api/admin/images' && method === 'POST') {
        const d = JSON.parse(await body(req, 8 * 1024 * 1024)),
          bytes = Buffer.from(String(d.base64 || ''), 'base64');
        if (!bytes.length || bytes.length > 5 * 1024 * 1024) return error(res, 400, 'Imagen de máximo 5 MB');
        const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
        if (!png && !jpg && !webp) return error(res, 400, 'Solo fotografías PNG, JPEG o WebP');
        const filename = randomBytes(16).toString('hex') + (png ? '.png' : jpg ? '.jpg' : '.webp');
        await mkdir('public/uploads', {
          recursive: true
        });
        await writeFile(resolve('public/uploads', filename), bytes, {
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
    const f = path === '/' ? 'index.html' : path.slice(1);
    if (!/^(index\.html|app\.js|style\.css|(?:js|css|assets|uploads)\/[a-zA-Z0-9_/-]+\.(?:js|css|png|jpg|jpeg|webp|svg|woff))$/.test(f)) return error(res, 404, 'No encontrado');
    const data = await readFile(resolve('public', f));
    res.writeHead(200, {
      'content-type': (mime[extname(f)] || 'text/plain') + '; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self'; font-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    });
    res.end(data);
  } catch (e) {
    console.error(e);
    error(res, e.status || 400, e.status ? e.message : 'Solicitud inválida o error de integración');
  }
}
const server = http.createServer(handler);
server.listen(PORT, () => console.log(`Bacatá disponible en http://localhost:${server.address().port}`));
