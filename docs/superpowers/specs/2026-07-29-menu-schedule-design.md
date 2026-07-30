# The home page becomes a schedule

2026-07-29. Supersedes the two-zone menu of `2026-07-28-home-navigation-design.md`,
which kept its structure.

## What it is

The property list stops being a set of buckets and becomes **one continuous
schedule on the deadline axis**. It runs from the earliest deadline the tracker
carries to the last one, a month heading over each month, and a countdown on
every row. It moves through time on its own: as days pass, rows cross from what
is coming into what is behind.

No division on the page is named after a state. The one exception is deliberate —
what is *coming* leads the page as a panel of its own, because prominence for the
workable set is worth the cost of a 30-day window that does not tile a calendar.
Everything else is a month.

## The shape it has to hold

229 properties, 16 months, Dec 2025 → Sep 2027, against the real tracker on
2026-07-29:

```
  Dec 2025    1   behind
  Apr 2026   11   behind
  May 2026   20   behind
  Jun 2026   29   behind
  Jul 2026   22   21 past due, 1 ahead (the 31st)
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
- **82 properties are past due** — 36% of the portfolio, the oldest 240 days
  back. Too many to treat as an exception, too many to leave unannounced — hence
  a drawer with a count on it rather than silence.
- **The horizon is ragged.** Apr 2027 has 3, then a gap, then 1, then 2. The CSV
  dribbles out rather than ending, so the bottom of the page is thin by nature
  and must not read as an error.

## Structure

Revised 2026-07-29, after the flat version shipped and was rejected. It was
honest about the calendar and wrong about the job: opening at today meant opening
on eighty rows of what was already behind, with the twenty-one that can actually
be worked somewhere down the middle of one very long scroll. Matt: *"now its just
one long ass scroll page… i want those upcoming ones to go back to being
prominent and taking up the top of the page like it used to be, with the list
below it."*

So **what is coming leads the page, and what is behind waits in a drawer.**

```
 ┌──────────────────────────────────────────────────────────────┐
 │  82 past due to HUD                             Show them    │  closed
 └──────────────────────────────────────────────────────────────┘
   DUE WITHIN 30 DAYS   21 properties · earliest deadline first
 ┌──────────────────────────────────────────────────────────────┐
 │  JULY 2026                                                   │
 │  Woodlake Apartments   OCAF   Jul 31 · 1 day left   Start 2026│
 │  AUGUST 2026                                                 │
 │  Asbury Park           OCAF   Aug 1 · 2 days left   Start 2026│
 └──────────────────────────────────────────────────────────────┘
   FURTHER OUT   127 properties · earliest deadline first
 ┌──────────────────────────────────────────────────────────────┐
 │  PROPERTY   PROGRAM   DUE TO HUD   RENTS EFFECTIVE   UNITS    │
 │  SEPTEMBER 2026 … SEPTEMBER 2027, then what is off the axis   │
