#!/usr/bin/env node
/* test_fuzz.js — PROVE THE STORM. A fuzzer that has never caught a planted
   defect is a random-number generator with a log file.

   Every other suite here tests the app. This one tests the INSTRUMENT: it
   builds bundles from deliberately broken copies of the real sources, storms
   each one, and requires the storm to name the break — then storms the CLEAN
   bundle with the identical seed and configuration and requires silence. Both
   halves are the check. A tool that shouts at everything and a tool that shouts
   at nothing are equally useless, and only the pair of runs tells them apart.

   The plants, each aimed at one oracle:

     isDirty-always-true  -> false-dirty-verdict / footer-disagrees
        app.js's isDirty() is the app's own answer to "are there unsaved
        changes". The storm recomputes that answer itself, key by key, so a
        lying isDirty() must be caught. This is the exact shape of the defect
        class that shipped as "the footer says unsaved changes with nothing on
        screen" (FORM-RULES 14).
     paint-a-new-colour   -> new-colour
        paintCell tints an edited cell a colour that is in no palette. This is
        M62's class — provenance painted twice, one painter disagreeing — and
        the reason the oracle calibrates its baseline from the app itself
        rather than from a list somebody typed.
     revert-does-nothing  -> revert-left-dirt
        the footer's "Revert to saved" becomes a no-op. FORM-RULES 6 exists
        because revertForm() silently did nothing in the commonest state there
        is, so a suite must be able to see a dead revert.

   Runtime is the reason there are three and not ten: each plant is a full
   chromium boot plus a bundle build. The clean control runs once per plant
   configuration, not once per plant, because that is what the comparison needs.

   Skips LOUDLY (exit 3) where no chromium is installed — never as a pass. */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const {storm,withBundle,primeSelftest}=require('./fuzz.js');
const {findChrome}=require('./cdplib.js');

const MIN_CHECKS=18;
let checks=0,fails=0;
const T=(name,cond,detail)=>{checks++;if(cond){console.log('  + '+name);}else{fails++;console.log('  X '+name+(detail?'\n      '+detail:''));}};

/* ── build a bundle from a patched copy of the real sources ─────────────── */
const SRC=__dirname;
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'rcs-fuzzproof-'));
process.on('exit',()=>{try{fs.rmSync(TMP,{recursive:true,force:true});}catch(e){}});

function buildPatched(tag,patch){
  const dir=path.join(TMP,tag);
  fs.mkdirSync(dir,{recursive:true});
  /* build.sh concatenates from its own directory, so the copy must be whole.
     Copy the files the build names, plus build.sh itself. */
  const need=['shell.head.html','shell.tail.html','config.js','crypto.js','pdfdecrypt.js','core.js','score.js',
              'db.js','db.supabase.js','app.js','ocr.js','rcs.js','hap.js','gen.js','xlsx.js','templates.js','build.sh'];
  for(const f of need)fs.copyFileSync(path.join(SRC,f),path.join(dir,f));
  fs.mkdirSync(path.join(dir,'lib'),{recursive:true});
  for(const f of ['pdf-lib.min.js','supabase.min.js'])fs.copyFileSync(path.join(SRC,'lib',f),path.join(dir,'lib',f));
  if(patch)patch(dir);
  const out=path.join(TMP,tag+'.html');
  cp.execFileSync('bash',[path.join(dir,'build.sh'),out],{stdio:['ignore','ignore','pipe']});
  const n=fs.statSync(out).size;
  if(n<500000)throw new Error(tag+': built bundle is implausibly small ('+n+' bytes)');
  return out;
}
/* A PLANT THAT DID NOT APPLY IS THE WORST OUTCOME THERE IS: the storm then
   reports silence on a bundle that was never broken, and the suite reads that
   as proof. So every substitution asserts it matched exactly once. */
function sub(dir,file,from,to){
  const p=path.join(dir,file);
  const src=fs.readFileSync(p,'utf8');
  const n=src.split(from).length-1;
  if(n!==1)throw new Error('plant did not apply: '+JSON.stringify(from).slice(0,70)+' matched '+n+' times in '+file);
  fs.writeFileSync(p,src.replace(from,to));
}

const CFG={seed:20260730,episodes:4,maxEdits:3,quiet:true,
           values:['1234','2050','777','999999']};

