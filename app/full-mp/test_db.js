/* test_db.js — headless proof of the single-record multi-property data layer.

   Hardened 2026-07-27, like the other two suites: every exit path sets a
   non-zero code, the verdict is the LAST line printed so a piped run still
   shows it, and MIN_CHECKS catches a run that dies partway — a short count is
   a failure, not a pass. Adding checks? Raise MIN_CHECKS. */
const { makeDb, memoryAdapter, isPerCycleKey, migrate, computeAnalysis, computeSalutation, CROSSWALK } = require('./db.js');
const MIN_CHECKS = 190;   // 2026-07-30 merge: union of both branches, counted off a real run (was ours 169 / main 186)
                        //;   // 2026-07-30: +4 current rents and executed UA carry on no programme
let fails = 0, n = 0, verdict = null;
const BAR = '═'.repeat(68);
function fail(msg, err) {
  verdict = 'fail'; process.exitCode = 1;
  console.log('\n' + BAR);
  console.log('  ✗✗✗  DATA-LAYER SUITE FAILED — DO NOT SHIP  ✗✗✗');
  console.log('  ' + msg);
  if (err) console.log(String(err && err.stack || err).replace(/^/gm, '  '));
  console.log(BAR);
  console.log(`✗ DATA-LAYER SUITE FAILED (${n} checks ran, ${fails} failed)`);
}
function finish() {
  if (fails) return fail(`${fails} of ${n} checks failed — see the ✗ lines above`);
  if (n < MIN_CHECKS) return fail(`only ${n} of the expected ${MIN_CHECKS} checks ran — the suite died partway, or checks were deleted without lowering MIN_CHECKS on purpose`);
  verdict = 'pass'; console.log(`\n✓ ALL ${n} CHECKS PASSED\n`);
}
process.on('exit', () => { if (verdict === null) fail(`the run ended without a verdict after ${n} of ${MIN_CHECKS} checks — it died partway`); });
process.on('unhandledRejection', e => { fail('unhandled rejection — an async throw is a failure, never a pass', e); process.exit(1); });
process.on('uncaughtException', e => { fail('uncaught exception', e); process.exit(1); });
const ok = (label, got, want) => { n++; const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) { fails++; console.log(`  ✗ FAIL  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${label}`); };
const truthy = (label, v) => ok(label, !!v, true);
function jsonAdapter() { let s = null; return { get: async () => (s ? JSON.parse(s) : null), set: async o => { s = JSON.stringify(o); }, clear: async () => { s = null; } }; }
(async () => {
  console.log('\n─ 1 · SEED + REGISTRY ─');
  const adapter = jsonAdapter(); let db = await makeDb(adapter);
  let props = db.listProperties();
  ok('seeds one property', props.length, 1);
  ok('seeded name', props[0].name, 'Gates Manor Apartments');
  ok('seeded total units', props[0].total_units, 51);
  /* The ring answers the question generation asks — see score.js. Gates Manor
     holds all ten of the keys the OLD ring counted and still cannot write four
     of its six documents, so 100% was never true of it. This is the headline
     regression: it read 100 before, and a green suite said nothing. */
  /* Was 65 / 4 of 6 while the FHA number was a blocker. It is a caveat now: a
     Section 8 property with no FHA-insured mortgage prints N/A in that box, and
     hasReal() reads N/A as not-an-answer — so requiring it made the draft rent
     schedule permanently un-generatable for those properties. The seed gains
     the schedule and the notice that depended on it. */
  /* Still 65: the percentage is progress through gate 2, and one blocker
     remains (the tenant-notice sender). Only the DOCUMENT count moved, which is
     the point — the schedule can be written now. */
  ok('the seed does not claim to be complete', Math.round(props[0].completeness*100), 65);
  ok('and the number says what it is counting', props[0].caption, '5 of 6 documents ready');
  ok('which is the same count the row carries', [props[0].docs_ready, props[0].docs_total], [5, 6]);
  ok('no cycles field', props[0].cycles, undefined);
  const gates = db.getActive().pid; truthy('active pid set', gates); ok('no sid', db.getActive().sid, undefined);

  console.log('\n─ 2 · DURABLE vs PER-CYCLE ROUTING ─');
  const raw = db._raw().props[gates];
  truthy('durable bucket', raw.durable); truthy('percycle bucket', raw.percycle); ok('no cycles array', raw.cycles, undefined);
  truthy('durable: property.name', raw.durable['property.name']);
  truthy('durable: unit num_units', raw.durable['units.0.num_units']);
  truthy('durable: Part B', raw.durable['partb.equipment.0']);
  ok('durable NOT rent', raw.durable['units.0.current'], undefined);
  truthy('percycle: current rent', raw.percycle['units.0.current']);
  truthy('percycle: SAFMR', raw.percycle['units.0.safmr_hud']);
  truthy('percycle: appraiser', raw.percycle['appr.firm']);
  ok('isPerCycleKey rent', isPerCycleKey('units.3.proposed'), true);
  ok('isPerCycleKey num_units durable', isPerCycleKey('units.3.num_units'), false);

  console.log('\n─ 3 · GATES NUMBERS (executed-RS accurate, UA $31) ─');
  let form = db.loadForm(gates); let a = computeAnalysis(form);
  ok('UA (exec) = 31', form['units.0.ua_exec'].value, '31');
  ok('current GPR  $98,634', Math.round(a.current_gpr), 98634);
  ok('proposed GPR $140,556', Math.round(a.proposed_gpr), 140556);
  ok('150% ceiling $178,245', Math.round(a.ceiling), 178245);
  ok('headroom     $37,689', Math.round(a.headroom), 37689);
  ok('PASS', a.pass, true);
  ok('lift +43%', a.pct, 43);
  ok('per unit +$822', Math.round(a.per_unit), 822);
  ok('salutation', computeSalutation(form), 'Dear Ms. Gross');

  console.log('\n─ 4 · MANY PROPERTIES ─');
  const v = db.createProperty('Crossroads of East Ravenswood'); db.createProperty('Harbor Point');
  props = db.listProperties();
  ok('three properties', props.length, 3);
  ok('sorted (Crossroads first)', props[0].name, 'Crossroads of East Ravenswood');
  let nf = db.loadForm(v.pid);
  ok('new durable name', nf['property.name'].value, 'Crossroads of East Ravenswood');
  ok('new has no rent', computeAnalysis(nf).proposed_gpr, 0);

  console.log('\n─ 5 · SAVE ROUTING + NO HISTORY ─');
  const hp0 = db.listProperties().find(p=>p.name==='Harbor Point');
  let hf = db.loadForm(hp0.id);
  hf['property.name'] = { value:'Harbor Point Apartments', source:'overridden' };
  hf['units.0.num_units'] = { value:'80', source:'this-cycle' };
  hf['units.0.current'] = { value:'1500', source:'this-cycle' };
  await db.saveForm(hp0.id, hf);
  ok('registry renamed', db.listProperties().find(p=>p.id===hp0.id).name, 'Harbor Point Apartments');
  ok('registry units', db.listProperties().find(p=>p.id===hp0.id).total_units, 80);
  truthy('num_units DURABLE', db._raw().props[hp0.id].durable['units.0.num_units']);
  truthy('current PERCYCLE', db._raw().props[hp0.id].percycle['units.0.current']);
  let hf2 = db.loadForm(hp0.id); hf2['units.0.current']={value:'1625',source:'this-cycle'}; await db.saveForm(hp0.id,hf2);
  ok('per-cycle overwrites', db.loadForm(hp0.id)['units.0.current'].value, '1625');
  ok('durable persists', db.loadForm(hp0.id)['units.0.num_units'].value, '80');

  console.log('\n─ 6 · LETTERHEAD + RENAME + MIGRATION + RECENCY ─');
  await db.setLetterhead(gates,'gates-letterhead.png','data:thumb');
  ok('letterhead name', db.getLetterhead(gates).name, 'gates-letterhead.png');
  ok('registry has_letterhead', db.listProperties().find(p=>p.id===gates).has_letterhead, true);
  await db.renameProperty(v.pid,'Crossroads (E. Ravenswood)');
  ok('rename reflected', db.listProperties().find(p=>p.id===v.pid).name, 'Crossroads (E. Ravenswood)');
  const old={v:1,meta:{seq:1,activePid:'p1',activeSid:{p1:'c1'}},props:{p1:{id:'p1',created_at:'2026-01-01',durable:{},cycles:{c1:{cells:{'units.0.current':{value:'900',source:'database',saved_at:'x'}}}},cycleOrder:['c1']}}};
  migrate(old);
  ok('migrate drops cycles', old.props.p1.cycles, undefined);
  ok('migrate carries percycle', old.props.p1.percycle['units.0.current'].value, '900');
  const rdb=await makeDb(jsonAdapter()); const gp=rdb.getActive().pid; const hp2=rdb.createProperty('Home').pid;
  await rdb.saveFlat(gp,{'property.name':{value:'Gates'}}); await new Promise(r=>setTimeout(r,8)); await rdb.saveFlat(hp2,{'property.name':{value:'Home'}});
  ok('updated_at has time', /T\d\d:\d\d:\d\d/.test(rdb._raw().props[hp2].updated_at), true);
  ok('later save ranks first', rdb._raw().props[hp2].updated_at > rdb._raw().props[gp].updated_at, true);

  console.log('\n─ 7 · REOPEN + DELETE ─');
  const db2 = await makeDb(adapter);
  ok('survive reopen', db2.listProperties().length, 3);
  const g2 = db2.listProperties().find(p=>p.name==='Gates Manor Apartments');
  ok('Gates numbers survive reopen', Math.round(computeAnalysis(db2.loadForm(g2.id)).proposed_gpr), 140556);
  await db2.deleteProperty(hp0.id);
  ok('property deleted', db2.listProperties().length, 2);
  truthy('active valid after delete', db2.getActive().pid && db2._raw().props[db2.getActive().pid]);

  /* ── 8 · CYCLES + DIRECTORY ──────────────────────────────────────────────
     db.js is the harness's stand-in for db.supabase.js, so the cycle surface
     ported into it is held to the backend's rules, not merely to "it runs".
     These check the rules that actually decide what the user sees: which cycle
     is dominant, what carries into a new one, and what writes back to the
     template. */
  console.log('\n─ 8 · CYCLES ─');
  const cdb = await makeDb(jsonAdapter());
  const cpid = cdb.getActive().pid;
  ok('no cycles before one is made', cdb.listCycles(cpid).length, 0);
  ok('no dominant cycle either', cdb.dominantCycleId(cpid), null);
  const { cid } = await cdb.createCycle(cpid, { full: true, programs: ['rcs'] });
  let cys = cdb.listCycles(cpid);
  ok('one cycle after createCycle', cys.length, 1);
  ok('programs read back as an ARRAY (stored joined, like the backend)', cys[0].programs, ['rcs']);
  ok('the only cycle is dominant', cys[0].dominant, true);
  ok('label derives from the effective date', cys[0].label, '2026');
  ok('effective date derives from date_eff_rs', cys[0].effective_date, '2026-09-01');
  ok('a full snapshot carries the proposed rents', cdb.getFlatCycle(cid)['units.0.proposed'].value, '2725');
  ok('the letterhead blob is never snapshotted', cdb.getFlatCycle(cid)['assets.letterhead_data'], undefined);
  ok('cycleAnalysis matches the property numbers', Math.round(cdb.cycleAnalysis(cid).proposed_gpr), 140556);
  ok('propertyAnalysis now reads the dominant cycle', Math.round(cdb.propertyAnalysis(cpid).proposed_gpr), 140556);
  ok('the menu card counts units from the dominant cycle', cdb.listProperties().find(p => p.id === cpid).total_units, 51);

  console.log('\n─ 8b · WHAT CARRIES INTO A NEW CYCLE ─');
  const { cid: cid2 } = await cdb.createCycle(cpid, { programs: ['rcs'], effective_date: '2027-09-01' });
  const c2 = cdb.getFlatCycle(cid2);
  /* What took effect is whatever the CA returned after the owner submitted, and
     the only record of that is the executed schedule. So a rent or an allowance
     we have not read from one must never arrive wearing the colour of saved
     truth — on ANY programme. These two were dropped on RCS years only until
     2026-07-30, which meant an OCAF built from an OCAF inherited a rent one full
     cycle stale (nothing rolls proposed into current) and computed this year's
     factor against it. */
  ok('an RCS year does NOT inherit last year\'s current rents', c2['units.0.current'], undefined);
  ok('nor its utility allowances', c2['units.0.ua_exec'], undefined);
  ok('nor what LAST year\'s study read', c2['units.0.br_rcs'], undefined);
  ok('nor the SAFMR ceilings HUD restates every year', c2['units.0.safmr_hud'], undefined);
  ok('nor a decision made about numbers that have changed', c2['units.0.safmr_reviewed'], undefined);
  ok('nor the owner\'s checklist, which is signed per package', c2['check.0'], undefined);
  ok('unit mix carries forward', c2['units.0.num_units'].value, '51');
  ok('last cycle\'s PROPOSED rents do not', c2['units.0.proposed'], undefined);
  ok('the appraiser does not', c2['appr.firm'], undefined);
  ok('the date chosen at creation wins', c2['rent_schedule.date_eff_custom'].value, '2027-09-01');
  ok('and is marked custom', c2['rent_schedule.date_eff_source'].value, 'custom');
  ok('identity is stamped from the property record', c2['property.name'].value, 'Gates Manor Apartments');

  console.log('\n─ 8c · WHICH CYCLE IS DOMINANT ─');
  ok('the later year takes over', cdb.dominantCycleId(cpid), cid2);
  /* Year is ranked BEFORE the full date, so a cycle whose year is known only
     from its label still outranks an earlier-dated one. Isolating that here:
     without it, the date tiebreak alone satisfies the check above. */
  const { cid: cidL } = await cdb.createCycle(cpid, { programs: ['rcs'], label: '2028' });
  ok('a label-only year still outranks an earlier dated cycle', cdb.dominantCycleId(cpid), cidL);
  await cdb.deleteCycle(cidL);
  ok('and dominance falls back when it goes', cdb.dominantCycleId(cpid), cid2);
  ok('dominant sorts first in the list', cdb.listCycles(cpid)[0].id, cid2);
  await cdb.setCyclePrograms(cid2, ['rcs', 'uaf']);
  ok('programs update', cdb.listCycles(cpid).find(c => c.id === cid2).programs, ['rcs', 'uaf']);
  const { cid: cid3 } = await cdb.createCycle(cpid, { programs: ['ocaf'], effective_date: '2027-09-01' });
  ok('same year: RCS+UAF still outranks OCAF', cdb.dominantCycleId(cpid), cid2);
  await cdb.setCycleGenerated(cid2, ['Cover letter']);
  ok('generated is recorded', cdb.listCycles(cpid).find(c => c.id === cid2).generated.docs, ['Cover letter']);
  await cdb.deleteCycle(cid3);
  ok('deleting a cycle removes it', cdb.listCycles(cpid).length, 2);

  /* ---- one package per programme per effective date ----
     Matt's rule for the new hierarchy: a year's line holds that year's package.
     NOT one per year, for two reasons the corpus and the process both insist on.
     Luther Towers (90111) carries two startable rows in ONE calendar year — OCAF
     2026-09-01 and OCAF 2026-12-06 — so a year key would let it hold one of its two
     real packages. And the utility allowance can be done alongside the rent action
     or on its own, so one date may legitimately carry {rcs,uaf} as a single package
     or {rcs} and {uaf} as two. Keying on the programme WITHIN the date permits both
     and rejects a programme twice. */
  console.log('\n─ 8c1b · ONE PACKAGE PER PROGRAMME PER DATE ─');
  const gdA = cdb.createProperty('Guard Alpha').pid;
  const gdB = cdb.createProperty('Guard Beta').pid;
  const mk = async (pid, o) => { try { await cdb.createCycle(pid, o); return 'made'; }
    catch (e) { return (e && e.code) ? e : String((e && e.message) || e); } };
  const gd1 = await cdb.createCycle(gdA, { programs: ['rcs'], effective_date: '2028-04-01' });
  ok('a first RCS at a date is made', typeof gd1.cid === 'string' && !!gd1.cid, true);
  const gd2 = await mk(gdA, { programs: ['rcs'], effective_date: '2028-04-01' });
  ok('a second RCS at the same date is refused', gd2.code, 'DUP_PACKAGE_PROGRAM');
  ok('and it names the package already holding it', gd2.cid, gd1.cid);
  ok('and says which programme clashed', gd2.programs, ['rcs']);
  /* Matt: "you can do RCS/OCAF + UA separately in a given year". */
  ok('a UA package alongside it IS allowed',
    await mk(gdA, { programs: ['uaf'], effective_date: '2028-04-01' }), 'made');
  /* Which means the date now holds both, so BOTH are taken. */
  ok('and then a second UA at that date is refused',
    (await mk(gdA, { programs: ['uaf'], effective_date: '2028-04-01' })).code, 'DUP_PACKAGE_PROGRAM');
  /* A combined package is the other legitimate shape of the same year. */
  ok('the two together as one package is allowed',
    await mk(gdB, { programs: ['rcs', 'uaf'], effective_date: '2028-04-01' }), 'made');
  ok('after which neither half can be started again',
    (await mk(gdB, { programs: ['rcs'], effective_date: '2028-04-01' })).code, 'DUP_PACKAGE_PROGRAM');
  ok('but a programme the date does not hold still can',
    await mk(gdB, { programs: ['ocaf'], effective_date: '2028-04-01' }), 'made');
  /* The Luther Towers shape: same programme, same YEAR, different date. */
  ok('the same programme at a different date in the same year is allowed',
    await mk(gdA, { programs: ['rcs'], effective_date: '2028-12-06' }), 'made');
  /* Nothing to be unique against. */
  ok('an undated package is not guarded', await mk(gdA, { programs: ['rcs'] }), 'made');
  /* The rule has to be the same rule in the layer the app actually runs on. */
  {
    const _fs = require('fs'), _p = require('path');
    const sup = _fs.readFileSync(_p.join(__dirname, 'db.supabase.js'), 'utf8');
    ok('db.supabase.js carries the same guard',
      /assertProgramsFree/.test(sup) && /DUP_PACKAGE_PROGRAM/.test(sup), true);
    ok('and calls it from createCycle',
      /createCycle\(pid, opts\)[\s\S]{0,400}?assertProgramsFree\(/.test(sup), true);
  }

  console.log('\n─ 8c2 · THE PARSED RENT SCHEDULE ─');
  /* The reading of the executed schedule used to live in a page-load variable,
     so every source row that read it went dim on refresh while rows backed by a
     real saved field (units.N.ua_exec) survived — one dropdown menu telling two
     different stories. It is stored with its package now, so these check the
     rules that bug broke: it comes back whole, it comes back after a reload, and
     it does NOT follow you into next year's package. */
  const radapter = jsonAdapter();
  let rdbc = await makeDb(radapter);
  const rp = rdbc.getActive().pid;
  const { cid: rc1 } = await rdbc.createCycle(rp, { full: true, programs: ['rcs'] });
  ok('a fresh package remembers no schedule', rdbc.getCycleRs(rc1), {});
  const DOC = { name: 'Beacon Hill executed RS.pdf', kind: 'fields', via: 'text', at: '2026-07-27T14:00:00.000Z',
                parsed: { scalars: { 'property.s8': 'MI43T000123', 'property.name': 'Beacon Hill' },
                          units: [{ type: '1 BR / 1 BA', count: 10, rent: 900, ua: 75 }], principals: [], ns8: [], nonrev: [] } };
  await rdbc.setCycleRs(rc1, DOC);
  ok('the reading is stored whole', rdbc.getCycleRs(rc1), DOC);
  ok('including the nested unit rows the rows-dropdowns read', rdbc.getCycleRs(rc1).parsed.units[0].ua, 75);
  ok('and the scalars the source rows read', rdbc.getCycleRs(rc1).parsed.scalars['property.s8'], 'MI43T000123');
  /* THE regression: this is the reload the old code could not survive. */
  rdbc = await makeDb(radapter);
  ok('it survives a reload of the data layer', rdbc.getCycleRs(rc1).name, 'Beacon Hill executed RS.pdf');
  ok('with its parse intact, not just its filename', rdbc.getCycleRs(rc1).parsed.scalars['property.name'], 'Beacon Hill');
  ok('no PDF bytes were stored', 'bytes' in rdbc.getCycleRs(rc1), false);
  const { cid: rc2 } = await rdbc.createCycle(rp, { programs: ['rcs'], effective_date: '2027-09-01' });
  ok('next year’s package does NOT inherit last year’s schedule', rdbc.getCycleRs(rc2), {});
  ok('and the package it was built from still has its own', rdbc.getCycleRs(rc1).name, 'Beacon Hill executed RS.pdf');
  await rdbc.setCycleRs(rc1, {});
  ok('replacing it with nothing clears it', rdbc.getCycleRs(rc1), {});
  ok('asking an unknown package is empty, not a throw', rdbc.getCycleRs('no-such-cycle'), {});

  console.log('\n─ 8d · WRITE-THROUGH + PRUNING ─');
  await cdb.saveFlatCycle(cid2, { 'property.name': { value: 'Gates Manor (renamed in cycle)' } });
  ok('identity edits on the dominant cycle reach the template', cdb.getFlat(cpid)['property.name'].value, 'Gates Manor (renamed in cycle)');
  await cdb.saveFlatCycle(cid2, { 'units.0.current': { value: '2000' } });
  ok('unit rents do NOT write back to the template', cdb.getFlat(cpid)['units.0.current'].value, '1903');
  await cdb.saveFlatCycle(cid, { 'property.name': { value: 'Not the dominant cycle' } });
  ok('a non-dominant cycle never writes through', cdb.getFlat(cpid)['property.name'].value, 'Gates Manor (renamed in cycle)');
  await cdb.pruneCycleCells(cid2, [], [], [], []);
  ok('pruning drops unit rows from the snapshot', cdb.getFlatCycle(cid2)['units.0.current'], undefined);
  ok('but leaves the rest of the snapshot', cdb.getFlatCycle(cid2)['property.name'].value, 'Gates Manor (renamed in cycle)');
  await cdb.saveFlat(cpid, { 'ns8.0.avg_rent': { value: '1200' }, 'principals.0.name': { value: 'A Principal' } });
  await cdb.pruneUnitRows(cpid, ['0'], [], [], []);
  ok('pruneUnitRows now prunes ns8 rows too', cdb.getFlat(cpid)['ns8.0.avg_rent'], undefined);
  ok('and principal rows', cdb.getFlat(cpid)['principals.0.name'], undefined);
  ok('while keeping the unit row it was told to keep', cdb.getFlat(cpid)['units.0.num_units'].value, '51');

  console.log('\n─ 8e · DIRECTORY ─');
  /* Awaited, because the real backend answers with a promise of the id and the
     stand-in must answer the same way — a test that read the id straight out
     would pass here and fail against Supabase, which is the fiction the parity
     rule exists to prevent. */
  const d1 = await cdb.addDir('appraiser', { name: 'Zeta Appraisal', email: 'z@example.com' });
  await cdb.addDir('appraiser', { name: 'Alpha Appraisal' });
  await cdb.addDir('ca', { name: 'Some CA' });
  ok('adding a directory entry answers with an id, as the backend does', typeof d1, 'string');
  ok('directory filters by kind', cdb.listDir('appraiser').length, 2);
  ok('and sorts by name', cdb.listDir('appraiser')[0].name, 'Alpha Appraisal');
  ok('a directory record carries the full field set', cdb.listDir('appraiser').find(c => c.id === d1).email, 'z@example.com');
  await cdb.updateDir(d1, { phone: '(555) 555-5555' });
  ok('update patches it', cdb.listDir('appraiser').find(c => c.id === d1).phone, '(555) 555-5555');
  await cdb.deleteDir(d1);
  ok('delete removes it', cdb.listDir('appraiser').length, 1);
  ok('other kinds are untouched', cdb.listDir('ca').length, 1);

  console.log('\n─ 8f · CYCLES SURVIVE A REOPEN ─');
  const cadapter = jsonAdapter();
  const rdb1 = await makeDb(cadapter); const rpid = rdb1.getActive().pid;
  await rdb1.createCycle(rpid, { full: true, programs: ['rcs'] });
  const rdb2 = await makeDb(cadapter);
  ok('the cycle is still there after reopening', rdb2.listCycles(rpid).length, 1);
  ok('and still dominant', rdb2.listCycles(rpid)[0].dominant, true);
  ok('a blob written before cycles existed still opens', (await makeDb(jsonAdapter())).listCycles('nope'), []);

  
/* ---- schema parity: every column we WRITE must actually exist -------------
   This suite runs against db.js, the localStorage stand-in, so it can never
   catch a column that Supabase does not have. Two real bugs got through that
   gap: db.js maps 'units.{i}.desig' to unit_type.designation, a column that has
   never existed in the live database, and rcs_doc was threaded through
   db.supabase.js before the column was added — which would have failed every
   cycle save on the deployed app.

   schema.sql is the checked-in record of the real schema. Comparing what
   db.supabase.js writes against it is static, needs no credentials, and would
   have caught both. If it fails: add the column and record it in schema.sql,
   or stop writing it. */
/* ---- a column written and never read back is a column that vanishes -------
   ra_property_code was written by createProperty, stored correctly, present in
   the row, and dropped by the loader: it is not a form cell, so it is in no
   PSCALAR map and nothing else picked it up. In one session everything worked.
   On the next page load propByRaCode() answered null for every property, so a
   scheduled property already opened came back as a record the schedule does not
   carry — a copy at the bottom of the menu, and a name clash on reopening.

   The rule, not the column: every column any write path puts on `property` must
   appear in the block that reads `property` rows back. Static, no credentials.
   PSCALAR columns are exempt because the loader walks PSCALAR_REV over all of
   them; these are the ones written by hand, which is where this can happen. */
(function propertyRoundTrip(){
  const _fs=require('fs'),_p=require('path'),_d=__dirname;
  const sup=_fs.readFileSync(_p.join(_d,'db.supabase.js'),'utf8');
  const li=sup.indexOf('(pr.data || []).forEach(r => {');
  const lj=sup.indexOf('D.props[r.id] = p;',li);
  ok('the property loader can be located',li>0&&lj>li,true);
  const loader=sup.slice(li,lj);
  const scalars=new Set();
  { const i=sup.indexOf('const PSCALAR'),j=sup.indexOf('};',i);
    (sup.slice(i,j).match(/'([a-z_0-9]+)'/g)||[]).forEach(x=>scalars.add(x.replace(/'/g,''))); }
  const written=new Set();
  { const i=sup.indexOf('function buildPropRow('),j=sup.indexOf('\n  }',i);
    (sup.slice(i,j).match(/row\.([a-z_0-9]+)\s*=/g)||[]).forEach(x=>written.add(x.match(/row\.([a-z_0-9]+)/)[1])); }
  const re=/from\('property'\)\s*\.\s*(?:upsert|update)\(\{([^}]*)\}/g; let m;
  while((m=re.exec(sup)))(m[1].match(/([a-z_0-9]+)\s*:/g)||[]).forEach(x=>written.add(x.replace(/\s*:$/,'')));
  ok('the write paths were found',written.size>=3,true);
  const missed=[...written].filter(c=>!scalars.has(c)&&loader.indexOf('r.'+c)<0);
  ok('every hand-written property column is read back on load',missed,[]);
})();
(function schemaParity(){
  const _fs=require('fs'),_p=require('path'),_d=__dirname;
  const sql=_fs.readFileSync(_p.join(_d,'..','..','schema.sql'),'utf8');
  const sup=_fs.readFileSync(_p.join(_d,'db.supabase.js'),'utf8');
  const tables={};
  const re=/create table public\.([a-z_0-9]+)\s*\(([\s\S]*?)\n\);/g;
  let m;
  while((m=re.exec(sql))){
    const cols=new Set();
    m[2].split('\n').forEach(function(line){
      const c=line.trim().match(/^"?([a-z_][a-z0-9_]*)"?\s+/);   // "use" is quoted: it is a reserved word
      if(c&&!/^(unique|primary|foreign|constraint|check)$/i.test(c[1]))cols.add(c[1]);
    });
    tables[m[1]]=cols;
  }
  function mapCols(name){
    const i=sup.indexOf('const '+name);
    if(i<0)return [];
    const body=sup.slice(i,sup.indexOf('};',i));
    return (body.match(/:\s*'([a-z_][a-z0-9_]*)'/g)||[]).map(function(x){return x.replace(/:\s*'/,'').replace(/'$/,'');});
  }
  const checks=[['unit_type',mapCols('UCOL')],['nonrev_unit',mapCols('NRCOL')],['ns8_unit',mapCols('NS8COL')]];
  const cy=sup.match(/from\('cycle'\)\.upsert\(\{([^}]*)\}/);
  if(cy)checks.push(['cycle',(cy[1].match(/([a-z_][a-z0-9_]*)\s*:/g)||[]).map(function(x){return x.replace(/\s*:$/,'');})]);
  checks.forEach(function(pair){
    const t=pair[0],cols=pair[1];
    ok('schema.sql documents the '+t+' table',!!tables[t],true);
    if(!tables[t])return;
    ok('every column written to '+t+' exists in schema.sql',
       cols.filter(function(c){return !tables[t].has(c);}),[]);
  });
})();

/* ── the other direction: a key with nowhere to land ─────────────────────────
   schemaParity above asks whether every column we WRITE exists. This asks
   whether every key we can SAVE has a column — the failure that runs the other
   way, and the quieter one, because an unmapped key is not an error at the
   backend: the upsert simply succeeds without it.

   Prompted by an audit that found twenty flat keys surviving in this stand-in
   and vanishing through db.supabase.js (units.N.uac_*, the ocaf.* set, the
   uaf.* set). All twenty turned out to be PER-CYCLE keys, which belong in the
   cycle's own JSONB and are not lost — but nothing was checking, and a new
   DURABLE key with no column would be accepted here, accepted by Postgres, and
   simply never stored. That is the shape of a defect nobody sees for months. */
(function keyHomeParity(){
  const _fs=require('fs'),_p=require('path'),_d=__dirname;
  const sup=_fs.readFileSync(_p.join(_d,'db.supabase.js'),'utf8');
  const between=(start)=>{const i=sup.indexOf(start);return i<0?'':sup.slice(i,sup.indexOf('};',i));};
  const PS=new Set((between("const PSCALAR").match(/'([^']+)'\s*:/g)||[]).map(x=>x.replace(/'|\s*:/g,'')));
  const cols=(start)=>new Set((between(start).match(/(\w+)\s*:/g)||[]).map(x=>x.replace(/\s*:/,'')));
  const UC=cols("const UCOL"), NR=cols("const NRCOL");
  const homeless=Object.keys(CROSSWALK).filter(function(k){
    if(isPerCycleKey(k))return false;                 // lives in cycle.cells, which is JSONB
    if(PS.has(k))return false;
    var m=k.match(/^units\.\{i\}\.(\w+)$/);        if(m&&UC.has(m[1]))return false;
    m=k.match(/^nonrev\.\{i\}\.(\w+)$/);           if(m&&NR.has(m[1]))return false;
    // ns8 rows, principals, Part B and the checklist have their own tables or JSONB
    if(/^(ns8|principals|partb|check)\./.test(k))return false;
    return true;});
  ok('every durable flat key has somewhere in the backend to land', homeless, []);

  /* ─ 9 · THE PACKAGE SCORE ────────────────────────────────────────────────
     score.js as a pure function: the gates, the cap, the step, and the two
     invariants the whole design rests on. Driven directly rather than through
     the data layer, because a score that is wrong is wrong before any record
     reaches it — and because both data layers call this same function. */
  console.log('\n─ 9 · THE PACKAGE SCORE ─');
  const SC = require('./score.js');
  const rd = m => k => (m[k] == null ? '' : String(m[k]));
  const CTX = x => Object.assign({ programs: ['rcs'], units: [0], checklistLen: 17, hasStudy: true, hasLetterhead: true }, x || {});
  const sc = (m, x) => SC.packageScore(rd(m), CTX(x));

  /* One key at a time, in the order a package is actually filled in. */
  const WALK = [['property.name', 'Colonial Village'], ['property.s8', 'OH10M000236'],
    ['property.addr_street', '1 Oak'], ['property.addr_city', 'Dayton'], ['property.addr_state', 'OH'], ['property.addr_zip', '45402'],
    ['owner.entity_name', 'Colonial Village LP'], ['units.0.num_units', '32'],
    ['ca.name', 'J Smith'], ['ca.org', 'CGI'], ['poc.name', 'M Kodsi'], ['sig.name', 'D Pearson'], ['sig.title', 'VP'],
    ['appr.name', 'A Ross'], ['appr.firm', 'Belfry'], ['property.fha', '043-11045'], ['tenant.sender_name', 'M Kodsi'],
    ['rent_schedule.date_eff_custom', '10/01/2025'], ['units.0.proposed', '1147'],
    ['ca.position', 'Analyst'], ['ca.addr_street', '9 Main'], ['poc.phone', '3135550142'], ['poc.email', 'm@x.com'],
    ['appr.addr_street', '2 Elm'], ['appr.email', 'a@b.com'], ['appr.phone', '2165550100'],
    ['owner.entity_type', 'Limited Partnership'], ['check.0', '1'], ['units.0.safmr_hud', '1800']];
  const rec = {}; const steps = [];
  WALK.forEach(([k, v]) => { rec[k] = v; steps.push(sc(rec)); });

  ok('an empty record scores 0', sc({}).pct, 0);
  ok('every score on the way up is a multiple of 5', steps.filter(x => x.pct % 5 !== 0).map(x => x.pct), []);
  ok('and it never goes backwards', steps.filter((x, i) => i && x.pct < steps[i - 1].pct).map(x => x.pct), []);
  ok('a full record reads 100', steps[steps.length - 1].pct, 100);
  ok('with nothing left to enter', [steps[steps.length - 1].blockers.length, steps[steps.length - 1].caveats.length], [0, 0]);

  /* The two invariants. Each boundary means exactly one thing, at every step. */
  ok('70 or better ⟺ every document has its source',
    steps.filter(x => (x.pct >= 70) !== (x.docsReady === x.docsTotal)).map(x => x.pct), []);
  ok('100 ⟺ no blockers and no caveats',
    steps.filter(x => (x.pct === 100) !== (!x.blockers.length && !x.caveats.length)).map(x => x.pct), []);
  ok('under 30 ⟺ the profile is not finished',
    steps.filter(x => (x.pct < 30) !== (x.profile.done < x.profile.total)).map(x => x.pct), []);

  /* The gates cap: a gate is left only when it is finished. */
  const profileOnly = {}; WALK.slice(0, 8).forEach(([k, v]) => profileOnly[k] = v);
  /* Profile finished and nothing yet done in the next gate — the one state
     that reads exactly 30. With a study already in hand it reads 35, because
     the study is a gate-2 item: one of twelve, already met. */
  ok('the profile gate tops out at exactly 30', sc(profileOnly, { hasStudy: false }).pct, 30);
  ok('and a study in hand is already progress into the next gate', sc(profileOnly).pct, 35);
  /* The FHA number no longer blocks — see above. What it must NOT do is vanish:
     it still changes what page 1 of the rent schedule prints, so it is a caveat,
     and it is satisfied by anything entered including the N/A the document
     itself carries. */
  const short = Object.assign({}, rec); delete short['property.fha'];
  ok('a missing FHA number no longer blocks the package', sc(short).blockers.map(b => b.label), []);
  ok('but it is still named as something that changes what prints',
     sc(short).caveats.some(b => /FHA number/.test(b.label)), true);
  const na = Object.assign({}, rec, { 'property.fha': 'N/A' });
  ok('and N/A answers it, because the document says N/A',
     sc(na).caveats.some(b => /FHA number/.test(b.label)), false);
  const clean = Object.assign({}, rec); delete clean['ca.position'];
  ok('one caveat short is capped below 100', sc(clean).pct, 95);

  /* The study is document 04, not a nicety: a package with none cannot be
     produced, and the ring says so rather than promising six documents. */
  ok('no study caps the package below 70', sc(rec, { hasStudy: false }).pct, 65);
  ok('and names it as the blocker', sc(rec, { hasStudy: false }).blockers.map(b => b.label), ['the completed RCS report (document 04)']);
  ok('the letterhead is a caveat, not a blocker', sc(rec, { hasLetterhead: false }).pct, 95);

  /* The old ring's ten keys, and nothing else. This is the reported defect. */
  const TEN = {}; ['property.name', 'property.s8', 'property.addr_street', 'property.addr_city', 'property.addr_state',
    'property.addr_zip', 'owner.entity_name', 'sig.name', 'ca.org', 'ca.name'].forEach(k => TEN[k] = 'x');
  ok('the ten keys the old ring counted do not make a package', sc(TEN).pct < 70, true);
  ok('and the rent schedule is one of the documents they leave unwritable',
    sc(TEN).docs.filter(d => !d.ready).map(d => d.id).indexOf('schedule') >= 0, true);

  /* Each program's package is its own list of documents. */
  ok('an RCS package is six documents', SC.packageDocs({ programs: ['rcs'] }).map(d => d.id),
    ['cover', 'owner', 'checklist', 'rcs', 'schedule', 'notice']);
  ok('an OCAF package is its own four, plus the CA package',
    SC.packageDocs({ programs: ['ocaf'] }).map(d => d.id), ['ocafws', 'exhibita', 'schedule', 'capkg']);
  ok('a floating rate adds the debt-service determination',
    SC.packageDocs({ programs: ['ocaf'], rateType: 'Floating rate' }).map(d => d.id).indexOf('dsevid') >= 0, true);
  ok('a UAF package offers the decrease notice only where there is a decrease',
    [SC.packageDocs({ programs: ['uaf'], uafDec: 0 }).map(d => d.id),
     SC.packageDocs({ programs: ['uaf'], uafDec: 2 }).map(d => d.id)],
    [['uafcert', 'schedule'], ['uafcert', 'schedule', 'uanotice', 'tcert']]);
})();

  /* ─ 10 · ONE PROPERTY, ONE NAME ──────────────────────────────────────────
     The dialog has refused a duplicate name since 2026-07-24, and the live
     record grew three "Beacon Hill"s and three "Colonial Village"s anyway. A
     check that lives in a dialog only covers the callers who came through that
     dialog: a rename, a save of property.name (which is what applying an
     executed schedule's parse does), and anything holding mpdb directly all
     walked past it. So the rule moved into the data layer, and this section is
     what keeps it there. */
  console.log('\n─ 10 · ONE PROPERTY, ONE NAME ─');
  const ndb = await makeDb(memoryAdapter());
  ndb.createProperty('Colonial Village');
  const nBefore = ndb.listProperties().length;
  const grab = fn => { try { fn(); return null; } catch (e) { return e; } };

  const dup = grab(() => ndb.createProperty('Colonial Village'));
  truthy('a second property of the same name is refused', dup);
  ok('and says why in a code a caller can branch on', dup && dup.code, 'DUP_PROPERTY_NAME');
  ok('and points at the property already holding the name',
    dup && (ndb.listProperties().find(p => p.id === dup.pid) || {}).name, 'Colonial Village');
  ok('the registry did not grow', ndb.listProperties().length, nBefore);

  ok('case is not a difference', grab(() => ndb.createProperty('colonial VILLAGE')).code, 'DUP_PROPERTY_NAME');
  ok('nor is surrounding space', grab(() => ndb.createProperty('  Colonial Village ')).code, 'DUP_PROPERTY_NAME');
  ok('the seeded property is protected too', grab(() => ndb.createProperty('Gates Manor Apartments')).code, 'DUP_PROPERTY_NAME');

  ok('a name nobody holds still creates', grab(() => ndb.createProperty('Beacon Hill')), null);
  ok('and that name is taken from then on', grab(() => ndb.createProperty('Beacon Hill')).code, 'DUP_PROPERTY_NAME');
  ok('two names, two properties', ndb.listProperties().length, nBefore + 1);

  /* A property with no name collides with nothing — there is no name yet for
     anything to be the same as. It gets one later, through the form, and that
     used to be the way round the rule. */
  ok('an unnamed property is allowed', grab(() => ndb.createProperty('')), null);
  ok('and so is a second one', grab(() => ndb.createProperty('   ')), null);

  /* The two routes that actually made the twins. A property's name need not be
     the name it was created with: a rename changes it, and so does any save
     carrying property.name — which is exactly what applying an executed rent
     schedule's parse does. Both are held to the same rule now. */
  const grabA = async fn => { try { await fn(); return null; } catch (e) { return e; } };
  const bh = ndb.listProperties().find(p => p.name === 'Beacon Hill').id;

  ok('a rename onto a name already taken is refused',
    (await grabA(() => ndb.renameProperty(bh, 'Colonial Village')) || {}).code, 'DUP_PROPERTY_NAME');
  ok('and the rename did not happen',
    ndb.listProperties().filter(p => p.name === 'Colonial Village').length, 1);
  ok('while renaming a property to what it is already called is fine',
    await grabA(() => ndb.renameProperty(bh, 'Beacon Hill')), null);

  const sv = await grabA(() => ndb.saveFlat(bh, { 'property.name': { value: 'colonial village' } }));
  ok('a save carrying a taken property.name is refused too', (sv || {}).code, 'DUP_PROPERTY_NAME');
  ok('and says which name it would not take', (sv || {}).dupName, 'colonial village');
  ok('so the property keeps the name it had',
    ndb.listProperties().find(p => p.id === bh).name, 'Beacon Hill');
  ok('and a property saving its OWN name is never in its own way',
    await grabA(() => ndb.saveFlat(bh, { 'property.name': { value: 'Beacon Hill' } })), null);

  /* ─ AN OCAF INHERITS NO RENT EITHER ─
     Last, and on its own property, because every cycle created on the shared
     fixture shifts the ids that section 8c asserts by name — which is how this
     block failed seven checks in three sections it never touched.

     The rule these prove: what took effect is whatever the CA returned after the
     owner submitted, and the only record of that is the executed schedule. An
     OCAF year has no schedule to upload, which was the reason it kept last
     year's figures and is the reason it must not — with nothing read, there is
     nothing behind the number. Nothing rolls proposed into current either, so
     what an OCAF-from-an-OCAF inherited was a rent one full cycle stale, and the
     factor was computed against it. */
  console.log('\n─ 11 · AN OCAF INHERITS NO RENT EITHER ─');
  const opid = (await cdb.createProperty('Ormsby Place')).pid;
  const { cid: oc1 } = await cdb.createCycle(opid, { programs: ['ocaf'], effective_date: '2026-09-01' });
  await cdb.saveFlatCycle(oc1, {
    'units.0.num_units': { value: '40' }, 'units.0.current': { value: '1150' },
    'units.0.ua_exec': { value: '62' },   'units.0.ua_source': { value: 'executed' } });
  ok('the earlier OCAF holds a current rent', cdb.getFlatCycle(oc1)['units.0.current'].value, '1150');
  const { cid: oc2 } = await cdb.createCycle(opid, { programs: ['ocaf'], effective_date: '2027-09-01' });
  const o2 = cdb.getFlatCycle(oc2);
  ok('the next OCAF does not inherit it', o2['units.0.current'], undefined);
  ok('nor the executed utility allowance', o2['units.0.ua_exec'], undefined);
  ok('nor how that allowance was sourced', o2['units.0.ua_source'], undefined);
  ok('while the unit mix still carries', o2['units.0.num_units'].value, '40');

  /* API PARITY (CLAUDE.md): db.js is the harness's stand-in, db.supabase.js is
     what actually runs, db.cosmos.js is what the RA port runs. A guard in one
     of the three is a guard in none of them. */
  { const _fs = require('fs'), _p = require('path'), _d = __dirname;
    ['db.js', 'db.supabase.js', 'db.cosmos.js'].forEach(f => {
      const src = _fs.readFileSync(_p.join(_d, f), 'utf8');
      truthy(f + ' defines the guard', /const assertNameFree/.test(src));
      truthy(f + ' runs it on createProperty',
        /createProperty\(name(?:, raMasterId)?\)\s*\{\s*assertNameFree\(name\)/.test(src));
    });
  }

finish();
})().catch(e => fail('the suite threw before reaching its verdict', e));
