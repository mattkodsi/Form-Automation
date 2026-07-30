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
const MONTHNAMES=['January','February','March','April','May','June','July',
                 'August','September','October','November','December'];
const MIN_CHECKS=222;   // 2026-07-30 merge: union of both branches, counted off a real run (was ours 175 / main 185)
                        //;   // 2026-07-30 merge: the union of both lines, recounted off a real run.
                        // ours: +10 a fill record belongs to one property, one file, and a form that still shows it (M60, M61)
                        // main: +15 the packages list stops being a chooser — one card for the
                        //       current renewal, one line per earlier one, and one way in
                        // 2026-07-29: +12 the schedule — one axis, month headings, the today-line
                        // 2026-07-28: +32 the home page's filter rail, +24 the primary action
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
  /* The menu is a list of what is owed and when. What a profile is short of is
     the property page's subject, not this one's, and asserting its ABSENCE here
     is what keeps it from drifting back onto a row. */
  T('the menu does not tell a row what it needs', !/class="pchip/.test(grid));
  T('menu count chip counts properties', /propert/.test(els.menuCount.textContent));
  T('nothing undefined leaked into the menu', !/undefined/.test(grid));
  /* The guard the rail rests on. With no tracker rows the page keeps the flat
     grid it had — which is what keeps a pre-tracker deployment working, and the
     RA port, whose build does not concatenate hap.js at all. */
  T('with no renewal schedule the page keeps its flat grid', !/data-view=/.test(els.menuCount.innerHTML));
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
    trow('R002','Rail Now','OCAF',10),          // inside the window -> coming
    trow('R003','Rail Soon','OCAF',60),         // inside the window -> coming
    trow('R004','Rail Later','OCAF',200),       // beyond it         -> later
    /* In scope (it has had an OCAF) but with nothing ahead of it: the shape the
       schedule's horizon makes, and the one that must never read as finished. */
    trow('R005','Rail Awaiting','OCAF',-500),
  ]);
  app.openMenu();
  const strip1=els.menuCount.innerHTML, lede1=els.menuLede.textContent, g1=els.menuGrid.innerHTML;
  const c1=app.__menuCounts();
  T('the figures strip renders once the tracker supplies properties', /class="fig/.test(strip1));
  T('nothing undefined leaked into the strip', !/undefined/.test(strip1));
  T('the strip names every band', /already due/.test(strip1)&&/within \d+ days/.test(strip1)
    &&/later/.test(strip1)&&/not in the schedule/.test(strip1)&&/properties/.test(strip1));
  T('and every figure is a control, not a caption', (strip1.match(/data-view=/g)||[]).length===5);
  /* The order is the order of the work: everything, what is coming, what is
     beyond it, what is behind, what is off the schedule. Asserted because it is a
     decision rather than an accident, and nothing else on the page would show it
     had drifted. */
  eq('the figures run in the order of the work',
    (strip1.match(/data-view="([a-z]+)"/g)||[]).map(x=>x.slice(11,-1)),
    ['all','now','later','past','undated']);
  T('the lede explains the view on screen', lede1.length>20);
  eq('a deadline already passed lands in already due', c1.past, 1);
  /* Two, not one: the page's window is MENU_WINDOW (90 days), so the row at
     +60 is coming rather than later. */
  eq('inside the window lands in what is coming',           c1.now, 2);
  eq('further out lands in later',                          c1.later, 1);
  /* Gates Manor carries no tracker code and Rail Awaiting has no future
     startable row: two different reasons, one honest answer — no date. */
  eq('a property with no future renewal, and the uncoded record, are not in the schedule', c1.undated, 2);
  /* The strip's whole claim. Four disjoint bands and their sum, all countable
     on the page under them. */
  eq('the four bands sum to the total', c1.past+c1.now+c1.later+c1.undated, c1.all);
  /* The figure and the grid answer one question. A strip saying 6 above a grid
     of 5 is the defect this pass exists to make impossible. */
  const cardsIn=h=>(h.match(/class="pcard"/g)||[]).length;
  eq('the page opens on everything', app.__menuView(), 'all');
  T('and the figure holding that view is marked current',
    /data-view="all"[^>]*aria-current/.test(strip1));
  /* The strip's claim, restated for the drawer: the total is still countable on
     the page, but 82 of it is countable ON THE BANNER rather than as rows. Cards
     drawn plus the number the banner names must be the figure pressed — a total
     that silently exceeded both would be the drawer hiding rows from the count. */
  const _inDrawer=+(((els.menuPastBar.innerHTML||'').match(/>(\d+)<\/b> already due/)||[])[1]||0);
  eq('the total equals the cards drawn plus the number the banner names',
    cardsIn(g1)+_inDrawer, c1.all);
  app.__setMenuView('later');
  eq('pressing a figure redraws the grid to match it', cardsIn(els.menuGrid.innerHTML), c1.later);
  app.__setMenuView('past');
  eq('and already due draws only what is past', cardsIn(els.menuGrid.innerHTML), c1.past);
  app.__setMenuView('undated');
  eq('not in the schedule draws both populations',    cardsIn(els.menuGrid.innerHTML), c1.undated);
  T('and separates them under the heading that says so',
    /Not in the renewal schedule/.test(els.menuGrid.innerHTML));

  /* ── THREE ZONES ───────────────────────────────────────────────────────
     What is coming leads the page; what is behind waits in a drawer. The flat
     single-list version this replaced opened on eighty rows of what was already
     past, with the twenty-one workable today somewhere down the middle. */
  console.log('\n─ WHAT IS COMING LEADS, WHAT IS BEHIND WAITS ─');
  app.__setMenuView('all');
  const sch=els.menuGrid.innerHTML;
  const heads=(sch.match(/class="mgroup"[^>]*>([^<]*)</g)||[]).map(x=>x.replace(/^[^>]*>/,'').replace(/<$/,''));
  /* Captured, not string-surgeried: `[^>]*` cannot cross the `>` in
     `class="zhead">`, so the tidy-up version of this returned the whole match. */
  const zh=[];{const re=/class="zhead"><h3>([^<]*)</g;let m;while((m=re.exec(sch)))zh.push(m[1]);}
  const bar=els.menuPastBar.innerHTML;
  eq('what is coming and the rest are two grids in the list',
    (sch.match(/class="mgrid rows/g)||[]).length, 2);
  /* The drawer is not in the list. It sits in its own bar flush under the
     masthead — it is not the first item of a list it is not part of, and opening
     it pushes the page's own heading down with everything else. */
  eq('and the drawer is a third, in its own bar above the heading',
    (bar.match(/class="mgrid rows/g)||[]).length, 1);
  T('the list holds none of it', !/id="mPast"/.test(sch)&&!/mpastwrap/.test(sch));
  T('and what is coming is named by the window it holds, not by a date inside it',
    /^Due within \d+ days$/.test(zh[0]||''));
  eq('with the rest of the schedule under it', zh[1], 'Further out');
  /* The drawer. Closed, so the page opens on the work rather than on the
     backlog — and the banner is the only thing standing where 82 rows would. */
  /* id, not class: "mpastwrap" starts with "mpast", so a class test matches the
     drawer's own container and would pass with no banner rendered at all. */
  T('the past-due rows are behind a banner', /id="mPast"/.test(bar));
  T('and it is closed on arrival', /id="mPastWrap"[^>]*hidden/.test(bar));
  T('the banner says how many are back there', new RegExp('>'+c1.past+'</b> already due').test(bar));
  T('and it is a control, not a caption', /aria-expanded="false"/.test(bar));
  T('it offers to show them without saying "them"', /Show</.test(bar)&&!/Show them/.test(bar));
  /* The arrow points DOWN when open, because on a disclosure control an arrow is
     read as the action, not as a compass bearing on where the rows are. */
  T('and closed it carries no arrow at all', !/\u2191/.test(bar)&&!/\u2193/.test(bar));
  /* Filtered TO what is past, the rows ARE the list. Left in the top bar they
     put every row of the chosen view above the page's own heading and left the
     list below it empty — and a banner over them would be a control that closes
     the view just chosen. */
  app.__setMenuView('past');
  const sp=els.menuGrid.innerHTML;
  T('filtered to what is past, the rows are the list and not a drawer',
    !/id="mPast"/.test(sp)&&!/hidden/.test(sp));
  eq('and every one of them is drawn in the list', cardsIn(sp), c1.past);
  eq('with the bar emptied, not left holding them', els.menuPastBar.innerHTML, '');
  app.__setMenuView('all');
  /* Months inside a zone run forward. Read off the markup, because ordering is
     the one thing a count cannot catch: headings in the wrong sequence still sum
     to the same total. */
  const months=heads.filter(h=>/^[A-Z][a-z]+ \d{4}$/.test(h));
  T('each month a zone reaches is headed by its own name', months.length>=2);
  const mi=h=>{const p=h.split(' ');return (+p[1])*12+MONTHNAMES.indexOf(p[0]);};
  const restM=months.slice(months.indexOf(heads.filter(h=>/^[A-Z][a-z]+ \d{4}$/.test(h))[0]));
  eq('and no zone lists its months out of order',
    restM.map(mi).slice().sort((a,b)=>a-b).length, restM.length);
  T('no heading anywhere names a state instead of a date or a window',
    !/Past their date|Remaining|All of them/.test(sch));
  /* Off the axis, so below every month rather than inside the last one. */
  const _sIdx=sch.indexOf('No renewal scheduled');
  const _mLast=sch.lastIndexOf(months[months.length-1]);
  T('a property with no deadline is drawn below the last month, not inside it', _sIdx>_mLast);

  /* ── THE PRIMARY ACTION ────────────────────────────────────────────── */
  console.log('\n─ ONE ACTION PER CARD, DERIVED NOT DECORATED ─');
  app.__setMenuView('all');
  const gall=els.menuGrid.innerHTML;
  T('a tracker card carries an action',     /data-pact=/.test(gall));
  /* The year on the button, the programme in the column headed Program. It used
     to be "Start 2026 OCAF" on a row already reading OCAF one cell to the left \u2014
     the same fact twice, and only because rows inside thirty days once sat in a
     panel with twice the width to spend. Both halves are still asserted; what is
     no longer asserted is that they sit in the same place. */
  T('the action names the year it will start',
    new RegExp('Start '+new Date(T0+132*DAY).getUTCFullYear()+'<').test(gall));
  T('and the programme is named once, in the column headed Program',
    /class="pc-prog[^"]*">OCAF</.test(gall)&&!/Start \d{4} OCAF/.test(gall));
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
  /* In the ledger the action is the verb and the year; a property with no
     scheduled renewal has no year, so the verb stands alone. What matters is
     that it HAS one — rendering it disabled, greyed or absent would retire
     the property on the tracker's say-so. */
  T('a property whose schedule runs out is still startable', /data-pact="R005"[^>]*>Start</.test(gund));
  T('and its button is not disabled', !/data-pact="R005"[^>]*disabled/.test(gund));

  /* How far along a package is comes from the app's own cycles, never from the
     tracker: every workflow column in the export is empty. And it is NOT a
     band. Starting one does not change when the renewal is owed, so it must
     not move the property — the rail used to lift it out of "Needs you" the
     moment a draft existed, which is how a generated-but-rejected package read
     as finished. The band says when; the button says how far. */
  const rpid=(await db.createProperty('Rail Now','R002')).pid;
  const rcid=(await db.createCycle(rpid,{programs:['ocaf'],label:String(new Date(T0+132*DAY).getUTCFullYear()),
    effective_date:us(132)})).cid;
  app.openMenu();app.__setMenuView('all');
  const c2=app.__menuCounts();
  eq('starting a package moves no property between bands',
     [c2.past,c2.now,c2.later,c2.undated], [c1.past,c1.now,c1.later,c1.undated]);
  T('and the row offers to continue what was started', /Continue /.test(els.menuGrid.innerHTML));
  eq('the partition still sums', c2.past+c2.now+c2.later+c2.undated, c2.all);
  await db.setCycleGenerated(rcid,['cover']);
  app.openMenu();app.__setMenuView('all');
  const c3=app.__menuCounts();
  eq('generating it moves nothing either',
     [c3.past,c3.now,c3.later,c3.undated], [c1.past,c1.now,c1.later,c1.undated]);
  T('and the row offers to view what was generated', /View /.test(els.menuGrid.innerHTML));
  eq('and the partition still sums', c3.past+c3.now+c3.later+c3.undated, c3.all);

  /* ── OPENING A PROPERTY THE REGISTRY ALREADY HOLDS ──────────────────
     A record can predate the schedule: imported by hand, or named before the
     tracker code existed. Opening its row then tried to CREATE a second
     property under the same name, hit the one-name rule, and reported "that
     name is already taken" — so the only route into that property was the one
     that refused. It binds the code to the record that is already there. */
  const twin=(await db.createProperty('Rail Later')).pid;
  const before=(db.listProperties()||[]).length;
  const got=await app.__openHap('R004');
  eq('opening a scheduled property finds the record already under that name', got, twin);
  eq('and makes no second one',(db.listProperties()||[]).length, before);
  eq('the tracker code is bound to it', db.propByRaCode('R004'), twin);

  /* ── THE DEV SWEEP, AND WHAT IT MUST NOT TAKE ───────────────────────
     "Not in the schedule" holds two populations: records the tracker never
     carried, and properties it DOES carry whose schedule has run out. The
     sweep is offered on the first and must never reach the second — taking
     both would delete live properties on the tracker's silence. */
  app.__setMenuView('undated');
  const _ug=els.menuGrid.innerHTML;
  T('the sweep is offered where the records the schedule does not carry are named',
    /id="orphPurge"/.test(_ug));
  T('and it is named for the population, not for the view', /Not in the renewal schedule/.test(_ug));
  /* R005's schedule has run out. It is in the tracker, so it is not the
     sweep's business, and it has no record to delete in any case. */
  T('a property whose schedule ran out is under its own heading', /No renewal scheduled/.test(_ug));

  /* ── DISPLAY FORMATTING ─────────────────────────────────────────────
     Formatted where it is shown, never in the record. A units column reading
     1689 is a database dump; this product files with HUD. */
  const F=app.__fmt;
  eq('figures carry thousands separators', [F.num(1689),F.num(51),F.num(1234567)], ['1,689','51','1,234,567']);
  eq('and a blank stays blank rather than becoming a zero', F.num(''), '');
  eq('phone numbers take one shape', F.phone('5551234567'), '(555) 123-4567');
  eq('a leading country code is dropped, not counted', F.phone('1-555-123-4567'), '(555) 123-4567');
  /* Inventing a shape for digits we cannot read would assert a phone number
     where the record holds something else. */
  eq('and anything that is not a phone number is shown verbatim', F.phone('x1234'), 'x1234');
  eq('email addresses are lower case', F.email('  Claire.Beatty@Related.COM '), 'claire.beatty@related.com');

  /* Search is a find-within: it forces the All view so a name is never hidden by
     the filter, and it does not overwrite the view you were in. */
  app.__setMenuView('later');
  els.menuSearch.value='Overdue';
  app.renderMenu();
  T('searching finds a property outside the current view', /Rail Overdue/.test(els.menuGrid.innerHTML));
  eq('without moving the view you were in', app.__menuView(), 'later');
  els.menuSearch.value='';
  app.renderMenu();
  eq('clearing the search returns you there', app.__menuView(), 'later');
  T('and draws that view again', cardsIn(els.menuGrid.innerHTML)===app.__menuCounts().later);

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
  T('BBRA is named as not yet available', /BBRA · Budget-Based Rent Adjustment — not yet available/.test(lb1));
  T('launcher has the letterhead slot',   /letterhead/i.test(lb1));
  T('a property with no packages says so',/No packages yet/.test(lb1));
  T('nothing undefined leaked into the launcher', !/undefined/.test(lb1));
  /* Gates Manor is not in the schedule, so the strip has nothing to say about
     it — and says nothing, rather than an empty "NEXT RENEWAL —". */
  T('an uncoded property gets no next-renewal strip', !/NEXT RENEWAL/.test(lb1));
  app.openLauncher(rpid);
  const lbT=els.launcherBody.innerHTML;
  /* And a tracker property whose renewal ALREADY HAS a package gets no strip
     either — the card is that renewal. The page was printing the same fact twice,
     a strip saying RCS effective October 1 over a card saying RCS effective
     October 1, and it read as two RCSs. The deadline and the action move into the
     card; there is one box per renewal because there is one package per programme
     per date. */
  T('a tracker property whose renewal has a package gets no strip either',
    !/NEXT RENEWAL/.test(lbT));
  T('the card carries the deadline the strip used to',   /pc-due/.test(lbT));
  T('and the action, so the one box still has something to press', /id="nuGo"/.test(lbT));
  T('nothing undefined leaked into it',   !/undefined/.test(lbT));
  app.openLauncher(pid);

  /* bootstrapFirstCycle migrates an existing single-record property into its
     own package #1, asynchronously, then re-renders. That re-render is the
     state a returning user actually sees, so it is the one worth asserting. */
  for(let i=0;i<8;i++) await new Promise(r=>setTimeout(r,0));
  const lb2=els.launcherBody.innerHTML;
  T('the existing record is migrated into package #1', /class="cycard/.test(lb2));
  T('that package is marked as the current one',       /cy-dom/.test(lb2));
  T('it is labelled by the date it takes effect',      /Effective September 1, 2026/.test(lb2));
  T('the affordability check renders inside the card', /AFFORDABILITY CHECK/.test(lb2));
  T('and reports the headroom',                        /\$37,689 headroom/.test(lb2));
  T('nothing undefined leaked into the re-render',     !/undefined/.test(lb2));
  eq('the data layer agrees there is one package', db.listCycles(pid).length, 1);
  eq('and reports its programs as an array',      db.listCycles(pid)[0].programs, ['rcs']);

  /* ─ THE CURRENT RENEWAL LEADS, THE REST IS A RECORD ─
     The list was a chooser: N equal cards, each one a candidate. It is not that
     any more — the schedule decides which package you work on, and a programme
     can be started only once per effective date — so what it has to hold is the
     current renewal expanded with its figures and every earlier package as one
     line. Asserted on its own property so the phases above keep their fixture. */
  console.log('\n─ THE CURRENT RENEWAL LEADS, THE REST IS A RECORD ─');
  const hpid=(await db.createProperty('Hollis Court')).pid;
  await db.createCycle(hpid,{programs:['rcs'],label:'2026',effective_date:'2026-09-01'});
  await db.createCycle(hpid,{programs:['uaf'],label:'2026',effective_date:'2026-09-01'});
  await db.createCycle(hpid,{programs:['ocaf'],label:'2025',effective_date:'2025-09-01'});
  await db.createCycle(hpid,{programs:['ocaf'],label:'2024',effective_date:'2024-09-01'});
  app.openLauncher(hpid);
  const lb3=els.launcherBody.innerHTML;
  const nCard=(lb3.match(/class="cycard/g)||[]).length;
  const nRow=(lb3.match(/class="cyrow"/g)||[]).length;
  eq('the two packages sharing the current date stay cards', nCard, 2);
  eq('the two earlier ones collapse to a line each',         nRow,  2);
  eq('every package is drawn exactly once',      nCard+nRow, db.listCycles(hpid).length);
  T('the earlier ones sit under their own heading', /cyh-t">Earlier</.test(lb3));
  eq('exactly one package is marked current',   (lb3.match(/cy-dom/g)||[]).length, 1);
  T('and the chip says it in one word',         />Current</.test(lb3));
  /* A UA effective the same day is the same renewal done in two packages. Filed
     under Earlier it would read as a year older than it is. */
  const hist=lb3.slice(lb3.indexOf('class="cyledger"'));
  T('a UA effective the current date is not filed as earlier', !/UAF/.test(hist));
  T('the earlier lines name their programme',   /OCAF/.test(hist));
  T('and the date it took effect',              /September 1, 2025/.test(hist));
  /* Two independent questions. How loud the control is answers whether there is
     another way in; what it says answers whether this is the first. */
  T('with the schedule silent, starting one is the primary control',
    /class="btn p" id="bNewCycle"/.test(lb3));
  T('and it says another, because three exist already', /Start another package/.test(lb3));
  app.openLauncher(rpid);
  const lb4=els.launcherBody.innerHTML;
  T('where the schedule offers a way in, starting one is quiet',
    /class="addrow" id="bNewCycle"/.test(lb4));
  eq('leaving the schedule\u2019s own action as the only primary',
    (lb4.match(/class="btn p"/g)||[]).length, 1);
  /* The data layer hands back an em dash for a property with no number. Printed
     straight it was a line holding one dash, which reads as a rendering fault. */
  const bpid=(await db.createProperty('Bare Record')).pid;
  app.openLauncher(bpid);
  const lb5=els.launcherBody.innerHTML;
  eq('a property with nothing but a name reports an em dash',
    (db.listProperties().find(p=>p.id===bpid)||{}).fha, '\u2014');
  T('and the page prints no meta line at all',  !/class="lh-meta"/.test(lb5));
  T('nothing undefined leaked into either',     !/undefined/.test(lb3+lb5));

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
  /* ── A FILL RECORD BELONGS TO ONE PROPERTY AND ONE FILE ────────────────
     The roster re-read that makes the two upload orders agree is gated on
     _rcsFill, the record that the study has been APPLIED. openCycleForm cleared
     the READINGS and left the RECORDS standing, so the record crossed from one
     property to the next: measured on HEAD, property B -- whose study had only
     been uploaded, never applied -- came out with the study's proposed rents on
     every row the moment its schedule was filled. Applying a document the user
     has not asked for, on a property they had not applied it to.

     A page reload is the other half of this and only the browser suite can see
     it; this is the half that is cheap to keep here. */
  console.log('\n─ a fill record belongs to one property and one file ─');
  { const STUDY={units:[
      {type:'Studio',br:0,ba:1,count:'',proposed:1000,ua:50,safmr:'',safmr_base:''},
      {type:'1BR',   br:1,ba:1,count:'',proposed:1500,ua:75,safmr:'',safmr_base:''}],scalars:{}};
    const SCHED={scalars:{},principals:[],ns8:[],nonrev:[],units:[
      {type:'Studio A',br:'Studio',ba:1,count:10,rent:900, ua:41},
      {type:'Studio B',br:'Studio',ba:1,count:6, rent:950, ua:42},
      {type:'1BR A',   br:1,       ba:1,count:12,rent:1400,ua:71},
      {type:'1BR B',   br:1,       ba:1,count:4, rent:1450,ua:72}]};
    const open=async name=>{const p=(await db.createProperty(name,name)).pid;
      await app.__openForm(p);await app.__newCycle({label:'TEST'});
      const cs=app.__cids();const cid=cs[cs.length-1];
      await app.__openCycleForm(p,cid);return {p,cid};};
    const proposed=()=>app.__UNITS().map(i=>String(app.getVal('units.'+i+'.proposed')||''));
    const counts=()=>app.__UNITS().map(i=>String(app.getVal('units.'+i+'.num_units')||''));

    /* A: the study is applied, then the schedule. M59's own case, as a control. */
    const A=await open('Record owner A');
    app.__setRcsParsed(STUDY);app.__rcsFill();
    app.__setRsParsed(SCHED); app.__rsFill();
    eq('the study reaches both variants of each type',proposed(),['1000','1000','1500','1500']);
    const recA=app.__fillRecords();
    eq('and the fill is recorded against the file it came from',recA.rcs&&recA.rcs.name,'study.pdf');
    T('the record is stored with the package, not just held in memory',
      !!((db.getCycleRcs(A.cid)||{}).fill));
    /* Saved, because a record only outlives the page if what it describes does —
       see the retirement rule below. This save is part of the setup, not a check. */
    for(const i of app.__UNITS())
      for(const f of ['proposed','br','ba','num_units'])await app.__saveField('units.'+i+'.'+f);

    /* B: the study is UPLOADED and never applied. */
    const B=await open('Record owner B');
    app.__setRcsParsed(STUDY);
    T('a study only uploaded claims no fill',!app.__fillRecords().rcs);
    app.__setRsParsed(SCHED);app.__rsFill();
    eq('its schedule still lays down the roster',counts(),['10','6','12','4']);
    eq('but the study it never applied stays unapplied',proposed(),['','','','']);

    /* …and re-opening A finds its own record again, not B's absence.
       UPDATED 2026-07-30: this check used to pass on an UNSAVED fill, which was
       the old behaviour and was wrong — a record that outlives the values it
       describes made the study tile read "Filled 10 values — 3 still to save."
       over a form showing none of them. A is saved above, so the record is still
       true and must come back. */
    await app.__openCycleForm(A.p,A.cid);
    eq('re-opening the first package restores its own SAVED record',
       (app.__fillRecords().rcs||{}).name,'study.pdf');
    /* Replacing the document retires the record: a fill is about the file it
       names, which is the rule fillNote has always used and the gate now does. */
    app.__setRcsParsed(STUDY);
    T('and replacing the study retires it',!app.__fillRecords().rcs);

    /* ── and the record retires itself when the form no longer shows the fill ──
       The other half of the same rule, and the reason the check above now says
       SAVED. Applied and never saved, the values go back to what is on file the
       moment the package is re-opened; the record must go with them. */
    const D=await open('Record owner D');
    app.__setRcsParsed(STUDY);app.__rcsFill();
    eq('a fresh fill is claimed while it is on the form',
       (app.__fillRecords().rcs||{}).name,'study.pdf');
    await app.__openCycleForm(D.p,D.cid);
    T('but an unsaved fill is retired when the package is re-opened',
      !app.__fillRecords().rcs);
  }

  console.log('\n─ rcsBrOf ─');
  eq('a studio arrives as the number 0',      app.__rcsBrOf({br:0}),'Studio');
  eq('and as the word',                       app.__rcsBrOf({br:'Studio'}),'Studio');
  eq('and as an efficiency',                  app.__rcsBrOf({br:'efficiency'}),'Studio');
  eq('one bedroom',                           app.__rcsBrOf({br:1}),'1BR');
  eq('nine bedrooms is not an option',        app.__rcsBrOf({br:9}),'');
  eq('and nothing is nothing',                app.__rcsBrOf({br:''}),'');

  finish();
})().catch(e=>fail('the suite threw before reaching its verdict',e));
