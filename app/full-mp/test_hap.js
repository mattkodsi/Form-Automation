/* test_hap.js — the HAP tracker seam, against the real export.

   Fixture: _archive/hap-fixtures/hap-tracker-2026-07-28.csv — 2853 rows, 249
   properties, the whole schedule out to 2040, exactly as Kinley's site exported
   it. Untrimmed on purpose: the hazards this suite exists to catch are things
   nobody would think to put in a hand-made fixture. A due date falling after the
   increase it precedes. A row a few fields short. A property code that is not a
   number. Three renewals in one year. A schedule that stops — and, added
   2026-07-28, the difference between a schedule that stops because the contract
   expires (Burt Farms I, and 124 others) and one that stops because it has not
   been extended (Fox Hill, Sandwich Manor, Country Club Heights). The original
   design said the first case did not exist; the export says it is the common one.

   EVERY HAZARD HAS A PROPERTY'S NAME ON IT. When one of these fails it should
   say which real case broke, not that assertion 41 returned false.

   THE SEAM'S TOLERANCE IS THE POINT. The integration happens on Kinley's machine
   against a container we have never seen, so the checks that matter most are the
   ones proving we accept his data whatever shape it arrives in — renamed columns,
   ISO dates, Excel serials, a promise, a bare array — and that when we cannot,
   we say why.

   Adding checks? Raise MIN_CHECKS. Never lower it to make a red run green. */

const fs = require('fs'), path = require('path');

