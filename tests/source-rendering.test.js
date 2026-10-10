import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractProduct} from '../src/source-reader.js';
import {readProductSource,renderProduct,requestLabel,renderFailure} from '../src/product-source.js';
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
test('diagnostics remove credentials and query values, and distinguish rendering failure',()=>{
  assert.equal(requestLabel('https://user:password@www.jomashop.com/graphql?token=secret'),'www.jomashop.com/graphql');
  assert.equal(requestLabel('https://www.jomashop.com/cdn-cgi/challenge-platform/token/value'),'www.jomashop.com/cdn-cgi/challenge-platform/[ruta omitida]');
  const diagnostics={requests:[{method:'POST',target:'www.jomashop.com/graphql',outcome:'blocked_method',reason:'Método no permitido'}],stages:[]};
  const error=renderFailure(Error('La ficha requiere JavaScript'),diagnostics);
  assert.equal(error.code,'SOURCE_RENDER_INCOMPLETE');assert.match(error.message,/Chromium/);assert.match(error.message,/POST www.jomashop.com\/graphql/);assert.equal(error.diagnostics,diagnostics);
});
test('product-data HTTP rejection takes priority over unrelated blocked scripts',()=>{
  const requests=[{method:'GET',target:'ads.example/script.js',outcome:'blocked_host',reason:'No permitido'},
    {method:'GET',target:'www.jomashop.com/graphql',resource:'fetch',outcome:'read_failed',reason:'Fuente HTTP 493; no se obtuvo la ficha'},
    {method:'POST',target:'www.jomashop.com/cdn-cgi/challenge-platform/verify',outcome:'blocked_method'}];
  const error=renderFailure(Error('La ficha requiere JavaScript'),{requests,stages:[]});
  assert.equal(error.code,'SOURCE_DATA_HTTP_ERROR');assert.equal(error.status,493);assert.match(error.message,/GET www.jomashop.com\/graphql, HTTP 493/);assert.match(error.message,/flujo de verificación/);assert.doesNotMatch(error.message,/ads.example/);
  const typed=renderFailure(Error('No data'),{requests:[{method:'GET',target:'www.jomashop.com/graphql',outcome:'read_failed',status:429,reason:'HTTP error'}],stages:[]});assert.equal(typed.status,429);assert.doesNotMatch(typed.message,/verificación/);
});
test('rendered source validates identity and records evidence; outside hosts never reach reader',{skip:!process.env.BACATA_TEST_CHROMIUM},async()=>{
  const calls=[];
  const html=`<h1>Bulova 98B428</h1><script>fetch('https://untrusted.example/private');fetch('/write',{method:'POST'});setTimeout(()=>{document.body.insertAdjacentHTML('beforeend','<table><tr><td>Movement</td><td>Quartz</td></tr></table>')},50)</script>`;
  const result=await renderProduct(url,expected,{launchOptions:{executablePath:process.env.BACATA_TEST_CHROMIUM},reader:async raw=>{calls.push(raw);return response(html);}});
  assert.equal(result.fields.movement,'Cuarzo');assert.equal(result.reference_verified,true);assert.equal(result.evidence.movement.method,'rendered/html');assert.deepEqual(calls,[url]);
  assert.ok(result.diagnostics.requests.some(r=>r.outcome==='blocked_host'));
  assert.ok(result.diagnostics.requests.some(r=>r.outcome==='blocked_method'));
});

test('observed Jomashop details are extracted only from an exact primary model and brand',()=>{
  const html=readFileSync(new URL('./fixtures/jomashop-98b428-details.html',import.meta.url),'utf8');
  const result=extractProduct(html,expected,url);
  assert.equal(result.fields.collection,'Racer');assert.equal(result.fields.movement,'Cuarzo');assert.equal(result.fields.diameter_mm,42);assert.equal(result.fields.material,'IP Stainless Steel');assert.equal(result.fields.dial_color,'Negro');assert.equal(result.fields.strap_color,'Negro');assert.equal(result.fields.strap,'Leather');assert.equal(result.fields.water_resistance,'100 metros / 330 pies');assert.equal(result.fields.case_color,undefined);
  assert.throws(()=>extractProduct(html.replace('<span class="more-value">98B428</span>','<span class="more-value">98B429</span>'),expected,url),/bloque principal/);
  const related=html.replace('class="more-detail-body"','class="related-product"');assert.equal(extractProduct(related,expected,url).fields.movement,undefined);
});
