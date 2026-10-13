import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contact, conditions, warranty, whatsappLink } from '../public/js/views/store.js';
test('commercial contact preserves reference text safely and keeps supplier warranty distinct', () => {
  const reference = 'REF <img src=x onerror=alert(1)> & azul';
  const view = contact(reference);
  assert.ok(view.includes('&lt;img'));
  assert.ok(!view.includes('<img src=x'));
  const url = new URL(whatsappLink(reference));
  assert.equal(url.pathname, '/573246871623');
  assert.equal(url.searchParams.get('text'), reference);
  assert.ok(!view.includes('canal comercial está pendiente'));
  assert.ok(conditions().includes('sin cobros ni reservas'));
  assert.ok(warranty().includes('no reemplaza la garantía legal'));
});
