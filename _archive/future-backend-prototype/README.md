# RCS Renewal Automation — Phase 1 (data model + persistence)

This is the **filing cabinet behind the tool**: where each property's information
lives, how a value gets saved with its date and its source, and proof that the
core loop works — **save → refill next cycle → override one value → undo**.
There are no screens yet; that's the next phase. This phase freezes the data
contract so everything built on top of it stays consistent.

## What it proves (run it and watch)

`src/roundtrip.ts` runs the whole loop on the Gates Manor example and **checks
every number against the approved "Rich Review v4" mockup**. If any figure is
off, it exits with an error — so a clean run means the logic is correct:

- proposed gross rent **$140,658**, 150% SAFMR ceiling **$178,245**, headroom
  **$37,587**, and the internal check returns **PASS** — all matching the mockup;
- resolved UA is **$33** (the executed rent schedule beats the RCS's $31);
- the salutation computes to **"Dear Ms. Gross"** from the prefix + last name;
- data **survives closing and reopening the database file** (real persistence);
- an **override** of the CA address is marked amber and keeps the prior value;
- **revert** restores the original value and its "on file" source.

To operate this yourself, open **`RCS Phase 1 — Test (open in browser).html`** in
the project root: a Form + Database page that runs these same six operations in
your browser (source in `app/harness/`, verified by `app/harness/test.js`).

## The six operations (the whole contract)

All in `src/store.ts`:

1. **createEmptyProperty** — a blank first-run record (nothing invented).
2. **writeValue** — save a value, stamped with a source + today's date.
3. **fillFromDatabase** — the durable prefill the form loads at the next cycle.
4. **override** — edit a stored value, keeping the prior for undo.
5. **revert** — restore the prior value and prior source.
6. **readRecord** — assemble the full record, including the computed fields.

Every stored value flows through one path that also writes a **provenance** row,
so nothing can be saved without a source and a date. The five sources use your
mockup's colors: on-file (purple), this-cycle (teal), overridden (amber),
auto-calculated (blue), new (gray).

## How the 69 fields map to the database

The locked spreadsheet **`RCS_OCAF_Schema_Field_Dictionary_v6.xlsx` is the single
source of truth.** `tools/build-schema.py` reads it and writes
`src/dictionary.json` — the field list is never hand-typed. On startup the app
runs a **conformance check** (`assertConformance`) that refuses to run if the
code and the dictionary ever disagree, so the schema can't silently drift.

The 69 fields resolve to: **57 stored** (across `property`, `unit_type`,
`principal`, `partb_item`, `submission`, `unit_cycle_value`, plus `partC/partE`
and `checklist` child tables) and **10 computed** (never stored — derived on
read: resolved UA/SAFMR, increase, gross rent, salutation, total units, the two
GPRs, and the 150% pass/fail). The exact tables are in `schema.sql`.

Durable (per-property) vs per-cycle (per submission) is honored: "fill from
database" returns only durable values; rents, UA and SAFMR are entered fresh
each cycle.

## Running it

Requires **Node 22.6+** (uses Node's built-in SQLite and TypeScript support —
**zero third-party libraries, nothing to install**).

- Windows: double-click **`run.bat`**
- Mac/Linux: **`./run.sh`**  (or `npm run proof`)

To regenerate the field list after editing the spreadsheet:
`python3 tools/build-schema.py`

## Frozen here · next up

Frozen: the data-model contract (tables + the six operations + provenance).
Next (Phase 2): the walking-skeleton UI — the Property section wired through
this same loop on screen. Still deferred: document generation, PDF/AI
extraction, the HUD SAFMR pull, and the database-manager screen.

## Files

```
src/schema.ts       the contract: field homes, tables (DDL), conformance check
src/compute.ts      the 10 computed fields (never stored)
src/store.ts        the six operations + provenance stamping
src/roundtrip.ts    the self-checking Phase 1 proof
src/dictionary.json the 69 fields, generated from 