# RCS Audit Procedure

The formal procedure for auditing whether this app produces correct HUD Section 8
renewal packages, and repairing it where it does not. It is the operating manual:
what to inspect, how to inspect it (visually, textually, by execution, and by
interaction), and how to orchestrate the work efficiently.

Read alongside `FORM-RULES.md` (the invariants you must not break when *editing* the
form) — this doc is *what to inspect for correctness when auditing it.*

---

## Part I — Mandate & standing principles

**The mandate.** Prove the app produces correct HUD renewal packages, and **fix the
app where it doesn't.** Not write reports — leave the app better. Fix by *mechanism*,
never per-property, and never from a single case.

**The non-negotiables** (each was learned by getting it wrong):
- **No finding exists without a rendered image and a re-run of the ship code.** A
  claim from code-reading alone is a hypothesis, not a finding. Anything that
  dissolves on evidence is dropped, not argued. (This week that killed three
  "confirmed" bugs: a scanned PDF read as a parser fault, a filed convention read as
  a generator fault, a round/floor tradeoff read as a date bug.)
- **FILED (THEIRS) is evidence, not gospel.** A filed document can be a superseded
  draft, an unexecuted study, or a convention (bedrooms-only tenant notices) that
  isn't the truth. **SHOULD comes from the sources you read by eye**, not from what
  the team filed.
- **Precedence & design decisions are the owner's, surfaced not flipped:** UA order
  (UAF→RS→RCS), HUD-vs-study SAFMR for the 150% ceiling, tenant-notice unit-type
  format, at-most-one-UAF-per-year.
- Work only on `rcs-audit`. Never deploy to main. Delete any `ZZ-CORPUS-*` scratch
  written to the live account and confirm the property count returns to base.

**The living-checklist mandate.** Every run, stay alert for **at least one new
auditable item** drawn from *actual usage of the site* — a behavior the checklist
doesn't yet name. **Never invent one to pad the list.** A candidate earns its place
only if it is real, observed, and checkable. A run that surfaces none is a valid run;
a forced item is worse than none.

---

## Part II — The per-package loop (the spine)

One real package (property + cycle) at a time:

1. **SHOULD** — read the *sources* by eye (appraiser study, executed prior rent
   schedule, UAF/tracker data). Write what the package must say: rents, UAs, unit
   types, counts, dates, names. This is the referee, and it comes from the sources.
2. **OURS** — drive the real app **here** to generate the package (all six documents
   + the workbook).
3. **THEIRS** — pull what the team actually filed for that package.
4. **Inspect three ways** — SHOULD vs OURS vs THEIRS, by the methods in Part III.
5. **Classify** each difference: **app wrong / team wrong / both wrong / cosmetic /
   convention** — naming which leg disagrees with SHOULD.
6. **Trace** an app fault to its mechanism: generated doc → form cell → parser →
   source page → the exact line.
7. **Fix the mechanism, test-first** (a deliberately-broken test first), then all
   suites + byte-for-byte build + RA gate green.
8. **Report:** the rendered pages + one line per finding. Next package.

---

## Part III — Inspection methods (precisely what is required)

Every artifact gets inspected by the methods marked **required** below. "Looked at it"
means a rendered page a human could open — never a value pulled blind.

| Artifact | Visual | Textual | Executional | Interactive |
|---|---|---|---|---|
| **SHOULD** (sources) | render & read the study/schedule pages | transcribe the figures | — | — |
| **OURS** (generated) | **render every page & look**; `rdiff` vs THEIRS | extract values vs SHOULD | re-run generation on the record | — |
| **THEIRS** (filed) | render & look | extract values vs SHOULD | — | — |
| **The form** | screenshot states & provenance colors | field values vs SHOULD | re-run parser on the real source | **fuzz (Part V)** |
| **The package** | `rdiff` OURS↔THEIRS, page-by-page | per-document value diff | regenerate & re-diff after a fix | — |

