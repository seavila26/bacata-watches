import { state } from '../state.js';
import { money, escapeHtml as esc, safeImage } from '../utils.js';
import { art, icon, emptyState, productAvailability } from '../components.js';
import { brand, activeCampaign, articles } from '../config.js';
const link = (path, label, className = 'text-link') => `<a class="${className}" href="#/${path}">${label}${icon('arrow')}</a>`;
export function card(p) {
  const availability = productAvailability(p);
  return `<article class="product-card">
    <a class="product-card__image art" href="#/reloj/${encodeURIComponent(p.id)}" aria-label="Ver ${esc(p.brand)} ${esc(p.name)}">${art(p)}</a>
    <div class="product-card__body">
      <div class="product-card__meta"><span>${esc(p.brand)}</span><span class="availability availability--${availability.key}">${availability.label}</span></div>
      <h3><a href="#/reloj/${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
      <p class="product-card__variant">${esc(p.variant)}</p>
      <p class="product-card__reference">Ref. ${esc(p.reference)}</p>
      <div class="product-card__bottom"><strong class="price">${money(p.price_cop)}</strong><a class="product-card__open" href="#/reloj/${encodeURIComponent(p.id)}" aria-label="Ver detalles de ${esc(p.name)}">${icon('arrow')}</a></div>
      <p class="product-card__delivery">Entrega: ${esc(p.delivery_days || 'Por confirmar')}</p>
    </div>
  </article>`;
}
export function home() {
  const seasonal = activeCampaign();
  const headline = seasonal ? esc(seasonal.headline) : 'Tiempo que<br><em>se siente.</em>';
  return `<section class="hero ${seasonal ? `campaign--${esc(seasonal.theme)}` : ''}" aria-labelledby="hero-title">
    <div class="hero__content"><span class="eyebrow">${seasonal ? esc(seasonal.label) : 'RELOJERÍA BACATÁ / BOGOTÁ'}</span>
      <h1 id="hero-title">${headline}</h1><p>${seasonal ? esc(seasonal.description) : 'Relojes elegidos por su diseño, materiales y movimiento. Una forma propia de elegir el tiempo.'}</p>
      ${link('catalogo', 'Explorar relojes', 'btn')}
      <div class="hero__caption"><span class="hairline"></span>Elegir con criterio. Disfrutar con confianza.</div>
    </div>
    <figure class="hero__visual"><img src="/assets/hero-concept.webp" width="1536" height="1024" fetchpriority="high" alt="Reloj de esfera azul sobre piedra, dirección visual conceptual de Bacatá"><figcaption>Imagen conceptual del manual de marca</figcaption></figure>
  </section>
  <div class="wrap">
    ${state.products.length ? `<nav class="brand-rail" aria-label="Marcas de la selección"><span>EN LA SELECCIÓN</span>${[...new Set(state.products.map(p => p.brand))].slice(0, 6).map(name => link(`catalogo?brand=${encodeURIComponent(name)}`, esc(name))).join('')}</nav>` : ''}
    <section class="selection-paths" data-reveal aria-label="Encuentra tu próxima pieza"><div><span class="eyebrow">UNA PIEZA PARA TI</span><h2>Encuentra tu<br>próxima pieza.</h2></div><div class="selection-paths__links">${link('catalogo?collection=automaticos', 'Automáticos')}${link('catalogo?collection=diario', 'Para el día a día')}${link('editorial/regalar', 'Para regalar')}</div></section>
    <section class="section collection" data-reveal><div class="section-head"><div><span class="eyebrow">SELECCIÓN BACATÁ</span><h2>El detalle importa.</h2></div>${link('catalogo', 'Ver todos los relojes')}</div>${state.products.length ? `<div class="product-grid">${state.products.slice(0, 4).map(card).join('')}</div>` : emptyState('La selección se está preparando.', 'Vuelve pronto para descubrir las referencias publicadas.')}</section>
    <section class="brand-story section" data-reveal><div class="brand-story__mark"><img src="/assets/bacata-logo.png" width="220" height="190" alt="Firma Relojería Bacatá"><span>PRECISIÓN CON RAÍCES</span></div><div><span class="eyebrow">NUESTRA MANERA DE MIRAR</span><h2>El tiempo también<br>se elige.</h2><p>Por cómo se siente. Por lo que acompaña. Por los detalles que importan. Bacatá une una selección cuidada con información clara y atención cercana.</p>${link('como-elegimos', 'Conoce nuestro criterio')}</div></section>
    <section class="section" data-reveal><div class="section-head"><div><span class="eyebrow">SELECCIÓN / EDUCACIÓN / MOMENTOS</span><h2>Mirar de cerca.</h2></div>${link('editorial', 'Explorar editorial')}</div><div class="editorial-grid">${articles.map((a, i) => `<a class="editorial-card" href="#/editorial/${a.slug}"><span class="editorial-card__number">0${i + 1}</span><span class="eyebrow">${a.category}</span><h3>${a.title}</h3><p>${a.intro}</p><span class="text-link">Leer el artículo ${icon('arrow')}</span></a>`).join('')}</div></section>
    ${serviceStrip()}
  </div>`;
}
function serviceStrip() {
  return `<section class="service-strip" aria-label="La experiencia Bacatá"><div>${icon('shield')}<h3>Claridad al elegir</h3><p>Referencia, estado y condiciones visibles en la ficha.</p></div><div>${icon('clock')}<h3>Tiempo para decidir</h3><p>Compara diseño, proporciones y uso antes de confirmar.</p></div><div>${icon('heart')}<h3>Atención cuidada</h3><p>Primera pieza, regalo o alta gama: la misma atención.</p></div></section>`;
}
export function catalog() {
  const f = state.filters;
  const brands = [...new Set(state.products.map(p => p.brand))].sort();
  const movements = [...new Set(state.products.map(p => p.movement).filter(Boolean))];
  const styles = [...new Set(state.products.map(p => p.style).filter(Boolean))];
  const rows = state.products.filter(p => {
    const available = productAvailability(p).key;
    return (!f.brand || p.brand === f.brand) && (!f.q || `${p.reference} ${p.name} ${p.brand} ${p.collection || ''} ${p.movement || ''}`.toLowerCase().includes(f.q.toLowerCase())) && (!f.price || (f.price === 'low' ? p.price_cop < 2500000 : f.price === 'mid' ? p.price_cop >= 2500000 && p.price_cop <= 4000000 : p.price_cop > 4000000)) && (!f.movement || p.movement === f.movement) && (!f.style || p.style === f.style) && (!f.availability || available === f.availability) && (!f.diameter || Number.isFinite(+p.diameter_mm) && p.diameter_mm != null && (f.diameter === 'compact' ? +p.diameter_mm < 40 : +p.diameter_mm >= 40));
  });
  if (state.catalogSort === 'price-asc') rows.sort((a, b) => a.price_cop - b.price_cop);
  if (state.catalogSort === 'price-desc') rows.sort((a, b) => b.price_cop - a.price_cop);
  if (state.catalogSort === 'brand') rows.sort((a, b) => a.brand.localeCompare(b.brand, 'es') || a.name.localeCompare(b.name, 'es'));
  const filterNames = { q: 'Búsqueda', brand: 'Marca', price: 'Precio', movement: 'Movimiento', diameter: 'Diámetro', style: 'Estilo', availability: 'Disponibilidad' };
  const activeFilters = Object.entries(f).filter(([, value]) => value);
  const options = (items, value) => items.map(([key, label]) => `<option value="${esc(key)}" ${value === key ? 'selected' : ''}>${esc(label)}</option>`).join('');
  return `<section class="wrap catalog"><div class="catalog-heading"><div><span class="eyebrow">BACATÁ / RELOJES</span><h1>Tu manera<br>de llevarlo.</h1></div><p>Una selección para comparar con calma. Referencias completas, precios en pesos y detalles que ayudan a elegir.</p></div>
    <div class="catalog-toolbar"><label class="search-field">${icon('search')}<span class="sr-only">Buscar por marca, nombre o referencia</span><input id="search" type="search" value="${esc(f.q)}" placeholder="Buscar marca, modelo o referencia"></label><button class="btn secondary" data-action="clear-filters">Restablecer filtros</button></div>
    <div class="filters"><label>Marca<select id="brand"><option value="">Todas las marcas</option>${options(brands.map(b => [b, b]), f.brand)}</select></label>
    <label>Precio COP<select data-filter="price"><option value="">Todos los precios</option>${options([['low', 'Menos de $2.500.000'], ['mid', '$2.500.000 a $4.000.000'], ['high', 'Más de $4.000.000']], f.price)}</select></label>
    <label>Movimiento<select data-filter="movement" ${movements.length ? '' : 'disabled'}><option value="">${movements.length ? 'Todos' : 'Datos por verificar'}</option>${options(movements.map(x => [x, x]), f.movement)}</select></label>
    <label>Diámetro<select data-filter="diameter" ${state.products.some(p => p.diameter_mm != null) ? '' : 'disabled'}><option value="">${state.products.some(p => p.diameter_mm != null) ? 'Todos' : 'Datos por verificar'}</option>${options([['compact', 'Menos de 40 mm'], ['large', '40 mm o más']], f.diameter)}</select></label>
    <label>Estilo<select data-filter="style" ${styles.length ? '' : 'disabled'}><option value="">${styles.length ? 'Todos' : 'Datos por verificar'}</option>${options(styles.map(x => [x, x]), f.style)}</select></label>
    <label>Disponibilidad<select data-filter="availability"><option value="">Todas</option>${options([['available', 'Disponible']], f.availability)}</select></label></div>
    ${activeFilters.length ? `<div class="active-filters" aria-label="Filtros activos">${activeFilters.map(([key, value]) => `<button class="filter-chip" data-action="remove-filter" data-filter-key="${key}" aria-label="Quitar filtro ${filterNames[key]}: ${esc(value)}">${filterNames[key]}${key === 'q' || key === 'brand' || key === 'movement' || key === 'style' ? `: ${esc(value)}` : ''}${icon('close')}</button>`).join('')}</div>` : ''}
    <div class="results-heading"><p role="status">${rows.length} ${rows.length === 1 ? 'pieza' : 'piezas'} en esta selección</p><label class="catalog-sort">Ordenar por<select id="catalog-sort">${options([['selection', 'Selección Bacatá'], ['price-asc', 'Precio: menor a mayor'], ['price-desc', 'Precio: mayor a menor'], ['brand', 'Marca: A–Z']], state.catalogSort)}</select></label></div>
    ${rows.length ? `<div class="product-grid">${rows.map(card).join('')}</div>` : emptyState('No encontramos esa pieza.', 'Prueba otra marca, referencia o rango de precio.', '<button class="btn" data-action="clear-filters">Limpiar filtros</button>')}
  </section>`;
}
export function detail(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return `<section class="wrap">${emptyState('Esta referencia no está disponible.', 'Puede haber sido retirada de la selección.', link('catalogo', 'Volver a relojes', 'btn'))}</section>`;
  const availability = productAvailability(p);
  const images = [p.image_url, ...(Array.isArray(p.images) ? p.images : [])].filter(Boolean);
  const galleryImages = images.map(safeImage).filter(Boolean);
  return `<section class="wrap product-detail"><nav class="breadcrumbs" aria-label="Ruta de navegación"><a href="#/">Inicio</a><span>/</span><a href="#/catalogo">Relojes</a><span>/</span><span>${esc(p.name)}</span></nav>
  <div class="detail"><div class="product-gallery"><button class="gallery-main art" data-action="zoom" data-id="${esc(p.id)}" aria-label="Ampliar imagen de ${esc(p.name)}">${art(p)}<span class="gallery-hint">${icon('search')} Mirar de cerca</span></button>${galleryImages.length > 1 ? `<div class="gallery-thumbs">${galleryImages.map((url, i) => `<button data-action="gallery" data-image="${esc(url)}" aria-label="Fotografía ${i + 1}" aria-pressed="${i === 0}"><img src="${esc(url)}" alt="Vista ${i + 1} de ${esc(p.name)}" width="80" height="80" loading="lazy"></button>`).join('')}</div>` : ''}<p class="gallery-caption">${p.image_url ? 'Imagen de la referencia. Verifica procedencia y condiciones.' : 'Ilustración de demostración; no acredita un producto real.'}</p></div>
  <div class="product-info"><span class="eyebrow">${esc(p.brand)}</span><h1>${esc(p.name)}</h1><p class="product-variant">${esc(p.variant)}</p><p class="product-reference">Referencia exacta · ${esc(p.reference)}</p><p class="detail-price">${money(p.price_cop)}</p>
  <div class="purchase-conditions"><span class="availability availability--${availability.key}">${availability.label}</span><p>Entrega estimada: <strong>${esc(p.delivery_days || 'Por confirmar')}</strong></p><p>Disponible para compra.</p></div>
  ${availability.buy ? `<button class="btn btn--wide" data-action="add" data-id="${esc(p.id)}">${icon('bag')}${availability.action}</button>` : link(`contacto?reference=${encodeURIComponent(p.reference)}`, availability.action, 'btn btn--wide')}
  <p class="product-description">${esc(p.description)}</p>
  <dl class="spec-grid">${[['Movimiento', p.movement], ['Diámetro', p.diameter_mm ? `${p.diameter_mm} mm` : null], ['Estado', p.condition], ['Material', p.material], ['Cristal', p.crystal], ['Resistencia al agua', p.water_resistance], ['Correa', p.strap], ['Color de esfera', p.dial_color], ['Color de caja', p.case_color], ['Color de correa', p.strap_color], ['Garantía', p.warranty], ['Contenido de entrega', p.package_contents]].map(([key, val]) => `<div><dt>${key}</dt><dd>${esc(val || 'Por verificar')}</dd></div>`).join('')}</dl>
  <details class="product-accordion"><summary>Procedencia y documentación</summary><p>${esc(p.provenance || 'La procedencia y la documentación deben validarse para esta referencia antes de una venta real.')}</p></details>
  <details class="product-accordion"><summary>Entrega, garantía y cambios</summary><p>${esc(p.shipping_terms || 'Plazo, costo de envío, responsable y alcance de garantía, y condiciones de cambio pendientes de confirmación comercial.')}</p></details>
  </div></div></section>`;
}
export function cart() {
  const all = Object.entries(state.cart).map(([id, qty]) => ({
    id,
    p: state.products.find(p => p.id === id),
    qty
  }));
  const rows = all.filter(x => x.p),
    missing = all.filter(x => !x.p);
  const total = rows.reduce((n, x) => n + x.p.price_cop * x.qty, 0);
  return `<section class="wrap bag"><span class="eyebrow">TU SELECCIÓN</span><h1>La bolsa.</h1>${missing.length ? `<div class="notice error"><p>Hay ${missing.length} referencias que ya no están publicadas. Retíralas para continuar.</p>${missing.map(x => `<button class="btn danger" data-action="remove" data-id="${esc(x.id)}">Retirar ${esc(x.id)}</button>`).join('')}</div>` : ''}${rows.length ? `<div class="split"><div>${rows.map(({
    p,
    qty
  }) => `<article class="cartrow"><a class="art" href="#/reloj/${encodeURIComponent(p.id)}">${art(p)}</a><div><span class="eyebrow">${esc(p.brand)}</span><h3>${esc(p.name)}</h3><p>${esc(p.variant)}</p><p class="muted">Ref. ${esc(p.reference)}</p><strong>${money(p.price_cop)}</strong></div><label class="field">Cantidad<input data-qty="${esc(p.id)}" type="number" min="1" max="10" value="${qty}"></label><button class="remove-btn" data-action="remove" data-id="${esc(p.id)}">Eliminar</button></article>`).join('')}</div><aside class="panel order-summary"><span class="eyebrow">RESUMEN DE SELECCIÓN</span><h2>Tu próxima pieza.</h2><div class="breakdown"><span>Subtotal</span><strong>${money(total)}</strong></div><div class="breakdown"><span>Envío</span><strong>Por confirmar</strong></div><div class="total"><span>Total estimado</span><strong>${money(total)}</strong></div><label class="acceptance"><input id="accept-terms" type="checkbox"><span>He leído las <a href="#/condiciones">condiciones de esta demostración</a>.</span></label><button class="btn btn--wide" data-action="order" ${missing.length ? 'disabled' : ''}>Continuar con solicitud de prueba ${icon('arrow')}</button><p class="summary-note">Pasarela pendiente. Esta solicitud no cobra ni reserva inventario.</p></aside></div>` : emptyState('Aún no has elegido una pieza.', 'Explora la selección y mira de cerca las referencias.', link('catalogo', 'Explorar relojes', 'btn'))}</section>`;
}
export function brands() {
  const names = [...new Set(state.products.map(p => p.brand))].sort();
  return `<section class="wrap"><span class="eyebrow">BACATÁ / MARCAS</span><h1>Distintas miradas.<br>Una selección.</h1><p class="intro">Explora las referencias publicadas de cada marca.</p><div class="brand-grid">${names.map(n => `<a class="brand-tile" href="#/catalogo?brand=${encodeURIComponent(n)}"><h2>${esc(n)}</h2><span>${state.products.filter(p => p.brand === n).length} referencias ${icon('arrow')}</span></a>`).join('')}</div></section>`;
}
export function principles() {
  return `<section class="wrap about"><span class="eyebrow">BACATÁ / NUESTRO CRITERIO</span><h1>Elegir con criterio.<br>Disfrutar con confianza.</h1><p class="intro">Acercamos relojes de marcas reconocidas a personas que valoran el diseño, quieren entender su compra y esperan una atención cuidada.</p><div class="about-grid">${[['01', 'Seleccionar', 'Diseño, proporciones y uso orientan cada elección. El producto conserva el protagonismo.'], ['02', 'Explicar', 'La referencia, las fotografías y sus condiciones merecen la misma atención que su presentación.'], ['03', 'Acompañar', 'Desde la primera pieza hasta una compra de mayor valor, la atención debe ser precisa, transparente y cercana.']].map(([n, t, p]) => `<article><span class="eyebrow">${n} / ${t.toUpperCase()}</span><h2>${t} con atención.</h2><p>${p}</p></article>`).join('')}</div><section class="audiences"><h2>Distintas compras.<br>La misma atención.</h2><div>${[['Primera pieza', 'Tamaños, movimientos y usos explicados con claridad.'], ['Un regalo', 'Orientación por estilo, uso y presupuesto.'], ['El aficionado', 'Referencias, detalles y procedencia documentada.'], ['Alta gama', 'Estado y documentación verificables, con revisión individual.']].map(([t, p]) => `<article><h3>${t}</h3><p>${p}</p></article>`).join('')}</div></section>${link('catalogo', 'Encuentra tu próxima pieza', 'btn')}</section>`;
}
export function editorial(slug = '') {
  const article = articles.find(a => a.slug === slug);
  if (article) return `<article class="wrap article"><a class="text-link" href="#/editorial">← Editorial</a><span class="eyebrow">${article.category}</span><h1>${article.title}</h1><p class="intro">${article.intro}</p>${article.paragraphs.map(p => `<p>${p}</p>`).join('')}<div class="article-end">${link('catalogo', 'Explorar la selección', 'btn')}</div></article>`;
  return `<section class="wrap"><span class="eyebrow">BACATÁ / EDITORIAL</span><h1>Sabe de relojes.<br>Sabe escuchar.</h1><p class="intro">Selección, educación y momentos. Ideas para elegir con calma.</p><div class="editorial-grid">${articles.map((a, i) => `<a class="editorial-card" href="#/editorial/${a.slug}"><span class="editorial-card__number">0${i + 1}</span><span class="eyebrow">${a.category}</span><h2>${a.title}</h2><p>${a.intro}</p><span class="text-link">Leer ${icon('arrow')}</span></a>`).join('')}</div></section>`;
}
export function contact(reference = '') {
  return `<section class="wrap contact"><span class="eyebrow">BACATÁ / ACOMPAÑAMIENTO</span><h1>Cuéntanos<br>qué buscas.</h1><p class="intro">Te ayudamos a comparar. ${reference ? `Referencia de interés: <strong>${esc(reference)}</strong>.` : ''}</p><div class="contact-grid"><div class="panel"><h2>Atención comercial</h2>${brand.contactEmail ? `<a class="text-link" href="mailto:${esc(brand.contactEmail)}">${esc(brand.contactEmail)}</a>` : '<p>El canal comercial está pendiente de configuración. Aún no se envían consultas desde esta versión.</p>'}${brand.whatsapp ? `<a class="btn" href="https://wa.me/${esc(brand.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">Recibir asesoría</a>` : ''}${brand.address ? `<p>${esc(brand.address)}</p>` : ''}</div><div><h2>Una consulta más precisa.</h2><p>Para comparar una pieza, ten a mano su referencia y cuéntanos el uso, el estilo y el presupuesto que tienes en mente.</p>${link('catalogo', 'Seguir explorando')}</div></div></section>`;
}
export function conditions() {
  return `<section class="wrap article"><span class="eyebrow">BACATÁ / INFORMACIÓN DE COMPRA</span><h1>Condiciones claras.</h1><p class="intro">Esta versión permite recorrer la tienda y crear solicitudes de prueba.</p><h2>Antes de confirmar</h2><p>Las marcas y cifras iniciales son de demostración. Las imágenes conceptuales no acreditan inventario. La solicitud no genera un cobro, una reserva ni una compra real.</p><h2>Información pendiente de aprobación</h2><p>La operación comercial debe definir responsable de venta, envío, garantía, cambios, devoluciones, tratamiento de datos y canales de atención. Estas condiciones se reemplazarán por textos revisados antes de publicar la tienda.</p>${link('carrito', 'Volver a la bolsa', 'btn secondary')}</section>`;
}
