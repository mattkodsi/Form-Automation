# RCS report parsing — design

_2026-07-27 · status: approved for planning · supersedes To-Do item 2 for the RCS half_

## In plain English

You upload the appraiser's completed study today and the app files it as document 04
without reading a word of it. This makes it read the study.

The appraiser's two-page transmittal letter is a gift: it holds a tidy table of every
number the form wants — the market rent per unit type, the utility allowance, the 150%
SAFMR, the appraiser's own contact details. The app reads that letter, drops the values
into the form the same way rent-schedule values already land (highlighted, labelled
"RCS report", yours to override), and double-checks itself against the grids deeper in
the report.

Nothing here is novel. It is the rent-schedule parser pointed at a second document.

## What the study yields

Grounded in the one real study in the repo: Belfry Valuation's Colonial Village report,
pages 4–55 of `_archive/colonial-village-example/Manual RCS Package (PDF).pdf`. Every
mapping below quotes text that is actually on the page.

### Transmittal letter, page 1 — identity

| Cell | Source text |
|---|---|
| `appr.firm` | `Belfry Valuation, LLC` |
| `appr.addr_street` / `_city` / `_state` / `_zip` | `PO BOX 8140, Bartlett, IL 60103` |
| `appr.phone` | `(P) (708) 500-2380` |
| `appr.email` | `(E) azabel@belfryvaluation.com` |
| `property.name` | `Market Rental Analysis` → `Colonial Village` |
| `property.addr_*` | `3641 Irving Street, Cincinnati, Hamilton County, Ohio 45220` |
| `property.s8` | `[FHA Project No. OH10M000236]` |
| `poc.name` | the addressee — `Mr. Matthew Kim` / `Related Affordable` |

`poc.name` is the weakest of these: the letter's addressee is whoever *ordered* the study,
which is usually but not necessarily the package's point of contact. It is therefore
offered as a source option only, ranked below Navigator, and never auto-preferred.

Two normalizations that are not optional:

- **The study's "FHA Project No." is the Section 8 number.** Belfry has miscategorised it;
  the value goes to `property.s8` and **never** to `property.fha`. The grids print the same
  number hyphenated (`OH10-M000-236`), so strip non-alphanumerics before comparing or writing.
- The address line carries a **county** (`Hamilton County`) that belongs in no cell, and
  spells the state in full (`Ohio` → `OH`).

### Transmittal letter, tables — the numbers

Three tables, keyed by unit type (`2BR/1BA`, `3BR/1BA`):

| Cell | Column |
|---|---|
| `units.N.proposed` | `ESTIMATED MARKET RENT` |
| `units.N.safmr_rcs` | `150% SAFMR FOR ZIP CODE 45220` |
| `units.N.ua_rcs` | `UTILITY ALLOWANCE` |
| _(corroboration only)_ | `# UNITS`, `SIZE (SF)`, `$ PSF`, `PREPARED GRID (Y/N)` |

Both `ua_rcs` and `safmr_rcs` already exist as keys with live source dropdowns
(`units.N.ua_source` = exec/rcs/custom; `units.N.safmr_source` = hud/rcs/custom). This
design fills machinery that was built for it and has been sitting empty.

The letter also states the appraiser's own 150% verdict —
`TOTAL GROSS RENEWAL RENT: $149,195` vs `150% OF SAFMR GROSS RENT: $157,305`,
`$149,195<$157,305`. The app computes this test independently; the two are compared, never
substituted.

### Signature block

`appr.name` ← `Aaron M. Zabel`. Title (`President`), licence (`ACGO.2024001506`) and job
number (`26-124`) are read for corroboration and **not stored** — see "No new cells".

### The HUD-92273-S8 grids — one per unit type

Row labels 1–46 are fixed by regulation, so this is the portable half of the parser.
Yields: unit type, subject's S8 number, subject SF, `46 Estimated Market Rent`,
`Estimated Market Rent/Sq. Ft`, date of value, subject ZIP, and **Part E rows 33–39**
(`Heat N/G`, `Cooking N/G`, `Cold Water/Sewer Y/Y`, `Trash/Recycling Y/Y`) — a genuine
second reading of Section 7's utilities and fuel types.

**Grid rows 11–28 are not Part B.** The grid asks *does the unit have it*; Part B asks
*is it included in the rent*. Different questions with the same nouns. Equipment rows are
read for cross-check only and never fill a Part B box.

### What the study does not have

