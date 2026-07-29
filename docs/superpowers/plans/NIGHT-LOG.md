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
