#!/usr/bin/env node
/* sweep.js -- the loop the whole project exists to run.

   For each property: drive the real app twice, once filling the rent schedule
   first and once the study first, extract facts from what it generated and
   from what the PM team actually filed, and compare.

   Three rules this file exists to enforce:

   1. THE APP IS FROZEN FOR THE DURATION OF A SWEEP. The commit SHA is recorded
      in every output. A moving app makes property 3 and property 30
      incomparable and the whole run worthless.

   2. RESULTS ARE GROUPED BY CAUSE, THEN BY KEY -- never by property. The point
      is seeing that one defect hits nineteen properties, which a per-property
      report hides completely.

   3. A RUN THAT PRODUCED NOTHING IS RECORDED, NOT DROPPED. A property whose
      rent schedule the app could not read has zero comparison rows, and zero
      rows must never read as agreement. Every property carries an explicit
      `verdict` saying which of those two it is.

   Resumable: each property writes its own file, and a second invocation skips
   what is already on disk unless --force. A crash on property 30 costs one
   property, not the night.

   usage:
     node sweep.js <corpusRoot> <cacheRoot> <corpus.json> [options]
       --out DIR        where results land (default <cacheRoot>/_sweep)
       --only A,B,C     property names or codes, comma-separated
       --limit N        first N properties
       --jobs N         concurrent chromium instances (default 3)
       --force          re-run properties already on disk
       --stale-ok       reuse records built by a DIFFERENT app commit
                        (off by default: a record from another build answers a
                        question about that build, not this one)
       --label NAME     names the output files (default sweep-1)
*/
const fs=require('fs'),path=require('path'),cp=require('child_process');
const {driveOne}=require('./drive.js');
const {assertNotMain}=require('./drive.js');
const {extractFacts}=require('./extract.js');
const {compareFacts,compareRuns,renderMarkdown}=require('./compare.js');

assertNotMain('sweep.js');   // before anything else: see drive.js
const argv=process.argv.slice(2);
const flag=(n,d)=>{const i=argv.indexOf('--'+n);return i>=0?argv[i+1]:d;};
const has=n=>argv.includes('--'+n);
/* Flags that take a value swallow the next argument; --force does not. Getting
   this wrong silently turns a flag's value into the corpus root. */
const VALUED=new Set(['out','only','limit','jobs','label']);
const positional=[];
for(let i=0;i<argv.length;i++){
  const a=argv[i];
  if(a.startsWith('--')){ if(VALUED.has(a.slice(2)))i++; continue; }
  positional.push(a);
}
const [CORPUS,CACHE,MANIFEST]=positional;
if(!CORPUS||!CACHE||!MANIFEST){
  console.log('usage: node sweep.js <corpusRoot> <cacheRoot> <corpus.json> [--only …] [--limit N] [--jobs N] [--force] [--stale-ok] [--label NAME]');
  process.exit(2);
}
const OUT=flag('out',path.join(CACHE,'_sweep'));
const LABEL=flag('label','sweep-1');
const JOBS=Math.max(1,+flag('jobs',3));
const LIMIT=+flag('limit',0)||0;
const ONLY=(flag('only','')||'').split(',').map(s=>s.trim()).filter(Boolean);
const FORCE=has('force');
/* Opts back into reusing records from another build. Named for what it costs. */
const STALE_OK=has('stale-ok');
fs.mkdirSync(OUT,{recursive:true});

const SHA=(()=>{try{return cp.execSync('git rev-parse --short HEAD',{cwd:path.join(__dirname,'..','..','..')}).toString().trim();}catch(e){return 'unknown';}})();

const man=JSON.parse(fs.readFileSync(MANIFEST,'utf8'));
const resolveIn=(folder,rel)=>{
  if(!rel)return null;
  const c=path.join(CACHE,folder,rel);
  return fs.existsSync(c)?c:path.join(CORPUS,folder,rel);
};

/* ---- which filed document is which ---------------------------------------
   Prefer a signed/executed copy, and prefer the combined package when one
   exists: it is what was actually sent, and its constituent documents are the
   ones the PM team stood behind. */
