/**
 * roundtrip.ts — the Phase 1 PROOF.
 * Runs the whole form↔DB contract on the Gates Manor example and asserts
 * every computed number against the approved "Rich Review v4" mockup. If any
 * assertion fails, the script exits non-zero — so "it ran" means "it's right".
 *
 *   create-empty → write durable → start cycle → write per-cycle rents/UA
 *   → reopen the file (persistence) → fill-from-database → computed + 150% check
 *   → override the CA address → revert it.
 */
import { existsSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { Store, SOURCES } from './store.ts';
import type { FieldView } from './store.ts';

const DB_PATH = process.env.RCS_DB ?? join(import.meta.dirname, '..', 'data', 'proof.db');
const OUT_PATH = process.env.RCS_OUT ?? '/tmp/roundtrip_result.json';
mkdirSync(dirname(DB_PATH), { recursive: true });
if (existsSync(DB_PATH)) rmSync(DB_PATH); // start clean for a repeatable demo

const money = (n: number): string => '$' + Math.round(n).toLocaleString('en-US');
const fv = (f: FieldView): string => `${f.value ?? '—'}  [${SOURCES[f.source].label}${f.saved_at ? ' · ' + f.saved_at : ''}]`;
const hr = (t: string) => console.log('\n' + '─'.repeat(74) + '\n' + t + '\n' + '─'.repeat(74));
let failures = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`   ${ok ? '✓' : '✗ FAIL'}  ${label}: got ${JSON.stringify(got)}${ok ? '' : `, expected ${JSON.stringify(want)}`}`);
};

const store = new Store(DB_PATH);

hr('0 · CONTRACT GUARDRAIL — code must match the locked v6 dictionary');
const c = store.verifyContract();
console.log(`   ${c.fields} fields total → ${c.stored} stored, ${c.computed} computed (never stored).`);
check('dictionary field count', c.fields, 69);
check('computed field count', c.computed, 10);

hr('1 · CREATE EMPTY — the first-run property (guardrail: must open blank)');
const pid = store.createEmptyProperty('Gates Manor Apartments');
let rec = store.readRecord(pid);
const propAtStart = rec.property as Record<string, FieldView>;
console.log('   property.name:', fv(propAtStart['property.name']));
console.log('   property.fha_section8_no:', fv(propAtStart['property.fha_section8_no']), '(still empty — nothing invented)');
check('a brand-new field reads as source "new"', propAtStart['property.fha_section8_no'].source, 'new');

hr('2 · WRITE DURABLE VALUES (source = on-file / database)');
const D = 'database' as const;
store.writeValue('property', pid, 'property.fha_section8_no', 'IL06H121063', D);
store.writeValue('property', pid, 'property.address_street', '1135 Wilmette Ave', D);
store.writeValue('property', pid, 'property.address_city', 'Wilmette', D);
store.writeValue('property', pid, 'property.address_state', 'IL', D);
store.writeValue('property', pid, 'property.address_zip', '60091', D);
store.writeValue('property', pid, 'owner.entity_name', 'Gates Manor Preservation, L.P.', D);
store.writeValue('property', pid, 'owner.entity_type', 'Limited Partnership', D);
store.writeValue('property', pid, 'signatory.name', 'David Pearson', D);
store.writeValue('property', pid, 'signatory.title', 'Vice President', D);
store.writeValue('property', pid, 'owner_poc.name', 'Claire Beatty', D);
store.writeValue('property', pid, 'owner_poc.phone', '9296188405', D);
store.writeValue('property', pid, 'owner_poc.email', 'cbeatty@related.com', D);
store.writeValue('property', pid, 'ca.org', 'National Housing Compliance', D);
store.writeValue('property', pid, 'ca.contact_prefix', 'Ms.', D);
store.writeValue('property', pid, 'ca.contact_name', 'Heather Gross', D);
store.writeValue('property', pid, 'ca.contact_title', 'Asset Manager', D);
store.writeValue('property', pid, 'ca.address_street', '1975 Lakeside Pkwy, Ste 310', D);
store.writeValue('property', pid, 'ca.address_city_state_zip', 'Tucker, GA 30084-5860', D);
store.writeValue('property', pid, 'tenant.sender_name', 'Tasha Francellno-Glenn', D);
store.writeValue('property', pid, 'tenant.sender_title', 'Community Manager', D);

const utId = store.addUnitType(pid, { type_label: '1BR / 1BA', num_units: 51, revenue_producing: true }, D);
store.addPrincipal(pid, { name: 'David Pearson', title: 'Vice President of General Partner' }, D);
// Part B — Gates Manor profile (from the executed rent schedule)
for (const e of [['Range', true], ['Refrigerator', true], ['Air Conditioner', false], ['Disposal', false], ['Dishwasher', false], ['Carpet', true], ['Drapes', false]] as Array<[string, boolean]>)
  store.addPartBItem(pid, { section: 'equipment', label: e[0], checked: e[1] }, D);
store.addPartBItem(pid, { section: 'equipment', label: 'Microwave', checked: true, is_writein: true }, D);
for (const u of [['Heating', true, 'G'], ['Hot Water', true, 'G'], ['Cooking', true, 'G'], ['Cooling', false, 'E']] as Array<[string, boolean, string]>)
  store.addPartBItem(pid, { section: 'utility', label: u[0], checked: u[1], fuel: u[2] }, D);
for (const s of [['Parking', true], ['Laundry', false], ['Security', true]] as Array<[string, boolean]>)
  store.addPartBItem(pid, { section: 'service', label: s[0], checked: s[1] }, D);
console.log('   wrote 20 property fields + 1 unit type + 1 principal + Part B profile, all stamped on-file @', store.today());

