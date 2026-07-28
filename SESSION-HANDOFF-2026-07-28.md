# Session handoff — 2026-07-28 (overnight)

Seven commits, `fedc816` → `f8cbf1d`, all pushed to `main` (which is the deploy).
**852 checks across six suites**, green: 114 · 144 · 85 · 33 · 230 · 165 (test_db,
test_interactions, smoke_combined, test_gen, test_rcs, test_browser).

## What happened

The queue landed first (`5f25382`). Then three audits ran in parallel — one over
`gen.js`/`db*.js`/`core.js`/`rcs.js`/`ocr.js`, one over `app.js` + `shell.head.html`
against FORM-RULES, and one in a real browser looking at the thing. Between them
they found **33 defects**. All but the four in the task list are fixed, each with
a check that fails against the code it replaced.

Two of the three found the management-address phantom-dirty bug independently,
which is the strongest evidence either of them was working properly.

## The ones worth knowing about

**Documents that looked finished and were wrong.** Part D's field 174 is captioned
"Total Rent Loss Due to Non-Revenue Units" and reported the rent of ONE unit. A
blank signatory printed ", Vice President of the General Partner" on two federal
forms. A utility with no UAF factor contributed ZERO to the new allowance — $50
electric at 1.02 plus $30 gas with no factor gave 80 → 51, which reads as a
decrease, prints "Present $80 / Proposed $51" on a notice served on residents, and
fires the 24 CFR 245.420 certification. The RCS reader took the words AFTER the
Section 8 label as the contract number, so "Section 8 Contract Renewal — Fifth
Year" printed `RENEWAL` as the Section 8 Number on every document in the package.
Any ten digits on the letter became the appraiser's phone.

**Two ways the HUD year became 0301.** The legacy rents-effective key is stored
ISO and reached the box raw under an mm/dd/yyyy placeholder, so the first
keystroke reformatted 2026-03-01 to 20/26/0301; and typing into the middle of an
existing date rewrote the whole thing. `effYear()` and `hudParams()` took the
first four digits they found. Both now read the year out of something that parses
as a real month, day and year.

**The pair now shows for every key its own press would save.** The click handler
has always widened through `coupledKeys`; the render did not. That one asymmetry
was the parsed effective date, the pulled OCAF factor, and the fiscal year behind
a utility factor — three bugs, one cause. `ovIcons` widens the same way now, so
what is shown and what is saved are the same set by construction.

**Escape reverted a different cell.** Four conflict-resolve handlers set
`_pending` and never `_pendingSnap`, so `revertPending` spent whatever snapshot
the previous widget had left behind.

**A deleted unit row came back on the next save**, holding one rent and no
bedrooms, bath or count.

**The generate dialog's primary action was, sometimes, a different action** — the
hover card opened downward onto "Download the RCS Package folder", and a click at
that button's centre fired a link inside the card.

## What changed that you will see

- The generate dialog no longer prints its two list blocks. Hover a document's
  "N fields short" and that document's own list opens, each field a jump to the
  cell that fixes it — and each says where the value was supposed to come from.
- The OCAF/UAF package has requirements for the first time. It used to refuse the
  whole package for one program's shortfall; it now generates what it can.
- The rent increase sits beside the buttons that commit it (inline from 1280px
  up, wraps below at 1200 — measured, not assumed).
- Part D's derived unit count paints and can be saved; the section flags have
  their pair beside their own checkbox.

## Answering "why wasn't it pulled"

Traced field by field against Colonial Village's own schedule:

| Field | Why |
|---|---|
| Ownership entity, entity type, signatory, principals | **They do come through.** Proved against the real OCR fixture. |
| FHA number | **Blank on the document itself** — the header prints "Project Name / FHA Project Number / Date Rents Will Be Effective" and then the name and the date with nothing between. |
| Appraiser, proposed rents | On the study, which was not uploaded in that run. |
| Point of contact, CA name, CA organization, tenant-notice sender | **No document carries them.** Typed once, saved with the property. |

That answer is now in the product: each field in the dialog's card says which of
those four it is.

## Still open

Tasks #19–#22: the 22.5px layout jump when a save note appears, the unit grid
between 1051 and 1250px, the per-cycle-keys question (a live schema decision,
deliberately left), and a list of copy items.
