# The form-level audit — plan

Written 2026-07-30 against the working tree at `c1a4a3e` **plus uncommitted changes to
`app/full-mp/app.js` and `app/full-mp/smoke_combined.js`** (another session is editing
them: `rcsBrOf` gained a "Studio" string branch, `rcsUnplaced` is new, `rcsMatch` gained
an unplaced-line ambiguity return, `MIN_CHECKS` in the smoke is 165 against CLAUDE.md's
138). Every number below is measured against that tree. If those edits land or are
reverted, re-measure before quoting.

Observation only. Nothing under `app/full-mp/` was modified to produce this.

---

## Does the cheap version work?

**No, not for the reason hoped — and yes, for a better one.** The 68 `_drive.json` files
on disk (34 properties × 2 fill orders) do **not** contain the form record: `drive.js`
snapshots the form exactly twice per property, once as the empty form at creation
(`baseline`) and once after the reload before the second order runs (`after`), and it
persists only the **diff** of those two — which across all 68 files totals **0 rows**,
because both snapshots are of an empty form. No filled cell, no `ua_source`, no
provenance, no colour, no chooser has ever been written to disk by any run. The
input/output pairings that exist are *uploads → generated documents*, and the whole
blind spot is between them.

The cheap route is a different one, and it is cheaper than re-driving. `app.js` already
exports the entire fill seam through `module.exports` — `__setRsParsed`, `__setRcsParsed`,
`__rsFill`, `__rcsFill`, `__UNITS`, `__boxes(i)`, `__rcsMatch(i)`, `__rcsOf(k)`,
`__form()`, `__formSnap()`, `__editCell`, `__saveCell`, `__revertKeys`, `__undoDepth` —
and `smoke_combined.js` already proves the bundle boots in plain node with a stubbed DOM.
**A form-level audit of the fill, the roster, the choosers, the provenance and the undo run
needs no Azure, no Supabase session, no browser and no Drive mount.** It runs in about a
second.

Proof, done while writing this plan: the studio/one-bed defect the user found by clicking
was **reproduced offline in node in one run**, from a synthetic pair of parses, with the
exact symptom he described — including the chooser offering the one-bedroom's allowance on
a studio row while the real one-bed rows show no RCS option at all. See "The reproduction"
below. That took no network calls of any kind.

So: the assumption is wrong about the artefacts and right about the conclusion. Re-audit
cheaply — just not by mining the drives.

---

## What the drives actually persist

`_archive/corpus-cache/_sweep/_out/<code>/<order>/_drive.json`, 68 files, ~8 KB each.
Top-level keys, union across all of them:

| key | what is in it | useful to a form audit? |
|---|---|---|
| `property` `code` `folder` `studyPath` `priorRsPath` `at` | which property, which two documents | yes, as an index |
| `propertyId` `cycleId` `propertyNameUsed` `propertyNameInDocuments` `nameIsPrefix` | identity, and whether the harness's own label leaked into the documents | yes |
| `uploads` | per document: tile name/state/sub, ms, `kind`, `via`, `halfB`, study unit-type **count**, `ocrCalls`, `ocrEndpoints`, `tier` | **yes — this is the one genuinely minable field** |
| `reopen` | `propertyIdMatched` `cycleIdMatched` `formEmpty` `diffs` `leaked` `rsRetained` `rcsRetained` `rsTile` `rcsTile` `held` `heldAfterReattach` `studyReattached` `ocrCallsSinceReload` | facts about the session boundary, but the diffs are empty by construction |
| `warnings` `errors` `console` `dialogs` | prose | yes, as a census of what the app said |
| `order` | `rs-first` / `rcs-first` | yes |
| `result` | `outDir`, `files[]` (name + bytes), `tier`, `rsVia`, `weakerTest`, `pkgText`, `docRows`, `propertyNameInForm`, `ocrCallsSoFar`, warnings/errors/dialogs/console | yes — the six-document readiness rows are here |

What is **missing**, exactly:

- **Any cell value after a fill.** `EX_SNAP` (drive.js:341) reads every `#sections
  [data-k]` value and every `input[data-cb]` checked state — a real full-form snapshot —
  but it is only ever evaluated at `baseline` (before any upload), at `after` (post-reload,
  pre-second-order) and at `after2` (post study re-attach). It is never taken after
  `#rsApply` or `#rcsApply`, and the snapshots themselves are discarded; only
  `diffSnaps(baseline, after)` survives, as `reopen.diffs` / `reopen.leaked`. Both are `[]`
  in all 68 files.
- **`EX_SNAP` would not be enough anyway.** It reads `.value` and `.checked` only. It
  carries no `source`, no `db_value`, no `saved_at`, no `_source`/`_custom`/`_reviewed`
  pointer that is not itself rendered as an input, no computed colour, and no dropdown
  contents. Rule 4 and rule 15 of `FORM-RULES.md` cannot be checked from it.