```

Three zones, in this order:

1. **The drawer** — the past-due rows, month-headed, `hidden` on load. Closed
   means *not on the page*, not merely scrolled off it; that was the whole
   complaint about the flat version.
2. **What is coming** — the live panel, due within 30 days, the largest type on
   the page and the only solid action buttons.
3. **Further out** — the rest of the schedule by month, then the properties with
   no deadline, then the records the tracker does not carry.

### Opening the drawer

Two ways in: pressing the banner, or **scrolling up while already at the top of
the page** — the gesture a PM reaches for without being told. The wheel handler
is guarded on the delta pointing up *and* `pageYOffset <= 0`, so it cannot fire
mid-list, and it is wired once for the life of the page rather than per render.

**The panel below must not move.** Inserting eighty rows above it would otherwise
shove it off the bottom of the screen, so the scroll is compensated by exactly
the height that appeared: the past list comes to exist *above* the viewport, to
scroll up into, and every pixel below the banner stays where it was.

Measured on the panel, not on the drawer. `offsetHeight` excludes margins, and
opening changes two of them — the banner sheds its 14px and the drawer brings
40px — which left the panel 26px from where it had been. Measuring the thing that
must not move cannot drift, whatever the boxes above it do.

### Months, and the two dates

Month headings run inside each zone, so a month split across two of them is named
in both: the ledger's "August 2026" stands over the August rows the live panel
did not take, under a zone heading that already said which thirty days it took.
This is a real cost of the live panel — a 30-day window does not tile a calendar
— and it is accepted deliberately in exchange for the prominence.

The live panel hides the *Rents effective* date. It carries no column headers, so
a second bare date beside the countdown read as part of it, and on a narrow name
it overprinted the unit count outright ("Jan 1, 2027" over "51 units"). The panel
is about the deadline; the ledger prints both dates under labels.

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
headings intact. Filtered TO what is past, the rows *are* the list and no drawer
is drawn — a banner over them would be a control that closes the view just
chosen.

## What changes in the code

`bandOf` (app.js ~3216) is the whole hinge. Today it returns one `past` key for
every overdue property and month keys only for the future. It becomes uniform:
**every dated property gets a month key**, and rank is month order. The `now`
band disappears as a *group* — its members fall into the months they belong to —
while surviving as a *filter* in the strip. Urgency stays legible per row
through the countdown and `--stamp` on ≤30 days.

The zone assembly in `renderMenu` becomes four row sets off one sorted list —
`_pastRows` / `_liveRows` / `_restRows` / `_offRows` — each rendered by a shared
`_zone()` that emits a month heading whenever the month changes. The old
`Remaining` / `All of them` heading logic goes: zone two names its window, zone
three is "Further out", and the drawer's banner names its own count. Column
headers appear on the two ledger-style grids, not on the live panel, which has
never had them.

`dueLine` is left alone. The draft of this spec had it gain a days-ago interval
on the past-due rows; that was struck on 2026-07-29 for contradicting a
decision already in the code — "anything overdue has already been completed", so
overdue states its date and stops there. Shouting "119 days late" across eighty
rows buries the handful genuinely inside thirty days, and the tracker records
the deadline, not the filing, so the interval would be an interval of nothing.
In the drawer a row reads "Was due Jul 1"; in the live panel, "Aug 1 · 2 days
left".

Nothing in `hap.js` changes. The deadline derivation, `actionFor`, the gap and
expiring cases and the 120-day fallback are all untouched.

## What does not change

- Every fact on a row today stays on it. No column is dropped.
- The sort is deadline ascending, as it already is.
- Provenance colours, the form, and every dialog are out of scope.
- The `DEV_PURGE` sweep stays where it is, on the off-axis group.
- `db.js` / `db.supabase.js` are untouched — this is a rendering change.

## Tests

- `test_browser.js` — a second fixture, since the first leaves the past band
  empty on purpose. The drawer is `hidden` on arrival and its rows are provably
  not on the page; the banner carries the count; pressing it opens it, closes it,
  and **does not move the panel below** — measured in the viewport, before and
  after, in a real layout. That last one is the check the DOM alone cannot make.
- `smoke_combined.js` — every dated property lands in a month group; the groups
  tile the schedule with no gaps and no double membership; the strip's five
  counts stay disjoint and still sum to the total; a property with no deadline
  renders below the last month, not inside it.
- `MIN_CHECKS` raised in both.

Defects found by driving the real bundle rather than by reading markup: the
scroll compensation measured `offsetHeight` and so drifted 26px on the margins;
the live panel had no column for the *Rents effective* date once the rule hiding
it was dropped, and it overprinted the unit count; and in the flat version that
preceded this, `.mgrid.rows` carried `overflow:hidden` — which makes it a scroll
container, so a `position:sticky` child sticks to a scrollport exactly as tall as
its own content and never moves at all.

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
