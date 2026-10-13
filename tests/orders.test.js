import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { state } from '../public/js/state.js';
import { ordersView } from '../public/js/views/orders.js';
test('requests preserve legacy rows, paginate all records and audit versioned review without payment changes', async () => {
  const dir = await mkdtemp(join(tmpdir(),'bacata-requests-'));
  process.env.DB_PATH = join(dir,'test.sqlite');
  process.env.SEED_DEMO = 'false';
  const legacy = new DatabaseSync(process.env.DB_PATH);
  legacy.exec("CREATE TABLE orders(id TEXT PRIMARY KEY,items_json TEXT NOT NULL,total_cop INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'payment_pending',created_at TEXT NOT NULL)");
  const items = [{id:'p1',reference:'REF%_01',name:'Pieza <script>alert(1)</script>',quantity:2,unit_price_cop:1000000}];
  for(let i=0;i<61;i++) legacy.prepare('INSERT INTO orders(id,items_json,total_cop,created_at) VALUES(?,?,?,?)').run('AUR-'+String(i).padStart(3,'0'),JSON.stringify(items),2000000,'2026-10-13T00:00:00Z');
  legacy.close();
  const { db } = await import('../src/db.js');
  const { requestList, requestDetail, reviewRequest } = await import('../src/orders.js');
  try {
    const first = requestList(new URLSearchParams());
    assert.equal(first.total,61); assert.equal(first.pages,3); assert.equal(first.rows.length,25);
    const second = requestList(new URLSearchParams({page:'2'}));
    assert.equal(second.rows.length,25);
    assert.ok(!second.rows.some(row=>first.rows.some(other=>other.id===row.id)));
    assert.equal(requestList(new URLSearchParams({page:'3'})).rows.length,11);
    assert.equal(requestList(new URLSearchParams({q:'REF%_01'})).total,61);
    assert.equal(requestList(new URLSearchParams({q:'not found'})).total,0);
    assert.throws(()=>requestList(new URLSearchParams({status:'paid'})), /Filtros/);
    const before=requestDetail('AUR-001');
    assert.equal(before.version,0); assert.equal(before.admin_note,'');
    const after=reviewRequest(before.id,{version:0,status:'reviewed',admin_note:'Revisada la referencia.'},'admin');
    assert.deepEqual(after.items,before.items); assert.equal(after.total_cop,before.total_cop); assert.equal(after.version,1);
    assert.throws(()=>reviewRequest(before.id,{version:0,status:'archived',admin_note:''},'admin'), e=>e.status===409);
    assert.throws(()=>reviewRequest(before.id,{version:1,status:'paid',admin_note:''},'admin'), e=>e.status===400);
    assert.throws(()=>reviewRequest(before.id,{version:1,status:'reviewed',admin_note:'',total_cop:1},'admin'), e=>e.status===400);
    const archived=reviewRequest(before.id,{version:1,status:'archived',admin_note:'Archivada sin borrar.'},'admin');
    assert.equal(requestList(new URLSearchParams({status:'archived'})).total,1);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM audit WHERE action='request_reviewed'").get().total,2);
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM orders').get().total,61);
    const previous=state.selectedOrder;
    try { state.selectedOrder=archived; assert.ok(ordersView().includes('&lt;script&gt;')); assert.ok(!ordersView().includes('<script>')); } finally {state.selectedOrder=previous;}
  } finally {db.close();await rm(dir,{recursive:true,force:true});}
});
