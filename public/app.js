/** Entry point. Routing and events only; templates live in js/views. */
import { checkoutView, checkoutSteps } from './js/views/checkout.js';
import { validateCustomer, customerDestination } from './js/checkout-model.js';
import { shippingEstimate } from './js/shipping-model.js';
import { paymentView } from './js/views/payments.js';
import { state } from './js/state.js';
import { api, request, normalizeProducts } from './js/api.js';
import { money, escapeHtml as esc, safeImage } from './js/utils.js';
import { art, emptyState } from './js/components.js';
import { home, catalog, detail, cart, brands, principles, editorial, contact, conditions, warranty, privacy } from './js/views/store.js';
import { activeCampaign } from './js/config.js';
import { filteredOpportunities } from './js/views/admin.js';
import { filteredPublications } from './js/views/publications.js';
import { filteredPreview } from './js/views/inventory.js';
import { admin, adminSections } from './js/views/admin.js';
import { enhanceView, enterView, toggleTheme } from './js/experience.js';
const main = document.querySelector('#main');
const toastEl = document.querySelector('#toast');
let routeSequence = 0;
let paymentPoll;
function toast(message, link = '') {
  toastEl.textContent = message;
  if (link) {
    const action = document.createElement('a');
    action.href = link;
    action.textContent = 'Ver bolsa →';
    toastEl.append(action);
  }
  toastEl.classList.add('on');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toastEl.classList.remove('on'), 4200);
}
function saveCart() {
  try {
    localStorage.setItem('aurel-cart', JSON.stringify(state.cart));
  } catch {/* Storage unavailable: session cart remains usable. */}
  const count = Object.values(state.cart).reduce((a, b) => a + b, 0);
  document.querySelector('#cart-count').textContent = count;
  document.querySelector('.bag-link').setAttribute('aria-label', `Bolsa de compra, ${count} artículos`);
}
function currentRoute() {
  const raw = location.hash.slice(1) || '/';
  const [path, query] = raw.split('?');
  return {
    path: decodeURIComponent(path),
    query: new URLSearchParams(query || '')
  };
}
function syncCatalogLocation() {
  const query = new URLSearchParams(Object.entries(state.filters).filter(([, value]) => value));
  if (state.catalogSort !== 'selection') query.set('sort', state.catalogSort);
  history.replaceState(null, '', `#/catalogo${query.size ? '?' + query.toString() : ''}`);
}
function render() {
  const focused = document.activeElement;
  const focusSelector = focused?.id ? `#${CSS.escape(focused.id)}` : focused?.dataset.opportunityId ? `[data-opportunity-id="${CSS.escape(focused.dataset.opportunityId)}"]` : focused?.dataset.publicationId ? `[data-publication-id="${CSS.escape(focused.dataset.publicationId)}"]` : focused?.dataset.importIndex !== undefined ? `[data-import-index="${focused.dataset.importIndex}"]` : focused?.name && focused.closest('form')?.id ? `#${CSS.escape(focused.closest('form').id)} [name="${CSS.escape(focused.name)}"]` : null;
  const {
    path,
    query
  } = currentRoute();
  document.body.classList.toggle('is-admin', path.startsWith('/admin'));
  const views = {
    '/': home,
    '/catalogo': catalog,
    '/carrito': cart,
    '/datos': checkoutView,
    '/marcas': brands,
    '/como-elegimos': principles,
    '/editorial': editorial,
    '/contacto': () => contact(query.get('reference') || ''),
    '/condiciones': conditions,
    '/garantia': warranty,
    '/privacidad': privacy,
    '/pago': paymentView
  };
  main.innerHTML = path.startsWith('/admin') ? admin() : path.startsWith('/reloj/') ? detail(path.slice(7)) : path.startsWith('/editorial/') ? editorial(path.slice(11)) : views[path] ? views[path]() : `<section class="wrap">${emptyState('No encontramos esta página.', 'Vuelve al inicio para seguir explorando.', '<a class="btn" href="#/">Volver al inicio</a>')}</section>`;
  document.querySelectorAll('.desktop-nav a').forEach(a => {
    const selected = a.getAttribute('href').slice(1) === path;
    if (selected) a.setAttribute('aria-current', 'page');else a.removeAttribute('aria-current');
  });
  saveCart();
  enhanceView(main);
  if (focusSelector) document.querySelector(focusSelector)?.focus({ preventScroll: true });
  document.title = path.startsWith('/admin') ? `${adminSections.find(([key]) => key === state.tab)?.[1] || 'Administración'} · Bacatá` : 'Relojería Bacatá — Tiempo que se siente';
}
function loading() {
  main.innerHTML = '<section class="wrap loading-state" role="status" aria-label="Cargando selección"><span class="eyebrow">BACATÁ</span><div class="skeleton skeleton-title"></div><div class="skeleton-grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div><p>Preparando la selección…</p></section>';
}
async function route() {
  clearTimeout(paymentPoll);
  const sequence = ++routeSequence;
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  clearTimeout(toast.timer);
  toastEl.classList.remove('on');
  loading();
  try {
    const {
      path,
      query
    } = currentRoute();
    if (path === '/catalogo' && query.size) {
      Object.keys(state.filters).forEach(key => state.filters[key] = query.get(key) || '');
      state.catalogSort = ['price-asc', 'price-desc', 'brand'].includes(query.get('sort')) ? query.get('sort') : 'selection';
    }
    if (path === '/catalogo' && query.has('collection')) {
      const collection = query.get('collection');
      if (collection === 'automaticos') state.filters.q = 'automático';
      if (collection === 'diario') state.filters.q = '';
    }
    if (path.startsWith('/admin')) {
      const section = path.slice('/admin/'.length);
      if (adminSections.some(([key]) => key === section)) state.tab = section;
      state.selected = null;
      const session = await api('/api/admin/session');
      const data = session.authenticated ? await api('/api/admin/overview') : null;
      if (sequence !== routeSequence) return;
      state.admin = data;
      if (data) { state.commercial = data.commercial; state.paymentConfig = data.payments; }
      if (data && state.tab === 'pedidos') {
        state.selectedOrder = null;
        await loadOrders();
        if (sequence !== routeSequence) return;
      }
    } else {
      const [data, profile, payments] = await Promise.all([api('/api/products'), api('/api/commercial'), api('/api/payments/config')]);
      if (sequence !== routeSequence) return;
      state.products = normalizeProducts(data.products);
      state.commercial = profile.commercial;
      state.paymentConfig = payments;
      if (path === '/pago') {
        await refreshPayment();
        if (sequence !== routeSequence) return;
      }
    }
    render();
    if (path === '/pago') pollPayment(sequence);
    scrollTo(0, 0);
    enterView(main);
    main.focus({
      preventScroll: true
    });
  } catch (error) {
    if (sequence !== routeSequence) return;
    main.innerHTML = `<section class="wrap">${emptyState('La selección no pudo cargarse.', error.message, '<button class="btn" data-action="retry">Reintentar</button>')}</section>`;
  }
}
function paymentToken() {
  return currentRoute().query.get('token') || new URLSearchParams(location.search).get('token') || '';
}
async function refreshPayment() {
  state.paymentError = '';
  const token = paymentToken();
  const source = new URLSearchParams(location.search);
  const transaction = source.get('token') === token ? source.get('id') : '';
  if (transaction) {
    try { await request('/api/payments/' + encodeURIComponent(token) + '/verify','POST',{transaction_id:transaction}); }
    catch(error) { state.paymentError = error.message; }
  }
  state.paymentResult = (await api('/api/payments/' + encodeURIComponent(token))).payment;
  const status = state.paymentResult.status;
  if (status !== 'PENDING') {
    let checkout;
    try { checkout = JSON.parse(sessionStorage.getItem('bacata-checkout') || 'null'); } catch {}
    if (status === 'APPROVED' && checkout?.token === token && checkout?.cart === JSON.stringify(Object.entries(state.cart).map(([id,quantity])=>({id,quantity})))) {
      state.cart = {}; saveCart();
    }
    if (checkout?.token === token) {
      try { sessionStorage.removeItem('bacata-checkout'); } catch {}
    }
  }
}
function pollPayment(sequence, attempt = 0) {
  if (state.paymentResult?.status !== 'PENDING' || attempt >= 8) return;
  paymentPoll = setTimeout(async () => {
    if (sequence !== routeSequence || currentRoute().path !== '/pago') return;
    try { await refreshPayment(); } catch(error) { state.paymentError = error.message; }
    if (sequence !== routeSequence || currentRoute().path !== '/pago') return;
    render(); pollPayment(sequence, attempt + 1);
  }, 15000);
}
function saveDestination() {
  try { sessionStorage.setItem('bacata-destination',JSON.stringify(state.shippingDestination)); } catch {}
}
function checkoutKey(items, destination, total, customer) {
  const cart = JSON.stringify(items);
  // La clave de reintento no guarda contacto ni dirección en el navegador.
  const context = JSON.stringify({destination,total});
  let existing;
  try { existing = JSON.parse(sessionStorage.getItem('bacata-checkout') || 'null'); } catch {}
  if (existing?.cart === cart && existing?.context === context && /^[a-f0-9]{64}$/.test(existing.key)) return existing.key;
  const key = [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
  try { sessionStorage.setItem('bacata-checkout',JSON.stringify({cart,key,context})); } catch {}
  return key;
}
async function refreshStorePrices() {
  const [products,profile]=await Promise.all([api('/api/products'),api('/api/commercial')]);
  state.products=normalizeProducts(products.products);state.commercial=profile.commercial;
}
async function loadOrders() {
  const query = new URLSearchParams(state.orderFilter);
  const data = await api('/api/admin/orders?' + query.toString());
  state.orderList = data;
  state.orderFilter.page = data.page;
}
async function refresh() {
  const [products, operations] = await Promise.all([api('/api/products'), api('/api/admin/overview')]);
  state.products = normalizeProducts(products.products);
  state.admin = operations;
  state.commercial = operations.commercial;
  state.paymentConfig = operations.payments;
  if (state.tab === 'pedidos') await loadOrders();
  render();
}
function openDialog(id) {
  document.querySelector(id).showModal();
}
function fileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(Error('No se pudo leer el archivo'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
}
async function download(path, data, name) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json();
    throw Error(error.error || 'No se pudo exportar');
  }
  const url = URL.createObjectURL(await response.blob()),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function act(button) {
  const {
    action,
    id
  } = button.dataset;
  switch (action) {
    case 'theme':
      toggleTheme();
      return;
    case 'admin-shortcut':
      if (button.dataset.tab === 'publicaciones') {
        state.publicationFilter = { ...state.publicationFilter, query: '', brand: '', status: button.dataset.status || '' };
        state.publicationPage = 0;
      } else if (button.dataset.tab === 'oportunidades') {
        state.adminQuery = '';
        state.adminStatus = button.dataset.status || '';
        state.opportunityFilter = 'all';
        state.adminPage = 0;
      }
      // Falls through to section navigation. No publication operation is performed.
    case 'tab':
      clearTimeout(toast.timer);
      toastEl.classList.remove('on');
      state.tab = button.dataset.tab;
      state.selected = null;
      history.pushState(null, '', `#/admin/${state.tab}`);
      if (state.tab === 'pedidos') { state.selectedOrder = null; await loadOrders(); }
      render();
      document.querySelector('#admin-tabpanel')?.focus({ preventScroll: true });
      enterView(document.querySelector('#admin-tabpanel'));
      return;
    case 'order-manage':
      document.querySelector('.fulfillment-layout')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
      document.querySelector('#fulfillment-form [name=status]')?.focus({preventScroll:true});
      return;
    case 'order-open':
      state.selectedOrder = (await api('/api/admin/orders/' + encodeURIComponent(id))).order;
      render();
      document.querySelector('#order-review-form')?.focus({ preventScroll: true });
      return;
    case 'order-back':
      state.selectedOrder = null; await loadOrders(); render(); return;
    case 'order-clear':
      state.orderFilter = { q:'', status:'', page:1 }; await loadOrders(); render(); return;
    case 'order-status-filter':
      state.orderFilter = { q:'', status:button.dataset.status, page:1 }; await loadOrders(); render(); return;
    case 'order-page':
      state.orderFilter.page += Number(button.dataset.delta); await loadOrders(); render(); return;
    case 'remove-filter':
      if (button.dataset.filterKey in state.filters) state.filters[button.dataset.filterKey] = '';
      syncCatalogLocation();
      render();
      document.querySelector('#search')?.focus({ preventScroll: true });
      return;
    case 'field-history':
      {
        const result = await api(`/api/admin/products/${encodeURIComponent(id)}/history`);
        document.querySelector('#field-history').innerHTML = result.history.map(h => `<div><strong>${esc(h.field)}</strong>: ${esc(JSON.parse(h.value_json))}<small>${esc(h.method)} · ${esc(h.created_at)} · ${esc(h.source_url || 'Edición administrativa')}</small></div>`).join('') || '<p>Aún no hay datos de procedencia registrados.</p>';
        return;
      }
    case 'select-opportunities':
      filteredOpportunities().forEach(p => state.opportunitySelection.add(p.id));
      render();
      return;
    case 'clear-opportunities':
      state.opportunitySelection.clear();
      render();
      return;
    case 'select-publications':
      filteredPublications().forEach(p => state.publicationSelection.add(p.id));
      render();
      return;
    case 'clear-publications':
      state.publicationSelection.clear();
      render();
      return;
    case 'publication-page':
      state.publicationPage += Number(button.dataset.delta);
      render();
      return;
    case 'export-opportunities':
      return download('/api/admin/catalog/export', {
        ids: state.opportunitySelection.size ? [...state.opportunitySelection] : filteredOpportunities().map(p => p.id)
      }, 'plantilla-fichas.xlsx');
    case 'export-import':
      return download('/api/admin/catalog/export', {
        token: state.importPreview.token,
        selection: state.importSelection.size ? [...state.importSelection] : filteredPreview().filter(r => r.reference && r.brand).map(r => r.index)
      }, 'plantilla-fichas.xlsx');
    case 'export-publications':
      return download('/api/admin/publications/export', {
        ids: state.publicationSelection.size ? [...state.publicationSelection] : filteredPublications().map(p => p.id)
      }, 'publicaciones.xlsx');
    case 'export-pending':
      return download('/api/admin/catalog/pending', {
        token: state.catalogResult.report_token
      }, 'pendientes-fichas.xlsx');
    case 'commit-catalog':
      state.catalogResult = await request('/api/admin/catalog/commit', 'POST', {
        token: state.catalogPreview.token
      });
      state.catalogPreview = null;
      await refresh();
      toast('Fichas guardadas. Revisa el resumen de publicación.');
      return;
    case 'publication-action':
      {
        const result = await request('/api/admin/publications/action', 'POST', {
          ids: id ? [id] : [...state.publicationSelection],
          action: button.dataset.command
        });
        await refresh();
        toast(`${result.results.filter(r => r.ok).length} actualizadas. ${result.results.filter(r => !r.ok).map(r => r.id + ': ' + r.issues.join('; ')).join(' · ')}`);
        return;
      }
    case 'select-import':
      filteredPreview().filter(r => !r.errors.length).forEach(r => state.importSelection.add(r.index));
      render();
      return;
    case 'clear-import':
      state.importSelection.clear();
      render();
      return;
    case 'import-page':
      state.importPage += Number(button.dataset.delta);
      render();
      return;
    case 'admin-page':
      state.adminPage += Number(button.dataset.delta);
      render();
      return;
    case 'commit-import':
      {
        const result = await request('/api/admin/inventory/commit', 'POST', {
          token: state.importPreview.token,
          selection: [...state.importSelection]
        });
        state.importPreview = null;
        state.importSelection.clear();
        state.tab = 'oportunidades';
        history.replaceState(null, '', '#/admin/oportunidades');
        state.adminPage = 0;
        state.adminQuery = '';
        state.adminStatus = '';
        await refresh();
        toast(`${result.created} nuevas, ${result.updated} actualizadas y ${result.paused} pausadas.`);
        return;
      }
    case 'retry':
      return route();
    case 'search':
      openDialog('#search-dialog');
      return;
    case 'menu':
      openDialog('#menu-dialog');
      return;
    case 'close-dialog':
      button.closest('dialog').close();
      return;
    case 'add':
      {
        const p = state.products.find(p => p.id === id);
        if (!p || !(p.price_cop > 0)) throw Error('Esta referencia no está disponible.');
        const quantity = state.cart[id] || 0;
        if (quantity >= 10) throw Error('Ya alcanzaste la límite de 10 piezas por solicitud.');
        state.cart[id] = quantity + 1;
        saveCart();
        toast('Pieza añadida a tu bolsa.', '#/carrito');
        return;
      }
    case 'remove':
      delete state.cart[id];
      render();
      return;
    case 'clear-filters':
      Object.keys(state.filters).forEach(k => state.filters[k] = '');
      syncCatalogLocation();
      render();
      return;
    case 'review':
      state.selected = id;
      render();
      main.focus({
        preventScroll: true
      });
      return;
    case 'back':
      state.selected = null;
      render();
      return;
    case 'logout':
      await request('/api/admin/logout', 'POST', {});
      state.admin = null;
      render();
      return;
    case 'zoom':
      {
        const p = state.products.find(x => x.id === id);
        const selectedImage = document.querySelector('.gallery-main img')?.src;
        document.querySelector('#zoom-content').innerHTML = `<div class="art">${art(selectedImage ? {
          ...p,
          image_url: selectedImage
        } : p)}</div><p>${esc(p.brand)} ${esc(p.name)} · ${esc(p.reference)}</p>`;
        openDialog('#image-dialog');
        return;
      }
    case 'gallery':
      {
        const url = safeImage(button.dataset.image);
        if (!url) throw Error('Imagen no disponible.');
        document.querySelector('.gallery-main').innerHTML = `<img src="${esc(url)}" alt="Vista seleccionada del reloj" width="640" height="640">`;
        document.querySelectorAll('.gallery-thumbs button').forEach(b => b.setAttribute('aria-pressed', b === button));
        return;
      }
    case 'payment-refresh':
      await refreshPayment(); render(); return;

  }
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.busy) return;
  button.dataset.busy = 'true';
  const wasDisabled = button.disabled;
  if (['publication-action', 'pay', 'payment-refresh', 'order', 'logout', 'commit-import', 'commit-catalog'].includes(button.dataset.action)) button.disabled = true;
  try {
    await act(button);
  } catch (error) {
    toast(error.message);
  } finally {
    delete button.dataset.busy;
    button.disabled = wasDisabled;
  }
});
document.addEventListener('change', async event => {
  const input = event.target;
  if(input.closest('#checkout-form') && input.name==='department'){state.checkoutDraft.department=input.value;state.checkoutDraft.city=input.value==='Bogotá D.C.'?'Bogotá':'';render();document.querySelector('#checkout-form [name=city]')?.focus();return;}
  if (input.id === 'shipping-zone') { state.shippingDestination={zone:input.value,city:input.value==='bogota'?'Bogotá':''};saveDestination();render();document.querySelector('#shipping-city')?.focus();return; }
  if (input.id === 'shipping-city') {state.shippingDestination.city=input.value;saveDestination();return;}
  if (input.id === 'catalog-sort') {
    state.catalogSort = input.value;
    syncCatalogLocation();
    render();
    return;
  }
  if (input.dataset.opportunityId) {
    if (input.checked) state.opportunitySelection.add(input.dataset.opportunityId);else state.opportunitySelection.delete(input.dataset.opportunityId);
    render();
    return;
  }
  if (input.dataset.publicationId) {
    if (input.checked) state.publicationSelection.add(input.dataset.publicationId);else state.publicationSelection.delete(input.dataset.publicationId);
    render();
    return;
  }
  if (input.dataset.importIndex !== undefined) {
    const index = Number(input.dataset.importIndex);
    if (input.checked) state.importSelection.add(index);else state.importSelection.delete(index);
    render();
    return;
  }
  if (input.dataset.upload) {
    const uploadForm = input.closest('form');
    if (uploadForm.dataset.uploading) {
      toast('Espera a que termine la carga de fotografías.');
      input.value = '';
      return;
    }
    uploadForm.dataset.uploading = 'true';
    input.disabled = true;
    try {
      const form = input.closest('form'),
        files = [...input.files];
      const additional = form.elements.images.value.split('\n').map(x => x.trim()).filter(Boolean);
      if (input.dataset.upload === 'gallery' && additional.length + files.length > 8) throw Error('Máximo ocho fotos adicionales');
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) throw Error('Cada foto debe pesar máximo 5 MB');
        const result = await request('/api/admin/images', 'POST', {
          base64: await fileBase64(file)
        });
        if (input.dataset.upload === 'main') {
          form.elements.image_url.value = result.url;
          document.querySelector('#editor-image-preview').innerHTML = `<img src="${esc(result.url)}" alt="Nueva fotografía principal">`;
        } else {
          additional.push(result.url);
          form.elements.images.value = additional.join('\n');
        }
      }
      toast('Fotografías subidas. Guarda la ficha para vincularlas.');
    } catch (e) {
      toast(e.message);
    } finally {
      delete uploadForm.dataset.uploading;
      input.disabled = false;
      input.value = '';
    }
    return;
  }
  if (input.id === 'brand' || input.dataset.filter) {
    state.filters[input.id === 'brand' ? 'brand' : input.dataset.filter] = input.value;
    syncCatalogLocation();
    const selector = input.id === 'brand' ? '#brand' : `[data-filter="${input.dataset.filter}"]`;
    render();
    document.querySelector(selector)?.focus();
  }
  if (input.dataset.qty) {
    const n = Number(input.value);
    const p = state.products.find(p => p.id === input.dataset.qty);
    if (!Number.isInteger(n) || n < 1 || n > (p ? 10 : 0)) {
      toast('Cantidad inválida (1 a 10).');
      render();
      return;
    }
    state.cart[input.dataset.qty] = n;
    render();
  }
});
document.addEventListener('input', event => {
  if(event.target.closest('#checkout-form') && Object.hasOwn(state.checkoutDraft,event.target.name)){state.checkoutDraft[event.target.name]=event.target.value;return;}
  if(event.target.id === 'shipping-city') {state.shippingDestination.city=event.target.value;saveDestination();return;}
  if (event.target.id !== 'search') return;
  const position = event.target.selectionStart;
  state.filters.q = event.target.value;
  syncCatalogLocation();
  render();
  const input = document.querySelector('#search');
  input.focus();
  input.setSelectionRange(position, position);
});
document.addEventListener('submit', async event => {
  const form = event.target;
  if (!['login', 'checkout-form', 'order-filter', 'order-review-form', 'fulfillment-form', 'commercial-form', 'settings-form', 'product-form', 'global-search', 'inventory-form', 'preview-filter', 'admin-filter', 'catalog-form', 'publication-filter'].includes(form.id)) return;
  event.preventDefault();
  if (form.dataset.uploading) {
    toast('Espera a que termine la carga de fotografías antes de guardar.');
    return;
  }
  const submit = form.querySelector('button[type="submit"], button:not([type])');
  if (submit?.disabled) return;
  if (submit) submit.disabled = true;
  try {
    if (form.id === 'catalog-form') {
      const file = form.elements.file.files[0];
      if (!file || file.size > 15 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.xlsx')) throw Error('Selecciona un XLSX de máximo 15 MB');
      state.catalogPreview = await api('/api/admin/catalog/preview', {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream'
        },
        body: await fileBase64(file)
      });
      state.catalogResult = null;
      render();
    }
    if (form.id === 'publication-filter') {
      state.publicationFilter = Object.fromEntries(new FormData(form));
      state.publicationPage = 0;
      render();
    }
    if (form.id === 'inventory-form') {
      const file = form.elements.file.files[0];
      if (!file || file.size > 15 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.xlsx')) throw Error('Selecciona un XLSX de máximo 15 MB');
      state.importPreview = await api('/api/admin/inventory/preview', {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream'
        },
        body: await fileBase64(file)
      });
      state.importSelection.clear();
      state.importPage = 0;
      state.importFilter = 'launch';
      state.importQuery = '';
      render();
      toast('Vista previa lista. El catálogo todavía no ha cambiado.');
    }
    if (form.id === 'preview-filter') {
      state.importFilter = form.elements.group.value;
      state.importQuery = form.elements.query.value.trim();
      state.importPage = 0;
      render();
    }
    if (form.id === 'admin-filter') {
      state.adminQuery = form.elements.query.value.trim();
      state.adminStatus = form.elements.status.value;
      state.opportunityFilter = form.elements.group.value;
      state.adminPage = 0;
      render();
    }
    if (form.id === 'global-search') {
      state.filters.q = form.elements.query.value.trim();
      document.querySelector('#search-dialog').close();
      if (currentRoute().path === '/catalogo') { syncCatalogLocation(); render(); } else {
        const query = new URLSearchParams({ q: state.filters.q });
        location.hash = '#/catalogo?' + query.toString();
      }
    }
    if (form.id === 'login') {
      await request('/api/admin/login', 'POST', Object.fromEntries(new FormData(form)));
      state.admin = await api('/api/admin/overview');
      state.commercial = state.admin.commercial;
      state.paymentConfig = state.admin.payments;
      if (state.tab === 'pedidos') await loadOrders();
      render();
    }
    if (form.id === 'checkout-form') {
      const fields=Object.fromEntries(new FormData(form));
      const customer=validateCustomer(Object.fromEntries(Object.keys(state.checkoutDraft).map(key=>[key,fields[key] || ''])));
      state.checkoutDraft={...customer};
      if(!form.elements.accepted.checked || !form.elements.privacy_accepted.checked)throw Error('Acepta los términos y autoriza el tratamiento de datos para gestionar el pedido');
      const items=Object.entries(state.cart).map(([id,quantity])=>({id,quantity}));
      const destination=customerDestination(customer);
      const quote=await request('/api/shipping/quote','POST',{items,destination});
      const estimate=state.products.reduce((sum,p)=>sum+p.price_cop*(state.cart[p.id] || 0),0)+shippingEstimate(destination.zone,state.commercial);
      if(quote.total_cop!==estimate){await refreshStorePrices();render();toast('El total cambió. Revisa el resumen y acepta de nuevo antes de continuar.');return;}
      const data={items,destination,customer,accepted:true,privacy_accepted:true,expected_total_cop:quote.total_cop};
      if(state.paymentConfig.enabled) {
        data.idempotency_key=checkoutKey(items,destination,quote.total_cop,customer);
        let result;
        try {result=await request('/api/payments/checkout','POST',data);}
        catch(error){
          if(error.code==='quote_changed'){await refreshStorePrices();render();toast(error.message);return;}
          let prior;try{prior=JSON.parse(sessionStorage.getItem('bacata-checkout') || 'null');}catch{}
          if(error.status===409&&/^[a-f0-9]{64}$/.test(prior?.token || '')){location.hash='#/pago?token='+prior.token;return;}
          throw error;
        }
        try{const previous=JSON.parse(sessionStorage.getItem('bacata-checkout') || '{}');sessionStorage.setItem('bacata-checkout',JSON.stringify({...previous,token:result.token}));}catch{}
        const url=new URL(result.checkout_url);if(url.origin!=='https://checkout.wompi.co')throw Error('Dirección de pago inválida');
        location.assign(url.href);
      }else{
        const result=await request('/api/orders','POST',data);
        state.cart={};saveCart();
        main.innerHTML=`<section class="wrap confirmation">${checkoutSteps(3)}<span class="eyebrow">SOLICITUD DE PRUEBA RECIBIDA</span><h1>Tu selección,<br>con seguimiento.</h1><div class="panel"><strong>${esc(result.id)}</strong><p>Total: ${money(result.total_cop)}</p><p>La pasarela está desactivada. No se procesó un pago ni se reservó inventario.</p></div><a class="btn" href="#/catalogo">Seguir explorando</a></section>`;
        scrollTo(0,0);main.focus({preventScroll:true});
      }
    }
    if (form.id === 'order-filter') {
      state.orderFilter = { ...Object.fromEntries(new FormData(form)), page:1 };
      await loadOrders(); render();
    }
    if(form.id === 'fulfillment-form') {
      const data={...Object.fromEntries(new FormData(form)),version:Number(form.dataset.version),simulate:form.elements.simulate.type==='checkbox' && form.elements.simulate.checked};
      state.selectedOrder=(await request('/api/admin/orders/'+encodeURIComponent(form.dataset.id)+'/fulfillment','PATCH',data)).order;
      await refresh();toast('Gestión del pedido guardada.');
    }
    if (form.id === 'order-review-form') {
      const data = { ...Object.fromEntries(new FormData(form)), version:Number(form.dataset.version) };
      state.selectedOrder = (await request('/api/admin/orders/' + encodeURIComponent(form.dataset.id), 'PATCH', data)).order;
      await refresh(); toast('Seguimiento guardado.');
    }
    if (form.id === 'commercial-form') {
      const data = Object.fromEntries(new FormData(form));
      data.provisional = form.elements.provisional.checked;
      await request('/api/admin/commercial', 'PUT', data);
      await refresh();
      toast('Información comercial guardada.');
    }
    if (form.id === 'settings-form') {
      const data = Object.fromEntries(new FormData(form));
      for (const key of ['duty', 'fee', 'logistics_rate', 'discount', 'min_margin']) data[key] = Number(data[key]) / 100;
      data.fx = Number(data.fx);
      await request('/api/admin/settings', 'PUT', data);
      await refresh();
      toast('Reglas guardadas.');
    }
    if (form.id === 'product-form') {
      const data = Object.fromEntries(new FormData(form));
      for (const key of ['approved_price_cop', 'diameter_mm']) if (key in data) data[key] = data[key] === '' && ['approved_price_cop', 'diameter_mm'].includes(key) ? null : Number(data[key]);
      data.images = data.images.split('\n').map(x => x.trim()).filter(Boolean);
      await request(`/api/admin/products/${encodeURIComponent(form.dataset.id)}`, 'PATCH', data);
      await refresh();
      toast('Ficha actualizada.');
    }
  } catch (error) {
    toast(error.message);
  } finally {
    if (submit) submit.disabled = false;
  }
});
document.addEventListener('keydown', async event => {
  const tab = event.target.closest('.tabs [role="tab"]');
  if (!tab || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
  let index = tabs.indexOf(tab);
  index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + tabs.length) % tabs.length;
  const next = tabs[index];
  const key = next.dataset.tab;
  state.tab = key;
  state.selected = null;
  history.replaceState(null, '', `#/admin/${key}`);
  if (key === 'pedidos') {
    state.selectedOrder = null;
    try { await loadOrders(); } catch (error) { toast(error.message); }
    if (state.tab !== key) return;
  }
  render();
  document.querySelector(`.tabs [data-tab="${key}"]`).focus();
});
addEventListener('hashchange', route);
saveCart();
if (location.pathname === '/pago') history.replaceState(null,'',location.pathname + location.search + '#/pago');
route();

// Campaigns expire automatically even when the homepage remains open.
let campaignKey = activeCampaign()?.theme || '';
setInterval(() => {
  const nextKey = activeCampaign()?.theme || '';
  if (nextKey !== campaignKey) {
    campaignKey = nextKey;
    if (currentRoute().path === '/') render();
  }
}, 60000);

// Visible image failure state; do not silently substitute another product.
document.addEventListener('error', event => {
  if (event.target instanceof HTMLImageElement && event.target.closest('.art')) {
    const container = event.target.closest('.art');
    container.innerHTML = '<span class="image-error">Imagen no disponible. Consulta la referencia antes de decidir.</span>';
  }
}, true);
