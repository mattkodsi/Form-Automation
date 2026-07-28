# Session handoff — 2026-07-28 (home navigation)

The home page stopped being a list of what the app has records for and became a
view of what needs doing. Nine commits, `0525d57` → `0212cbf`, on `main`, plus a
new suite. **1042 checks across seven suites**, green: 168 · 144 · 86 · 33 · 245 ·
124 · 242 (test_db, test_interactions, smoke_combined, test_gen, test_rcs,
**test_hap**, test_browser).

Design: `docs/superpowers/specs/2026-07-28-home-navigation-design.md`. Read that
before changing anything here; this file is what happened, that one is why.

## What the page is now

Properties come from Related Affordable's HAP tracker rather than from the app's
own records. The tracker is the catalogue — 249 properties, one row per renewal
year out to 2040, each carrying a due date, a program and the portfolio manager
who owns it. The app's records are the *work*, brought into existence the first
time somebody opens a property and joined back by the tracker's property code.

That is the shape the RA deployment has, where no property data exists until the
schedule supplies it. Both deployments now run it.

You pick which manager you are, once, from the names the schedule itself
contains — so there is no mapping table to drift. **Mine** is a lens, not a
permission; **All** is one click.

## What was measured, so nobody re-derives it

All from `_archive/hap-fixtures/hap-tracker-2026-07-28.csv`, 2853 rows, parsed.

| | |
|---|---|
| Properties | 249, codes ↔ names exactly 1:1, no blanks |
| In scope (an OCAF or RCS in some year) | **229**. The other 20 are PBV or expiring-only and are **absent**, not listed with an explanation |
| With a future startable row today | 228. Fox Hill (90063) is the one that is not, and it stays |
| Managers | 5 — Claire Beatty, Tolga Ayberk, Mike McKee, Matt Kim, Elliot Kohanbash. A property never changes manager |
| `Increase Type` | OCAF 2155 · RCS 410 · EXPIRES 145 · Request 141 (+ one `Expires`, differing only in case) |
| Lead time `Due to HUD` → `Rent Increase` | median **122 days** — where the 120-day fallback comes from. The tracker supplies the real date for 99% of rows |
| `Date to Order RCS` | ~183 days ahead. An RCS year needs the appraiser two months before the package is due |
| Always empty | `Regional VP`, `Regional CM`, `Last Renewal`, `Next UA Baseline`, `Paperwork Rec`, `Sent to HUD/CA`, `Conf by CA`, `Notes` |

**The tracker never knows progress.** Every workflow column is empty, so the app's
own cycle state is the only source of how far along anything is.

**`EXPIRES` is never terminal.** It marks the end of an option term and the
assumption is the contract renews. 125 of the 229 in-scope properties end on one
inside this export, so reading it as an ending would retire over half the
portfolio as the calendar advances. Bastrop Oak Grove (90030) runs OCAF · OCAF ·
OCAF · EXPIRES 2029 · OCAF 2030 — the target is the earliest future *startable*
row, stepping over the others.

## What is built

**Step 1 — the seam (`app/full-mp/hap.js`, `20e42c3`).** Read-only, mirrors
`window.RASource`. The contract is the smallest one available — hand us rows —
because the integration happens on Michael Kinley's machine against a container
nobody here has seen, and any shape agreed today is one he has to hit blind. So
columns are matched by meaning rather than spelling, dates are taken in six
formats, and rows arrive as an array, an object, a function, a promise or CSV
text. **`diagnose()` is the integration**: when a live source returns nothing it
says whether the container was empty, the columns were named differently, or the
dates did not parse, quoting the keys it was actually given.

**Step 2 — identity and the lens (`c244b2f`).** Supabase gains `hap_schedule`
(the tracker mirrored, columns kept as text so the tolerant reader is exercised
identically in both deployments; read-only to clients, not owner-scoped, because
the schedule is shared), `app_user` (owner-scoped, holds your chosen name), and
`property.ra_property_code` (the join). `createProperty(name, raMasterId)` now
carries the code in all three adapters.

