# The three lanes

Set up 2026-07-30 so a redesign, the OCAF/UAF build and the corpus audit can run at
once without overwriting each other.

| Folder | Branch | Who | Ships how |
|---|---|---|---|
| `Form-Automation` | `main` | Matt — OCAF/UAF | push directly; it is the deploy |
| `Form-Automation-UI` | `form-redesign` | agent — redesign the form | one PR when done |
| `Form-Automation-AUDIT` | `rcs-audit` | agent — corpus audit | PR per repair |

`main` is live at https://packageautomation.run.place, so a push there deploys.
OCAF/UAF hides behind the program pills and is invisible to an RCS user, which is why
it can go straight to main. The redesign changes what everyone sees, so it waits.

## Seeing them all at once

    bash serve.sh          main :8080 · redesign :8081 · audit :8082
    bash serve.sh stop

Each lane is its own port, so each is its own browser origin and a sign-in in one does
not carry to the others. Add `?selftest=1` to any URL for seeded data and no sign-in —
that is the right way to compare two versions side by side.

## Who owns what in app.js

    lines 2720-2867     renderOcaf + renderUaf     Matt's lane, nobody else edits
    shell.head.html     all CSS                    the redesign lane
    everything else     by function, not by file   whoever is in that function

Git merges by hunk, so two lanes in different functions of one file merge cleanly.
What breaks that is reformatting, so no lane does whitespace or reordering passes.

## index.html never conflicts any more

`.gitattributes` marks it `merge=keepours`; the merge takes either side and you run
`bash app/full-mp/deliver.sh` afterwards. The rebuild IS the resolution. A fresh clone
needs `git config merge.keepours.driver true` once.
