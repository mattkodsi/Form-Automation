# STATE — the one file that says where this lane actually is

**Whoever changes something updates this in the same commit.** It is the only file that
claims to be current; every other doc in the lane is either standing rules
(`rcs-audit-run.md`, `rcs-audit-plan.md`), method (`rcs-audit-method.md`), or accumulated
findings (`AUDIT-LEDGER.md`). If this file disagrees with them, this file is right and
the other one needs fixing.

Last updated: **2026-07-31**, by the Mac, after verifying the tracker-aware driver.

## Blocked on one thing

**The renewal selector returns the wrong row, and nothing can sweep until it is fixed.**
Owner: **cloud**. Filed at
`docs/lanes/inbox/2026-07-31-mac-to-cloud-renewal-selector.md`.

Two callers, one wrong answer: the driver refuses `75708` saying the tracker carries no
startable row in or after 2026, and the Renewals page calls 87 of 88 properties
unscheduled. Brewster Mews is the sharpest case — it found a row **eight years late**
rather than none, so the walk steps over valid rows rather than failing to see them.

## Where each leg stands

| leg | state |
|---|---|
| SHOULD (sources read by eye) | 28 of 42 properties, cloud, ongoing |
| OURS (app-generated packages) | 37 packages driven, **all provisional** — driven before the date lock, so anything year-derived in a prior-year record is untrustworthy |
| FILED (what the team submitted) | read alongside SHOULD |
| three-way verdicts closed | a handful; this is the deliverable and the number that counts |
| repairs shipped | **none yet.** Findings are not fixes. |

## The environment, as of now

- Account: **249 real portfolio properties**, 0 cycles, 0 scratch records. Rebuilt from
  the HAP tracker 2026-07-31 with Matt's blessing; what it replaced is snapshotted at
  `docs/superpowers/plans/account-snapshot-before-reset.json`.
- Tracker: **4,273 rows**, rent-increase years **2014–2046**, loaded into `hap_schedule`.
  Write policies were added for the import and dropped again — reads 200, writes 403.
- **43 of the corpus's 66 property-years are drivable.** The other 23 are pre-2020 years
  the export does not reach, plus Sycamore Green, which the tracker never lists.
- Driver: finds the property by `ra_property_code`, creates none, records and deletes
  **cycles**. Verified on 75708 — account unchanged at 249/0/0.
- Not built: the **two-pass** drive (prior cycle → save → current cycle), which is the
  only way to reach the on-file and overridden provenance states.

## Who does what

**Cloud** reads sources, writes verdicts, traces mechanisms, and is the only machine that
edits source, builds, tests and delivers. **Mac** drives the real signed-in app, cleans
the account, and after any repair re-drives and reports whether the right things moved.
The Mac does not edit source.

## How we talk

`docs/lanes/inbox/` — one file per handoff, `<date>-<from>-to-<to>-<topic>.md`. **Both
machines check it at the start of every loop iteration**; a message therefore crosses in
at most one iteration without Matt carrying it.

**When a handoff is dealt with, move it to `docs/lanes/inbox/done/` in the commit that
deals with it** — appending "done" inside the file does not work, because the next reader
sees a directory of files and cannot tell which still want something. An empty inbox
means nothing is waiting on the other machine, and that has to be true at a glance.

Neither machine can wake the other. A message waits for the recipient's next iteration —
fine for hours-long work, useless for anything urgent. For urgent, Matt is still the
fastest path.
