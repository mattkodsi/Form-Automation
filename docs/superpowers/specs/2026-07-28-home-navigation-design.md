# Home page navigation — design

**Date:** 2026-07-28
**Status:** design approved in outline; both open questions resolved 2026-07-28 —
ready to build
**Supersedes:** the property gallery's name/recency sort (`renderMenu`, `app.js:2877`)

---

## Summary for review

The home page stops being a list of what exists and becomes a view of what needs
doing. Properties come from Related Affordable's HAP tracker rather than from the
app's own records; each one shows when its renewal is due, who owns it, and a
single action that either starts this year's package or resumes the draft already
in progress. A portfolio manager opens the app and sees their own work, ordered by
deadline.

## Open questions — both resolved

1. **Is HAP's `Property Code` the same identifier as AUM's `RAID`?**
   `db.cosmos.js:302` projects `RAID || ra_master_id`. **Assume yes and proceed**
   — this was originally flagged as blocking, which was wrong. Because properties
   originate from the tracker, `Property Code` is the app's own primary key and is
   self-consistent; there is no second population to reconcile it against.

   It matters in one place only: AUM prefill. `RASource.value(k)` (`app.js:363`)
   reads owner entity, address and point of contact by AUM id. If the identifiers
   differ, a tracker-created property cannot find its AUM record and those fields
   are typed once instead of arriving pre-filled. Degraded convenience, not a
   wrong package, and the remedy is a mapping call rather than a redesign.
2. ~~What do `Increase Type` values `EXPIRES` and `Request` mean?~~
   **Resolved 2026-07-28 (Matt).** `EXPIRES` means the HAP contract is expiring —
   not a rent adjustment. `Request` is for PBVs, which get neither an RCS nor an
   OCAF. Neither produces a package from this app. See *Which rows are startable*.

---

## What the data actually says

