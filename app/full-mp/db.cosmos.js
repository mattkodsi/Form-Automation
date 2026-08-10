/* db.cosmos.js — RA Platform (Cosmos DB) data layer for the RCS app.
   Drop-in replacement for makeSupabaseDb(client): SAME public method surface,
   argument signatures and RETURN SHAPES, so the shared app.js/core.js/gen.js run
   unchanged on the Azure port. Brought to FULL parity with db.supabase.js
   (2026-08-10): the whole cycle surface, the HAP/identity surface, and the
   RA-code binding now match the live Supabase adapter method-for-method.

   Model:
   • ONE Cosmos document per PROPERTY (container RcsProperties, pk /id):
       { id, type:'rcsProperty', ra_property_code, created_at, updated_at,
         durable:{ key:{value,saved_at} }, percycle:{ key:{value,saved_at} },
         name, fha, city_state, entity, alias, unit_types, total_units,
         completeness, has_letterhead }        // denormalized gallery summary
     One property is ONE atomic upsert (Cosmos single-doc writes are
     transactional), skipping the relational PSCALAR/UCOL decomposition entirely.
   • ONE Cosmos document per CYCLE / package (container RcsCycles, pk
     /property_id — a property's packages co-locate, so "all cycles for a
     property" is a single-partition query; the bootstrap returns them all):
       { id, type:'rcsCycle', property_id, programs, label, effective_date,
         cells:{ key:{value,saved_at,origin,pinned} }, generated, rs_doc,
         rcs_doc, reopened_at?, created_at, updated_at }
     A cycle carries only form cells (no letterhead PNG — cyNoCarry drops it), so
     it stays comfortably under the 2MB doc cap; no chunking needed.

   Letterheads (dataURLs up to ~5.5MB) exceed Cosmos's 2MB doc cap, so they live
   as ≤1.4MB chunks in RcsAssets, written via /api/rcs/letterhead and re-assembled
   server-side into the bootstrap payload.

   The HAP tracker (hap_schedule equivalent) and the signed-in PM's display name
   are reference/identity data: the bootstrap payload carries them read-mostly
   (b.hap, b.hapError, b.pmName), exactly as db.supabase.js loads app_user +
   hap_schedule. setPmName is the one identity write.

   AUM PREFILL (read-only): the bootstrap payload carries a projection of the AUM
   master registry (b.aum). aumIndex()/aumValue()/create-time seeding read it. The
   adapter has NO write path to AUM or any other source container — user edits to
   prefilled values are stored on the RCS property doc only, by construction. The
   registry link the app binds by is ra_property_code (matches db.supabase.js and
   propByRaCode/raCodeOfPid/setRaCode); legacy docs written with raMasterId are
   read through a fallback on load.

   Auth: every request rides the App Service Easy Auth session (cookies); the
   server enforces module view/edit via requireModule(['rcs']) and knows the
   signed-in user itself (setPmName sends no id).

   Server endpoints this client calls (integrator must provide):
     GET  /api/rcs/bootstrap        -> { props[], cycles[], contacts[], dir[],
                                         letterheads{}, aum[], hap[], hapError, pmName }
     POST /api/rcs/property         (whole-doc upsert of buildDoc(pid))
     POST /api/rcs/property-delete  { id }
     POST /api/rcs/cycle            (whole-doc upsert of a cycle)
     POST /api/rcs/cycle-delete     { id }
     POST /api/rcs/letterhead       (chunked; see setLetterhead)
     POST /api/rcs/contact          { op, collection, rec | id }
     POST /api/rcs/pm-name          { pm_name }
     POST /api/rcs/clear-all        {}                                          */
