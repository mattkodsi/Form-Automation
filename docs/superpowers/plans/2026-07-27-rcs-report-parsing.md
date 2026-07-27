# RCS Report Parsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read the appraiser's completed RCS study PDF and fill the form's market rents, utility allowances, 150% SAFMRs, appraiser identity and property identity — the same way the executed rent schedule already fills its own cells.

**Architecture:** A new pure module `app/full-mp/rcs.js` (`window.RCSParse`) takes the positioned text runs that `rsTextPages()` already produces and returns a parsed record. Two independent readers — the appraiser's transmittal letter and the HUD-92273-S8 grids — produce the same shape and are reconciled, letter winning, disagreements surfaced. `app.js` gains an `rcs*` family mirroring the existing `rs*` family line for line.

**Tech Stack:** Plain browser JS (no framework, no build step beyond `cat`), pdf-lib (vendored), Node for tests. No network calls, no AI model calls in this version.

## Global Constraints

Every task's requirements implicitly include this section.

- **Never `Read` these files** — they will crash the session: `index.html` (~411k tok), `app/full-mp/templates.js` (~237k tok), `app/full-mp/lib/pdf-lib.min.js` (~131k tok). Use `grep -n` / `sed -n` / `head -c`.
- **Never hand-edit `index.html`.** Edit source in `app/full-mp/`, then rebuild.
- **Never host-edit source files directly.** Write to `/tmp` first, `cp` into place, verify with `cmp` and `node --check`. Host `Write`/`Edit` on this mounted folder has truncated files and appended NUL bytes before.
- **Read `app/full-mp/FORM-RULES.md` before touching any form cell, dropdown or click handler.** Eighteen rules, each written because breaking it shipped a bug.
- **Every document-fed cell must say so** (FORM-RULES): `rcsTag` must cover every key `rcsFillFromParsed` writes.
- **API parity:** any function added to `db.js` must be added to `db.supabase.js` with identical semantics, and vice versa.
- **Post-edit gates, all four:** source rebuilds byte-for-byte to `index.html` · 0 NUL bytes in every source file · `node --check` clean · `bash app/full-mp/run_tests.sh` passes.
- **RA-port anchor gate after any `app.js` or `shell.head.html` edit:** `python3 app/full-mp/build-ra.py /tmp/rcs-ra-check.html` must print `built …`. If it fails, an anchor moved — update it in `build-ra.py`.
- **Adding checks to a suite? Raise its `MIN_CHECKS`.** Never lower it to make a red run green.
- **Never pipe a test suite through `| tail`** — a pipeline reports the last command's exit status, which hides node's failure.
- **UI copy standard:** professional prose, no shorthand. Blue provenance highlighting means "non-empty on file".
- **Money values are integers** (Supabase money columns are `integer`); `$/sq ft` keeps two decimals and is corroboration only, never stored.

## Ground Truth

Every string below was copied from actual tool output against the one real study in the repo:
`_archive/colonial-village-example/Manual RCS Package (PDF).pdf` (60 pages, 0-indexed, Belfry Valuation, Colonial Village).

| What | Where |
|---|---|
| Transmittal letter p1 (identity + unit table) | page index **5** |
| Transmittal letter p2 (three numeric tables + signature) | page index **6** |
| Table of contents | page index **7** |
| HUD-92273-S8 grid — Two Bedroom | page index **26** |
| HUD-92273-S8 grid — Three Bedroom | page index **34** |
| Image-only pages (0 text runs) | page indices **32**, **36** |

Expected parse results, asserted literally in tests:

| Cell | 2BR/1BA | 3BR/1BA |
|---|---|---|
| `proposed` (market rent) | 1850 | 2400 |
| `ua_rcs` (utility allowance) | 161 | 171 |
| `safmr_rcs` (**150%** SAFMR) | 2085 | 2745 |
| count | 32 | 33 |
| sq ft | 790 | 1008 |

Totals: gross renewal `149195` · gross SAFMR (base) `104870` · 150% of SAFMR gross `157305` · verdict `149195 < 157305` (passes).
Identity: `property.s8` = `OH10M000236` · `appr.firm` = `Belfry Valuation, LLC` · `appr.name` = `Aaron M. Zabel`.

## Corrections to the design document

Cartography against the real PDF contradicted the approved design in three places. **These corrections are authoritative for this plan:**

1. **The grids carry five comparables, not three.** Column pitch is exactly 63pt: `Subject` x≈124, `Comp #1` x≈231, then +63 each to `Comp #5` x≈483. The subject has a `Data` column but **no `$ Adj` column** — every section header row prints `Data $ Adj` five times, starting at comp 1.
2. **The table of contents does NOT map to checklist items 4–17.** The TOC has 15 entries; it has **no** entry for Scope of Work, the selection-of-comparables narrative, the locator map, or the rent grids themselves, and its printed page numbers are unreliable (off by +7/+8 from the PDF index and internally inconsistent with the pages' own `19 | Page` footers). Task 7 therefore detects checklist evidence by scanning **every page** for section headings and cites the **PDF page index**, never the TOC's numbers.
3. **Anchors must be matched on normalized text.** Re-exporting the same document destroys word spacing (`AsoutlinedintheRenewalHAPcontract…`), drops curly quotes and en-dashes, and shifts every y coordinate. All anchor matching goes through `norm()` (casefold + strip every non-alphanumeric). Absolute y coordinates are never anchors.

Additionally, one trap that is not in the design and must not be lost:

4. **Letter table 3 prints the BASE SAFMR, not the 150% figure.** `$1,390` / `$1,830` are base; the 150% values the form wants (`$2,085` / `$2,745`) are in **table 1**. `units.N.safmr_rcs` holds the 150% ceiling (per `db.js:109`). The reader cross-checks `table1 ≈ table3 × 1.5` and warns on mismatch.

## File Structure

| File | Responsibility |
|---|---|
| `app/full-mp/rcs.js` (**new**, ~400 lines) | `window.RCSParse`. Pure: pages in, record out. Line assembly, normalization, page classification, letter reader, grid reader, reconciliation. No DOM, no store, no network. |
| `app/full-mp/build.sh` (modify) | Concatenate `rcs.js` between `ocr.js` and `gen.js`. |
| `app/full-mp/test_rcs.js` (**new**) | Node suite driving `rcs.js` against the real study PDF. |
| `app/full-mp/run_tests.sh` (modify) | Register `test_rcs.js` — the only place a suite is registered. |
| `app/full-mp/app.js` (modify) | `rcsVal`/`rcsUnitVal`/`rcsOf`/`rcsTag`/`rcsFillFromParsed`/`rcsRemember`/`rcsRecall`; live source rows; upload + apply wiring; checklist ticks; record checks. |
| `app/full-mp/db.js` + `db.supabase.js` (modify) | `setCycleRcs`/`getCycleRcs` on both, per API parity. |
| `supabase` migration | Add `rcs_doc jsonb` to `cycle`. |

---

### Task 1: `rcs.js` foundation — line assembly, normalization, page classification

The parser's whole surface rests on one fact: **`rsTextPages()` returns runs that fragment mid-word.** `"BELFRY VA"` + `"LUATION"`, `"RCS"` + `" "` + `"RENTS"`, `"("` + `"708"` + `") "` + `"500"` + `"-"` + `"2380"`. Nothing may match against a single run; everything matches against assembled lines. This task builds that assembler and proves it against the real document.

Note also that `rsTextPages` returns **PDF-space y** (origin bottom-left): larger y is higher on the page. Sorting descending by y walks the page top to bottom.

**Files:**
- Create: `app/full-mp/rcs.js`
- Create: `app/full-mp/test_rcs.js`
- Modify: `app/full-mp/build.sh`
- Modify: `app/full-mp/run_tests.sh`
- Modify: `app/full-mp/app.js` (add `__rsTextPages` test hatch to `module.exports`, line ~2933; fix the dangling rejection in `rsInflate`, line ~880)

**Interfaces:**
- Consumes: `rsTextPages(doc)` from app.js — returns `Array<Array<{x,y,s,d}>>`, one run list per page in page order.
- Produces, on `window.RCSParse`:
  - `norm(s) -> string` — casefold, strip every non-alphanumeric.
  - `lines(runs, tol=2) -> Array<{y, text, runs}>` — runs grouped into baselines, top of page first, each `runs` array sorted by ascending x, `text` the runs concatenated with whitespace collapsed.
  - `money(s) -> number|''` — `"$1,850"` → `1850`, rounded to integer.
  - `dec(s) -> number|''` — `"$2.34"` → `2.34`, two decimals kept.
  - `classify(pages) -> {letter:[i], grids:[i], toc:i|null, cert:i|null, blank:[i]}` — page indices by role.

- [ ] **Step 1: Write the failing test**

Create `app/full-mp/test_rcs.js`:

```js
/* test_rcs.js — the RCS report reader, against the one real study in the repo.
   Fixture: _archive/colonial-village-example/Manual RCS Package (PDF).pdf
   Adding checks? Raise MIN_CHECKS. Never lower it to make a red run green. */
process.on('unhandledRejection',e=>{fail('unhandled rejection — an async throw is a failure, never a pass',e);process.exit(1);});
process.on('uncaughtException',e=>{fail('uncaught exception',e);process.exit(1);});
global.CSS={escape:s=>s};
const mem={};
global.window={addEventListener:(e,cb)=>{if(e==='DOMContentLoaded')global.__ready=cb;},localStorage:{getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=v;},removeItem:k=>{delete mem[k];}},scrollY:0,scrollTo(){}};
function mk(id){return {id:id||'',style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},setAttribute(){},getAttribute(){return'';},appendChild(){},addEventListener(){},closest(){return null;},parentElement:null,querySelector(){return null;},querySelectorAll(){return[];},innerHTML:'',textContent:'',onclick:null,value:'',checked:false,focus(){},select(){},setSelectionRange(){},files:[]};}
const els={};
global.document={getElementById:id=>els[id]||(els[id]=mk(id)),querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>mk(),addEventListener(){},body:{classList:{toggle(){},contains(){return false;}}}};
const fs=require('fs'),path=require('path'),os=require('os');

const MIN_CHECKS=6;                  // the count this file is known to run to the end
let n=0,fails=0,verdict=null;
const BAR='═'.repeat(68);
function fail(msg,err){
  verdict='fail'; process.exitCode=1;
  console.log('\n'+BAR);
  console.log('  ✗✗✗  RCS PARSE SUITE FAILED — DO NOT SHIP  ✗✗✗');
  console.log('  '+msg);
  if(err)console.log(String(err&&err.stack||err).replace(/^/gm,'  '));
  console.log(BAR);
  console.log(`✗ RCS PARSE SUITE FAILED (${n} checks ran, ${fails} failed)`);
}
function pass(){verdict='pass';console.log(`\n✓ ALL ${n} RCS PARSE CHECKS PASSED\n`);}
function finish(){
  if(fails)return fail(`${fails} of ${n} checks failed — see the ✗ lines above`);
  if(n<MIN_CHECKS)return fail(`only ${n} of the expected ${MIN_CHECKS} checks ran — the suite died partway`);
  pass();
}
process.on('exit',()=>{if(verdict===null)fail(`the run ended without a verdict after ${n} of ${MIN_CHECKS} checks — it died partway`);});
const eq=(label,got,want)=>{n++;const p=JSON.stringify(got)===JSON.stringify(want);if(!p){fails++;console.log(`  ✗ ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);}else console.log(`  ✓ ${label}`);};
const T=(label,v)=>eq(label,!!v,true);

const _d=__dirname;
(0,eval)(fs.readFileSync(path.join(_d,'lib/pdf-lib.min.js'),'utf8'));
global.window.PDFLib=global.window.PDFLib||globalThis.PDFLib;
const _b=path.join(os.tmpdir(),'rcs_parse_test.js');
fs.writeFileSync(_b,['core.js','db.js','app.js','rcs.js'].map(x=>fs.readFileSync(path.join(_d,x),'utf8')).join('\n'));
const app=require(_b);
const R=global.window.RCSParse;
const FIXTURE=path.join(_d,'..','..','_archive','colonial-village-example','Manual RCS Package (PDF).pdf');