**`test_hap.js`, 124 checks**, held to the real export rather than an invented
fixture, because the things that break this are things nobody would think to
invent. Every case carries a property's name: Mad River Manor's due date that
falls after the increase it precedes, Woodland Hills' row short of fields, the
code `HCV1` which is not a number, Bastrop's mid-schedule EXPIRES, Fox Hill's
schedule that stops, Luther Towers' three renewals in one year.

## What is not built

Steps 3 and 4 of the spec. **These are the delegable units.**

**Step 3 — the rail and the bands.** The design chose a left rail of named views
(Needs you · Coming up · In flight · Done for the year · Undated · **All
properties**, then a Programs group) showing one at a time, so the first screen is
only what is actionable. Today the page is still a flat grid with a Mine/All
segment; the deadline line and program pill are already on the cards, and
`RCSHap.bandOf()` already returns `overdue` / `now` / `soon` / `later` /
`undated`. So this is presentation, not derivation.

**Step 4 — the primary action.** One button per card: **Start 2027 OCAF** when no
package exists for the target year, **Continue 2026 RCS** when a draft does. The
comparison is `RCSHap.targetFor()` against `listCycles()`. `openHapProperty()`
already materialises the record on first open; this promotes what `cyclesHtml()`
does one level up onto the list. The same action belongs on the property profile.

**Also open:** the tracker's effective date should become a *source row* — same
dropdown, same provenance colour, same `_reviewed` grammar as everything else per
FORM-RULES — rather than silently overwriting a cycle's own `effective_date`. Not
started.

## Hazards

**`index.html` is a 2.4 MB generated file that is committed, and it collided three
times in one hour.** Any two sessions that both run `deliver.sh` conflict on it,
every time. It is a build artifact, so the resolution is always the same — rebase,
then rebuild from the merged sources, never pick a side — but the collision is
structural and will keep happening. **Generating it at deploy instead of
committing it would remove the whole class.** GitHub Pages serves it from `main`,
so that needs a real decision. This is the single highest-value cleanup available.

**The repo is public and holds the whole portfolio.** `hap-tracker-2026-07-28.csv`
carries 249 properties with contract numbers, PM assignments and expirations;
`_archive/` carries executed rent schedules and full RCS packages. Matt chose this
deliberately on 2026-07-28. **Do not change repo visibility** — it was flipped to
private that day and Pages, which requires GitHub Pro on a private repo, was
*deleted* rather than paused, taking `packageautomation.run.place` down for twenty
minutes with nothing announcing it. Recreating it worked and the CNAME and
certificate survived:

    gh api repos/mattkodsi/Form-Automation/pages -X POST -f "source[branch]=main" -f "source[path]=/"

**Green suites did not see the new page.** 1041 checks passed while the count line
called an unassigned record one of yours and the heading separating tracker
properties from uncoded ones had a style and no markup. Both were found by driving
the real bundle through `?selftest=1` and reading the DOM. Anything that renders
needs looking at, not testing at.

**Two questions were left for Kinley and one resolved itself.** Whether HAP's
`Property Code` is AUM's `RAID` was originally called blocking; it is not, because
properties originate from the tracker, so the code is the app's own key and
answers only to itself. It decides one thing — whether AUM prefill finds its
record, or whether a few fields get typed once. The parameter is named
`raMasterId` in all three adapters on that assumption.

## Where the truth lives

- **Why**: `docs/superpowers/specs/2026-07-28-home-navigation-design.md`
- **The reader**: `app/full-mp/hap.js` — its header explains why it is so forgiving
- **The corpus**: `_archive/hap-fixtures/hap-tracker-2026-07-28.csv`
- **The rules that bind**: `app/full-mp/FORM-RULES.md`, and CLAUDE.md's three hard rules
