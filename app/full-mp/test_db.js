/* test_db.js — headless proof of the single-record multi-property data layer.

   Hardened 2026-07-27, like the other two suites: every exit path sets a
   non-zero code, the verdict is the LAST line printed so a piped run still
   shows it, and MIN_CHECKS catches a run that dies partway — a short count is
   a failure, not a pass. Adding checks? Raise MIN_CHECKS. */
const { makeDb, memoryAdapter, isPerCycleKey, migrate, computeAnalysis, computeSalutation } = require('./db.js');
const MIN_CHECKS = 93;
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
  ok('completeness 100%', Math.round(props[0].completeness*100), 100);
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
  ok('current rents carry forward', c2['units.0.current'].value, '1903');
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
  const d1 = cdb.addDir('appraiser', { name: 'Zeta Appraisal', email: 'z@example.com' });
  cdb.addDir('appraiser', { name: 'Alpha Appraisal' });
  cdb.addDir('ca', { name: 'Some CA' });
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

  finish();
})().catch(e => fail('the suite threw before reaching its verdict', e));