(async()=>{
  /* ---- pure helpers ---- */
  eq('norm strips punctuation and case','RENT COMPARABILITY GRID'===''?'':R.norm('Rent Comparability Grid'),'rentcomparabilitygrid');
  eq('norm survives lost word spacing',R.norm('AsoutlinedintheRenewal'),R.norm('As outlined in the Renewal'));
  eq('money parses a dollar amount',R.money('$1,850'),1850);
  eq('dec keeps two decimals',R.dec('$2.34'),2.34);

  /* ---- against the real document ---- */
  const P=global.window.PDFLib;
  const doc=await P.PDFDocument.load(new Uint8Array(fs.readFileSync(FIXTURE)),{ignoreEncryption:true,throwOnInvalidObject:false});
  const pages=await app.__rsTextPages(doc);
  eq('the study has 60 pages',pages.length,60);

  const L=R.lines(pages[6]);
  // the letterhead fragments as "BELFRY VA"+"LUATION"; only assembly recovers it
  T('line assembly rejoins a mid-word split',L.some(l=>l.text==='BELFRY VALUATION'));
  // small-caps headings shatter into per-letter runs at two baselines
  T('line assembly rejoins shattered small caps',L.some(l=>R.norm(l.text)==='ownersgrossrenewalpotentialcalculation'));

  const C=R.classify(pages);
  eq('classify finds both letter pages',C.letter,[5,6]);
  eq('classify finds both grid pages',C.grids,[26,34]);
  eq('classify finds the table of contents',C.toc,7);
  eq('classify reports the image-only pages',C.blank,[32,36]);

  finish();
})().catch(e=>{fail('the suite threw',e);process.exit(1);});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation && node app/full-mp/test_rcs.js
```

Expected: FAIL — `rcs.js` does not exist yet, so the bundle write throws `ENOENT`.

- [ ] **Step 3: Add the `__rsTextPages` test hatch and fix the dangling rejection in app.js**

Two edits to `app.js`. First, `rsInflate` (~line 880) leaves an unhandled promise rejection when a stream fails to inflate — harmless in the browser but it aborts a Node test run, and this parser calls it across 60 pages. Replace:

```js
async function rsInflate(seg){let e=seg.length;while(e>0&&(seg[e-1]===10||seg[e-1]===13||seg[e-1]===32))e--;seg=seg.slice(0,e);
  const ds=new DecompressionStream('deflate');const w=ds.writable.getWriter();const pr=new Response(ds.readable).arrayBuffer();await w.write(seg);await w.close();return new TextDecoder('latin1').decode(await pr);}
```

with:

```js
async function rsInflate(seg){let e=seg.length;while(e>0&&(seg[e-1]===10||seg[e-1]===13||seg[e-1]===32))e--;seg=seg.slice(0,e);
  const ds=new DecompressionStream('deflate');const w=ds.writable.getWriter();
  /* Claim the read promise's rejection before anything can throw. A truncated
     stream rejects BOTH the writer and this promise; returning on the writer's
     throw used to leave this one unhandled, which is only a console warning in
     the browser but kills a Node test run outright. */
  const pr=new Response(ds.readable).arrayBuffer().catch(()=>null);
  try{await w.write(seg);await w.close();}catch(err){await pr;throw err;}
  const buf=await pr;if(buf==null)throw new Error('inflate failed');
  return new TextDecoder('latin1').decode(buf);}
```

Second, add the test hatch to `module.exports` (~line 2933). Find `__cell:(k)=>form[k],` and insert immediately after it:

```js
__rsTextPages:(doc)=>rsTextPages(doc),
```

- [ ] **Step 4: Write `rcs.js`**

Per the global constraints, write to `/tmp` and `cp` into place — do not host-edit.

```js
/* rcs.js — reads the appraiser's completed RCS study.  window.RCSParse
   ------------------------------------------------------------------
   PURE: positioned text runs in, parsed record out. No DOM, no store, no
   network — which is what makes it testable in Node against real PDFs.

   It does not get its own PDF engine. rsTextPages(doc) in app.js already
   returns one run list per page; app.js passes those in.

   THE ONE FACT EVERYTHING RESTS ON: runs fragment mid-word. The letterhead
   arrives as "BELFRY VA"+"LUATION"; a phone number as "("+"708"+") "+"500"+
   "-"+"2380"; a small-caps heading as one run per letter across two baselines.
   Nothing may be matched against a single run. Everything matches against an
   assembled line, and every anchor goes through norm() — because re-exporting
   the same document destroys word spacing ("AsoutlinedintheRenewal"), drops
   curly quotes, and shifts every y coordinate. Absolute y is never an anchor. */
(function(){
'use strict';

/* Casefold and strip every non-alphanumeric. The only form in which document
   text may be compared to an expected string. */
function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');}

/* Runs -> baselines. y is PDF space (origin bottom-left), so descending y walks
   the page top to bottom. tol=2 because the real document offsets a small-caps
   capital 2pt above its own word ("AS IS" sits at y=118.0 and y=120.0). */
function lines(runs,tol){
  tol=tol==null?2:tol;
  const rows=[];
  (runs||[]).slice().sort(function(a,b){return (b.y-a.y)||(a.x-b.x);}).forEach(function(r){
    if(!r||!r.s)return;
    let row=null;
    for(let i=0;i<rows.length;i++)if(Math.abs(rows[i].y-r.y)<=tol){row=rows[i];break;}
    if(row)row.runs.push(r);else rows.push({y:r.y,runs:[r]});
  });
  return rows.map(function(q){
    q.runs.sort(function(a,b){return a.x-b.x;});
    return {y:q.y,text:q.runs.map(function(r){return r.s;}).join('').replace(/\s+/g,' ').trim(),runs:q.runs};
  }).filter(function(q){return q.text;});
}

function money(s){const t=String(s==null?'':s).replace(/[^0-9.]/g,'');if(!t)return '';const n=parseFloat(t);return isFinite(n)?Math.round(n):'';}
function dec(s){const t=String(s==null?'':s).replace(/[^0-9.]/g,'');if(!t)return '';const n=parseFloat(t);return isFinite(n)?Math.round(n*100)/100:'';}

/* Page roles. Cheap: one lines() pass per page, matching normalized anchors.
   A 52-page valuation report is not a 3-page form, so nothing else reads a page
   this has not identified. */
function classify(pages){
  const out={letter:[],grids:[],toc:null,cert:null,blank:[]};
  (pages||[]).forEach(function(runs,i){
    if(!runs||!runs.length){out.blank.push(i);return;}
    const L=lines(runs);
    const all=L.map(function(l){return norm(l.text);}).join('|');
    // the grid names itself twice over: the HUD form title and the subject's FHA cell
    if(all.indexOf('rentcomparabilitygrid')>=0&&all.indexOf('subjectsfha')>=0){out.grids.push(i);return;}
    if(all.indexOf('tableofcontents')>=0&&out.toc===null){out.toc=i;return;}
    // the transmittal letter: page 1 carries the bracketed FHA line, page 2 the totals
    if(all.indexOf('marketrentalanalysis')>=0&&all.indexOf('fhaprojectno')>=0){out.letter.push(i);return;}
    if(all.indexOf('totalgrossrenewalrent')>=0&&all.indexOf('150ofsafmrgrossrent')>=0){out.letter.push(i);return;}
    if(out.cert===null&&all.indexOf('certification')>=0&&all.indexOf('appraiser')>=0)out.cert=i;
  });
  out.letter.sort(function(a,b){return a-b;});
  out.grids.sort(function(a,b){return a-b;});
  return out;
}

window.RCSParse={norm:norm,lines:lines,money:money,dec:dec,classify:classify};
})();
```

- [ ] **Step 5: Register `rcs.js` in the build and the test runner**

In `app/full-mp/build.sh`, add `rcs.js` between `ocr.js` and `gen.js`:

```bash
{ cat "$d/shell.head.html" "$d/lib/pdf-lib.min.js" "$d/lib/supabase.min.js"; printf '\n;\n'; cat "$d/config.js" "$d/core.js" "$d/db.js" "$d/db.supabase.js" "$d/app.js" "$d/ocr.js" "$d/rcs.js" "$d/gen.js" "$d/xlsx.js" "$d/templates.js" "$d/shell.tail.html"; } > "$out"
```

In `app/full-mp/run_tests.sh`, add the suite to the list:

```bash
suites="test_db.js test_interactions.js smoke_combined.js test_gen.js test_rcs.js"
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation && node app/full-mp/test_rcs.js
```

Expected: PASS — `✓ ALL 11 RCS PARSE CHECKS PASSED`.

- [ ] **Step 7: Run every gate**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation
node --check app/full-mp/rcs.js && node --check app/full-mp/app.js
for f in app/full-mp/*.js; do c=$(tr -d '\0' < "$f" | wc -c); o=$(wc -c < "$f"); [ "$c" = "$o" ] || echo "NUL BYTES IN $f"; done
bash app/full-mp/run_tests.sh
python3 app/full-mp/build-ra.py /tmp/rcs-ra-check.html
```

Expected: `node --check` silent · no NUL-byte lines · every suite passes · `built …` printed. If `build-ra.py` fails, an anchor moved — update it in `build-ra.py` (that file ships to Kinley with every handoff).

- [ ] **Step 8: Commit**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation
git add app/full-mp/rcs.js app/full-mp/test_rcs.js app/full-mp/build.sh app/full-mp/run_tests.sh app/full-mp/app.js
git commit -m "The study is 60 pages; six of them are worth reading"
```

---

### Task 2: Letter reader — identity

Transmittal letter page 1 is a business letter with a fixed skeleton: date, sender block, addressee block, subject block, salutation. Each field is found by **what it looks like**, never by line number — a different firm will stack the same facts at different offsets.

Verbatim from page index 5, in order:

```
June 30, 2026
Belfry Valuation, LLC
PO BOX 8140,
Bartlett, IL 60103
(P) (708) 500-2380
(E) azabel@belfryvaluation.com
Mr. Matthew Kim
Related Affordable
30 Hudson Yards,
New York, New York 10001
Market Rental Analysis
Colonial Village
3641 Irving Street,
Cincinnati, Hamilton County, Ohio 45220
[FHA Project No. OH10M000236]
Date of Value: June 23, 2026
```

Three normalizations are not optional:

1. **The study's "FHA Project No." is the Section 8 number.** Belfry has miscategorised it. The value goes to `property.s8` and **never** to `property.fha`. The grids print the same number hyphenated (`OH10-M000-236`), so strip non-alphanumerics before comparing or writing.
2. **The address line carries a county** (`Hamilton County`) that belongs in no cell, and spells the state in full (`Ohio` → `OH`).
3. **The addressee is the study's orderer, not necessarily the package's point of contact.** `poc.name` is offered as a source option only — ranked below Related Affordable, never auto-preferred, never written by `rcsFillFromParsed`.

**Files:**
- Modify: `app/full-mp/rcs.js`
- Modify: `app/full-mp/test_rcs.js`

**Interfaces:**
- Consumes: `lines()`, `norm()` from Task 1.
- Produces: `readLetter(pages, cls) -> {scalars:{}, units:[], totals:{}, warnings:[]}`. This task fills `scalars` only; Task 3 fills `units` and `totals` in the same function. `scalars` keys are form keys verbatim: `appr.firm`, `appr.addr_street`, `appr.addr_city`, `appr.addr_state`, `appr.addr_zip`, `appr.phone` (10 bare digits — `fmtPhone` formats at fill time), `appr.email`, `appr.name`, `property.name`, `property.addr_street`, `property.addr_city`, `property.addr_state`, `property.addr_zip`, `property.s8`. Plus two corroboration-only values that are **never** written to a cell: `_date_of_value`, `_poc_name`.

- [ ] **Step 1: Write the failing test**

Append inside the `(async()=>{ … })()` block in `test_rcs.js`, immediately before `finish();`:

```js
  /* ---- letter reader: identity ---- */
  const LET=R.readLetter(pages,C);
  eq('appraiser firm',LET.scalars['appr.firm'],'Belfry Valuation, LLC');
  eq('appraiser street',LET.scalars['appr.addr_street'],'PO BOX 8140');
  eq('appraiser city',LET.scalars['appr.addr_city'],'Bartlett');
  eq('appraiser state',LET.scalars['appr.addr_state'],'IL');
  eq('appraiser zip',LET.scalars['appr.addr_zip'],'60103');
  eq('appraiser phone is bare digits',LET.scalars['appr.phone'],'7085002380');
  eq('appraiser email',LET.scalars['appr.email'],'azabel@belfryvaluation.com');
  eq('appraiser name from the signature block',LET.scalars['appr.name'],'Aaron M. Zabel');
  eq('property name',LET.scalars['property.name'],'Colonial Village');
  eq('property street loses its trailing comma',LET.scalars['property.addr_street'],'3641 Irving Street');
  eq('property city drops the county',LET.scalars['property.addr_city'],'Cincinnati');
  eq('state name becomes an abbreviation',LET.scalars['property.addr_state'],'OH');
  eq('property zip',LET.scalars['property.addr_zip'],'45220');
  // Belfry prints the Section 8 number under an "FHA Project No." label. It is
  // the Section 8 number. It must never reach property.fha.
  eq('the FHA-labelled number is the Section 8 number',LET.scalars['property.s8'],'OH10M000236');
  eq('the study never sources an FHA number',LET.scalars['property.fha'],undefined);
  // the addressee ordered the study; that is not the same as the package's contact
  eq('the addressee is corroboration only',LET.scalars['poc.name'],undefined);
  eq('the addressee is still reported',LET.scalars['_poc_name'],'Mr. Matthew Kim');
  eq('date of value is read but not a cell',LET.scalars['_date_of_value'],'2026-06-23');