- **Anything about a chooser.** Grepped across all of `app/full-mp/corpus/*.js`:
  `ua_rcs`, `ua_source`, `uaBox`, `uaopt`, `safmr_source`, `srcedit`, `data-box`,
  `provColors`, `undo`, `Escape`, `isDirty` — **zero matches, every one.** `ua_exec`
  appears once, in `test_extract.js`, as a form-record fixture for an app-side extractor
  test, not as a comparator key. The comparator's fact keys are all printed-document
  values (`total.contract_rent`, `unit.N.type`, `sig.name`, …).

**Cheapest way to start capturing the record, if it is wanted:** `drive.js` already has the
extractor. Add a snapshot call after each `clickApply` in `runOrder` and write the two
snapshots plus a `PROV` extractor (`data-box` → computed `border-left-color` + the `.srctag`
text + the selected `.uaopt`) into the per-order `_drive.json`. That is ~20 lines, adds no
Azure calls, no wall clock worth measuring, and turns every future drive into a form-level
artefact. It should be done **before** the next sweep, not instead of the offline work —
it makes drives more useful, it does not make them cheap.

---

## The reproduction — measured, offline, no network

Instrument: a temp bundle of `core.js score.js db.js hap.js app.js` plus a two-line probe
exposing `_rcsFill` (the module-local fill record), required in node under
`smoke_combined.js`'s DOM stub. Scratch files under
`…/scratchpad/planner/`. Inputs are synthetic: a study that prices **two** lines
(all studios $1,400/UA $80/SAFMR $2,100; all one-beds $1,750/$95/$2,400) against a schedule
with **four** rows (Studio A ×10 @1,200, Studio B ×6 @1,250, 1BR A ×20 @1,500, 1BR B ×8
@1,550).

**Result 1 — inside a single page load, both orders are already correct.**

| order | row 0 Studio A | row 1 Studio B | row 2 1BR A | row 3 1BR B |
|---|---|---|---|---|
| `rcs-first` | 1400 / UA 80 | 1400 / 80 | 1750 / 95 | 1750 / 95 |
| `rs-first` | 1400 / 80 | 1400 / 80 | 1750 / 95 | 1750 / 95 |

That is `04d0609` working: `rsFillFromParsed` re-reads an already-applied study once the
schedule has laid down the real roster (app.js:2373), and register class E is genuinely
closed for this shape.

**Result 2 — the re-read is gated on a page-local variable, and the gate opens the defect
back up across a session boundary.** The guard is
`if(_rcsFill && _rcsUpload && _rcsUpload.parsed)`. `_rcsFill` is a plain module variable
(app.js:2400), assigned in exactly one place (app.js:1393, inside `rcsFillFromParsed`), and
**`openCycleForm` does not restore it** — it clears `_undoStack`, `_undoChain`, `_rsUpload`
and `_rcsUpload`, then rehydrates the two uploads via `rsRecall()`/`rcsRecall()`, and never
touches `_rcsFill`. So on the sequence *apply the study → save → leave the form (or reload)
→ come back → apply the schedule*, the study's reading is rehydrated, its values are on the
form, and the re-read does not fire. Simulated by nulling `_rcsFill` between the two
applies:

| row | printed type | units | current | **proposed** | **ua_rcs** | **safmr_rcs** | UA chooser "RCS report" row | `rcsOf()` answers |
|---|---|---:|---:|---:|---:|---:|---|---|
| 0 | Studio A | 10 | 1200 | **1750** | **95** | **2400** | `$95` — the one-bed's | 80 / 1400 |
| 1 | Studio B | 6 | 1250 | 1400 | 80 | 2100 | `$80` | 80 / 1400 |
| 2 | 1BR A | 20 | 1500 | *(blank)* | *(blank)* | *(blank)* | **DIM — "not available"** | 95 / 1750 |
| 3 | 1BR B | 8 | 1550 | *(blank)* | *(blank)* | *(blank)* | **DIM** | 95 / 1750 |

Both defects, exactly as reported. Rows 2 and 3 also lose their bath (`ba` empty), because
the study's `ba` only reaches the form through the path that did not run.

**The second defect is separable from the first and survives any roster fix.** `uaBox(i)`
(app.js:634) reads `ua_exec` / `ua_rcs` / `ua_custom` off the form and nothing else. It
never asks `rcsOf('units.'+i+'.ua_rcs')`. So the chooser reports whatever the last fill
happened to write into that cell, and the two facts in the table's last two columns can
disagree indefinitely. `safmrBox(i)` (app.js:683) is built the same way. That is rule 2 of
`FORM-RULES.md` — *"a source row carries a value, not just a tag"* — failing in the other
direction: the row carries a value, and it is the wrong row's.

