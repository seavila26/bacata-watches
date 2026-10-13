import { commercialView } from './commercial.js';
import { inventory } from './inventory.js';
import { catalogImport } from './catalog-import.js';
import { publications } from './publications.js';
import { productEditor } from './product-editor.js';
import { overview, operationCounts } from './admin-overview.js';
import { icon } from '../components.js';
import { state } from '../state.js';
import { money, percent, formatDate, escapeHtml as esc } from '../utils.js';
export const adminSections = [
  ['resumen', 'Resumen', 'dashboard', 'Tu selección, de un vistazo.'],
  ['inventario', 'Importar base', 'upload', 'Analiza la base y guarda las referencias que quieres trabajar.'],
  ['oportunidades', 'Oportunidades', 'chart', 'Compara rentabilidad y prepara tu selección de fichas.'],
  ['fichas', 'Importar fichas', 'file', 'Revisa los datos técnicos antes de guardar y publicar.'],
  ['publicaciones', 'Publicaciones', 'check', 'Cuida la vigencia y visibilidad de tu catálogo.'],
  ['reglas', 'Parámetros', 'settings', 'Condiciones comunes y reglas de rentabilidad.'],
  ['comercial', 'Información comercial', 'file', 'Contacto, envíos, garantía y condiciones públicas de tu tienda.'],
  ['pedidos', 'Solicitudes', 'bag', 'Consulta las solicitudes de compra de demostración.'],
  ['auditoria', 'Actividad', 'history', 'El registro de los cambios en tu selección.']
];
export const statusLabels = {
  pending: 'Borrador',
  published: 'Publicada',
  paused: 'Pausada',
  requires_confirmation: 'Requiere confirmación'
};
export function launchMatch(p) {
  return p.analysis.margin >= .10 && p.analysis.comparable && p.source?.availability === 'In Stock.' && p.analysis.price_usd <= 2000;
}
export function filteredOpportunities() {
  return state.admin.products.filter(p => (!state.adminQuery || `${p.brand} ${p.name} ${p.reference}`.toLowerCase().includes(state.adminQuery.toLowerCase())) && (!state.adminStatus || p.effective_status === state.adminStatus) && (state.opportunityFilter === 'all' || (state.opportunityFilter === 'launch' ? launchMatch(p) : state.opportunityFilter === 'pending' ? p.analysis.margin == null : state.opportunityFilter === 'review' ? !p.analysis.comparable : state.opportunityFilter === 'high' ? p.analysis.margin > .2 : state.opportunityFilter === 'priority' ? p.analysis.margin >= .1 && p.analysis.margin <= .2 : state.opportunityFilter === 'low' ? p.analysis.margin >= .02 && p.analysis.margin < .1 : p.analysis.margin != null && p.analysis.margin < .02)));
}
export const tag = p => `<span class="tag ${p.effective_status === 'published' ? 'good' : 'warn'}">${esc(statusLabels[p.effective_status] || p.effective_status)}</span>`;
const amount = v => v == null ? 'Por cotizar' : money(v);
export function profitability(p) {
  const a = p.analysis;
  return `<section class="panel"><h3>Análisis de rentabilidad</h3>${[['Precio proveedor (USD ' + (a.price_usd ?? '—') + ')', a.supplier], ['Envío proveedor (USD ' + (a.shipping_usd ?? '—') + ')', a.shipping], ['Importación e impuestos', a.importCost], ['Comisión', a.commission], ['Colchón logístico', a.buffer], ['Costo total estimado', a.cost], ['Precio de mercado', a.market], ['Venta sugerida', a.suggested], ['Precio aprobado', p.approved_price_cop], ['Precio de publicación', a.price], ['Contribución', a.profit]].map(([label, value]) => `<div class="breakdown"><span>${esc(label)}</span><strong>${amount(value)}</strong></div>`).join('')}<div class="breakdown emphasis"><span>Margen sobre venta</span><strong>${a.margin == null ? 'Por cotizar' : percent(a.margin)}</strong></div>${a.quote_reason ? `<p class="notice">${esc(a.quote_reason)}</p>` : ''}<p class="muted">Tasa ${money(a.fx)}/USD. Costo total = compra + envío + importación e impuestos + comisión + colchón logístico.</p></section>`;
}
export function login() {
  return `<section class="wrap admin-login"><div class="login-story"><span class="eyebrow">BACATÁ / OPERACIONES</span><h1>Cada detalle,<br><em>bajo control.</em></h1><p>Una selección cuidada empieza con información clara. Revisa tus oportunidades, prepara las fichas y acompaña cada publicación.</p><span class="login-signature"><span class="hairline"></span>Tiempo que se siente.</span></div><div class="login-form-panel panel"><span class="eyebrow">ACCESO PRIVADO</span><h2>Administración</h2><p class="muted">Ingresa para continuar con tu selección.</p><form id="login"><label class="field">Correo<input type="email" name="email" autocomplete="username" required></label><label class="field">Contraseña<input type="password" name="password" autocomplete="current-password" required></label><button class="btn">Ingresar ${icon('arrow')}</button></form><a class="text-link" href="#/">Volver a la tienda</a></div></section>`;
}
function opportunities() {
  const rows = filteredOpportunities();
  state.adminPage = Math.min(Math.max(0, state.adminPage), Math.max(0, Math.ceil(rows.length / 50) - 1));
  return `<div class="stats">${[[rows.length, 'Resultados'], [state.opportunitySelection.size, 'Seleccionados'], [rows.filter(p => p.analysis.eligible).length, 'Superan margen mínimo']].map(([n, label]) => `<div class="panel"><b>${n}</b>${label}</div>`).join('')}</div><form id="admin-filter" class="admin-filters"><label>Buscar<input name="query" type="search" value="${esc(state.adminQuery)}"></label><label>Grupo<select name="group">${Object.entries({
    launch: 'Inicio: margen ≥10%, In Stock, compra ≤USD 2.000',
    all: 'Todas',
    high: 'Margen >20%',
    priority: 'Margen 10–20%',
    low: 'Margen 2–10%',
    outside: 'Fuera de margen',
    pending: 'Por cotizar',
    review: 'Comparable por revisar'
  }).map(([v, l]) => `<option value="${v}" ${v === state.opportunityFilter ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>Estado<select name="status"><option value="">Todos</option>${Object.entries(statusLabels).map(([v, l]) => `<option value="${v}" ${v === state.adminStatus ? 'selected' : ''}>${l}</option>`).join('')}</select></label><button class="btn secondary">Filtrar</button></form>
 <div class="selection-toolbar"><div class="actions"><button class="btn secondary" data-action="select-opportunities">Seleccionar resultados de todas las páginas</button><button class="btn secondary" data-action="clear-opportunities">Limpiar selección</button><button class="btn" data-action="export-opportunities" ${!rows.length && !state.opportunitySelection.size ? 'disabled' : ''}>Exportar plantilla de fichas</button></div><p class="muted">Exporta la selección; si no hay selección, todos los resultados filtrados.</p></div>
 <div class="table-wrap"><table><thead><tr><th>Elegir</th><th>Marca / referencia</th><th>Compra USD</th><th>Costo total</th><th>Mercado</th><th>Venta sugerida</th><th>Precio aprobado</th><th>Contribución</th><th>Margen</th><th>Estado</th><th></th></tr></thead><tbody>${rows.slice(state.adminPage * 50, (state.adminPage + 1) * 50).map(p => `<tr><td><input type="checkbox" data-opportunity-id="${esc(p.id)}" aria-label="Seleccionar ${esc(p.reference)}" ${state.opportunitySelection.has(p.id) ? 'checked' : ''}></td><td><strong>${esc(p.brand)}</strong><small>${esc(p.reference)}</small></td><td>${p.analysis.price_usd ?? 'Por cotizar'}</td><td>${amount(p.analysis.cost)}</td><td>${amount(p.analysis.market)}</td><td>${amount(p.analysis.suggested)}</td><td>${amount(p.approved_price_cop)}</td><td>${amount(p.analysis.profit)}</td><td>${p.analysis.margin == null ? 'Por cotizar' : percent(p.analysis.margin)}</td><td>${tag(p)}</td><td><button class="btn secondary" data-action="review" data-id="${esc(p.id)}">Examinar</button></td></tr>`).join('') || '<tr><td colspan="11">Sin resultados.</td></tr>'}</tbody></table></div><div class="pagination"><button class="btn secondary" data-action="admin-page" data-delta="-1" ${!state.adminPage ? 'disabled' : ''}>Anterior</button><span>${rows.length} referencias · página ${state.adminPage + 1}</span><button class="btn secondary" data-action="admin-page" data-delta="1" ${(state.adminPage + 1) * 50 >= rows.length ? 'disabled' : ''}>Siguiente</button></div>`;
}
function settingsView(s) {
  return `<form id="settings-form" class="panel"><h2>Administración</h2><div class="settings-grid">${[['fx', 'Tasa COP/USD'], ['duty', 'Importación e impuestos (%)'], ['fee', 'Comisión (%)'], ['logistics_rate', 'Colchón logístico (%)'], ['discount', 'Descuento sobre mercado (%)'], ['min_margin', 'Margen mínimo (%)']].map(([k, l]) => `<label>${l}<input name="${k}" type="number" min="0" step="any" value="${k === 'fx' ? esc(s[k]) : Number(s[k]) * 100}" required></label>`).join('')}</div>${[['delivery_days', 'Plazo de entrega global'], ['warranty', 'Garantía global'], ['shipping_terms', 'Condiciones de envío globales']].map(([k, l]) => `<label class="field">${l}<textarea name="${k}" required>${esc(s[k])}</textarea></label>`).join('')}<p class="notice">Los cambios recalculan todas las oportunidades. Las publicaciones cuyo margen quede por debajo del mínimo se pausan.</p><button class="btn">Guardar parámetros</button></form>`;
}
export function admin() {
  if (!state.admin) return login();
  const d = state.admin;
  let content = '';
  const selected = d.products.find(p => p.id === state.selected);
  if (selected) content = `<div class="reference-heading"><button class="btn secondary" data-action="back">← Volver</button><div><span class="eyebrow">FICHA PRIVADA</span><h2>${esc(selected.brand)} · ${esc(selected.reference)}</h2></div>${tag(selected)}</div><div class="admin-detail">${profitability(selected)}<section class="panel"><h3>Estado de la ficha</h3><p>${esc(selected.pause_reason)}</p>${selected.publication_issues.length ? `<ul class="readiness-list">${selected.publication_issues.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="notice">La ficha cumple los requisitos de publicación actuales.</p>'}<div class="actions"><button class="btn secondary" data-action="publication-action" data-command="pause" data-id="${esc(selected.id)}" ${selected.effective_status === 'pending' || selected.effective_status === 'paused' ? 'disabled' : ''}>Pausar</button><button class="btn" data-action="publication-action" data-command="${selected.effective_status === 'published' || selected.effective_status === 'requires_confirmation' ? 'confirm' : 'reactivate'}" data-id="${esc(selected.id)}">${selected.effective_status === 'published' ? 'Confirmar vigencia' : selected.effective_status === 'requires_confirmation' ? 'Confirmar y mantener activa' : selected.effective_status === 'pending' ? 'Publicar ficha' : 'Reactivar'}</button></div><details><summary>Historial de campos</summary><button class="btn secondary" data-action="field-history" data-id="${esc(selected.id)}">Consultar</button><div id="field-history" class="log"></div></details>${productEditor(selected)}</section></div>`;else if (state.tab === 'resumen') content = overview(d);else if (state.tab === 'oportunidades') content = opportunities();else if (state.tab === 'inventario') content = inventory();else if (state.tab === 'fichas') content = catalogImport();else if (state.tab === 'publicaciones') content = publications();else if (state.tab === 'comercial') content = commercialView(d.commercial);else if (state.tab === 'reglas') content = settingsView(d.settings);else if (state.tab === 'auditoria') content = `<section class="panel"><h2>Actividad reciente</h2>${d.audit.map(a => `<div class="breakdown"><span>${esc(a.action)} · ${esc(a.subject)}<small>${esc(a.actor)} · ${esc(formatDate(a.created_at))}</small></span><details><summary>Detalle</summary><pre>${esc(a.details)}</pre></details></div>`).join('') || '<div class="calm-state">Todavía no hay cambios registrados.</div>'}</section>`;else if (state.tab === 'pedidos') content = `<section class="panel"><h2>Solicitudes de prueba</h2><p class="notice">Pasarela pendiente. Sin cobros ni reservas.</p>${d.orders.map(o => `<div class="breakdown"><span>${esc(o.id)}<small>${esc(o.status)}</small></span><strong>${money(o.total_cop)}</strong></div>`).join('') || '<div class="calm-state">Todavía no hay solicitudes.</div>'}</section>`;
  const section = adminSections.find(([key]) => key === state.tab) || adminSections[0];
  const counts = operationCounts(d.products);
  return `<div class="admin-shell"><aside class="admin-sidebar"><div class="sidebar-heading"><span class="sidebar-symbol" aria-hidden="true">${icon('clock')}</span><div><strong>Bacatá</strong><span>Centro de control</span></div></div><div class="tabs admin-nav" role="tablist" aria-orientation="vertical" aria-label="Secciones administrativas">${adminSections.map(([key, label, symbol]) => `<button id="admin-nav-${key}" role="tab" aria-selected="${state.tab === key}" tabindex="${state.tab === key ? 0 : -1}" aria-controls="admin-tabpanel" data-action="tab" data-tab="${key}" class="${state.tab === key ? 'active' : ''}">${icon(symbol)}<span>${label}</span>${key === 'publicaciones' ? `<small>${counts.published}</small>` : key === 'oportunidades' ? `<small>${counts.total}</small>` : ''}</button>`).join('')}</div><div class="sidebar-bottom"><a href="#/catalogo">Ver la tienda ${icon('arrow')}</a><span>Área privada · costos y márgenes</span><button data-action="logout">Cerrar sesión</button></div></aside><div class="admin-workspace"><header class="admin-top"><div><span class="eyebrow">BACATÁ / OPERACIONES</span><h1>${state.tab === 'resumen' ? 'Centro de control' : section[1]}</h1><p>${section[3]}</p></div><a class="btn secondary" href="#/catalogo">Ver tienda ${icon('arrow')}</a></header><section id="admin-tabpanel" role="tabpanel" aria-labelledby="admin-nav-${section[0]}" tabindex="-1">${content}</section></div></div>`;
}
