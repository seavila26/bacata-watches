import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commercialView } from '../public/js/views/commercial.js';
import { commercialDefaults, validateCommercial } from '../public/js/commercial-model.js';
import { state } from '../public/js/state.js';
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

test('commercial form renders saved values safely and rejects malformed or incomplete final profiles', () => {
  assert.throws(() => validateCommercial({ ...commercialDefaults, email:'invalid' }), /Correo/);
  assert.throws(() => validateCommercial({ ...commercialDefaults, whatsapp:'javascript:1234' }), /WhatsApp/);
  assert.throws(() => validateCommercial({ ...commercialDefaults, provisional:false }), /identidad legal/);
  const saved = { ...commercialDefaults, warranty:'Línea 1\n<script>alert(1)</script>' };
  const previous = state.commercial;
  try {
    state.commercial = saved;
    assert.ok(conditions().includes('&lt;script&gt;'));
    assert.ok(!conditions().includes('<script>'));
    const form = commercialView(saved);
    assert.ok(form.includes('id="commercial-form"'));
    assert.ok(form.includes('&lt;script&gt;'));
  } finally { state.commercial = previous; }
});
