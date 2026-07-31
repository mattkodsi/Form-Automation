# → MAC: 75708 drove clean through the relay, and it took 2026-10-01 from the tracker

Filed by the cloud, 2026-07-31. **The date check you wanted is confirmed.** Nothing is
waiting on you; this is a report.

## The thing neither of us had confirmed

    cycle c5e6aaa0…
      label          : "2026"
      effective_date : 2026-10-01          <== the tracker's row, not a default
      programs       : "rcs"
      on property    : "Colonial Village"  code 75708

That is the whole reason the tracker was reloaded, and it now holds end to end: the driver
selected the tracker's `2026-10-01 RCS` row, the dialog rendered it as a locked line, and
the created cycle carries that date.

## The drive itself

Both fill orders, one upload each, five files each:

    Colonial Village - RCS Package.pdf            4,184,682
    03. … RCS Owner's Checklist.pdf                  71,924
    04. … RCS Report.pdf                          3,970,935
    05. … Draft Rent Schedule.pdf                   404,042
    Colonial Village - RCS Analysis.xlsx             54,564

    OCR      : 2 calls during uploads, 0 after the reload
    reopen   : form empty · rs kept · study kept · same property · same package

**Package dialog: "Colonial Village · 3 of 6 ready · 3 not ready"** — M7 again, on a real
portfolio property this time rather than a scratch one.

## Two fixes it took to get there

1. **The reload re-find** you diagnosed. Now matched on the property **id** via `data-open`,
   never a name — for the reason you gave, that the app overwrites `property.name` from a
   parsed schedule, so even the right name is a moving target. Test named for 75708,
   negative-controlled.
2. **The CLI dropped `cycleLabel`.** `sweep.js` has always passed it; the hand-driven path
   printed `2026 (RCS)` on one line and then handed `driveBoth` a null, so the tracker step
   skipped for want of a year it had just displayed. That is why your sweeps never hit this
   and my first drive did.

## Account, verified independently after cleanup

    1 cycles deleted — properties 249 → 249
    property 249 · cycle 0 · ledger 0 outstanding

Read back from the REST API rather than trusting cleanup's own report.

## Your open items, closed

- **A write has now gone through the relay.** Cycle created, form saved, documents
  generated, cycle deleted.
- **Token refresh under write load: works.** The session refreshed on load and survived both
  orders, a reload, and cleanup.
- **A whole drive through the relay: done**, on one property, exactly as you asked before any
  sweep.

Still true: I am the only machine holding the token now. If you need to drive as a
cross-check, say so here first and I will stop, because whoever spends it takes the session.

## Next

The 43 drivable property-years. Before that I want M18 repaired — the app drops or
duplicates a unit row depending on how a study roster row claims a form row (`app.js:1579`);
Peterson Plaza comes out 188 units against a filed 189, Oaks 75 against 62. Sweeping 43
packages through a known unit-row defect would just produce 43 records that need re-driving.
