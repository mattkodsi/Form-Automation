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

---

# Wave 1 — five properties read by eye, three ways

Ebony Gardens (75566), Clinton Manor (75830), Circle Park (75833), Oak Center (75926),
Morh Housing (75927). App frozen at `f829094`. Each property audited by reading the RCS
study and the year−1 executed rent schedule as rendered images, then comparing our
generated package and the filed package against that reading.

## Two claims in this register are now DISPROVED

- **`OakCenter1` is not a defect.** Every string the app emits reads `Oak Center 1`,
  correctly spaced, and it never appends the contract number. Grepped across all four
  generated PDFs and the workbook: zero unspaced occurrences. Class F's name rows were
  the extractor's spacing loss, not the app's output. Morh Housing likewise: the app
  resolved `Morh I Housing` from the prior schedule's Project Name and used it
  everywhere — one of the four strings the team itself uses, and the one the form wants.
- **Utility allowances are not "the study's values".** See M16.

## Mechanisms, ranked by money then by breadth

### M1 · SAFMR — the workbook divides a rounded ceiling by 1.5 and prints the remainder

4 properties (Ebony, Clinton, Morh, Oak Center).

`applyHudSafmr` (app.js:797) stores `safmr_hud` = `hudCeil(...)` = `round(base × 1.5)`
(app.js:771) — that is the **150% ceiling**, already rounded. The workbook's SAFMR column
wants the base, and recovers it by dividing by 1.5. `6620 / 1.5 = 4413.333333333333`.

| property | ours | the study's own SAFMR | filed workbook |
|---|---|---|---|
| Morh (94607) | 3,724 · 4,413.333… | 3,130 · 3,710 | 3,130 · 3,710 |
| Oak Center (94607) | 2,385.33 · 2,912 · 3,724 · 3,724 · 4,413.33 | 2,010 · 2,450 · 3,130 · 3,130 · 3,710 | same as study |
| Clinton | 869.333… · 1,133.333… · 1,358 · 1,625.333… | 720 · 950 · 1,160 · 1,340 | same as study |
| Ebony | 2,511.333… · 2,780 · 3,465.333… | 2,490 · 2,730 · 3,420 | same as study |

Two separate faults, and they need separating before either is fixed:

1. **The fractional print is unambiguous.** A rounded ceiling divided back down is not a
   SAFMR; it is a rounding remainder. Oak Center and Morh share ZIP 94607 and get
   byte-identical figures, which confirms the pull itself is deterministic and real.
2. **`defSafmrSrc` prefers HUD over the study** (app.js:234). On all four properties the
   team used the study's SAFMR, and the filed 150% test is computed from it. Clinton's
   margin is **$12** ($90,528 vs $90,540) — at that width the choice of source decides
   whether a package passes. This half is a decision, not a repair.

### M2/M3 · Non-revenue and $0-rent rows — emitted twice, or not at all

3 properties emit a phantom row; 2 drop real ones. Same seam.

- **Oak Center**: the OCR read 6 unit rows including the non-revenue one, then emitted it
  **twice** — once as `3 BR` with empty money cells and once as `Manager's Unit` with
  empty money cells. Total Units **78 vs 77**; monthly potential **277,700 vs 279,428**,
  because the manager's unit's $1,728 fell out of the total.
- **Morh Housing**: a phantom fourth row titled `Manager's Unit`, 1 unit, no rents.
  Total Units **127 vs 126**.
- **Ebony Gardens**: writes the *use* (`Superintendent`) into the Part A **Unit Type**
  cell, and drops both section-header rows.
- **Circle Park**: all four zero-rent LIHTC rows dropped. Total Units **239 vs 418**.

The Part D "use" is being turned into a Part A unit type. That is the mechanism.

### M4 · A priced study row produces no rent at all — Circle Park, $3.25M/yr

`3 BR / 1.5 BA TH`, 58 units, $4,675: contract rent, Col. 4 and gross rent all blank in
**both** fill orders. Monthly potential **565,900 instead of 837,050**.
Candidate anchor: the study omits the `Y` in its PREPARED GRID column for exactly that
row on both p2 and p74, though the grid itself exists at pp59–68. One property so far —
needs a second before a fix is written.

### M5 · Fill order still changes the bottom line

Morh: rs-first **607,600**, rcs-first **602,500** — and both runs parsed identically
(3 rows from the schedule, 2 from the study). The divergence happens during **apply**,
not parse. Ebony loses its non-revenue row the same way. The written-and-parked patch at
`scratchpad/PARKED-roster-fix.patch` targets this.

