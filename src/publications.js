import { db, calculate, audit } from './db.js';
import { publicationIssues, publicationState } from './catalog-model.js';
export function reconcileProduct(p, {
  automatic = false,
  confirmed = false,
  actor = 'system',
  now = new Date().toISOString()
} = {}) {
  const a = calculate(p),
    issues = publicationIssues(p, a);
  let status = p.status,
    reason = p.pause_reason || '',
    published = p.published_at;
  if (p.status === 'published' && issues.length) {
    status = 'paused';
    reason = issues.join('; ');
  } else if (automatic && (p.status === 'pending' || p.status === 'paused' && reason !== 'Pausa manual') && !issues.length) {
    status = 'published';
    reason = '';
    published ||= now;
  } else if (status === 'pending') reason = issues.join('; ');
  db.prepare('UPDATE products SET status=?,pause_reason=?,published_at=?,last_confirmed_at=?,updated_at=? WHERE id=?').run(status, reason, published ?? null, confirmed ? now : p.last_confirmed_at ?? null, now, p.id);
  if (status !== p.status) audit(actor, status === 'published' ? 'product_published' : 'product_paused', p.id, {
    from: p.status,
    to: status,
    reason,
    price: a.price
  });
  return {
    id: p.id,
    brand: p.brand,
    reference: p.reference,
    status,
    issues,
    reason,
    analysis: a
  };
}
export function reconcileAll(actor = 'system') {
  for (const p of db.prepare('SELECT * FROM products').all()) reconcileProduct(p, {
    actor
  });
}
export function publicationAction(ids, action, actor) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 10000 || new Set(ids).size !== ids.length) throw Error('Selecciona referencias sin repetir');
  if (!['pause', 'reactivate', 'confirm'].includes(action)) throw Error('Acción inválida');
  const results = [],
    now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const id of ids) {
      const p = db.prepare('SELECT * FROM products WHERE id=?').get(id);
      if (!p) throw Error('Referencia no encontrada');
      const a = calculate(p),
        issues = publicationIssues(p, a);
      if (action !== 'pause' && issues.length) {
        results.push({
          id,
          ok: false,
          issues
        });
        continue;
      }
      if (action === 'confirm' && publicationState(p) !== 'requires_confirmation') {
        results.push({
          id,
          ok: false,
          issues: ['La ficha no requiere confirmación']
        });
        continue;
      }
      const status = action === 'pause' ? 'paused' : 'published';
      db.prepare('UPDATE products SET status=?,pause_reason=?,published_at=?,last_confirmed_at=?,updated_at=? WHERE id=?').run(status, action === 'pause' ? 'Pausa manual' : '', p.published_at || (status === 'published' ? now : null), action === 'pause' ? p.last_confirmed_at : now, now, id);
      audit(actor, action === 'pause' ? 'product_paused' : action === 'confirm' ? 'publication_confirmed' : 'product_reactivated', id, {
        from: p.status,
        to: status,
        price: a.price
      });
      results.push({
        id,
        ok: true,
        status
      });
    }
    db.exec('COMMIT');
    return {
      results
    };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
export function isVisible(p, now = Date.now()) {
  return publicationState(p, now) === 'published' && !publicationIssues(p, calculate(p)).length;
}