```

Raise the floor: `const MIN_CHECKS=29;`

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation && node app/full-mp/test_rcs.js
```

Expected: FAIL — `R.readLetter is not a function`.

- [ ] **Step 3: Implement the identity reader**

Insert into `rcs.js` above the `window.RCSParse={…}` line:

```js
/* Full state names appear in letter prose ("Cincinnati, Hamilton County, Ohio
   45220"); every form cell wants the postal abbreviation. */
const ST={alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',colorado:'CO',connecticut:'CT',delaware:'DE',districtofcolumbia:'DC',florida:'FL',georgia:'GA',hawaii:'HI',idaho:'ID',illinois:'IL',indiana:'IN',iowa:'IA',kansas:'KS',kentucky:'KY',louisiana:'LA',maine:'ME',maryland:'MD',massachusetts:'MA',michigan:'MI',minnesota:'MN',mississippi:'MS',missouri:'MO',montana:'MT',nebraska:'NE',nevada:'NV',newhampshire:'NH',newjersey:'NJ',newmexico:'NM',newyork:'NY',northcarolina:'NC',northdakota:'ND',ohio:'OH',oklahoma:'OK',oregon:'OR',pennsylvania:'PA',rhodeisland:'RI',southcarolina:'SC',southdakota:'SD',tennessee:'TN',texas:'TX',utah:'UT',vermont:'VT',virginia:'VA',washington:'WA',westvirginia:'WV',wisconsin:'WI',wyoming:'WY',puertorico:'PR'};
function stAbbr(s){s=String(s||'').trim();if(/^[A-Za-z]{2}$/.test(s))return s.toUpperCase();return ST[norm(s)]||'';}

/* "Cincinnati, Hamilton County, Ohio 45220" -> city/state/zip, county discarded.
   Also handles the plain "Bartlett, IL 60103" and a doubled city name
   ("New York, New York 10001"). */
function splitCityStateZip(t){
  const out={city:'',state:'',zip:''};
  t=String(t||'').trim().replace(/,\s*$/,'');
  const z=t.match(/(\d{5})(?:-\d{4})?\s*$/);
  if(z){out.zip=z[1];t=t.slice(0,z.index).trim().replace(/,\s*$/,'');}
  const parts=t.split(',').map(function(p){return p.trim();}).filter(Boolean);
  // a "… County" part names no cell and is dropped outright
  const keep=parts.filter(function(p){return !/\bcounty\b/i.test(p);});
  if(keep.length>=2){out.state=stAbbr(keep[keep.length-1]);out.city=keep[0];}
  else if(keep.length===1){
    const m=keep[0].match(/^(.*)\s+([A-Za-z]{2})$/);
    if(m&&stAbbr(m[2])){out.city=m[1].trim();out.state=stAbbr(m[2]);}else out.city=keep[0];
  }
  return out;
}

function isoDate(t){
  const MN={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
  const m=String(t||'').toLowerCase().match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if(m&&MN[m[1]])return m[3]+'-'+('0'+MN[m[1]]).slice(-2)+'-'+('0'+m[2]).slice(-2);
  const s=String(t||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(s)return s[3]+'-'+('0'+s[1]).slice(-2)+'-'+('0'+s[2]).slice(-2);
  return '';
}

function readLetterIdentity(L,S,warn){
  const txt=L.map(function(l){return l.text;});
  const N=txt.map(norm);
  const at=function(re){for(let i=0;i<txt.length;i++)if(re.test(txt[i]))return i;return -1;};

  /* Sender block: the date is the letter's first dated line; the firm is the
     next line that is not itself an address, phone or email. */
  const di=at(/^[A-Z][a-z]+\s+\d{1,2},\s*\d{4}$/);
  if(di>=0){
    for(let i=di+1;i<Math.min(di+4,txt.length);i++){
      const t=txt[i];
      if(/@/.test(t)||/\d{3}[)\s.-]*\d{3}[\s.-]*\d{4}/.test(t)||/^\s*(po\s*box|\d+)/i.test(t))continue;
      S['appr.firm']=t.replace(/,\s*$/,'').trim()||undefined;
      // the two lines under the firm are its street and its city/state/zip
      if(txt[i+1])S['appr.addr_street']=txt[i+1].replace(/,\s*$/,'').trim();
      if(txt[i+2]){const a=splitCityStateZip(txt[i+2]);
        if(a.city)S['appr.addr_city']=a.city;if(a.state)S['appr.addr_state']=a.state;if(a.zip)S['appr.addr_zip']=a.zip;}
      break;
    }
  }
  const em=txt.join('\n').match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  if(em)S['appr.email']=em[0];
  const ph=txt.join('\n').match(/\(?(\d{3})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})/);
  if(ph)S['appr.phone']=ph[1]+ph[2]+ph[3];

  /* Subject block: everything the study is about sits under its own heading. */
  let mi=-1;for(let i=0;i<N.length;i++)if(N[i]==='marketrentalanalysis'){mi=i;break;}
  if(mi>=0){
    if(txt[mi+1])S['property.name']=txt[mi+1].replace(/,\s*$/,'').trim();
    if(txt[mi+2])S['property.addr_street']=txt[mi+2].replace(/,\s*$/,'').trim();
    if(txt[mi+3]){const a=splitCityStateZip(txt[mi+3]);
      if(a.city)S['property.addr_city']=a.city;if(a.state)S['property.addr_state']=a.state;if(a.zip)S['property.addr_zip']=a.zip;}
  }else warn.push('The letter has no “Market Rental Analysis” heading, so the property block could not be located.');

  /* THE MISLABELLED NUMBER. Belfry prints the Section 8 contract number under
     an "FHA Project No." label. It is not the FHA project number, and this
     parser must never write property.fha from a study. */
  for(let i=0;i<N.length;i++){
    if(N[i].indexOf('fhaprojectno')>=0){
      const m=txt[i].match(/no\.?\s*:?\s*\[?\s*([A-Za-z0-9][A-Za-z0-9-]{4,})/i);
      if(m)S['property.s8']=m[1].replace(/[^A-Za-z0-9]/g,'').toUpperCase();
      break;
    }
  }
  const dv=at(/date\s+of\s+value/i);
  if(dv>=0)S['_date_of_value']=isoDate(txt[dv]);
  const po=at(/^(mr\.|ms\.|mrs\.|dr\.)\s+\S/i);
  if(po>=0)S['_poc_name']=txt[po].trim();   // offered as a source row, never auto-filled
}

/* The signature block on letter page 2: the name is the first line under
   "Sincerely," that is not a licence, initials or job number. */
function readSignature(L,S){
  const txt=L.map(function(l){return l.text;});
  let si=-1;for(let i=0;i<txt.length;i++)if(/^sincerely/i.test(txt[i])){si=i;break;}
  if(si<0)return;
  for(let i=si+1;i<Math.min(si+6,txt.length);i++){
    const t=txt[i].trim();
    if(!t||/license|certified|job\s*no|^[A-Z]{2,4}\/[A-Z]{2,4}$/i.test(t))continue;
    S['appr.name']=t;return;
  }
}
```

Then add the reader entry point, also above the `window.RCSParse={…}` line:

```js
function readLetter(pages,cls){
  const S={},warn=[],out={scalars:S,units:[],totals:{},warnings:warn};
  const idx=(cls&&cls.letter)||[];
  if(!idx.length){warn.push('No appraiser’s transmittal letter was found in this document.');return out;}
  idx.forEach(function(pi,ord){
    const L=lines(pages[pi]);
    if(ord===0)readLetterIdentity(L,S,warn);
    readSignature(L,S);
  });
  return out;
}
```

Export it — replace the `window.RCSParse={…}` line with:

```js
window.RCSParse={norm:norm,lines:lines,money:money,dec:dec,classify:classify,readLetter:readLetter,
  _splitCityStateZip:splitCityStateZip,_isoDate:isoDate,_stAbbr:stAbbr};
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation && node app/full-mp/test_rcs.js
```

Expected: PASS — `✓ ALL 29 RCS PARSE CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation
git add app/full-mp/rcs.js app/full-mp/test_rcs.js
git commit -m "A letter says who wrote it and what it is about"
```

---

### Task 3: Letter reader — the numbers

Four tables across the two letter pages. Rows are matched by **regex against the assembled line**, not by x-column bands: the row text is well-formed (`2BR/1BA 32 $1,850 $161 $64,352`) and a regex survives the column drift that re-export introduces, where fixed x bands do not.

Page index 5, the unit table:

```
UNIT TYPE # UNITS SIZE (SF) RENT $ PSF GRID (Y/N)
2BR/1BA 32 790 $1,850 $2.34 Y
3BR/1BA 33 1008 $2,400 $2.38 Y
TOTAL 65
```

Page index 6, three tables under their own headings:

```
# OF BEDROOMS ... # OF UNITS RCS RENTS 45220 150% SAFMR       <- table 1, five columns
2BR/1BA 32 $1,850 $2,085 $1,850<$2,085
3BR/1BA 33 $2,400 $2,745 $2,400<$2,745
OWNERS GROSS RENEWAL POTENTIAL CALCULATION                    <- table 2, five columns
2BR/1BA 32 $1,850 $161 $64,352
3BR/1BA 33 $2,400 $171 $84,843
TOTAL GROSS RENEWAL RENT: $149,195
SAFMR GROSS RENEWAL POTENTIAL CALCULATION                     <- table 3, four columns
2BR/1BA 32 $1,390 $44,480
3BR/1BA 33 $1,830 $60,390
TOTAL GROSS SAFMR RENT: $104,870
150% OF SAFMR GROSS RENT: $157,305
```

**The trap.** Table 3's `SAFMR RENTS` column is the **base** SAFMR (`$1,390`). The form's `units.N.safmr_rcs` holds the **150% ceiling** (`db.js:109`), which is table 1's `150% SAFMR` column (`$2,085`). Taking table 3 would understate every ceiling by a third and quietly break the 150% test the whole package exists to pass. The reader takes table 1 and cross-checks `table1 ≈ round(table3 × 1.5)`, warning on mismatch.

The market rent is printed three times — page 5's `RENT`, table 1's `RCS RENTS`, table 2's `RCS RENTS`. All three agreeing is real corroboration; a disagreement is a warning, and page 5's value wins because it is the one under a column headed `ESTIMATED MARKET RENT`.

**Files:**
- Modify: `app/full-mp/rcs.js`
- Modify: `app/full-mp/test_rcs.js`

**Interfaces:**
- Consumes: `lines()`, `norm()`, `money()`, `dec()` from Task 1; `readLetter()` from Task 2.
- Produces: `readLetter()` now also fills
  - `units: [{type, br, ba, count, sf, proposed, ua, safmr, safmr_base, psf, grid, page}]` — `type` verbatim (`'2BR/1BA'`), `br`/`ba` numbers, money fields integers, `page` the PDF index the row was read from.
  - `totals: {grossRenewal, grossSafmrBase, grossSafmr150, verdict}` — `verdict` is `'pass'` when `grossRenewal < grossSafmr150`, else `'fail'`.
  - `parseType(t) -> {type, br, ba}` exported on `window.RCSParse` for the grid reader's reuse.

- [ ] **Step 1: Write the failing test**

Append in `test_rcs.js` before `finish();`:

```js
  /* ---- letter reader: the numbers ---- */
  eq('two unit types',LET.units.length,2);
  const U0=LET.units[0],U1=LET.units[1];
  eq('unit type verbatim',U0.type,'2BR/1BA');
  eq('bedrooms and baths',[U0.br,U0.ba],[2,1]);
  eq('unit count',U0.count,32);
  eq('unit square feet',U0.sf,790);
  eq('market rent 2BR',U0.proposed,1850);
  eq('market rent 3BR',U1.proposed,2400);
  eq('utility allowance 2BR',U0.ua,161);
  eq('utility allowance 3BR',U1.ua,171);
  // the 150% ceiling comes from table 1. Table 3's $1,390 is the BASE SAFMR and
  // taking it would understate every ceiling by a third.
  eq('150% SAFMR 2BR',U0.safmr,2085);
  eq('150% SAFMR 3BR',U1.safmr,2745);
  eq('base SAFMR is kept separately',U0.safmr_base,1390);
  eq('150% is 1.5x the base',U0.safmr,Math.round(U0.safmr_base*1.5));
  eq('dollars per square foot',U0.psf,2.34);
  eq('a grid was prepared',U0.grid,true);
  eq('gross renewal rent',LET.totals.grossRenewal,149195);
  eq('gross SAFMR rent (base)',LET.totals.grossSafmrBase,104870);
  eq('150% of gross SAFMR rent',LET.totals.grossSafmr150,157305);
  eq('the appraiser’s own verdict',LET.totals.verdict,'pass');
  eq('three printings of the market rent agree, so no warning',LET.warnings.filter(function(w){return /market rent/i.test(w);}).length,0);
  eq('parseType reads a spelled-out grid heading',R.parseType('Two Bedroom').br,2);
```