### M6–M11 · The small ones, each on 3–4 properties

| id | defect | properties |
|---|---|---|
| M6 | Part F (max allowable monthly rent potential) left blank | Ebony, Circle Park, Morh, Oak Center |
| M7 | Part I HAP contract number left blank though the prior schedule carries it | Ebony, Circle Park, Morh, Oak Center |
| M8 | Part H prints `Vice President of **the** General Partner`; the word appears in no source | Ebony, Circle Park, Morh, Oak Center |
| M9 | Checklist stamped with the **run date** under an unsigned signature line | Ebony, Circle Park, Morh, Oak Center |
| M10 | Checklist leaves `Scope of Work` unticked though every study has it | Circle Park, Morh, Oak Center |
| M11 | Workbook unit labels drop the designation suffix, producing duplicate labels (`2BR/1.5BA` twice) | Ebony, Circle Park, Oak Center |

Also: Circle Park's checklist ticks `Copy of RCS Appraiser's License` though the study
answers **N** to the temporary-licence question. Our generated PDFs are **not flattened**
— `Clear All` and `Print` buttons render on page 2 (Circle Park, Oak Center). Oak Center's
Part B services print `Community Roc`, clipped at the line width.

### M12 · Half the package never generates

Every property: "3 of 6 ready." The CA cover letter, owner cover letter and tenant notice
are each withheld for missing `ca.name` / `ca.org` / `poc.name` (`score.js:69`). Those are
contacts a PM keeps on the property record and a fresh scratch property does not have.
Most likely a fixture gap rather than a defect — but it means documents 01, 02 and 06 are
currently unverified against what the team filed, on every property in the corpus.

## M16 · The utility allowance comes from a document the app is never given

Five properties, five different filing chains, one conclusion.

| property | ours | the study says | the team filed | where the filed number comes from |
|---|---|---|---|---|
| Ebony | 65/88/98/107 (**last year's**) | 96/117/129/125 | 100/121/135/125 | `Exhibit A.pdf`, a Contract Administrator document |
| Clinton | 116/134/168/196 (**the study's**) | same | 98/131/150/167 | UA workbook → tenant notice v2 → signed UA summary letter |
| Circle Park | 74/100/128/185/182 | same | 69/93/119/172/169 | `2025-IL-UAF-Rounded-v-Unrounded.pdf`: current × Illinois UAF 0.928 |
| Morh | 102/138 | same | 107/144 | `FY2026 UAF Notice.pdf` |
| Oak Center | 44/49/62/67/54 (**last year's**) | — | 39/53/57/65/70 | the property's own PG&E utility study |

The app holds `ua_exec` and `ua_rcs` side by side, flags the disagreement, and defaults to
the executed schedule (app.js:235, app.js:1865). So Ebony printed last year's and Clinton
printed the study's from the *same code* — Clinton's prior schedule was unreadable, so the
default fell through. The behaviour is consistent; the inputs are not.

**In none of the five cases is the filed allowance derivable from the two documents the app
receives.** Every one comes from a third document sitting in the same cycle folder. This
is a decision about what the app should ingest, not a bug to repair.

## Errors in the filed packages (team wrong) and in the studies

- Circle Park: the filed schedule **drops the percentage interests** from Part G
  (`General Partner` for `.01% General Partner`). Ours carries them; the form requires them.
- Circle Park: the filed tenant notice certification is **unsigned and undated**.
- Oak Center: filed 4BR allowance is **$70** where the team's own utility study computes
  **$69** — both sides wrong against the source.
- Clinton: the study places the property in **North Carolina** (p11), contradicts itself on
  bathroom counts (`3BR/1.5BA` vs `3BR/1BA`, narrative says one bathroom throughout), and
  the prior filed schedule uses **periods as thousands separators** in three cells
  (`9.984`, `24.384`, `1.150`) while others use commas.
- Circle Park: the study prints the contract number as `IL00054027` — a digit short of
  `IL060054027` — throughout, and two of its own totals are off by $80 and $270.
- Ebony: the study gives two different subject addresses, and inverts the 3 BR allowances
  relative to every other source.
- Oak Center: the study's own unit count disagrees with itself (76 on p2 and p69, 77 on
  p18). Both the app and the team took the schedule's figure. Correctly ignored by both.
- Four studies label the **Section 8 contract number as an FHA project number**. The app
  correctly declines to take it every time.

---

# Wave 2 — Northcross, Westwood Village, Riverwood, Burt Farms I, Sycamore Green

App at `3ecdfd2`. Wave 1's five were re-driven on the same build and diffed.

## The three wave-1 fixes landed, and one of them was wrong

| property | before | after | filed |
|---|---|---|---|
| Oak Center · monthly potential | 277,700 | **279,428** | **279,428** |
| Ebony Gardens · monthly potential | 550,625 | 554,325 | **550,625** |
| Morh Housing · monthly potential | 607,600 | 612,363 | **607,600** |

Part H's inserted article and the checklist's run-date are gone everywhere, and Column 1
of the non-revenue row now carries the unit type on all three. But **printing the
non-revenue rent was backed out**: it made Oak Center exactly right and two others newly
wrong, because the figure we store is not the figure the schedule shows — Ebony's
non-revenue unit rents at $0 and we hold 3,700, Morh's is 5,100 for the new term and we
hold last year's 4,763, and on Morh the unit already occupies a `units.*` row so adding
it again double-counts.

**`nonrev.<i>.rent` being wrong is now the blocking defect**, not the printing of it.

## M17 · The utility allowance IS fixable — the study usually carries the filed number

This overturns the wave-1 conclusion that no repair can reach it. On three of wave 2's
five, the **study's own table equals what the team filed**, and we printed the prior
year's anyway:

| property | prior schedule (what we print) | the study says | the team filed |
|---|---|---|---|
| Sycamore Green | **42 / 50** | **51 / 64** | **51 / 64** |
| Burt Farms I | **52** | **54** | **54** |
| Northcross | **149 / 184 / 204** | **180 / 221 / 246** | **180 / 221 / 246** |

Sycamore Green is the cleanest case in the corpus: its UA workbook, its Exhibit A and its
study all say 51/64, only the prior schedule says 42/50, and the app had the right figure
in a file it was handed and used the other one. `defUaSrc` (app.js) prefers `exec`.

Where a third document does govern (Ebony, Clinton, Circle Park, Riverwood, Westwood),
the study is still nearer the filed figure than last year's is. **Preferring the study is
the better default on every property audited so far.**

Riverwood's chain, for the record: `UA Baseline/Riverwood Apartments 2025 UA Decrease
Notice.pdf` proposes 81/66/90/107 and the filed Col. 5 is exactly that; study and prior
schedule agree with each other on 71/71/85/142 and both differ from what was filed.

## M18 · SAFMR — the figures are real HUD data of the wrong vintage, divided by 1.5

| property | ours | the study says | the team filed |
|---|---|---|---|
| Westwood Village | 1,254 · **1,743.3333333333333** · 2,104 | 1,120 · 1,570 · 1,850 | the study's |
| Sycamore Green | **1,149.3333333333333** · **1,427.3333333333333** | 990 · 1,230 | 1,050 · 1,310 (from the v1 study) |
| Northcross | 1,520 · 1,890 · 2,430 | same | same |
| Burt Farms I | 1,260 | same | same |

Two agents independently grepped their study's full text layer and found none of our
figures. They are the HUD pull. Northcross and Burt Farms match because the pull returned
the study's own figure there. `hudCeil` stores `round(base × 1.5)` and the workbook
divides back by 1.5, which is where the repeating third comes from.

## M19 · Tier 2 rejects rent schedules that have a clean text layer

Two properties, and neither document is hard to read:

- **Westwood Village** — the tier-2 reader refused with *"the printed labels do not sit
  where the form puts them (out by about 7.1 points)"*, on a flattened text PDF whose
  Part A table `pdftotext -layout` renders perfectly. Three OCR calls followed and it
  still ended `unreadable:text`. **Five of six documents did not generate.**
- **Riverwood** — `pdfinfo` says `Form: none`, `pdffonts` shows eight embedded subset
  fonts, `pdfimages` finds no image on page 1 at all, and PyMuPDF extracts every Part A
  value cleanly in Tahoma/WinAnsi. The app got a **429 from Azure** and produced
  **zero documents in both orders**, refusing with "Cannot generate the package with zero
  units". The only garbled run in the whole file is the DocuSign date stamp.
- **Burt Farms I** — same shape: a Print-to-PDF DocuSign copy that `pdftotext` reads
  fine, taken by tier 3 (six OCR calls) rather than tier 1 or 2.

This is a bigger cost than it looks: it is why Azure is being paid for on documents that
did not need it, and on Riverwood the rate limit that followed cost the whole package.

## M20 · The study reader also fails on Gill Group and on image-first covers

**Riverwood** produced `units: 0` — "No appraiser's letter was found in this file." The
letter is on **PDF pages 3–4**; page 1 has zero text (an image-only banner page). And its
unit types are written in bed/bath notation — `1/1`, `1/1`, `2/1`, `3/1.5` — which
`parseType` does not read, with **two different unit types sharing the label `1/1`**
(4 units at 515 sf, 23 at 593 sf). Gill Group format; one property so far.

## M21 · The SAFMR table creates unit types out of nothing — FIXED

**Northcross** priced 3 types and the app read **6**: the three real ones plus phantom
`2BR`, `3BR`, `4BR` rows carrying a SAFMR and nothing else. `upsert()` was shared between
the concluded-rent table and the SAFMR table, and HUD publishes the small-area FMR per
bedroom count, so the SAFMR table names sizes where the rent table names unit types.
Fixed: a SAFMR row now attaches to the exact type, else the stem, else every row with
that bedroom count — which is the right answer when two unit types share a size — and
never creates one.

## Confirmations from wave 2

- Workbook ships cached `NO` on the 150% test: Northcross, Westwood, Sycamore. **Now 8.**
- Part I HAP contract number blank: Burt Farms, Sycamore. **Now 6.**
- Part F blank: Burt Farms, Sycamore, Westwood. **Now 7.**
- Checklist `Scope of Work` unticked though the study carries it: Sycamore, Westwood.
  **Now 5.**
- Section header rows (`Section 8`, `Non-Revenue`) dropped from Column 1: Burt Farms,
  Sycamore. **Now 4.**
- Workbook labels lose the designation: Westwood emits **two rows literally named
  `2BR/1BA` and two named `3BR/1BA`** (the `HC` suffix dropped). **Now 4.**
- Unflattened AcroForm — `Clear All` / `Print` render on page 2: Burt Farms, Sycamore.
  **Now 4.**
- Fill order changes the bottom line: **Sycamore Green** writes the 2 BR contract rent
  (1,450) into the non-revenue employee unit AND into Part D under `rs-first`, totalling
  272,750 where `rcs-first` and the filed schedule both say **271,300**. Same defect
  family as Ebony and Morh, and the clearest statement of it yet: the correct answer is
  the one `rcs-first` already produces.

## team wrong, wave 2

- **Northcross**: the filed workbook's `I7 =($C$3*I3)+($C$4*I4)` drops the 4BR term.
  Filed SAFMR gross $144,000 against a true $178,020; the annual "% of SAFMR" prints
  **117.12%** where the true figure is **94.74%**. Also `30 Huson Yards` in the owner
  letter, and Part B's utility checkboxes checked in the loose copy and unchecked in the
  CA-executed copy of the same DocuSign envelope.
- **Burt Farms I**: the filed workbook computes the allowance as `=52*1.05` → **54.6**,
  using a 1.05 factor where the owner's own signed UAF used **1.04**.
- **Riverwood**: the executed schedule's CA approval date reads `04/24/205`; the two
  filed copies disagree on the Col. 5 effective date (04/01 vs 05/01/2025); and the UA
  decrease notice gives the property a Georgia zip.
- **Sycamore Green**: the filed package contains the **September** study, not the
  December revision that changed both the UA and the SAFMR; the tenant notice sends
  residents to 52 Strathmore Circle where every other document says 55; and the team's
  own 150% test compares contract rent, not gross rent, which is not the study's method.
- **Westwood Village**: the study's cover letter prints the contract number as
  `VA36H026152` against `VA36H027152` everywhere else — one digit, on the page the app
  reads.

## The manifest's "coin toss" is not cosmetic

Three properties this wave turned on which study was chosen. Northcross: the app was fed
the June 14 revision (3BR UA 221) while the package filed the June 4 one (222). Sycamore
Green: the app was fed v4 (SAFMR 990/1,230) while all three filed packages contain v1
(1,050/1,310). Burt Farms I: the alternative study concludes **$1,475** against the
chosen **$1,825** — $350 a unit. The chosen file was right there, but the margin is real.

---

# Wave 3 (partial) — the allowance fix, verified against the filed documents

`d714cd8` re-driven over all ten audited properties. Every allowance moved the way the
evidence said it would, and no other row moved:

| property | before | after | filed |
|---|---|---|---|
| Burt Farms I | 52 | **54** | 54 |
| Sycamore Green | 42 · 50 | **51 · 64** | 51 · 64 |
| Northcross | 149 · 184 · 204 | **180 · 221 · 246** | 180 · 221 · 246 |
| Ebony Gardens | 65 · 88 · 98 · 107 | **96 · 117 · 129 · 125** | the filed workbook's four rows now read `match` |

Mismatch counts fell on four properties and rose on none: Ebony 100→93, Sycamore 81→78,
Oak Center 150→147, Morh 97→100→97. Riverwood is still 0 — it generates nothing.

## M22 · One study, one unit type, two spellings — FIXED

**North Park** prices four unit types. The reader found **seven**. Its transmittal table
writes `1BD/1BA` where its SAFMR and gross-renewal tables write `1BR/1BA`, and the roster
keyed on the raw string, so three ghost rows appeared carrying a SAFMR and nothing else.

The quieter half is worse: the studio matched between the two tables and took the study's
allowance, the other three did not match and fell back to the prior schedule's. **One
column, one document, two different allowance policies, decided by a letter.**
`typeKey` now folds BD to BR. It cannot merge rows a study means to keep apart —
Lansing Manor's patio/no-patio pair differ by more than a letter, and the suite pins it.

## M23 · The corpus rig is feeding the app documents the team did not use

This is not an app defect, and it means **some rows recorded as `app wrong` are artifacts**.

**Wrong prior schedule.** New Horizons: the rig chose `2023/Unexecuted RS.pdf`, which is
100% vector outlines — `Print To PDF`, zero fonts, zero images, `pdftotext` returns three
bytes, and the decompressed streams hold ~2,400 line operators and **not one text-drawing
operator**. Two readable siblings sit in the same folder and **one has a live AcroForm**
that tier 1 would have read outright. North Park: the rig chose the **2023** schedule when
`2024/Executed RS_North Park Apts.pdf` is the real year−1 — so every "current rent" we
printed is a year stale (500,223 against 510,752).

**Wrong study.** Northcross (June 4 filed vs June 14 fed), Sycamore Green (v1 filed vs v4
fed), New Horizons (3-26 filed vs 3-12 fed). On New Horizons the two differ in exactly the
column under repair: the fed draft says 132/138/151/139, the filed study says
149/156/171/158, and the filed schedule says 149/156/171/158. **Preferring the study is
right — but only against the study the team actually filed.**

The ranker sorts by folder and filename and never asks whether the file is readable or
whether it is the one that was filed. **From here, every allowance or SAFMR row must name
which study it was measured against.**

## New Horizons and North Park

New Horizons generated **nothing** in both orders — "Cannot generate the package with zero
units" — from the unreadable schedule above plus an Azure **429**. North Park generated
**one of six**: the study, passed through unchanged. Its workbook is order-dependent —
`rs-first` loses the study's 1/2/3BR rents and SAFMRs entirely; `rcs-first` keeps them but
on the three ghost rows.

North Park's filed allowances (94/112/123/129) match `2025/Exhibit A.pdf` exactly and
match neither the study nor any schedule. Its study's UA table is a verbatim copy of the
year−1 schedule's Column 5, so on that property "prefer the study" and "prefer the prior
schedule" would give the same answer had the right schedule been fed.

New Horizons' correct allowances are derived in `Submission/Exhibit 5 - New Horizons
UAF.pdf` under HUD Notice 2015-04 from the FY2024 New York factors (electric 1.04, gas
1.296): 84×1.04=87 plus 48×1.296=62 gives $149, and so on for the rest.

## team wrong

- New Horizons: the loose `Exhibit 2 - RCS Owners Checklist … 3.25.24.pdf` is titled
  **`Oceanport Senior Citizens`** — another property — and it is the NEWER copy, signed
  three weeks after the one in the package. A later re-signing reintroduced a wrong header.
- North Park: the filed package renders one contract number three ways —
  `NY36A005001`, `NY36-A005-001`, and again as an "FHA Project No." in the study.
- New Horizons passes its 150% test by **$353** on $204,742 — 0.17%. The competing grid
  block in the same workbook reads `Below 150%? = NO`.

## M24 · Hampshire House — the study's concluded rents reached NOTHING

The study prints **$2,000** and **$2,400** unambiguously, on its page-2 letter table and
in row 46 of both HUD-92273-S8 grids. In our output:

- draft rent schedule Col. 3, Col. 4 and Col. 6: **blank on both rows**
- Monthly and Yearly Contract Rent Potential: **blank** (filed: $240,000 / $2,880,000)
- Part F: **blank**
- workbook column E ("RCS Rents"): **empty on both rows**

And the app still reported the draft rent schedule as **"✓ … 1 suggested"**. Both fill
orders identical, so this is not an ordering fault. Circle Park loses one priced row this
way; Hampshire House loses **all** of them. **Two properties — this is now fixable.**

## M25 · Two documents in one package disagree with each other on the allowance

Hampshire House, same run, same record: the **workbook** printed the study's **70 / 86**
and the **draft rent schedule Col. 5** printed the prior schedule's **68 / 83**. One
package cannot state two allowances. The workbook resolves through `uaResolvedOf`; the
schedule resolves through its own inline fallback in `gen.js`. After `d714cd8` those two
were supposed to agree, and on this property they do not — so one of the two paths is not
seeing `ua_rcs` at all. Trace before touching either.

## M26 · The workbook flattens a distinction the rent schedule keeps

**Lansing Manor** is the test case the corpus was waiting for: two 1-bedroom types at
different rents, separated only by a patio.

- our **rent schedule** prints `1 BR / 1 BA` and `1 BR / 1 BA Patio` — correct, and it
  keeps them apart by inheriting the prior schedule's suffix
- our **workbook** labels **both rows `1BR/1BA`** — identical strings, distinguishable
  only by unit count

The study's own words ("without patio" / "with patio") survive in neither. Fifth property
for the workbook-label defect, and the clearest: the same run gets it right in one
document and wrong in the other.

## Wave 3 — the rest

**Hampshire House** needed **no OCR** (`tier: text`, 0 calls) and was right to: its prior
schedule is a real AcroForm with an embedded text layer. **Lansing Manor** made **3 OCR
calls** on a document whose page 4 (Exhibit A) carries the entire rent roll in a clean
text layer — `32 / 1BR / 892 / 116 / 1,008` reads straight out of it. Its HUD-92458 pages
are flattened (`/Fields` empty, zero widgets), so tier 1 legitimately fails, but tier 2
had a readable page and did not use it.

New app-wrong rows this wave:

| defect | properties |
|---|---|
| Part G "Other (specify)" stores `Liability Company` — the word **Limited** is lost | Lansing |
| Effective date 02/01/2026 where every source says 02/02/2026 | Lansing |
| Checklist ticks `Copy of RCS Appraiser's License` though the study answers **N** to the temporary-licence question | Lansing, Circle Park — **now 2** |
| Checklist `Scope of Work` unticked | Lansing — **now 6** |
| Part I HAP contract number blank | Lansing — **now 7** |
| Part F blank | Lansing — **now 8** |
| Non-revenue row present in the input and dropped from our output | Hampshire |
| Workbook rows 10/15 missing formulas entirely (hard zeros in L, M, V) | Hampshire |
| SAFMR from the HUD pull, not the study: 1,590/1,916 vs 1,500/1,810; 1,012 vs 1,040 | Hampshire, Lansing — **now 8** |