**Hypothesis, from code reading, not measured:** `_rcsFill` is also never *cleared* by
`openCycleForm`, so within one page load it stays truthy after moving to another package or
property. Two consequences follow if so — clicking Apply on a schedule would trigger a
study re-read on a package where the study was never applied (which the code's own comment
at app.js:2368 says must not happen), and `fillNote(_rcsFill, up)` at app.js:2414 would let
one package's tile claim *"Filled N values"* about another's. This is the same bug shape
rule 19 already names for `_rsUpload`. Worth one check each.

---

## The inventory — measured, not guessed

Instrument: the bundle rendered under the node DOM stub; counts taken off
`document.getElementById('sections').innerHTML` after `openCycleForm`.

### The key space

| | count |
|---|---:|
| keys in the `SEED` manifest (= `ALL_KEYS`, = the store's field list) | **148** |
| keys in the live form record on a freshly opened one-row package | **149** |
| sections in `SECTION_TITLES` | **12** |
| sections declared in `FIELD_SECTIONS` (the plain-field renderer) | 5, carrying **23** field entries |
| owner's-checklist items (`CHECKLIST_FLAT`) | **17**, of which 2 conditional (`CHECK_CONDITIONAL` = items 2 and 14) |
| Part B items (`PARTB`) | **18** — equipment 7, utilities 5, services 6 |
| composite address groups (`ADDR_GROUPS`) | **4** |
| UAF utility categories | **4** |
| provenance colours (`CLR`) | **5** — database, this-cycle, overridden, auto-calculated, new |

`SEED` by prefix: `partb` 48 · `units` 19 · `check` 17 · `ocaf` 11 · `ca` 8 · `appr` 8 ·
`tenant` 8 · `property` 7 · `uaf` 7 · `rent_schedule` 4 · `owner` 3 · `poc` 3 · `sig` 3 ·
`principals` 2.

The 19 keys on **one** `units.*` row — this is the real denominator for anything
roster-shaped: `br ba label num_units current proposed ua_exec ua_rcs ua_source ua_reviewed
ua_custom safmr_rcs safmr_hud safmr_source safmr_reviewed uac_oil uac_gas uac_electric
uac_water`.

Provenance-bearing keys in the manifest: **5** `*_source`/`*_src`, **3** `*_custom`, **2**
`*_reviewed`. Per unit row that is 3 of the 19.

### The rendered controls

`data-k` counts are distinct keys (they equal occurrences — no key is rendered twice, which
is itself worth an assertion).

| | 1 unit row, RCS only | RCS+OCAF+UAF | 4 unit rows | 6 units + 1 non-rev + 1 non-S8 |
|---|---:|---:|---:|---:|
| `input[data-k]` | 46 | 54 | 61 | 76 |
| `input[data-cb]` | 35 | 35 | 35 | 35 |
| distinct `data-box` (cell identities) | 35 | 43 | 56 | 77 |
| dropdown triggers `.uatrigger` | 38 | 38 | 62 | 87 |
| dropdown option rows `.uaopt` | 231 | 231 | 325 | 419 |
| — of which source rows `.srcopt` | 46 | 46 | | |
| — of which **dim** (`.srcdim`, nothing to offer) | 41 | 41 | | |
| `csDrop` option rows (`data-csopt`) | 179 | 179 | | |
| — distinct `csDrop` keys | 8 | 8 | | |
| `[data-srcedit]` inputs | 3 | 3 | | |
| `[data-csclear]` | 2 | 2 | | |
| `[data-fuel]` / `[data-fuel3]` | 5 / 1 | 5 / 1 | | |
| `[data-wibox]` write-in ticks | 12 | 12 | | |
| `[data-save1]` save ticks | 82 | 90 | 106 | 131 |
| `[data-rev]` revert arrows | 79 | 87 | | |
| `[data-money="1"]` | 5 | 9 | | |
| UA choosers (`data-uaopt` rows) | 3 | 3 | | |
| SAFMR choosers (`data-safmropt` rows) | 3 | 3 | | |
| provenance-painted boxes (`border-left-color`) | 35 | 43 | 56 | 77 |

**Marginal cost of one unit row: +5 `data-k`, +7 `data-box` cells, +8 dropdown triggers,
+~31 dropdown option rows, +8 save ticks, +5 record keys.** A 10-row property carries
roughly **125** cell identities and **135** dropdown triggers.

### The cell kinds

Seven, by how they take input — not by CSS class:

1. plain text (`input[data-k]`, no `data-money`)
2. money text (`input[data-k][data-money="1"]`)
3. phone text (`data-phone`, guarded by rule 18 in three save paths)
4. `csDrop` enumerated dropdown (`data-csopt` / `data-cskey`) — 8 distinct keys
5. checkbox (`input[data-cb]`) — 35, including the 17 checklist ticks and 18 Part B items
6. chip / write-in tick (`data-fuel`, `data-fuel3`, `data-wibox`) — 18
7. source chooser (`data-uaopt`, `data-safmropt`, `data-deffopt`, `data-ocfopt`, plus the
   `srcPick` menus grafted onto text and `csDrop` cells)

### The source choosers

Six mechanisms, and they do not share a code path:

| mechanism | site | reads | rows offered |
|---|---|---|---|
| `uaBox(i)` | app.js:634 | stored `ua_exec` / `ua_rcs` / `ua_custom` | Executed RS · RCS report · Custom |
| `safmrBox(i)` | app.js:683 | stored `safmr_hud` / `safmr_rcs` / `safmr_custom` | HUD API · RCS report · Custom |
| `srcPick(k, rows)` | app.js:445 | `SRCPICK_ROWS[k]()` — **13** registered keys — calling `rsVal`/`raVal`/`rcsVal` **live** | per key |
| `DIR_SRCROW` | app.js:488 | `{tag, val:()=>…}` — **2** keys (`appr.name`, `sig.name`) | 1 |
| `moneySrcRows(k)` | app.js:495 | live | per key |
| `rsCsRow(k)` / `rcsCsRow(k)` | app.js:1062/1068 | `rsBrBa`/`rcsBrBa`, **live** | grafted into `csDrop` |

**The split that matters:** four of these six read the parse **live**, and two —
`uaBox` and `safmrBox`, the only two with the money in them — read cells written once at
fill time. That asymmetry is the second defect above, and it is a structural fact of the
inventory rather than one property's bad luck.

### The shape census — how many corpus properties can even show the defect

From `sweep-7.json` (34 properties, sha `e2c0080`), the study's unit-line count comes from
each `_drive.json`'s `uploads.rcs.units`; the form's row count is the highest `unit.N.*`
index the comparator emitted. **The row figure is a floor** — it only exists where the
analysis workbook was read, so seven properties are unknown and none can be shown to have
*fewer* rows than study lines.

| relation | properties |
|---|---:|
| form rows **>** study lines (the crossover shape) | **8** |
| equal | 19 |
| fewer | 0 |
| not measurable | 7 |

The eight: Oak Center 5→10 · Marine Terrace 3→6 · Hampshire House 2→5 · Ebony Gardens
4→5 · Fairview Homes 3→4 · Woodbury Oakwood 2→3 · Colonial Village 2→3 · Morh Housing 2→3.
Nearly a quarter of the corpus, and the register's class-E list (Ebony 26 rows, Peterson 24,
Oaks 16, Walden 6, Marine Terrace 4, Morh 3, Fairview 2, Woodbury 2) overlaps it heavily.

