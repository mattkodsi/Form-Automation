# The tracker decides when; the app decides what

2026-07-30. Settled with Matt in conversation, measured against the real export
before it was agreed. **Built the same night** — see "What shipped" at the end
for what is done and what is still open.

## The rule

Two systems currently know things about a renewal, and when they disagree nobody
can say which is right. So each owns a field outright and neither owns both:

| Fact | Owner |
|---|---|
| Effective date | HAP tracker |
| Program (RCS / OCAF) | HAP tracker |
| Property name | HAP tracker |
| Contract number (Section 8 #) | **This app** |
| Tenant alias | This app |
| Everything else on the form | This app |

The tracker's half is read-only in the app. The app's half is where the contract
numbers come from — Kinley's system has no definitive list, so this website is
where they are collected, and handing them back is a later piece of work.

## Why this is safe: 228 of 229

Measured against `_archive/hap-fixtures/hap-tracker-2026-07-28.csv`, 2,852 rows,
as of the export's own date:

```
  229  properties in scope
  228  have a startable next renewal      <- the tracker can answer
    1  does not (Fox Hill: schedule stops, contract not yet extended)
```

Locking the date and the program to the tracker costs one property out of 229.
That number is what makes the rule affordable.

## A filed package's date is a fact, not a forecast

The tracker says what is *scheduled*. Once a package exists it describes a
document that was, or will be, submitted. If the tracker later moves that row,
the package must not move with it.

So the date is **inherited from the tracker at creation and frozen from then on**.
The tooltip on the locked field says that — not "the tracker owns this," which
would be a promise the app cannot keep after a re-import.

## What the locked field looks like

Not greyed out. Grey reads as broken rather than governed, and the value still
has to be legible.

- Value at full contrast.
- No input border, no hover state, no caret — nothing that invites a click.
- A small lock mark at the end of the field, carrying the tooltip.

## The guard lives in the data layer

An input that cannot be typed into is not a rule. This project has already been
bitten: duplicate properties got in through **rename** and through **applying a
parsed rent schedule**, not through the create dialog, and the rent-schedule
parser writes `property.name` directly.

So `createProperty`, `renameProperty` and `createCycle` enforce it in `db.js`
AND `db.supabase.js` (they are held to API parity), and the UI only reflects
what the data layer already refuses.

## A package points at a row, not at a year

`(property, year)` does not identify a renewal. 16 property-years in the export
carry more than one startable row. Luther Towers carries two every year to 2038.

Storing the tracker row a package came from makes the ambiguous cases fall out
correctly, and it is what a standalone UAF needs — a UAF has no tracker row of
its own, so it borrows the year from the row it accompanies while keeping its own
month and day.

## What the double rows actually are

Four properties carry two startable rows in one year. They are not one problem:

- **Greenport, Courthouse Square, Halcyon House** — one clean annual stream out
  to 2039 plus a single stray 2026 row that breaks the pattern. Halcyon House's
  stray row has no due date at all. These are hand-entry errors.
- **Luther Towers** — two complete parallel streams, twelve years long, each on
  its own correct five-year RCS clock (Sep: 2029, 2034 · Dec: 2028, 2033, 2038).
  A typo does not keep time for twelve years. It is two contracts on one
  property code, and it will be split upstream.

**Decision: the app makes no exception for Luther Towers.** After the upstream
split, one property means one contract and the app is already correct.

Worth knowing while it is unsplit: `Units`, `S8 Units`, `Contract Exp` and
`Contract Admin` are property-level columns repeated identically on every row,
so nothing in the export says which units belong to which contract. Starting the
December package inherits the September contract's unit mix.

## Not decided

- **Correction turnaround.** Kinley replaces the CSV with the live database
  next. Until that lands, a wrong tracker row means a request and a re-export,
  and there are rows in the export already past due. The lock is only as good as
  this loop is fast.
- **Standalone UAF dates.** Month and day editable, year fixed. UAF is not a row
  type in the export, so nothing here can be verified against data yet.
- **New property.** Everything is assumed to arrive through the tracker, but the
  button stays in the header for testing.

## What shipped (2026-07-30, commit `96fdb66`)

The lock turned out to need no tracker-code plumbing at all, because
`window.RASource` — Kinley's database seam, already wired for the per-cell source
rows — is the authority. One predicate carries the whole feature:

```js
isLocked(cell)   // true only when RASource answers for that cell
```

False for a property this app created, so those keep full functionality for free.
Turning the feature off again is `return false`.

Done:

- **The property name and the effective date lock** when that seam answers. Full
  contrast, flat surface, nothing focusable, a drawn padlock carrying the note.
- **The effective date got a real source.** It was being stored as
  `date_eff_source='custom'` — "the user typed this" — which is the dishonesty the
  start-a-package dialog existed to apologise for. It now lands in `date_eff_ra`
  and outranks the executed schedule and any typed date: in the form, in
  `cySyncEff` on both data layers, and on the federal form.
- **The refusal is on the write**, not the widget (FORM-RULES 17). Both parse
  fills ask `raLockedKey` first, so the rent schedule cannot set either key.
- **Rename becomes the tenant alias alone** when the name is locked.
- **A locked cell writes through**, so the value reaches the record and the
  documents rather than only the screen — now FORM-RULES 20, because the first
  version did it on one of the two paths that open a form and not the other.

Still open, deliberately:

- **Storing the tracker row on the package.** Not needed once RASource answers
  per property. It comes back if Luther Towers is ever split, or when standalone
  UAF is built.
- **The programme lock in the new-package dialog.** The dialog already pre-fills
  from the tracker; making it fixed is dialog code and waits on the UAF question.
- **The UAF month/day exception.**
- **Contract-number export back to Kinley** — separate piece.
- **Correction turnaround**, which is still the thing the whole rule rests on.
