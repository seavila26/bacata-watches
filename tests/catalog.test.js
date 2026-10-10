import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ExcelJS from 'exceljs';
const temp=await mkdtemp(join(tmpdir(),'bacata-test-'));
process.env.DB_PATH=join(temp,'test.sqlite');process.env.SEED_DEMO='false';
const {db,decorate}=await import('../src/db.js');
const {previewInventory,commitInventory}=await import('../src/inventory-import.js');
const {editProduct}=await import('../src/product-editor.js');
const {publicProduct,publicationIssues}=await import('../src/catalog-model.js');
const {importCsv}=await import('../src/supplier.js');
after(async()=>{db.close();await rm(temp,{recursive:true,force:true});});
// Generated supplier workbook fixture exercises parsing and transaction behavior.
async function fixture({price=544,date='2026-10-07',count=1,invalid=false,lux=false}={}) {
  const w=new ExcelJS.Workbook(),a=w.addWorksheet('Supuestos');
  [3216.01,.03,35,100,.01,0,.1,.1,.19,.19,1,.03,.02,25000,35000,250000,.1,1].forEach((v,i)=>a.getCell(i+6,2).value=v);
  const s=w.addWorksheet('Base comparada');
  const headers=['Marca','Referencia','Joma promo USD','Joma sin cupón USD','Precio Colombia COP','Mensaje despacho Joma','Enlace compra Jomashop','Fecha consulta','SKU Jomashop','Condición Joma','Referencia Colombia','Enlace comparable Colombia','Código cupón','Grupo al corte','Elegible comparable (1/0)'];
  s.getRow(5).values=headers;
  for(let i=0;i<count;i++)s.getRow(i+6).values=['Bulova',i?'CODE / SPACE 2':'96B349',invalid?-1:price,price,3792000,'In Stock.','https://www.jomashop.com/watch.html',new Date(date),'SKU','Nuevo','96B349','https://example.com/watch','', '10–20%',1];
  if(lux){const l=w.addWorksheet('Base lujo');l.getRow(5).values=['Marca','Referencia Jomashop','Nombre del reloj','Joma promoción USD','Joma sin cupón USD','Precio local original','Moneda local original','Cotización COP (editar)','Disponibilidad Joma','URL compra Jomashop','Fecha consulta','SKU Jomashop','Condición Joma','Referencia local','URL comparable local','Cupón','Oferta local COP exacta con stock (1/0)'];
    l.getRow(6).values=['Bulova','96B349','Repeated',price,price,3792000,'COP',null,'In Stock.','https://www.jomashop.com/watch.html',new Date(date),'SKU','Nuevo','96B349','','',1];
    l.getRow(7).values=['Rolex','TEST/REF','Rolex Test',10000,10000,null,null,null,'In Stock.','https://www.jomashop.com/test.html',new Date(date),'RLX','Nuevo',null,null,null,0];
    l.getCell('R7').value={formula:'1+""',result:{error:'#VALUE!'}};
  }
  return Buffer.from(await w.xlsx.writeBuffer());
}
let firstId;
test('preview is read-only; formulas with errors and overlaps do not create fake prices',async()=>{
  const p=await previewInventory(await fixture({lux:true}),'admin');
  assert.equal(p.summary.total,2);assert.equal(p.duplicates,1);assert.equal(p.formula_errors_ignored,1);
  assert.equal(p.records[1].analysis.suggested,null);assert.equal(p.records[1].analysis.margin,null);
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n,0);
  assert.ok(Math.abs(p.records[0].analysis.margin-.18035937626359586)<1e-10);
  assert.ok(Math.abs(p.records[0].analysis.margin_without_vat_credit-.04338487368532468)<1e-10);
  const c=commitInventory(p.token,[0,1],'admin');assert.equal(c.created,2);
  firstId=db.prepare("SELECT id FROM products WHERE reference='96B349'").get().id;
  const saved=db.prepare('SELECT * FROM products').all();assert.ok(saved.every(p=>p.stock===0&&p.status==='pending'&&p.approved_price_cop===null&&p.sale_mode==='quote'));
  assert.throws(()=>commitInventory(p.token,[0],'admin'),/venció/);
});
test('invalid rows are blocked; manual CSV cannot bypass preview',async()=>{
  const p=await previewInventory(await fixture({invalid:true}),'admin');assert.equal(p.summary.blocked,1);assert.throws(()=>commitInventory(p.token,[0],'admin'),/errores/);
  assert.throws(()=>importCsv('reference,brand,name,variant,price_usd,shipping_usd,market_cop,stock\n96B349,Bulova,X,X,544,35,3792000,1','test','admin'),/gestionada por Excel/);
});
test('editor persists gallery and technical details; enforces inputs and publication requirements',()=>{
  assert.throws(()=>editProduct(firstId,{stock:-1},'admin'),/Número/);
  assert.throws(()=>editProduct(firstId,{image_url:'javascript:alert(1)'},'admin'),/imagen/);
  assert.throws(()=>editProduct(firstId,{sale_mode:'fake'},'admin'),/Modalidad/);
  let p=editProduct(firstId,{name:'Marine Star',variant:'Azul',description:'Descripción verificada',image_url:'https://example.com/photo.webp',images:['https://example.com/back.webp'],collection:'Marine Star',movement:'Automático',diameter_mm:43,material:'Acero',crystal:'Mineral',water_resistance:'200 metros',dial_color:'Azul',strap:'Acero',condition:'Nuevo',warranty:'Garantía del comercio, 12 meses',package_contents:'Caja y documentación',provenance:'Factura de importación',shipping_terms:'Entrega y cambios confirmados',delivery_days:'15 a 20 días hábiles',approved_price_cop:3412800,sale_mode:'on_order',cost_verified:true},'admin');
  assert.equal(p.movement,'Automático');assert.equal(p.images.length,1);assert.ok(p.publication_issues.some(i=>i.includes('disponibilidad')));
  p=editProduct(firstId,{confirm_supplier:true},'admin');assert.deepEqual(p.publication_issues,[]);
  assert.ok(publicationIssues({...p,supplier_confirmed_at:'2020-01-01'},p.analysis).length>0);
  const publicP=publicProduct(p,p.analysis);assert.equal(publicP.price_cop,3412800);assert.equal(publicP.availability,'on_order');
  for(const privateKey of ['source_snapshot_json','source','supplier_url','price_usd','analysis','cost_verified','manual_cost_cop'])assert.equal(privateKey in publicP,false);
  assert.ok(publicationIssues({...p,sale_mode:'available'},p.analysis).some(i=>i.includes('existencias')));
});
test('reimport preserves merchandising and manual price, pauses on changed source',async()=>{
  db.prepare("UPDATE products SET status='published' WHERE id=?").run(firstId);
  const p=await previewInventory(await fixture({price:600,date:'2026-10-08'}),'admin');
  assert.equal(p.summary.update,1);const c=commitInventory(p.token,[0],'admin');assert.equal(c.paused,1);
  const saved=decorate(db.prepare('SELECT * FROM products WHERE id=?').get(firstId));
  assert.equal(saved.name,'Marine Star');assert.equal(saved.movement,'Automático');assert.equal(saved.images.length,1);assert.equal(saved.approved_price_cop,3412800);assert.equal(saved.stock,0);assert.equal(saved.cost_verified,0);assert.equal(saved.supplier_confirmed_at,null);assert.equal(saved.status,'paused');
  const older=await previewInventory(await fixture(),'admin');assert.equal(older.summary.blocked,1);
});
test('transaction rolls back earlier insert when later preview conflicts',async()=>{
  const p=await previewInventory(await fixture({date:'2026-10-09',count:2}),'admin');
  editProduct(firstId,{description:'Cambio concurrente'},'admin');
  const before=db.prepare('SELECT count(*) n FROM products').get().n;
  assert.throws(()=>commitInventory(p.token,[1,0],'admin'),/cambió/);
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n,before);
});
test('references containing spaces and slashes are accepted without lossy identifiers',async()=>{
  const p=await previewInventory(await fixture({date:'2026-10-10',count:2}),'admin');const c=commitInventory(p.token,[1],'admin');assert.equal(c.created,1);
  assert.ok(db.prepare("SELECT id FROM products WHERE reference='CODE / SPACE 2'").get());
});
