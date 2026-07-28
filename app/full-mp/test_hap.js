/* test_hap.js — the HAP tracker seam, against the real export.

   Fixture: _archive/hap-fixtures/hap-tracker-2026-07-28.csv — 2853 rows, 249
   properties, the whole schedule out to 2040, exactly as Kinley's site exported
   it. Untrimmed on purpose: the hazards this suite exists to catch are things
   nobody would think to put in a hand-made fixture. A due date falling after the
   increase it precedes. A row a few fields short. A property code that is not a
   number. Three renewals in one year. A schedule that stops.

   EVERY HAZARD HAS A PROPERTY'S NAME ON IT. When one of these fails it should
   say which real case broke, not that assertion 41 returned false.

   THE SEAM'S TOLERANCE IS THE POINT. The integration happens on Kinley's machine
   against a container we have never seen, so the checks that matter most are the
   ones proving we accept his data whatever shape it arrives in — renamed columns,
   ISO dates, Excel serials, a promise, a bare array — and that when we cannot,
   we say why.

   Adding checks? Raise MIN_CHECKS. Never lower it to make a red run green. */

const fs = require('fs'), path = require('path');

const MIN_CHECKS = 124;
let n = 0, fails = 0, verdict = null;
const BAR = '='.repeat(68);
function fail(msg, err) {
  verdict = 'fail'; process.exitCode = 1;
  console.log('\n' + BAR);
  console.log('  XXX  HAP SEAM SUITE FAILED - DO NOT SHIP  XXX');
  console.log('  ' + msg);
  if (err) console.log(String(err && err.stack || err).replace(/^/gm, '  '));
  console.log(BAR);
  console.log(`X HAP SEAM SUITE FAILED (${n} checks ran, ${fails} failed)`);
}
function pass() { verdict = 'pass'; console.log(`\n+ ALL ${n} HAP SEAM CHECKS PASSED\n`); }
function finish() {
  if (fails) return fail(`${fails} of ${n} checks failed - see the X lines above`);
  if (n < MIN_CHECKS) return fail(`only ${n} of the expected ${MIN_CHECKS} checks ran - the suite died partway`);
  pass();
}
process.on('exit', () => { if (verdict === null) fail(`the run ended without a verdict after ${n} of ${MIN_CHECKS} checks - it died partway`); });
process.on('unhandledRejection', e => { fail('unhandled rejection - an async throw is a failure, never a pass', e); process.exit(1); });
process.on('uncaughtException', e => { fail('uncaught exception', e); process.exit(1); });
const eq = (label, got, want) => { n++; const p = JSON.stringify(got) === JSON.stringify(want); if (!p) { fails++; console.log(`  X ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); } else console.log(`  + ${label}`); };
const T = (label, v) => eq(label, !!v, true);
const HAS = (label, hay, needle) => { n++; const p = String(hay).indexOf(needle) >= 0; if (!p) { fails++; console.log(`  X ${label}: ${JSON.stringify(String(hay).slice(0, 200))} does not contain ${JSON.stringify(needle)}`); } else console.log(`  + ${label}`); };

const H = require(path.join(__dirname, 'hap.js'));
const CSV_PATH = path.join(__dirname, '..', '..', '_archive', 'hap-fixtures', 'hap-tracker-2026-07-28.csv');
const TODAY = '2026-07-28';           // the export's date; every expectation below is anchored to it

(async function () {

  /* ---- 1. dates: every shape a tracker might hand us ------------------ */
  console.log('\n-- date tolerance --');
  eq('US month-first, the CSV\'s own format', H.toISO('10/01/2025'), '2025-10-01');
  eq('single-digit month and day', H.toISO('4/1/2026'), '2026-04-01');
  eq('ISO passes through', H.toISO('2026-01-01'), '2026-01-01');
  eq('ISO with a time component keeps the date', H.toISO('2026-01-01T00:00:00Z'), '2026-01-01');
  eq('ISO with single-digit parts is padded', H.toISO('2026-1-5'), '2026-01-05');
  eq('a Date object, from a driver that already parsed', H.toISO(new Date(Date.UTC(2026, 0, 1))), '2026-01-01');
  eq('an Excel serial, from a sheet export', H.toISO('45658'), '2025-01-01');
  eq('dashes instead of slashes', H.toISO('10-01-2025'), '2025-10-01');
  eq('two-digit year', H.toISO('10/01/25'), '2025-10-01');
  eq('empty is empty, not epoch', H.toISO(''), '');
  eq('null is empty, not a crash', H.toISO(null), '');
  eq('an unreadable string is empty', H.toISO('sometime next spring'), '');
  eq('an invalid Date is empty', H.toISO(new Date('nonsense')), '');
  eq('a small number is not a serial', H.toISO('42'), '');
  eq('date arithmetic crosses a month', H.addDays('2026-01-01', -120), '2025-09-03');
  eq('date arithmetic crosses a year', H.addDays('2026-01-01', -1), '2025-12-31');
  eq('leap day survives', H.addDays('2028-02-28', 1), '2028-02-29');
  eq('daysBetween counts forward', H.daysBetween('2026-01-01', '2026-01-31'), 30);
  eq('daysBetween counts backward', H.daysBetween('2026-01-31', '2026-01-01'), -30);

  /* ---- 2. startable types --------------------------------------------- */
  console.log('\n-- which rows are startable --');
  eq('OCAF is startable', H.isStartable('OCAF'), true);
  eq('RCS is startable', H.isStartable('RCS'), true);
  eq('EXPIRES is not', H.isStartable('EXPIRES'), false);
  eq('Expires, the case variant in the export, is also not', H.isStartable('Expires'), false);
  eq('Request is not', H.isStartable('Request'), false);
  eq('lowercase ocaf still is', H.isStartable('ocaf'), true);
  eq('padded whitespace still is', H.isStartable('  RCS  '), true);
  eq('empty is not', H.isStartable(''), false);
  eq('an unknown future type is not', H.isStartable('MARK-UP'), false);

  /* ---- 3. CSV parsing -------------------------------------------------- */
  console.log('\n-- CSV parsing --');
  eq('quoted field with an embedded comma', H.parseCSV('a,b\n"x,y",z')[0].a, 'x,y');
  eq('doubled quotes become one', H.parseCSV('a\n"he said ""hi"""')[0].a, 'he said "hi"');
  eq('CRLF line endings', H.parseCSV('a,b\r\n1,2')[0].b, '2');
  eq('a UTF-8 BOM does not poison the first header', Object.keys(H.parseCSV('﻿a,b\n1,2')[0])[0], 'a');
  eq('blank lines are dropped', H.parseCSV('a\n1\n\n2\n').length, 2);
  eq('a short row reads as far as it goes', H.parseCSV('a,b,c\n1,2')[0].b, '2');
  eq('a short row leaves the rest empty, not undefined', H.parseCSV('a,b,c\n1,2')[0].c, '');
  eq('empty text is an empty list', H.parseCSV('').length, 0);

  /* ---- 4. the real export --------------------------------------------- */
  console.log('\n-- the real export --');
  T('the fixture is present', fs.existsSync(CSV_PATH));
  const raw = H.parseCSV(fs.readFileSync(CSV_PATH, 'utf8'));
  eq('every data row is read', raw.length, 2853);
  const { rows, cols, report } = H.normalize(raw, { leadDays: 120 });

  eq('all twelve columns are matched', cols.missing.length, 0);
  eq('none of them had to be guessed', Object.keys(cols.guessed).length, 0);
  eq('no required column is missing', cols.missingRequired.length, 0);
  eq('the join key comes from Property Code', cols.map.code, 'Property Code');
  eq('the program comes from Increase Type', cols.map.type, 'Increase Type');
  eq('the anniversary comes from Rent Increase', cols.map.effective, 'Rent Increase');
  eq('the deadline comes from Due to HUD', cols.map.due, 'Due to HUD');
  eq('Contract Type does not get claimed as the program', cols.map.contractType, 'Contract Type');

  eq('249 properties', H.codesOf(rows).length, 249);
  eq('229 of them have an OCAF or RCS in some year', Object.keys(H.inScope(rows)).length, 229);
  const scheduled = H.codesOf(rows).filter(c => H.statusFor(rows, c, TODAY) === 'scheduled');
  eq('228 have a future package as of the export date', scheduled.length, 228);
  eq('the five portfolio managers', H.managers(rows),
    ['Claire Beatty', 'Elliot Kohanbash', 'Matt Kim', 'Mike McKee', 'Tolga Ayberk']);

  /* ---- 5. the named hazards ------------------------------------------- */
  console.log('\n-- Mad River Manor: a due date after the increase it precedes --');
  const madRiver = rows.filter(r => r.name === 'Mad River Manor');
  T('Mad River Manor is in the export', madRiver.length > 0);
  const inverted = madRiver.filter(r => r.dueSuspect);
  T('its inverted rows are flagged', inverted.length > 0);
  eq('the tracker date is refused', inverted[0].due, '');
  eq('the fallback is used instead', inverted[0].deadlineSource, 'computed');
  eq('the fallback lands 120 days before the increase', inverted[0].deadline, H.addDays(inverted[0].effective, -120));
  T('and the countdown is never negative', H.daysBetween(inverted[0].deadline, inverted[0].effective) > 0);
  T('the whole export reports its inverted rows', report.inverted > 0);

  console.log('\n-- Woodland Hills: a row short of fields --');
  const wh = rows.filter(r => r.code === '79610');
  T('the ragged row did not take down the import', wh.length > 0);
  eq('and it still knows its own name', wh[0].name, 'Woodland Hills');

  console.log('\n-- HCV1: a property code that is not a number --');
  const hcv = rows.filter(r => r.code === 'HCV1');
  T('a non-numeric code survives', hcv.length > 0);
  eq('as a string, not coerced', typeof hcv[0].code, 'string');
  eq('and not mangled into a number', hcv[0].code, 'HCV1');

  console.log('\n-- Bastrop Oak Grove: an option term ends mid-schedule --');
  const bastrop = rows.filter(r => r.code === '90030');
  eq('its 2029 row is an EXPIRES', bastrop.find(r => r.effective === '2029-01-01').type, 'EXPIRES');
  eq('which is not startable', bastrop.find(r => r.effective === '2029-01-01').startable, false);
  eq('its 2030 row is an OCAF', bastrop.find(r => r.effective === '2030-01-01').type, 'OCAF');
  const bTarget = H.targetFor(rows, '90030', '2028-06-01');
  eq('a target sought before 2029 steps over the EXPIRES row', bTarget.effective, '2030-01-01');
  eq('and lands on a startable row', bTarget.startable, true);
  const bAfter = H.targetFor(rows, '90030', '2029-02-01');
  eq('sought after it, the next OCAF is found', bAfter.effective, '2030-01-01');
  eq('the contract is not treated as over', H.statusFor(rows, '90030', '2029-02-01'), 'scheduled');

  console.log('\n-- Fox Hill: the schedule runs out at an EXPIRES --');
  const fox = rows.filter(r => r.code === '90063');
  T('Fox Hill is in the export', fox.length > 0);
  eq('its last row is an EXPIRES', fox[fox.length - 1].type, 'EXPIRES');
  eq('it is in scope, having had OCAFs', H.inScope(rows)['90063'], 1);
  eq('it has no future package', H.targetFor(rows, '90063', TODAY), null);
  eq('but it is AWAITING one, not finished', H.statusFor(rows, '90063', TODAY), 'awaiting-schedule');

  console.log('\n-- Luther Towers: three renewals in one year --');
  const luther = rows.filter(r => r.code === '90111');
  eq('all 41 rows are kept', luther.length, 41);
  const in2026 = luther.filter(r => r.effective.slice(0, 4) === '2026');
  eq('three of them fall in 2026', in2026.length, 3);
  const lTarget = H.targetFor(rows, '90111', '2026-07-28');
  eq('the target is the next one chronologically, not the next year', lTarget.effective, '2026-09-01');
  eq('and it is startable', lTarget.startable, true);
  eq('the January Request row is not chosen', lTarget.type, 'OCAF');

  console.log('\n-- Southeast Towers: never startable --');
  eq('a PBV-and-expiring property is out of scope', H.statusFor(rows, '75494', TODAY), 'out-of-scope');
  eq('it is absent from the in-scope set', H.inScope(rows)['75494'], undefined);

  console.log('\n-- Request is judged on increase type, not contract type --');
  const req = rows.filter(r => r.type === 'REQUEST');
  T('the export carries Request rows', req.length > 0);
  eq('none of them is startable', req.filter(r => r.startable).length, 0);
  T('and they are not all PBV, so contract type would have misjudged them',
    new Set(req.map(r => r.contractType)).size > 1);

  /* ---- 6. deadlines and bands ------------------------------------------ */
  console.log('\n-- deadlines and bands --');
  const tracker = rows.filter(r => r.deadlineSource === 'tracker');
  T('most deadlines come from the tracker, not the fallback', tracker.length > rows.length * 0.9);
  eq('band: past due', H.bandOf('2026-06-03', TODAY), 'overdue');
  eq('band: due now', H.bandOf('2026-08-03', TODAY), 'now');
  eq('band: coming up', H.bandOf('2026-09-03', TODAY), 'soon');
  eq('band: later', H.bandOf('2027-02-01', TODAY), 'later');
  eq('band: no date at all', H.bandOf('', TODAY), 'undated');
  eq('the boundary at 30 days is inclusive', H.bandOf(H.addDays(TODAY, 30), TODAY), 'now');
  eq('and 31 days is not', H.bandOf(H.addDays(TODAY, 31), TODAY), 'soon');
  eq('today itself is due now, not overdue', H.bandOf(TODAY, TODAY), 'now');

  /* ---- 7. the seam accepts whatever Kinley has ------------------------- */
  console.log('\n-- the seam: every shape a source might take --');
  const sample = [{ 'Property Code': '1', 'Property Name': 'A', 'Increase Type': 'OCAF', 'Rent Increase': '01/01/2027' }];
  eq('a bare array', (await H.read(sample)).raw.length, 1);
  eq('an object with rows', (await H.read({ rows: sample })).raw.length, 1);
  eq('rows as a function', (await H.read({ rows: () => sample })).raw.length, 1);
  eq('rows as a promise', (await H.read({ rows: async () => sample })).raw.length, 1);
  eq('the whole source as a function', (await H.read(() => sample)).raw.length, 1);
  eq('an object with schedule', (await H.read({ schedule: sample })).raw.length, 1);
  eq('an object with data', (await H.read({ data: sample })).raw.length, 1);
  eq('an object with items', (await H.read({ items: sample })).raw.length, 1);
  eq('raw CSV text', (await H.read('Property Code,Property Name,Increase Type,Rent Increase\n1,A,OCAF,01/01/2027')).raw.length, 1);
  eq('an object with csv', (await H.read({ csv: 'Property Code,Property Name,Increase Type,Rent Increase\n1,A,OCAF,01/01/2027' })).raw.length, 1);
  const none = await H.read(null);
  eq('no source is a refusal, not a crash', none.ok, false);
  HAS('and it says window.HAPSource is not set', none.why, 'HAPSource');
  const wrong = await H.read({ nothing: 'useful' });
  eq('an unrecognised shape is a refusal', wrong.ok, false);
  HAS('and it lists what it looked for', wrong.why, 'rows/schedule/data');

  /* ---- 8. columns renamed, as they will be on Kinley's machine --------- */
  console.log('\n-- columns under other names --');
  const renamed = [{ RAID: '77', 'Project Name': 'B', 'Renewal Type': 'RCS', 'Effective Date': '2027-03-01', 'Due Date': '2026-11-01' }];
  const rn = H.normalize(renamed);
  eq('RAID answers for the code', rn.rows[0].code, '77');
  eq('Project Name answers for the name', rn.rows[0].name, 'B');
  eq('Renewal Type answers for the program', rn.rows[0].type, 'RCS');
  eq('Effective Date answers for the anniversary', rn.rows[0].effective, '2027-03-01');
  eq('Due Date answers for the deadline', rn.rows[0].due, '2026-11-01');
  eq('and no required column is reported missing', rn.cols.missingRequired.length, 0);
  const snake = H.normalize([{ property_code: '9', property_name: 'C', increase_type: 'OCAF', rent_increase: '2027-01-01' }]);
  eq('snake_case is understood too', snake.rows[0].code, '9');
  eq('and it reads the program', snake.rows[0].type, 'OCAF');

  /* ---- 9. the diagnosis is the integration ----------------------------- */
  console.log('\n-- diagnose() --');
  const dEmpty = H.diagnose([]);
  HAS('an empty container says so', dEmpty, '0 rows');
  const dReal = H.diagnose(raw);
  HAS('the real export reports how many it read', dReal, '2853');
  HAS('and how many are usable', dReal, 'usable');
  HAS('and names the columns it was handed', dReal, 'Property Code');
  HAS('and reports the inverted due dates', dReal, 'due date after the increase');
  HAS('and counts the properties in scope', dReal, '229');
  const dBad = H.diagnose([{ foo: 1, bar: 2 }]);
  HAS('an unmappable source says what it cannot proceed without', dBad, 'CANNOT PROCEED');
  HAS('and quotes the keys it actually saw', dBad, 'foo');
  const dNoType = H.diagnose([{ 'Property Code': '1', 'Property Name': 'A', 'Increase Type': 'WAT', 'Rent Increase': '01/01/2027' }]);
  HAS('a source with no startable rows warns rather than showing an empty list', dNoType, 'no startable rows');

  finish();
})();
