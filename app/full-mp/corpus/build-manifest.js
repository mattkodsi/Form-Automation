#!/usr/bin/env node
/* build-manifest.js -- walk the filed packages and say, per property and per
   cycle, what went IN and what came OUT.

   Two rules, both learned by getting it wrong:

   1. RECURSE EVERYWHERE. The first pass descended only into folders whose name
      looked like a package, so it never opened Archive/ -- which is exactly
      where Oceanport and the Pines keep both their study and their filed
      submission. It then reported those properties as having no RCS year, which
      was a statement about the walker, not the corpus.

   2. A STUDY IS A FILE THE STUDY READER CAN READ. Five properties, five naming
      conventions: "25-119 - Lansing Manor...", "R1542R2017", "2019.09.04 - The
      Pines - Market Study Final", "VA-24-254925 - Oceanport Gardens - RCS",
      "RCS - The Pines, The Woodlands, TX". No pattern covers them. So we hand
      candidates to RCSParse.readLetter and let it answer -- which also runs the
      reader across the whole corpus and reports where it fails.

   Every property is known to have at least one RCS year. A property yielding no
   study is therefore a failure of this pass, and is reported as one.

   usage: node build-manifest.js <corpus-root> [out.json] [--limit N]
*/
global.CSS={escape:s=>s};
const mem={};
global.window={addEventListener:(e,cb)=>{if(e==='DOMContentLoaded')global.__ready=cb;},localStorage:{getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=v;},removeItem:k=>{delete mem[k];}},scrollY:0,scrollTo(){}};
function mk(id){return {id:id||'',style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},setAttribute(){},getAttribute(){return'';},appendChild(){},addEventListener(){},closest(){return null;},parentElement:null,querySelector(){return null;},querySelectorAll(){return[];},innerHTML:'',textContent:'',onclick:null,value:'',checked:false,focus(){},select(){},setSelectionRange(){},files:[]};}
const els={};
global.document={getElementById:id=>els[id]||(els[id]=mk(id)),querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>mk(),addEventListener(){},body:{classList:{toggle(){},contains(){return false;}}}};

const fs=require('fs'),path=require('path'),os=require('os');
const SRC=path.join(__dirname,'..');                       // app/full-mp
(0,eval)(fs.readFileSync(path.join(SRC,'lib/pdf-lib.min.js'),'utf8'));
global.window.PDFLib=global.window.PDFLib||globalThis.PDFLib;
const P=global.window.PDFLib;
const _b=path.join(os.tmpdir(),'rcs_manifest.'+process.pid+'.js');
process.on('exit',()=>{try{fs.rmSync(_b,{force:true});}catch(e){}});
fs.writeFileSync(_b,
   ['templates.js','core.js','score.js','db.js','app.js','ocr.js','rcs.js']
     .map(x=>fs.readFileSync(path.join(SRC,x),'utf8')).join('\n')
  +'\nocrHalf=function(){return Promise.resolve(null);};\n'
  +'if(typeof module!=="undefined")Object.assign(module.exports,{__rsTextPageAt:rsTextPageAt});\n');
const app=require(_b);
const R=global.window.RCSParse;

const args=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const ROOT=args[0], OUT=args[1]||path.join(__dirname,'corpus.json');
const LIMIT=(()=>{const i=process.argv.indexOf('--limit');return i>0?+process.argv[i+1]:0;})();
if(!ROOT||!fs.existsSync(ROOT)){console.error('corpus root not found: '+ROOT);process.exit(1);}

/* ---- walk ---------------------------------------------------------------- */
function walk(dir,rel,out){
  let ents=[];try{ents=fs.readdirSync(dir,{withFileTypes:true});}catch(e){return out;}
  for(const e of ents){
    if(/^~\$|^\./.test(e.name))continue;
    const abs=path.join(dir,e.name), r=rel?rel+'/'+e.name:e.name;
    if(e.isDirectory())walk(abs,r,out);
    else if(e.isFile()){
      let bytes=0;try{bytes=fs.statSync(abs).size;}catch(err){}
      out.push({rel:r,name:e.name,dir:rel,bytes,abs});
    }
  }
  return out;
}

