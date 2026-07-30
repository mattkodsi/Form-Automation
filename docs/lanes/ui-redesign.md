# Lane brief — extend the redesign to the form

Paste this to the chat doing the redesign. Matt should be able to read it in a minute;
if a rule here needs a paragraph to justify, it belongs in FORM-RULES.md instead.

## Where you work

    /Users/matthewkodsi/Desktop/github/Form-Automation-UI      branch: form-redesign

`cd` there at the START of every shell command. The working directory drifts to the
main checkout, which is a different branch, and a destructive command run there does
real damage. That has happened more than once.

## The five rules

1. **Stay out of `app.js` lines 2720–2867.** That is `renderOcaf` and `renderUaf`, and
   another lane owns them. If a change seems to need them, stop and say so.

2. **No reformatting.** No whitespace passes, no reflowing, no reordering `app.js`.
   Two lanes share this file and merge cleanly only while you each stay in your own
   functions. A tidy-up pass turns a clean merge into a week.

3. **Never hand-edit `index.html`.** It is built. Edit `shell.head.html` / `app.js`,
   then `bash app/full-mp/deliver.sh`.

4. **Merge `origin/main` into this branch every day.** Not at the end. Two branches
   were once left to drift 113 commits apart and it cost a full session to reunite.

5. **Read `app/full-mp/FORM-RULES.md` before touching a cell, a dropdown or a click
   handler.** Eighteen rules, each written because breaking it shipped a bug.

## What is already a contract, not a preference

These have tests. Changing them means changing the tests, which means arguing for it
first — they are not loose ends the redesign is free to tidy:

- Tab order walks the columns in reading order (`.cols { grid-auto-flow: column }`)
- All 83 dropdown triggers show a focus ring
- `#ccbar` is ONE line, 32px, at every width — the section rail's jump offset depends on it
- The section rail: ten rows that jump, one indicator that travels
- The five provenance colours mean what `CLR` says they mean

## Done means

    bash app/full-mp/run_tests.sh          every suite green
    bash app/full-mp/deliver.sh            index.html rebuilds
    python3 app/full-mp/build-ra.py /tmp/x.html    must print "built"

That last one matters most and is the one a redesign breaks. Kinley's Azure port finds
its place in our code by matching literal sentences; move them and his build breaks
silently. If it fails, fix the anchor in `build-ra.py` and say that you did.

Then look at it: `node app/full-mp/shots.js` writes 46 images. A test cannot see two
colours that are the same colour, or a bar covering the heading you just jumped to.
