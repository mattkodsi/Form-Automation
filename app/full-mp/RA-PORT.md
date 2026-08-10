# RA port (the RA integrator / Azure) — the anchor contract

The RA integrator's port (received back 2026-07-16, reference copy in
`_archive/ra-integrator/ra-port-2026-07-16/`, kept out of git) treats this folder's
sources as **pristine** — the RA integrator never edits them. Their `build-ra.py` concatenates
them and applies **assert-guarded, in-memory patches** to swap the backend:

- drops `lib/supabase.min.js` + `config.js` + `db.supabase.js`, adds `db.cosmos.js`
- patches `app.js`/`shell.head.html`: Supabase auth → App Service Easy Auth (Entra),
  `makeSupabaseDb` → `makeCosmosDb`, the HUD SAFMR edge function → `/api/hud-safmr`,
  and wires our `window.RASource` seam to their AUM master registry
  (`aumIndex()`/`aumValue()` on the adapter — read-only; nothing writes back to AUM).

Every patch asserts **exactly one match**, so if a seam string in our sources
moves, their build fails loudly instead of silently shipping a broken port.

## What this means for us (the contract)

**`db.cosmos.js` and `build-ra.py` in this folder are the hand-back copies** —
updated by us whenever our changes move an anchor, and included in every source
drop we send them. They are NOT part of our own build (`build.sh`/`deliver.sh`
ignore them; our app still builds and ships on Supabase, unchanged).

**Post-edit gate** (add to the usual rebuild/NUL/syntax checks): after touching
`app.js` or `shell.head.html`, run

```bash
python3 app/full-mp/build-ra.py /tmp/rcs-ra-check.html
```