const MIN_CHECKS = 189;   // 2026-07-28: +62 for the primary action, incl. the terminal-EXPIRES rule
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

  /* ---- 5b. the primary action ------------------------------------------
     What one property's button does, held to the same corpus. Every case below
     is a real property, so a failure names which one broke. */
  console.log('\n-- typeKind: a known non-event is not an unknown one --');
  eq('OCAF is startable', H.typeKind('OCAF'), 'startable');
  eq('RCS is startable', H.typeKind('rcs'), 'startable');
  eq('EXPIRES is a known skip', H.typeKind('EXPIRES'), 'skip');
  eq('so is the case variant the export also carries', H.typeKind('Expires'), 'skip');
  eq('Request is a known skip', H.typeKind('Request'), 'skip');
  /* Blank falls to unknown on purpose. The export has none - the one malformed
     row is dropped for its date, not its type - so this fires on nothing today
     and is news the day it fires. */
  eq('a blank type is unknown, not a skip', H.typeKind(''), 'unknown');
  eq('and so is a type nobody has seen', H.typeKind('Budget Based'), 'unknown');

  console.log('\n-- the ordinary case: a package waiting to be started --');
  const aStart = H.actionFor(rows, '90030', [], TODAY);
  eq('Bastrop Oak Grove has one to start', aStart.kind, 'start');
  eq('the tracker names the program', aStart.type, 'OCAF');
  eq('and the year', aStart.year, '2027');
  eq('the effective date is the row\'s own', aStart.effective, '2027-01-01');
  eq('the package is pre-programmed from it', aStart.programs, ['ocaf']);
  eq('and pre-labelled by its year', aStart.label, '2027');
  eq('the button is live', aStart.disabled, false);
  eq('a property that never has an OCAF or RCS offers nothing',
    H.actionFor(rows, '75494', [], TODAY).kind, 'none');
  eq('and says why', H.actionFor(rows, '75494', [], TODAY).reasonCode, 'out-of-scope');

  console.log('\n-- Bastrop Oak Grove: the mid-schedule EXPIRES is stepped over --');
  const bMid = H.actionFor(rows, '90030', [], '2028-06-01');
  eq('the 2029 EXPIRES does not become the action', bMid.kind, 'start');
  eq('the 2030 OCAF does', bMid.year, '2030');
  T('and the property is never treated as expiring there', bMid.kind !== 'expiring');

  /* THE CORRECTION, measured. The original design said EXPIRES is never
     terminal. It is: 125 in-scope properties end on one, and the row's date
     matches the Contract Exp column on 122 of them. Only three run two years or
     more beyond, and those are a gap in the schedule rather than an ending. */
  console.log('\n-- a schedule that ENDS on an EXPIRES is the contract expiring --');
  const codes = Object.keys(H.inScope(rows));
  const lastOf = c => { const rs = rows.filter(r => r.code === c); return rs[rs.length - 1]; };
  const terminal = codes.filter(c => lastOf(c).type === 'EXPIRES');
  eq('125 of the 229 end on one', terminal.length, 125);
  const beyondOf = c => { const l = lastOf(c); return l.contractExp ? H.daysBetween(l.effective, l.contractExp) : null; };
  eq('120 of those have a contract ending with them, not after them',
    terminal.filter(c => { const d = beyondOf(c); return d != null && d < 730; }).length, 120);
  /* Two carry no contract expiration at all - Westwood Village and Van Nuys - so
     the EXPIRES row is the only evidence there is, and it says the contract
     ends. Reading them as gaps would invent a renewal out of a missing field. */
  const noExp = terminal.filter(c => beyondOf(c) === null);
  eq('two of them have no contract record to compare against', noExp.length, 2);
  eq('and they are read as expiring, not as gaps',
    noExp.map(c => H.actionFor(rows, c, [], '2040-12-31').kind), ['expiring', 'expiring']);
  /* Named, so a regression says which property. Burt Farms I expires four days
     before its contract record does. */
  const burt = rows.filter(r => r.name === 'Burt Farms I');
  T('Burt Farms I is in the export', burt.length > 0);
  eq('its last row is an EXPIRES', burt[burt.length - 1].type, 'EXPIRES');
  T('dated within days of its contract expiration',
    Math.abs(H.daysBetween(burt[burt.length - 1].effective, burt[burt.length - 1].contractExp)) < 30);
  const aBurt = H.actionFor(rows, burt[0].code, [], '2039-01-01');   // past its last startable row
  eq('so the action states the expiry rather than inventing a renewal', aBurt.kind, 'expiring');
  eq('and says which fact it is reporting', aBurt.reasonCode, 'contract-expires');
  eq('it offers no target year', aBurt.year, '');
  eq('and nothing to press', aBurt.disabled, true);
  /* The other half of the rule, and the more important one: reporting the expiry
     is not the same as retiring the property. The tracker records a date, not an
     outcome - whether the contract renews is a business fact it does not hold. */
  eq('the property is still in scope', H.inScope(rows)[burt[0].code], 1);
  T('and is not rendered as finished, done or viewable',
    aBurt.kind !== 'view' && aBurt.kind !== 'done' && aBurt.kind !== 'none');
  eq('the expiry date it reports is the row\'s own', aBurt.effective, burt[burt.length - 1].effective);

  console.log('\n-- Fox Hill: a gap in the schedule, not an expiry --');
  /* The property the original design generalised from, and one of only three
     where that generalisation holds: its schedule stops at an EXPIRES in 2027
     while the contract record runs to 2045. */
  const aFox = H.actionFor(rows, '90063', [], TODAY);
  eq('Fox Hill is a gap', aFox.kind, 'gap');
  eq('named as one', aFox.reasonCode, 'schedule-gap');
  eq('the schedule stops here', aFox.effective, '2027-04-01');
  eq('while the contract runs on', aFox.contractExp, '2045-02-28');
  eq('so it stays startable', aFox.disabled, false);
  T('and is not reported as expiring', aFox.kind !== 'expiring');
  const gaps = codes.filter(c => H.actionFor(rows, c, [], '2040-12-31').kind === 'gap');
  eq('exactly three properties in the export are gaps', gaps.length, 3);
  eq('and they are these three', gaps.map(c => rows.find(r => r.code === c).name).sort(),
    ['Country Club Heights', 'Fox Hill', 'Sandwich Manor']);

  console.log('\n-- the portfolio today --');
  const kinds = {};
  codes.forEach(c => { const k = H.actionFor(rows, c, [], TODAY).kind; kinds[k] = (kinds[k] || 0) + 1; });
  eq('228 have a package to start, and Fox Hill is the gap', kinds, { start: 228, gap: 1 });
  /* The check that catches a new Increase Type appearing in a future export:
     nothing today is unsupported, so anything that becomes so is news. */
  eq('nothing in the export is an unrecognised type', kinds.unsupported || 0, 0);

  console.log('\n-- Luther Towers: two renewals in one year, same program --');
  /* The only property of the 249 where year+program cannot identify a package -
     OCAF 2026-09-01 and OCAF 2026-12-06, same label, same program. Without the
     concurrency guard, generating the December package would mark the September
     one done, and its deadline has already passed. */
  const lTgt = H.actionFor(rows, '90111', [], TODAY);
  eq('the target is the September row', lTgt.effective, '2026-09-01');
  const cDec = { id: 'c1', programs: ['ocaf'], label: '2026', effective_date: '2026-12-06', generated: {} };
  const cSep = { id: 'c2', programs: ['ocaf'], label: '2026', effective_date: '2026-09-01', generated: {} };
  eq('the December package does not answer for the September one',
    H.actionFor(rows, '90111', [cDec], TODAY).kind, 'start');
  eq('the September one does', H.actionFor(rows, '90111', [cSep], TODAY).kind, 'continue');
  eq('by id', H.actionFor(rows, '90111', [cSep], TODAY).cid, 'c2');
  eq('with both present, the right one still wins',
    H.actionFor(rows, '90111', [cDec, cSep], TODAY).cid, 'c2');

  console.log('\n-- matching a package to the renewal it belongs to --');
  /* A package created by hand before this feature has a label and no effective
     date. Where the year holds only one startable row, the label is enough. */
  const byLabel = { id: 'x', programs: ['ocaf'], label: '2027', effective_date: '', generated: {} };
  eq('a package with only a label still matches', H.actionFor(rows, '90030', [byLabel], TODAY).kind, 'continue');
  eq('by id', H.actionFor(rows, '90030', [byLabel], TODAY).cid, 'x');
  /* Never cycles[0] or the dominant one: listCycles sorts the dominant first,
     and the dominant cycle is the latest-effective, not the one due next. */
  const far = { id: 'far', programs: ['ocaf'], label: '2031', effective_date: '2031-01-01', generated: {} };
  eq('a package for a different year does not answer for this one',
    H.actionFor(rows, '90030', [far], TODAY).kind, 'start');
  const rcsTgt = rows.find(r => r.startable && r.type === 'RCS' && r.effective >= TODAY);
  const wrongProg = { id: 'w', programs: ['ocaf'], label: rcsTgt.effective.slice(0, 4), effective_date: rcsTgt.effective, generated: {} };
  eq('an OCAF package does not answer for an RCS year',
    H.actionFor(rows, rcsTgt.code, [{ id: 'w', programs: ['ocaf'], label: wrongProg.label, effective_date: '', generated: {} }], TODAY).kind, 'start');
  const withUaf = { id: 'u', programs: ['ocaf', 'uaf'], label: '2027', effective_date: '2027-01-01', generated: {} };
  eq('a package carrying UAF alongside OCAF still matches the OCAF year',
    H.actionFor(rows, '90030', [withUaf], TODAY).cid, 'u');

  console.log('\n-- a generated package is viewable, and does not skip ahead --');
  const gen = { id: 'g', programs: ['ocaf'], label: '2027', effective_date: '2027-01-01', generated: { at: '2026-07-01T10:00:00Z', docs: ['cover'] } };
  const aGen = H.actionFor(rows, '90030', [gen], TODAY);
  eq('a generated package reads as viewable', aGen.kind, 'view');
  eq('pointing at itself', aGen.cid, 'g');
  /* Packages are generated ~120 days BEFORE their effective date, so advancing
     to the next target would print "Start 2028 OCAF" above a deadline line
     counting down to 2027. targetFor moves on by itself once the date passes. */
  eq('and it still names the year it is for, not the next one', aGen.year, '2027');

  console.log('\n-- an increase type nobody has seen stops the action --');
  const oddSoon = H.normalize(raw.concat([{
    'Property Code': '90030', 'Property Name': 'Bastrop Oak Grove', 'Increase Type': 'Budget Based',
    'Rent Increase': '10/01/2026', 'Due to HUD': '06/01/2026',
  }]), { leadDays: 120 }).rows;
  const aOdd = H.actionFor(oddSoon, '90030', [], TODAY);
  eq('an unrecognised type ahead of the target blocks it', aOdd.kind, 'unsupported');
  /* Asserted as the exact string so nobody "tidies" it: the failure table says
     displayed verbatim, never silently dropped. */
  eq('and is carried verbatim', aOdd.type, 'BUDGET BASED');
  eq('the button is dead', aOdd.disabled, true);
  eq('and says why', aOdd.reasonCode, 'unknown-type');
  /* A row with no increase type at all. 'Displayed verbatim' has nothing to
     display, and the two ways of vanishing the design forbids are both easy to
     hit here: the button read Start 2027 \u201c\u201d and the pill did not render.
     Named for Bastrop because Bastrop is the property carrying the case. */
  const blankSoon = H.normalize(raw.concat([{
    'Property Code': '90030', 'Property Name': 'Bastrop Oak Grove', 'Increase Type': '',
    'Rent Increase': '10/01/2026', 'Due to HUD': '06/01/2026',
  }]), { leadDays: 120 }).rows;
  const aBlank = H.actionFor(blankSoon, '90030', [], TODAY);
  eq('a row stating no increase type blocks the action too', aBlank.kind, 'unsupported');
  eq('and does not invent one', aBlank.type, '');
  eq('the button is dead', aBlank.disabled, true);

  const oddLate = H.normalize(raw.concat([{
    'Property Code': '90030', 'Property Name': 'Bastrop Oak Grove', 'Increase Type': 'Budget Based',
    'Rent Increase': '01/01/2032', 'Due to HUD': '09/01/2031',
  }]), { leadDays: 120 }).rows;
  const aLate = H.actionFor(oddLate, '90030', [], TODAY);
  eq('the same row years away blocks nothing', aLate.kind, 'start');
  eq('and the 2027 OCAF is still the action', aLate.year, '2027');

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