### The comparator's noise, measured

`sweep-7.json`, the last full 34-property sweep:

| status | rows | share |
|---|---:|---:|
| `missing-theirs` | 861 | **58.7 %** |
| `match` | 298 | 20.3 % |
| `mismatch` | 194 | 13.2 % |
| `missing-ours` | 113 | 7.7 % |
| **total rows** | **1,466** | |
| plus boilerplate `drift` lines | 994 | |

`missing-theirs` by document: rentSchedule 496 · checklist 212 · analysisXlsx 153. On the
**checklist, 212 of 231 rows (91.8 %) are `missing-theirs`** — the handoff already
established the comparator cannot read a filed checklist's ticks at all, because they are
glyphs in an offset font or drawn by DocuSign. So of 2,460 emitted lines, **194 carry a
disagreement**: a 7.9 % signal-to-noise ratio, and every one of the 194 has to be found by
hand inside the other 2,266.

`fillOrder` — the one arm that needs no ground truth — carried **83 rows across 8
properties** in sweep-7 (24 in wave-2, 50 in sweep-1). `sweep.js` tallies it into a markdown
table and a `counts.fillOrder` integer. It exits non-zero only on an uncaught throw
(sweep.js:476) or bad arguments (sweep.js:59). **An order-dependent package has never
failed a run.**

---

## The phases, cheapest first

Cost legend: **Azure** = billable OCR pages · **session** = needs Matt signed in (only he
can sign in; `signin.js` is his to run) · **chromium** = needs a local headless chromium ·
**Drive** = needs the corpus mount.

### Phase 0 — silence the comparator before comparing again

*Measures:* nothing about the app. It fixes the instrument.

*Instrument:* `corpus/compare.js` + `corpus/extract.js`, guarded by
`corpus/test_compare.js`.

*Cost:* no Azure, no session, no chromium. Half a day of reading. The register's own
"order of work" already puts this first, and it is still first.

