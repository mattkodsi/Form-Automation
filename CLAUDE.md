# Automation Project — session guide

RCS (Rent Comparability Study) 5th-year renewal-package automation for HUD
Section 8 (Related Affordable). A form-driven tool that pre-fills from stored +
uploaded data, clears an internal 150%-SAFMR check, and generates the six-document
renewal package as review-ready drafts. See `RCS Renewal Automation - Project Plan.md`.

> **Latest handoff:** `SESSION-HANDOFF-2026-07-27.md` — the `?selftest=1` hatch (drive the
> real form in a browser, no sign-in), what shipped, and the interaction audit that is
> the next task. Older: `SESSION-HANDOFF-2026-07-14.md` — the Supabase backend migration
> (data layer moved off localStorage), what's live, and a resume-here block. NOTE: the
> storage/offline/deliver sections below predate that migration and need refreshing.

## The product is the single-file app — built from source

`index.html` (project root, ~1.6 MB) is
**the deliverable** Matt double-clicks — a complete standalone browser app.

It is **built, not hand-written.** `app/full-mp/build.sh` concatenates the modular
source — `shell.head.html` + `lib/pdf-lib.min.js` + `core.js` + `db.js` + `app.js`
+ `gen.js` + `templates.js` + `shell.tail.html` — into that one HTML. So:

- the **HTML is the bundle** (what runs in the browser);
- **`app/full-mp/` is the editable source** of that bundle.

