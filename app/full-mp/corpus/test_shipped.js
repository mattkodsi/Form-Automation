/* Does the SHIPPED index.html carry a working decryptor?

   Building is not shipping and neither is passing a unit test: the modules
   could be absent from the bundle, or concatenated in the wrong order --
   pdfdecrypt reads window.RCSCrypto at load time, so if crypto.js follows it
   the whole thing is silently inert. So pull the JS out of the delivered file,
   evaluate it, and decrypt a real locked study with it. */
const fs=require('fs'),path=require('path');
const HTML=process.argv[2], PDF=process.argv[3];

const html=fs.readFileSync(HTML,'utf8');
console.log('index.html: '+html.length.toLocaleString()+' bytes');
for(const name of ['RCSCrypto','RCSPdfDecrypt','unlockPdf']){
  const n=(html.match(new RegExp(name,'g'))||[]).length;
  console.log('  mentions '+name.padEnd(14)+': '+n+(n?'':'   <-- MISSING FROM THE BUNDLE'));
}
/* order matters: crypto must be defined before pdfdecrypt runs */
const ci=html.indexOf('window.RCSCrypto=API'), pi=html.indexOf('window.RCSPdfDecrypt=API');
console.log('  crypto defined before pdfdecrypt: '+((ci>=0&&pi>=0&&ci<pi)?'yes':'NO — WRONG ORDER'));

/* Evaluate the bundle's scripts with a minimal DOM, then use the real thing. */
global.window=global.window||{};
global.self=global.window;
global.CSS={escape:s=>s};
const mem={};
global.window.localStorage={getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=v;},removeItem:k=>{delete mem[k];}};
global.window.addEventListener=()=>{};
global.window.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});
function mk(){return {style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},setAttribute(){},getAttribute(){return'';},appendChild(){},addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];},innerHTML:'',textContent:'',value:'',checked:false,files:[],focus(){},click(){}};}
global.document={getElementById:()=>mk(),querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>mk(),addEventListener(){},body:{classList:{toggle(){},contains(){return false;}},appendChild(){}},documentElement:mk()};
global.navigator={userAgent:'node'};
global.location={href:'file:///index.html',search:''};

const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(x=>x.trim());
console.log('  <script> blocks: '+scripts.length);
let ran=0;
for(const src of scripts){
  try{ (0,eval)(src); ran++; }catch(e){ /* the app's boot needs a real DOM; the libraries do not */ }
}
console.log('  script blocks evaluated without throwing: '+ran+'/'+scripts.length);

const C=global.window.RCSCrypto, D=global.window.RCSPdfDecrypt;
if(!C||!D){console.log('\nX the shipped bundle does not expose the decryptor');process.exit(1);}
console.log('  window.RCSCrypto present     : yes');
console.log('  window.RCSPdfDecrypt present : yes');

(async()=>{
  const bytes=new Uint8Array(fs.readFileSync(PDF));
  console.log('\n  locked study: '+path.basename(PDF)+'  ('+bytes.length.toLocaleString()+' bytes)');
  console.log('  isEncrypted(): '+D.isEncrypted(bytes));
  const r=await D.decrypt(bytes);
  console.log('  decrypt(): ok='+r.ok+(r.reason?('  '+r.reason):'')+(r.ok?('  '+JSON.stringify(r.info)):''));
  if(!r.ok)process.exit(1);
  const P=global.window.PDFLib||globalThis.PDFLib||global.PDFLib;
  if(!P){console.log("  (harness could not locate PDFLib; decrypt result above still stands)");process.exit(0);}
  const doc=await P.PDFDocument.load(r.bytes,{ignoreEncryption:true,throwOnInvalidObject:false});
  console.log('  pdf-lib opened it: '+doc.getPageCount()+' pages');
  const ok=doc.getPageCount()>0;
  console.log('\n'+(ok?'+ THE SHIPPED APP CAN READ A LOCKED STUDY':'X still cannot read it'));
  process.exitCode=ok?0:1;
})().catch(e=>{console.error('threw:',e.message);process.exit(1);});
