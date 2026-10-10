import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
test('HTTP authentication, origin checks, protected editor and upload validation',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'bacata-http-'));
  const child=spawn(process.execPath,['src/server.js'],{env:{...process.env,PORT:'0',APP_ORIGIN:'http://localhost',DB_PATH:join(dir,'test.sqlite'),ADMIN_EMAIL:'admin@test.local',ADMIN_PASSWORD:'TemporaryTestPassword123',SESSION_SECRET:'temporary-test-secret-at-least-32-chars',SEED_DEMO:'true'},stdio:['ignore','pipe','pipe']});
  try{
    // Port 0 prints actual bound port in the startup message.
    const message=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Servidor no inició')),10000);child.stdout.once('data',b=>{clearTimeout(timeout);resolve(b.toString());});child.once('error',reject);});
    const port=message.match(/:(\d+)/)[1],base=`http://127.0.0.1:${port}`;
    const denied=await fetch(base+'/api/admin/overview');assert.equal(denied.status,401);
    const originDenied=await fetch(base+'/api/admin/login',{method:'POST',headers:{origin:'https://other.example'},body:'{}'});assert.equal(originDenied.status,403);
    const login=await fetch(base+'/api/admin/login',{method:'POST',body:JSON.stringify({email:'admin@test.local',password:'TemporaryTestPassword123'})});assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const overview=await fetch(base+'/api/admin/overview',{headers:{cookie}}).then(r=>r.json());assert.equal(overview.products.length,10);
    const p=overview.products[0];
    const publish=await fetch(base+`/api/admin/products/${p.id}/status`,{method:'PATCH',headers:{cookie},body:JSON.stringify({status:'published',override:true})});assert.equal(publish.status,409);
    const invalidImage=await fetch(base+'/api/admin/images',{method:'POST',headers:{cookie},body:JSON.stringify({base64:Buffer.from('<svg>bad</svg>').toString('base64')})});assert.equal(invalidImage.status,400);
    const list=await fetch(base+'/api/products').then(r=>r.json());assert.ok(list.products.every(p=>!('supplier_url'in p)&&!('price_usd'in p)));
    const oldImport=await fetch(base+'/api/admin/import',{method:'POST',headers:{cookie},body:'anything'});assert.equal(oldImport.status,410);
    const logout=await fetch(base+'/api/admin/logout',{method:'POST',headers:{cookie},body:'{}'});assert.equal(logout.status,200);
    const closed=await fetch(base+'/api/admin/overview',{headers:{cookie}});assert.equal(closed.status,401);
  }finally{child.kill();await once(child,'exit');await rm(dir,{recursive:true,force:true});}
});
