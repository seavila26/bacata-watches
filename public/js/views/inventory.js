import { state } from '../state.js';
import { money, percent, escapeHtml as esc } from '../utils.js';
const labels = {
  all: 'Todas las referencias',
  launch: 'Inicio: margen ≥10%, In Stock y compra ≤USD 2.000',
  priority: 'Margen 10–20%',
  high: 'Margen superior al 20%',
  low: 'Margen 2–10%',
  pending: 'Sin comparable',
  review: 'Comparable por revisar',
  outside: 'Fuera del margen'
};
export function filteredPreview() {
  const p = state.importPreview;
  if (!p) return [];
  return p.records.filter(r => (state.importFilter === 'all' || (state.importFilter === 'launch' ? ['priority', 'high'].includes(r.group) && r.availability === 'In Stock.' && r.analysis.supplier / r.analysis.fx <= 2000 : r.group === state.importFilter)) && (!state.importQuery || `${r.brand} ${r.reference}`.toLowerCase().includes(state.importQuery.toLowerCase())));
}
export function inventory() {
  const p = state.importPreview;
  return `<div class="panel import-intro"><span class="eyebrow">01 / ANALIZAR · 02 / SELECCIONAR · 03 / GUARDAR</span><h2>Cargar referencias.</h2><p>Sube el Excel con las hojas <strong>Base comparada</strong>, <strong>Base lujo</strong> y <strong>Supuestos</strong>. Las vistas de margen no se importan como productos adicionales.</p>
  <form id="inventory-form"><label class="field">Inventario XLSX (máximo 15 MB)<input type="file" name="file" accept=".xlsx" required></label><button class="btn">Analizar y preparar vista previa</button></form><p class="muted">Analizar no modifica el catálogo. Las nuevas referencias se guardarán como borradores, por cotizar.</p></div>
  ${p ? preview(p) : '<div class="panel import-empty"><h3>La vista previa aparecerá aquí.</h3><p>Podrás revisar errores, márgenes y disponibilidad antes de elegir las referencias que deseas guardar.</p></div>'}`;
}
function preview(p) {
  const filtered = filteredPreview(),
    page = Math.min(state.importPage, Math.max(0, Math.ceil(filtered.length / 50) - 1));
  state.importPage = page;
  const rows = filtered.slice(page * 50, (page + 1) * 50);
  const selected = p.records.filter(r => state.importSelection.has(r.index));
  return `<section class="import-preview"><div class="stats">${[[p.summary.total, 'Referencias únicas'], [p.summary.create, 'Nuevas'], [p.summary.update, 'Actualizaciones'], [p.summary.blocked, 'Con errores']].map(([n, label]) => `<div class="panel"><b>${n}</b>${label}</div>`).join('')}</div>
  <div class="notice"><strong>${p.duplicates} coincidencias reunidas.</strong> ${p.formula_errors} errores de fórmula: esas referencias quedan por cotizar. Los costos se calculan en el servidor con los parámetros de Administración. Tasa global: ${money(p.global_settings.fx)}/USD.</div>
  <form id="preview-filter" class="admin-filters"><label>Grupo<select name="group">${Object.entries(labels).map(([k, v]) => `<option value="${k}" ${state.importFilter === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label>Marca o referencia<input name="query" value="${esc(state.importQuery)}" type="search"></label><button class="btn secondary">Filtrar</button></form>
  <div class="selection-toolbar"><p role="status">${filtered.length} resultados · <strong>${selected.length} seleccionados</strong></p><div class="actions"><button class="btn secondary" data-action="select-import">Seleccionar resultados válidos del filtro</button><button class="btn secondary" data-action="clear-import">Limpiar selección</button><button class="btn secondary" data-action="export-import" ${!filtered.length && !selected.length ? 'disabled' : ''}>Exportar plantilla de fichas</button></div></div>
  <div class="table-wrap"><table><thead><tr><th>Elegir</th><th>Referencia</th><th>Origen</th><th>Acción</th><th>Venta sugerida</th><th>Margen de contribución</th><th>Proveedor</th><th>Revisión necesaria</th></tr></thead><tbody>${rows.map(r => `<tr><td><input aria-label="Seleccionar ${esc(r.reference)}" type="checkbox" data-import-index="${r.index}" ${state.importSelection.has(r.index) ? 'checked' : ''} ${r.errors.length ? 'disabled' : ''}></td><td><strong>${esc(r.brand)}</strong><small>${esc(r.reference)}</small></td><td>${esc(r.sheet)}<small>Fila ${r.row} · ${esc(r.date.slice(0, 10))}</small></td><td>${r.errors.length ? 'Bloqueada' : r.action === 'create' ? 'Nueva' : 'Actualizar'}</td><td class="num">${r.analysis?.suggested == null ? 'Por cotizar' : money(r.analysis.suggested)}</td><td class="num">${r.analysis?.margin == null ? 'Sin comparable' : percent(r.analysis.margin)}</td><td>${esc(r.availability)}</td><td>${r.errors.map(x => `<p class="import-error">${esc(x)}</p>`).join('')}${r.warnings.map(x => `<small>${esc(x)}</small>`).join('')}${!r.errors.length ? '<small>Exportar plantilla para completar ficha.</small>' : ''}</td></tr>`).join('') || '<tr><td colspan="8">No hay referencias en este filtro.</td></tr>'}</tbody></table></div>
  <div class="pagination"><button class="btn secondary" data-action="import-page" data-delta="-1" ${page === 0 ? 'disabled' : ''}>Anterior</button><span>Página ${page + 1} de ${Math.max(1, Math.ceil(filtered.length / 50))}</span><button class="btn secondary" data-action="import-page" data-delta="1" ${(page + 1) * 50 >= filtered.length ? 'disabled' : ''}>Siguiente</button></div>
  <div class="panel import-commit"><h3>Guardar ${selected.length} referencias seleccionadas</h3><p>Las actualizaciones conservan fotos, textos, datos técnicos y precio aprobado. Actualizan la última confirmación. Si el margen cae por debajo del mínimo, la publicación se pausa.</p><p class="muted">Vista previa válida hasta ${esc(new Date(p.expires_at).toLocaleTimeString('es-CO'))}. Guardar registra la carga en Actividad.</p><button class="btn" data-action="commit-import" ${!selected.length ? 'disabled' : ''}>Guardar selección en el administrador</button></div></section>`;
}
