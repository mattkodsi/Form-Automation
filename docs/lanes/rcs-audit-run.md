# The run order — CURRENT. Supersedes everything above it in git history.

Rewritten 2026-07-31 after three things changed underneath this lane: the corpus is
driven from a real portfolio rather than scratch records, `main` made the renewal
schedule definitive for a package's date, and the roles swapped.

## Roles

**The cloud is the quarterback and owns the code.** It reads sources, writes verdicts,
traces mechanisms, and is the ONLY machine that edits source, builds, tests and
delivers. It cannot drive the app — chromium has no network egress in that container,
proved by twelve measurements — and that is its only limitation. Loopback works there,
so it runs every suite including the browser ones.

**The Mac is the driving rig.** It drives the real signed-in app against the corpus,
pushes the records, cleans up the account, and after any repair re-drives and reports
whether the packages that should have moved moved and nothing else did. **It does not
edit source.** What it observes it writes down and hands over.

## The state of the account — READ THIS BEFORE DRIVING ANYTHING

The account is no longer a scratch pad. On 2026-07-31, with Matt's explicit blessing, it
was emptied and rebuilt from the HAP tracker:

- **236 real portfolio properties**, imported with their `ra_property_code`.
- **4,273 tracker rows** in `hap_schedule`, carrying rent-increase years **2014–2046**
  where the previous export effectively began at the next renewal.
- What was deleted is snapshotted at
  `docs/superpowers/plans/account-snapshot-before-reset.json` — 15 properties, 4 cycles.

**Therefore the old cleanup rule is now DANGEROUS.** `--cleanup` deletes PROPERTIES. The
properties in that account are now real portfolio records that must survive. A cleanup
that deletes properties would destroy the portfolio, not tidy up after a run.

**The new rule: a run creates CYCLES, not properties, and cleanup deletes only the
cycles it created.** Until the driver is changed to work that way, DO NOT run a sweep
against the portfolio.

## Why the date now comes from the tracker

`main` (`afda7f4`, and the spec at
`docs/superpowers/specs/2026-07-30-tracker-is-definitive-design.md`) made the renewal
schedule definitive. In `newCycleDialog`, when the tracker carries a row for the
property, `_fixed` is true and the effective date and program render as LOCKED LINES —
there is no `cyEff` input to type into. The package takes the schedule's date.

Two consequences, and they are the reason the tracker was reloaded:

1. **A historical package can be created only if the tracker carries that year.** With
   the new export, **43 of the corpus's 66 property-years** are drivable. The other 23
   are pre-2020 years where the export thins to a handful of rows, plus Sycamore Green,
   which the tracker does not list at all. Those 23 can still be READ for SHOULD; they
   cannot be regenerated, and the driver must skip them and say so rather than invent a
   date.
2. **Every package driven before 2026-07-31 took a default date.** `drive.js` never set
   `cyEff`, so all 89 in `sweep-out/` were created as current-cycle packages whatever
   their year. Anything year-derived in a prior-year record — the SAFMR pull most
   obviously — is comparing today's HUD data against a filing from years ago. Treat
   those prior-year rows as PROVISIONAL until re-driven.

## The driver change — the cloud's next job, and nothing drives until it lands

| # | what | why |
|--:|---|---|
| 1 | Find the existing property by `ra_property_code`; never create one | the portfolio is real now |
| 2 | Create the package for the TARGET year by selecting its tracker row | 16 property-years carry more than one row, so the row must be chosen, not assumed |
| 3 | Skip, loudly, any property-year the tracker does not carry | a package with an invented date is not the package that was filed |
| 4 | Record and delete **cycles**, never properties | see the account warning above |
| 5 | Two passes: drive the prior cycle, SAVE, then drive the current one | this is the one that matters — see below |

**Why two passes is the point.** A blank property makes every cell read `new` — grey. The
provenance system's whole purpose is the difference between **on file** (blue),
**overridden** (orange) and **new**, and a blank record can produce neither of the first
two. Every audit run to date has therefore never once exercised the states Matt's team
actually works in. Driving last year's package, saving it, and then driving this year's
against a record that already holds it is not a simulation of the workflow — it IS the
5th-year renewal.

## What the Mac does once the change lands

1. Drive the 43 drivable property-years, both fill orders, storm on.
2. Cleanup by cycle; confirm the property count is still **236** and unchanged.
3. Commit `docs/superpowers/plans/sweep-out/` and push after every wave, not at the end.
4. Re-drive after every repair and report what moved.

## Step one of every loop iteration, both machines: merge `origin/main`

Not a rule people remember — the FIRST thing each iteration does.

Main drifted **19 commits** under this lane before anyone noticed on the morning of
2026-07-31, and had drifted **4 more** by that evening, including `2f8b4b7 The source
badge follows the value`, which changes `app.js` and `test_browser.js` in exactly the
provenance area this audit measures. A sweep run against an unmerged branch produces
records describing a superseded build, and the first question anyone asks of a provenance
difference is whether it is a real defect or a change the branch had not taken yet. That
is the "app frozen at one SHA" problem `sweep.js` exists to prevent, arriving through the
back door.

**The cloud merges**, because it owns the code and can run the suites and deliver. It
merges, runs all fourteen suites, and pushes before anything else in the iteration.

**The Mac does not merge** — two machines merging one branch is a conflict waiting for the
worst moment. It pulls, and if `git log rcs-audit..origin/main` is non-empty it reports
that and does not drive, because a spot-check against a stale branch answers a question
nobody asked.

## Rails that have each cost a run

- **The property count is 236 and must stay 236.** If it changes, something deleted or
  created a portfolio record and the run stops. (Was 249 until 2026-07-31, when the
  tracker was filtered to OCAF/RCS only and the 15 properties whose every tracker row was
  EXPIRES or Request — never a rent renewal — were removed. See the inbox note. That trim
  was deliberate and done through admin SQL, so it did not spend the session token.)
- A scratch record can rename itself out of any name-based check — the app overwrites
  `property.name` from a readable schedule. `drive.js` records ids; trust ids, never names.
- Never pipe a suite through `| tail` — the exit status becomes tail's.
- `find` returns only the root on the Drive mount, silently. Use `ls -R`.
- A record saying "the app generated nothing comparable" is **blocked**, not done.
- Stay out of `app.js` 2720–2867 and `shell.head.html` styling — another lane owns them.
- Merge `origin/main` daily. It moved 19 commits under this lane before anyone noticed.
