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

## M30 · The SAFMR the appraiser printed now beats the one the API returned — FIXED

`defSafmrSrc` preferred the HUD pull whenever it returned anything. Two independent
reasons to reverse that, and neither depends on the other.

**The team used the study's figure on every property audited.**

| property | the study prints | the pull returned | the filed workbook used |
|---|---|---|---|
| Westwood Village | 1,120 · 1,570 · 1,850 | 1,254 · 1,743.33 · 2,104 | the study |
| Sycamore Green | 990 · 1,230 | 1,149.33 · 1,427.33 | the study (v1's 1,050 · 1,310) |
| Hampshire House | 1,500 · 1,810 | 1,590 · 1,916 | the study |
| Clinton Manor | 720 · 950 · 1,160 · 1,340 | 869.33 · 1,133.33 · 1,358 · 1,625.33 | the study |
| Northcross, Burt Farms | — | matched the study | the study |

**And the pull is not stable.** Ebony Gardens, driven twice in one afternoon on the same
build, returned `2,511 · 2,780 · 3,465` and then `2,655 · 2,910 · 3,644`. Neither is its
study's `2,490 · 2,730 · 3,420`. A figure that moves between runs cannot be the default
for a federal filing when the appraiser has printed one in the document under their
licence.

The 150% test turns on this number, and **Clinton Manor passes it by $12**.

An explicit choice still wins, the pull still fills in when the study is silent, and an
entered figure beats both. `db.js` carries the same precedence, so the menu card and the
form cannot disagree about whether a property clears its ceiling.

---

# Holly House (75564) — wave 4, sixteenth property

## The whole package was lost to a rate limit, and the tier call was right

`uploads.rs.state` is `could not be read` — `kind=scan`, **"Azure declined the page (429)"** — in
**all four runs** (both orders of the current sweep and both of the snapshot). `tier:
unreadable:scan`, `rsVia: null`, and the harness recorded *"#rsApply never appeared — nothing
was applied to the form"*. **1 of 6 documents generated.**

And OCR was the correct tier: `pdffonts` on that schedule returns **nothing at all** — zero
fonts — and `pdfimages -list` finds **101 JPEGs**, page 1 alone being 37 sliced 2550×34
strips from a print-driver band split. There is no text layer to read. **The failure is the
429, not the classification.** Four properties have now lost most or all of a package to it:
Riverwood, New Horizons, Woodbury Oakwood, Holly House.

## M27 confirmed on a second property, and it dropped a whole unit type

Ebony lost the ability to read its schedule between runs. Holly House lost a **unit type**:

- in the snapshot, both orders, workbook **row 10 is entirely empty** — no label, no count,
  no rent, no allowance, no SAFMR. The 1-bedroom type, **20 of 42 units**, simply absent
- in the current sweep, both orders, row 10 is fully populated: `1BR/1BA · 20 · 2,375 · UA 64`

Same inputs, same build, and both `_drive.json`s record the identical parse — `read · Belfry
Valuation · 2 unit types`. Confirmed in the raw sheet XML, so not a reader artifact.
**Two properties now show run-to-run instability, and one of them silently dropped half its
unit mix.**

## SAFMR — a fifth property, and the agent traced it to the seam I had just repaired

Ours printed `1,690 / 1,910`; the study prints `1,440 / 1,620` (150%: 2,160 / 2,430). The
agent ran the shipped reader over the study independently and it read the table **perfectly**
— `safmr_base: 1440/1620`, `safmr: 2160/2430`, `grossSafmr150: 96120`. So the reader had the
right figure and the workbook took the HUD pull instead. Our 150% threshold came out at
**$113,070** against the study's and the team's **$96,120**.

`592101a` reverses exactly that precedence, so this property should now agree. It is the
fifth independent confirmation, and the first where an agent proved the reader innocent.

## The utility allowance, and four different pairs in one cycle

| reading | Studio | 1 BR | where |
|---|---|---|---|
| prior schedule Col. 5 | 48 | 51 | prior RS p2 |
| the study's table | **61** | **64** | study p3 |
| **ours** | **61** | **64** | our workbook — the study's |
| **filed Col. 5** | **40** | **51** | executed FY2025 RS p2 |

The filed figure comes from `UA Decrease Notice/Holly House UA Decrease.pdf` (28 May 2025):
`0 BR 48 → 40`, `1 BR 51 → 51`. That governs. But the same cycle folder also holds a baseline
workbook proposing **38 / 53**, the team's own impact analysis repeating 38/53, and a filed
UAF certification deriving the study's **61 / 64** from `58 × 1.058` and `61 × 1.058`.
**Four different pairs across the team's own documents, all in one filing.** Ours reproduces
the study's, which is what the app's inputs support.

## New, small

`P20 = SUM(P9:P19)` sums the **allowance column** into a total row — a figure with no meaning.
The team's sheet prints `-` there.

## team wrong

- The tenant notice is dated **April 30th** and signed **April 29th** — the signature predates
  the notice on the same page.
- Its column headings are transposed in meaning: `Proposed Increase` holds the delta and
  `RCS Increase` holds the new rent. The arithmetic is right; the labels are not.
- The CA's own transmittal is dated **"Jube 2, 2025"**.
- The loose `Exhibit 2` checklist is unsigned and undated where the bound copy is executed.

**No arithmetic error in any filed document on this property** — the agent verified every
extension, total and gross by hand, both years.

---

# Oceanport (75563) and Oaks on North Plaza (75544) — wave 4

## M31 · The zero-unit-type class, root cause found

**Oceanport's study is not the problem it looked like.** It is a fully digital Word→PDF:
`pdffonts` shows eleven ordinary Times/Arial faces, `Form: none`, page 1 carries 661
characters of extractable text, and `pdfimages` finds only a 243×235 logo — **no image-only
cover page hiding anything.** The appraiser's letter is on **pages 2–4** and the
concluded-rent table on **page 3**.

The reader read **two pages** and reported "No appraiser's letter was found", 0 unit types.

The distinguishing feature is the shape of the table cell: **every unit-type label is two
lines** — `1BR/1BA` on the first, `SMALL` on the second — so the text stream emits
`1BR/1BA`, `SMALL`, `1BR/1BA`, `MEDIUM`, … as separate runs, and **all six labels appear
before the first `# UNITS` value in reading order.** No row pattern can match, because
there are no rows in the stream.

This is the same family as Peterson's wrapped `Senior` line and Walden's late designation,
but structural rather than incidental. Two things to fix: the row reader must join a label
to its continuation line, and the letter scan must reach the page the letter is on.

Because 0 types were read, the draft schedule carried the prior year forward: **no contract
rents at all**, FY2023 allowances printed under a 07/01/2024 effective date, prior-year
Part D ($2,082 where the filing says $3,220), no SAFMR, and a spurious seventh Part A row
taking Total Units to **101** against 100.

The same study spells its six types **four ways across its own pages** — `1BR/1BA`+`SMALL`,
`1BD/1BA`, `2BD/2BA`, `2BR/2BA` — and four more spellings appear elsewhere in the cycle
(`1 BR SM`, `1BR SM`, `1 BR-S`, `One Bedroom Small`). Its p47 labels the subject's 2BR units
as two-bath when p17 says every unit has one bathroom.

## M32 · Tier 2 ACCEPTED a text layer it should have rejected — the mirror of M19

Oaks on North Plaza's prior schedule is a **bitonal CCITT scan carrying a scanner-generated
OCR text layer of unusable quality**. The app read it — `via: text`, `kind: fields`,
**0 OCR calls**, tier `text`, recorded as a clean success — and swallowed the garbage
verbatim:

| field | what the app stored | truth |
|---|---|---|
| property name | `OaksonINorthP,lazafkaNorthPlazaApartmentsPartA-ApartmentRents` | `Oaks on North Plaza fka North Plaza Apartments` |
| 1 BR current rent | **111198** | 1,198 (the layer prints `111, 198`) |
| 3 BR ADA current rent | **11918** | 1,198 (the layer prints `1, 1918`) |
| monthly contract rent potential | **1,642,642** | **91,922** |

That name reached the workbook title, all three filenames, the package dialog and the
letterhead warning. **This is M19 inverted**: there, tier 2 refused pages it could read; here
it accepted one it could not. Both are the same missing judgement — nothing checks whether
what came back is plausible. A rent of 111,198 on a property whose other five rents are
between 1,198 and 1,876, and a project name with no spaces and a comma inside a word, are
both rejectable on their face.

**A code reading confirms the generality: there is no plausibility check on a parsed rent
anywhere.** This does not need a second property.

## M33 · Fill order, at its most destructive yet

Oaks on North Plaza, same two files:

- **`rcs-first`** — all six study types merged onto the six schedule rows correctly.
- **`rs-first`** — **one** of six merged (`2 BR/1 BA` ↔ `2 BR / 1 BA TH`); the other five
  were **appended as rows 15–19**, giving an eleven-row sheet, 118 units of double-counted
  allowance, and half-empty rent columns. It also tripped a warning the other order never
  sees: *"Part A holds 11 rows and your unit types fill them, so the 2 non-revenue rows will
  be left off Part A."*

The ADA distinction is lost in both orders: `2 BR/1 BA - ADA` and `3 BR - ADA` come out
identical to their non-ADA siblings, so two pairs of rows read the same.

## Confirmations

- **SAFMR from the HUD pull**: Oaks prints `1562 / 1852 / 2347.3333333333335` where the study
  prints `1,490 / 1,760 / 2,240`. Sixth property, and the agent noted the pull looks like a
  current-year vintage against a 2024 filing. `592101a` and `1de0813` address both halves.
- **Allowances**: Oceanport's filed Col. 5 (43/40/45/63/73/19) comes from
  `Oceanport Senior Citizens-M2M-UAF-FY2024.pdf`, which applies a **1.033** factor to the
  FY2023 set; ours printed the FY2023 set unfactored. Oaks' filed Col. 5 (120/233/233/176/
  246/246) comes from `Exhibit_A_Eff_1-1-25.pdf`; ours printed the prior year's, which is
  also what its study quoted. **Twelfth and thirteenth confirmations** that a third document
  governs.

