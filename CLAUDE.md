# Automation Project — session guide

RCS (Rent Comparability Study) 5th-year renewal-package automation for HUD
Section 8 (Related Affordable). A form-driven tool that pre-fills from stored +
uploaded data, clears an internal 150%-SAFMR check, and generates the six-document
renewal package as review-ready drafts. See `RCS Renewal Automation - Project Plan.md`.

> **Latest handoff:** `SESSION-HANDOFF-2026-07-13.md` — what changed on 2026-07-13,
> the current folder structure, verification evidence, and a resume-here block.

## The product is the single-file app — built from source

`RCS Renewal — Multi-property (open in browser).html` (project root, ~1.6 MB) is
**the deliverable** Matt double-clicks — a complete standalone browser app.

It is **built, not hand-written.** `app/full-mp/build.sh` concatenates the modular
source — `shell.head.html` + `lib/pdf-lib.min.js` + `core.js` + `db.js` + `app.js`
+ `gen.js` + `templates.js` + `shell.tail.html` — into that one HTML. So:

- the **HTML is the bundle** (what runs in the browser);
- **`app/full-mp/` is the editable source** of that bundle.

Verified 2026-07-13: building from `app/full-mp/` reproduces the shipped HTML
**byte-for-byte**. Edit the small source files and rebuild — never hand-edit the
big HTML (that's how `templates.js` silently drifted from the app before).

## ⚠️ Three hard rules (all caused real problems)

**1. Never open these with `Read` — it can crash the session.**
They exceed a standard context window. Inspect with the shell instead.

| File | ~Tokens | What it is |
|------|--------:|------------|
| `RCS Renewal — Multi-property (open in browser).html` | ~411,000 | The shipped app (bundle) |
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
3. *