# Night log — RCS corpus loop

Append-only. One entry per task: what ran, what it found, what changed, what is
still open. Read from the top on waking. The plan is
`docs/superpowers/plans/2026-07-29-rcs-corpus-loop.md`; the order is A (build and
run the comparison loop) with B (scanner fixes) as a reactive interrupt.

Every entry ends with a `RESUME HERE:` line naming the exact next command, so a
cold re-invocation never has to re-derive where it was.

---

## Task 1 — safety rails, decrypted cache, night log

**Ran:** `node app/full-mp/corpus/test_safety.js`, then
`node app/full-mp/corpus/decrypt-cache.js "$CORPUS" _archive/corpus-cache app/full-mp/corpus/corpus.json`

**Found / changed:**
- New suite `corpus/test_safety.js`, 7 checks, all passing. It asserts the things
  that would be expensive or irreversible if they quietly stopped being true:
  `ocr.js` makes no network call of its own and reaches Azure only through
  `supaClient.functions.invoke` (so tier 3 cannot bill under selftest, where no
  client exists); the cache is gitignored; the branch is not `main`; the Drive
  mount is readable and shows 34 property folders; `pdfdecrypt.js` and
  `crypto.js` are present.
- `_archive/corpus-cache/` added to `.gitignore`. Confirmed by `git status`:
  145 MB of decrypted studies, zero of them staged.
- **20 of 20 locked studies decrypted with our own `pdfdecrypt.js`** — R4/AESV2
  for eighteen, R6/AESV3 for Noble Tower's two. Not MuPDF: a corpus unlocked by
  a tool we do not ship would prove the tool, not the app.

**Got wrong:** the file I wrote landed with a NUL byte inside a string literal
(`folder+'\0'+rel`). `node --check` passes on it and the code runs correctly —
only the NUL-byte gate caught it. This is the mounted-folder corruption CLAUDE.md
warns about, and it reached a *sandbox* file, not just the mount. Every source
file written tonight is checked with `tr -cd '\000' | wc -c` before it is used.

**Still open:** nothing in this task.

---

## Task 2 — the manifest tells the truth about year −1

**Measured first, before changing anything.** 13 of 34 wave-1 cycles had
`priorRs: null`, and 26 had more than one study candidate with the first one
taken arbitrarily.

**Diagnosed by looking at four properties, not one** (Northcross, Westwood
Village, Hampshire House, Walden, 333 Holly):

- The lookup demanded a rent schedule matching `/approved|executed/` inside a
  folder for `year0 − 1`. The folders exist and the schedules are in them — the
  regex is what was wrong. Northcross's 2023 schedule says `(signed)`;
  Westwood's 2024, Walden's 2024 and 333 Holly's 2024 carry **no qualifier at
  all**. All four are the genuine filed schedule.

**Changed:** `rsRank()` ranks instead of filtering — executed/approved 6,
signed 5, final 3, draft −6, unsigned −4, Archive −1 — and the resolution runs
four rules in descending confidence, recording which one fired in
`priorRsRule`: year−1 folder → year−1 in the filename → newest before year 0 →
null with the attempts listed. `studyRank()` ranks candidates (FINAL +6,
numbered package item +4, revision +2, draft −8, Archive −5, mtime breaks exact
ties only), keeps every candidate, sets `chosenStudy`, and flags a coin toss
when the top two are within one rank.

Also: the manifest now reads decrypted copies from the cache when one exists,
so the 20 previously-unreadable studies enter the corpus as studies instead of
as read errors. Those 20 are disproportionately the firms `rcs.js` does not
recognise, which is exactly what the reader audit will need.

**Smoke on 3 properties:** all three resolved via the strongest rule, and the
chosen files are right by eye (Northcross → `2023/… 10-1-2023 (signed).pdf`,
Westwood → `2024/… eff. 8.1.24.pdf`, Riverwood → `2024/FY2024 RS … (executed).pdf`).

**Got wrong:** the first version reported Westwood's prior RS as "a draft or
unsigned copy" because its rank was 0. Rank 0 means the filename carries no
marker, which is the common case and not a defect. Split into `notes` vs
`problems` so the runnable count is not depressed by ordinary filenames.

**Still open:** full 34-property rebuild running.

RESUME HERE: check the background rebuild, then write `corpus-review.md`
(Task 2 Step 6) and commit.

**Result:** 34 of 34 runnable pairs (was 11). Zero readLetter errors (was 20).
33 resolved by the strongest rule, 1 by fallback (North Park). 19 of 34 have no
open questions at all; 12 have a study choice close enough to be a coin toss,
listed for Matt in `app/full-mp/corpus/corpus-review.md`.

RESUME HERE: done. Task 7 (compare) merged; Task 8 (Lansing ground truth) done.

---

## Task 7 — the compare seam (agent)

91 checks, verified by me rather than taken on report. Hand-checked nine
normalisation cases directly against the module: the alias correctly refuses to
match, money and dates and word-spacing correctly do, accounting parentheses and
leading zeros correctly do not. My own expectation was wrong on one case —
`NC19E000007` vs `NC19-E000-007` — which the module matches and should, because
they are the same HUD contract written two ways.

---

## Task 8 — Lansing Manor, read by eye

115 values across six documents in `corpus/verified/lansing-manor.json`, read off
150-dpi page renders rather than through any text layer, so a bug in the reading
path cannot reach both this file and the extractor.

Six findings, each of which will show up as discrepancies later and would have
been misdiagnosed without this file: the Belfry FHA/Section-8 mislabel confirmed
in the corpus; unit types renamed between documents; the utility allowance
falling 116 → 99 from a source that is neither input; Part B growing by six
items so it is not a carry-forward; the tenant notice dated a day before the
cover letter; two different CA staff, only one knowable at generation time.

