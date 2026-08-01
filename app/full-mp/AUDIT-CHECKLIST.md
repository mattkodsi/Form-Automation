# RCS Audit Checklist

Everything the audit looks for, per file and audit-wide. Grounded in the real
app (`FIELD_SECTIONS`, `SECTION_TITLES`, `DOC_REQS`, `gen.js`, `rcs.js`,
`parseRsPdf`, `hap.js`, `db.js`, `score.js`). Each line is a thing to **check on
a rendered document or a re-run of the ship code** — not a thing to assert from
reading. If a check can't be tied to a render or an execution, it isn't a finding.

---

## 0. Method & guardrails (audit-wide)

The per-package loop:
1. **SHOULD** — read the *sources* by eye (appraiser study, executed prior rent
   schedule, UAF/tracker data) and write what the package must say: rents, UAs,
   unit types, counts, dates, names. SHOULD comes from the sources, **not** from
   what was filed.
2. **OURS** — drive the real app here to generate the package.
3. **FILED** — pull what the team actually submitted.
4. **Three-way, visually** — render each of our docs and look; `rdiff` OURS vs
   FILED page-by-page; hold both against SHOULD.
5. **Classify** each difference: app wrong / team wrong / both wrong / cosmetic /
   convention — naming which leg disagrees with SHOULD.
6. **Trace** an app fault: generated doc → form cell → parser → source page →
   exact mechanism.
7. **Fix the mechanism, test-first** (deliberately-broken test first), then all
   suites + byte-for-byte build + RA gate green.
8. **Report**: rendered pages + one line per finding.

Standing guardrails:
- **No finding without a rendered image and a re-run of the ship code.** Anything
  that dissolves on evidence is dropped, not argued. (This session killed B6, B17,
  B3 that way.)
- **FILED is evidence, not gospel** — it can be a superseded draft, an unexecuted
  study, or a convention (White Oak's bedrooms-only tenant notice) that isn't the
  truth. The study/schedule sources are the truth.
- **Precedence & design decisions are Matt's**, surfaced not flipped: UA order
  (UAF→RS→RCS), HUD-vs-study SAFMR for the 150% ceiling, tenant-notice unit-type
  format, the at-most-one-UAF-per-year rule.
- Work only on `rcs-audit`; never deploy to main; delete any `ZZ-CORPUS-*` scratch
  data written to the live account and confirm the property count returns to base.
- Tools kept: `drive.js` (real app), `rdiff.js` (pixel diff), `ocr-cache.js`
  (app's own OCR). Native `Read` of a rendered page for the ordinary "does it look
  right" check.

---

## 1. Reading / parsing (the input side)

### 1a. RCS study reader — `rcs.js` `RCSParse.readLetter`
The appraiser's transmittal letter / rent-comparability grid. Nine studies, four
firms, five row grammars.
- **Sender block** (`readSender`): appraiser name, title, firm, phone, email,
  street address, signature split — each read, none bleeding into the next.
- **Row grammars** (`ROW_MAIN`, `ROW_CS6`, `ROW_5C`, `ROW_CMP`, `ROW_4C`): every
  concluded rent row is read; **no row silently dropped** because a firm prints the
  comparability flag spelled-out, columnar, or off the expected line.
- **Unit type** (`parseType`/`typeStem`): br / ba / designation parsed; a type with
  a designation ("1 BR E") not collapsed with its plain sibling.
- **SAFMR base** (`applySafmrBase`): the 150%-SAFMR base lands on the right unit
  type; the townhouse/garden fallback (`typeStem`) doesn't orphan a row.
- **Verdict** (150% conclusion): the appraiser's own over/under conclusion read,
  and a tie handled deterministically.
- **Scanned study**: a text-less scan yields nothing from the text path **by
  design** — it must reach OCR, not be reported as a parse failure.

### 1b. Rent-schedule reader — `app.js` `parseRsPdf` (now always-OCR)
HUD-92458. After the merge, OCR runs on **every** schedule; text/fields win each
cell they can read.
- **Always-OCR**: confirm OCR runs even when tier 1/2 read something — the "full
  picture" pass, so image-only rows are never missed.
- **Tier precedence**: tier 1 (AcroForm fields) and tier 2 (positional text) values
  win a cell over OCR where present, because text is exact.
- **Reconciliation gate** (`rsRecordHolds`): parsed rents sum to the schedule's
  printed total; watch the fail-open case where the total itself isn't readable.
- **Everything read**: `units[]` (type, count, current rent, ua), `ns8[]`
  (non-Section-8), `nonrev[]` (non-revenue, incl. a real $0 rent), Part B `_checked`
  states, `principals[]`, scalars (`property.name`+alias, `property.fha`,
  `property.s8`, `owner.entity_name`/type, `sig.*`), and `rs_date` → effective date.
- **Widget `/V` vs text layer**: HUD-92458 values live in the widget value, not the
  page text; a flattened/e-signed copy moves them into artwork (OCR territory).

### 1c. OCR tier — `ocr.js`
- Runs the app's own page-splitting, template geometry, and field placement (via
  `ocr-cache.js` centrally in the sweep).
- Field assignment isn't by vertical distance alone (a value snapping to the wrong
  row label).
