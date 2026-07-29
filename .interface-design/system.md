# Design system — Section 8 Rent Adjustments

Written 2026-07-28 on branch `ui-overhaul`. This file is the decision record: if it
names a value, hold to it rather than re-deciding at the call site.

## The human, the verb, the feel

Claire Beatty opens this at 8am with a HUD deadline in her calendar and 54 properties
in her portfolio. She is not browsing. She came to answer **what is owed to HUD, and
when** — then to start or finish one package. Five minutes later she is inside a form
transcribing figures off an appraiser's PDF, and she must be able to tell at a glance
which of those figures the record already holds.

It should feel like **a well-kept file room**: quiet, ruled, exact. Not a dashboard, not
a SaaS product. The app writes HUD documents, so it should speak in their voice.

## Signature

**The coloured left rule.** One marker, three scales — on a *cell* it means provenance
(is this saved?), on a *row* it means urgency (is this owed?), on a *section* it means
status. Learned once, true everywhere. This already exists in the form; the redesign
promotes it rather than inventing a new marker.

Everything that competes with the rule — pills, chips, coloured badges, box borders —
goes quiet or goes away. That is the whole risk of the direction: the rule carries the
weight alone, so it must be the only coloured thing on a resting screen.

**Rejected 2026-07-28: a serif voice.** The first pass set the page's statement, property
names and month bands in IBM Plex Serif, italic for the accent line. Matt's read was
"beautiful, but a tad artsy — a tad unprofessional." He is right, and the reason is worth
keeping: a display face carries its own personality into a room where the product's
authority comes from being *exact*, not expressive. An italic serif headline reads
editorial. This tool files with HUD. The rule alone is the signature.

## Voice — the app reports, it never narrates

This is the rule that took three passes to find, and it outranks every typographic
decision below. Matt's words: *"it reads as custom written rather than
informative/accurate."*

The first pass opened with **"Three packages due this week."** at 33px in two colours,
over **"Nine more inside five weeks. Your other 42 properties have nothing due until
autumn — they're in the ledger below."** Both are sentences a person wrote to another
person. Removing the serif did not fix it, because the typeface was never the problem —
a magazine cover set in Helvetica is still a magazine cover.

What replaced it: an eyebrow naming the scope, a two-word title naming the view, and a
line of figures — `3 due this week · 9 within 30 days · 42 later · 54 properties` — each
carrying the left rule in its urgency colour, so the page teaches its own colour code in
the first thing you read.

Concretely:

- **No prose paragraph anywhere in the chrome.** Figures with labels, not sentences.
- **No headline above ~22px.** Size is not how this product earns attention; being right is.
- **Never two colours in one heading.** Colour means urgency or provenance. A heading has
  neither, so a heading is one colour.
- **Never "your".** "Remaining", not "the rest of your portfolio". The user knows whose
  portfolio it is.
- **Figures, not words, for quantities.** "3 days", never "three days".
- Helper text stays professional prose in the *form*, where it explains a rule the user
  must follow. That is instruction, not narration, and it is the one place sentences belong.

## Where the palette comes from

A housing-authority file room: manila kraft, the pale safety-paper green of a HUD form,
received-stamp ink, blue-black ballpoint on a signature line, the faint blue rule of a
columnar pad, photostat gray.

## Tokens

Today `shell.head.html` has **128 distinct hex values, 20 border-radius values, and zero
CSS custom properties**. That is the actual cause of "flat and washed out" — not the hues,
the absence of a system. Everything below collapses into one `:root` block.