*What to do:*
1. **Retire the rows where only one side has a field.** `analysisXlsx :: property.name`
   and `:: appr.firm` are 54 rows across 27 properties because the team's workbook titles
   itself in free text and carries no appraiser firm. Those are template asymmetry, not
   differences. They belong in a `notComparable` bucket with a stated reason, not in `rows`.
2. **Make an unreadable filed side a property-level fact, not N row-level ones.** When the
   extractor gets nothing from a filed document, emit **one** row saying so and suppress the
   per-key rows. That removes ~861 rows and loses nothing: the information content of 496
   rentSchedule `missing-theirs` rows is "we could not read the filed schedule."
3. **Stop emitting checklist rows at all** until the tick reader exists. 212 of 231 are
   noise and the remaining 19 cannot be trusted either — any claim about a filed tick is an
   eye-read (established 2026-07-30).
4. **Separate `drift` from `rows` in the report** and put the 301-line constant floor
   (present in every sweep from sweep-1 to sweep-6) behind a one-line summary.

*Failure looks like:* the report still needs a human to read 2,400 lines to find 194
findings. Success is a report whose row count is within a small factor of its finding count.

*Permanent home:* `corpus/test_compare.js`. It already holds "the rules that must NOT
normalise"; add "the rows that must NOT be emitted", with the 54-row and checklist cases
named. Raise `MIN_CHECKS` from 91.

### Phase 1 — mine what the drives already hold

*Measures:* the reading tier per property per order, OCR calls billed vs tier used,
`halfB`, study unit-type counts, the six-document readiness rows (`docRows`), the reopen
facts (`formEmpty`, `rsRetained`, `rcsRetained`, `ocrCallsSinceReload`, `held.hasBytes`),
and every warning string the app produced.

*Instrument:* a read-only node script over the 68 `_drive.json` files. Nothing is driven.

*Cost:* seconds. No Azure, no session, no chromium, no Drive.

*Honest expectation: a small yield.* Everything above is already summarised in
`sweep-*.json` and the register. The one thing worth extracting fresh is the **cross-order
consistency of `uploads`** and a census of the warning strings — "how many properties ever
saw this sentence" is a question nobody has asked, and the app's warnings are the only
per-property record of what it declined to do. Two hours, then stop; this is not where the
defects are.

*Failure looks like:* a finding that turns out to be already in the register. Check the
register first.

### Phase 2 — the inventory as a machine-readable census, with a floor

*Measures:* the numbers in this document, as assertions.

*Instrument:* `smoke_combined.js` (it already builds its own bundle and renders the form).

*Cost:* seconds. No Azure, no session, no chromium.

*What to assert:* 148 `SEED` keys · 12 sections · 17 checklist items with exactly 2
conditional · 18 Part B items · 4 address groups · 5 provenance colours · 19 keys per unit
row · 46 `data-k` / 35 `data-cb` / 35 `data-box` on a one-row RCS package · **no `data-k`
rendered twice** · the marginal cost of a unit row (+5 keys, +7 boxes, +8 triggers) · 13
`SRCPICK_ROWS` keys · 2 `DIR_SRCROW` keys.

*Why it is worth the checks:* every one of these is a denominator. A control that quietly
stops rendering — rule 13's failure mode, `refreshPrincipalOpts` dropping a dim row — is
invisible today because nothing counts. And a plan written on top of "roughly a hundred
controls" cannot say what fraction it covers.

*Failure looks like:* a count moved and nobody meant it to. That is the whole point; the
check names the number so the diff is a decision.

*Permanent home:* `smoke_combined.js`. Raise `MIN_CHECKS`.

### Phase 3 — the invariants, as assertions rather than statistics

Four. Each is a property of the whole record, each is checkable in node, and each currently
either is not checked or is checked and then tallied.

**3a — order-independence of the whole record.** Today `sweep.js` compares the two orders'
**generated documents** and counts the rows. The invariant is stronger and cheaper: fill a
form both ways from the same two parses and assert `__form()` is key-for-key identical,
**value and `source`**. Run it over synthetic shapes (phase 4) and over every corpus study
whose parse is cached. **This must fail the run**, not increment a counter — 83 rows across
8 properties in the last full sweep, and the register calls it "highest severity, no ground
truth needed."

**3b — the session boundary.** Rule 19 was written for `_rsUpload` and the same class is
live in `_rcsFill`. The invariant: for any sequence of applies interrupted by
`openCycleForm`, the record is the same as the uninterrupted sequence. Concretely — apply
study, reopen, apply schedule must equal apply study, apply schedule. Measured above: it
does not. Also assert the converse, that opening a *different* package cannot inherit a
fill record (the hypothesis above).