- Skips **loudly** where the rasterizer/endpoint is absent — never a silent pass.

---

## 2. The form — every section, field, and behavior

The 12 sections (`SECTION_TITLES`); visibility depends on the cycle's programs
(`visibleSections`): RCS shows all, OCAF/UAF/BBRA show a subset.

### Section 1 — Source documents
- Each uploaded source names itself correctly (RS vs study vs tracker).
- Tier badge shown (fields / text / OCR) reflects how it was actually read.
- A parse populates the right cells and tags them provenance-correctly.

### Section 2 — Property
Fields: `property.name`, `tenant.property_alias`, `property.addr` (street/city/
state/zip), `owner.entity_name`, `owner.entity_type` (select), `property.s8`,
`property.fha`.
- Name vs alias split correct (the "known to tenants as" second name).
- **`property.s8` ≠ `property.fha`** — distinct fields, not cross-filled.
- Entity type from the fixed `ENTITY_TYPES` list; "other" free-text when needed.
- Address parts join without stray commas when parts are blank.

### Section 3 — Point of contact & signatory
Fields: `poc.name`, `poc.email`, `poc.phone` (phone-formatted), `sig.name`,
`sig.title` (+ `sig.principal`).
- Signatory title composes as "<title> of <principal>" with **no inserted
  article** ("of General Partner", not "of the General Partner").
- Phone input formats/validates; email is an email.