```css
:root{
  --paper:#d8dde4;  --card:#ffffff;  --sunk:#eef1f5;   /* the desk, a document, a ruled band */
  --ink:#101822; --ink-2:#41505f; --ink-3:#556270; --ink-4:#636c77;  /* four levels, not two */
  --rule:#c2cbd6;  --rule-soft:#e4e9ef;
  --stamp:#9c2b18;  --stamp-wash:#f7ece8;   /* received-stamp ink — owed now */
  --ledger:#1f5480;                          /* columnar-pad blue — coming up */
  --filed:#2f6a45;                           /* safety-paper green — done */
  --chrome:#101d2b;                          /* the masthead — dark in both themes */
  --on-chrome:#fff; --on-chrome-wash:rgba(255,255,255,.10);
  --on-chrome-line:rgba(255,255,255,.26);    /* so no call site hardcodes a white */
  --btn:#101d2b; --btn-hover:#1f5480; --btn-ink:#fff;
  --r-ctl:4px; --r-card:8px;                 /* + 999px for pills. Three, not twenty. */
  --ease:cubic-bezier(.23,1,.32,1);
}
html[data-t="night"]{
  --paper:#0a0e14; --card:#161c25; --sunk:#11161e;
  --ink:#eef2f7; --ink-2:#a9b6c4; --ink-3:#8796a7; --ink-4:#75869a;
  --rule:rgba(255,255,255,.11); --rule-soft:rgba(255,255,255,.06);
  --stamp:#e8836d; --stamp-wash:#2a1710;
  --ledger:#5b9dd4; --filed:#4fb383; --chrome:#080c11;
  --btn:#2d6ca8; --btn-hover:#3d81c2; --btn-ink:#fff;
}
```

