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
