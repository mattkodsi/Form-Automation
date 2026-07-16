# Reference & Research — not code, kept for context

Nothing in this folder is loaded by the app or its build (`app/full-mp/build.sh` only
reads from `app/full-mp/`). This is supporting material: what the generated documents
should look like, how the UI got to its current design, and domain research behind
possible future features (OCAF/UAF/BBRA). Safe to exclude from a Cowork session if it's
crowding context — nothing here is a dependency of the product.

## Blank RCS Package/

The **blank template documents** for the six-document RCS package plus the Rent
Analysis workbook — Word/PDF/Excel files with `[Property Name]` placeholders, unfilled.
Useful as a formatting reference when checking that `gen.js`/`xlsx.js` output matches
what these forms actually look like blank.

## Mockups/

Early **design exploration**, from before the app was built: PNG/PDF mockups of the
form and database-manager concepts, plus the Python scripts (`*.py`) that generated
them. Superseded by the live app — kept for design history, not as a spec.

## Process Research/

Domain research into the HUD renewal process itself, not the tool:

- `OCAF Renewal Process - Deep Dive (Willow Woods 2025).md` — a worked-example
  analysis of an **OCAF-year** renewal package (rent adjustment via the Operating
  Cost Adjustment Factor, rather than a full RCS reset).
- `07-15 OCAF and RCS Process Training and Systematization Discussion-transcript.txt`
  — a meeting transcript discussing how to formalize/systematize that process.

Relevant if the app's existing OCAF/UAF/BBRA program pills (see `CLAUDE.md`'s code map)
grow real functionality beyond RCS — this is the groundwork for that, not yet acted on.

Related real-package examples for the same research thread live in
`_archive/ocaf-examples/` (signed OCAF packages) and
`_archive/colonial-village-example/` (a completed manual RCS package, used as the
gold-standard comparison against this tool's output).
