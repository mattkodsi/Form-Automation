# Lane brief — continue the RCS corpus audit

Paste this to the chat continuing the audit.

## Where you work

    /Users/matthewkodsi/Desktop/github/Form-Automation-AUDIT   branch: rcs-audit

`cd` there at the START of every shell command — the working directory drifts to the
main checkout, which is a different branch.

## Read first

- `SESSION-HANDOFF-2026-07-29-AUDIT.md` — the three-way method (read the SOURCES
  yourself, then compare app vs filed), the audit-wave / repair-break loop, what is
  fixed and what is open.
- `docs/superpowers/plans/MORNING-REPORT.md` — what the first full sweep found.

## The four rules

1. **Every run writes `ZZ-CORPUS-*` properties into Matt's LIVE account. Delete them
   afterwards:**

       node app/full-mp/corpus/drive.js --cleanup --prefix ZZ-CORPUS- --dry-run   # look first
       node app/full-mp/corpus/drive.js --cleanup --prefix ZZ-CORPUS-

   `cleanup()` refuses a prefix under 4 characters rather than guess what to delete.

2. **A sweep refuses to run on `main`**, because a push to main is a deploy. You are on
   `rcs-audit`, so it will run. `CORPUS_ALLOW_MAIN=1` exists and you should not need it.

3. **Stay out of `app.js` lines 2720–2867 and out of `shell.head.html` styling.** Two
   other lanes own those. Audit findings that need a UI change: write them down and
   hand them over rather than making them here.

4. **Merge `origin/main` into this branch every day.**

## Two things that will save you a day

- **The comparator is blind to presentation.** Both sides have `$` and `,` stripped
  before they meet, so a dropped dollar sign or a figure one row low compares as a
  perfect match. When a finding is about how something LOOKS, use
  `corpus/look.js` (renders to PNG) or `corpus/rdiff.js` (pixel diff, two PDFs).
- **The OCR cache is symlinked** to the main folder's `_archive/corpus-cache`, so
  re-reading the corpus costs nothing. Do not delete it; rebuilding means paying Azure
  again.

## Done means

    bash app/full-mp/run_tests.sh    every suite green before anything is pushed

Repairs land on this branch and reach `main` by PR, not by pushing to main.
