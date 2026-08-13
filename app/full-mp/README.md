# rcs-src — RCS Renewal Packages (source + RA/Azure build)

Sources for `/rcs.html`. Every `*.js`/`*.html` file **except `db.cosmos.js` and
`build-ra.py`** is pristine app source shared with our own Supabase build — do not
hand-edit it. The RA-specific backend swap is applied at build time.

## This is the RCS-only release

This build offers **RCS renewals only** — OCAF and UAF are turned off. `build-ra.py`
narrows one flag (`ENABLED_PROGRAMS` → `['rcs']`), which the app reads in four places:

- the home page **hides OCAF-year properties** until they reach an RCS year;
- **"Start a package"** offers only RCS (no OCAF card, no UAF checkbox);
- the form-header **OCAF and UAF pills are greyed** and unclickable;
- `createCycle` refuses a non-RCS program even if one slips through the UI.

To give this port OCAF/UAF later, delete the single `programs: RCS-only` patch in
`build-ra.py` — nothing else changes. (Our own Supabase build keeps all three programs;
the flag defaults to `['rcs','ocaf','uaf']`, and `build-ra.py` is the only thing that
narrows it.)

## Build

```bash
python3 build-ra.py ../rcs.html   # asserts the seam patches + no-Supabase/no-secret guards; prints "built …"
```

`build-ra.py`'s asserts are the build gate. If one fails, an anchor string moved in
`app.js`/`shell.head.html` — update that patch (keep the replacement's intent); `RA-PORT.md`
lists the anchors and documents the RASource seam in full. (The app's own test suites are
internal and not part of this drop.)

## The two files you maintain against your backend

- **`db.cosmos.js`** — the Cosmos adapter (replaces `db.supabase.js`; the client POSTs
  to `/api/rcs/*`). **Its header comment is the server contract** — containers,
  partition keys, every endpoint, and the `bootstrap` payload shape.
- **`build-ra.py`** — the concat build + assert-guarded `app.js` patches: adapter swap,
  Entra (Easy Auth) gate, `/api/hud-safmr`, `/api/ocr-rs`, and `RASource → AUM`.

## What changed since the 2026-07-16 drop

- **`db.cosmos.js` is now at full API parity with the live adapter** (28 → 53 methods):
  the whole package/cycle surface (`listCycles`/`createCycle`/`saveFlatCycle`/
  `setCyclePrograms`/`reopenCycle`/`cycleAnalysis`/…), HAP + identity (`hapRows`/
  `getPmName`/`setPmName`/`clearAll`), and RA-code binding (`setRaCode`/`propByRaCode`/
  `raCodeOfPid`). The only two extra methods are the Cosmos-only `aumIndex`/`aumValue`.
- **New server-side needs:**
  - `GET /api/rcs/bootstrap` must now **also** return `cycles[]`, `hap[]`, `hapError`, `pmName`.
  - New endpoints: `POST /api/rcs/cycle`, `/cycle-delete`, `/pm-name`, `/clear-all`.
  - A **new cycles container** (one document per package; the client assumes pk
    `/property_id` — confirm on your side).
- **Registry link is `ra_property_code`** (older docs written with `raMasterId` are still
  read through a load-time fallback, so no backfill is required to boot).

## One product decision to make

The `RASource` seam is consulted for 15 cells; the AUM projection answers 8 (the table
is in `RA-PORT.md`). `property.name` is in AUM, so **the name cell locks**.
`rent_schedule.date_rents_effective` is **not** in AUM, so **the effective-date cell
stays editable** on the Azure port. If Related wants the renewal calendar to own that
date, `aumValue` (or another `RASource`) must return it.

## Don't

Never open `templates.js` or `lib/pdf-lib.min.js` in a context-limited editor — grep them.