Raise the floor: `const MIN_CHECKS=50;`

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation && node app/full-mp/test_rcs.js
```

Expected: FAIL — `two unit types: got 0 want 2`.

- [ ] **Step 3: Implement the table reader**

Add to `rcs.js`, above `readLetter`:

```js
const WORDNUM={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,studio:0,efficiency:0};

/* "2BR/1BA", "Two Bedroom", "3 Bedroom / 1 Bath" -> a comparable shape.
   Bedrooms and baths are the only things a study line and a form row may be
   matched on. Ordinal matching is forbidden — it would put a 2BR rent on a
   3BR row. */
function parseType(t){
  const s=String(t||'').trim();const o={type:s,br:'',ba:''};
  let m=s.match(/(\d+)\s*(?:br\b|bed)/i);
  if(m)o.br=+m[1];
  else{m=s.match(/\b([a-z]+)\s*(?:bedroom|br)\b/i);if(m&&WORDNUM[m[1].toLowerCase()]!=null)o.br=WORDNUM[m[1].toLowerCase()];}
  if(o.br===''&&/studio|efficiency/i.test(s))o.br=0;
  m=s.match(/(\d+(?:\.\d+)?)\s*(?:ba\b|bath)/i);
  if(m)o.ba=parseFloat(m[1]);
  return o;
}
function typeKey(u){return String(u.br)+'/'+String(u.ba);}

/* Rows are matched as whole assembled lines. Column x-bands were rejected:
   re-export shifts every coordinate, and these row shapes are unambiguous. */
const ROW_P5 =/^(\S+)\s+(\d+)\s+([\d,]+)\s+\$([\d,]+)\s+\$?([\d.]+)\s+([YN])\b/i;   // type count sf rent psf grid
const ROW_5C =/^(\S+)\s+(\d+)\s+\$([\d,]+)\s+\$([\d,]+)\s+\$([\d,]+)\s*$/;          // type count rent ua gross
const ROW_CMP=/^(\S+)\s+(\d+)\s+\$([\d,]+)\s+\$([\d,]+)\s+\$[\d,]+\s*[<>]\s*\$[\d,]+/; // type count rent 150%safmr verdict
const ROW_4C =/^(\S+)\s+(\d+)\s+\$([\d,]+)\s+\$([\d,]+)\s*$/;                       // type count safmrbase gross

function upsert(units,type,page){
  const p=parseType(type),k=typeKey(p);
  for(let i=0;i<units.length;i++)if(typeKey(units[i])===k)return units[i];
  const u={type:p.type,br:p.br,ba:p.ba,count:'',sf:'',proposed:'',ua:'',safmr:'',safmr_base:'',psf:'',grid:false,page:page};
  units.push(u);return u;
}

function readLetterTables(L,pi,units,totals,warn,seen){
  const txt=L.map(function(l){return l.text;});
  let section='';
  txt.forEach(function(t){
    const n=norm(t);
    if(n.indexOf('ownersgrossrenewalpotentialcalculation')>=0){section='owner';return;}
    if(n.indexOf('safmrgrossrenewalpotentialcalculation')>=0){section='safmr';return;}
    let m;
    if((m=t.match(/total\s+gross\s+renewal\s+rent\s*:?\s*\$([\d,]+)/i))){totals.grossRenewal=money(m[1]);return;}
    if((m=t.match(/total\s+gross\s+safmr\s+rent\s*:?\s*\$([\d,]+)/i))){totals.grossSafmrBase=money(m[1]);return;}
    if((m=t.match(/150%\s*of\s*safmr\s+gross\s+rent\s*:?\s*\$([\d,]+)/i))){totals.grossSafmr150=money(m[1]);return;}

    if((m=t.match(ROW_P5))){
      const u=upsert(units,m[1],pi);
      u.count=money(m[2]);u.sf=money(m[3]);u.psf=dec(m[5]);u.grid=/^y$/i.test(m[6]);
      seen.push({type:u.type,where:'the unit table',rent:money(m[4])});
      if(u.proposed==='')u.proposed=money(m[4]);
      return;
    }
    if((m=t.match(ROW_CMP))){
      const u=upsert(units,m[1],pi);
      if(u.count==='')u.count=money(m[2]);
      u.safmr=money(m[4]);                       // the 150% ceiling — table 1, never table 3
      seen.push({type:u.type,where:'the 150% comparison table',rent:money(m[3])});
      return;
    }
    if(section==='owner'&&(m=t.match(ROW_5C))){
      const u=upsert(units,m[1],pi);
      if(u.count==='')u.count=money(m[2]);
      u.ua=money(m[4]);
      seen.push({type:u.type,where:'the gross renewal table',rent:money(m[3])});
      return;
    }
    if(section==='safmr'&&(m=t.match(ROW_4C))){
      const u=upsert(units,m[1],pi);
      u.safmr_base=money(m[3]);                  // BASE SAFMR — corroboration for the ceiling above
      return;
    }
  });
}
```

Now rewrite `readLetter` to run both passes and reconcile the repeated market rent:

```js
function readLetter(pages,cls){
  const S={},warn=[],units=[],totals={},seen=[];
  const out={scalars:S,units:units,totals:totals,warnings:warn};
  const idx=(cls&&cls.letter)||[];
  if(!idx.length){warn.push('No appraiser’s transmittal letter was found in this document.');return out;}
  idx.forEach(function(pi,ord){
    const L=lines(pages[pi]);
    if(ord===0)readLetterIdentity(L,S,warn);
    readSignature(L,S);
    readLetterTables(L,pi,units,totals,warn,seen);
  });

  /* The market rent is printed three times. Agreement is real verification;
     disagreement is the document arguing with itself and the reader says so
     rather than silently preferring one. */
  units.forEach(function(u){
    const mine=seen.filter(function(s){return s.type===u.type;});
    const vals=mine.map(function(s){return s.rent;}).filter(function(v){return v!=='';});
    const uniq=vals.filter(function(v,i){return vals.indexOf(v)===i;});
    if(uniq.length>1)warn.push('The study prints more than one market rent for '+u.type+': '+uniq.map(function(v){return '$'+v.toLocaleString('en-US');}).join(' and ')+'. The unit table’s figure was used.');
  });

  /* The 150% ceiling must be 1.5x the base the study itself printed. */
  units.forEach(function(u){
    if(u.safmr!==''&&u.safmr_base!==''){
      const want=Math.round(u.safmr_base*1.5);
      if(Math.abs(want-u.safmr)>2)warn.push('For '+u.type+' the study’s 150% SAFMR ($'+u.safmr.toLocaleString('en-US')+') is not 1.5 times the SAFMR it prints ($'+u.safmr_base.toLocaleString('en-US')+').');
    }
  });

  if(totals.grossRenewal!=null&&totals.grossSafmr150!=null)
    totals.verdict=totals.grossRenewal<totals.grossSafmr150?'pass':'fail';
  if(!units.length)warn.push('The letter’s rent tables could not be read, so no rents were taken from it.');
  return out;
}
```

Extend the export line:

```js
window.RCSParse={norm:norm,lines:lines,money:money,dec:dec,classify:classify,readLetter:readLetter,parseType:parseType,
  _splitCityStateZip:splitCityStateZip,_isoDate:isoDate,_stAbbr:stAbbr,_typeKey:typeKey};
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation && node app/full-mp/test_rcs.js
```

Expected: PASS — `✓ ALL 50 RCS PARSE CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation
git add app/full-mp/rcs.js app/full-mp/test_rcs.js
git commit -m "Three tables, and only one of them holds the ceiling"
```

---

### Task 4: Grid reader — HUD-92273-S8

The grids are the portable half of the parser: row numbers 1–46 and their labels are fixed by regulation, so this code should work on any appraiser's study without a profile. Two grid pages in this study — index 26 (Two Bedroom) and index 34 (Three Bedroom), one per unit type.

Verbatim structure (page index 26):

```
Rent Comparability Grid Unit TypeTwo BedroomSubject's FHA #:OH10-M000-236
SubjectComp #1Comp #2Comp #3Comp #4Comp #5
...
452204521945219452194522045219
A. Rents ChargedData$ AdjData$ AdjData$ AdjData$ AdjData$ Adj
11# Bedrooms222222
12# Baths11112($50)1
13Unit Interior Sq. Ft.790975($55)800950($50)1050($80)902($35)
...
33Heat (in rent?/ type)N/GN/GN/GY/G($35)N/GN/G
38Cold Water/ SewerY/YY/YY/YY/YN/N$119Y/Y
46Estimated Market Rent$1,850$2.34Estimated Market Rent/ Sq. Ft
```

Three structural facts that decide the implementation:

1. **The assembled line text has no separators at cell boundaries** (`Unit TypeTwo BedroomSubject's FHA #:`). The header row must be read from **runs**, not text: find the run whose normalized value is `unittype`, take the next run by x.
2. **The subject column's x position is not constant.** In the address block the subject sits at x≈127; in the numbered rows at x≈184. A fixed band fails. The reliable rule is positional-relative: **drop the row-number run and every label run (x < 170); the subject is the first run that remains.** The five comparables follow at a 63pt pitch.
3. **The subject has a `Data` column but no `$ Adj` column.** Every section header prints `Data $ Adj` five times, for comps 1–5 only. So the subject is never confused with an adjustment.

Row 46 is laid out oddly and must not be read left-to-right as label-then-value: the rent and the $/sq ft both sit **left** of the label `Estimated Market Rent/ Sq. Ft`.

**Files:**
- Modify: `app/full-mp/rcs.js`
- Modify: `app/full-mp/test_rcs.js`

**Interfaces:**
- Consumes: `lines()`, `norm()`, `money()`, `dec()`, `parseType()`, `typeKey()`.
- Produces: `readGrids(pages, cls) -> {units, scalars, partE, warnings}` where
  - `units: [{type, br, ba, sf, proposed, psf, page}]` — same shape as the letter's, minus the fields a grid does not carry.
  - `scalars: {'property.s8', 'property.addr_zip'}` — corroboration for the letter's own.
  - `partE: { '<typeKey>': {heat:{inRent,fuel}, cooling:{…}, cooking:{…}, hot_water:{…}, other_electric:{inRent}, water_sewer:{inRent,fuel}, trash:{inRent,fuel}} }` — `inRent` is `true`/`false`, `fuel` is the letter after the slash (`G` gas, `E` electric) or `''`. **Cross-check only. Grid rows never fill a Part B box** — the grid asks whether the unit *has* the item; Part B asks whether it is *included in the rent*. Same nouns, different questions.

- [ ] **Step 1: Write the failing test**

Append in `test_rcs.js` before `finish();`:

```js
  /* ---- grid reader ---- */
  const GR=R.readGrids(pages,C);
  eq('one grid per unit type',GR.units.length,2);
  eq('grid unit type spelled out',GR.units[0].type,'Two Bedroom');
  eq('grid bedrooms',GR.units[0].br,2);
  eq('grid bedrooms from row 11 when the heading is bare',GR.units[1].br,3);
  eq('grid baths from row 12',GR.units[0].ba,1);
  eq('grid square feet from row 13',GR.units[0].sf,790);
  eq('grid market rent from row 46 — 2BR',GR.units[0].proposed,1850);
  eq('grid market rent from row 46 — 3BR',GR.units[1].proposed,2400);
  eq('grid rent per square foot',GR.units[0].psf,2.34);
  // the grid prints the same number hyphenated; both must reduce to one value
  eq('the hyphenated number reduces to the letter’s',GR.scalars['property.s8'],'OH10M000236');
  eq('subject zip from the address block',GR.scalars['property.addr_zip'],'45220');
  const PE=GR.partE[R._typeKey({br:2,ba:1})];
  eq('heat is not in the rent, and is gas',[PE.heat.inRent,PE.heat.fuel],[false,'G']);
  eq('cooking is not in the rent, and is gas',[PE.cooking.inRent,PE.cooking.fuel],[false,'G']);
  eq('cold water and sewer are in the rent',[PE.water_sewer.inRent,PE.water_sewer.fuel],[true,'Y']);
  eq('trash and recycling are in the rent',PE.trash.inRent,true);
  eq('other electric is not in the rent',PE.other_electric.inRent,false);
```

