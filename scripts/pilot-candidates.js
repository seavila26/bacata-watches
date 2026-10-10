import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const input=process.argv[2],live=process.argv.includes('--live');
if(!input){console.error('Uso: node scripts/pilot-candidates.js inventario.xlsx [--live]');process.exit(1);}
const dir=await mkdtemp(join(tmpdir(),'bacata-pilot-'));process.env.DB_PATH=join(dir,'pilot.sqlite');process.env.SEED_DEMO='false';
const {parseInventory}=await import('../src/inventory-import.js');
const {readSource,extractProduct}=await import('../src/source-reader.js');
const {db}=await import('../src/db.js');
try {
  const {records}=await parseInventory(await readFile(input));
  const candidates=records.filter(r=>!r.errors.length&&r.source.evidence&&r.analysis.margin>=.1&&r.source.availability==='In Stock.'&&r.analysis.supplier/r.analysis.fx<=2000);
  const selected=[],brands=new Set();
  for(const r of candidates)if(!brands.has(r.brand)){selected.push(r);brands.add(r.brand);if(selected.length===10)break;}
  for(const r of candidates)if(selected.length<10&&!selected.includes(r))selected.push(r);
  const results=[];
  for(const r of selected) {
    const row={brand:r.brand,reference:r.reference,source_url:r.source.supplier_url};
    if(live)try{const response=await readSource(row.source_url,{timeoutMs:3000});const data=extractProduct(response.buffer.toString('utf8'),row,response.url);row.state='extracted';row.fields=data.fields;row.images=data.images;row.warnings=data.warnings;}catch(e){row.state='pending_source';row.reason=e.message;}
    else row.state='not_requested';
    results.push(row);
  }
  console.log(JSON.stringify({candidate_count:candidates.length,pilot_count:selected.length,live,results},null,2));
}finally{db.close();await rm(dir,{recursive:true,force:true});}
