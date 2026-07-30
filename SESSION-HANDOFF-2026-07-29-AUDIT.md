# RCS corpus audit — resume here

**Branch:** `worktree-rcs-corpus`. Never push or merge to `main` (a push to main is a
production deploy).

---

> **WAVE 6 DONE 2026-07-30 — 26 of 34 audited, 17 defects fixed.** All five wave-5
> properties are audited (Market Square, Barnum House, Shiloh Village, Morningside Court,
> 333 Holly) and three defects shipped: `43258e0` tier 2 now checks that a page prints the
> form where the form prints it; `c23b161` the workbook and the rent schedule share one
> unit-type label; `da46f05` a column gap drawn as a pen move is a column gap, which took
> **Shiloh Village and 333 Holly from ZERO unit types to a complete, correct unit mix.**
> Verified end to end: Shiloh's workbook now carries 1,830/2,235/2,535, allowances
> 102/124/133 and SAFMR bases 1,590/2,000/2,550 — every figure matching the eye-read
> source — where before it had none and printed a false "NO" on the 150% test.
>
> **I owe a correction on my own commit message.** `43258e0` claims it stops the
> contaminated property names. It does not. Re-driving Shiloh showed the name is still
> wrong and now differently wrong — `Shiloh Village Apts. Part A Apartment Rents Show the
> actual` — because declining tier 2 sends the page to tier 3, which swallows the same
> heading. The real cause is **M41**: our own template's Project Name box is 23pt tall and
> reaches 1.95pt below the next printed row. That is the top repair for wave 7 and the
> register has both candidate fixes.
>
> **Two queue items were misdiagnosed and are now resolved as understanding, not code.**
> The "7.1 points" is a third printing of HUD-92458 whose Part B rows sit on a 14.4pt pitch
> against our 10.85pt — Market Square and Mapleview measure identical to five decimals, so
> the residual measures *the blank*, not the document, and tier 3's refusal is **correct**.
> Loosening that threshold would have been actively harmful. The real fix is a
> label-relative reader, which is new work rather than a tuning.
>
> Eight properties remain unaudited: The Pines (75705), Colonial Village (75708),
> Friendship Court (75831), Newberry Arms (75832), Northgate Terrace CA (75919),
> Fairview Homes (75920), Walden (75921), Marine Terrace (75922).
>
> Scratch properties are cleaned (**0** `ZZ-CORPUS-*`). Snapshot of the pre-fix output is at
> `_archive/corpus-cache/_snap-w5/`. Everything is committed and pushed.
>
> ⚠️ **Two things for Matt.** (1) The account is now down to **2 properties**; it held 14 on
> 2026-07-29, then 4, now 2. My cleanup provably cannot do this — it returns before deleting
> when no name matches the prefix, and it reports exactly what it removes. If this is not you
> tidying up, it is data loss and it should jump the whole queue. (2) `git` could not
> auto-detect an identity this session because the machine's hostname changed to `Mac.(none)`;
> rather than write to your config I passed the same name and address your earlier commits
> already used. Setting `user.name`/`user.email` in the repo would make that unnecessary.

> **WAVE 4 AUDITS NEED RE-RUNNING.** On 2026-07-29 four of the five wave-4 audit
> agents — Noble Tower, Oaks on North Plaza, Oceanport, Holly House — died on
> `API Error: 529 Overloaded`, a server-side fault, before returning anything.
> Mapleview Towers may or may not have completed. The 13-property sweep labelled
> `wave-4` is unaffected (it is local node + chromium, not the API) and its output
> stands, with the pre-fix snapshot preserved at `_archive/corpus-cache/_snap-w3/`.
> Nothing was lost and nothing was half-recorded: no wave-4 property is marked
> audited. Re-launch those five when the API is healthy.

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
- **THE PROPERTY COUNT IS NOT A SAFETY CHECK, AND NEVER WAS.** On 2026-07-29 the account
  went from 14 properties to 4 within minutes, while the corpus cleanup was reporting
  `0 whose name starts with "ZZ-CORPUS-"` — and `cleanup()` returns before deleting
  anything when nothing matches the prefix (drive.js:1200), so the runs could not have
  caused it. Two properties were created at 22:38 that had not existed before
  (`Trees - Maple`, a fresh `Manhattan Plaza`), which is the signature of someone working
  in the app, not of a sweep. **The only valid check is "0 properties named `ZZ-CORPUS-*`".**
  Never assert a total, never delete anything that lacks the prefix, and never treat a
  changed count as evidence about the audit.
