# Every kind of cell on the form, and what it remembers

Written 2026-07-31, read off `app.js` rather than recalled. `FORM-RULES.md` says what
you must not break; this says what is there. Where they disagree, read the code.

---

## 1. What a cell is

Every value on the form is one entry in `form`, keyed by a flat string
(`property.name`, `units.0.ua_exec`). The shape is `core.js`'s:

```
{ value, source, saved_at, prior_value, prior_source, db_value }
```

`db_value` is what the record holds. **`source` is not stored — it is derived** by
comparing `value` to `db_value` every time you edit. That one sentence explains most
of what follows.

| `source` | Colour | Means |
|---|---|---|
| `database` | blue | equals what is on file |
| `this-cycle` | green | pulled or parsed this package, not saved |
| `overridden` | amber | differs from what is on file |
| `new` | grey | nothing on file for this key |

A cell saved EMPTY keeps `db_value:''` and reads `new`, deliberately — so an empty box
never paints blue, and typing into it later reads as new data rather than an override.
After one "Update property profile" **every key in the form has been saved**, most of
them blank. Assume that state when reasoning about anything.

Colour answers *is this saved?* The **badge** answers *where did it come from?* They are
orthogonal, and a HUD filing needs both.

---

## 2. The part that surprises people

There are **two different families of source-backed cell**, and they answer "which
source did I pick?" in opposite ways.

### Family A — pointer cells: they remember the click

`units.N.ua_*` · `units.N.safmr_*` · `rent_schedule.date_eff_*` · `ocaf.factor_*`

These store **three or more keys per cell**:

- `*_exec` / `*_rcs` / `*_hud` / `*_pub` — one key per source, each holding that
  source's own figure, all at once
- `*_source` — **which one you picked** (`exec` | `rcs` | `hud` | `fr` | `custom`)
- `*_custom` — the figure you typed, used only when `*_source` is `custom`
- `*_reviewed` — set when you approve a conflict, cleared when the conflict goes

Picking a row writes `*_source`. The cell reads it back to decide what to display, so
the badge changes because the *pointer* changed. `srcSpec(k)` is the registry of these;
if it returns non-null, the cell is Family A. `coupledKeys` keeps the whole set
together so one Enter, one Escape, one ✓ and one ↺ act on all of it.

When nothing has been picked, `defUaSrc` / `defSafmrSrc` pick a default — for the
utility allowance the **study** outranks the executed schedule, which is a deliberate
call recorded in the code with the properties it was measured on.

### Family B — comparison cells: they remember nothing but the value

`property.name` · `property.s8` · `property.fha` · `owner.entity_name` ·
`tenant.property_alias` · `sig.title` · `poc.email` · `poc.phone` · and everything else
carrying the small ▾ built by `srcPick`.

These store **one key: the value.** Picking a row from the dropdown is exactly
equivalent to typing that value by hand — `store.editForm(form, k, value)` and nothing
else. There is no record of the click.

The badge is then *computed*: `rsTag(k)` asks "does this cell equal what the rent
schedule gave?", `rcsTag(k)` asks the same of the study, and `srcTags(k)` draws
whichever answers yes — or `RS · RCS` when both do.

**The consequence**, and the reason this section exists: when the two documents give
the *same* value there is nothing to distinguish, so picking either row leaves the same
badge. It is not a broken control; the app genuinely does not record which row you
clicked. When the documents *disagree*, the badge does move, because the value moved.

The underlying principle is FORM-RULES 3: *a figure equal to a source we hold IS that
source.* Typing $1,146 while HUD publishes $1,146 does not make a hand-entered figure.
That principle is right for the figures. Whether it is right for **names** — where two
documents agreeing is the norm, not the exception — is the open question.

### Family C — locked cells: nothing to pick

`property.name` and the effective date, **when `window.RASource` answers for them**.
Related Affordable owns the fact; the cell renders as text with a padlock, holds nothing
focusable, and the dropdown is gone rather than disabled. See FORM-RULES 20.

---

## 3. The precedence ladder

When more than one source can answer for a key:

```
Related Affordable  (locks the cell; the others may not overwrite it)
        ↓
Executed rent schedule   (rsOffers: if the RS has it, the study may not set it)
        ↓
RCS report
        ↓
whatever you type
```

`rsOffers(k)` is the gate: the RCS fill skips any key the schedule already answers for.
`raLockedKey(k)` is the outer gate: both fills skip a key Related Affordable owns.

