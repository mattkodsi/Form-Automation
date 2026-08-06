/* db.js — multi-property store on a portable storage socket.
   ------------------------------------------------------------------------
   The "filing cabinet" behind the tool. Holds MANY properties; each property
   is ONE CURRENT RECORD — a durable bucket (per-property fields + unit
   structure + Part B profile + letterhead) plus a single per-cycle bucket
   (this submission's rents, UA, SAFMR, appraiser, checklist, dates). There is
   NO form history: loading a new RCS report + rent schedule overwrites the
   per-cycle values; durable data persists. Generate a package -> Box -> next
   cycle, reload new source docs and regenerate. Values are keyed cells with a
   source + save date, using the SAME flat keys the form UI already uses.

   Portability: the store talks to an async ADAPTER ({get,set,clear}). The
   browser plugs in a localStorage adapter; a future Node/SQLite/API build
   plugs in an adapter of the same shape — the public API and the UI never
   change. Each flat key maps to a v7 dictionary key + FIELD_HOME via CROSSWALK
   below, so extracting this JSON into the SQLite tables is a table lookup. */

/* ---- which flat keys are PER-CYCLE (everything else is durable) --------- */
function isPerCycleKey(k) {
  return /^units\.\d+\.(current|proposed|ua_exec|ua_rcs|ua_source|ua_reviewed|ua_custom|num_rcs|br_rcs|ba_rcs|num_source|num_reviewed|type_source|type_reviewed|safmr_rcs|safmr_hud|safmr_source|safmr_reviewed|safmr_custom|uac_[a-z]+)$/.test(k)
    || /^appr\./.test(k)
    || /^check\.\d+$/.test(k)
    || /^cycle\./.test(k)
    || (/^ocaf\./.test(k) && k !== 'ocaf.rate_type' && k !== 'ocaf.ds_annual') // debt-service defaults live on the template
    || /^uaf\./.test(k)
    || k === 'checklist.sign_date' || k === 'tenant.date_of_notice' || k === 'rent_schedule.date_rents_effective'
    || k === 'rent_schedule.date_eff_rs' || k === 'rent_schedule.date_eff_ra' || k === 'rent_schedule.date_eff_source' || k === 'rent_schedule.date_eff_custom';
}

/* ---- crosswalk: UI flat key -> v7 dictionary key + home (for extraction) -
   Consumed by tools that port this browser JSON into the SQLite schema; not
   used by the UI. Array keys carry {i} the unit index. */
const CROSSWALK = {
  'property.name': ['property.name', 'property.name'],
  'property.addr_street': ['property.address_street', 'property.address_street'],
  'property.addr_city': ['property.address_city', 'property.address_city'],
  'property.addr_state': ['property.address_state', 'property.address_state'],
  'property.addr_zip': ['property.address_zip', 'property.address_zip'],
  'property.fha': ['property.fha_no', 'property.fha_no'],
  'property.s8': ['property.fha_section8_no', 'property.fha_section8_no'],
  'owner.entity_name': ['owner.entity_name', 'property.entity_name'],
  'owner.entity_type': ['owner.entity_type', 'property.entity_type'],
  'owner.entity_type_other': ['owner.entity_type_other', 'property.entity_type_other'],
  'owner.gp': ['owner.general_partner', 'property.general_partner'],
  'poc.name': ['owner_poc.name', 'property.owner_poc_name'],
  'poc.phone': ['owner_poc.phone', 'property.owner_poc_phone'],
  'poc.email': ['owner_poc.email', 'property.owner_poc_email'],
  'sig.name': ['signatory.name', 'property.signatory_name'],
  'sig.title': ['signatory.title', 'property.signatory_title'],
  'sig.principal': ['signatory.principal', 'property.signatory_principal'],
  'ca.org': ['ca.org', 'property.ca_org'],
  'ca.prefix': ['ca.contact_prefix', 'property.ca_contact_prefix'],
  'ca.name': ['ca.contact_name', 'property.ca_contact_name'],
  'ca.position': ['ca.contact_title', 'property.ca_contact_title'],
  'ca.addr_street': ['ca.address_street', 'property.ca_address_street'],
  'ca.addr_city': ['ca.address_city', 'property.ca_address_city'],
  'ca.addr_state': ['ca.address_state', 'property.ca_address_state'],
  'ca.addr_zip': ['ca.address_zip', 'property.ca_address_zip'],
  'tenant.sender_name': ['tenant.sender_name', 'property.tenant_sender_name'],
  'tenant.sender_title': ['tenant.sender_title', 'property.tenant_sender_title'],
  'tenant.mgmt_source': ['tenant.mgmt_source', 'property.tenant_mgmt_source'],
  'tenant.mgmt_street': ['tenant.mgmt_address_street', 'property.tenant_mgmt_address_street'],
  'tenant.mgmt_city': ['tenant.mgmt_address_city', 'property.tenant_mgmt_address_city'],
  'tenant.mgmt_state': ['tenant.mgmt_address_state', 'property.tenant_mgmt_address_state'],
  'tenant.mgmt_zip': ['tenant.mgmt_address_zip', 'property.tenant_mgmt_address_zip'],
  'tenant.property_alias': ['tenant.property_alias', 'property.tenant_alias_name'],
  'assets.letterhead_name': ['assets.letterhead', 'property.letterhead_asset'],
  'appr.firm': ['study.appraiser_firm', 'submission.appraiser_firm'],
  'appr.name': ['study.appraiser_name', 'submission.appraiser_name'],
  'appr.email': ['study.appraiser_email', 'submission.appraiser_email'],
  'appr.phone': ['study.appraiser_phone', 'submission.appraiser_phone'],
  'units.{i}.br': ['units[].bedrooms', 'unit_type.bedrooms'],
  'units.{i}.ba': ['units[].bathrooms', 'unit_type.bathrooms'],
  'units.{i}.label': ['units[].label', 'unit_type.label'],   // free text, whatever the schedule prints after the counts
  'units.{i}.num_units': ['units[].num_units', 'unit_type.num_units'],
  'units.{i}.current': ['units[].current_contract_rent', 'unit_cycle_value.current_contract_rent'],
  'units.{i}.proposed': ['units[].proposed_contract_rent', 'unit_cycle_value.proposed_contract_rent'],
  'units.{i}.ua_exec': ['units[].ua_from_exec_rs', 'unit_cycle_value.ua_from_exec_rs'],
  'units.{i}.ua_rcs': ['units[].ua_from_rcs', 'unit_cycle_value.ua_from_rcs'],
  'units.{i}.safmr_hud': ['units[].safmr_from_hud', 'unit_cycle_value.safmr_from_hud'],
  'units.{i}.safmr_rcs': ['units[].safmr_from_rcs', 'unit_cycle_value.safmr_from_rcs'],
  'check.{i}': ['checklist.items[17]', 'checklist_item.checked'],
  'nonrev.{i}.use': ['units[].nonrev_use', 'unit_type.nonrev_use'],
  'nonrev.{i}.rent': ['units[].nonrev_rent', 'unit_type.nonrev_rent'],
};