Raise the floor: `const MIN_CHECKS=66;`

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation && node app/full-mp/test_rcs.js
```

Expected: FAIL — `R.readGrids is not a function`.

- [ ] **Step 3: Implement the grid reader**

Add to `rcs.js`, above the export line:

```js
const LABEL_X=170;   // every row label and row number lives left of this

/* A numbered grid row: its number, its label, then the subject's value and the
   five comparables. The subject's x is NOT constant down the page (x≈127 in the
   address block, x≈184 in the numbered rows), so the subject is identified as
   "the first run right of the label", never by a fixed band. */
function gridRow(L,num){
  for(let i=0;i<L.length;i++){
    const rs=L[i].runs;if(!rs.length)continue;
    if(String(rs[0].s).trim()!==String(num))continue;
    const rest=rs.slice(1).filter(function(r){return r.x>=LABEL_X;});
    const label=rs.slice(1).filter(function(r){return r.x<LABEL_X;}).map(function(r){return r.s;}).join('').trim();
    if(rest.length)return {label:label,subject:String(rest[0].s).trim(),cells:rest,line:L[i]};
  }
  return null;
}

/* "N/G" -> not in the rent, gas. "Y/Y" -> in the rent. "N" -> not in the rent. */
function partECell(v){
  const s=String(v||'').trim();
  const m=s.match(/^([YN])\s*\/\s*([A-Za-z])/i);
  if(m)return {inRent:/^y$/i.test(m[1]),fuel:m[2].toUpperCase()};
  if(/^[YN]$/i.test(s))return {inRent:/^y$/i.test(s),fuel:''};
  return {inRent:false,fuel:''};
}

function readGrids(pages,cls){
  const units=[],S={},partE={},warn=[];
  const out={units:units,scalars:S,partE:partE,warnings:warn};
  const idx=(cls&&cls.grids)||[];
  if(!idx.length){warn.push('No rent comparability grids were found in this document.');return out;}

  idx.forEach(function(pi){
    const L=lines(pages[pi]);

    /* Header row, read from runs — the assembled text runs the cells together
       ("Unit TypeTwo BedroomSubject's FHA #:"). */
    let type='',s8='';
    for(let i=0;i<L.length;i++){
      const rs=L[i].runs;
      for(let j=0;j<rs.length;j++){
        const n=norm(rs[j].s);
        if(n==='unittype'&&rs[j+1]&&!type)type=String(rs[j+1].s).trim();
        if(n.indexOf('fha')>=0&&rs[j+1]&&!s8)s8=String(rs[j+1].s).replace(/[^A-Za-z0-9]/g,'').toUpperCase();
      }
      if(type)break;
    }
    if(!type){warn.push('A grid on page '+(pi+1)+' does not name its unit type; it was skipped.');return;}
    if(s8&&!S['property.s8'])S['property.s8']=s8;

    const p=parseType(type);
    const u={type:type,br:p.br,ba:p.ba,sf:'',proposed:'',psf:'',page:pi};

    /* Rows 11/12/13 state the subject's bedrooms, baths and size outright —
       more reliable than the heading, which may only say "Two Bedroom". */
    const r11=gridRow(L,11),r12=gridRow(L,12),r13=gridRow(L,13);
    if(r11&&/^\d+$/.test(r11.subject))u.br=+r11.subject;
    if(r12&&/^\d+(\.\d+)?$/.test(r12.subject))u.ba=parseFloat(r12.subject);
    if(r13)u.sf=money(r13.subject);

    /* Row 46 puts BOTH values left of the label "Estimated Market Rent/ Sq. Ft",
       so it cannot be read as label-then-value. */
    const r46=gridRow(L,46);
    if(r46){u.proposed=money(r46.subject);if(r46.cells[1])u.psf=dec(r46.cells[1].s);}
    else warn.push('The grid on page '+(pi+1)+' has no row 46, so no market rent was read from it.');

    /* The subject's ZIP: the address block above the numbered rows, whose first
       run is five digits. */
    for(let i=0;i<L.length;i++){
      const rs=L[i].runs;
      if(norm(L[i].text).indexOf('rentscharged')>=0)break;
      if(rs.length>=2&&/^\d{5}$/.test(String(rs[0].s).trim())&&!S['property.addr_zip']){S['property.addr_zip']=String(rs[0].s).trim();break;}
    }

    /* Part E, rows 33-39. Cross-check only: the grid asks whether the unit HAS
       the item, Part B asks whether it is INCLUDED IN THE RENT. Same nouns,
       different questions — these never fill a Part B box. */
    const E={},MAP={33:'heat',34:'cooling',35:'cooking',36:'hot_water',37:'other_electric',38:'water_sewer',39:'trash'};
    Object.keys(MAP).forEach(function(n){
      const r=gridRow(L,+n);if(r)E[MAP[n]]=partECell(r.subject);
    });
    partE[typeKey(u)]=E;
    units.push(u);
  });
  return out;
}
```

Extend the export line to add `readGrids:readGrids`.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation && node app/full-mp/test_rcs.js
```

Expected: PASS — `✓ ALL 66 RCS PARSE CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation
git add app/full-mp/rcs.js app/full-mp/test_rcs.js
git commit -m "The grid's row numbers are fixed by regulation, so read those"
```

---

### Task 5: Reconciliation and the `parse()` entry point

Two readers, one record. Where the letter and the grids overlap — market rent, unit type, Section 8 number — agreement is real verification. On disagreement **the letter's value is written** and the difference is surfaced with both figures and their pages. Withholding the value was considered and rejected: real documents disagree with themselves over rounding constantly, and a parser that blanks a cell over `$741.36` vs `$741` reads as broken.

This task also enforces the rule the whole module answers to: **an unreadable study fills nothing and says so.** No partial guessing, no generic fallback that invents structure.

**Files:**
- Modify: `app/full-mp/rcs.js`
- Modify: `app/full-mp/test_rcs.js`

**Interfaces:**
- Consumes: `classify()`, `readLetter()`, `readGrids()`, `typeKey()`.
- Produces: `parse(pages) -> record`, the single entry point app.js calls:

```
{ profile:'belfry'|'generic'|null,
  scalars:{ 'appr.firm':…, 'property.s8':…, … },
  units:[ {type, br, ba, count, sf, proposed, ua, safmr, safmr_base, psf, grid, pages:{letter, grid}} ],
  partE:{ '<typeKey>':{…} },          // cross-check only
  totals:{ grossRenewal, grossSafmrBase, grossSafmr150, verdict },
  conflicts:[ {what, letter, grid, pages:{letter,grid}} ],
  warnings:[ … ],
  found:{ letter:[i], grids:[i] } }
```

- [ ] **Step 1: Write the failing test**

Append in `test_rcs.js` before `finish();`:

```js
  /* ---- reconciliation and the entry point ---- */
  const REC=R.parse(pages);
  eq('the firm is recognised',REC.profile,'belfry');
  eq('two reconciled unit types',REC.units.length,2);
  eq('reconciled market rent',REC.units[0].proposed,1850);
  eq('reconciled 150% SAFMR survives',REC.units[0].safmr,2085);
  eq('reconciled utility allowance survives',REC.units[0].ua,161);
  eq('square feet agree across letter and grid',REC.units[0].sf,790);
  eq('each unit cites both pages',REC.units[0].pages,{letter:5,grid:26});
  eq('the two documents agree, so nothing is flagged',REC.conflicts.length,0);
  eq('the section 8 number survives both printings',REC.scalars['property.s8'],'OH10M000236');
  eq('no FHA number is ever sourced from a study',REC.scalars['property.fha'],undefined);
  eq('the appraiser’s verdict is carried',REC.totals.verdict,'pass');

  /* An injected disagreement is reported, and the letter still wins. */
  const clash=JSON.parse(JSON.stringify(pages.map(function(p){return p;})));
  const REC2=R._reconcile(
    {scalars:{},units:[{type:'2BR/1BA',br:2,ba:1,proposed:1850,page:5}],totals:{},warnings:[]},
    {scalars:{},units:[{type:'Two Bedroom',br:2,ba:1,proposed:1900,page:26}],partE:{},warnings:[]});
  eq('a disagreement is reported',REC2.conflicts.length,1);
  eq('the letter wins a disagreement',REC2.units[0].proposed,1850);
  eq('both figures are stated',[REC2.conflicts[0].letter,REC2.conflicts[0].grid],[1850,1900]);

  /* A document that is not an RCS study fills nothing and says so. */
  const other=await P.PDFDocument.load(new Uint8Array(fs.readFileSync(
    path.join(_d,'..','..','_archive','colonial-village-example','Colonial Village - Executed Rent Schedule.pdf'))),
    {ignoreEncryption:true,throwOnInvalidObject:false});
  const REC3=R.parse(await app.__rsTextPages(other));
  eq('a rent schedule is not a study',REC3.profile,null);
  eq('an unreadable study fills no units',REC3.units.length,0);
  eq('an unreadable study fills no cells',Object.keys(REC3.scalars).length,0);
  T('an unreadable study says so',REC3.warnings.length>0);
```

Raise the floor: `const MIN_CHECKS=84;`

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation && node app/full-mp/test_rcs.js
```

Expected: FAIL — `R.parse is not a function`.

- [ ] **Step 3: Implement reconciliation and `parse`**

Add to `rcs.js`, above the export line:

```js
/* Firm profiles are data, not code: a detector and nothing else so far. Adding
   an appraiser is a new entry plus a new fixture, never a parser rewrite. */
const PROFILES=[{id:'belfry',detect:/belfryvaluation/}];

function detectProfile(pages){
  const hay=pages.map(function(runs){return lines(runs).map(function(l){return norm(l.text);}).join('');}).join('|');
  for(let i=0;i<PROFILES.length;i++)if(PROFILES[i].detect.test(hay))return PROFILES[i].id;
  return null;
}

/* Letter wins; the grid corroborates. Every overlap that disagrees is reported
   with both figures and both pages — never silently averaged, never blanked. */
function _reconcile(L,G){
  const conflicts=[],warnings=(L.warnings||[]).concat(G.warnings||[]);
  const scalars={};
  Object.keys(L.scalars||{}).forEach(function(k){if(L.scalars[k]!=null&&L.scalars[k]!=='')scalars[k]=L.scalars[k];});
  Object.keys(G.scalars||{}).forEach(function(k){
    const g=G.scalars[k];if(g==null||g==='')return;
    if(scalars[k]==null){scalars[k]=g;return;}
    if(String(scalars[k])!==String(g))conflicts.push({what:k,letter:scalars[k],grid:g,pages:{letter:null,grid:null}});
  });

  const units=(L.units||[]).map(function(u){
    const out=JSON.parse(JSON.stringify(u));
    out.pages={letter:u.page==null?null:u.page,grid:null};
    delete out.page;
    const g=(G.units||[]).filter(function(x){return typeKey(x)===typeKey(u);})[0];
    if(g){
      out.pages.grid=g.page;
      ['sf','proposed','psf'].forEach(function(f){
        if(g[f]===''||g[f]==null)return;
        if(out[f]===''||out[f]==null){out[f]=g[f];return;}
        if(Number(out[f])!==Number(g[f]))
          conflicts.push({what:u.type+' '+f,letter:out[f],grid:g[f],pages:{letter:out.pages.letter,grid:g.page}});
      });
    }
    return out;
  });

  /* A study line matching no form row, or a grid matching no study line, is
     reported and fills nothing. */
  (G.units||[]).forEach(function(g){
    if(!(L.units||[]).some(function(u){return typeKey(u)===typeKey(g);}))
      warnings.push('The grid for “'+g.type+'” on page '+(g.page+1)+' matches no unit type in the letter’s tables, so it filled nothing.');
  });

  return {scalars:scalars,units:units,conflicts:conflicts,warnings:warnings,
    totals:L.totals||{},partE:G.partE||{}};
}

function parse(pages){
  const empty={profile:null,scalars:{},units:[],partE:{},totals:{},conflicts:[],warnings:[],found:{letter:[],grids:[]}};
  if(!pages||!pages.length){empty.warnings.push('This PDF has no readable pages.');return empty;}
  const cls=classify(pages);
  const profile=detectProfile(pages);

  /* Nothing recognised is not a licence to guess. */
  if(!cls.letter.length&&!cls.grids.length){
    empty.warnings.push('This document does not look like an RCS study — no appraiser’s transmittal letter and no rent comparability grids were found. Nothing was filled.');
    return empty;
  }

  const L=readLetter(pages,cls),G=readGrids(pages,cls);
  const rec=_reconcile(L,G);
  if(!rec.units.length&&!Object.keys(rec.scalars).length){
    empty.warnings=empty.warnings.concat(rec.warnings);
    empty.warnings.push('Nothing could be read from this study, so no values were filled.');
    return empty;
  }
  rec.profile=profile||'generic';
  rec.found={letter:cls.letter,grids:cls.grids};
  return rec;
}
```

Extend the export line to add `parse:parse` and `_reconcile:_reconcile`.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation && node app/full-mp/test_rcs.js
```

