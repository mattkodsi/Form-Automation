/**
 * schema.ts — THE CONTRACT (frozen at Phase 1)
 * -------------------------------------------------------------------------
 * The locked v6 field dictionary (RCS_OCAF_Schema_Field_Dictionary_v6.xlsx)
 * is the single source of truth. `tools/build-schema.py` reads that
 * spreadsheet and writes src/dictionary.json — nothing here is hand-typed
 * from memory. This file:
 *   1. gives every one of the 69 fields a HOME (a real column, a child table,
 *      a computed value, or provenance meta), and
 *   2. refuses to run (assertConformance) if the dictionary and the tables
 *      ever disagree — so the code can never silently drift from the spec.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

/* ---- Field classes, exactly as in the dictionary ---------------------- */
export type FieldClass =
  | 'Durable'    // per-property, changes rarely
  | 'Per-cycle'  // entered/confirmed each submission
  | 'Per-study'  // comes from the RCS study (the appraiser block)
  | 'Constant'   // boilerplate template text
  | 'Computed'   // NEVER stored — derived on read
  | 'Mixed';     // the units[] container itself

export type DictField = {
  num: number; key: string; group: string; type: string;
  cls: FieldClass; source: string; used_in_docs: string; notes: string;
};

/* ---- Provenance: where a stored value came from (the mockup's colors) -- */
export type ProvenanceSource =
  | 'database'         // on file (purple)
  | 'this-cycle'       // entered/parsed this submission (teal)
  | 'overridden'       // was on file, user edited (amber, revertible)
  | 'auto-calculated'  // derived (blue)
  | 'new';             // raw, not yet saved (gray)

export const SOURCES: Record<ProvenanceSource, { label: string; color: string; tint: string }> = {
  'database':        { label: 'On file (database)', color: '#6d28d9', tint: '#f1ebfb' },
  'this-cycle':      { label: 'Entered this cycle',  color: '#0f766e', tint: '#e9f5f2' },
  'overridden':      { label: 'Overridden',          color: '#b45309', tint: '#fbf1e6' },
  'auto-calculated': { label: 'Auto-calculated',     color: '#2563eb', tint: '#e8f0fe' },
  'new':             { label: 'New — not yet saved',  color: '#64748b', tint: '#f1f5f9' },
};

/* ---- Where every dictionary field lives ------------------------------- */
export type FieldHome =
  | { kind: 'column'; table: string; column: string } // one scalar column
  | { kind: 'child'; table: string }                  // repeating rows (array)
  | { kind: 'computed' }                               // derived, never stored
  | { kind: 'container' }                              // the units[] array itself
  | { kind: 'meta' };                                  // lives in the provenance log

