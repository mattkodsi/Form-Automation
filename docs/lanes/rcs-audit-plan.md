# The plan — who does what, and what counts as done

Matt, 2026-07-31: *"I just want to make sure you guys actually know what the plan is
between you two and that you are going to be fixing real bugs and issues."*

The lane's deliverable has always been **a correct app, not a report**. As of this
commit we have found a great deal and repaired nothing. That is the gap this file
closes.

## The division, and it is not negotiable

| | **Cloud** | **Mac (quarterback)** |
|---|---|---|
| reads sources by eye | ✅ the only one who can, at scale | never |
| drives the app | never — chromium has no egress there, proved | ✅ the only one who can |
| writes verdicts | ✅ | reviews |
| traces mechanisms | ✅ | ✅ |
| **edits code** | **never** | **✅ alone, serialized** |
| runs the suites, delivers, pushes | never | ✅ |

**Only one machine edits source.** One mechanism usually spans many properties, and two
agents in `app.js` collide. The cloud writes findings; the Mac writes fixes. A finding
that needs a UI change is written down and handed over, never applied.

## What counts as a real bug, in priority order

**1. Storm violations — real today, no ground truth needed.** 34 across the sweep, 30 of
them `save-left-dirt`. These are app defects by construction: the storm recomputes the
truth itself and the app disagreed with it. TRIAGE FIRST — some name `property.name`
against a `ZZ-CORPUS` `db_value`, and that one is now explained (the rename, fixed in
`10ff2fa`). What survives triage is the queue. Every violation carries a seed that
replays it exactly, so every fix gets a test.

**2. `app wrong` rows from the three-way.** The only verdict that indicts the app, and
it needs all three legs. 37 packages now have OURS; the cloud has read 28 properties.
Closing those is the highest-value work available to either of us.

**3. The 52 blocked packages.** 38 generated nothing, 13 generated no document the filed
package also has. Either the app cannot handle a whole class of input — a defect worth
more than any single field — or the manifest carries folders that are not packages. The
answer decides whether this is the biggest finding in the audit or an inventory bug.

**4. Fill-order disagreements.** Same inputs, two orders, two packages. Needs no ground
truth and has been a defect every previous time it appeared.

## What "fixed" means here

Not "diagnosed". A repair is done when **all** of these hold:

- it is fixed by **mechanism**, not by property (one parse bug spanned 7 properties);
- it is supported by **two properties or a code reading** that shows it is general —
  never a single property;
- **blast radius measured before and after**;
- a **regression test named for the properties that exhibit it**, with `MIN_CHECKS`
  raised — never lowered to make a red run green;
- `bash app/full-mp/run_tests.sh` green, `deliver.sh` run, RA anchors built;
- the sweep re-run over the affected properties, and **only what should have moved
  moved**. Anything else that moved is a regression and blocks the fix.

## The loop between us

1. Mac drives → pushes records to `sweep-out/`.
2. Cloud pulls → closes three-way verdicts → traces mechanisms → pushes the ledger.
3. Mac pulls → picks the top mechanism → repairs it → tests → pushes.
4. Mac re-drives the affected properties → confirms the numbers moved the right way.
5. Repeat.

**Push after every wave, not when the wave feels finished.** The desync on 2026-07-31
was one hour of my results sitting uncommitted while the cloud read against a repo that
did not have them.

## Standing rails

- Runs write into Matt's **live** account. The prefix is not a handle — a readable
  schedule renames the record and the prefix vanishes. `drive.js` now records every id
  it creates; cleanup deletes on either net. Verify zero after every batch.
- Never delete a property this driver did not create.
- Never pipe a suite through `| tail`.
- `find` returns nothing on the Drive mount, silently.
- A record saying "generated nothing comparable" is **blocked**, not done.
- Stay out of `app.js` 2720–2867 and `shell.head.html` styling — another lane owns them.
