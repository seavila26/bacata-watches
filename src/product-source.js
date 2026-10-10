import {readSource,extractProduct,sourceUrl} from './source-reader.js';

// All browser requests use the existing DNS-pinned HTTPS reader. No browser
// network fallback, arbitrary hosts, cookies, logins, or challenge solving.
export function requestLabel(raw) {
  try {const url=new URL(raw);return `${url.hostname}${url.pathname}`.slice(0,240);}catch{return 'URL no válida';}
}
export function renderFailure(error,diagnostics) {
  const failures=diagnostics.requests.filter(r=>['blocked_method','blocked_host','read_failed','request_limit','size_limit'].includes(r.outcome));
  const unique=[...new Set(failures.map(r=>`${r.method} ${r.target}: ${r.reason||r.outcome}`))].slice(0,4);
  const detail=unique.length?` Solicitudes fallidas registradas: ${unique.join('; ')}.`:' No se registraron solicitudes bloqueadas de datos o scripts.';
  const result=Error(`La lectura con Chromium no produjo una ficha verificable. ${error.message}.${detail}`);
  result.code=error.code==='SOURCE_BLOCKED'?'SOURCE_BLOCKED':'SOURCE_RENDER_INCOMPLETE';result.diagnostics=diagnostics;return result;
}
export async function renderProduct(raw,expected,{reader=readSource,chromium,launchOptions={},diagnostics={requests:[],stages:[]},timeoutMs=30000}={}) {
  sourceUrl(raw);
  if(!chromium)({chromium}=await import('playwright'));
  let browser;
  try {browser=await chromium.launch({headless:true,...launchOptions});}
  catch {throw Error('Chromium no está disponible. Ejecuta npm run browser:install en el servidor');}
  let timer;
  try {
    const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
    await context.routeWebSocket(/.*/,socket=>socket.close());
    let requests=0,bytes=0;
    const record=entry=>{if(diagnostics.requests.length<160)diagnostics.requests.push(entry);};
    await context.route('**/*',async route=>{
      const request=route.request(),entry={method:request.method(),target:requestLabel(request.url()),resource:request.resourceType()};
      try {
        if(['image','media','font'].includes(request.resourceType())){record({...entry,outcome:'excluded_resource'});return await route.abort();}
        if(request.method()!=='GET') {
          let operation='';try {const data=JSON.parse(request.postData()||'{}');operation=String(data.operationName||'').replace(/[^a-zA-Z0-9_]/g,'').slice(0,80);}catch{}
          record({...entry,outcome:'blocked_method',reason:'Método no permitido',...(operation?{operation}: {})});return await route.abort();
        }
        if(++requests>120){record({...entry,outcome:'request_limit',reason:'Límite de 120 solicitudes'});return await route.abort();}
        let safeUrl;
        try {safeUrl=sourceUrl(request.url()).href;}catch {record({...entry,outcome:'blocked_host',reason:'URL fuera de los dominios HTTPS permitidos'});return await route.abort();}
        const response=await reader(safeUrl,{maxBytes:8*1024*1024,timeoutMs:8000});
        bytes+=response.buffer.length;if(bytes>32*1024*1024){record({...entry,outcome:'size_limit',reason:'Límite total de 32 MB'});return await route.abort();}
        record({...entry,outcome:'fulfilled',status:response.status,bytes:response.buffer.length});
        await route.fulfill({status:response.status,body:response.buffer,headers:{'content-type':String(response.headers['content-type']||'application/octet-stream')}});
      }catch(error){record({...entry,outcome:'read_failed',reason:String(error.code||error.message||'Error de lectura').replace(/https?:\/\/[^\s]+/g,'[URL omitida]').slice(0,180)});await route.abort().catch(()=>{});}
    });
    const page=await context.newPage();
    diagnostics.script_errors=[];
    page.on('pageerror',error=>{if(diagnostics.script_errors.length<8)diagnostics.script_errors.push({name:error.name,message:String(error.message).replace(/https?:\/\/[^\s]+/g,'[URL omitida]').slice(0,180)});});
    const task=async()=>{
      await page.goto(raw,{waitUntil:'domcontentloaded',timeout:25000});
      diagnostics.stages.push({stage:'dom_loaded'});
      for(let attempt=0;attempt<20;attempt++) {
        try {
          const url=sourceUrl(page.url()).href;
          const extracted=extractProduct(await page.content(),expected,url);
          if(!Object.keys(extracted.fields).some(key=>!['name','description'].includes(key)))throw Error('La ficha renderizada aún no contiene especificaciones verificables');
          for(const entry of Object.values(extracted.evidence))entry.method=`rendered/${entry.method}`;
          diagnostics.stages.push({stage:'extracted',fields:Object.keys(extracted.fields)});
          return {...extracted,url,diagnostics};
        }catch(error){if(error.code==='SOURCE_BLOCKED')throw error;if(attempt===19){diagnostics.stages.push({stage:'extraction_failed',code:error.code||'IDENTITY_OR_FACTS_MISSING'});throw error;}}
        await page.waitForTimeout(500);
      }
    };
    return await Promise.race([task(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Tiempo máximo de lectura agotado')),timeoutMs);})]);
  } catch(error) {
    throw renderFailure(error,diagnostics);
  } finally {clearTimeout(timer);await browser.close();}
}

export async function readProductSource(raw,expected,{reader=readSource,renderer=renderProduct,renderEnabled=process.env.ENRICHMENT_RENDER_ENABLED==='true',...renderOptions}={}) {
  const diagnostics=renderOptions.diagnostics||{requests:[],stages:[]};
  let response;
  try {response=await reader(raw);diagnostics.stages.push({stage:'initial_response',status:response.status,bytes:response.buffer.length});}
  catch(error){diagnostics.stages.push({stage:'initial_read_failed',code:error.code||'SOURCE_READ_FAILED'});error.diagnostics=diagnostics;throw error;}
  try {return {...extractProduct(response.buffer.toString('utf8'),expected,response.url),url:response.url};}
  catch(error) {
    if(error.code!=='SOURCE_NEEDS_RENDER')throw error;
    if(!renderEnabled)throw Error(`${error.message}. Lectura renderizada desactivada: configura ENRICHMENT_RENDER_ENABLED=true o carga un catálogo autorizado`);
    diagnostics.stages.push({stage:'render_started'});
    return renderer(response.url,expected,{...renderOptions,diagnostics,reader});
  }
}
