/* test_compare.js — the comparison seam, checked against hand-built facts.
   No PDFs here on purpose: this suite is about what counts as the same value
   and what does not, and that question is decidable from two strings.

   The two failure modes it exists to prevent are opposites, and the first is
   much the worse:
     - OVER-normalising, which turns a real defect into a green row. The alias
       check below is the canary: a filed schedule that carries
       "Colonial Village/White Oak Townhomes" where we print "Colonial Village"
       is a genuine difference, and any "fix" that makes it match is a
       regression, not an improvement.
     - UNDER-normalising, which spends a human's night on "1,850" vs "1850".
       Noisy, but honest, and recoverable by adding a rule.
   Every deliberate limit is asserted here so nobody removes one by accident. */
const path = require('path');
const C = require(path.join(__dirname, 'compare.js'));

const MIN_CHECKS = 91;               // the count this file is known to run to the end
let n = 0, fails = 0, verdict = null;
const BAR = '='.repeat(68);
function fail(msg, err) {
  fails++; console.log('  X ' + msg + (err ? ': ' + (err && err.message || err) : ''));
  if (err && err.stack) console.log(String(err.stack).split('\n').slice(1, 4).join('\n'));
}
function eq(label, got, want) {
  n++;
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) console.log('  + ' + label); else fail(label + ': got ' + a + ' want ' + b);
}
const T = (label, v) => eq(label, !!v, true);
function finish() {
  console.log('\n' + BAR);
  if (fails) {
    verdict = 'X COMPARE SUITE FAILED (' + n + ' checks ran, ' + fails + ' failed)';
    console.log('  XXX  COMPARE SUITE FAILED — DO NOT SHIP  XXX');
    console.log('  ' + fails + ' of ' + n + ' checks failed — see the X lines above');
  } else if (n < MIN_CHECKS) {
    fails = 1;
    verdict = 'X COMPARE SUITE FAILED (only ' + n + ' of ' + MIN_CHECKS + ' checks ran)';
    console.log('  XXX  COMPARE SUITE FAILED — DO NOT SHIP  XXX');
    console.log('  only ' + n + ' of the expected ' + MIN_CHECKS + ' checks ran — the suite died '
      + 'partway, or checks were deleted without lowering MIN_CHECKS on purpose');
  } else verdict = '+ ALL ' + n + ' COMPARE CHECKS PASSED';
  console.log(fails ? (BAR + '\n') : '');
  console.log(verdict);                       // the verdict is the LAST line, always
  process.exit(fails ? 1 : 0);
}
process.on('exit', () => { if (verdict === null) console.log('X COMPARE SUITE DIED after ' + n + ' checks'); });

/* ---- fixtures ------------------------------------------------------------ */
const facts = (values, boilerplate, notes) =>
  ({ values: values || {}, boilerplate: boilerplate || [], notes: notes || [] });

/* one key, one document, both sides — the shape most checks below want */
function row1(key, a, b, opts) {
  const mk = v => facts(v === undefined ? {} : { [key]: v });
  const res = C.compareFacts(mk(a), mk(b), Object.assign({ doc: 'rentSchedule' }, opts || {}));
  return res.rows[0];
}
const statusOf = (key, a, b) => { const r = row1(key, a, b); return r ? r.status : '(no row)'; };

