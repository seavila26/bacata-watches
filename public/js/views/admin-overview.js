import { escapeHtml as esc } from '../utils.js';
import { icon } from '../components.js';

export function operationCounts(products) {
  return {
    total: products.length,
    published: products.filter(p => p.effective_status === 'published').length,
    pending: products.filter(p => p.effective_status === 'pending').length,
    paused: products.filter(p => p.effective_status === 'paused').length,
    confirmation: products.filter(p => p.effective_status === 'requires_confirmation').length
  };
}
const steps = [
  ['inventario', 'Cargar la base', 'Analiza precios y comparables sin modificar el catálogo.', 'upload'],
  ['oportunidades', 'Elegir referencias', 'Revisa el margen y exporta la plantilla de tu selección.', 'chart'],
  ['fichas', 'Completar las fichas', 'Importa las características. Revisa antes de guardar y publicar.', 'file'],
  ['publicaciones', 'Cuidar la selección', 'Confirma vigencia, pausa o reactiva las piezas publicadas.', 'check']
];
export function overview(data) {
  const counts = operationCounts(data.products);
  const metrics = [
    [counts.published, 'En tienda', 'Publicaciones activas', 'publicaciones', 'published', 'good'],
    [counts.pending, 'Borradores', 'Referencias por completar', 'oportunidades', 'pending', ''],
    [counts.confirmation, 'Por confirmar', 'Revisar vigencia de la fuente', 'publicaciones', 'requires_confirmation', 'warn'],
    [counts.paused, 'Pausadas', 'Retiradas de la selección', 'publicaciones', 'paused', '']
  ];
  const focus = counts.confirmation ? ['Confirmar la vigencia.', `${counts.confirmation} referencias requieren confirmación antes de volver a la tienda.`, 'publicaciones', 'requires_confirmation', 'Revisar confirmaciones']
    : counts.pending ? ['Dar forma a la selección.', `${counts.pending} borradores esperan revisión. Compara las oportunidades y prepara sus fichas.`, 'oportunidades', 'pending', 'Revisar borradores']
    : !counts.total ? ['Tu selección empieza aquí.', 'Carga la base de precios para revisar oportunidades y preparar las primeras fichas.', 'inventario', '', 'Importar la base']
    : ['Una selección al día.', 'Revisa las publicaciones y confirma que cada ficha conserva sus condiciones vigentes.', 'publicaciones', '', 'Ver publicaciones'];
  const attention = data.products.filter(p => ['requires_confirmation', 'paused'].includes(p.effective_status)).slice(0, 5);
  return `<div class="admin-metrics">${metrics.map(([value, label, description, tab, status, tone]) => `<button class="metric-card ${tone}" data-action="admin-shortcut" data-tab="${tab}" data-status="${status}"><span class="metric-card__label">${label}${icon('arrow')}</span><strong>${value}</strong><span>${description}</span></button>`).join('')}</div>
  <section class="operations-focus"><div><span class="eyebrow">TU SIGUIENTE PASO</span><h2>${focus[0]}</h2><p>${focus[1]}</p></div><button class="btn" data-action="admin-shortcut" data-tab="${focus[2]}" data-status="${focus[3]}">${focus[4]}${icon('arrow')}</button></section>
  <section class="workflow-guide"><div class="section-head"><div><span class="eyebrow">DE LA OPORTUNIDAD A LA TIENDA</span><h2>Un recorrido, cuatro pasos.</h2></div><span class="workflow-note">Los costos permanecen en el área privada.</span></div><div class="workflow-grid">${steps.map(([tab, title, text, symbol], index) => `<button class="workflow-card" data-action="tab" data-tab="${tab}"><span class="workflow-card__top"><span>0${index + 1}</span>${icon(symbol)}</span><strong>${title}</strong><span>${text}</span><span class="workflow-card__link">Abrir sección ${icon('arrow')}</span></button>`).join('')}</div></section>
  <section class="attention-panel panel"><div class="section-head"><div><span class="eyebrow">ATENCIÓN A LA SELECCIÓN</span><h2>Lo que merece una revisión.</h2></div><button class="text-button" data-action="tab" data-tab="publicaciones">Ver publicaciones ${icon('arrow')}</button></div>${attention.length ? `<div class="attention-list">${attention.map(p => `<button class="attention-item" data-action="review" data-id="${esc(p.id)}"><span>${icon(p.effective_status === 'requires_confirmation' ? 'clock' : 'file')}</span><span><strong>${esc(p.brand)} · ${esc(p.reference)}</strong><small>${p.effective_status === 'requires_confirmation' ? 'Requiere confirmación' : 'Publicación pausada'} · ${esc(p.pause_reason || 'Revisa las condiciones de la ficha')}</small></span>${icon('arrow')}</button>`).join('')}</div>` : `<div class="calm-state">${icon('check')}<div><strong>Sin publicaciones pausadas ni pendientes de confirmación.</strong><p>${counts.pending ? 'Los borradores se revisan desde Oportunidades.' : 'Continúa preparando y revisando tu selección.'}</p></div></div>`}</section>
  <p class="admin-footnote">${counts.total} referencias en el administrador · la tienda muestra únicamente las publicaciones vigentes.</p>`;
}