## The utility allowance, restated after ten properties

Every property has a **third document**, and it is usually the one that governs:

| property | the filed Col. 5 comes from |
|---|---|
| Hampshire House | `M2M-UAF YR3-FY2025.pdf` — a **CA letter written eight weeks AFTER filing**, applying a gas factor of 1.312 the owner's own UAF letter never used |
| Lansing Manor | `Appendix II - Senior World (UA Decrease).pdf`, 12/24/2025: $116 − $17 = **$99** |
| New Horizons | `Exhibit 5 - UAF.pdf`, HUD Notice 2015-04, factors 1.04 and 1.296 |
| North Park | `2025/Exhibit A.pdf` |
| Ebony, Clinton, Circle Park, Riverwood, Westwood | as recorded in Wave 1 and Wave 2 |

Hampshire House is the sharpest case: the owner's own UAF letter computes 68×1.033 = **70**
and 83×1.033 = **86**, which is exactly what the study says and exactly what we now print.
The filed schedule says **73 / 89**, from a document that did not exist when the package
was assembled. **On that property our output is right and the filed one is later.**

## Woodbury Oakwood (Lakeside) — wave 3, fifteenth property

Rents, counts, totals, Part B, Part G, the checklist and the property name all exactly
right. Two things wrong, and one of them is now on four properties.

