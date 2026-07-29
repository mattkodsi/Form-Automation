# RCS Corpus Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive every property's real rent schedule and RCS study through the real app in both fill orders, generate the package, diff it against the package the PM team filed, diagnose every discrepancy to root cause, and iterate on the app until the residue is only what the app cannot know.

**Architecture:** Three seams with a cache between the first and second — `drive` (headless chromium, real bundle under `?selftest=1`, real uploads, real Generate) → `extract` (document bytes → a normalized `facts` record of variable data only) → `compare` (two facts records → verdict + cause label). The cache means extractor and comparison logic iterate in seconds without a browser. Fixes are made by root cause across properties, never per property, with the app frozen for the duration of each sweep so results are comparable.

**Tech Stack:** node 24 (no dependencies beyond the repo), pdf-lib (vendored), CDP over node's own WebSocket, Google Drive for Desktop mount (read-only), the app's own `RCSParse` / `parseRsPdf` / `RCSGen`.

---

## Global Constraints

These are absolute. Every task inherits them.

1. **NEVER push to `main`, and never merge to `main`.** Push only `worktree-rcs-corpus`. On this repo a push to `main` is a production deploy.
2. **NEVER enable tier-3 OCR.** It bills per page against Azure Document Intelligence. Under `?selftest=1` there is no Supabase client so `ocrHalf` throws and returns null — Task 1 asserts this. Any code path that would call it directly must stub it to `Promise.resolve(null)`.
3. **The Drive mount is READ-ONLY.** `~/Library/CloudStorage/GoogleDrive-mfkodsi@gmail.com/My Drive/RCS Package Samples`. Never write, move, rename, or delete anything under it. All outputs go to `_archive/corpus-cache/` (gitignored) or the repo.
4. **Edit every source file in the sandbox, then copy in.** Write to `/tmp/…`, `cp` into place, verify with `cmp` and `node --check`, and check `tr -cd '\000' | wc -c` is 0. Host edits on this mounted folder have truncated files and appended NUL bytes before. This applies to `app.js`, `rcs.js`, `gen.js`, `core.js`, `db.js`, `shell.head.html`.
5. **NEVER open with `Read`:** `index.html`, `app/full-mp/templates.js`, `app/full-mp/lib/pdf-lib.min.js`. Use `grep -n`, `head -c`, `sed -n`.
6. **After any `app.js` or `shell.head.html` edit**, the RA-port anchor gate must pass: `python3 app/full-mp/build-ra.py /tmp/rcs-ra-check.html` prints `built …`.
7. **Before any commit that touches app source**, `bash app/full-mp/deliver.sh` must pass end to end. A failing suite aborts before anything is written.
8. **Adding checks to a suite? Raise its `MIN_CHECKS`.** Never lower one to make a red run green.
9. **Never pipe a suite through `| tail`** — a pipeline's exit status is the last command's, and node's failure vanishes.
10. **Never fix from a single property.** A defect must appear in at least two properties, or a code reading must show it is general. A one-property fix is overfitting.
11. **Commit after every task.** Message style: a declarative sentence naming what was learned, not `feat:`.
12. **If a task's gate fails twice in a row, stop and write the reason into `docs/superpowers/plans/NIGHT-LOG.md`, then move to the next independent task.** Do not thrash.

**Paths used throughout:**
- Repo: `/Users/matthewkodsi/Desktop/github/Form-Automation/.claude/worktrees/rcs-corpus`
- Corpus: `$CORPUS` = `~/Library/CloudStorage/GoogleDrive-mfkodsi@gmail.com/My Drive/RCS Package Samples`
- Cache: `_archive/corpus-cache/` (gitignored, created in Task 1)

---

## File Structure

