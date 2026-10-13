import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateCustomer, departments } from '../public/js/checkout-model.js';
import { checkoutView } from '../public/js/views/checkout.js';
import { state } from '../public/js/state.js';
import { customerFixture } from './checkout-fixture.js';
test('checkout validates Colombian contact/destination, stores consent privately and excludes buyer data from payment status',async()=>{
 assert.equal(departments.length,33);
 for(const input of [{...customerFixture,country:'US'},{...customerFixture,department:'Unknown'},{...customerFixture,email:'bad'},{...customerFixture,phone:'abc3001234567'},{...customerFixture,address:''},{...customerFixture,city:'Medellín'}])assert.throws(()=>validateCustomer(input));
 assert.equal(validateCustomer({...customerFixture,notes:'Portería\nSegundo piso'}).notes,'Portería\nSegundo piso');
 const dir=await mkdtemp(join(tmpdir(),'bacata-checkout-'));process.env.DB_PATH=join(dir,'db.sqlite');process.env.WOMPI_MODE='disabled';process.env.SEED_DEMO='false';
 const {db}=await import('../src/db.js');
 const {createCheckout,wompiConfig,paymentState}=await import('../src/wompi.js');
 const {customerDetails}=await import('../src/checkout-customer.js');
 const config=wompiConfig({WOMPI_MODE:'sandbox',WOMPI_PUBLIC_KEY:'pub_test_fixture',WOMPI_PRIVATE_KEY:'prv_test_fixture',WOMPI_INTEGRITY_SECRET:'test_integrity_fixture',WOMPI_EVENTS_SECRET:'test_events_fixture'});
 try {
 const now=new Date().toISOString();db.prepare(`INSERT INTO products(id,identity_key,brand,reference,name,price_usd,market_cop,status,updated_at,last_confirmed_at,published_at,collection,movement,diameter_mm,material,crystal,water_resistance,dial_color,strap,image_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('p1','fixture','Bulova','98B428','Racer',100,2000000,'published',now,now,now,'Racer','Cuarzo',40,'Acero','Zafiro','100 metros','Negro','Acero','https://example.com/watch.webp');
 const input={items:[{id:'p1',quantity:1}],customer:customerFixture,accepted:true,privacy_accepted:true,destination:{zone:'bogota',city:'Bogotá'},expected_total_cop:1940000,idempotency_key:'9'.repeat(64)};
 assert.throws(()=>createCheckout({...input,privacy_accepted:false},'https://example.com',config),e=>e.status===400);
 const checkout=createCheckout(input,'https://example.com',config);assert.equal(customerDetails(checkout.reference).email,customerFixture.email);
 const consent=db.prepare('SELECT policy_json,accepted_at FROM order_customer WHERE order_id=?').get(checkout.reference);assert.ok(consent.accepted_at);assert.equal(JSON.parse(consent.policy_json).advertising_authorized,false);
 const publicData=JSON.stringify(paymentState(checkout.token));for(const sensitive of [customerFixture.email,customerFixture.phone,customerFixture.address,customerFixture.full_name])assert.ok(!publicData.includes(sensitive));
 assert.equal(paymentState(checkout.token).items[0].reference,'98B428');
 assert.throws(()=>createCheckout({...input,customer:{...customerFixture,address:'Otra calle 99'}},'https://example.com',config),e=>e.status===409);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,1);
 const previous={checkoutDraft:state.checkoutDraft,products:state.products,cart:state.cart};try{state.checkoutDraft={...customerFixture,address:'<script>test</script>'};state.products=[{id:'p1',brand:'Bulova',reference:'98B428',price_cop:1940000}];state.cart={p1:1};const view=checkoutView();assert.ok(view.includes('&lt;script&gt;'));assert.ok(!view.includes('iurban'));assert.ok(view.includes('privacy_accepted'));assert.ok(!view.includes('<script>test'));}finally{Object.assign(state,previous);}
 }finally{db.close();await rm(dir,{recursive:true,force:true});}
});