**3c — save / revert / undo leaves no residue.** `FORM-RULES` "Before you deliver" item 6
already specifies it: for every control, make the change, take it back, assert `isDirty()`
is false **and** diff `__form()` against `__formSnap()` key by key, because `isDirty()`
compares values only. `test_browser.js --full` does this for ~110 controls through real
keys. What is missing is the node-side equivalent over the **full inventory including
multi-row rosters** — `--full` drives the seeded property, and the count of controls scales
with unit rows, so a 10-row property has ~125 cells the sweep has never touched. Add the
undo run: N edits then N Escapes must return the record to where it started, one cell per
press (rule 12).

**3d — provenance colour matches actual source.** Rule 4's failure mode is a cell painted
from a key that does not exist (`ocaf.factor_source` vs `ocaf.factor_src`). The invariant:
for every `data-box`, the rendered `border-left-color` equals `CLR[srcOf(theBoxKey)][0]`,
and the box key is one the record actually holds. 35 boxes on a one-row package, 77 on a
six-row one — enumerable, so assert all of them rather than sampling. This needs the
rendered HTML, which the node harness has.

*Cost, all four:* seconds each. No Azure, no session. 3d wants the real browser as well
(provenance is painted twice — `renderBody` and `paintCell` — and a node check sees only
one), so it lands in both harnesses.

*Failure looks like:* a red suite. That is the change: these become gates, not columns.

*Permanent home:* 3a and 3b in `test_interactions.js` (it already drives the real store and
the decision logic). 3c extends `test_interactions.js` for the node half and
`test_browser.js --full` for the keys. 3d in `smoke_combined.js` for the render and
`test_browser.js` for the repaint.

### Phase 4 — synthetic shapes, because the 34 do not contain the awkward cases

The corpus is what the portfolio happens to be. Eight of its properties have more rows than
study lines; **none** has fewer, none has a variant with no match, and the register's own
gaps (a genuine $0 allowance, a non-revenue row, a study whose counts disagree) each appear
on one or two properties at most. Enumerate the shapes instead.

*Instrument:* the node harness used for the reproduction above — `__setRsParsed` /
`__setRcsParsed` / `__rsFill` / `__rcsFill`, then read `__form()`, `__UNITS()`,
`__boxes(i)`, `__rcsMatch(i)`, `__rcsOf(k)`. Both orders, and both orders across a reopen
(3b). Each shape is ~15 lines of fixture.

*Cost:* seconds for the whole matrix. No Azure, no session, no chromium, no Drive.

The matrix, each row a fixture:

