# Unit label replaces unit designation — design

_2026-07-27 · status: approved by Matt, ready to implement · handoff to the main session_

## In one line

Delete the unit designation feature. Replace it with one free-text **label** that holds whatever
follows the bedroom and bath counts — `Elderly`, `Family`, `Patio`, anything the rent schedule says.

## Why

**1. The form loses information the source document gives it.** HUD's rent schedule Part A "unit
type" is a single free-text column. Across 26 real schedules it contains:

| What appears | Example | Captured today? |
|---|---|---|
| `E` / `F` | `1 BR E` (Beacon Hill) | yes → desig |
| `Elderly` / `Family` | `2 Bedroom, Elderly` (Willow Woods) | yes → desig |
| **anything else** | `1Bedroom Patio` (Lansing Manor) | **no — dropped** |
| nothing | `1Bedroom` | n/a |

The designation enum covers two of those four. `rsParseUnitType` reads `1Bedroom Patio`, keeps the
bedroom count, and throws `Patio` away because there is nowhere to put it.

**2. That is a document defect, not just a modelling nicety.** `utype()` in `gen.js:250` builds the
printed unit type from bedrooms + baths + designation. Lansing Manor has two unit types —
`1Bedroom` (32 units, $1,190) and `1Bedroom Patio` (68 units, $1,200). The generated rent schedule
prints **both rows identically**:

```
today                         after
1 BR      32   $1,190         1 BR / 1 BA         32   $1,190
1 BR      68   $1,200         1 BR / 1 BA Patio   68   $1,200
```

Two identical unit-type labels carrying different rents, submitted to HUD.

**3. The designation has never actually been saved.** Verified 2026-07-27 against the live database:

- `unit_type` has **no `designation` column** (checked `information_schema.columns`).
- `desig` is **not in `UCOL`** (`db.supabase.js:46`), the whitelist `buildUnitRows` uses, so it is
  never written.
- `db.js:74` **does** map `'units.{i}.desig' → 'unit_type.designation'`.

So the local stand-in persists it, the real backend silently does not — an API-parity break of
exactly the kind CLAUDE.md warns about. On the deployed app, setting a designation and pressing
"Update database" loses it on reload.

**This makes the migration free: there is no stored designation data to convert.**

**4. The cell is overcrowded.** `unitTypeCell` (`app.js:477`) renders seven interactive elements in
one cell: bedroom select + clear, slash, bath select + clear, designation select + clear, divider,
group source picker. Removing the designation takes it to three.

## The design

**Cell:** `1BR ▾ / 1BA ▾ … ▾` — bedroom, bath, source picker. Nothing else.

**Label line:** directly beneath the type cell, inside the same column.

- Collapsed to nothing when empty, so a property with no labels is exactly as tall as today.
- A muted `add a label` hint appears on row hover or focus.
- When set, shows a small tag icon and the text in accent colour.
- Typing offers `Elderly`, `Family`, `Disabled`, `Near-elderly` as suggestions — **suggestions only.
  Any text is valid.**

**Printed form:** `utype()` appends the label — `1 BR / 1 BA Patio`.

## What changes

| File | Change |
|---|---|
| `app.js` | Delete `DESIG`, `desigName`, `desigDrop`, `desigColors`, `desigTip`. `unitTypeCell` drops the designation control and gains the label line. `rsParseUnitType` returns the leftover text as `label` instead of matching an enum. `rsFillFromParsed` writes `units.N.label`. 40 references. |
| `gen.js` | `utype(br,ba,label)` appends the label. 2 references. |
| `shell.head.html` | Designation CSS out, label-line CSS in. 5 references. |
| `db.js` | Crosswalk `units.{i}.desig` → `units.{i}.label` / `unit_type.label`. |
| `db.supabase.js` | Add `label: 'label'` to `UCOL` — the thing that was missing all along. |
| `schema.sql` + migration | `alter table public.unit_type add column if not exists label text;` |
| `test_interactions.js` | 54 references — the designation chip is heavily covered. Largest single piece of work. |
| `smoke_combined.js` | 5 references. |

## Rules that must hold

- **A label is free text.** Never validate it against a list. The four designations are autocomplete
  entries, nothing more.
- **An empty label costs no vertical space.** Rows without one must render at today's height.
- **The label round-trips.** What the uploaded schedule said in its unit-type column is what the
  generated schedule prints.
- **`rsParseUnitType` keeps parsing bedrooms and baths as it does now** — the SAFMR pull, the ceiling
  maths and the RCS row matching all key off `br`, and none of that may change.
- Existing per-cell machinery applies unchanged: provenance colour, override note, revert, and a
  source tag if a document fed it.

## Not in scope

The RCS study parser does **not** need the label to match its rows. It disambiguates on unit count,
which is exact (`68 = 68`) where text matching would be fuzzy (`Patio` vs `with patio`). See
`app.js rcsMatch`. The label is for fidelity and for the generated schedule, not for matching.

## Evidence

- Corpus: 26 rent schedules under `_archive/` and the Drive folder `RA / Section 8 Examples`.
- Lansing Manor's schedule: `Lansing Manor - DRAFT RS - 2025.pdf`, Part A rows `1Bedroom` (32) and
  `1Bedroom Patio` (68).
- Live schema checked via the Supabase MCP against project `plgegtosqwehriqecaui`.