| File | Responsibility |
|---|---|
| `app/full-mp/corpus/build-manifest.js` | **exists** — walk the corpus, content-classify studies, emit `corpus.json`. Task 2 fixes its year−1 lookup and candidate ranking. |
| `app/full-mp/corpus/decrypt-cache.js` | **new** (Task 1) — pre-pass using *our* `pdfdecrypt.js`; writes unlocked copies to the cache. Replaces the Python/MuPDF script. |
| `app/full-mp/corpus/reader-audit.js` | **new** (Task 3) — run `RCSParse.readLetter` over every wave-1 study; emit a defect table. |
| `app/full-mp/corpus/drive.js` | **new** (Task 5) — one property + one fill order → package bytes on disk. |
| `app/full-mp/corpus/extract.js` | **new** (Task 6) — document bytes → `facts` record. Shared by both sides. |
| `app/full-mp/corpus/compare.js` | **new** (Task 7) — two `facts` → verdict rows with cause labels. |
| `app/full-mp/corpus/sweep.js` | **new** (Task 9) — orchestrate N properties × 2 orders, write `sweep-<n>.json`. |
| `app/full-mp/test_corpus.js` | **new** (Task 11) — permanent suite over committed facts; skips loudly with no corpus. |
| `docs/superpowers/plans/NIGHT-LOG.md` | **new** (Task 1) — append-only running log; the thing to read on waking. |

---

## Task 1: Safety rails, cache, and the night log

**Files:**
- Create: `docs/superpowers/plans/NIGHT-LOG.md`
- Create: `app/full-mp/corpus/decrypt-cache.js`
- Modify: `.gitignore`
- Test: `app/full-mp/corpus/test_safety.js`

**Interfaces:**
- Produces: `decryptToCache(corpusRoot, cacheDir, manifestPath) -> {ok, failed, skipped}`; cache layout `<cacheDir>/<propertyFolder>/<relative path>`.

- [ ] **Step 1: Write the failing safety test**

Create `app/full-mp/corpus/test_safety.js`:

```js
/* The rails that make unattended running safe. If any of these stops being
   true, the night must not proceed. */
const fs=require('fs'),path=require('path'),cp=require('child_process');
let n=0,fails=0;
const T=(l,v)=>{n++;if(!v){fails++;console.log('  X '+l);}else console.log('  + '+l);};
const ROOT=path.join(__dirname,'..','..','..');

// 1. tier 3 cannot bill: ocrHalf's only network call goes through supaClient,
//    which selftest never creates.
const ocr=fs.readFileSync(path.join(__dirname,'..','ocr.js'),'utf8');
T('ocr.js reaches the network only via supaClient.functions.invoke',
  (ocr.match(/fetch\(|XMLHttpRequest|axios/g)||[]).length===0
  && /supaClient\.functions\.invoke/.test(ocr));

// 2. the cache is gitignored
const gi=fs.readFileSync(path.join(ROOT,'.gitignore'),'utf8');
T('_archive/corpus-cache/ is gitignored',/_archive\/corpus-cache\//.test(gi));

// 3. we are not on main
const br=cp.execSync('git rev-parse --abbrev-ref HEAD',{cwd:ROOT}).toString().trim();
T('not working on main (got "'+br+'")',br!=='main');

console.log('\n'+(fails?('X SAFETY SUITE FAILED ('+fails+' of '+n+')')
                      :('+ ALL '+n+' SAFETY CHECKS PASSED')));
process.exitCode=fails?1:0;
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node app/full-mp/corpus/test_safety.js`
Expected: FAIL on the gitignore check (`_archive/corpus-cache/` not yet ignored).

- [ ] **Step 3: Add the cache to .gitignore**

Append to `.gitignore` (sandbox-edit, then `cp`):

```
# decrypted corpus copies — derived from Drive, never committed
_archive/corpus-cache/
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node app/full-mp/corpus/test_safety.js`
Expected: `+ ALL 3 SAFETY CHECKS PASSED`

- [ ] **Step 5: Write decrypt-cache.js using OUR decryptor**

Create `app/full-mp/corpus/decrypt-cache.js`. It must use `../pdfdecrypt.js`, not MuPDF — the whole point is that the shipped code is what we depend on. For every entry in the manifest's `readErrors`, plus any file `isEncrypted()` says is locked, write the unlocked bytes to the cache preserving the relative path. Print a per-file line and a total. Do not write anything under `$CORPUS`.

