# Package completion score — design

_2026-07-28 · status: **built** on branch `claude/pensive-pike-434395` · design approved by Matt (scope, ladder,
summit, clean gate, step size) · re-audited against `main` @ `4ac56f8`_

## In one line

Replace the property ring — ten durable keys, present or absent — with a **package** score on a
three-gate ladder in steps of 5, where **70 means every document in the package has its source** and
**100 means nothing is left to enter**, computed once and read by the menu, the launcher and the
form.

## Why

**1. The number and the documents answer to different tables.** The ring is `completenessOf`
(`db.js:269`, `db.supabase.js:202`): ten durable keys, counted.

```js
const REQUIRED_DURABLE = ['property.name','property.s8','property.addr_street','property.addr_city',
  'property.addr_state','property.addr_zip','owner.entity_name','sig.name','ca.org','ca.name'];
```

Generation answers to `DOC_REQS` (`app.js:3159`), audited document by document against what `gen.js`
actually prints. The fields it needs that the ring has never looked at:

| Key | Blocks | In the ring? |
|---|---|---|
| `sig.title` | every document that carries a signature block | no |
| `poc.name` | cover, owner | no |
| `appr.name`, `appr.firm` | owner | no |
| `property.fha` | schedule | no |
| rents-effective date | schedule | no |
| ≥1 unit type with a count | schedule, notice | no |
| proposed rents | notice | no |
| `tenant.sender_name` | notice, uanotice | no |
| the published OCAF factor | ocafws, exhibita | no |
| T-12 / F-12 debt service | dsevid | no |

So a property reads **100% with two documents unbuildable** — reported by Matt 2026-07-28. The draft
rent schedule and the tenant notice are the two whose requirements overlap least with those ten
keys, which is why they are the two that fail.

**2. The ring physically cannot ask the generation question.** `completenessOf` lives in the data
layer and sees `p.durable`. `docMissing` (`app.js:3255`) and `docWarns` (`app.js:3224`) live in
`app.js` and read the open form through `get(k)`. The menu renders from `listProperties()` with no
form loaded. Two computations, two scopes, and only one of them knows what a document needs —
FORM-RULES §13's "two renderers, one of them wrong, and the user only ever sees the second".

**3. The package's own contents are already described in four places.** `pkgCard` (`app.js:2075`)
builds the RCS list with computed ticks and the OCAF/UAF list as **plain strings with no readiness
at all** — a card that asserts six documents are in the package without asking whether any of them
could be written, which is precisely what §15 forbids. The two generate runs build the same lists
again inline. A score that derived a fifth list would drift from all four.

**4. A score is an indicator, and §15 applies.** It must compute, never assert. Today's ring asserts
completeness from a list that was never reconciled with the documents.

## The design

### Component 0 — one list of the package's documents

Before the score can be honest, the package has to have one description of itself.

```js
PACKAGE_DOCS(programs, ctx) -> [{ id, label, produce: 'generate' | 'upload', required: bool }]
```

| Package | Documents |
|---|---|
| RCS | cover · owner · checklist · **study** (upload, required — document 04) · schedule · notice |
| OCAF | ocafws · exhibita · dsevid (floating rate only) · schedule · **CA package** (upload, optional) |
| UAF | uafcert · uanotice · tcert · schedule |
| OCAF + UAF | the union, with one merged revised rent schedule |

Four consumers, one table: `pkgCard`, `__genPackageRun`, the OCAF/UAF generate run, and the score.
The OCAF/UAF card gains computed ticks for free, which is a §15 fix in its own right.

### Scope: the number describes a package, not a property

Documents are generated per package (cycle), so "can it all be produced?" only has an answer at that
scope. The menu card shows the **dominant** package's score; the launcher shows the dominant
package's score in the big ring and each package's own score on its row. A property with no package
yet is scored on gate 1 alone and captioned `no package yet`.

### The ladder

Three gates. A gate must be **completely** done before the score leaves it, so every boundary
carries one meaning.

| Range | Gate | The promise at the top |
|---|---|---|
| 0–30 | **Profile** | 30 = this is a real property record |
| 30–70 | **Buildable** | 70 = every document in this package has its source |
| 70–100 | **Clean** | 100 = nothing left to enter |

