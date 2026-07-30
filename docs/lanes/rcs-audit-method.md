# Gate 1 — the method, one page

*rcs-audit lane, 2026-07-30. Nothing below has been run against the corpus; per the
lane brief this waits for your approval and then the blind trial.*

## 1. How SHOULD is built

For each (property, year) I read the two governing sources **by eye, before opening
either output**: every page of the appraiser's RCS study and of the prior year's
executed rent schedule, rendered to images (poppler, fixed DPI) and read visually.
From them I write a field-level record of what the six documents must contain — every
rent-roll row, potential, name, date, principal, checklist tick. No text parser
contributes to SHOULD; the parsers are the thing under test. Where a field's governing
source is a third document the app never sees (the Col. 5 utility allowance), SHOULD
records "third-document" plus what that folder's exhibit says, and the finding — if
any — is charged accordingly, not guessed against the study.

## 2. How a page becomes judgeable — mechanically

Every page of all three versions (SHOULD's sources, OURS, FILED) is rendered to PNG at
one DPI with `pdftoppm`. Values are then compared three ways: field-by-field SHOULD vs
OURS and SHOULD vs FILED (values read off the page images; OURS' AcroForm values also
read from the fields directly); OURS vs FILED as a **pixel diff** per page
(`rdiff.js`), which reports each differing region's coordinates, ink direction and a
side-by-side PNG — so a dropped `$`, a blank-where-0, or a row landing one line low is
caught even where normalized values compare equal. Workbooks are compared cell-by-cell
out of the xlsx XML, formulas included. Every diff region is either explained by a
known style class (signatures, DocuSign chrome, the CA's Parts F/I) or becomes a
finding. The middle is observed, not inferred: the real form driven in a real browser
(`?selftest=1`), checking what each source parsed, which cell it landed in, its
provenance colour, and that it survives save.

## 3. How each instrument was proved (all run today; planted difference must be found, identical pair must stay silent)

- **Inventory (`ls -R`)** — `find` silently returns one entry on the Drive mount, so it
  is discarded; `ls -R` enumerated 5,272 entries and found 12+ package years the repo's
  manifest misses. The manifest is demoted to driver config, regenerated from disk.
- **Renderer + pixel diff** — same content from different bytes: 0 differing pixels; a
  planted one-digit nudge (2,050→2,060): exactly one 9×13 px region at that digit; a
  planted dropped `$`: region reported with "ink missing" direction.
- **Eye-read channel** — the nudged page, rendered and read visually, returns 2,060.
- **AcroForm reader** — planted 2050 vs 2060 detected; identical pair silent.
- **Workbook comparator** — one cell planted in a real OCAF workbook (37→99937)
  detected as exactly `A17`; untouched copy reports IDENTICAL.

Anything that fails this bar is discarded, whoever wrote it — `find` already was.

## 4. Scale

**56 complete packages** (34 current-cycle + 22 prior-cycle; see
`rcs-audit-inventory.md`). Per package: ~35–60 source/output pages eye-read, ~18
documents rendered and diffed, one browser drive. Waves of 5 packages in parallel at
roughly 2.5–4 h per wave → the corpus in about **2–3 working days** of running.
Cash cost ≈ **$1–2 total** (Azure OCR only where the text tiers refuse); everything
else is local. Live-account writes are `ZZ-CORPUS-*` only, deleted after every run and
verified back to zero.

## 5. What a finding looks like

One ledger row: `property · year · document · field · SHOULD · OURS · FILED · verdict
· mechanism · evidence`. The verdict names the wrong leg — `app wrong`, `team wrong`,
`both wrong`, or `cosmetic` — decided by which output disagrees with SHOULD; FILED is
evidence, never the referee. Evidence travels with the row: the rendered region or
page image, the extracted values, and where each was read (file + page). Style,
ordering, file naming and optional extra documents are not findings. A row with no
evidence does not count; no repair is written against an undiagnosed row.
