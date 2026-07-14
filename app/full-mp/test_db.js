/* test_db.js — headless proof of the single-record multi-property data layer. */
const { makeDb, memoryAdapter, isPerCycleKey, migrate, computeAnalysis, computeSalutation } = require('./db.js');
let fails = 0, n = 0;
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

  console.log(`\n${fails===0?'✓ ALL '+n+' CHECKS PASSED':'✗ '+fails+' / '+n+' FAILED'}\n`);
  process.exit(fails===0?0:1);
})().catch(e=>{console.error(e);process.exit(1);});