**Part D charges rent loss for a unit that loses none.** rs-first prints Col. 3 `2,075`
and Total Rent Loss `$2,075`; rcs-first prints blank and `$0`. Truth and the filed
schedule both say **0**. Ebony printed 3,700, Sycamore 1,450, Morh 4,763.
**Four properties, all order-dependent, all the same `nonrev.<i>.rent` seam.**

**The workbook is missing formulas outright.** `M9`, `L10`, `M10` and `V10` hold a literal
`0` with no formula, so annual RCS gross potential totals zero and the 150% SAFMR sum
silently omits the 2 BR line — 213,840 instead of 234,105. Hampshire House has the same
holes at rows 10 and 15. **Two properties.**

Its allowances read 48/96 against a study and a filed schedule that both say 53/106 — but
this property was audited from the **preserved pre-fix output**, so that row is evidence
about the old build, not the new one. The UAF in its own cycle folder derives it
explicitly: 48 × 1.101 = 52.847 → **53**, 96 × 1.101 = 105.695 → **106**, confirmed by the
NJHMFA approval letter. Here the study and the third document agree, so the shipped fix
should land it.

**team wrong:** the filed schedule prints its Monthly Contract Rent Potential as
**`$181.725`** — a decimal point where a comma belongs. The prior year's Exhibit A lists
99 units across bedroom counts that contradict its own Part A, and the prior year's UA
notice says the allowance was "calculated based on the utility costs at **Oak Park
Apartments**" — a different property — and states a 2 BR allowance of $88 against the $96
on its own page 2.