Expected: PASS — `✓ ALL 84 RCS PARSE CHECKS PASSED`.

- [ ] **Step 5: Run every gate and commit**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation
node --check app/full-mp/rcs.js
bash app/full-mp/run_tests.sh
git add app/full-mp/rcs.js app/full-mp/test_rcs.js
git commit -m "Two readings of one document, and a way to say they disagree"
```

---

### Task 6: app.js wiring — the `rcs*` family

This mirrors the existing `rs*` family line for line. Read `app/full-mp/FORM-RULES.md` first — this task touches cells, dropdowns and click handlers, which is exactly what those eighteen rules govern.

**Row matching is bedrooms + baths, never ordinal.** A study line (`2BR/1BA — $1,850`) fills **every** form row with that bedroom/bath combination, including a designation split: 2BR Elderly and 2BR Family both take `$1,850`, because the appraiser priced the unit, not the designation. Ordinal matching would put a 2BR rent on a 3BR row.

Two pieces of machinery already exist and need only to be fed: `uaBox()` (app.js:451) and `safmrBox()` (app.js:492) already render a live "RCS report" option driven by `units.N.ua_rcs` and `units.N.safmr_rcs`. Writing those cells lights those dropdowns up with no render change.

**Files:**
- Modify: `app/full-mp/app.js`
- Modify: `app/full-mp/test_rcs.js`

**Interfaces:**
- Consumes: `window.RCSParse.parse()` (Task 5); `rsTextPages()`; `store.editForm`, `markCycle`, `srcSetSource`, `deriveUnits`, `renderBody`, `setStatus`, `fmtPhone`, `rsParseUnitType`.
- Produces, all in app.js:
  - `parseRcsPdf(bytes) -> Promise<record|null>`
  - `rcsVal(k) -> string|null` · `rcsUnitVal(i, field) -> string|null` · `rcsOf(k) -> string|null` · `rcsTag(k) -> string`
  - `rcsFillFromParsed() -> void`
  - `__rcsFill` test hatch on `module.exports`.

- [ ] **Step 1: Write the failing test**

Append in `test_rcs.js` before `finish();`. This drives the real store through the real fill:

```js
  /* ---- app.js wiring: the fill ---- */
  await global.__ready();
  await app.__localDb();
  const pid=app.__firstPid();
  await app.__openForm(pid);
  app.__setRcsParsed(REC);                       // stand in for the upload
  app.__rcsFill();
  eq('market rent landed on row 0',app.getVal('units.0.proposed'),'1850');
  eq('utility allowance landed on row 0',app.getVal('units.0.ua_rcs'),'161');
  eq('150% SAFMR landed on row 0',app.getVal('units.0.safmr_rcs'),'2085');
  eq('the appraiser firm landed',app.getVal('appr.firm'),'Belfry Valuation, LLC');
  eq('the appraiser name landed',app.getVal('appr.name'),'Aaron M. Zabel');
  eq('the phone is formatted on the way in',app.getVal('appr.phone'),'(708) 500-2380');
  eq('the section 8 number landed',app.getVal('property.s8'),'OH10M000236');
  eq('the study never fills an FHA number',app.getVal('property.fha'),'');
  eq('the addressee never fills the point of contact',app.getVal('poc.name'),'');
  T('a filled cell says where it came from',app.__rcsTag('units.0.proposed').indexOf('RCS')>=0);
  T('every key the fill writes is covered by rcsTag',app.__rcsFillKeys().every(function(k){return app.__rcsTag(k)!=='';}));
```

Raise the floor: `const MIN_CHECKS=95;`

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation && node app/full-mp/test_rcs.js
```

Expected: FAIL — `app.__setRcsParsed is not a function`.

- [ ] **Step 3: Add the readers and the tag**

Insert into `app.js` immediately after `rsRecall` (~line 843):

```js
/* ===================== the RCS study, read ===================== */
async function parseRcsPdf(bytes){
  if(!(window.PDFLib&&window.RCSParse))return null;
  let doc=null;
  try{doc=await window.PDFLib.PDFDocument.load(bytes,{ignoreEncryption:true,throwOnInvalidObject:false});}catch(e){return null;}
  let pages=null;try{pages=await rsTextPages(doc);}catch(e){return null;}
  try{return window.RCSParse.parse(pages);}catch(e){return null;}
}
function rcsVal(k){try{const p=_rcsUpload&&_rcsUpload.parsed;const v=p&&p.scalars?p.scalars[k]:null;return (v==null||v==='')?null:String(v);}catch(e){return null;}}
/* The study priced a unit, not a designation: a 2BR/1BA line answers for every
   2BR/1BA row on the form, elderly and family alike. Ordinal matching is
   forbidden — it would put a 2BR rent on a 3BR row. */
function rcsUnitVal(i,field){
  const p=_rcsUpload&&_rcsUpload.parsed;if(!p||!p.units)return null;
  const br=String(get('units.'+i+'.br')||''),ba=String(get('units.'+i+'.ba')||'');
  if(!br)return null;
  for(let j=0;j<p.units.length;j++){
    const u=p.units[j];
    if(String(u.br)+'BR'!==br)continue;
    if(ba&&u.ba!==''&&String(u.ba)+'BA'!==ba)continue;
    const v=u[field];return (v==null||v==='')?null:String(v);
  }
  return null;
}
function rcsOf(k){
  let m=k.match(/^units\.(\d+)\.proposed$/);   if(m)return rcsUnitVal(+m[1],'proposed');
  m=k.match(/^units\.(\d+)\.ua_rcs$/);         if(m)return rcsUnitVal(+m[1],'ua');
  m=k.match(/^units\.(\d+)\.safmr_rcs$/);      if(m)return rcsUnitVal(+m[1],'safmr');
  return rcsVal(k);
}
/* FORM-RULES: every document-fed cell says so. This must cover every key
   rcsFillFromParsed writes — the test asserts exactly that. */
function rcsTag(k){
  const v=get(k); if(v===''||v==null)return '';
  const r=rcsOf(k); if(r==null||r==='')return '';
  const num=/^units\.\d+\.(proposed|ua_rcs|safmr_rcs)$/.test(k);
  const same=num?(numf(v)===numf(r)):(String(v)===String(r));
  return same?'<span class="srctag rcstag">· RCS</span>':'';
}
```

- [ ] **Step 4: Add the fill**

Insert after `rcsTag`:

```js
/* The keys the fill is allowed to write. Declared, not inferred, so the test
   can assert that rcsTag covers every one of them. */
function rcsFillKeys(){
  const ks=['appr.firm','appr.name','appr.email','appr.phone','appr.addr_street','appr.addr_city','appr.addr_state','appr.addr_zip',
            'property.name','property.addr_street','property.addr_city','property.addr_state','property.addr_zip','property.s8'];
  (UNITS||[]).forEach(function(i){['proposed','ua_rcs','safmr_rcs'].forEach(function(f){ks.push('units.'+i+'.'+f);});});
  return ks.filter(function(k){const r=rcsOf(k);return r!=null&&r!=='';});
}
function rcsFillFromParsed(){
  const P=_rcsUpload&&_rcsUpload.parsed;if(!P)return;
  const mark=k=>{markCycle(k);if(form[k])form[k].fromParse=true;};
  const setk=(k,v)=>{if(v!=null&&v!==''){form=store.editForm(form,k,String(v));mark(k);}};

  /* The study carries none of these, so none may ever be sourced from it:
     FHA number, ownership entity, entity type, signatory, current rents,
     rents-effective date, contract-administrator details. */
  ['appr.firm','appr.name','appr.email','appr.addr_street','appr.addr_city','appr.addr_state','appr.addr_zip',
   'property.name','property.addr_street','property.addr_city','property.addr_state','property.addr_zip','property.s8']
    .forEach(function(k){setk(k,P.scalars[k]);});
  if(P.scalars['appr.phone'])setk('appr.phone',fmtPhone(P.scalars['appr.phone']));

  (UNITS||[]).forEach(function(i){
    const rent=rcsUnitVal(i,'proposed'),ua=rcsUnitVal(i,'ua'),sa=rcsUnitVal(i,'safmr');
    if(rent)setk('units.'+i+'.proposed',rent);
    if(ua){setk('units.'+i+'.ua_rcs',ua);
      if(!get('units.'+i+'.ua_source')){srcSetSource('units.'+i+'.ua_custom','rcs');mark('units.'+i+'.ua_source');}}
    if(sa){setk('units.'+i+'.safmr_rcs',sa);}      // the source stays HUD unless the user picks RCS: the HUD pull is authoritative
  });

  deriveUnits();renderBody();
  const n=rcsFillKeys().length;
  setStatus('Form filled from the RCS study — '+n+' value'+(n===1?'':'s')+' marked “RCS report”. Review the highlighted cells, then “Update property profile”.');
}
```

- [ ] **Step 5: Make the source rows live**

Five edits in `app.js`, each replacing a stub that has been rendering "not available" since it was written.

In `SRCPICK_ROWS` (~line 311) replace the four `{tag:'RCS report',val:null}` entries and add the appraiser rows:

```js
 'property.name':()=>[{tag:'Executed RS',val:rsVal('property.name')},{tag:'Related Affordable',val:raVal('property.name')},{tag:'RCS report',val:rcsVal('property.name')}],
 'property.s8':()=>[{tag:'Executed RS',val:rsVal('property.s8')},{tag:'RCS report',val:rcsVal('property.s8')}],
 'appr.firm':()=>[{tag:'RCS report',val:rcsVal('appr.firm')}],
 'appr.email':()=>[{tag:'RCS report',val:rcsVal('appr.email')}],
 'appr.phone':()=>[{tag:'RCS report',val:rcsVal('appr.phone')?fmtPhone(rcsVal('appr.phone')):null}],
```

In `SRCGROUP` (~line 325) make both address groups live:

```js
 'property.addr':()=>{const st=raVal('property.addr_street'),ci=raVal('property.addr_city'),sa=raVal('property.addr_state'),zp=raVal('property.addr_zip');
   const cs=rcsVal('property.addr_street'),cc=rcsVal('property.addr_city'),cst=rcsVal('property.addr_state'),cz=rcsVal('property.addr_zip');
   return [{tag:'Related Affordable',apply:(st||ci||sa||zp)?{'property.addr_street':st||'','property.addr_city':ci||'','property.addr_state':sa||'','property.addr_zip':zp||''}:null},
           {tag:'RCS report',apply:(cs||cc||cst||cz)?{'property.addr_street':cs||'','property.addr_city':cc||'','property.addr_state':cst||'','property.addr_zip':cz||''}:null}];},
 'appr.addr':()=>{const s=rcsVal('appr.addr_street'),c=rcsVal('appr.addr_city'),t=rcsVal('appr.addr_state'),z=rcsVal('appr.addr_zip');
   return [{tag:'RCS report',apply:(s||c||t||z)?{'appr.addr_street':s||'','appr.addr_city':c||'','appr.addr_state':t||'','appr.addr_zip':z||''}:null}];},
```

In `DIR_SRCROW` (~line 336) the appraiser's name now has an answer:

```js
const DIR_SRCROW={'appr.name':{tag:'RCS report',val:()=>rcsVal('appr.name')},'sig.name':{tag:'Executed RS',val:()=>rsVal('sig.name')}};
```

In `moneyBox` (~line 433) give `units.N.proposed` its live row — it is the one key `moneySrcTag` already labels "RCS report" while always rendering it dim:

```js
  const _m=k.match(/^units\.(\d+)\.current$/),_mn=k.match(/^nonrev\.(\d+)\.rent$/),_ml=k.match(/^ns8\.(\d+)\.avg_rent$/),_mp=k.match(/^units\.(\d+)\.proposed$/);
  const _rv=_m?rsUnit(+_m[1],'rent'):(_mn?rsFamVal('nonrev',+_mn[1],'rent'):(_ml?rsFamVal('ns8',+_ml[1],'rent'):(_mp?rcsUnitVal(+_mp[1],'proposed'):null)));
```

And in the same function's returned markup, add the tag beside the rent-schedule one so a parsed cell says so:

```js
  return `<div class="rbox money" data-box="${k}" style="background:${c[1]};border-left-color:${c[0]}"><span class="cur">$</span><input type="text" data-money="1" data-k="${k}" value="${esc(fmtMoney(get(k)))}">${rsTag(k)}${rcsTag(k)}${pick}${noIcons?'':ovIcons(k)}</div>`;}
```

- [ ] **Step 6: Wire the upload and the apply button**

Replace the `#rcsFile` handler (~line 1973) — it currently files the PDF without reading a word of it:

```js
  const rf=el('rcsFile');if(rf)rf.onchange=()=>{const f=rf.files&&rf.files[0];if(!f)return;
    if(_rcsBusy){setStatus('Still reading the last study — one moment.');rf.value='';return;}
    f.arrayBuffer().then(async buf=>{const b=new Uint8Array(buf);
      if(!(b.length>4&&b[0]===0x25&&b[1]===0x50&&b[2]===0x44&&b[3]===0x46)){setStatus('That file isn’t a PDF — upload the completed RCS report as a PDF.');rf.value='';return;}
      // a 52-page valuation report is not a 3-page form; the row must not sit frozen
      _rcsBusy={name:f.name,note:'Reading…',sub:'Reading the study’s letter and rent comparability grids.'};renderBody();
      let r=null;try{r=await parseRcsPdf(b);}catch(e){r=null;}finally{_rcsBusy=null;}
      _rcsUpload={name:f.name,bytes:b,parsed:r,at:new Date().toISOString()};rf.value='';renderBody();
      if(r&&r.units.length){
        const t=r.units.length;
        setStatus('RCS study read — '+(r.profile==='belfry'?'Belfry Valuation':'the study')+', '+t+' unit type'+(t===1?'':'s')+'. Use “Fill form from the study” in '+secRef(1)+' to apply it.');
      }else setStatus('The study was uploaded, but its values could not be read — enter them by hand below.');
    });};
  const rap=el('rcsApply');if(rap)rap.onclick=()=>rcsFillFromParsed();
```

Declare `_rcsBusy` beside `_rsBusy` (~line 67): change `let _rcsUpload=null;` to `let _rcsUpload=null;let _rcsBusy=null;`.

In `renderSources` (~line 1194), replace the row that claims parsing is unavailable:

```js
  const rcs=_rcsBusy
    ?`<div class="srcrow"><span class="spin" aria-hidden="true"></span><div><b>${esc(_rcsBusy.name)}</b> <span class="parsed">${esc(_rcsBusy.note)}</span><div class="sub">${esc(_rcsBusy.sub)}</div></div></div>`
    :up
    ?`<div class="srcrow"><span class="ok">✓</span><div><b>${esc(up.name)}</b> <span class="parsed">${up.parsed&&up.parsed.units.length?'read · '+up.parsed.units.length+' unit type'+(up.parsed.units.length===1?'':'s'):'uploaded · not readable'}</span><div class="sub">${up.parsed&&up.parsed.units.length?'Values are ready to apply.':'Automatic reading found nothing in this copy — review each section below.'}</div></div>${up.parsed&&up.parsed.units.length?'<button class="btn sm" id="rcsApply">Fill form from the study</button>':''}<button class="btn sm" id="upRcs">Replace</button></div>`
    :`<div class="srcrow${sl.need?'':' dim'}"><span class="mut">○</span><div><b>${esc(sl.title)}</b> <span class="${sl.need?'missing':'parsed'}">${sl.need?'not uploaded':'optional'}</span><div class="sub">${esc(sl.sub)}</div></div><button class="btn sm" id="upRcs">Upload PDF</button></div>`;
```

- [ ] **Step 7: Add the test hatches**

In `module.exports` (~line 2933), after `__rsTextPages`, add:

```js
__setRcsParsed:(rec)=>{_rcsUpload={name:'test.pdf',bytes:null,parsed:rec,at:''};},
__rcsFill:()=>rcsFillFromParsed(),__rcsTag:(k)=>rcsTag(k),__rcsFillKeys:()=>rcsFillKeys(),
```

- [ ] **Step 8: Run the tests and every gate**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation
node --check app/full-mp/app.js
bash app/full-mp/run_tests.sh
python3 app/full-mp/build-ra.py /tmp/rcs-ra-check.html
```

Expected: `✓ ALL 95 RCS PARSE CHECKS PASSED`, every other suite green, and `built …`. If `build-ra.py` fails, an anchor moved — `moneyBox` and `SRCPICK_ROWS` are both plausible anchor sites; update the anchor in `build-ra.py`.

- [ ] **Step 9: Build and eyeball it in the browser**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation && bash app/full-mp/build.sh index.html
```

Open `index.html`, upload `_archive/colonial-village-example/Manual RCS Package (PDF).pdf` in Section 1, confirm the row reports "Belfry Valuation, 2 unit types", press "Fill form from the study", and confirm Section 5 and Section 6 fill with cells tagged `· RCS`.

- [ ] **Step 10: Commit**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation
git add app/full-mp/app.js app/full-mp/test_rcs.js index.html
git commit -m "The study fills the form, and every cell it fills says so"
```

---

### Task 7: Owner's checklist — evidence, not certification

**This task deviates from the design document, and the deviation is deliberate.** The design proposed reading the study's table of contents and mapping it to checklist items 4–17. Cartography killed that: the TOC has 15 entries and **no** entry for Scope of Work, the selection-of-comparables narrative, the locator map, or the grids themselves; it adds entries with no checklist counterpart; and its printed page numbers are unreliable (off by +7/+8 from the PDF index, and inconsistent with the pages' own `19 | Page` footers).

So the detector scans **every page** for the section's own heading and cites the **PDF page index** where it found it. An item with no confident anchor is left unticked — the checklist remains a certification the user signs. The app reports what it found; it does not certify.

Items 0–2 (`Signed cover letter`, `Signed owner’s checklist`, `Scope of repair`) are owner-side documents that are not part of the appraiser's study and are never ticked by this code.

**Files:**
- Modify: `app/full-mp/rcs.js`, `app/full-mp/app.js`, `app/full-mp/test_rcs.js`

**Interfaces:**
- Produces: `RCSParse.readChecklist(pages, cls) -> { '<CHECKLIST_FLAT index>': {page:<pdf index>} }`, merged onto the record by `parse()` as `record.checklist`. app.js gains `rcsChecklistFill()`, called from `rcsFillFromParsed`.

- [ ] **Step 1: Write the failing test**

```js
  /* ---- checklist evidence ---- */
  eq('the transmittal letter is evidenced',REC.checklist['3'].page,5);
  eq('the grids are evidenced',REC.checklist['10'].page,26);
  eq('the gross rents computation is evidenced',REC.checklist['15'].page,6);
  eq('the certification is evidenced',REC.checklist['13'].page,48);
  eq('owner-side items are never claimed',[REC.checklist['0'],REC.checklist['1'],REC.checklist['2']],[undefined,undefined,undefined]);
  T('an item with no anchor is simply absent',REC.checklist['14']===undefined||typeof REC.checklist['14'].page==='number');
```

Raise the floor: `const MIN_CHECKS=101;`

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation && node app/full-mp/test_rcs.js
```

Expected: FAIL — `Cannot read properties of undefined (reading '3')`.

- [ ] **Step 3: Implement the detector**

Add to `rcs.js` above the export line. The index keys match `CHECKLIST_FLAT` in app.js:31 exactly:

```js
/* Checklist evidence. Each entry names a section by the heading it prints, and
   the page index where it was found is cited back to the user. Items with no
   dependable anchor are deliberately absent: an unticked box is honest, a box
   ticked on a guess is not. Indices match CHECKLIST_FLAT in app.js. */
const CHECK_ANCHORS={
  4:/scopeof(work|assignment)/,
  5:/identificationofsubjectproperty/,
  6:/definitionofsubjects?primarymarketarea/,
  7:/descriptionofneighborhood/,
  11:/^conclusion|adjustment/,
  12:/comparableproperties/,
  13:/certification/,
  15:/grossrenewalpotentialcalculation/,
  16:/150ofsafmrgrossrent/
};
function readChecklist(pages,cls){
  const out={};
  (pages||[]).forEach(function(runs,i){
    if(!runs||!runs.length)return;
    const L=lines(runs);
    // headings only: a section names itself in its own top lines, and body prose
    // must not be allowed to tick a box
    const head=L.slice(0,6).map(function(l){return norm(l.text);}).join('|');
    Object.keys(CHECK_ANCHORS).forEach(function(n){
      if(out[n])return;
      if(CHECK_ANCHORS[n].test(head))out[n]={page:i};
    });
  });
  if(cls&&cls.letter&&cls.letter.length)out['3']={page:cls.letter[0]};
  if(cls&&cls.grids&&cls.grids.length)out['10']={page:cls.grids[0]};
  return out;
}
```

In `parse()`, before `return rec;`, add `rec.checklist=readChecklist(pages,cls);` and add `readChecklist:readChecklist` to the export. Also set `empty.checklist={}` on the two early returns so the shape is never undefined.

- [ ] **Step 4: Tick the boxes in app.js**

Add after `rcsFillKeys` in `app.js`:

```js
/* A tick carries the same parsed provenance as any other parsed value, and the
   page it was found on is cited in the status line. The user still signs it. */
function rcsChecklistFill(){
  const P=_rcsUpload&&_rcsUpload.parsed;if(!P||!P.checklist)return 0;
  let n=0;
  Object.keys(P.checklist).forEach(function(ix){
    const k='check.'+ix;
    if(get(k)==='1')return;
    form=store.editForm(form,k,'1');markCycle(k);if(form[k])form[k].fromParse=true;n++;
  });
  return n;
}
```

Call it from `rcsFillFromParsed`, immediately before `deriveUnits();`:

```js
  const ticked=rcsChecklistFill();
```

and extend that function's closing status line to mention it:

```js
  setStatus('Form filled from the RCS study — '+n+' value'+(n===1?'':'s')+' marked “RCS report”'+(ticked?', and '+ticked+' checklist item'+(ticked===1?'':'s')+' ticked from evidence in the document':'')+'. Review the highlighted cells, then “Update property profile”.');
```

- [ ] **Step 5: Run the tests, then commit**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation
bash app/full-mp/run_tests.sh && python3 app/full-mp/build-ra.py /tmp/rcs-ra-check.html
git add app/full-mp/rcs.js app/full-mp/app.js app/full-mp/test_rcs.js
git commit -m "A ticked box now cites the page it was ticked from"
```

---

### Task 8: Persist the reading with its package

The reading must outlive the page that made it, exactly as `rsRemember`/`rsRecall` do for the rent schedule (app.js:837). Store the parsed record and the file name — **not the PDF bytes**: nothing downstream reads them, and a 52-page study is megabytes the record does not need.

**API parity is mandatory:** a function added to `db.js` must be added to `db.supabase.js` with identical semantics. A stand-in that answers differently from the real backend makes every test that uses it a fiction.

**Files:**
- Modify: `app/full-mp/db.js`, `app/full-mp/db.supabase.js`, `app/full-mp/app.js`, `app/full-mp/test_db.js`
- Supabase migration: add `rcs_doc jsonb` to `cycle`

**Interfaces:**
- Produces: `getCycleRcs(cid) -> object` and `setCycleRcs(cid, doc) -> Promise`, on both data layers, mirroring `getCycleRs`/`setCycleRs` (db.js:488, db.supabase.js:468).

- [ ] **Step 1: Write the failing test**

In `app/full-mp/test_db.js`, beside the existing `rs_doc` checks:

```js
  await db.setCycleRcs(cid,{name:'study.pdf',parsed:{profile:'belfry',units:[{type:'2BR/1BA'}]}});
  eq('the study reading persists',db.getCycleRcs(cid).name,'study.pdf');
  eq('the study reading keeps its profile',db.getCycleRcs(cid).parsed.profile,'belfry');
  eq('a cycle with no study returns an empty object',db.getCycleRcs('nope'),{});
```

Raise `MIN_CHECKS` in `test_db.js` by 3.

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation && node app/full-mp/test_db.js
```

Expected: FAIL — `db.setCycleRcs is not a function`.

- [ ] **Step 3: Add the migration**

Apply to the Supabase project `plgegtosqwehriqecaui` (name "Related Affordable Package Automation"), and record it in `schema.sql`:

```sql
alter table public.cycle add column if not exists rcs_doc jsonb not null default '{}'::jsonb;
```

- [ ] **Step 4: Implement on both data layers**

In `db.js`, after `setCycleRs` (line 489):

```js
    getCycleRcs(cid) { const c = D.cycles[cid]; return (c && c.rcs_doc) || {}; },
    setCycleRcs(cid, doc) { const c = D.cycles[cid]; if (!c) return Promise.resolve(); c.rcs_doc = doc || {}; c.updated_at = now(); return persist(); },
```

