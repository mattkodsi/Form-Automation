# Diagnostic register — sweep-7

Every property driven through the real signed-in app as a PM would drive it: create
the package, upload the year−1 executed rent schedule and the year-0 RCS study, apply
both, generate. Then twice — once filling schedule→study, once study→schedule, from a
single upload — and the generated PDFs and workbook read back and compared against the
package the PM team actually filed.

**Run:** 34 properties, app frozen at `e2c0080`, 99 Azure OCR requests, 28 of 34 needed
at least one. 1466 values compared.

| | count |
|---|---:|
| match | 298 |
| **both sides had a value and they differ** | **194** |
| we produced a value the filed document has no field for | 861 |
| the filed document had a value we produced nothing for | 113 |
| **fill-order disagreements** (same inputs, two orders) | **83** |

---

## Read this first: the ground-truth arm is much weaker than the totals suggest

`missing-theirs` is 861 rows and it is not 861 disagreements. Two things inflate it, and
until they are separated the headline numbers cannot be used to judge the app.

**1. Template asymmetry — 54 rows, and not a defect at all.** `analysisXlsx ::
property.name` and `analysisXlsx :: appr.firm` are 27 rows each across 27 properties: the
PM team's workbook titles itself in free text and carries no appraiser firm, so every
property contributes two rows where only one side has a field.

**2. We could not read most of the FILED rent schedules.** The remaining rentSchedule
`missing-theirs` concentrates in ten properties — Oak Center (80), Friendship Court (69),
Peterson Plaza (62), Ebony Gardens (57), Fairview Homes (55), Morningside Court (49),
Woodbury Oakwood (49), Barnum House (37), Hampshire House (29), Marine Terrace (9). Only
**five properties** produced any rentSchedule matches at all, and only two meaningfully
(Colonial Village 39, Marine Terrace 26).

So for the rent schedule, the corpus is comparing our output against a mostly-blank
reading of the filed document. The filed executed schedules are the same flattened
vector-outline PDFs the app itself cannot read without OCR — and the harness's extractor
does not OCR them. **The ground-truth comparison for the rent schedule is currently
measuring the extractor, not the app.**

This is why the fill-order arm matters disproportionately: it needs no ground truth, and
83 rows of it survived.

---

## App-side classes

### A. Unit type carries no designation — 71 rows, 24 properties · `analysisXlsx :: unit.N.type`

| property | ours | filed |
|---|---|---|
| Barnum House | `Studio/1BA` | `0-Bedroom` |
| Burt Farms I | `1BR/1BA` | `1BR` |
| Circle Park | `2BR/1.5BA` | `2BR-Flat` |
| Circle Park | `2BR/1.5BA` | `2BR-TH` |
| 333 Holly | `2BR/2BA` | `2BRLG` |

Two distinct problems wearing one shape.

*Vocabulary* — we print `1BR/1BA` where the filed package prints `1-Bedroom` or `1BR`.
Cosmetic, but it is on every document a PM reads.

*Identity* — Circle Park's rows 1 and 2 are **both** `2BR/1.5BA` to us and `2BR-Flat` /
`2BR-TH` to them. The data model builds the type from bedrooms and bathrooms alone, and
no field distinguishes two unit types that share both. This is the same gap that makes
class E possible, and it cannot be closed without a designation field — its name, its
source and its UI are Matt's call.

### B. SAFMR differs, and prints unrounded — 29 rows, 10 properties · `analysisXlsx :: unit.N.safmr`

| property | ours | filed |
|---|---|---|
| Clinton Manor | `869.3333333333334` | `720` |
| Clinton Manor | `1133.3333333333333` | `950` |
| Friendship Court | `1035.3333333333333` | `840` |

Two findings. The repeating `.333` says we are **averaging** across several ZIP codes
while the filed package uses a single figure — a substantive disagreement about which
SAFMR applies, worth more than the count suggests because SAFMR drives the 150% gate.
Separately, a raw float should never reach a printed document.

**Not yet traced.** Needs the source SAFMR table and the 150% check read together.

### C. Utility allowances differ — 17 rows, 7 properties · `analysisXlsx :: unit.N.ua`

| property | ours | filed |
|---|---|---|
| Ebony Gardens | `65` `88` `98` `107` | `96` `117` `129` `125` |
| Friendship Court | `61` `85` `100` `107` | `66.02` `82.07` `108.91` `124.47` |

