# The app is the system of record for UAFs — executed RS + saved UAF, never the study

**Decision by Matt, 2026-07-31.** Settles the utility-allowance source question the corpus audit
kept circling, and defines the redesign it implies.

## The principle

For a unit's utility allowance, the **executed rent schedule is the baseline of record**, and the
**app is where UAFs (utility-allowance factor updates) are performed and saved.** When an RCS or
OCAF package is built, the app applies any **saved UAF** on top of the executed baseline to produce
the current allowance. The **appraiser's RCS study allowance is NOT a source** — it can occasionally
be more current (when a UAF happened outside the app) but it can also simply be wrong, so it is at
most a **cross-check**, never the value the app trusts.

Rationale: the study is an external transcription and error-prone; the executed schedule plus an
in-app UAF is a controlled, auditable path the app owns end to end. The expectation is that **all
UAFs will be done through the app**, so even when a UAF legitimately occurs between the executed
schedule and the study, the assumption is the UAF was saved in the app and can be applied when the
RCS/OCAF is finally filled out — making executed+savedUAF equal to (and more trustworthy than) the
study's number.

## Why the current app is wrong, and why a naive default-flip is not enough

Today `defUaSrc` (app.js:294 / score.js:58 / gen.js:425) **prefers the study's UA (`ua_rcs`)** over
the executed (`ua_exec`). That is backwards under this principle. But simply flipping it to prefer
`ua_exec` is insufficient: where a UAF happened outside the app, `ua_exec` alone is the **stale,
pre-UAF** figure, so the app would print an out-of-date allowance. The study "winning" in the corpus
cases (Sycamore Green, Burt Farms, Northcross filed the study's UA; Holly House filed the UAF-certified
61/64) is precisely the symptom of the missing feature — a UAF that was never captured in the app, so
there was nothing to apply and the study was the only carrier of the update.

## The redesign — three pieces

1. **A "UAF-only" workflow.** Let the user record a utility-allowance factor update on its own — the
   factor and its effective date — saved to the property/cycle, independent of running a full RCS or
   OCAF. Today UAF inputs only exist inside the OCAF/UAF program path; promote a standalone entry.
2. **Feed the saved UAF into RCS *and* OCAF.** When building either package, resolve the current UA
   as **executed baseline × applicable saved UAF (by effective date)**, not the study figure. The
   OCAF path already has UAF machinery (`uaf.f_*`, `uafFigures`); the RCS path needs to consume the
   same saved UAF.
3. **Change UA resolution + provenance.** `defUaSrc`/`uaResolvedOf` resolve to executed+savedUAF; the
   study allowance renders as a **cross-check that flags disagreement**, not a selectable source of
   record. Keep `test_gen.js:455` in mind — those three properties should, post-redesign, reach the
   study's number *through* a saved UAF applied to executed, not by trusting the study.

## Audit implication (correcting the ledger)

The corpus audit's UA findings were chasing this gap. Specifically:
- **Holly House 2025 is NOT an app bug.** The app matched the filed 61/64 by falling back to the
  study — a symptom, not correctness. Under this design the app should reach the operative allowance
  from executed+savedUAF, and flag that a UAF is needed if none is saved.
- The **"prefer study" default is wrong**; the **"block the conflict / prefer HUD" recommendations
  are superseded** by this design (the answer is executed+UAF as the system of record, with the study
  and HUD as cross-checks).
- HUD 9-14.B Step 1 (M17 — Morh, Woodland, Lansing, Holly House ran the 150% threshold on a stale
  allowance) is the *team-side* face of the same gap: without an in-app UAF-only path feeding the
  build, the operative allowance is easy to miss.

## Status

Captured, not built. Next step is to scope pieces 1–3 as an implementation plan.

## Concrete design (Matt, 2026-07-31)

**UA resolution precedence: `UAF → RS → RCS`.** The saved **UAF submission** value wins; absent one,
the **executed RS** (`ua_exec`) baseline; the **RCS study** (`ua_rcs`) is last, a cross-check. (Custom
remains an explicit override.)

**A new "UAF submission" source on the UA dropdown**, on both the RCS and OCAF forms. The UA cell
(`uaBox`, app.js:797) already renders an "Executed RS / RCS report / Custom…" menu via `srcOptRow`;
add a top row `data-uaopt="uaf"` labeled "UAF submission", carrying the UAF-computed per-unit value.

**Combined RCS/OCAF + UAF auto-repopulates the cell.** When the package includes a UAF, the UAF
calculation (factor × baseline, by effective date) writes the per-unit `ua_uaf` value and the cell
resolves to it automatically — no hand-pick. A standalone **UAF-only** submission saves the same
`ua_uaf` for a later RCS/OCAF to pick up.

### Implementation plan (files → change)

1. **New per-unit key `units.N.ua_uaf`** — register in `FIELDS` (app.js ~56), route it to the
   per-cycle bucket in `db.js`/`db.supabase.js` (it changes each cycle), and add it to `coupledKeys`
   for the UA cell so save/revert/undo carry it with the pair.
2. **Precedence** — `defUaSrc` (app.js:294 **and** score.js:58, kept in parity):
   `uaHas(uaf)?'uaf':(uaHas(exec)?'exec':(uaHas(rcs)?'rcs':'custom'))`. Add the `uaf` branch to
   `uaResolvedOf` (app.js:308, score.js:59) and to gen.js's inline resolver (gen.js:425).
3. **Dropdown option** — add the `data-uaopt="uaf"` row in `uaBox` (and wherever the OCAF form renders
   the UA cell); the existing `.uaopt` click handler (app.js:3741) already routes `data-uaopt` values
   through `srcSetSource`, so `"uaf"` needs no new handler, only inclusion in `names`/fallback lists
   (app.js:3619) and the label logic in `uaBox`.
4. **The UAF calculation feeds `ua_uaf`** — compute per-unit `ua_uaf` from the saved UAF factor
   applied to the executed baseline (the OCAF path already holds `uaf.f_*` and `uafFigures`); in a
   combined package write it and let the cell resolve to it. Standalone UAF-only entry writes the same.
5. **Provenance + notes** — `uaCellColors`/`uaNoteCell` gain a "UAF submission" label; the exec-vs-rcs
   conflict note becomes a cross-check flag (study disagrees), not a source-picker.
6. **Tests** — flip `test_gen.js:455` (executed/UAF wins, study is a cross-check), add `ua_uaf`
   resolution + precedence cases to `test_rcs.js` (the score parity block) and `test_db.js` (per-cycle
   routing), and a `test_interactions.js` case that the new option saves/reverts as one cell.

### Scope note

Pieces 1–5 are this lane (app.js / score.js / gen.js / db*.js logic; the dropdown reuses existing CSS
classes, no new styling). The **standalone UAF-only entry point** (a place in the UI to start a UAF
submission on its own) is the one piece that may want the redesign lane. Build order: precedence +
`ua_uaf` + dropdown option + feed (1–5) first, since they make the combined-package path correct; the
standalone entry point second.
