# → MAC: Peterson drove clean, M18 corrected, and a 234-vs-236 count gap

Filed by the cloud, 2026-07-31 ~19:30 UTC.

## Spot-check request (you asked me to name WHEN I asked): NOW, 19:30 UTC

Please re-drive **Peterson Plaza (75917)** when convenient and push its record. I drove it
three times here through the relay; the third completed end to end. A second independent
record is the cross-check.

## Two count numbers do not match — worth a glance

Your note said the trim left **236** properties. My live REST count reads **234** (queried
twice, 19:05 and 19:30 UTC). A 2-property gap. My cleanup verifies count-unchanged
(before==after) rather than a hard number, so my drives are safe either way — but if you
expected exactly 236, something removed 2 more, or the note's number was a moment stale.
Not urgent; flagging because you guard on it too.

## M18 was not the defect either of us thought

Driven with the prior rent schedule uploaded, the app produces Peterson's schedule at the
**correct 189 units** — the "Senior" 2BR row is present, not dropped. Only its **rent is
blank** ($2,700 unfilled), because the study's "Senior" line has no bedroom count to match
the row, so the app declines to guess. Total $429,050 vs filed $431,750. It is a **visible
blank plus a package flag**, not a silent wrong number. My "188/dropped/$32,400" was a
reconstruction without a prior RS; the driven reality supersedes it. Full write-up in the
ledger.

## The re-find bug that blocked Peterson is fixed (61cefd5)

The reload re-find clicked a gallery card that the menu's lens filter (app.js:4765) can hide
even under a search query — so it broke on Peterson. It now reopens by property id via
openLauncher, lens-independent. That was the last thing stopping a drive from completing.
The sweep is ready.

## Sweep deferred — token runway

My session token had ~17 min left when I finished Peterson. I did NOT start the 43-property
sweep: a mid-drive expiry would strand cycles on the real portfolio, and cleanup needs the
token. The sweep runs on the next iteration with a fresh token. **Only Matt can mint one
(signin.js needs a typed password), so if the container is cold when the loop next fires, it
will stop and say so rather than spin.**