function makeCosmosDb() {
  const today = () => new Date().toISOString().slice(0, 10);
  const now = () => new Date().toISOString();
  const uuid = () => (crypto && crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }));

  async function api(path, opts) {
    const r = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } }, opts || {}));
    if (!r.ok) {
      let msg = 'HTTP ' + r.status;
      try { msg = (await r.json()).error || msg; } catch (e) { }
      throw new Error(msg);
    }
    return r.json();
  }

  /* ---- in-memory mirror --------------------------------------------------
     Same shape as db.supabase.js's D (props/contacts/dir/activePid/cycles/hap/
     hapError/pmName), plus the cosmos-only letterheads + AUM projection. */
  let D = { props: {}, contacts: [], dir: [], activePid: null, cycles: {}, hap: [], hapError: '', pmName: '', letterheads: {}, aum: [] };

  const place = (p, key, raw, sa) => {
    const cell = { value: (raw == null ? '' : String(raw)), source: 'database', saved_at: sa };
    if (isPerCycleKey(key)) p.percycle[key] = cell; else p.durable[key] = cell;
  };

  async function load() {
    const b = await api('/api/rcs/bootstrap');
    D = { props: {}, contacts: [], dir: [], activePid: null, cycles: {}, hap: b.hap || [], hapError: b.hapError || '', pmName: b.pmName || '', letterheads: b.letterheads || {}, aum: b.aum || [] };
    (b.props || []).forEach(doc => {
      const p = {
        id: doc.id,
        created_at: doc.created_at || '', updated_at: doc.updated_at || doc.created_at,
        durable: {}, percycle: {},
      };
      /* The registry link the app binds by. ra_property_code is canonical
         (matches db.supabase.js); raMasterId is the legacy field older cosmos
         docs were written with, read here so a rename in the schema doesn't
         orphan a scheduled property from its tracker code. */
      const rac = (doc.ra_property_code != null) ? doc.ra_property_code : doc.raMasterId;
      if (rac != null && String(rac) !== '') p.ra_property_code = String(rac);
      ['durable', 'percycle'].forEach(bkt => {
        const src = doc[bkt] || {};
        for (let k in src) {
          const cell = src[k]; if (!cell || cell.value == null) continue;
          // legacy key migration (2026-07-16): lihtc.* renamed to ns8.*
          if (k === 'lihtc.enabled') k = 'ns8.enabled';
          else if (k.indexOf('lihtc.') === 0) k = 'ns8.' + k.slice(6);
          // re-route through isPerCycleKey so durable/percycle stay canonical
          place(p, k, cell.value, cell.saved_at || '');
        }
      });
      // letterhead print data lives outside the doc — rejoin it here
      if (D.letterheads[doc.id]) {
        p.durable['assets.letterhead_data'] = { value: D.letterheads[doc.id], source: 'database', saved_at: doc.updated_at || '' };
      }
      D.props[doc.id] = p;
    });
    /* Cycles are their own documents. Mirror them into D.cycles with the SAME
       shape db.supabase.js keeps, so every downstream helper (dominantCycleId,
       cyCompare, scoreOfCycle…) reads them identically. */
    (b.cycles || []).forEach(c => {
      D.cycles[c.id] = { id: c.id, property_id: c.property_id, programs: c.programs || '', label: c.label || '', effective_date: c.effective_date || '', cells: c.cells || {}, reopened_at: c.reopened_at || null, generated: c.generated || {}, rs_doc: c.rs_doc || {}, rcs_doc: c.rcs_doc || {}, created_at: c.created_at || '', updated_at: c.updated_at || c.created_at || '' };
    });
    D.contacts = (b.contacts || []).map(c => ({ id: c.id, name: c.name || '', email: c.email || '', phone: c.phone || '' }));
    const DIRF = ['name', 'email', 'phone', 'prefix', 'org', 'firm', 'title', 'addr_street', 'addr_city', 'addr_state', 'addr_zip'];
    D.dir = (b.dir || []).map(c => { const r = { id: c.id, kind: c.kind || '' }; DIRF.forEach(f => r[f] = c[f] || ''); return r; });
  }

  /* ---- registry helpers (mirror db.supabase.js) --------------------------- */
  const dv = (p, k) => (p.durable[k] && p.durable[k].value !== '' ? p.durable[k].value : '');

  /* One property, one name — enforced here, where every caller passes.

     The dialog has asked existingPropByName() since 2026-07-24 and opens the
     twin rather than making a second one. But a courtesy only guards the path
     that remembers it, and three routes never did: creating a property with no
     name and naming it afterwards, renaming one onto a name already taken, and
     a plain save of property.name — which is exactly what applying an executed
     schedule's parse does. The live record grew three duplicates of one sample
     property and three of another with that dialog check in place the whole
     time.

     So the rule lives in the data layer and the dialog keeps the courtesy:
     callers that ask first still open the existing profile and never see this
     throw. Case- and space-insensitive, because "Sample Property" and "sample
     property " are the same building. */
  const nameKey = s => String(s == null ? '' : s).trim().toLowerCase();
  const propByName = (name, skipPid) => {
    const k = nameKey(name); if (!k) return null;
    for (const id in D.props) { if (id === skipPid) continue; if (nameKey(dv(D.props[id], 'property.name')) === k) return D.props[id]; }
    return null;
  };
  const assertNameFree = (name, skipPid) => {
    const clash = propByName(name, skipPid); if (!clash) return;
    const e = new Error('A property named “' + String(name).trim() + '” already exists.');
    e.code = 'DUP_PROPERTY_NAME'; e.pid = clash.id; e.dupName = String(name).trim(); throw e;
  };
  function unitCountOf(p) {
    const idx = new Set(); Object.keys(p.durable).forEach(k => { const m = k.match(/^units\.(\d+)\.num_units$/); if (m && p.durable[k].value !== '') idx.add(m[1]); });
    let total = 0; idx.forEach(i => total += num(p.durable['units.' + i + '.num_units'].value)); return { types: idx.size, units: total };
  }
  function merged(pid) { const p = D.props[pid]; return p ? Object.assign({}, p.durable, p.percycle) : {}; }
  function bucketsOf(pid) { return merged(pid); }
  function loadFormCells(pid) {
    const b = merged(pid), form = {};
    for (const k in b) { const v = b[k] ? b[k].value : ''; const has = v !== '' && v != null; form[k] = { value: (v == null ? '' : v), source: has ? 'database' : 'new', saved_at: b[k] ? b[k].saved_at : null, prior_value: null, prior_source: null, db_value: has ? v : (b[k] ? '' : null) }; }
    return form;
  }
  const touch = pid => { if (D.props[pid]) D.props[pid].updated_at = now(); };

  /* ---- scoring (mirror db.supabase.js) -----------------------------------
     The ring is the DOMINANT PACKAGE's score — see score.js. In the browser
     bundle window.RCSScore is set by the concatenated score.js; node tests reach
     it through require. Identical wiring to db.supabase.js/db.js. */
  const SCORE = (typeof window !== 'undefined' && window.RCSScore) ? window.RCSScore
    : (typeof require !== 'undefined' ? require('./score.js') : null);
  /* Reading the dominant cycle, falling back to the template. A cycle that HOLDS
     a key answers for it even when the value is blank — the package is what was
     frozen, not the template underneath it. */
  function scoreRead(pid, cid) {
    const domId = cid === undefined ? dominantCycleId(pid) : cid;
    const cells = domId && D.cycles[domId] ? D.cycles[domId].cells : null;
    const base = bucketsOf(pid);
    return k => {
      if (cells && Object.prototype.hasOwnProperty.call(cells, k)) { const v = cells[k].value; return v == null ? '' : String(v); }
      const d = base[k]; const v = d ? d.value : '';
      return v == null ? '' : String(v);
    };
  }
  /* Scored for ONE package, not for the property. Same arithmetic, same tables
     as db.supabase.js, one argument more. */
  function scoreOfCycle(pid, cid) {
    const p = D.props[pid]; if (!p || !SCORE) return { pct: 0, gate: 'profile', docsReady: 0, docsTotal: 0 };
    const domId = cid; const cy = domId ? D.cycles[domId] : null;
    const u = new Set(), pr = new Set();
    const scan = o => { for (const k in o) { let m = k.match(/^units\.(\d+)\./); if (m) u.add(+m[1]);
      m = k.match(/^principals\.(\d+)\./); if (m) pr.add(+m[1]); } };
    scan(bucketsOf(pid)); if (cy) scan(cy.cells);
    const progs = cy ? (Array.isArray(cy.programs) ? cy.programs : String(cy.programs || '').split(',').filter(Boolean)) : [];
    const held = !!(cy && cy.rcs_doc && Object.keys(cy.rcs_doc).length);
    const read = scoreRead(pid, domId);
    return SCORE.packageScore(read, {
      programs: progs.length ? progs : ['rcs'], units: [...u].sort((a, b) => a - b),
      principals: [...pr].sort((a, b) => a - b), checklistLen: 17,
      hasLetterhead: dv(p, 'assets.letterhead_name') !== '', hasStudy: held, hasCaPkg: held,
      rateType: read('ocaf.rate_type'),
    });
  }
  const scoreOfPid = pid => scoreOfCycle(pid, dominantCycleId(pid));
  const completenessOf = p => scoreOfPid(p.id).pct / 100;
  /* The menu card reads the CURRENT cycle, not the template — same rule as
     db.supabase.js, so a property's unit count is identical whichever backend the
     app booted on. */
  function unitCountOfPid(pid) {
    const domId = dominantCycleId(pid);
    if (domId) {
      const cells = D.cycles[domId].cells; const idx = {};
      for (const k in cells) { const m = k.match(/^units\.(\d+)\.num_units$/); if (m && cells[k].value !== '') idx[m[1]] = num(cells[k].value); }
      const ks = Object.keys(idx);
      if (ks.length) return { types: ks.length, units: ks.reduce((s, i) => s + idx[i], 0) };
    }
    const p = D.props[pid]; return p ? unitCountOf(p) : { types: 0, units: 0 };
  }

  /* ---- cycles: one document = a complete frozen snapshot -------------------
     Ported verbatim from db.supabase.js so this adapter answers the same
     questions the real backend does; the programs list is stored comma-JOINED so
     cyCompare reads it identically and a cycle cannot rank differently depending
     on which layer the app booted on.

     Template stamp copies only durable IDENTITY keys; unit rows, Part B,
     checklist, and assets stay per-cycle / property-level respectively. */
  const isTemplateKey = k => !isPerCycleKey(k) && !/^(units|ns8|nonrev|partb|check|assets|principals)\./.test(k) && k !== 'ns8.enabled' && k !== 'nonrev.enabled';
  /* What does NOT carry from the prevailing cycle into a NEW cycle: each cycle's
     own outcomes (proposed rents), its year's factors, its dates, and its
     appraiser. Current rents and utility allowances never carry, on any
     programme — a figure the CA sets after submission must not arrive wearing the
     colour of saved truth; the executed schedule fills it. Everything else
     pre-fills so a new cycle starts from the property's current reality. */
  const cyNoCarry = (k) => /^units\.\d+\.proposed$/.test(k)
    || /^units\.\d+\.(current|ua_exec|ua_source|ua_custom)$/.test(k)
    || /^units\.\d+\.(br_rcs|ba_rcs|num_rcs|ua_rcs)$/.test(k)
    || /^units\.\d+\.safmr_(hud|rcs|source|custom)$/.test(k)
    || /^units\.\d+\.(ua|safmr|num|type)_reviewed$/.test(k)
    || /^units\.\d+\.uac_[a-z]+$/.test(k)
    || /^check\.\d+$/.test(k)
    || /^appr\./.test(k)
    || /^nonrev\.\d+\.rent$/.test(k)
    || /^ocaf\.(factor_|ds_t12$|ds_f12$)/.test(k)
    || /^uaf\./.test(k)
    || /^rent_schedule\./.test(k)
    || /^cycle\./.test(k)
    || k === 'checklist.sign_date' || k === 'tenant.date_of_notice'
    || k === 'assets.letterhead_data';
  /* cycle hierarchy: year first, then full date, then newest. */
  const cyYear = c => { const y = String(c.effective_date || '').slice(0, 4); return /^\d{4}$/.test(y) ? y : ((String(c.label || '').match(/\d{4}/) || [''])[0]); };
  const cyCompare = (a, b) => cyYear(b).localeCompare(cyYear(a))
    || String(b.effective_date || '').localeCompare(String(a.effective_date || ''))
    || String(b.created_at || '').localeCompare(String(a.created_at || ''));
  const cyclesOf = pid => Object.values(D.cycles || {}).filter(c => c.property_id === pid);
  function dominantCycleId(pid) {
    const cs = cyclesOf(pid); if (!cs.length) return null;
    cs.sort(cyCompare);
    return cs[0].id;
  }
  const cyISO = v => { v = String(v || '').trim(); if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10); const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? (m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2)) : ''; };
  /* ---- one package per effective date ----
     API PARITY with db.supabase.js — same rule, same error codes, same fields. */
  const PROGS_OF = c => String((c && c.programs) || '')
    .split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  /* ---- a filed package is history ----
     A package is CLOSED once its effective date has passed — unless it was
     deliberately reopened. Enforced on the WRITE (not a UI flag), because the
     form has ~110 controls and one that missed a read-only flag would write
     silently into a package already gone to the CA (FORM-RULES 17).

     NB: this honours reopened_at and re-reads the cycle in the error path, per
     db.js — the shared reference the app holds to parity. db.supabase.js's own
     twin currently omits the reopened_at check and references an out-of-scope
     var in assertCycleOpen; replicating those into a reference adapter would make
     reopenCycle a no-op and turn a friendly PACKAGE_CLOSED into a ReferenceError,
     so this follows the corrected db.js behaviour. See handoff/report. */
  const cycleClosed = cid => {
    const c = D.cycles[cid]; if (!c) return false;
    if (c.reopened_at) return false;   // somebody deliberately said otherwise
    const eff = cyISO(c.effective_date); if (!eff) return false;
    return eff < today();
  };
  const assertCycleOpen = cid => {
    if (!cycleClosed(cid)) return;
    const c = D.cycles[cid];
    const e = new Error('These rents took effect on ' + cyISO(c.effective_date) + '. A package is history once its date has passed — reopen it if it genuinely still needs work.');
    e.code = 'PACKAGE_CLOSED'; e.cid = cid; throw e;
  };
  const assertPackageFree = (pid, effIn, progs, skipCid) => {
    const want = (progs || []).map(x => String(x).trim().toLowerCase()).filter(Boolean);
    if (want.indexOf('rcs') >= 0 && want.indexOf('ocaf') >= 0) {
      const e = new Error('A package sets its rents by a market study or by the published factor, never both.');
      e.code = 'PROGRAM_CONFLICT'; throw e;
    }
    const eff = cyISO(effIn); if (!eff || !want.length) return;
    for (const cid in D.cycles) {
      if (cid === skipCid) continue;
      const c = D.cycles[cid];
      if (!c || c.property_id !== pid || cyISO(c.effective_date) !== eff) continue;
      /* Creating: the date is taken, whatever that package happens to hold. */
      if (skipCid === undefined) {
        const e = new Error('This property already has a package effective ' + eff + '.');
        e.code = 'DUP_PACKAGE_DATE'; e.cid = cid; e.effective = eff; throw e;
      }
      /* Changing an existing package's contents: the only way to reach here is a
         legacy same-date twin. Refuse to hand it a programme the twin holds. */
      const held = PROGS_OF(c);
      const clash = want.filter(x => held.indexOf(x) >= 0);
      if (clash.length) {
        const e = new Error('A ' + clash.join(' + ').toUpperCase()
          + ' package effective ' + eff + ' already exists for this property.');
        e.code = 'DUP_PACKAGE_PROGRAM'; e.cid = cid; e.programs = clash; e.effective = eff;
        throw e;
      }
      if ((want.indexOf('rcs') >= 0 && held.indexOf('ocaf') >= 0)
        || (want.indexOf('ocaf') >= 0 && held.indexOf('rcs') >= 0)) {
        const e = new Error('A package effective ' + eff + ' already sets this property’s rents the other way.');
        e.code = 'PROGRAM_CONFLICT'; e.cid = cid; e.effective = eff; throw e;
      }
    }
  };
  function cySyncEff(c) {
    // the form's date-rents-effective drives the cycle's date + year label
    const src = (c.cells['rent_schedule.date_eff_source'] || {}).value;
    /* Related Affordable outranks both. It is written only when their database
       answered, and it is per-cycle and non-carrying, so it stays the answer for
       THIS package even if that database later says something else. */
    const eff = cyISO((c.cells['rent_schedule.date_eff_ra'] || {}).value
      || (src === 'custom' ? (c.cells['rent_schedule.date_eff_custom'] || {}).value
      : ((c.cells['rent_schedule.date_eff_rs'] || {}).value || (c.cells['rent_schedule.date_eff_custom'] || {}).value)));
    if (eff) { c.effective_date = eff; const y = eff.slice(0, 4); if (y) c.label = y; }
  }
  function cycleAnalysisOf(cid) {
    const c = D.cycles[cid]; const f = {}; if (!c) return computeAnalysis(f);
    for (const k in c.cells) f[k] = { value: c.cells[k].value };
    if ((c.programs || '').indexOf('rcs') < 0) { // OCAF/UAF: proposed falls back to current
      for (const k in f) { const m = k.match(/^units\.(\d+)\.current$/); if (!m) continue;
        const pk = 'units.' + m[1] + '.proposed'; if (!(f[pk] && parseFloat(f[pk].value) > 0)) f[pk] = { value: f[k].value }; }
    }
    return computeAnalysis(f);
  }
  async function pushCycle(cid) {
    const c = D.cycles[cid]; if (!c) return;
    await api('/api/rcs/cycle', { method: 'POST', body: JSON.stringify({
      id: c.id, type: 'rcsCycle', property_id: c.property_id, programs: c.programs, label: c.label,
      effective_date: c.effective_date, cells: c.cells, generated: c.generated || {},
      rs_doc: c.rs_doc || {}, rcs_doc: c.rcs_doc || {},
      ...(c.reopened_at ? { reopened_at: c.reopened_at } : {}),
      created_at: c.created_at, updated_at: now(),
    }) });
  }

  /* ---- build the Cosmos property doc from the mirror ---------------------- */
  function buildDoc(pid) {
    const p = D.props[pid];
    const strip = (bkt) => {
      const out = {};
      for (const k in bkt) {
        if (k === 'assets.letterhead_data') continue; // chunked in RcsAssets
        out[k] = { value: bkt[k].value, saved_at: bkt[k].saved_at || '' };
      }
      return out;
    };
    const uc = unitCountOfPid(pid);
    return {
      id: pid, type: 'rcsProperty', ra_property_code: p.ra_property_code || '',
      created_at: p.created_at, updated_at: now(),
      durable: strip(p.durable), percycle: strip(p.percycle),
      // denormalized gallery summary (kept on the doc so future list-only
      // endpoints never need the full cell map)
      name: dv(p, 'property.name') || '', fha: dv(p, 'property.s8') || dv(p, 'property.fha') || '',
      city_state: (dv(p, 'property.addr_city') || '') + (dv(p, 'property.addr_state') ? ', ' + dv(p, 'property.addr_state') : ''),
      entity: dv(p, 'owner.entity_name') || '', alias: dv(p, 'tenant.property_alias') || '',
      unit_types: uc.types, total_units: uc.units,
      completeness: completenessOf(p),
      has_letterhead: dv(p, 'assets.letterhead_name') !== '',
    };
  }
  async function pushProperty(pid) {
    if (!D.props[pid]) return; // deleted while queued
    await api('/api/rcs/property', { method: 'POST', body: JSON.stringify(buildDoc(pid)) });
  }

  /* ---- per-property write serialization + push coalescing -----------------
     (verbatim pattern from db.supabase.js — see the RA integration design notes) */
  const _q = {};
  function enqueue(pid, fn) { const prev = _q[pid] || Promise.resolve(); const next = prev.then(fn, fn); _q[pid] = next.catch(() => { }); return next; }
  const _pend = {};
  function pushSoon(pid) {
    if (_pend[pid]) return _pend[pid].p;
    const t = {}; t.p = new Promise((res, rej) => { t.res = res; t.rej = rej; });
    _pend[pid] = t;
    enqueue(pid, async () => { delete _pend[pid]; try { await pushProperty(pid); t.res(); } catch (e) { t.rej(e); } });
    return t.p;
  }

  /* saveFlat as a plain function: saveFlatCycle writes identity edits through to
     the template and must not depend on how the caller bound `this`. */
  function _saveFlat(pid, map) {
    const p = D.props[pid]; if (!p) throw new Error('no property ' + pid);
    if (map && map['property.name']) assertNameFree(map['property.name'].value, pid);
    for (const k in map) place(p, k, (map[k] && map[k].value != null ? map[k].value : ''), (map[k] && map[k].saved_at) ? map[k].saved_at : today());
    touch(pid); return pushSoon(pid);
  }

  /* ---- AUM prefill (READ-ONLY — no write path to source data exists) ------ */
  const AUM_PREFILL = (a) => ({
    'property.name': a.property_name || '',
    'property.addr_street': a.address || a.street_address || '',
    'property.addr_city': a.city || '',
    'property.addr_state': a.state || '',
    'property.addr_zip': String(a.zip || ''),
    'owner.entity_name': a.partnership_name || '',
    'tenant.property_alias': (a.aka_name && a.aka_name !== 'N/A') ? a.aka_name : '',
    'ca.org': a.section_8_contract_administrator || '',
  });
  const aumFor = p => (p && p.ra_property_code)
    ? (D.aum || []).find(x => String(x.RAID || x.ra_master_id || '') === String(p.ra_property_code))
    : null;

  /* ---- init ---------------------------------------------------------------- */
  return (async () => {
    await load();
    return {
      _raw: () => D,
      today,
      listProperties() {
        return Object.values(D.props).map(p => {
          const uc = unitCountOfPid(p.id); const _s = scoreOfPid(p.id);
          return {
            id: p.id, name: dv(p, 'property.name') || '(unnamed property)', fha: dv(p, 'property.s8') || dv(p, 'property.fha') || '—',
            city_state: (dv(p, 'property.addr_city') || '') + (dv(p, 'property.addr_state') ? ', ' + dv(p, 'property.addr_state') : ''),
            entity: dv(p, 'owner.entity_name') || '', alias: dv(p, 'tenant.property_alias') || '', unit_types: uc.types, total_units: uc.units,
            completeness: _s.pct / 100, score: _s.pct, caption: SCORE ? SCORE.scoreCaption(_s) : "",
            profile: _s.profile,
            docs_ready: _s.docsReady, docs_total: _s.docsTotal,
            created_at: p.created_at, updated_at: p.updated_at || p.created_at,
            has_letterhead: dv(p, 'assets.letterhead_name') !== '',
          };
        }).sort((a, b) => a.name.localeCompare(b.name));
      },
      propertyAnalysis(pid) {
        const domId = dominantCycleId(pid); // the dominant cycle feeds the property summary
        if (domId) return cycleAnalysisOf(domId);
        return computeAnalysis(loadFormCells(pid));
      },
      getActive() { return { pid: D.activePid }; },
      setActive(pid) { if (D.props[pid]) D.activePid = pid; return Promise.resolve(); },
      createProperty(name, raMasterId) {
        assertNameFree(name);
        const pid = uuid();
        D.props[pid] = { id: pid, created_at: today(), updated_at: now(), durable: {}, percycle: {} };
        if (name) D.props[pid].durable['property.name'] = { value: String(name), source: 'database', saved_at: today() };
        if (raMasterId) D.props[pid].ra_property_code = String(raMasterId);
        // Read-only AUM prefill: seed cells from the master registry. Edits stay
        // on this RCS doc — nothing is ever written back to AUM.
        const a = aumFor(D.props[pid]);
        if (a) { const map = AUM_PREFILL(a); for (const k in map) if (map[k] !== '') place(D.props[pid], k, map[k], today()); }
        D.activePid = pid;
        pushSoon(pid);
        return { pid };
      },
      /* Binding, not creating. A record can predate the schedule — imported by
         hand, or named before the code existed — and then the schedule's own row
         has nowhere to land, so opening it tried to make a SECOND property under
         the same name and hit the one-name rule. Same building, so the code goes
         on the record. API PARITY with db.supabase.js. */
      setRaCode(pid, code) {
        const p = D.props[pid]; if (!p) return Promise.resolve();
        const c = String(code == null ? '' : code).trim();
        if (!c || String(p.ra_property_code || '') === c) return Promise.resolve();
        p.ra_property_code = c; p.updated_at = now();
        pushSoon(pid);   // buildDoc now carries ra_property_code
        return Promise.resolve();
      },
      renameProperty(pid, name) {
        const p = D.props[pid]; if (!p) return Promise.resolve();
        assertNameFree(name, pid);
        p.durable['property.name'] = { value: String(name), source: 'database', saved_at: today() }; touch(pid);
        return pushSoon(pid);
      },
      deleteProperty(pid) {
        delete D.props[pid]; delete D.letterheads[pid];
        if (D.activePid === pid) { const rest = Object.keys(D.props); D.activePid = rest.length ? rest[0] : null; }
        return enqueue(pid, () => api('/api/rcs/property-delete', { method: 'POST', body: JSON.stringify({ id: pid }) }));
      },
      loadForm(pid) { return loadFormCells(pid); },
      saveForm(pid, form) {
        const p = D.props[pid]; if (!p) throw new Error('no such property ' + pid);
  /* A save that carries property.name IS a rename — which is how the twins got
     in: a fresh property, an executed schedule uploaded, its parse applied, and
     the name it printed saved over whatever the property was called before.
     skipPid so a property saving its OWN name is not in its own way. */
        if (form && form['property.name']) assertNameFree(form['property.name'].value, pid);
        for (const k in form) place(p, k, (form[k] && form[k].value != null ? form[k].value : ''), today());
        touch(pid); return pushSoon(pid);
      },
      pruneUnitRows(pid, keepU, keepNR, keepLI, keepP) {
        const p = D.props[pid]; if (!p) return Promise.resolve();
        const ku = new Set((keepU || []).map(String)), kn = new Set((keepNR || []).map(String)), kl = new Set((keepLI || []).map(String)), kp = new Set((keepP || []).map(String));
        const uidx = k => { const r = k.slice(6); const d = r.indexOf('.'); return d > 0 ? r.slice(0, d) : null; };
        const nidx = k => { const r = k.slice(7); const d = r.indexOf('.'); return d > 0 ? r.slice(0, d) : null; };
        const lidx = k => { const r = k.slice(4); const d = r.indexOf('.'); return d > 0 ? r.slice(0, d) : null; };   // "ns8." is 4, not 6
        [p.durable, p.percycle].forEach(b => Object.keys(b).forEach(k => {
          if (k.indexOf('units.') === 0) { const i = uidx(k); if (i !== null && !ku.has(i)) delete b[k]; }
          else if (k.indexOf('nonrev.') === 0) { const i = nidx(k); if (i !== null && !kn.has(i)) delete b[k]; }
          else if (k.indexOf('ns8.') === 0) { const i = lidx(k); if (i !== null && !kl.has(i)) delete b[k]; }
          else if (keepP && k.indexOf('principals.') === 0) { const r = k.slice(11), d = r.indexOf('.'), i = d > 0 ? r.slice(0, d) : null; if (i !== null && !kp.has(i)) delete b[k]; }
        }));
        touch(pid); return pushSoon(pid);
      },
      getFlat(pid) { return merged(pid); },
      saveFlat(pid, map) { return _saveFlat(pid, map); },
      setLetterhead(pid, name, thumb, data) {
        const p = D.props[pid]; if (!p) return Promise.resolve();
        p.durable['assets.letterhead_name'] = { value: name || '', source: 'database', saved_at: today() };
        if (thumb !== undefined) p.durable['assets.letterhead_thumb'] = { value: thumb || '', source: 'database', saved_at: today() };
        if (data !== undefined) {
          p.durable['assets.letterhead_data'] = { value: data || '', source: 'database', saved_at: today() };
          D.letterheads[pid] = data || '';
        }
        touch(pid);
        // Chunked upload: ≤1.4MB per request (Cosmos 2MB doc cap + the server's
        // JSON body limit), serialized on the property queue.
        const CH = 1400000;
        const payload = (data !== undefined) ? (data || '') : (D.letterheads[pid] || '');
        const chunks = []; for (let i = 0; i < payload.length; i += CH) chunks.push(payload.slice(i, i + CH));
        const total = chunks.length;
        return enqueue(pid, async () => {
          if (total === 0) {
            await api('/api/rcs/letterhead', { method: 'POST', body: JSON.stringify({ pid, name: name || '', thumb: thumb || '', seq: 0, total: 0 }) });
            return;
          }
          for (let i = 0; i < total; i++) {
            await api('/api/rcs/letterhead', {
              method: 'POST',
              body: JSON.stringify({ pid, name: name || '', thumb: (i === total - 1 ? (thumb || '') : undefined), seq: i, total, chunk: chunks[i] }),
            });
          }
        });
      },
      getLetterhead(pid) {
        const p = D.props[pid]; if (!p) return { name: '', thumb: '', data: '' };
        return { name: dv(p, 'assets.letterhead_name'), thumb: dv(p, 'assets.letterhead_thumb'), data: dv(p, 'assets.letterhead_data') };
      },
      listContacts() { return (D.contacts || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))); },
      async addContact(c) {
        const id = uuid(); const rec = { id, name: (c && c.name) || '', email: (c && c.email) || '', phone: (c && c.phone) || '' };
        D.contacts.push(rec);
        await api('/api/rcs/contact', { method: 'POST', body: JSON.stringify({ op: 'upsert', collection: 'pm', rec }) });
        return id;
      },
      async updateContact(id, patch) {
        const c = (D.contacts || []).find(x => x.id === id); if (c) Object.assign(c, patch || {});
        await api('/api/rcs/contact', { method: 'POST', body: JSON.stringify({ op: 'upsert', collection: 'pm', rec: c || Object.assign({ id }, patch) }) });
      },
      async deleteContact(id) {
        D.contacts = (D.contacts || []).filter(x => x.id !== id);
        await api('/api/rcs/contact', { method: 'POST', body: JSON.stringify({ op: 'delete', collection: 'pm', id }) });
      },
      listDir(kind) { return (D.dir || []).filter(c => c.kind === kind).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))); },
      async addDir(kind, c) {
        const DIRF = ['name', 'email', 'phone', 'prefix', 'org', 'firm', 'title', 'addr_street', 'addr_city', 'addr_state', 'addr_zip'];
        const id = uuid(); const rec = { id, kind }; DIRF.forEach(f => rec[f] = (c && c[f]) || '');
        D.dir.push(rec);
        await api('/api/rcs/contact', { method: 'POST', body: JSON.stringify({ op: 'upsert', collection: 'dir', rec }) });
        return id;
      },
      async updateDir(id, patch) {
        const c = (D.dir || []).find(x => x.id === id); if (c) Object.assign(c, patch || {});
        await api('/api/rcs/contact', { method: 'POST', body: JSON.stringify({ op: 'upsert', collection: 'dir', rec: c || Object.assign({ id }, patch) }) });
      },
      async deleteDir(id) {
        D.dir = (D.dir || []).filter(x => x.id !== id);
        await api('/api/rcs/contact', { method: 'POST', body: JSON.stringify({ op: 'delete', collection: 'dir', id }) });
      },
      async clearAll() {
        /* Wipe the portfolio server-side, then reset the mirror. Reference and
           identity data (the HAP tracker, the AUM projection, the PM name)
           survive a portfolio wipe, matching db.supabase.js, which keeps D.hap /
           D.hapError / D.pmName. Letterheads belong to properties, so they go. */
        await api('/api/rcs/clear-all', { method: 'POST', body: JSON.stringify({}) });
        D = { props: {}, contacts: [], dir: [], activePid: null, cycles: {}, hap: D.hap, hapError: D.hapError, pmName: D.pmName, letterheads: {}, aum: D.aum };
      },
      /* ---- cycle surface (mirrors db.supabase.js) ---- */
      /* One package's score, for the launcher, which lists them all. */
      cycleScore(cid) { const c = D.cycles[cid];
        return c ? scoreOfCycle(c.property_id, cid) : { pct: 0, gate: 'profile', docsReady: 0, docsTotal: 0 }; },
      listCycles(pid) {
        const dom = dominantCycleId(pid);
        return cyclesOf(pid).map(c => ({ id: c.id, programs: (c.programs || '').split(',').filter(Boolean), label: c.label, effective_date: c.effective_date, generated: c.generated || {}, dominant: c.id === dom, created_at: c.created_at, updated_at: c.updated_at }))
          .sort((a, b) => ((b.dominant ? 1 : 0) - (a.dominant ? 1 : 0)) || cyCompare(D.cycles[a.id], D.cycles[b.id]));
      },
      dominantCycleId,
      cycleAnalysis(cid) { return cycleAnalysisOf(cid); },
      createCycle(pid, opts) {
        const p = D.props[pid]; if (!p) throw new Error('no property ' + pid);
        const o = opts || {}; const cid = uuid(); const cells = {};
        assertPackageFree(pid, o.effective_date, o.programs || ['rcs']);
        if (o.full) { const m = merged(pid); for (const k in m) { if (k === 'assets.letterhead_data') continue; cells[k] = { value: m[k].value, saved_at: m[k].saved_at || today(), origin: (m[k].origin || 'database'), pinned: !!m[k].pinned }; } }
        else {
          const domId = dominantCycleId(pid);
          const src = domId ? D.cycles[domId].cells : merged(pid);
            // A carried value is nobody's deliberate choice this cycle: origin 'carried', unpinned.
            for (const k in src) { if (cyNoCarry(k)) continue; const v = src[k].value; if (v == null || v === '') continue; cells[k] = { value: String(v), saved_at: today(), origin: 'carried', pinned: false }; }
          for (const k in p.durable) { if (!isTemplateKey(k)) continue; cells[k] = { value: p.durable[k].value, saved_at: today(), origin: 'database', pinned: false }; } // property record stays authoritative for identity
        }
        // The date picked when the package is created is a statement about this
        // package, so it lands in the form and outranks any date inherited from
        // the property record or the package it was built from.
        const effIn = String(o.effective_date || '').trim();
        if (effIn) { cells['rent_schedule.date_eff_source'] = { value: 'custom', saved_at: today() }; cells['rent_schedule.date_eff_custom'] = { value: effIn, saved_at: today() }; }
        D.cycles[cid] = { id: cid, property_id: pid, programs: (o.programs || ['rcs']).join(','), label: o.label || '', effective_date: cyISO(o.effective_date) || '', cells, generated: {}, rs_doc: {}, rcs_doc: {}, created_at: now(), updated_at: now() };
        if (o.full) cySyncEff(D.cycles[cid]);
        return enqueue('cy' + cid, () => pushCycle(cid)).then(() => ({ cid }));
      },
      deleteCycle(cid) {
        delete D.cycles[cid];
        return enqueue('cy' + cid, () => api('/api/rcs/cycle-delete', { method: 'POST', body: JSON.stringify({ id: cid }) }));
      },
      getFlatCycle(cid) {
        const c = D.cycles[cid]; if (!c) return {};
        const out = {}; for (const k in c.cells) { const v = c.cells[k].value == null ? '' : String(c.cells[k].value); out[k] = { value: v, source: v === '' ? 'new' : 'database', saved_at: c.cells[k].saved_at || '', origin: (c.cells[k].origin != null ? c.cells[k].origin : (v === '' ? null : 'database')), pinned: !!c.cells[k].pinned }; }
        return out;
      },
      cycleClosed(cid) { return cycleClosed(cid); },
      /* See db.js — same rule, same one-way override. The field is sent only when
         set, so a store that has not run the reopened_at migration keeps working
         for every package nobody has reopened. */
      reopenCycle(cid) { const c = D.cycles[cid]; if (!c) return Promise.resolve();
        c.reopened_at = now(); c.updated_at = now(); return enqueue('cy' + cid, () => pushCycle(cid)); },
      saveFlatCycle(cid, map) {
        const c = D.cycles[cid]; if (!c) throw new Error('no cycle ' + cid);
        assertCycleOpen(cid);
        for (const k in map) c.cells[k] = { value: (map[k] && map[k].value != null) ? String(map[k].value) : '', saved_at: (map[k] && map[k].saved_at) ? map[k].saved_at : today(), origin: (map[k] && map[k].origin != null) ? map[k].origin : null, pinned: !!(map[k] && map[k].pinned) };
        cySyncEff(c);
        c.updated_at = now();
        const jobs = [enqueue('cy' + cid, () => pushCycle(cid))];
        // dominant cycle: durable identity edits write through to the template
        if (dominantCycleId(c.property_id) === cid) {
          const dur = {}; let any = false;
          for (const k in map) if (isTemplateKey(k)) { dur[k] = map[k]; any = true; }
          if (any) jobs.push(_saveFlat(c.property_id, dur));
        }
        return Promise.all(jobs);
      },
      pruneCycleCells(cid, keepU, keepNR, keepLI, keepP) {
        // cycle twin of pruneUnitRows: deleted unit rows must leave the snapshot too
        const c = D.cycles[cid]; if (!c) return Promise.resolve();
        const ku = new Set((keepU || []).map(String)), kn = new Set((keepNR || []).map(String)), kl = new Set((keepLI || []).map(String)), kp = new Set((keepP || []).map(String));
        const idx = (k, plen) => { const r = k.slice(plen); const d = r.indexOf('.'); return d > 0 ? r.slice(0, d) : null; };
        Object.keys(c.cells).forEach(k => {
          if (k.indexOf('units.') === 0) { const i = idx(k, 6); if (i !== null && !ku.has(i)) delete c.cells[k]; }
          else if (k.indexOf('nonrev.') === 0) { const i = idx(k, 7); if (i !== null && !kn.has(i)) delete c.cells[k]; }
          else if (k.indexOf('ns8.') === 0) { const i = idx(k, 4); if (i !== null && !kl.has(i)) delete c.cells[k]; }
          else if (keepP && k.indexOf('principals.') === 0) { const i = idx(k, 11); if (i !== null && !kp.has(i)) delete c.cells[k]; }
        });
        c.updated_at = now();
        return enqueue('cy' + cid, () => pushCycle(cid));
      },
      setCyclePrograms(cid, programs) { const c = D.cycles[cid]; if (!c) return Promise.resolve(); assertCycleOpen(cid); assertPackageFree(c.property_id, c.effective_date, programs, cid); c.programs = (programs || []).join(','); c.updated_at = now(); return enqueue('cy' + cid, () => pushCycle(cid)); },
      /* The parsed executed rent schedule, kept with its package. Stores the
         reading, never the PDF bytes. */
      getCycleRs(cid) { const c = D.cycles[cid]; return (c && c.rs_doc) || {}; },
      setCycleRs(cid, doc) { const c = D.cycles[cid]; if (!c) return Promise.resolve(); c.rs_doc = doc || {}; c.updated_at = now(); return enqueue('cy' + cid, () => pushCycle(cid)); },
      getCycleRcs(cid) { const c = D.cycles[cid]; return (c && c.rcs_doc) || {}; },
      setCycleRcs(cid, doc) { const c = D.cycles[cid]; if (!c) return Promise.resolve(); c.rcs_doc = doc || {}; c.updated_at = now(); return enqueue('cy' + cid, () => pushCycle(cid)); },
      setCycleGenerated(cid, docs) { const c = D.cycles[cid]; if (!c) return Promise.resolve(); c.generated = { at: now(), docs: docs || [] }; c.updated_at = now(); return enqueue('cy' + cid, () => pushCycle(cid)); },
      /* ---- the HAP tracker + who is using the app -------------------- */
      hapRows: () => (D.hap || []).slice(),
      hapError: () => D.hapError || '',
      getPmName: () => D.pmName || '',
      async setPmName(name) {
        D.pmName = String(name || '');
        // the server identifies the signed-in user from the Easy Auth session
        await api('/api/rcs/pm-name', { method: 'POST', body: JSON.stringify({ pm_name: D.pmName }) });
      },
      propByRaCode(code) {
        const c = String(code == null ? '' : code);
        if (!c) return null;
        for (const id in D.props) if (String(D.props[id].ra_property_code || '') === c) return id;
        return null;
      },
      /* The other direction, which the RA seam needs on every render. */
      raCodeOfPid(pid) {
        const p = D.props[pid];
        return p ? (String(p.ra_property_code || '') || null) : null;
      },
      /* AUM prefill surface (read-only) */
      aumValue(pid, k) {
        // Per-cell AUM read for the RASource seam (same mapping as the create-time
        // prefill; read-only by construction).
        const a = aumFor(D.props[pid]); if (!a) return null;
        const v = AUM_PREFILL(a)[k];
        return (v === undefined || v === '') ? null : v;
      },
      aumIndex() {
        return (D.aum || []).map(a => ({
          raid: String(a.RAID || a.ra_master_id || ''), name: a.property_name || '',
          city: a.city || '', state: a.state || '', units: a.total_units || '',
        })).filter(a => a.raid && a.name).sort((a, b) => a.name.localeCompare(b.name));
      },
      computeAnalysis, computeSalutation,
    };
  })();
}
if (typeof module !== 'undefined') module.exports = { makeCosmosDb };
