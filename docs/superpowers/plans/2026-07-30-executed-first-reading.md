# The executed-first reading path

*2026-07-30 · branch `vis-ocr` · written from a measurement of all 34 filed packages*

---

## 0. The decision this rests on, and it is closed

**The app always asks the property manager for the EXECUTED (countersigned) rent
schedule. It never asks for the draft.** In the owner's own words:

> "the executed schedule may differ from the draft, and there is no way to know
> whether that is true by looking at the draft, since PMs do not go back and
> revise the draft to reflect the final RS. also, executed RS should always be
> saved, while occasionally a PM might dumbly delete a draft once they received
> the executed schedule countersigned by the CA."

Everything below is downstream of that. The draft is usually the *readable* copy —
it is the one that still carries the form fields — and that is not a reason to ask
for it. A readable wrong number is worse than an unreadable right one. Do not
reopen this to save OCR spend; the spend is the price of asking for the document
that is true.

---

## 1. The census

Every property's **current-cycle** rent schedule, choosing the executed copy where
one exists (the manifest's own `rsRank`: `fully executed` / `executed` /
`approved` > `(signed)` > `final` > unqualified > `unsigned` > `draft`). Measured
offline, with the app's own reader and pdf-lib, on 2026-07-30.

Classes:

- **A** — usable AcroForm fields; tier 1 reads it.
- **B** — no usable fields, but the printed page carries the values; tier 2 reads it.
- **C** — neither. **OCR is the only path.**