Ebony's are uniformly lower; Friendship Court's filed values carry cents, which an
allowance schedule does not — suggesting the filed workbook holds a *weighted* allowance
the app does not compute. Two different mechanisms hiding in one class.

**Not yet traced.**

### D. Proposed rents land on the wrong rows — 10 mismatches + 15 missing, 5–7 properties

| property | ours | filed |
|---|---|---|
| Morh Housing | `4475` `5100` `5100` | `4675` `5275` `4475` |
| Oak Center | `3650` `4300` `4550` | `4050` `4475` `4675` |

Morh shows `5100` twice where the filed package has two distinct figures, and the filed
`unit.2` equals our `unit.0` — a duplicated broadcast plus a row offset. This is the
class Matt identified independently in his own testing: a study that quotes one figure
per bedroom count against a schedule that lists several variants of that bedroom count.

**Mechanism traced — see class E.** Whether the *filed* values are right for these
specific properties still needs the study read alongside.

### E. Fill order changes the package — 83 rows, 8 properties · **highest severity, no ground truth needed**

Ebony Gardens 26 · Peterson Plaza 24 · Oaks on North Plaza 16 · Walden 6 · Marine
Terrace 4 · Morh Housing 3 · Fairview Homes 2 · Woodbury Oakwood 2.

Peterson Plaza's `total.contract_rent` is **429200** filling schedule-first and **285250**
filling study-first — a $143,950 difference on the document that goes to HUD.

**Root cause, traced end to end.** `rcsMatch` (app.js:1106) looks a row up by bedrooms and
baths, so one study line can price several rows — a study quoting "all 1BR" correctly
fills both 1BR variants. But line 1109 returns nothing when the row has no bedroom count
yet. So:

- On an **empty** form every study line is homeless, and the homeless path (app.js:1298)
  builds the roster — one row per study line.
- `rsFillFromParsed` (app.js:1863) then writes `units.<ix>` **positionally** from the
  schedule's own parse order, straight over those rows, and appends the rest.
- The study's proposed rents never move. A 2-line study against a 4-row schedule leaves
  the one-bedroom figure sitting on the second studio.

Fill the schedule first and it is correct, because the roster is the schedule's and the
study broadcasts across it.

The design intent is already written at app.js:1155 — *"the order the two documents happen
to be uploaded in cannot change the result"* — and is implemented for scalar cells via
`rsOffers`. It was never extended to the roster.

A candidate fix (re-read an already-applied study after the schedule lays down the
roster) is written and **parked, not applied**, pending the rest of this diagnosis.

### F. Property name — 6 rows

`FairviewHomes(NJ390013022)` vs `FairviewHomes` (we append the contract number),
`OakCenter1` vs `OakCenter` (stray trailing `1`), `MorningsideCourtApartments` vs
`MorningsideCourt`. Small, real, and each needs its own trace.

---

## Harness-side classes — these are NOT app defects

### G. The extractor graded the wrong page — 13 + 5 rows

| property | key | "filed" value |
|---|---|---|
| Fairview Homes | `rentSchedule :: unit.0.type` | `410TenthAve,8` |
| Fairview Homes | `rentSchedule :: unit.1.type` | `NewYork,NY10001` |
| Fairview Homes | `rentSchedule :: unit.3.type` | `DearMr.Delancy,` |
| Hampshire House | `rentSchedule :: unit.0.units` | `ndFloor` |

Those are cover-letter lines. The extractor located the rent schedule on the wrong page of
the filed package. Every difference for these properties is noise until fixed.

### H. Offset-ASCII font not decoded — 2+ rows

Hampshire House and Woodbury Oakwood return control characters for `checklist ::
property.name`. The filed checklist font is ASCII−29; the decoder is known and
implemented, so it is not being reached on these files.

### I. Four properties produced nothing comparable

New Horizons · Noble Tower · Oceanport · Riverwood. Cause not yet established.

---

## What this changes about the order of work

1. **Fix the harness first (G, H, I).** Classes G and H put false values on the "filed"
   side, and I removes four properties from the corpus entirely. Until they are fixed,
   any app-side conclusion drawn from those properties is unsafe.
2. **Then extend ground truth to the filed rent schedules.** Ten properties currently
   compare against a blank. This is the single biggest limit on the whole exercise.