| # | shape | what it should prove |
|---|---|---|
| 1 | study 2 lines, schedule 4 rows (2 studio variants, 2 one-bed variants) | **the reported defect.** Every row gets its own bedroom count's figures; no chooser offers another shape's allowance |
| 2 | study 4 lines, schedule 2 rows | the two extra study lines bring their own rows, and nothing is silently dropped |
| 3 | two variants sharing **both** br and ba, different unit counts | the count tiebreak (`rcsMatch`, `by:'count'`) resolves it |
| 4 | two variants sharing br and ba, **identical** unit counts | genuinely ambiguous: fills nothing and **says so**. Never guesses |
| 5 | a schedule row whose bedroom count no study line matches | the row keeps the schedule's figures, its RCS chooser row is honestly dim (rule 1), and no other line's rent lands on it |
| 6 | a study line the schedule has no row for | the homeless path builds the row, once, in either order |
| 7 | a **$0** allowance stated by the schedule | survives. The register records this twice as a real value that a `>0` test threw away |
| 8 | a $0-rent non-revenue row (superintendent's unit) | prints 0, occupies a `nonrev.*` row and **not** a `units.*` row (register M2/M3) |
| 9 | a non-revenue row whose br/ba matches a priced study line | does not take the market rent for a unit that earns nothing |
| 10 | study unit counts disagreeing with the schedule's | the conflict is visible (`num_rcs` beside `num_units`), the schedule wins the printed figure, and the disagreement can be approved |
| 11 | a study line with a figure but an unparseable bedroom count | the new `rcsUnplaced` path: ambiguous rather than broadcasting the other line's rent (this is what the uncommitted app.js edit adds — the fixture should exist either way) |
| 12 | schedule and study listing the same two types in **opposite** orders | already covered by `test_browser.js` (the Barnum House case); keep it, and add the 2-vs-4 variant of it |
| 13 | ten unit rows | the row-scaling counts from phase 2, and the ~125-cell round-trip sweep of 3c |

*Failure looks like:* a fixture that cannot be written because the parse shape does not
allow it — which is itself a finding about `rcs.js` or `parseRsPdf`.

*Permanent home:* `test_interactions.js`, one block per shape, each named for the corpus
property that motivates it where one exists (Hampshire House for #1, Oak Center for #13,
Ebony Gardens for #7, Morh Housing for #8, Lansing Manor for #3, Barnum House for #12) and
for the shape itself where none does. Raise `MIN_CHECKS` once, at the end.

### Phase 5 — human sequences, not controls

*Measures:* what a person does that no script does.

*Instrument:* `test_browser.js` — real chromium via `?selftest=1`, real trusted key events
over CDP, zero dependencies.

*Cost:* chromium. No Azure, no session, no Drive. Minutes.

**What it already does** (phase headings, read off the file): Enter saves the focused cell ·
Escape returns it · the source dropdowns save their whole cell · a cell has one identity ·
across the session boundary · the caret survives a save · switching to Custom saves · the
unit type cell · either upload order, one package · documents listing types in opposite
orders · what each document is short of · a pulled factor can be saved · every cell says
where its value came from · tier 3 end to end on a fixture · one property, one name · the
filter rail · the primary action · the console stayed quiet. `--full` drives all ~110
controls instead of one per kind. **315 checks.**

**What it does not do.** Every one of these is a sequence, and the file is organised around
controls:

| sequence | why it matters |
|---|---|
| apply → **undo** → edit → **re-apply** | the applies are deliberately outside the undo run (rule 5). Nothing tests what the undo run holds afterwards |
| apply → leave the form → return → apply the other document | **the measured defect.** `_rcsFill` does not survive it |
| apply → **reload the page** → return → apply the other document | the harder version; `drive.js` reloads but always applies both documents before it |
| **swap a file** — upload a second schedule over the first | `fillRecord` keys on the file name, so this is where a stale fill note lives |
| edit a cell → apply a document over it | `setk` declines a cell the schedule offers, but does it decline one a **person** typed? |
| switch programs (RCS ↔ OCAF ↔ UAF) mid-form | 8 keys exist only with all three programs; the pills only render once a package is open |
| open property A's form, then property B's, without reloading | the `_rcsFill` / `_rsFill` hypothesis, and rule 19's class generally |
| generate → reopen → generate again | the reopen path already lost document 04 once (`d46e42e`) |

*Failure looks like:* a sequence that leaves the record different from the same operations
performed in one sitting.

*Permanent home:* `test_browser.js`, a new phase per sequence. Raise `MIN_CHECKS` from 315.
**A finding here belongs in that file as a check, not in a markdown list** — the file's own
header says so, and the last audit's 47 findings went stale the moment they were fixed.

### Phase 6 — every offer equals what the matcher answers now

*Measures:* the second defect, as a general invariant rather than one cell's bug.

*The invariant:* for every source row in every chooser, the value offered equals what the
live lookup answers for that key **at render time**. Six mechanisms, and four of them are
already live; the assertion pins the other two.

*Instrument:* node. `__boxes(i)` returns the rendered `uaBox`/`safmrBox` HTML; `__rcsOf(k)`
and `__rcsMatch(i)` are the live matcher; `__moneySrcRows(k)` and `__srcTags(k)` cover the
`srcPick` family. Parse the offered figures out of the HTML and compare. 3 UA rows + 3 SAFMR
rows per unit row, plus the 13 `SRCPICK_ROWS` keys and 2 `DIR_SRCROW` keys.

*Cost:* seconds. No Azure, no session, no chromium.

*Corollary worth asserting separately:* a chooser row is dim **only** when the live lookup
returns null (rule 1's honest dim), never merely because a cell is empty. Rows 2 and 3 of
the reproduction table are dim while `rcsOf` answers — that is the check.

*Failure looks like:* a chooser offering a figure the matcher would not.

*Permanent home:* `test_interactions.js` alongside phase 4, since the fixtures are shared.

### Phase 7 — and only then, re-drive the corpus

*Measures:* that the fixes reach the generated documents on real inputs.

*Cost:* **Azure and session.** The sweep is ~20 min and ~100 OCR calls; one property is
~90 s and ~3 calls. Every run creates `ZZ-CORPUS-*` properties in Matt's live account and
must end with `--cleanup --prefix ZZ-CORPUS-` reporting **0**. Tier 2 now reads 9 of 34
prior schedules rather than 3, so the call count is lower than it was, but not zero.

*Preconditions, all of them:* phase 0 landed (or the report is unreadable again) · phases
2–6 green (or the sweep is being used to find things a second suite could have found for
free) · the `drive.js` snapshot addition landed (or the run produces no form-level artefact
again).

*What must change in the rig:*
- **`fillOrder` becomes an exit code.** Any order disagreement fails the sweep. It is the
  one arm that needs no ground truth and it has never failed a run.
- **Add the form snapshots** described at the end of "What the drives actually persist",
  plus a provenance extractor. This is the whole difference between a drive that can answer
  form-level questions and one that cannot.
- **Add a third order:** apply one document, reopen the package, apply the other. That is
  the sequence the defect lives in, and `drive.js` already reloads — it just always applies
  both documents on the near side of the reload.
- **Fix the two study-selection faults the handoff names** before trusting any figure: the
  filename token `(updated)` is trusted over the letter date printed inside (on Market
  Square that picked the *oldest* of three revisions and scored as correct), and
  owner-signed prior schedules are preferred over HUD-countersigned ones, forfeiting the
  contract number and Part F for free.

*Failure looks like:* a difference count that fell for the wrong reason. Marine Terrace went
14 → 0 because five of six documents were withheld. A low count is a signal to go looking.

---

## What happens to the suites

Eleven suites. `MIN_CHECKS` as it stands in the tree today, which does **not** match either
CLAUDE.md's 1,717 or the handoff's 1,753 — the actual sum is **1,779**, and the smoke's 165
is part-way through another session's edit. Treat the list as a map and the file as the
authority, exactly as CLAUDE.md says.

| suite | now | phases it gains | needs |
|---|---:|---|---|
| `test_crypto.js` | 81 | — | |
| `test_db.js` | 169 | — | |
| `test_interactions.js` | 144 | **3a, 3b, 3c (node half), 4, 6** — the bulk of this plan | node only |
| `smoke_combined.js` | 165 | **2, 3d (render half)** | node only |
| `test_gen.js` | 75 | — | |
| `test_rcs.js` | 420 | shape #11's parse side, if `rcsUnplaced` stays | node only |
| `test_hap.js` | 189 | — | |
| `test_browser.js` | 315 | **3c (keys), 3d (repaint), 5** | chromium |
| `corpus/test_safety.js` | 10 | one check: the sweep fails on `fillOrder` | |
| `corpus/test_compare.js` | 91 | **0** — the rows that must not be emitted | |
| `corpus/test_extract.js` | 120 | — | |

Discipline, unchanged and worth restating because it has been the thing that held: a suite
that dies partway must not read as a pass, so **`MIN_CHECKS` goes up with every added check
and is never lowered to make a red run green.** Never pipe a suite through `| tail`. New
suites register in `run_tests.sh` and nowhere else. And every fix gets a regression test
**named for the property that exhibits it**, so a failure says which real case broke.

One judgement about placement. Almost all of this lands in `test_interactions.js`, which
would roughly double it. That is the right home — it is the suite that owns the store and
the decision logic, it needs no browser, and keeping the fixtures in one file lets phases 4
and 6 share them. If it becomes unwieldy, split by subject (`test_roster.js` for the fill
seam) rather than by phase, and register the new file in `run_tests.sh`.

---

## Cost summary, and what needs Matt

| phase | Azure | session | chromium | Drive | wall clock |
|---|---|---|---|---|---|
| 0 comparator | no | no | no | no | hours, no runs |
| 1 mine the drives | no | no | no | no | seconds |
| 2 inventory census | no | no | no | no | seconds |
| 3 invariants | no | no | 3c/3d partly | no | seconds |
| 4 synthetic shapes | no | no | no | no | seconds |
| 5 human sequences | no | no | **yes** | no | minutes |
| 6 offers vs matcher | no | no | no | no | seconds |
| 7 re-drive | **yes** | **yes** | yes | yes | ~20 min/sweep |

**Six of the seven phases cost nothing but time**, and the one defect class this plan was
written for was reproduced in phase 4's instrument before the plan was finished. Phase 7 is
the only one that spends money or needs Matt.

### Decisions that are Matt's

1. **Is `uaBox`/`safmrBox` reading a stored cell a bug or a design?** A chooser that reads
   the live matcher would change value under the PM's hands when a new document is read;
   one that reads the cell can be stale, as measured. There is a third answer — read the
   cell, but assert at render time that it agrees with the matcher and warn where it does
   not — and it is probably the right one for a HUD filing. This is his call, not a repair.
2. **May the drives start recording the form record?** It writes ~30–60 KB more per
   property into `_archive/corpus-cache/` (gitignored, and it holds real contract numbers
   already). No new spend. Recommended, but it is his cache.
3. **Does the sweep get to fail?** Making `fillOrder` an exit code means a night of runs can
   stop early. Worth it — an order-dependent package is a wrong HUD form — but it changes
   how unattended runs behave.
4. **`git` identity.** Every commit in this line has passed `GIT_AUTHOR_*` explicitly
   because the hostname is `Mac.(none)`. Setting `user.name` / `user.email` in the repo would
   end that, and is his config to change.

### One thing to check before starting

`app/full-mp/app.js` and `app/full-mp/smoke_combined.js` are **modified and uncommitted** in
this worktree by a concurrent session, and the changes are in exactly the code this plan
measures (`rcsBrOf`, `rcsUnplaced`, `rcsMatch`'s ambiguity return). Reconcile with that
session before editing either file, and re-measure the inventory numbers if the edits move.
