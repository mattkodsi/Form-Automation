# RCS corpus audit — ledger

Started 2026-07-31 on branch `rcs-audit`, per `docs/lanes/rcs-audit-run.md`.

Row format, per the method: `property · year · document · field · SHOULD · OURS ·
FILED · verdict · mechanism · evidence`. The verdict names the leg that is wrong —
`app wrong`, `team wrong`, `both wrong`, `cosmetic`. FILED is evidence, never the
referee. A row with no evidence does not count. A row whose mechanism is not traced
stays `undiagnosed`, and no repair is written against an undiagnosed row.

---

## RUN BLOCKER — the OURS leg produced nothing, corpus-wide

**Status: open. Needs Matt. Nothing about the app can be concluded until it clears.**

The first sweep (`--only 75708 --jobs 1 --label cv`) generated no documents at all:

```
[1/1] Colonial Village 2026 (RCS)        the app generated nothing comparable
```

Cause, read out of `_archive/corpus-cache/_sweep/cv.json` — both fill orders failed
identically, before the browser ever drove the form:

```
the stored session expired ...s ago and the refresh token was refused
(400: Invalid Refresh Token: Already Used)
```

Confirmed independently with a direct `grant_type=refresh_token` call to Supabase:
**HTTP 400, `Invalid Refresh Token: Already Used`.**

Why it cannot be fixed from inside the container:

- Supabase **rotates** refresh tokens: each successful refresh consumes the old one
  and issues a new one. `RCS_SUPABASE_REFRESH_TOKEN` holds a token that was already
  spent, and the replacement went to whatever spent it.
- There is no session file at `_archive/corpus-cache/.session.json` — the cache is
  gitignored and this is a fresh clone, exactly the cloud-runner case `loadSession`
  documents.
- `signin.js` is the only thing that can mint a new session, and by design it asks
  for the password interactively and never stores it. It cannot run unattended.

This would have failed identically on all 88 cycles, so per the run order's
"stop and say so" rule the corpus sweep was **not** started.

**To unblock:** either run `node app/full-mp/corpus/signin.js` on a machine with a
terminal and let the harness pick up the session file, or export a *fresh, unused*
`RCS_SUPABASE_REFRESH_TOKEN`.

### What was done instead

The two legs that need no app session were run: **SHOULD** (the governing sources,
read as images) and **FILED** (what the PM team submitted). SHOULD is the expensive,
reusable half — once a session exists, OURS drops into rows whose SHOULD column is
already written. Rows produced this way carry `OURS = n/a (not generated)` and can
only reach the verdicts `team wrong`, `agrees`, `cosmetic` or `undetermined`.
**No `app wrong` verdict is reachable tonight.**

---

## Handed to the redesign lane — not repaired here

`test_browser.js`, 539 checks, 5 failed. All viewport/layout; `shell.head.html`
styling belongs to another lane, so these are written down rather than fixed
(run order step 5: "record them and carry on").

| # | check | got | want |
|---|---|---|---|
| 1 | 1200px: the page does not scroll sideways | true | false |
| 2 | 1280px: the page does not scroll sideways | true | false |
| 3 | …and sits at the top of the screen, not scrolled off it | false | true |
| 4 | at 1680px the page is centred, not pinned left | false | true |
| 5 | at 2560px the page is centred, not pinned left | false | true |

Checks 1–2 say the page scrolls horizontally at common laptop widths, which is a
real usability defect rather than a cosmetic one. Not diagnosed here.

---

## Findings

None recorded yet — the first package's reading pass is in flight.
