import { customerFixture } from './checkout-fixture.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commercialDefaults, validateCommercial } from '../public/js/commercial-model.js';
import { state } from '../public/js/state.js';
import { cart, conditions } from '../public/js/views/store.js';
test('editable shipping tariffs are validated, signed in checkout and preserved in historical orders', async () => {
  const dir=await mkdtemp(join(tmpdir(),'bacata-shipping-'));
  process.env.DB_PATH=join(dir,'test.sqlite');process.env.WOMPI_MODE='disabled';process.env.SEED_DEMO='false';
  const {db}=await import('../src/db.js');
  const {commercialProfile,saveCommercial}=await import('../src/commercial.js');
  const {destination,quoteDelivery,deliveryDetails}=await import('../src/shipping.js');
  const {wompiConfig,createCheckout,paymentState}=await import('../src/wompi.js');
  const config=wompiConfig({WOMPI_MODE:'sandbox',WOMPI_PUBLIC_KEY:'pub_test_fixture',WOMPI_PRIVATE_KEY:'prv_test_fixture',WOMPI_INTEGRITY_SECRET:'test_integrity_fixture',WOMPI_EVENTS_SECRET:'test_events_fixture'});
  try {
    const now=new Date().toISOString();
    db.prepare(`INSERT INTO products(id,identity_key,brand,reference,name,price_usd,market_cop,status,updated_at,last_confirmed_at,published_at,collection,movement,diameter_mm,material,crystal,water_resistance,dial_color,strap,image_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('p1','fixture','Bulova','98B428','Racer',100,2000000,'published',now,now,now,'Racer','Cuarzo',40,'Acero','Zafiro','100 metros','Negro','Acero','https://example.com/watch.webp');
    const items=[{id:'p1',quantity:2}];
    assert.equal(quoteDelivery(items,{zone:'bogota',city:'Bogotá D.C.'}).shipping,0);
    assert.equal(quoteDelivery(items,{zone:'national',city:'Medellín'}).shipping,25000);
    assert.equal(quoteDelivery(items,{zone:'national',city:'Medellín'}).total,3905000);
    assert.throws(()=>destination({zone:'bogota',city:'Soacha'}),e=>e.status===400);
    assert.throws(()=>destination({zone:'national',city:'Bogota'}),e=>e.status===400);
    assert.throws(()=>destination({zone:'national',city:'<script>'}),e=>e.status===400);
    assert.throws(()=>destination({zone:'bogota',shipping_cop:0}),e=>e.status===400);
    for(const invalid of [-1,1.5,'',null,true,1000001,'NaN'])assert.throws(()=>validateCommercial({...commercialDefaults,shipping_national_cop:invalid}),/tarifas/);
    assert.equal(validateCommercial({...commercialDefaults,shipping_national_cop:'35000'}).shipping_national_cop,35000);
    const input={items,accepted:true,customer:{...customerFixture,department:'Antioquia',city:'Medellín'},privacy_accepted:true,idempotency_key:'f'.repeat(64),destination:{zone:'national',city:'Medellín'},expected_total_cop:3905000};
    const first=createCheckout(input,'https://example.com',config);
    assert.equal(new URL(first.checkout_url).searchParams.get('amount-in-cents'),'390500000');
    assert.equal(paymentState(first.token).shipping_cop,25000);
    assert.deepEqual({...deliveryDetails(first.reference)},{zone:'national',city:'Medellín',subtotal_cop:3880000,shipping_cop:25000});
    saveCommercial({...commercialProfile(),shipping_bogota_cop:10000,shipping_national_cop:35000},'admin');
    assert.equal(quoteDelivery(items,{zone:'national',city:'Medellín'}).total,3915000);
    assert.equal(quoteDelivery(items,{zone:'bogota'}).shipping,10000);
    assert.equal(paymentState(first.token).total_cop,3905000);
    assert.equal(paymentState(first.token).shipping_cop,25000);
    assert.equal(db.prepare('SELECT total_cop FROM orders WHERE id=?').get(first.reference).total_cop,3905000);
    assert.throws(()=>createCheckout({...input,idempotency_key:'e'.repeat(64)},'https://example.com',config),e=>e.status===409 && e.code==='quote_changed');
    const second=createCheckout({...input,idempotency_key:'e'.repeat(64),expected_total_cop:3915000},'https://example.com',config);
    assert.equal(paymentState(second.token).shipping_cop,35000);
    const previous={commercial:state.commercial,products:state.products,cart:state.cart,shippingDestination:state.shippingDestination};
    try {
      state.commercial=commercialProfile();state.products=[{id:'p1',brand:'Bulova',name:'Racer',reference:'98B428',price_cop:1940000}];state.cart={p1:2};state.shippingDestination={zone:'national',city:'Medellín'};
      assert.ok(cart().includes('Continuar a Datos'));assert.ok(!cart().includes('accept-terms'));assert.ok(conditions().includes('10.000'));
    } finally {Object.assign(state,previous);}
  } finally {db.close();await rm(dir,{recursive:true,force:true});}
});