## The rig, again

`corpus.json` records Oaks on North Plaza as having **no filed cover letter, submittal
letter, checklist or tenant notice** and `hasCombined: false`. All three owner documents sit
in `2025 (RCS)/Submission Package/` inside a signed 92-page package that was never indexed.
Any conclusion drawn from "the team filed nothing here" would have been false.

## team wrong

- **Oaks: the filed package binds the SUPERSEDED study.** The signed package carries the
  **30 August** version — 4 unit types, 16 one-bedrooms, gross $127,422 — while the executed
  schedule and the team's own workbook use the **16 September** revision — 6 types, 14
  one-bedrooms plus two ADA rows, gross $128,787. The bound exhibit does not support the
  rents that were filed.
- Oaks' filed workbook carries a Denver ZIP (`80209`) for an Austin property and a note about
  *"Starmark Rents"* — another firm's name in a Cornerstone comparison. Its SAFMR block is
  the July draft's, not the September study's.
- Oceanport's study prints the property's ZIP as **60657** — a Chicago ZIP, the appraiser's
  own city — on its cover page, against 07757 everywhere else; and its p36 narrative
  describes a property "which specializes on individuals struggling with homelessness",
  boilerplate from another assignment, on a senior-citizens property.
- Oceanport's tenant notice told residents **$2,525**; the executed rent is **$2,590**, and
  **no study concluding 2,590 exists in the folder** — the step from 2,525 is undocumented
  and not a uniform factor (+65/+65/+65/+20/+15/+20).
- Oceanport's `Exhibit 2` checklist carries the PDF title `…New Horizons 3.25.24.pdf` while
  New Horizons' checklist was titled `Oceanport Senior Citizens`. A reciprocal re-save
  between two properties, and a real filing artefact.

---

# Noble Tower (75543) — the app crashes, and now we know why

## M34 · An ENCRYPTED study makes generation fail outright

Both orders produced **zero files**, reproducibly across **four** preserved runs at three
different commits:

> `the app refused to generate — Generation failed: Expected instance of e, but got instance of undefined`

That is a pdf-lib shape, and the cause is in the document. The chosen study is:

```
Pages: 92        File size: 43,556,351 bytes        Form: AcroForm (with an EMPTY /Fields)
Encrypted: yes   /Filter /Standard  /V 5  /R 6  /CFM /AESV3  /Length 256
                 /StmF /StdCF  /StrF /StdCF  /P -1052   (copy/extract disabled)
```

AES-256, PDF-2.0 revision 6, **both streams and strings encrypted**, opening on an empty
user password. It is **43.6 MB against a corpus median of 4.3 MB** — 2.5× the next largest.
Its sibling (21 August, 91 pages) carries the same encryption.

`corpus.json` flags exactly **three** chosen studies as `unlocked: true` — this one, North
Park wave 2, and Northgate Terrace wave 2. So this is not unique, and the failure mode is
total: no cover letter, no checklist, no schedule, no workbook, nothing.

## M35 · The salutation became the property name — the `DearMr.Delancy,` shape was real

The study was also never read: `units: 0`, "No appraiser's letter was found in this file."
But the letter **is** on pages 2–4, the concluded-rent tables on pages 2 and 3, page 1
carries 213 characters of clean extractable text, and `pdftotext -layout` yields ~165 KB
across the document. The node scan read three pages and came back with
**`name: "Dear Mr. Larmore"`** — the salutation — plus `firm: null` and `s8: null`, though
`CA39H113049` is printed in the letter's own `Re:` line.

The register long ago dismissed `DearMr.Delancy,` as an extractor artifact on a different
property. **On this property the app itself does it.** The letter-finder can settle on a page
whose only match is the greeting, and then read a person's name as a project's.

## Where the truth stands

Prior schedule (a pure image scan — `pdffonts` returns nothing, so tier 3 was correct here):
`1 Bedroom A` 182 @ 3,106 and `1 Bedroom B` 13 @ 3,219, UA **0** on both, total 195,
monthly **607,139**. Filed FY2025: both rows at **3,265**, monthly **636,675**, Part F the
same. The study concluded a single rent for a 532 SF typical unit while its own page 26 shows
the B units at 665 SF; the team collapsed the A/B spread to match. Recorded, not judged.

Four spellings of two unit types inside one cycle: `One-Bedroom` (study pp2–3),
`One-Bedroom A`/`B` (study p26), `1 Bedroom A`/`B` (both schedules), `1 BR A`/`B` (workbook).

## The allowance question, answered differently for the first time

Every document says **$0**: the prior schedule's Col. 5, the study's Unit Summary, the study's
threshold table, and the filed Col. 5. The study's own narrative explains it — heat, cooling,
cooking, hot water, other electric, water, sewer, trash and parking are **all included in
rent**. A third document exists (a PHA HUD-52667 bound at study p91) and its "Actual Family
Allowances" panel is **entirely blank**, so it is an exhibit rather than an applied schedule.