```js
const fs=require('fs'),path=require('path');
global.window={};
global.window.RCSCrypto=require(path.join(__dirname,'..','crypto.js'));
const D=require(path.join(__dirname,'..','pdfdecrypt.js'));
async function decryptToCache(root,cache,manifestPath){
  const man=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const folderOf={};man.properties.forEach(p=>folderOf[p.name]=p.folder);
  let ok=0,failed=0;
  for(const e of (man.readErrors||[])){
    const folder=folderOf[e.property];if(!folder)continue;
    const src=path.join(root,folder,e.file), dst=path.join(cache,folder,e.file);
    let bytes;try{bytes=new Uint8Array(fs.readFileSync(src));}catch(err){failed++;continue;}
    if(!D.isEncrypted(bytes)){failed++;console.log('  not encrypted: '+e.file);continue;}
    const r=await D.decrypt(bytes);
    if(!r.ok){failed++;console.log('  FAIL '+path.basename(e.file)+': '+r.reason);continue;}
    fs.mkdirSync(path.dirname(dst),{recursive:true});
    fs.writeFileSync(dst,Buffer.from(r.bytes));
    ok++;console.log('  ok  R'+r.info.R+' '+r.info.CFM+'  '+path.basename(e.file).slice(0,58));
  }
  return {ok,failed};
}
module.exports={decryptToCache};
if(require.main===module){
  const [root,cache,man]=process.argv.slice(2);
  decryptToCache(root,cache,man).then(r=>{
    console.log('\ndecrypted '+r.ok+', failed '+r.failed);
    process.exitCode=r.failed?1:0;
  });
}
```

- [ ] **Step 6: Run it over the corpus**

```bash
CORPUS=~/Library/CloudStorage/GoogleDrive-mfkodsi@gmail.com/My\ Drive/RCS\ Package\ Samples
node app/full-mp/corpus/decrypt-cache.js "$CORPUS" _archive/corpus-cache app/full-mp/corpus/corpus.json
```
Expected: `decrypted 20, failed 0`. If fewer than 20, that is a `pdfdecrypt.js` regression — stop and log it.

- [ ] **Step 7: Create the night log**

Create `docs/superpowers/plans/NIGHT-LOG.md` with a header and an entry per task, appended as you go:

```markdown
# Night log — RCS corpus loop

Append-only. One entry per task: what ran, what it found, what changed, what is
still open. Read from the top on waking.

## Task 1 — safety rails, cache, night log
- tier-3 OCR confirmed unreachable under selftest (no supaClient) — asserted in test_safety.js
- _archive/corpus-cache/ gitignored
- 20/20 locked studies decrypted with our own pdfdecrypt.js (not MuPDF)
```

- [ ] **Step 8: Commit**

```bash
git add .gitignore app/full-mp/corpus/decrypt-cache.js app/full-mp/corpus/test_safety.js docs/superpowers/plans/NIGHT-LOG.md
git commit -m "The rails come before the run

Tier-3 OCR bills per page and is now asserted unreachable under selftest rather
than assumed so. The decrypted cache is gitignored and built by our own
pdfdecrypt.js, because depending on MuPDF here would mean the corpus proves a
tool we do not ship."
```

---

## Task 2: The manifest tells the truth about year −1

**Files:**
- Modify: `app/full-mp/corpus/build-manifest.js`
- Create: `app/full-mp/corpus/corpus-review.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `corpus.json` where every wave-1 cycle has `inputs.priorRs` non-null, or an explicit `problems` entry saying why not.

Background: the current run leaves **13 of 34** wave-1 cycles with "no year −1 executed rent schedule". That is almost certainly the lookup, not the data — it demands an executed schedule inside a folder named for `year-1`, and Lansing Manor's layout is not universal.

- [ ] **Step 1: Measure the current failure precisely**

```bash
node -e '
const j=require("./app/full-mp/corpus/corpus.json");
j.properties.forEach(p=>{const c=p.cycles.find(x=>x.wave===1);
 if(c&&!c.priorRs)console.log(p.name+"  year0="+c.year+"  cycles="+p.cycles.map(x=>x.cycleLabel).join("|"));});'
