# The form's rules

Every rule here was written because breaking it shipped a bug, and each one names the
fault it prevents. They are not style preferences. Walk this list before you add a
cell, a dropdown or a click handler — and again before you deliver.

The form is `app/full-mp/app.js` + `app/full-mp/shell.head.html`. The cell model is
`app/full-mp/core.js`. Read this alongside `CLAUDE.md`, which covers the build.

---

## The cell model, in one paragraph

A cell is `{value, source, saved_at, prior_value, prior_source, db_value}`. `db_value`
is what the record holds; `source` is derived by comparing `value` to it. A cell saved
EMPTY keeps `db_value:''` and `source:'new'`, deliberately — so an empty text box never
paints blue, and a later entry into it reads as an override rather than first-time
data. **After one "Update property profile" every key in the form has been saved, most
of them blank.** Assume that state when you reason about anything; it is the state
that broke the address revert, the source pointers, and the Escape path.

| Colour | rgb | Asserts |
|---|---|---|
| blue | `232,240,254` | on file — the record holds this |
| green | `233,245,242` | pulled or parsed this package, not saved yet |
| orange | `251,241,230` | overridden — differs from the record |
| grey | `246,247,249` | new — nothing on file |

Colour answers *is this saved?*; the badge answers *where did it come from?* They are
orthogonal and a HUD filing needs both. That is why a source-backed cell keeps a
`*_source` pointer instead of collapsing to a custom value on save.

---

## 1. Every source-backed cell declares its sources — including the empty ones

A cell fillable from the executed rent schedule, the RCS report, a HUD API or the
Federal Register lists those sources **whether or not a value has been pulled yet**.
With nothing to offer, the row renders dimmed: `— Executed RS · not available`. Use
`dimPick` / `srcOptRow` / `srcPick`; never conditionally omit the row.

**Why:** rendering nothing leaves the cell looking as though it has no source at all
the moment an upload goes out of session, and the reader cannot tell "not parsed" from
"not parseable". The utility allowance and the 150% ceiling made their RCS row vanish
in a non-RCS package while every other unavailable source in the same menu dimmed.

**The one deliberate exception** is `nonrev.N.num_units`. HUD-92458 Part D has one
named space per row and no unit-count field, so there is no such source to declare.
Offering a permanently-dim "Executed RS" row there would assert a source the document
structurally does not contain. If you add an exception, write the reason down here.

## 2. A source row carries a value, not just a tag

If you register a source for a cell, wire it to the lookup. `SRCPICK_ROWS` entries call
`rsVal(...)` / `raVal(...)`; `DIR_SRCROW` entries are `{tag, val:()=>…}`.

**Why:** `property.s8` was hardwired `val:null` and read "not available" while the
parser found the number three different ways — and that is precisely the field Belfry's
RCS mislabels, so the schedule's own answer is the one worth offering. `sig.name` did
the same while `sig.title` beside it offered the very same parse live.

## 3. Choosing the on-file source writes what the record holds, and clears the custom partner

Route every write of a `*_source` key through `srcSetSource(cusKey, chosen)`, and every
write of a source-backed figure through `srcEditKey(k, val)`. Never
`store.editForm(form,'…_source', name)` by hand — not in a click handler, and not in a
parser or an API pull.

**Why:** `srcSetSource` knows two things a raw write does not — that on a record which
never stored a source, the write must be **blank**, not the source's name (writing the
name is a change of its own, and left the form dirty after returning a cell to the
figure on file), and that switching away from Custom must empty `*_custom`. Raw writes
are how the rents-effective date and the OCAF factor kept a stale Custom figure that
still saved and still drove the HUD year, and how three separate pulls dirtied a form
whose visible values had not moved.

`srcEditKey` adds the other half: a figure equal to a source we hold **is** that
source. Typing $1,146 while HUD publishes $1,146 does not make a hand-entered figure,
and storing it as one dropped the badge and drifted the pointer away from the record.

## 4. A cell colours itself from its own keys

`provColors(state, srcKey)` must be passed the key that actually exists. The OCAF
factor cell passed `ocaf.factor_source`; the field is `ocaf.factor_src`.

And the three source-backed cells decide their state the same way — `srcCellState` on
the `*_custom` key, promoted to overridden or database, then `provColors` on the
`*_source` key. Three cells doing the same job by two different rules is how one of
them ends up a colour the others would never show.

## 5. Every mutating handler sets `_pending` + `_pendingSnap`, or pushes the undo run

