# Morning report — the RCS corpus loop

**What ran:** every one of your 34 properties, driven through the real app twice
(rent schedule first, then study first), package generated, compared against the
package your PM team actually filed. App frozen at `d4c3d60` for the whole sweep.
1,055 values compared. Full detail in `_archive/corpus-cache/_sweep/sweep-1.md`
(gitignored — it holds real rents).

Read this in order. The first item changes what the other items mean.

---

## 0. What changed while you slept

**Final numbers — six sweeps of all 34 properties, both fill orders each.**

| | first sweep | last sweep |
|---|---:|---:|
| **values that MATCH the filed package** | 127 | **185** |
| **fill-order disagreements** | **50** | **16** |
| **properties producing two different packages** | **6** | **1** |
| both sides had a value and they differ | 168 | **124** |
| the filed document had a value we produced nothing for | 412 | **163** |

**Every one of the remaining 124 traces to something already named here — I found
no unexplained data error from the app:**

| what | rows | cause |
|---|---:|---|
| we print `1BR/1BA`, you print `1-Bedroom` | 46 | vocabulary, not data |
| genuinely different type names (`2BRLG`, `3-BedroomS`/`L`) | 22 | the missing designation field, item 3 |
| rows missing on our side, shifting everything after them | ~38 | the unreadable schedules, item 1 |
| my own extractor still misreading a filed document | ~15 | mine to fix, not the app's |
| the DocuSign stamp read as a property name | 3 | fixed |

**A caution about the big numbers.** 343 of the differences are the app producing
a value the filed document has no field for — your analysis workbook titles
itself in free text and carries no appraiser firm. Those are not disagreements
about anything. **Read the 124, and inside it read the 22.**

### What I got wrong, and corrected, in this stretch

- **The app was right and I was grading it against the wrong property.** Colonial
  Village's analysis workbook holds two sheets — it and White Oak Townhomes share
  a contract — and I read only the first. Fifty-five differences were entirely
  mine. Six of your 34 workbooks have several sheets, named for the firm rather
  than the content.
- **A labelled row that counts nothing is a template row, not a unit type.**
  Taking it shifted the filed side by one on 24 properties.
- **I reported one commit as pushed when it had not been.** Nested quotes in the
  message broke the shell; the commit failed and the push never ran. It is in
  now — but I stated something I had not verified, and that is worth knowing.

---

## 0b. The original overnight summary

I ran the whole corpus again after fixing what I could fix without you
(`sweep-4`, app frozen at `8730a23`). Same 34 properties, same two orders.

| | first sweep | after the fixes |
|---|---:|---:|
| **fill-order disagreements** | **50** | **16** |
| **properties producing two different packages** | **6** | **1** |
| both sides had a value and they differ | 174 | **168** |
| we produced a value the filed document has no field for | 356 | 352 |
| the filed document had a value we produced nothing for | 398 | 401 |

**44 resolved, 6 new, and none of the 6 is a regression** — four are cases of the
app now producing a value the filed workbook simply has no field for, and two are
row-ordering on Oaks. I checked each one rather than assuming.

**Two defects fixed, both found by the sweep and both diagnosed to root cause:**

1. **A studio the reader could not read was inflating a HUD form by 17 units.**
   Barnum House's schedule writes its studio as `0 BEDROOM`. The reader returned
   no bedroom count, the matcher skips a row with no bedroom count, so the
   study's studio line was treated as new and added a *second* row for the same
   17 units — the generated form claimed 100 units where the schedule says 83.
   Both orders now say 83. Rather than fix one property I parsed all 34 filed
   schedules and fixed every spelling they actually use: `BR3` (Shiloh Village,
   333 Holly, The Pines) and `2BR2BA` (333 Holly, Oaks) as well.
   **Shiloh Village gained a whole missing unit row from this** — 4BR, 72 units —
   and now matches its filed package.
2. **The bathroom count reached the printed unit type only when the study
   created the row**, so schedule-first printed `1BR` and study-first
   `1BR/1BA` from identical files. Fixed for Friendship Court, Hampshire House
   and The Pines, all now at zero.

**Still one property with order-dependence: Oaks on North Plaza**, whose schedule
is a poor scan the reader turns into `3613`, `16R` and `2BIRMBA-ADA`. I left those
deliberately unread — a wrong unit type is worse than a missing one. It did get
substantively better: 11 outright data losses down to 5.