It must print `built … bytes`. If an assert fails, an anchor moved — update the
patch in `build-ra.py` to target the new text (keep the replacement's intent),
re-run, and mention it in the commit message so the change travels with the
next handoff.

## Current anchors in app.js / shell.head.html (don't move casually)

1. shell: the `#viewAuth` sign-in card markup (replaced with the RA access panel)
2. `mpdb=await makeSupabaseDb(supaClient);` (adapter swap + `window.RASource` injection)
3. the `supaClient.functions.invoke('hud-safmr'…)` block + its no-client guard
3b. **`ocr.js`** (new, tier-3 scanned rent schedules): the `ocrAnalyze` body — kept
   as one self-contained function marked `// ra-seam: the OCR endpoint` — plus the
   `if(!window.PDFLib||!supaClient)` guard in `ocrParseRs`. Patched to
   `fetch('/api/ocr-rs')`. **Related's side runs Document Intelligence inside its own
   tenancy** (container or managed resource), so a scanned schedule never leaves
   Azure; only the endpoint differs, and every line of the geometry is shared. The
   Azure side must return `{width,height,unit,angle,words:[{s,poly}],marks:[{on,poly}]}`
   for ONE page — see `supabase/functions/ocr-rs/index.ts` for the exact shape and why
   it is one page per call (the F0 tier silently drops all but the first two pages).
4. the `showAuthScreen` function body, the `bSignOut` handler, and the
   `DOMContentLoaded` boot block
(the create dialog needs NO patch anymore — `createProperty(name, pickedId)`
   passes the picked registry id through natively; the Supabase adapter ignores
   the 2nd arg, the RA adapter uses it for read-only AUM prefill)

## What the RASource seam is ASKED for (2026-08-10)

`raVal(k)` → `window.RASource.value(k)` is now consulted for **15 keys**. Two of
them *lock* the cell outright when the seam answers (the renewal calendar and this
app cannot both own one fact); the other thirteen are offered as a **"Related
Affordable" source row** the user may take or leave.

**Locking keys** — a non-null answer makes the cell read-only:

| `k` | Effect of an answer |
|---|---|
| `property.name` | Locks the name cell; the rename control becomes the tenant alias alone |
| `rent_schedule.date_rents_effective` | Locks the effective-date cell; stored as `date_eff_ra`, outranks the executed schedule and any typed date, and sets the package's own effective date |

**Offer keys** — a non-null answer adds a pickable "Related Affordable" source row:
`poc.name`, `poc.email`, `poc.phone`, `ca.name`, `ca.org`, `owner.entity_name`,
`property.addr_street`, `property.addr_city`, `property.addr_state`,
`property.addr_zip`, `tenant.property_alias`, `tenant.community_manager`,
`tenant.regional_cm`.

### What the AUM provider actually answers (the Azure wiring)

`build-ra.py` patch 4 wires `RASource.value(k)` to `mpdb.aumValue(activePid, k)`,
which projects the AUM master registry through `AUM_PREFILL`. It answers **8** of
the 15 keys and returns `null` for the other 7:

| Answered from AUM (8) | AUM record field |
|---|---|
| `property.name` | `property_name` |
| `property.addr_street` | `address` (or `street_address`) |
| `property.addr_city` | `city` |
| `property.addr_state` | `state` |
| `property.addr_zip` | `zip` |
| `owner.entity_name` | `partnership_name` |
| `tenant.property_alias` | `aka_name` (skipped when `"N/A"`) |
| `ca.org` | `section_8_contract_administrator` |

Returns `null`, staying app-owned: `rent_schedule.date_rents_effective`, `poc.name`,
`poc.email`, `poc.phone`, `ca.name`, `tenant.community_manager`, `tenant.regional_cm`.
(`aumFor` matches a property's `ra_property_code` against each AUM record's `RAID`
or `ra_master_id`; `aumIndex()` additionally reads `total_units`.)

**Consequence to know:** `property.name` is in AUM, so the **name locks** on the
Azure port. `rent_schedule.date_rents_effective` is **not** in AUM, so the **date
lock does not fire** there — if Related wants the effective date owned by the
calendar, the AUM projection (or another `RASource`) must return it; today it stays
editable. (On our own Supabase build the provider is `raTrackerSource()`, the HAP
tracker, which answers both name and date.)

Three things worth knowing on the Azure side:

1. **Answer only for properties AUM really covers.** `null` is not a failure — it
   means "this app owns the field", which is exactly right for a property somebody
   created here. The lock is conditional on a non-null answer, so nothing needs a
   flag or a tracker code.
2. **Any date shape is fine.** `mm/dd/yyyy` and ISO both parse; anything else is
   treated as no answer rather than guessed at.
3. **The answer is read when a form OPENS, and frozen into that package.** Changing
   the row afterwards does not move a package already under way — deliberately, and
   the tooltip on the cell says so. A new package picks up the new answer.

Note on escaping: `build-ra.py` is Python — any literal `\uXXXX` text inside our
JS (e.g. in comments) must be written double-backslashed in its anchor strings.

## Divergence status (2026-08-10)

The last full source drop to the RA integrator was the **2026-07-16** copy
(reference in `_archive/ra-integrator/ra-port-2026-07-16/`). Our sources have moved
a long way since — the four-resolver-cell flatten, the provenance overhaul, the
RA-seam POC/CA source rows, the HAP-tracker home page, the privacy scrub, and this
parity pass — so a by-commit "N behind" count is no longer the useful frame. The
handoff is **the current source folder plus the two hand-back copies below**, and
the anchor gate (`python3 build-ra.py /tmp/x.html` printing `built …`) is what
guarantees it assembles against our current `app.js`/`shell.head.html`.

- **`db.cosmos.js`** — brought to **full API parity** with `db.supabase.js` on
  2026-08-10. The whole cycle surface (`listCycles`/`createCycle`/`saveFlatCycle`/
  `pruneCycleCells`/`setCyclePrograms`/`getCycleRs`/`setCycleRs`/`getCycleRcs`/
  `setCycleRcs`/`setCycleGenerated`/`cycleAnalysis`/`cycleScore`/`cycleClosed`/
  `reopenCycle`/`dominantCycleId`), the HAP + identity surface (`hapRows`/`hapError`/
  `getPmName`/`setPmName`/`clearAll`), and the RA-code binding (`setRaCode`/
  `propByRaCode`/`raCodeOfPid`) now match method-for-method, plus the cosmos-only
  `aumIndex`/`aumValue` prefill surface. The registry link is `ra_property_code`
  (legacy `raMasterId` docs are read through a load-time fallback). The client
  POSTs to `/api/rcs/*` REST endpoints; the new server-side needs are a `cycles[]`/
  `hap[]`/`hapError`/`pmName` addition to `GET /api/rcs/bootstrap`, plus
  `POST /api/rcs/cycle`, `/cycle-delete`, `/pm-name`, `/clear-all`, and a cycles
  container (assumed pk `/property_id`).
- **`build-ra.py`** — the assert-guarded patch set + the assembly order
  (`… db.js + db.cosmos.js + app + ocr + gen …`).

**One correction traveling with this drop.** While bringing `db.cosmos.js` to
parity we found `db.supabase.js`'s `cycleClosed` ignored `reopened_at` (so **Reopen
was a no-op** — the form re-locked and a closed-package save then threw a
`ReferenceError` from an undefined `c` in `assertCycleOpen`, instead of a clean
`PACKAGE_CLOSED`). `db.js` and `db.cosmos.js` were already correct; `db.supabase.js`
is now aligned, and `test_db.js` guards all three against the drift recurring.

To send a handoff: run the anchor gate, then send this folder + `db.cosmos.js` +
`build-ra.py`.
