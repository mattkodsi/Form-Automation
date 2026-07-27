# Session handoff — 2026-07-27

Read this, then `CLAUDE.md`, then `app/full-mp/FORM-RULES.md`. The next task is a
**full interaction audit**, and the reason it is worth doing is in §1.

---

## 1. The thing that changed: you can now drive the real app

`index.html?selftest=1` boots straight into the form. No sign-in, no live data.

```
python3 -m http.server 8971        # from the repo root
open http://localhost:8971/index.html?selftest=1
```

- It **never constructs a Supabase client.** The isolation is structural, not a
  permission that could be misconfigured — the real record is unreachable because
  no connection to it is ever opened.
- It writes to its own `localStorage` key (`rcs_selftest`).
- The title bar reads `SELFTEST — …` so it can never be mistaken for the real app.
- `window.__t` exposes the **same hook surface** the Node suites use
  (`__firstPid`, `__openCycleForm`, `__editCell`, `__saveCell`, `getVal`, `srcOf`,
  `coupledKeys`, `isDirty`, `__renderBody`, `__docMissing`, `__docWarns`, …).

**Why this matters more than it sounds.** Before it existed there were two kinds
of test and a hole between them:

| | What it proved | What it could not see |
|---|---|---|
| Node suites (316 checks) | call `save()` and it saves | whether any key or click ever *reaches* `save()` |
| Browser sessions | one row's markup measures correctly | anything interactive — the row was inert HTML pasted onto a page |

Every defect Matt hit on 2026-07-27 lived in that hole. The hatch closes it and
found a real bug within minutes of existing (§2, "Enter").

**Still out of reach:** the HUD SAFMR pull, the OCAF/UAF factor pulls and the OCR
call all go through authenticated edge functions. The stub database cannot fake
those.

**Never handle Matt's password.** He has offered it; decline. Testing that needs a
real session is either done by him, or through the hatch.

---

## 2. What shipped this session

All deployed and verified live (push to `main` = deploy; poll
`curl -s -o /dev/null -w '%{size_download}' "https://packageautomation.run.place/index.html?cb=$RANDOM"`).

- **The parsed rent schedule persists.** `_rsUpload` was a page-load variable that
  `openCycleForm` itself cleared, so every source row reading `rsVal()` went dim on
  refresh while rows backed by a saved field (`units.N.ua_exec`) survived — one
  menu, two stories. Now stored on `cycle.rs_doc` (new JSONB column, additive
  migration already applied) and rehydrated. Bytes are deliberately not stored.
- **The generated-document row is the download target**, not the word "Download"
  (42× the hit area).
- **Required vs suggested audited for all six documents** — see
  `app/full-mp/DOC-REQUIREMENTS.md`. Headline: only the checklist ever asked for a
  signatory, so three documents could be filed with an empty signature block.
  Proposed rents are **required on the tenant notice, suggested on the rent
  schedule**, deliberately.
- **Number formatting in dropdowns**, and count inputs, so a box and its own
  dropdown cannot disagree.
- **RS-upload copy rewritten** — see §4.
- **Signatories directory removed** (Matt: signatories are not standardised). No
  data deleted; `app_contact` rows of kind `signatory` are simply no longer read.
