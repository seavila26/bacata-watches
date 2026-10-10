import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractProduct} from '../src/source-reader.js';
import {readProductSource,renderProduct} from '../src/product-source.js';
const url='https://www.jomashop.com/watch.html';
const expected={brand:'Bulova',reference:'98B428'};
const shell='<title>Bulova 98B428</title><noscript>enable JavaScript in your browser</noscript>';
const response=html=>({url,status:200,headers:{'content-type':'text/html'},buffer:Buffer.from(html)});
test('initial JavaScript shell is not a reference mismatch or a verified product',()=>{
  assert.throws(()=>extractProduct(shell,expected,url),error=>error.code==='SOURCE_NEEDS_RENDER');
  assert.throws(()=>extractProduct('<h1>Bulova 98B4280</h1>',expected,url),/referencia exacta/);
});
test('rendering is opt-in and happens only for a JavaScript shell',async()=>{
  let calls=0;const renderer=async()=>{calls++;return {reference_verified:true,fields:{movement:'Cuarzo'}};};
  await assert.rejects(readProductSource(url,expected,{reader:async()=>response(shell),renderer,renderEnabled:false}),/desactivada/);
  assert.equal(calls,0);
  const result=await readProductSource(url,expected,{reader:async()=>response(shell),renderer,renderEnabled:true});assert.equal(result.fields.movement,'Cuarzo');assert.equal(calls,1);
  await assert.rejects(readProductSource(url,expected,{reader:async()=>response('<h1>Bulova 98B429</h1>'),renderer,renderEnabled:true}),/referencia exacta/);assert.equal(calls,1);
  await assert.rejects(readProductSource(url,expected,{reader:async()=>response('<title>Access denied</title>'),renderer,renderEnabled:true}),/bloqueo/);assert.equal(calls,1);
});
test('rendered source validates identity and records evidence; outside hosts never reach reader',{skip:!process.env.BACATA_TEST_CHROMIUM},async()=>{
  const calls=[];
  const html=`<h1>Bulova 98B428</h1><script>fetch('https://untrusted.example/private');fetch('/write',{method:'POST'});setTimeout(()=>{document.body.insertAdjacentHTML('beforeend','<table><tr><td>Movement</td><td>Quartz</td></tr></table>')},50)</script>`;
  const result=await renderProduct(url,expected,{launchOptions:{executablePath:process.env.BACATA_TEST_CHROMIUM},reader:async raw=>{calls.push(raw);return response(html);}});
  assert.equal(result.fields.movement,'Cuarzo');assert.equal(result.reference_verified,true);assert.equal(result.evidence.movement.method,'rendered/html');assert.deepEqual(calls,[url]);
});
