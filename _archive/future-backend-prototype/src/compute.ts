/**
 * compute.ts — the 10 COMPUTED fields (class = Computed in the dictionary).
 * These are NEVER stored in the database. They are derived on read from the
 * stored values, so they can never go stale or drift from their inputs.
 * Every function here maps 1:1 to a computed field in schema.ts / FIELD_HOME.
 */

/** units[].ua_resolved — primary = executed rent schedule, backup = RCS. */
export function uaResolved(uaExecRs: number | null, uaRcs: number | null): number | null {
  return uaExecRs ?? uaRcs ?? null;
}

/** units[].increase — proposed − current. */
export function increase(proposed: number | null, current: number | null): number | null {
  if (proposed == null || current == null) return null;
  return proposed - current;
}

/** units[].gross_rent — proposed + resolved UA (draft rent schedule, Col 6). */
export function grossRent(proposed: number | null, ua: number | null): number | null {
  if (proposed == null) return null;
  return proposed + (ua ?? 0);
}

/** units[].safmr_resolved — primary = HUD dataset, cross-check = RCS. */
export function safmrResolved(safmrHud: number | null, safmrRcs: number | null): number | null {
  return safmrHud ?? safmrRcs ?? null;
}

/** units[].safmr_150 — the 150% SAFMR ceiling for a unit type. */
export function safmr150(resolved: number | null): number | null {
  return resolved == null ? null : resolved * 1.5;
}

/** ca.contact_salutation — "Dear " + prefix + last token of the contact name. */
export function salutation(prefix: string | null, contactName: string | null): string | null {
  if (!contactName) return null;
  const tokens = contactName.trim().split(/\s+/);
  const last = tokens[tokens.length - 1];
  return `Dear ${prefix ? prefix + ' ' : ''}${last}`;
}

/** rent_schedule.total_units — sum of all unit-type counts. */
export function totalUnits(units: Array<{ num_units: number | null }>): number {
  return units.reduce((s, u) => s + (u.num_units ?? 0), 0);
}

/* ---- Analysis (the internal 150% SAFMR check) ------------------------- */
export type AnalysisUnit = {
  num_units: number | null;
  revenue_producing: boolean;
  current_contract_rent: number | null;
  proposed_contract_rent: number | null;
  ua_from_exec_rs: number | null;
  ua_from_rcs: number | null;
  safmr_from_hud: number | null;
  safmr_from_rcs: number | null;
};

const sumOverRevenueUnits = (units: AnalysisUnit[], perUnit: (u: AnalysisUnit) => number | null): number =>
  units
    .filter((u) => u.revenue_producing)
    .reduce((s, u) => s + (perUnit(u) ?? 0) * (u.num_units ?? 0), 0);

/** Monthly current gross rent potential (in-place rent + UA). For the gauge. */
export function currentGpr(units: AnalysisUnit[]): number {
  return sumOverRevenueUnits(units, (u) => grossRent(u.current_contract_rent, uaResolved(u.ua_from_exec_rs, u.ua_from_rcs)));
}

/** analysis.rcs_plus_ua_gpr — monthly proposed gross rent potential (RCS + UA). */
export function rcsPlusUaGpr(units: AnalysisUnit[]): number {
  return sumOverRevenueUnits(units, (u) => grossRent(u.proposed_contract_rent, uaResolved(u.ua_from_exec_rs, u.ua_from_rcs)));
}

/** analysis.safmr_150_gpr — monthly 150% SAFMR ceiling across the property. */
export function safmr150Gpr(units: AnalysisUnit[]): number {
  return sumOverRevenueUnits(units, (u) => safmr150(safmrResolved(u.safmr_from_hud, u.safmr_from_rcs)));
}

/** analysis.below_150 — the pass/fail: proposed GPR must be under the ceiling. */
export function below150(units: AnalysisUnit[]): boolean {
  return rcsPlusUaGpr(units) < safmr150Gpr(units);
}
