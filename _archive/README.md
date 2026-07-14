# _archive — kept, but out of the active working set

These folders are parked here so they don't clutter the active project or load into
sessions. To hide them from Cowork entirely, drag this `_archive/` folder out of the
project in Explorer.

> Note: the built app is **not** here — it lives at the project root
> (`RCS Renewal — Multi-property (open in browser).html`) because it is the actual
> product. And `app/full-mp/` (the source that builds it) stays in the active tree.

## colonial-village-example/

The completed **manual** Colonial Village RCS package — the gold-standard example
for the planned review: review these, find discrepancies against what the tool
generates, then patch the PDF-generation errors in Cowork.

- `Manual RCS Package (PDF).pdf` — the full package (real/text PDF).
- `separated-files/` — the same package split into its six component documents
  (cover letter, owner cover letter, owner's checklist, RCS report, draft rent
  schedule, tenant notice). Best for per-document comparison.
- `Colonial Village - Executed Rent Schedule.pdf` — key source doc (current rents,
  utility allowances, Part B, unit mix).
- `Colonial Village - RCS Package.pdf` — condensed package copy.

Removed as redundant during cleanup: the 19 MB image-only twin of the package PDF,
and the 60 individual page-scan JPGs — both duplicated content already in the PDFs above.

## future-backend-prototype/

The **earlier Phase-1 prototype** of a real data backend — TypeScript + Node's
built-in SQLite. It implements the "six operations" form↔DB contract
(`src/store.ts`) and a proof harness (`src/roundtrip.ts`, run via `run.sh`/`run.bat`
or `npm run proof`), with `schema.sql` and `tools/build-schema.py` regenerating
`src/dictionary.json` from the field dictionary.

The shipped browser app does **not** use any of this (confirmed — nothing in
`app/full-mp/` references it). It's parked R&D toward the eventual real backend
(Node/SQLite → Azure / Navigator 2.0) and is **stale**: built on the old v6 schema
(current is v7). If/when the backend work resumes, regenerate it from v7 first.
