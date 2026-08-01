# Provenance / dropdown audit — what is left

State as of 2026-07-27. Discovery is **complete**: three passes (source inventory of
every provenance-bearing cell, CSS/geometry, and a browser pass driving real
keystrokes) produced 47 numbered inconsistencies plus 8 browser findings. Everything
that corrupts data, strands the form dirty, or makes a control lie is **fixed and
verified** — see `FORM-RULES.md` for the rules those fixes established.

What follows is what remains. Nothing here is a repair; it is missing features, two
style decisions, and one deferred geometry sweep.

---

## A. Cells with no source dropdown, where the data exists

The biggest block, and the only one that is real feature work. Each needs a source
registered (`SRCPICK_ROWS` / `SRCGROUP` / `DIR_SRCROW`) and wired to its lookup.
Rule 1 in `FORM-RULES.md` applies: register the source even when it is empty today,
and let the row render dim.

| Cells | Data that exists and is not offered |
|---|---|
| all 25 Part B keys — equipment, utilities, fuel letters, services, 12 write-ins | `rsPartB` parses every one of them; `rsFillFromParsed` writes them |
| `uaf.f_oil` / `f_gas` / `f_electric` / `f_water` | filled by `pullUafFactors` from HUD USER — while the analogous `ocaf.factor_pub` has a Federal Register row |
| `poc.email`, `poc.phone` | `raVal()` reads both inside the `[data-pocra]` handler; only `poc.name` exposes them |
| `tenant.property_alias` | derived by the parser from the schedule's slash-separated name |
| `ca.addr_*`, `tenant.mgmt_*` | no group picker at all, where `property.addr` has one |
| `nonrev.N.num_units` | **deliberate exception** — HUD-92458 Part D has no unit-count field, so there is no source to declare. Do not "fix" this. |

Also unwired but with no data behind them yet, so honest as they stand:
`appr.firm` / `appr.email` / `appr.phone` and `property.name`'s RCS row are permanently
dim because **RCS-report parsing does not exist**. They light up when it lands.

## B. Two style decisions — need Matt, not a fix

1. **Clearability.** Five `csDrop` cells are mouse-clearable (✕); three are not
   (`owner.entity_type`, and the address state in `compAddrCell` and `mgmtCell`). The
   unit designation uses neither — it has an explicit `— No designation` menu row. All
   nine clear from the keyboard with Backspace, so the mouse is the odd one out.
   **Pick one pattern and apply it to all nine.**
2. **Source-row sets differ per cell with no visible rule.** `property.name` offers
   RS/RA/RCS, `property.fha` RS/RA, `property.s8` RS/RCS, `poc.name` RA/RCS with no RS,
   `tenant.sender_name` RA only. Some of that is real (a source genuinely has nothing
   for that field); some looks arbitrary. Worth one pass to say which is which.

## C. Deferred geometry — the third grid

The Section 6 unit rows and the Part D / non-Section-8 rows both now put their
save/revert pair BELOW the row (`.uracts`), measured Δ0px at 1200/1280/1920. **The OCAF
and UAF cells still carry theirs inside the box** — `ocaf.ds_annual` / `ds_t12` /
`ds_f12` / `ocaf.g`, `uaf.f_*`, `units.N.uac_*`, and `ocaf.factor_custom`. Same
treatment, different section.

Watch `ocafFactorCell`'s inline `max-width:330px` when you do: its `.uac-in` carries
`flex:1 1 34px` which overrides the inline `width:78px`, so adding an `.ovic` inside a
capped box likely changes the cell's width when edited — the exact defect the unit rows
were fixed for. **Needs measurement.**

## D. Smaller, known

- `dateEffCell` and `ocafFactorCell` render no save/revert pair at all in their
  non-custom mode — the pair appears only after switching to Custom.
- `mgmtCell` shows its pair only when `tenant.mgmt_source` is already `overridden`; a
  "new" state has no ✓.
- `dateEffCell`'s source row is tagged with a sentence — its dim state reads
  `— A year after the executed RS · not available`, where every other row reads
  `— Executed RS · not available`.
- `ocafFactorCell` offers no in-place `.srcedit` input, so you cannot type over the
  published factor the way you can over a UA, a SAFMR or the RS date.
- A `.rbox.brba` still sets `data-box` to the bedroom key only. `cellActBtn` now takes
  an explicit key so Enter and Escape hit the right sub-cell, but the underlying
  identity is still shared.

## E. Verified only in source — never reached in a browser

- ~~`[data-typ]` / `[data-num]`, the unit-type and unit-count conflict buttons.~~
  **Reached 2026-07-27.** The seeded record holds no conflict, which is why they never
  rendered; `test_browser.js` synthesises one (`units.0.br_rcs`, `units.0.num_rcs`),
  drives both buttons, and holds three things in place: the conflict renders both ways
  out, resolving it clears the conflict, and the `*_reviewed` flag does not outlive it
  (rule 14). No defect found — the source-only fixes were right.
- The **live** OCAF and UAF factor pulls. The edge functions return 401 when not signed
  in, so the round-trip was verified against a synthesised saved factor; the network
  path is untested. **Still out of reach** — the stub database cannot fake an
  authenticated edge function, so this needs Matt or a real session.

## F. Page-frame geometry at non-1920 widths — three `test_browser` checks (2026-08-01)

Measured driving the real bundle at several viewport widths. One was a clear bug and
is **fixed** (2026-08-01, `18df2db`); three remain and each is a design question, not
an obvious defect.

- **FIXED — the form scrolled sideways at 1200 and 1280px.** Every section is a `.cols`
  grid (`calc(50% - 23px) 1fr`); the `1fr` track's `auto` min-content (the
  point-of-contact email box, ~490px) exceeded its fr share and grew the grid 62px past
  its column. `minmax(0,1fr)` lets the track shrink to its share — the email input takes
  the slack. Measured clean at 1200/1280/1920px, nothing clipped.
- **The page is pinned left, not centred, at 1680 and 2560px.** On a wide display the
  form sits against the left edge with all the whitespace on the right. This may be
  intended (a left-aligned max-width layout is a legitimate choice) or an oversight
  (a missing `margin:0 auto`). **Needs Matt** — do not "fix" it to match the test until
  the intent is known; the test asserts centring, which is a preference, not a rule.
- **After a jump-to, the target heading sits under the sticky command bar rather than
  clearing it at one width.** `test_browser` wants the pinned heading's top within 2px
  of the screen top; it measured off-screen. Could be a real scroll-offset-vs-bar-height
  gap, or specific to the test's viewport. **Needs a per-width measurement** before it is
  called a bug — the sticky-chrome shots (`36`–`38`, `46`–`48`) are the right lens.

---

## How to verify anything here

`FORM-RULES.md` → "Before you deliver". In short: sandbox the edit, `cmp` it in, run
`bash app/full-mp/run_tests.sh` (must print `✓ every suite passed`), build, clear the
RA-port anchor gate, then **drive the real bundle in a browser** — provenance is painted
twice and the two renderers can disagree.
