# Validating the package against the packages we actually filed

**Date:** 2026-07-28 · **Branch:** `worktree-rcs-corpus` off `origin/main` (bd88506)

## The problem

`gen.js` produces six documents. We have exactly **one** pair of (our output, the
package a human actually filed) — Colonial Village — and it was assembled by hand.
Every other claim about generation is a claim about what the code does, not about
whether the result is the document HUD received.

Matt's Drive holds **33 property folders**, most with a completed renewal cycle: the
appraiser's study and the prior-year rent schedule that went *in*, and the cover
letter, submittal letter, owner's checklist, tenant notice, draft rent schedule and
RCS Analysis that came *out*. That is 33 ground-truth pairs sitting unused.

## What this builds

An end-to-end harness: real study + real prior-year rent schedule go into **the real
app**, the app generates the package, and the result is compared against the package
that was actually filed. Not a simulation of the app — the shipped bundle, driven
through its own file inputs and its own Generate button.

The output is a defect table: which properties fail, on which field, from which
appraisal firm's format, at which parse tier.

## Non-goals

- Not a rewrite of `gen.js`, `rcs.js` or the RS ladder. This measures them first.
- Not OCAF or UAF. RCS packages only.
- Not a judgement on prose. Wording differences are reported, never failed.

---

## 1 · Corpus

### Manifest — `app/full-mp/corpus.json`, committed

One row per property:

```json
{ "code": "75500", "name": "Lansing Manor", "cycle": "2026",
  "inputs":   { "study": "<driveId>", "priorRs": "<driveId>" },
  "expected": { "coverLetter": "<driveId>", "submittalLetter": "<driveId>",
                "checklist": "<driveId>", "tenantNotice": "<driveId>",
                "rentSchedule": "<driveId>", "analysisXlsx": "<driveId>" },
  "notes": "flat in '2026 - RCS'; Belfry job 25-119" }
```

Built by walking Drive once and classifying on filename, then **reviewed by Matt before
anything depends on it.** Folder naming is not uniform — Colonial Village nests its
package at `2026 (RCS)/RCS Package/`, Lansing Manor lays it flat in `2026 - RCS/`,
Fairview uses `2025 - RCS/`. A misclassified input yields a confident, fabricated
failure, which is worse than no result. Human review is the gate.

A property missing any input, or missing every expected output, is recorded as
`skipped: incomplete` — never counted as a pass.

### Cache — `_archive/corpus/<code>/`, gitignored

`pull-corpus.sh` hydrates it from the manifest. Lansing Manor's package alone is
~15 MB; 33 properties is 300–500 MB, which does not belong in git. What gets committed
is the manifest and the small facts files — the things tests assert against, and the
things a diff can show.

---

## 2 · Harness — three seams

A failure has to name its own cause. One monolithic script that boots a browser and
prints "mismatch" cannot say whether the scanner misread, the form dropped it, or the
generator printed it wrong. So:

| Seam | Input → output | Runs |
|---|---|---|
| **drive** | corpus row → package bytes on disk | headless chromium, once per property, cached |
| **extract** | document bytes → `facts` record | plain node, instant |
| **compare** | two `facts` records → verdict | pure, instant |

The cache between *drive* and *extract* is the point: once a property has been driven,
extractor and comparison logic can be iterated in seconds with no browser in the loop.

### drive

The plumbing already exists and is proven by `test_browser.js`:

- `?selftest=1` boots the real bundle against a local stub database — no Supabase
  session, no sign-in.
- The bundle is served over a loopback HTTP server and driven through CDP over node's
  own WebSocket — zero dependencies.
- Study and rent-schedule bytes go in through the **real** `#rcsFile` / `#rsFile`
  inputs via `DOM.setFileInputFiles`, so the real `onchange` handlers run: the RS
  three-tier ladder and `RCSParse.readLetter`, not a stub.
- `__parseRsPdf(bytes, onStep)` reports **which tier answered**, which is recorded per
  property — the tier distribution across 33 real schedules is itself a finding.
- Generation goes through the real `genPackage()`; the bytes are captured with
  `Browser.setDownloadBehavior`.

### extract

Per document type, a reducer to a normalized `facts` record holding **variable data
only**: property name and alias, S8 contract number, FHA number, effective dates, unit
counts by type, every rent and utility-allowance figure, the 150% SAFMR result,
appraiser name and firm, signatory, PM contact, addresses.

The same extractor runs on **both sides** — our generated document and the filed one.
Boilerplate cancels; only variables survive to be compared.

- **Rent schedule** and **owner's checklist**: same AcroForm template both sides, so
  this is field-id to field-id and exact.
- **Cover letter, submittal letter, tenant notice**: prose, from different templates.
  Variable slots are pulled positionally.
- **RCS Analysis xlsx**: cell-addressed.

### compare

Two `facts` records in, a verdict out. Every field is one of `match`, `mismatch`,
`missing-ours`, `missing-theirs`. Boilerplate divergence is collected separately into a
**template-drift** report — always visible, never a failure. That separation is what
keeps a failure meaningful: it always denotes a real data defect.

---

## 3 · Sequencing

1. **Lansing Manor**, end to end, with its facts **hand-verified against the actual
   PDFs.** This design has exactly one silent failure mode: an extractor bug that
   cancels on both sides, turning a real difference into a false match. Automation
   cannot catch it because the automation is the thing at fault. One property read
   carefully is what rules it out, and it must happen before the batch, not after.
2. **Colonial Village** — a different folder shape, and its manual package is already
   held locally, so the Drive path and the local path are both exercised.
3. **The batch of 33** → the defect table.
4. Fix defects, each becoming a committed check.

## 4 · What lands permanently

`app/full-mp/test_corpus.js`, registered in `run_tests.sh` and therefore in
`deliver.sh`, asserting against the committed facts files. It runs with no Drive
access and no network. `MIN_CHECKS` per the house rule.

## 5 · Risks

- **Shared-extractor blindness.** Addressed by step 1 above; it is the reason step 1
  exists.
- **Azure DI billing.** Scanned schedules fall to tier 3, which bills per page. The
  batch reports its tier-3 count, and tier 3 is opt-in by flag rather than default.
- **Real portfolio data.** Contract numbers, owner entities and tenant-facing letters
  for live Related Affordable properties. The cache is gitignored; the committed facts
  files carry real values and the repository is private (since 2026-07-28). Confirm
  visibility before any push.
- **Incomplete cycles.** Some of the 33 will lack a filed package. Reported as
  `skipped: incomplete`, never silently counted as passing.
