/* smoke_combined.js — headless render smoke of the assembled app:
   menu -> form, plus exit dirty-detection. Run: node smoke_combined.js

   REVIVED 2026-07-27. It had been dead: it did `require('./combined.js')`, a
   build artifact that no longer exists, so it crashed on line 9 every time. It
   now builds its own bundle the way test_interactions.js does, and boots the
   data layer through __localDb() because app.js correctly refuses to start
   without Supabase configured.

   Hardened the same way, and for the same reason — a suite nobody notices is
   worse than no suite: every exit path sets a non-zero code, the verdict is the
   LAST line printed so a piped run still shows it, and MIN_CHECKS catches a run
   that dies partway. Adding checks? Raise MIN_CHECKS. */
global.CSS={escape:s=>s};
const mem={};
global.window={addEventListener:(e,cb)=>{if(e==='DOMContentLoaded')global.__ready=cb;},localStorage:{getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=v;},removeItem:k=>{delete mem[k];}},scrollY:0,scrollTo(){}};
const els={};
function mk(id){return {id:id||'',style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},setAttribute(){},getAttribute(){return'';},appendChild(){},addEventListener(){},closest(){return null;},parentElement:null,querySelector(){return null;},querySelectorAll(){return[];},innerHTML:'',textContent:'',onclick:null,value:'',checked:false,focus(){},select(){},setSelectionRange(){},files:[]};}
global.document={getElementById:id=>els[id]||(els[id]=mk(id)),querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>mk(),addEventListener(){},body:{classList:{toggle(){},contains(){return false;}}}};
const os=require('os'),path=require('path'),fs=require('fs');

/* ── the verdict machinery (mirrors test_interactions.js) ───────────────── */
const MIN_CHECKS=24;
let n=0,fails=0,verdict=null;
const BAR='═'.repeat(68);
function fail(msg,err){
  verdict='fail'; process.exitCode=1;
  console.log('\n'+BAR);
  console.log('  ✗✗✗  RENDER SMOKE FAILED — DO NOT SHIP  ✗✗✗');
  console.log('  '+msg);
  if(err)console.log(String(err&&err.stack||err).replace(/^/gm,'  '));
  console.log(BAR);
  console.log(`✗ RENDER SMOKE FAILED (${n} checks ran, ${fails} failed)`);
}
function pass(){verdict='pass';console.log(`\n✓ ALL ${n} SMOKE CHECKS PASSED\n`);}
function finish(){
  if(fails)return fail(`${fails} of ${n} checks failed — see the ✗ lines above`);
  if(n<MIN_CHECKS)return fail(`only ${n} of the expected ${MIN_CHECKS} checks ran — the suite died partway, or checks were deleted without lowering MIN_CHECKS on purpose`);
  pass();
}
process.on('exit',()=>{if(verdict===null)fail(`the run ended without a verdict after ${n} of ${MIN_CHECKS} checks — it died partway`);});
process.on('unhandledRejection',e=>{fail('unhandled rejection — an async throw is a failure, never a pass',e);process.exit(1);});
process.on('uncaughtException',e=>{fail('uncaught exception',e);process.exit(1);});

const _d=__dirname,_b=path.join(os.tmpdir(),'rcs_combined_smoke.js');
fs.writeFileSync(_b,['core.js','db.js','app.js'].map(x=>fs.readFileSync(path.join(_d,x),'utf8')).join('\n'));
const app=require(_b);
const eq=(label,got,want)=>{n++;const p=JSON.stringify(got)===JSON.stringify(want);if(!p){fails++;console.log(`  ✗ ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);}else console.log(`  ✓ ${label}`);};
const T=(label,v)=>eq(label,!!v,true);

(async()=>{
  await global.__ready();
  const db=await app.__localDb();     // no Supabase in this harness — see __localDb

  console.log('\n─ MENU renders the property gallery ─');
  app.openMenu();
  const grid=els.menuGrid.innerHTML;
  T('menu names the seeded property', /Gates Manor Apartments/.test(grid));
  T('menu draws property cards',      /class="pcard"/.test(grid));
  T('menu draws the completeness ring', /svg/.test(grid));
  T('menu count chip counts properties', /propert/.test(els.menuCount.textContent));
  T('nothing undefined leaked into the menu', !/undefined/.test(grid));

  /* The LAUNCHER cannot be smoked yet. It renders through cyclesHtml(), which
     calls mpdb.listCycles — part of the cycle surface that exists in
     db.supabase.js (what the app actually runs on) but not in db.js (which is
     now only this harness's stand-in). Faking listCycles here would prove
     nothing about the real launcher, so the phase is skipped rather than
     invented. The check below RETIRES ITSELF: the day db.js gains the cycle
     surface, this fails and tells you to restore the launcher checks. */
  console.log('\n─ LAUNCHER skipped — db.js has no cycle surface (see note) ─');
  if(typeof db.listCycles==='function'){
    n++;fails++;
    console.log('  ✗ the launcher skip is now STALE: db.js has listCycles, so the launcher can be covered — restore those checks and delete this guard');
  }else{
    n++;console.log('  ✓ skip still warranted (db.js has no listCycles) — launcher coverage remains an open gap');
  }

  console.log('\n─ FORM opens and renders the RCS package ─');
  const pid=app.__firstPid();
  T('a seeded property id exists', !!pid);
  await app.__openForm(pid);
  eq('form header names the property', els.hdrProp.textContent, 'Gates Manor Apartments');
  T('form header names the program', /RCS Package/.test(els.hdrProgram.textContent));
  const secs=els.sections.innerHTML;
  T('form body is fully rendered (not a stub)', secs.length>20000);
  T('unit-type table header renders',  /class="rgh"/.test(secs));
  T('unit columns are labelled',       /Current rent/.test(secs)&&/Proposed rent/.test(secs)&&/Utility allowance/.test(secs));
  T('150% SAFMR column renders',       /150% SAFMR/.test(secs));
  T('unit cards render',               /ucard/.test(secs));
  T('the address is rendered',         /Wilmette/.test(secs));
  T('nothing undefined leaked into the form', !/undefined/.test(secs));

  console.log('\n─ ANALYSIS: the numbers behind the 150% check ─');
  const a=app.analysis();
  eq('current gross',  a.cg,    98634);
  eq('proposed gross', a.pg,    140556);
  eq('150% ceiling',   a.ceil,  178245);
  T('proposed sits under the ceiling', a.pass===true);
  eq('headroom is ceiling minus proposed', a.headroom, a.ceil-a.pg);

  console.log('\n─ DIRTY tracking drives the exit prompt ─');
  T('a freshly opened form is not dirty', !app.isDirty());
  app.__edit('property.name','Zzz Renamed');
  T('an edit marks the form dirty', app.isDirty());
  app.__revert('property.name');
  T('reverting that edit clears dirty', !app.isDirty());

  finish();
})().catch(e=>fail('the suite threw before reaching its verdict',e));