### Section 4 — Contract administrator
Fields: `ca.name` (+ `ca.prefix`), `ca.position`, `ca.org`, `ca.addr`.
- CA org present (it's named in the cover, owner letter, tenant notice, cert).
- Salutation/prefix handling correct.

### Section 5 — Appraiser
Fields: `appr.name`, `appr.firm`, `appr.addr`, `appr.email`, `appr.phone`.
- Name vs firm distinct (owner letter names both; firm alone left "The RCS
  appraiser's (, Smith & Co)").
- Email/zip read from the study land in the right cells (not swapped).

### Section 6 — Rents & unit mix
Per unit row `units.N.*`: `br`, `ba`, `label` (designation), `num_units`,
`current`, `proposed`, and the allowance + SAFMR sub-cells.
- **Unit types** distinct: two same-bedroom types (br+ba+designation) never
  collapse to one row.
- **Allowance source** `ua_source` resolves **UAF → RS(exec) → RCS(study)**:
  `ua_uaf`, `ua_exec`, `ua_rcs`, `ua_custom`; the "UAF submission" dropdown option;
  a same-year standalone UAF's `ua_uaf` overlaid onto an RCS/OCAF sibling.
- **Counts** match the study and the schedule.
- **Proposed rents** present for RCS; OCAF/UAF fall proposed→current.
- `ns8[]` non-Section-8 rows and `nonrev[]` non-revenue rows handled (a
  superintendent unit is a **type**, not a "use"; its $0 rent is real, not blank).

### Section 7 — Items included in rent (Part B)
`PARTB`: equipment (Range, Refrigerator, Air Conditioner, Disposal, Dishwasher,
Carpet, Drapes), utilities (Heating, Cooling, Hot Water, Cooking, Lights),
services (Parking, Laundry, Swimming Pool, Tennis Courts, Nursing Care,
Linen/Maid Service).
- A definite on/off read from the schedule is written either way; a write-in only
  when actually found.
- Fuel/write-in fields carry their text.

### Section 8 — Owner's checklist (17 items)
`CHECKLIST_FLAT` — the 17 items from "Signed cover letter" through "Gross rents vs
SAFMR comparison".
- Each item's state and the signature/date; **no signing date claimed on an
  unsigned checklist**.
- Property name prints 18pt across the head of the generated form.
- Filed checklist font offset (ASCII−29) handled when reading a filed copy.

### Section 9 — Tenant notice
Fields: `tenant.sender_name`, `tenant.sender_title`, `tenant.mgmt_address`.
- Sender name/title present (the notice is signed by the sender).
- Management address composes cleanly.

### Section 10 — OCAF rent adjustment (HUD-9625)
- Published OCAF factor present (without it, lines N–R print dashes and Step 3
  lists current rents as "adjusted").
- Worksheet math (Steps 1–3), Exhibit A, and the debt-service evidence for a
  floating rate.

### Section 11 — Utility allowance factors (UAF)
- UAF-only is a first-class package; the standalone UAF form's sections.
- **At most one UAF per property per year** — the creation modal + pill toggle
  block a standalone-UAF *and* an RCS/OCAF+UAF in the same year, offering a move.
- UAF calc applies to the executed baseline; the result feeds the sibling's cell.

### Section 12 — Principals
- `principals.N.name`/`title` rows read from the schedule and printed where HUD
  requires the ownership principals.

### Cross-cutting form behavior
- **Provenance colors** (`CLR`): database (blue, "On file"), this-cycle (teal),
  overridden (amber), auto-calculated (blue), new (grey) — a cell paints the color
  its origin actually warrants; no cell painted a color it can't justify.
- **Source dropdowns**: the chosen source resolves the value; `defUaSrc`/
  `defSafmrSrc` defaults; a PM-set source overrides the default.
- **Save / revert** (`core.js`): `db_value` recorded so clears/unchecks persist and
  a later edit reads as an override; `coupledKeys` keep value↔source paired.
- **Dirty tracking & `_pending`**: every mutating handler updates `_pending` and the
  undo run; no phantom-dirty from an async refresh (SAFMR/HUD auto-pull) marking a
  cell changed when the user didn't.
- **RA-lock**: property name and effective date lock when `RASource` answers
  (`?ra=1`); locked cells don't accept edits and show the lock.
- **Section rail** status (ok/warn) and the confidence count reflect real
  completeness (`score.js`), not a stale count.
- **Keyboard**: Enter commits, Escape reverts, on every kind of cell (text, select,
  checkbox, source dropdown, conflict buttons) — a keystroke actually **reaches**
  `save()`.
- **Delivery gates**: "Update database" / "Generate package" enabled only when the
  record supports it.

---

## 3. The 150% SAFMR test — `analysis()` / `overCeiling` / `safmrResolvedOf`
- **Which SAFMR is used vs labeled**: the ceiling resolves via `safmrResolvedOf`
  (default `defSafmrSrc` prefers study/rcs) while the summary caption says "the HUD
  pull is used" — compute and label must agree. *(Open precedence decision — Matt's
  call: HUD-published vs appraiser's study figure for the compliance ceiling.)*
- Ceiling = 150% × SAFMR per unit type; gross rent (proposed + UA) compared to it.
- A conflict (HUD ≠ study SAFMR) surfaced, not silently resolved the wrong way.
- A ceiling needs both a SAFMR and a unit count present.

---

## 4. Generation — every document (`gen.js`)

For each: the required fields print (`DOC_REQS`), the values are correct against
SHOULD, and it **refuses to print wrong rather than print a guess** (blank over $0
where nothing was entered). `rdiff` OURS vs FILED for each.

- **Cover letter** (`coverLetter`): property name, S8 #, CA name+org, POC, signatory
  name+title; closing sentence names who the CA calls.
- **Owner letter** (`ownerLetter`): + ownership entity, appraiser name+firm; the
  perjury certifications name appraiser (2) and POC (7).
- **Owner's checklist** (`fillChecklist`): property name 18pt header; signatory;
  no date on an unsigned copy.
- **Rent schedule HUD-92458** (`fillRentSchedule`): header (name, FHA #, effective
  date — the *resolved* date, not a plain key — mortgagor entity Part F, Part G
  signature); Part A unit rows with the **full br/ba/designation label** (`utype`);
  UA per resolved source; gross = proposed + UA; the form's own AcroForm arithmetic
  (`/CO`, `/AA`) preserved and calculating; Part A at one font size; non-revenue row
  states a zero, not a blank or an invented rent; potential foots correctly.
- **Tenant notice** (`tenantNotice` / `uaTenantNotice`): 24 CFR 245 served notice;
  date of notice starts the 30-day clock (stamped in ET, not UTC); a never-entered
  rent prints blank not "$0"; property name in its ~six sentences; CA org named;
  signed by the sender. *(Unit-type label format = Matt's convention call — filed
  notices are bedrooms-only.)*
- **OCAF worksheet** (`ocafWorksheet`) + **Exhibit A** (`exhibitA`): published
  factor; Steps 1–3 math; adjusted contract rents (not the current rents relabeled).
- **Debt-service evidence** (`dsEvidence`): only for a floating rate; certifies the
  comparison it actually made.
- **UAF certification** (`uafCert`): factor applied to the executed baseline; no
  utility read as a decrease because it was simply never factored.
- **Tenant-comment certification** (`tenantCommentCert`): addressed to CA by name;
  headed by the ownership entity (not "[Ownership Entity Name]").
- **Rent analysis workbook** (`xlsx`): row labels = `utype` (br/ba/designation), the
  same as the schedule; figures match; accounting formats (parentheses, leading
  zeros) not normalized away.
- **Entity name**: a real ownership entity everywhere, never a "[placeholder]".

---

## 5. Carry-forward & cycles — `db.js` / `db.supabase.js`
- **Durable vs per-cycle** (`isPerCycleKey`): unit mix, Part B, addresses carry;
  rents, SAFMR, appraiser, dates are per-cycle.
- **Dominant cycle** drives the menu card/unit count; a new cycle carries the right
  durable data and starts the per-cycle data fresh.
- **Effective-date precedence**: Related Affordable date > schedule date; per-cycle,
  non-carrying, stays this package's answer even if the RA database later differs.
- **UAF overlay**: a same-year standalone UAF's `ua_uaf` reads into an RCS/OCAF
  sibling that owns none, never overwriting a value the sibling already saved
  (freeze-on-save; live until then).
- **API parity**: `db.js` (test stand-in) answers identically to `db.supabase.js`
  (the real backend) — cycles, directory, everything.

---

## 6. Tracker — `hap.js`
- **Date reading** (`toISO`): ISO, US month-first, two-digit year, Excel serials,
  Date objects, a time component keeps the date; a small number isn't a serial.
- **Concurrency**: a renewal binds to the correct package/cycle, not an adjacent one
  (two renewals in one year, e.g. Luther Towers).
- **Action determination** (`actionFor`/`isStartable`): the tracker can date the
  cycle; a nearest-startable row picked correctly; option terms ending mid-schedule
  handled (Bastrop, Fox Hill, Mad River).
- **Tolerant column matching**: renamed columns, ISO dates, Excel serials, bare
  arrays all accepted; `diagnose()` says *why* when they can't be.

---

## 7. Scoring — `score.js`
- **Three-gate ladder** (steps of 5): 30 = record is real; 70 = every document in
  the package has its source; 100 = nothing left to enter.
- **`packageDocs`** lists the right documents per program (RCS / OCAF / UAF / BBRA).
- The score is pure over `read(key)` — the form, menu card, and launcher all agree.
- A gate reports the denominator ("3 of 12 blockers left"), not just what's missing.

---

## Known open items (Matt's decisions, not app bugs)
- **UA precedence** — UAF → RS → RCS (implemented; confirm end-to-end).
- **SAFMR precedence** for the 150% ceiling — HUD-published vs study figure (B1:
  compute uses study, caption says HUD).
- **Tenant-notice unit-type format** — full br/ba/designation vs filed bedrooms-only.
- **At-most-one-UAF-per-year** — enforced at modal + pill (confirm the move flow).
