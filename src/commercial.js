import { db, audit } from './db.js';
import { commercialDefaults, validateCommercial } from '../public/js/commercial-model.js';
db.exec(`CREATE TABLE IF NOT EXISTS commercial_profile (
  id INTEGER PRIMARY KEY CHECK(id=1), data_json TEXT NOT NULL, updated_at TEXT NOT NULL
)`);
export function commercialProfile() {
  const row = db.prepare('SELECT data_json FROM commercial_profile WHERE id=1').get();
  const data = row ? { ...commercialDefaults, ...JSON.parse(row.data_json) } : { ...commercialDefaults };
  if (data.shipping === 'El costo y las condiciones de envío se confirman antes de la compra. No se anuncia envío gratuito.') data.shipping = commercialDefaults.shipping;
  if(data.delivery === 'El plazo de entrega se confirma según la referencia y el destino antes de la compra.') data.delivery=commercialDefaults.delivery;
  return data;
}
export function saveCommercial(input, actor) {
  const data = validateCommercial(input);
  db.exec('BEGIN IMMEDIATE');
  try {
    const before = commercialProfile();
    db.prepare('INSERT INTO commercial_profile(id,data_json,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at').run(JSON.stringify(data), new Date().toISOString());
    audit(actor, 'commercial_updated', 'commercial_profile', { before, after: data });
    db.exec('COMMIT');
    if(data.delivery === 'El plazo de entrega se confirma según la referencia y el destino antes de la compra.') data.delivery=commercialDefaults.delivery;
  return data;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