Use `snapPend(keys)` (which returns the snapshot *and* pushes it) or `pushCellUndo(k)`,
**and** name the edit in `_pending` so Enter can commit it.

A handler that mutates `form` and does neither cannot be undone — and worse, leaves a
STALE `_pending` pointing at an earlier cell, so the next Escape reverts something the
user is not looking at. That is exactly what the ✕ clear did: set a designation, clear
a bedroom, press Escape, and the bedroom stayed cleared while the designation silently
reverted.

**Deliberately outside the undo run**, because each has its own affordance and a single
Escape unwinding it would surprise: row add/delete (`_undoStack` / `_undoNR` /
`_undoLI` / `_undoPR`, with their own visible "↩ Undo delete" links), the section
toggles, `#rsApply`, `#ocafApply`, `#uafApply`, and the three API pulls. If you add
another exclusion, add it to this list.

## 6. Revert restores what is on file — including a saved blank

Use `revertKeys(keys)`. `store.revertForm` alone returns false unless
`source==='overridden'`, and a cell saved blank reads as `'new'` — so the button did
nothing in the most common state there is. A revert is itself an edit: push it onto the
undo run so a mis-click can be walked back.

## 7. Enter saves the focused cell; Escape reverts it — for EVERY kind of cell

Not just text inputs. Dropdown triggers, checkboxes, fuel chips and write-in ticks are
all focusable and all answer both keys. Enter finds the cell's ✓ and clicks it; Escape
walks the undo run (§12).

**Why:** the save/revert buttons are `tabindex="-1"` on the premise that Enter and
Escape ARE the keyboard route. A cell that did not answer those keys had no keyboard
path to save or revert at all.

## 8. Read a widget's key off the widget, not off its neighbours

Backspace in a dropdown read `data-cskey` off the **first menu row**. On a menu that
leads with a source row there is no key there, so the app created a field literally
named `"null"` and Update property profile wrote it into the record. The trigger
carries `data-trigfor`; use it, and guard against a null key before writing.

## 9. A cell's `data-box` is its stable identity

Do not flip it between two keys depending on mode. The utility allowance, the 150%
SAFMR, the rents-effective date and the management address each flip `data-box` between
a `*_source` and a `*_custom` key, so every lookup keyed on it misses on one of the two.
If a cell genuinely has two identities, `cellActBtn` must know both.

**Known and not yet fixed:** a `.rbox.brba` sets `data-box` to the bedroom key only, so
a lookup from inside the bath dropdown resolves to the bedroom's pair. Masked most of
the time by the `_pending` path, which is per-key.

## 10. A cell's pair is findable wherever it sits

Three placements are all legitimate: inside a roomy cell (`ovIcons` → `.ovic`), beside
a plain text field (`ovNote` → `.ovnote[data-ov]`), or below the row under its own
column (`.uracts`). **Use `cellActBtn(cell, sel, mode)`** — it checks all three. Code
that looks in one place silently skips whole sections.

Rows that look alike behave alike: if a Section 6 unit row puts its pair below the row,
so do the Part D and non-Section-8 rows that render the same grid.

## 11. Sub-cells butt together with squared inner edges

Two adjacent sub-cells of one colour must read as one field: zero gap, inner corners
squared. A 6px radius on an inner edge leaves corner notches showing the group colour
through — which reads as a third colour nobody chose.

Watch `flex` growth, not media queries. There are **no** `@media` rules on these rows;
the widths that measured right at 1280 and wrong at 1920 were `flex:1` on a `.uadrop`
growing with its container while its acts slot stayed pinned. Fix by specificity
(`.ucards .urow …` / `.pdrow …` beat `.brba .uadrop.cs`), and measure at three widths.

## 12. Escape walks back a RUN of edits, one cell per press

`_undoChain` is a stack of `{sig, snap, keys}`. Each press pops one entry, restores the
whole cell, and stops.

- **The unit is the CELL, not the keystroke.** A text box pushes one entry on the first
  character typed into it since its last push, so one press undoes a whole entry rather
  than a letter. `pushUndo` returns the existing top entry when the signature matches.
- **The cell is `fieldKeys` widened through `coupledKeys`** — the grouping the
  save/revert pair already uses. An address is one entry however many parts you
  touched; a utility allowance carries its source pointer with it.
- **Restoring puts the whole cell back, provenance and all.** Rebuilding a
  source-backed cell key by key is what once left an allowance grey instead of amber,
  and emptied it instead of restoring the figure on file.
