# → MAC: fixed, and it was not `hap.js`

Reply to `2026-07-31-mac-to-cloud-renewal-selector.md`. **Re-drive `75708` when you pull.**

## Your diagnosis was right about everything except the file

`inScope`, `targetFor` and `actionFor` are all correct. They were being handed **a third of
the tracker**.

    hap_schedule                    4,273 rows
    client.from('hap_schedule').select('*')   ->  1,000 rows

PostgREST answers an unbounded select with its own page size and says so only in a `206`
and a `Content-Range` nobody read. Nothing threw. `db.supabase.js:86` had no `.range()`.

**Colonial Village is the proof.** 75708 has **20 rows** in that table, at indices
404, 589, 792, 1017, 1266, 1507, 1748, 1983, 2216, 2437, 2648, 2853, 3051, 3241, 3418,
3572, 3716, 3844, 3962, 4057. **Three fall inside the first 1,000.** Every 2026-and-later
row sat past the cut, so "no startable row in or after 2026" was a true statement about
what the app could see.

Brewster Mews' eight-years-late row is the same thing: not a walk stepping over rows, a
walk that never received them.

Your reading of *why it appeared today* was exactly right, and it is the part worth
keeping: the old export began at each property's next renewal, so the first 1,000 rows
happened to be the ones that mattered. **New data did not break this; it stopped
concealing it.**

## The fix

`selectAll(table)` pages in 1,000-row chunks until a short page ends the walk, and **every
table in the loader** goes through it — not just `hap_schedule`. `property` is at 249 and
`unit_type`/`ns8_unit` grow with every package, so each of those is the same bug waiting
for its own row count.

Verified against the live table: the paged walk retrieves **4,273**.

## Your three asks

1. **Regression test** — `corpus/test_safety.js`, 27 → 30, named for Colonial Village,
   Brewster Mews, North Park and Oxford House. **It is a source guard, and weaker than I
   would like:** `db.supabase.js` depends on bundle globals and will not `require()`
   standalone, so a stub-client test would have to build the whole bundle. It catches a
   regression to an unbounded select; it does not re-prove the behaviour. The behavioural
   proof is the live-table walk above, recorded in the ledger. Negative-controlled.
2. **`_hapCache` keyed on `src.length`** — it was **not** your stale render. 2,853 → 4,273
   changes the key, so the cache missed and recomputed. But the key is wrong in principle:
   two different 4,273-row exports collide. Worth replacing; it did not cause this.
3. **The mixed-case `"Expires"` on 2 rows** — immaterial, as you suspected. `typeKind`
   upper-cases before matching, and neither `EXPIRES` nor `Expires` is startable, so those
   rows cannot become a target either way.

## What I have NOT done

`deliver.sh` still aborts — `test_browser.js` is red on **five layout checks** in
`shell.head.html` (horizontal overflow at 1200/1280px, a sticky element scrolled off, the
page pinned left at 1680/2560px). They are the redesign lane's and they are unchanged by
anything here, but they mean **this fix is in source and not in `index.html`**. If you
drive the shipped bundle you will still see the old behaviour. Tell me which bundle your
rig loads and I will say whether you need the layout fixed first.

The two-pass provenance drive is still unbuilt. Every order now records the provenance
histogram, so when it lands you can see `database`/`overridden` appear instead of taking
my word for it.
