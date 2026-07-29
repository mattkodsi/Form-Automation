#!/usr/bin/env node
/* build-manifest.js -- walk the filed packages and say, per property and per
   cycle, what went IN and what came OUT.

   This file guesses. It is not allowed to pretend otherwise: every cycle it
   emits carries `confident` and `problems`, and every file it could not place
   stays visible in `unclassified`. A misfiled input produces a confident,
   fabricated discrepancy, which costs more diagnosis time than having no result
   at all -- so the manifest is a proposal for review, never an answer.

   usage: node build-manifest.js <corpus-root> [out.json]
*/
const fs=require('fs'),path=require('path');

const ROOT=process.argv[2];
const OUT=process.argv[3]||path.join(__dirname,'corpus.json');
if(!ROOT||!fs.existsSync(ROOT)){console.error('corpus root not found: '+ROOT);process.exit(1);}

const ls=d=>{try{return fs.readdirSync(d,{withFileTypes:true});}catch(e){return [];}};
const isDir=e=>e.isDirectory();
const low=s=>s.toLowerCase();

/* ---- which folders are cycles -------------------------------------------
   Year folders are named every way a human names them: "2025", "2026 - RCS",
   "2026 (RCS)", "RCS". The year is what matters; the RCS marker only tells us
   the cycle is likelier to hold a study. */
function cycleOf(name){
  const m=name.match(/(20\d{2})/);
  if(!m)return null;
  return {year:+m[1], rcsMarked:/rcs/i.test(name), label:name};
}

/* ---- document classification --------------------------------------------
   Order matters: "Submittal Cover Letter" must be tested before "Cover Letter",
   or every submittal letter is filed as a cover letter. */
const RULES=[
  ['analysisXlsx',   f=>/\.xlsx?$/i.test(f) && /analysis/i.test(f)],
  ['submittalLetter',f=>/submittal/i.test(f) && /letter/i.test(f)],
  ['checklist',      f=>/checklist/i.test(f)],
  ['tenantNotice',   f=>/tenant notice/i.test(f) || /\b30[- ]day notice/i.test(f)],
  ['coverLetter',    f=>/cover letter/i.test(f)],
  ['rentSchedule',   f=>/(rent schedule|\bRS\b|92458)/i.test(f)],
];
/* A study is the appraiser's report: a job number like 25-119, or a firm name,
   on a PDF large enough to be a real report. */
function looksStudy(f,bytes){
  if(!/\.pdf$/i.test(f))return false;
  if(/invoice|engagement/i.test(f))return false;
  return (/\b\d{2}-\d{3}\b/.test(f) || /belfry|cornerstone/i.test(f)) && bytes>400*1024;
}
/* An executed/approved schedule is what HUD sent back -- it is the NEXT cycle's
   year -1 input, and must not be mistaken for the draft we generate. */
const isExecuted=f=>/approved|executed|fully executed/i.test(f);

function classify(dir){
  const out={files:[],unclassified:[],study:null,rentScheduleExecuted:[],docs:{}};
  for(const e of ls(dir)){
    if(!e.isFile())continue;
    const f=e.name;
    if(/^~\$|^\./.test(f))continue;
    let bytes=0;try{bytes=fs.statSync(path.join(dir,f)).size;}catch(err){}
    const rec={name:f,bytes};
    out.files.push(rec);
    if(looksStudy(f,bytes)){
      // prefer the copy without "(updated)" -- the numbered package item is what was filed
      if(!out.study || (/\(updated\)/i.test(out.study.name) && !/\(updated\)/i.test(f)))out.study=rec;
      continue;
    }
    let hit=null;
    for(const [key,test] of RULES){ if(test(f)){hit=key;break;} }
    if(hit==='rentSchedule'&&isExecuted(f)){ out.rentScheduleExecuted.push(rec); continue; }
    if(hit){ (out.docs[hit]=out.docs[hit]||[]).push(rec); continue; }
    out.unclassified.push(rec);
  }
  return out;
}

