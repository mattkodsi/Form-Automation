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
/* Twenty studies are locked with a PDF security handler and pdf-lib will not
   open them; decrypt-cache.js has already written unlocked copies at the same
   relative path. Prefer those, so the firms behind those twenty -- MVS among
   them -- reach the reader instead of being logged as read errors. */
const CACHE=(()=>{const i=process.argv.indexOf('--cache');return i>0?process.argv[i+1]:null;})();
const readable=abs=>{
  if(!CACHE)return abs;
  const c=path.join(CACHE,path.relative(ROOT,abs));
  return fs.existsSync(c)?c:abs;
};
if(!ROOT||!fs.existsSync(ROOT)){console.error('corpus root not found: '+ROOT);process.exit(1);}

/* ---- walk ---------------------------------------------------------------- */
function walk(dir,rel,out){
  let ents=[];try{ents=fs.readdirSync(dir,{withFileTypes:true});}catch(e){return out;}
  for(const e of ents){
    if(/^~\$|^\./.test(e.name))continue;
    const abs=path.join(dir,e.name), r=rel?rel+'/'+e.name:e.name;
    if(e.isDirectory())walk(abs,r,out);
    else if(e.isFile()){
      let bytes=0,mtime=0;
      try{const s=fs.statSync(abs);bytes=s.size;mtime=s.mtimeMs;}catch(err){}
      out.push({rel:r,name:e.name,dir:rel,bytes,mtime,abs});
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
  /* One try around everything, because pdf-lib parses lazily: load() accepts a
     document whose page tree is broken and only throws later, at getPageCount.
     Sycamore Green has such a file, and it killed a 34-property run from
     outside a catch that only wrapped load(). No single document may end the
     sweep -- an unreadable one is a result, recorded and moved past. */
  let rec=null, rd=null;
  const src=readable(f.abs), unlocked=src!==f.abs;
  try{
    const doc=await P.PDFDocument.load(new Uint8Array(fs.readFileSync(src)),{ignoreEncryption:true,throwOnInvalidObject:false});
    rd={pageCount:doc.getPageCount(),hits:0,
        getPage:async i=>{rd.hits++;return await app.__rsTextPageAt(doc,i);}};
    rec=await R.readLetter(rd);
  }catch(e){ return {error:String(e&&e.message||e).slice(0,120)}; }
  if(!rec)return null;
  const sc=rec.scalars||{};
  const out={firm:rec.firm||null, s8:sc['property.s8']||null, name:sc['property.name']||null,
             units:(rec.units||[]).length, pagesRead:rd.hits, pageCount:rd.pageCount,
             unlocked:unlocked||undefined};
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
function classifyName(f){
  for(const [k,t] of RULES)if(t(f))return k;
  return null;
}

/* ---- ranking rent schedules ----------------------------------------------
   AN EXECUTED SCHEDULE DOES NOT ALWAYS SAY SO. The first pass kept only files
   matching /approved|executed/ and then looked for one in the year -1 folder,
   which left 13 of 34 properties with "no year -1 executed rent schedule".
   That was a statement about the regex, not the corpus: Northcross's 2023
   schedule says "(signed)", Westwood's 2024 and Walden's 2024 and 333 Holly's
   2024 carry no qualifier at all. All four are the real filed schedule.

   So rank, do not filter. Everything the classifier calls a rent schedule is a
   candidate; a draft or an unsigned copy ranks below a signed one but is still
   kept, so a property whose only surviving copy is a draft stays runnable and
   says so in priorRsRule rather than vanishing. */
function rsRank(rel){
  let s=0;
  if(/fully.?exec|executed|final.?approv|\bapproved\b/i.test(rel))s+=6;
  else if(/\(signed\)|[ _.-]signed\b|owner.?signed/i.test(rel))s+=5;
  else if(/\bfinal\b/i.test(rel))s+=3;
  if(/\bdrafts?\b|proposed/i.test(rel))s-=6;
  if(/unsigned|\btbs\b/i.test(rel))s-=4;
  if(/(^|\/)(archive|_?old)\//i.test(rel))s-=1;
  return s;
}
/* Years a filename claims, four-digit or two-digit-in-a-date. "eff. 8.1.24",
   "Rent_Schedule_Eff_7-1-24" and "10-1-2023" all have to resolve. */
function yearsInName(rel){
  const ys=new Set();
  for(const m of rel.matchAll(/(20\d{2})/g))ys.add(+m[1]);
  for(const m of rel.matchAll(/\b\d{1,2}[._\-/]\d{1,2}[._\-/](\d{2})\b/g))ys.add(2000+ +m[1]);
  return ys;
}
const pickBest=(arr,key)=>arr.slice().sort((a,b)=>key(b)-key(a))[0];

/* ---- ranking study candidates --------------------------------------------
   26 properties file more than one. Taking the first was arbitrary; these are
   the distinctions the PM team's own naming actually draws. */
function studyRank(rel,mtime){
  let s=0;
  if(/\bfinal\b/i.test(rel))s+=6;
  if(/\bdrafts?\b/i.test(rel))s-=8;
  if(/(^|\/)\d+\s*-\s/.test(rel))s+=4;            // a numbered package item
  if(/\bv\d+\b|updated|revised/i.test(rel))s+=2;  // a later revision of the same study
  if(/(^|\/)(archive|_?old)\//i.test(rel))s-=5;
  return s+Math.min(1,(mtime||0)/1e15);           // mtime breaks exact ties only
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
    const rsAll=[];                       // every rent schedule in the property, cycle or not
    const add=(key,year,bucket,rec)=>{
      const c=cycles[key]=cycles[key]||{cycleLabel:key,year,studies:[],docs:{},executedRs:[]};
      if(bucket==='study')c.studies.push(rec);
      else (c.docs[bucket]=c.docs[bucket]||[]).push(rec);
    };
    for(const f of files){
      const cy=cycleOfPath(f.rel);
      const kind=classifyName(f.name);
      if(kind==='rentSchedule'){
        /* Flat, and independent of whether the folder ever produced a study --
           the year -1 schedule lives in a plain year folder that has no study
           in it, so it exists only in this list. */
        rsAll.push({file:f.rel,bytes:f.bytes,rank:rsRank(f.rel),
                    cycleYear:cy?cy.year:null,nameYears:[...yearsInName(f.rel)]});
      }
      if(kind&&cy){ add(cy.key,cy.year,kind,{file:f.rel,bytes:f.bytes}); continue; }
      if(kind)continue;                   // classified but loose at the property root
      // study candidates: content-tested, cycle or not
      const st=await readsAsStudy(f);
      scanned++;
      if(st&&st.error){readErrors.push({property:m?m[2]:folder,file:f.rel,error:st.error});continue;}
      if(st){ studyHits++;
        const rec=Object.assign({file:f.rel,bytes:f.bytes,rank:studyRank(f.rel,f.mtime)},st);
        if(cy)add(cy.key,cy.year,'study',rec);
        else add('(no cycle folder)',null,'study',rec);
      }
    }
    const list=Object.values(cycles).filter(c=>c.studies.length)
      .sort((a,b)=>(b.year||0)-(a.year||0));
    list.forEach(c=>{
      /* The prior schedule, in four descending degrees of confidence. Which
         rule fired is recorded, because "found it in the 2023 folder" and
         "took the newest thing older than 2024" are not the same claim and a
         reader must be able to tell them apart. */
      const y1=c.year-1;
      const tries=[];
      let hit=null,rule=null;
      const attempt=(name,pool)=>{
        tries.push(name+'('+pool.length+')');
        if(!hit&&pool.length){hit=pickBest(pool,x=>x.rank);rule=name;}
      };
      attempt('year-1 folder',       rsAll.filter(x=>x.cycleYear===y1));
      attempt('year-1 in the name',  rsAll.filter(x=>x.nameYears.includes(y1)));
      const older=rsAll.filter(x=>(x.cycleYear||Math.max(0,...x.nameYears))<c.year
                                 &&(x.cycleYear||Math.max(0,...x.nameYears))>0);
      attempt('newest before year 0',
        older.length?[pickBest(older,x=>(x.cycleYear||Math.max(0,...x.nameYears))*100+x.rank)]:[]);
      c.priorRs=hit?hit.file:null;
      c.priorRsRule=rule;
      c.priorRsRank=hit?hit.rank:null;
      c.priorRsTried=tries;

      /* One study is chosen, but every candidate is kept: the choice is a
         guess we might be wrong about, and hiding the runners-up would make
         that unfalsifiable. */
      c.studies.sort((a,b)=>b.rank-a.rank);
      c.chosenStudy=c.studies.length?c.studies[0].file:null;

      const missing=['coverLetter','submittalLetter','checklist','tenantNotice']
        .filter(k=>!c.docs[k]||!c.docs[k].length);
      c.hasCombined=!!(c.docs.combinedPackage&&c.docs.combinedPackage.length);
      c.problems=[];c.notes=[];
      if(!c.priorRs)c.problems.push('no prior rent schedule found; tried '+tries.join(', '));
      else if(rule!=='year-1 folder')c.problems.push('prior RS found by fallback: '+rule);
      else if(hit.rank<0)c.problems.push('prior RS is a draft or an unsigned copy');
      /* Rank 0 is the common case, not a defect: most filed schedules simply
         do not put "executed" in the filename. Worth saying, not worth
         holding a property back for. */
      else if(hit.rank===0)c.notes.push('prior RS filename carries no signed/executed marker');
      if(missing.length&&!c.hasCombined)c.problems.push('no filed '+missing.join(', '));
      if(c.studies.length>1&&(c.studies[0].rank-c.studies[1].rank)<=1)
        c.problems.push('top two studies are within one rank; the choice is a coin toss');
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

  const w1c=properties.map(p=>(p.cycles||[]).find(c=>c.wave===1)).filter(Boolean);
  const byRule={};
  w1c.forEach(c=>{byRule[c.priorRsRule||'NONE']=(byRule[c.priorRsRule||'NONE']||0)+1;});
  console.log('\nprior rent schedule, by which rule found it:');
  Object.keys(byRule).sort().forEach(k=>console.log('  '+String(byRule[k]).padStart(3)+'  '+k));
  console.log('\nrunnable wave-1 pairs (a study AND a prior RS): '
    +w1c.filter(c=>c.priorRs&&c.chosenStudy).length+' of '+properties.length);
  const coin=w1c.filter(c=>c.problems.some(x=>/coin toss/.test(x)));
  console.log('study choice is a coin toss for       : '+coin.length);
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
