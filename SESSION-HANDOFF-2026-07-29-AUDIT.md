# RCS corpus audit — resume here

**Branch:** `worktree-rcs-corpus`. Never push or merge to `main` (a push to main is a
production deploy).

---

> # RESUME HERE — 2026-07-30, wave 3. M62 done, and THREE OF MATT'S FOUR FINDINGS.
>
> ## MATT REPORTED FOUR THINGS FROM TESTING COLONIAL VILLAGE — status of each
>
> 1. **aka name in the RS Project Name** — ALREADY FIXED on this branch (`03a5452`), and absent
>    from `main`, which is what he runs. `git show main:app/full-mp/gen.js | grep -c "_pn+'/'+_pa"`
>    is 0; here it is 1. **Nothing to do but merge this branch.**
> 2. **Part A columns 3 and 5 of a non-revenue row must state a zero** — FIXED (M63). It also
>    settles the three-property argument the old non-revenue comment was stuck in.
> 3. **Part D column 3 must be the PROPOSED rent, not the current** — FIXED (M63). Colonial
>    Village's leasing office printed 1,147 where the filing says 1,850.
> 4. **The second Part G principal did not copy** — **OPEN, and it is the next thing to do.**
>    `Colonial Village Preservation GP, LLC` / `General Partner` copied; `David Pearson, Vice
>    President of the General Partner` did not. The failing row looks like it carries its TITLE
>    INSIDE THE NAME, comma-separated, where the row that worked has them in two fields. Parse
>    Colonial Village's own executed schedule (code 75708) and print `parsed.principals` — that
>    single measurement says whether the reader found one principal or found two and dropped a
>    field. Do NOT guess between those; they need different fixes.
>
> ## TWO AGENTS ARE RUNNING, both on Matt's explicit instruction
>
> - **Property-name provenance** (Cherry Garden: `"Oak Park Apartments (t/b/k/a Cherry Garden
>   Apartments)"`). Read-and-document only; it writes
>   `docs/superpowers/plans/2026-07-30-property-name-provenance.md` and changes no source. It
>   carries a real DECISION FOR MATT about whether the HAP tracker, the executed RS, or the PM's
>   own edit is definitive for Property Name, and what that means for Kinley's database.
> - **Tab / shift-tab order and dropdown focus visibility**, in its own isolated worktree, on its
>   own branch, NOT merged. Column-major within a section, then the next section; and a focus
>   indicator whose measured geometry matches the trigger's.
>
> ## M62 — provenance is painted twice and two cells were painted differently (phase 3d)
>
> All 60 boxes of a four-row package enumerated: **2 moved by a whole colour** when repainted —
> `units.0.ua_source` orange→grey, `units.0.safmr_source` teal→grey. `paintCell` asked
> `srcCellState` for a `*_source` key, got null, and judged the cell by its own history. The colour
> of a source-backed cell is a family question, so it now lives in one function both painters call.
> **0 of 60 move now, 0 of 35 after a reload.** One latent finding pinned, not allowlisted:
> `tenant.mgmt_address` is a box painted from a key the record never holds — the
> `ocaf.factor_source` shape, latent because that cell always re-renders.
>
> **And the new test passed on the broken code first time round**, because a `try/catch` swallowed
> the missing `__paintCell` door so no repaint ever fired. Step 4 caught it. It now asserts the
> door is reachable and counts the repaints. `test_browser.js` 333 → **341**, `test_gen.js` 76 →
> **81**.
>
> ---
>
> ## WAVE 2 — M60 and M61 are DONE.
>
> **M61 fixed a defect M60 introduced, found by M60's own critique.** Making the fill record
> durable did not ask what happens when the FILL does not survive the reload — a fill applied and
> never saved does not, so the study tile printed *"Filled 10 values — 3 still to save."* over a
> form holding one empty row and none of the study's figures, and the `3` counted nothing. A record
> is a claim about the form, so a recalled record is now checked against it: at least one key it
> names must still carry the document's value, or it is retired. Three cases measured in real
> chromium — unsaved study retires, saved study survives, saved schedule survives (the control that
> stops the rule over-reaching). M60 is intact: the saved case still lands 1000/1000/1500/1500.
> **A wave-1 test that asserted the old behaviour was updated and says so in the file.** Also added
> the sequence M60's critique promised: schedule → save → reload → study, which lands in the same
> place. `test_browser.js` 327 → **333**, `smoke_combined.js` 173 → **175**, eleven suites,
> **1,808 checks**, green, delivered, RA anchors built.
>
> **NEXT: Peterson Plaza and Oaks on North Plaza**, the two whose fill orders still disagree — see
> the wave-1 section below for the shape and the register's `M60` corpus section for the numbers.
> It needs those two source PDFs read by eye, which is the first thing this wave could not do.
>
> ---
>
> ## WAVE 1 — M60 is DONE.
>
> **The reload defect is fixed and settled in real chromium** (M60, last section of the register).
> `_rsFill` / `_rcsFill` were module variables, so a page reload threw away the record that a
> document had been APPLIED while faithfully restoring the reading — which un-did M59 and brought
> Matt's studio / one-bedroom defect straight back on the second sitting, and leaked a fill record
> from one property into the next. The record now travels with the document, per cycle. Proved
> broken on HEAD in a real `Page.navigate` reload: `got ["Studio:1000","Studio:1500","1BR:","1BR:"]`.
> `test_browser.js` 315 → **327**, `smoke_combined.js` 165 → **173**. Eleven suites, **1,800
> checks**, all green; delivered; RA anchors built.
>
> **The corpus verification blocked at M59 has now run** (`_sweep/wave1.*`, app frozen at
> `b1b4ab2`, both orders, `--jobs 2`). Morh Housing 10 → **0** and North Park 18 → **0**
> converged. **Peterson Plaza 24 → 17 and Oaks on North Plaza 16 → 16 did not**, and the shape
> says why: the schedule's row reads `2BR` with no bathroom while the study prices `2BR/1BA` and
> `2BR/1.5BA` separately, so schedule-first hits M59's ambiguity guard and declines the row while
> study-first never faces it. **The two orders now build different rosters** — a different
> mechanism from M59, worth $27,850/month of contract rent on Peterson's HUD form. Settling it
> needs those two source documents read by eye. **That is the next wave.**
>
> `ZZ-CORPUS-` cleanup ran twice and reports **0**; four test properties created, four deleted.
> One note for whoever runs the suites next: `test_crypto.js` failed once at `1 of 81` while two
> suites ran concurrently and passed unchanged on its own — the known load flake, not a defect.
>
> ---
>
> ## EARLIER — All 34 audited, 26 defects fixed. M54 and M55 are DONE.
>
> HEAD `04d0609` (+ this record), pushed, tree clean, **0** `ZZ-CORPUS-*` in the account.
> Eleven suites, **1,753 checks**, all green. Every property has been driven through the real
> app, read by eye against its own sources, and compared three ways against what was filed.
>
> ---
>
> ## DONE — the big one. Seven schedules print HUD-92458 somewhere else (04d0609)
>
> **M54 as recorded proposed the wrong fix, and the measurement is the useful part.** Fitting
> each axis independently over a page's own label correspondences — a more generous model than
> tier 3's similarity fit — leaves a **median 3.2 to 9.0 points** of error on the declined
> pages, with maxima of **13 to 16**: more than a printed row. On Market Square the implied
> shift walks from −1.4pt at the top of the page to −45pt at the bottom, because that printing
> sets Part B's rows on a **14.4pt pitch where ours uses 10.92**. They are different
> *printings* of the form, so no transform of any order places them — and "anchor the rects to
> found text" fails too, because inside Part A there is no text to anchor to. There are
> **four** alternate printings in the corpus, each shared by exactly two properties.
>
> **What ships instead:** `rsTableA` reads Part A out of the form's own table — columns from
> the page's own printed "Col. 1".."Col. 8", rows from its own baselines, no reference to our
> geometry at all — and hands the result to the same `rsAssembleFields`, whose reconciliation
> against the schedule's printed monthly total decides whether the read is believed. Reached
> **only where the reader returned null before.**
>
> **Six properties gained their whole rent roll, every figure eye-read off the source page:**
> Market Square 118,712/mo · Mapleview Towers 247,248 · Riverwood 106,563 · Shiloh Village
> 267,688 · 333 Holly 221,267 · The Pines 242,808. Every unit count, rent and allowance
> matches the printed page exactly. **Tier 2 read 3 of 34 prior schedules before and reads 9
> now.** Riverwood went from *three OCR calls and zero files* to a package; Market Square and
> Mapleview from 3 files and 2 billed calls to **5 files and none**.
>
> **M55 closed with it.** The Pines' two fill orders disagreed on 12 rows because tier 3 placed
> them through a fit that held to only 3.4pt on a 12pt pitch. Read as a table they agree
> exactly and the phantom fourth row is gone. **M37's contaminated names are finished too** —
> `The Pines fka Wood Glen Apartments`, `Shiloh Village Apts.`, no swallowed divider.
>
> **Still open on those pages:** Parts B–E are unread on a printing that is not ours (the
> reader covers Part A, the head row and the printed total); Westwood Village and Oaks on
> North Plaza correctly gain nothing and stay OCR cases. See the last section of
> `docs/superpowers/plans/DIAGNOSTIC-REGISTER.md` for all of it, including the four-printing
> table and the proof that the control's two moved rows are M47's, not this fix's.
>
> ---
>
> ## DONE — M47, the checklist reads the study (4914153)
>
> The one authorised code change is shipped and verified end to end. `checkSeed` +
> `CHECK_CONDITIONAL` in `app.js` replaced two rules that disagreed (the key manifest tested
> the LABEL text, `applyChecklistDefaults` hardcoded `(i===2||i===4)`, and only the second is
> read at runtime). `readChecklist` in `rcs.js` answers item 14 from the study over pages the
> reader **already holds** — page budget unchanged, no OCR page added.
>
> Result, through the real signed-in app: **Scope of Work now ticks** (all 34 studies carry
> the section; Belfry heads it "Scope of Assignment") and the **appraiser's-licence item ticks
> only when the study names a temporary licence** — measured across all 31 studies the app can
> open, that is Holly House and Hampshire House and nothing else, which is exactly where the
> filed checklists tick it truthfully.
>
> **Two things in the finding as written were wrong, and the register now says so.** TP018-25
> is Holly House's permit, not Fairview Homes' — Fairview's study answers the question "No" in
> plain text on page 74, and there is no blank-with-a-permit case in this corpus. And the
> filed checklists tick "Scope of Work" on **one** property (Colonial Village), not four. The
> larger correction: the app was not diverging from the team's practice on item 14, it was
> **reproducing** it — five filed checklists read by eye all tick it, three of them with
> permanent licences. That is a "team wrong" verdict, so from here the app deliberately
> differs from those filed packages on that one box.
>
> **New in this session's evidence, worth keeping:** the comparator **cannot read a filed
> checklist's ticks at all** — every `check.N` row comes back `theirs: null`, because the
> marks are glyphs in an offset font or, on DocuSigned copies, drawn. Any claim about a filed
> tick has to be an eye-read.
>
> ---
>
> ## ~~THE ONE LARGE JOB — M54~~ — SHIPPED 2026-07-30 as `04d0609`. Kept below because
> the three measurements it names are still the sharpest statement of what these pages are,
> and because the fix it proposed ("anchor each page's rects to found text") was measured and
> refused — see the register's M54 section.
>
> Our blank HUD-92458's vertical metrics do not match the filed renditions, in three places
> The Pines measured exactly:
>
> | where | the mismatch |
> |---|---|
> | Project Name box | rect over-reaches its drawn cell by **12–13pt**, so it swallows the divider printed 10.32pt below at the identical 24.24pt left margin |
> | Part A grid | starts **7.92pt out of phase** at an identical 12.00pt pitch — same pitch, wrong phase |
> | field 228, Part H name and title | rect y 601.51–636.51 against a signatory line at y 587.3–596.6 — **4.9pt clear, zero overlap, every tier, every run** |
>
> That last one alone withheld five documents on a property whose checklist needs only three
> fields, two of them printed in clean 10pt type on the page the app was handed. The row-mate
> clamp in `1b3b883` closes one of the three. **The real fix anchors each page's rects to
> found text before placing anything.** Its verifier already exists:
> `scratchpad/cmp-fields.js` runs a field-level before/after over every prior schedule in the
> corpus and has twice been decisive — once proving a fix moved 8 properties and regressed
> none, once catching a double-space I had introduced.
>
> Related and open: **M55**, the two upload orders disagree on The Pines (`rs-first` attaches
> the study's rows one row early and invents a phantom fourth row, reading $298,960 monthly
> against a true $285,840) while the harness prints *"both orders produce comparable
> packages"*. Probably the same 7.92pt phase error. **M42**, a page that registered at
> residual 0.00 and was billed is discarded because Part A failed — two properties, two
> causes. **M58**, an HTTP 429 is rendered as a permanent verdict: Marine Terrace read the
> same file successfully nine hours earlier, and the message sends the PM to hand-key thirty
> values that were machine-read that afternoon, after three retries in 2,076ms.
>
> ---
>
> ## WITHDRAWN — do not re-open these
>
> - **Part F and Part I are not defects.** Matt: those filed schedules are copies sent **back
>   from the contract administrators, who completed them**. The corpus agrees everywhere —
>   Newberry Arms' owner copy is blank and the CA wrote Part I on 11/18; Friendship Court's is
>   countersigned; Marine Terrace's reads `CS CGI 07/17/2026`; Fairview's Part F reads `RD`.
>   **The app is right to leave both blank**, and the "Part F blank (8)" / "Part I blank (7)"
>   rows are gone. **The method consequence is larger:** much of what this corpus calls
>   "filed" is a CA-returned copy, not what the owner submitted, so a draft-vs-filed comparison
>   will always show those Parts as differences that are not differences.
> - **OakCenter1** — the app writes `Oak Center 1` correctly.
> - **"the UA comes from the study"** — a third document governs, and it has twice confirmed a
>   genuine **$0** that must survive any fix.
> - **"the workbook is missing formulas"** — they are Excel **shared** formulas the reader
>   could not resolve. Three separate agents nearly filed this; two caught themselves.
> - ~~**"checklist Scope of Work unticked is a team habit"** — the *signed* filed copies tick it.~~
>   **This was wrong and is corrected in the register (M47).** Of five filed checklists read by
>   eye, **one** ticks it — Colonial Village's 2026 DocuSigned copy. Walden, Fairview Homes,
>   Holly House and Hampshire House all leave it blank on the signed "Exhibit 2" template. The
>   app ticks it now anyway, because all 34 studies carry the section and HUD lists it as
>   required RCS material; leaving it blank under-reports material that is in the package.
> - **The 7.1-point tier-2 refusals** are a **third printing of HUD-92458**, discriminated by
>   its footer's page count and not its OMB date, whose Part B rows sit on a 14.4pt pitch
>   against our 10.85pt. Market Square and Mapleview measure identical to five decimals, so
>   the residual measures **the blank**, not the document, and tier 3's refusal is **correct**.
>   Loosening `OCR_MAXRESID` would be actively harmful. The real fix is a label-relative reader.
> - **Correcting the tier-2 offset** was tried and refused by measurement: on the eight
>   misaligned schedules the displaced labels agree on **no single shift**.
> - **A plausibility bound on parsed values** was rejected with evidence: the garbage included
>   a rent of **11,918**, inside any bound loose enough to accept real rents of 1,198–2,875.
>
> ## TABLED — UAF-feature work, and the corpus is its training data
>
> The allowance-source problem (5 properties) and the §245.410 decrease notice (3 properties)
> both belong to the **UAF feature, which is not built yet**. Matt has tabled them and wants
> the findings kept. The register's last section lists what the corpus already establishes for
> that phase: the governing allowance can **postdate the submission by six weeks**, it is
> sometimes a **human judgement** a parser cannot derive (108.9060 → 105), the study is only
> ever a witness to *last* year's figure, a decrease can affect **one unit type only**, the
> decrease notice has a **different signer**, and a study's addenda can print a state UA
> schedule that is **not** the subject's allowance.
>
> ## The instruments, and why a difference count means little
>
> **Six properties now: the count measures the comparator, not the app.** Fairview Homes 95 →
> **4** real (62 rows are the extractor reading an NJHMFA transmittal letter's lines as Part A
> rows, because DocuSign rasterised the filed schedule to one character of text on page 2);
> Walden 97 → 7; Friendship Court 98 → 8; Colonial Village 39 → 7; Barnum House 79 → mostly a
> one-field offset; **Marine Terrace 14 → 0**, low only because five of six documents were
> withheld. A low or falling count is a signal to go looking.
>
> Two rig faults worth fixing before the next comparison run: the study-selection rule trusts
> the filename token **"(updated)"** over the letter date printed inside — on Market Square
> that picked the **oldest** of three revisions, so our figure matched the filed Submission
> exactly and *scored as correct* while the executed schedule said $50/unit less. And the rig
> prefers **owner-signed** prior schedules over **HUD-countersigned** ones (Barnum House,
> Friendship Court), forfeiting the contract number and Part F for free. **The executed rent
> schedule, not the Submission PDF, is the authority on what was approved.**
>
> ## The account is fine
>
> 14 → 4 → 2 was **Matt**: he deleted the properties and replaced them with the company's
> actual property list from the CSV HAP tracker. Not data loss. Two consequences: the
> `ZZ-CORPUS-` prefix discipline now matters **more**, because scratch records sit beside the
> real portfolio, and `--cleanup --prefix ZZ-CORPUS-` reporting **0** remains the only safety
> check — a property total never was one.
>
> ## Housekeeping
>
> `git` cannot auto-detect an identity on this machine since its hostname became
> `Mac.(none)`. Every commit in this run passed `GIT_AUTHOR_NAME/EMAIL` and
> `GIT_COMMITTER_NAME/EMAIL` from `git log -1 --format='%an'` / `'%ae'` rather than writing to
> Matt's config. Setting `user.name` and `user.email` in the repo would end that.
>
> `deliver.sh` fails intermittently on `test_crypto.js` under load and passes unchanged on
> retry. Note that **the commit can land while the build does not**, leaving `index.html` a
> build behind its own sources — check, and confirm the shipped bundle actually carries the
> change rather than trusting a byte count.

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
| 22 | 75705 | The Pines | **audited** | 12 |
| 23 | 75708 | Colonial Village | **audited** | 14 |
| 24 | 75830 | Clinton Manor | **audited** | 1 |
| 25 | 75831 | Friendship Court | **audited** | 14 |
| 26 | 75832 | Newberry Arms | **audited** | 8 |
| 27 | 75833 | Circle Park | **audited** | 1 |
| 28 | 75917 | Peterson Plaza | **audited** | 0 |
| 29 | 75919 | Northgate Terrace CA | **audited** | 11 |
| 30 | 75920 | Fairview Homes | **audited** | 4 |
| 31 | 75921 | Walden | **audited** | 7 |
| 32 | 75922 | Marine Terrace | **audited** | 7 |
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