Measured from `hap-tracker-2026-07-28.csv` (2853 rows, exported from Kinley's site).

| Fact | Value |
|---|---|
| Rows / distinct properties | 2853 / 249 (one row per property per renewal year) |
| Year span | 2026 (249 properties) → 2040 (61), thinning as contracts expire |
| `Property Code` integrity | 249 codes ↔ 249 names, exact 1:1, no blanks |
| Portfolio managers | 5 — Claire Beatty 728, Tolga Ayberk 663, Mike McKee 573, Matt Kim 517, Elliot Kohanbash 351 |
| PM stability | No property changes PM across any year |
| `Increase Type` | OCAF 2155 · RCS 410 · EXPIRES 145 · Request 141 · `Expires` 1 · blank 1 |
| Lead time (`Rent Increase` − `Due to HUD`) | median **122 days**, p25 120, p75 122 |
| RCS ordering lead (`Rent Increase` − `Date to Order RCS`) | median **183 days**, present on 485 rows |
| Always-empty columns | `Regional VP`, `Regional CM`, `Last Renewal`, `Next UA Baseline`, `Paperwork Rec`, `Sent to HUD/CA`, `Conf by CA`, `Notes` — 0/2853 |

### Data hazards the implementation must survive

- **19 rows have `Due to HUD` *after* `Rent Increase`.** Mad River Manor is wrong
  systematically, every year 2026–2030. A naive countdown renders negative.
- **19 property+year combinations appear more than once.**
- **One malformed row** — `Woodland Hills`, code 79610 — has fewer fields than the
  header. The parser must skip it, not throw.
- **Codes are strings, not numbers.** One code is `HCV1`. Parsing as integer
  corrupts it.
- **`Expires` vs `EXPIRES`** differ only by case; exact matching drops one row.
- **Status is unknowable from the tracker.** Every workflow column is empty, so the
  app's own cycle state is the only source of progress.

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Visibility | See all, home defaults to **Mine** | Focus by default, coverage on demand, no admin needed for handoff |
| Source of properties | **The HAP tracker** | On push to RA there is no existing property data; every property arrives from the tracker. "New property" survives as a rare escape hatch |
| Assignment | Tracker's `Portfolio Mgr` | Authoritative, 99% populated, stable per property |
| Identity | Each user **picks their name once** from `managers()` | No mapping table, tolerant of spelling drift, changeable later |
| Spine | **The renewal calendar** | The only axis that says what needs doing today |
| Deadline | Tracker's `Due to HUD`; fallback `Rent Increase − 120d` | Tracker supplies it for 99% of rows |
| Layout | **Filter rail**, one view at a time, plus **All properties** | First screen is only what is actionable |
| Integration | **Seam + CSV-backed provider** | Testable in the Supabase build; Cosmos plugs in behind the same interface |

### Rejected

- **Name-matching properties across systems.** Proposed, then withdrawn: it would
  fuse the test record "Beacon Hill" with tracker property 79618, which is Mike
  McKee's. Made moot once properties come from the tracker. No code, no link,
  show "not in tracker."
- **Point-of-contact as the assignment key.** `poc.*` is filled on 2 of 7
  properties and stored as copied strings with the contact id discarded
  (`app.js:258`). The tracker is better on every axis. `poc` keeps its real job:
  printing on the cover letter.
- **A settings screen for the lead time.** The constant fires on ~1% of rows.
  `window.HAP_LEAD_DAYS` (default 120), set in the shell before boot.

---

## Architecture

### The seam

Mirrors `window.RASource` (`app.js:321-337`). Read-only; nothing writes back.
Normalization lives in the provider, so the app never sees `MM/DD/YYYY`.

```js
window.HAPSource = {
  schedule() -> [{
    code,          // "75433" — join key, ALWAYS a string
    name,          // "Southport Mews"
    pm,            // "Matt Kim"
    type,          // "OCAF" | "RCS" | "EXPIRES" | "Request"
    effective,     // "2026-01-01" — Rent Increase, ISO
    due,           // "2025-09-01" — Due to HUD, ISO, or null
    orderRcsBy,    // "2025-07-01" or null
    contractType,  // "Option 1"
    contractExp,   // "2044-12-31"
    ca, units, s8Units,
  }],
  managers() -> ["Claire Beatty", …]   // derived, so a 6th PM needs no code change
}
```

Two providers behind one interface:

- **Azure** — reads the Cosmos container, alongside `aumIndex()`.
- **Supabase** — a `hap_schedule` table loaded by CSV import. Also the offline
  fallback when a live source is unreachable.

### Derivation

Per property code:

1. Rows with `effective >= today` **and a startable type**, earliest wins — the
   current target. See *Which rows are startable*.
2. `deadline = due` when present **and** `due < effective`; else
   `effective − HAP_LEAD_DAYS`. A row failing the sanity check is flagged as a
   tracker discrepancy rather than rendering a negative countdown.
3. `band` = deadline vs today.
4. `program` = `type`, pre-selected when starting a package.

### The primary action

Compares tracker target against local cycles (`listCycles`, `db.supabase.js:420`):

| Local state | Action | Effect |
|---|---|---|
| No package for target year | **Start 2027 OCAF** | `createCycle` pre-dated and pre-programmed from the tracker |
| Draft exists | **Continue 2026 RCS** | `openCycleForm` on that cycle |
| Generated | **View package** / start next | next target from the tracker |
| `type` is EXPIRES / Request | disabled, with reason | open question 2 |

Available in both places: the properties list and the property profile. This
promotes what `cyclesHtml` (`app.js:2966`) already does one level up.

### Which rows are startable

Only `OCAF` and `RCS` produce a package. `EXPIRES` is a contract ending; `Request`
is a PBV, which gets neither an RCS nor an OCAF (Matt, 2026-07-28).

**Filter on `Increase Type`, never on `Contract Type`.** `Request` is mostly PBV
(107 of 141 rows) but the remaining 34 are SPRAC, Section 811 and Option 5 —
keying off the contract type misjudges all of them. Compare case-insensitively:
the export contains both `EXPIRES` and `Expires`.

**Skip the row, not the property.** Bastrop Oak Grove (90030) runs OCAF · OCAF ·
OCAF · EXPIRES 2029 · OCAF 2030 · … · EXPIRES 2034 · OCAF …, marking the end of
each five-year option term while the contract continues. 129 properties mix
startable and non-startable rows. The target is the earliest future *startable*
row, skipping past the others.

**`EXPIRES` is never terminal.** We hope and assume the contract renews (Matt,
2026-07-28). A schedule that runs out at an `EXPIRES` row has reached the
*tracker's horizon*, not the property's end — the app must never render that as
finished, retired, or done. Fox Hill (90063) is the live case: OCAF 04/01/2026,
then EXPIRES 04/01/2027 and nothing after. It stays in the portfolio, awaiting its
next schedule. This is not an edge case waiting to happen: **125 of the 229
in-scope properties end on an `EXPIRES` row** within the current export, so the
opposite assumption would retire over half the portfolio as the calendar advances.

**Scope: the 229 properties that have an OCAF or RCS in any year.** The other 20
never do — pure PBV and expiring-only schedules — and are **excluded entirely**,
not listed with an explanation. This app is for properties with OCAFs and RCSs
(Matt, 2026-07-28). Of the 229, 228 have a future startable row today; Fox Hill is
the one that does not, and it stays.

**Six properties carry concurrent renewal streams.** Luther Towers (90111) has 41
rows and up to three renewals in a single year, each with its own date and
program. "The next renewal" is therefore the next row chronologically, not the
next year — and a property may legitimately have two open packages at once, which
the cycle model already supports.

### Property names must be unique

A new property may not take the name of an existing one.

The check exists today (`existingPropByName`, `app.js:2903`, added 2026-07-24 in
b21a923) and covers both `createProperty` dialog paths — yet the live database
holds **three "Beacon Hill" records and three "Colonial Village"**, created
2026-07-25, 07-27 and 07-28. All three postdate the guard, so something creates
properties without passing through the dialog. The `?selftest=1` hatch is the
prime suspect; this needs proving, not assuming.

The lesson for this design: **a check that lives only in a click handler is not a
constraint.** Uniqueness moves to the data layer —

- `createProperty` in **both** `db.js` and `db.supabase.js` rejects a
  case-insensitive name collision, so every caller is covered including the test
  hatch. Parity per CLAUDE.md: change one, change both.
- A `unique` index on `(owner_id, lower(name))` in Postgres makes it impossible
  regardless of client path. Requires deduplicating the six existing rows first.
- The dialog keeps its friendlier behaviour — open the existing profile rather
  than error — but is now the courtesy, not the enforcement.

Tracker-sourced properties are unique by `code` for free. This matters for the
manual "New property" escape hatch, which survives precisely because someone will
need it.

### Provenance

The tracker's effective date is **a source row like any other** — same dropdown,
same provenance colour, same `_reviewed` grammar, per `FORM-RULES.md`. It never
silently overwrites a cycle's own `effective_date`. A deliberate edit stands, and
disagreement surfaces as a conflict the user resolves.

---

## The page

Filter rail, one view at a time, opening on what is actionable.

**Rail:** Needs you · Coming up · In flight · Done for the year · Undated ·
**All properties** — then a Programs group (RCS years, OCAF years).

**Header:** `Mine | All` segmented control, search, `+ New property`, and the
signed-in user's name (new — the app currently never shows who is signed in).

**Card:** name, city/state, units, program chip, completion ring, deadline line
("Due Aug 3 · 6 days left" / "Was due Jun 3 · 55 days late"), and the primary
action.

---

## Failure modes

| Condition | Behaviour |
|---|---|
| Tracker unreachable | Fall back to last import; banner naming the date; app stays usable |
| Property not in tracker | Listed under "Not in tracker", no deadline, manual package start |
| `due` after `effective` | Computed fallback + discrepancy marker; never a negative countdown |
| Duplicate property+year | Earliest `due` wins; discrepancy marker |
| Ragged CSV row | Skipped, counted, reported in the import summary |
| Duplicate property name on create | Rejected at the data layer, not just the dialog |
| No name chosen yet | Prompted on first load; "All" until chosen |
| `Increase Type` is EXPIRES / Request | Row skipped when picking the target |
| Unknown `Increase Type` (new value) | Displayed verbatim, action disabled with a reason — never silently dropped |
| Property never has an OCAF or RCS | Excluded from the app entirely (20 of 249 today) |
| Schedule runs out at an EXPIRES row | Property stays, awaiting its next schedule. Never rendered as finished (125 of 229 today) |

---

## Testing

Extends the existing suites; each raises its own `MIN_CHECKS`.

- **`test_hap.js` (new)** — parser and derivation against the real CSV, held to the
  corpus the way `test_rcs.js` holds the study reader. Named cases, each a real
  property in the export, so a regression names itself:
  - **Mad River Manor** — `due` after `effective`; must never render a negative countdown
  - **Woodland Hills (79610)** — ragged row; skipped and counted, not thrown
  - **`HCV1`** — a non-numeric property code survives round-tripping as a string
  - **Bastrop Oak Grove (90030)** — intermediate `EXPIRES` skipped, OCAF 2030 found
  - **Fox Hill (90063)** — schedule ends at `EXPIRES`; property stays, is not finished
  - **Luther Towers (90111)** — three renewals in one year, each its own target
  - **Southeast Towers (75494)** — never startable; excluded entirely
  - **case-variant `Expires`** — matched, not dropped
  - counts hold: 249 total, 229 in scope, 228 with a future startable row
- **`test_db.js`** — `hap_schedule` storage, the code join, target selection.
  Parity between `db.js` and `db.supabase.js` per CLAUDE.md.
- **`smoke_combined.js`** — menu renders bands from a fixture; counts per band.
- **`test_browser.js`** — the rail, the Mine/All toggle, and the primary action
  driven with real key and click events through `?selftest=1`.

Gates unchanged: byte-for-byte rebuild, 0 NUL bytes, `node --check`, and
`build-ra.py` anchors intact.

---

## Scope

This is not a small change. It adds an external dependency, an identity concept,
and a rewrite of the main screen. It should be built in this order, each step
shippable:

1. The seam + CSV import + `test_hap.js` — no UI change, provable in isolation.
2. Identity ("who are you") + the Mine/All lens over the existing grid.
3. The rail, bands, and deadline rendering.
4. The primary action promoted onto the list.

Step 1 is worth doing regardless, and it is where the two open questions get
settled.
