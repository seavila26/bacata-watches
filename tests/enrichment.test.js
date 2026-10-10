import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const temp=await mkdtemp(join(tmpdir(),'bacata-enrichment-'));
process.env.DB_PATH=join(temp,'test.sqlite');process.env.SEED_DEMO='false';
const {db,decorate}=await import('../src/db.js');
const {identityKey}=await import('../src/catalog-model.js');
const {extractProduct,sourceUrl}=await import('../src/source-reader.js');
const {prepareProposal,importAuthorizedCatalog,applyProposals}=await import('../src/catalog-enrichment.js');
const {saveTemplate,previewBulk,applyBulk,bulkOverview}=await import('../src/catalog-bulk.js');
const {editProduct}=await import('../src/product-editor.js');
after(async()=>{db.close();await rm(temp,{recursive:true,force:true});});
const now=new Date().toISOString();
for(let i=0;i<10;i++)db.prepare(`INSERT INTO products(id,brand,name,reference,identity_key,variant,price_usd,shipping_usd,market_cop,stock,sale_mode,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(`test-${i}`,'Bulova',`Bulova REF-${i}`,`REF-${i}`,identityKey('Bulova',`REF-${i}`),'',100,10,2000000,0,'quote',now);
const expected={brand:'Bulova',reference:'REF-0'};
const html=(ref='REF-0',brand='Bulova')=>`<h1>${brand} Watch ${ref}</h1><script type="application/ld+json">${JSON.stringify({'@type':'Product',brand:{name:brand},mpn:ref,name:`${brand} Marine ${ref}`,image:['https://cdn.jomashop.com/test.webp'],additionalProperty:[{name:'Series',value:'Marine Star'},{name:'Movement',value:'Automatic'},{name:'Case Size',value:'43 mm'},{name:'Case Material',value:'Stainless Steel'},{name:'Crystal',value:'Mineral'},{name:'Water Resistance',value:'200 meters / 660 feet'},{name:'Dial Color',value:'Blue'},{name:'Band Material',value:'Stainless Steel'}]})}</script>`;
test('extract exact reference and facts; unknown and conflicting values remain pending',()=>{
  const result=extractProduct(html(),expected,'https://www.jomashop.com/test.html');assert.equal(result.fields.diameter_mm,43);assert.equal(result.fields.movement,'Automático');assert.equal(result.fields.material,'Acero inoxidable');assert.equal(result.fields.dial_color,'Azul');assert.equal(result.fields.water_resistance,'200 metros / 660 pies');assert.equal(result.fields.warranty,undefined);
  assert.throws(()=>extractProduct(html('REF-01'),expected,'https://www.jomashop.com/test.html'),/referencia exacta/);
  assert.throws(()=>extractProduct(html('REF-0','Other'),expected,'https://www.jomashop.com/test.html'),/marca/);
  const conflict=extractProduct(html()+`<table><tr><td>Case Size</td><td>40 mm</td></tr><tr><td>Case Size</td><td>43 mm</td></tr></table>`,expected,'https://www.jomashop.com/test.html');assert.equal(conflict.fields.diameter_mm,undefined);assert.ok(conflict.warnings.length);
});
test('source URLs prevent arbitrary hosts and credential-bearing or local targets',()=>{
  assert.throws(()=>sourceUrl('http://www.jomashop.com/watch'),/HTTPS/);assert.throws(()=>sourceUrl('https://127.0.0.1/watch'),/dominios/);assert.throws(()=>sourceUrl('https://user:password@www.jomashop.com/watch'),/dominios/);assert.throws(()=>sourceUrl('https://other.example/watch'),/dominios/);
});
test('pilot of ten prepares Spanish proposals without touching product stock or facts',async()=>{
  const records=Array.from({length:10},(_,i)=>({brand:'Bulova',reference:`REF-${i}`,source_url:'https://www.jomashop.com/test.html',fields:{collection:'Marine Star',movement:'Automatic',diameter_mm:43,material:'Stainless Steel',crystal:'Mineral',water_resistance:'200 meters',dial_color:'Blue',strap:'Stainless Steel'},images:[]}));
  const result=await importAuthorizedCatalog({records,download_images:false},'admin');assert.equal(result.total,10);
  assert.equal(db.prepare("SELECT count(*) n FROM products WHERE movement!=''").get().n,0);
  const proposals=bulkOverview().proposals.filter(p=>p.job_id===result.id);assert.equal(proposals.length,10);
  assert.ok(proposals.every(p=>p.proposal.fields.description.includes('Movimiento: Automático')));
  const applied=applyProposals({ids:proposals.map(p=>p.id)},'admin');assert.equal(applied.applied,10);
  const saved=db.prepare('SELECT * FROM products').all();assert.ok(saved.every(p=>p.stock===0&&p.status==='pending'&&p.movement==='Automático'));
  assert.ok(db.prepare('SELECT count(*) n FROM field_history').get().n>0);
});
test('preparation preserves manual corrections and does not invent commercial terms',async()=>{
  editProduct('test-0',{name:'Mi nombre aprobado',movement:'Cuarzo confirmado',description:'Descripción manual'},'admin');
  const p=db.prepare('SELECT * FROM products WHERE id=?').get('test-0');
  const proposal=await prepareProposal(p,{...extractProduct(html(),expected,'https://www.jomashop.com/test.html'),url:'https://www.jomashop.com/test.html'});
  assert.equal(proposal.fields.name,undefined);assert.equal(proposal.fields.movement,undefined);assert.equal(proposal.fields.description,undefined);
  for(const field of ['stock','warranty','delivery_days','approved_price_cop','cost_verified'])assert.equal(field in proposal.fields,false);
});
test('condition templates require preview; bulk publication skips incomplete items',()=>{
  const t=saveTemplate({name:'Condiciones aprobadas',fields:{sale_mode:'quote',warranty:'Comercio, 12 meses',package_contents:'Caja verificada',provenance:'Factura',shipping_terms:'Condiciones acordadas'}},'admin');
  const plan=previewBulk({ids:['test-1','test-2'],template_id:t.id},'admin');assert.equal(plan.total,2);assert.equal(plan.ready,0);
  assert.equal(db.prepare('SELECT warranty FROM products WHERE id=?').get('test-1').warranty,'');
  const result=applyBulk(plan.token,true,'admin');assert.equal(result.updated,2);assert.equal(result.published,0);assert.equal(result.blocked.length,2);
  assert.equal(db.prepare('SELECT stock FROM products WHERE id=?').get('test-1').stock,0);
  const confirmations=previewBulk({ids:['test-5'],confirm_costs:true,confirm_supplier:true},'admin');
  assert.equal(db.prepare('SELECT cost_verified FROM products WHERE id=?').get('test-5').cost_verified,0);
  applyBulk(confirmations.token,false,'admin');
  const checked=db.prepare('SELECT cost_verified,supplier_confirmed_at,stock FROM products WHERE id=?').get('test-5');assert.equal(checked.cost_verified,1);assert.ok(checked.supplier_confirmed_at);assert.equal(checked.stock,0);
});
test('bulk preview is atomic when a later item changes; existing terms survive default templates',()=>{
  const t=saveTemplate({name:'Otra plantilla',fields:{warranty:'Nueva garantía'}},'admin');
  const plan=previewBulk({ids:['test-1','test-2'],template_id:t.id},'admin');assert.equal(plan.items[0].changes.warranty,undefined);
  const overwrite=previewBulk({ids:['test-1','test-2'],template_id:t.id,overwrite:true},'admin');
  editProduct('test-2',{variant:'Cambio concurrente'},'admin');
  assert.throws(()=>applyBulk(overwrite.token,false,'admin'),/Cambió/);
  assert.equal(db.prepare('SELECT warranty FROM products WHERE id=?').get('test-1').warranty,'Comercio, 12 meses');
});
test('proposal application rejects concurrent changes without partially modifying the lot',async()=>{
  const result=await importAuthorizedCatalog({records:[{brand:'Bulova',reference:'REF-3',source_url:'https://www.jomashop.com/test.html',fields:{case_color:'Silver'}}]},'admin');
  const proposal=bulkOverview().proposals.find(p=>p.job_id===result.id);editProduct('test-3',{variant:'Otra variante'},'admin');
  assert.throws(()=>applyProposals({ids:[proposal.id]},'admin'),/Cambió/);assert.equal(db.prepare('SELECT case_color FROM products WHERE id=?').get('test-3').case_color,'');
});
test('bad image responses stay pending and never substitute a fabricated photograph',async()=>{
  const p=db.prepare('SELECT * FROM products WHERE id=?').get('test-4');
  const proposal=await prepareProposal(p,{fields:{collection:'Marine Star'},evidence:{},images:['https://cdn.jomashop.com/test.webp'],url:'https://www.jomashop.com/test.html'}, {download_images:true,reader:async()=>({buffer:Buffer.from('<html>blocked</html>')})});
  assert.equal(proposal.fields.image_url,undefined);assert.ok(proposal.warnings.some(w=>w.includes('Foto pendiente')));
});
test('one bulk action publishes ready quotes and reports remaining incomplete references',()=>{
  editProduct('test-1',{image_url:'https://example.com/photo.webp',condition:'Nuevo'},'admin');
  const plan=previewBulk({ids:['test-1','test-2']},'admin');assert.equal(plan.ready,1);
  const result=applyBulk(plan.token,true,'admin');assert.equal(result.published,1);assert.equal(result.blocked.length,1);
  assert.equal(db.prepare('SELECT status FROM products WHERE id=?').get('test-1').status,'published');
  assert.equal(db.prepare('SELECT status FROM products WHERE id=?').get('test-2').status,'pending');
});