**First of thirteen properties where the third document agrees with a $0 Column 5 instead of
overriding it.** Worth holding onto when the allowance question is finally settled: $0 is
sometimes the right answer and must survive.

## team wrong — the filed workbook overstates its own headroom by 13×

| field | the study says | the filed workbook says |
|---|---|---|
| SAFMR, 1 BR | **$2,180** (zip 94612) | **$2,220**, labelled zip **`80204`** — a Denver ZIP |
| annual SAFMR | 5,101,200 | 5,194,800 |
| 150% ceiling | **7,651,800** | **7,792,200** |
| headroom | **+11,700 · 0.15%** | **+152,100 · 1.99%** |

The study's own arithmetic is internally consistent and its "Below" verdict holds either way,
but the filed sheet shows comfortable clearance where the study shows **$975 a month**. It
also ships a live `#REF!` in `R14`, and a cross-block formula that reads the wrong block's
unit counts while omitting a row. Stray template text names "Gill" and "Starmark" rents in a
Van Hazinga comparison.

**And the study itself carries two other properties' names, filed as-is:** page 7's running
header reads **`Raymond J. Lord Manor`** and page 26's table subtitle reads **`Hostmark of
Village Cove, Poulsbo, WA`** — corroborated by two Hostmark files sitting in the same archive.
Both leaks are in the filed package, under an owner's certification.

The contact's phone number differs between the transmittal (714 316-3021) and the owner's
cover letter (310 359-0047), and Appendix 9-2-1 is addressed to the owner itself.

## Two method findings worth more than either property

**1. `pdftotext` dropped a digit and nearly produced a false accusation.** The agent read
package page 9 as an image and saw `August 2, 2024`; the text layer renders the same line as
`August , 2024`. Had it trusted the parser it would have filed "the team bound an undated
study" as a team defect. **The read-as-images rule earned itself here.**

**2. Agents are clobbering each other in the shared scratchpad.** This agent wrote
`pdftotext` output to `scratchpad/study.txt`, a concurrent agent wrote the same path, and it
briefly read another firm's study while believing it was this one. It caught the swap only
because the content contradicted images it had already read. It re-extracted everything under
a pid-scoped path. **Every future agent brief must require a pid- or property-scoped scratch
path** — this is the same clobber that once made a test suite read another run's bundle.

---

# Mapleview Towers (75567) — wave 4 complete, and the comparator lied

## M36 · THE SWEEP'S OWN COMPARATOR PRODUCED A FALSE HIGH-SEVERITY MISMATCH

`_sweep/75567.json` reports:

> `unit.0.proposed · ours 3095 / theirs 3200 · mismatch · severity high`

**Both halves are wrong.** The filed workbook has two stacked blocks — rows 2–6 are the
**superseded $3,200 proposal**, rows 9–13 are labelled **`Revised`** and carry **$3,095**.
The comparator read the superseded block. And its own `notes` show it read the filed side from
`Submission/Archive/… (signed).pdf`, the **2 December 2025** submission that Gill Group
**rejected**, not the 30 April 2026 package that was actually filed and accepted.

Our value of 3,095 matches the governing filed figure **exactly**.

This is the third instrument failure in this register, after `OakCenter1` and the shared-formula
"missing formulas". It is the worst of the three, because it manufactured a *high-severity*
row rather than a cosmetic one. **Any high-severity sweep row must be confirmed against the
newest filed package and the governing block before it is believed.**

## M19 confirmed — tier 2 rejects a readable page, and there may be a reason

`uploads.rs.state = "could not be read"` in all four runs: *"the printed labels do not sit
where the form puts them (they are out by about **7.1 points**), so the values could not be
placed with confidence."* Two OCR calls, 30.7 s, then refused. `tier: unreadable:text`.

**The file did not deserve that.** `pdftotext -layout` returns every Part A row, both totals,
Part B, Part D and Part I correctly laid out, with no OCR at all. `pdffonts` shows embedded
subsetted fonts, there is a live AcroForm, and `pdfimages` finds three small rasters — a logo
and two signature strips.

**Westwood Village failed at 7.1 points too.** Same number, same message, both on files a
text parser reads cleanly. And the agent found a plausible cause worth chasing: the footers
disagree — **page 1 says "Page 1 of 2" and page 2 says "Page 2 of 3"** — so the document is
assembled from two different printings of the HUD-92458, which is exactly how a consistent
few-point offset would arise between the page and the blank the app registers against.

Consequence: **1 of 6 documents.** The workbook's `Current Rent` cell is empty, and that empty
cell is the only downstream trace of the whole prior schedule.

## The allowance agrees on zero — the second such property

Prior schedule Col. 5, the study's own table, ours, and the executed filing all say **0**, and
the third document (`Exhibit A - Mapleview Towers.pdf`, effective 4/1/2026) confirms it:
100 units, 1 bedroom, contract 3,095, **utility allowance 0**, gross 3,095. The filed workbook
has no allowance column at all.

With Noble Tower that is **two of fourteen** properties where the governing third document
agrees with $0 rather than overriding. Whatever finally settles Column 5 must not treat a
stated zero as an absence — the same lesson Part D learned in `83a1e14`.

## `rcsRecall` would cost a real user the one document the app delivered

`reopen.held.rcs.hasBytes = false` on both orders. The harness re-attached the study so the
two orders stayed comparable; **a real PM who closed the package and came back would lose
document 04** — which on this property is the only document generated. `d46e42e` made that
survivable rather than silent, but it is still a loss.

## Correct, and worth saying

The concluded rent is right: **$3,095** in the study, in our workbook, in the filed schedule
and in the tenant notice. Four spellings of one unit type across the cycle (`1BR/1BA`,
`One Bed`, `1-Bedroom`, `1 Bedroom`) and ours matches the study it read.

## team wrong

- **The filed draft's Part D is stale:** `Employee Unit / 1 Bedroom / 3,200` and total rent
  loss `$3,200`, while Part A prices that same unit at **3,095**. Left over from the rejected
  proposal. The executed copy corrects it to 3,095.
- The filed draft's **Part F is blank**; the executed copy carries $309,500.
- The tenant notice's header says `Stamford, CT 06901` and its comment paragraph says
  **06604** — in both the packaged and the loose copy.
- The loose tenant notice is five months stale, still showing the rejected `$3,200 / +$752`.
- Study grid p26 says `Cooking G` and `Hot Water E`; every HUD-92458 says `Cooking E` and
  `Hot Water G`. One of the two is wrong.
- The owner cover letter's letterhead is obscured by the DocuSign stamp — it reads
  `…iew Towers Preservation, LP`.

An agent honesty note worth keeping: it first read the draft's monthly potential as `$312.595`
at 150 dpi, re-rendered at 500 dpi, found an unambiguous comma, and **withdrew its own
finding** rather than filing it. 309,500 + 3,095 = 312,595 ✓.

---

# WAVE 6 — 2026-07-30 · Market Square · Barnum House · Shiloh Village · Morningside Court · 333 Holly

Twenty-six of thirty-four audited. Three defects shipped: `43258e0`, `c23b161`, `da46f05`.

## M37 — tier 2 read four schedules out of boxes that sat over the wrong printing · **FIXED `43258e0`**

Tier 2 reads a value out of the blank template's own field rectangle, and `rsDropTplLabels`
tells a printed label from an entered value by finding that label at the template's own
coordinates. Both rest on one premise — that this copy prints the form where the blank form
prints it — and nothing checked it.

Measured across all 34 properties the premise is **binary, not marginal**:

| | labels at template coordinates | of those present |
|---|---|---|
| shares the template's geometry (12 properties) | **28 – 128** | 78 – 99% |
| does not (8 properties) | **0 – 3** | 0 – 10% |

Nothing lies between 10% and 78%. So one pass settles it, and tier 2 now declines rather than
guessing, which hands the page to tier 3 — the tier that registers a page onto the template
before reading it and so can take an arbitrary geometry.

What the four misaligned-and-accepted properties were returning:

| property | project name it filed itself under | worst figure |
|---|---|---|
| Oaks on North Plaza | `OaksonINorthP,lazafkaNorthPlazaApartmentsPartA-ApartmentRents` | 14 units at **$111,198**/mo; monthly potential **$1,642,642** against a page printing **$91,922** |
| Shiloh Village | `ShilohVillageApts.      PartA-ApartmentRents` | types `2BR`, `BR3`, `4BR` |
| 333 Holly | `11fkaCreek333HollyHollyPartA-ApartmentRents` | types `BR3` |
| The Pines | `ThePinesfkaWoodGlenApartmentsPartA-ApartmentRents` | types `BR3` |

**Considered and rejected with evidence: measuring the offset and correcting for it.** On the
eight misaligned schedules the displaced labels agree on *no single shift* — 4 of 56, 5 of 62,
2 of 22, 6 of 27 land within 2pt of the best one. They are not shifted copies of our template;
they are a different printing of the form. Correcting a shift that is not there would have
placed values with false confidence.

**Also rejected: a plausibility bound on the values.** The garbage included a rent of
**11,918**, which sits inside any bound loose enough to accept real Section 8 rents (the corpus
runs 1,198–2,875). And the figure such rows would be reconciled against read as the *word*
`"Potential"`. A bound would have caught one of the six bad rows on Oaks and none elsewhere.

## M38 — the reader's only quality gate is disabled exactly when it is needed · **OPEN**

```js
const ok=outp.units.length>0&&(tot===''||Math.abs(sum-tot)<=Math.max(2,all.length));
```

`tot===''` means "there is no printed total to check against" and is treated as **passed**. The
total is the *only* check `rsAssembleFields` makes, and it goes missing precisely on the pages
that cannot be read. On all four M37 properties the printed total read as `"Potential"` or `""`,
so the gate degenerated to "at least one row exists" and waved the $1,642,642 through.

Not fixed this wave, and the reason is honest: its blast radius **cannot be measured offline.**
Nine properties reach tier 2 with no readable total in a diagnostic that stubs the OCR
tick-assist, and in the real app that assist supplies values afterwards — so whether requiring a
total would newly decline a good property can only be answered by a live re-drive. Do that
before touching this line.

## M39 — the workbook and the rent schedule disagreed about what a unit type is called · **FIXED `c23b161`**

`gen.js` builds Column 1 with `utype(br,ba,dg)`, whose comment already says why the designation
matters: *"Without it a property whose elderly and family rows carry different rents generated
two rows that read identically."* The workbook built its own label, `br + '/' + ba`, and dropped
both the designation and the spacing. Morningside Court's two one-bedroom types, at **$2,275**
and **$2,285**, print as `1 BR / 1 BA S` and `1 BR / 1 BA Large` on the rent schedule and as
`1BR/1BA` **twice** in the workbook beside it. `utype` is now module-scope, exported, and called
by both.

## M40 — two studies read as zero unit types because a gap emitted no characters · **FIXED `da46f05`**

The single highest-value repair found so far, and two agents reached it independently with
byte-level proof.

Cornerstone's letter tables are laid out identically across the corpus, but Acrobat emits them
two ways. The Pines and Oaks put a whole row in one `TJ` array, whose large kerning numbers
`rsRuns` already converts back to spaces. Shiloh Village and 333 Holly put each cell after its
own `Td` move — which moves the pen and shows nothing:

```
[(1)-96 ( BR)-71.9 ( /)-103.7 ( 1)-96 ( BA)]TJ
0 Tc 0 Tw 10.482 -0 0 10.4221 216.5607 309.732 Tm
(51)Tj  4.071 0 Td  (632)Tj  5.643 0 Td  [($1,)-35.7 (710)]TJ
```

So the row arrived as `1 BR / 1 BA51632$1,710$2.71Y`, every row pattern needs `\s+` between the
count and the next column, and both studies read as **zero** unit types. And with zero rows the
Apply button is never offered (`app.js` gates `rcsApply` on the unit count), which suppressed
not just the rents but **every scalar those letters carried** — including the correct property
name. Two whole packages went unwritten over a missing space character.

Verified end to end by re-driving Shiloh Village. Its workbook went from no RCS rents, no
SAFMR, and a false **"NO"** on the 150% test, to:

| | units | current | RCS rent | UA | SAFMR base |
|---|---|---|---|---|---|
| 2 BR | 16 | 1,355 | **1,830** | 102 | **1,590** |
| 3 BR | 80 | 1,537 | **2,235** | 124 | **2,000** |
| 4 BR | 72 | 1,709 | **2,535** | 133 | **2,550** |

Every figure matches the auditor's eye-read truth table. 333 Holly reads its four types with
the same fidelity.

**The threshold is 25 device points and it is not a matter of taste.** Cell gaps are an order of
magnitude wider than anything inside a cell — medians 44 to 125pt against intra-cell moves
reaching ~22pt. 1.5pt was tried first and **the suite refused it**: Golden Link draws `$1,580`
as `$1,` then a pen move then `580`, and that move is as wide as the moves between its own
cells, so the figure split and the row read as 580 units. No width rule can judge that boundary,
so a digit-comma-digit join is left alone — testing for the *comma*, not merely for digits on
both sides, because `30` and `537` are genuinely adjacent cells and welding them to `30537` is
the exact ambiguity the `TJ` rule exists to prevent. Belfry's studies use no horizontal `Td`
moves at all, so none of this can reach them.

## CORRECTION I OWE — M37 does **not** fix the contaminated property names

`43258e0`'s commit message overstates its reach. Re-driving Shiloh Village after the fix, the
name is **still wrong** — and now differently wrong:

```
before   ShilohVillageApts.      PartA-ApartmentRents      (tier 2)
after    Shiloh Village Apts. Part A Apartment Rents Show the actual   (tier 3)
```

Declining tier 2 sent the page to tier 3, which swallows the same heading. So M37 stops tier 2
**misplacing values** on a page it cannot locate — which is real and is what the $1,642,642 was
— but the name has a different and simpler cause, which both agents identified and I
under-weighted:

**M41 — our own template's Project Name box is 23pt tall and reaches below the next printed
row.** Field `1`'s rect is `y 678.59 … 701.59`; fields `2` and `3` beside it are 19pt with a
bottom edge at 682.59. `rsMapRects` accepts `r.y >= rc.y-1`, so the window is 677.59…701.59 —
and on Shiloh the project name sits at baseline 691.20 while `Part A - Apartment Rents` sits at
**680.64**, 1.95pt inside the box. Both get collected and joined. Confirmed independently on
333 Holly, where the value's runs are spread over baselines 693.36/693.24/693.12/691.20 (one
printed line, jittered by a scanner's OCR) with `Part A` 7.7pt below.

Two candidate fixes, neither attempted yet: raise field 1's read window to match its
neighbours, or cluster the runs inside a box by baseline and keep only the topmost cluster —
the latter also fixes the ordering, since `rsMapRects` sorts by descending y and so returns a
jittered line out of reading order. `rsLines` already solved exactly that for the HAP-number
label; `rsMapRects` never got the same treatment. **Do not edit the template PDF** — gen.js
writes through the same rect.

## The 7.1 points is SOLVED, and the queue item was misdiagnosed

There are **three printings of HUD-92458 (11/05)** in this corpus, and the discriminator is the
footer's page count, **not** the OMB expiry date:

| printing | OMB exp | p1 footer | registers? |
|---|---|---|---|
| 1 | 11/30/2020 | Page 1 of 3 | yes — Noble Tower reads |
| 2 | 04/30/2027 | Page 1 of 3 | our bundled template |
| 3 | 11/30/2020 | **Page 1 of 2** | **no — fails at ~7.1** |

Market Square and Mapleview Towers measure **identical to five decimal places** (scale 1.01059,
stage-0 median residual 7.58), which proves the residual measures *the blank*, not the document.
The "of 2" printing compresses Parts A–F onto one page with a different row pitch — Part B's
checkbox rows sit on a **14.4pt pitch against our 10.85pt**, and the top four shift-vote bins
span 24 points with near-equal support. **No similarity transform can absorb it, so tier 3's
refusal is correct behaviour.**

So "tier 2 refuses pages it can read" was wrong as stated. The pages are readable *as text* but
not placeable on *our template's geometry*. That reframes the work from "loosen a threshold" —
which would have been actively harmful, since it is the same misalignment that produced the
$1,642,642 — to **"add a label-relative reader"**: find the label, read the value beside it,
independent of our coordinates. That is the real fix for Westwood, Riverwood, Mapleview and
Market Square, and it is a new piece of work, not a tuning.

## M42 — `ocrPlace` throws away a page that registers perfectly · **OPEN, and cheap**

On Market Square and Mapleview, page 2 registers at **residual 0.00, scale 1.00000, over 66
label pairs** — and is discarded unread, because `ocrPlace` returns as soon as Part A fails
("Part A is the half we cannot do without"). That page carries Part G (ownership entity,
principals), Part H (signatory) and Part I (the HAP contract number) — none of which depend on
Part A. `ocrHalf` already exists for exactly this shape; `ocrParseRs` never reaches it. This is
a large part of "Part F blank (8)" and "Part I HAP number blank (7)".

## M43 — Part E has no model at all · **OPEN**

Barnum House files three commercial tenants — Creative Inkstinkts $1,045, United Roots $1,576,
Miss Thelma's Resturant $1,848, **total $4,469/month, $53,628/year** — on both the prior
executed schedule and the HUD-approved 2026 one. Our generated HUD-92458 prints Part E
completely empty, down to the "Total Commercial Rent Potential" box. There is no `commercial.*`
key in `db.js`, no Part E field id in `gen.js`, and **no warning anywhere**. Nothing was
misparsed; nothing was ever collected. It will hit every mixed-use property in the portfolio.

## M44 — a value run that is entirely punctuation is deleted · **OPEN, one line**

`rsDropTplLabels` skips `/^[_\-–—.]+$/` as "a rule to write on, not writing" — but it applies
that to *any* run, including one inside a value box. Barnum's schedule prints
`BARNUM HOTEL - CT26H03706` as four runs, and the run whose whole text is the hyphen is
deleted, so three generated documents say `BARNUM HOTEL CT26H03706`. A printed rule is
`_____`; a hyphen in a name is one character. Requiring 3+ such characters separates them.

## M45 — the study tile tells the user to replace a complete study · **OPEN**

`renderSources` derives its message from the unit count alone, so `_rn === 0 && !textless`
prints *"No appraiser's letter was found in this file. Check that it is the complete study."*
On 333 Holly and Shiloh the letter **was** found — `parsed.found` is available and unused — and
the tile shows a green ✓ beside `uploaded · not read`. It sent the user off to re-source a
complete 77-page study over a missing space character. M40 removes the trigger on these two;
the false message remains for any other study whose rows fail.

## M46 — the checklist prints a blank date under a false-claims signature · **OPEN**

`checklist.sign_date` has no automatic source **and is not in `DOC_REQS.checklist`**, so the
checklist scores `✓ ready` while printing "Date:" with nothing after it, on a form the owner
signs under 18 U.S.C. §1001.

## M47 — the checklist's 17 ticks are a hard-coded default · **OPEN**

`app.js` sets all on except indices 2 and 4; nothing consults the study. So we assert a
document that does not exist (the appraiser's licence, where Morningside's and Barnum's studies
both answer **N** to "did you prepare the RCS under a temporary license?") and leave "Scope of
Work" unticked where the study carries a Scope of Assignment section. Two properties each way.

## M48 — the checklist signature line runs off the page · **OPEN**

`gen.js` draws it at `x:109` with **no width measurement, no wrap, no truncation**. Barnum's
signatory line reaches **x 611.5 on a 612pt page**, truncated mid-word, and the white rectangle
behind it covers only the field's own box — so two overlapping strings survive in the text
layer with different content.

## M49 — every generated workbook ships a named employee and a stale path · **OPEN**

`xlsx.js` embeds a real Related workbook as a base64 zip and never rewrites `docProps`. Every
workbook that goes to a contract administrator carries `dc:creator = "Beatty, Claire"`,
`Company = "Related Partners Inc."`, a 2025-10-14 creation date, and
`absPath = /Users/matthewkodsi/Desktop/github/Form-Automation/Blank RCS Package/`.

## RIG CORRECTIONS — these invalidate comparisons, and matter more than most defects

**1. The study-selection rule trusts the filename over the letter date, and on Market Square
that picks the OLDER study.** Three revisions exist: Sept 24 (`$2,375`, bound into the filed
Submission), Oct 29 (`$2,375`, the file *named* `(updated)`, which the manifest chose), and
**Nov 21 (`$2,325`, plain filename, the latest)**. The **fully executed, HUD-approved** FY2026
rent schedule in the same folder says **$2,325**, and so does the team's own workbook. Our app
emitted $2,375 — matching the filed Submission exactly, so a Submission-only comparison
**scores it correct** while the operative figure is $50/unit lower. Any property with an
"(updated)" study may have been audited against a superseded conclusion.

**2. The executed rent schedule, not the Submission PDF, is the authority on what was
approved.** And the letter date *inside* the study, not the filename, decides which study is
current.

**3. The corpus picked the weaker of two prior schedules on Barnum House.** `2025/Barnum House
- 2025 Rent Schedule.pdf` is owner-signed only, with Part I blank and a truncated contract
number glued to the project name. Beside it sits `2025/FY 2025 RS - Barnum House eff.
04.01.25.pdf` — HUD-countersigned, **Part I = CT26H037068**, Part F filled, correct rates, clean
name. Preferring the countersigned copy would have handed the app the contract number for free.

**4. `_sweep/75569.json`'s "79 differences" are mostly its own comparator's fault** — it reads
the filed rent schedule **one field off** (`property.name → "N/A"`, `total.units →
"YearlyContractRentPotential"`) and zero of the 17 checklist ticks. The filed FY2026 RS is a
*retyped* 92458, not our template's geometry. Every `severity: high` row in that record is an
artefact. This is the second time the comparator has invented a high-severity finding.

## team wrong — the app caught real errors in filed deliverables

- **Morningside Court's filed workbook is wrong on both numbers the 150% gate is made of.**
  Allowances **68/66/120** and SAFMRs **2,040/2,300/2,960**, which match *nothing* in the
  folder — not the 2025 UAF worksheet that set 34/33/57, not the executed schedule that filed
  those same figures, not the study's own SAFMR table, not the 2021/2024/2025 schedules. Ours
  reproduces the study's $395,822 and $456,900 to the dollar.
- **Barnum's filed, HUD-countersigned schedule misnames the mortgagor entity in Part G** —
  `BARNUM HOUSING PRESERVATION, L.P.` — and contradicts itself in Part H two inches below.
  Ours prints the correct `BARNUM HOUSE PRESERVATION, L.P.` Do not fix the app toward this.
- Shiloh's UA workbook has a stale "Current Utility Allowance" column (86/104/112) matching no
  schedule in force; it did not feed the Proposed figures, so the filing is unaffected.
- 333 Holly's study Re: block names **San Antonio** where its body, its SAFMR zip and every
  filed schedule say The Woodlands — so when the name reader is fixed, the Re: block is the
  wrong line to trust on this document.
- 333 Holly's filed workbook carries a `Gill Grids - As Is` block naming two firms with no
  connection to this Cornerstone study.
- Belfry's grid header on Market Square reads `CT26N037003` — H→N — in the grid only.
- Barnum's study promises the CT DOH Utility Allowance Schedule "in the addenda" and **it is not
  there**; the addenda are a divider, a résumé and the certification.

## The utility allowance: a decision only Matt can make, now with a price

Shiloh Village's governing FY2026 allowances — **$101 / $103 / $111** — exist only in
`2026 (RCS)/Archive/UA - Shiloh Village 2026 2-12-2026.xlsx`, derived from 12-month bill
sampling. The study deliberately carries the **prior** figures and says so in its own footnote
(*"Utility Allowances From Rent Schedule"*). So the app cannot reach the filed numbers from
either of its two inputs, and carrying 102/124/133 forward is correct given what it was given
and still produces the wrong draft schedule. It also cannot detect that this cycle is a **UA
decrease**, which changes the tenant notice's governing rule from 24 CFR 245.310 to **245.410**.
Same shape on 333 Holly, where FY25 has no UA schedule at all and only Exhibit A states the
figures.

---

# WAVE 7 — 2026-07-30 · The Pines · Colonial Village · Friendship Court · Newberry Arms · Northgate Terrace CA

Two defects shipped: `1b3b883`, `b68833c` (+ `691d765`, the bundle whose delivery lost a coin toss).

## M41 — a box that reached into the next printed row, and read itself backwards · **FIXED `1b3b883`**

Two faults, one symptom, and the symptom reached every generated document and all three
filenames on four properties.

**The geometry.** Field 1, the Project Name, is 23pt tall in our own blank where fields 2 and 3
beside it **on the same printed row** — the FHA number and the effective date — are 19pt. Its
floor therefore sits 4pt lower, which on this form is most of a row, and the
`Part A - Apartment Rents` divider prints its baseline 1.95pt **inside** field 1's window.

**The order.** `rsMapRects` sorted its runs by descending baseline. Right for a level page,
wrong for a scanner's text layer: 333 Holly prints `333 Holly fka Holly Creek II` on one line
and its OCR layer gives that line four baselines within 2.16pt, so height order returned
`11 | fka Creek | 333 | Holly Holly`. The `11` is the scanner reading the roman numeral II at a
third the font size of its neighbours. `rsLines` had already solved this for the HAP-number
label; `rsMapRects` never got the same treatment.

The clamp needs no threshold: **a box is clamped to the shallowest floor on its own printed
row.** Only 12 of the 95 rows on page 1 disagree about their floor at all, 11 of them by about a
point — sloppiness far too small to reach another row, since rows are 10–12pt apart. Field 1's
row is the only one that disagrees by enough to matter, which is why it was the only one
misreading.

Measured across all 34 properties: 8 change, none regress. The wins go well past the names —

| | before | after |
|---|---|---|
| Shiloh Village, 333 Holly, The Pines — a unit type | `BR3` | `3BR` |
| Shiloh Village — effective date | `1/5/` | `5/1/` (**month and day were transposed**) |
| Oaks on North Plaza — first principal | `onPlazaNorthGP, LLC` | `onNorthPlazaGP, LLC` |
| The Pines — limited partner | `FargoAffordableDevelopmentCorporationLimitedPartnerHousingCommunity` | in order |
| Shiloh Village — project name | `ShilohVillageApts.      PartA-ApartmentRents` | `ShilohVillageApts.` |

## M50 — the form's own printed lines were arriving as data · **FIXED `b68833c`**

`rsDropTplLabels` drops a label by finding it **where the template prints it**. Right on a page
laid out like the template; finds nothing on a page that is not. So declining the misaligned
pages (`43258e0`) only moved the swallow to tier 3 — Shiloh came back from OCR as
`Shiloh Village Apts. Part A Apartment Rents Show the actual` — and the M41 clamp could not
reach 333 Holly or The Pines, where the divider prints **above** the row-mates' floor.

Text reaches all of them: whatever coordinates it arrived at, a line reproducing one of the
blank form's own printed lines is the form talking. One helper, both tiers, so a page cannot be
scrubbed one way on the text path and another after OCR. An 8-character floor keeps it away
from short values (the divider normalises to 19 characters, `N/A` to 2), and the match is on a
whole line, so `Part A Apartments LLC` survives.

The names finish here — 333 Holly `333HollyfkaHollyCreek 11`, The Pines
`ThePinesfkaWoodGlenApartments` — and **verified end to end through tier 3**: re-driving Shiloh
Village now names its documents `Shiloh Village Apts.`, exactly what the executed schedule's
Part A prints.

The larger surprise is how much boilerplate had been arriving as data on 8 properties, with no
real value lost:

- **`Disposal` and `Tennis Courts` were being read as TICKED Part B boxes** on Westwood Village,
  Riverwood, Mapleview Towers and Market Square — the form claimed a disposal and a tennis court
  were included in the rent. This is precisely the fault `rsDropTplLabels`' own comment
  describes, surviving where position cannot see it.
- **`NameandTitle`**, the Part G column header, was the name of every **empty** principal row —
  four each on Shiloh Village and The Pines — and rode on the end of the real ones.
- `TypeofEntity` as an entity value; `Worksheet (to be completed by HUD or lender)`,
  `Enter Maximum Allowable Monthly Rent`, `Potential From Rent Computation` and `Potential` as
  Part F figures; `Total Commercial Rent $0` now reads `$0`.

## M51 — the workbook prints a fabricated rent increase · **OPEN, highest consequence in the wave**

Newberry Arms' prior schedule could not be read (7 of 8 anchors), so Current Rent `D9:D12` is
empty. The delta cells are unconditional formulas over that column: `J22 = J20-I20` with
`I20 = 0`, so the delivered workbook prints a monthly increase of **$87,900** against a true
**$23,748** — the entire gross potential presented as the increase, a **3.7× overstatement** —
with `M22 = $1,054,800` and `#DIV/0!` in the percentage cells beside it.

