# STATE — the one file that says where this lane actually is

**Whoever changes something updates this in the same commit.** It is the only file that
claims to be current; every other doc in the lane is either standing rules
(`rcs-audit-run.md`, `rcs-audit-plan.md`), method (`rcs-audit-method.md`), or accumulated
findings (`AUDIT-LEDGER.md`). If this file disagrees with them, this file is right and
the other one needs fixing.

Last updated: **2026-07-31**, by the cloud — the sweep is running from the container.

## Merged with main (7dff1bf) — 13 of 14 suites green

`origin/main` folded in, including the provenance-badge change (`2f8b4b7`) this audit
measures. All fourteen suites run: 13 green, `test_browser` red on the **same 5
`shell.head.html` layout checks** as before — the merge added 11 browser checks (all pass)
and zero new failures. Those 5 are the redesign lane's, unchanged. Per Matt's call the
branch carries main's commits re-authored to noreply@anthropic.com (attribution waived).

## THE SWEEP IS LIVE FROM THE CONTAINER

Wave 1 driven from the cloud through the relay, storm on, both orders, cleaned up by
cycle (account 234 -> 234). Three-ways closed: Peterson 2025, Hampshire 2024, Colonial
Village 2026 all **clean on the money** (Colonial off by a $1 UA rounding; the rest 0
money diffs). The big raw difference counts are H9 harness noise. M18 confirmed corrected
by the driven record (Peterson 189 units, Senior blank flagged, 0 money diffs). Prior-year
cycles are provisional; Hampshire 2019 BLOCKED (nothing comparable).

Account baseline is **234** (Mac's trim note said 236; cleanup verifies count-unchanged,
so drives are safe either way). Token self-refreshes under 5 min left; forced to 60 to
unblock the sweep. Only Matt can mint a fresh one if the refresh token ever rotates out.

## The selector blocker is FIXED — and it was not the selector

`52b7b96`. `inScope` / `targetFor` / `actionFor` were correct; they were handed a third of
the tracker. `hap_schedule` holds 4,273 rows and `client.from('hap_schedule').select('*')`
returned **1,000** — PostgREST answers an unbounded select with its own page size and says
so only in a `206` and a `Content-Range` nobody read. Nothing threw.

Colonial Village proves it: 75708 has **20 rows** in that table and **3** inside the first
1,000, so every 2026-and-later row sat past the cut. Brewster Mews' eight-years-late row is
the same fault from the other end — not a walk stepping over rows, a walk that never
received them. `selectAll()` now pages every table, not just the one that broke.

**But it is in source and NOT in `index.html`** — see the delivery blocker below.

## Delivery is NOT blocking the sweep — the rig drives source

The Mac confirmed `corpus/drive.js:200` builds `build.sh` into a pid-scoped temp file and
serves that, so **the rig drives SOURCE, not `index.html`**. Measured: `selectAll` appears
10 times in `db.supabase.js` and 0 times in the shipped bundle. My earlier claim that a
driving rig would still see 1,000 rows was wrong.

`deliver.sh` still aborts, so the shipped `index.html` is stale and anything Matt opens by
double-clicking is behind. That matters for Matt, not for the sweep.

## The stale shipped bundle

**`deliver.sh` aborts, so no repair can reach the shipped bundle.** `test_browser.js` is red
on **five layout checks** in `shell.head.html` — horizontal overflow at 1200/1280px, a
sticky element scrolled off, the page pinned left at 1680/2560px. The lane's own rails
assign `shell.head.html` styling to the **redesign lane**, so this lane cannot fix them.

Owner: **redesign lane / Matt**. Consequence: the paging fix, and every repair after it,
exists in source only — fine for the sweep, stale for anyone opening `index.html`.

## Chromium here CAN reach Supabase, through a loopback relay

Five probes green from inside chromium against the live account — auth health, anon REST,
authenticated REST, a property read, and `auth/v1/user`. Filed at
`docs/lanes/inbox/2026-07-31-cloud-to-mac-relay-works.md`.

**Now proved:** the real bundle boots signed in as Matt through the relay — 14 Supabase
requests all 200 (`auth/v1/user`, all nine tables, three paged `hap_schedule` calls), **249
properties, 4,273 tracker rows, zero JS errors**, `renderMenu()` at 174 ms. Implemented as a
fetch shim behind `--relay-supabase`, so `SUPABASE_URL` and the derived storage key are
unchanged and only the transport moves.

**The WRITE path is now proved.** 75708 drove end to end through the relay on 2026-07-31:
cycle created, both fill orders, one upload each, five files each, reload re-find, cleanup.
Token refresh survived write load. Account verified independently afterwards — **249
properties, 0 cycles, 0 outstanding ledger entries**.

**The package took `2026-10-01` from the tracker** — the one thing neither machine had
confirmed end to end, and the whole reason the tracker was reloaded.

The Mac's argument against the move — that nothing then independently checks the container —
was overruled by Matt, not answered. It is still true, and the mitigation is that the Mac
drives on request as a second opinion.