```
Record the list in NIGHT-LOG.md before changing anything.

- [ ] **Step 2: For three of those properties, find where the prior schedule actually lives**

```bash
CORPUS=~/Library/CloudStorage/GoogleDrive-mfkodsi@gmail.com/My\ Drive/RCS\ Package\ Samples
find "$CORPUS/<property folder>" -iname "*rent*schedule*" -o -iname "*approved*RS*" | head -20
```
Do this for three separate properties. Do not generalise from one.

- [ ] **Step 3: Widen the lookup**

In `build-manifest.js`, replace the year−1-folder-only search with, in priority order:
1. an executed/approved schedule in a folder whose year is `year0 - 1`;
2. an executed/approved schedule anywhere in the property whose **filename or path** carries `year0 - 1`;
3. the most recent executed/approved schedule anywhere in the property with a year strictly less than `year0`;
4. otherwise null, and a `problems` entry naming which of these were tried.

Record which rule matched in `inputs.priorRsRule` so the manifest says how it decided.

- [ ] **Step 4: Rank multiple study candidates instead of taking the first**

26 properties have more than one. Rank by: filename containing `final` beats `draft`; a numbered package item (`^\d+ - `) beats an unnumbered one; a file not in `Archive/` or `_Old/` beats one that is; later modified time beats earlier. Keep **all** candidates in `studies`, set `chosenStudy` to the winner, and add a `problems` entry when the top two are within one rank of each other.

- [ ] **Step 5: Rebuild and check the numbers moved**

```bash
node app/full-mp/corpus/build-manifest.js "$CORPUS" app/full-mp/corpus/corpus.json
```
Expected: "wave-1 runnable" rises well above 11 of 34; "no open questions" rises above 5. If `priorRs` is still null for more than 5 properties, those are genuinely missing — list them in the review file rather than forcing a match.

- [ ] **Step 6: Write the human review file**

Create `app/full-mp/corpus/corpus-review.md`: one row per property — year 0, chosen study, which rule found the prior RS, the runner-up study if close, and any problems. This is the file Matt reads. Keep it under 60 lines; link to `corpus.json` for detail.

- [ ] **Step 7: Commit**

```bash
git add app/full-mp/corpus/build-manifest.js app/full-mp/corpus/corpus-review.md app/full-mp/corpus/corpus.json docs/superpowers/plans/NIGHT-LOG.md
git commit -m "A prior-year schedule is not always in the prior year's folder"
```

---

## Task 3: Audit the study reader against every real study

**Files:**
- Create: `app/full-mp/corpus/reader-audit.js`
- Create: `app/full-mp/corpus/reader-defects.md`

**Interfaces:**
- Consumes: `corpus.json` from Task 2, cache from Task 1.
- Produces: `reader-defects.md`, a table grouped by **defect class**, not by property.

Known already, from 20 decrypted studies: property name read as `"Dear Mr. Larmore"` (a salutation) and `"550 24th Street"` (an address); 7 studies spend the full 14-page budget and find nothing; no contract number extracted from any of them; only `gill` recognised among the older firms.

- [ ] **Step 1: Write the audit**

For every wave-1 `chosenStudy` (preferring the cache copy when one exists), call `window.RCSParse.readLetter` with a page-counting reader, and record: firm, `property.name`, `property.s8`, unit-row count, pages read, page count, and every scalar it returned. Stub `ocrHalf` to `Promise.resolve(null)`. Emit JSON plus a grouped markdown table.

- [ ] **Step 2: Run it**

```bash
node app/full-mp/corpus/reader-audit.js "$CORPUS" _archive/corpus-cache app/full-mp/corpus/corpus.json
```

- [ ] **Step 3: Group findings into defect classes by hand**

Write `reader-defects.md` with one section per class, each naming **at least two properties** that show it. Expected classes, to be confirmed rather than assumed:
- firm not recognised by `detectFirm` (which firms, how their letterhead differs)
- salutation captured as property name
- street address captured as property name
- contract number present in the letter but not extracted
- letter not found within the page budget

For each: the exact text the reader saw, the value it produced, and the value it should have produced.

- [ ] **Step 4: Commit**

```bash
git add app/full-mp/corpus/reader-audit.js app/full-mp/corpus/reader-defects.md docs/superpowers/plans/NIGHT-LOG.md
git commit -m "What the study reader gets wrong, grouped by why"
```

---

## Task 4: Fix the reader defects, one class at a time

**Files:**
- Modify: `app/full-mp/rcs.js` (sandbox-edit → `cp` → `cmp` → `node --check`)
- Modify: `app/full-mp/test_rcs.js` (raise `MIN_CHECKS`)

**Interfaces:**
- Consumes: `reader-defects.md`.
- Produces: no signature change. `readLetter` returns the same shape, correctly filled.

- [ ] **Step 1: Pick the class affecting the most properties**

Work in descending order of property count. Skip any class affecting only one property (Constraint 10).

- [ ] **Step 2: Add a failing check to `test_rcs.js` first**

Use the real fixture. For a study now in the cache, add it to `_archive/rcs-fixtures/` **trimmed to its letter pages** so the suite stays fast and the page budget stays meaningful. Assert the corrected value:

```js
const nh=await R.readLetter(await reader(path.join(FIX,'mvs-new-horizons.pdf')));
eq('new horizons: the salutation is not the property name',
   nh.scalars['property.name'],'New Horizons Apartments');