FHA #, ownership entity, entity type, signatory, current rents, rents-effective date, CA
details. The parser must never source these, and no "RCS report" source row may offer them.

## Decisions

**Deterministic now, AI later.** No model call in version one. The letter's tables and the
grids' fixed row labels are parseable with the same machinery the rent schedule already
uses, at zero cost, offline, and testable against real PDFs. The module boundary leaves a
clean seam where an AI tier can be added the way OCR was added as the rent schedule's
tier 3.

**Two readers, letter wins, disagreement is flagged.** `readLetter()` and `readGrids()` run
independently and produce the same shape. Where they overlap — market rent, unit type,
S8 number — agreement is real verification. On disagreement **the letter's value is
written** and the difference is surfaced with both figures and their pages. Withholding the
value was considered and rejected: real documents disagree with themselves over rounding
constantly (the OCR work established this at length), and a parser that blanks a cell over
`$741.36` vs `$741` reads as broken.

**Firm profiles are data, not code.** A profile is an object — a detector regex and the
patterns for that firm's prose. Belfry ships first; a `generic` profile works from
HUD-mandated labels alone. Adding an appraiser is a new object plus a new fixture, never a
parser rewrite. When no profile detects and generic finds nothing, the app says it could
not read the study and fills nothing.

**Row matching is bedrooms + baths.** A study line (`2BR/1BA — $1,850`) fills **every**
form row with that bedroom/bath combination, including a designation split (2BR Elderly
and 2BR Family both take $1,850) — the appraiser priced the unit, not the designation.
Existing `rsParseUnitType()` already parses `2BR/1BA` correctly and is reused. A study line
matching no row, or a form row matched by no study line, is reported and fills nothing.
**Ordinal matching is forbidden** — it would put a 2BR rent on a 3BR row.

**No new cells.** Date of value, licence number, unit SF, $/PSF and job number are parsed
for corroboration and discarded. No generated document prints them, and the form should not
grow fields nobody fills by hand.

## Architecture

### `app/full-mp/rcs.js` → `window.RCSParse`

A new source file, concatenated between `ocr.js` and `gen.js` in `build.sh`. **Pure**:
pages in, parsed record out. No DOM, no store, no network — which is what makes it testable
in Node.

It does not get its own PDF engine. `rsTextPages(doc)` (app.js:943) already returns
positioned text runs per page; app.js passes those in.

Two passes, because a 52-page valuation report is not a 3-page form:

1. **Classify** — plain-text scan per page: which page is the transmittal letter, which are
   grids (`Rent Comparability Grid` + `Subject's FHA #`), which is the table of contents,
   the certification, the licence.
2. **Read** — positioned runs pulled only for the pages that matter.

Returned shape (mirrors `_rsUpload.parsed` so the app-side wiring is symmetrical):

```
{ profile:'belfry'|'generic'|null,
  scalars:{ 'appr.firm':…, 'property.s8':…, … },
  units:[ {type, br, ba, count, sf, proposed, ua, safmr, pages:{letter, grid}} ],
  partE:{ 'partb.util.heating':{inRent, fuel}, … },      // cross-check only
  checklist:{ 3:{found:true, page:41}, … },              // CHECKLIST_FLAT index → evidence
  totals:{ grossRenewal, grossSafmr150, verdict },
  conflicts:[ {key, letter, grid, pages} ],
  warnings:[ … ] }
```

### app.js wiring — mirrors the rs* family exactly

`rcsVal` / `rcsUnitVal` / `rcsOf` / `rcsTag` / `rcsFillFromParsed` / `rcsRemember` /
`rcsRecall`, following `rsVal` (app.js:815), `rsOf` (680), `rsFillFromParsed` (1146) and
`rsRemember` (824) line for line, including the rule from FORM-RULES that **every
document-fed cell says so** — `rcsTag` must cover every key `rcsFillFromParsed` writes.

The stubbed source rows at app.js:310–336 (`{tag:'RCS report', val:null}`) become live.

### Persistence

`setCycleRcs` / `getCycleRcs`, added to **both** `db.js` and `db.supabase.js` per the API
parity rule, mirroring `setCycleRs`/`getCycleRs` (db.js:488). Stores the parsed reading and
the file name — **not the PDF bytes**, exactly as the rent schedule does.

**This needs a Supabase migration:** `rs_doc` is a jsonb column on `cycle`; `rcs_doc` must
be added alongside it, and threaded through the three places `rs_doc` appears in
`db.supabase.js` (hydrate line 89, `pushCycle` 268, `createCycle` 422).