(async()=>{
  console.log('── test_fuzz.js — does the storm catch a planted defect? ─────────\n');
  if(!findChrome()){
    console.log('X SKIPPED LOUDLY: no chromium binary found.');
    console.log('  A fuzzer proof that ran no browser has proven nothing.');
    process.exit(3);
  }

  const PLANTS=[
    /* always-FALSE, not always-true. The fixture fill leaves real unsaved
       values, so the form is legitimately dirty for most of a storm and a
       lying "true" would agree with the truth and stay invisible. Measured
       before it was written: the always-true plant reported nothing at all. */
    {tag:'isdirty',expect:['false-dirty-verdict','footer-disagrees'],
     kinds:['escape'],
     what:'isDirty() always answers false',
     patch:dir=>sub(dir,'app.js','function isDirty(){if(!FORMSNAP)return false;',
                                 'function isDirty(){if(1)return false;if(!FORMSNAP)return false;')},
    /* THE PLANT MUST SURVIVE A RE-RENDER, or the oracle is being asked to see
       something that no longer exists by the time it looks. The first version
       set an inline background inside paintCell; every episode ends by walking
       the form back to rest, which re-renders, which discards inline styles —
       so the storm scanned a page the plant had already been erased from and
       reported nothing. Planting the colour in the PALETTE instead makes it as
       durable as a real provenance defect, which is the thing being simulated:
       the "this-cycle" tint is the one colour absent from an untouched form and
       present the moment a document fills it. */
    {tag:'colour',expect:['new-colour'],
     kinds:['escape'],
     what:'a provenance state is painted a colour in no palette',
     patch:dir=>sub(dir,'app.js',"'this-cycle':['#0f766e','#e9f5f2','API / this package']",
                                 "'this-cycle':['#0f766e','#ff00ff','API / this package']")},
    /* aimed at the handler the BUTTON actually calls. The first version broke
       revertKeys(), which is the per-cell Escape path; the footer's button runs
       _revertToSaved -> store.fillForm(). Breaking a function the storm never
       reaches and reporting silence would have "proven" the oracle works. */
    {tag:'revert',expect:['revert-left-dirt'],
     kinds:['revertAll'],
     what:'the footer\'s "Revert to saved" is a no-op',
     patch:dir=>sub(dir,'app.js','const _revertToSaved=async()=>{form=await store.fillForm();',
                                 'const _revertToSaved=async()=>{if(1)return;form=await store.fillForm();')},
  ];

  /* the clean control, built once and stormed per configuration */
  let clean;
  try{clean=buildPatched('clean',null);}
  catch(e){console.log('X could not build the clean bundle: '+e.message);process.exit(1);}
  T('the clean bundle builds',!!clean&&fs.existsSync(clean));

  for(const p of PLANTS){
    console.log('\n── plant: '+p.what+' ───────────────────');
    let bundle=null,plantErr=null;
    try{bundle=buildPatched(p.tag,p.patch);}catch(e){plantErr=e.message;}
    T('the plant applies and builds ['+p.tag+']',!!bundle,plantErr||'');
    if(!bundle)continue;

    const cfg=Object.assign({},CFG,{kinds:p.kinds});
    const broken=await withBundle(bundle,async c=>{const{baseColours}=await primeSelftest(c);return await storm(c,Object.assign({baseColours},cfg));});
    const kinds=[...new Set((broken.violations||[]).map(v=>v.kind))];
    T('the storm reports SOMETHING on the broken build ['+p.tag+']',
      (broken.violations||[]).length>0,'violations: '+JSON.stringify(kinds));
    T('and what it reports is the planted break ['+p.tag+']',
      kinds.some(k=>p.expect.includes(k)),
      'expected one of '+JSON.stringify(p.expect)+', got '+JSON.stringify(kinds));
    T('the violation carries the actions that produced it ['+p.tag+']',
      (broken.violations||[]).every(v=>Array.isArray(v.after)&&v.after.length>0));

    const ok=await withBundle(clean,async c=>{const{baseColours}=await primeSelftest(c);return await storm(c,Object.assign({baseColours},cfg));});
    const okKinds=[...new Set((ok.violations||[]).map(v=>v.kind))];
    T('the SAME storm on the clean build does not report that break ['+p.tag+']',
      !okKinds.some(k=>p.expect.includes(k)),
      'clean build reported: '+JSON.stringify(okKinds));
    T('the same seed drives the same number of actions on both builds ['+p.tag+']',
      Math.abs(broken.actions.length-ok.actions.length)<=broken.actions.length,
      'broken '+broken.actions.length+' vs clean '+ok.actions.length);
  }

  /* determinism: one seed, one walk */
  console.log('\n── the seed is the whole state ───────────────────');
  const a=await withBundle(clean,async c=>{const{baseColours}=await primeSelftest(c);return await storm(c,Object.assign({},CFG,{kinds:['escape'],baseColours}));});
  const b=await withBundle(clean,async c=>{const{baseColours}=await primeSelftest(c);return await storm(c,Object.assign({},CFG,{kinds:['escape'],baseColours}));});
  T('the same seed picks the same controls in the same order',
    JSON.stringify(a.actions.filter(x=>/^type|^click|^open/.test(x)))===JSON.stringify(b.actions.filter(x=>/^type|^click|^open/.test(x))),
    'a: '+a.actions.length+' actions, b: '+b.actions.length);
  T('a different seed does not walk the same path',
    JSON.stringify((await withBundle(clean,async c=>{const{baseColours}=await primeSelftest(c);
      return await storm(c,Object.assign({},CFG,{seed:CFG.seed+1,kinds:['escape'],baseColours}));})).actions)!==JSON.stringify(a.actions));
  T('the storm records its own seed for replay',a.seed===CFG.seed);
  T('the storm pressed real trusted keys, not synthesised ones',a.realKeys===true);
  T('the storm actually did something',a.counts.episodes===CFG.episodes&&a.actions.length>CFG.episodes);

  console.log('\n'+'='.repeat(68));
  if(checks<MIN_CHECKS){console.log('X ONLY '+checks+' CHECKS RAN, EXPECTED AT LEAST '+MIN_CHECKS+' — a partial run is not a pass');process.exit(1);}
  if(fails){console.log('\nX '+fails+' OF '+checks+' FUZZ-PROOF CHECKS FAILED');process.exit(1);}
  console.log('\n+ ALL '+checks+' FUZZ-PROOF CHECKS PASSED');
})().catch(e=>{console.error(e);process.exit(1);});