3. **Then E**, which is traced and needs only a decision.
4. **Then B and C**, which need tracing.
5. **A needs Matt** — the designation field is a data-model decision, not something to
   invent unattended.

---

# Property 1 — Peterson Plaza (75917), read by eye against the filed package

Ours: `_sweep/_out/75917/rs-first/05. … Draft Rent Schedule.pdf`
Theirs: `2025 - RCS/Peterson Plaza (IL060052016) Rent Schedule eff. 09.01.2025 (unsigned).pdf`

| row | units | ours rent | filed rent | ours UA | filed UA |
|---|---:|---:|---:|---:|---:|
| 1BR | 100 | **2,025** | **2,050** | **86** | **60** |
| 1BR | 30 | 2,025 | 2,025 | **83** | **71** |
| 2BR | 1 | **2,650** | **2,700** | **111** | **71** |
| 2BR | 42 | 2,650 | 2,650 | **111** | **71** |
| 3BR | 16 | 3,250 | 3,250 | **131** | **125** |
| total | 189 ✓ | **429,200** | **431,750** | | |

Unit counts and row order are exactly right. The 2,550 shortfall is exactly
`100 × 25 + 1 × 50` — the two rows that took the wrong rent.

## The chain, end to end

The study's table lists each type over TWO lines — the spec, then a designation:

```
IBR/1BA        100    562    $2,050
  Senior
1BR/1BA         30    672    $2,025
  Multi-Family
2BR /1BA         1    742    $2,700
  Senior
2BR/1BA         42    786    $2,650
  Multi-Family
3BR/1.5BA       16   1,049   $3,250
  Multi-Family
```

The app parses it to:

```
[0] type:"IBR/1BA"   br:""  count:100  proposed:2050  ua:86
[1] type:"1BR/1BA"   br:1   count:30   proposed:2025  ua:83
[2] type:"Senior"    br:""  count:1    proposed:2700  ua:""
[3] type:"2BR/1BA"   br:2   count:42   proposed:2650  ua:111
[4] type:"3BR/1.5BA" br:3   count:16   proposed:3250  ua:131
```

`rcsMatch` (app.js:1106) selects candidate lines by bedroom count. Lines 0 and 2
have none, so they are not candidates at all. For the two 1BR form rows only line
1 survives — `hit.length === 1`, so it reads as UNAMBIGUOUS, the count tiebreak at
app.js:1124 never runs, and both rows take 2,025. Identically both 2BR rows take
2,650 because line 2 dropped out.

## Defects

**P1 — `IBR/1BA` is not read as 1BR.** The document's own text has a capital `I`
for the digit `1`. `rsParseUnitType` returns no bedroom count, so the line is
invisible to matching. *(app.js `rsParseUnitType`)*

**P2 — `2BR /1BA` is not read.** An internal space before the slash breaks type
recognition, and the row then adopts the wrapped designation line below it, so its
type becomes `Senior`.

**P3 — wrapped designation lines are consumed as unit types** instead of being
attached to the spec above them. `Senior` / `Multi-Family` are designations.

**P4 — THE DANGEROUS ONE. A line that cannot be matched does not blank the cell;
it lets another line's rent be broadcast into the row.** Because the unreadable
line is not a candidate, the remaining line looks unambiguous and the `many` guard
never fires. A parse miss becomes a wrong number on a HUD form, silently. The rule
should be: if the study prices N types for a bedroom count and the form has N rows,
a line that failed to parse must make that group ambiguous, not unanimous.

**P5 — utility allowances come from the wrong document.** Our 86 / 83 / 111 / 131
are exactly the study's `ua` values. The filed package's 60 / 71 / 71 / 125 come
from the property's own allowance schedule (`2025 - RCS/Utility Baseline/Peterson
Plaza Baseline UA Workbook 4.14.xlsx`). Col 5 of HUD-92458 is the allowance in
effect, not the appraiser's estimate. This is class C's root cause and it affects
every property where the two differ.

**P6 — Part F is blank.** The filed schedule prints Maximum Allowable Monthly Rent
Potential 335,132; we print nothing.

## And the answer to the designation question

The study CARRIES the designation — `Senior` vs `Multi-Family` — and that is
exactly what distinguishes Circle Park's `2BR-Flat` from `2BR-TH` and 333 Holly's
`2BRLG`. The field class A needs is already in the source; the parser is throwing
it away (P3). That reframes A from "invent a data model" to "stop discarding what
the appraiser already told us".