**Visual** — render to PNG (poppler, via `rdiff.js`) and open it. `rdiff` OURS↔THEIRS
reports differing pixels, region boxes, and ink deltas — it catches a dropped `$`, a
wrong digit, a row one line low, a `0` where the form prints blank. For the form,
screenshot and read the states and the colored left rule.

**Textual** — extract values and compare to SHOULD. **Never rely on value-compare
alone:** stripping `$` and `,` made "1850" and "$1,850" compare equal and hid a
visibly-wrong document. Textual confirms; visual decides.

**Executional** — reproduce, don't infer. Run the app's own parser on the real source
page; run generation on the real record. A fault you cannot reproduce by running the
ship code is not yet a finding. (A scanned study yielding nothing from the *text*
path is correct — it must reach OCR.)

**Interactive** — the fuzz protocol, Part V.

---

## Part IV — The checklist (what to look for)

### 1. Parsing (the input side)
- **RCS study reader** (`rcs.js` `RCSParse.readLetter`): sender name/title/firm/phone/
  email/address/signature read cleanly; **every concluded rent row read, none dropped**
  because a firm prints the comparability flag spelled-out or columnar; unit type
  (br/ba/designation) parsed; SAFMR base lands on the right type; the 150% verdict
  read. A text-less scan must reach OCR, not read as a parse failure.
- **Rent-schedule reader** (`app.js` `parseRsPdf`, now always-OCR): OCR runs on every
  schedule; tier-1 fields / tier-2 positional text win a cell they can read;
  reconciliation gate (rents sum to the printed total) — watch the fail-open case
  where the total itself is unreadable; everything read (`units[]`, `ns8[]`,
  `nonrev[]` incl. a real $0, Part B `_checked`, `principals[]`, scalars, `rs_date`).
- **OCR** (`ocr.js`): app's own page-split/geometry/placement; field not assigned by
  vertical distance alone; skips loudly where the rasterizer is absent.

### 2. The form (all 12 sections + behavior)
Sections (`SECTION_TITLES`; visibility by program via `visibleSections`):
1. **Source documents** — each source names itself; the tier badge matches how it was read.
2. **Property** — name vs alias split; **`property.s8` ≠ `property.fha`**; entity type
   from the fixed list; addresses join without stray commas.
3. **POC & signatory** — signatory title composes "<title> of <principal>" with **no
   inserted article**; phone/email valid.
4. **Contract administrator** — CA org present (named across cover/owner/notice/cert).
5. **Appraiser** — name vs firm distinct; email/zip land in the right cells.
6. **Rents & unit mix** — unit types distinct (two same-bedroom types never collapse);
   allowance source **UAF→RS(exec)→RCS(study)** + the "UAF submission" option + the
   same-year standalone-UAF overlay; counts match study & schedule; proposed rents
   present for RCS; `ns8`/`nonrev` handled (superintendent = a type, its $0 is real).
7. **Part B** — a definite on/off written either way; write-ins only when found.
8. **Owner's checklist** (17 items) — item states + signature; **no date on an unsigned
   copy**; property name 18pt header.
9. **Tenant notice** — sender name/title; management address composes cleanly.
10. **OCAF (HUD-9625)** — published factor present; worksheet Steps 1–3; Exhibit A; DS
    evidence for a floating rate.
11. **UAF** — UAF-only first-class; **at most one UAF per property per year** (modal +
    pill block a standalone-UAF *and* an RCS/OCAF+UAF same year, offering a move); the
    calc applies to the executed baseline and feeds the sibling.
12. **Principals** — read from the schedule; printed where HUD requires.

Cross-cutting behavior:
- **Provenance colors** (`CLR`): database/blue, this-cycle/teal, overridden/amber,
  auto-calc/blue, new/grey — a cell paints only the color its origin warrants.
- **Source dropdowns** — chosen source resolves the value; defaults (`defUaSrc`,
  `defSafmrSrc`); a PM-set source overrides the default.
- **Save/revert** (`core.js`) — `db_value` recorded so clears persist and later edits
  read as overrides; `coupledKeys` keep value↔source paired.
- **Dirty-tracking / `_pending`** — every mutating handler updates `_pending` + the
  undo run; **no phantom-dirty** from an async refresh marking an untouched cell.