/* ---- cycle attribution ---------------------------------------------------
   A file belongs to the cycle named by the FIRST path segment carrying a year.
   Files sitting loose at the property root belong to no cycle. */
function cycleOfPath(rel){
  for(const seg of rel.split('/').slice(0,-1)){
    const m=seg.match(/(20\d{2})/);
    if(m)return {key:seg,year:+m[1]};
  }
  return null;
}

/* ---- is this PDF a study? ------------------------------------------------ */
const SKIP=/invoice|engagement|certificat|w-?9\b|insurance|tax|deed|mortgage|hap contract|amend rents/i;
async function readsAsStudy(f){
  if(!/\.pdf$/i.test(f.name))return null;
  if(SKIP.test(f.name))return null;
  if(f.bytes<200*1024)return null;                        // a real report is not tiny
  let doc;
  try{ doc=await P.PDFDocument.load(new Uint8Array(fs.readFileSync(f.abs)),{ignoreEncryption:true,throwOnInvalidObject:false}); }
  catch(e){ return {error:'unreadable pdf: '+e.message}; }
  const rd={pageCount:doc.getPageCount(),hits:0,
            getPage:async i=>{rd.hits++;return await app.__rsTextPageAt(doc,i);}};
  let rec=null;
  try{ rec=await R.readLetter(rd); }catch(e){ return {error:'readLetter threw: '+e.message,pages:rd.pageCount}; }
  if(!rec)return null;
  const sc=rec.scalars||{};
  const out={firm:rec.firm||null, s8:sc['property.s8']||null, name:sc['property.name']||null,
             units:(rec.units||[]).length, pagesRead:rd.hits, pageCount:doc.getPageCount()};
  /* readLetter returns a record for documents that are not studies at all --
     OCAF letters, rent schedules, non-compliance notices -- with every field
     null. On the first three properties that was 73 of 84 "hits". A truthy
     return is therefore not evidence; a firm, a contract number or a unit grid
     is. Kept as OR rather than requiring a firm, so a study from a firm rcs.js
     does not yet recognise still counts. */
  if(!(out.firm||out.s8||out.units>0))return null;
  return out;
}

/* ---- filed-output classification (filenames are fine for these) ---------- */
const RULES=[
  ['analysisXlsx',   f=>/\.xlsx?$/i.test(f)&&/analysis/i.test(f)],
  ['submittalLetter',f=>/submittal/i.test(f)&&/letter/i.test(f)],
  ['checklist',      f=>/checklist/i.test(f)],
  ['tenantNotice',   f=>/tenant notice/i.test(f)||/\b30[- ]day notice/i.test(f)],
  ['coverLetter',    f=>/cover letter/i.test(f)],
  ['combinedPackage',f=>/submission|rcs p(ac)?k(a)?g/i.test(f)&&/\.pdf$/i.test(f)],
  ['rentSchedule',   f=>/(rent[_ ]schedule|\bRS\b|92458)/i.test(f)],
];
const isExecuted=f=>/approved|executed|fully.?exec/i.test(f);
function classifyName(f){
  for(const [k,t] of RULES)if(t(f))return k;
  return null;
}