export const FIELD_HOME: Record<string, FieldHome> = {
  // --- property (durable scalars) ---
  'property.name':                    { kind: 'column', table: 'property', column: 'name' },
  'property.fha_section8_no':         { kind: 'column', table: 'property', column: 'fha_section8_no' },
  'property.address_street':          { kind: 'column', table: 'property', column: 'address_street' },
  'property.address_city':            { kind: 'column', table: 'property', column: 'address_city' },
  'property.address_state':           { kind: 'column', table: 'property', column: 'address_state' },
  'property.address_zip':             { kind: 'column', table: 'property', column: 'address_zip' },
  'owner.entity_name':                { kind: 'column', table: 'property', column: 'entity_name' },
  'owner.entity_type':                { kind: 'column', table: 'property', column: 'entity_type' },
  'signatory.name':                   { kind: 'column', table: 'property', column: 'signatory_name' },
  'signatory.title':                  { kind: 'column', table: 'property', column: 'signatory_title' },
  'owner_poc.name':                   { kind: 'column', table: 'property', column: 'owner_poc_name' },
  'owner_poc.phone':                  { kind: 'column', table: 'property', column: 'owner_poc_phone' },
  'owner_poc.email':                  { kind: 'column', table: 'property', column: 'owner_poc_email' },
  'ca.org':                           { kind: 'column', table: 'property', column: 'ca_org' },
  'ca.contact_name':                  { kind: 'column', table: 'property', column: 'ca_contact_name' },
  'ca.contact_title':                 { kind: 'column', table: 'property', column: 'ca_contact_title' },
  'ca.contact_prefix':                { kind: 'column', table: 'property', column: 'ca_contact_prefix' },
  'ca.address_street':                { kind: 'column', table: 'property', column: 'ca_address_street' },
  'ca.address_city_state_zip':        { kind: 'column', table: 'property', column: 'ca_address_city_state_zip' },
  'tenant.sender_name':               { kind: 'column', table: 'property', column: 'tenant_sender_name' },
  'tenant.sender_title':              { kind: 'column', table: 'property', column: 'tenant_sender_title' },
  'assets.letterhead':                { kind: 'column', table: 'property', column: 'letterhead_asset' },

  // --- submission (per-cycle + per-study scalars) ---
  'rent_schedule.date_rents_effective': { kind: 'column', table: 'submission', column: 'date_rents_effective' },
  'cycle.program_type':               { kind: 'column', table: 'submission', column: 'program_type' },
  'cycle.adjustment_type':            { kind: 'column', table: 'submission', column: 'adjustment_type' },
  'cycle.hap_reference':              { kind: 'column', table: 'submission', column: 'hap_reference' },
  'cycle.submission_date':            { kind: 'column', table: 'submission', column: 'submission_date' },
  'checklist.sign_date':              { kind: 'column', table: 'submission', column: 'sign_date' },
  'tenant.date_of_notice':            { kind: 'column', table: 'submission', column: 'tenant_date_of_notice' },
  'assets.rcs_report':                { kind: 'column', table: 'submission', column: 'rcs_report_asset' },
  'assets.prior_executed_rent_schedule': { kind: 'column', table: 'submission', column: 'prior_rs_asset' },
  'study.appraiser_name':             { kind: 'column', table: 'submission', column: 'appraiser_name' },
  'study.appraiser_firm':             { kind: 'column', table: 'submission', column: 'appraiser_firm' },
  'study.appraiser_address_street':   { kind: 'column', table: 'submission', column: 'appraiser_address_street' },
  'study.appraiser_address_city_state_zip': { kind: 'column', table: 'submission', column: 'appraiser_address_city_state_zip' },
  'study.appraiser_email':            { kind: 'column', table: 'submission', column: 'appraiser_email' },
  'study.appraiser_phone':            { kind: 'column', table: 'submission', column: 'appraiser_phone' },

  // --- child tables (repeating rows) ---
  'units[].type_label':               { kind: 'child', table: 'unit_type' },
  'units[].num_units':                { kind: 'child', table: 'unit_type' },
  'units[].revenue_producing':        { kind: 'child', table: 'unit_type' },
  'units[].nonrev_use':               { kind: 'child', table: 'unit_type' },
  'owner.principals[]':               { kind: 'child', table: 'principal' },
  'partB.equipment':                  { kind: 'child', table: 'partb_item' },
  'partB.equipment_writeins[]':       { kind: 'child', table: 'partb_item' },
  'partB.utilities':                  { kind: 'child', table: 'partb_item' },
  'partB.services':                   { kind: 'child', table: 'partb_item' },
  'partB.utility_writeins[]':         { kind: 'child', table: 'partb_item' },
  'partB.service_writeins[]':         { kind: 'child', table: 'partb_item' },
  'partE.commercial[]':               { kind: 'child', table: 'partE_commercial' },
  'units[].current_contract_rent':    { kind: 'child', table: 'unit_cycle_value' },
  'units[].proposed_contract_rent':   { kind: 'child', table: 'unit_cycle_value' },
  'units[].ua_from_exec_rs':          { kind: 'child', table: 'unit_cycle_value' },
  'units[].ua_from_rcs':              { kind: 'child', table: 'unit_cycle_value' },
  'units[].safmr_from_rcs':           { kind: 'child', table: 'unit_cycle_value' },
  'units[].safmr_from_hud':           { kind: 'child', table: 'unit_cycle_value' },
  'partC.charges[]':                  { kind: 'child', table: 'partC_charge' },
  'checklist.items[17]':              { kind: 'child', table: 'checklist_item' },

  // --- computed (NEVER stored — see compute.ts) ---
  'units[].ua_resolved':              { kind: 'computed' },
  'units[].increase':                 { kind: 'computed' },
  'units[].gross_rent':               { kind: 'computed' },
  'rent_schedule.total_units':        { kind: 'computed' },
  'ca.contact_salutation':            { kind: 'computed' },
  'units[].safmr_resolved':           { kind: 'computed' },
  'units[].safmr_150':                { kind: 'computed' },
  'analysis.rcs_plus_ua_gpr':         { kind: 'computed' },
  'analysis.safmr_150_gpr':           { kind: 'computed' },
  'analysis.below_150':               { kind: 'computed' },

  // --- special ---
  'units[]':                          { kind: 'container' }, // the array itself
  'record.field_save_dates':          { kind: 'meta' },      // the provenance log
};

