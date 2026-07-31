# Handoff — the form joins the desk

Branch `form-redesign`, in `/Users/matthewkodsi/Desktop/github/Form-Automation-UI`.
Four commits, `origin/main` merged in, every suite green at HEAD.

Serve it: `bash serve.sh` → <http://localhost:8081/index.html?selftest=1>

---

## What this was

The four non-form views moved into the housing-authority file room in July and the
form was deliberately left on the old chrome. This extends the redesign to
`#viewForm`, built from `docs/design/2026-07-28-form-redesign.html` and held to
`docs/design/2026-07-28-style-guide.html`.

## The one thing that is not a restyle

**A cell no longer states its save state by flooding itself with colour.** Every
cell now sits on the same inset surface — a field is a box you write in, so it is a
step darker than the card holding it — and the answer is a **3px rule down its left
edge**. That is the same marker the home page uses for urgency and the launcher for
which package: one marker, learned once, true at three scales.

Two states keep a wash as well — parsed and overridden — because those are the two
that want your hands. Hue is spent only where it asks for something.

The four hues are untouched, and `borderLeftColor` on `[data-box]` is still what the
suite reads. What moved is `CLR`'s fills in `app.js`, twinned with the
`--prov-*-fill` tokens in the new `#viewForm` block. `FORM-RULES.md`'s table now
describes rules and washes rather than four fills.

## Where the code is

- **`app/full-mp/shell.head.html`** — one block, last in the sheet, headed
  `THE FORM — the desk, extended`. Scoped to `#viewForm` so it cannot reach the four
  signed-off views; last so it wins the cascade **without a single `!important`**.
  The legacy token names are kept and **re-pointed** rather than renamed: two lanes
  share this file, and a rename touches every line while a re-point touches one block.
- **`app/full-mp/app.js`** — `CLR`'s fills, `liftClr`, the pass/over/wait classes on
  `.passbox`, and the presentation hexes in the strip and `#ccbar`. Nothing inside
  lines 2720–2867 (`renderOcaf` / `renderUaf`) was touched.

## Four things this found that were not restyling

1. `line-height:1.5` made a text cell 40.25px inside a 36px dropdown trigger, so the
   focus ring stopped being the same box as the control it was ringing. Stated at
   18px, the cell is the 38px the mockup draws.
2. A blanket `:focus-visible` ringed the `<input>` **and** the cell holding it, and
   the inner ring covered the provenance rule — the one answer you cannot take away
   while somebody is typing. Focus is now indicated once per stop.
3. Reduced motion's `transform:none` parked the rail indicator at the top of the
   rail, for exactly the reader who most needs position to be the indicator.
   Transitions go; transforms do not.
4. An `#id` rule restating input padding outranked the ≤1340px block that keeps
   four-digit figures from clipping — and tabular figures are wider than the
   proportional ones this form used to set. Measured clean at 1200 / 1280 / 1920.

Plus two the merge with `main` created: `.cc{overflow:hidden}` would have clipped
the record-checks hover panel, and the `#id` cell rule handed `main`'s new
`.fbox.locked` the grey that means "new — nothing on file". Both fixed; the locked
cell was verified through `?ra=1`.

## Verified

    bash app/full-mp/run_tests.sh              ✓ every suite passed
    bash app/full-mp/build.sh                  index.html rebuilds
    python3 app/full-mp/build-ra.py /tmp/x     built …
    node app/full-mp/shots.js                  54 images, reviewed by eye

`index.html` after a merge is **rebuilt, never trusted**: git will merge the
deliverable textually and produce something that is neither side's build. That is
its own commit here.

## Open / not signed off

- **Sections 10 and 11 (OCAF worksheet, UAF matrix)** got the token pass they never
  had — six hexes the desk does not contain — but were **not looked at**. Driving a
  package with those programs from `?selftest=1` did not get the sections to render
  (`__openCycleForm` returns with the header still saying "RCS Package"); the markup
  belongs to another lane. Somebody with an OCAF package in front of them should
  look before this is called done.
- **`test_browser.js --full`** (all ~110 controls, rather than one of each kind) was
  started and not finished — it runs past ten minutes. The standard 539-check run is
  green; the full sweep is still owed.
- **A flake worth naming, not dismissing.** One run in four, `test_browser.js` failed
  two checks in the *menu's* past-due bob — "arriving at the top by a fast wheel …
  and opens nothing / and leaves the page at the top: got 163 want 0". Nothing in
  this lane touches `#menuPastBar`, and it passed on every rerun. This project's
  standing rule is that a flake is a code claim until proved otherwise, so it is
  written down here rather than waved off.
- **No night mode.** The style guide draws one; the shipped app has never had one,
  and adding it to the form alone would have made the form the only view with it.
