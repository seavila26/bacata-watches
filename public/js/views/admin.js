import {bulkCatalog} from './catalog-bulk.js';
import {inventory} from './inventory.js';
import {productEditor} from './product-editor.js';
import { state } from '../state.js';
import { money, percent, escapeHtml } from '../utils.js';
const statusLabel = {
  pending: 'Pendiente',
  published: 'Publicado',
  discarded: 'Descartado',
  paused: 'Pausado'
};
const statusTag = p => `<span class="tag ${p.status === 'published' ? 'good' : p.status === 'pending' ? 'warn' : 'bad'}">${statusLabel[p.status] || p.status}</span>`;
export function login() {
  return `<section class="wrap">
    <span class="eyebrow">ACCESO PRIVADO</span>
    <h1>Administración</h1>
    <form id="login" class="panel">
    <label class="field">Correo<input type="email" name="email" autocomplete="username" required>
    </label>
    <label class="field">Contraseña<input type="password" name="password" autocomplete="current-password" required>
    </label>
    <button class="btn">Ingresar</button>
    </form>
    </section>`;
}
export function admin() {
  if (!state.admin) return login();
  const d = state.admin,
    allRows = d.products,
    rows = allRows.filter(p => (!state.adminQuery || `${p.brand} ${p.name} ${p.reference}`.toLowerCase().includes(state.adminQuery.toLowerCase())) && (!state.adminStatus || p.status === state.adminStatus)),
    s = d.settings;
  let content = '';
  if (state.tab === 'oportunidades') {
    const selected = allRows.find(p => p.id === state.selected);
    content = selected ? adminDetail(selected) : `<div class="stats">
    <div class="panel">
    <b>${rows.length}</b>Referencias</div>
    <div class="panel">
    <b>${rows.filter(p => p.status === 'pending').length}</b>Pendientes</div>
    <div class="panel">
    <b>${rows.filter(p => p.analysis.eligible && p.status === 'pending').length}</b>Cumplen regla</div>
    <div class="panel">
    <b>${rows.filter(p => p.status === 'published').length}</b>Publicados</div>
    </div>
    <p class="notice">Las referencias iniciales son de demostración. Las importadas conservan su corte y necesitan revisión comercial. Importar no equivale a publicar ni confirma stock propio.</p>
    <form id="admin-filter" class="admin-filters"><label>Marca, nombre o referencia<input type="search" name="query" value="${escapeHtml(state.adminQuery)}"></label><label>Estado<select name="status"><option value="">Todos</option>${Object.entries(statusLabel).map(([key,label])=>`<option value="${key}" ${state.adminStatus===key?'selected':''}>${label}</option>`).join('')}</select></label><button class="btn secondary">Filtrar</button></form>
    <div class="table-wrap">
    <table>
    <thead>
    <tr>
    <th>Referencia</th>
    <th>Proveedor</th>
    <th>Compra USD</th>
    <th>Mercado COP</th>
    <th>Costo total</th>
    <th>Venta propuesta</th>
    <th>Utilidad</th>
    <th>Margen</th>
    <th>Estado</th>
    <th>Revisión</th>
    </tr>
    </thead>
    <tbody>${rows.slice(state.adminPage*50,(state.adminPage+1)*50).map(p => `<tr>
    <td>
    <strong>${escapeHtml(p.reference)}</strong>
    <small>${escapeHtml(p.brand)} · ${escapeHtml(p.variant)}</small>
    </td>
    <td>${escapeHtml(p.supplier)}</td>
    <td class="num">USD ${p.price_usd}</td>
    <td class="num">${money(p.market_cop)}</td>
    <td class="num">${money(p.analysis.cost)}</td>
    <td class="num">${money(p.analysis.price)}</td>
    <td class="num">${money(p.analysis.profit)}</td>
    <td class="num">
    <span class="tag ${p.analysis.eligible ? 'good' : 'bad'}">${percent(p.analysis.margin)}</span>
    </td>
    <td>${statusTag(p)}</td>
    <td>
    <button class="btn secondary" data-action="review" data-id="${escapeHtml(p.id)}">Examinar</button>
    </td>
    </tr>`).join('')}</tbody>
    </table>
    </div><div class="pagination"><button class="btn secondary" data-action="admin-page" data-delta="-1" ${state.adminPage===0?'disabled':''}>Anterior</button><span>${rows.length} referencias · página ${state.adminPage+1}</span><button class="btn secondary" data-action="admin-page" data-delta="1" ${(state.adminPage+1)*50>=rows.length?'disabled':''}>Siguiente</button></div>`;
  }
  if (state.tab === 'reglas') content = `<div class="split">
    <form id="settings-form" class="panel">
    <h3>Reglas de rentabilidad</h3>
    <div class="settings-grid">${[['fx', 'TRM de referencia (COP/USD)'], ['duty', 'Importación e impuestos (decimal)'], ['fee', 'Comisión de venta (decimal)'], ['market_factor', 'Factor del mercado (decimal)'], ['min_margin', 'Margen mínimo (decimal)'], ['shipping_buffer_cop', 'Colchón logístico (COP)']].map(([key, label]) => `<label>${label}<input name="${key}" type="number" step="any" value="${escapeHtml(s[key])}" required>
    </label>`).join('')}</div>
    <label>
    <input name="auto_publish" type="checkbox" disabled ${s.auto_publish === 'true' ? 'checked' : ''}>Reservado: publicación automática deshabilitada en las cargas de inventario</label>
    <button class="btn">Guardar reglas</button>
    </form>
    <div class="panel">
    <h3>Cómo se calcula</h3>
    <p>El precio propuesto es el precio de mercado × factor. Se resta compra convertida a COP, envío, costos de importación, comisión y colchón logístico.</p>
    <p class="notice">Valores provisionales. Antes de activar publicación automática, validar fuente de mercado, TRM, tributos, garantía y disponibilidad. El 10 % es un supuesto de trabajo.</p>
    </div>
    </div>`;
  if(state.tab==='preparar') content=bulkCatalog();
  if (state.tab === 'inventario') content = inventory();
  if (state.tab === 'fuentes') content = `<div class="split">
    <div class="panel">
    <h3>Sincronización del proveedor</h3>
    <p>Para el inventario de Jomashop, usa la pestaña <strong>Importar inventario</strong> y revisa la vista previa XLSX.</p>
    <p class="muted">El feed CSV configurado en el servidor se conserva para fuentes independientes. No modifica las referencias administradas por Excel ni publica nuevas fichas automáticamente.</p>
    <button class="btn secondary" data-action="sync">Ejecutar sincronización configurada</button>
    </div>
    <div class="panel">
    <h3>Últimas ejecuciones</h3>
    <div class="log">${d.jobs.length ? d.jobs.map(j => `<div>
    <strong>${escapeHtml(j.status)}</strong> · ${escapeHtml(j.source)} · ${j.imported} registros<br>
    <small>${escapeHtml(j.started_at)} ${escapeHtml(j.error || '')}</small>
    </div>`).join('') : 'Aún no hay importaciones.'}</div>
    </div>
    </div>`;
  if (state.tab === 'pedidos') content = `<div class="panel">
    <h3>Solicitudes de prueba</h3>
    <p class="muted">No se ha integrado la pasarela de pagos. No hay cobros ni reservas de inventario.</p>
    <div class="log">${d.orders.length ? d.orders.map(o => `<div>
    <strong>${escapeHtml(o.id)}</strong> · ${money(o.total_cop)} · ${escapeHtml(o.status)}<br>
    <small>${escapeHtml(o.created_at)}</small>
    </div>`).join('') : 'No hay solicitudes.'}</div>
    </div>`;
  if (state.tab === 'auditoria') content = `<div class="panel">
    <h3>Actividad reciente</h3>
    <div class="log">${d.audit.map(a => `<div>
    <strong>${escapeHtml(a.action)}</strong> · ${escapeHtml(a.subject)}<br>
    <small>${escapeHtml(a.actor)} · ${escapeHtml(a.created_at)}</small>
    </div>`).join('')}</div>
    </div>`;
  return `<div class="admin-shell">
    <div class="admin-top">
    <div>
    <span class="eyebrow">BACATÁ / OPERACIONES</span>
    <h1>Centro de control</h1>
    </div>
    <button class="btn secondary" data-action="logout">Cerrar sesión</button>
    </div>
    <p class="muted">Oportunidades, reglas, fuentes y trazabilidad en un solo lugar.</p>
    <div class="tabs" role="tablist" aria-label="Secciones administrativas">${[['oportunidades', 'Oportunidades'], ['reglas', 'Reglas'], ['inventario', 'Importar inventario'], ['preparar','Preparar catálogo'], ['fuentes', 'Sincronización'], ['pedidos', 'Pedidos'], ['auditoria', 'Actividad']].map(([key, label]) => `<button role="tab" aria-selected="${state.tab === key}" tabindex="${state.tab === key ? 0 : -1}" aria-controls="admin-tabpanel" class="${state.tab === key ? 'active' : ''}" data-action="tab" data-tab="${key}">${label}</button>`).join('')}</div>
    <section id="admin-tabpanel" role="tabpanel" aria-label="${escapeHtml(state.tab)}">${content}</section>
    </div>`;
}
function adminDetail(p) {
  const a = p.analysis;
  return `<button class="btn secondary" data-action="back">← Todas las oportunidades</button>
    <div class="admin-detail">
    <div class="panel">
    <span class="eyebrow">ANÁLISIS DE REFERENCIA</span>
    <h2>${escapeHtml(p.brand)} ${escapeHtml(p.name)}</h2>
    <p>${escapeHtml(p.reference)} · ${escapeHtml(p.variant)} · ${statusTag(p)}</p>${[['Precio proveedor (USD ' + p.price_usd + ')', a.supplier], ['Envío proveedor (USD ' + p.shipping_usd + ')', a.shipping], ['Importación e impuestos estimados', a.importCost], ['Comisión estimada', a.commission], ['Colchón logístico', a.buffer], ['Costo total estimado', a.cost], ['Precio de mercado informado', p.market_cop], ['Venta sugerida', a.suggested??a.price], ['Precio aprobado', p.approved_price_cop??0], ['Contribución estimada', a.profit]].map(([k, v]) => `<div class="breakdown">
    <span>${k}</span>
    <strong>${money(v)}</strong>
    </div>`).join('')}<div class="breakdown emphasis">
    <span>Margen de contribución</span>
    <strong>${(a.margin==null?'Sin comparable':percent(a.margin))}</strong>
    </div>
    </div>
    <div class="panel">
    <h3>Preparación para publicar</h3>
    ${p.publication_issues?.length ? `<ul class="readiness-list">${p.publication_issues.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>` : '<p class="tag good">Ficha lista para publicar</p>'}
    <p class="tag ${a.eligible ? 'good' : 'bad'}">${a.eligible ? 'Cumple la regla' : 'No cumple la regla'}</p>
    <p class="muted">Umbral: ${percent(+state.admin.settings.min_margin)}. Unidades propias: ${p.stock}. Último dato de origen: ${escapeHtml(p.source_updated_at || 'Sin registro')}.</p>
    <div class="actions">
    <button class="btn" data-action="status" data-id="${escapeHtml(p.id)}" data-status="published">Publicar</button>
    <button class="btn secondary" data-action="status" data-id="${escapeHtml(p.id)}" data-status="pending">Dejar pendiente</button>
    <button class="btn secondary" data-action="status" data-id="${escapeHtml(p.id)}" data-status="paused">Pausar</button>
    <button class="btn danger" data-action="status" data-id="${escapeHtml(p.id)}" data-status="discarded">Descartar</button>
    </div>${p.status === 'published' ? `<p>
    <a href="#/reloj/${encodeURIComponent(p.id)}">Ver en tienda ↗</a>
    </p>` : ''}<p class="notice">La publicación comprueba la ficha y las condiciones guardadas. Las referencias por cotizar no habilitan compras.</p>
    <details><summary>Fuentes e historial de campos</summary><button class="btn secondary" data-action="field-history" data-id="${escapeHtml(p.id)}">Consultar procedencia</button><div id="field-history" class="log"></div></details>
    ${productEditor(p)}
    </div>
    </div>`;
}