## A harness hazard, recorded so it is not rediscovered

The wave-3 sweep re-drove Woodbury Oakwood **while its auditor was reading the output**,
overwriting it. The re-run hit an Azure **429** and produced 1 of 6 documents instead of 3,
and printed the property as "Woodbury Oakwood" rather than "Lakeside Apartments". The
agent noticed and fell back to the preserved copy under `_sweep-wave2-before`, but only
because it happened to check. **Never re-drive a property while an agent is auditing it** —
snapshot first, point the agents at the snapshot, and drive into a fresh label.

---

# Re-check of `1c87c7e` and `83a1e14` — verified against the filed figures

Sweep `wave-4` diffed against the pre-fix snapshot `_snap-w3`, by document and key.

## Hampshire House — from nothing to exactly right

| field | before | after | filed |
|---|---|---|---|
| unit.0.rent | *(blank)* | **2,000** | 2,000 |
| unit.1.rent | *(blank)* | **2,400** | 2,400 |
| unit.0.extension | *(blank)* | **180,000** | 180,000 |
| unit.1.extension | *(blank)* | **60,000** | 60,000 |
| Monthly contract rent potential | *(blank)* | **240,000** | $240,000 |
| Yearly contract rent potential | *(blank)* | **2,880,000** | $2,880,000 |
| draft rent schedule | generated but empty | **generated with values** | — |