- **The live-account baseline is no longer 12.** After wave 1 the account holds **14**,
  with **0** `ZZ-CORPUS-*` — my scratch properties were all deleted and verified gone.
  Nine properties were created on 2026-07-29 that are NOT mine and NOT prefixed:
  `Luther Towers`, `Clarendon Court`, `Gates Mills Villa`, `Garden House of River Oaks II`,
  `Ebony Gardens`, `Round Barn Manor`, `Park Place`, `Fairview Housing`, `Winter Garden`.
  **All nine have 0 cycles and 0 unit types** — empty shells. `Gates Manor` also appears
  twice. They look like the HAP-tracker home page or hand clicking, not the driver, which
  names everything `ZZ-CORPUS-*`. **Do not delete them** — they are real records in Matt's
  account and removing them is irreversible. The cleanup check is therefore
  "0 `ZZ-CORPUS-*`", not "exactly 12 properties".
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
| 1 | 2640001 | Northcross | **audited** | 2 |
| 2 | 4640009 | Westwood Village | **audited** | 2 |
| 3 | 4640013 | Riverwood | **audited** | 2 |
| 4 | 75109 | Burt Farms I | **audited** | 2 |
| 5 | 75453 | Sycamore Green | **audited** | 2 |
| 6 | 75474 | New Horizons | **audited** | 3 |
| 7 | 75478 | North Park | **audited** | 3 |
| 8 | 75488 | Woodbury Oakwood (Lakeside) | **audited** | 3 |
| 9 | 75495 | Hampshire House | **audited** | 3 |
| 10 | 75500 | Lansing Manor | **audited** | 3 |
| 11 | 75543 | Noble Tower | **audited** | 4 |
| 12 | 75544 | Oaks on North Plaza | **audited** | 4 |
| 13 | 75563 | Oceanport | **audited** | 4 |
| 14 | 75564 | Holly House | **audited** | 4 |
| 15 | 75566 | Ebony Gardens | **audited** | 1 |
| 16 | 75567 | Mapleview Towers | **audited** | 4 |
| 17 | 75568 | Market Square | **audited** | 7 |
| 18 | 75569 | Barnum House | **audited** | 9 |
| 19 | 75572 | Shiloh Village | **audited** | 11 |
| 20 | 75573 | Morningside Court | **audited** | 12 |
| 21 | 75704 | 333 Holly | **audited** | 8 |
| 22 | 75705 | The Pines | unaudited | |
| 23 | 75708 | Colonial Village | unaudited | |
| 24 | 75830 | Clinton Manor | **audited** | 1 |
| 25 | 75831 | Friendship Court | unaudited | |
| 26 | 75832 | Newberry Arms | unaudited | |
| 27 | 75833 | Circle Park | **audited** | 1 |
| 28 | 75917 | Peterson Plaza | **audited** | 0 |
| 29 | 75919 | Northgate Terrace CA | unaudited | |
| 30 | 75920 | Fairview Homes | unaudited | |
| 31 | 75921 | Walden | unaudited | |
| 32 | 75922 | Marine Terrace | unaudited | |
| 33 | 75926 | Oak Center | **audited** | 1 |
| 34 | 75927 | Morh Housing | **audited** | 1 |

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

### THE REPAIR QUEUE — after wave 2

Evidence is in `docs/superpowers/plans/DIAGNOSTIC-REGISTER.md`, "Wave 1" and "Wave 2".
Do not re-derive it.

**FIXED so far:** Part H's inserted article; the checklist's run-date; the non-revenue
row printing its use instead of its type (`3ecdfd2`); the SAFMR table creating phantom
unit types (`upsert` no longer shared — `applySafmrBase` in rcs.js).

**Next, in order. Each meets the two-property rule.**

