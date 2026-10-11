import { test } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../public/js/state.js';
import { admin, filteredOpportunities } from '../public/js/views/admin.js';
import { filteredPublications } from '../public/js/views/publications.js';
import { filteredPreview } from '../public/js/views/inventory.js';
import { detail } from '../public/js/views/store.js';
const products = Array.from({
  length: 55
}, (_, i) => ({
  id: `p-${i}`,
  brand: i % 2 ? 'Bulova' : 'Tissot',
  reference: `REF-${i}`,
  name: `Nombre ${i}`,
  effective_status: 'published',
  status: 'published',
  published_at: '2026-10-11',
  last_confirmed_at: '2026-10-11',
  pause_reason: '',
  publication_issues: [],
  images: ['https://example.com/back.webp', 'https://example.com/side.webp'],
  image_url: 'https://example.com/main.webp',
  delivery_days: '5 a 10 días hábiles',
  warranty: '12 meses',
  shipping_terms: 'Envío nacional',
  price_cop: 3000000,
  source: {
    availability: 'In Stock.'
  },
  analysis: {
    price_usd: 100,
    shipping_usd: 35,
    fx: 4000,
    supplier: 400000,
    shipping: 140000,
    importCost: 108000,
    commission: 105000,
    buffer: 0,
    cost: 753000,
    price: 3000000,
    suggested: 3000000,
    profit: 2247000,
    margin: .749,
    comparable: true,
    eligible: true
  }
}));
test('admin filters retain all pages, selection survives paging, and the four new screens render', () => {
  state.admin = {
    products,
    settings: {
      fx: 4000,
      duty: .2,
      fee: .035,
      logistics_rate: 0,
      discount: .03,
      min_margin: .1,
      delivery_days: '5 a 10 días hábiles',
      warranty: '12 meses',
      shipping_terms: 'Envío'
    },
    orders: [],
    audit: []
  };
  state.tab = 'oportunidades';
  assert.equal(filteredOpportunities().length, 55);
  let html = admin();
  assert.equal((html.match(/data-opportunity-id=/g) || []).length, 50);
  state.opportunitySelection.add('p-0');
  state.opportunitySelection.add('p-54');
  state.adminPage = 1;
  html = admin();
  assert.equal((html.match(/data-opportunity-id=/g) || []).length, 5);
  assert.match(html, /data-opportunity-id="p-54"[^>]*checked/);
  assert.equal(state.opportunitySelection.size, 2);
  assert.equal(filteredOpportunities().length, 55);
  state.tab = 'publicaciones';
  assert.equal(filteredPublications().length, 55);
  state.publicationFilter.status = 'requires_confirmation';
  assert.equal(filteredPublications().length, 0);
  state.publicationFilter.status = '';
  state.publicationFilter.brand = 'Bulova';
  assert.equal(filteredPublications().length, 27);
  state.publicationFilter.brand = '';
  assert.match(admin(), /Confirmar selección/);
  state.tab = 'inventario';
  state.importPreview = {
    token: 'test',
    expires_at: new Date(Date.now() + 60000).toISOString(),
    summary: {
      total: 55,
      create: 55,
      update: 0,
      blocked: 0
    },
    duplicates: 0,
    formula_errors: 0,
    global_settings: {
      fx: 4000
    },
    records: products.map((p, index) => ({
      index,
      brand: p.brand,
      reference: p.reference,
      sheet: 'Base comparada',
      row: index + 6,
      group: 'high',
      availability: 'In Stock.',
      date: '2026-10-11',
      analysis: p.analysis,
      warnings: [],
      errors: [],
      action: 'create'
    }))
  };
  assert.equal(filteredPreview().length, 55);
  assert.match(admin(), /Exportar plantilla de fichas/);
  state.tab = 'fichas';
  assert.match(admin(), /Analizar fichas/);
  state.tab = 'reglas';
  assert.match(admin(), /Colchón logístico \(%\)/);
  state.selected = 'p-0';
  assert.match(admin(), /Análisis de rentabilidad/);
  assert.match(admin(), /Subir foto principal/);
  assert.doesNotMatch(admin(), /Existencias propias|Importación bajo pedido|confirm_supplier/);
});
test('public detail includes all three photos and global delivery with no stock counts or costs', () => {
  globalThis.location = {
    href: 'http://localhost/'
  };
  state.products = products;
  const html = detail('p-0');
  assert.equal((html.match(/data-action="gallery"/g) || []).length, 3);
  assert.match(html, /5 a 10 días hábiles/);
  assert.match(html, /data-action="add"/);
  assert.doesNotMatch(html, /unidades|Existencias propias|Análisis de rentabilidad/);
});
