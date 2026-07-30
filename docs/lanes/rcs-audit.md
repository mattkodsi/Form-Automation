# Lane brief — RCS package audit

    /Users/matthewkodsi/Desktop/github/Form-Automation-AUDIT   branch: rcs-audit

`cd` there at the start of every shell command. The corpus (read-only Drive mount):

    ~/Library/CloudStorage/GoogleDrive-mfkodsi@gmail.com/My Drive/RCS Package Samples

## Do not run the audit yet

Two gates, both Matt's: he approves your written method, then your pipeline passes a
blind trial on one package he designates. Nothing scales until both pass.

## The task

30+ real properties. Each property folder holds one or more package years; a year
holds the appraiser's RCS survey, the prior year's executed rent schedule, and the
package the PM actually submitted to HUD. **Inventory the corpus yourself, from disk,
every property and every year, before you scope anything.**

For each (property, year) you audit, produce three versions of the package and compare
all three:

- **SHOULD** — what the package must contain, derived by you from the two source
  documents alone, before consulting any answer.
- **OURS** — what Matt's form generates when fed those same two documents: the
  document set and the Excel workbook.
- **FILED** — what the PM submitted.

FILED is evidence, not truth — PMs make mistakes too. SHOULD is the referee: every
finding names which leg is wrong and how you know. Differences of style, ordering,
file naming, or optional extra documents are not findings.

Read every page of every document the way a reviewing human would — numbers, wording,
placement, formatting, what is absent, what is invented. Rendering pages and looking
at them is part of the pipeline for **every** document, not a step reserved for
suspicious ones.

Audit the middle as well as the ends: what the form parsed from each source, what
landed in which cell, provenance colours, saving — driven in a real browser, observed,
not inferred from reading the code.

## Prove your instruments first

Trust no tool you have not tested — **including everything already in this repo**.
Before any extractor, renderer, or comparator joins your pipeline, show it detects a
difference you deliberately planted and stays silent on an identical pair. A green
unit suite is not that proof. Whatever fails the check is discarded, whoever wrote it.

## Gate 1 — the method, one page

Plain terms Matt can judge in two minutes:

1. How you build SHOULD.
2. How a page becomes something you can judge — mechanically.
3. How you proved each instrument you rely on.
4. Scale: package count, wall-clock, cost.
5. What a finding looks like, and how it names the leg that is wrong.

## Gate 2 — the blind trial

Matt designates one trial package when he approves the method. It contains defects you
have not been told about. Run the full pipeline and report everything you find. Every
finding must carry the pipeline evidence that produced it — the rendered region, the
extracted values, the comparison — and findings without evidence do not count. You are
graded on what you find, what you miss, and what you falsely report. Then wait.

## Rails

- Runs write `ZZ-CORPUS-*` properties into Matt's LIVE account. Delete them after
  every run: `node app/full-mp/corpus/drive.js --cleanup --prefix ZZ-CORPUS-`
  (`--dry-run` first to look).
- Sweeps refuse to run on `main`; you are on `rcs-audit`.
- Stay out of `app.js` lines 2720–2867 and out of `shell.head.html` styling — other
  lanes own them. A finding that needs a UI change is written down and handed over.
- Merge `origin/main` into this branch daily.
- `_archive/corpus-cache` is symlinked and expensive to rebuild. Do not delete it.
- `bash app/full-mp/run_tests.sh` green before any push. Repairs reach `main` by PR.
