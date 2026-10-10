import {readSource,extractProduct,sourceUrl} from './source-reader.js';

// All browser requests use the existing DNS-pinned HTTPS reader. No browser
// network fallback, arbitrary hosts, cookies, logins, or challenge solving.
export async function renderProduct(raw,expected,{reader=readSource,chromium,launchOptions={}}={}) {
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
    await context.route('**/*',async route=>{
      try {
        const request=route.request();
        if(request.method()!=='GET'||['image','media','font'].includes(request.resourceType())||++requests>120)return await route.abort();
        const safeUrl=sourceUrl(request.url()).href;
        const response=await reader(safeUrl,{maxBytes:8*1024*1024,timeoutMs:8000});
        bytes+=response.buffer.length;if(bytes>32*1024*1024)return await route.abort();
        await route.fulfill({status:response.status,body:response.buffer,headers:{'content-type':String(response.headers['content-type']||'application/octet-stream')}});
      }catch {await route.abort().catch(()=>{});}
    });
    const page=await context.newPage();
    const task=async()=>{
      await page.goto(raw,{waitUntil:'domcontentloaded',timeout:25000});
      for(let attempt=0;attempt<20;attempt++) {
        try {
          const url=sourceUrl(page.url()).href;
          const extracted=extractProduct(await page.content(),expected,url);
          if(!Object.keys(extracted.fields).some(key=>!['name','description'].includes(key)))throw Error('La ficha renderizada aún no contiene especificaciones verificables');
          for(const entry of Object.values(extracted.evidence))entry.method=`rendered/${entry.method}`;
          return {...extracted,url};
        }catch(error){if(error.code==='SOURCE_BLOCKED')throw error;if(attempt===19)throw error;}
        await page.waitForTimeout(500);
      }
    };
    return await Promise.race([task(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('La fuente no entregó una ficha renderizada en 30 segundos; revisa el acceso o utiliza un catálogo autorizado')),30000);})]);
  } finally {clearTimeout(timer);await browser.close();}
}

export async function readProductSource(raw,expected,{reader=readSource,renderer=renderProduct,renderEnabled=process.env.ENRICHMENT_RENDER_ENABLED==='true'}={}) {
  const response=await reader(raw);
  try {return {...extractProduct(response.buffer.toString('utf8'),expected,response.url),url:response.url};}
  catch(error) {
    if(error.code!=='SOURCE_NEEDS_RENDER')throw error;
    if(!renderEnabled)throw Error(`${error.message}. Lectura renderizada desactivada: configura ENRICHMENT_RENDER_ENABLED=true o carga un catálogo autorizado`);
    return renderer(response.url,expected,{reader});
  }
}
