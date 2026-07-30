# The home page becomes a schedule

2026-07-29. Supersedes the two-zone menu of `2026-07-28-home-navigation-design.md`,
which kept its structure.

## What it is

The property list stops being a set of buckets and becomes **one continuous
schedule on the deadline axis**. It runs from the earliest deadline the tracker
carries to the last one, a month heading over each month, a today-line drawn in
its true position, and a countdown on every row. It moves through time on its
own: as days pass the line slides down and the rows above it accumulate.

Nothing is lifted out of it. There is no live panel, no "past their date" bucket,
no state-named group. Every division on the page is a point in time.

## The shape it has to hold

229 properties, 16 months, Dec 2025 → Sep 2027, against the real tracker on
2026-07-29:

```
  Dec 2025    1   behind
  Apr 2026   11   behind
  May 2026   20   behind
  Jun 2026   29   behind
  Jul 2026   22   behind 21, ahead 1   <-- straddles today
  Aug 2026   20
  Sep 2026   31
  Oct 2026   12
  Nov 2026    3
  Dec 2026   18
  Jan 2027   14
  Feb 2027   19
  Mar 2027   22
  Apr 2027    3
  Jun 2027    1
  Sep 2027    2
```

Three facts the design has to answer to:

- **It is flat.** The front eight months carry 12–31 each. This is a steady
  ~20/month workload for a year, not a spike with a tail. So the page cannot be
  built around "the urgent few" — the whole year is the subject.
- **82 properties are behind the line** — 36% of the portfolio, the oldest 240
  days back. Too many to treat as an exception, too many to leave unannounced.
- **The horizon is ragged.** Apr 2027 has 3, then a gap, then 1, then 2. The CSV
  dribbles out rather than ending, so the bottom of the page is thin by nature
  and must not read as an error.

## Structure

One grid. Rows in deadline order, ascending, always — the sort is not a choice
the user makes, because a schedule with a configurable order is not a schedule.

```
 ┌──────────────────────────────────────────────────────────────┐
 │  ↑  82 past due          TODAY · July 29, 2026               │  pinned
 ├──────────────────────────────────────────────────────────────┤
 │  Aug 2026                                                    │
 │  Bellhaven Court      OCAF   due Aug 3 · 5 days      92 units│
 │  Grandview            OCAF   due Aug 7 · 9 days     140 units│
 │  …                                                           │
```

Scrolled up, above the line:

```
 │  Jun 2026                                                    │
 │  Northpoint           OCAF   was due Jun 1 · 58 days ago     │
 │  …                                                           │
 │  Jul 2026                                                    │
 │  Cedar Run            OCAF   was due Jul 25 · 4 days ago     │
 │  ─────────────  TODAY · Jul 29, 2026  ───────────────────────│
 │  Milford Green        OCAF   due Jul 31 · 2 days             │
 │  Aug 2026                                                    │
```

### The today-line

A row in the flow, not a boundary between headings — July 2026 straddles it, so
it must be able to sit mid-group. It is **sticky**: pinned to the top of the
viewport while you are below it, unpinned and travelling as an ordinary divider
once you scroll above it.

It carries `↑ 82 past due` while pinned. That count is the affordance: clicking it
jumps to the top of the schedule. This is the whole answer to option A's one
flaw — that the past is off-screen upward on load — and it is why no panel is
needed.

Month headings do not stick. One sticky element per view; two would fight.

### Landing scroll

The page opens scrolled to the today-line. **On first paint only.** `renderMenu`
rebuilds the entire list on every filter change and every search keystroke; a
scroll applied on each rebuild would yank the page while the user types. So the
scroll is a one-shot on the first render of a session, and every render after it
holds whatever position the user is at.

### Off the axis

A property with no deadline cannot sit on a deadline timeline. Those keep the
existing group at the very bottom, below the last month, under its own heading —
they are not part of the schedule and must not read as its tail. Today this is
Fox Hill alone (a schedule gap: rows end on an EXPIRES in 2027, contract runs to
2045) plus the records the tracker does not carry at all.