/* ---- directory (appraiser / CA / signatory) field set, mirrors db.supabase.js */
const DIRF = ['name', 'email', 'phone', 'prefix', 'org', 'firm', 'title', 'addr_street', 'addr_city', 'addr_state', 'addr_zip'];

/* ---- number + computed helpers (shared by the form and the menu) -------- */
function num(v) { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; }

function unitIndices(form) {
  const s = new Set();
  Object.keys(form).forEach(k => { const m = k.match(/^units\.(\d+)\./); if (m) s.add(+m[1]); });
  return [...s].sort((a, b) => a - b);
}

/** The internal 150% SAFMR analysis — unit-weighted portfolio economics.
    Reads the SAME flat form the UI uses, so the menu and the command center
    never diverge. */
function safmrResolvedFrom(val, i) {
  const sh = num(val('units.' + i + '.safmr_hud')), sr = num(val('units.' + i + '.safmr_rcs'));
  const src = val('units.' + i + '.safmr_source') || (sh > 0 ? 'hud' : (sr > 0 ? 'rcs' : 'custom'));
  if (src === 'custom') return num(val('units.' + i + '.safmr_custom'));
  return src === 'rcs' ? (sr || sh) : (sh || sr); // HUD trumps by default
}
function computeAnalysis(form) {
  const val = k => (form[k] ? form[k].value : '');
  const units = unitIndices(form);
  // cgC/pgC mirror cg/pg but only over the types that carry BOTH a current and a
  // proposed rent — the same comparable set sc/sp/nd use. The monthly and annual
  // deltas must come from that set: taken over every type, an unpriced type
  // contributes its current rent as pure loss, which is how a property with no
  // proposed rents yet reported "+0% increase" beside "-$2.6M annualized".
  let cg = 0, pg = 0, tot = 0, sc = 0, sp = 0, nd = 0, cgC = 0, pgC = 0, ceilC = 0, tTot = 0, tPr = 0, ceil = 0, safmrMissing = false, safmrOver = 0;
  units.forEach(i => {
    const n = num(val('units.' + i + '.num_units')), cur = num(val('units.' + i + '.current')), pro = num(val('units.' + i + '.proposed'));
    const ue = num(val('units.' + i + '.ua_exec')), ur = num(val('units.' + i + '.ua_rcs'));
    const usrc = val('units.' + i + '.ua_source') || (ue > 0 ? 'exec' : (ur > 0 ? 'rcs' : 'custom'));
    const ua = usrc === 'rcs' ? num(val('units.' + i + '.ua_rcs')) : (usrc === 'custom' ? num(val('units.' + i + '.ua_custom')) : num(val('units.' + i + '.ua_exec')));
    const safmr = safmrResolvedFrom(val, i);
    cg += (cur + ua) * n; pg += (pro + ua) * n; tot += n;
    if (safmr > 0) { ceil += safmr * n; if (pro > 0 && pro >= safmr) safmrOver++; } else if (n > 0) safmrMissing = true; // safmr = the 150% SAFMR ceiling per unit, entered/parsed directly (future HUD API pull must x1.5 its base value); per-type over when net proposed >= it
    if (n > 0) tTot++;
    if (cur > 0 && pro > 0) { sc += cur * n; sp += pro * n; nd += n; cgC += (cur + ua) * n; pgC += (pro + ua) * n; if (safmr > 0) ceilC += safmr * n; if (n > 0) tPr++; }
  });
  return {
    current_gpr: cg, proposed_gpr: pg, ceiling: ceil, headroom: ceil - pg, pass: (ceil > 0 && pg < ceil), safmr_missing: safmrMissing, safmr_over: safmrOver,
    total_units: tot, pct: sc ? Math.round((sp - sc) / sc * 100) : 0, per_unit: nd ? (sp - sc) / nd : 0,
    priced: nd, delta_mo: pgC - cgC, delta_yr: (pgC - cgC) * 12,
    cg_priced: cgC, pg_priced: pgC, ceil_priced: ceilC, types_total: tTot, types_priced: tPr,
  };
}