Chromium still cannot reach Supabase *directly* — reconfirmed on the correct proxy port
(35069; an earlier probe hardcoded 34565, so that negative was worthless) and against a
neutral host, with zero proxy-side failures logged.

## Where each leg stands

| leg | state |
|---|---|
| SHOULD (sources read by eye) | 28 of 42 properties, cloud, ongoing |
| OURS (app-generated packages) | 37 packages driven, **all provisional** — driven before the date lock, so anything year-derived in a prior-year record is untrustworthy |
| FILED (what the team submitted) | read alongside SHOULD |
| three-way verdicts closed | **every package that has both a sweep record and a SHOULD.** 7 substantive, 3 BLOCKED, 6 closed on the H9 harness classes, 4 adjudicated by focused readers |
| repairs shipped | **one: the paging fix (`52b7b96`), in source only.** Findings are not fixes, and source is not shipped. |

Of the 304 rows where both legs carried a value and differed, **120 are unit-type label
formatting and 18 are checklist whitespace** — 46% of the adjudicable set is normalisation
noise, and only **76 rows are money**. Any headline built on the run's 2,156 differing
values overstates it roughly fourfold.

**39 of the 52 blocked packages are real filed packages the app produced nothing comparable
for** — 8 cycles carry no filed documents at all, 1 has no manifest cycle, and 4 are a
duplicate-folder collision (H10). That, with the 39 of 89 that generated nothing, makes M7
the dominant finding of the sweep: the app does not build a package.

**M18 REPAIRED — and it was not what I recorded.** I wrote that the app dropped a unit row
*silently*. It does not: `rcsUnplaced()` has caught these since the reader was written and
`rcsChecks()` warns *"The study prices a unit type we could not read"*. What was missing is
that **nothing acted on it** — `chk()` renders a coloured line and there is no blocking
severity, so the app noticed the schedule would be short and generated it anyway.

Verified by running the real parser over both studies rather than reasoning about them:

| property | lines parsed | unplaced |
|---|---|---|
| Peterson Plaza | 5 | `type="Senior"`, no bedroom count, **1 unit at $2,700**, priced |
| Oaks on North Plaza | 6 | **none — all six parse cleanly**, totalling 62 units |

So Peterson is 100+30+1+42+16 = **189**, the app writes **188**. And **Oaks has no parser
defect at all** — my earlier "75 against 62" came from a reader's reconstruction, not from a
driven record, and the parser evidence contradicts it. Treat that half of M18 as withdrawn
until a driven record shows otherwise.

**The fix:** an unplaced *priced* line is now a **blocker** in `score.js`, not a caveat —
"blockers stop a document being written; caveats do not" is that file's own rule, and this
one has to stop it. Only when priced: an unplaced line with no money tells us nothing and
must not hold a package hostage. `scoreCtx()` supplies the count; the data layers pass no
upload so no blocker fires on a menu card, which is correct.

`test_db.js` 200 → 205, negative-controlled two ways (blocker removed, and demoted to a
caveat). Suites green: db 205 · interactions 144 · smoke 222 · gen 131 · rcs 444 · hap 189 ·
safety 34 · compare 91 · extract 120.

**Still to do:** re-drive Peterson Plaza to confirm the blocker fires on a real package.

## The environment, as of now

- Account: **236 real portfolio properties**, 0 cycles, 0 scratch records. Rebuilt from
  the HAP tracker 2026-07-31 with Matt's blessing; what it replaced is snapshotted at
  `docs/superpowers/plans/account-snapshot-before-reset.json`.
- Tracker: **4,273 rows**, rent-increase years **2014–2046**, loaded into `hap_schedule`.
  Write policies were added for the import and dropped again — reads 200, writes 403.
- **43 of the corpus's 66 property-years are drivable.** The other 23 are pre-2020 years
  the export does not reach, plus Sycamore Green, which the tracker never lists.
- Driver: finds the property by `ra_property_code`, creates none, records and deletes
  **cycles**. Verified on 75708 — account unchanged at 236/0/0.
- Not built: the **two-pass** drive (prior cycle → save → current cycle), which is the
  only way to reach the on-file and overridden provenance states.

## Who does what

**Matt moved the driving leg to the cloud on 2026-07-31**, overruling the Mac's argument for
keeping the split. `.claude/settings.json` carries the permission grant and travels with the
repo.

**Cloud** now does all of it: reads sources, writes verdicts, traces mechanisms, edits
source, builds, tests, delivers, **and drives the real signed-in app**. **Mac** reviews,
reads, argues with findings, and drives only on request as a second opinion.

**THE SESSION TOKEN IS SINGLE-USE AND SHARED.** Supabase rotates the refresh token on every
use, so whoever spends it holds the session and the other machine's copy is dead. It killed
this lane twice in one day. The cloud holds it; the Mac asks in the inbox before driving
anything. `signin.js` needs a typed password, so **only Matt can mint a new one** — a
container restart locks the cloud out until he is awake.

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