In `db.supabase.js`, after `setCycleRs` (line 469):

```js
      getCycleRcs(cid) { const c = D.cycles[cid]; return (c && c.rcs_doc) || {}; },
      setCycleRcs(cid, doc) { const c = D.cycles[cid]; if (!c) return Promise.resolve(); c.rcs_doc = doc || {}; c.updated_at = now(); return enqueue('cy' + cid, () => pushCycle(cid)); },
```

Thread `rcs_doc` through the three places `rs_doc` appears in `db.supabase.js` — hydrate (line 89), `pushCycle` (line 268), `createCycle` (line 422) — adding `rcs_doc: c.rcs_doc || {}`, `rcs_doc: c.rcs_doc || {}`, and `rcs_doc: {}` respectively. Do the same wherever `rs_doc` is initialised in `db.js`.

- [ ] **Step 5: Remember and recall in app.js**

Add after `rcsFillFromParsed`:

```js
function rcsRemember(){if(!(activeCid&&mpdb&&mpdb.setCycleRcs))return;const u=_rcsUpload;
  const doc=u?{name:u.name,at:u.at,parsed:u.parsed}:{};      // the reading is stored; the bytes are not
  try{Promise.resolve(mpdb.setCycleRcs(activeCid,doc)).catch(()=>{});}catch(e){}}
function rcsRecall(){if(!(activeCid&&mpdb&&mpdb.getCycleRcs))return null;
  let d=null;try{d=mpdb.getCycleRcs(activeCid);}catch(e){return null;}
  if(!d||!d.name)return null;
  return {name:d.name,bytes:null,parsed:d.parsed||null,at:d.at||'',stored:true};}
```

Call `rcsRemember()` in the `#rcsFile` handler immediately after `_rcsUpload` is assigned, and set `_rcsUpload=rcsRecall()` wherever `_rsUpload=rsRecall()` is called on form open.

- [ ] **Step 6: Run every suite, then commit**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation
bash app/full-mp/run_tests.sh && python3 app/full-mp/build-ra.py /tmp/rcs-ra-check.html
git add app/full-mp/db.js app/full-mp/db.supabase.js app/full-mp/app.js app/full-mp/test_db.js schema.sql
git commit -m "The reading outlives the page that made it"
```

---

### Task 9: RECORD CHECKS — from restatement to verification

Today the command-center RECORD CHECKS card and its footer chips only restate what is stored or hand-entered; nothing is checked against a source document. A green tick that merely echoes an entered value reads as verification the app never performed. With two documents parsed, the same chips can carry real findings.

Each check states **both figures and where each came from**. A check whose two sides are not both present does not render — it must never imply an agreement it did not test.

**Files:**
- Modify: `app/full-mp/app.js`, `app/full-mp/test_rcs.js`

**Interfaces:**
- Produces: `rcsChecks() -> [{id, ok, label, detail}]` in app.js, consumed by the existing RECORD CHECKS renderer.

- [ ] **Step 1: Find the real Part B key names before writing any comparison**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation
grep -n "partb\." app/full-mp/app.js | head -20
```

Use the names this prints. Do not invent key names for the Part E comparison; the grid's neutral keys (`heat`, `cooking`, `water_sewer`, `trash`, …) are mapped onto whatever this grep reports.

- [ ] **Step 2: Write the failing test**

```js
  /* ---- record checks ---- */
  const CH=app.__rcsChecks();
  const by=function(id){return CH.filter(function(c){return c.id===id;})[0];};
  // the Section 8 number has two sides the moment the study is filled: the
  // study's reading and the stored record's own value
  T('the section 8 number is compared across sources',by('s8'));
  eq('and the sources agree',by('s8').ok,true);
  T('the check names each source',/study/.test(by('s8').detail));
  T('every rendered check states its evidence',CH.every(function(c){return c.detail&&c.detail.length>0;}));
  // the 150% check needs a ceiling to exist on our side; with none there is
  // nothing to compare and it must not render at all rather than claim a match
  T('the 150% check renders only when we have a ceiling of our own',
    by('safmr150')===undefined||/157,305/.test(by('safmr150').detail));
```

Raise the floor: `const MIN_CHECKS=106;`

- [ ] **Step 3: Implement the checks**

Add to `app.js` after `rcsChecklistFill`:

```js
/* Real comparisons, not restatements. A check renders only when BOTH sides
   exist — anything else would imply an agreement that was never tested. */
function rcsChecks(){
  const P=_rcsUpload&&_rcsUpload.parsed;const out=[];if(!P)return out;
  const m=v=>'$'+Number(v).toLocaleString('en-US');

  /* The appraiser's own 150% verdict against ours. Never substituted for it. */
  if(P.totals&&P.totals.grossRenewal!=null&&P.totals.grossSafmr150!=null){
    const a=analysis();
    /* analysis().pass is false whenever no ceiling exists, which is not the same
       as disagreeing with the study. With no ceiling there is nothing to compare
       and the check does not render at all. */
    if(a&&a.ceil>0){
      const theirs=P.totals.grossRenewal<P.totals.grossSafmr150;
      out.push({id:'safmr150',ok:theirs===a.pass,
        label:theirs===a.pass?'The study’s 150% conclusion matches ours':'The study’s 150% conclusion differs from ours',
        detail:'The study computes '+m(P.totals.grossRenewal)+' against a 150% SAFMR ceiling of '+m(P.totals.grossSafmr150)+'; our own figures are '+m(a.pg)+' against '+m(a.ceil)+'.'});
    }
  }

  /* The Section 8 number across the study, the schedule and the record. */
  const cs=rcsVal('property.s8'),rs=rsVal('property.s8'),st=get('property.s8');
  const seen=[['the study',cs],['the executed rent schedule',rs],['the stored record',st]]
    .filter(function(p){return p[1];});
  if(seen.length>1){
    const norm=function(v){return String(v).replace(/[^A-Za-z0-9]/g,'').toUpperCase();};
    const agree=seen.every(function(p){return norm(p[1])===norm(seen[0][1]);});
    out.push({id:'s8',ok:agree,
      label:agree?'The Section 8 number agrees across every source':'The Section 8 number differs between sources',
      detail:seen.map(function(p){return p[1]+' per '+p[0];}).join(' · ')});
  }

  /* Utility allowance and SAFMR, per unit type, study against its counterpart. */
  (UNITS||[]).forEach(function(i){
    const rc=numf(get('units.'+i+'.ua_rcs')),ex=numf(get('units.'+i+'.ua_exec'));
    if(rc>0&&ex>0)out.push({id:'ua'+i,ok:rc===ex,
      label:(rc===ex?'Utility allowance agrees':'Utility allowance differs')+' for '+(get('units.'+i+'.br')||'row '+(i+1)),
      detail:m(rc)+' per the study · '+m(ex)+' per the executed rent schedule'});
    const sr=numf(get('units.'+i+'.safmr_rcs')),sh=numf(get('units.'+i+'.safmr_hud'));
    if(sr>0&&sh>0)out.push({id:'safmr'+i,ok:sr===sh,
      label:(sr===sh?'150% SAFMR agrees':'150% SAFMR differs')+' for '+(get('units.'+i+'.br')||'row '+(i+1)),
      detail:m(sr)+' per the study · '+m(sh)+' per the HUD pull'});
  });

  /* The two readings of the study itself. */
  (P.conflicts||[]).forEach(function(c,ix){
    out.push({id:'conflict'+ix,ok:false,
      label:'The study disagrees with itself about '+c.what,
      detail:'The transmittal letter says '+c.letter+(c.pages&&c.pages.letter!=null?' (page '+(c.pages.letter+1)+')':'')+'; the grid says '+c.grid+(c.pages&&c.pages.grid!=null?' (page '+(c.pages.grid+1)+')':'')+'. The letter’s figure was used.'});
  });

  (P.warnings||[]).forEach(function(w,ix){out.push({id:'warn'+ix,ok:false,label:'The study could not be fully read',detail:w});});
  return out;
}
```

Add `__rcsChecks:()=>rcsChecks(),` to `module.exports`, and render `rcsChecks()` in the RECORD CHECKS card beside the existing chips — find the card with `grep -n "RECORD CHECKS" app/full-mp/shell.head.html app/full-mp/app.js` and follow the markup already there.

- [ ] **Step 4: Run the suites and commit**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation
bash app/full-mp/run_tests.sh && python3 app/full-mp/build-ra.py /tmp/rcs-ra-check.html
git add app/full-mp/app.js app/full-mp/test_rcs.js
git commit -m "A tick that means two documents were compared"
```

---

### Task 10: Non-revenue rents

To-Do #14. Each `nonrev.N.rent` fills from the proposed rent of the revenue row matching its bedroom/bath combination — the same row-matching rule as everywhere else, and the same override behaviour as any parsed field.

**Files:**
- Modify: `app/full-mp/app.js`, `app/full-mp/test_rcs.js`

- [ ] **Step 1: Write the failing test**

```js
  /* ---- non-revenue rents ---- */
  app.__edit('nonrev.0.br','2BR');app.__edit('nonrev.0.ba','1BA');
  app.__rcsFill();
  eq('a non-revenue unit takes the matching market rent',app.getVal('nonrev.0.rent'),'1850');
  T('and it says where it came from',app.__rcsTag('nonrev.0.rent').indexOf('RCS')>=0);
```

Raise the floor: `const MIN_CHECKS=108;`

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation && node app/full-mp/test_rcs.js
```

Expected: FAIL — `a non-revenue unit takes the matching market rent: got "" want "1850"`.

- [ ] **Step 3: Implement**

Extend `rcsOf` with a non-revenue branch:

```js
  m=k.match(/^nonrev\.(\d+)\.rent$/);           if(m)return rcsNonrevVal(+m[1]);
```

and add beside `rcsUnitVal`:

```js
/* A non-revenue unit is priced by its bedroom/bath combination, exactly like a
   revenue row — the appraiser priced the unit, not its use. */
function rcsNonrevVal(i){
  const p=_rcsUpload&&_rcsUpload.parsed;if(!p||!p.units)return null;
  const br=String(get('nonrev.'+i+'.br')||''),ba=String(get('nonrev.'+i+'.ba')||'');
  if(!br)return null;
  for(let j=0;j<p.units.length;j++){
    const u=p.units[j];
    if(String(u.br)+'BR'!==br)continue;
    if(ba&&u.ba!==''&&String(u.ba)+'BA'!==ba)continue;
    return (u.proposed==null||u.proposed==='')?null:String(u.proposed);
  }
  return null;
}
```

In `rcsFillFromParsed`, after the `UNITS` loop:

```js
  (NONREV||[]).forEach(function(i){const v=rcsNonrevVal(i);if(v)setk('nonrev.'+i+'.rent',v);});
```

In `rcsFillKeys`, add `(NONREV||[]).forEach(function(i){ks.push('nonrev.'+i+'.rent');});` before the filter, and in `rcsTag` add `nonrev\.\d+\.rent` to the numeric-comparison regex.

- [ ] **Step 4: Run every gate and commit**

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation
bash app/full-mp/run_tests.sh && python3 app/full-mp/build-ra.py /tmp/rcs-ra-check.html
bash app/full-mp/build.sh index.html
git add app/full-mp/app.js app/full-mp/test_rcs.js index.html
git commit -m "A unit is priced by its shape, whether or not it earns"
```

---

## Deliver

Once every task is committed:

```bash
cd /Users/matthewkodsi/Desktop/github/Form-Automation
bash app/full-mp/deliver.sh
git add index.html && git commit -m "Ship the study reader" && git push
```

`deliver.sh` syntax-checks every JS the build concatenates, runs all suites via `run_tests.sh`, builds in the sandbox, copies to the project-root `index.html`, and `cmp`-verifies the copy landed intact. A failing suite aborts before anything is written. Pushing to `main` deploys to https://packageautomation.run.place — verify with:

```bash
curl -s -o /dev/null -w '%{size_download}\n' "https://packageautomation.run.place/index.html?cb=$RANDOM"
```

## What this plan does not claim

**One document.** Everything is tuned to a single Belfry study, because it is the only real RCS study in the repo. The profile design keeps the cost of being wrong low — a new appraiser is a new entry in `PROFILES` plus a new fixture, not a rewrite — but nothing here has been validated against a second firm's format, and the generic profile is untested by definition: until a non-Belfry study exists it can only be tested negatively, that an unrecognised document fills nothing.

**Re-export breaks anchors.** The 8-page `Colonial Village - RCS Package.pdf` renders the same source documents with word spacing destroyed and values missing. Every anchor in this plan goes through `norm()` for that reason, but a study that arrives through a lossy converter may still read as unparseable. That is the honest outcome, and the app says so rather than guessing.
