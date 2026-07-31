# RA port (Kinley / Azure) — the anchor contract

Kinley's integration (received back 2026-07-16, reference copy in
`_archive/Kinley/ra-port-2026-07-16/`, kept out of git) treats this folder's
sources as **pristine** — he never edits them. His `build-ra.py` concatenates
them and applies **assert-guarded, in-memory patches** to swap the backend:

- drops `lib/supabase.min.js` + `config.js` + `db.supabase.js`, adds `db.cosmos.js`
- patches `app.js`/`shell.head.html`: Supabase auth → App Service Easy Auth (Entra),
  `makeSupabaseDb` → `makeCosmosDb`, the HUD SAFMR edge function → `/api/hud-safmr`,
  and wires our `window.RASource` seam to his AUM master registry
  (`aumIndex()`/`aumValue()` on the adapter — read-only; nothing writes back to AUM).

Every patch asserts **exactly one match**, so if a seam string in our sources
moves, his build fails loudly instead of silently shipping a broken port.

## What this means for us (the contract)

**`db.cosmos.js` and `build-ra.py` in this folder are the hand-back copies** —
updated by us whenever our changes move an anchor, and included in every source
drop we send him. They are NOT part of our own build (`build.sh`/`deliver.sh`
ignore them; our app still builds and ships on Supabase, unchanged).

**Post-edit gate** (add to the usual rebuild/NUL/syntax checks): after touching
`app.js` or `shell.head.html`, run

```bash
python3 app/full-mp/build-ra.py /tmp/rcs-ra-check.html
```

It must print `built … bytes`. If an assert fails, an anchor moved — update the
patch in `build-ra.py` to target the new text (keep the replacement's intent),
re-run, and mention it in the commit message so the change travels with the
next handoff.

## Current anchors in app.js / shell.head.html (don't move casually)

1. shell: the `#viewAuth` sign-in card markup (replaced with the RA access panel)
2. `mpdb=await makeSupabaseDb(supaClient);` (adapter swap + `window.RASource` injection)
3. the `supaClient.functions.invoke('hud-safmr'…)` block + its no-client guard
3b. **`ocr.js`** (new, tier-3 scanned rent schedules): the `ocrAnalyze` body — kept
   as one self-contained function marked `// ra-seam: the OCR endpoint` — plus the
   `if(!window.PDFLib||!supaClient)` guard in `ocrParseRs`. Patched to
   `fetch('/api/ocr-rs')`. **Related's side runs Document Intelligence inside its own
   tenancy** (container or managed resource), so a scanned schedule never leaves
   Azure; only the endpoint differs, and every line of the geometry is shared. The
   Azure side must return `{width,height,unit,angle,words:[{s,poly}],marks:[{on,poly}]}`
   for ONE page — see `supabase/functions/ocr-rs/index.ts` for the exact shape and why
   it is one page per call (the F0 tier silently drops all but the first two pages).
4. the `showAuthScreen` function body, the `bSignOut` handler, and the
   `DOMContentLoaded` boot block
(the create dialog needs NO patch anymore — `createProperty(name, pickedId)`
   passes the picked registry id through natively; the Supabase adapter ignores
   the 2nd arg, the RA adapter uses it for read-only AUM prefill)

## What the RASource seam is now ASKED for (2026-07-30)

`window.RASource.value(k)` was consulted only for per-cell source ROWS — an
offer the user could take or leave. It now also decides two cells outright:
whenever it answers, the cell stops being editable, because the renewal calendar
and this app cannot both own one fact.

| `k` | What the app does with an answer |
|---|---|
| `property.name` | Locks the name cell; the rename dialog becomes the tenant alias alone |
| `rent_schedule.date_rents_effective` | Locks the effective-date cell; stored as `date_eff_ra`, outranks the executed schedule and any typed date, and sets the package's own effective date |

Three things worth knowing on the Azure side:

1. **Answer only for properties AUM really covers.** `null` is not a failure — it
   means "this app owns the field", which is exactly right for a property somebody
   created here. The lock is conditional on a non-null answer, so nothing needs a
   flag or a tracker code.
2. **Any date shape is fine.** `mm/dd/yyyy` and ISO both parse; anything else is
   treated as no answer rather than guessed at.
3. **The answer is read when a form OPENS, and frozen into that package.** Changing
   the row afterwards does not move a package already under way — deliberately, and
   the tooltip on the cell says so. A new package picks up the new answer.

Note on escaping: `build-ra.py` is Python — any literal `\uXXXX` text inside our
JS (e.g. in comments) must be written double-backslashed in its anchor strings.

## Divergence status (2026-07-16)

His returned sources = our commit `669f875` exactly (app.js/shell byte-identical;
core/db/gen/xlsx/templates/tests identical to current). Our later commits
(`616f863` Navigator sourcing UI, `d915338` menu restyle) are what his copy is
missing — the updated `build-ra.py` here already targets them, so sending him
the current folder + these two files is a complete, verified handoff.
