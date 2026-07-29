/* Our decryptor against MuPDF's output, on the real locked studies.
   MuPDF is the oracle: same page count, and the same text on the pages the
   study reader actually looks at. Anything less is a bug we can see. */
global.CSS={escape:s=>s};
const mem={};
global.window={addEventListener:(e,cb)=>{if(e==='DOMContentLoaded')global.__ready=cb;},localStorage:{getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=v;},removeItem:k=>{delete mem[k];}},scrollY:0,scrollTo(){}};
function mk(id){return {id:id||'',style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},setAttribute(){},getAttribute(){return'';},appendChild(){},addEventListener(){},closest(){return null;},parentElement:null,querySelector(){return null;},querySelectorAll(){return[];},innerHTML:'',textContent:'',onclick:null,value:'',checked:false,focus(){},select(){},setSelectionRange(){},files:[]};}
const els={};
global.document={getElementById:id=>els[id]||(els[id]=mk(id)),querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>mk(),addEventListener(){},body:{classList:{toggle(){},contains(){return false;}}}};
const fs=require('fs'),path=require('path'),os=require('os');
const SRC=require('path').resolve(process.argv[2]), ORIG_ROOT=process.argv[3], CACHE=process.argv[4], ONLY=process.argv[5];
(0,eval)(fs.readFileSync(path.join(SRC,'lib/pdf-lib.min.js'),'utf8'));
global.window.PDFLib=global.window.PDFLib||globalThis.PDFLib;
const P=global.window.PDFLib;
global.window.RCSCrypto=require(path.join(SRC,'crypto.js'));
const D=require(path.join(SRC,'pdfdecrypt.js'));
const _b=path.join(os.tmpdir(),'rcs_td.'+process.pid+'.js');
process.on('exit',()=>{try{fs.rmSync(_b,{force:true});}catch(e){}});
fs.writeFileSync(_b,['templates.js','core.js','score.js','db.js','app.js','ocr.js','rcs.js']
  .map(x=>fs.readFileSync(path.join(SRC,x),'utf8')).join('\n')
  +'\nocrHalf=function(){return Promise.resolve(null);};\n'
  +'if(typeof module!=="undefined")Object.assign(module.exports,{__rsTextPageAt:rsTextPageAt});\n');
const app=require(_b);

function walk(d,base,out){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
  if(e.isDirectory())walk(p,base,out); else if(/\.pdf$/i.test(e.name))out.push(path.relative(base,p));} return out;}
async function textOf(bytes,maxPages){
  const doc=await P.PDFDocument.load(bytes,{ignoreEncryption:true,throwOnInvalidObject:false});
  const n=doc.getPageCount();
  const pages=[];
  for(let i=0;i<Math.min(n,maxPages);i++){
    let runs=[];try{runs=await app.__rsTextPageAt(doc,i);}catch(e){runs=[];}
    pages.push((runs||[]).map(r=>r.s).join('').replace(/\s+/g,' ').trim());
  }
  return {n,pages};
}

(async()=>{
  let rel=walk(CACHE,CACHE,[]).sort();
  if(ONLY)rel=rel.filter(r=>r.includes(ONLY));
  let pass=0,fail=0;
  for(const r of rel){
    const orig=path.join(ORIG_ROOT,r), mine=path.join(CACHE,r);
    const label=path.basename(r).slice(0,50).padEnd(52);
    let res;
    try{ res=await D.decrypt(new Uint8Array(fs.readFileSync(orig))); }
    catch(err){ console.log('  X '+label+' decrypt threw: '+err.message); fail++; continue; }
    if(!res.ok){ console.log('  X '+label+' '+res.reason); fail++; continue; }
    let ours,theirs;
    try{ ours=await textOf(res.bytes,6); }
    catch(err){ console.log('  X '+label+' pdf-lib rejected our output: '+String(err.message).slice(0,54)); fail++; continue; }
    try{ theirs=await textOf(new Uint8Array(fs.readFileSync(mine)),6); }
    catch(err){ console.log('  ? '+label+' oracle unreadable, skipping'); continue; }
    const samePages=ours.n===theirs.n;
    let sameText=0,cmp=0;
    for(let i=0;i<Math.min(ours.pages.length,theirs.pages.length);i++){
      cmp++;
      const a=ours.pages[i].replace(/\s/g,''), b=theirs.pages[i].replace(/\s/g,'');
      if(a===b)sameText++;
    }
    const ok=samePages&&cmp>0&&sameText===cmp;
    if(ok)pass++;else fail++;
    console.log('  '+(ok?'+':'X')+' '+label
      +' R'+res.info.R+' '+String(res.info.CFM||'-').padEnd(6)
      +' pages '+ours.n+'/'+theirs.n
      +'  text '+sameText+'/'+cmp
      +(res.validated?'':'  [U check failed]'));
    if(!ok&&ours.pages[0]!==undefined){
      console.log('      ours  : '+ours.pages[0].slice(0,72));
      console.log('      mupdf : '+theirs.pages[0].slice(0,72));
    }
  }
  console.log('\n  matched MuPDF: '+pass+'   failed: '+fail);
  process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exit(1);});