HUD-92458 Part A holds the project name and the tenant-facing name in **one box**
(`Colonial Village/White Oak Townhomes`). `splitProjectName` is the only place that
knows it — both source rows read it, and so does the fill.

---

## 4. Every renderer, and what it produces

| Renderer | Used for | Family | Notes |
|---|---|---|---|
| `fieldCell` default | plain text fields | B | input + badge + ▾ |
| `lockedField` | RA-owned cells | C | text + padlock, nothing focusable |
| `selectCell` | entity type | B | dropdown; source rows spliced into the menu |
| `compAddrCell` | property / CA / appraiser / management address | B, grouped | 4 keys, ONE box, one badge, one pair |
| `pocCell` | point of contact | B + directory | picks a saved contact, fills 3 keys |
| `dirCell` | appraiser, CA | B + directory | same shape, `DIR_PICK` |
| `sigTitleCell` | signatory title | B | offers the principals from Section 12 |
| `moneyBox` / `numBox` | rents, counts | B | `SRC_MONEY` / `SRC_COUNT` decide formatting |
| `brbaBox` | bedroom / bath | B, grouped | two keys, squared inner edges, one badge |
| `uaBox` | utility allowance | **A** | exec / RCS / Custom… |
| `safmrBox` | 150% ceiling | **A** | HUD / RCS / Custom… |
| `dateEffCell` | rents-effective date | **A** | RS / Custom… — or locked |
| `ocafFactorCell` | OCAF factor | **A** | Federal Register / Custom… |
| `csDrop` | states, prefixes, designations | B | plain option list, optional ✕ |
| `[data-cb]` | Part B, owner's checklist | B | checkbox; value is `'1'` or `''` |
| `[data-wibox]` | Part B write-ins | B, grouped | tick + text + optional fuel |
| `[data-fuel]` / `[data-fuel3]` | fuel chips | B | cycle through G / E / O |

---

## 5. What each action does

| You do | What happens |
|---|---|
| **Type in a box** | `store.editForm` → `source` re-derived → `paintCell` repaints the colour **and the badge** |
| **Pick a source row** (Family A) | `srcSetSource` writes `*_source`, clears `*_custom` if leaving Custom |
| **Pick a source row** (Family B) | `store.editForm` writes the value; `markCycle` makes it green; no memory of the click |
| **Enter** | commits `_pending` — finds the cell's ✓ and presses it. Every kind of cell answers Enter |
| **Escape** | pops ONE entry off the undo run and restores that whole cell, provenance and all |
| **✓ save this field** | saves this cell and everything `coupledKeys` widens it to |
| **↺ revert** | `revertKeys` — back to what is on file, including a saved blank |
| **Update property profile** | `saveToDb` — writes EVERY key, including the empty ones |
| **Revert to saved** | re-reads the record and rebuilds the form |
| **Fill form from RS / study** | bulk fill through `setk`, which skips RA-locked keys and (for the study) anything the RS already answers |

A save is a wall: Enter, ✓ and Update all call `clearUndoChain()`. Nothing unwinds past
a save.

---

## 6. Groups

Some cells are several keys behind one box: an address (4), bedroom+bath (2), a
write-in (2–3), and every Family A cell (3–5). For those:

- `groupOf(k)` → the box they share · `coupledKeys(k)` → everything one press saves
- the colour is `groupColors(...)` over the whole set — one box, one colour
- the ✓/↺ pair appears once and acts on all of them
- Escape restores the whole group as one entry

FORM-RULES 12 and 17 both exist because a path widened by a different rule than its
twin: the ✓ button and Enter once disagreed about what a cell was, and saved different
halves of one.

---

## 7. The gap

**Family B does not record which source row you clicked.** Where the documents agree,
the badge cannot tell you which one you chose, because nothing knows.

Closing it means giving Family B a pointer the way Family A has one — an `origin` on
the cell, written when a row is clicked, cleared when you type, read by `srcTags`
before it falls back to comparison. That is backlog item #28 ("store cell origin"), and
it buys a second thing: a re-parse could stop clobbering a value you had corrected by
hand, because the app would know the hand correction was a hand correction.

The cost is that `origin` has to survive a save, which means a column per cell or a
side table — the data layer currently stores a value and a date, nothing else. That is
the real reason it has not been done, and it is worth deciding deliberately rather than
by default.