try {

/* ---- money --------------------------------------------------------------- */
eq('money: a thousands comma is not a difference',
   statusOf('unit.0.rent', '1,850', '1850'), 'match');
eq('money: a dollar sign and cents are not a difference',
   statusOf('unit.0.rent', '$1,850.00', '1850'), 'match');
eq('money: a number and its formatted string are the same rent',
   statusOf('unit.0.rent', 1850, '1,850'), 'match');
eq('money: trailing zero cents on both sides still match',
   statusOf('unit.0.gross', '$1,925.00', '1925.00'), 'match');
eq('money: a different rent is a mismatch',
   statusOf('unit.0.rent', '1,850', '1860'), 'mismatch');
eq('money: fifty cents apart is a mismatch, not a rounding',
   statusOf('unit.0.ua', '75.50', '75'), 'mismatch');
eq('money: zero and empty are not the same thing',           // '' is absent, 0 is a value
   statusOf('unit.0.ua', '0', ''), 'missing-theirs');
/* Deliberate limit: a leading zero says "identifier", not "amount". Contract
   and project numbers are digit strings, and 000123 is not 123. */
eq('money: a leading-zero digit string is an identifier, not a number',
   statusOf('contract.s8', '000123', '123'), 'mismatch');
eq('money: identical leading-zero identifiers still match',
   statusOf('contract.s8', '000123', '000123'), 'match');
/* The sign is the one piece of punctuation prose-stripping may not eat: a
   credit reported as a charge is the difference we are hunting, not noise. */
eq('money: (1,850) is not normalised to -1850',
   statusOf('unit.0.adj', '(1,850)', '-1850'), 'mismatch');
eq('money: (1,850) is not the same as 1850 either',
   statusOf('unit.0.adj', '(1,850)', '1850'), 'mismatch');
eq('money: a negative is not its positive',
   statusOf('unit.0.adj', '-1850', '1850'), 'mismatch');

/* ---- dates --------------------------------------------------------------- */
eq('date: a zero-padded day is not a difference',
   statusOf('contract.effective', '10/01/2026', '10/1/2026'), 'match');
eq('date: ISO and US slash forms are the same date',
   statusOf('contract.effective', '10/01/2026', '2026-10-01'), 'match');
eq('date: a spelled-out month is the same date',
   statusOf('contract.effective', 'October 1, 2026', '10/01/2026'), 'match');
eq('date: an abbreviated month is the same date',
   statusOf('contract.effective', 'Oct. 1, 2026', '2026-10-01'), 'match');
eq('date: day-month-year is the same date',
   statusOf('contract.effective', '1 October 2026', '2026-10-01'), 'match');
eq('date: dashes and dots are the same separators as slashes',
   statusOf('contract.effective', '10-01-2026', '10.01.2026'), 'match');
eq('date: a day apart is a mismatch',
   statusOf('contract.effective', '10/01/2026', '10/02/2026'), 'mismatch');
eq('date: a year apart is a mismatch',
   statusOf('contract.effective', 'October 1, 2026', 'October 1, 2027'), 'mismatch');
/* Deliberate limit: a two-digit year is ambiguous (26 could be 1926) and a
   bare 10/01 has no year at all. Neither is normalised. */
eq('date: a two-digit year is not assumed to be this century',
   statusOf('contract.effective', '10/01/26', '2026-10-01'), 'mismatch');
eq('date: month 13 is not a date, so it falls through to prose',
   statusOf('contract.effective', '13/01/2026', '2026-01-13'), 'mismatch');

/* ---- prose --------------------------------------------------------------- */
/* Our generated documents have no word spacing — the filed one does. */
eq('prose: our unspaced output matches their spaced text',
   statusOf('letter.para1', 'As outlined in the Renewal', 'AsoutlinedintheRenewal'), 'match');
eq('prose: case is insignificant',
   statusOf('property.name', 'COLONIAL VILLAGE', 'Colonial Village'), 'match');
eq('prose: surrounding whitespace is insignificant',
   statusOf('property.name', '   Colonial Village  ', 'Colonial Village'), 'match');
eq('prose: internal punctuation is insignificant',
   statusOf('contract.s8', 'MI43-T000-123', 'MI43T000123'), 'match');
eq('prose: a newline inside a value is insignificant',
   statusOf('address.full', '123 Main St\nLansing, MI', '123 Main St Lansing, MI'), 'match');
/* THE CANARY. The filed schedule carries the property alias and ours does not.
   That is a real difference in the delivered document. Anyone who later makes
   this check pass as a match has hidden a defect, not fixed a false positive. */
eq('prose: the filed alias is a REAL difference and must not normalise away',
   statusOf('property.name', 'Colonial Village', 'Colonial Village/White Oak Townhomes'),
   'mismatch');
eq('prose: two different values of punctuation only do not match',
   statusOf('letter.dash', '---', '***'), 'mismatch');

/* ---- presence ------------------------------------------------------------ */
eq('presence: a key only we have is missing on their side',
   statusOf('appraiser.firm', 'Belfry', undefined), 'missing-theirs');
eq('presence: a key only they have is missing on our side',
   statusOf('appraiser.firm', undefined, 'Belfry'), 'missing-ours');
eq('presence: an empty string on our side reads as missing, not as a mismatch',
   statusOf('appraiser.firm', '', 'Belfry'), 'missing-ours');
eq('presence: a null on their side reads as missing',
   statusOf('appraiser.firm', 'Belfry', null), 'missing-theirs');
eq('presence: whitespace only reads as missing',
   statusOf('appraiser.firm', '   ', 'Belfry'), 'missing-ours');
eq('presence: a key absent from both sides is not a row',
   C.compareFacts(facts({ 'unit.0.rent': '', 'unit.0.ua': null }),
                  facts({ 'unit.0.rent': undefined }), { doc: 'rentSchedule' }).rows.length, 0);

/* ---- row shape ----------------------------------------------------------- */
{
  const r = row1('unit.0.rent', '1850', '1900');
  eq('row: names the document', r.doc, 'rentSchedule');
  eq('row: names the key', r.key, 'unit.0.rent');
  eq('row: carries our raw value', r.ours, '1850');
  eq('row: carries their raw value', r.theirs, '1900');
  /* A wrong cause label is worse than no label, because it stops the
     investigation. Nothing but a human or a commented rule may set one. */
  eq('row: every row starts undiagnosed', r.cause, 'undiagnosed');
  eq('row: a mismatch is high severity', r.severity, 'high');
  eq('row: a match is no severity', row1('unit.0.rent', '1850', '1850').severity, 'none');
  eq('row: a missing value is medium severity',
     row1('unit.0.rent', '1850', undefined).severity, 'medium');
  eq('row: a matched row is still undiagnosed, never "diagnosed"',
     row1('unit.0.rent', '1850', '1850').cause, 'undiagnosed');
  eq('row: the property is stamped when the caller names one',
     row1('unit.0.rent', '1850', '1900', { property: 'Lansing Manor' }).property, 'Lansing Manor');
  eq('row: no property key at all when the caller names none', 'property' in r, false);
}

/* ---- combined packages --------------------------------------------------- */
{
  const ours = { rentSchedule: facts({ 'unit.0.rent': '1,850' }),
                 coverLetter:  facts({ 'property.name': 'Colonial Village' }) };
  const theirs = { rentSchedule: facts({ 'unit.0.rent': '1850' }),
                   coverLetter:  facts({ 'property.name': 'Colonial Village/White Oak Townhomes' }) };
  const res = C.compareFacts(ours, theirs, { property: 'Colonial Village' });
  eq('package: one row per key per document', res.rows.length, 2);
  const byDoc = {}; res.rows.forEach(r => byDoc[r.doc] = r);
  eq('package: the schedule rent matches across formats', byDoc.rentSchedule.status, 'match');
  eq('package: the cover letter alias is a mismatch', byDoc.coverLetter.status, 'mismatch');
  eq('package: a document only one side has still yields rows',
     C.compareFacts({ tenantNotice: facts({ 'notice.date': '10/01/2026' }) }, {},
                    { doc: 'x' }).rows[0].status, 'missing-theirs');
}

/* ---- boilerplate drift --------------------------------------------------- */
{
  const ours = facts({ 'property.name': 'Lansing Manor' },
                     ['As outlined in the Renewal', 'Sincerely']);
  const theirs = facts({ 'property.name': 'Lansing Manor' },
                       ['AsoutlinedintheRenewal', 'Very truly yours']);
  const res = C.compareFacts(ours, theirs, { doc: 'coverLetter', property: 'Lansing Manor' });
  eq('drift: boilerplate never appears in rows as a mismatch',
     res.rows.filter(r => r.status !== 'match').length, 0);
  eq('drift: identical prose modulo spacing is not drift',
     res.drift.filter(d => /outlined/i.test(d.line)).length, 0);
  eq('drift: a divergent line is reported once per side', res.drift.length, 2);
  eq('drift: our side is named', res.drift.filter(d => d.side === 'ours')[0].line, 'Sincerely');
  eq('drift: their side is named',
     res.drift.filter(d => d.side === 'theirs')[0].line, 'Very truly yours');
  eq('drift: drift names the document', res.drift[0].doc, 'coverLetter');
  eq('drift: drift carries the property when given', res.drift[0].property, 'Lansing Manor');
  eq('drift: no drift when boilerplate agrees',
     C.compareFacts(facts({}, ['A B']), facts({}, ['ab']), { doc: 'x' }).drift.length, 0);
}

/* ---- compareRuns: the same inputs, two fill orders ----------------------- */
{
  const rsFirst  = { rentSchedule: facts({ 'unit.0.rent': '1,850', 'property.name': 'Lansing Manor' },
                                         ['As outlined in the Renewal']) };
  const rcsFirst = { rentSchedule: facts({ 'unit.0.rent': '1900',  'property.name': 'Lansing Manor' },
                                         ['As outlined in the Renewal']) };
  const rows = C.compareRuns(rsFirst, rcsFirst, { property: 'Lansing Manor' });
  eq('runs: only the disagreements come back', rows.length, 1);
  eq('runs: the disagreeing key is named', rows[0].key, 'unit.0.rent');
  eq('runs: rs-first is the "ours" column', rows[0].ours, '1,850');
  eq('runs: rcs-first is the "theirs" column', rows[0].theirs, '1900');
  /* The one cause we may set by construction: same inputs, two outputs. */
  eq('runs: the cause is fill-order by construction', rows[0].cause, 'fill-order');
  eq('runs: order-dependence is the highest severity in the project',
     rows[0].severity, 'critical');
  eq('runs: the columns say which order produced which',
     [rows[0].oursRun, rows[0].theirsRun], ['rs-first', 'rcs-first']);
  eq('runs: the property is carried through', rows[0].property, 'Lansing Manor');
  eq('runs: a key only one order produced is a disagreement too',
     C.compareRuns({ x: facts({ k: 'v' }) }, { x: facts({}) })[0].status, 'missing-theirs');
  eq('runs: agreement across formats is not a disagreement',
     C.compareRuns({ x: facts({ k: '$1,850.00' }) }, { x: facts({ k: '1850' }) }).length, 0);
  const withDrift = C.compareRuns({ x: facts({}, ['one']) }, { x: facts({}, ['two']) });
  eq('runs: boilerplate divergence rides along as drift, not as a row',
     withDrift.length, 0);
  eq('runs: and that drift is still reachable', withDrift.drift.length, 2);
  eq('runs: order-dependent boilerplate is critical drift',
     withDrift.drift[0].severity, 'critical');
}

/* ---- renderMarkdown: by cause, then by key, NEVER by property ------------ */
{
  const rows = [
    { property: 'Lansing Manor',    doc: 'rentSchedule', key: 'unit.0.rent',
      ours: '1850', theirs: '1900', status: 'mismatch', cause: 'undiagnosed', severity: 'high' },
    { property: 'Colonial Village', doc: 'rentSchedule', key: 'unit.0.rent',
      ours: '1200', theirs: '1250', status: 'mismatch', cause: 'undiagnosed', severity: 'high' },
    { property: 'Colonial Village', doc: 'coverLetter',  key: 'property.name',
      ours: 'Colonial Village', theirs: 'Colonial Village/White Oak Townhomes',
      status: 'mismatch', cause: 'parser', severity: 'high' },
    { property: 'Lansing Manor',    doc: 'coverLetter',  key: 'appraiser.firm',
      ours: 'Belfry', theirs: 'Belfry', status: 'match', cause: 'undiagnosed', severity: 'none' },
    { property: 'Mad River Manor',  doc: 'checklist',    key: 'unit.1.rent',
      ours: '900', theirs: '950', status: 'mismatch', cause: 'fill-order', severity: 'critical' }
  ];
  const drift = [{ property: 'Lansing Manor', doc: 'coverLetter', side: 'ours',
                   line: 'Sincerely', severity: 'low' }];
  const md = C.renderMarkdown({ rows, drift });
  T('markdown: returns a string', typeof md === 'string' && md.length > 0);
  T('markdown: has a cause section for parser', /##\s.*parser/i.test(md));
  T('markdown: has a cause section for fill-order', /##\s.*fill-order/i.test(md));
  T('markdown: has a cause section for undiagnosed', /##\s.*undiagnosed/i.test(md));
  /* Match the HEADINGS, not the bare words — the intro prose mentions
     "undiagnosed" before any section starts, and an index-of on the word
     alone passed for the wrong reason until this was tightened. */
  T('markdown: fill-order comes first, being the highest severity',
    md.indexOf('## Cause: fill-order') >= 0
    && md.indexOf('## Cause: fill-order') < md.indexOf('## Cause: parser'));
  T('markdown: undiagnosed comes last, being the least actionable',
    md.indexOf('## Cause: parser') < md.indexOf('## Cause: undiagnosed'));
  eq('markdown: a key hitting two properties is ONE key section, not two',
     (md.match(/### `unit\.0\.rent`/g) || []).length, 1);
  T('markdown: the key section says how many properties it hits',
    /### `unit\.0\.rent`[^\n]*2 properties/.test(md));
  T('markdown: both affected properties are named under the one key',
    /Lansing Manor/.test(md) && /Colonial Village/.test(md));
  T('markdown: no property is used as a section heading',
    !/^#+ .*Lansing Manor/m.test(md));
  T('markdown: the summary counts mismatches', /4 mismatch/.test(md));
  T('markdown: the summary counts matches', /1 match/.test(md));
  T('markdown: matched rows are not listed as findings',
    !/appraiser\.firm/.test(md));
  T('markdown: drift has its own section', /##\s.*drift/i.test(md));
  T('markdown: the drift line is shown', /Sincerely/.test(md));
  T('markdown: accepts the array compareRuns returns',
    typeof C.renderMarkdown(C.compareRuns({ x: facts({ k: 'a' }) }, { x: facts({ k: 'b' }) })) === 'string');
  T('markdown: an empty result still renders',
    typeof C.renderMarkdown({ rows: [], drift: [] }) === 'string');
}

/* ---- the exported surface ------------------------------------------------ */
T('exports compareFacts', typeof C.compareFacts === 'function');
T('exports compareRuns', typeof C.compareRuns === 'function');
T('exports renderMarkdown', typeof C.renderMarkdown === 'function');

} catch (e) { fail('the suite threw before finishing', e); }

finish();