- **A save is a wall.** Enter, the ✓ button and Update property profile all call
  `clearUndoChain()`. Nothing unwinds past a save.
- **`_pendingSnap` and the stack's top entry are the SAME object.** That identity is how
  `revertPending` knows which entry its press just spent (`undoDrop`), and what keeps
  two clicks on one dropdown to a single Escape.

## 13. A live re-render draws the same rows the full render draws

`refreshPrincipalOpts()` rebuilds one menu on every keystroke and dropped the dim row
that `sigTitleCell()` renders — so typing a principal's name in Section 12 quietly
deleted a row from Section 3's menu until the next full render. Any partial repaint
must agree with `renderBody()` about what exists.

This is the same trap as provenance being painted twice (`renderBody` vs `paintCell`):
two renderers, one of them wrong, and the user only ever sees the second.

## 14. A flag does not outlive the condition it describes

A `*_reviewed` flag exists only to silence a conflict warning. When the conflict goes
away the flag is meaningless — and it was then the last thing on the form still
differing from the record, so the footer said "unsaved changes" with nothing on screen.
`syncReviewed()` clears it, but only when the record does not already hold it:
un-setting a saved flag would dirty a form the moment it opened, which is the same bug
pointed the other way.

## 15. An indicator computes; it never asserts

No hardcoded `✓`, no unconditional `+`, no `class="teal"` on a figure that can be
negative. Every tick, colour and sign is a function of the data. The six-document card
once hardcoded a check for five of the six.

## 16. No number reaches the screen except through a formatter

| Kind | Use | Gives |
|---|---|---|
| money, whole | `money(n)` / `fmtMoney(x)` | `$3,495` |
| money, cents | `money2(n)` | `$1,074.50` |
| money, signed | `sMoney(n)` | `+$120` / `-$120` |
| date | `fmtDate(iso)` / `fmtDateLong(v)` | `3/1/2026` / `March 1, 2026` |
| phone | `fmtPhone(x)` | `(313) 555-0142` |
| percentage | `sPct(n)` | `+4%` |

Never interpolate a bare `get()`, a naked `Math.round`, or a raw `toFixed` into
user-visible text. Values off `get()` are **strings** — pass them through `numf()` first.

**Why:** twelve sites printed `$3495`, and the 150%-ceiling card printed `⚠ HUD $3495 ·
RCS $3435` directly above a line reading `$3,495 < $3,600`. One card, two conventions —
which reads as a rendering glitch rather than a house style.

## 17. A rule belongs to the operation, not to the button

Put the invariant in the function every path calls — `revertKeys`, `srcEditKey`,
`cellActBtn` — never in one widget's click handler.

**Why:** this has now failed four times. The phantom-dirty fix lived in the `.srcedit`
handler and missed the return trip through the generic input. The "a revert is not a
redo" fix lived in `[data-rev]`'s handler and missed the input's own Escape. If a
behaviour is true of reverting, it goes in `revertKeys`.

The fourth: **the ✓ button and Enter disagreed about what a cell is.** `[data-save1]`
widened its keys through `coupledKeys`; `commitPending` — the path Enter takes —
widened only through `groupOf`, so picking a source saved the source and left the
`*_reviewed` flag beside it. The app said *"Saved this field to the database"* while the
footer said *"Unsaved changes"*, with nothing on screen to save. The same press through
the button was fine. **Two paths to one operation must widen by the same rule.**

## 18. A phone is saved only when complete

Ten digits or empty, enforced in all three save paths — `commitPending`, the
`[data-save1]` click, and the input's own Enter handler. Add a phone field and you add
it to all three; the appraiser's was guarded in two of them and saved half-typed from
the third.

---

## 19. What a source row offers must outlive the page that loaded it

Every "Executed RS" row looks alike, so every one must behave alike. Two of them
did not: rows fed by a real saved field (`units.N.ua_exec`, written into the
record by `rsFillFromParsed`) still had their value tomorrow, while every row
calling `rsVal()` / `rsUnit()` / `rsBrBa()` read `_rsUpload` — a plain variable
set on upload and cleared by `openCycleForm` itself. So the same menu told two
different stories, and not only on refresh: leaving the form and coming straight
back was enough to lose the schedule while its numbers sat in the form.

The reading is now stored with its package (`cycle.rs_doc`, via
`getCycleRs` / `setCycleRs`) and rehydrated in `openCycleForm`. The PDF bytes are
deliberately NOT stored — nothing downstream reads `_rsUpload.bytes`. If you add
a new parsed source, store what it read, not the file it read it from.