```

- [ ] **Step 3: Run it and watch it fail**

Run: `node app/full-mp/test_rcs.js`
Expected: the new check fails with the wrong value; every existing check still passes.

- [ ] **Step 4: Fix `rcs.js`**

Minimal change. Do not special-case a firm where a general rule works — a salutation begins `Dear `, an address begins with digits and ends in a street type; both are recognisable without knowing the firm.

- [ ] **Step 5: Raise `MIN_CHECKS` and re-run**

Run: `node app/full-mp/test_rcs.js`
Expected: `+ ALL <n> RCS PARSE CHECKS PASSED`, `n` above the raised floor.

- [ ] **Step 6: Re-run the audit and confirm the class is gone across all affected properties**

Run: `node app/full-mp/corpus/reader-audit.js …`
Expected: that class is empty. If a property still shows it, the fix was too narrow.

- [ ] **Step 7: Full gate, then commit**

```bash
bash app/full-mp/deliver.sh
git add -A && git commit -m "<sentence naming the class fixed>"
```

- [ ] **Step 8: Repeat Steps 1–7 for the next class.** Log each class to NIGHT-LOG.md as it closes.

---

## Task 5: The drive seam

**Files:**
- Create: `app/full-mp/corpus/drive.js`

**Interfaces:**
- Consumes: `corpus.json`; the bundle built by `app/full-mp/build.sh`.
- Produces: `driveOne({propertyFolder, studyPath, priorRsPath, order}) -> {outDir, files[], tier, warnings[]}` where `order` is `'rs-first'` or `'rcs-first'`. Writes generated documents to `_archive/corpus-cache/_out/<code>/<order>/`.

Reuse the harness in `test_browser.js`: it serves the bundle over a loopback HTTP server, launches chromium `--headless=new` with a pid-scoped user-data-dir, and speaks CDP over node's own WebSocket. **Build to a pid-scoped bundle path** — a fixed name means a concurrent run serves you another build and you pass having tested nothing.

- [ ] **Step 1: Build the bundle to a pid-scoped path and boot under `?selftest=1`**

Assert the app booted (`window.__API` present). Assert `window.RCSPdfDecrypt` is present — the decryptor must be in the bundle being tested.

- [ ] **Step 2: Create a property and a cycle**

```js
await c.eval(`(async()=>{ await window.__API.__localDb();
  const pid=await window.__API.__firstPid(); ... })()`);
```
Use `__newCycle({full:true,programs:['rcs'],label:'CORPUS'})` to get a package with program pills, then `__openCycleForm(pid,cid)`.

- [ ] **Step 3: Feed real bytes through the real file inputs**

Use CDP `DOM.setFileInputFiles` against `#rsFile` and `#rcsFile` so the real `onchange` handlers run — including `unlockPdf`. Do **not** use `__setRsParsed` / `__setRcsParsed`; those bypass the parsers, which are the thing under test.

- [ ] **Step 4: Apply in the requested order**

`rs-first`: upload RS → wait for the row to settle → click `#rsApply` → upload study → click `#rcsApply`.
`rcs-first`: the reverse. Record `__parseRsPdf`'s reported tier. **Assert the tier is never `ocr`** — if it is, the safety rail failed and the run must stop.

- [ ] **Step 5: Generate and capture**

Set `Browser.setDownloadBehavior` to `allow` with a per-run `downloadPath`, click `#bGenerate`, then poll the directory until file count stops changing for 3 seconds. Record any modal text as a warning rather than clicking blindly past it.

