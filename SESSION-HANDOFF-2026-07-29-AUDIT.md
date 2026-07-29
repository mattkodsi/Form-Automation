# RCS corpus audit — resume here

**Branch:** `worktree-rcs-corpus`. Never push or merge to `main` (a push to main is a
production deploy).

---

## The job, in one paragraph

Use the app to build real RCS packages for ~34 properties, check each one against what
the PM team actually filed, and when the app's output is wrong, trace it to the
mechanism and repair it. The deliverable is a correct app, not a report.

Matt's words: *"your entire job is to use the form to try and create accurate final RCS
packages. if the app's producing incorrect output, then you diagnose that issue."*

---

## The audit method — THREE-WAY, agreed 2026-07-29

For each property, read the **source documents first** and write down what the package
*should* contain, before looking at either output. Then compare three things:

| | |
|---|---|
| **truth** | derived by reading the RCS study + prior executed rent schedule myself |
| **ours** | what the app generated |
| **theirs** | what the PM team filed |

Verdict per field: `app wrong` · `team wrong` · `both wrong` · `both right (cosmetic)`.

This replaced an earlier two-way method that only consulted the source **where the two
outputs disagreed** — which was blind to the case where the app and the team are wrong
in the same way. Matt caught that and asked for the fix. Do not regress to two-way.

**"Read by eye" means read by eye.** Open the PDF page as an image with the Read tool
(`pages:` parameter) and read the numbers off it. Do NOT substitute a text parser —
the parser is the thing under test, and it has already produced confident nonsense
(`DearMr.Delancy,` graded as a unit type). `poppler` is installed, so Read renders
PDF pages.

---

## The wave workflow

Repeat until the corpus is clean:

1. **Audit wave** — 5 subagents, ~5 properties each, running in parallel. Observation
   only: no code edits, no fixes. Each returns ledger rows with exact values and where
   it read them.
2. **Repair break** — I fix, alone and serialized. Never in parallel: one mechanism
   usually spans many properties, and two agents editing `app.js` would collide.
3. **Re-run** — regenerate everything audited so far, diff against the previous
   generation, and eye-read only what CHANGED. Anything that moved and shouldn't have
   is a regression and blocks the fix.
4. **Next wave** — new properties, plus a re-check of properties whose findings the
   repairs should have moved.