/** ca.contact_salutation — "Dear " + prefix + last token of the contact name. */
function computeSalutation(form) {
  const name = form['ca.name'] ? String(form['ca.name'].value || '') : '';
  const prefix = form['ca.prefix'] ? String(form['ca.prefix'].value || '') : '';
  if (!name.trim()) return '';
  const last = name.trim().split(/\s+/).pop();
  return 'Dear ' + (prefix ? prefix + ' ' : '') + last;
}

/* ---- Riverside Gardens seed (the worked sample; also the first-run demo row) --- */
function gatesSeedFlat() {
  const f = {
    'property.name': 'Riverside Gardens Apartments',
    'property.addr_street': '100 Main Street', 'property.addr_city': 'Wilmette',
    'property.addr_state': 'IL', 'property.addr_zip': '60091', 'property.s8': 'IL00X000000',
    'owner.entity_name': 'Riverside Gardens Preservation, L.P.', 'owner.entity_type': 'Limited Partnership',
    'poc.name': 'Jordan Doe', 'poc.email': 'jdoe@example.com', 'poc.phone': '(929) 618-8405',
    'owner.gp': 'Related (GP)', 'sig.name': 'Alex Morgan', 'sig.title': 'Vice President',
    /* Part G. The HUD-92458 does not ask for the principals, it instructs:
       "List all Principals Comprising Mortgagor Entity". This seed exists to be a
       record whose rent schedule CAN be written, so it has to carry one. */
    'principals.0.name': 'Alex Morgan', 'principals.0.title': 'Vice President',
    'ca.org': 'Regional Housing Agency', 'ca.prefix': 'Ms.', 'ca.name': 'Sam Rivera', 'ca.position': 'Asset Manager',
    'ca.addr_street': '200 Center Street, Suite 310', 'ca.addr_city': 'Tucker', 'ca.addr_state': 'GA', 'ca.addr_zip': '30084-5860',
    'appr.firm': 'Belfry Valuation', 'appr.name': 'Taylor Reed', 'appr.email': 'appraiser@example.com', 'appr.phone': '(708) 500-2380',
    'units.0.br': '1BR', 'units.0.ba': '1BA', 'units.0.num_units': '51', 'units.0.current': '1903', 'units.0.proposed': '2725',
    'units.0.ua_exec': '31', 'units.0.ua_rcs': '31', 'units.0.ua_source': 'exec', 'units.0.ua_reviewed': '', 'units.0.ua_custom': '', 'rent_schedule.date_rents_effective': '2026-09-01', 'rent_schedule.date_eff_rs': '2026-09-01', 'rent_schedule.date_eff_source': 'rs', 'rent_schedule.date_eff_custom': '',
    'units.0.safmr_rcs': '3435', 'units.0.safmr_hud': '3495', 'units.0.safmr_source': 'hud', 'units.0.safmr_reviewed': '',
    'tenant.sender_name': 'Jordan Lee', 'tenant.sender_title': 'Community Manager',
    'tenant.mgmt_street': '', 'tenant.mgmt_city': '', 'tenant.mgmt_state': '', 'tenant.mgmt_zip': '', 'tenant.mgmt_source': 'property',
  };
  const eqOn = { 0: 1, 1: 1, 2: 1, 5: 1 };      // Range, Refrigerator, Air Conditioner, Carpet
  for (let i = 0; i < 7; i++) f['partb.equipment.' + i] = eqOn[i] ? '1' : '';
  const utOn = { 0: 1, 2: 1, 3: 1 };            // Heating, Hot Water, Cooking
  const utFuel = { 0: 'G', 1: '', 2: 'G', 3: 'G', 4: '' };
  for (let i = 0; i < 5; i++) { f['partb.utilities.' + i] = utOn[i] ? '1' : ''; f['partb.fuel.' + i] = utFuel[i]; }
  const svOn = {};                               // none fixed; write-ins below
  for (let i = 0; i < 6; i++) f['partb.services.' + i] = svOn[i] ? '1' : '';
  ['e1', 'e2', 'e3', 'e4', 'e5', 'u1', 's1', 's2', 's3', 's4', 's5', 's6'].forEach(id => { f['partb.writein.' + id] = ''; f['partb.writein.' + id + '.on'] = ''; });
  f['partb.writein.e1'] = 'Microwave'; f['partb.writein.e1.on'] = '1';         // equipment write-ins
  f['partb.writein.e2'] = 'Mini Blinds'; f['partb.writein.e2.on'] = '1';
  f['partb.writein.s1'] = 'Fitness Center'; f['partb.writein.s1.on'] = '1';    // service write-ins
  f['partb.writein.s2'] = 'Community RM'; f['partb.writein.s2.on'] = '1';
  f['partb.writein.u1.fuel'] = '';
  for (let i = 0; i < 17; i++) f['check.' + i] = (i === 2 || i === 4) ? '' : '1';
  return f;
}