/* ---- The database, written out explicitly (nothing generated/hidden) --- */
export const DDL = `
CREATE TABLE IF NOT EXISTS property (
  id INTEGER PRIMARY KEY,
  name TEXT, fha_section8_no TEXT,
  address_street TEXT, address_city TEXT, address_state TEXT, address_zip TEXT,
  entity_name TEXT, entity_type TEXT,
  signatory_name TEXT, signatory_title TEXT,
  owner_poc_name TEXT, owner_poc_phone TEXT, owner_poc_email TEXT,
  ca_org TEXT, ca_contact_name TEXT, ca_contact_title TEXT, ca_contact_prefix TEXT,
  ca_address_street TEXT, ca_address_city_state_zip TEXT,
  tenant_sender_name TEXT, tenant_sender_title TEXT,
  letterhead_asset TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS unit_type (
  id INTEGER PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES property(id),
  type_label TEXT, num_units INTEGER,
  revenue_producing INTEGER DEFAULT 1, nonrev_use TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS principal (
  id INTEGER PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES property(id),
  name TEXT, title TEXT, sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS partb_item (
  id INTEGER PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES property(id),
  section TEXT NOT NULL,            -- 'equipment' | 'utility' | 'service'
  label TEXT NOT NULL,
  checked INTEGER DEFAULT 0,
  fuel TEXT,                        -- utilities only: E / G / F
  is_writein INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS partE_commercial (
  id INTEGER PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES property(id),
  description TEXT, monthly_rent REAL, sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS submission (
  id INTEGER PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES property(id),
  program_type TEXT, adjustment_type TEXT, hap_reference TEXT,
  submission_date TEXT, date_rents_effective TEXT,
  sign_date TEXT, tenant_date_of_notice TEXT,
  rcs_report_asset TEXT, prior_rs_asset TEXT,
  appraiser_name TEXT, appraiser_firm TEXT,
  appraiser_address_street TEXT, appraiser_address_city_state_zip TEXT,
  appraiser_email TEXT, appraiser_phone TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS unit_cycle_value (
  id INTEGER PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submission(id),
  unit_type_id INTEGER NOT NULL REFERENCES unit_type(id),
  current_contract_rent REAL, proposed_contract_rent REAL,
  ua_from_exec_rs REAL, ua_from_rcs REAL,
  safmr_from_rcs REAL, safmr_from_hud REAL,
  UNIQUE(submission_id, unit_type_id)
);

CREATE TABLE IF NOT EXISTS partC_charge (
  id INTEGER PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submission(id),
  description TEXT, amount REAL, sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS checklist_item (
  id INTEGER PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submission(id),
  idx INTEGER NOT NULL, label TEXT, checked INTEGER DEFAULT 0
);

-- Field-level provenance: one row per stored value, stamped with its source
-- and save date, keeping the prior value so a single-level revert works.
CREATE TABLE IF NOT EXISTS provenance (
  id INTEGER PRIMARY KEY,
  entity_table TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  field_key TEXT NOT NULL,      -- dictionary key, e.g. 'ca.address_street'
  column_name TEXT NOT NULL,    -- physical column stamped
  source TEXT NOT NULL,         -- database | this-cycle | overridden | auto-calculated | new
  saved_at TEXT NOT NULL,       -- yyyy-mm-dd
  prior_value TEXT,             -- previous value (revert target)
  prior_source TEXT,
  UNIQUE(entity_table, entity_id, column_name)
);
`;

/* ---- Loading + validation --------------------------------------------- */
export function loadDictionary(): DictField[] {
  const path = join(import.meta.dirname, 'dictionary.json');
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Array<Record<string, unknown>>;
  return raw.map((r) => ({
    num: Number(r.num),
    key: String(r.key),
    group: String(r.group ?? ''),
    type: String(r.type ?? ''),
    cls: String(r.cls) as FieldClass,
    source: String(r.source ?? ''),
    used_in_docs: String(r.used_in_docs ?? ''),
    notes: String(r.notes ?? ''),
  }));
}

export function applySchema(db: DatabaseSync): void {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(DDL);
}

/**
 * The guardrail. Proves, at startup, that the code matches the locked
 * dictionary: every field has a home, and every "column" home is a real
 * column in a real table. Throws (loudly) on any drift.
 */
export function assertConformance(db: DatabaseSync): { fields: number; stored: number; computed: number } {
  const dict = loadDictionary();
  const dictKeys = new Set(dict.map((f) => f.key));
  const homeKeys = new Set(Object.keys(FIELD_HOME));

  const missing = [...dictKeys].filter((k) => !homeKeys.has(k));
  const extra = [...homeKeys].filter((k) => !dictKeys.has(k));
  if (missing.length || extra.length) {
    throw new Error(
      `Schema drift vs v6 dictionary.\n  Fields with no home: ${JSON.stringify(missing)}\n  Homes with no field: ${JSON.stringify(extra)}`,
    );
  }

  // Every 'column' home must be a real column in its table.
  const cols: Record<string, Set<string>> = {};
  const tableOf = (t: string): Set<string> => {
    if (!cols[t]) {
      const info = db.prepare(`PRAGMA table_info(${t})`).all() as Array<{ name: string }>;
      cols[t] = new Set(info.map((c) => c.name));
    }
    return cols[t];
  };
  let stored = 0;
  let computed = 0;
  for (const [key, home] of Object.entries(FIELD_HOME)) {
    if (home.kind === 'column') {
      if (!tableOf(home.table).has(home.column)) {
        throw new Error(`Field ${key} → ${home.table}.${home.column} but that column does not exist.`);
      }
      stored++;
    } else if (home.kind === 'child') {
      if (tableOf(home.table).size === 0) throw new Error(`Field ${key} → missing child table ${home.table}.`);
      stored++;
    } else if (home.kind === 'computed') {
      computed++;
    }
  }
  return { fields: dict.length, stored, computed };
}