**Read the 168, not the 921.** Two thirds of the raw total is one side holding a
field the other's template does not have — your analysis workbook titles itself
in free text and carries no appraiser firm at all, so every property contributes
two rows that are not disagreements about anything.

Everything below still stands; item 1 is unchanged and is still the one that
needs you.

---

## 1. The headline: the app cannot read 27 of your 34 executed rent schedules

Not a parser nicety — the largest single defect in the product, and a **cost**
problem as much as a correctness one.

| how the rent schedule stores its values | properties | app can read it |
|---|---:|---|
| real text in the text layer | **7** | yes, tier 2 |
| text layer holds only the blank form; values are vector outlines | 17 | no |
| no text layer at all (scanned or fully outlined) | 10 | no |

I verified this rather than inferring it. For Lansing Manor's executed schedule
the values are not in the text layer, not in widgets, and not in annotations:
**they are filled vector paths.** Where `1Bedroom` prints there are 159 path
items; where `892` prints, 85. The text was converted to outlines when the
document was flattened. There is nothing for any text parser to recover — not
with a better regex, not with better positioning. Tier 2 can never read these.

**What it costs you today:** every one of those 27 properties needs tier-3 Azure
OCR, billed per page, on every package the tool produces. And when the schedule
can't be read, the app declines to generate the documents that depend on it:

| document | properties where the app produced nothing | of |
|---|---:|---|
| cover letter | 27 | 34 |
| rent schedule | 26 | 34 |
| checklist | 23 | 34 |
| tenant notice | 16 | 34 |
| submittal letter | 9 | 34 |

**This needs your decision.** Three options:

- **(a) Accept the per-page cost.** Simplest. You already built tier 3; it works.
- **(b) Install a local OCR engine.** Free after setup and no data leaves the
  machine. I tried the zero-install route — macOS Vision via a small Swift
  helper — and it is **blocked on your machine**: `swiftc` is version-mismatched
  with the SDK (compiler `swiftlang-…909`, SDK built with `…904`), so every
  Apple module fails to build. Fixing that means `xcode-select` or installing
  Xcode, which needs your password. I did not install anything.
- **(c) Build a vector-glyph reader.** The outlines are deterministic — the same
  glyph shape means the same character every time. Free, offline, exact rather
  than probabilistic, and it would read the 17 outlined ones (not the 10 scans).
  Real work, but it is the only option that costs nothing per page and needs no
  new dependency.

---

## 2. Fill-order disagreements — same inputs, two different packages

**50 disagreements across 5 properties.** These need no ground truth to be
defects: the same two files, uploaded in a different order, produced different
documents.

> **Updated after I fixed part of this.** My first root cause here was wrong and
> I have corrected it below. Friendship Court and Hampshire House now show **zero**
> fill-order disagreements; The Pines dropped 3 to 1. 14 resolved, 0 regressions.
> Barnum House and Oaks on North Plaza are unchanged and are two *different*
> defects — see the end of this section.

**Root cause (corrected): an adopt-versus-offer asymmetry, not a positional
merge.** `rcsMatch` already matches study lines to form rows by bedrooms and
bathrooms with the unit count as a tiebreaker. But a study line that *matches* an
existing row wrote only the shadow keys `br_rcs`/`ba_rcs`, while a line the form
had no row for wrote `br`/`ba` outright — so the bathroom reached the printed
unit type only when the study happened to CREATE the row. Fixed: the study is
adopted, not merely offered, wherever the schedule stated nothing at all.

**What that leaves.** Barnum House's rows still land in a different ORDER
(schedule-first `1BR, Studio`; study-first `Studio, 1BR`), which is why its total
is still 100 one way and 83 the other — that one IS positional. And Oaks on North
Plaza still loses its current rents when the schedule is uploaded first. Those are
the next two targets.

The original (superseded) diagnosis follows for the record: Every unit field is keyed `units.<i>.<field>`,
so row 0 is simply "the first row". When the rent schedule and the study list
unit types in a different order — which is exactly what these five properties do
— whichever file you upload first decides the layout, and the second file's
values land against the wrong unit type.

Barnum House is the worst case and shows how bad it gets:

| key | upload RS first | upload study first |
|---|---|---|
| `total.units` | **100** | **83** |
| `unit.0.type` | `1BR` | `Studio/1BA` |
| `unit.0.units` | 66 | 17 |
| `unit.0.rent` | $2,825 | $2,325 |

The generated rent schedule's **total unit count depends on which file you
uploaded first**. That document goes to HUD.

Affected: Barnum House, Friendship Court, Hampshire House, Oaks on North Plaza,
The Pines. The type disagreement appears in all five; current rents in three.

**Suggested fix:** match unit rows by identity (bedrooms + bathrooms +
designation) rather than by position when a second source is applied. That is an
app change I did not make — it touches the merge logic in `rsFillFromParsed` /
`rcsFillFromParsed` and I would rather you saw the evidence first.

---

## 3. Unit type collapses distinct unit types into one label — 27 properties

The largest correctness defect after the reader.

The app builds a unit type from **bedrooms and bathrooms only**
(`buildRentAnalysisBytes`, [app.js:4091](app/full-mp/app.js:4091); `gen.js` does
the same in five places). **There is no field in the data model that
distinguishes two unit types sharing a bedroom and bathroom count.**

Lansing Manor has 32 units *without* a patio and 68 *with* one. Both are 1BR/1BA.
The app labels both `1BR/1BA`; the filed schedule correctly says `1-Bedroom` and
`1-Bedroom Patio`. Every generated document that lists unit types shows two rows
that look identical.

This also explains part of item 2: with no designation to match on, even an
identity-based merge would need a new field first.

---

## 4. What the app gets right

Worth saying plainly, because the counts above are grim and the reader is the
reason for most of them. On Lansing Manor, where I hand-verified all 115 values
myself off page images:

- unit counts — **32 and 68, correct**
- RCS rents — **$1,190 and $1,200, correct**, matching the study exactly, which
  the contract administrator then approved verbatim
- SAFMR — **$1,040, correct**

The study reader works. It read all 34 properties, including the 20 that were
locked and that the app now decrypts itself.

---

## 5. What I got wrong overnight, and how I found it

- **The first Lansing run reported 67 differences. Six were real.** The other 59
  were my own harness lying in four ways: counting a document the app never
  wrote as thirty separate differences; refusing every filed workbook's cached
  formula values (right for our workbook, wrong for Excel-saved ones); reading
  spreadsheet columns by letter when ours start at row 9 and yours at row 3; and
  comparing the spreadsheet row number as if it were data. All four are fixed
  and would each have multiplied across 34 properties.
- **I tagged the property name with the run label** (`Lansing Manor [75500
  rs-first]`), which put harness bookkeeping into every generated document and
  produced 27 property-name "mismatches" that were entirely my fault. Fixed
  after the sweep, so those rows in `sweep-1` are noise — ignore them.
- **My first classification of the rent schedules graded the wrong page** — for
  Lansing it graded the transmittal letter, not the HUD-92458. Redone by locating
  the actual form page.
- **I expected `NC19E000007` and `NC19-E000-007` to compare as different.** They
  are the same HUD contract; the comparison is right and I was wrong.
- **A file I wrote landed with a NUL byte inside a string literal.** `node
  --check` passes on it; only the NUL gate caught it. Every source file written
  since is checked.

---

## 6. What needs you

1. **The OCR decision** in item 1 — (a), (b) or (c). Everything else is gated
   behind it: until the app can read an executed rent schedule, 27 of your 34
   properties generate one document instead of six.
2. **12 study choices are a coin toss** — two candidates ranked within a point,
   listed in [corpus-review.md](app/full-mp/corpus/corpus-review.md). If the
   wrong one is picked, that property's discrepancies are noise.
3. **Whether to merge the app-capability work to `main`** — `crypto.js`,
   `pdfdecrypt.js` and the `unlockPdf` wiring let the app open the 20 locked
   studies. It is real product capability sitting on this branch. I have not
   pushed anything to `main`.

---

## 7. Where to pick up

```bash
node app/full-mp/corpus/sweep.js "$CORPUS" _archive/corpus-cache app/full-mp/corpus/corpus.json --jobs 3 --label sweep-2 --force
```

Re-running now would already be cleaner than `sweep-1`: the property-name fix
landed after the sweep. The right next move is a fix to one of items 1–3, then a
re-sweep and a **resolved / persisting / NEW** diff against `sweep-1.json` — a
new row would be a regression and outranks everything else.