- **RA-lock** — name & effective date lock when `RASource` answers (`?ra=1`); a locked
  cell shows *and* stores its value on every path (FORM-RULES 20).
- **Rail status**, **keyboard reaches `save()`** (Enter commits / Escape reverts on
  every kind of cell), **delivery gates** enable only when the record supports it.

### 3. The 150% SAFMR test
`analysis()` / `overCeiling` / `safmrResolvedOf` — **which SAFMR is used must equal
what the caption says** (open: compute defaults to study, caption says HUD); ceiling =
150% × SAFMR per type; gross (proposed + UA) compared to it; a HUD≠study conflict
surfaced, not silently resolved; a ceiling needs both a SAFMR and a count.

### 4. Generation (every document, `gen.js`)
Each: required fields print (`DOC_REQS`), values correct vs SHOULD, and it **refuses to
print wrong rather than guess** (blank over $0). `rdiff` OURS↔THEIRS each.
- **Cover / Owner letters** — names, S8#, CA, POC, signatory; owner letter adds entity
  + appraiser name/firm under the perjury certifications.
- **Checklist** — 18pt name header; signatory; no date unsigned.
- **Rent schedule (HUD-92458)** — header (name, FHA#, **resolved** effective date,
  Part F mortgagor, Part G signature); Part A rows carry the **full br/ba/designation
  label**; UA per resolved source; gross = proposed+UA; the form's own AcroForm
  arithmetic (`/CO`,`/AA`) preserved; Part A one font size; non-revenue row states a
  zero not a blank/invented rent; potential foots.
- **Tenant notice** — 24 CFR 245; date-of-notice stamped in ET; never-entered rent
  prints blank; property name in ~six sentences; CA org named; signed by sender.
- **OCAF worksheet / Exhibit A** — published factor; Steps 1–3; adjusted rents (not
  current relabeled).
- **DS evidence** (floating only), **UAF cert** (factor on baseline; no false
  decrease), **tenant-comment cert** (to CA by name; entity header, not placeholder).
- **Rent-analysis workbook** — row labels = `utype`, matching the schedule; figures
  agree; accounting formats not normalized away.

### 5. Carry-forward & cycles (`db.js` / `db.supabase.js`)
Durable vs per-cycle (`isPerCycleKey`); dominant cycle drives the card; effective-date
precedence (Related Affordable > schedule, per-cycle non-carrying); the same-year UAF
overlay (freeze-on-save, never overwrites a saved value); **API parity** between the
test stand-in and the real backend.

