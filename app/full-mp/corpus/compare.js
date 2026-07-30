/* compare.js — two `facts` records in, verdict rows out.
 *
 * A `facts` record is what extract.js produces:
 *     {values:{key:value}, boilerplate:[lines], notes:[]}
 * `values` holds VARIABLE data only — property name and alias, contract
 * numbers, dates, unit types with counts, rents, utility allowances, gross
 * rents, appraiser, firm, signatory, contacts, addresses. Keys are dotted
 * strings: `property.name`, `contract.s8`, `unit.0.rent`.
 * A combined package is a map `{[docType]: facts}`. Both shapes are accepted
 * on either side, and a bare record is treated as the single document named
 * by `opts.doc`.
 *
 * -- The two rules this file exists to hold ---------------------------------
 *
 * 1. NEVER GUESS A CAUSE. Every row leaves here `undiagnosed`. A cause may be
 *    set by a human, or by an explicit rule that carries a comment saying how
 *    it knows — there is exactly one such rule in this file, in compareRuns,
 *    and the comment there says why it is entitled to its label. A wrong cause
 *    is worse than no cause: it makes a report look finished and stops the
 *    investigation that would have found the real defect.
 *
 * 2. UNDER-NORMALISE RATHER THAN OVER-NORMALISE. Over-normalising turns a real
 *    difference into a green row and the defect ships. Under-normalising costs
 *    a human ten minutes reading noise, and the fix is one more rule. So every
 *    normalisation here is narrow and named, and every limit is deliberate and
 *    asserted in test_compare.js. The limits, so nobody has to rediscover them:
 *      - a digit string with a leading zero is an identifier, not an amount
 *        (000123 is not 123);
 *      - accounting parentheses are not read as a negative;
 *      - a two-digit year is not assumed to be this century;
 *      - a value with no year is not a date;
 *      - "Colonial Village" and "Colonial Village/White Oak Townhomes" are
 *        DIFFERENT. The filed schedule carries the alias and our output does
 *        not; that is a real defect in the delivered document, and normalising
 *        the alias away would hide it.
 *
 * Boilerplate — the fixed prose of a template — never becomes a row. It goes
 * to `drift`, because a wording difference between our template and the one
 * the PM team filed is a fact about templates, not a wrong value, and mixing
 * the two would bury the rents under paragraphs.
 */

/* -- severity --------------------------------------------------------------
   Severity is a shape-of-the-difference judgement, not a cause judgement, so
   it is safe to assign here: critical is reserved for an order-dependence
   proof, a differing value outranks an absent one, and a match is nothing. */
const SEVERITY = {
  'mismatch':       'high',
  'missing-ours':   'medium',
  'missing-theirs': 'medium',
  'match':          'none'
};

/* -- presence -------------------------------------------------------------
   Absent, null, empty and whitespace-only all mean "this document does not
   carry the value". A blank field and a missing field are the same fact to a
   reader holding the page. Note 0 and "0" ARE present — a zero utility
   allowance is a number someone chose. */
function present(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

/* -- money ----------------------------------------------------------------
   "$1,850.00", "1,850", "1850" and the number 1850 are one rent. Returns null
   for anything that is not plainly an amount, so the caller falls through to
   the next rule rather than forcing a numeric reading. */
function money(v) {
  const s = String(v).trim().replace(/^\$\s*/, '').trim();
  if (!/^-?(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(s)) return null;
  const intPart = s.replace(/^-/, '').split('.')[0].replace(/,/g, '');
  /* A leading zero says identifier, not amount: contract, project and FHA
     numbers are digit strings where 000123 !== 123. Refusing them here is why
     `contract.s8` cannot silently match across a zero-padding difference. */
  if (intPart.length > 1 && intPart[0] === '0') return null;
  return parseFloat(s.replace(/,/g, ''));
}

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
};

function iso(y, m, d) {
  y = +y; m = +m; d = +d;
  if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return null;
  return String(y).padStart(4, '0') + '-' + String(m).padStart(2, '0')
       + '-' + String(d).padStart(2, '0');
}

/* -- dates ----------------------------------------------------------------
   Canonicalises to YYYY-MM-DD. Four written forms, all requiring a four-digit
   year: a two-digit year is ambiguous (26 could be 1926) and a value with no
   year is not a date, so both return null and fall through to prose rather
   than being guessed into agreement. Slash forms are read US-style M/D/Y,
   which is what every document in this corpus prints. */
function dateISO(v) {
  const s = String(v).trim().replace(/,/g, ' ').replace(/\s+/g, ' ');
  let m;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s))) return iso(m[1], m[2], m[3]);
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s))) return iso(m[3], m[1], m[2]);
  if ((m = /^([A-Za-z]+)\.? (\d{1,2})(?:st|nd|rd|th)? (\d{4})$/.exec(s))) {
    const mo = MONTHS[m[1].toLowerCase()];
    return mo ? iso(m[3], mo, m[2]) : null;
  }
  if ((m = /^(\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]+)\.? (\d{4})$/.exec(s))) {
    const mo = MONTHS[m[2].toLowerCase()];
    return mo ? iso(m[3], mo, m[1]) : null;
  }
  return null;
}