Gross rents read 2,070 and 2,486 against a filed 2,073 and 2,489 — the $3 difference is the
allowance question, not this fix: ours is the study's 70/86, which is also what the owner's
own UAF letter computes, and the filed 73/89 comes from a CA letter written eight weeks
after the package was submitted.

## Circle Park — the biggest number in the corpus

| field | before | after | filed |
|---|---|---|---|
| unit.4.proposed | *(absent)* | **4,675** — status `match` | 4,675 |
| Monthly contract rent potential | 565,900 | **837,050** | 837,050 |
| Yearly contract rent potential | 6,790,800 | **10,044,600** | 10,044,600 |

## Part D

Sycamore Green's `nonrev.0.rent` and `nonrev.total_rent` both went **1,450 → 0**, which is
what the prior schedule and the filed schedule both say.

## Two count increases that are NOT regressions

Woodbury Oakwood 8 → 75 and Hampshire House 67 → 77. Both are **more output, not worse
output**: Woodbury's previous run had died on an Azure 429 and produced one document of
six, and Hampshire now emits a populated schedule where it emitted an empty one. Every new
row is `missing-theirs` — the extractor cannot read the filed rent schedules, a harness
limit recorded long ago. Woodbury also gained `unit.0.current` 1,109 and `unit.1.current`
1,356, both `match`, and its printed name went `Woodbury Oakwood` → **`Lakeside
Apartments`**, which is what the filed schedule says.

