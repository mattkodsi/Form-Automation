/* smoke_combined.js — headless render smoke of the assembled app:
   menu -> launcher -> form, plus exit dirty-detection. Run: node smoke_combined.js

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
const MIN_CHECKS=80;
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

  /* The LAUNCHER phase, restored 2026-07-27 once db.js gained the cycle surface
     db.supabase.js has. It was skipped rather than faked while that gap existed. */
  console.log('\n─ LAUNCHER renders the property summary + packages ─');
  const pid=app.__firstPid();
  T('a seeded property id exists', !!pid);
  app.openLauncher(pid);
  const lb1=els.launcherBody.innerHTML;
  T('launcher names the property',        /Gates Manor Apartments/.test(lb1));
  T('launcher has a Packages section',    /lsec-t">Packages/.test(lb1));
  T('launcher offers "start new package"',/id="bNewCycle"/.test(lb1));
  T('launcher lists coming-soon programs',/Coming soon/.test(lb1));
  T('BBRA is one of them',                /Budget-Based Rent Adjustment/.test(lb1));
  T('launcher has the letterhead slot',   /letterhead/i.test(lb1));
  T('a property with no packages says so',/No packages yet/.test(lb1));
  T('nothing undefined leaked into the launcher', !/undefined/.test(lb1));

  /* bootstrapFirstCycle migrates an existing single-record property into its
     own package #1, asynchronously, then re-renders. That re-render is the
     state a returning user actually sees, so it is the one worth asserting. */
  for(let i=0;i<8;i++) await new Promise(r=>setTimeout(r,0));
  const lb2=els.launcherBody.innerHTML;
  T('the existing record is migrated into package #1', /class="cycard/.test(lb2));
  T('that package is marked as the current one',       /cy-dom/.test(lb2));
  T('it is labelled by its effective year',            /2026 · effective September 1, 2026/.test(lb2));
  T('the affordability check renders inside the card', /AFFORDABILITY CHECK/.test(lb2));
  T('and reports the headroom',                        /\$37,689 headroom/.test(lb2));
  T('nothing undefined leaked into the re-render',     !/undefined/.test(lb2));
  eq('the data layer agrees there is one package', db.listCycles(pid).length, 1);
  eq('and reports its programs as an array',      db.listCycles(pid)[0].programs, ['rcs']);

  console.log('\n─ FORM opens and renders the RCS package ─');
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

  /* The executed schedule must still be there tomorrow. It used to live in a
     variable that openCycleForm itself cleared, so a source row reading rsVal()
     went dim on refresh — or merely on leaving the form — while a row backed by
     a saved field (units.N.ua_exec) survived. Note this opens the form the way
     the app really does, through openCycleForm; __openForm above takes the
     legacy no-cycle path. */
  console.log('\n─ THE PARSED RENT SCHEDULE SURVIVES REOPENING THE PACKAGE ─');
  const scid=db.listCycles(pid)[0].id;
  eq('the package starts with no schedule read for it', db.getCycleRs(scid), {});
  await app.__openCycleForm(pid,scid);
  T('with none stored, the source row is honestly dim',
    /Executed RS · not available/.test(els.sections.innerHTML));
  await db.setCycleRs(scid,{name:'Gates Manor executed RS.pdf',kind:'fields',via:'text',
    at:'2026-07-27T14:00:00.000Z',
    parsed:{scalars:{'property.s8':'MI43T000123'},units:[],principals:[],ns8:[],nonrev:[]}});
  await app.__openCycleForm(pid,scid);
  const rsec=els.sections.innerHTML;
  T('reopening the package restores the schedule’s value into its source row',
    /MI43T000123<span class="uasub">Executed RS<\/span>/.test(rsec));
  T('and the upload row names the file instead of asking for it again',
    /Gates Manor executed RS\.pdf/.test(rsec));
  T('it says when it was read, so it is not mistaken for this session’s work',
    /read Jul 27, 2026/.test(rsec));
  T('nothing undefined leaked in with it', !/undefined/.test(rsec));

  console.log('\n─ ANALYSIS: the numbers behind the 150% check ─');
  const a=app.analysis();
  eq('current gross',  a.cg,    98634);
  eq('proposed gross', a.pg,    140556);
  eq('150% ceiling',   a.ceil,  178245);
  T('proposed sits under the ceiling', a.pass===true);
  eq('headroom is ceiling minus proposed', a.headroom, a.ceil-a.pg);

  /* The six-document gate, audited against what gen.js actually prints. Each
     check below is a hole the old table left open: five letters could all
     generate with an empty signature block, because only the checklist ever
     asked for a signatory. */
  /* Rule 16, at the one place it kept escaping. A source row offered "1027"
     directly beneath a cell reading "$ 1,027" — the same figure in two
     conventions. The UA and SAFMR menus formatted at their own call sites and so
     looked right, which is exactly how the rest were missed. */
  console.log('\n─ A SOURCE ROW PRINTS ITS FIGURE THE WAY THE CELL DOES ─');
  await db.setCycleRs(scid,{name:'Gates Manor executed RS.pdf',kind:'fields',via:'text',at:'2026-07-27T14:00:00.000Z',
    parsed:{scalars:{},principals:[],ns8:[],nonrev:[],
      units:[{type:'1 BR / 1 BA',count:1027,rent:1027,ua:75}]}});
  // a four-digit count, or the separator check below cannot fail
  await db.saveFlatCycle(scid,{'units.0.num_units':{value:'1027'}});
  await app.__openCycleForm(pid,scid);
  const fsec=els.sections.innerHTML;
  T('the current-rent source row carries a dollar sign and a comma',
    /\$1,027<span class="uasub">Executed RS<\/span>/.test(fsec));
  T('and never the bare figure',
    !/>1027<span class="uasub">Executed RS<\/span>/.test(fsec));
  T('a unit count gets its separator but no dollar sign',
    /">1,027<span class="uasub">Executed RS<\/span>/.test(fsec));
  /* The click writes data-srcv into the cell, so it must stay unformatted —
     a formatted one would put "$1,027" into the field. */
  T('but the value it writes stays raw', /data-srcv="1027"/.test(fsec));
  T('so no cell is offered a dollar sign to swallow', !/data-srcv="\$/.test(fsec));
  /* And the cell beside it must agree, or the fix above just reverses the
     mismatch: a dropdown reading 1,027 above a box reading 1027. */
  T('the unit-count box carries the separator too', /data-money="1" data-k="units.0.num_units" value="1,027"/.test(fsec));
  T('while the UAF factor box is left alone — cleanNum would eat its decimal point',
    !/data-money="1" data-k="uaf\.f_/.test(els.sections.innerHTML));

  /* Provenance belongs to the FACT, not the fragment. The unit type is one
     string on the schedule — "1 BR / 1 BA E" — split into three boxes only so it
     can be edited. Badging the designation alone, while the two boxes beside it
     said nothing, is what read as arbitrary. */
  console.log('\n─ ONE RS BADGE FOR THE WHOLE UNIT TYPE ─');
  const br0=app.getVal('units.0.br'), ba0=app.getVal('units.0.ba');
  await db.setCycleRs(scid,{name:'RS.pdf',kind:'fields',via:'text',at:'2026-07-27T14:00:00.000Z',
    parsed:{scalars:{},principals:[],ns8:[],nonrev:[],
      units:[{type:br0+' / '+ba0,count:1027,rent:1027,ua:75}]}});
  await app.__openCycleForm(pid,scid);
  const utc=els.sections.innerHTML.split('<div class="urow">')[1]||'';
  /* The whole-cell picker is gone: bedroom and bath are two independent cells
     again, each declaring the schedule as its own source. */
  T('no whole-cell picker on the type', !/utgrp/.test(utc));
  T('bedroom is its own control', /data-trigfor="units\.0\.br"/.test(utc));
  T('bathroom is its own control',  /data-trigfor="units\.0\.ba"/.test(utc));
  /* The same shape as the assertion the designation chip used to carry: the ONE
     badge belongs to the group, and no sub-part of the type may grow a second.
     The label line is the sub-part that could. */
  T('and the label line carries none of its own', !/ulabline[\s\S]{0,300}?srctag/.test(utc));
  /* The label replaced the designation chip. It is a text box on its own line
     under the counts, so it clears the way every other text box does — by
     emptying it — and it costs no height until it holds something. */
  app.__editCell('units.0.label','Patio'); app.__renderBody();
  const utcD=els.sections.innerHTML.split('<div class="urow">')[1]||'';
  T('the label renders under the type cell', /ulabline[\s\S]{0,300}?ulab-in/.test(utcD));
  T('and holds what was typed', /ulab-in[^>]*value="Patio"/.test(utcD));
  app.__editCell('units.0.label',''); app.__renderBody();
  const utcE=els.sections.innerHTML.split('<div class="urow">')[1]||'';
  T('an empty label still renders its line, collapsed by CSS', /ulabline/.test(utcE));
  T('and claims no value', !/ulab-in[^>]*value="[^"]+"/.test(utcE));
  app.__editCell('units.0.ba', ba0==='1BA'?'2BA':'1BA');
  app.__renderBody();
  const utc2=els.sections.innerHTML.split('<div class="urow">')[1]||'';
  eq('one edit anywhere drops the badge for the whole fact', (utc2.match(/utgrp"><span class="srctag rstag"/g)||[]).length, 0);
  await app.__openCycleForm(pid,scid);

  /* Every schedule-fed cell says so, not just the ones that happened to be
     built on the source-backed model. The unit count and the current rent sat
     unbadged beside an allowance that carried one. */
  console.log('\n─ EVERY SCHEDULE-FED CELL CARRIES ITS RS TAG ─');
  await db.saveFlatCycle(scid,{'units.0.num_units':{value:'104'},'units.0.current':{value:'1027'}});
  await db.setCycleRs(scid,{name:'RS.pdf',kind:'fields',via:'text',at:'2026-07-27T14:00:00.000Z',
    parsed:{scalars:{},principals:[],ns8:[],nonrev:[],units:[{type:br0+' / '+ba0,count:104,rent:1027,ua:43}]}});
  await app.__openCycleForm(pid,scid);
  const rowT=els.sections.innerHTML.split('<div class=\"urow\">')[1]||'';
  T('the unit count carries an RS tag', /data-k=\"units.0.num_units\"[^>]*>\s*<span class=\"srctag[^\"]*\">/.test(rowT));
  T('the current rent carries one too',  /data-k=\"units.0.current\"[^>]*>\s*<span class=\"srctag[^\"]*\">/.test(rowT));
  app.__editCell('units.0.current','999'); app.__renderBody();
  const rowT2=els.sections.innerHTML.split('<div class=\"urow\">')[1]||'';
  T('changing the rent drops its tag', !/data-k=\"units.0.current\"[^>]*>\s*<span class=\"srctag[^\"]*\">/.test(rowT2));
  T('but the unit count keeps its own', /data-k=\"units.0.num_units\"[^>]*>\s*<span class=\"srctag[^\"]*\">/.test(rowT2));
  await app.__openCycleForm(pid,scid);

  console.log('\n─ WHAT EACH DOCUMENT REQUIRES ─');
  const miss=id=>app.__docMissing(id), warn=id=>app.__docWarns(id);
  const has=(a,x)=>a.indexOf(x)>=0;
  T('the seeded property blocks nothing on the cover letter', miss('cover').length===0);
  app.__edit('sig.name','');
  T('no signatory blocks the cover letter',   has(miss('cover'),'signatory name'));
  T('…and the owner letter',                  has(miss('owner'),'signatory name'));
  T('…and the checklist',                     has(miss('checklist'),'signatory name'));
  T('…and the rent schedule',                 has(miss('schedule'),'signatory name'));
  app.__edit('sig.name','A Signatory');
  app.__edit('appr.name','');
  T('the owner letter certifies the appraiser by name, so it blocks without one',
    has(miss('owner'),'appraiser name'));
  app.__edit('appr.name','An Appraiser');
  app.__edit('property.fha','');
  T('HUD-92458 blocks without its FHA number', has(miss('schedule'),'FHA number'));
  T('which is NOT the Section 8 number — that one is not asked for here',
    !has(miss('schedule'),'Section 8 number'));
  app.__edit('property.fha','023-11111');
  app.__edit('property.name','');
  T('the notice names the property in six sentences, so it blocks without one',
    has(miss('notice'),'property name'));
  T('…and so does the checklist, which prints it 18pt across the head',
    has(miss('checklist'),'property name'));
  app.__edit('property.name','Gates Manor Apartments');

  /* Matt's question, settled: the same figure is required for one document and
     merely suggested for another, because the documents differ. */
  console.log('\n─ PROPOSED RENTS: required on the notice, suggested on the schedule ─');
  const props=[]; for(let i=0;i<12;i++){const k='units.'+i+'.proposed'; if(app.getVal(k)!=null&&app.getVal(k)!=='')props.push([k,app.getVal(k)]);}
  T('the seeded property has proposed rents to clear', props.length>0);
  props.forEach(([k])=>app.__edit(k,''));
  T('with none, the tenant notice will not generate', has(miss('notice'),'proposed rents'));
  T('but the rent schedule still generates',          !has(miss('schedule'),'proposed rents'));
  T('and says so as a caveat instead',                has(warn('schedule'),'proposed rents'));
  props.forEach(([k,v])=>app.__edit(k,v));
  T('restoring them clears the notice block',  !has(miss('notice'),'proposed rents'));
  T('and clears the schedule caveat too',      !has(warn('schedule'),'proposed rents'));

  console.log('\n─ CAVEATS DEGRADE, THEY DO NOT BLOCK ─');
  app.__edit('ca.addr_street','');
  T('a missing CA street is a caveat on the cover letter', has(warn('cover'),'CA street address'));
  T('and does not block it',                              !has(miss('cover'),'CA street address'));
  app.__edit('poc.phone','');app.__edit('poc.email','');
  T('losing BOTH ways to reach the point of contact is a caveat, not a block',
    has(warn('cover'),'a phone or email for the point of contact'));
  T('the cover letter still generates',                    miss('cover').length===0);
  // this phase edited the form to probe the gate; reopen so the next one starts clean
  await app.__openCycleForm(pid,scid);

  console.log('\n─ DIRTY tracking drives the exit prompt ─');
  T('a freshly opened form is not dirty', !app.isDirty());
  app.__edit('property.name','Zzz Renamed');
  T('an edit marks the form dirty', app.isDirty());
  app.__revert('property.name');
  T('reverting that edit clears dirty', !app.isDirty());

  finish();
})().catch(e=>fail('the suite threw before reaching its verdict',e));