**Gate 1 — Profile (5 items).** `property.name` · `property.s8` · address complete (street, city,
state, zip — one item, all four) · `owner.entity_name` · at least one unit type with a count > 0.

**Gate 2 — Buildable.** **Derived, never hand-listed:** for every document in `PACKAGE_DOCS`, the
union of `docMissing(id)` — minus the keys gate 1 already counted — plus, for each `produce:'upload'`
document marked `required`, the upload itself. Change `DOC_REQS` and this gate changes with it; that
is the property that keeps the ring honest.

For an RCS package today it comes to twelve items: `ca.name` · `ca.org` · `poc.name` · `sig.name` ·
`sig.title` · `appr.name` · `appr.firm` · `property.fha` · `tenant.sender_name` · rents-effective
date · proposed rents · **a study attached**.

**The study is a gate-2 item, not a caveat.** Document 04 of six is an upload rather than a
generation, but it is still one of the six — `pkgCard` already ticks it from `_rcsUpload`. Scoring
it as a caveat would let the ring promise a complete package with no study in it. The consequence is
deliberate: while a study is out with the appraiser the package genuinely cannot be produced, and
the ring will sit in the 60s saying so. The CA package on an OCAF cycle is `required:false` — the
code treats it as a warning, not a blocker — so it lands in gate 3 instead.

**Gate 3 — Clean.** The union of `docWarns(id)` across the package's documents (deduped by key, so
the cover's "a phone or email for the point of contact" does not double-count `poc.phone` /
`poc.email`), plus: one item per unresolved conflict (UA, SAFMR, unit type, unit count — `attnFlags`
at `app.js:2128` already counts them) · SAFMR present for every unit type (RCS only) · letterhead on
file · any optional upload the package names. Typically about twelve items.

### The arithmetic

```js
gateScore(floor, ceil, done, total) {
  if (total === 0)      return ceil;                 // nothing to do in this gate
  if (done === total)   return ceil;
  const raw = floor + (ceil - floor) * (done / total);
  return clamp(round5(raw), floor, ceil - 5);        // never reach the top without earning it
}
```

The score is the score of the **lowest incomplete gate**. Work done in a later gate is not shown
until the earlier one closes — a deliberate trade: it is what makes 70 mean "every document has its
source" rather than "roughly two thirds of everything". The visible consequence is that closing the
last blocker can jump the ring from 65 to 100, which is honest.

Every value is a multiple of 5. About twenty are reachable:

```
0  5  10  20  25  30          profile   (5 items, 6.0 pts each)
35 40 45 50 55 60 65 70       buildable (12 items, 3.3 pts each)
75 80 85 90 95 100            clean     (~12 items, 2.5 pts each)
```

### The number moves on fields; the caption speaks in documents

With twelve blockers across forty points a single field is 3.3 points, so some edits will not move
the ring. The caption always moves:

```
55%   Buildable · 4 of 6 documents ready
      blocked: FHA number, tenant-notice sender
70%   Every document has its source
      8 items left before this package is clean
100%  Ready to generate
```

## Where the code lives

One computation, three call sites. New source file `app/full-mp/score.js`, concatenated **between
`core.js` and `db.js`** so both layers can reach it.

```js
window.RCSScore = {
  packageScore(read, ctx),   // -> {pct, gate, done, total, blockers[], caveats[], docsReady, docsTotal}
  packageDocs(programs, ctx), docMissing(read, id), docWarns(read, id), DOC_REQS, hasReal
};
// read(key) -> string        the ONLY interface between the score and its caller
// ctx { programs, hasLetterhead, uploads, units:[i], conflicts:[…], rateType }
```

- `DOC_REQS`, `docMissing`, `docWarns`, `hasReal` **move** out of `app.js` unchanged. `app.js` keeps
  one-line wrappers (`docMissing(id) → RCSScore.docMissing(get, id)`), so `pkgCard`, both generate
  runs and `__API` keep their present call sites.