Fix cadence is **A: fix per batch** (Matt's call), not audit-everything-then-fix.

### Fixing rules

- **Fix by MECHANISM, not by property.** One parse bug spanned 7 properties.
- **Never fix from a single property.** Either 2+ properties show it, or a code reading
  shows it is general.
- **Measure blast radius before fixing** and again after. The 15→1 measurement is the
  model for this.
- Every fix gets a regression test named for the properties that exhibit it, and
  `MIN_CHECKS` goes up. Never lower `MIN_CHECKS` to make a red run green.

### Three tiers of verification — cheapest first

| tier | cost | use |
|---|---|---|
| 1. parser scan in node | seconds, no browser, **no Azure** | the inner loop; most parse bugs fully verified here |
| 2. one property driven | ~90s, ~3 Azure calls | confirms the fix reaches the generated PDF |
| 3. full 34-property sweep | ~20 min, ~100 Azure calls | ONCE per batch, never per fix |

Tier 1 scanner: `scratchpad/scan.js` pattern — loads `app/full-mp/*.js` in node with
`supaClient=null` and runs the real reader over every study in the manifest.

---

## Standing constraints — these have all bitten

- **Runs write to Matt's LIVE account** (`mfkodsi@gmail.com`, his explicit choice).
  Every scratch property is named `ZZ-CORPUS-*` and **must be deleted after each batch**:
  `node app/full-mp/corpus/drive.js --cleanup --prefix ZZ-CORPUS-`
  Baseline: **12 real properties.** After cleanup that count must still be 12.
- **Never open with `Read`:** `index.html` (~411k tok), `app/full-mp/templates.js`,
  `app/full-mp/lib/pdf-lib.min.js`. Use `grep -n` / `sed -n` / `head -c`.
- **Never host-edit source files.** Write to `/tmp` (the scratchpad), `cp` in, then
  verify with `cmp` + `node --check` + `tr -cd '\000' | wc -c`. Host edits have
  truncated files and appended NUL bytes.
- **Never pipe a test suite through `| tail`** — the pipeline's exit status is tail's.
  This was demonstrated live today: a failing suite showed `EXIT=0`.
- **Edit source, then rebuild.** `bash app/full-mp/deliver.sh` runs every suite, builds,
  and verifies the copy. Never hand-edit `index.html`.
- **RA-port anchor gate** after any `app.js` / `shell.head.html` edit:
  `python3 app/full-mp/build-ra.py /tmp/rcs-ra-check.html` must print `built …`.
- **Verify a push with `git log`**, never from an assumed `&&` chain. A commit silently
  failed once and was reported as pushed.
- Session file: `_archive/corpus-cache/.session.json` (gitignored, mode 600, auto-refreshes).
  If it dies, **Matt** runs `node app/full-mp/corpus/signin.js` — never ask for the password.

---

## Progress — which properties have been audited

`audited` means the three-way comparison was done and its rows are in the ledger.
`sources read` means the truth column exists but nothing has been compared to it yet.
A wave marks a property `audited` only when its agent returned rows.

| # | code | property | status | wave |
|--:|---|---|---|--:|
| 1 | 2640001 | Northcross | unaudited | |
| 2 | 4640009 | Westwood Village | unaudited | |
| 3 | 4640013 | Riverwood | unaudited | |
| 4 | 75109 | Burt Farms I | unaudited | |
| 5 | 75453 | Sycamore Green | unaudited | |
| 6 | 75474 | New Horizons | unaudited | |
| 7 | 75478 | North Park | unaudited | |
| 8 | 75488 | Woodbury Oakwood (Lakeside) | unaudited | |
| 9 | 75495 | Hampshire House | unaudited | |
| 10 | 75500 | Lansing Manor | unaudited | |
| 11 | 75543 | Noble Tower | unaudited | |
| 12 | 75544 | Oaks on North Plaza | unaudited | |
| 13 | 75563 | Oceanport | unaudited | |
| 14 | 75564 | Holly House | unaudited | |
| 15 | 75566 | Ebony Gardens | sources read | 1 |
| 16 | 75567 | Mapleview Towers | unaudited | |
| 17 | 75568 | Market Square | unaudited | |
| 18 | 75569 | Barnum House | unaudited | |
| 19 | 75572 | Shiloh Village | unaudited | |
| 20 | 75573 | Morningside Court | unaudited | |
| 21 | 75704 | 333 Holly | unaudited | |
| 22 | 75705 | The Pines | unaudited | |
| 23 | 75708 | Colonial Village | unaudited | |
| 24 | 75830 | Clinton Manor | unaudited | 1 |
| 25 | 75831 | Friendship Court | unaudited | |
| 26 | 75832 | Newberry Arms | unaudited | |
| 27 | 75833 | Circle Park | unaudited | 1 |
| 28 | 75917 | Peterson Plaza | **audited** | 0 |
| 29 | 75919 | Northgate Terrace CA | unaudited | |
| 30 | 75920 | Fairview Homes | unaudited | |
| 31 | 75921 | Walden | unaudited | |
| 32 | 75922 | Marine Terrace | unaudited | |
| 33 | 75926 | Oak Center | unaudited | 1 |
| 34 | 75927 | Morh Housing | unaudited | 1 |

**Wave 0** (before the loop): Peterson Plaza, traced end to end — commit `bbe9868`.

---

## Where things stand

### Fixed and verified today

| commit | what |
|---|---|
| `d46e42e` | A reopened package could not be downloaded and silently dropped document 04 |
| `e2c0080` | Under `--jobs 2` every property was driven twice — doubled Azure spend and made fill-order findings artifacts |
| `d9b6d51` | **15 unit-type spellings the reader did not understand** (see below) |
| `0e35325` | The diagnostic register |
| `bbe9868` | Peterson Plaza traced end to end |

**The unit-type fix is the important one.** A study line whose bedroom count does not
parse is invisible to `rcsMatch` (which selects candidates BY bedroom count), so the
row silently takes **a different unit type's rent** rather than none. 15 of 98 priced
lines across 7 studies. Now 1.

Verified against the filed package: Peterson Plaza's 100-unit row went 2,025 → **2,050**
(filed: 2,050), monthly potential 429,200 → **431,700** (filed: 431,750).

### Open defects, in priority order

1. **`Senior` wrapped-designation line** — the studies print the unit type over two
   lines (spec, then designation). Peterson's 1-unit row captures `Senior` as its type,
   so it takes 2,650 instead of 2,700. Last $50 of Peterson's gap. The row reader, not
   `parseType`.
2. **Utility allowances come from the wrong document.** Ours are exactly the study's
   `ua` values (Peterson: 86/83/111/131). The filed package uses the property's own
   allowance workbook (60/71/71/125 — see `2025 - RCS/Utility Baseline/Peterson Plaza
   Baseline UA Workbook 4.14.xlsx`). Col 5 of HUD-92458 is the allowance in effect, not
   the appraiser's estimate. 17 rows, 7 properties.
3. **Fill order changes the package** — 83 rows, 8 properties. Peterson's total contract
   rent is 429,200 schedule-first and 285,250 study-first. **Diagnosed, fix WRITTEN AND
   PARKED at `scratchpad/PARKED-roster-fix.patch`** — Matt asked me not to apply it
   mid-diagnosis. Cause: on an empty form every study line is homeless so the STUDY
   builds the roster; `rsFillFromParsed` then writes `units.<i>` positionally over it.
   The fix re-reads an already-applied study after the schedule lays down the roster.
   Note the vocabulary fix may have shrunk this class — **re-measure before applying.**
4. **SAFMR averaged across ZIPs** and printed unrounded — `869.3333333333334` vs filed
   `720`. Drives the 150% gate, so it matters more than its count. 29 rows, 10 properties.
5. **Part F blank** where the filed schedule prints a Maximum Allowable Monthly Rent
   Potential (Peterson: 335,132).
6. **Unit type vocabulary/designation** — we print `2BR/1.5BA`, filed prints `2BR-Flat` /
   `2BR-TH` / `2BRLG` / `3 BR - small`. **The designation IS in the sources** — the study
   says `Senior` / `Multi-Family`, and Ebony's prior schedule says `3 BR - small` /
   `3 BR - large`. So this is "stop discarding what the documents say", not "invent a
   data model". Still Matt's call on the field's name and UI.
7. **Four properties produced nothing comparable** — New Horizons, Noble Tower,
   Oceanport, Riverwood. Two of them (Noble Tower, New Horizons) had EVERY study line
   fail the vocabulary bug, so the fix may have revived them. **Re-check first.**
8. **Property name** — we emit `FairviewHomes(NJ390013022)`, `OakCenter1`,
   `MorningsideCourtApartments` where filed says `FairviewHomes`, `OakCenter`,
   `MorningsideCourt`.

### Harness problems that corrupt the evidence — do not trust these rows

- `corpus/extract.js` **graded the wrong page** on Fairview Homes and Hampshire House,
  returning cover-letter lines (`410TenthAve,8`, `DearMr.Delancy,`) as unit types.
- It does **not decode the ASCII−29 checklist font** on Hampshire House and Woodbury
  Oakwood, returning control characters.
- It **cannot read most FILED rent schedules** (they are flattened vector outlines).
  Only 5 of 34 properties produced any rentSchedule matches; only 2 meaningfully.

**This is why the method is now "read it myself".** Matt's direction: *"dont focus all
this manpower on building out this rig."* Do NOT invest in repairing `extract.js` as
ground truth. Use it only as a cross-check on the app's OWN output, where it is fine.

---

## Batch 1 — already begun

Properties: **Ebony Gardens, Circle Park, Morh Housing, Oak Center, Clinton Manor.**
Chosen because between them they cover every open class.

### Ebony Gardens source truth (already read, 2026-07-29)

Prior executed rent schedule, `2024/Executed Rent Schedule.pdf`, eff. 12/08/2024:

| unit type | units | rent | ext | UA | gross |
|---|---:|---:|---:|---:|---:|
| 1 BR | 36 | 2,083 | 74,988 | 65 | 2,148 |
| 2 BR | 83 | 2,320 | 192,560 | 88 | 2,408 |
| **3 BR - small** | 21 | 2,774 | 58,254 | 98 | 2,872 |
| **3 BR - large** | 3 | 2,898 | 8,694 | 107 | 3,005 |
| *Non-Revenue* 2 BR | 1 | 0 | 0 | 0 | 0 |
| **total** | **144** | | **334,496** | | |

Yearly 4,013,952. Part F = 334,496. Part D: Superintendent, 2 BR, $0.

Note `3 BR - small` / `3 BR - large` — the designation problem again, and a
**non-revenue row**, which is the other fill-order class.

Study: `2025 - RCS/Archive/Revised RCS - 25-053 - Ebony Gardens ….pdf`
Filed schedule: `2025 - RCS/Rent Schedule_Ebony Gardens - Signed.pdf` (and a
`FULLY EXECUTED` copy).

---

## The ledger

Append findings to `docs/superpowers/plans/AUDIT-LEDGER.md`, one row per finding:

```
property · document · field · truth · ours · theirs · verdict · mechanism · status
```

`mechanism` stays `undiagnosed` until the number has been traced generated doc → form
cell → parsed value → raw source text. **No fix is written against an undiagnosed row.**

Recording `team wrong` matters — it is information Matt wants, and it stops the app
being "fixed" toward somebody's typo.

---

## Agent brief template (audit wave)

> Audit ONE property end to end. Observation only — do not edit any code, do not fix
> anything, do not run `deliver.sh`.
>
> 1. Read the source documents FIRST and write down what the package should contain:
>    the RCS study's concluded-rent table and the prior executed rent schedule. Read
>    them as IMAGES via the Read tool's `pages:` parameter. Do not use a text parser —
>    the parser is under test.
> 2. Read what the app generated: `_archive/corpus-cache/_out/<code>/rs-first/` and
>    `/rcs-first/`. Same rule — read the pages.
> 3. Read what the PM team filed, in the property's `<year> - RCS/` folder.
> 4. Return ledger rows: property · document · field · truth · ours · theirs · verdict ·
>    where you read each value (file + page). Verdict is one of `app wrong`,
>    `team wrong`, `both wrong`, `both right (cosmetic)`.
> 5. Report EXACT values. If you cannot read something, say so — never infer a number.
>
> Do not propose fixes. The mechanism trace and the repair are done by the coordinator.

---

## Useful commands

```bash
# drive one property (creates a ZZ-CORPUS-* property; ~3 Azure calls)
CORPUS=$(node -e 'console.log(require("./app/full-mp/corpus/corpus.json").root)')
node app/full-mp/corpus/drive.js "$CORPUS" _archive/corpus-cache app/full-mp/corpus/corpus.json "Ebony Gardens"

# full sweep, once per batch
node app/full-mp/corpus/sweep.js "$CORPUS" _archive/corpus-cache app/full-mp/corpus/corpus.json --jobs 3 --label sweep-8

# clean up after every batch — MUST end at 12 properties
node app/full-mp/corpus/drive.js --cleanup --prefix ZZ-CORPUS-

# everything + rebuild
bash app/full-mp/deliver.sh
```

`sweep.js` keys its resume cache on the app commit, so a record built by an older build
is re-driven rather than reused. `--stale-ok` opts back in; don't.

**1553 checks across eleven suites** as of `d9b6d51`.