Night mode inverts lightness only — one hue family throughout, semantic colours
desaturated slightly, and **no depth shadows** (they don't read on dark).

### The ink levels are measured, not chosen by eye

The first pass picked them by appearance and three of the four failed WCAG on the light
surfaces — `--ink-4` on `--paper` came out at **1.91:1** against a 4.5:1 floor, which is
barely a colour difference and would have been invisible on the very monitor this redesign
exists to fix. Matt spotted it by eye before any tool did.

Every text/surface pair now clears **4.5:1 in both themes** — 40 pairs measured, all
passing. Two rules fall out of that, and both are binding:

- **`--ink-4` is never used on `--paper`.** It is the placeholder-and-resting-control level
  and it lives on `--card` and `--sunk` only. Pushing it dark enough to work on the page
  background would have collapsed it into `--ink-3` and cost a level.
- **Any new colour pair gets measured before it ships.** `/tmp` scripts don't survive;
  if this recurs, the check belongs in a suite.

Known trade-off: `--ink-3` and `--ink-4` now sit 1.17 apart in contrast, tighter than the
1.2 that reads as clearly distinct. That is the price of four legible levels on a light
surface, and it is the right price — an invisible level is not a level.

The surface steps were already right and did not move: `--paper` 72% → `--sunk` 88% →
`--card` 100% relative luminance. That 28-point spread is the washed-out fix.

## The provenance palette is not ours to restyle

`CLR` in `app.js:81` and the table in `FORM-RULES.md` are a contract with tests behind
them. Colour answers *is this saved?*; the badge answers *where did it come from?*

| meaning | fill | asserts |
|---|---|---|
| blue `#2563eb` / `#e8f0fe` | on file — the record holds this |
| teal `#0f766e` / `#e9f5f2` | pulled or parsed this package, not saved |
| orange `#b45309` / `#fbf1e6` | overridden — differs from the record |
| grey `#64748b` / `#f6f7f9` | new — nothing on file |

These become tokens (`--prov-db`, `--prov-cycle`, `--prov-over`, `--prov-new`) with the
same values, so night mode can tune them. **The values do not change.**

**Collision rule:** urgency and provenance must never occupy the same surface. Urgency
(`--stamp`, `--ledger`) lives on the home page and the launcher; provenance lives inside
the form. `--stamp` is a red no provenance state uses, and the two vocabularies never
co-occur on one screen. Check this before adding a coloured marker anywhere.

## Type

IBM Plex Sans for everything the interface says · IBM Plex Mono only for figures sitting
in a column against another figure (rents, allowances, contract numbers). Two roles, one
family. **No display face and no italics** — see the rejected serif above.

Scale ≈1.25 off a 13.5px body: `caption 11 · meta 12 · body 13.5 · h4 15 · h3 17 · h1 33`.
Weight and colour do the hierarchy work, not size alone — three tiers at one size via
`600/--ink`, `500/--ink-2`, `400/--ink-3`.

`font-variant-numeric: tabular-nums` on the root. Every figure in this product is in a
column being compared to another figure.

**Delivery constraint:** `index.html` is a standalone file Matt double-clicks — no CDN.
Plex must ship as base64 `woff2` subsets inside the bundle (~40 KB for two faces against
2.46 MB). The mockups link Google Fonts; the real build cannot.

## Depth — one strategy

**Borders and surface-colour shift. No shadows.** A document world doesn't float. The
page→card step is a real ~10% lightness jump (not the current 4%), which is what fixes
the washed-out look on a large monitor; `--rule` defines edges; nothing lifts.

**Spacing base 4px, and it is enforced, not aspirational.** A deslop pass found eleven
off-grid values (5, 7, 9, 11, 18, 22, 26, 33…) in a file whose own system declared a 4px
base. Card padding 24px, symmetrical. Table cells 12px 16px. Section gap 64px, group gap
16px — breathe unevenly: things sharing a deadline group tight, things that don't are set
apart.

**Cursors do not lie.** `cursor:pointer` on a `<tr>` that nothing handles is a promise the
page cannot keep, and it let me justify a 33px control by claiming "the row is the target."
Either the row is a real control with keyboard access, or the button is the target and it
meets 40px. Never the appearance of the first with the mechanics of neither.

## Component values

- `Button primary` — 34px min-height · 8px 15px pad · `--r-ctl` · 12.5/600 · `--btn`,
  hover `--btn-hover`, `:active scale(.975)`. **Never full-width** — a solid slab
  out-shouts the page's statement.
- `Button quiet` — same box, transparent fill, `--rule` border, `--ink-2` text.
- `Ledger row` — 11px 18px pad · 3px transparent left rule, `--ledger` when due soon ·
  hover `--sunk` · action revealed on row hover, 32px min-height.
- `Live card` — 18px pad · `--r-card` · 3px left rule (`--stamp` now, `--ledger` next).

## Motion

Under 300ms, `--ease` for entering, `transform`/`opacity` only, never `transition:all`.
Press feedback `scale(.975)`. `prefers-reduced-motion` drops movement, keeps colour.

## Truth rules — a review found all three of these broken at once

This product's authority is that its numbers are right. These are not style preferences.

- **A heading asserts a fact, so only its members may sit under it.** The first build put
  a card due Aug 8 under a heading that read *"Due to HUD by August 1."* Spacing it apart
  was decoration over a structural error. If an item does not share the heading's claim, it
  belongs in a different section — the live zone holds what shares one deadline, nothing else.
- **Every figure on a page must be countable on that page.** The status line claimed
  "9 within 30 days" while seven were marked. A count the user cannot verify by looking is
  worse than no count, because they cannot tell whether the figure or the marking is wrong.
  The buckets must be disjoint and sum to the total: 3 + 7 + 42 + 2 = 54.
- **One raised surface family per view.** The card row and the ledger were two white slabs
  of equal weight on grey, so nothing led. The ledger now sits directly on `--paper` as ruled
  lines, leaving the live cards as the only elevated surface — that *is* the focal point,
  achieved structurally rather than by making a headline bigger.

## States that must exist

Every control: default, hover, active, focus-visible, disabled. Every data surface:
loading, **empty**, error — all four specimened in the style guide.

- The empty state is not a failure. *"No renewals due in the next 60 days"* plus the date of
  the earliest one. A page that can be calm.
- **`--filed` earns its place.** A tool for completing packages must show a completed one:
  green rule, name demoted to 400, submission date in place of the action. You cannot start
  what is done, so the filed row has no Start button.
- **Hit areas 40px.** Measured and fixed: the theme toggle was 25px and the masthead links
  20px. In the ledger the *row* is the 52px target and the Start label stays a quiet
  affordance — extend the target, don't inflate the control.

## Checks before shipping a screen

- **Swap test** — swap Plex for the system stack, the ledger for cards: does anything
  change? Where it wouldn't, that's where the default won.
- **Squint test** — blur: is the statement still the first thing you see? Nothing harsh.
- **Signature test** — name five places the rule or the serif voice appears.
- **Token test** — read the variables aloud: paper, ink, rule, stamp, ledger, filed.
  Could someone name the product from them?