**This is the app stating something false rather than omitting it**, and it is why "the prior
schedule was not read" cannot be filed as merely incomplete output. It generalises to every
property whose prior schedule is unreadable. A blank would be honest.

## M52 — a two-appraiser signature block loses the appraiser's name · **OPEN, two properties**

`rcs.js readSignature` scans the lines after "Sincerely," and requires a 2–4-token name. Belfry
signs some letters in **two columns**, so the assembled line carries both appraisers:
`Aaron M. Zabel   Rachel A Walsh` on Newberry Arms, `Aaron M. Zabel   Matthew A. Polnow` on
Morningside Court. Five or six tokens, so the regex rejects it, the following lines are caught
by the `license|certified|president|associate` skips, and the window is exhausted. `appr.firm`
survives because it comes from the letterhead.

`appr.name` is a requirement of the **owner cover letter**, so on both properties this alone
withholds a document. Two properties, one mechanism, and the runs carry the x positions needed
to split the columns.

## M53 — one unreadable source disarms the allowance review gate · **OPEN**

`score.js` raises the allowance caveat only when `ua_exec` **and** `ua_rcs` are both present.
Newberry Arms' allowance changes on all four types and the 4BR **decreases** $158 → $147 — the
case where owner review matters most — and because `ua_exec` was empty the study's figure was
adopted in silence. The team recognised it and served a 24 CFR 245.420 notice. Every gate keyed
on "both sources present" fails the same way.