/* ---- migrate an older store shape (cycles[]) to the single-record shape -- */
function migrate(D) {
  if (!D || !D.props) return D;
  Object.values(D.props).forEach(p => {
    if (!p.durable) p.durable = {};
    if (p.cycles && !p.percycle) {
      const order = p.cycleOrder && p.cycleOrder.length ? p.cycleOrder : Object.keys(p.cycles);
      const last = order[order.length - 1];
      const cells = (last && p.cycles[last] && p.cycles[last].cells) || {};
      p.percycle = {};
      for (const k in cells) p.percycle[k] = cells[k];
    }
    if (!p.percycle) p.percycle = {};
    delete p.cycles; delete p.cycleOrder;
    const _b=p.durable||{}; const _mv=(from,slots)=>{ const c=_b['partb.writein.'+from]; if(c&&c.value){ const slot=slots.find(s=>!(_b['partb.writein.'+s]&&_b['partb.writein.'+s].value)); if(slot){ _b['partb.writein.'+slot]=c; if(_b['partb.writein.'+from+'.on'])_b['partb.writein.'+slot+'.on']=_b['partb.writein.'+from+'.on']; } } delete _b['partb.writein.'+from]; delete _b['partb.writein.'+from+'.on']; };
    _mv('microwave',['e1','e2','e3','e4','e5']); _mv('elevator',['s1','s2','s3','s4','s5','s6']);
  });
  if (D.meta) { delete D.meta.activeSid; }
  D.v = 2;
  return D;
}