- [ ] **Step 6: Prove it on Colonial Village, both orders**

Expected: six documents on disk for each order, non-zero bytes, tier not `ocr`.

- [ ] **Step 7: Commit**

```bash
git add app/full-mp/corpus/drive.js docs/superpowers/plans/NIGHT-LOG.md
git commit -m "The app, driven the way a person drives it"
```

---

## Task 6: The extract seam

**Files:**
- Create: `app/full-mp/corpus/extract.js`
- Test: `app/full-mp/corpus/test_extract.js`

**Interfaces:**
- Produces: `extractFacts(bytes, docType) -> {values:{key:value}, boilerplate:[lines]}` where `docType` is one of `coverLetter | submittalLetter | checklist | rentSchedule | tenantNotice | analysisXlsx | combinedPackage`.

Four traps, each already confirmed and each silently wrong if missed:
- **HUD-92458 values are not in the text layer.** They live in widget `/V`. Text extraction returns blank-template boilerplate on both sides and two empty forms compare as a perfect match. Read annotations in place.
- **The filed checklist page uses a font encoding offset by ASCII −29.** `charCodeAt + 29` decodes it. Undecoded it is line noise.
- **Our generated documents have no word spacing** (`AsoutlinedintheRenewal`). Normalise away all non-alphanumerics before comparing prose.
- **`copyPages` drops the AcroForm dictionary** (233 fields → 0) while keeping the annotations. Never split a document to read its fields.

- [ ] **Step 1: Write the failing test using the local Colonial Village pair**

```js
const facts=await extractFacts(read('_archive/colonial-village-example/Manual RCS Package (PDF).pdf'),'combinedPackage');
eq('the filed rent schedule yields real values, not blank boilerplate',
   facts.rentSchedule.values['unit.0.rent'],'1850');
eq('the checklist decodes rather than reading as line noise',
   /Owner/.test(facts.checklist.values['heading']),true);
```

- [ ] **Step 2: Run it and watch it fail.** Expected: undefined / line noise.

- [ ] **Step 3: Implement, reading widget annotations in place**

Walk `page.node.Annots()`, resolve `/T` and `/V` through `/Parent` when a widget is only a kid, and map HUD-92458's numeric field ids to names via the same map `gen.js` writes with — read it from `gen.js`, do not invent a second one.

- [ ] **Step 4: Run it and watch it pass.**

- [ ] **Step 5: Add the auto-decode check**

Assert that a page whose text scores as shifted is decoded, and that a normal page is **not** — a decoder that fires on clean text corrupts every other document.

- [ ] **Step 6: Commit**

---

## Task 7: The compare seam

**Files:**
- Create: `app/full-mp/corpus/compare.js`
- Test: `app/full-mp/corpus/test_compare.js`

**Interfaces:**
- Produces: `compareFacts(ours, theirs) -> {rows:[{doc,key,ours,theirs,status,cause}], drift:[…]}` where `status` ∈ `match | mismatch | missing-ours | missing-theirs` and `cause` ∈ `parser | fill-order | generator | template | pm-hand-edit | unknowable | undiagnosed`.

- [ ] **Step 1: Write the test for normalisation rules**

Money `"1,850"` and `"1850"` match. Dates `"10/01/2026"` and `"10/1/2026"` match. Prose matches after stripping non-alphanumerics. `"Colonial Village"` vs `"Colonial Village/White Oak Townhomes"` does **not** match — that is a real difference (the filed schedule carries the alias) and must not be normalised away.

- [ ] **Step 2: Run, fail, implement, pass.**

- [ ] **Step 3: Add the two-order comparison**

`compareRuns(rsFirst, rcsFirst)` returns rows where the two fill orders disagree. **These need no ground truth and are the highest-severity findings** — same inputs, two different packages means order-dependent state in the fill logic.

- [ ] **Step 4: Every row starts `undiagnosed`.** `cause` is only set by a human or by an explicit rule with a comment saying how it knows. Never guess a cause to make a report look finished.

- [ ] **Step 5: Commit**

---

## Task 8: Lansing Manor, by hand

