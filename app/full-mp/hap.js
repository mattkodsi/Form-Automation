/* hap.js — the HAP tracker seam.

   Related Affordable's HAP tracker knows when every renewal is due, which
   program it is, and whose property it is. This file turns that into something
   the app can navigate by. It reads; it never writes back.

   WHY THIS FILE IS SO FORGIVING. The integration happens on Michael Kinley's
   machine, and we will not see his container until we are standing at it. Any
   shape we agree today is a shape he has to hit blind. So the contract is the
   smallest one there is — hand us rows, in whatever form you have them — and
   every accommodation lives here: column names are matched by meaning rather
   than spelling, dates are accepted in six formats, and a row that cannot be
   read is dropped with a reason rather than taken down the whole import.

   AND WHY IT EXPLAINS ITSELF. The failure we are actually designing against is
   not a crash. It is plugging in a live source and getting an empty list with
   no idea whether the container is empty, the columns are named differently, or
   the dates did not parse. So `diagnose()` reports what it matched, what it
   guessed, and what it could not find — against the real keys it was given.
   That report is the integration.

   Consumed by app.js for the home page; held to the real corpus by test_hap.js.
*/
(function () {
  'use strict';

  /* ---- small helpers --------------------------------------------------- */
  const pad = n => ('0' + n).slice(-2);
  const isoOf = d => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const trim = s => String(s == null ? '' : s).trim();

  /* Dates arrive as the CSV's MM/DD/YYYY, as ISO from a JSON API, as a Date
     from a driver that already parsed them, or as an Excel serial from a sheet
     export. Take all of them; return ISO or '' and let the caller decide. */
  function toISO(v) {
    if (v == null) return '';
    if (v instanceof Date) return isNaN(v.getTime()) ? '' : isoOf(v);
    const s = trim(v);
    if (!s) return '';
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
    m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);          // US month-first
    if (m) return m[3] + '-' + pad(+m[1]) + '-' + pad(+m[2]);
    m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2})$/);          // two-digit year
    if (m) { const y = +m[3]; return (y < 50 ? 2000 + y : 1900 + y) + '-' + pad(+m[1]) + '-' + pad(+m[2]); }
    if (/^\d+(\.\d+)?$/.test(s)) {                                    // Excel serial
      const n = +s;
      if (n > 20000 && n < 80000) return isoOf(new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000));
      return '';
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : isoOf(d);
  }

  const addDays = (iso, n) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
    const p = iso.split('-');
    return isoOf(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)));
  };
  const daysBetween = (a, b) => {                                     // b - a, in days
    if (!a || !b) return null;
    const pa = a.split('-'), pb = b.split('-');
    return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
  };

  /* ---- what a row means ------------------------------------------------ */

  /* Only these two produce a package. EXPIRES is a contract reaching the end of
     an option term; Request is a PBV. Neither gets an RCS or an OCAF. Compared
     case-insensitively because the export spells it both EXPIRES and Expires. */
  const STARTABLE = { OCAF: 1, RCS: 1 };
  const isStartable = t => !!STARTABLE[String(t || '').trim().toUpperCase()];

  /* Matched by meaning, not spelling. Exact normalized hits are silent; a
     substring fallback is allowed but always reported, so an integration never
     depends on a guess nobody saw. */
  const COLS = [
    ['code', ['propertycode', 'code', 'raid', 'ramasterid', 'propertyid', 'propid', 'ranumber']],
    ['name', ['propertyname', 'name', 'property', 'projectname']],
    ['pm', ['portfoliomgr', 'portfoliomanager', 'pm', 'manager', 'assetmanager']],
    ['type', ['increasetype', 'renewaltype', 'adjustmenttype', 'type']],
    ['effective', ['rentincrease', 'rentincreasedate', 'effectivedate', 'effective', 'anniversary', 'rentseffective']],
    ['due', ['duetohud', 'duetohudca', 'duedate', 'submissiondue', 'due']],
    ['orderRcsBy', ['datetoorderrcs', 'rcsorderdate', 'orderrcs', 'datetoorder']],
    ['contractType', ['contracttype']],
    ['contractExp', ['contractexp', 'contractexpiration', 'contractexpdate', 'expirationdate']],
    ['ca', ['contractadmin', 'contractadministrator', 'contractadministrator', 'ca']],
    ['units', ['units', 'totalunits', 'unitcount']],
    ['s8Units', ['s8units', 'section8units', 'assistedunits']],
  ];
  const REQUIRED = ['code', 'name', 'type', 'effective'];

  /* Work out which source key feeds which field. A source key is claimed once,
     so 'Contract Type' cannot also answer for 'type'. */
  function mapColumns(sampleRow) {
    const keys = Object.keys(sampleRow || {});
    const byNorm = {};
    keys.forEach(k => { const n = norm(k); if (!(n in byNorm)) byNorm[n] = k; });
    const map = {}, guessed = {}, claimed = {};

    COLS.forEach(([field, aliases]) => {                              // pass 1: exact
      for (const a of aliases) {
        const src = byNorm[a];
        if (src && !claimed[src]) { map[field] = src; claimed[src] = 1; return; }
      }
    });
    COLS.forEach(([field, aliases]) => {                              // pass 2: substring, reported
      if (map[field]) return;
      for (const a of aliases) {
        const hit = keys.find(k => !claimed[k] && (norm(k).indexOf(a) >= 0 || a.indexOf(norm(k)) >= 0));
        if (hit) { map[field] = hit; guessed[field] = hit; claimed[hit] = 1; return; }
      }
    });

    const missing = COLS.map(c => c[0]).filter(f => !map[f]);
    return { map, guessed, missing, sourceKeys: keys, missingRequired: REQUIRED.filter(f => !map[f]) };
  }

  /* ---- CSV ------------------------------------------------------------- */

  /* RFC-ish: quoted fields, embedded commas and newlines, doubled quotes, BOM,
     CRLF. Ragged rows are kept and padded — the export contains one (a single
     property short a few trailing fields) and losing it silently would be worse
     than reading what it does have. */
  function parseCSV(text) {
    const s = String(text || '').replace(/^﻿/, '');
    const rows = [];
    let row = [], field = '', q = false, i = 0;
    while (i < s.length) {
      const c = s[i];
      if (q) {
        if (c === '"') { if (s[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
        field += c; i++; continue;
      }
      if (c === '"') { q = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return [];
    const head = rows.shift().map(trim);
    return rows
      .filter(r => r.some(v => trim(v) !== ''))                       // drop blank lines
      .map(r => { const o = {}; head.forEach((h, j) => { o[h] = r[j] == null ? '' : r[j]; }); return o; });
  }

  /* ---- normalize ------------------------------------------------------- */

  /* Raw rows in, usable rows out, plus an account of everything discarded or
     repaired. Nothing is dropped quietly. */
  function normalize(rawRows, opts) {
    const o = opts || {};
    const leadDays = o.leadDays == null ? 120 : o.leadDays;
    const raw = Array.isArray(rawRows) ? rawRows : [];
    const cols = mapColumns(raw[0] || {});
    const rows = [], dropped = [];
    let ragged = 0, badDates = 0, inverted = 0;

    raw.forEach((r, idx) => {
      const get = f => (cols.map[f] ? r[cols.map[f]] : undefined);
      const code = trim(get('code'));                                 // ALWAYS a string: one code is "HCV1"
      const name = trim(get('name'));
      const type = trim(get('type')).toUpperCase();
      const effective = toISO(get('effective'));
      if (Object.keys(r).length < cols.sourceKeys.length) ragged++;   // short row: read what it has
      if (!code) { dropped.push({ idx, why: 'no property code' }); return; }
      if (!effective) {
        if (trim(get('effective'))) badDates++;
        dropped.push({ idx, code, why: 'no readable rent-increase date' }); return;
      }
      let due = toISO(get('due'));
      /* A due date after the increase it precedes is a tracker error, not a
         schedule. Nineteen rows have it. Fall back to the computed date and
         say so, rather than render a negative countdown. */
      let dueSuspect = false;
      if (due && daysBetween(due, effective) < 0) { dueSuspect = true; inverted++; due = ''; }
      rows.push({
        code, name, type,
        pm: trim(get('pm')),
        effective, due,
        dueSuspect,
        deadline: due || addDays(effective, -leadDays),
        deadlineSource: due ? 'tracker' : 'computed',
        orderRcsBy: toISO(get('orderRcsBy')),
        contractType: trim(get('contractType')),
        contractExp: toISO(get('contractExp')),
        ca: trim(get('ca')),
        units: trim(get('units')),
        s8Units: trim(get('s8Units')),
        startable: isStartable(type),
      });
    });

    rows.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0) || (a.effective < b.effective ? -1 : a.effective > b.effective ? 1 : 0));
    return { rows, cols, report: { read: raw.length, kept: rows.length, dropped, ragged, badDates, inverted, leadDays } };
  }

  /* ---- derivation ------------------------------------------------------ */

  const codesOf = rows => { const s = {}; rows.forEach(r => { s[r.code] = 1; }); return Object.keys(s); };

  /* In scope = has an OCAF or an RCS in ANY year. A property that never does is
     not this app's work and is not listed with an explanation of why; it is
     simply absent. */
  function inScope(rows) {
    const s = {};
    rows.forEach(r => { if (r.startable) s[r.code] = 1; });
    return s;
  }

  /* The next package. Skips EXPIRES and Request rows rather than stopping at
     them: a property reaches the end of an option term and carries on. */
  function targetFor(rows, code, todayISO) {
    const t = todayISO || isoOf(new Date());
    let best = null;
    rows.forEach(r => {
      if (r.code !== code || !r.startable || r.effective < t) return;
      if (!best || r.effective < best.effective) best = r;
    });
    return best;
  }

  /* A schedule that runs out at an EXPIRES row has reached the tracker's
     horizon, not the property's end — we assume the contract renews. So a
     property with no future startable row is AWAITING one, never finished. */
  function statusFor(rows, code, todayISO) {
    if (!inScope(rows)[code]) return 'out-of-scope';
    return targetFor(rows, code, todayISO) ? 'scheduled' : 'awaiting-schedule';
  }

  const BANDS = [
    ['overdue', d => d < 0],
    ['now', d => d <= 30],
    ['soon', d => d <= 90],
    ['later', () => true],
  ];
  function bandOf(deadlineISO, todayISO) {
    const t = todayISO || isoOf(new Date());
    if (!deadlineISO) return 'undated';
    const d = daysBetween(t, deadlineISO);
    if (d == null) return 'undated';
    return BANDS.find(b => b[1](d))[0];
  }

  function managers(rows) {
    const s = {};
    rows.forEach(r => { if (r.pm) s[r.pm] = 1; });
    return Object.keys(s).sort();
  }

  /* ---- the seam -------------------------------------------------------- */

  /* Kinley sets window.HAPSource. Everything below is accepted, because being
     particular about the handshake is how an on-site integration turns into a
     debugging session:
         an array of rows                         window.HAPSource = [...]
         an object with rows / schedule / data    { rows: [...] }
         a function returning either              { rows: () => [...] }
         a promise of either                      { rows: async () => [...] }
         raw CSV text                             { csv: "..." }  */
  async function read(source) {
    let s = source === undefined ? (typeof window !== 'undefined' ? window.HAPSource : null) : source;
    if (s == null) return { ok: false, raw: [], why: 'no source: window.HAPSource is not set' };
    if (typeof s === 'function') s = s();
    s = await Promise.resolve(s);
    if (typeof s === 'string') return { ok: true, raw: parseCSV(s), why: '' };
    if (Array.isArray(s)) return { ok: true, raw: s, why: '' };
    if (s && typeof s === 'object') {
      for (const k of ['rows', 'schedule', 'data', 'items', 'value']) {
        if (k in s) {
          let v = s[k];
          if (typeof v === 'function') v = v.call(s);
          v = await Promise.resolve(v);
          if (typeof v === 'string') return { ok: true, raw: parseCSV(v), why: '' };
          if (Array.isArray(v)) return { ok: true, raw: v, why: '' };
        }
      }
      if (typeof s.csv === 'string') return { ok: true, raw: parseCSV(s.csv), why: '' };
    }
    return { ok: false, raw: [], why: 'source gave no array of rows (looked for rows/schedule/data/items/value/csv)' };
  }

  /* The integration aid. When a live source returns nothing, this says whether
     the container was empty, the columns were named differently, or the dates
     did not parse — quoting the keys it actually saw. */
  function diagnose(rawRows, opts) {
    const raw = Array.isArray(rawRows) ? rawRows : [];
    const L = [];
    if (!raw.length) {
      L.push('HAP source returned 0 rows. The container is empty, or the query is scoped wrong.');
      return L.join('\n');
    }
    const { rows, cols, report } = normalize(raw, opts);
    L.push(`HAP source returned ${report.read} rows; ${report.kept} usable.`);
    L.push('Columns it was given: ' + cols.sourceKeys.join(', '));
    const matched = COLS.map(c => c[0]).filter(f => cols.map[f] && !cols.guessed[f]);
    if (matched.length) L.push('Matched: ' + matched.map(f => `${f} <- "${cols.map[f]}"`).join(', '));
    const g = Object.keys(cols.guessed);
    if (g.length) L.push('GUESSED (verify these): ' + g.map(f => `${f} <- "${cols.guessed[f]}"`).join(', '));
    if (cols.missing.length) L.push('Not found: ' + cols.missing.join(', '));
    if (cols.missingRequired.length) L.push(`CANNOT PROCEED — required field(s) missing: ${cols.missingRequired.join(', ')}. Nothing will show until these map.`);
    if (report.dropped.length) L.push(`Dropped ${report.dropped.length} row(s): ` + report.dropped.slice(0, 3).map(d => `#${d.idx} ${d.why}`).join('; ') + (report.dropped.length > 3 ? ' …' : ''));
    if (report.ragged) L.push(`${report.ragged} row(s) had fewer fields than the header; read as far as they went.`);
    if (report.inverted) L.push(`${report.inverted} row(s) had a due date after the increase; using ${report.leadDays}-day fallback for those.`);
    const scope = Object.keys(inScope(rows)).length;
    L.push(`${codesOf(rows).length} properties, ${scope} with an OCAF or RCS in some year.`);
    if (!scope) L.push('WARNING: no startable rows. Check that the increase-type column is mapped and spelled OCAF/RCS.');
    return L.join('\n');
  }

  const API = {
    parseCSV, normalize, mapColumns, diagnose, read,
    targetFor, statusFor, inScope, bandOf, managers, codesOf,
    isStartable, toISO, addDays, daysBetween,
    _cols: COLS, _required: REQUIRED,
  };
  if (typeof window !== 'undefined') window.RCSHap = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