## CORRECTION — "Part I HAP number blank (7 properties)" is largely NOT a defect

Page 3 of the schedule prints its own instruction: *"Part I. Do not complete this Part. The HUD
Field Office/lender will complete this part."* On Newberry Arms the owner's 10/30 copy is
correctly blank and the contract administrator wrote `SC16-0061-002` on 11/18. So a blank Part I
in an owner's submission is right, and the HAP number only ever appears in the returned copy.
Market Square's audit says the same of **Part F** (*"Part F. Do not complete this Part."*).
Before anything is "fixed" to fill either, read the form's own instruction. What remains of M42
is Parts **G and H**, which the owner does complete.

## team wrong — a tenant notice names the wrong property

**Newberry Arms' UA-decrease notice tells its residents that "tenants of _Clinton Manor_" may
inspect the materials and submit comments** — twice, in the two 24 CFR 245.420 participation
sentences — while the address, property name, contract number and the $158→$147 figure are all
correctly Newberry's. Clinton Manor is Belfry job 25-093 to Newberry's 25-095, the adjacent job
in one engagement on the same `SC16-0061-xxx` contract series. Clinton Manor's own notice and
Friendship Court's are both clean, so this is a one-directional copy-forward that survived to
service.

It also shows the corpus loop's blind spot: the file sits in a `UA Baseline/` subfolder the
manifest does not enumerate, in a `.doc` the extract pipeline never opens, in a document type
the RCS flow does not generate — three independent reasons the sweep could never have reported
it, on the property the sweep called quietest in the wave. *(Read with a text extractor, not a
rendered page, because a `.doc` has none. A human should confirm before acting.)*