(async()=>{
  let dirs=fs.readdirSync(ROOT,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();
  if(LIMIT)dirs=dirs.slice(0,LIMIT);
  const properties=[]; let scanned=0,studyHits=0,readErrors=[];
  for(const folder of dirs){
    const m=folder.match(/^(\S+)\s*-\s*(.+?)\s*-\s*Section 8/i);
    const files=walk(path.join(ROOT,folder),'',[]);
    process.stderr.write('  '+folder+' ('+files.length+' files) ');
    const cycles={};
    const add=(key,year,bucket,rec)=>{
      const c=cycles[key]=cycles[key]||{cycleLabel:key,year,studies:[],docs:{},executedRs:[]};
      if(bucket==='study')c.studies.push(rec);
      else if(bucket==='executedRs')c.executedRs.push(rec);
      else (c.docs[bucket]=c.docs[bucket]||[]).push(rec);
    };
    for(const f of files){
      const cy=cycleOfPath(f.rel);
      const kind=classifyName(f.name);
      if(kind==='rentSchedule'&&isExecuted(f.name)){ if(cy)add(cy.key,cy.year,'executedRs',{file:f.rel,bytes:f.bytes}); continue; }
      if(kind&&cy){ add(cy.key,cy.year,kind,{file:f.rel,bytes:f.bytes}); continue; }
      // study candidates: content-tested, cycle or not
      const st=await readsAsStudy(f);
      scanned++;
      if(st&&st.error){readErrors.push({property:m?m[2]:folder,file:f.rel,error:st.error});continue;}
      if(st){ studyHits++;
        if(cy)add(cy.key,cy.year,'study',Object.assign({file:f.rel,bytes:f.bytes},st));
        else add('(no cycle folder)',null,'study',Object.assign({file:f.rel,bytes:f.bytes},st));
      }
    }
    const list=Object.values(cycles).filter(c=>c.studies.length)
      .sort((a,b)=>(b.year||0)-(a.year||0));
    list.forEach(c=>{
      const prior=Object.values(cycles).filter(x=>x.year===(c.year-1)).flatMap(x=>x.executedRs);
      c.priorRs=prior.length?prior[0].file:null;
      const missing=['coverLetter','submittalLetter','checklist','tenantNotice']
        .filter(k=>!c.docs[k]||!c.docs[k].length);
      c.hasCombined=!!(c.docs.combinedPackage&&c.docs.combinedPackage.length);
      c.problems=[];
      if(!c.priorRs)c.problems.push('no year -1 executed rent schedule');
      if(missing.length&&!c.hasCombined)c.problems.push('no filed '+missing.join(', '));
      if(c.studies.length>1)c.problems.push(c.studies.length+' study candidates');
    });
    list.forEach((c,i)=>c.wave=(c===(list.find(x=>x.priorRs)||list[0]))?1:2);
    properties.push({code:m?m[1]:null,name:m?m[2]:folder,folder,fileCount:files.length,cycles:list});
    process.stderr.write('-> '+list.length+' RCS cycle(s)\n');
  }
  fs.writeFileSync(OUT,JSON.stringify({root:ROOT,properties,readErrors},null,2));

  const none=properties.filter(p=>!p.cycles.length);
  const w1=properties.filter(p=>p.cycles.some(c=>c.wave===1));
  const clean=properties.filter(p=>p.cycles.some(c=>c.wave===1&&!c.problems.length));
  console.log('\n'+'='.repeat(66));
  console.log('properties            : '+properties.length);
  console.log('PDFs content-tested   : '+scanned+'   read as a study: '+studyHits);
  console.log('with an RCS cycle     : '+(properties.length-none.length));
  console.log('wave-1 cycle chosen   : '+w1.length+'   of those with no open questions: '+clean.length);
  console.log('readLetter errors     : '+readErrors.length);
  if(none.length){
    console.log('\nXXX EVERY PROPERTY IS KNOWN TO HAVE AN RCS YEAR -- these yielded none,');
    console.log('    which is a failure of this pass, not an absent cycle:');
    none.forEach(p=>console.log('      - '+p.name+'  ('+p.fileCount+' files walked)'));
    process.exitCode=1;
  }
  if(readErrors.length){
    console.log('\nreadLetter could not read these (scanner findings, not manifest bugs):');
    readErrors.slice(0,12).forEach(e=>console.log('      - '+e.property+': '+e.file+'  -- '+e.error));
  }
  console.log('\nwritten to '+OUT);
})().catch(e=>{console.error(e);process.exit(1);});