- **Unit type is one fact**: one source badge for the whole group, a group picker
  behind a divider (the address cell's grammar), sub-cell pickers kept for
  mix-and-match, bedroom ✕ dropped.
- **RS tags on every schedule-fed cell** — scalars, principals, Part B, unit rows —
  all through one `rsOf()` / `rsTag()`.
- **Enter saves the source-backed cells.** Three separate defects, found in layers:
  the handler never set `_pending`; it refocused on `[data-k]`, which stops
  existing the moment the cell snaps out of Custom; and — found only via the
  hatch — the document-level Enter handler stands down whenever focus is in a text
  box, expecting the box to have its own Enter handler, which `.srcedit` boxes did
  not. Enter fell through the gap between two handlers.

Suites: **test_db 104 · test_interactions 136 · smoke_combined 80 · test_gen 23**.

---

## 3. THE NEXT TASK — full interaction audit

Not a rerun of the 2026-07-26 audit. That one produced 47 findings, they were
fixed, and it still missed everything above — because it could not press keys or
cross a page boundary. Scope this at what is *newly reachable*.

**Output must be tests, not a findings list.** The last audit's markdown went
stale as its findings were fixed. Each finding here should become a check that
stops it returning, the way the Enter fix is now held in place.

1. **Keyboard on every kind of cell.** The Enter bug is one instance of a pattern:
   a cell whose input is not a `[data-k]` box falls through the gap. Same shape,
   never pressed: the SAFMR box, the rents-effective date, the OCAF factor cell,
   the management address, the fuel chips, the write-in ticks. **Expect at least
   one more broken.** Rule 7 is the spec.
2. **The round-trip sweep** (FORM-RULES "Before you deliver" §6). For every control
   in `#viewForm`: change it, take it back, assert `isDirty()` is false and `form`
   matches `FORMSNAP` key by key. It has been in the checklist for weeks as a
   manual step nobody could perform across ~200 controls. It is now a loop.
3. **The session boundary** (rule 19). Reload, leave and return, reopen the
   package — every source row must still offer what it offered.
4. **Focus after every mutating action.** A lost caret is what made Enter
   unreachable. Nothing has ever checked where focus lands after a click, save,
   revert or dropdown pick.
5. **Geometry of the whole form** at 1200 / 1280 / 1920, from computed style — not
   one injected row.
6. **`AUDIT-BACKLOG.md` §E** — the unit-type and unit-count conflict buttons, marked
   "source-verified only" because they could not be reached in a browser. Task #26
   has been stuck on exactly this. They are reachable now.

---

## 4. Standing instructions from Matt

- **UI copy: never narrate the engineering decision.** The worst offender was a
  loading subtitle explaining that tick boxes are drawn rather than typed. Matt:
  *"it's clearly text written in response to the work I prompted about scanning.
  that's an issue across the board."* Name the user-visible state, not the
  mechanism. Test: could a reader act differently because of this sentence?
- **Register differs by surface.** The bottom **status bar** is a live progress
  report and may be chattier. **Persistent UI** — row subtitles, helper text — must
  be short, neutral, mechanism-free.
- **Multitask.** Fold new requests in; do not abandon queued work when a new
  message arrives. This was called out directly.
- **Measure before showing.** "Make sure it all fits well before you show me this
  shit." Geometry passing is not the same as the design working — check that a
  badge *reads* as belonging to the right thing, not merely that it does not
  overflow.
- **Keep it simple for Kinley.** The RA-port anchor gate
  (`python3 app/full-mp/build-ra.py /tmp/rcs-ra-check.html`) is mandatory after any
  `app.js` / `shell.head.html` edit. It caught two anchor breaks this session and
  that is exactly its job.

---

## 5. Open backlog

| # | Item |
|---|---|
| 22 | Source dropdowns for Part B, UAF factors, alias, CA + mgmt addresses. **POC email/phone is NOT RS-parseable** — that was my error, they come from Related Affordable |
| 23 | One clearability pattern across all nine dropdowns |
| 24 | OCAF/UAF save/revert pairs below their rows |
| 25 | `AUDIT-BACKLOG.md` §D small provenance gaps |
| 26 | Conflict buttons + live factor pulls in a browser — **now partly unblocked** |
| 29 | Duplicated HUD-9625 worksheet math (Matt: only if obvious) |
| 34 | **`db.cosmos.js` API parity before the next RA handoff.** Missing all 11 cycle functions plus `getCycleRs`/`setCycleRs`. Not urgent — Kinley runs an older build — but it is a hard blocker on sending him the new codebase |
| 35 | Dead code: `CROSSWALK`, `combined_test.js`, `rsUnitBr`/`rsUnitDesig`, `TODAY`, `rcsLine`, ~44 CSS classes (verify in a browser — `.ghost` is dead, `.ghostlink` is live) |

**Undecided:** 144.6 MB of the 206 MB git history is 589 historical versions of
`index.html`. Options: leave it / build-on-deploy via Action / rewrite history.

**Open design question Matt raised and has not settled:** the unit-type cell now
carries four chevrons (bedroom, bathroom, designation, group). It fits and nothing
clips, but he has twice called that cell crowded. The next cut would be collapsing
the three sub-cell menus into the group menu — he explicitly wants mix-and-match
kept, so do not do this without asking.

---

## 6. Hard-won, do not relearn

- **Never `Read`** `index.html`, `templates.js`, `lib/pdf-lib.min.js`.
- **Never host-edit source** — sandbox in `/tmp`, `cp` in, `cmp` to verify, check
  0 NUL bytes.
- **Assert on the cell, never on `isDirty()`**, in `test_interactions.js`. That
  suite has edited a dozen cells by the time yours runs; a global dirty flag says
  nothing about one cell. Reading it wrong made me report a product bug that was
  my own harness's fault.
- **A passing check can be vacuous.** Two of mine passed because the value under
  test was absent (a 2-digit count needs no comma; the seeded unit had no
  designation). Prove a new check fails against the old code before trusting it.
- **`.srctag` truncating is the exception now**, opted into by `.long`. As a
  shrinkable box beside a greedy input every badge collapsed to its own ellipsis
  and printed as a bare dot.