**Files:**
- Create: `app/full-mp/corpus/verified/lansing-manor.json`

This is the gate that catches the one silent failure mode of the whole design: an extractor bug that misreads **both** sides identically turns a real difference into a false match, and no automation can catch it because the automation is what is wrong.

- [ ] **Step 1: Run drive + extract + compare for Lansing Manor, both orders.**
- [ ] **Step 2: Open the filed PDFs and read the values with your own eyes.** Property name and alias, contract number, effective date, every unit type with its count, rent, utility allowance and gross rent, appraiser and firm, signatory, PM contact.
- [ ] **Step 3: Write them into `verified/lansing-manor.json` by hand.** This file is ground truth entered by a person, not by a parser.
- [ ] **Step 4: Assert the extractor agrees with the hand-entered file** on both the filed side and ours. Any disagreement is an extractor bug — fix it before any sweep, and log it.
- [ ] **Step 5: Commit.** This file is small and worth committing even though it holds real values.

---

## Task 9: The calibration set of five

**Files:**
- Create: `app/full-mp/corpus/sweep.js`

Pick five properties for **maximum variety**, not convenience: different firms (belfry, renzi, gill, cornerstone, one unrecognised), different unit-type mixes, one with non-revenue units, one with no FHA number, one whose filed package is a single combined PDF.

- [ ] **Step 1: Write `sweep.js`** — takes a property list, runs both orders, extracts, compares, writes `sweep-<n>.json` plus `sweep-<n>.md` grouped **by cause then by key**, never by property.
- [ ] **Step 2: Run it over the five.**
- [ ] **Step 3: Diagnose every row.** Most volume here will be extractor and harness defects, not app defects. Fix those first — they are noise that would otherwise multiply across 34 properties.
- [ ] **Step 4: Re-run until the five produce only rows with a real cause.**
- [ ] **Step 5: Commit the sweep output and the fixes.**

---

## Task 10: The full sweep, app frozen

- [ ] **Step 1: Freeze.** Record the current commit SHA in NIGHT-LOG.md. **Change no app source until the sweep completes.** A moving app makes property 3 and property 30 incomparable and the whole sweep worthless.
- [ ] **Step 2: Run all 34 × 2 orders.** Expect roughly an hour. Log progress per property so a crash is resumable.
- [ ] **Step 3: Write `sweep-1.md`** — counts by cause, counts by document, the fill-order disagreements first, then the top 20 keys by row count.
- [ ] **Step 4: Fix by root cause in descending row count**, obeying Constraint 10. Each fix: failing check first, fix, full `deliver.sh`, commit.
- [ ] **Step 5: Re-sweep and diff against `sweep-1.json`.** Report **resolved / persisting / NEW**. A new row is a regression your fix introduced and outranks everything else.
- [ ] **Step 6: Repeat 4–5** until the remaining rows are all `pm-hand-edit`, `template` or `unknowable`.

---

## Task 11: Make it permanent

**Files:**
- Create: `app/full-mp/test_corpus.js`
- Modify: `app/full-mp/run_tests.sh`

- [ ] **Step 1: Write the suite** over the committed `verified/*.json` facts, so it runs with **no Drive access and no network**. Skip **loudly** — never as a pass — when the corpus mount is absent, matching `test_browser.js`'s convention.
- [ ] **Step 2: Set `MIN_CHECKS`.**
- [ ] **Step 3: Register in `run_tests.sh`.**
- [ ] **Step 4: `bash app/full-mp/deliver.sh`** must pass with the new suite included.
- [ ] **Step 5: Commit and push the branch** (`git push origin worktree-rcs-corpus`). **Not `main`.**

---

## Morning Report

Write `docs/superpowers/plans/MORNING-REPORT.md` last, containing, in this order:

1. **What the app does better than it did last night** — defects fixed, with the property count each affected.
2. **The fill-order disagreements** — same inputs, different packages. Highest severity.
3. **What still differs and why** — grouped by cause, with counts.
4. **What needs Matt** — study candidate choices, year-0 picks, and anything labelled `pm-hand-edit` that might actually be an app defect.
5. **What I got wrong overnight and how I found it** — every self-correction, so the reasoning is auditable.
6. **Where it stopped, if it stopped**, and the exact command to resume.