---

## Task 5 — the drive seam (agent), and THE FINDING OF THE NIGHT

The seam works: real bytes through the real file inputs via CDP, both orders,
real downloads captured (no fallback, `weakerTest:false`), tier-3 tripwire clean.
Two harness bugs the agent found and fixed in itself are in its report.

**But it only produced 3 files, not 6, and the app said why: `1 of 6 ready ·
5 need more information`.** The cause is not the harness.

### The app cannot read executed rent schedules — 29 of 34, not 5

I verified this myself rather than accepting it. For Lansing Manor's executed
prior schedule the values are not in the text layer, not in widgets, and not in
annotations: they are **filled vector paths**. Where "1Bedroom" prints there are
159 path items; where "892" prints, 85. The text was converted to outlines when
the document was flattened. There is nothing for a text parser to recover — not
by a better regex, not by better positioning. Tier 2 cannot ever read it.

Surveying all 34 wave-1 prior schedules by locating the actual HUD-92458 page
and looking for digits in the unit-row band:

|  count | how the values are stored | readable by the app today |
|---:|---|---|
|  5 | real text in the text layer | yes, tier 2 |
| 11 | blank-template text, values outlined as vector paths | no |
| 18 | no text layer on the form page at all (outlined or scanned) | no |

So **5 of 34**. The five that work are Northcross, Westwood Village, Riverwood,
Mapleview Towers and Market Square.

This reframes the night. It is not a parser nicety — it is the largest single
defect in the product, and it is a **cost** finding as much as a correctness one:
every one of those 29 properties currently requires tier-3 Azure OCR, which
bills per page, on every package the tool produces.

**The lead I am following:** `swiftc` 6.2 and `Vision.framework` are both present
on this machine. macOS Vision text recognition is local, offline and free, and is
strong on clean printed forms. If it reads Lansing's 892 / 897 / 28,544
correctly — values I have already verified by hand, so I can grade it honestly —
then the corpus harness gains a free oracle for all 29, the sweep can proceed on
34 properties instead of 5, and there is a real argument for a local reader in
the product rather than paying per page.

Spike in progress. If Vision does not read them accurately I will not pretend it
does: the fallback is to run the sweep on the 5 readable properties for the RS
path, run all 34 for the study path, and report the gap as the headline.

RESUME HERE: `"$SP/visionocr" "$SP/lansing/prior-p2.png"` and grade the output
against `corpus/verified/lansing-manor.json` -> priorRentSchedule.values.

**Spike result: Swift is unavailable on this machine.** `swiftc` and the SDK are
version-mismatched — the compiler is `swiftlang-6.2.0.9.909`, the CommandLineTools
SDK was built with `...904` — so every Apple module fails to build. Fixing it
means `xcode-select` or installing Xcode, which needs Matt's password. Per
Constraint 12 I did not retry it a second way; it goes to the morning report as
a decision, and I rotated to the sweep.

---

## Task 9 — the loop, proven on Lansing Manor

`corpus/sweep.js` runs drive → extract → compare over a property list in both
orders, resumable per property, output grouped by cause then key.

**First run: 67 differences. Six were real. The other fifty-nine were the
harness lying, in four distinct ways** — each of which would have multiplied
across 34 properties and buried every genuine finding:

1. **A document the app never wrote was counted as thirty differences.** Thirty
   rows were every field of five documents the app declined to generate. One
   root cause, restated once per field. Now only documents both sides have are
   compared; the rest are counted once, with the app's own stated reason.
2. **Every filed analysis workbook read as empty.** The extractor refused all
   cached formula results. That is right for *our* workbook, which declares
   `fullCalcOnLoad` and holds stale zeros — and wrong for the PM team's, which
   were saved by Excel and whose cached values are real. Trust is a property of
   the workbook, not a constant.
3. **Columns were addressed by letter.** Ours puts unit rows at row 9, the filed
   ones at row 3, and Lansing's labels `Current Rent` one column to the right of
   the data it names. Now matched by header text, with footnote markers stripped
   because ours says `RCS Rents*`.
4. **The spreadsheet row number was compared as data.** One guaranteed false
   difference per unit type, on every property.

**After the fixes: 14 compared, 6 matched, 8 differences, every one real.**
The app's unit counts, RCS rents and SAFMR all agree with the filed workbook.

### The three findings, diagnosed rather than just detected

- **Unit type collapses two types into one.** Ours says `1BR/1BA` for both rows;
  the filed workbook says `1-Bedroom` and `1-Bedroom Patio`. Root cause found in
  the source, not guessed: `buildRentAnalysisBytes` (app.js:4091) builds the type
  as bedrooms + bathrooms and nothing else, and `gen.js` does the same in five
  places. **The data model has no field that distinguishes two unit types
  sharing a bedroom and bathroom count.** Lansing's 32 units without a patio and
  68 with one are indistinguishable to the app. Structural, not cosmetic.
- **UA says 85 where the filed workbook says 116 — and this is NOT a separate
  bug.** The precedence at app.js:4091 is executed → RCS → custom, which is the
  right order. There was no executed value because the prior rent schedule was
  unreadable, so it fell through to the study's 85. Downstream of the finding
  above, and it would be wrong to report it as a second defect.
- **No current rents at all**, for the same reason. The analysis workbook's
  entire rent-increase column is blank.

RESUME HERE: full sweep of all 34 × 2 orders is running in the background at
`--jobs 3`, label `sweep-1`, app frozen at d4c3d60. When it lands, read
`_archive/corpus-cache/_sweep/sweep-1.md`, then diagnose by descending row count
per Constraint 10 (two properties minimum before any fix).