## M27 · OCR IS NONDETERMINISTIC — the same document, the same code, a different outcome

**Ebony Gardens read its prior schedule successfully last run and failed this run.** The
new record says:

> `state: "could not be read"`, `kind: "scan"` — "The scan came back and **47 labels were
> recognised**, but the page could not be squared with the [blank form]"

Forty-seven anchors is nearly six times the eight the registration needs, so this is not the
`OCR_MINPAIRS` threshold. It is the fit itself failing on a page that fitted an hour
earlier. The consequences are a whole package: all four current rents went to `null`, and
the checklist and the draft rent schedule stopped generating (6 documents → 3).

Its mismatch count fell 93 → 19, which looks like an improvement and is the opposite —
fewer rows were produced, so fewer could disagree. **A falling difference count is not
evidence of a fix.**

This also explains the SAFMR figures moving on Ebony (2,511.33 → 2,655.33, 2,780 → 2,910,
3,465.33 → 3,644) with neither value matching the study's 2,490 / 2,730 / 3,420: the HUD
pull returns different numbers on different runs. Two independent reasons, then, to stop
preferring that pull over the study's own printed table.

**This is now the top of the queue.** Every finding in this register that rests on a single
driven run is weaker than it looked, and any property whose schedule "could not be read"
should be re-driven before its rows are trusted.

