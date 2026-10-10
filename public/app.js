/** Entry point. Routing and events only; templates live in js/views. */
import { state } from './js/state.js';
import { api, request, normalizeProducts } from './js/api.js';
import { money, escapeHtml as esc, safeImage } from './js/utils.js';
import { art, emptyState } from './js/components.js';
import { home, catalog, detail, cart, brands, principles, editorial, contact, conditions } from './js/views/store.js';
import { activeCampaign } from './js/config.js';
import {filteredBulkProducts} from './js/views/catalog-bulk.js';
import {filteredPreview} from './js/views/inventory.js';
import { admin } from './js/views/admin.js';
const main = document.querySelector('#main');
const toastEl = document.querySelector('#toast');
let routeSequence = 0;
function toast(message) {
  toastEl.textContent = message;
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
function render() {
  const {
    path,
    query
  } = currentRoute();
  document.body.classList.toggle('is-admin', path.startsWith('/admin'));
  const views = {
    '/': home,
    '/catalogo': catalog,
    '/carrito': cart,
    '/marcas': brands,
    '/como-elegimos': principles,
    '/editorial': editorial,
    '/contacto': () => contact(query.get('reference') || ''),
    '/condiciones': conditions
  };
  main.innerHTML = path.startsWith('/admin') ? admin() : path.startsWith('/reloj/') ? detail(path.slice(7)) : path.startsWith('/editorial/') ? editorial(path.slice(11)) : views[path] ? views[path]() : `<section class="wrap">${emptyState('No encontramos esta página.', 'Vuelve al inicio para seguir explorando.', '<a class="btn" href="#/">Volver al inicio</a>')}</section>`;
  document.querySelectorAll('.desktop-nav a').forEach(a => {
    const selected = a.getAttribute('href').slice(1) === path;
    if (selected) a.setAttribute('aria-current', 'page');else a.removeAttribute('aria-current');
  });
  saveCart();
}
function loading() {
  main.innerHTML = '<section class="wrap loading-state" role="status" aria-label="Cargando selección"><span class="eyebrow">BACATÁ</span><div class="skeleton skeleton-title"></div><div class="skeleton-grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div><p>Preparando la selección…</p></section>';
}
async function route() {
  const sequence = ++routeSequence;
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  loading();
  try {
    const {
      path,
      query
    } = currentRoute();
    if (path === '/catalogo' && query.has('brand')) state.filters.brand = query.get('brand');
    if (path === '/catalogo' && query.has('collection')) {
      const collection = query.get('collection');
      if (collection === 'automaticos') state.filters.q = 'automático';
      if (collection === 'diario') state.filters.q = '';
    }
    if (path.startsWith('/admin')) {
      const session = await api('/api/admin/session');
      const data = session.authenticated ? await api('/api/admin/overview') : null;
      if (sequence !== routeSequence) return;
      state.admin = data;
    } else {
      const data = await api('/api/products');
      if (sequence !== routeSequence) return;
      state.products = normalizeProducts(data.products);
    }
    render();
    scrollTo(0, 0);
    main.focus({
      preventScroll: true
    });
  } catch (error) {
    if (sequence !== routeSequence) return;
    main.innerHTML = `<section class="wrap">${emptyState('La selección no pudo cargarse.', error.message, '<button class="btn" data-action="retry">Reintentar</button>')}</section>`;
  }
}
async function refresh() {
  const [products, operations] = await Promise.all([api('/api/products'), api('/api/admin/overview')]);
  state.products = normalizeProducts(products.products);
  state.admin = operations;
  render();
}
function openDialog(id) {
  document.querySelector(id).showModal();
}
function fileBase64(file) {
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('No se pudo leer el archivo'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file);});
}
async function act(button) {
  const {
    action,
    id
  } = button.dataset;
  switch (action) {
    case 'field-history': {
      const result=await api(`/api/admin/products/${encodeURIComponent(id)}/history`);
      document.querySelector('#field-history').innerHTML=result.history.map(h=>`<div><strong>${esc(h.field)}</strong>: ${esc(JSON.parse(h.value_json))}<small>${esc(h.method)} · ${esc(h.created_at)} · ${esc(h.source_url||'Edición administrativa')}</small></div>`).join('')||'<p>Aún no hay datos de procedencia registrados.</p>';return;
    }
    case 'bulk-select': {
      const ids=filteredBulkProducts().map(p=>p.id);if(new Set([...state.bulkSelection,...ids]).size>250)throw Error('Selecciona un filtro de máximo 250 referencias');
      ids.forEach(id=>state.bulkSelection.add(id));state.bulkPlan=null;render();return;
    }
    case 'bulk-clear': state.bulkSelection.clear();state.bulkPlan=null;render();return;
    case 'bulk-page': state.bulkPage+=Number(button.dataset.delta);render();return;
    case 'proposal-page': state.proposalPage+=Number(button.dataset.delta);render();return;
    case 'proposal-filter': state.proposalFilter=button.dataset.filter;state.proposalPage=0;render();return;
    case 'select-proposals': {
      const proposed=state.admin.bulk.proposals.filter(p=>p.state==='proposed');
      if(proposed.length>250)throw Error('Revisa primero un lote de hasta 250 propuestas');
      proposed.forEach(p=>state.proposalSelection.add(p.id));render();return;
    }
    case 'clear-proposals': state.proposalSelection.clear();render();return;
    case 'bulk-review-product': state.tab='oportunidades';state.selected=id;render();return;
    case 'cancel-enrichment': await request('/api/admin/enrichment/cancel','POST',{id});await refresh();toast('Cancelación solicitada; termina la referencia en curso.');return;
    case 'apply-bulk': {
      const result=await request('/api/admin/bulk/apply','POST',{token:state.bulkPlan.token,publish:button.dataset.publish==='true'});
      state.bulkPlan=null;await refresh();toast(`${result.updated} fichas actualizadas; ${result.published} publicadas; ${result.blocked.length} con pendientes.`);return;
    }
    case 'select-import':
      filteredPreview().filter(r=>!r.errors.length).forEach(r=>state.importSelection.add(r.index));render();return;
    case 'clear-import': state.importSelection.clear();render();return;
    case 'import-page': state.importPage+=Number(button.dataset.delta);render();return;
    case 'admin-page': state.adminPage+=Number(button.dataset.delta);render();return;
    case 'commit-import': {
      const result=await request('/api/admin/inventory/commit','POST',{token:state.importPreview.token,selection:[...state.importSelection]});
      state.importPreview=null;state.importSelection.clear();state.tab='oportunidades';state.adminPage=0;state.adminQuery='';state.adminStatus='';
      await refresh();toast(`${result.created} nuevas, ${result.updated} actualizadas y ${result.paused} pausadas.`);return;
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
        if (!p || p.stock < 1) throw Error('Esta referencia no está disponible.');
        const quantity = state.cart[id] || 0;
        if (quantity >= Math.min(10, p.stock)) throw Error('Ya alcanzaste la disponibilidad mostrada para esta pieza.');
        state.cart[id] = quantity + 1;
        saveCart();
        toast('Pieza añadida a tu bolsa.');
        return;
      }
    case 'remove':
      delete state.cart[id];
      render();
      return;
    case 'clear-filters':
      Object.keys(state.filters).forEach(k => state.filters[k] = '');
      render();
      return;
    case 'tab':
      state.tab = button.dataset.tab;
      state.selected = null;
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
    case 'sync':
      {
        const result = await request('/api/admin/sync', 'POST', {});
        await refresh();
        toast(`${result.imported} referencias sincronizadas.`);
        return;
      }
    case 'status':
      {
        const p = state.admin.products.find(x => x.id === id);
        await request(`/api/admin/products/${encodeURIComponent(id)}/status`, 'PATCH', {status: button.dataset.status});
        await refresh();
        toast('Decisión guardada.');
        return;
      }
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
    case 'order':
      {
        if (!document.querySelector('#accept-terms')?.checked) throw Error('Lee y acepta las condiciones de la demostración para continuar.');
        const items = Object.entries(state.cart).map(([id, quantity]) => ({
          id,
          quantity
        }));
        const result = await request('/api/orders', 'POST', {
          items
        });
        state.cart = {};
        saveCart();
        main.innerHTML = `<section class="wrap confirmation"><span class="eyebrow">SOLICITUD DE PRUEBA RECIBIDA</span><h1>Gracias por<br>elegir Bacatá.</h1><p>Que esta pieza acompañe tus próximos momentos.</p><div class="panel"><strong>${esc(result.id)}</strong><p>Importe estimado: ${money(result.total_cop)}.</p><p>No se procesó un pago ni se reservó inventario.</p></div><a class="btn" href="#/catalogo">Seguir explorando</a></section>`;
        scrollTo(0, 0);
        main.focus({
          preventScroll: true
        });
        return;
      }
  }
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.busy) return;
  button.dataset.busy = 'true';
  const wasDisabled = button.disabled;
  if (['sync', 'status', 'order', 'logout','commit-import','apply-bulk','cancel-enrichment'].includes(button.dataset.action)) button.disabled = true;
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
  if(input.dataset.bulkId) {
    if(input.checked&&state.bulkSelection.size>=250){input.checked=false;toast('Máximo 250 referencias por lote');return;}
    if(input.checked)state.bulkSelection.add(input.dataset.bulkId);else state.bulkSelection.delete(input.dataset.bulkId);state.bulkPlan=null;render();return;
  }
  if(input.dataset.proposalId){if(input.checked)state.proposalSelection.add(input.dataset.proposalId);else state.proposalSelection.delete(input.dataset.proposalId);render();return;}
  if(input.dataset.importIndex!==undefined){const index=Number(input.dataset.importIndex);if(input.checked)state.importSelection.add(index);else state.importSelection.delete(index);render();return;}
  if(input.dataset.upload) {
    const uploadForm=input.closest('form');
    if(uploadForm.dataset.uploading){toast('Espera a que termine la carga de fotografías.');input.value='';return;}
    uploadForm.dataset.uploading='true';input.disabled=true;
    try {
      const form=input.closest('form'),files=[...input.files];
      const additional=form.elements.images.value.split('\n').map(x=>x.trim()).filter(Boolean);
      if(input.dataset.upload==='gallery'&&additional.length+files.length>8)throw Error('Máximo ocho fotos adicionales');
      for(const file of files) {
        if(file.size>5*1024*1024)throw Error('Cada foto debe pesar máximo 5 MB');
        const result=await request('/api/admin/images','POST',{base64:await fileBase64(file)});
        if(input.dataset.upload==='main') {form.elements.image_url.value=result.url;document.querySelector('#editor-image-preview').innerHTML=`<img src="${esc(result.url)}" alt="Nueva fotografía principal">`;}
        else {additional.push(result.url);form.elements.images.value=additional.join('\n');}
      }
      toast('Fotografías subidas. Guarda la ficha para vincularlas.');
    }catch(e){toast(e.message);}finally{delete uploadForm.dataset.uploading;input.disabled=false;input.value='';}
    return;
  }
  if (input.id === 'brand' || input.dataset.filter) {
    state.filters[input.id === 'brand' ? 'brand' : input.dataset.filter] = input.value;
    const selector = input.id === 'brand' ? '#brand' : `[data-filter="${input.dataset.filter}"]`;
    render();
    document.querySelector(selector)?.focus();
  }
  if (input.dataset.qty) {
    const n = Number(input.value);
    const p = state.products.find(p => p.id === input.dataset.qty);
    if (!Number.isInteger(n) || n < 1 || n > Math.min(10, p?.stock || 0)) {
      toast('Cantidad fuera de la disponibilidad mostrada.');
      render();
      return;
    }
    state.cart[input.dataset.qty] = n;
    render();
  }
});
document.addEventListener('input', event => {
  if(event.target.dataset.proposalEdit) {
    const id=event.target.dataset.proposalEdit,key=event.target.dataset.field;
    state.proposalEdits[id]??={};state.proposalEdits[id][key]=key==='diameter_mm'?(event.target.value===''?null:Number(event.target.value)):event.target.value;return;
  }
  if (event.target.id !== 'search') return;
  const position = event.target.selectionStart;
  state.filters.q = event.target.value;
  render();
  const input = document.querySelector('#search');
  input.focus();
  input.setSelectionRange(position, position);
});
document.addEventListener('submit', async event => {
  const form = event.target;
  if (!['login', 'settings-form', 'import-form', 'product-form', 'global-search','inventory-form','preview-filter','admin-filter','bulk-filter','enrichment-form','bulk-plan-form','proposal-review-form','template-form','authorized-catalog-form'].includes(form.id)) return;
  event.preventDefault();
  if(form.dataset.uploading){toast('Espera a que termine la carga de fotografías antes de guardar.');return;}
  const submit = form.querySelector('button[type="submit"], button:not([type])');
  if (submit?.disabled) return;
  if (submit) submit.disabled = true;
  try {
    if(form.id==='bulk-filter'){state.bulkFilter=form.elements.mode.value;state.bulkQuery=form.elements.query.value.trim();state.bulkPage=0;render();}
    if(form.id==='enrichment-form'){
      const ids=[...state.bulkSelection];const scope=event.submitter?.value;
      const result=await request('/api/admin/enrichment/start','POST',{ids:scope==='pilot'?ids.slice(0,10):ids,download_images:form.elements.download_images.checked,use_ai:form.elements.use_ai.checked});
      await refresh();toast(`Lote iniciado: ${result.total} referencias. Puedes seguir trabajando.`);
    }
    if(form.id==='bulk-plan-form'){
      state.bulkPlan=await request('/api/admin/bulk/preview','POST',{ids:[...state.bulkSelection],template_id:form.elements.template_id.value,approve_suggested:form.elements.approve_suggested.checked,overwrite:form.elements.overwrite.checked,confirm_costs:form.elements.confirm_costs.checked,confirm_supplier:form.elements.confirm_supplier.checked});render();
    }
    if(form.id==='proposal-review-form'){
      const ids=[...state.proposalSelection];const edits=Object.fromEntries(ids.filter(id=>state.proposalEdits[id]).map(id=>[id,state.proposalEdits[id]]));
      const result=await request('/api/admin/enrichment/apply','POST',{ids,edits});state.proposalSelection.clear();state.proposalEdits={};state.bulkPlan=null;await refresh();toast(`${result.applied} propuestas aplicadas. Revisa las condiciones antes de publicar.`);
    }
    if(form.id==='template-form'){
      const data=Object.fromEntries(new FormData(form));const name=data.name;delete data.name;
      await request('/api/admin/templates','POST',{name,fields:Object.fromEntries(Object.entries(data).filter(([,v])=>v.trim()))});await refresh();toast('Plantilla guardada.');
    }
    if(form.id==='authorized-catalog-form'){
      const file=form.elements.file.files[0];if(!file||file.size>4*1024*1024)throw Error('Catálogo JSON de máximo 4 MB');
      const records=JSON.parse(await file.text());
      const result=await request('/api/admin/enrichment/catalog','POST',{records:Array.isArray(records)?records:records.records,download_images:form.elements.download_images.checked,use_ai:false});await refresh();toast(`${result.total} propuestas preparadas desde el catálogo.`);
    }
    if(form.id==='inventory-form') {
      const file=form.elements.file.files[0];if(!file||file.size>15*1024*1024||!file.name.toLowerCase().endsWith('.xlsx'))throw Error('Selecciona un XLSX de máximo 15 MB');
      state.importPreview=await api('/api/admin/inventory/preview',{method:'POST',headers:{'content-type':'application/octet-stream'},body:await fileBase64(file)});
      state.importSelection.clear();state.importPage=0;state.importFilter='all';state.importQuery='';render();toast('Vista previa lista. El catálogo todavía no ha cambiado.');
    }
    if(form.id==='preview-filter'){state.importFilter=form.elements.group.value;state.importQuery=form.elements.query.value.trim();state.importPage=0;render();}
    if(form.id==='admin-filter'){state.adminQuery=form.elements.query.value.trim();state.adminStatus=form.elements.status.value;state.adminPage=0;render();}
    if (form.id === 'global-search') {
      state.filters.q = form.elements.query.value.trim();
      document.querySelector('#search-dialog').close();
      if (location.hash === '#/catalogo') render();else location.hash = '#/catalogo';
    }
    if (form.id === 'login') {
      await request('/api/admin/login', 'POST', Object.fromEntries(new FormData(form)));
      state.admin = await api('/api/admin/overview');
      render();
    }
    if (form.id === 'settings-form') {
      const data = Object.fromEntries(new FormData(form));
      data.auto_publish = form.elements.auto_publish.checked;
      await request('/api/admin/settings', 'PUT', data);
      await refresh();
      toast('Reglas guardadas.');
    }
    if (form.id === 'product-form') {
      const data = Object.fromEntries(new FormData(form));
      for(const key of ['market_cop','stock','approved_price_cop','manual_cost_cop','diameter_mm'])if(key in data)data[key]=data[key]===''&&['approved_price_cop','manual_cost_cop','diameter_mm'].includes(key)?null:Number(data[key]);
      data.cost_verified=form.elements.cost_verified.checked;
      if(form.elements.confirm_supplier.checked)data.confirm_supplier=true;else delete data.confirm_supplier;
      data.images=data.images.split('\n').map(x=>x.trim()).filter(Boolean);
      await request(`/api/admin/products/${encodeURIComponent(form.dataset.id)}`, 'PATCH', data);
      await refresh();
      toast('Ficha actualizada.');
    }
    if (form.id === 'import-form') {
      const file = form.elements.file.files[0];
      if (!file || file.size > 5 * 1024 * 1024) throw Error('Selecciona un CSV de máximo 5 MB.');
      const result = await api('/api/admin/import', {
        method: 'POST',
        headers: {
          'content-type': 'text/csv'
        },
        body: await file.text()
      });
      await refresh();
      toast(`${result.imported} referencias importadas.`);
    }
  } catch (error) {
    toast(error.message);
  } finally {
    if (submit) submit.disabled = false;
  }
});
document.addEventListener('keydown', event => {
  const tab = event.target.closest('.tabs [role="tab"]');
  if (!tab || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
  let index = tabs.indexOf(tab);
  index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  const next = tabs[index];
  const key = next.dataset.tab;
  state.tab = key;
  state.selected = null;
  render();
  document.querySelector(`.tabs [data-tab="${key}"]`).focus();
});
addEventListener('hashchange', route);
saveCart();
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

// Refresh operational progress without interrupting an in-progress review edit.
let bulkPolling=false,bulkNeedsRender=false;
setInterval(async()=>{
 if(bulkPolling||document.hidden||state.tab!=='preparar'||!state.admin||!currentRoute().path.startsWith('/admin'))return;
 bulkPolling=true;
 try {
  const data=await api('/api/admin/bulk');
  const changed=JSON.stringify(data)!==JSON.stringify(state.admin.bulk);
  state.admin.bulk=data;
  if(changed)bulkNeedsRender=true;
  if(bulkNeedsRender&&!document.activeElement?.closest('input,textarea,select')){const y=scrollY;render();scrollTo(0,y);bulkNeedsRender=false;}
 }catch(e){if(!state.admin)return;}
 finally{bulkPolling=false;}
},4000);