const rank=(f,dt)=>{
  let s=0;
  if(/fully.?exec|executed|\(signed\)|[ _.-]signed\b/i.test(f))s+=5;
  if(/\bfinal\b/i.test(f))s+=2;
  if(/unsigned|\bdrafts?\b|tbs/i.test(f))s-=5;
  if(/(^|\/)(archive|_?old)\//i.test(f))s-=2;
  /* Lansing files two workbooks: 'Senior World - RCS Analysis.xlsx' and
     'Senior World - SAFMR Analysis.xlsx'. They rank equally on the generic
     rules, so the first one won and the comparison graded our RCS analysis
     against their SAFMR analysis -- fourteen differences that were entirely
     the harness picking the wrong file. */
  if(dt==='analysisXlsx'){
    if(/rcs analysis/i.test(f))s+=6;
    if(/safmr/i.test(f))s-=6;
  }
  return s;
};
const best=(list,dt)=>(list&&list.length)?list.slice().sort((a,b)=>rank(b.file,dt)-rank(a.file,dt))[0].file:null;

/* Our generated file names vary; map them onto docTypes by what they say. */
function docTypeOfOurs(name){
  const n=name.toLowerCase();
  if(/\.xlsx?$/.test(n))return 'analysisXlsx';
  if(/analysis/.test(n))return 'analysisXlsx';
  if(/submittal/.test(n))return 'submittalLetter';
  if(/checklist/.test(n))return 'checklist';
  if(/notice/.test(n))return 'tenantNotice';
  if(/rent ?schedule|92458/.test(n))return 'rentSchedule';
  if(/owner/.test(n))return 'ownerLetter';
  if(/cover|letter/.test(n))return 'coverLetter';
  if(/package|submission/.test(n))return 'combinedPackage';
  if(/report|rcs/.test(n))return 'rcsStudy';
  return null;
}

async function factsOfOurs(outDir,files){
  const out={};const notes=[];
  for(const f of files){
    const name=f.name||f.file||'';
    const dt=docTypeOfOurs(name);
    if(!dt||dt==='rcsStudy'||dt==='combinedPackage')continue;
    const abs=path.join(outDir,f.file||name);
    let bytes;try{bytes=new Uint8Array(fs.readFileSync(abs));}catch(e){notes.push('unreadable: '+name);continue;}
    try{out[dt]=await extractFacts(bytes,dt);}
    catch(e){notes.push(dt+': '+String(e.message).slice(0,80));}
  }
  return {facts:out,notes};
}

async function factsOfFiled(folder,cycle){
  const out={};const notes=[];
  const combined=best(cycle.docs.combinedPackage,'combinedPackage');
  if(combined){
    const abs=resolveIn(folder,combined);
    try{
      const r=await extractFacts(new Uint8Array(fs.readFileSync(abs)),'combinedPackage');
      /* combinedPackage returns a map of docType -> facts, plus its own keys */
      for(const k of Object.keys(r))if(r[k]&&r[k].values)out[k]=r[k];
      notes.push('filed side read from the combined package: '+path.basename(combined));
    }catch(e){notes.push('combined package unreadable: '+String(e.message).slice(0,80));}
  }
  /* Individually filed documents fill any gap the combined package left, and
     are preferred when the combined one produced nothing for that type. */
  for(const dt of ['coverLetter','submittalLetter','checklist','tenantNotice','rentSchedule','analysisXlsx']){
    if(out[dt]&&Object.keys(out[dt].values||{}).length)continue;
    const f=best(cycle.docs[dt],dt);
    if(!f)continue;
    const abs=resolveIn(folder,f);
    try{out[dt]=await extractFacts(new Uint8Array(fs.readFileSync(abs)),dt);
        notes.push(dt+' read from '+path.basename(f));}
    catch(e){notes.push(dt+' unreadable: '+String(e.message).slice(0,70));}
  }
  return {facts:out,notes};
}

async function runProperty(p){
  const cycle=(p.cycles||[]).find(c=>c.wave===1);
  const rec={property:p.name,code:p.code,folder:p.folder,year:cycle&&cycle.year,
             sha:SHA,orders:{},rows:[],fillOrder:[],drift:[],notes:[],verdict:null};
  if(!cycle||!cycle.chosenStudy){rec.verdict='no wave-1 cycle';return rec;}
  rec.inputs={study:cycle.chosenStudy,priorRs:cycle.priorRs,priorRsRule:cycle.priorRsRule};

  const perOrder={};
  for(const order of ['rs-first','rcs-first']){
    let r;
    try{
      r=await driveOne({propertyFolder:p.folder,studyPath:cycle.chosenStudy,
        priorRsPath:cycle.priorRs,order,outRoot:path.join(OUT,'_out'),
        corpusRoot:CORPUS,cacheRoot:CACHE,propertyCode:p.code,propertyName:p.name});
    }catch(e){
      rec.orders[order]={error:String(e.message).slice(0,160),files:0};
      rec.notes.push(order+': drive threw -- '+String(e.message).slice(0,120));
      continue;
    }
    const {facts,notes}=await factsOfOurs(r.outDir,r.files||[]);
    perOrder[order]=facts;
    rec.orders[order]={
      files:(r.files||[]).length, tier:r.tier, weakerTest:!!r.weakerTest,
      /* WHAT WE ACTUALLY PAID, and the only field here that knows. `tier` comes
         from the app's own `via`, which names the FUNCTION that assembled the
         record, not where its values came from: rsReadTextTier calls ocrHalf
         (app.js:1777 and 1805) and then reports via:'text' regardless. Lansing
         Manor's unit rows arrive through that page-0 tick-box call, which fills
         blank value fields as well as boxes, and the app labels the result a
         text read. Made Azure unreachable and the same file yields zero unit
         rows — so the values are Azure's and nothing in the app records it.
         ocrCalls counts real HTTP requests to the ocr-rs endpoint, observed by
         a fetch wrapper installed before the app's own script. For a question
         about billing it is the instrument; `tier` is not. */
      ocrCalls:(r.uploads&&r.uploads.ocrCalls)||0,
      via:(r.uploads&&r.uploads.rs&&r.uploads.rs.via)||null,
      missing:r.missing||null, warnings:r.warnings||[], errors:r.errors||[],
      docsExtracted:Object.keys(facts)
    };
    notes.forEach(n=>rec.notes.push(order+': '+n));
  }

  /* The highest-value comparison in the project, and it needs no ground truth:
     the same inputs in two orders must produce the same package. */
  if(perOrder['rs-first']&&perOrder['rcs-first']){
    try{rec.fillOrder=compareRuns(perOrder['rs-first'],perOrder['rcs-first'],{property:p.name})||[];}
    catch(e){rec.notes.push('compareRuns threw: '+String(e.message).slice(0,100));}
  }

  const ours=perOrder['rs-first']||perOrder['rcs-first'];
  if(!ours||!Object.keys(ours).length){
    rec.verdict='the app generated nothing comparable';
    return rec;
  }
  const filed=await factsOfFiled(p.folder,cycle);
  filed.notes.forEach(n=>rec.notes.push('filed: '+n));
  if(!Object.keys(filed.facts).length){rec.verdict='no filed package could be read';return rec;}

  /* A DOCUMENT THE APP NEVER WROTE IS ONE FINDING, NOT THIRTY.
     Lansing's first run produced 67 "differences", of which 30 were every
     field of five documents the app declined to generate because it could not
     read the rent schedule. Comparing those fields restates a single root
     cause once per field and buries the handful of real ones. So compare only
     the documents both sides actually have, and record the rest as what they
     are: a document not generated, with the app's own reason. */
  /* A FILED WORKBOOK MAY COVER MORE THAN ONE PROPERTY. Colonial Village's holds
     a sheet for it and a sheet for White Oak Townhomes, which share its
     contract, and reading the first one compared our figures against the wrong
     development -- 55 differences that were entirely this.

     The sheet is chosen by UNIT COUNTS, not by which one agrees with us most
     overall. A unit count is a fact of the property that both documents state
     independently, so matching on it identifies the sheet without letting the
     choice be steered by the very values under test. The decision is written
     into the notes either way. */
  const fx=filed.facts.analysisXlsx;
  if(fx&&fx.sheets&&fx.sheets.length>1&&ours.analysisXlsx){
    const countsOf=v=>new Set(Object.keys(v||{}).filter(k=>/^unit\.\d+\.units$/.test(k))
      .map(k=>String(v[k])).filter(x=>x&&x!=='0'));
    const mine=countsOf(ours.analysisXlsx.values);
    let best=null,bestHit=-1;
    fx.sheets.forEach(sh=>{
      const hit=[...countsOf(sh.values)].filter(x=>mine.has(x)).length;
      if(hit>bestHit){bestHit=hit;best=sh;}});
    if(best&&best.sheet!==fx.sheet&&bestHit>0){
      rec.notes.push('filed: the analysis workbook holds '+fx.sheets.length+' sheets ('
        +fx.sheets.map(x=>JSON.stringify(x.sheet)).join(', ')+'); compared against '
        +JSON.stringify(best.sheet)+', chosen because '+bestHit+' of its unit counts match ours');
      filed.facts.analysisXlsx=Object.assign({},fx,{values:best.values,sheet:best.sheet});
    }else if(best){
      rec.notes.push('filed: the analysis workbook holds '+fx.sheets.length+' sheets; kept '
        +JSON.stringify(fx.sheet)+(bestHit>0?'':' — no sheet\'s unit counts matched ours'));
    }
  }

  const notGenerated=[];
  const commonFiled={};
  for(const dt of Object.keys(filed.facts)){
    if(ours[dt])commonFiled[dt]=filed.facts[dt];
    else notGenerated.push(dt);
  }
  rec.notGenerated=notGenerated;
  const anyOrder=rec.orders['rs-first']||rec.orders['rcs-first']||{};
  rec.notGeneratedWhy=anyOrder.missing||null;

  if(!Object.keys(commonFiled).length){
    rec.verdict='the app generated no document the filed package also has';
    rec.counts={compared:0,matched:0,differing:0,fillOrder:(rec.fillOrder||[]).length,
                drift:0,notGenerated:notGenerated.length};
    return rec;
  }
  try{
    const res=compareFacts(ours,commonFiled,{property:p.name});
    rec.rows=res.rows||[];rec.drift=res.drift||[];
  }catch(e){rec.notes.push('compareFacts threw: '+String(e.message).slice(0,120));}

  const mism=rec.rows.filter(r=>r.status!=='match');
  rec.verdict=mism.length?(mism.length+' differences'):'every compared value agrees';
  rec.counts={compared:rec.rows.length,matched:rec.rows.length-mism.length,
              differing:mism.length,fillOrder:rec.fillOrder.length,drift:rec.drift.length,
              notGenerated:notGenerated.length};
  return rec;
}

/* ---- report --------------------------------------------------------------
   By cause, then by key. Never by property. */
function report(records){
  const L=[];
  const push=(...a)=>L.push(a.join(''));
  /* THE SHA MUST COME FROM THE RECORDS, NOT FROM THE CLOCK. Each property
     stamps the commit it was actually driven at; rendering the report later --
     or re-rendering it from cache after a commit -- would otherwise print
     today's SHA over yesterday's numbers, which is the one thing a comparison
     harness must never do. If the records disagree the run was not frozen, and
     that has to be said out loud rather than averaged away. */
  const shas=[...new Set(records.map(r=>r.sha).filter(Boolean))];
  push('# ',LABEL,' — ',records.length,' properties, app frozen at ',shas.join(' + ')||'unknown');
  push('');
  if(shas.length>1){
    push('> **These results are NOT comparable.** They were produced at ',shas.length,
         ' different commits (',shas.join(', '),'), so a difference between two');
    push('> properties may be a difference between two builds. Re-run with --force.');
    push('');
  }
  if(shas.length===1&&shas[0]!==SHA)
    push('_(rendered at '+SHA+'; the numbers below are from '+shas[0]+')_\n');
  const ran=records.filter(r=>r.counts);
  const blank=records.filter(r=>!r.counts);
  push('| | count |');
  push('|---|---:|');
  push('| properties swept | ',records.length,' |');
  push('| produced something comparable | ',ran.length,' |');
  push('| produced nothing comparable | ',blank.length,' |');
  push('| values compared | ',ran.reduce((s,r)=>s+r.counts.compared,0),' |');
  push('| values differing | ',ran.reduce((s,r)=>s+r.counts.differing,0),' |');
  /* THE RAW TOTAL IS THE WRONG HEADLINE. Two thirds of it is one side holding a
     field the other's template simply does not have -- the PM team's analysis
     workbook titles itself in free text and carries no appraiser firm at all,
     so every property contributes two rows that are not disagreements about
     anything. What matters is where both documents state a value and the
     values differ. */
  const st={};
  ran.forEach(r=>(r.rows||[]).forEach(x=>{if(x.status!=='match')st[x.status]=(st[x.status]||0)+1;}));
  push('| — of those, **both sides had a value and they differ** | **',st.mismatch||0,'** |');
  push('| — we produced a value the filed document has no field for | ',st['missing-theirs']||0,' |');
  push('| — the filed document had a value we produced nothing for | ',st['missing-ours']||0,' |');
  push('| fill-order disagreements | ',records.reduce((s,r)=>s+(r.fillOrder||[]).length,0),' |');
  /* Reported per sweep because it is a recurring cost, not a one-off: every
     package a user makes pays this again. Counted from HTTP requests actually
     sent, not from any label the app applies to the reading afterwards. */
  const calls=records.reduce((s,r)=>s+Object.values(r.orders||{}).reduce((a,o)=>Math.max(a,o.ocrCalls||0),0),0);
  const billed=records.filter(r=>Object.values(r.orders||{}).some(o=>(o.ocrCalls||0)>0));
  push('| Azure OCR requests sent | ',calls,' |');
  push('| — properties that needed at least one | ',billed.length,' of ',records.length,' |');
  push('');

  /* Fill-order first: same inputs, two packages. No ground truth needed. */
  const fo=records.flatMap(r=>(r.fillOrder||[]).map(x=>Object.assign({property:r.property},x)));
  push('## Fill-order disagreements — highest severity');
  push('');
  if(!fo.length)push('None. Every property that generated in both orders generated the same package.');
  else{
    push('The same inputs in two different fill orders produced different output.');
    push('This needs no ground truth to be a defect.');
    push('');
    push('| property | doc | key | rs-first | rcs-first |');
    push('|---|---|---|---|---|');
    fo.forEach(x=>push('| ',x.property,' | ',x.doc||'',' | ',x.key,' | ',J(x.ours),' | ',J(x.theirs),' |'));
  }
  push('');

  /* Documents the app declined to write. One row per document per property --
     never one row per field, which would restate a single cause thirty times. */
  const ng={};
  records.forEach(r=>(r.notGenerated||[]).forEach(dt=>{(ng[dt]=ng[dt]||[]).push(r.property);}));
  push('## Documents the app did not generate');
  push('');
  if(!Object.keys(ng).length)push('None — every filed document had a generated counterpart.');
  else{
    push('The filed package contains these; the app produced no counterpart, so');
    push('there was nothing to compare. Counted once per document, not once per field.');
    push('');
    push('| document | properties | of |');
    push('|---|---:|---:|');
    Object.keys(ng).sort((a,b)=>ng[b].length-ng[a].length)
      .forEach(dt=>push('| ',dt,' | ',ng[dt].length,' | ',records.length,' |'));
  }
  push('');

  /* What the app could not do at all -- zero rows must never read as success. */
  push('## Properties that produced nothing comparable');
  push('');
  if(!blank.length)push('None.');
  else{
    push('Zero comparison rows is not agreement. Each of these is a property the');
    push('sweep could not test, and why.');
    push('');
    push('| property | verdict | rs tier | what the app said it was missing |');
    push('|---|---|---|---|');
    blank.forEach(r=>{
      const o=r.orders['rs-first']||r.orders['rcs-first']||{};
      const miss=o.missing?Object.keys(o.missing).join(', '):'';
      push('| ',r.property,' | ',r.verdict||'',' | ',o.tier||'—',' | ',miss.slice(0,60),' |');
    });
  }
  push('');

  /* The main table: cause, then key, then how many properties. */
  const rows=ran.flatMap(r=>r.rows.filter(x=>x.status!=='match')
    .map(x=>Object.assign({property:r.property},x)));
  const byCause={};
  rows.forEach(x=>{(byCause[x.cause||'undiagnosed']=byCause[x.cause||'undiagnosed']||[]).push(x);});
  push('## Differences, grouped by cause then by key');
  push('');
  push('Read the **mismatch** rows first: those are the ones where both documents');
  push('state a value and the two disagree. A `missing-theirs` row usually means');
  push('the filed template has no such field, not that anything is wrong.');
  push('');
  push('Every row starts `undiagnosed`. A cause is only set by a person, or by a');
  push('rule that says how it knows.');
  push('');
  for(const cause of Object.keys(byCause).sort((a,b)=>byCause[b].length-byCause[a].length)){
    const group=byCause[cause];
    push('### Cause: ',cause,' — ',group.length,' rows');
    push('');
    const byKey={};
    group.forEach(x=>{const k=(x.doc||'?')+' · '+x.key;(byKey[k]=byKey[k]||[]).push(x);});
    push('| doc · key | properties | example ours | example filed |');
    push('|---|---:|---|---|');
    Object.keys(byKey).sort((a,b)=>byKey[b].length-byKey[a].length).forEach(k=>{
      const g=byKey[k],e=g[0];
      push('| ',k,' | ',g.length,' | ',J(e.ours),' | ',J(e.theirs),' |');
    });
    push('');
  }
  return L.join('\n')+'\n';
}
const J=v=>{
  if(v===undefined||v===null)return '_(absent)_';
  const s=String(v).replace(/\|/g,'\\|').replace(/\n/g,' ');
  return '`'+(s.length>34?s.slice(0,33)+'…':s)+'`';
};

(async()=>{
  let props=man.properties.slice();
  if(ONLY.length)props=props.filter(p=>ONLY.some(o=>p.name===o||p.code===o||p.name.toLowerCase().includes(o.toLowerCase())));
  if(LIMIT)props=props.slice(0,LIMIT);
  console.log('sweep: '+props.length+' properties, '+JOBS+' concurrent, app frozen at '+SHA);
  console.log('out: '+OUT+'\n');

  const records=[];let done=0;
  const queue=props.slice();
  async function worker(id){
    while(queue.length){
      const p=queue.shift();if(!p)break;
      const file=path.join(OUT,(p.code||p.name).replace(/[^\w.-]/g,'_')+'.json');
      /* A RECORD BUILT BY A DIFFERENT APP IS NOT A RESULT, IT IS A MEMORY.
         Resume exists so a crash on property 30 costs one property, not 29 —
         but it keyed only on "is there a file", and a file written by an older
         build answers a question about that build. This bit hard: a probe run
         after the OCR work returned two properties instantly from records made
         three commits earlier, still reporting tier "unreadable:text", which is
         precisely the stale headline the OCR work disproved. The sweep would
         have re-published it under today's commit and the report's own
         provenance line would have been the only clue.
         So the cache is now keyed on the app as well as the property. Same
         commit, reuse it; different commit, drive it again. --stale-ok opts
         back into the old behaviour for the rare case where the app did not
         change in a way the sweep can see. */
      if(!FORCE&&fs.existsSync(file)){
        try{
          const prior=JSON.parse(fs.readFileSync(file,'utf8'));
          if(STALE_OK||prior.sha===SHA){
            records.push(prior);
            console.log('  ['+(++done)+'/'+props.length+'] '+p.name+'  (cached'
              +(prior.sha===SHA?'':', from '+prior.sha)+')');continue;}
          console.log('  ['+(done+1)+'/'+props.length+'] '+p.name+'  — cached record is from '
            +(prior.sha||'an unknown commit')+', re-driving at '+SHA);
        }
        catch(e){/* fall through and re-run */}
      }
      let rec;
      try{rec=await runProperty(p);}
      catch(e){rec={property:p.name,code:p.code,sha:SHA,verdict:'sweep threw',
                    notes:['threw: '+String(e&&e.message||e).slice(0,200)],rows:[],fillOrder:[],orders:{}};}
      fs.writeFileSync(file,JSON.stringify(rec,null,1));
      records.push(rec);
      console.log('  ['+(++done)+'/'+props.length+'] '+p.name.padEnd(26)+' '+(rec.verdict||''));
    }
  }
  await Promise.all(Array.from({length:Math.min(JOBS,props.length)},(_,i)=>worker(i)));

  records.sort((a,b)=>String(a.property).localeCompare(String(b.property)));
  fs.writeFileSync(path.join(OUT,LABEL+'.json'),JSON.stringify({sha:SHA,label:LABEL,records},null,1));
  fs.writeFileSync(path.join(OUT,LABEL+'.md'),report(records));
  console.log('\nwrote '+path.join(OUT,LABEL+'.json'));
  console.log('wrote '+path.join(OUT,LABEL+'.md'));
})().catch(e=>{console.error(e);process.exit(1);});
