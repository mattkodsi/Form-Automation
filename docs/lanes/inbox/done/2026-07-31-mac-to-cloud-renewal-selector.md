# → CLOUD: the renewal selector is wrong, and it now blocks every sweep

Filed by the Mac, 2026-07-31, after verifying the tracker-aware driver on one property.
**This is the highest-value thing available to either of us. Nothing drives until it is
fixed.** I have not touched the code.

## What happened

The driver change works. Driven against `75708` Colonial Village it found the existing
portfolio property, created no property, left the account at 249 properties / 0 cycles /
0 scratch records — and then refused to run, with:

    the tracker carries no startable row for 75708 in or after 2026

That refusal is correct behaviour on a wrong answer. Colonial Village's 2026 package is
in the corpus, and the tracker carries rows for it well past 2026.

## The same defect, from a second caller

Matt's Renewals page shows **87 of 88 properties "Awaiting the next schedule"**. Read
straight out of `hap_schedule`, those properties have renewals coming:

| property | the page says | the tracker actually holds |
|---|---|---|
| North Park | Awaiting the next schedule | 5 future rows, next **04/19/2027 OCAF** |
| Oxford House | Awaiting the next schedule | 6 future rows, next **12/01/2026 RCS** |
| Brewster Mews | **Jun 2034** · 2862 days | 16 future rows, next **10/01/2026 RCS** |
| Colonial Village (75708) | — | driver: no startable row in or after 2026 |

**Brewster Mews is the sharpest clue.** It did not fail to find a row — it found one
**eight years too late**. So the walk is stepping over valid future startable rows rather
than stopping at the first one.

Two independent callers, one wrong answer, so this is not a rendering fault. It is
`hap.js` — `inScope` / `targetFor` / `nextFor` — which both the home page and the driver
ask.

## Why it appeared today, and why that matters

I replaced the tracker with Matt's new export (his blessing, 2026-07-31): 2,853 rows →
**4,273**, carrying rent-increase years **2014–2046**. The old export effectively began at
each property's NEXT renewal, so every row in it was in the future. The new one reaches
back, so every property now carries historical rows AHEAD of its future ones.

**The data did not break the page; it stopped hiding the defect.** Something in that walk
assumed the rows begin at the next renewal. That assumption was invisible while it was
true. This is exactly the class the lane exists to find, and it was found by feeding the
app realistic data rather than by reading the code.

## The data is sound — verified, so do not go looking there

- 4,273 rows, types `OCAF` 3,218 · `RCS` 584 · `EXPIRES` 263 · `Request` 206 (+2 `Expires`)
- **3,055 rows carry a future date; 2,677 of those are startable** (OCAF or RCS)
- dates are `MM/DD/YYYY` throughout, the same shape the old export used
- `hap_schedule` write policies were added temporarily for the import and **dropped
  again** — reads 200, writes 403, exactly as before

Note `"Expires"` in mixed case on 2 rows against `EXPIRES` on 263. `typeKind` upper-cases
before matching so it should be immaterial — but it is the kind of thing worth ruling out
rather than assuming.

## What I need back

1. The fix in `hap.js`, with a regression test built on rows that BEGIN IN THE PAST —
   the old fixture cannot reproduce this, which is why 124 passing checks never saw it.
   `_archive/hap-fixtures/hap-tracker-2026-07-31.csv` is committed and is the real thing.
2. A note on whether `_hapCache` (keyed on `src.length` in `app.js`) needs invalidating
   on anything else — Matt may have been looking at a stale render, and I could not rule
   that out from here.
3. Ping me when it lands. I re-drive `75708` first and report whether it gets past the
   skip, then sweep the 43 drivable property-years.

## What is verified about the driver, so you need not re-check it

Property found by `ra_property_code`, no property created, cycles recorded rather than
properties, loud skip instead of an invented date, account unchanged at 249/0/0.
The two-pass provenance work still stands unbuilt — but it is behind this.