/* -- prose ----------------------------------------------------------------
   Our generated documents have no word spacing — "AsoutlinedintheRenewal" —
   so a raw compare fails on identical text. Stripping every non-alphanumeric
   and lowercasing is the only way the two sides can be compared at all.
   It costs us the ability to see a punctuation-only difference; that is the
   price, and it is the right way round, because a missing hyphen in a letter
   is not what this project is hunting. */
function prose(v) {
  return String(v).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/* A minus sign and accounting parentheses both survive prose stripping as
   nothing, which would let "(1,850)", "-1850" and "1850" all read as one
   value — a credit reported as a charge. The sign is the one piece of
   punctuation that carries meaning, so it is compared rather than stripped.
   (Found by test_compare.js: the parens check went green before this existed,
   which is exactly the over-normalisation this file is supposed to refuse.)
   Parentheses get their OWN class rather than being folded into "minus": we
   do not actually know that a filed "(1,850)" means negative 1850 rather
   than a footnote marker or a range, and claiming to know would be the same
   guess this file forbids elsewhere. So all three of "(1,850)", "-1850" and
   "1850" read as three different values, and a human decides. */
function signOf(v) {
  const s = String(v).trim();
  if (/^\(.*\)$/.test(s)) return '()';
  return /^-/.test(s) ? '-' : '+';
}

/* Same value? Tried in order of how much the rule assumes: exact, then
   amount, then date, then prose. Each rule only fires when BOTH sides satisfy
   it, so a rent never gets compared against a date. */
function sameValue(a, b) {
  const sa = String(a), sb = String(b);
  if (sa.trim() === sb.trim()) return true;
  const ma = money(sa), mb = money(sb);
  if (ma !== null && mb !== null) return ma === mb;
  const da = dateISO(sa), db = dateISO(sb);
  if (da && db) return da === db;
  if (signOf(sa) !== signOf(sb)) return false;
  const pa = prose(sa), pb = prose(sb);
  /* Two values that reduce to nothing ("---" and "***") are not thereby the
     same value; that is the empty-set trap, and it reads as a difference. */
  if (pa === '' || pb === '') return false;
  return pa === pb;
}

/* -- input shapes ---------------------------------------------------------
   A facts record is anything carrying a `values` object. Everything else is
   read as a map of docType -> facts. */
function isFacts(x) {
  return !!x && typeof x === 'object' && !Array.isArray(x)
    && typeof x.values === 'object' && x.values !== null;
}
const EMPTY = { values: {}, boilerplate: [], notes: [] };

function toMap(x, defaultDoc) {
  if (!x || typeof x !== 'object') return {};
  if (isFacts(x)) return { [defaultDoc]: x };
  const out = {};
  for (const k of Object.keys(x)) if (isFacts(x[k])) out[k] = x[k];
  return out;
}

function unionKeys(a, b) {
  const seen = new Set(), out = [];
  for (const k of Object.keys(a || {})) if (!seen.has(k)) { seen.add(k); out.push(k); }
  for (const k of Object.keys(b || {})) if (!seen.has(k)) { seen.add(k); out.push(k); }
  return out;
}

/* Boilerplate divergence, as a multiset difference over normalised prose. A
   line that merely lost its word spacing is NOT drift; a line only one side
   carries is, and a reworded line shows as one entry per side, which is the
   honest reading when the two lists cannot be aligned by index. */
function boilerplateDrift(doc, ours, theirs, opts) {
  const out = [];
  const count = lines => {
    const m = new Map();
    (lines || []).forEach(l => {
      const k = prose(l);
      if (!k) return;                       // a blank or punctuation-only line says nothing
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(l);
    });
    return m;
  };
  const a = count(ours), b = count(theirs);
  const emit = (map, other, side) => {
    for (const [k, raw] of map) {
      const extra = raw.length - ((other.get(k) || []).length);
      for (let i = 0; i < extra; i++) {
        const row = { doc, side, line: raw[i], normalized: k,
                      severity: opts.driftSeverity || 'low' };
        if (opts.property) row.property = opts.property;
        out.push(row);
      }
    }
  };
  emit(a, b, 'ours');
  emit(b, a, 'theirs');
  return out;
}

/* -- compareFacts ---------------------------------------------------------
   ours   — the package the app generated
   theirs — the package the PM team filed (the ground truth)
   opts   — {doc} names the document when a bare facts record is passed;
            {property} stamps every row so a sweep can group by key across
            properties, which is the whole point of the report.
   Returns {rows, drift}. Rows include matches: a caller that wants only the
   findings filters on status, and a caller that wants a denominator needs the
   matches counted. */
function compareFacts(ours, theirs, opts) {
  opts = opts || {};
  const defaultDoc = opts.doc || 'document';
  const O = toMap(ours, defaultDoc), P = toMap(theirs, defaultDoc);
  const rows = [], drift = [];
  for (const doc of unionKeys(O, P)) {
    const o = O[doc] || EMPTY, t = P[doc] || EMPTY;
    for (const key of unionKeys(o.values, t.values)) {
      const ov = o.values[key], tv = t.values[key];
      const oHas = present(ov), tHas = present(tv);
      if (!oHas && !tHas) continue;         // absent from both sides is not a row
      let status;
      if (oHas && tHas) status = sameValue(ov, tv) ? 'match' : 'mismatch';
      else if (!oHas) status = 'missing-ours';
      else status = 'missing-theirs';
      const row = {
        doc, key,
        ours:   oHas ? ov : null,           // the RAW value, so the report shows what was read
        theirs: tHas ? tv : null,
        status,
        cause: 'undiagnosed',               // only a human, or a rule that says how it knows
        severity: SEVERITY[status]
      };
      if (opts.property) row.property = opts.property;
      rows.push(row);
    }
    for (const d of boilerplateDrift(doc, o.boilerplate, t.boilerplate, opts)) drift.push(d);
  }
  return { rows, drift };
}

/* -- compareRuns ----------------------------------------------------------
   The same property, the same inputs, driven through the app in two fill
   orders: rs-first and rcs-first. Any key where the two packages disagree is
   proof of order-dependent state in the fill logic — no ground truth is
   needed to know something is wrong, because both outputs came from identical
   inputs and at most one of them can be right.
   THIS IS THE ONE PLACE A CAUSE MAY BE SET WITHOUT A HUMAN, and it is set by
   construction rather than by inference: the two runs differ only in fill
   order, so fill order IS the difference. Nothing else in this file may do
   that.
   Returns an array of the disagreements only. Boilerplate divergence between
   two runs is still drift and not a row (rule 2 of the file), so it rides on
   the returned array as `.drift` — carried at critical severity, because
   template prose that changes with fill order is the same class of defect. */
function compareRuns(rsFirst, rcsFirst, opts) {
  opts = opts || {};
  const res = compareFacts(rsFirst, rcsFirst,
    Object.assign({}, opts, { driftSeverity: 'critical' }));
  const rows = res.rows.filter(r => r.status !== 'match').map(r => {
    r.cause = 'fill-order';
    r.severity = 'critical';
    r.oursRun = 'rs-first';
    r.theirsRun = 'rcs-first';
    return r;
  });
  Object.defineProperty(rows, 'drift', { value: res.drift, enumerable: false });
  return rows;
}

/* -- renderMarkdown -------------------------------------------------------
   Grouped by CAUSE, then by KEY — never by property. A per-property report
   hides the only thing worth seeing: that one key is wrong in nineteen
   properties, which is one defect, not nineteen. Causes are ordered by how
   actionable they are, with `undiagnosed` last because it is the pile nobody
   has looked at yet. Matched rows are counted in the summary and listed
   nowhere: they are the denominator, not a finding. */
const CAUSE_RANK = { 'fill-order': 0, 'generator': 1, 'parser': 2, 'template': 3,
                     'pm-hand-edit': 4, 'unknowable': 5, 'undiagnosed': 9 };
const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };

function cell(v) {
  if (v === undefined || v === null) return '-';
  return String(v).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').slice(0, 120);
}

function renderMarkdown(result) {
  const rows  = Array.isArray(result) ? result : ((result && result.rows) || []);
  const drift = (result && result.drift) || [];
  const count = s => rows.filter(r => r.status === s).length;
  const findings = rows.filter(r => r.status !== 'match');

  const out = [];
  out.push('# Corpus comparison');
  out.push('');
  out.push(rows.length + ' rows: ' + count('match') + ' match, ' + count('mismatch')
    + ' mismatch, ' + count('missing-ours') + ' missing-ours, '
    + count('missing-theirs') + ' missing-theirs. ' + drift.length
    + (drift.length === 1 ? ' drift line.' : ' drift lines.'));
  out.push('');
  out.push('Grouped by cause, then by key — never by property, because one key wrong in '
    + 'nineteen properties is one defect, not nineteen. Matched rows are counted above '
    + 'and listed nowhere. An `undiagnosed` row is exactly that: nobody has looked yet.');
  out.push('');

  if (!findings.length) { out.push('_No differences._'); out.push(''); }

  const byCause = new Map();
  findings.forEach(r => {
    const c = r.cause || 'undiagnosed';
    if (!byCause.has(c)) byCause.set(c, []);
    byCause.get(c).push(r);
  });
  const causes = [...byCause.keys()].sort((a, b) => {
    const ra = CAUSE_RANK[a] === undefined ? 8 : CAUSE_RANK[a];
    const rb = CAUSE_RANK[b] === undefined ? 8 : CAUSE_RANK[b];
    return ra - rb || byCause.get(b).length - byCause.get(a).length || (a < b ? -1 : 1);
  });

  for (const cause of causes) {
    const list = byCause.get(cause);
    const worst = list
      .map(r => (SEV_RANK[r.severity] === undefined ? 4 : SEV_RANK[r.severity]))
      .reduce((a, b) => Math.min(a, b), 4);
    const sevName = Object.keys(SEV_RANK).find(k => SEV_RANK[k] === worst) || 'none';
    const byKey = new Map();
    list.forEach(r => { if (!byKey.has(r.key)) byKey.set(r.key, []); byKey.get(r.key).push(r); });
    out.push('## Cause: ' + cause + ' — ' + list.length
      + (list.length === 1 ? ' row across ' : ' rows across ')
      + byKey.size + (byKey.size === 1 ? ' key' : ' keys')
      + ' (worst severity: ' + sevName + ')');
    out.push('');
    const keys = [...byKey.keys()].sort((a, b) =>
      byKey.get(b).length - byKey.get(a).length || (a < b ? -1 : 1));
    for (const key of keys) {
      const rs = byKey.get(key);
      const props = [...new Set(rs.map(r => r.property).filter(Boolean))];
      const docs  = [...new Set(rs.map(r => r.doc).filter(Boolean))];
      const bits = [rs.length + (rs.length === 1 ? ' row' : ' rows')];
      if (props.length) bits.push(props.length + (props.length === 1 ? ' property' : ' properties'));
      if (docs.length) bits.push(docs.join(', '));
      out.push('### `' + key + '` — ' + bits.join(', '));
      out.push('');
      out.push('| property | doc | status | ours | theirs |');
      out.push('|---|---|---|---|---|');
      rs.forEach(r => out.push('| ' + cell(r.property) + ' | ' + cell(r.doc) + ' | '
        + cell(r.status) + ' | ' + cell(r.ours) + ' | ' + cell(r.theirs) + ' |'));
      out.push('');
    }
  }

  if (drift.length) {
    out.push('## Boilerplate drift — ' + drift.length
      + (drift.length === 1 ? ' line' : ' lines'));
    out.push('');
    out.push('Template wording, not values. Never a mismatch row; listed so a real '
      + 'template divergence stays visible without burying the rents under paragraphs.');
    out.push('');
    out.push('| property | doc | side | line |');
    out.push('|---|---|---|---|');
    drift.forEach(d => out.push('| ' + cell(d.property) + ' | ' + cell(d.doc) + ' | '
      + cell(d.side) + ' | ' + cell(d.line) + ' |'));
    out.push('');
  }
  return out.join('\n');
}

module.exports = {
  compareFacts, compareRuns, renderMarkdown,
  /* exported for test_compare.js and for anyone writing a new rule */
  _norm: { money, dateISO, prose, present, signOf, sameValue }
};