/* ======================================================================== */
async function makeDb(adapter, opts) {
  opts = opts || {};
  const today = () => new Date().toISOString().slice(0, 10);
  const now = () => new Date().toISOString();
  const freshDb = () => ({ v: 2, meta: { seq: 0, activePid: null, contacts: [] }, props: {}, cycles: {}, dir: [] });

  let D = await adapter.get();
  const _needSeed = !D || !D.props;
  if (_needSeed) D = freshDb();
  else migrate(D);
  if (!D.meta) D.meta = { seq: 0, activePid: null }; if (!D.meta.contacts) D.meta.contacts = [];
  if (!D.meta.hap) D.meta.hap = []; if (D.meta.pmName == null) D.meta.pmName = '';
  if (!D.cycles) D.cycles = {}; if (!D.dir) D.dir = [];   // a blob written before cycles existed

  function nid(pre) { D.meta.seq = (D.meta.seq || 0) + 1; return pre + D.meta.seq; }
  const persist = () => adapter.set(D);
  const touch = pid => { if (D.props[pid]) D.props[pid].updated_at = now(); };
  const cell = v => ({ value: (v == null ? '' : String(v)), source: 'database', saved_at: today() });

  function _createProperty(name, raMasterId) {
    const pid = nid('p');
    D.props[pid] = { id: pid, created_at: today(), updated_at: now(), durable: {}, percycle: {} };
    if (name) D.props[pid].durable['property.name'] = cell(name);
    // New-property checklist default is applied at the FORM layer (app.js applyChecklistDefaults)
    // as source 'new' (gray/unsaved), NOT seeded here as 'database' (which would render blue).
    if (raMasterId) D.props[pid].ra_property_code = String(raMasterId);
    D.meta.activePid = pid;
    return { pid };
  }

  function seedGates() {
    const { pid } = _createProperty(null);
    const flat = gatesSeedFlat();
    const p = D.props[pid];
    for (const k in flat) { const c = cell(flat[k]); if (isPerCycleKey(k)) p.percycle[k] = c; else p.durable[k] = c; }
    return pid;
  }

  /* ---- form <-> store mapping (durable + per-cycle, merged) ------------- */
  function bucketsOf(pid) { const p = D.props[pid]; return p ? Object.assign({}, p.durable, p.percycle) : {}; }

  function loadForm(pid) {
    const p = D.props[pid]; if (!p) return {};
    const merged = bucketsOf(pid);
    const form = {};
    for (const k in merged) {
      const c = merged[k];
      const v = c ? c.value : '';
      const has = v !== '' && v != null;
      form[k] = { value: (v == null ? '' : v), source: has ? 'database' : 'new', saved_at: c ? c.saved_at : null, prior_value: null, prior_source: null, db_value: has ? v : (c ? '' : null) };
    }
    return form;
  }

  function saveForm(pid, form) {
    const p = D.props[pid]; if (!p) throw new Error('no such property ' + pid);
  /* A save that carries property.name IS a rename — which is how the twins got
     in: a fresh property, an executed schedule uploaded, its parse applied, and
     the name it printed saved over whatever the property was called before.
     skipPid so a property saving its OWN name is not in its own way. */
    if (form && form['property.name']) assertNameFree(form['property.name'].value, pid);
    for (const k in form) {
      const v = form[k].value;
      const c = { value: (v == null ? '' : String(v)), source: 'database', saved_at: today() };
      if (isPerCycleKey(k)) p.percycle[k] = c; else p.durable[k] = c;
    }
    touch(pid);
    return persist();
  }

  /* ---- property registry ------------------------------------------------ */
  const dv = (p, k) => (p.durable[k] && p.durable[k].value !== '' ? p.durable[k].value : '');

  /* One property, one name — enforced here, where every caller passes.

     The dialog has asked existingPropByName() since 2026-07-24 and opens the
     twin rather than making a second one. But a courtesy only guards the path
     that remembers it, and three routes never did: creating a property with no
     name and naming it afterwards, renaming one onto a name already taken, and
     a plain save of property.name — which is exactly what applying an executed
     schedule's parse does. The live record grew three "Sample Property"s and three
     "Sample Property"s with that dialog check in place the whole time.

     So the rule lives in the data layer and the dialog keeps the courtesy:
     callers that ask first still open the existing profile and never see this
     throw. Case- and space-insensitive, because "Sample Property" and "beacon
     hill " are the same building. */
  const nameKey = s => String(s == null ? '' : s).trim().toLowerCase();
  const propByName = (name, skipPid) => {
    const k = nameKey(name); if (!k) return null;
    for (const id in D.props) { if (id === skipPid) continue; if (nameKey(dv(D.props[id], 'property.name')) === k) return D.props[id]; }
    return null;
  };
  const assertNameFree = (name, skipPid) => {
    const clash = propByName(name, skipPid); if (!clash) return;
    const e = new Error('A property named \u201c' + String(name).trim() + '\u201d already exists.');
    e.code = 'DUP_PROPERTY_NAME'; e.pid = clash.id; e.dupName = String(name).trim(); throw e;
  };
  /* The ring is the DOMINANT PACKAGE's score — see score.js. It used to be ten
     durable keys, counted, which is why a property could read 100% with the
     draft rent schedule and the tenant notice unbuildable: those ten were never
     reconciled with what a document needs. The form, the menu and the launcher
     now all read one computation. */
  const SCORE = (typeof window !== 'undefined' && window.RCSScore) ? window.RCSScore
    : (typeof require !== 'undefined' ? require('./score.js') : null);
  /* Reading the dominant cycle, falling back to the template. A cycle that HOLDS
     a key answers for it even when the value is blank — the package is what was
     frozen, not the template underneath it. */
  function scoreRead(pid, cid) {
    const domId = cid === undefined ? dominantCycleId(pid) : cid;
    const cells = domId && D.cycles[domId] ? D.cycles[domId].cells : null;
    /* With no package yet, the template IS what would be scored — and the
       template is BOTH buckets. Reading p.durable alone left the appraiser, the
       rents and every other per-cycle key invisible, so the menu scored a
       property lower than the form it opens. */
    const base = bucketsOf(pid);
    return k => {
      if (cells && Object.prototype.hasOwnProperty.call(cells, k)) { const v = cells[k].value; return v == null ? '' : String(v); }
      const d = base[k]; const v = d ? d.value : '';
      return v == null ? '' : String(v);
    };
  }
  /* Scored for ONE package, not for the property. The launcher lists every package
     a property has and each is at a different point; scoring only the dominant
     cycle left the rest with nothing to say but "Draft", which is not a fact about
     how far along anything is. Matt: "the generated tag tells you NOTHING." Same
     arithmetic, same tables, one argument more. */
  function scoreOfCycle(pid, cid) {
    const p = D.props[pid]; if (!p || !SCORE) return { pct: 0, gate: 'profile', docsReady: 0, docsTotal: 0 };
    const domId = cid; const cy = domId ? D.cycles[domId] : null;
    const u = new Set(), pr = new Set();
    /* Principals ride along with the unit scan: Part G of the HUD-92458 requires
       them, so the score has to see them from the menu and the launcher too, not
       only with a form open. */
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
  function unitCountOf(p) {
    const idx = new Set(); Object.keys(p.durable).forEach(k => { const m = k.match(/^units\.(\d+)\.num_units$/); if (m && p.durable[k].value !== '') idx.add(m[1]); });
    let total = 0; idx.forEach(i => total += num(p.durable['units.' + i + '.num_units'].value)); return { types: idx.size, units: total };
  }

  /* ---- cycles: one row = a complete frozen snapshot -----------------------
     Ported from db.supabase.js so this stand-in answers the same questions the
     real backend does. Kept deliberately line-for-line with that file: the
     programs list is stored comma-JOINED here too, so cyCompare reads it
     identically and a cycle cannot rank differently depending on which layer
     the app happened to boot on.

     Template stamp copies only durable IDENTITY keys; unit rows, Part B,
     checklist, and assets stay per-cycle / property-level respectively. */
  const isTemplateKey = k => !isPerCycleKey(k) && !/^(units|ns8|nonrev|partb|check|assets|principals)\./.test(k) && k !== 'ns8.enabled' && k !== 'nonrev.enabled';
  /* What does NOT carry from the prevailing cycle into a NEW cycle: each
     cycle's own outcomes (proposed rents), its year's factors, its dates, and
     its appraiser. Everything else pre-fills so a new cycle starts from the
     property's current reality. */
  /* Three things looked like the property's current reality and are not.
     What LAST year's study read (br_rcs, ba_rcs, num_rcs, ua_rcs) is offered
     in this year's menus as though a study had been uploaded. What HUD
     published for last year (the SAFMR ceilings) is restated annually and
     decides the 150% test. And a _reviewed flag records a person accepting a
     conflict between two numbers that are no longer the numbers in front of
     them. The owner's checklist goes the same way: it is signed per package.

     Current rents and utility allowances never carry, on any programme.
     They were dropped on RCS years only, on the reasoning that an OCAF year
     has no executed schedule to upload and last year's figures are the best
     starting point. Both halves were wrong. Nothing in the app ever rolls
     proposed into current, so an OCAF built from an OCAF inherited a rent one
     full cycle stale and computed this year's factor against it. And rolling
     proposed forward would not have fixed it: what took effect is whatever the
     CA returned after the owner submitted, and the only record of that is the
     executed schedule. A figure we cannot observe must not arrive wearing the
     colour of saved truth. The column starts empty and the schedule fills it.

     Still pre-filled either way: unit mix, Part B, non-S8 and non-revenue
     rows, debt service, and everything about the property itself. */
  const cyNoCarry = (k) => /^units\.\d+\.proposed$/.test(k)
    || /^units\.\d+\.(current|ua_exec|ua_source|ua_custom)$/.test(k)
    || /^units\.\d+\.(br_rcs|ba_rcs|num_rcs|ua_rcs)$/.test(k)
    || /^units\.\d+\.safmr_(hud|rcs|source|custom)$/.test(k)
    || /^units\.\d+\.(ua|safmr|num|type)_reviewed$/.test(k)
    || /^units\.\d+\.uac_[a-z]+$/.test(k)
    || /^check\.\d+$/.test(k)
    /* The appraiser no longer carries (Matt, 2026-08-05, reversing 2026-07-30).
       It is re-read from the study each cycle. A stale appraiser name on the
       transmittal letter is exactly the silent wrong a fresh study corrects; the
       firm coming back is a five-field re-entry, not a licence to guess. */
    || /^appr\./.test(k)
    || /^nonrev\.\d+\.rent$/.test(k)   /* a contract rent is a contract rent, whoever lives there */
    || /^ocaf\.(factor_|ds_t12$|ds_f12$)/.test(k)
    || /^uaf\./.test(k)
    || /^rent_schedule\./.test(k)
    || /^cycle\./.test(k)
    || k === 'checklist.sign_date' || k === 'tenant.date_of_notice'
    || k === 'assets.letterhead_data';
  /* cycle hierarchy: year first, then full date, then newest.
     Programme completeness used to break the tie between the two — RCS+UAF over
     RCS over OCAF+UAF and so on. That ranking existed to choose between two
     packages sharing one effective date, and one date now holds exactly one
     package (assertPackageFree), so the tie it settled cannot occur. Across two
     DATES it was actively wrong: it let a September OCAF+UAF outrank a December
     OCAF, which is the older package winning on the strength of its contents. */
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
     API PARITY with db.supabase.js — same rule, same error codes, same fields.

     A property files ONE package per effective date. RCS, OCAF and UAF are that
     package's CONTENTS, not three kinds of package. The utility allowance rides
     on the rent action's own date (CYCLES-OCAF-UAF-DESIGN.md:128 — a factor UAF
     is deterministic, so it runs concurrently), which means doing the UA "first"
     is a statement about when it is SENT, not about when it takes effect.
     Generation records that per document; the record itself stays one.

     This replaced one-package-per-PROGRAMME-per-date, under which a date could
     hold {ocaf} and {uaf} as two rows — and the programme pill, which writes
     through setCyclePrograms, could then put uaf on BOTH of them, because that
     write was never guarded at all. The collision is gone because the second row
     is.

     Sample Property (90111) is untouched: its two 2026 OCAFs are two DATES
     (09-01 and 12-06). The rule is per date, never per year.

     Undated packages are not guarded — there is no key to be unique against.
     Same-date pairs created before this rule are TOLERATED, not migrated: they
     stay readable and openable, and only new writes are constrained. Every error
     carries the cid already holding the date, so the caller opens that one
     instead of reporting a failure. */
  const PROGS_OF = c => String((c && c.programs) || '')
    .split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  /* ---- a filed package is history ----
     A package is CLOSED once its effective date has passed. That is the moment
     the rents it sets are the rents in force and the schedule's next entry takes
     over as the one being worked on — the same moment it stops being Current on
     the property page and drops into "Earlier".

     Keyed on the date rather than on "a later package exists", because a later
     one exists as soon as somebody STARTS it, which can happen while the current
     one is still being finished. A date cannot be raced.

     Read-only enforced by a UI flag is not enforced: the form has some 110
     controls and the Enter and Escape handlers behind them, and one that missed
     the flag would write silently into a package whose documents have already
     gone to the CA. The invariant belongs to the operation (FORM-RULES 17), so
     it sits on the write. The form can then be shown inert without that being
     the thing keeping it safe.

     Deliberately NOT blocked: deleteCycle (removing a mistaken package is a
     different act from editing a filed one) and setCycleGenerated (re-downloading
     what was filed changes nothing about the record).
     API PARITY with db.supabase.js. */
  const cycleClosed = cid => {
    const c = D.cycles[cid]; if (!c) return false;
    if (c.reopened_at) return false;   // somebody deliberately said otherwise
    const eff = cyISO(c.effective_date); if (!eff) return false;
    return eff < today();
  };
  const assertCycleOpen = cid => {
    if (!cycleClosed(cid)) return;
    const c = D.cycles[cid];
    const e = new Error('These rents took effect on ' + cyISO(c.effective_date) + '. A package is history once its date has passed \u2014 reopen it if it genuinely still needs work.');
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
  /* The menu card reads the CURRENT cycle, not the template — same rule as the
     backend, so a property's unit count does not change when the app is booted
     against this layer instead. */
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

  /* saveFlat as a plain function: saveFlatCycle writes identity edits through
     to the template and must not depend on how the caller bound `this`. */
  function _saveFlat(pid, map) {
    const p = D.props[pid]; if (!p) throw new Error('no property ' + pid);
    if (map && map['property.name']) assertNameFree(map['property.name'].value, pid);
    for (const k in map) {
      const c = { value: (map[k] && map[k].value != null ? String(map[k].value) : ''), source: 'database', saved_at: (map[k] && map[k].saved_at) ? map[k].saved_at : today() };
      if (isPerCycleKey(k)) p.percycle[k] = c; else p.durable[k] = c;
    }
    touch(pid); return persist();
  }

  function listProperties() {
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
  }

  /** One property's headline analysis, for the launcher summary. */
  function propertyAnalysis(pid) { const domId = dominantCycleId(pid); if (domId) return cycleAnalysisOf(domId); return computeAnalysis(loadForm(pid)); }

  if (_needSeed) { if (opts.seed !== false) { seedGates(); D.meta.contacts = [{ id: 'k1', name: 'Jordan Doe', email: 'jdoe@example.com', phone: '(929) 618-8405' }]; } await adapter.set(D); }
  else if (opts && opts.persistMigration !== false) { await adapter.set(D); }

  return {
    _raw: () => D,
    today,
    listProperties, propertyAnalysis,
    getActive() { return { pid: D.meta.activePid }; },
    setActive(pid) { if (D.props[pid]) D.meta.activePid = pid; return Promise.resolve(); }, // pointer only; nav must not write (real saves persist it)
    createProperty(name, raMasterId) { assertNameFree(name); const r = _createProperty(name || '', raMasterId); persist(); return r; },
    /* API PARITY with db.supabase.js. Binding, not creating: a record can
       predate the schedule, and then opening its tracker row tried to make a
       SECOND property under the same name and hit the one-name rule. */
    setRaCode(pid, code) { const p = D.props[pid]; if (!p) return;
      const c = String(code == null ? '' : code).trim();
      if (!c || String(p.ra_property_code || '') === c) return;
      p.ra_property_code = c; touch(pid); return persist(); },
    renameProperty(pid, name) { const p = D.props[pid]; if (!p) return; assertNameFree(name, pid); p.durable['property.name'] = cell(name); touch(pid); return persist(); },
    deleteProperty(pid) {
      delete D.props[pid];
      if (D.meta.activePid === pid) { const rest = Object.keys(D.props); D.meta.activePid = rest.length ? rest[0] : null; }
      return persist();
    },
    loadForm, saveForm,
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
      touch(pid); return persist();
    },
    getFlat(pid) { return bucketsOf(pid); },
    saveFlat: _saveFlat,
    /** Letterhead — a permanent per-property durable asset (name + UI thumbnail + print-quality PNG). */
    setLetterhead(pid, name, thumb, data) {
      const p = D.props[pid]; if (!p) return;
      p.durable['assets.letterhead_name'] = cell(name || '');
      if (thumb !== undefined) p.durable['assets.letterhead_thumb'] = cell(thumb || '');
      if (data !== undefined) p.durable['assets.letterhead_data'] = cell(data || '');
      touch(pid); return persist();
    },
    getLetterhead(pid) {
      const p = D.props[pid]; if (!p) return { name: '', thumb: '', data: '' };
      return { name: dv(p, 'assets.letterhead_name'), thumb: dv(p, 'assets.letterhead_thumb'), data: dv(p, 'assets.letterhead_data') };
    },
    listContacts() { return (D.meta.contacts || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))); },
    async addContact(c) { D.meta.contacts = D.meta.contacts || []; const id = nid('k'); D.meta.contacts.push({ id, name: (c && c.name) || '', email: (c && c.email) || '', phone: (c && c.phone) || '' }); await persist(); return id; },
    updateContact(id, patch) { const c = (D.meta.contacts || []).find(x => x.id === id); if (c) Object.assign(c, patch || {}); return persist(); },
    deleteContact(id) { D.meta.contacts = (D.meta.contacts || []).filter(x => x.id !== id); return persist(); },
    listDir(kind) { return (D.dir || []).filter(c => c.kind === kind).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))); },
    async addDir(kind, c) { D.dir = D.dir || []; const id = nid('d'); const rec = { id, kind }; DIRF.forEach(f => rec[f] = (c && c[f]) || ''); D.dir.push(rec); await persist(); return id; },
    updateDir(id, patch) { const c = (D.dir || []).find(x => x.id === id); if (c) Object.assign(c, patch || {}); return persist(); },
    deleteDir(id) { D.dir = (D.dir || []).filter(x => x.id !== id); return persist(); },
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
    cycleClosed(cid) { return cycleClosed(cid); },
    /* The override. A package locks on its effective date, and HUD's effective
       date is when rents take force, not when the paperwork stops — so a package
       still being corrected with the CA after its date has to have a way back.
       Persisted, not per-session: reopening is a decision, not a mood.
       It is deliberately one-way. Re-locking would be a second control for a
       state the date already answers. */
    reopenCycle(cid) { const c = D.cycles[cid]; if (!c) return Promise.resolve();
      c.reopened_at = now(); c.updated_at = now(); return persist(); },
    createCycle(pid, opts) {
      const p = D.props[pid]; if (!p) throw new Error('no property ' + pid);
      const o = opts || {}; const cid = nid('cy'); const cells = {};
      assertPackageFree(pid, o.effective_date, o.programs || ['rcs']);
      if (o.full) { const m = bucketsOf(pid); for (const k in m) { if (k === 'assets.letterhead_data') continue; cells[k] = { value: m[k].value, saved_at: m[k].saved_at || today(), origin: (m[k].origin || 'database'), pinned: !!m[k].pinned }; } }
      else {
        const domId = dominantCycleId(pid);
        const src = domId ? D.cycles[domId].cells : bucketsOf(pid);
          // A carried value is nobody's deliberate choice this cycle: origin 'carried', unpinned.
          for (const k in src) { if (cyNoCarry(k)) continue; const v = src[k].value; if (v == null || v === '') continue; cells[k] = { value: String(v), saved_at: today(), origin: 'carried', pinned: false }; }
        for (const k in p.durable) { if (!isTemplateKey(k)) continue; cells[k] = { value: p.durable[k].value, saved_at: today(), origin: 'database', pinned: false }; } // property record stays authoritative for identity
      }
      // The date picked when the package is created is a statement about this
      // package, so it lands in the form and outranks any date inherited from
      // the property record or the package it was built from.
      const effIn = String(o.effective_date || '').trim();
      if (effIn) { cells['rent_schedule.date_eff_source'] = { value: 'custom', saved_at: today() }; cells['rent_schedule.date_eff_custom'] = { value: effIn, saved_at: today() }; }
      D.cycles[cid] = { id: cid, property_id: pid, programs: (o.programs || ['rcs']).join(','), label: o.label || '', effective_date: cyISO(o.effective_date) || '', cells, generated: {}, rs_doc: {}, created_at: now(), updated_at: now() };
      if (o.full) cySyncEff(D.cycles[cid]);
      return persist().then(() => ({ cid }));
    },
    deleteCycle(cid) { delete D.cycles[cid]; return persist(); },
    getFlatCycle(cid) {
      const c = D.cycles[cid]; if (!c) return {};
      const out = {}; for (const k in c.cells) { const v = c.cells[k].value == null ? '' : String(c.cells[k].value); out[k] = { value: v, source: v === '' ? 'new' : 'database', saved_at: c.cells[k].saved_at || '', origin: (c.cells[k].origin != null ? c.cells[k].origin : (v === '' ? null : 'database')), pinned: !!c.cells[k].pinned }; }
      return out;
    },
    saveFlatCycle(cid, map) {
      const c = D.cycles[cid]; if (!c) throw new Error('no cycle ' + cid);
      assertCycleOpen(cid);
      for (const k in map) c.cells[k] = { value: (map[k] && map[k].value != null) ? String(map[k].value) : '', saved_at: (map[k] && map[k].saved_at) ? map[k].saved_at : today(), origin: (map[k] && map[k].origin != null) ? map[k].origin : null, pinned: !!(map[k] && map[k].pinned) };
      cySyncEff(c);
      c.updated_at = now();
      const jobs = [persist()];
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
      return persist();
    },
    setCyclePrograms(cid, programs) { const c = D.cycles[cid]; if (!c) return Promise.resolve(); assertCycleOpen(cid); assertPackageFree(c.property_id, c.effective_date, programs, cid); c.programs = (programs || []).join(','); c.updated_at = now(); return persist(); },
    /* API parity with db.supabase.js's rs_doc surface — see CLAUDE.md: a
       stand-in that answers differently from the real backend makes every test
       that uses it a fiction. */
    getCycleRs(cid) { const c = D.cycles[cid]; return (c && c.rs_doc) || {}; },
    setCycleRs(cid, doc) { const c = D.cycles[cid]; if (!c) return Promise.resolve(); c.rs_doc = doc || {}; c.updated_at = now(); return persist(); },
    getCycleRcs(cid) { const c = D.cycles[cid]; return (c && c.rcs_doc) || {}; },
    setCycleRcs(cid, doc) { const c = D.cycles[cid]; if (!c) return Promise.resolve(); c.rcs_doc = doc || {}; c.updated_at = now(); return persist(); },
    setCycleGenerated(cid, docs) { const c = D.cycles[cid]; if (!c) return Promise.resolve(); c.generated = { at: now(), docs: docs || [] }; c.updated_at = now(); return persist(); },
    clearAll() { D = freshDb(); seedGates(); return persist(); },
    /* ---- the HAP tracker + who is using the app (parity with db.supabase.js) */
    hapRows: () => (D.meta.hap || []).slice(),
    hapError: () => '',
    getPmName: () => D.meta.pmName || '',
    async setPmName(name) { D.meta.pmName = String(name || ''); await persist(); },
    _setHapRows(rows) { D.meta.hap = Array.isArray(rows) ? rows.slice() : []; return persist(); },  // test seam; the real backend reads a table
    propByRaCode(code) {
      const c = String(code == null ? '' : code);
      if (!c) return null;
      for (const id in D.props) if (String(D.props[id].ra_property_code || '') === c) return id;
      return null;
    },
    /* The other direction, which the RA seam needs on every render. Its
       partner above scans every property; listProperties() would answer too,
       but it scores the whole portfolio to do it. */
    raCodeOfPid(pid) {
      const p = D.props[pid];
      return p ? (String(p.ra_property_code || '') || null) : null;
    },
    computeAnalysis, computeSalutation,
  };
}

/* ---- adapters --------------------------------------------------------- */
function localAdapter(KEY) {
  KEY = KEY || 'rcs_mp_db1';
  let LS; try { LS = window.localStorage; LS.setItem('__t', '1'); LS.removeItem('__t'); }
  catch (e) { const m = {}; LS = { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } }; }
  return {
    get: async () => { try { return JSON.parse(LS.getItem(KEY)); } catch (e) { return null; } },
    set: async (o) => LS.setItem(KEY, JSON.stringify(o)),
    clear: async () => LS.removeItem(KEY),
  };
}
function memoryAdapter(init) { let o = init || null; return { get: async () => o, set: async (x) => { o = x; }, clear: async () => { o = null; } }; }

if (typeof module !== 'undefined') module.exports = { makeDb, localAdapter, memoryAdapter, isPerCycleKey, migrate, computeAnalysis, computeSalutation, safmrResolvedFrom, gatesSeedFlat, num, CROSSWALK };