| # | mechanism | properties | note |
|--:|---|---|---|
| 1 | **`defUaSrc` prefers the prior schedule; it should prefer the study.** On Sycamore Green, Burt Farms I and Northcross the study's own table IS the filed figure and we printed last year's. Where a third document governs, the study is still nearer than last year's. | 3 outright, 8 improved | app.js:235, app.js:1865 |
| 2 | **`nonrev.<i>.rent` holds the wrong number** — Ebony 3,700 where truth is 0, Morh 4,763 where truth is 5,100. Until this is right the non-revenue row cannot print its rent, and Oak Center stays 1,728 short. | 3 | the roster/apply seam |
| 3 | **A non-revenue unit occupies a `units.*` row AND a `nonrev.*` row** — double-counted totals and phantom rows. | Morh, Oak Center | same seam as #2 |
| 4 | **The workbook divides a rounded 150% ceiling by 1.5 and prints the remainder** (`6620/1.5 = 4413.333…`). Separately, `defSafmrSrc` prefers the HUD pull over the study; the team used the study every time. | 6 | `hudCeil` gen-side; app.js:234 |
| 5 | **The workbook ships cached formula values of 0 and a `NO` verdict** on packages that pass. | 8 | xlsx.js |
| 6 | Part F left blank | 7 | gen.js |
| 7 | Part I HAP contract number left blank | 6 | gen.js |
| 8 | Checklist `Scope of Work` unticked though every study carries it (as "Scope of Assignment") | 5 | the checklist mapping |
| 9 | Workbook labels drop the designation, so two rows read identically (`2BR/1BA` twice) | 4 | xlsx.js |
| 10 | Section header rows (`Section 8`, `Non-Revenue`) dropped from Column 1 | 4 | gen.js |
| 11 | Generated PDFs are not flattened — `Clear All` / `Print` render on page 2 | 4 | gen.js |
| 12 | Fill order changes the bottom line. **Sycamore Green states it most clearly: `rcs-first` already produces the filed answer (271,300) and `rs-first` does not (272,750).** | 4 | `scratchpad/PARKED-roster-fix.patch` |

**Bigger, and worth doing before more auditing:**

| # | mechanism | properties | why it matters |
|--:|---|---|---|
| 13 | **Tier 2 rejects schedules that have a clean text layer.** Westwood: "labels out by about 7.1 points" on a PDF `pdftotext -layout` reads perfectly. Riverwood: no AcroForm, eight embedded fonts, no image on page 1, every value extractable — and the app went to Azure, got a **429**, and produced **zero documents**. Burt Farms: same, six OCR calls. | 3 | it is why Azure is being paid for at all, and on Riverwood the rate limit cost the entire package |
| 14 | **A priced study row produces no rent** — Circle Park's `3 BR / 1.5 BA TH`, 58 units, $271,150/month | 1 | biggest single-property money in the corpus |
| 15 | **The study reader cannot read Gill Group.** Riverwood's letter is on pages 3–4 behind an image-only cover, and its unit types are `1/1`, `2/1`, `3/1.5` | 1 | |
| 16 | **The OCR anchor pass rejects a legible page at 7 of 8** — Clinton Manor | 1 | `OCR_MINPAIRS`, ocr.js:26 |

### DECISIONS FOR MATT — these are not repairs

1. **Where does the Col. 5 utility allowance come from?** On all five properties the filed
   allowance comes from a **third document** in the same cycle folder — a CA exhibit, a UA
   workbook, a UAF notice, a PG&E utility study — that the app is never given. The app
   holds the schedule's and the study's figures side by side and flags the disagreement,
   which is the right behaviour for the inputs it has. It cannot reach the filed number.
2. **SAFMR: HUD's live pull or the study's own table?** `defSafmrSrc` (app.js:234) prefers
   HUD. On all four properties the team used the study's, and the filed 150% test is
   computed from it. Clinton's margin is **$12** — at that width the source decides whether
   a package passes.
3. **Three of six documents never generate** (CA letter, owner letter, tenant notice),
   because a fresh scratch property has no `ca.name` / `ca.org` / `poc.name`. Probably a
   fixture gap, but it means documents 01, 02 and 06 go unverified on every property.

### Two register claims are DISPROVED — do not re-fix them

- **`OakCenter1` is not real.** Every string the app emits reads `Oak Center 1`, correctly
  spaced, and it never appends the contract number. Morh likewise resolves `Morh I Housing`
  correctly. The name rows were the extractor's own lost spacing.
- **Utility allowances are not "the study's values"** — see decision 1.

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