### 6. Tracker (`hap.js`)
Date reading (ISO / US / two-digit / Excel serial / Date; a time keeps the date; a
small number isn't a serial); concurrency (a renewal binds to the right cycle);
action determination; tolerant column matching with a real `diagnose()` when it can't.

### 7. Scoring (`score.js`)
Three-gate ladder (30 real / 70 every doc sourced / 100 nothing left); `packageDocs`
lists the right docs per program; pure over `read(key)` so form/card/launcher agree;
the score reports the denominator, not just what's missing.

---

## Part V — The fuzz protocol (interactive inspection)

**Purpose.** Randomized interaction with the **real app** to shake out glitches the
deterministic checklist won't — the ones that only appear in the seams between
actions. This is the interactive method from Part III, formalized.

**The interaction vocabulary** — compose random sequences from:
- save · revert · override a saved cell · edit then Escape · edit then leave without
  saving · undo-run (multiple Escapes) · switch program pill (RCS/OCAF/UAF/BBRA) ·
  switch menus (menu → launcher → form) · **leave the form and re-enter** ·
  change something, leave, come back · upload a source · switch a cell's source
  dropdown · toggle a checklist/Part-B item.

**What to watch for** (a reproduced instance is a finding → trace → fix):
- **phantom-dirty** — a cell reads changed after a completed save, or an async refresh
  (SAFMR/HUD pull) marks an untouched cell (FORM-RULES 5/14).
- **lost edit** — a value entered then not persisted, or persisted to the wrong cycle.
- **wrong provenance color** — a cell painting a color its origin can't justify.
- **stuck state** — form stranded dirty, a control that won't commit, Escape not
  walking the run back.
- **crash / console error / silent no-op** on any sequence.

**How to run it.** Drive the real bundle via `?selftest=1` (or the signed-in app),
issue random-but-logged sequences, and after each: snapshot the cell states and the
console. A glitch must **reproduce** from the logged sequence before it's a finding.
This is what `fuzz.js` / `test_fuzz.js` automate; run it, and also drive by hand for
the sequences the harness doesn't script.

---

## Part VI — Orchestration & subagents (how to run it efficiently)

**Model & effort policy:**
- **Default = inherit Opus 4.8 at `high` effort** for the hard jobs: tracing a fault,
  judging a three-way diff, designing a fix, adversarially verifying a finding.
- **Downshift to Sonnet or Haiku, and/or lower effort (`low`/`medium`)** for the
  mechanical jobs: rendering pages, extracting values, running a suite, folding a
  file. Match the tier to the difficulty — a render job does not need Opus.
- **Never `fable`. Never Opus 5.** (Inheriting the parent gives 4.8; never select up.)

**Subagent vs inline:**
- **Fan out subagents** for parallel, self-contained, read-heavy work — read the
  sources for N properties, render+diff N packages, extract values across a set. They
  return **verdict rows / ledger lines, never page dumps** — the conclusion, not the
  file contents.
- **Keep inline** the trace→fix→commit chain, which needs the full working context and
  serializes on the code anyway.

**Orchestration shape:**
1. **Fan-out reads** — one subagent per property (or per document), returning a compact
   three-way verdict (SHOULD/OURS/THEIRS + classification). Concurrency = a few at a
   time, not dozens.
2. **Adversarial verify** — before a candidate finding is "real," a second pass (a
   distinct lens, or a skeptic prompted to refute) must confirm it against the render
   + a ship-code re-run. Findings that don't survive are dropped.
3. **Triage** — surviving findings ranked by severity (wrong money/compliance > wrong
   label > cosmetic).
4. **Repair serially** — code edits can't run in parallel: fix one mechanism
   test-first, run the suites + build + RA gate, commit, then the next.
5. **Report** — render + one line per finding; commit per fix (or per property);
   **push per wave, never only at the end.**

**Token discipline** (spend on depth, not prose):
- Subagents return structured verdicts, not dumps; batch by property; **cache renders**
  (don't re-render the same page); targeted `grep`/`sed`, never re-read the giant
  files (`index.html`, `templates.js`, `pdf-lib.min.js`); scale fan-out depth to the
  remaining budget — fewer, deeper passes when budget is low.

---

## Part VII — Guardrails & housekeeping

- **Live-account safety.** Every drive may write `ZZ-CORPUS-*` rows to the live
  account. Delete only the CYCLES a run created — never properties — and confirm the
  property count returns to base after every run.
- **Branch discipline.** `rcs-audit` only; never commit to or deploy main; never touch
  `shell.head.html` styling or the redesign-lane region without cause.
- **Delivery gates** (before any commit that touches source): `node --check` + **0 NUL
  bytes** on every edited file; `bash run_tests.sh` (only the known redesign-lane
  browser-layout failures allowed); `bash build.sh` reproduces `index.html`
  byte-for-byte; `python3 build-ra.py` prints `built …`.
- **Source-edit safety** — edit source, verify, then let the build/tests catch
  truncation or NULs; recover a corrupted file from the shipped bundle.
- **Token budget** — a hard ceiling, not a suggestion. Keep docs tight; put the tokens
  into the per-package passes.

---

## Appendix — Open decisions (owner's, not app bugs)
- **UA precedence** — UAF → RS → RCS (implemented; confirm end-to-end).
- **SAFMR precedence** for the 150% ceiling — HUD-published vs study figure (compute
  uses study, caption says HUD).
- **Tenant-notice unit-type format** — full br/ba/designation vs filed bedrooms-only.
- **At-most-one-UAF-per-year** — enforced at modal + pill (confirm the move flow).