/* Walk one property: its cycle folders, plus any nested package folder. */
function readProperty(pdir){
  const cycles={};
  for(const e of ls(pdir)){
    if(!isDir(e))continue;
    const c=cycleOf(e.name);
    if(!c)continue;
    let dir=path.join(pdir,e.name);
    // Colonial Village nests the package one level down.
    const nested=ls(dir).filter(isDir).find(x=>/rcs package|package|submission/i.test(x.name));
    const here=classify(dir);
    let merged=here;
    if(nested){
      const deep=classify(path.join(dir,nested.name));
      merged={files:here.files.concat(deep.files),
              unclassified:here.unclassified.concat(deep.unclassified),
              study:here.study||deep.study,
              rentScheduleExecuted:here.rentScheduleExecuted.concat(deep.rentScheduleExecuted),
              docs:Object.assign({},here.docs)};
      for(const k of Object.keys(deep.docs))merged.docs[k]=(merged.docs[k]||[]).concat(deep.docs[k]);
      merged.nestedIn=nested.name;
    }
    merged.label=e.name; merged.year=c.year; merged.rcsMarked=c.rcsMarked;
    // last one wins only if it carries more; otherwise keep both under distinct labels
    cycles[e.name]=merged;
  }
  return cycles;
}

/* A cycle is runnable when it has a study (year 0) and we can find the prior
   year's executed schedule (year -1) somewhere in the property. */
function buildProperty(name,pdir){
  const cycles=readProperty(pdir);
  const years=Object.values(cycles);
  const out=[];
  for(const c of years){
    if(!c.study)continue;                       // no study, no RCS cycle
    const prior=years.filter(x=>x.year===c.year-1)
                     .flatMap(x=>x.rentScheduleExecuted.map(r=>({cycle:x.label,file:r})));
    // fall back: an executed schedule inside the same cycle folder predating it
    const problems=[];
    if(!prior.length)problems.push('no year -1 executed rent schedule found');
    const missing=['coverLetter','submittalLetter','checklist','tenantNotice','analysisXlsx']
      .filter(k=>!c.docs[k]||!c.docs[k].length);
    if(missing.length)problems.push('no filed '+missing.join(', '));
    const multi=Object.keys(c.docs).filter(k=>c.docs[k].length>1);
    if(multi.length)problems.push('more than one candidate for '+multi.join(', '));
    out.push({
      year0:c.year, cycleLabel:c.label, nestedIn:c.nestedIn||null,
      inputs:{ study:c.study.name, priorRs:prior.length?prior[0].file.name:null,
               priorRsCycle:prior.length?prior[0].cycle:null },
      expected:Object.fromEntries(Object.entries(c.docs).map(([k,v])=>[k,v.map(x=>x.name)])),
      unclassified:c.unclassified.map(x=>x.name),
      problems, confident:problems.length===0,
    });
  }
  out.sort((a,b)=>b.year0-a.year0);
  out.forEach((c,i)=>{c.wave=null;});
  // wave 1 = most recent cycle that is runnable (study AND prior RS present)
  const w1=out.find(c=>c.inputs.priorRs) || out[0];
  out.forEach(c=>{c.wave=(c===w1)?1:2;});
  return out;
}

const props=[];
for(const e of ls(ROOT)){
  if(!isDir(e))continue;
  const m=e.name.match(/^(\S+)\s*-\s*(.+?)\s*-\s*Section 8/i);
  const cycles=buildProperty(e.name,path.join(ROOT,e.name));
  props.push({ code:m?m[1]:null, name:m?m[2]:e.name, folder:e.name,
               cycles, runnable:cycles.some(c=>c.wave===1&&c.inputs.priorRs) });
}
props.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
fs.writeFileSync(OUT,JSON.stringify({root:ROOT,builtFrom:'filesystem walk',properties:props},null,2));

/* ---- report -------------------------------------------------------------- */
const total=props.length;
const withCycle=props.filter(p=>p.cycles.length).length;
const runnable=props.filter(p=>p.runnable).length;
const confident=props.filter(p=>p.cycles.some(c=>c.wave===1&&c.confident)).length;
console.log('properties found          : '+total);
console.log('with at least one RCS cycle: '+withCycle);
console.log('wave-1 runnable (study + year -1 RS): '+runnable);
console.log('  of those, no open questions      : '+confident);
console.log('total cycles with a study : '+props.reduce((n,p)=>n+p.cycles.length,0));
console.log('\nwritten to '+OUT+'\n');
console.log('NEEDS REVIEW — properties with no runnable wave-1 cycle:');
props.filter(p=>!p.runnable).forEach(p=>{
  const why=p.cycles.length?p.cycles.map(c=>c.year0+': '+c.problems.join('; ')).join('  |  '):'no cycle folder with a study';
  console.log('  - '+p.name+'  ('+why+')');
});