Also: the filed tenant notice and the decrease letter both drop "Drive" from
`186 Newberry Arms Drive`; and the contract administrator's own notification page carries a dead
entity name, `Newberry Arms Limited Partnership`, against Part G's `Newberry SC Preservation,
L.P.`

## A difference count is not a measure of agreement — twice confirmed

Newberry Arms was the **lowest** count in the wave at 18, and 14 of the 18 are noise: 8 are
`missing-theirs` on figures the filed workbook plainly carries (its UA header is
`"Proposed ⏎UA"` with an embedded newline, and its SAFMR column stores the 150% value from a
`{base*1.5}` formula while the comparator looks for the base), and 4 are the unit-type label
where ours uses the study's spelling and theirs the HUD Column 1 spelling — both internally
correct. The comparator ran 26 comparisons and **all 26 were against the workbook**, because
five of six documents were withheld. Zero wrong dollar figures were found by the comparator on
a property where the app prints a $87,900 increase that does not exist.

Verified right, and worth stating: the 150% test agrees across all three sides on a **$306/month
margin** ($95,814 < $96,120), which is the sharpest available test of `592101a`, and the
`_snap-w6` copy of this workbook shows the pre-fix SAFMR as **787.3333333333334** — a repeating
decimal in a rent cell.

## M54 — our blank's vertical metrics do not match the filed rendition, in THREE places · **OPEN, and this is the shape of the remaining work**

The Pines' audit measured every one of them on one page, which turns M41 from a fixed field into a
recognised class:

| where | our blank | this scan | consequence |
|---|---|---|---|
| Project Name box | rect 23pt tall, y 90.41→113.41 | the drawn cell's bottom rule is at y≈100 | the rect over-reaches the printed cell by **12–13pt**, so it takes the divider printed **10.32pt** below at the **identical 24.24pt** left margin |
| Part A grid | starts y 200.41, pitch 12.00 | starts y 208.33, pitch 12.00 | same pitch, **+7.92pt out of phase** — two-thirds of a row |
| Part H name/title, field 228 | rect y 601.51→636.51 | `Flynann Janisse, President/Chairman of the Board` occupies y 587.3→596.6 | the rect sits **4.9pt BELOW the line it exists to capture — zero overlap, every tier, every run** |

That last one is the whole difference between "the app generated no document the filed package also
has" and a real comparison on this property: `DOC_REQS.checklist` needs only `property.name`,
`sig.name`, `sig.title`, and the two missing ones are printed in clean 10pt type on page 2 of the
schedule the app was handed. **A fix that anchors each page's rects to found text before placing
anything closes all three; a fix aimed at one box closes one.** The M41 row-mate clamp was the
right first step and is not the general answer.

## M55 — the two upload orders disagree, and the harness says they do not · **OPEN, high**

On The Pines in **`rs-first` order only**, the study's rows attach one row early: row 9 (40 units,
current $1,350) gets $1,820, row 10 gets $2,230, row 11 comes out **blank**, and a **phantom row 12
with no unit count** carries $1,640. Monthly proposed reads **$298,960** against a true $285,840,
annual **$3,587,520** against $3,430,080, and the delta 23.1% against 17.72%. `rcs-first` is
correct. The 150% verdict still reads YES by luck.

Two things make this worse than one property's arithmetic. The harness prints *"both orders produce
comparable packages"* — which is false here. And in **both** orders the workbook's unit-type cells
are wrong (`2 BR / 1 BA`, `3 BR / 1 BA`, `3 BR / 1.5 BA BR`, that last from a stray
`units.2.label = "BR"`), which is consistent with the +7.92pt phase error above putting Column 1's
text over the wrong row while the numeric columns still reconcile. Suspected as to cause, confirmed
as to effect.

## M52 confirmed on a THIRD property

`readSignature` requires a 2–4-token name after "Sincerely,"/"Respectfully submitted,". Belfry and
Cornerstone both sign some letters in two columns, so the line carries both people:

- Newberry Arms — `Aaron M. Zabel   Rachel A Walsh`
- Morningside Court — `Aaron M. Zabel   Matthew A. Polnow`
- Northgate Terrace CA — `Aaron M. Zabel   Rachel A Walsh`

Six tokens, rejected; the following lines are then eaten by the `license|certified|president|
associate` skips and the window is exhausted. `appr.name` is a requirement of the **owner cover
letter**, so on each of the three this alone withholds a document. The runs carry the x positions
needed to split the columns.

## M56 — an email address was read as the appraisal firm · **OPEN, one line**

`readSender` takes the first of the letter's first 8 lines matching
`/valuation|appraisal|appraiser|associates/i`. On Northgate Terrace **line 2 is the e-mail**, so
`appr.firm` was stored as **`"(E) azabel@belfryvaluation.com"`** — it contains "valuation". No `@`
guard anywhere, and the title-page fallback then declines to overwrite it. `DOC_REQS.owner`'s own
comment warns about this exact print.

## M42 confirmed on a SECOND property, with a different cause

Northgate Terrace's page 1 is a 600-dpi scan sliced into **360 JPEG bands**, ~4.24 MB — about **5%
over** the OCR function's own 4 MB pre-flight guard, so it was rejected. **Page 2 is 0.33 MB, cannot
trip that guard, and was successfully read and billed — then discarded**, because `ocrPlace` returns
null the moment Part A fails. It carries the entity, the principals, the signatory, the title and
the HAP number: 3 of the 4 fields blocking the draft schedule and both blocking the checklist.
Raising the size cap is the hard half; **keeping the half already paid for is the easy half**, and
alone it moves this property from 1-of-6 to within reach of ready with no new OCR call.

## M57 — a utility-allowance DECREASE needs a second notice the app cannot produce · **DECISION FOR MATT**

Friendship Court's 2BR allowance fell $85 → $83, and the team served a separate
`UA decrease letter 01.27.26.pdf` under **24 CFR 245.420** — subpart D, not the subpart B
rent-increase notice at §245.310 — signed by a **different person** (Amy Bence, Regional Manager)
from the rent-increase notice (Joy Walker, Community Manager). Shiloh Village is the same shape.
`score.js` has a `uanotice` document but it belongs to the UAF program, so in the RCS flow the app
models one tenant notice, has no input for the allowance schedule, and no way to detect a decrease.

And the governing figures are not merely unread — they are a **human judgement** the app could not
reproduce even with the spreadsheet: Friendship Court's utility-analysis workbook computes
108.91 and 124.47, and the signed UA Summary filed **105** and **118**.

## CORRECTION — "checklist Scope of Work unticked" is the app's fault, not a team habit

Recorded earlier as possibly a team convention because the *unsigned* filed copies leave it blank.
Colonial Village's **signed** `Owners Checklist v2` ticks it, and so does Newberry Arms' and
Friendship Court's signed copy. The app hard-codes it off (`app.js` seeds all 17 ticks on except
indices 2 and 4) and never consults the study — which carries the section under Belfry's own
heading **"Scope of Assignment"**, so a literal phrase match would miss it even if it looked.
The appraiser-licence item is the mirror image: ours ticks it, the study answers **N** to "did you
prepare the RCS under a temporary license?", and on Friendship Court ours and theirs each tick 15
of 17 — **but not the same 15**.

## The comparator, a third and fourth time

Friendship Court's **98 differences are 8 real ones**: 69 rows are `missing-theirs` on a
DocuSign-flattened rent schedule from which it extracted **zero of 69** fields, 19 are the
retyped checklist yielding **zero of 17** ticks, and 30 are drift on unchecked static labels.
Colonial Village's 39 are **7 real**: 20 are the rig failing to read DocuSign vector ✓ glyphs on the
signed checklist, and because that copy carries no property name the extractor's anchor fell through
to the DocuSign date and filed `ours "ColonialVillage" / theirs "7/7/2026"` at severity **high**.
Northgate Terrace's manifest is wrong in the other direction: `problems` says "no filed
submittalLetter, checklist" and `hasCombined: false`, but both documents exist, signed, inside a
66-page PDF classified only as "Option 1 Renewal" — so its "zero overlap" was measured against an
incomplete `docs` list. **Four properties now: the count measures the comparator, not the app.**

## team wrong, this wave

- **Colonial Village's filed draft prints a $160 utility allowance on the 2BR row** which matches
  nothing — not its own UAF letter (which computes 93 + 68 = **161**), not the study, not the team's
  own workbook, all three of which say 161. It also labels the 33-unit $2,400 row **`1 BR`** where it
  is the three-bedroom line, and its Part H names **Matthew Finkle** where every other document and
  every signature is David Pearson.
- **Friendship Court's countersigned Part I reads `SC16M000084`** against the contract's
  `SC16-M000-048` — a digit transposition written in by the contract administrator.
- Friendship Court's study prints `$133,744 > $138,060` under a heading that reads
  `RCS GROSS RENT < SAFMR GROSS RENT`, in **all three** revisions; the arithmetic is right.
- The Pines' team files the Section 8 contract number in the **FHA Project Number** box on both
  schedules, while their own Exhibit A and the CA's notice both say the FHA number is **N/A**.
- One person, three titles in one cycle on The Pines: `President/Chairman of the Board`,
  `Executive Director of General Partner`, `Director of the GP`. Two phone numbers for one point of
  contact on The Pines and on Northgate Terrace both.
- Northgate Terrace's signed submittal letter says **"Northgate Village Apartments"**.

## Verified right, on the sharpest margins in the corpus

Newberry Arms clears the 150% ceiling by **$306 a month** and all three sides agree
($95,814 < $96,120) — the best available test of `592101a`, and the `_snap-w6` copy of that same
workbook shows the pre-fix SAFMR as **787.3333333333334**, a repeating decimal in a rent cell.
Northgate Terrace clears by $58,290 and agrees exactly. Colonial Village, Friendship Court and
Northgate Terrace each reproduce their study's 150% figures to the dollar. And Colonial Village's
$0 allowance is genuine on three documents, with the reason printed on study p.33 — every utility
is included in the rent.

---

# WAVE 8 — 2026-07-30 · Fairview Homes · Walden · Marine Terrace

The last three properties driven at `b90a2d8` (snapshot `_snap-w7/`); their audits were in
flight when this was written. Two defects shipped: `2d2ffd6`.

## M52 — a two-column signature block loses the appraiser's name · **FIXED `2d2ffd6`**

`readSignature` requires a two-to-four-token capitalised line after "Sincerely,". Belfry and
Cornerstone sign some letters in **two columns**, so the line carries both people:

| property | the line as it assembles |
|---|---|
| Newberry Arms, Northgate Terrace CA | `Aaron M. Zabel   Rachel A Walsh` |
| Morningside Court | `Aaron M. Zabel   Matthew A. Polnow` |

Six tokens, rejected; the following lines are eaten by the
`license|certified|president|associate` skips and the window runs out. `appr.name` is a
requirement of the **owner cover letter**, so on each of the three this alone withheld a document
the team filed.

The split is **down the middle**, not at the first position that parses — two columns hold one
name each, so a balanced split reflects the layout, whereas trying every position would accept
`Aaron M.` off the front of `Aaron M. | Zabel Matthew A. Polnow`, which parses equally well and is
not a person. There are checks for that trap and for prose and a job number after "Sincerely,"
yielding nothing.

## M56 — an email address was read as the appraisal firm · **FIXED `2d2ffd6`**

`readSender` takes the first opening line matching
`/valuation|appraisal|appraiser|associates|…/`. Northgate Terrace's letter puts the appraiser's
e-mail on line 2 and its domain contains "valuation", so `appr.firm` was stored as
**`"(E) azabel@belfryvaluation.com"`** and shipped on the owner cover letter's certifications; the
title-page fallback then declines to overwrite a firm it believes it has. Proved against the old
code: given only that line, the old reader returns it as the firm and the new one returns nothing.

## Sweep counts for the last three, before their audits

Walden **97**, Fairview Homes **95**, Marine Terrace **14**. On the evidence of four earlier
properties, expect most of the two large counts to be the comparator failing to read a
DocuSign-flattened schedule and a retyped checklist — and expect the small one to mean little was
produced rather than that little differs.