## The strip

Structurally unchanged. It stays a filter, its five buttons stay disjoint, and
its parts still sum to its total:

| Button | Test |
|---|---|
| properties | all |
| behind | days < 0 |
| due within 30 days | 0 ≤ days ≤ 30 |
| later | days > 30 |
| not in the schedule | no deadline |

Only `past their date` → `behind` changes, so the label matches the schedule the
page now is. Filtering to one band shows that band alone, with its month
headings intact, and suppresses the today-line where the band is entirely on one
side of it.

## What changes in the code

`bandOf` (app.js ~3216) is the whole hinge. Today it returns one `past` key for
every overdue property and month keys only for the future. It becomes uniform:
**every dated property gets a month key**, and rank is month order. The `now`
band disappears as a *group* — its members fall into the months they belong to —
while surviving as a *filter* in the strip. Urgency stays legible per row
through the countdown and `--stamp` on ≤30 days.

The two-zone assembly in `renderMenu` (~3535) collapses to one grid. `_liveHd`,
`_liveHtml`, `_restHd`, `_restLbl`, `_restSort` and the `Remaining` / `All of
them` heading logic all go, replaced by month headings plus the today divider.
The column header row stays, once, at the top.

`dueLine` is left alone. The draft of this spec had it gain a days-ago interval
on the rows above the line; that was struck on 2026-07-29 for contradicting a
decision already in the code — "anything overdue has already been completed", so
overdue states its date and stops there. Shouting "119 days late" across eighty
rows buries the handful genuinely inside thirty days, and the tracker records
the deadline, not the filing, so the interval would be an interval of nothing.
Above the line a row reads "Was due Jul 1"; below it, "Aug 1 · 2 days left".

Nothing in `hap.js` changes. The deadline derivation, `actionFor`, the gap and
expiring cases and the 120-day fallback are all untouched.

## What does not change

- Every fact on a row today stays on it. No column is dropped.
- The sort is deadline ascending, as it already is.
- Provenance colours, the form, and every dialog are out of scope.
- The `DEV_PURGE` sweep stays where it is, on the off-axis group.
- `db.js` / `db.supabase.js` are untouched — this is a rendering change.

## Tests

- `test_browser.js` — the today-line exists, is pinned on load, carries the
  behind count, and unpins above itself. The page opens at it. Typing in the
  search box does **not** move the scroll. Clicking the count jumps to the top.
  A month group that straddles today holds the divider between its own rows.
- `smoke_combined.js` — every dated property lands in a month group; the groups
  tile the schedule with no gaps and no double membership; the strip's five
  counts stay disjoint and still sum to the total; a property with no deadline
  renders below the last month, not inside it.
- `MIN_CHECKS` raised in both.

Two defects the checks caught while building, both invisible in markup:
`.mgrid.rows` carried `overflow:hidden`, which makes it a scroll container, so
the sticky line stuck to a scrollport exactly as tall as its own content and
never moved; and the landing scroll's one-shot was spent on the first render,
which happens before the tracker source answers and therefore has no line to
scroll to — so the schedule opened at December 2025 with today 3,675px below the
fold. The flag is now spent when the scroll fires, not when it is reached.

## Explicitly out of scope

**The page cannot know what has been cleared.** Nothing marks a package filed,
so December 2025 will sit at the top of the schedule forever. The tracker has
three columns for exactly this — `Paperwork Rec`, `Sent to HUD/CA`, `Conf by CA`
— and they are empty on every Fox Hill row; whether they are populated anywhere
in the portfolio is unchecked. Reading them would be the natural next step, and
it is deliberately *not* part of this change. Ruled out on 2026-07-29: deriving
"cleared" from form completion or `packageScore`. Completion is not filing, and a
schedule that reorders itself because someone typed in a field is not a
schedule.