- `db.js` and `db.supabase.js` build a `read` over the dominant cycle's cells and call the same
  function. Both change together, under the API-parity rule they already live by: a stand-in that
  scores differently from the real backend makes every test using it a fiction.
- `completenessOf` and `REQUIRED_DURABLE` are deleted, not left beside the new score. Two answers to
  one question is the defect being fixed.

## What the reader sees

- **Menu card** — ring = dominant package's score, plus a caption line
  (`FY2025 RCS · 4 of 6 documents ready`). The header's "N need review" counts packages under 100.
- **Launcher** — big ring = dominant package; each package row carries its own score, so a closed
  OCAF cycle can read 100 beside a live RCS one at 55.
- **The form** — the package card gains a *what's holding it* list: one line per gap, blockers and
  caveats visually distinct, each clicking through to the exact cell via `gotoSection(sec, key)`
  (`app.js:3294`). Conflicts link to their one-click resolve buttons — `[data-uaok]`,
  `[data-safmrok]`, `[data-typ]`, `[data-num]`, all still present and all one press.

## What it deliberately does not score

| Excluded | Why |
|---|---|
| Whether the package was generated | Matt's call: the ring answers "ready?", not "done?". The launcher's `Package generated / Draft` chip already carries that. |
| Unsaved changes | Session state, not a property of the record — the menu ring is computed from the database and cannot see it. The footer already says so. |
| Unit types over the 150% SAFMR ceiling | A finding about the property, not a gap in the record. A package can be complete and still fail the test. |
| Rent-schedule capacity warnings | Structural (more unit types than Part A's eleven rows), not fixable by entering data. Holding a property under 100 forever would make the number useless. Stays a flag. |

## How it is proven

**`test_db.js`** — the score as a pure function over a record: gate boundaries, the cap rule, the
rounding, empty and full records, each program's document list, and the two invariants that are the
point of the whole exercise:

- `pct >= 70` ⟺ every document in `PACKAGE_DOCS` has its source (`docMissing` empty for each
  generated one, upload present for each required uploaded one);
- `pct === 100` ⟺ no blockers **and** no caveats.

**`test_browser.js`** — on the real bundle: the same number in the menu card, the launcher and the
form card (the two-renderers trap), and a scripted fill of the two blocking fields crossing
65 → 70. Raise `MIN_CHECKS`.

**The headline regression** — a record holding all ten of today's `REQUIRED_DURABLE` keys but no FHA
number **must not read 100**. It fails against today's code, which is what makes it worth writing.

## Risks and open items

1. **A new source file touches the RA port.** `build.sh`, `deliver.sh`'s syntax list and
   `build-ra.py` (Kinley's Azure port, a mandatory gate) all enumerate the sources. The plan
   verifies `python3 app/full-mp/build-ra.py` before anything else; if the port cannot take a new
   file, `score.js`'s contents go into `core.js`, which is already built before `db.js`.
2. **`listProperties` needs cycle cells.** Today it reads `p.durable` only. Scoring the dominant
   package means reaching that cycle's cells for every property in the gallery. Preferred shape:
   `listCycles` carries a per-cycle score and `listProperties` reports the dominant one. Cost to be
   measured against the real backend before committing to it.
3. **Extracting `PACKAGE_DOCS` touches both generate paths.** They are the two functions that
   produce what Matt files. The plan changes them last, behind the tests that already cover
   generation (`test_gen.js`, 33 checks), and changes no document's contents — only where the list
   of documents is read from.
4. **The study's bytes do not persist.** `rcsRecall` (`app.js:1316`) returns `{bytes:null,
   stored:true}` — after a reload we know a study was attached but cannot embed it. The score treats
   "attached" as satisfied, because it describes the record; the package card says
   `re-upload to include`. Storing the bytes is separate work.
5. **The study gate cuts both ways.** An RCS package with a flawless record but no study delivered
   yet reads at most 65. Intended — but it means the ring sits in the 60s for as long as a study is
   out with the appraiser.
6. **Item counts here are illustrative.** The real counts derive from `PACKAGE_DOCS`, `DOC_REQS` and
   `docWarns` at run time. Nothing hard-codes twelve.
