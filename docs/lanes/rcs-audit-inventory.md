# RCS corpus inventory — read from disk 2026-07-30

Mount: `~/Library/CloudStorage/GoogleDrive-mfkodsi@gmail.com/My Drive/RCS Package Samples`

**How it was read, and why not with `find`:** `find` silently fails on this CloudStorage
mount — `find "$CORPUS"` returns exactly one entry (the root) with no error. Discovered by
test, not luck: a filename sweep returned nothing a plain `ls` had just shown. The
inventory below comes from `ls -R` (5,272 lines) plus a per-folder classification pass,
with every ambiguous folder opened and read. Any future pipeline step that shells out to
`find` against the corpus sees an empty corpus and must not be used.

> ## ⚠ THIS DOCUMENT IS A FLOOR, NOT A COUNT — corrected 2026-07-30 from the cloud
>
> Everything below was measured through the Google Drive **mount on Matt's Mac**, and the
> mount is incomplete. Read directly from Drive, the same corpus holds **4,447 files**
> against the mount's 3,364 — **1,083 files, 24%, never reached this inventory** — and
> **46 top-level folders** against 34.
>
> Of the 12 extra folders (all created 2026-07-27, the day before the coded bulk upload),
> 4 duplicate a coded property by name — Colonial Village, Lansing Manor, Fairview Homes,
> Riverwood — and **8 are properties named nowhere in this document or the manifest**:
> Village Court, **Cherry Garden**, Southport Mews, Gates Manor, Manhattan Plaza,
> Golden Link Manor, Crossroads of East Ravenswood, Woodland Towers.
>
> **Cherry Garden is the designated Gate 2 trial package, and the pipeline cannot
> currently see it.** That is the first thing to fix, not a footnote: a corpus inventory
> that misses the property under test is exactly the failure this lane exists to catch,
> and it was caught by driving the corpus from somewhere other than the machine that
> built the inventory.
>
> The counts below stand only as a lower bound until the manifest is rebuilt against
> Drive itself.

**The manifest disagreed with the disk.** `app/full-mp/corpus/corpus.json` listed 44
cycles when this was written; it lists **68** since `c43c355`, of which **63** carry both
a study and filed documents. Both numbers were still derived from the incomplete mount. The disk holds **56 complete (property, year) packages**. Missing from the
manifest: Westwood Village 2020, Sycamore Green 2020, New Horizons 2019, Woodbury
Oakwood 2021, Hampshire House 2019, Lansing Manor 2021, Ebony Gardens 2018, Mapleview
Towers 2020, Shiloh Village 2019, Peterson Plaza 2020, Northgate Terrace 2020, Walden
2020, Burt Farms I 2019 — and it lists Northgate **2016** (a partial) where the complete
prior package is **2020 (RCS)**. The manifest is driver config, not ground truth; it gets
regenerated from this inventory before any sweep.

## Complete packages — study + filed submission both on disk (56)

| # | code | property | current cycle | prior cycle(s) |
|--:|---|---|---|---|
| 1 | 2640001 | Northcross | 2024 - RCS | — |
| 2 | 4640009 | Westwood Village | 2025 - RCS | 2020 |
| 3 | 4640013 | Riverwood | 2025 - RCS | 2020 |
| 4 | 75109 | Burt Farms I | 2024 - Renewal & RCS | 2019 |
| 5 | 75453 | Sycamore Green | 2025 - RCS | 2020 |
| 6 | 75474 | New Horizons | 2024 - RCS | 2019 |
| 7 | 75478 | North Park | 2025 (unmarked folder) | 2019+2020 (one FY2020 cycle split across two folders) |
| 8 | 75488 | Woodbury Oakwood (Lakeside) | 2026 - RCS | 2021 |
| 9 | 75495 | Hampshire House | 2024 - RCS | 2019 |
| 10 | 75500 | Lansing Manor | 2026 - RCS | 2021 |
| 11 | 75543 | Noble Tower | 2024 - RCS | — |
| 12 | 75544 | Oaks on North Plaza | 2025 (RCS) | — |
| 13 | 75563 | Oceanport | 2024 - RCS | — |
| 14 | 75564 | Holly House | 2025 - RCS | — |
| 15 | 75566 | Ebony Gardens | 2025 - RCS | 2018 |
| 16 | 75567 | Mapleview Towers | 2026 - RCS | 2020 |
| 17 | 75568 | Market Square | 2026 - RCS | — (2018/2019 are HAP-renewal years, no RCS) |
| 18 | 75569 | Barnum House | 2026 - RCS | — |
| 19 | 75572 | Shiloh Village | 2026 (RCS) | 2019 |
| 20 | 75573 | Morningside Court | 2026 - RCS | — |
| 21 | 75704 | 333 Holly | 2025 - RCS | — |
| 22 | 75705 | The Pines | 2025 - RCS | — |
| 23 | 75708 | Colonial Village | 2026 (RCS) | — |
| 24 | 75830 | Clinton Manor | 2026 - RCS | 2019 |
| 25 | 75831 | Friendship Court | 2026 - RCS | 2018 |
| 26 | 75832 | Newberry Arms | 2026 - RCS | 2019 (2020 renewal re-files the 2019 study — see partials) |
| 27 | 75833 | Circle Park | 2026 - RCS | — |
| 28 | 75917 | Peterson Plaza | 2025 - RCS | 2020 |
| 29 | 75919 | Northgate Terrace CA | 2025 (RCS) | 2020 (RCS) |
| 30 | 75920 | Fairview Homes | 2025 - RCS | 2020 (two firms: Starmark + Gill, multiple versions) |
| 31 | 75921 | Walden | 2025 - RCS | 2020 |
| 32 | 75922 | Marine Terrace | 2026 - RCS | 2021 |
| 33 | 75926 | Oak Center | 2026 - RCS | 2021 |
| 34 | 75927 | Morh Housing | 2026 - RCS | 2021 |

Count: 34 current + 22 prior = **56**. (North Park's 2019+2020 folders are one cycle:
the 2019 folder holds an early study + checklist, the 2020 folder the actual
"2020 North Park 5 Yr RCS Submission" with the 11.07.2019 final study.)

## Partial years — sources without a filed package, or a package reusing an old study

Not audit units; kept as source material and for study-reader coverage.

- Sycamore Green 2014 — study only (MVS)
- New Horizons 2014 — study + rent schedules, no submission
- Shiloh Village 2014 — study + rent schedule
- Noble Tower 2018 folder — the 2016 study + a post-rehab executed RS
- Oaks on North Plaza 2019 — Gill study only
- Northgate Terrace 2016 — 2015 study + executed RS + OCAF memo
- Newberry Arms 2020 — full Option-2 one-year renewal package that re-files the 2019
  study; auditable only as a variant of the 2019 unit

Every other year folder in every property is OCAF/UAF/AAF/admin material with no RCS
study, verified by the classification pass over the full listing
(`corpus-ls-R.txt` capture, study-pattern + package-pattern match, ambiguous folders
opened by hand: Northgate 2025, Hampshire 2026, Riverwood 2024, Walden 2024,
Newberry 2020, North Park 2019/2020, Fairview 2020, plus the seven partials above).
