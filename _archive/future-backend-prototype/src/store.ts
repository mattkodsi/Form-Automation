/**
 * store.ts — the FORM↔DB CONTRACT (frozen at Phase 1).
 *
 * Six operations, nothing more:
 *   1. createEmptyProperty  — a blank first-run record
 *   2. writeValue           — save a value, stamped (source + today's date)
 *   3. fillFromDatabase     — the durable prefill the form loads next cycle
 *   4. override             — edit a stored value (keeps the prior for revert)
 *   5. revert               — restore the prior value + prior source
 *   6. readRecord           — assemble the full record incl. computed fields
 *
 * Every stored value goes through ONE path (setColumn) that also writes the
 * provenance row, so nothing can be saved without a source and a date.
 */
import { DatabaseSync } from 'node:sqlite';
import { FIELD_HOME, SOURCES, applySchema, assertConformance } from './schema.ts';
import type { ProvenanceSource } from './schema.ts';
import * as C from './compute.ts';

type Val = string | number | boolean | null;
type Prov = { source: ProvenanceSource; saved_at: string | null; prior_value: string | null; prior_source: string | null };
export type FieldView = { value: Val; source: ProvenanceSource; saved_at: string | null };

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ident = (s: string): string => {
  if (!IDENT.test(s)) throw new Error(`Unsafe identifier: ${s}`);
  return s;
};
const toSql = (v: Val): string | number | null => {
  if (v == null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
};

// Which dictionary key a child-table column belongs to (for provenance labels).
const CHILD_FIELD_KEY: Record<string, Record<string, string>> = {
  unit_type: {
    type_label: 'units[].type_label', num_units: 'units[].num_units',
    revenue_producing: 'units[].revenue_producing', nonrev_use: 'units[].nonrev_use',
  },
  unit_cycle_value: {
    current_contract_rent: 'units[].current_contract_rent', proposed_contract_rent: 'units[].proposed_contract_rent',
    ua_from_exec_rs: 'units[].ua_from_exec_rs', ua_from_rcs: 'units[].ua_from_rcs',
    safmr_from_rcs: 'units[].safmr_from_rcs', safmr_from_hud: 'units[].safmr_from_hud',
  },
  principal: { name: 'owner.principals[]', title: 'owner.principals[]' },
  partb_item: { label: 'partB.item', checked: 'partB.item', fuel: 'partB.item' },
  checklist_item: { checked: 'checklist.items[17]', label: 'checklist.items[17]' },
};

export class Store {
  readonly db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    applySchema(this.db);
  }

  /** Run the drift guardrail; returns field counts. */
  verifyContract(): { fields: number; stored: number; computed: number } {
    return assertConformance(this.db);
  }

  today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /* ---- the one write path: set a column + stamp provenance ------------ */
  private setColumn(table: string, id: number, fieldKey: string, column: string, value: Val, source: ProvenanceSource): void {
    ident(table); ident(column);
    const curRow = this.db.prepare(`SELECT ${column} AS v FROM ${table} WHERE id = ?`).get(id) as { v: unknown } | undefined;
    const oldVal = curRow ? curRow.v : null;
    const provRow = this.db.prepare(
      `SELECT source FROM provenance WHERE entity_table=? AND entity_id=? AND column_name=?`,
    ).get(table, id, column) as { source: string } | undefined;
    const oldSource = provRow ? provRow.source : null;

    this.db.prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?`).run(toSql(value), id);
    this.db.prepare(
      `INSERT INTO provenance (entity_table, entity_id, field_key, column_name, source, saved_at, prior_value, prior_source)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(entity_table, entity_id, column_name) DO UPDATE SET
         field_key=excluded.field_key, source=excluded.source, saved_at=excluded.saved_at,
         prior_value=excluded.prior_value, prior_source=excluded.prior_source`,
    ).run(table, id, fieldKey, column, source, this.today(), oldVal == null ? null : String(oldVal), oldSource);
  }

  private getProv(table: string, id: number, column: string): Prov {
    const r = this.db.prepare(
      `SELECT source, saved_at, prior_value, prior_source FROM provenance WHERE entity_table=? AND entity_id=? AND column_name=?`,
    ).get(table, id, column) as Prov | undefined;
    return r ?? { source: 'new', saved_at: null, prior_value: null, prior_source: null };
  }

  private view(table: string, id: number, column: string): FieldView {
    ident(table); ident(column);
    const row = this.db.prepare(`SELECT ${column} AS v FROM ${table} WHERE id = ?`).get(id) as { v: Val } | undefined;
    const p = this.getProv(table, id, column);
    return { value: row ? row.v : null, source: p.source, saved_at: p.saved_at };
  }

  /* ---- 1. create empty ------------------------------------------------ */
  createEmptyProperty(name?: string): number {
    const info = this.db.prepare(`INSERT INTO property (created_at) VALUES (?)`).run(this.today());
    const id = Number(info.lastInsertRowid);
    if (name != null) this.setColumn('property', id, 'property.name', 'name', name, 'new');
    return id;
  }

  /* ---- 2. write a value (durable or per-cycle), stamped --------------- */
  writeValue(table: string, id: number, fieldKey: string, value: Val, source: ProvenanceSource): void {
    const home = FIELD_HOME[fieldKey];
    if (!home || home.kind !== 'column') throw new Error(`${fieldKey} is not a stored scalar column.`);
    if (home.table !== table) throw new Error(`${fieldKey} lives in ${home.table}, not ${table}.`);
    this.setColumn(table, id, fieldKey, home.column, value, source);
  }

  /* ---- child rows (arrays) — durable structure ------------------------ */
  addUnitType(propertyId: number, u: { type_label?: string; num_units?: number; revenue_producing?: boolean; nonrev_use?: string | null }, source: ProvenanceSource = 'database'): number {
    const info = this.db.prepare(`INSERT INTO unit_type (property_id) VALUES (?)`).run(propertyId);
    const id = Number(info.lastInsertRowid);
    const set = (col: string, v: Val) => this.setColumn('unit_type', id, CHILD_FIELD_KEY.unit_type[col], col, v, source);
    if (u.type_label !== undefined) set('type_label', u.type_label);
    if (u.num_units !== undefined) set('num_units', u.num_units);
    if (u.revenue_producing !== undefined) set('revenue_producing', u.revenue_producing);
    if (u.nonrev_use !== undefined) set('nonrev_use', u.nonrev_use);
    return id;
  }

  addPrincipal(propertyId: number, p: { name: string; title?: string }, source: ProvenanceSource = 'database'): number {
    const info = this.db.prepare(`INSERT INTO principal (property_id) VALUES (?)`).run(propertyId);
    const id = Number(info.lastInsertRowid);
    this.setColumn('principal', id, 'owner.principals[]', 'name', p.name, source);
    if (p.title !== undefined) this.setColumn('principal', id, 'owner.principals[]', 'title', p.title, source);
    return id;
  }

  addPartBItem(propertyId: number, it: { section: 'equipment' | 'utility' | 'service'; label: string; checked?: boolean; fuel?: string | null; is_writein?: boolean }, source: ProvenanceSource = 'database'): number {
    const info = this.db.prepare(
      `INSERT INTO partb_item (property_id, section, label, is_writein) VALUES (?,?,?,?)`,
    ).run(propertyId, it.section, it.label, it.is_writein ? 1 : 0);
    const id = Number(info.lastInsertRowid);
    this.setColumn('partb_item', id, 'partB.item', 'checked', it.checked ?? false, source);
    if (it.fuel !== undefined) this.setColumn('partb_item', id, 'partB.item', 'fuel', it.fuel, source);
    return id;
  }

  /* ---- per-cycle submission + its per-unit values --------------------- */
  startSubmission(propertyId: number, s: Record<string, Val>, source: ProvenanceSource = 'this-cycle'): number {
    const info = this.db.prepare(`INSERT INTO submission (property_id, created_at) VALUES (?,?)`).run(propertyId, this.today());
    const id = Number(info.lastInsertRowid);
    for (const [fieldKey, value] of Object.entries(s)) this.writeValue('submission', id, fieldKey, value, source);
    return id;
  }

  setUnitCycleValue(submissionId: number, unitTypeId: number, v: Partial<Record<string, number | null>>, source: ProvenanceSource = 'this-cycle'): number {
    let row = this.db.prepare(`SELECT id FROM unit_cycle_value WHERE submission_id=? AND unit_type_id=?`).get(submissionId, unitTypeId) as { id: number } | undefined;
    if (!row) {
      const info = this.db.prepare(`INSERT INTO unit_cycle_value (submission_id, unit_type_id) VALUES (?,?)`).run(submissionId, unitTypeId);
      row = { id: Number(info.lastInsertRowid) };
    }
    for (const [col, value] of Object.entries(v)) {
      const fk = CHILD_FIELD_KEY.unit_cycle_value[col];
      if (!fk) throw new Error(`Unknown unit_cycle_value column: ${col}`);
      this.setColumn('unit_cycle_value', row.id, fk, col, value ?? null, source);
    }
    return row.id;
  }

  /* ---- 4. override / 5. revert ---------------------------------------- */
  override(table: string, id: number, fieldKey: string, newValue: Val): void {
    this.writeValue(table, id, fieldKey, newValue, 'overridden');
  }

  /** Restore the prior value and prior source captured on the last write. */
  revert(table: string, id: number, fieldKey: string): boolean {
    const home = FIELD_HOME[fieldKey];
    if (!home || home.kind !== 'column') throw new Error(`${fieldKey} is not a stored scalar column.`);
    ident(table); ident(home.column);
    const p = this.getProv(table, id, home.column);
    if (p.prior_source == null && p.prior_value == null) return false; // nothing to revert to
    this.db.prepare(`UPDATE ${table} SET ${home.column} = ? WHERE id = ?`).run(p.prior_value, id);
    this.db.prepare(
      `UPDATE provenance SET source=?, saved_at=?, prior_value=NULL, prior_source=NULL
       WHERE entity_table=? AND entity_id=? AND column_name=?`,
    ).run(p.prior_source ?? 'database', this.today(), table, id, home.column);
    return true;
  }

  /* ---- 3. fill from database — the durable prefill -------------------- */
  fillFromDatabase(propertyId: number): {
    property: Record<string, FieldView>;
    unit_types: Array<Record<string, FieldView> & { id: number }>;
    principals: Array<{ id: number; name: FieldView }>;
    partb: Array<{ id: number; section: string; label: string; is_writein: boolean; checked: FieldView; fuel: FieldView }>;
  } {
    const property: Record<string, FieldView> = {};
    for (const [key, home] of Object.entries(FIELD_HOME)) {
      if (home.kind === 'column' && home.table === 'property') property[key] = this.view('property', propertyId, home.column);
    }
    const unitRows = this.db.prepare(`SELECT id FROM unit_type WHERE property_id=? ORDER BY sort_order, id`).all(propertyId) as Array<{ id: number }>;
    const unit_types = unitRows.map((r) => ({
      id: r.id,
      type_label: this.view('unit_type', r.id, 'type_label'),
      num_units: this.view('unit_type', r.id, 'num_units'),
      revenue_producing: this.view('unit_type', r.id, 'revenue_producing'),
      nonrev_use: this.view('unit_type', r.id, 'nonrev_use'),
    }));
    const princRows = this.db.prepare(`SELECT id FROM principal WHERE property_id=? ORDER BY sort_order, id`).all(propertyId) as Array<{ id: number }>;
    const principals = princRows.map((r) => ({ id: r.id, name: this.view('principal', r.id, 'name') }));
    const pbRows = this.db.prepare(`SELECT id, section, label, is_writein FROM partb_item WHERE property_id=? ORDER BY section, sort_order, id`).all(propertyId) as Array<{ id: number; section: string; label: string; is_writein: number }>;
    const partb = pbRows.map((r) => ({
      id: r.id, section: r.section, label: r.label, is_writein: !!r.is_writein,
      checked: this.view('partb_item', r.id, 'checked'), fuel: this.view('partb_item', r.id, 'fuel'),
    }));
    return { property, unit_types, principals, partb };
  }

  /* ---- 6. read the full record incl. computed fields ------------------ */
  readRecord(propertyId: number, submissionId?: number): Record<string, unknown> {
    const base = this.fillFromDatabase(propertyId);

    // computed durable field: salutation
    const salutation = C.salutation(base.property['ca.contact_prefix']?.value as string | null, base.property['ca.contact_name']?.value as string | null);

    let submission: Record<string, FieldView> | null = null;
    let units: Array<Record<string, unknown>> = [];
    let analysis: Record<string, unknown> | null = null;

    if (submissionId != null) {
      submission = {};
      for (const [key, home] of Object.entries(FIELD_HOME)) {
        if (home.kind === 'column' && home.table === 'submission') submission[key] = this.view('submission', submissionId, home.column);
      }
      const cvRows = this.db.prepare(`SELECT id, unit_type_id, current_contract_rent, proposed_contract_rent, ua_from_exec_rs, ua_from_rcs, safmr_from_rcs, safmr_from_hud FROM unit_cycle_value WHERE submission_id=?`).all(submissionId) as Array<Record<string, number | null> & { id: number; unit_type_id: number }>;
      const byType = new Map(base.unit_types.map((u) => [u.id, u]));
      const analysisUnits: C.AnalysisUnit[] = [];
      units = cvRows.map((cv) => {
        const ut = byType.get(cv.unit_type_id);
        const numUnits = (ut?.num_units.value as number | null) ?? null;
        const revenue = (ut?.revenue_producing.value as number | null) !== 0;
        const uaRes = C.uaResolved(cv.ua_from_exec_rs, cv.ua_from_rcs);
        const au: C.AnalysisUnit = {
          num_units: numUnits, revenue_producing: revenue,
          current_contract_rent: cv.current_contract_rent, proposed_contract_rent: cv.proposed_contract_rent,
          ua_from_exec_rs: cv.ua_from_exec_rs, ua_from_rcs: cv.ua_from_rcs,
          safmr_from_hud: cv.safmr_from_hud, safmr_from_rcs: cv.safmr_from_rcs,
        };
        analysisUnits.push(au);
        return {
          type_label: ut?.type_label.value ?? null, num_units: numUnits,
          current: this.view('unit_cycle_value', cv.id, 'current_contract_rent'),
          proposed: this.view('unit_cycle_value', cv.id, 'proposed_contract_rent'),
          ua_from_exec_rs: this.view('unit_cycle_value', cv.id, 'ua_from_exec_rs'),
          ua_from_rcs: this.view('unit_cycle_value', cv.id, 'ua_from_rcs'),
          // computed (never stored):
          ua_resolved: uaRes,
          increase: C.increase(cv.proposed_contract_rent, cv.current_contract_rent),
          gross_rent: C.grossRent(cv.proposed_contract_rent, uaRes),
          safmr_resolved: C.safmrResolved(cv.safmr_from_hud, cv.safmr_from_rcs),
          safmr_150: C.safmr150(C.safmrResolved(cv.safmr_from_hud, cv.safmr_from_rcs)),
        };
      });
      const proposedGpr = C.rcsPlusUaGpr(analysisUnits);
      const ceilingGpr = C.safmr150Gpr(analysisUnits);
      analysis = {
        current_gpr: C.currentGpr(analysisUnits),
        rcs_plus_ua_gpr: proposedGpr,
        safmr_150_gpr: ceilingGpr,
        below_150: C.below150(analysisUnits),
        headroom: ceilingGpr - proposedGpr,
      };
    }

    return {
      property: base.property,
      computed: { 'ca.contact_salutation': salutation, 'rent_schedule.total_units': C.totalUnits(base.unit_types.map((u) => ({ num_units: u.num_units.value as number | null }))) },
      unit_types: base.unit_types, principals: base.principals, partb: base.partb,
      submission, units, analysis,
    };
  }

  /* ---- registry: every property with quick metadata (the manager list) -- */
  listProperties(): Array<{ id: number; name: string | null; fha: string | null; unit_types: number; total_units: number; cycles: number; created_at: string }> {
    const rows = this.db.prepare(`SELECT id, name, fha_section8_no AS fha, created_at FROM property ORDER BY name`).all() as Array<{ id: number; name: string | null; fha: string | null; created_at: string }>;
    return rows.map((r) => {
      const ut = this.db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(num_units),0) AS u FROM unit_type WHERE property_id=? AND revenue_producing=1`).get(r.id) as { c: number; u: number };
      const cy = this.db.prepare(`SELECT COUNT(*) AS c FROM submission WHERE property_id=?`).get(r.id) as { c: number };
      return { id: r.id, name: r.name, fha: r.fha, unit_types: ut.c, total_units: ut.u, cycles: cy.c, created_at: r.created_at };
    });
  }

  /* ---- delete a property and everything under it (FK-safe order) -------- */
  deleteProperty(id: number): void {
    const subs = this.db.prepare(`SELECT id FROM submission WHERE property_id=?`).all(id) as Array<{ id: number }>;
    for (const sub of subs) {
      this.db.prepare(`DELETE FROM unit_cycle_value WHERE submission_id=?`).run(sub.id);
      this.db.prepare(`DELETE FROM partC_charge WHERE submission_id=?`).run(sub.id);
      this.db.prepare(`DELETE FROM checklist_item WHERE submission_id=?`).run(sub.id);
      this.db.prepare(`DELETE FROM provenance WHERE entity_table='submission' AND entity_id=?`).run(sub.id);
    }
    for (const t of ['submission', 'unit_type', 'principal', 'partb_item', 'partE_commercial']) {
      this.db.prepare(`DELETE FROM ${t} WHERE property_id=?`).run(id);
    }
    this.db.prepare(`DELETE FROM provenance WHERE entity_table='property' AND entity_id=?`).run(id);
    this.db.prepare(`DELETE FROM property WHERE id=?`).run(id);
  }

  close(): void {
    this.db.close();
  }
}

export { SOURCES };
