/* hap.js — the HAP tracker seam.

   Related Affordable's HAP tracker knows when every renewal is due, which
   program it is, and whose property it is. This file turns that into something
   the app can navigate by. It reads; it never writes back.

   WHY THIS FILE IS SO FORGIVING. The integration happens on Michael the RA integrator's
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

  /* EXPIRES and Request are known non-events: an option term ending, and a PBV.
     Stepping over them is correct. A type we have never seen is NOT the same
     thing — it may be the very work that is due — so it stops the action and is
     shown verbatim rather than skipped, per the design's failure table. A blank
     type falls here too, deliberately: today's export has none, and one
     appearing tomorrow is news, not noise. */
  const KNOWN_SKIP = { EXPIRES: 1, REQUEST: 1 };
  function typeKind(t) {
    const u = String(t == null ? '' : t).trim().toUpperCase();
    if (STARTABLE[u]) return 'startable';
    if (KNOWN_SKIP[u]) return 'skip';
    return 'unknown';
  }

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

  /* ---- the primary action ----------------------------------------------
     What one property's button does. Compares the tracker's next startable row
     against the packages that exist locally. Facts only — the words are app.js's,
     because a data module that owns copy is a data module nobody can restyle.

     It lives here and not in app.js so it can be held to the real 2853-row
     corpus in node, where Bastrop, Sample Property and Sample Property already are; and
     because a second copy in app.js would be one rule with two implementations,
     which is the shape CLAUDE.md's parity warning is about. hap.js stays
     read-only: cycles arrive as an argument. */

  /* A TERMINAL `EXPIRES` IS THE CONTRACT EXPIRING, NOT THE TRACKER'S HORIZON.
     The original design said EXPIRES is never terminal and the contract always
     renews. Measured against the export, that is wrong as a blanket rule:

       · a mid-schedule EXPIRES — one with a startable row after it — is an
         option-term boundary and occurs on exactly four properties (Crossroads
         of Shoreview 75948, Roosevelt 90020, Sample Property 90030, Luther
         Towers 90111). There the contract carries on and the row is stepped over.
       · a schedule that ENDS on an EXPIRES is 125 properties, and its date
         matches the Contract Exp column: 122 of the 125 agree within a year
         either way. Sample Property expires 2029-06-26 against a contract ending
         2029-06-30; Greenacres 2027-10-01 against 2027-09-30.
       · the horizon theory fails on the distribution besides. Properties whose
         last row is startable pile up at the export's edge — 99 of 103 in 2039
         or 2040 — while terminal-EXPIRES years spread evenly from 2027 to 2040.
         The tracker stops on purpose.

     Three properties are the exception, their contract running two years or more
     past the EXPIRES row: Sample Property (75444), Sample Property (79612)
     and Sample Property (90063) — the one the original design generalised from. That is
     a gap in the schedule, not an expiry, and it is said differently.

     Either way the property STAYS listed and is never rendered finished or
     retired: the tracker records a date, not an outcome, and whether a contract
     renews is a business fact it does not hold. */
  const GAP_DAYS = 730;

  function actionFor(rows, code, cycles, todayISO) {
    const t = todayISO || isoOf(new Date());
    const out = {
      kind: 'none', type: '', year: '', effective: '', deadline: '', contractExp: '',
      cid: null, programs: [], label: '', disabled: true, reasonCode: '',
    };
    if (!inScope(rows)[code]) { out.reasonCode = 'out-of-scope'; return out; }

    const mine = rows.filter(r => r.code === code)
      .sort((a, b) => (a.effective < b.effective ? -1 : a.effective > b.effective ? 1 : 0));
    const future = mine.filter(r => r.effective >= t);
    const target = future.find(r => typeKind(r.type) === 'startable') || null;
    const blocker = future.find(r => typeKind(r.type) === 'unknown') || null;

    /* An unrecognised type only blocks when it comes FIRST. A property with an
       OCAF in 2027 and something strange in 2032 still starts its 2027 OCAF. */
    if (blocker && (!target || blocker.effective < target.effective)) {
      return Object.assign(out, {
        kind: 'unsupported', type: blocker.type, year: blocker.effective.slice(0, 4),
        effective: blocker.effective, deadline: blocker.deadline,
        disabled: true, reasonCode: 'unknown-type',
      });
    }

    if (!target) {
      const last = mine[mine.length - 1] || null;
      if (last && String(last.type).trim().toUpperCase() === 'EXPIRES') {
        const beyond = last.contractExp ? daysBetween(last.effective, last.contractExp) : null;
        if (beyond != null && beyond >= GAP_DAYS)
          return Object.assign(out, {
            kind: 'gap', type: last.type, effective: last.effective,
            contractExp: last.contractExp, disabled: false, reasonCode: 'schedule-gap',
          });
        return Object.assign(out, {
          kind: 'expiring', type: last.type, effective: last.effective,
          contractExp: last.contractExp, disabled: true, reasonCode: 'contract-expires',
        });
      }
      /* The schedule simply runs out — on a startable row, or on a PBV request.
         That IS the tracker's horizon, and the contract is assumed to carry on. */
      return Object.assign(out, { kind: 'awaiting', disabled: false, reasonCode: 'no-future-row' });
    }

    const year = target.effective.slice(0, 4);
    const prog = target.type.toLowerCase();
    const base = {
      type: target.type, year, effective: target.effective, deadline: target.deadline,
      programs: [prog], label: year, disabled: false, reasonCode: '',
    };

    /* Two startable rows in one calendar year means year+program cannot identify
       a package. Sample Property (90111) is the only one of the 249 with that
       shape — OCAF 2026-09-01 and OCAF 2026-12-06, same label, same program — so
       the loose match is switched off for exactly it, and the September package
       cannot be mistaken for the December one. */
    const concurrent = future.filter(r => typeKind(r.type) === 'startable'
      && r.effective.slice(0, 4) === year).length > 1;
    const cyISO = c => String((c && c.effective_date) || '').slice(0, 10);
    const cyYear = c => cyISO(c).slice(0, 4) || (String((c && c.label) || '').match(/\d{4}/) || [''])[0];
    const list = Array.isArray(cycles) ? cycles : [];
    /* Never cycles[0] or c.dominant: listCycles sorts the dominant one first,
       and the dominant cycle is the latest-effective, which for a property being
       worked a year ahead is not the one the target names. */
    const match = list.find(c => cyISO(c) === target.effective)
      || (concurrent ? null
        : list.find(c => (c.programs || []).indexOf(prog) >= 0 && cyYear(c) === year))
      || null;

    if (!match) return Object.assign(out, base, { kind: 'start' });
    const gen = !!(match.generated && match.generated.at);
    /* A generated package does NOT advance to the next target. Packages are
       generated ~120 days before their effective date, so the current target is
       normally still in the future when its package is done — advancing would
       put "Start 2028 OCAF" directly beneath a deadline line reading "Due Sep 1
       · 34 days left", one card describing two renewals. targetFor moves on by
       itself once the date passes. */
    return Object.assign(out, base, { kind: gen ? 'view' : 'continue', cid: match.id });
  }

  /* Exported, because the home page explains these bands in prose ("due in the
     next 30 days") and prose that restates a constant is a second copy of it.
     The rail reads _bandDays rather than writing 30 again. */
  const BAND_DAYS = { now: 30, soon: 90 };
  const BANDS = [
    ['overdue', d => d < 0],
    ['now', d => d <= BAND_DAYS.now],
    ['soon', d => d <= BAND_DAYS.soon],
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

  /* the RA integrator sets window.HAPSource. Everything below is accepted, because being
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
    isStartable, typeKind, actionFor, toISO, addDays, daysBetween,
    _cols: COLS, _required: REQUIRED, _bandDays: BAND_DAYS, _gapDays: GAP_DAYS,
  };
  if (typeof window !== 'undefined') window.RCSHap = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