| # | Property | Executed schedule the app would be given | Pg | Fields (filled) | Text chars per page | Images per page | Picture pages | Class |
|---|---|---|---:|---|---|---|---:|:-:|
| 1 | Northcross | Northcross Townhomes (NC19-E000-007) - 2024 Rent ... | 3 | 1 (0) | 2958 / 1046 / 3346 | 0 / 0 / 0 | 0 | B |
| 2 | Westwood Village | FY2025 Rent Schedule.pdf | 2 | 0 (0) | 2757 / 1593 | 0 / 3 | 0 | C |
| 3 | Riverwood | Executed - FY2025 RS.pdf | 2 | 0 (0) | 2801 / 1584 | 0 / 3 | 0 | B |
| 4 | Burt Farms I | Burt Farms I Rent Schedule eff. 6.26.2024.pdf | 3 | 0 (0) | 0 / 0 / 0 | 0 / 17 / 0 | 1 | C |
| 5 | Sycamore Green | Sycamore Green - Fully Executed RS eff. 03.30.25.pdf | 3 | 0 (0) | 2691 / 1713 / 4723 | 0 / 3 / 0 | 0 | C |
| 6 | New Horizons | New Horizons_Rent Schedule (Owner Executed).pdf | 3 | 1 (0) | 58 / 149 / 58 | 0 / 0 / 0 | 0 | C |
| 7 | North Park | North Park - 2025 Approved Rent Schedule.pdf | 3 | 0 (0) | 2952 / 1026 / 3300 | 0 / 0 / 0 | 0 | B |
| 8 | Woodbury Oakwood (Lakeside) | Woodbury Oakwood (Lakeside) - Rent Schedule eff. ... | 3 | 1 (0) | 2964 / 1117 / 3346 | 0 / 0 / 0 | 0 | B |
| 9 | Hampshire House | Hampshire House Rent Schedule eff. 10.1.24.pdf | 4 | 0 (0) | 917 / 0 / 0 / 938 | 22 / 0 / 63 / 0 | 1 | C |
| 10 | Lansing Manor | 800010652 - Approved Rent Schedule - 12-29-25 - L... | 4 | 0 (0) | 1718 / 3280 / 2033 / 657 | 2 / 0 / 1 / 0 | 0 | B |
| 11 | Noble Tower | Noble Tower FY2025 Executed RS.pdf | 2 | 0 (0) | 2858 / 1091 | 0 / 1 | 0 | C |
| 12 | Oaks on North Plaza | Rent_Schedule_Eff_1-1-25.pdf | 2 | 0 (0) | 2556 / 1548 | 1 / 1 | 0 | B |
| 13 | Oceanport | Oceanport Gardens Rent Schedule eff. 7.1.24.pdf | 4 | 0 (0) | 779 / 0 / 0 / 1146 | 38 / 0 / 65 / 0 | 1 | C |
| 14 | Holly House | Holly House - Executed RS - FY2025.pdf | 4 | 0 (0) | 0 / 0 / 0 / 0 | 44 / 0 / 65 / 0 | 2 | C |
| 15 | Ebony Gardens | FULLY EXECUTED Rent Schedule_Ebony Gardens.pdf | 3 | 0 (0) | 0 / 0 / 0 | 36 / 27 / 30 | 3 | C |
| 16 | Mapleview Towers | FY2026 RS - Mapleview Towers eff. 04.01.26 (execu... | 2 | 0 (0) | 2664 / 1584 | 0 / 2 | 0 | B |
| 17 | Market Square | Market Square-FY 2026 - RS (fully executed).pdf | 2 | 0 (0) | 2667 / 1594 | 0 / 3 | 0 | B |
| 18 | Barnum House | FY2026 RS - Barnum House eff. 04.01.26.pdf | 2 | 0 (0) | 2722 / 1595 | 0 / 3 | 0 | B |
| 19 | Shiloh Village | Shiloh Rent_Schedule_Eff_5-1-26.pdf | 2 | 1 (0) | 2568 / 1476 | 1 / 1 | 0 | B |
| 20 | Morningside Court | *none filed in the current cycle* | – | – | – | – | – | – |
| 21 | 333 Holly | 333 Holly - Rent_Schedule_Eff_7-1-25.pdf | 2 | 0 (0) | 2453 / 1591 | 1 / 1 | 0 | B |
| 22 | The Pines | The Pines - Rent_Schedule_Eff_7-1-25.pdf | 2 | 0 (0) | 2523 / 0 | 1 / 1 | 1 | B |
| 23 | Colonial Village | 05 - Colonial Village - Draft Rent Schedule.pdf | 3 | 232 (83) | 2685 / 803 / 3288 | 0 / 0 / 0 | 0 | A |
| 24 | Clinton Manor | Final Copies - Clinton Manor (SC16-0061-005) Rent... | 3 | 0 (0) | 0 / 0 / 0 | 1 / 1 / 1 | 3 | C |
| 25 | Friendship Court | Friendship Court (SC16-M000-048) - 2026 Rent Sche... | 3 | 1 (0) | 3059 / 1074 / 3346 | 0 / 0 / 0 | 0 | B |
| 26 | Newberry Arms | Newberry Arms (SC16-0061-002) - 2026 Rent Schedul... | 3 | 1 (0) | 3089 / 1069 / 3346 | 0 / 0 / 0 | 0 | B |
| 27 | Circle Park | 2026-Rent Schedule-Circle Park Apts IL060054027 -... | 3 | 0 (0) | 8 / 56 / 0 | 0 / 55 / 0 | 1 | C |
| 28 | Peterson Plaza | 2025 Rent Schedule-Peterson Plaza eff. 09.01.25 (... | 2 | 0 (0) | 2705 / 1651 | 0 / 3 | 0 | C |
| 29 | Northgate Terrace CA | Northgate Terrace FY2025 Executed RS.pdf | 2 | 0 (0) | 0 / 10 | 0 / 88 | 1 | C |
| 30 | Fairview Homes | Fairview Homes Rent Schedule eff. 5.7.25.pdf | 4 | 0 (0) | 630 / 0 / 0 / 1033 | 30 / 0 / 88 / 0 | 1 | C |
| 31 | Walden | Walden aka The Cedars Rent Schedule eff. 7.16.25.pdf | 3 | 0 (0) | 3016 / 1722 / 4736 | 0 / 37 / 0 | 0 | C |
| 32 | Marine Terrace | Marine Terrace Executed RS eff. 06.30.26.pdf | 3 | 0 (0) | 0 / 26 / 0 | 0 / 2 / 0 | 1 | C |
| 33 | Oak Center | Oak Center 1 - FY2026 Executed RS.pdf | 3 | 0 (0) | 0 / 20 / 0 | 0 / 1 / 0 | 1 | C |
| 34 | Morh Housing | Morh I Housing FY2026 Executed RS.pdf | 3 | 0 (0) | 0 / 20 / 0 | 0 / 26 / 0 | 1 | C |

### Totals

| Class | Properties | Share |
|---|---:|---|
| **A** — form fields | **1** | Colonial Village, and its only filed schedule this cycle is the *draft* |
| **B** — text-readable | **14** | |
| **C** — OCR only | **18** | |
| no schedule filed | 1 | Morningside Court |
| **total** | **34** | |

**15 of 34 are readable without OCR; 18 of 34 are not.**

### On the "9 of 34" figure

It does not hold, and it is now low rather than high. `corpus/drive.js:23` says
"only 7 of 34 filed schedules are readable without it"; the memory note from the
four-printings work says tier 2 "went from 3 of 34 to 9". Measured today the app
reads **15** of the 34 current executed schedules without OCR — 1 through fields
and 14 through text. The difference is not a disagreement about the documents; it
is that `rsTableA` (the Col. 1..Col. 8 table reader, landed 2026-07-30) turned
four scanner-text-layer copies into readable ones, and that this census picks the
current cycle's executed copy by rank rather than by a filename regex. **Both the
comment in `drive.js` and the memory note are stale and should be corrected to
15 / 18.**

### What the class-C copies actually are

Not one thing. Three shapes, and they call for different handling:

1. **True scans** — 12 of the 18 have at least one page that is nothing but images
   (Burt Farms, Hampshire House, Oceanport, Holly House, Ebony Gardens, Clinton
   Manor, Circle Park, Northgate Terrace, Fairview, Marine Terrace, Oak Center,
   Morh). Several are *tiled*: Northgate Terrace's page 2 is 88 separate images,
   Fairview's is 88, Holly House's 65. A single full-page image is the exception,
   not the rule, so "is there one big picture on the page" is not a usable test.
2. **Flattened e-signed copies** — Westwood Village, Sycamore Green, Noble Tower,
   Peterson Plaza and Walden all carry 2,500–4,700 characters of text per page and
   not one of them is a value. The page reads as maximally readable and yields
   nothing. This is the shape that makes "is there text on it?" the wrong question.
3. **Near-empty text layers** — New Horizons (58/149/58 chars), Circle Park
   (8/56/0), Oak Center and Morh (0/20/0): a handful of stray characters, which is
   worse than none because it clears any run-count threshold set too low.

---

## 2. Where OCR must be invoked, and what it costs

`app.js:parseRsPdf` is the whole ladder, and the OCR calls hang off three points:

| # | Call site | Trigger | Pages sent |
|---|---|---|---:|
| 1 | `parseRsPdf` → `ocrParseRs` | fewer than 15 text runs in the whole document | up to `OCR_MAXPAGES` = 4, stopping as soon as both halves are found |
| 2 | `parseRsPdf` → `ocrParseRs` | text present but tier 2 produced no record (the flattened e-signed case) | same |
| 3 | `rsReadTextTier` → `ocrHalf(bytes,0,…)` | tier 2 read the page but found no ticked box on it | 1 page |
| 4 | `rsReadTextTier` → `ocrHalf(bytes,1,…)` | tier 2 found Part G but read nothing off it | 1 page (the others are skipped) |

Cost, from `supabase/functions/ocr-rs/SETUP.md`: Azure Document Intelligence,
`prebuilt-layout`, **free F0 tier — 500 pages a month, permanently free**, one
page per request (F0 silently reads only the first two pages of a multi-page
file, which is why the client splits). S0, if it is ever picked by mistake, is
**~$1.50 per 1,000 pages**.

So the portfolio's real bill: 18 class-C properties × 2–4 pages ≈ **36–72 pages a
year**, plus the tick-and-fill top-ups on the class-B copies. Under F0's 500/month
that is free with two orders of magnitude of headroom, and under S0 it would be
about **eleven cents a year**. **OCR is not expensive here. Reading the wrong
document is.** The page budget in `parseRsPdf` is worth keeping for latency — OCR
takes seconds per page and the user is watching — but it should never be the
reason a document goes unread.

---

## 3. Verify the read against the rendered page, do not trust it

Every tier the app has reads a *description* of the page — field dictionaries,
content-stream operators, or Azure's word polygons. None of them looks at what the
page shows. That gap has produced the worst defects on this project: Oaks on North
Plaza came back with a monthly potential of $1,642,642 where the page prints
$91,922, and it came back looking exactly like a clean read.

`rsTplPremiseHolds` is the current answer and it is a good one — it refuses a page
whose printing does not sit where our template puts it — but it is still one
description checked against another. The verification we actually want is:

**render the page, and check that the values we claim to have read appear on it,
where we say they are.**

A sibling agent is building `look.js` / `rdiff.js` (PDF → image) on branch
`vis-look`. Assuming it exists, this is what the reading path wants from it:

| Want | Why |
|---|---|
| `render(bytes, pageIndex, {dpi}) -> {width, height, pixels}` | the raster of one page, at a DPI we choose per job (150 for a read-back check, 300 for OCR input) |
| `crop(raster, rect)` in **PDF points**, not pixels | every rectangle we hold — `rsFieldRects()`, the OCR fit — is in template points. A cropper that speaks pixels moves that conversion into every caller. |
| `ink(raster, rect) -> fraction` | "is this box empty?" answered from the picture. It is the single cheapest check we do not have: a field we read as blank over a box with ink in it is a **miss**, and a field we read as `$1,190` over a box with no ink in it is an **invention**. Both are silent today. |
| `diff(rasterA, rasterB) -> {changedRects, score}` | draft vs executed, and our generated schedule vs the filed one, compared as pictures. `rdiff` is what turns "the executed copy may differ from the draft" from an assumption into a measurement. |
| deterministic output (fixed rasteriser, fixed DPI, no antialiasing drift) | a fixture that changes because the renderer was upgraded is a fixture nobody trusts |
| pure Node, no network | the corpus loop and every suite run offline |

### The read-back check, in order

1. Parse as today (tier 1 / 2 / 3), producing `{fieldId: value}`.
2. Render the page the values were taken from.
3. For each field the record claims a value for, `ink()` its rectangle. **No ink
   under a claimed value ⇒ the value is invented.** Refuse the document and say
   which fields.
4. For each Part A rent rectangle the record left empty, `ink()` it. **Ink under a
   blank ⇒ we missed a row.** This is the one that catches the Peterson Plaza
   class of fault — a row silently skipped — which no totals gate catches when
   the total is missing too.
5. Only then apply the totals gate (`rsRecordHolds`).

Steps 3 and 4 are cheap: one raster per page, a few hundred rectangle sums. They
should run on **every** tier, including tier 1 — tier 1 is where the field
dictionary and the printed page are most free to disagree, because a flattened
copy can carry an AcroForm that no longer describes what is drawn.

### What renders the OCR input, too

Tier 3 currently posts the original PDF page to Azure. Once `look.js` exists it
should post a **rendered raster** instead, at a DPI we control. Two reasons: a
vector page that Azure rasterises at its own resolution is a variable we do not
hold, and a tiled 88-image page (Northgate Terrace) is exactly the kind of input
that rasterises cleanly and parses badly.

---

## 4. When OCR itself is low-confidence

Azure returns a per-word confidence; `ocr.js` currently discards it. Every one of
tier 3's refusals today is *geometric* — too few anchors, a bad fit, a skew, a
residual — and none of them is about whether the characters were read right. The
ladder should be:

| Signal | Rule |
|---|---|
| registration fails (`ocrRegister` returns null) | refuse, as today. `OCR_WHY` already says which of the five ways it failed. |
| registration holds, **any digit** in a rent or unit-count box below ~0.90 confidence | do **not** refuse the document. Accept the record, mark those cells, and paint them as needing confirmation — the same treatment an overridden cell gets. A digit is worth a thousand dollars a month; a low-confidence project name is worth nothing. |
| the totals gate fails | refuse, as today, and say the numbers did not reconcile. This already distinguishes "the scan failed" from "the scan read the page and the numbers did not add up", which is the only one worth retrying. |
| `ink()` says a claimed value sits over an empty box | refuse. A recognised character over blank paper is a hallucination and there is no confidence score that makes it safe. |
| OCR unavailable (no session, no engine) | refuse **with a reason** — fixed on this branch; see §5. |

The principle: **confidence should change the colour of a cell, not the fate of a
document.** Refusal is for the cases where we cannot say *where* on the page a
value came from. Uncertainty about *what* a value says is something a reviewer can
resolve in two seconds if the app points at it — and cannot resolve at all if the
app hides it behind a green tick.

---

## 5. What was fixed on this branch (2026-07-30)

**The reader had a floor, and only two of its three tiers stood on it.**

`rsAssembleFields` refuses a record with no Section 8 rent rows, and refuses rows
that do not reconcile against the schedule's own printed total. Tiers 2 and 3 must
pass it. **Tier 1 — the AcroForm reader — had no floor at all.** Any PDF with more
than ten form fields returned whatever those fields held, and `parseRsPdf` reported
`{kind:'fields', parsed:…}`, which is exactly what the upload handler arms
"Fill form from RS" and the Enter key on. An empty record read as a successful read.

Two real documents walk through it:

- **our own blank HUD-92458** (`templates.js`), 232 fields and not a value in one
  of them — what a PM sends when they mean to attach the schedule and attach the
  form instead;
- **Mapleview Towers, `HUD Rent Schedule - Mapleview Towers eff. 04.01.26.pdf`** —
  a filed document, 232 fields, 39 of them carrying a value, and **every one of
  those 39 is the string `"0"`**, the printed monthly total included. Tier 1
  returned `{scalars:{}, units:[], ns8:[]}` and the form said the schedule had been
  read. Across all 103 rent schedules in the corpus it is the only filed copy that
  does this — and one is enough, because what it puts into a federal filing is
  nothing at all, with a tick beside it.

Changed:

- `app.js` — the gate is lifted out as `rsRecordHolds(outp, totalRaw)` and asked
  of **all three tiers**. Tier 1 that fails it no longer returns a record; it
  carries a reason and falls through to the printed page and then to OCR, because
  a copy flattened at signing often keeps the AcroForm skeleton while the values
  move into the page.
- `app.js` — `rsWhy()` composes the reasons, so a copy that is useless in two ways
  says both, in order.
- `ocr.js` — `ocrParseRs` returned `null` with `OCR_WHY` still empty whenever there
  was no session. Both early exits now say which one they are.
- `app.js` — the "could not be read" tile no longer falls back to the sentence
  "Enter the values below." with no reason attached to it.
- `test_rcs.js` — 24 checks, built from our own template so no portfolio bytes are
  copied anywhere. `MIN_CHECKS` 420 → 444.

**Not changed:** which document the app asks for, what any document prints, the
OCR pipeline itself, and the reading of all 34 current executed schedules — the
census was re-run after the fix and no property's class or unit count moved.

---

## 6. Open, in the order it matters

1. **`look.js` lands** → wire steps 3 and 4 of §3 into `parseRsPdf`. This is the
   one change that would have caught Oaks on North Plaza *before* the premise test
   was invented, and it catches the next one too.
2. **Confidence out of Azure** — `ocr-rs` should return per-word confidence and
   `ocrMap` should carry the minimum over each box onto the cell.
3. **Correct the stale figures** — `corpus/drive.js:23` ("7 of 34") and the
   `executed-rs-are-outlines` memory note ("only 7 of 34 are text-readable").
4. **Ask what the CA returns.** Three of the class-C copies (Clinton Manor, Ebony
   Gardens, Holly House) are pure scans of a document the CA countersigned and
   posted back. If the CA can be asked for a digital copy, a third of the OCR
   problem is a conversation rather than a pipeline.