## Behaviour

**Upload.** Unchanged entry point (`#rcsFile`, app.js:1938). After the bytes are validated,
the source row shows progress the way the rent schedule's does (`_rsBusy`, app.js:1949) —
classification is fast, but a 52-page report should not present a frozen row.

**Apply.** Explicit, like the schedule's `rsApply` button. The row reports what was found —
"Belfry Valuation · 2 unit types · 12 fields" — and applying writes them, marked
`fromParse`, so an override reads as "parsed — changed from stored record" rather than a
bare change.

**Section 8, owner's checklist.** Items 4–17 of `CHECKLIST_FLAT` are almost verbatim the
study's own table of contents. Detected items are pre-ticked **with a page citation**, and
the tick carries parsed provenance like any other parsed value. It remains a certification
the user signs: the app reports what it found, it does not certify.

**Non-revenue rents (To-Do #14).** Each `nonrev.N.rent` fills from the proposed rent of the
revenue row matching its bedroom/bath combination, with the same override behaviour as any
parsed field.

**RECORD CHECKS.** The chips graduate from restating entered values to real comparisons:
unit types and counts RCS vs executed RS · UA `ua_rcs` vs `ua_exec` · `safmr_rcs` vs the
HUD pull · S8 number RCS vs RS vs stored record · Part E vs Part B · the appraiser's 150%
verdict vs the app's own computation · letter-vs-grid conflicts. Each states both figures
and where each came from.

## Honesty rules

Each of these is the RCS equivalent of a rule that was already earned the hard way on the
rent-schedule parser.

- **An unreadable study fills nothing and says so.** No partial guessing, no generic
  fallback that invents structure.
- **Never source a field the study does not carry** (FHA #, entity, signatory, current
  rents, effective date).
- **Position is not permission.** A number found near a label is a candidate; it must match
  the expected shape (money, count, unit type) before it is written.
- **The blank form's own text is not data** — the printed labels of the HUD grid are not
  values, same subtraction rule as the OCR tier.
- **Parsed values never overwrite a user's override.** `store.editForm` provenance decides.
- **Corroboration never becomes a source.** Grid equipment rows and the appraiser's own
  150% verdict inform checks; they never fill a cell.

## Testing

`app/full-mp/test_rcs.js`, registered in `run_tests.sh` (the only place a suite is
registered), with a `MIN_CHECKS` floor so a partial run cannot read as a pass. Fixture is
already in git: `_archive/colonial-village-example/Manual RCS Package (PDF).pdf`,
pages 4–55.

Covered: Belfry profile end-to-end against the real study, expected values asserted
literally ($1,850 / $2,400 market rents, $161 / $171 UA, $2,085 / $2,745 150% SAFMR,
`OH10M000236` from both the hyphenated and unhyphenated printings) · grid reader alone ·
letter reader alone · reconciliation with an injected disagreement · row matching including
a designation split · a non-Belfry document parsing to `profile:null` and filling nothing ·
checklist detection page citations.

Existing gates still apply: source rebuilds byte-for-byte, zero NUL bytes, `node --check`
clean, and `python3 app/full-mp/build-ra.py` must still print `built …` after any `app.js`
edit (the RA port patches by anchor string).

## Phasing

Each phase ships working and is independently useful.

1. **Read and fill** — `rcs.js` with the Belfry profile, both readers, reconciliation, the
   Section 2/3/5/6 fills, the source rows, `test_rcs.js`. This is most of the value.
2. **Checklist auto-tick** with page citations.
3. **Persist per cycle** — `setCycleRcs`/`getCycleRcs` plus the Supabase column.
4. **RECORD CHECKS graduation** — the cross-document comparisons.
5. **Non-revenue rents** (To-Do #14).

## Risks

**One document.** Everything is tuned to a single Belfry study. "Several firms, similar
bones" is a working assumption until other appraisers' reports arrive; Matt is sourcing
them. The profile design keeps the cost of being wrong low — a new firm is a new object,
not a rewrite — but this design does not claim to have been validated against a second
format, and the plan should not pretend otherwise.

**The generic profile is untested by definition.** Until a non-Belfry study exists, the
fallback path can only be tested negatively: an unrecognised document must fill nothing.

**A 52-page report is heavier than a 3-page form.** Page classification must stay cheap;
if full run-extraction over every page proves slow in the browser, classification narrows
it to the six pages that matter.