**Why the audit missed this, which matters more than the bug:** every check in
that sweep was made inside ONE page load — change a cell, take it back, confirm
the form is clean. Nothing ever crossed a session boundary, and this defect does
not exist inside a single load. **Add the reload to the sweep:** after filling
from a document, reopen the package and confirm every source row still offers
what it offered a moment ago.

## 20. A locked cell displays a value AND stores it, on every path that opens a form

A cell whose answer comes from Kinley's database (`isLocked`, `RA_LOCKED` in app.js)
renders as text instead of an input. That value is not decoration: it names the package
in the header, it drives the record checks, and it prints on six documents. So
`applyRaLocked()` writes it INTO the form — **before `snapForm()`**, so a value nobody
can change never opens the form dirty asking to be saved.

**Why:** the write-through was added to `openCycleForm` and not to `openForm`. Through
that second door the locked value was painted over a record that had never received it:
the cell read "Colonial Village" while the header read "(unnamed property)" and Record
Checks said the property name was missing. Displaying and storing are one operation, and
it belongs to *opening a form*, not to one of the two functions that do it.

Two more things that fall out of the same idea:

- **Locked is not a fifth provenance colour.** The four all answer *is this saved?*; this
  one answers *who decides this*. It takes none of them — flat surface, neutral rule where
  the provenance bar would be. Not greyed out either: grey reads as broken rather than
  governed, and the value still has to be legible on a document nobody can retype.
- **Rule 7 does not apply to it, because nothing in it is focusable.** A locked cell holds
  no input, no trigger, no tabindex. That is the invariant to assert — a control you can
  reach but cannot use is the state rule 7 exists to prevent. And when a cell locks, the
  dropdown it replaces must be *gone*, not disabled: a menu offering two answers beside a
  value that answers to neither is a control that lies.

The refusal itself is rule 17's, not this one's: removing an input stops a person, and does
nothing about the rent-schedule parser, which sets these very keys from a document often a
year older than the record. Every fill asks `raLockedKey(k)` first.

## Before you deliver

`deliver.sh` runs most of this. Run it, then do the rest by hand.

1. `node --check` every edited source file, and **0 NUL bytes**
   (`LC_ALL=C tr -dc '\0' < FILE | wc -c`). Host `Write`/`Edit` on this mounted folder
   can truncate mid-write — edit in a sandbox, `cp` in, `cmp` to verify.
2. `bash app/full-mp/run_tests.sh` → `✓ every suite passed`.
   **Never pipe a suite through `| tail`**: a pipeline's exit status is the last
   command's, so node's failure vanishes. That is half of why a suite sat broken for
   eleven days. Adding checks? Raise `MIN_CHECKS`.
3. `bash app/full-mp/build.sh`, then `python3 app/full-mp/build-ra.py
   /tmp/rcs-ra-check.html` must print `built …` — mandatory after any `app.js` or
   `shell.head.html` edit, because Kinley's Azure port patches those files at build
   time through assert-guarded anchor strings.
4. **Drive the real bundle in a browser.** Node tests are not enough: provenance is
   painted twice, by `renderBody()` and by `paintCell(k)`, with different inputs. A test
   calling a render function directly passes while the app is visibly broken.
5. **Reopen the package.** Fill from an uploaded document, then leave the form
   and come back (and reload the page). Every source row must still offer what it
   offered before — see rule 19. A sweep confined to one page load cannot see a
   whole class of defect.
6. **Round-trip sweep.** For every control in `#viewForm` — `input[data-k]`,
   `input[data-srcedit]`, `input[data-cb]`, every `.uaopt`, `[data-csclear]`,
   `[data-fuel]`, `[data-fuel3]`, `[data-wibox]`, the conflict buttons, `#clAll` /
   `#clNone` — make the change, take it back, confirm `isDirty()` is false, and diff
   `form` against `FORMSNAP` key by key. `isDirty()` compares VALUES ONLY across ALL
   keys, so one hidden side-effect key strands the form dirty with nothing on screen.

   **This is now a loop, not a chore.** `node app/full-mp/test_browser.js` covers one
   of every kind on every run; `--full` drives all ~110 controls. It builds its own
   bundle and presses real keys, so it sees what a hand sweep across 200 controls never
   could. A finding here belongs in that file as a check, not in a markdown list — the
   last audit's 47 findings went stale the moment they were fixed.
7. **Measure at 1200, 1280 and 1920**, from computed style — never from a class name.