Verified 2026-07-13: building from `app/full-mp/` reproduces the shipped `index.html`
**byte-for-byte**. Edit the small source files and rebuild — never hand-edit the
big HTML (that's how `templates.js` silently drifted from the app before).

## ⚠️ Three hard rules (all caused real problems)

**1. Never open these with `Read` — it can crash the session.**
They exceed a standard context window. Inspect with the shell instead.

| File | ~Tokens | What it is |
|------|--------:|------------|
| `index.html` | ~411,000 | The shipped app (bundle) |
| `app/full-mp/templates.js` | ~237,000 | base64 PDF-template blobs |
| `app/full-mp/lib/pdf-lib.min.js` | ~131,000 | Vendored minified library |

- Search: `grep -n "PATTERN" FILE`  ·  Peek: `head -c 500 FILE`  ·  Slice: `sed -n '1,40p' FILE`

**2. Change the app via the source, then rebuild — don't hand-edit the HTML.**
Edit `core.js` / `db.js` / `app.js` / `gen.js` (small, safe to read — but edit them
in the sandbox, per rule 3). Hand-editing the 411k-token HTML is crash-prone and
silently drifts the source out of sync.

**3. Don't host-edit source files — edit in the sandbox, then copy in.**
Host `Write`/`Edit` on this mounted folder can **truncate a file mid-write** or append
stray NUL bytes. It bit the *small* JS files too: on 2026-07-13 a batch of host `Edit`s
left `db.js` with trailing NULs and truncated the tail of `app.js`. So edit **every**
source file (`core/db/app/gen.js`, `shell.head.html`) in the sandbox: read → transform →
write to `/tmp` → `cp` into the folder → verify with `cmp` + `node --check`. Recover a
corrupted file by extracting the clean original from the shipped HTML (the build is a plain
concatenation) and re-splicing. Matt does visual QA in the browser (he can't run Node locally yet).

## Understanding the app — the code map (read these, NOT the bundle)

To learn the full feature set, read the **source** in `app/full-mp/` — ~43k tokens
total, the complete app and far more legible than the built bundle. **Do not** open the
built HTML (~411k tok), `templates.js` (base64 blobs), or `lib/pdf-lib.min.js`
(third-party) — they hold nothing to "understand" and will blow up context. Reading the
five files below gives the whole picture; read them in this order:

> ⚠️ **Touching a form cell, a dropdown or a click handler? Read
> `app/full-mp/FORM-RULES.md` first.** Eighteen rules, each one written because breaking
> it shipped a bug: how a source names itself, when a cell may paint which colour, what
> every mutating handler owes `_pending` and the undo run, and the delivery gates. It is
> the checklist that replaces re-finding these faults by clicking.

1. **`shell.head.html`** (~9k tok) — HTML skeleton + **all CSS**, and the four views:
   `#viewMenu` (property gallery), `#viewLauncher` (property summary + program picker +
   letterhead), `#viewContacts` (PM contacts), `#viewForm` (the RCS form: command-center
   bar, program pills RCS/OCAF/UAF/BBRA, section rail, the 9 sections, "Update database" /
   "Generate package" footer).
2. **`app.js`** (~22k tok) — the whole form UI + logic. The top of the file defines the
   shape: `FIELD_SECTIONS` + `SECTION_TITLES` (the 9 sections), `ADDR`/`CA_ADDR`/`MGMT_ADDR`
   (composite addresses), `PARTB` (equipment/utilities/services), `CHECKLIST_FLAT` (17
   owner's-checklist items), `CLR` (provenance colors). Below that: renderers + behavior
   (see the index). The `NAVIGATION` banner (~line 338) begins menu → launcher → form →
   exit → client-side generation → boot.
3. **`core.js`** (~0.6k tok) — the keyed-cell **store** (`makeStore(adapter, FIELDS)`): six ops on
   cells through an async storage adapter — `emptyForm`, `fillForm`, `editForm`, `revertForm`,
   `saveField`, `saveToDb`. Each cell is `{value, source, saved_at, prior_value, prior_source,
   db_value}`; `editForm` derives `source` (database / overridden / new) by comparing the new value to
   the saved `db_value`, and `saveField` records `db_value` so clears/unchecks persist and later edits
   correctly read as overrides. **Save/revert semantics live here** (see `coupledKeys` in `app.js` for
   value↔source pairing).
4. **`db.js`** (~5k tok) — the multi-property **data layer** (`makeDb(adapter)`). One CURRENT record per
   property, split into a **durable** bucket (unit mix, Part B, addresses…) and a **per-cycle** bucket
   (rents, SAFMR, appraiser…); `isPerCycleKey` routes each flat key and `CROSSWALK` maps flat keys → the
   v7 dictionary. Key funcs: `getFlat`/`saveFlat`, `loadForm`/`saveForm`, `listProperties` /
   `createProperty`/`renameProperty`/`deleteProperty`, `getActive`/`setActive`, `getLetterhead` /
   `setLetterhead`, contacts (`listContacts`/`addContact`/`updateContact`/`deleteContact`),
   `propertyAnalysis`, `pruneUnitRows`, `computeAnalysis`, `computeSalutation`, `migrate`, and
   `localAdapter` (browser localStorage). Its exports also drive `test_db.js`. **The app itself runs on
   `db.supabase.js` (`makeSupabaseDb`) — `db.js` is now the test harness's stand-in, reached via app.js's
   `__localDb()`.** It is held to API PARITY with `db.supabase.js` (cycles: `listCycles`/`createCycle`/
   `saveFlatCycle`/…; directory: `listDir`/`addDir`/…), because a stand-in that answers differently from
   the real backend makes every test that uses it a fiction. Change one, change both.
5. **`gen.js`** (~5k tok) — client-side **PDF generation** (`window.RCSGen`), pure record→bytes via
   `window.PDFLib` (pdf-lib): `coverLetter`, `ownerLetter`, `fillChecklist`, `fillRentSchedule`,
   `tenantNotice` (+ `resolve`, `nmv` number-clean, `_toISO` date-normalize). Fills AcroForm fields on the
   base64 templates in `templates.js`. **The remaining "package generation" work lives here.**

## Build & deliver — always outputs `index.html`

- Rebuild + ship in one step: **`bash app/full-mp/deliver.sh`** — syntax-checks every JS the build
  concatenates, runs **all** test suites via `run_tests.sh`, builds in the sandbox, copies to the
  project-root **`index.html`**, then `cmp`-verifies the copy landed intact (guards the mounted-folder
  truncation gotcha). A failing suite aborts before anything is written.
- **Every build/iteration produces the single deliverable `index.html` at the project root** — the file
  Matt double-clicks. `build.sh` alone writes the same `index.html` (pass a path arg to build elsewhere).
  Renamed 2026-07-13 from `RCS Renewal — Multi-property (open in browser).html`.
- Post-edit sanity gates: source **rebuilds byte-for-byte** to `index.html`, **0 NUL bytes** in every
  source file, `node --check` clean, and both test suites below pass.
- **RA-port anchor gate** (after any `app.js`/`shell.head.html` edit): `python3 app/full-mp/build-ra.py
  /tmp/rcs-ra-check.html` must print `built …`. Kinley's Azure port patches our pristine sources at
  build time via assert-guarded anchor strings — see `app/full-mp/RA-PORT.md`. If it fails, an anchor
  moved: update it in `build-ra.py` (that file ships to Kinley with every handoff).

## Tests

Run them all with **`bash app/full-mp/run_tests.sh`** — one command, one exit code, and the only place
a new suite needs registering (`deliver.sh` calls it).

- **`app/full-mp/test_db.js`** — data layer incl. the cycle + directory surface (which cycle is
  dominant, what carries into a new one, what writes back to the template); 93 checks.
- **`app/full-mp/test_interactions.js`** — save/revert/group + esc/enter decision logic against the real
  store, incl. the unit designation chip; 82 checks (self-contained; builds its own bundle).
- **`app/full-mp/smoke_combined.js`** — headless render smoke of the assembled app: menu → launcher →
  form, the 150% analysis numbers, and dirty-tracking; 39 checks. The launcher phase covers the
  first-run migration that turns an existing record into package #1.
- **`app/full-mp/test_browser.js`** — **the only suite that presses keys.** Builds its own bundle,
  drives it in a real headless chromium through `?selftest=1`, and dispatches real trusted key
  events over CDP (zero dependencies — node's own WebSocket). It covers the hole the other suites
  cannot see: they prove `save()` saves, this proves a keystroke *reaches* it. 45 checks — Enter and
  Escape on every kind of cell, the source dropdowns, the conflict buttons, the session boundary.
  `--full` drives all ~110 controls instead of one per kind. Skips **loudly** (never as a pass) when
  no chromium is installed.

⚠️ **Don't pipe a suite through `| tail`.** A pipeline's exit status is the LAST command's, so node's
failure vanishes — that is half of why `test_interactions.js` sat broken for eleven days after the
Supabase migration (the other half: `deliver.sh` never ran it). All three suites now print their verdict
as the last line so a pipe at least *shows* the failure, and each asserts a minimum check count
(`MIN_CHECKS`) so dying partway can't read as a pass. **Adding checks? Raise `MIN_CHECKS`.**

## Resume point

`SESSION-HANDOFF-2026-07-13.md` holds the working state: what's done and QA-accepted, the hard-won
lessons, and the next task (**package generation** in `gen.js`).
