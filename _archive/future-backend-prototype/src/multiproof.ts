/* multiproof.ts — proves the SQLite contract is multi-property:
   create several properties (each with a cycle), list them with metadata,
   then delete one and confirm the rest survive. */
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { Store } from './store.ts';

const DB = process.env.RCS_DB ?? join(import.meta.dirname, '..', 'data', 'multi.db');
mkdirSync(dirname(DB), { recursive: true });
if (existsSync(DB)) rmSync(DB);

let fails = 0, n = 0;
const ok = (label: string, got: unknown, want: unknown) => {
  n++; const pass = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${pass ? '✓' : '✗ FAIL'}  ${label}: ${JSON.stringify(got)}${pass ? '' : ' (want ' + JSON.stringify(want) + ')'}`);
  if (!pass) fails++;
};

const store = new Store(DB);
const D = 'database' as const;

// three properties, each with a unit type + a cycle
function makeProp(name: string, units: number, rent: number): number {
  const pid = store.createEmptyProperty(name);
  store.writeValue('property', pid, 'property.fha_section8_no', 'FHA-' + name.slice(0, 3).toUpperCase(), D);
  const ut = store.addUnitType(pid, { type_label: '1BR / 1BA', num_units: units, revenue_producing: true }, D);
  const sub = store.startSubmission(pid, { 'cycle.program_type': 'RCS', 'cycle.submission_date': store.today() });
  store.setUnitCycleValue(sub, ut, { current_contract_rent: rent, proposed_contract_rent: rent + 500, ua_from_exec_rs: 30, safmr_from_hud: 2000 });
  return pid;
}

console.log('\n── SQLite multi-property contract ────────────────────');
const gates = makeProp('Gates Manor', 51, 1903);
makeProp('Harbor Point', 80, 1500);
const cross = makeProp('Crossroads', 124, 1200);

let list = store.listProperties();
ok('three properties listed', list.length, 3);
ok('sorted by name', list.map((p) => p.name), ['Crossroads', 'Gates Manor', 'Harbor Point']);
ok('Gates unit total', list.find((p) => p.name === 'Gates Manor')!.total_units, 51);
ok('each has one cycle', list.every((p) => p.cycles === 1), true);

// a property can hold multiple cycles (history)
store.startSubmission(gates, { 'cycle.program_type': 'RCS', 'cycle.submission_date': '2031-01-01' });
ok('Gates now has two cycles', store.listProperties().find((p) => p.name === 'Gates Manor')!.cycles, 2);

// delete one property; others survive
store.deleteProperty(cross);
list = store.listProperties();
ok('after delete: two properties', list.length, 2);
ok('deleted one is gone', list.some((p) => p.name === 'Crossroads'), false);
ok('Gates history intact after unrelated delete', list.find((p) => p.name === 'Gates Manor')!.cycles, 2);

store.close();
console.log(`\n${fails === 0 ? '✓ ALL ' + n + ' CHECKS PASSED' : '✗ ' + fails + ' FAILED'}\n`);
process.exit(fails === 0 ? 0 : 1);
