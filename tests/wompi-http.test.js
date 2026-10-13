import { customerFixture } from './checkout-fixture.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
test('sandbox HTTP exposes no secrets, signs checkout, persists across restart and protects callbacks', async () => {
  const dir=await mkdtemp(join(tmpdir(),'bacata-wompi-http-')), dbPath=join(dir,'db.sqlite');
  let child;
  const start=async()=>{
    child=spawn(process.execPath,['src/server.js'],{env:{...process.env,PORT:'0',APP_ORIGIN:'http://localhost',DB_PATH:dbPath,ADMIN_EMAIL:'admin@test.local',ADMIN_PASSWORD:'TemporaryTestPassword123',SESSION_SECRET:'temporary-test-secret-at-least-32-chars',SEED_DEMO:'false',WOMPI_MODE:'sandbox',WOMPI_PUBLIC_KEY:'pub_test_fixture',WOMPI_PRIVATE_KEY:'prv_test_fixture',WOMPI_INTEGRITY_SECRET:'test_integrity_fixture',WOMPI_EVENTS_SECRET:'test_events_fixture'},stdio:['ignore','pipe','pipe']});
    let stderr='';child.stderr.on('data',b=>stderr+=b);
    const message=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('No inició el servidor: '+stderr)),10000);
      child.stdout.once('data',b=>{clearTimeout(timer);resolve(b.toString());});
      child.once('error',e=>{clearTimeout(timer);reject(e);});
      child.once('exit',code=>{clearTimeout(timer);reject(Error('Servidor terminó '+code+': '+stderr));});
    });
    return 'http://127.0.0.1:'+message.match(/:(\d+)/)[1];
  };
  const stop=async()=>{if(child?.exitCode===null){child.kill();await once(child,'exit');}};
  try {
    let base=await start();
    const db=new DatabaseSync(dbPath), now=new Date().toISOString();
    db.prepare(`INSERT INTO products(id,identity_key,brand,reference,name,price_usd,market_cop,status,updated_at,last_confirmed_at,published_at,collection,movement,diameter_mm,material,crystal,water_resistance,dial_color,strap,image_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('p1','fixture','Bulova','98B428','Racer',100,2000000,'published',now,now,now,'Racer','Cuarzo',40,'Acero','Zafiro','100 metros','Negro','Acero','https://example.com/watch.webp');
    db.close();
    const input={items:[{id:'p1',quantity:2}],accepted:true,customer:customerFixture,privacy_accepted:true,destination:{zone:'bogota',city:'Bogotá'},expected_total_cop:3880000,idempotency_key:'d'.repeat(64)};
    const send=(path,body,headers={})=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
    assert.deepEqual(await (await fetch(base+'/api/payments/config')).json(),{mode:'sandbox',enabled:true});
    assert.equal((await send('/api/shipping/quote',{items:input.items,destination:{zone:'national',city:'Medellín'}})).status,200);
    const shippingQuote=await (await send('/api/shipping/quote',{items:input.items,destination:{zone:'national',city:'Medellín'}})).json();assert.equal(shippingQuote.total_cop,3905000);
    assert.equal((await send('/api/payments/checkout',{...input,customer:{...customerFixture,department:'Antioquia',city:'Medellín'},destination:{zone:'national',city:'Medellín'},expected_total_cop:3880000})).status,409);
    assert.equal((await send('/api/payments/checkout',input,{origin:'https://other.example'})).status,403);
    const response=await send('/api/payments/checkout',input);assert.equal(response.status,201);
    const checkout=await response.json(), text=JSON.stringify(checkout);
    for(const secret of ['prv_test_fixture','test_integrity_fixture','test_events_fixture'])assert.ok(!text.includes(secret));
    const url=new URL(checkout.checkout_url);
    assert.equal(Number(url.searchParams.get('amount-in-cents')),388000000);
    assert.equal(new URL(url.searchParams.get('redirect-url')).pathname,'/pago');
    assert.equal((await (await send('/api/payments/checkout',input)).json()).reference,checkout.reference);
    assert.equal((await fetch(base+'/api/payments/'+'e'.repeat(64))).status,404);
    assert.equal((await send('/api/payments/'+checkout.token+'/verify',{transaction_id:'fake'},{origin:'https://other.example'})).status,403);
    assert.equal((await send('/api/payments/wompi/events',{event:'transaction.updated',environment:'test',timestamp:123,data:{transaction:{id:'fake'}},signature:{properties:['transaction.id'],checksum:'0'.repeat(64)}})).status,401);
    assert.equal((await fetch(base+'/api/admin/orders/'+checkout.reference)).status,401);
    assert.equal((await fetch(base+'/api/admin/orders?email='+customerFixture.email)).status,401);
    const status=await (await fetch(base+'/api/payments/'+checkout.token)).json();assert.equal(status.payment.status,'PENDING');
    assert.ok(!JSON.stringify(status).includes('token'));
    assert.ok(!JSON.stringify(status).includes(customerFixture.email));
    assert.ok(!JSON.stringify(status).includes(customerFixture.address));
    await stop();base=await start();
    const restored=await (await fetch(base+'/api/payments/'+checkout.token)).json();assert.equal(restored.payment.reference,checkout.reference);assert.equal(restored.payment.status,'PENDING');
    assert.equal((await fetch(base+'/pago?token='+checkout.token+'&id=fake')).status,200);
    const restoredDb=new DatabaseSync(dbPath,{readOnly:true});assert.equal(restoredDb.prepare('SELECT COUNT(*) AS n FROM orders').get().n,1);restoredDb.close();
  } finally {await stop();await rm(dir,{recursive:true,force:true});}
});