---

# The analysis workbook — two defects, and one claim withdrawn

## WITHDRAWN · "the workbook is missing formulas" is a harness artifact

Two agents reported that `M9`, `L10`, `M10` and `V10` hold a literal `0` with no
formula. They do have formulas — **shared** ones:

```
<c r="V9" s="36"><f t="shared" ref="V9:V14" si="2">U9*C9</f><v>0</v></c>
<c r="V10" s="36"><f t="shared" si="2"/><v>0</v></c>
```

`V9` is the master and `V10` inherits it by `si`. A reader that does not resolve shared
formulas sees an empty `<f/>` and reports the cell as a bare zero. Same class as the
withdrawn `OakCenter1`: **the tool doing the looking was the thing at fault.**
Do not "fix" these cells.

## M28 · The workbook shipped a stale answer to the 150% test — FIXED

All **116** of the template's formula cells carry the cached value the blank was saved
with: zeros, `#DIV/0!`, and a `Below 150%?` of **NO**. `fullCalcOnLoad` makes Excel
recompute on open, which is why this went unnoticed — but anything that reads the stored
value sees the stale one: a preview pane, Numbers, Google Sheets, a reader script, or a
person who glances at the file without opening it in Excel. **Eight properties shipped a
workbook saying NO about a package that passes.**

The cached values are now stripped from every formula cell, along with the `t="str"`/`t="e"`
attributes that describe them. The formula stays; the answer is only ever one that was
actually computed. An empty cell is an honest "not calculated yet"; a cached NO is a claim.
A guard throws if the template ever ships with nothing to clear, so this cannot silently
regress.

## M29 · The SAFMR column printed a rounding remainder — FIXED

`xlsx.js` wrote `safmr150 / 1.5` into a column headed SAFMR. The app stores the **ceiling**,
already rounded, so dividing it back does not recover the base — it recovers the remainder.
A HUD base of 4,413 becomes a ceiling of 6,620, and 6,620 / 1.5 printed
**4413.3333333333335**. Rounding the quotient returns the published integer exactly,
because the ceiling was `round(base × 1.5)` to begin with.

This is the printing half of the SAFMR problem. The other half — `defSafmrSrc` preferring
the HUD pull over the study's own printed table — is unfixed, and there are now two
independent reasons to change it: the team used the study's figure on every property
audited, and **the pull returns different numbers on different runs** (see M27).

**The workbook had no tests at all.** It has nine now, driving the real template through
node (which has had `DecompressionStream`, `Blob` and `atob` since v18).

## A flaky delivery gate, recorded so it is not mistaken for a defect

`deliver.sh` refused to ship once with `✗ FAILED SUITE(S): test_crypto.js`, minutes after
that same suite had printed `ALL 81 CRYPTO CHECKS PASSED` inside `run_tests.sh`. Run alone
it exits 0; the delivery succeeded unchanged on retry. The failing run overlapped several
headless chromium instances and a subagent fleet, so contention is the likely cause. It
matters because an unattended loop reads that gate as authority — **a single red delivery
is worth one retry before it is believed.**
