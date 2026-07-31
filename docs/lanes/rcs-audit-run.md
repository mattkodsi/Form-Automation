# The run order — read this, then go

Matt's instruction, 2026-07-31: **no separate trial gate. Start the audit tonight.**
Colonial Village goes first so there is one checkable result early, and the sweep
continues without waiting for anyone to approve it.

Cherry Garden was the earlier designation and is **postponed** — it is one of the eight
properties the manifest cannot see (see the warning at the top of
`rcs-audit-inventory.md`). Do not spend the night making it visible.

## Order of work

1. **`git pull`.** `.claude/settings.json` now allows the read-only rclone verbs, which
   is what blocked the corpus fetch.

2. **Fetch the corpus** to `$HOME/corpus` — outside the repo, it is ~4 GB and must never
   be committed:

       rclone copy gd: $HOME/corpus --fast-list --transfers 16 --progress

3. **Fix chromium, in THREE places.** Your `findChrome()` patch is accepted — honour
   `PLAYWRIGHT_BROWSERS_PATH` / `CHROME_PATH`, and pass `--no-sandbox` only at uid 0.
   But there are three spawn sites, not one, and the third landed today so you have not
   seen it:

   | file | what it needs |
   |---|---|
   | `app/full-mp/cdplib.js` | `findChrome()` **and** the spawn args |
   | `app/full-mp/corpus/drive.js` | its own `findChrome()` **and** spawn args |
   | `app/full-mp/fuzz.js` | spawn args only — it imports `findChrome` from cdplib |

   `fuzz.js`'s `withBundle()` exists to serve a deliberately broken bundle to the storm's
   proof suite. Miss it and `test_fuzz.js` fails as root while everything else passes.

   **A suite that reports 0 checks must fail, not pass.** You found `test_browser.js`
   doing exactly that. `MIN_CHECKS` was supposed to make that impossible; a skip that
   returns before reaching its own floor defeats it. Fix that too — it is the same shape
   as a planted defect that silently fails to apply, and it is worth more than the
   container it was found in.

4. **Rebuild the manifest** against the real corpus and commit it:

       node app/full-mp/corpus/build-manifest.js $HOME/corpus app/full-mp/corpus/corpus.json

5. **`bash app/full-mp/run_tests.sh`** must be green before driving anything. Fourteen
   suites. If the viewport failures reappear, record them and carry on — CSS belongs to
   another lane; nothing else may be red.

6. **Colonial Village first**, both fill orders, storm on:

       node app/full-mp/corpus/sweep.js $HOME/corpus _archive/corpus-cache \
         app/full-mp/corpus/corpus.json --only 75708 --jobs 1 --label cv

   Read what it produced BY EYE — render the pages, look at them — against Colonial
   Village's own sources. Commit the result. If the package is obviously wrong in a way
   that would repeat across every property, stop and say so; otherwise continue.

7. **The rest of the corpus**, ~3 jobs:

       node app/full-mp/corpus/sweep.js $HOME/corpus _archive/corpus-cache \
         app/full-mp/corpus/corpus.json --jobs 3 --label night-1

## Rails — all of these have bitten

- **Runs write `ZZ-CORPUS-*` properties into Matt's LIVE account.** Delete them after
  every batch and verify zero remain:
  `node app/full-mp/corpus/drive.js --cleanup --prefix ZZ-CORPUS-`
  Never delete anything without that prefix. A property total is NOT a safety check.
- **Commit and push after every few packages.** The session can idle out with no warning
  and the docs do not say when; uncommitted work is lost work. `sweep.js` writes one file
  per package and resumes, so a death costs one package if you have been pushing.
- **Never pipe a suite through `| tail`** — the exit status becomes tail's.
- **Do not use `find` on the corpus.** It returns nothing on a Drive mount, silently.
- **Never edit `index.html` by hand**; edit `app/full-mp/*` and run `deliver.sh`.
- **Stay out of `app.js` lines 2720–2867 and `shell.head.html` styling** — another lane
  owns them. A finding that needs a UI change gets written down, not fixed.

## What to report

Per the method: `property · year · document · field · SHOULD · OURS · FILED · verdict ·
mechanism · evidence`, verdict naming which leg is wrong. FILED is evidence, not truth.
Findings without evidence do not count. Append to
`docs/superpowers/plans/AUDIT-LEDGER.md` and push.

**Also report what the storm found.** It runs on every package with its own seed and
needs no ground truth, so its violations are findable tonight even where a comparison is
not. Every violation carries the seed that replays it.

Do not wait for approval between packages. Matt is asleep.

---

## Fan out. Do not read the corpus in your own context.

Added after the run started, because the file above did not say it and it decides
whether the night finishes.

**The mechanical leg is already parallel** — `sweep.js --jobs 3` drives three browsers
at once. That is not what this section is about.

**The reading leg is the one that will kill you.** The method says every page of every
document is rendered and read BY EYE. That is images, dozens per package, across ~68
packages. Done in one context it exhausts the window somewhere around package three,
and everything after that is a summary of a summary — which is exactly the failure this
lane was created to stop.

So: **one subagent per package.** It reads the pages, and it returns rows — never the
pages, never long quotations of what it saw. Your context holds the ledger, the
mechanism traces and the repairs; theirs holds the documents.

Run **4–6 at a time**. Beyond that the drives contend and the account fills with
scratch records faster than cleanup runs.

### The brief each one gets

> Audit ONE package end to end: `<property>`, cycle `<label>`. Observation only — do not
> edit code, do not fix anything, do not run `deliver.sh`, do not push.
>
> 1. Read the SOURCES first and write down what the package must contain, BEFORE opening
>    any output: the RCS study's concluded-rent table and the prior executed rent
>    schedule. Read them as IMAGES (the Read tool's `pages:` parameter). Do NOT use a
>    text parser — the parser is the thing under test and has produced confident
>    nonsense before.
> 2. Read what the app generated, in both fill orders, under the sweep's `_out` tree.
>    Same rule: look at the pages.
> 3. Read what the PM team filed, in the property's cycle folder.
> 4. Return ledger rows ONLY:
>    `property · year · document · field · SHOULD · OURS · FILED · verdict · where you
>    read each value (file + page)`. Verdict is one of `app wrong`, `team wrong`,
>    `both wrong`, `cosmetic`.
> 5. EXACT values. If you cannot read something, say so — never infer a number, and
>    never fill a gap with what the other two legs say.
> 6. Do not propose fixes. The mechanism trace and the repair belong to the coordinator.

### What you do with what comes back

Append rows to `docs/superpowers/plans/AUDIT-LEDGER.md` and **push after every wave**,
not at the end. A row whose mechanism is not traced stays `undiagnosed`, and no repair
is written against an undiagnosed row.

Fix by MECHANISM, never by property, and never from a single property: either two
properties show it or a code reading shows it is general. Repairs are serialized — one
at a time, by you, never by a subagent — because one mechanism usually spans many
properties and two agents editing `app.js` collide.
