# Lane brief — RCS package audit

    /Users/matthewkodsi/Desktop/github/Form-Automation-AUDIT   branch: rcs-audit

`cd` there at the start of every shell command.

---

# STOP. Do not run anything yet.

Write your methodology first. Matt approves it before you audit a single package.
Then you prove it on ONE package before you touch the rest. Two gates, both his.

An overnight run that finds nothing is the failure mode this lane exists to avoid.
It has already happened. It happened because nobody checked the method first.

---

## What this audit is

For each property AND each year it has a package, build three things:

| | what it is |
|---|---|
| **SHOULD** | What the package must contain — derived by YOU, from the appraiser's RCS survey and the prior year's executed rent schedule. Reasoned out from the sources, before looking at any answer. |
| **OURS** | What Matt's form generates when fed those same two documents — the documents and the Excel workbook. |
| **FILED** | What the PM actually sent HUD that year. |

Compare all three.

**SHOULD is the referee, and that is the whole point.** Where OURS differs from FILED,
that alone tells you nothing — it could be a bug in the form or a typo by the PM. Only
SHOULD settles which. A comparison that treats FILED as truth cannot tell a defect from
a human error, and every previous attempt here did exactly that.

Ignore differences of style, ordering, file naming, and extra optional documents a PM
chose to include. Those are not findings.

## Read like a person, not like a parser

Every document, every page, in all three sets: **look at it and read it.** Textual,
visual, functional. Numbers, wording, placement, formatting, alignment, what is missing,
what is invented, what is in the wrong box.

Rendering is a PASS, not a follow-up. You cannot decide to look at a page because a
finding told you to — the findings you are hunting are the ones only looking produces.

## Why the previous attempts failed — do not repeat these

Verified in the code, not remembered:

1. **It never rendered a single page.** `sweep.js` contains no call to any renderer.
   `look.js` and `rdiff.js` exist and nothing invokes them.
2. **It stripped `$` and `,` off both sides before comparing** (`extract.js:96`,
   `compare.js:68`), so a missing dollar sign on a federal filing compared as a perfect
   match across all 34 properties.
3. **It treated FILED as truth.** No SHOULD leg existed.
4. **It audited a fraction.** The manifest holds 48 packages; the property folders on
   disk hold 8–26 each. Re-manifest before you scope anything.
5. Its verdict line reads *"every compared value agrees"* — which a reader takes as
   "this property is fine."

## The calibration gate — prove the method before you scale

These are real defects in this form, every one found by a human eye and missed entirely
by the automated sweep. Run your pipeline and see whether it rediscovers them **without
being told where to look**:

- The four rent-potential totals printed with no `$`, where every filed copy has one.
- Part D Column 3 printed the prior year's rent instead of the proposed rent
  (Colonial Village: 1,147 where the filing says 1,850).
- Field 174 printed blank where HUD's own form and every filed copy print `0`.
- Rent values stored as `"1,850"`, which Acrobat reads as 1.85 — the form miscalculated
  by a factor of a thousand on a live filing.
- Part H read "Vice President **of the** General Partner"; no source has that article.
- The signature date defaulted to today, under a signature line nobody had signed.
- The Part A project name lost everything after the `/`.

**If your method cannot find these, it will not find the ones nobody has found yet.**
Report how many you caught, and for each one you missed, why. That number is the gate.

## Your methodology, in plain terms

One page. No jargon. Matt must be able to judge it in two minutes. Answer exactly this:

1. **How do you build SHOULD?** What do you read, and how do you decide what's correct?
2. **How do you actually look at a document?** Mechanically — what turns a page into
   something you can judge?
3. **How do you know you catch things?** Your score on the calibration list above.
4. **How big and how long?** Package count, wall-clock, and what it costs.
5. **What do I get at the end?** The shape of the output, and how a finding says which
   of the three legs was wrong.

Then run **one** package end to end, show Matt the findings, and wait.

## The rails

- **Every run writes `ZZ-CORPUS-*` properties into Matt's LIVE account.** Delete them:

      node app/full-mp/corpus/drive.js --cleanup --prefix ZZ-CORPUS- --dry-run
      node app/full-mp/corpus/drive.js --cleanup --prefix ZZ-CORPUS-

- A sweep refuses to run on `main`. You are on `rcs-audit`, so it will run.
- **Stay out of `app.js` 2720–2867** (OCAF/UAF) and out of `shell.head.html` styling —
  two other lanes own those. Findings that need a UI change: write them down, hand over.
- Merge `origin/main` into this branch daily.
- The OCR cache is symlinked to the main folder. Don't delete it; rebuilding costs money.
- `bash app/full-mp/run_tests.sh` green before anything is pushed. Repairs reach `main`
  by PR.

## Read first

- `SESSION-HANDOFF-2026-07-29-AUDIT.md` — the method, the repair loop, what's open.
- `docs/superpowers/plans/MORNING-REPORT.md` — what the first sweep found.
