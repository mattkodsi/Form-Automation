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
const MIN_CHECKS=165;   // 2026-07-28: +32 the home page's filter rail, +24 the primary action
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

const _d=__dirname,_b=path.join(os.tmpdir(),'rcs_combined_smoke.'+process.pid+'.js');
/* The pid above keeps parallel worktrees off each other's bundle (610fe58); it does
   not clean up after itself, and a few hundred of these had piled up in the temp
   directory. Take ours with us. force:true so a run that never got as far as
   writing the file still exits quietly, and the try/catch so cleanup can never be
   the thing that fails an otherwise-green run. */
process.on('exit',()=>{try{fs.rmSync(_b,{force:true});}catch(e){}});
/* hap.js MUST come before app.js. It ends with `module.exports = API`, which
   appended after app.js would clobber app.js's own export and take the whole
   suite down. Before it, it sets window.RCSHap off the harness's window stub,
   which app.js reads lazily inside hapAll(). */
fs.writeFileSync(_b,['core.js','score.js','db.js','hap.js','app.js'].map(x=>fs.readFileSync(path.join(_d,x),'utf8')).join('\n'));
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
  /* The ring came off the property card: it was reading the dominant PACKAGE,
     so it moved when a form was opened and again when one was abandoned
     unsaved. A record is either sufficient to build from or short specific
     fields — a state, which the chip names, and which says nothing at all when
     there is nothing to say. */
  T('menu draws no ring on a property card', !/<svg/.test(grid));
  T('a short profile says what it is short of', !/missing from the profile/.test(grid)||/pchip/.test(grid));
  T('menu count chip counts properties', /propert/.test(els.menuCount.textContent));
  T('nothing undefined leaked into the menu', !/undefined/.test(grid));
  /* The guard the rail rests on. With no tracker rows the page keeps the flat
     grid it had — which is what keeps a pre-tracker deployment working, and the
     RA port, whose build does not concatenate hap.js at all. */
  T('with no renewal schedule the page keeps its flat grid', els.menuRail.innerHTML==='');
  T('and offers no action on a record the schedule does not carry', !/data-pact/.test(grid));

  /* ── THE RAIL ─────────────────────────────────────────────────────────
     The tracker is seeded HERE and not before, deliberately: the four checks
     above assume the flat-grid branch and the seeded orphan record, and a
     tracker present at that point would move Gates Manor into 'undated' and out
     of the default view.

     Every fixture date is built relative to new Date() at run time. Neither
     db.js's today() nor db.supabase.js's has an override hook, so a hardcoded
     date silently changes band as the calendar advances — which is a suite that
     passes today and fails in October for no reason anybody can find. */
  console.log('\n─ THE RAIL SORTS THE PORTFOLIO INTO BANDS ─');
  /* boot() installs this shim in the real app; this harness never reaches boot()
     because the DOMContentLoaded handler rightly refuses to start without
     Supabase. Install the identical one rather than loosening that refusal. */
  global.window.HAPSource={rows:()=>db.hapRows()};
  const DAY=86400000, T0=Date.now();
  const us=n=>{const d=new Date(T0+n*DAY);return (d.getUTCMonth()+1)+'/'+d.getUTCDate()+'/'+d.getUTCFullYear();};
  /* due = effective − 122 days, the export's median lead. A due date AFTER its
     increase is refused by normalize() and falls back to the computed one, so
     the two must be built as a pair. */
  const trow=(code,name,type,dueIn)=>({'Property Code':code,'Property Name':name,'Portfolio Mgr':'Claire Beatty',
    'Increase Type':type,'Rent Increase':us(dueIn+122),'Due to HUD':us(dueIn)});
  await db._setHapRows([
    trow('R001','Rail Overdue','RCS',-10),      // deadline passed  -> band overdue
    trow('R002','Rail Now','OCAF',10),          // inside 30 days   -> band now
    trow('R003','Rail Soon','OCAF',60),         // inside 90 days   -> band soon
    trow('R004','Rail Later','OCAF',200),       // beyond 90 days   -> band later
    /* In scope (it has had an OCAF) but with nothing ahead of it: the shape the
       schedule's horizon makes, and the one that must never read as finished. */
    trow('R005','Rail Awaiting','OCAF',-500),
  ]);
  app.openMenu();
  const rail1=els.menuRail.innerHTML, lede1=els.menuLede.textContent, g1=els.menuGrid.innerHTML;
  const c1=app.__menuCounts();
  T('the rail renders once the tracker supplies properties', /mr-row/.test(rail1));
  T('nothing undefined leaked into the rail', !/undefined/.test(rail1));
  T('the rail names every view', /Needs you/.test(rail1)&&/Coming up/.test(rail1)&&/In flight/.test(rail1)
    &&/Done for the year/.test(rail1)&&/Undated/.test(rail1)&&/All properties/.test(rail1));
  T('and groups the two programs under their own heading', /Programs/.test(rail1)&&/RCS years/.test(rail1)&&/OCAF years/.test(rail1));
  T('the lede explains the view on screen', lede1.length>20);
  eq('overdue and due-now land in Needs you', c1.needs, 2);
  eq('soon and later land in Coming up',      c1.coming, 2);
  /* Gates Manor carries no tracker code and Rail Awaiting has no future
     startable row: two different reasons, one honest answer — no date. */
  eq('a property with no future renewal, and the uncoded record, are Undated', c1.undated, 2);
  eq('nothing is in flight before a package exists', c1.flight, 0);
  eq('and nothing is done',                            c1.done, 0);
  eq('the five views sum to All properties', c1.needs+c1.coming+c1.flight+c1.done+c1.undated, c1.all);
  /* Three, not four: Rail Awaiting has no target, so it has no program either.
     The Programs group asks what the NEXT renewal is, and a property with no
     next renewal has no answer — putting it under OCAF because it once had one
     would assert work that is not scheduled. */
  eq('the Programs group cross-cuts on the target program', [c1.rcs,c1.ocaf], [1,3]);
  /* The badge and the grid answer one question. A rail saying 6 above a grid of
     5 is the defect this pass exists to make impossible. */
  const cardsIn=h=>(h.match(/class="pcard"/g)||[]).length;
  eq('the rail opens on the first non-empty view', app.__menuView(), 'needs');
  eq('and the badge on that row equals the cards drawn', cardsIn(g1), c1.needs);
  app.__setMenuView('coming');
  eq('switching view redraws the grid to match its badge', cardsIn(els.menuGrid.innerHTML), c1.coming);
  app.__setMenuView('undated');
  eq('Undated draws both populations',                    cardsIn(els.menuGrid.innerHTML), c1.undated);
  T('and separates them under the heading that says so',
    /Not in the renewal schedule/.test(els.menuGrid.innerHTML));
  app.__setMenuView('flight');
  T('an empty view says what is empty and where to look instead',
    /class="mempty"/.test(els.menuGrid.innerHTML)&&!/Clear search/.test(els.menuGrid.innerHTML));

  /* ── THE PRIMARY ACTION ────────────────────────────────────────────── */
  console.log('\n─ ONE ACTION PER CARD, DERIVED NOT DECORATED ─');
  app.__setMenuView('all');
  const gall=els.menuGrid.innerHTML;
  T('a tracker card carries an action',     /data-pact=/.test(gall));
  T('and the label names the year and the program it will start',
    new RegExp('Start '+new Date(T0+132*DAY).getUTCFullYear()+' OCAF').test(gall));
  /* The nested-button trap. <button> inside <button> is invalid HTML: the parser
     closes the outer element and re-parents the inner one as a sibling, so the
     card silently loses its bottom half in a real browser while an innerHTML
     regex sees exactly what was emitted. Assert on the string so the regression
     is named here rather than inferred from a broken screenshot. */
  T('no card nests one button inside another', !/<button[^>]*>[^<]*<button/.test(gall));
  T('the card is a container holding a body button', /class="pcard"/.test(gall)&&/class="pc-body"/.test(gall));
  T('the action button carries no icon — the no-ring check would fail on it', !/<svg/.test(gall));
  T('nothing undefined leaked in with the actions', !/undefined/.test(gall));
  /* An uncoded record has no tracker row, so it has no scheduled renewal to
     start. Its action lives on the launcher as "+ Start new package". */
  const gorph=gall.split('Not in the renewal schedule')[1]||'';
  T('the record the schedule does not carry gets no action', gorph.length>0&&!/data-pact/.test(gorph));
  /* A property whose schedule simply stops is AWAITING one, not finished:
     rendering it disabled, greyed or absent retires it on the tracker's say-so. */
  app.__setMenuView('undated');
  const gund=els.menuGrid.innerHTML;
  T('a property whose schedule runs out is still startable', /Start a package/.test(gund));
  T('and its button is not disabled', !/data-pact="R005"[^>]*disabled/.test(gund));

  /* In flight and Done for the year come from the app's own packages, never
     from the tracker: every workflow column in the export is empty. */
  const rpid=(await db.createProperty('Rail Now','R002')).pid;
  const rcid=(await db.createCycle(rpid,{programs:['ocaf'],label:String(new Date(T0+132*DAY).getUTCFullYear()),
    effective_date:us(132)})).cid;
  app.openMenu();
  const c2=app.__menuCounts();
  eq('a matching draft moves that property into In flight', c2.flight, 1);
  eq('and takes it out of Needs you',                       c2.needs, c1.needs-1);
  eq('the partition still sums',                            c2.needs+c2.coming+c2.flight+c2.done+c2.undated, c2.all);
  await db.setCycleGenerated(rcid,['cover']);
  app.openMenu();
  const c3=app.__menuCounts();
  eq('generating it moves the property on to Done for the year', [c3.done,c3.flight], [1,0]);
  eq('and the partition still sums', c3.needs+c3.coming+c3.flight+c3.done+c3.undated, c3.all);

  /* Search is a find-within: it forces the All view so a name is never hidden by
     the filter, and it does not overwrite the view you were in. */
  app.__setMenuView('coming');
  els.menuSearch.value='Overdue';
  app.renderMenu();
  T('searching finds a property outside the current view', /Rail Overdue/.test(els.menuGrid.innerHTML));
  eq('without moving the view you were in', app.__menuView(), 'coming');
  els.menuSearch.value='';
  app.renderMenu();
  eq('clearing the search returns you there', app.__menuView(), 'coming');
  T('and draws that view again', cardsIn(els.menuGrid.innerHTML)===app.__menuCounts().coming);

  /* An increase type nobody has seen must not leave a card describing two
     different renewals. Before this was pinned, a property with an unreadable
     row in ten weeks and an OCAF two years behind it rendered a blue OCAF pill,
     a countdown of 900 days, and a button naming the unreadable type — three
     parts of one card, each about a different row, with the row that actually
     comes next invisible. The card is about the row that comes next. */
  await app.__seedHap([
    trow('R001','Rail Overdue','RCS',-10), trow('R002','Rail Now','OCAF',10),
    trow('R003','Rail Soon','OCAF',60),    trow('R004','Rail Later','OCAF',200),
    trow('R005','Rail Awaiting','OCAF',-500),
    {'Property Code':'R006','Property Name':'Rail Odd Type','Portfolio Mgr':'Claire Beatty',
     'Increase Type':'Budget Based','Rent Increase':us(200),'Due to HUD':us(78)},
    trow('R006','Rail Odd Type','OCAF',900),
  ]);
  app.openMenu();app.__setMenuView('all');
  const odd=(app.__hapProps()||[]).find(p=>p.code==='R006');
  eq('the action is blocked by the unreadable row', odd.action.kind, 'unsupported');
  eq('the type is carried verbatim, never tidied', odd.action.type, 'BUDGET BASED');
  eq('the pill names that same row',               odd.program, 'BUDGET BASED');
  eq('and the countdown is to that row, not past it', odd.deadline, odd.action.deadline);
  T('so the card is about one renewal, not three',
    odd.program===odd.action.type&&odd.deadline===odd.action.deadline);
  const gOdd=els.menuGrid.innerHTML;
  T('the button says so verbatim and is dead',
    /data-pact="R006"[^>]*disabled/.test(gOdd)&&/BUDGET BASED/.test(gOdd));
  T('and the pill is not painted in the colour that means RCS', /pc-prog unk/.test(gOdd));
  /* An unrecognised type two years out blocks nothing: the 2027 OCAF in front of
     it is still the action. */
  await app.__seedHap([
    trow('R001','Rail Overdue','RCS',-10), trow('R002','Rail Now','OCAF',10),
    trow('R003','Rail Soon','OCAF',60),    trow('R004','Rail Later','OCAF',200),
    trow('R005','Rail Awaiting','OCAF',-500), trow('R006','Rail Odd Type','OCAF',200),
    {'Property Code':'R006','Property Name':'Rail Odd Type','Portfolio Mgr':'Claire Beatty',
     'Increase Type':'Budget Based','Rent Increase':us(1200),'Due to HUD':us(1078)},
  ]);
  app.openMenu();
  eq('the same row years away blocks nothing',
    ((app.__hapProps()||[]).find(p=>p.code==='R006')||{}).action.kind, 'start');

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
  /* Gates Manor is not in the schedule, so the strip has nothing to say about
     it — and says nothing, rather than an empty "NEXT RENEWAL —". */
  T('an uncoded property gets no next-renewal strip', !/NEXT RENEWAL/.test(lb1));
  app.openLauncher(rpid);
  const lbT=els.launcherBody.innerHTML;
  T('a tracker property gets one',        /NEXT RENEWAL/.test(lbT));
  T('naming the program and the date',    /OCAF · effective/.test(lbT));
  T('and offering the same action the card does', /id="nuGo"/.test(lbT));
  T('nothing undefined leaked into it',   !/undefined/.test(lbT));
  app.openLauncher(pid);

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
  /* It does NOT block without it, and requiring it was a dead end: a Section 8
     property with no FHA-insured mortgage prints N/A in that box, and hasReal()
     reads N/A as not-an-answer — so the draft rent schedule could never be
     written for one. It changes what page 1 prints, so it is a caveat. */
  app.__edit('property.fha','');
  T('HUD-92458 does not block on a number the property may not have',
    !has(miss('schedule'),'FHA number'));
  app.__edit('property.fha','N/A');
  T('and N/A answers it, because that is what the document itself carries',
    !has(miss('schedule'),'FHA number'));
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

  /* ── two documents, four variants: the order cannot change the result ─────
     Matt's case, found by clicking for twenty minutes and invisible to the
     corpus sweep, because it never shows up in a generated document.

     A study that prices ONE line per bedroom count -- "all studios", "all one
     beds" -- against a schedule with TWO studio variants and TWO one-bed
     variants. rcsMatch looks a row up by bedrooms and baths, so one study line
     is MEANT to price several rows. But it can only price rows that exist, and
     on an empty form the study builds the roster itself: one row per line. Apply
     the schedule after that and it writes units.0..N positionally over those
     rows, so the one-bedroom figure ends up on the SECOND STUDIO and the two
     real one-bed rows get nothing.

     The chooser under each allowance cell then shows it: the studio row offered
     "RCS report $75" -- the one-bedroom's allowance -- and had it selected,
     while the one-bed rows offered no RCS figure at all even though rcsOf could
     answer 75 for them. That divergence is the last assertion here, because a
     chooser that disagrees with the matcher is the shape of the whole defect. */
  console.log('\n─ two documents, four variants, both orders ─');
  { const STUDY={units:[
      {type:'Studio',  br:0,ba:1,count:'',proposed:1000,ua:50,safmr:'',safmr_base:''},
      {type:'1BR/1BA', br:1,ba:1,count:'',proposed:1500,ua:75,safmr:'',safmr_base:''}],scalars:{}};
    const SCHED={scalars:{'property.name':'Four Variants'},principals:[],ns8:[],nonrev:[],units:[
      {type:'Studio A',br:'Studio',ba:1,count:10,rent:900, ua:41},
      {type:'Studio B',br:'Studio',ba:1,count:20,rent:950, ua:42},
      {type:'1BR A',   br:1,       ba:1,count:30,rent:1400,ua:71},
      {type:'1BR B',   br:1,       ba:1,count:40,rent:1450,ua:72}]};
    const offer=(i,kind)=>{const seg=app.__boxes(i).ua.split('data-uaopt=').find(x=>x.indexOf('"'+kind+'"')===0);
      if(!seg)return null;const m=/\$([\d,]+)/.exec(seg.slice(0,220));return m?m[1]:null;};
    const drive=async(name,order)=>{
      const p=(await db.createProperty(name,name)).pid;
      await app.__openForm(p);app.__newCycle({label:'TEST'});
      const cs=app.__cids();await app.__openCycleForm(p,cs[cs.length-1]);
      const rcs=()=>{app.__setRcsParsed(STUDY);app.__rcsFill();};
      const rs =()=>{app.__setRsParsed(SCHED); app.__rsFill();};
      if(order==='rcs-first'){rcs();rs();}else{rs();rcs();}
      const U=app.__UNITS();
      return {rows:U.length,
        proposed:U.map(i=>app.getVal('units.'+i+'.proposed')),
        ua:U.map(i=>app.uaResolvedOf(i)),
        rcsOffer:U.map(i=>offer(i,'rcs')),
        rsOffer:U.map(i=>offer(i,'exec')),
        matcher:U.map(i=>app.__rcsOf('units.'+i+'.ua_rcs'))};};

    const A=await drive('FourVariantsA','rcs-first');
    eq('study first: the schedule\'s four rows survive',        A.rows,4);
    eq('study first: each variant takes its own bedroom count\'s rent',A.proposed,['1000','1000','1500','1500']);
    eq('study first: and its own allowance',                    A.ua,[50,50,75,75]);
    eq('study first: the chooser offers the study figure on every row',A.rcsOffer,['50','50','75','75']);
    eq('study first: and the schedule\'s own figure beside it',  A.rsOffer,['41','42','71','72']);

    const B=await drive('FourVariantsB','rs-first');
    eq('schedule first: four rows',                             B.rows,4);
    eq('schedule first: the same rents',                        B.proposed,['1000','1000','1500','1500']);
    eq('schedule first: the same allowances',                   B.ua,[50,50,75,75]);
    eq('schedule first: the same offers',                       B.rcsOffer,['50','50','75','75']);
    eq('schedule first: and the same schedule figures',         B.rsOffer,['41','42','71','72']);

    /* The invariant the app already claims for scalar cells and never held for
       the roster: "the order the two documents happen to be uploaded in cannot
       change the result". */
    eq('THE ORDER CANNOT CHANGE THE RESULT',JSON.stringify(A),JSON.stringify(B));
    eq('and the chooser never disagrees with the matcher',A.rcsOffer,A.matcher.map(v=>v==null?null:String(v)));
  }

  /* ── a study line the reader could not place ──────────────────────────────
     Peterson Plaza's shape. Its study prices two 1BR types, and the first
     arrives as "IBR/1BA" -- a capital I for the digit -- so it has no bedroom
     count and is not a candidate at all. The readable line was then the only
     one, read as unanimous, and BOTH 1BR rows took its $2,025: the 100-unit row
     should have had $2,050, and the schedule went out $2,550 short with nothing
     said. Now the row whose unit count that unplaced line states is ambiguous,
     so the form asks instead of guessing. */
  console.log('\n─ a study line the reader could not place ─');
  { const STUDY={units:[
      {type:'IBR/1BA',  br:'',ba:'',  count:100,proposed:2050,ua:86, safmr:'',safmr_base:''},
      {type:'1BR/1BA',  br:1, ba:1,   count:30, proposed:2025,ua:83, safmr:'',safmr_base:''},
      {type:'3BR/1.5BA',br:3, ba:1.5, count:16, proposed:3250,ua:131,safmr:'',safmr_base:''}],scalars:{}};
    const SCHED={scalars:{'property.name':'Peterson-shaped'},principals:[],ns8:[],nonrev:[],units:[
      {type:'1BR/1BA A',br:1,ba:1,  count:100,rent:1900,ua:60},
      {type:'1BR/1BA B',br:1,ba:1,  count:30, rent:1880,ua:71},
      {type:'3BR/1.5BA',br:3,ba:1.5,count:16, rent:2900,ua:125}]};
    const p=(await db.createProperty('PetersonShaped','PS1')).pid;
    await app.__openForm(p);app.__newCycle({label:'TEST'});
    const cs=app.__cids();await app.__openCycleForm(p,cs[cs.length-1]);
    app.__setRsParsed(SCHED);app.__rsFill();
    app.__setRcsParsed(STUDY);app.__rcsFill();
    eq('the unreadable priced line is counted, once',app.__rcsUnplaced().length,1);
    const m0=app.__rcsMatch(0),m1=app.__rcsMatch(1),m2=app.__rcsMatch(2);
    T('the 100-unit row is ambiguous, not unanimous',m0.many&&m0.unplaced);
    eq('and it names both candidates',m0.types,['1BR/1BA','IBR/1BA']);
    eq('so it takes no rent rather than another type\'s',app.getVal('units.0.proposed'),'');
    T('the 30-unit row is still unambiguous',!m1.many);
    eq('and takes the figure its own line states',app.getVal('units.1.proposed'),'2025');
    T('a bedroom count with one type is untouched',!m2.many);
    eq('and keeps its rent',app.getVal('units.2.proposed'),'3250');
    T('the study tile says a priced line could not be read',/could not read/.test(app.__rcsChecks()));
  }

  /* ── every spelling of a studio ───────────────────────────────────────────
     '' from rcsBrOf does not mean "unknown", it means THIS LINE MATCHES NO ROW,
     so anything it fails to recognise disappears from the study silently. */
  console.log('\n─ rcsBrOf ─');
  eq('a studio arrives as the number 0',      app.__rcsBrOf({br:0}),'Studio');
  eq('and as the word',                       app.__rcsBrOf({br:'Studio'}),'Studio');
  eq('and as an efficiency',                  app.__rcsBrOf({br:'efficiency'}),'Studio');
  eq('one bedroom',                           app.__rcsBrOf({br:1}),'1BR');
  eq('nine bedrooms is not an option',        app.__rcsBrOf({br:9}),'');
  eq('and nothing is nothing',                app.__rcsBrOf({br:''}),'');

  finish();
})().catch(e=>fail('the suite threw before reaching its verdict',e));
