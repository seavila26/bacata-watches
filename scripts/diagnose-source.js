import {writeFile} from 'node:fs/promises';
import {readProductSource,requestLabel} from '../src/product-source.js';
const [url,reference,brand]=process.argv.slice(2);
if(!url||!reference||!brand){console.error('Uso: npm run diagnose:source -- URL REFERENCIA MARCA');process.exit(1);}
const diagnostics={requests:[],stages:[]};
const report={brand,reference,source:requestLabel(url),checked_at:new Date().toISOString(),diagnostics};
try {
  const result=await readProductSource(url,{brand,reference},{renderEnabled:true,diagnostics});
  report.state='extracted';report.fields=result.fields;report.warnings=result.warnings;
}catch(error){report.state='pending_source';report.code=error.code||'SOURCE_READ_FAILED';report.reason=error.message;process.exitCode=2;}
const path='source-diagnostic.json';
await writeFile(path,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));console.log(`Diagnóstico guardado en ${path}. No se modificó SQLite ni se publicó ningún producto.`);