hr('3 · START A CYCLE + WRITE PER-CYCLE RENTS / UA / SAFMR');
const subId = store.startSubmission(pid, {
  'cycle.program_type': 'RCS',
  'cycle.adjustment_type': '5th-Year RCS Adjustment',
  'cycle.hap_reference': 'Section 5b(2)(b)',
  'cycle.submission_date': store.today(),
  'rent_schedule.date_rents_effective': '2026-09-01',
  'study.appraiser_name': 'Aaron M. Zabel',
  'study.appraiser_firm': 'Belfry Valuation',
  'study.appraiser_email': 'azabel@belfryvaluation.com',
  'study.appraiser_phone': '7085002380',
}, 'this-cycle');
store.setUnitCycleValue(subId, utId, {
  current_contract_rent: 1903, proposed_contract_rent: 2725,
  ua_from_exec_rs: 33, ua_from_rcs: 31,
  safmr_from_hud: 2330, safmr_from_rcs: 2290,
}, 'this-cycle');
console.log('   cycle: proposed $2,725 (RCS) · current $1,903 (exec RS) · UA 33/31 · SAFMR 2330(HUD)/2290(RCS)');

hr('4 · PERSISTENCE — close the file, reopen it, data must survive');
store.close();
const store2 = new Store(DB_PATH);
rec = store2.readRecord(pid, subId);
const unitsAfterReopen = rec.units as Array<Record<string, FieldView | number | null>>;
check('proposed rent survives a file reopen', (unitsAfterReopen[0].proposed as FieldView).value, 2725);

hr('5 · FILL FROM DATABASE — the durable prefill for next cycle');
const fill = store2.fillFromDatabase(pid);
console.log('   property.name:        ', fv(fill.property['property.name']));
console.log('   signatory.name:       ', fv(fill.property['signatory.name']));
console.log('   ca.contact_name:      ', fv(fill.property['ca.contact_name']));
console.log('   unit type:            ', fv(fill.unit_types[0].type_label), '×', fv(fill.unit_types[0].num_units));
console.log('   Part B items on file: ', fill.partb.length, '(rents/UA are NOT prefilled — entered fresh each cycle)');

hr('6 · COMPUTED FIELDS + 150% SAFMR CHECK (never stored — derived on read)');
const comp = rec.computed as Record<string, unknown>;
const a = rec.analysis as Record<string, number>;
const u0 = unitsAfterReopen[0] as Record<string, number | null | FieldView>;
console.log('   salutation:      ', comp['ca.contact_salutation']);
console.log('   total_units:     ', comp['rent_schedule.total_units']);
console.log('   UA resolved:     ', u0.ua_resolved, '(exec RS $33 wins over RCS $31)');
console.log('   increase / unit: ', u0.increase);
console.log('   gross rent:      ', u0.gross_rent, '(proposed 2725 + UA 33)');
console.log('   current GPR:     ', money(a.current_gpr));
console.log('   proposed GPR:    ', money(a.rcs_plus_ua_gpr));
console.log('   150% ceiling GPR:', money(a.safmr_150_gpr));
console.log('   headroom:        ', money(a.headroom));
console.log('   BELOW 150%?      ', a.below_150 ? 'PASS ✓' : 'FAIL ✗');
check('salutation', comp['ca.contact_salutation'], 'Dear Ms. Gross');
check('total units', comp['rent_schedule.total_units'], 51);
check('UA resolved (exec wins)', u0.ua_resolved, 33);
check('increase/unit', u0.increase, 822);
check('gross rent', u0.gross_rent, 2758);
check('proposed GPR (mockup: $140,658)', Math.round(a.rcs_plus_ua_gpr), 140658);
check('150% ceiling GPR (mockup: $178,245)', Math.round(a.safmr_150_gpr), 178245);
check('current GPR (mockup: $98,736)', Math.round(a.current_gpr), 98736);
check('headroom (mockup: $37,587)', Math.round(a.headroom), 37587);
check('150% SAFMR pass', a.below_150, true);

hr('7 · OVERRIDE — edit a stored value (keeps the prior for revert)');
const before = store2.fillFromDatabase(pid).property['ca.address_street'];
console.log('   before:', fv(before));
store2.override('property', pid, 'ca.address_street', '1975 Lakeside Parkway, Suite 310');
const afterOv = store2.fillFromDatabase(pid).property['ca.address_street'];
console.log('   after :', fv(afterOv));
check('override changed the value', afterOv.value, '1975 Lakeside Parkway, Suite 310');
check('override marked source = overridden', afterOv.source, 'overridden');

hr('8 · REVERT — restore the prior value and prior source');
const reverted = store2.revert('property', pid, 'ca.address_street');
const afterRv = store2.fillFromDatabase(pid).property['ca.address_street'];
console.log('   reverted:', reverted, '→', fv(afterRv));
check('revert restored the original value', afterRv.value, '1975 Lakeside Pkwy, Ste 310');
check('revert restored source = database', afterRv.source, 'database');

// ---- write the result for the visual snapshot ----
const finalRec = store2.readRecord(pid, subId);
writeFileSync(OUT_PATH, JSON.stringify({
  generated_at: store2.today(),
  contract: c,
  record: finalRec,
  fill: store2.fillFromDatabase(pid),
  override_demo: { before: before, after_override: afterOv, after_revert: afterRv },
}, null, 2));
store2.close();

hr(failures === 0 ? '✓ ALL CHECKS PASSED — Phase 1 contract works end to end' : `✗ ${failures} CHECK(S) FAILED`);
console.log('   result written to', OUT_PATH);
process.exit(failures === 0 ? 0 : 1);
