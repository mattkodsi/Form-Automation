# RCS corpus audit — ledger

Started 2026-07-31 on branch `rcs-audit`, per `docs/lanes/rcs-audit-run.md`.

Row format, per the method: `property · year · document · field · SHOULD · OURS ·
FILED · verdict · mechanism · evidence`. The verdict names the leg that is wrong —
`app wrong`, `team wrong`, `both wrong`, `cosmetic`. FILED is evidence, never the
referee. A row with no evidence does not count. A row whose mechanism is not traced
stays `undiagnosed`, and no repair is written against an undiagnosed row.

---

## RUN BLOCKER — chromium has no network egress in this container

**Status: open. Needs Matt. No `app wrong` verdict is reachable until it clears.**

The sweep generates nothing, on every property, because the browser it drives cannot
reach the internet. **This is an environment limit, not an app defect and not a token
problem.** An earlier entry in this ledger blamed the Supabase refresh token; that was
wrong and is corrected here.

### How it was established

The first sweep failed with `Invalid Refresh Token: Already Used`. Matt supplied a
fresh token; `loadSession` exchanged it successfully (`signed in as mfkodsi@gmail.com
— valid 3600 s`) and wrote the rotated token to the session file. The sweep then failed
*differently*: `the signed-in app never reached the property gallery`, `view now: Auth`.

Driving the same bundle under CDP and asking the page what it saw:

```
lsPresent : true                     the session IS in localStorage
a fresh client in the page: session  { exp: 1785478830 }   ← the session is VALID
net: 13086ms GET THREW https://…supabase.co/auth/v1/user :: Failed to fetch
```

So the app has a good session and fails on the network call. Chromium's own error, read
off the Network domain rather than inferred from `Failed to fetch`:

```
net::ERR_CONNECTION_RESET        (net_error -101)
ERROR:net/socket/ssl_client_socket_impl.cc:902  handshake failed; SSL error code 1
```

Four things were then ruled out by test, not by assumption:

| hypothesis | test | result |
|---|---|---|
| chromium ignores `--proxy-server` | pointed it at a dead port | error CHANGED to `ERR_PROXY_CONNECTION_FAILED` → **the flag is honoured** |
| the proxy CA is untrusted | imported it into a new NSS db at `~/.pki/nssdb` | no change (and an untrusted CA reports `ERR_CERT_AUTHORITY_INVALID`, not a reset) |
| chromium's ClientHello breaks the MITM | `--ssl-version-max=tls1.2`, `--disable-features=PostQuantumKyber,ECH`, `--disable-quic --disable-http2` | no change on any |
| Supabase specifically is blocked | fetched `example.com` and `api.github.com` from the same browser | **both fail too** |

The discriminator: through the *same* proxy, in the *same* container, `curl` gets
`200 / 200 / 401` for those three hosts while chromium gets a reset on all three. And
`$HTTPS_PROXY/__agentproxy/status` reports `recentRelayFailures: []` — chromium's
connections never reach the proxy's relay at all.

**Conclusion:** node and curl have egress; chromium does not. Every browser-driven leg
— `sweep.js`, `drive.js`, and the interaction storm — is therefore unrunnable here.
`test_browser.js` and `test_shots.js` still pass because they serve the bundle from
`127.0.0.1` and never leave the container.

### The proxy is NOT the cause — measured, negative result

The run doc's hypothesis (chromium never gets `HTTPS_PROXY`, which node reads
automatically) is sound in general and is **wrong here**. Recorded because a ruled-out
cause is worth as much in the morning as a fix.

| # | measurement | result | what it kills |
|--:|---|---|---|
| 1 | `env \| grep -i proxy` | `http://127.0.0.1:34565` — **no embedded credentials, `http` scheme** | Chrome-ignores-proxy-credentials, and the https-scheme-lost-in-the-flag theory |
| 2 | `curl` to Supabase **with no proxy at all** | **200-class reply** (`UNAUTHORIZED_MISSING_API_KEY`, via cloudflare) | egress is **not** proxied — so a missing proxy flag cannot be the cause |
| 3 | `--proxy-server` pointed at a dead port | error CHANGES to `ERR_PROXY_CONNECTION_FAILED` | "the flag was ignored" — it is honoured |
| 4 | proxy CA imported into a fresh `~/.pki/nssdb` | no change | untrusted-CA (which would report `ERR_CERT_AUTHORITY_INVALID` anyway) |
| 5 | `--ignore-certificate-errors` | no change | any TLS-trust cause |
| 6 | `--ssl-version-max=tls1.2`; `--disable-features=PostQuantumKyber,ECH`; `--disable-quic --disable-http2` | no change on any | ClientHello / protocol incompatibility |
| 7 | full `chromium-1194/chrome-linux/chrome` instead of `headless_shell` | no change | a stripped-build defect |
| 8 | `--disable-features=NetworkServiceSandbox`; `--headless=old`; `--no-zygote --single-process` | no change on any | chromium's network-service sandbox |
| 9 | `--host-resolver-rules=MAP example.com <curl's own IP>` | no change | DNS interception |
| 10 | `example.com`, `api.github.com`, Supabase from chromium | **all** `ERR_CONNECTION_RESET` | anything host-specific or policy-specific |
| 11 | same three hosts via curl | `200 / 200 / 401` | any claim that the container cannot reach the internet |
| 12 | `$HTTPS_PROXY/__agentproxy/status` | `recentRelayFailures: []` | the proxy rejecting chromium — it never sees it |

Chromium's own report is `net::ERR_CONNECTION_RESET` (net_error −101) with
`handshake failed; SSL error code 1`, identically with and without proxy flags. The
browser process is sound — it loads `data:` URLs, runs JavaScript and answers CDP evals
throughout. **Only its outbound sockets die, and only chromium's.**

Untested and the remaining plausible cause: an egress filter that distinguishes
processes (cgroup/uid/binary) below the proxy, which no chromium flag can reach.

**To unblock:** run the driving leg on a machine with working chromium egress (Matt's
Mac, where `drive.js` has always worked). Nothing in this container's chromium
configuration is going to fix it.

### Corpus and manifest are ready for it

Not blocked, and done: the corpus is fetched and the manifest rebuilt from all of it.

| | old (partial mount) | rebuilt | inventory doc |
|---|--:|--:|--:|
| properties | 34 | **46** | 34 |
| cycles | 68 | **88** | — |
| files | 3,364 | **4,445** | — |
| auditable (study + filed docs) | 63 | **80** | 56 |

4,447 files fetched (3.824 GiB, 0 copy errors), agreeing three ways — `find`, `ls -R`,
and rclone's own Drive-side count. The walker reports 4,445 because it skips two `~$`
lockfiles by design. Village Court yields no RCS cycle from 8 walked files, which
`build-manifest.js` itself flags as a failure of the pass rather than an absent cycle.

---

## Findings — Colonial Village (75708), 2026 (RCS)

Read by eye as rendered page images, per the method. **The OURS leg is absent** (see the
blocker), so these are SHOULD vs FILED only and no verdict here can be `app wrong`.

148 fields were checked; the 8 below disagree with SHOULD. The rest agree and form the
evidence base. SHOULD was built from the governing RCS study and the FY2025 **executed**
rent schedule, both read before any filed output was opened.

| # | document | field | SHOULD | FILED | verdict | evidence |
|--:|---|---|---|---|---|---|
| 1 | Rent schedule `05` | Col.1 row 2 unit type | `3 Bedroom` | **`1 BR`** | team wrong | RS26 p.1 @200dpi vs EXEC25 p.1 @200dpi; RCS p.2 "3BR/1BA"; tenant notice "3BR" |
| 2 | Rent schedule `05` | Col.5 UA, 2BR | `161` | **`160`** | team wrong | RS26 p.1 vs RCS p.3, EXEC25 p.1, workbook `Belfy!P9`=161 |
| 3 | Rent schedule `05` | Col.6 gross rent, 2BR | `2,011` | **`2,010`** | team wrong | consequence of #2; RCS p.3 computes 32 × 2,011 = 64,352 |
| 4 | Rent schedule `05` | Part H name/title | David Pearson, VP of GP | **Matthew Finkle, VP of GP** | team wrong | RS26 p.2 vs its own Part G, EXEC25 Part H, both cover letters |
| 5 | Checklist `03` | owner signature | signed | signature line renders blank | team wrong | CK3 p.1 |
| 6 | Checklist `v2 (signed)` | project identification | Colonial Village | **absent** — blank "Sample Owner's Checklist" | team wrong | CKv2 p.1 |
| 7 | Checklist `03` vs `v2` | "Scope of Work" box | checked (RCS has a Scope of Assignment, p.5) | `03` unchecked, `v2` checked | team wrong | CK3 p.1 vs CKv2 p.1 vs RCS p.5 |
| 8 | Analysis workbook | scope of file | Colonial Village only | sheet 1 holds **Crossroads of East Ravenswood** rent grids | team wrong | `xl/workbook.xml` sheets `Belfry`/`Belfy`; sharedStrings carries both property titles |

### The two most serious, verified independently

Findings **#1–#3** were re-checked by the coordinator, not taken on the subagent's word:
both schedules were re-rendered at 200 DPI with `pdftoppm` and read directly.

The filed 2026 schedule reads:

| Col.1 | Units | Rent/unit | Col.4 | Col.5 UA | Col.6 Gross |
|---|--:|--:|--:|--:|--:|
| 2 BR | 32 | 1,850 | 59,200 | **160** | **2,010** |
| **1 BR** | 33 | 2,400 | 79,200 | 171 | 2,571 |
| 2 BR Non Rev | 1 | 0 | 0 | 0 | 0 |

The FY2025 **executed** schedule — the governing prior document — reads:

| Col.1 | Units | Rent/unit | Col.4 | Col.5 UA | Col.6 Gross |
|---|--:|--:|--:|--:|--:|
| 2 Bedroom | 32 | 1,147 | 36,704 | **161** | 1,308 |
| **3 Bedroom** | 33 | 1,407 | 46,431 | 171 | 1,578 |
| 2BR Non Rev | 1 | 0 | 0 | 0 | 0 |

**#1** — read literally, the filed schedule asks the contract administrator to set a
one-bedroom contract rent of $2,400 on 33 units in a project with no one-bedroom units.

**#2/#3** — the $160 is not arbitrary: it is the value from the FY2025 **draft**, which
the executed schedule corrected to $161. The 2026 schedule appears built from the
superseded draft. Dollar effect is small ($32/month understated, and the 150% SAFMR test
passes either way — $149,195 < $157,305), but it makes the filed schedule disagree with
the study it accompanies and with the team's own workbook.

### Appraiser-side inconsistencies inside the filed RCS

Not PM errors, but they are in the filed package and a reviewer will find them.

- Comparable 2 (ES Properties) is **2720 Eden Avenue** in the 2BR grid and **2611 Vine
  Street** in the 3BR grid and its own profile — one comparable, two addresses.
- Comparable 5 is **EL/4** (elevator, 4 storeys) in the 2BR grid and **TH/2** (townhouse,
  2 storeys) in the 3BR grid, where the profile says "two-story, townhouse".
- The Improvements page dates the renovation to **2022**; both grids and the adjustment
  narrative use **1956/2021**.

Neither of the first two drove a dollar adjustment.

### Two things that look like discrepancies and are not

- 2BR count is **32** in the RCS conclusion and **33** in the Improvements table:
  different populations. The 33rd two-bedroom is the leasing office, carried separately
  on the schedule's "2 BR Non Rev" line and in Part D.
- Comparable 4 (The Whitfield) has no 3BR stock, so its 2BR was used in the 3BR grid
  with a disclosed **+$460** bedroom adjustment on line 11 — not a hidden substitution.

---

## Harness findings

| # | component | finding | evidence |
|--:|---|---|---|
| H1 | `sweep.js` | **`--session` is silently ignored.** The string does not appear in the file and is absent from its `VALUED` set, so `--session /tmp/s.json` drops the path into the positional array and sweep loads `SESSION_DEFAULT` regardless. Placed *before* the three positionals it would instead be parsed as the corpus root. `drive.js` does support the flag, so the two disagree. | `grep -c session sweep.js` = 0; `VALUED=new Set(['out','only','limit','jobs','label','fuzz','cycles'])` |
| H2 | `build-manifest.js` | Colonial Village's "top two studies are within one rank; the choice is a coin toss" is **spurious** — the two files are byte-identical (both md5 `3b89efc4d29eae2d5dfa0e3caa2909ab`, 3,970,935 bytes). One document filed twice under two naming conventions. 17 properties carry this problem flag; some fraction are likely the same duplicate-file case, which a hash check would retire. | `md5sum` of both files |
| H3 | `test_browser.js` | **Fixed in `ef2aee5`.** `skip()` printed "0 checks ran — this is not a pass" and then exited 0, so `run_tests.sh` counted it green; `MIN_CHECKS` never ran because the skip returned before `finish()`. Now fails, and the exit handler asserts the floor independently so any future early return is caught. | with the browser hidden the suite exits 1 where it previously exited 0 |
| H4 | `cdplib.js`, `corpus/drive.js`, `fuzz.js` | **Fixed in `ef2aee5`.** `findChrome()` searched only `~/Library/Caches/ms-playwright`, so no browser was found on a Linux runner; and chromium refuses to start as root with its sandbox on. Three spawn sites, all corrected; `--no-sandbox` only at uid 0. | `test_browser.js` 0 → 539 checks; `test_shots.js` could not run at all, now 111 |

---

## Handed to the redesign lane — not repaired here

`test_browser.js`, 539 checks, 5 failed. All viewport/layout; `shell.head.html` styling
belongs to another lane, so these are written down rather than fixed (run order step 5).

| # | check | got | want |
|---|---|---|---|
| 1 | 1200px: the page does not scroll sideways | true | false |
| 2 | 1280px: the page does not scroll sideways | true | false |
| 3 | …and sits at the top of the screen, not scrolled off it | false | true |
| 4 | at 1680px the page is centred, not pinned left | false | true |
| 5 | at 2560px the page is centred, not pinned left | false | true |

Checks 1–2 say the page scrolls horizontally at common laptop widths — a usability
defect rather than a cosmetic one. Not diagnosed here.

---

## Findings — Westwood Village (4640009), 2025 - RCS

SHOULD vs FILED only; OURS absent. Sources: Belfry study 25-072 (24 Jun 2025) and the
FY2024 executed schedule. ~110 fields checked.

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | Rent schedule | 3BR-HC utility allowance | **155** (baseline wkbk `F18` = electric 98 + gas 57) | **161** | team wrong |
| 2 | Rent schedule | 3BR-HC gross rent | 1,505 | 1,511 | team wrong |
| 3 | Rent schedule | 4BR utility allowance | **151** (`F19` = 82 + 69) | **150** | team wrong |
| 4 | Rent schedule | 4BR gross rent | 1,751 | 1,750 | team wrong |
| 5 | Rent schedule | Part B "Trash" | checked (study p.42 + grid row 39; HUD screening checklist) | unchecked | team wrong |
| 6 | RCS transmittal | contract number | **VA36H027152** | **VA36H026152** | team wrong |
| 7 | Owner's checklist | "Scope of Work" | checked (study has a Scope of Assignment) | unchecked | team wrong |
| 8 | RCS body p.13 | who pays hot water | tenant (gas) — per its own grid row 36 and p.42 | "owner provides cold and hot water" | team wrong |

Both bad allowances flow through to **Exhibit A**, the document that tells the site what
to bill. Neither appears in either 30-day UA notice nor in the CA's written correction:
the CA's 17 Jul 2025 email corrected only 2BR→121 and 2BR-HC→87 and struck the 3BR-HC
and 4BR rows from the tenant notice. **$161 and $150 have no documented source in the
folder.** Observation, not a conclusion: 161 = 98 (3BR-**HC** electric) + 63 (the
**non-HC** 3BR gas figure).

Contamination check **negative** — both grid workbooks hold a single `Westwood` sheet.
Two working files (not filed) carry defects: the 6.20.25 workbook's second block has
`#REF!` in its pass/fail cell, and the superseded 11.30.24 workbook assigned SAFMRs one
bedroom low and grossed UAs by a flat 10% instead of measuring them.

## Findings — Circle Park (75833), 2026 - RCS

SHOULD vs FILED only; OURS absent. Governing study is the **25 Nov 2025** 87-page
revision (HUD's issues memo forced it); the 11 Nov 80-page version is superseded. Rent
conclusions are identical between the two, so nothing downstream turns on the choice.

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | RCS study p.4 | 150% SAFMR test line | `864,296 < 959,940` | prints **`$864,296>$959,940`** | team wrong |
| 2 | RCS study p.4 | Total Gross SAFMR Rent | **639,960** (its own five lines) | **639,690** (transposed) | team wrong |
| 3 | RCS study p.3 | Gross potential, 1BR line | **365,880** (120 × 3,049) | **365,800** | team wrong |
| 4 | RCS transmittal | FHA/project number | **IL060054027** | **IL00054027** | team wrong |
| 5 | RCS study p.2/p.74 | "Prepared Grid (Y/N)" 3BR-TH | Y (grid is at p.65) | renders blank | team wrong |
| 6 | RCS study p.18 | unit-breakdown column vs total | column and TOTAL must agree | 120/4/55/2/58 = 239 under a TOTAL of 418 | team wrong |
| 7 | Tenant Notice Certification | signature + date | signed and dated | both render blank | team wrong |
| 8 | Combined package | which study is embedded | the 25 Nov study of record | the superseded 11 Nov study | team wrong |
| 9 | 13 Jan rent-schedule drafts | Part B utilities | unchecked (UAs are non-zero) | Heating/Cooling/Hot Water/Cooking **checked** | team wrong (superseded) |

The test **does** pass; #1 is a printed glyph asserting the opposite, and #2/#3 are line
items whose own totals were computed off the correct figures. #9 did not reach the
executed form but was in the file the owner DocuSigned.

**Unresolved:** the study and the workbook disagree on the FY vintage of the SAFMR table
(study 2,340/2,640/3,390 vs workbook 2,370/2,670/3,440). No HUD SAFMR printout is in the
folder. Outcome is unaffected — the project passes on either set.

**Adjacent, outside this cycle:** Circle Park's **2025** tenant-notice certification
certifies on behalf of *Marshall Field Preservation L.P.* — a different Related property.

## Findings — Oceanport Gardens (75563), 2024 - RCS

SHOULD vs FILED only; OURS absent. Renzi & Associates job 24-067 governs; the JLL study
is an internal comparison and appears nowhere in the submission.

**The central finding is a rent gap nobody in the folder derives.**

The filed RCS concludes 2,525 / 2,535 / 2,550 / 3,200 / 3,210 / 3,215. The rents executed
effective 1 Jul 2024 are 2,590 / 2,600 / 2,615 / 3,220 / 3,225 / 3,235 — **$6,015/month,
$72,180/year above what the filed study supports.** Both the NJHMFA approval letter
(2 May 2024) and its transmittal (7 May) describe these as *"100% of Owner's Rent
Comparability Study."*

Nothing in the folder produces those numbers: not the Renzi report, not its preliminary
grids, not the JLL study, and not any workbook dated before the CA's letter. The
`5.3.24` workbook records them *after* the CA issued them. They are not an OCAF or UAF
applied to the RCS rents — the implied 1BR multiplier does not reproduce the 2BR values.
**Marked `undetermined`, not `team wrong`: the mismatch is not in doubt, its origin is.**

Downstream, stated without proposing anything: the 16 Apr 2024 tenant notice told
residents 2,525–3,215. The adopted rents are higher, and no corrected notice is in the
folder. The 150% SAFMR test still passes on the higher rents (270,257 vs 356,250).

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | RCS grid p.25 vs summaries | 1BR-Small concluded rent | one value | grid says **2,500 / $4.53**, every summary says **2,525 / $4.57** | team wrong |
| 2 | RCS title page | ZIP | 07757 | **60657** | team wrong |
| 3 | RCS pp.32, 41 | tenancy narrative | a senior-citizens project | "specializes on individuals struggling with homelessness and with special needs" | team wrong |
| 4 | Owner's checklist | owner signature | signed (its own "Signed Owner's Checklist" is ticked) | signature line renders blank | team wrong |
| 5 | Exhibit A | contract form cited | **HUD-9638** Mark-Up-to-Market | **HUD-9637** Basic Renewal | team wrong |

#1 affects 60 of 100 units, and the filed schedule's 2,590 is $90 above even the grid.
The other five grids match their summaries exactly, so it is isolated. Contamination
check **negative** across all four workbooks.

## Findings — Lansing Manor (75500), 2026 - RCS

SHOULD vs FILED only; OURS absent. Four copies of the Belfry 25-119 study exist; the
**7 Oct** version is the one bound into the filed submission. The 17 Oct "(updated)"
version differs only in grid line 33 (heat adjustment −26 → −41, adding the MSHDA $15
gas service charge) and **line 46, the concluded rent, is unchanged in both** — so the
choice is immaterial to every figure below.

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | RCS study p.3 | utility allowance | **116** in force (prior executed RS + team's own workbook `I3`) | **85** | team wrong |
| 2 | RCS study p.3 | owner's gross renewal potential | on 116 → 131,280 | 40,800 / 87,380 / **128,180** on the 85 | team wrong |
| 3 | RCS study p.3 | first 150% SAFMR table | a genuine FY2025 comparison (910 → 1,365) | headed "150% **2025** SAFMR" but fed by the 2026 column at 1,560 — a duplicate of the table below it | team wrong |
| 4 | RCS study p.2/p.23/p.30 | "FHA Project No." | `N/A` | **MI330005001** (that is the HAP contract number) | team wrong |
| 5 | RCS study p.1/p.14 vs p.2/p.23/p.30 | county | one county | **Ingham** on title/site ("Inghram"), **Eaton** in the letter and both grids | undetermined |
| 6 | Appendix 2 (21 Nov) | ZIP / project no. / entity | 48917 / MI330005001 / …Association, LLC | **48971** / **MI1330005001** / "…**Associaton LP**" | team wrong |
| 7 | CA rent determination letter | 1BR-Patio current rent | 897 | **997** | undetermined (CA's error, did not propagate) |

**$85 appears in no other document in the cycle.** The 150% conclusion survives
recomputation on the correct 116 (131,280 < 156,000), but the printed gross figures are
wrong. #6 is three transcription errors on one page.

**Not contamination.** Both workbooks are named "Senior World" but hold Lansing Manor's
own data — "Senior World" and "Village Green III" are aliases of this property, and no
separate Senior World exists anywhere in the corpus. The Belfry `SAFMR Analysis.xlsx`
"Proposed Rents" column is a ceiling back-solve (`=150%SAFMR − UA`), a pre-engagement
feasibility screen, not a concluded rent — and it was not filed.

**Signature caveat worth carrying forward:** the three loose components in the folder
root render unsigned, while the copies bound into the filed submission are all
DocuSigned. Judging a package by its loose files would report false "unsigned" defects —
the bound submission is the operative artifact.

---

## Mechanisms — patterns across properties, not per-property defects

Per the run order: *"Fix by MECHANISM, never by property, and never from a single
property: either two properties show it or a code reading shows it is general."* Wave 1
is five packages. Each entry below states how many of the five carry it, so a reader can
see which have cleared that bar and which have not.

### M1 · "FHA Project No." always carries the HAP contract number — 5 of 5

Every study transmittal prints the Section 8 HAP contract number in a field labelled
*FHA Project No.*, and the rent-comparability grid headers repeat it under
*Subject's FHA #*. The actual FHA project number is `N/A` for these properties, and the
executed schedules say so.

| property | printed as "FHA Project No." | correct FHA no. |
|---|---|---|
| Colonial Village | `OH10M000236` | (blank on both filed and prior executed) |
| Westwood Village | `VA36H026152` — **and a digit wrong** (…027152) | `N/A` |
| Circle Park | `IL00054027` — **and a digit wrong** (IL060054027) | blank |
| Lansing Manor | `MI330005001` | `N/A` |
| Oceanport Gardens | `NJ3900-14058` in the grids' FHA box | `N/A` on the HAP contract, `031-35157` on Exhibit A |

Two of the five also mistype the number, and in Circle Park's case **HUD's own issues
memo repeated the malformed number**, so the error propagated into the review record.
This is an appraiser-template mechanism (Belfry on four, Renzi on one — so it is not
even firm-specific). It is not something the app can cause, but it is something the app
could *detect*, since the app holds both numbers.

### M2 · The filed Col.5 utility allowance disagrees with its governing source — 3 of 5

| property | filed | governing source says | source of the wrong figure |
|---|--:|--:|---|
| Colonial Village | 160 | 161 (RCS p.3, FY2025 **executed**, workbook) | the FY2025 **draft**, which the executed corrected |
| Westwood Village | 161 / 150 | 155 / 151 (baseline worksheet `F18`/`F19`) | undetermined — appears nowhere in the folder |
| Lansing Manor | study priced on 85 | 116 in force, 99 approved | undetermined — appears nowhere in the cycle |

**This is the mechanism most relevant to the app.** Colonial Village's case is exactly
the failure the app is meant to prevent: a value carried from a superseded draft instead
of the executed schedule. `db.js` routes rents and allowances through the per-cycle
bucket and the app reads the *prior executed* schedule as its source — so when the OURS
leg runs, the first question to ask each package is **which schedule the app picked up
as "prior"**. The manifest's `priorRsRule` already records that choice per cycle, and
2 of 88 cycles resolved by `newest before year 0` rather than `year-1 folder`.

### M3 · Judging loose files manufactures defects — 3 of 5, and it is a METHOD finding

Colonial Village, Oceanport and Lansing Manor all have package components sitting loose
in the folder that render **unsigned**, while the copies bound into the combined
submission are DocuSigned. Lansing Manor has all three loose components unsigned and all
three bound copies signed.

An auditor reading the loose files reports three signature defects that do not exist.
**This applies directly to the OURS leg**: the app generates loose documents, so any
comparison of OURS against a *bound* FILED package will show a signature difference on
every property, and that difference is not a finding. Any comparator that scores
signatures must compare like with like, or exclude them.

### M4 · "Scope of Work" left unchecked though the study contains one — 3 of 5

Colonial Village, Westwood Village and Oceanport Gardens all leave the owner's-checklist
"Scope of Work" box unticked while the RCS opens with a *Scope of Assignment* section.
Circle Park and Lansing Manor tick it correctly. The app owns this checkbox
(`CHECKLIST_FLAT`, 17 items), so it is directly testable once OURS exists.

### M5 · Arithmetic errors on the study's own summary pages — 2 of 5

Circle Park prints a line item of `365,800` where its own columns give `365,880`, a
total of `639,690` where its own five lines sum to `639,960`, and a 150% test reading
`$864,296>$959,940` when the figures require `<`. Oceanport's 1BR-Small grid concludes
`2,500 / $4.53` while every summary in the same report says `2,525 / $4.57`.

In both cases **the downstream totals were computed off the correct figures**, so the
printed line items are the only wrong values. That matters: a comparator checking only
totals passes these.

### Not yet mechanisms — single property, recorded so the second instance is recognised

- **Cross-property contamination in a filed workbook** — Colonial Village only (sheet 1
  holds Crossroads of East Ravenswood's rent grids). Lansing Manor looked like a second
  instance and is not: "Senior World" and "Village Green III" are aliases of Lansing
  Manor itself. **An alias is not contamination**, and the corpus is full of aliases
  (Colonial Village/White Oak Townhomes, Oceanport Gardens/Oceanport Senior Citizens).
  Adjacent: Circle Park's **2025** certification names *Marshall Field Preservation L.P.*
- **A rent gap the folder cannot derive** — Oceanport only, $72,180/year, described by
  the CA as "100% of Owner's RCS". If a second property shows this, it stops being a
  one-off and becomes a question about how CA determinations relate to filed studies.
- **The unit-type label on the filed HUD-92458** — Colonial Village only (`1 BR` for 33
  three-bedroom units). Directly app-relevant: the app writes Col.1 from its own unit
  mix, so this is a row the OURS leg will either reproduce or get right.

---

## THREE-WAY — Colonial Village (75708), 2026 (RCS) — the first complete audit unit

The OURS leg ran on Matt's Mac (`sweep-out/cv.json`, app frozen at `84677d0`) while
SHOULD and FILED were read here by eye. **This is the first row set where all three legs
exist, so it is the first place `app wrong` is reachable.**

88 values compared; 56 matched; 10 are true mismatches (both sides carry a value). The
remaining 22 are extraction gaps, judged separately below.

### The app is right and the PM team is wrong — 5 of 5 defects I found by eye

Every SHOULD-vs-FILED defect in the rent schedule, the app got right on its own:

| key | SHOULD | OURS | FILED | verdict |
|---|---|---|---|---|
| `unit.0.ua` | **161** | **161** | `160` | team wrong |
| `unit.0.gross` | **2,011** | **2,011** | `2,010` | team wrong |
| `unit.1.type` | **3 Bedroom** | **`3BR/1BA`** | `1BR` | team wrong |
| `sig.name_title` | **David Pearson, VP of General Partner** | **same** | `Matthew Finkle, VP of GP` | team wrong |
| checklist "Scope of work" | **checked** | **`check.4 = 1`** | unticked on filed `03` | team wrong |

This is the strongest evidence yet that the tool does the job it was built for. The
utility-allowance case is the sharpest: the team carried `160` forward from the FY2025
**draft**, and the app independently produced `161` — the value in the executed schedule
and in the study. The app would have caught a live filing error on 32 units.

The checklist row could not be compared mechanically (see extraction gaps) — it is
established by combining the app's own `check.4 = 1` with my eye-read of the filed form.

### The app is wrong — 1 confirmed

| key | SHOULD | OURS | FILED | verdict |
|---|---|---|---|---|
| `unit.2.type` | **`2 BR Non Rev`** | **`2BR`** | `2BRNonRev` | **app wrong** |

The app drops the non-revenue designation from Col. 1 row 3. Both the filed 2026
schedule and the FY2025 executed schedule carry it, and Part D separately books the unit
as a Leasing Office with `$1,850` of rent loss. A HUD-92458 whose Col. 1 does not
distinguish the non-revenue unit invites it to be read as a 33rd revenue-producing
two-bedroom. **Mechanism not yet traced — stays `undiagnosed`, no repair written.**

### The app produced nothing where the filed document has a value — 1

`principals.1.name` — the filed Part G names a second principal, *David Pearson, Vice
President of General Partner*; the app emitted none. Whether Part G should carry the
principal in addition to the entity and GP is a form-rules question I have not settled,
so this is **`undetermined`**, not `app wrong`.

### Style, not findings — 4

`unit.0.type` `2BR/1BA` vs `2BR`, the same on both `analysisXlsx` rows, and
`rent_schedule.eff_day` `01` vs `1`. The app is more specific than the filed form; the
run brief excludes differences of style. Recorded so nobody re-derives them.

### Instrument defects — the comparator, not the app or the team

1. **`checklist · property.name` extracts as `7/7/2026`.** The filed checklist carries
   *Colonial Village* as project name and *7/1/2026* as the date; the extractor is
   reading a date into the name field. Reported by the pipeline as a high-severity
   mismatch, it is **a false finding**. Either field misalignment in `extract.js`, or it
   read `Owners Checklist v2 (signed).pdf`, which has no project identification at all.
2. **21 `missing-theirs` rows on the checklist.** The filed checklist yields no
   extractable field values, so all 17 app checkbox values plus heading and signature
   have nothing to compare against. Not a defect on either side — but it means **the
   checklist is currently unaudited mechanically**, and the one substantive finding in
   it (Scope of work) had to be established by eye.
3. **`coverLetter` counted as "the app did not generate".** `gen.js` exports both
   `coverLetter` and `ownerLetter`, and the filed package holds two distinct letters.
   More likely a pairing failure in the comparator than a generation gap. Needs
   diagnosis before it is reported as an app defect.

Per the lane brief — *trust no tool you have not tested* — items 1 and 3 are exactly the
kind of confident-but-wrong output the audit is supposed to catch in its own instruments.

### The interaction storm found a real app bug

Three violations, all replaying from seed `601113841`. Two name `property.name` over a
`ZZ-CORPUS` value and are probably harness artifacts. The third is not:

> `partb.fuel.1` and `partb.fuel.4` hold `'E'` with source `new` after a completed save,
> against a record holding `''` — and **neither cell is on screen**.

Off-screen keys still differing after a settled save is the phantom-dirty shape. This is
an `app wrong` candidate with a deterministic replay, found without any ground truth —
which is why the storm runs on every package.

### What this changes about the run

The split now works: the driving leg on the Mac, the reading and analysis legs here, the
repo as the channel. One package has been audited all three ways. **87 cycles remain**,
and the SHOULD leg for four more (Westwood Village, Circle Park, Oceanport Gardens,
Lansing Manor) is already written and waiting for its OURS.

---

## Oceanport's $72,180 gap — the third-document hypothesis, tested and eliminated

Matt's suggestion was that every previously unexplained allowance in this corpus turned
out to live in a third document — a CA exhibit or UA workbook. **Tested here; it does
not.** The gap's entry point is now located precisely even though its derivation is not.

**Where it enters.** NJHMFA's determination letter of **05/02/2024**
(`2024 - RCS/Oceanport Senior Citizens-M2M-UAF-FY2024.pdf`), read page by page as
images. Its rent table is headed:

> **"Adjusted Contract Rent Based on Owner's RCS"** — 2,590 / 2,600 / 2,615 / 3,220 /
> 3,225 / 3,235

The filed RCS concludes 2,525 / 2,535 / 2,550 / 3,200 / 3,210 / 3,215. **The letter's own
column header names a basis its own numbers contradict.** Deltas +65/+65/+65/+20/+15/+20
— not a uniform factor, so not an OCAF or UAF applied to the RCS.

**What was ruled out, by looking rather than by inference.**

| checked | result |
|---|---|
| The letter's **Enclosure** (pp. 3–5) | a **blank** HUD-92458 for the owner to complete — carries no figures at all |
| The rest of the 2024 cycle folder | no CA exhibit, rent-adjustment worksheet or UA workbook for 2024. `RENT_ADJU_WORKSHEET` files exist for 2021 and 2022 only |
| Whether the figures appear in the study | the study's whole text layer carries **one** occurrence, on p.54 — and that is **Comp #3's adjusted rent** of `$3,220` on line 44 of the Two-Bedroom-Medium grid, a comparable, not a conclusion. Line 46 of that grid reads **$3,210**, the RCS figure. Confirmed by rendering p.54 at 160 dpi and reading it |
| Later cycles | `2025/` holds only a rent schedule and an archive; `2026/` an amendment. Neither restates the 2024 basis |
| The UA leg | the letter's Adjusted Utility Allowances (43/40/45/63/73/19) are exactly `prior × 1.033` rounded, and match the study. **The gap is entirely in contract rent, not in the allowance** |

**Verdict stays `undetermined`** — but the statement is now much tighter than "nobody
derives them". The figures enter the record at the CA's determination, the determination
cites the RCS as its basis, the RCS does not contain them, and nothing else in the
property folder does either. Whatever produced them is outside this corpus.

This also distinguishes it from the Westwood and Lansing allowance cases, where the
unexplained figure was a *utility allowance* and the governing worksheet was present.
Here the governing document is present, is the source, and disagrees with itself.

---

## M6 · Off-screen Part B keys survive a completed save — 2 properties, MECHANISM

Judged per **key**, not per violation. That distinction matters: three of the four
violations name `property.name` *alongside* other keys, so discarding a violation because
it mentions `property.name` would throw away the real keys travelling with it.

**Classification of all 19 violation keys across the four driven packages:**

| class | keys | judgement |
|---|--:|---|
| `property.name` vs a `ZZ-CORPUS` snapshot | 4 | **harness artifact** — confirmed |
| **off-screen, still dirty after a settled save** | **6** | **real — phantom dirty** |
| on-screen, still dirty after a settled save | 9 | needs diagnosis, see below |

### The real one

| property | key | form | snapshot | seed |
|---|---|---|---|---|
| Colonial Village | `partb.fuel.1` | `"E"` / `new` | `""` / **`database`** | `601113841` |
| Colonial Village | `partb.fuel.4` | `"E"` / `new` | `""` / **`database`** | `601113841` |
| Colonial Village | `partb.equipment.3` | `"1"` / `new` | `""` / `new` | `601113841` |
| Colonial Village | `partb.equipment.4` | `"1"` / `new` | `""` / `new` | `601113841` |
| Colonial Village | `partb.writein.s6.on` | `"1"` / `new` | `""` / `new` | `601113841` |
| **Westwood Village 2020** | `partb.services.4` | `"1"` / `new` | `""` / `new` | `4248152120` |

**Two properties, so this clears the two-property bar and is a mechanism, not a one-off.**
Westwood Village 2020 is a different cycle, a different firm's study and a different
seed, and it reproduces the same shape.

**Every one of the six is a `partb.*` key** — equipment, fuel, services, write-in. Part B
is the equipment/utilities/services block. Nothing outside Part B appears in the
off-screen class. That is the mechanism's signature and the place to look.

The two `partb.fuel` keys are the cleanest evidence: the snapshot's source is `database`,
so the record genuinely holds `""`, while the form holds `"E"` as `new` after
*"Update property profile"* has settled — and neither cell is on screen. This is the
shape that makes the footer claim unsaved changes with nothing visible to save.

**Undiagnosed.** Per the run order no repair is written against an undiagnosed row, and
repairs are serialized on the Mac. Both seeds replay deterministically.

### The nine on-screen keys — deliberately not called real yet

All nine hold values the storm itself typed (`"$1,234"` into `appr.name`, `"1234"` into
`property.addr_city`, `"129"` into `appr.addr_street` and `partb.writein.s6`). Dirt that
is *visible* is a different and less pernicious thing than dirt that is not, and it may
be legitimate — a field the save did not cover, or a control the storm left mid-edit.

Five of them share a distinct sub-shape worth separating: Riverwood's `property.fha`,
`property.s8`, `units.0.br` and `units.0.num_units` hold **`this-cycle`** values against a
snapshot of `""` / `new`. A form holding real cycle data against an empty snapshot looks
more like the snapshot being taken before the cycle finished loading than like a failed
save. **Recorded as `undiagnosed`, not counted as app defects.**

### Storm coverage note

Northcross 2024 ran the storm and produced **zero** violations — so the storm is
discriminating, not merely reporting noise on every package.

---

## Findings — Clinton Manor (75830), 2026 - RCS

SHOULD vs FILED; no sweep record yet, so no three-way. Belfry study 25-093 and the
FY2025 executed schedule read as images before any output was opened.

**Operative rent schedule:** `Final Copies - … eff. 01.01.26 (executed).pdf` — the only
one of four carrying the CA's notification page (Lisa T. Wilkerson, SC Housing,
6 Nov 2025), a completed Part I and a handwritten Part F.

### 1 · The executed HUD-92458 was altered after the owner certified it — `team wrong`

The most serious finding in the corpus so far.

Part H bears David Pearson's DocuSign of **27 Oct 2025**, envelope
`309FFC35-DF36-441E-8260-D73440E40CE1`. The copy he signed carries:

| | 1BR | 2BR | 3BR | 4BR |
|---|--:|--:|--:|--:|
| Col.5 UA **as signed** (27 Oct) | 95 | 131 | 154 | 149 |
| Col.5 UA **as executed** | **98** | 131 | **150** | **167** |
| Col.6 gross **as signed** | 1,130 | 1,466 | 1,649 | 1,874 |
| Col.6 gross **as executed** | **1,133** | 1,466 | **1,645** | **1,892** |

The executed copy carries **the same envelope ID and the same 27 Oct signature date**.
At 400 dpi the changed figures render in a different, smaller, non-monospace face,
misaligned within their cells against the Courier of the original form fill — **an
overlay applied on 28 Oct, not a re-fill**. The owner's certification therefore attests
to figures that are not the figures on the executed form, and the CA countersigned the
altered document on 6 Nov.

### 2 · The executed allowances are supported by no workbook in the folder — `undetermined`

`Clinton Manor UA Workbook 2026.xlsx` computes `=AVERAGE('1 Bedroom Analysis'!N2:N45)`
etc. → 95.458 / 130.909 / 153.598 / 149.120, rounded to **95 / 131 / 154 / 149** — the
superseded set, dated 24 Oct. Nothing in the folder recomputes to 98/131/150/167; the
only support is the 28 Oct UA Summary Letter's assertion. A second consumption tranche
(`Clinton Manor Electric Consumption Part 2.xlsx`) is present and is consistent with a
late revision, but **the revised workbook itself is not in the corpus**.

This is the **third** instance of M2 (filed allowance unsupported by its governing
source), after Westwood Village and Lansing Manor — and the second where the unsupported
figure cannot be derived from anything in the folder at all.

### 3 · The study contradicts itself on the 2BR concluded rent — `undetermined`

HUD-92273-S8 Two-Bed grid row 46 reads **$1,325** / $1.44 psf (p.32, and identically in
the bound submission p.40 — so not a rendering artifact). The transmittal, the 2BR
reconciliation and the Conclusion all read **$1,335** / $1.45 psf. The team filed
$1,335 throughout. Left `undetermined` because the grid is the HUD form the CA reviews,
while the narrative's own logic ("adjusted range $1,334–$1,760 … reconciled at the
low-end") favours $1,335. Bounded: at $1,325 the gross would be $90,288, and the 150%
test passes either way.

**This is the second instance of M5** (Oceanport's 1BR-Small grid says $2,500 where every
summary says $2,525). Two properties — M5 now clears the mechanism bar: *the
HUD-92273-S8 grid disagrees with the study's own summary tables on one unit type.*

### 4 · The 150% SAFMR test passes by $12

$90,528 against $90,540 — a margin of 0.013% (`workbook J10 = 0.99986746`). Arithmetically
correct and it does clear. Recorded because at that margin a single rounding difference
in one bedroom type flips the result.

### Refines M1 — the FHA/HAP mislabel is 6 of 6, the typos are 2 of 6

Clinton Manor prints `SC160061005` as "FHA Project No." in six places (transmittal, all
four grid headers, Appendix 9-1-4). Read at 400 dpi, **all six are character-for-character
correct** — the mislabel is present, the digits are not wrong. And the team did **not**
propagate it: both executed schedules print `N/A` in the FHA field and put the contract
number in Part I. So M1 is better stated as *the appraiser's template mislabels the field
in every study; only sometimes does it also mistype it, and the team generally catches it.*

### Source-side, not the team's work

Study p.11 places the property in "Clinton, Laurens County, **North Carolina**". The
study disagrees with itself on bathrooms — transmittal/Conclusion/grids say 3BR/1.5BA and
4BR/2.5BA, the Improvements table says one bathroom throughout and the contents heads
both sections "One Bathroom Units".

### Unresolved

Which UA decrease notice was served (v1 27 Oct with 95/131/154/149, or v2 28 Oct with
98/131/150/167) — **no certificate of service, posting photograph or dated log exists in
the folder**. Given finding 1, which notice residents received is not a filing detail.

---

## M7 · The app has never produced a complete package — 4 of 4 driven packages

Read off the sweep records' own warnings. Every driven package ends with a package
dialog stating how many of the six documents were ready:

| package | study firm | rs tier | files | docs extracted | **package dialog** |
|---|---|---|--:|---|---|
| Colonial Village 2026 | Belfry | `text` | 5 | checklist, rentSchedule, analysisXlsx | **3 of 6 ready · 3 not ready** |
| Northcross 2024 | Belfry | `text:half` | 3 | analysisXlsx | **1 of 6 ready · 5 not ready** |
| Riverwood 2025 | Gill Group | `text:half` | 3 | analysisXlsx | **1 of 6 ready · 5 not ready** |
| Westwood Village 2020 | Federal Appraisal | `ocr` | 3 | analysisXlsx | **1 of 6 ready · 5 not ready** |

**Best case across the whole corpus so far is 3 of 6.** This is the finding the lane
exists to produce, and it is not visible from any single package.

Three separable mechanisms, each with its own property count:

### M7a · `rcsRecall` drops the study's bytes on reopen — 4 of 4, with a code location

> *"after reopening, the study is recalled without its bytes (`rcsRecall, app.js:1404`)
> — the reading is persisted but the PDF is not, so **document 04 cannot be included**
> until the file is re-attached."*

Present on **every** driven package including the one that otherwise does best. Document
04 is the RCS study itself — one of the six. So the study can never be included in a
package built after a reopen, regardless of firm, tier or anything else. The warning
names the function and line, so this is diagnosed, not merely observed.

### M7b · The study reader yields no unit types on non-Belfry studies — 2 of 4

> *"the study yielded no unit types — no values can be applied from it"* and
> *"study: `#rcsApply` never appeared — nothing was applied to the form"*

Riverwood (**Gill Group**, file `R2999R2017`) and Westwood Village 2020 (**Federal
Appraisal**). Absent on both Belfry packages. Two properties, two different non-Belfry
firms — clears the bar.

The consequence is visible in Riverwood's rows: the app emitted **no** `unit.N.proposed`
and **no** `unit.N.safmr` for any of its four unit types, where the filed workbook has
all eight. The study concluded $1,355 / $1,400 / $1,565 / $1,875 and the app carried none
of them.

### M7c · `text:half` reads only the front of the prior rent schedule — 2 of 4

> *"only the front half of the rent schedule was read — Parts F and G (ownership entity,
> principals, signatory) did not come through"*

Northcross and Riverwood, both at tier `text:half`. Colonial Village (`text`) and
Westwood 2020 (`ocr`) do not show it. **The tier of the prior-schedule read predicts how
much of the package the app can build** — `text` → 3 of 6, `text:half` and `ocr` → 1 of 6.
That is a testable prediction for the remaining 84 cycles.

---

## THREE-WAY — Riverwood (4640013), 2025 - RCS

All three legs present. SHOULD from the Gill Group study `R2999R2017` (FINAL, signed) and
the FY2024 executed schedule; OURS from the sweep; FILED read by eye.

Only 26 values were comparable, **all of them in the analysis workbook**, because the app
produced nothing else comparable (M7 above).

| # | doc · key | SHOULD | OURS | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | `unit.{0-3}.proposed` | 1,355 / 1,400 / 1,565 / 1,875 | **absent** | 1,355 / 1,400 / 1,565 / 1,875 | **app wrong** |
| 2 | `unit.{0-3}.safmr` | 1,030 / 1,030 / 1,260 / 1,780 | **absent** | 1,030 / 1,030 / 1,260 / 1,780 | **app wrong** |
| 3 | `unit.N.type` ×4 | e.g. `1 Bedroom, Family` | `1BRFamily` | `1-Bedroom,Family` | cosmetic |

**Mechanism traced:** rows 1–2 are M7b — the Gill study yielded no unit types, so there
was nothing to price. FILED is correct on every one of the eight values; SHOULD confirms
it. The app is the leg that disagrees.

Row 3 is label formatting only and is excluded as style, consistent with Colonial
Village's `2BR/1BA` vs `2BR`.

### What FILED got wrong here, independently of the app

| document | field | SHOULD | FILED | verdict |
|---|---|---|---|---|
| Executed HUD-92458 p.2 | HUD approval date | a four-digit year | **`04/24/205`** | team wrong (CA-entered) |
| Executed HUD-92458 | document assembly | one instrument | p.1 has no DocuSign header and reads `Page 1 of 2`; p.2 carries the envelope and reads `Page 2 of 3` — **a splice** | team wrong (CA) |
| HUD-92458 Part B | Dishwasher | checked (study says so three times) | unchecked, and also unchecked on FY2024 | team wrong |
| UA decrease notice (filed) | inspection address ZIP | 22443 | **30043** | team wrong |
| RCS study p.48 | secondary-type derivation | a $/sf figure | prints **`#NUM!`** twice: "dollar per square foot of #NUM! (78 SF x #NUM! = $45.24)" | team wrong (appraiser) |
| UA baseline worksheet | sample size | 20 per type per state policy | **19** and **17** — and those are exactly the two types whose allowance *decreased* | team wrong |
| CA reviewer letter | date | after the 19 Nov 2024 study | **3 Apr 2024**, seven months before it | team wrong (CA vendor) |

The `#NUM!` is notable: an unresolved Excel error survived into the FINAL study and into
the bound submission.

---

## Findings — Holly House (75564), 2025 - RCS

SHOULD vs FILED; no sweep record yet. **There is no September package** — every "9.24"
filename carries the rent *effective* date. The operative package is the 66-page
`…3.27.2025 (Executed).pdf`; the `Archive/` copies are its unsigned pre-signature
rendering, created three minutes earlier from the identical assembly.

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | UA workbook `… _ Submission` | "Current Utility Allowance" | 48 / 51 (FY2024 executed) | **46 / 49** — the **2023** figures, one cycle stale | team wrong |
| 2 | UA workbook | Contract / Project Number | NJ39E000038 | labels present, **values blank** | team wrong |
| 3 | Owner's checklist | "Scope of Work" | checked | unchecked | team wrong |
| 4 | Tenant notice | date | one date | headed **30 April**, signed **29 April** | team wrong |
| 5 | Tenant notice | column headed "RCS Increase" | an increase | holds the **new rent level** ($1,950/$2,375); the actual increase sits under "Proposed Increase" | team wrong |
| 6 | RCS study | "Subject's FHA #" | project has **no** FHA number (HAP contract says `NA`) | `NJ39E000038` on both grids and Appendix 9-1-4 | team wrong |
| 7 | RCS study | stories | one value | "three-story" vs grid `WU/2` and "2-story" | team wrong |
| 8 | RCS study p.12 | who pays in-unit electric | tenant (a UA exists) | "the property owner incurs" — contradicts its own grid and Part B | team wrong |
| 9 | Belfry impact workbook | "Gill Grids" block | — | a **2BR rent of $1,750 against 0 units** in a 42-unit property with no 2BR | team wrong |

**Item 3 is the fourth instance of M4** (Colonial Village, Westwood Village, Oceanport,
Holly House) — "Scope of Work" left unchecked though the study carries a Scope of
Assignment. Four of eight packages read.

**Item 6 refines M1 again:** mislabel present, digits clean, and the *team* handled it
correctly — the executed schedule's FHA box renders blank and Exhibit A says `N/A`.

**Not contamination** (item 9): "Gill Grids" and "Renzi" are appraiser/grid-set labels,
not property names, and the block inherits Holly House's own cells by reference. It is
incoherent residue, not another property's data — the same distinction that saved
Lansing Manor from a false finding.

**Unresolved:** why the approved UA is 40/51 where the workbook proposed 38/53. The only
candidate record is an NJHMFA `.msg` in compressed RTF, unreadable here. Four different
UA pairs circulate in this cycle (61/64, 38/53, 46/49, 40/51); the submitted package is
internally consistent, and the change came after it.

---

## Findings — Peterson Plaza (75917), 2025 - RCS

SHOULD vs FILED; no sweep record yet. Governing study is the **8 May 2025 "(updated)"**
version — and for once the folder says why: `RCS Issue Memo … 5.7.25.docx` is a
substantive review by Xandra LLC for the CA rejecting the 10 April study on one point
(Rachel Walsh signed the RCS but was absent from Certification item 9). The updated
study answers exactly that. **Concluded rents are identical between versions**, read side
by side. The bound submission carries the *original* study because it completed on
29 April, nine days before the correction — chronology, not a defect.

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | RCS study (both versions) | street address | **5969 North Ravenswood Avenue** | **"5969 West Peterson Avenue"** on cover, transmittal and site description | team wrong |
| 2 | RCS study p.19 | county / state | Cook County, **Illinois** | "Cook County, **Connecticut**" | team wrong |
| 3 | RCS study, all 5 grids | "Subject's FHA #" | **07135706** | `IL060052016` — the HAP contract number | team wrong |
| 4 | RCS study p.21 | assisted-unit count | 189 of 189 | narrative says "excluding 9 one-bedroom units" while the table above it shows 189 and 0 not-rent-restricted | team wrong |
| 5 | `RCS Analysis.xlsx` `U5`,`U6`,`U7` | proposed UA | 71 / 71 / 125 (as approved and filed) | **99 / 99 / 124** | team wrong |
| 6 | Baseline UA workbook `Summary!C3` | contract number | IL060052016 | **IL060025016** — 5 and 2 transposed | team wrong |
| 7 | Baseline UA workbook `Summary!D9:E13` | bedroom row labels | 1BR ×2, 2BR ×2, 3BR | labelled "0 / 1 / 2 / 3 / 4 Bedroom" — **off by one bedroom throughout** | team wrong |

### M1 is now *proved*, not just observed

This is the first package where the property's **real FHA number is on the record**:
`07135706`, printed under "FHA Project Number (if applicable)" on the CA's Exhibit A in
both 2021 and the 2025 approval package, alongside "Section 8 Contract Number:
IL060052016". The study's five grids print the *contract* number in the FHA field.

So M1 is no longer an inference from "these projects have no FHA number" — here the FHA
number exists, is documented, and the study prints a different number in its place.
Seven of seven packages read now carry the mislabel.

### A useful negative result — M5 does not hit everywhere

Every summary column on this study was re-added and **all of it holds**: gross renewal
potential 449,709 ✓, SAFMR gross 375,300 ✓ and ×1.5 = 562,950 ✓, per-bedroom 150%
figures ✓, net rentable 126,898 sf ✓ and 671 sf average ✓, and every grid's line 44 =
line 5 + line 43 across all 25 comparable columns ✓. **All five inequality glyphs are
`<` and all five are true.**

Circle Park's reversed glyph and Clinton Manor's grid conflict are therefore not
universal to the appraiser's template — which makes them sharper findings, not weaker
ones.

### Unresolved, and worth someone's eyes

The CA's approval letter reports the **2BR** electric average as **$70.70** — within a
cent of the owner workbook's **1BR-B** average of $70.6909 — while the owner's own 2BR
sample averaged **$98.79**. Whether the CA re-sampled or populated its 2BR column from
the 1BR-B data cannot be told from these files. **The $28 gap flows straight into the
filed Col.5 and therefore into every tenant's rent portion.** Not asserted as a defect.

Separately, the baseline workbook counts one household twice: sheet `1A` row `B-02D` and
sheet `1B` row `C-02D` carry the same twelve readings with months 1 and 2 transposed,
both averaging 62.6725 — the same unit in two different unit-type samples.

---

## THREE-WAY — Northcross Townhomes (2640001), 2024 - RCS

All three legs. 20 values comparable, **all in the workbook** (M7 again — the package
dialog said 1 of 6 ready). 12 matched.

### The verdict turns on which study is the source, and that is the finding

| key | SHOULD | OURS | FILED | verdict |
|---|--:|--:|--:|---|
| `unit.1.ua` (3BR) | **222** *or* **221** — see below | **221** | **221** | **undetermined, not app wrong** |

Three versions of the Renzi study exist, all with identical concluded rents, differing
**only** in utility allowances:

| version | date | 3BR UA | bound into the filed submission? |
|---|---|--:|---|
| v1 (Archive) | 17 May | 184 | no |
| "(updated UAs)" | **4 June** | **222** | **yes** — this is the study in the package |
| "v2 06.14.24" | 14 June | **221** | **no** — never filed |

The property's own `Northcross 2024 UAF Calculation.xls` computes **222**. The study
actually submitted to HUD prints **222**. The filed HUD-92458 prints **221**, and the CA
executed at 221 without comment.

**The app also produced 221** — because the manifest's `chosenStudy` for this cycle is
`…RCS v2 06.14.24.pdf`, the June 14 revision, which is **not the study the team bound
into its submission**.

So OURS and FILED agree exactly, and both may disagree with the document that was
actually filed. Calling this `app wrong` would be wrong: the app faithfully read the
study it was given. Calling it `team wrong` would also overreach, since a later
appraiser revision plausibly supersedes. **Recorded as `undetermined` on the value, and
as a real finding about study selection.**

### H5 · The manifest can select a study the team did not file — harness finding

`build-manifest.js` picks `chosenStudy` by rank among candidates. For Northcross it
picked the newest (14 June) when the submission demonstrably contains the 4 June version
— provable from the bound transmittal date, the bound Appendix 9-1-4 signature date
(`06/04/2024`), and the submission PDF's own creation date of 4 June, ten days before v2
existed.

**Consequence for the whole sweep:** wherever the manifest's chosen study differs from
the bound one, OURS is being generated from a source the filed package never used, and
every resulting difference is uninterpretable. The manifest already flags **17 properties**
where "the top two studies are within one rank; the choice is a coin toss". This is what
that flag costs. A cheap check — does the chosen study's certification date match the one
bound into the combined package — would catch it.

### The rest of the comparison

- **5 × `missing-theirs`**: the app emitted `property.name`, `appr.firm` and all three
  utility allowances where the filed workbook has **null**. The app produced *more* than
  the team's spreadsheet, not less. Not a defect on either side.
- **3 × `mismatch`, all unit-type labels**: `2BR/1BA` vs `2-Bedroom`, `3BR/1.5BA` vs
  `3-Bedroom`, `4BR/1.5BA` vs `4-Bedroom`. **Third package showing this** (Colonial
  Village, Riverwood, Northcross) — the app consistently uses the study's
  bedroom/bathroom convention where filed documents use the schedule's plain form. It is
  a systematic, predictable style difference, and it is excluded as style — but it will
  generate three or four rows on every package for the rest of the corpus.

### What FILED got wrong, independent of the app

| document | field | SHOULD | FILED | verdict |
|---|---|---|---|---|
| HUD-92458 Part B | all five utility boxes | **unchecked** (tenant-paid; Col.5 is nonzero) | **all five checked** | team wrong |
| Study Conclusion table p.48 | 4BR units / total | 14 / 99 | **10 / 95** — in **all three** study versions | team wrong |
| Owner's Cover Letter | owner address | 30 **Hudson** Yards | **"30 Huson Yards"** | team wrong |
| Workbook `I7`/`K7` | SAFMR totals | 178,020 / 267,030 | **144,000 / 216,000** — the formulas omit the 4BR term entirely | team wrong |
| All three grids | "Grid was prepared" checkbox | one box ticked | both render blank | team wrong |

The Part B finding is the notable one: checked means *included in rent*, yet Col.5
carries nonzero allowances, the study says the tenant bears in-unit electric and cooking,
and the grids record every utility as "not in rent". The 2023 executed schedule and the
CA's own executed copy both have them **unchecked** — so the filed copy is the outlier.
The agent checked whether it was a rendering artifact and found the checkmarks are baked
page content, not widget appearances.

The workbook formula error is a clean instance of M5's cousin: the property passed its
own internal 150% check by luck, since the correct comparison lives in the study.

---

## THREE-WAY — Westwood Village (4640009), **2020** — the BLOCKED record, resolved

Record verdict was *"the app generated no document the filed package also has."* **That is
mostly the package's shape, not a generation failure — but not entirely.**

### The 2020 filing is not a five-year RCS package at all

The VHDA permanent financing matured 1 Aug 2020 and the HAP contract terminated with it.
The owner filed a **HUD-9624 Option Two** election for a 10-year MAHRA renewal, rents set
by **OCAF** and capped at the RCS comparable potential. **The RCS is Exhibit 3 of
thirteen** — it exists only to supply that cap.

What a modern cycle has and this one does not:

| absent | why |
|---|---|
| tenant notice of the new rents | **correctly** absent — the Option Two OCAF checkbox carries no 24 CFR 245 notification clause; that appears only on the two budget-based boxes, both unchecked |
| analysis workbook | the arithmetic lives in the HUD-9625 and the HUD-9624 comparison chart |
| 150% SAFMR test | the 2020 rule was the Section 9-14 **140% median-gross-rent** comparison — and the study performed it |
| combined single-PDF submission | the only bound submission is the **superseded Option Four** request |
| owner letter as a distinct document | the cover letter is the only transmittal |

So four of the six documents the app generates have **no counterpart that could exist**
in a 2020 filing. Comparing them was never possible.

### But the explanation is not complete

**The executed rent schedule and the owner's checklist are both present**, and both are
documents the app produces. They should have matched and did not. The record's own
warnings say why: tier `ocr`, *"the study yielded no unit types"*, *"`#rcsApply` never
appeared"* — **M7b**, the Federal Appraisal study reading as nothing. So this record is
**both** a package-shape mismatch and a genuine M7b failure, and it should not be filed
away as "old package, nothing to see".

**Verdict: `undetermined` on the missing four (no counterpart exists); `app wrong` on the
rent schedule and checklist, traced to M7b.**

---

## M8 · The HUD-92458 prints thousands separators as PERIODS — 2 properties

A numeric reader that trusts the glyph reads **`43.355` as forty-three dollars**.

| property | field | renders as | means |
|---|---|---|---|
| Westwood Village 2019 & 2020 | Col.4, all five rows | `43.355` · `2.022` · `26.004` · `2.343` · `7.758` | 43,355 · 2,022 · 26,004 · 2,343 · 7,758 |
| Westwood Village 2019 | monthly total | `$80.027` | $80,027 |
| Colonial Village 2026 | Col.3 2BR, Col.4 2BR | `1.850` · `59.200` | 1,850 · 59,200 |

Two properties, four years apart, different firms — **clears the mechanism bar.** And it
is inconsistent *within one document*: Westwood's 2020 Col.4 uses periods while its own
totals use commas (`$81,482`, `$977,784`).

This is directly app-relevant in both directions: the app must not mis-read a filed
schedule this way, and `compare.js` strips `$` and `,` before comparing (`compare.js:68`)
— **but a period is neither**, so `43.355` and `43,355` would compare as different
strings while `1.850` might silently parse as a float. Worth a look on the Mac.

### What FILED got wrong in 2020, independent of the app

| document | field | SHOULD | FILED | verdict |
|---|---|---|---|---|
| Cover letter (in the live folder) | renewal option | **Option Two, 10-year** | requests **Option Four, 20-year** | team wrong |
| Cover letter | rent change | rents rise ~1.8% by OCAF | *"requesting no change to the rents"* | team wrong |
| Cover letter | exhibit citations | per its own index | **every citation from Ex.3 on is off by one** | team wrong |
| Rent schedule + HAP Exhibit A | effective date | 08/01/2020 | typed **08/02/2020**, hand-corrected by two different CA staff (`CHR`, `LS`) | team wrong |
| Rent schedule Part B | Hot Water | included (grid line 36 "Yes/Gas"; intake form circled Yes) | **unchecked** | team wrong |
| Rent schedule Part B | Dishwasher | **not** included (grid line 17 "Yes/No"; kitchen photo shows none) | **checked** | team wrong |
| Rent schedule Part I | HAP contract number | `VA36H027152` | **renders blank** | team wrong |
| Study p.3 | Median Gross Rent Threshold table | three rows, cum 113 | **4-bedroom row missing**; cum stops at 104; Total still says 113 | team wrong |
| Owner's Certification | checklist appendix cited | 9-2-1 | **9-2-2** | team wrong |
| **2019** prior executed schedule | Part F max allowable | ≥ its own Col.4 sum of $80,027 | **$78,272** — the schedule exceeds its own stated maximum by $1,755 | team wrong (source doc) |

### M1 gets worse here — it is not just a label

The executed HAP contract p.4 settles the truth: Section 8 number `VA36H027152`, FHA
Project Number `N/A`. Every owner-prepared 2020 document prints the HAP number in an
FHA-labelled field **and renders it as `VA36-HO27-152` — with a letter O in place of the
digit 0**, verified at 500–700 dpi against the digit 0 in adjacent date fields. Seven
documents carry it. The RCS study is the only owner-side document with the characters
right and the label wrong; the HUD-9624's FHA cell, left blank, is the only strictly
correct treatment in the package.

**Eight of eight packages read now carry the M1 mislabel.**

---

## Findings — Burt Farms I (75109), 2024 - Renewal & RCS

SHOULD vs FILED; no sweep record yet.

**What this filing is.** An **Option 1-A entitlement Mark-Up-To-Market renewal** on
HUD-9624, consummated on **HUD-9638**. The old contract expired 6/25/2024 and a *new*
five-year contract began 6/26/2024. So — like Westwood 2020 — a modern six-document RCS
package is only partly applicable. **Legitimately absent:** any OCAF worksheet (MUTM sets
rents at market, so no factor applies) and any scope of repair (as-is study). **Unlike**
Westwood 2020, nothing is structurally impossible: all six promised exhibits are present.

**My brief's premise was wrong and the agent inverted it.** I flagged the study (3.22.24)
as post-dating the submission (3.19.24). It does not: the grid is signed 3/4, the
transmittal is dated 3/18, and the DocuSign certificate shows the *whole package* was
executed **3/22/2024 5:05:48 PM ET**. "3.19.2024" is a nominal date typed three days
ahead of actual execution across every document. Recorded because a brief that asserts a
sequence can manufacture a finding.

### The two serious ones

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | HUD-9624 worksheet | Initial Eligibility Worksheet | present — the signed form certifies *"I have attached … and completed the 'Initial Eligibility Worksheet'"* and claims market potential *"at or above 100% of the published Fair Market Rents"* | **absent**, and **no published FMR appears anywhere in the 60 pages** — only SAFMRs | team wrong |
| 2 | HUD-9624 worksheet | debarment certification | exactly one of two mutually exclusive boxes | **both checked** — the executed form certifies the owner both is *and is not* suspended or debarred | team wrong |

Item 1 is the weightiest: **the 100%-of-FMR entitlement gate for Option 1-A is asserted
and never demonstrated.** That gate is what qualifies the project for MUTM at all.

### The rest

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 3 | RCS Scope of Assignment | effective date | March 4, **2024** (grid signed 3/4/24; comps last leased Feb–Mar 24; Conclusion says 2024) | *"as of March 4, **2023**"*, research window from 2/22/**2023** | team wrong |
| 4 | RCS narrative, Comp 5 | neighborhood adjustment | **downward** ($70 as the grid applies) | *"adjusted **upward** at 4% of the unadjusted rent"* — and 4% of $1,850 is $74; the $70 is the stale January figure from when the comp's rent was $1,700 | team wrong |
| 5 | RCS narrative | SAFMR vintage | FY2024 | *"the HUD **2023** Small Area Fair Market Rents"* for a March-2024 study supporting a 6/26/2024 effective date | undetermined |
| 6 | Threshold summary row | per-unit comparison | $1,879 < $1,890 (gross vs gross) | **`$1,825<$1,890`** — **net** rent against a **gross** threshold. Outcome holds, but the true margin is **$11/unit**, not the $65 implied | team wrong |
| 7 | Tenant notice | signature block | Burt Farms I | *"Regional Manager, **Burt Farms II**"* (900 dpi) | team wrong |
| 8 | Tenant notice | rate-table header | an increase | **`RCS Increase`** holds the new rent $1,825, beside "Proposed Increase 386" | team wrong |
| 9 | Tenant notice | submission date | executed 3/22, sent to CGI 3/22–23 | served 3/27 saying *"on March 27, 2024 we plan to submit"* | team wrong |
| 10 | Owner's checklist | "Scope of Work" | checked (RCS carries it as *Scope of Assignment*) | unchecked | team wrong |
| 11 | Grid analysis workbook `O10` | UAF | `52*1.04` (the owner's own UAF, signed three weeks earlier) | **`52*1.05`** → 54.6, carrying to a gross of 93,980 not 93,950 | team wrong |
| 12 | Cover letter | expiring-contract date | 6/25/2024 | *"terminates on June 26, 2024"* — contradicting the HUD-9624 in the same package | team wrong |

**Item 10 is the fifth instance of M4** (Colonial Village, Westwood 2025, Oceanport,
Holly House, Burt Farms I).

### M9 · The tenant notice's "RCS Increase" column holds the new rent — 3 properties

Holly House, Oceanport Gardens and Burt Farms I all print the **new contract rent** under
a header reading *"RCS Increase"*, with the actual increase in a separate column. Three
properties clears the bar. On a §245.410 resident-facing notice the header misdescribes
the number beneath it — a resident reading "RCS Increase $1,825" against a current rent
of $1,439 sees an increase four times the real one.

### Two useful negatives

- **M8 does not appear here.** Both ambiguous figures were re-rendered at **900 dpi** and
  are **commas** — `1,439` and `1,825`. The period convention is not universal, which
  makes it a per-document property a reader must detect rather than assume.
- **No post-certification alteration.** A page-by-page comparison of the executed
  60-page copy against the loose one shows **zero** value differences — only the DocuSign
  stamp. The Clinton Manor shape is not endemic.

### The two-firm bake-off, recorded not judged

Renzi (job 24-013) concluded **$1,825** on 1/23; JLL (VA-24-254936) concluded **$1,475**
on 1/26; the comparison workbook was built 1/27; Renzi was then engaged for the full RCS
on 2/21. **A $350/month spread, and the higher was retained for the study that sets the
rents.** Not a defect on this evidence — JLL's product was a restricted due-diligence
grid, not a Chapter 9 RCS — but it is the second property (with Oceanport) where two
firms were commissioned and the higher conclusion went forward.

**M1 is 9 of 9.** No letter-O substitution here; all zeros verified as digits at 400 dpi.

---

## Findings — Sycamore Green (75453), 2025 - RCS

**The governing study is not the filed study.** Four versions of Renzi job 24-406 exist
(25 Sep, 30 Oct, 3 Dec, 17 Dec 2024). **v4 governs** — its allowances ($51/$64) are the
ones on the executed schedule. **v1 is what is bound into all three submission copies**,
carrying the *prior year's* allowances ($42/$50) and a total gross renewal rent of
**$280,680** instead of $283,196. Nothing in the folder shows v2–v4 was ever re-transmitted
to CGI. Concluded rents never changed across the four ($1,200 / $1,450).

**This is the second instance of H5** (Northcross) — the version that governs and the
version that was filed are different documents.

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | Study transmittal p.3, **all four versions** | unit total | **194** | **88** | team wrong |
| 2 | Study v4 | SAFMR 1BR / 2BR | one value | transmittal `$990`/`$1,230` vs narrative `$1,050`/`$1,300` — and the study's **own addendum** (Rochester HA 2024 standards) supports neither | team wrong |
| 3 | `RCS Analysis.xlsx` `I4`/`I5` | SAFMR | 990 / 1,230 | **1050 / 1310 hardcoded**, driving a SAFMR gross of 243,740 vs 229,020 — modified the day the schedule was signed | team wrong |
| 4 | Conclusion p.40, 2BR map p.32, Comp 1 profile p.41 | 2BR unit type | **2BR/1BA** (Unit Breakdown; grid line 12 = 1) | **2BR/2BA** | team wrong |
| 5 | Study p.17 vs p.26 + grid | stories | 3-story (`WU/3`) | "**two-story**" | team wrong |
| 6 | Appendix 9-1-4 | temporary licence | v1 answers **YES** and attaches the NY temp cert (expiring 10/25/24) | v4 answers **NO** with a permanent NY licence — **re-answering a certification question about work already performed** under the temporary one | team wrong |
| 7 | Both grids | "Grid was prepared" | one box ticked | both render blank | team wrong |

M1: 9 of 9, digits clean. M8: not present — commas at 300–500 dpi.

---

## Findings — New Horizons (75474), 2024 - RCS

**JLL governs and Renzi never entered the filed package** — the inverse of Oceanport.
Proved five ways, including that the string "Renzi" appears nowhere in the 94-page bound
submission, and that Renzi's engagement letter commissions "as-is grids" only.

### The finding that matters

The team's own workbook runs both firms through the 150% threshold in parallel blocks:

| firm | gross potential | threshold | cell |
|---|--:|--:|---|
| **Renzi** | $226,242 | $205,095 | `Q19 = NO` — **over by $21,147** |
| **JLL** | $204,742 | $205,095 | `Q35 = YES` — **under by $353 (0.17%)** |

Renzi's grids would have tripped the mandatory market-rent threshold and forced HUD to
order its own appraisal. JLL's do not, by less than one 4BR unit's monthly gross rent.
The firm whose grids passed is the one whose study was filed.

An earlier workbook states JLL's proposed rents as **formulas**: `E26 = 2800+F26` with
`F26 = 225`, and the same $225 addend on all four types, the bases being JLL's own
1-26-24 conclusions. **Reported as cell contents; no conclusion about intent is drawn,
and whether the uplift preceded or followed JLL's revision is not determinable.**

**My brief pointed at the wrong prior schedule.** I designated `2023/Unexecuted RS.pdf`;
the agent found the genuinely executed one and showed the designated file carries a **$1
error** (4BR UA 140 vs 139, gross 5,425 vs 5,424) traced to a superseded UAF. Three of
five 2023 copies carry 140 — including one that is **owner-signed**. Anchoring SHOULD on
the file I named would have propagated that error into every downstream row.

**M1 breaks here, in the opposite direction.** New Horizons is **non-insured**: HUD's own
extension and the 2019 executed schedule both print "**Non-Insured**" in the FHA box. The
2024 schedule, Exhibit A and the 30-day certification leave it **blank** — a regression.
Worse, the filed JLL grids assert `Subject's FHA #: 01297260`, **a number that appears in
no HUD document in the corpus**, and JLL themselves removed it in their April revision.

Also: the operative schedule has **no text layer at all** (Print-To-PDF), so every value
had to be read as an image. M9 "RCS Increase" — **fourth instance**.

---

## Findings — North Park (75478), 2025

**Two study builds forty minutes apart differ on a fact about the subject.** v1: "does not
offer a community room". v2: "offers a community room". Grid row 27 flips `N/N` → `Y/N` on
all four grids, reversing the clubhouse adjustment on three or four comparables each and
raising **all twenty adjusted rents by exactly $10**. The rounded conclusions absorbed it.

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | Study transmittal p.3 | $ PSF 1BD / 3BD | **$7.22 / $8.38** (as its own Conclusion and grids print) | **$7.18 / $8.35** — and $8.35 is the stale value from the superseded 24-548 draft | team wrong |
| 2 | Owner's checklist | temp-licence box | unchecked (appraiser certified **NO**; no licence copy in the package) | **checked** | team wrong |
| 3 | Study p.59 vs pp.6, 68 | who inspected | Zabel only | "Zabel **and** Walsh have made personal inspections" | team wrong |
| 4 | Owner's cover letter item 8 | appraiser e-mail | `aaron@` (who signed everything) | **`neil@`** | team wrong |
| 5 | Renzi invoice | city | Manhattan | **Brooklyn**; invoice job `24-548` while the filed study is `24-625`, and no invoice for 24-625 exists | team wrong |
| 6 | 2025 schedule Col.5 | UA 94/112/123/129 | supported | **no document in the 2025 folder establishes them** (+27% to +45%, which no UAF factor produces); corroborated only downstream by the FY2026 UAF | undetermined |

**M1 gains a second proved case.** North Park **has** a real FHA number — `01297263`, on
its own executed schedules for 2016, 2021 and 2022 — blank from 2023 onward. The study
prints the *contract* number under FHA labels in four places. As with Peterson Plaza, the
FHA number exists and a different number is printed in its place.

### M8 needs a correction — printed glyph vs OCR noise

`pdftotext` on North Park's **2021** executed schedule emits `85.024`, `2.727`, `25.780`.
**That is OCR noise in a scan's own text layer, not a printed period.** Read as an image,
the glyphs are commas.

So M8 as stated was too broad. The mechanism is real where the *rendering* shows a period
(Westwood 2019/2020, Colonial Village 2026) — but a period seen in a **text layer** may be
an artefact of the scan, not the document. **Only the rendered glyph counts**, which is
exactly why the method reads images. A comparator patched to strip periods would corrupt
genuine decimals; the fix must be per-document detection, not a blanket rule.

---

## Findings — Oaks on North Plaza (75544), 2025 (RCS)

### H6 · The manifest reported four documents absent that are present — and the cause is mechanical

The manifest flags *"no filed coverLetter, submittalLetter, checklist, tenantNotice"*.
**Three of the four exist**, bound inside
`2025 (RCS)/Submission Package/…5 year option renewal of HAP contract_Signed.pdf` —
p.1 submittal letter, p.4 Appendix 9-2-1 cover letter, p.6 Appendix 9-2-2 checklist, all
signed by Ron Kowal.

**Why the walker missed them:** pages 1–7 of both signed files carry **no text layer at
all** (`pdftotext` returns empty). A text-based detector sees a 92-page PDF whose first
readable page is an RCS cover, and classifies the whole thing as a study. **Only
rendering finds the letters.**

This is a `build-manifest.js` defect with a named cause, and it is not property-specific:
any scanned submission will be mis-classified the same way. It also means **"no filed X"
in the manifest is not evidence of absence** — every such flag in the other 87 cycles is
suspect. The tenant notice here *is* genuinely absent, proved by scanning all 44 files.

### H5, third instance — and the largest gap yet

The two "coin toss" studies are **not** byte-identical (md5 `cc778ef9…` vs `bbdc28c7…`;
77 of 85 pages differ at pixel level). They are two **editions**: August 30 analyses four
unit types (16 × 1 BR); September 16 breaks the two ADA units into six rows.

Rendering all 85 bound pages against both: **85/85 identical to the August edition.**

| | supports monthly | annual |
|---|--:|--:|
| study **bound into the filed submission** (Aug 30) | $119,920 | $1,439,040 |
| **executed HUD-92458** | **$121,105** | **$1,453,260** |
| study *not* bound (Sep 16) | $121,105 ✓ | $1,453,260 ✓ |

**A $1,185/month, $14,220/year gap between the filed study and the executed schedule** —
exactly the two ADA units repriced from 1 BR to 2 BR and 3 BR. The September revision
supports the executed figure to the dollar, is dated five days after the owner signed,
and **nothing in the folder shows it was transmitted.**

**A heuristic inversion worth carrying:** here the **`Archive/` copy is the one that was
filed**. "Cycle root = operative, Archive = superseded" is backwards for this property and
would pick the wrong document.

### Other findings

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | Owner's checklist | "Owner's Signature **& Date**" | a date | signed, **date renders blank** (the facing cover letter got 09/11/2024) | team wrong |
| 2 | Study, **both editions** | 3 BR unit size | **1,044** (grid header, grid line 13, every size adjustment, and the owner's own `OONP Breakdown.xlsx`) | **1,054** in the summary and unit-mix tables — propagating to NRA 6,324 vs 6,264, total NRA 50,450 vs 50,390, average 814 vs 813, and $/SF $2.21 vs the grid's $2.23 | team wrong |
| 3 | `Rent Grid Analysis.xlsx` | SAFMR ZIP label | 78753 (Austin) | **80209 — Denver** | team wrong |
| 4 | same | firm labels | Cornerstone | `Starmark Rents` (P30), `Gill Rents` (P29) on the Cornerstone block | team wrong |
| 5 | same, `Questions` sheet | subject | Oaks on North Plaza | **Ash, Pine, The Detroit Apartments, 50 Corona, 66 Pearl, Carlisle on the Park** | team wrong |
| 6 | same `O27`/`O28` | 150% test basis | gross vs gross | **net** annual contract rent vs **gross** SAFMR — understating the subject side by the entire utility allowance | team wrong |
| 7 | Non-Shelter Service Summary | Property Name / HAP no. | Oaks on North Plaza / TX590022011 | both render blank | team wrong |

**Items 3–5 are genuine contamination, and the source is still in the folder:**
`TEMPLATE - Non-Shelter Service Summary.xlsx` carries Property Name "**The Trees**" with
Denver vendors — which is where 80209 comes from. **Second confirmed instance** after
Colonial Village, so contamination-in-a-filed-workbook clears the mechanism bar.

The same package shows why the alias rule matters: `fka North Plaza Apartments` on the
rent schedule is a **genuine alias**, and `Gill` on the left block is a **correct firm
label** (the 2019 appraiser). Neither must be normalised away.

### Two instrument notes

- **The agent caught its own false positive.** The threshold-conclusion sentence appeared
  absent from the September edition's text layer; on render it had simply moved to the
  next page. Reported as a near-miss rather than filed as a finding.
- **M8 confirmed as a text-layer artefact here.** The RCS appendix reproduces the 2024
  schedule as a scan whose OCR emits `1, 198`, `11, 190023`, `TX5900220 11`. None of it
  is in the rendering. This is the third property supporting the corrected M8: **only the
  rendered glyph counts.**

M1: `TX590022011` sits in the box labelled "FHA Project Number" on every schedule
2021–2026, and the project has **no** FHA number — Exhibit A, the appraiser's
certification and the 2026 Appendix 2 all say `N/A`, and the grids' FHA box renders blank.
Digits verified at 400 dpi.

---

## M8 RETRACTED — the period separator is probably a rendering artefact

**I asserted a mechanism that the evidence no longer supports. Recording the retraction
where the claim was made.**

M8 said the HUD-92458 prints thousands separators as periods, on the strength of Westwood
Village (`43.355`) and Colonial Village (`1.850`, `59.200`). Three later packages tested
it and **all three explain it away**:

| package | what was found |
|---|---|
| North Park | `85.024`, `2.727` appear in `pdftotext` of a **scan** — OCR noise in that scan's text layer. Rendered: commas |
| Oaks on North Plaza | `1, 198`, `11, 190023`, `TX5900220 11` from a scanned appendix — same artefact class |
| **Hampshire House** | at **150 dpi** the figures render as `164.995`, `180.000`, `2.073`; at **400 dpi** they resolve to commas; at **1200 dpi** the `1,368` glyph shows an **unmistakable descending comma tail** |

The Hampshire House result is the decisive one, because it is not an OCR artefact — **it
is the rendering itself**. Low-DPI rasterisation thins a comma's tail until it reads as a
period. The agent also noted the scanned 2019/2021 schedules show the same thinning, and
that those documents' own arithmetic only works on a comma reading.

**Consequence:** the two instances M8 rested on were never re-checked at high DPI, so
**M8 is withdrawn pending re-verification of Westwood Village and Colonial Village at
1200 dpi.** It should not be treated as a mechanism, and no comparator change should be
made for it.

The methodological lesson is worth more than the retracted finding: **a glyph read at
150–200 dpi is not evidence.** Several findings in this ledger were confirmed at 300–400
dpi, which Hampshire House shows can still be too low for comma-versus-period. Digit
identity (letter O vs zero) held up at 400 dpi; separator identity apparently needs more.

---

## Findings — Hampshire House (75495), 2024 - RCS

### The substantive defect: a unit disappeared from the executed federal form

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | HUD-92458 eff. 10.1.24 | Col.1 rows | a `Non-Revenue 2 BR` row, 1 unit | **row absent** | team wrong |
| 2 | same | Total Units | **116** | **115** | team wrong |

All four prior executed schedules (2019, 2021, 2022, 2023) carry the Non-Revenue row and
`Total Units 116`, several distinguishing "Section 8 Units 115" separately. Col.1's own
printed instruction reads *"(Include Non-revenue Producing Units)"*. The 116th unit has
not gone away — the 2023 OCAF worksheet still states 116 total / 115 Section 8 — but on
the 2024 form it is recorded **nowhere**, Part D being empty with `$0` rent loss. **The
error is inherited by 2025 and 2026.**

Defensible reading: 115 is the *contract* unit count, Exhibit A correctly says 115, and
the CA countersigned. But the 92458's Total Units cell and Exhibit A's contract count are
different quantities, and 2019–2023 kept them distinct. Recorded as a value discrepancy.

### The prior-schedule trap, located precisely

An executed 2023 schedule **does** exist. The designated file shares its DocuSign envelope
and owner-signature date but has a blank Part I — it is the owner-executed,
not-yet-countersigned copy. The difference is **Part F: `$154,030` designated vs
`$164,995` executed**, hand-entered and initialled `NM` by the CA coordinator.

`$154,030` is **the 2021 Monthly Contract Rent Potential** — a value stale by two cycles.
Anchoring SHOULD on the designated file would have set the prior-year maximum $10,965/month
low. (I checked the utility allowances specifically for the New Horizons $1-class error at
1200 dpi: there is none. Part F and Part I are the *only* differences.)

### Post-certification alteration — present here, and LEGITIMATE

The 2023 executed schedule shares the signed copy's envelope and date yet its Part F
differs. **Part F is captioned "(to be completed by HUD or lender)"** — the CA filling it
in after owner certification is proper, not tampering.

**This sharpens the Clinton Manor finding rather than weakening it.** There the altered
fields were **Col.5 and Col.6**, which the owner certifies — not Part F, which HUD owns.
A comparison that flags any same-envelope difference would call this legitimate case a
defect; the discriminator is *which field* moved.

### Two firms — and here both passed

Unlike New Horizons. Verbatim result cells: **Renzi `Q19 = 'YES'`** (248,465 vs 270,375)
and **Gill `Q35 = 'YES'`** (182,715 vs 270,375). Both clear.

The workbook states the gap itself: `L37 Renzi 2,880,000`, `L38 Gill 2,091,000`,
`L40 Delta ($) −789,000` — **$789,000 a year, $65,750 a month**, and the higher was
retained. Reported as fact; no conclusion about intent. Gill's grids were **never
finalised**: the signature block renders an `IN PROGRESS` stamp and the FHA field renders
the template placeholder `Insert Text`. Only Renzi produced a signed, complete RCS.

### Other findings

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 3 | Loose `Exhibit 5 - UAF Letter 2024.pdf` | contract number | `NJ390030010` | **`NJ90030010`** — a digit dropped — and unsigned | team wrong |
| 4 | UAF letter, **both** copies | printed calculations | `68 × 1.033 = 70.244`; `83 × 1.033 = 85.739` | **`= 70.21`; `= 85.70`** — the products of 1.0325, not the stated 1.033 | team wrong |
| 5 | Both grids, both study versions | "Subject's FHA #" | no FHA number exists | `NJ390030010` | team wrong |
| 6 | RCS gross renewal potential | reconciliation to the executed schedule | $248,795 | **$248,450** — the CA applied a **gas** UAF of 1.312 that the owner's letter, treating the whole allowance as electric, did not | undetermined |

**Loose vs bound ran three times here and would have produced three false findings** —
loose Exhibits 1, 2 and 5 all render unsigned; all three are properly signed in the bound
copy. The package is clean; the drafts left beside it are not.

**Study selection:** `24-076` (5 June) is bound and governs; `24-259R` (6 Aug) is a
post-submission refresh. **Conclusions are identical** — every comparable was re-surveyed
and four rents moved, but both reach $2,000 / $2,400. Which study the CA held at approval
is undetermined; its letter cites no job number.

M1: 10 of 10.

---

## M10 · The owner's workbook derives the RCS rent as an earlier conclusion plus a flat addend — 2 properties

Recorded as cell contents. **No conclusion is drawn about intent, and none should be read
into this entry.**

| property | workbook cells | earlier study concluded | later study concluded | approved |
|---|---|--:|--:|--:|
| **New Horizons** 2024 | `E26 = 2800+F26`, `F26 = 225`; same $225 addend on all four unit types | JLL 26 Jan: 2,800 / 3,800 / 4,100 / 5,300 | JLL 26 Mar: 3,150 / 4,000 / 4,350 / 5,450 | JLL's |
| **Woodbury Oakwood** 2026 | `E10 = 1800+Z10`, `E11 = 1975+Z11`, `Z10 = Z11 = 100`, under column headers **"Orig"** and **"Adder"** | Belfry 12 Mar: **1,800 / 1,975** | Belfry 9 Apr: **1,900 / 2,075** | **1,900 / 2,075, at 100% of the owner's RCS** |

Two properties, two appraisal firms, two years — **clears the two-property bar.**

In Woodbury Oakwood the arithmetic is exact in both directions: the "Orig" values are
precisely the March study's conclusions, and `Orig + Adder` is precisely the April study's.
The owner's own workbook records the post-March increase as a **flat additive nudge**
rather than as an appraisal conclusion, and those are the rents NJHMFA approved at 100%.

What is **not** established: the ordering. Whether the workbook anticipated the revision or
recorded it afterwards cannot be told from these files, in either property. That question
needs someone who can ask the appraiser and the asset manager.

---

## Findings — Woodbury Oakwood / Lakeside (75488), 2026 - RCS

### The Fairview Homes documents — a foreign document, not embedded contamination

`Exhibit 1 - RCS Owner Cover Letter **Fairview Homes** 05.07.25.pdf` is **wholly Fairview
Homes' document**: addressee *Fairview Homes Preservation, L.P.*, Re line *Fairview Homes
(NJ390013022)*, dated *April 4 2025*, naming a different owner representative, and
**unsigned**. Fairview Homes is a separate property (75920, Newark). This is **not** the
alias problem — Woodbury Oakwood / Lakeside Apartments are genuinely one property and the
bound Exhibit 1 mixes those two names correctly.

**It was not filed.** The bound 63-page executed submission carries the correct Lakeside
letter at pp.4–5. Exposure is contained.

**But it is one of five Fairview files in the folder, and two are unmarked** — this cover
letter and `Exhibit 4 - Evidence of Debt Service - **Fairview Homes** Berkadia Mortgage
Statement March 2025.pdf`, a statement for Fairview's loan 991063295 sitting beside the
real Exhibit 4 (Wells Fargo, Woodbury Oakwood). Three others carry an `x` prefix marking
them as templates. **The package was built by copying Fairview's and the sources were left
behind, two of them indistinguishable by filename from live exhibits.** Given that one
property in this corpus *did* file another's rent grids, this is the near-miss version of
that failure.

### The CA refused the study twice, and approved a version still carrying the defect

| date | event |
|---|---|
| 20 Apr 2026 | NJHMFA reviewer: *"the reviewer cannot accept this RCS"* — building age, laundry photos, comparable ages |
| 4 May | revised — ages harmonised to 1943, **but both grids left with no Effective Rent, no Adjusted Rent, no Estimated Market Rent** |
| 6 May | second review: *"the grids on Page 19 and 27 are not complete. The reviewer cannot accept this report"* |
| 12 May | revised again — working grids restored, **and the grids revert to Year Built 1960** |
| **15 May** | **NJHMFA approves at 100% of the owner's RCS** |

The April 20 review said in terms: *"Page 12 says the building was constructed in 1930
while all of the grids state 1960. Please clarify."* **The approved study still states 1943
in the Improvements section and 1960 in both grids.** Its Chronological Age prints **66
years** against a stated 1943 — 66 is the age belonging to 1960, so the year was edited and
the age was not. The bound April copy is worse: 1930, 1960 and 1960 in one report.

### Other findings

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | Both grids, bound **and** governing | "Grid was prepared" | one box ticked | **both render blank on the 2BR grid** (the 1BR grid has one ticked) | team wrong |
| 2 | Bound transmittal | HAP clause cite | §6b(2)(b) | **"Section 6(2b)"** — and the superseded draft's "Section 6b (2)" was closer, so it *degraded* | team wrong |
| 3 | Checklist | "Scope of Work" / licence copy | checked / unchecked | unchecked / **checked** (certification says temporary licence = N) | team wrong |
| 4 | UAF letter | date | a full date | **"March 23rd"** — no year, on a copy executed under the submission's own envelope | team wrong |
| 5 | Live `Submission/` folder | UAF copy | the signed one | the **unsigned** copy is live; the signed one is in `archive/` | team wrong |
| 6 | **CA reviewer letters ×2** | contract number | `NJ39H085097` | **`NJ39H`O`85097`** — letter O, confirmed at 500 dpi against the digit 0 later in the same string | team wrong (CA) |
| 7 | same | address / county / appraiser | 231 N Evergreen, Gloucester, Zabel | **731** N Evergreen, "Glouster", "Zabek" | team wrong (CA) |
| 8 | CA letter 4/20 | "Current Utility Allowances" | $48 / $96 | **$53 / $106** — the *proposed* values | team wrong (CA) |

**#6 is the first confirmed letter-O since Westwood Village** — and it is in the contract
administrator's own documents, not the owner's.

### Instrument notes

- **M8 negative again.** Checked at 500 dpi on both 2026 schedules: the separator carries a
  descender tail — comma, not period. Consistent with the retraction above.
- **Post-certification alteration: none.** Archive draft and executed schedule share an
  envelope; only Part F, Part I and Part C "N/A" strokes differ — all HUD-owned fields.
  The agent noted pixel-diffing was **uninformative** here (different rendering pipelines
  differ everywhere) and settled it by reading values off both renderings instead.
- **"R" is not a version marker.** The five study versions run `26-029`, `26-029R`,
  `26-029R`, `26-029`, `26-029R` in date order. Only the transmittal date orders them.

**Study selection:** version 3 (9 Apr) is bound; version 5 (12 May) governs the approval.
**Conclusions are identical** across versions 2–5, so the H5 pattern is present
structurally but **harmless on the numbers here** — unlike Sycamore Green and Oaks, where
it moved money. Version 2 was flagged "(WRONG UAs)" in its own filename and correctly
excluded.

M1: 11 of 11.

---

## Findings — Noble Tower (75543), 2024 - RCS

**SHOULD/FILED only — no sweep record.** Not a three-way; the app has never driven this
package. Read against the sources; nothing here is an app claim.

### The tightest margin in the corpus — and the record understates it 13-fold

The study concludes **$3,265**. Against the SAFMR the study itself prints (**$2,180**),
150% is $3,270 — **$5/unit/month of clearance, 0.153%**. Against the SAFMR the owner's
workbook carries (**$2,220**), 150% is $3,330 and clearance is $65/unit — **$975/month**
across the units, thirteen times what the study's own arithmetic shows.

Two SAFMRs for one property in one package, and the smaller one is the one printed. The
reconciliation above is **mine, not the agent's** — it is arithmetic over the four reported
figures and is consistent with all of them, but which SAFMR is *correct* was not settled
from the source and is open. Whichever it is, this package clears the cap by a margin
narrower than any other in the corpus, and a $5 error in either direction flips it.

### The workbook is an appraiser-shopping record — and the folder tree corroborates it

The 2024 Rent Grid Analysis workbook carries four conclusions: **Renzi $3,450 · VHA $3,265
· HCVA $3,100 · Novogradac $2,450**. The filed study concludes the second.

Verified independently against the folder, which names all four:

| appraiser | artefact in the folder | quote |
|---|---|---|
| Renzi | `RCS/Invoices/Renzi - … INVOICE.pdf` | $3,450 |
| VanHazinga | `Archive/VanHazinga - Noble Tower - Proposal.pdf` | $3,265 |
| HCVA | `Archive/HCVA - … RCS Proposal.pdf` (+ a Consulting Proposal) | $3,100 |
| Novogradac | `RCS/Grids/Novo - Noble Tower Preliminary Grids.pdf` | $2,450 |

**Open, not a finding:** the only *invoice* in the folder is Renzi's, but the conclusion
filed is VHA's. Nobody has read the invoice. Do not infer who was paid for what.

Four appraisers priced this property and the spread is **$1,000/unit/month** — 41% of the
lowest. No intent is claimed. But the range is the reason the $5 margin above matters:
the conclusion is not a measurement with a $5 tolerance.

### Contamination is *inside the filed study*, not beside it

Unlike Woodbury Oakwood (where the foreign documents sat in the folder and were not filed),
here the foreign text is bound into the governing document:

| # | where | prints | should be | verdict |
|--:|---|---|---|---|
| 1 | Unit Summary subtitle | **"Hostmark of Village Cove, Poulsbo, WA"** | Noble Tower, Oakland, CA | team wrong |
| 2 | running header | **"Raymond J. Lord Manor"** | Noble Tower | team wrong |
| 3 | both grids | **`CH39H113049`** | `CA39H113049` | team wrong |
| 4 | `Archive/Noble Tower - Option 1 Submission Package.pdf` | the **HUD Chapter Nine guide** | a submission package | team wrong |

**#1 is not random.** `RCS/Archive/Hostmark - Wellness Program Analysis - A20240605.pdf`
and `2024 - RCS/Noble Tower - Wellness Program Analysis - A20240605.pdf` are the **same
date-coded document under two property names**, and two Hostmark newsletter mock-ups sit
beside it. The template-reuse mechanism that produced the subtitle is visible in the file
tree — this is the same class as Woodbury's Fairview files, one step further along: the
copy was made, and this time the source name reached the filed page.

**#3 is a new glyph class.** `CH` for `CA` is not the letter-O/digit-0 confusion (Westwood,
Woodbury) — it is a wrong letter, on both grids, in the contract number that identifies the
HAP contract. A real FHA number (`121-98056`) does exist on the 2018 schedule, so the
package is not short of correct identifiers; this one was typed wrong and copied.

### Study selection — H5 present, harmless on the numbers

Two revisions: `Archive/… - A20240802 Final.pdf` (92pp) and the live
`Noble Tower, Oakland, CA - RCS.pdf` (91pp). **Both conclude $3,265.** The manifest ranks
the **Archive** copy above the live one (rank 5.00 vs 4.00) — H5 would fire here and pick a
study out of `Archive/`. As at Woodbury, identical conclusions make it harmless *on the
numbers*; it is still the wrong selection rule. H5 stands at 3 properties (Northcross,
Sycamore Green, Oaks moved money; Woodbury and Noble Tower are structural only).

### M8 — a 400 dpi observation, logged against the retraction, NOT reviving it

Period separators were read on the **2018** schedule at 400 dpi, **mixed with commas on the
same page**. Mixed glyphs on one page are not what a uniform rendering artefact produces,
so this is worth keeping. It is **not** evidence for M8: 400 dpi is precisely the resolution
that produced the original wrong claim, and Hampshire House only resolved at 1200 dpi.

**M8 stays retracted.** Anyone reviving it owes a 1200 dpi read of this page — and the fact
that this schedule is *2018*, six years before the cycle under audit and from a different
producer, means even a confirmed period here would not carry to the filed 2024 documents.

### Ledger position

M1: 11 of 11 (unchanged — no new alias evidence).

---

## H7 · Four properties are in the corpus twice, and the manifest counts both — harness finding

**⚠ ACTION FOR THE MAC LANE, not for the container.** The sweep is driven off
`corpus.json`. Four packages in it are duplicates. Left alone, the Mac will drive each of
them **twice** — spending the scarce leg on work already done, and writing **two**
`ZZ-CORPUS-*` properties into Matt's live account per duplicated package instead of one.
Two of the four have already been swept once.

### What is on disk

46 top-level folders in `/root/corpus`: **34 coded** (`NNNNN - Name - Section 8`) and
**12 uncoded** (`Name - Section 8`). Four of the twelve are twins of a coded folder:

| uncoded folder | coded twin | size | tree diff | already swept as |
|---|---|--:|---|---|
| `Colonial Village - Section 8` | `75708 - …` | 22 MB / 22 MB | 1 file — an Excel `~$` lock | **coded**, `75708__2026__RCS_.json` |
| `Riverwood - Section 8` | `4640013 - …` | 126 MB / 126 MB | **none** | **coded**, `4640013__2025_-_RCS.json` |
| `Lansing Manor - Section 8` | `75500 - …` | 80 MB / 80 MB | 1 file — an Excel `~$` lock | not yet |
| `Fairview Homes - Section 8` | `75920 - …` | 124 MB / 124 MB | **none** | not yet |

The only differences are `~$…xlsx` files — Excel's *workbook-is-currently-open* markers.
Content is the same: `./2017/FY 2017 -RS.pdf` under both Riverwood folders is **byte-identical
by `cmp`**.

**So the corpus holds 42 distinct properties, not 46.** Every count derived from the
manifest — properties, cycles, auditable cycles — is inflated by these four.

### What this does and does not affect

- **Verdicts already reached are safe.** Colonial Village and Riverwood were swept from
  the coded folder, and the twins are byte-identical, so nothing read from either copy
  could differ. The three-way verdicts stand.
- **Cost and exposure are real.** Two duplicated packages are still queued. Driving them
  buys nothing and doubles the live-account cleanup surface for those properties.

### Settled — Drive really holds two folders. Not an rclone artifact, not a shortcut.

The obvious innocent explanation was a Drive **shortcut** that `rclone copy` expanded into
a second real directory. It is not that:

```
rclone lsd gd:                        -> 46 directories
rclone lsd gd: --drive-skip-shortcuts -> 46 directories   (all 8 twin folders survive)
```

A shortcut would vanish from the second listing. None did. **The PM team's Drive holds two
independent, byte-identical directories for each of these four properties.**

The Drive mtimes say when it happened, and they fall into two clean populations:

| population | count | mtime |
|---|--:|---|
| **all 34 coded folders** | 34 | `2026-07-28 23:54:24`–`:26` — a **3-second batch** |
| **all 12 uncoded folders** | 12 | individually spaced, `07-27 22:30` → `07-28 02:47` |

Thirty-four folders acquiring a code prefix within three seconds is a bulk **rename**
(Drive stamps a folder's mtime on rename without touching ~4 GB of contents). The twelve
uncoded ones were touched one at a time over the preceding ~4½ hours. So the corpus was
caught **mid-migration**: someone is adding `NNNNN - ` prefixes, and for four properties
the coded folder now exists *alongside* the uncoded original rather than replacing it.

**What the mtimes cannot settle** is why those four survived the rename — copied before it,
skipped by it, or restored after. That is a question for whoever ran the migration, and it
does not change the operational answer: dedupe before sweeping.

**The fix is one line of manifest hygiene** — drop an uncoded folder when a coded folder of
the same name exists. Not applied here: `corpus.json` is the file the Mac is iterating, and
mutating it mid-sweep is the kind of change that belongs on the machine doing the driving.

### The eight uncoded-only properties are NOT duplicates

`Cherry Garden`, `Crossroads of East Ravenswood`, `Gates Manor`, `Golden Link Manor`,
`Manhattan Plaza`, `Southport Mews`, `Village Court`, `Woodland Towers` have no coded twin.
They are real properties whose folders were never given a code prefix, and **none has been
read**. Crossroads is in the current reading wave. Their contract/FHA numbers, read out of
the documents, are the only identifiers they have — which makes them the packages where the
alias problem (M1) is most likely to be invisible from the folder name alone.

---

## Findings — Friendship Court (75831), 2026 - RCS

**SHOULD/FILED only — no sweep record.**

### The margin, and a per-unit-type failure the aggregate absorbs

Study and owner's workbook use the **same** SAFMRs (FY2025, ZIP 29625) — 840 / 1,010 /
1,280 / 1,690, SAFMR gross $92,040/mo, cap **$138,060/mo**. **No SAFMR disagreement — the
first clean negative on the pattern Noble Tower failed.**

Three gross figures exist because three UA sets are in play, and all three clear the cap by
under 3.2%:

| source | UA set | gross | headroom |
|---|---|--:|--:|
| study | 61/85/100/107 | $133,744 | $4,316/mo · $53.95/unit · **3.13%** |
| owner workbook | 66.02/82.07/108.91/124.47 | $134,197.56 | $3,862.44/mo · $48.28/unit · **2.80%** |
| executed schedule | 65/83/105/118 | $134,028 | $4,032/mo · $50.40/unit · **2.92%** |

**The 1BR fails the test on its own**: $1,375 against a 150% SAFMR of $1,260 — over by
**$115/unit/mo, 163.7% of SAFMR**. The aggregate test is the binding one and the study
discloses the overage on its own summary, so this is disclosure, not violation. Recorded
because it is the first per-unit-type failure read in this corpus and the app will have to
decide whether to surface it.

### The threshold result is printed backwards — in every revision, including the bound one

The study transmittal's threshold line is labelled *"RCS GROSS RENT **<** SAFMR GROSS
RENT"* and then prints:

> `$133,744 > $138,060`

$133,744 is **less** than $138,060. The mandatory 150% threshold statement — the one
sentence in the package that says whether the property passes — **states its own result
inverted**, and does so in all three revisions and in the executed submission.

Verified at **1200 dpi** on a cropped region (bbox from `pdftotext -bbox-layout`, p.3,
x 397–499pt, y 524–535pt). The character is unambiguously `>`. This is not the glyph class;
the arithmetic beside it is right and the label above it is right. Only the operator is wrong.

### Study selection — three revisions, one conclusion, and a rejection in the middle

| file | transmittal / cert | concluded 1/2/3/4BR |
|---|---|---|
| `4 - 25-094 …SC.pdf` (66pp) | 7 Aug 2025 | 1375 / 1500 / 1675 / 1925 |
| `25-094 … (updated) v1.pdf` (67pp) | 30 Oct 2025 | identical |
| `25-094 … (updated) v2.pdf` (67pp) | 31 Oct 2025 | identical |

Conclusions never move. v1 answered both CA revision comments; v2 differs from v1 only by
date, a second contact, and the cert date. Filename order happens to match transmittal
order here — which it does not elsewhere in this corpus.

**FILED:** the executed submission (Docusign `6DF61C18…`, completed 22 Oct 2025, 76pp)
binds the **7 Aug** study. **GOVERNS: undetermined**, and that is the finding — see M11.

### Defects

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | study transmittal p.2, **all 3 revisions + the bound one** | threshold statement | `$133,744 < $138,060` | **`>`** — the result inverted | team wrong |
| 2 | submission package | study bound | one the CA accepted | the 7 Aug study, **rejected 28 Oct 2025**; no re-submission in the folder | open — see M11 |
| 3 | cover letter + submittal letter (live folder) | date / signature | 21 Oct 2025, signed | 13 Oct 2025, **unsigned drafts** | team wrong |
| 4 | owner's RCS checklist (live folder) | owner signature | signed 21 Oct 2025 | blank — **yet "Signed Owner's Checklist" is ticked** | cosmetic |
| 5 | UA workbook `Summary!C3` | contract number | `SC16-M000-048` | `SC16-M`**OOO**`-048` — three letter-O | team wrong |
| 6 | UA Summary vs schedule col. 5 | utility allowances | 66/82/109/124 (the only support in the folder) | 65/83/105/118 | open |
| 7 | UA-decrease tenant notice (27 Jan 2026) | 2BR UA effective date | ≥30 days after service, per the notice's own text | **$83 effective 1 Jan 2026 — 26 days before the notice** | team wrong |
| 8 | `RCS Analysis.xlsx` K2 | SAFMR column header | "SAFMR for 29625" | "SAFMR for **29325**" (values are 29625's) | cosmetic |
| 9 | same, col. D | "Size" | 622 / 822 / 984 / 1170 | blank, all four rows | cosmetic |
| 10 | UA Summary vs UA-decrease letter | column header | "Proposed UA" | letter body says proposed, its table header says **"Approved UA"** | cosmetic |
| 11 | transmittal + all 4 grids | FHA project number | **N/A** — no FHA-insured mortgage | "[FHA Project No. SC16M000048]" — the *Section 8 contract* number | cosmetic |
| 12 | CA substantive review, App. 9-5-2 §1 | "appraiser conducted a physical inspection" | Yes (cert: personal inspection; reviewer's own comment: "The subject was inspected") | **No** | cosmetic (CA) |
| 13 | CA Notification 29 Jan 2026 | project location | 719 W. **Mauldin** St. | 719 W. **Maudlin** St. | cosmetic (CA) |

**#5 is the third letter-O property** (Westwood Village, Woodbury Oakwood, now Friendship
Court) — but it is confined to an internal workbook. Every filed identifier is clean:
`SC16M000048` ×5 per study, ×6 in the package, ×4 in the review, all digits.

**#6 is a negative result worth as much as a positive one.** Three reconstructions of
65/83/105/118 were attempted from the supporting workbook — all-unit average, 12-full-month
units only, and the Dec-2024→Aug-2025 window the Duke data file's name implies. **None
reproduces the filed figures.** The calculation that produced the utility allowances in the
executed rent schedule is not in the folder.

### Patterns explicitly ABSENT

Foreign-document contamination: **none** — every property name in every document is
Friendship Court or a named comparable (only trace is Word metadata, `Title: April 14, 2008
/ Author: Mark Burgess`, invisible on page). Glyph substitution in *filed* identifiers:
**none**. Incomplete grids: **none** — all four carry Effective Rent, Adjusted Rent,
Estimated Market Rent, a 7/16/2025 signature and a ticked "prepared using HUD's Excel form".
Year-built/age contradiction: **none** (1972, renovated 2021, age 53 — consistent).
UA current/proposed swap: **none**. Rent-schedule arithmetic: **clean**. Prior-cycle
citation: **none** — the tenant notice's current rents trace exactly to the 2025 schedule,
so `../2018/` was not needed.

### Instrument notes

- **`Final Copies…eff. 01.01.26.pdf` has no text layer** (3 bytes from `pdftotext`). Read as
  raster at 200 dpi. The **tenant notice's rent table is an image** inside an otherwise
  text-bearing PDF — `pdftotext` returns the prose with a gap where the table is. Do not
  read that gap as a missing table.
- **Checklist and cert pages are flattened.** `getForm()` returns 0 fields on the checklist
  and 1 (envelope ID) on the signed schedule. Rasterise; do not trust AcroForm here. The
  Docusign-flattened rent schedule is the exception — its values *are* in the text layer.
- **Undetermined:** whether v2 was ever transmitted, and which revision the 29 Jan 2026
  approval rests on. Nothing exists in the tree between 31 Oct 2025 and 26 Jan 2026.

### An XLSX parser trap — checked against our own readers, which do NOT have it

The reader's first pass mis-read the workbook: a regex shaped
`<c([^>]*)>(.*?)</c>|<c([^>]*)/>` associates a self-closing `<c r="D3"/>` with the *next*
cell's body and shifts every value one column left. It reported current rents in the "Size"
column until the raw `sheet1.xml` settled it.

**Our tooling is clean, verified:**

- `corpus/extract.js:596` puts the self-closing branch **first** —
  `/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g` — and binds every value to an
  explicit captured `r=` reference, so a column shift is not expressible.
- `xlsx.js:52` `setCell` orders the alternation the same correct way.
- `xlsx.js:95` **is** sloppy: `<c\b[^>]*>[\s\S]*?<\/c>` matches a self-closing cell (`[^>]*`
  eats `r="D3"/`) and then runs to the next `</c>`, merging them. It is **inert** — the lazy
  match means a blob is always *n* self-closing cells plus exactly one real cell, and the
  operation performed (drop `<v>` where `<f>` is present, then a non-global `t=` strip that
  cannot cross a `>` and so lands on the real tag) gives the same result merged or not.
  Recorded because it is fragile, not because it is currently wrong.

---

## M8 · CLOSED — the period separator is a clip-box artefact, and the mechanism is now named

M8 was asserted, then **retracted** as "probably a rendering artefact" (Hampshire House,
1200 dpi). Crossroads of East Ravenswood settles it. The cause is not resolution at all:

> The fillable source's widget appearance streams read **`(57,660) Tj`** and
> **`(152,130) Tj`** — the character in the PDF *is* a comma. Those fields carry a clip box
> of `1 1 53 7 re` with a baseline of `Td y=1.161`. **The clip box shears the comma's
> descender off.** Fields 26 and 34 on the same form use `… 8 re` at `y=1.661` and keep it.

So a HUD-92458 prints commas and *clips some of them into periods*, per-field, on the same
page — which is exactly the mixed comma/period pattern reported at Noble Tower, North Park,
the Oaks and Hampshire House and never explained.

**Consequences, all of them binding on later readers:**

1. **M8 is closed as a document defect and re-opened as an instrument artefact.** No filed
   HUD-92458 in this corpus has been shown to print a period as a thousands separator.
2. **Raster reading cannot settle this question at any resolution.** Newberry Arms is the
   proof: at **1200 dpi** two values read as periods and two as commas; re-rendered at
   **2400 dpi** all four are commas with visible descenders. The 1200 dpi rule this ledger
   adopted after the retraction was *still not enough*.
3. **The correct instrument is `/AP`.** Read the widget appearance stream, not pixels. Where
   the copy is flattened (Docusign), read the unsigned twin's widgets and verify they match.
4. **Do not re-report this.** Three separate readers have now spent effort on it.

---

## Findings — Newberry Arms (75832), 2026 - RCS

**SHOULD/FILED only — no sweep record.** Same appraiser (Zabel), same CA (SC Housing) and
an adjacent property code to Friendship Court above. Read in the same wave; the cross-link
turned out to matter.

### $5.10 per unit per month

Study and workbook agree on SAFMRs (FY2025, ZIP 29108: 780 / 1,020 / 1,230 / 1,350, carried
as live `=780*1.5` formulas in the workbook) — **no divergence**. 150% gross = $96,120/mo.

| | UA set | gross | headroom |
|---|---|--:|--:|
| **filed** (7 Aug study) | 2025: 84/127/142/158 | $95,460 | $660/mo · $11.00/unit · **99.31%** of cap |
| **governing** (11 Nov study, workbook, executed 92458) | 2026: 88/141/144/147 | $95,814 | **$306/mo · $3,672/yr · $5.10/unit · 99.68%** of cap |

**Raising the 3BR conclusion by $17 would breach the cap.** And the **1BR conclusion
$1,175 already exceeds its own 150% SAFMR of $1,170** — the study discloses it and relies
on the gross test, exactly as Friendship Court does. See M13.

### Friendship Court's renovation budget is bound into Newberry Arms' governing study

Page 73 of the **November revision** carries *"Friendship Court – Proposed Scope/Budget",
80 units, $4,775,000*. Page 14 then computes Newberry Arms' renovation cost as
*"$59,687.50/unit or $4,775,000"* — **$4,775,000 ÷ 80**. Newberry Arms has **60 units**.

This is not a stray file and not a running header. **A foreign property's budget was bound
in as an addendum and a per-unit figure was derived from it**, and it is in the revision
whose allowances the CA's 18 Nov Notification adopts. The *filed* 78-page submission is
clean — "Friendship" appears zero times in it — so the contamination is confined to the
document that governs rather than the one that was filed.

### Study selection

| file | transmittal | grids dated | conclusions | gross |
|---|---|---|---|--:|
| `4 - 25-095 …pdf` (68pp) | **7 Aug 2025** | 7/16/2025 | 1,175 / 1,375 / 1,650 / 1,850 | $95,460 |
| `25-095R … (updated).pdf` (76pp) | **11 Nov 2025** | 7/16/2025 | identical | $95,814 |

**FILED:** the 7 Aug study, bound as Exhibit C at pp.9–76 of the executed submission
(Docusign `6DF61C18…`, 21 Oct 2025). **GOVERNS:** the 11 Nov revision — its allowances are
the ones on the CA Notification executed 18 Nov 2025. Concluded rents are identical; only
allowances and adjusted rents moved. **No CA review or refusal letter is in the folder**,
so the revision's scope is the only evidence of what was objected to.

### Defects

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | filed 8/7 study | owner's gross renewal calc | 2026 UAs → $95,814 (what the package adopts) | 2025 UAs → $95,460 | team wrong |
| 2 | **revision p.73** | renovation scope addendum | Newberry Arms, 60 units | **Friendship Court, 80 units, $4,775,000** | team wrong |
| 3 | **revision p.14** | renovation cost/unit | consistent with 60 units | `$59,687.50/unit` = the foreign 80-unit divisor | team wrong |
| 4 | revision, all 4 grids | grid date | on/after 11/11/2025 | 7/16/2025 — though rows 41/43/44/45 changed in every grid | team wrong |
| 5 | both studies | appraiser's certification | signed **and dated** | signed by Zabel and Walsh, **undated** | team wrong |
| 6 | revision | revision identification | a transmittal saying it supersedes 8/7 | none; Job No. still `25-095`; **only the filename says "R"** | team wrong |
| 7 | filed 8/7 study | subject effective age | stated — the grids assert comps "within 10 years of effective age" | absent; only "Chronological Age: 46 years" | team wrong |
| 8 | tenant notice | service date | ≥30 days before submission, per its own comment-period text | dated 10/21; package executed 10/21, transmitted 10/22 | team wrong |
| 9 | revision | value date vs inspection | value date supported or re-inspection disclosed | value "as of the date of this report" (11/11); sole inspection 7/16 | open |
| 10 | both studies | "Subject's FHA #" | N/A, or 054-35389 | `SC160061002` — the *Section 8 contract* number | cosmetic |
| 11 | HUD-92458 2026 | FHA Project Number | 054-35389 (used on the 2018/2019 filings; UA workbook C4) | "N/A" | open |
| 12 | tenant notice ×3 | address | 186 Newberry Arms **Drive** | "186 Newberry Arms" | cosmetic |
| 13 | live folder | which copies are live | the 10/21 executed versions | loose cover + submittal letters dated **10/13**; executed only inside `Submission/` | cosmetic |
| 14 | loose owner's checklist | signature | unticked while unsigned | **"Signed Cover Letter" and "Signed Owner's Checklist" both ticked on an unsigned, undated sheet** | cosmetic |
| 15 | UA workbook `D19` | row label | "4x2 Bedroom Units" | "3 x2 Bedroom Units" (it averages the 4x2 sheet) | cosmetic |
| 16 | revision, 2BR grid | concluded market rent | a reconciliation for landing below 4 of 5 adjusted rents | $1,375 unchanged while every 2BR adjusted rent rose $15–$35 | open |
| 17 | CA Notification 11/18 | project name | Newberry Arms | "Newberry Arms **Limited Partnership**" — the pre-2021 owner | open (CA) |
| 18 | workbook + study | SAFMR vintage | FY2026 if effective 10/1/2025 | FY2025 | open |
| 19 | HUD-92458 Part B | Carpet | match the grid | ticked, carried from 2025; grid row 19 lists **LVT only** | open |

**#14 repeats Friendship Court's #4 exactly** — a checklist certifying that signed documents
are attached, on an unsigned sheet. Two properties, same appraiser, same cycle.

**#18 is not academic at $5.10/unit of headroom.** Whether FY2026 SAFMRs for ZIP 29108 were
published before the 21 Oct submission would settle it, and is not in the folder.

### Patterns explicitly ABSENT

Glyph substitution: **none** — every `SC160061002` / `SC16-0061-002` is all digits.
Foreign contamination *in the filed package*: **none** (see above — it is in the revision).
UA current/proposed swap: **none**. Incomplete grids: **none**. Year-built/age
contradiction: **none** (1979, 46 years, consistent). Thousands separator: **not a defect**
— see M8 above; this reader is the one who took it to 2400 dpi.

### Instrument notes

- The **unsigned** 2026 schedule exposes 232 AcroForm fields via `/V`; the **signed** copy is
  Docusign-flattened to one field. `Final Copies …eff. 01.01.26.pdf` is a Konica scan with
  no text layer — 150 dpi by eye.
- **The true prior schedule is `2025/…(unsigned).pdf`** (872/991/1,204/1,372, UA
  84/127/142/158), *not* the 2019 or 2020 folders. It matches the tenant notice's current-rent
  column exactly.
- `pypdf` is broken in this container (`cryptography` fails to import). pdf-lib via CommonJS
  `require` on the vendored copy works.
- **Could not determine:** whether the 11 Nov revision was transmitted (no cover letter,
  transmittal or CA correspondence in the cycle); what the CA objected to; whether the FHA
  number is genuinely N/A post-2021 refinance — the HAP and assignment PDFs are image-only.

---

## Findings — Crossroads of East Ravenswood (no folder code), 2026 (RCS)

**SHOULD/FILED only — no sweep record.** One of the eight uncoded-only properties (H7);
identifiers had to be read out of the documents.

### The margin is wide — and the workbook computes a ratio that looks like the test but isn't

Study and workbook agree on SAFMRs for ZIP 60640 (2,040 / 2,300 / 2,960 / 3,430) —
**no divergence**. SAFMR gross $297,780/mo, cap **$446,670/mo**. Governing gross
$297,163/mo → **$149,507/mo of headroom, 33.5% under the cap, $1,205.70/unit/mo.**
Comfortably clear, and the first wide margin in this wave.

**One trap worth naming:** the concluded gross is **99.79% of 1× SAFMR**, and the workbook
computes exactly that ratio in `T17`. A reader glancing at a figure of 0.9979 could take it
for the 150% test scraping through. It is not the test.

### Study selection — and the money it moves

| file | date | conclusion 1/2/3/4BR | net GRP/mo |
|---|---|---|--:|
| `Grids/Belfry Grids - 25-225…` | Jan 2026 | 1,725 / 2,250 / 2,900 / 3,650 | 284,775 |
| `Grids/Cornerstone Rent Grids…` | 17 Feb 2026 | 1,870 / 2,305 / 2,815 / 3,150 | 288,115 |
| `RCS/RCS - …IL.pdf` ≡ `RCS Package/04.…` (same md5 `dedeb6f5…`) | **13 Apr 2026** | 1,870 / 2,305 / 2,815 / 3,150 | 288,115 |
| `Revised RCS - …IL.pdf` | **4 May 2026** | 1,860 / 2,305 / 2,805 / 3,135 | 287,505 |

**FILED** = the 13 Apr original, bound pp.5–119 of *both* combined packages. **GOVERNS** =
the 4 May revision — the CA letter of 8 June approves 1,860/2,305/2,805/3,135 and $287,505
exactly. Divergence: **$610/mo = $7,320/yr**. Choice of firm moved **$2,730/mo =
$32,760/yr** against Belfry's grids. **No combined package was ever rebuilt around the
revised study** — the filed package and the governing study are permanently different
documents.

### The transmittal for the revised study is another property's letter, executed under penalty of perjury

`…RCS Owner Cover Letter (Updated RCS).pdf` (Docusign `8371E446`, 7 May) is the **only**
transmittal for the revised RCS. Every identifying element in it belongs to **Woodland
Towers**: the property name, contract `IL06H121046`, appraiser *Aaron Zabel of Belfry
Valuation*, owner *Woodland Towers Preservation, L.P.* Crossroads' own values are
`IL060048014`, Cornerstone, Kyle Bjerke, East Ravenswood Preservation, L.P.

**It was executed.** Not a draft left in a folder — a signed instrument, under penalty of
perjury, and it is the sole transmittal on the record for the study that governs. Woodland
Towers is itself one of the eight uncoded-only properties and has not been read.

### Defects

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | **transmittal for the revised RCS** (Docusign, 7 May) | entire letter | Crossroads / IL060048014 / Bjerke, Cornerstone / East Ravenswood Preservation | **Woodland Towers / IL06H121046 / Zabel, Belfry / Woodland Towers Preservation** | team wrong |
| 2 | UAF workbook + both UAF PDFs | UA split | gas ×0.971 + electric ×1.078 → **63/79/108/103** | **100% in electric, gas blank → 66/82/111/106** — **+$3/unit/mo = $4,464/yr** | team wrong |
| 3 | `Issues Memo - Responses.pdf` | which comps took the $20 street-appeal cut | Comps **2, 4, 5** (Comp 3 is G/A, unadjusted) | "Comparables 2, 3, and 5" | team wrong |
| 4 | revised RCS, Line 46, all 4 unit types | comparison sentence | "Comparables **Two and Three**" (1 & 4 at 22.5%, 2 & 3 at 20%) | "Comparables Three and Four" | team wrong |
| 5 | **filed** 13 Apr study, cert p.65 | licence label | "Permanent License No" (as the revision says) | "**Temporary** License No: 553.003053" beside "temporary license? **No**" | team wrong |
| 6 | owner's checklist | Scope of Work | checked — it is at RCS p.1 and in the TOC | unchecked | team wrong |
| 7 | owner's checklist | appraiser licence copy "only if relying on a temporary licence" | unchecked | **checked** | team wrong |
| 8 | rent schedule p.1 | FHA Project Number | populated (2021 carried IL060048014; CA Exhibit A carries 07111112) | blank — contract no. crammed into Project Name | team wrong |
| 9 | rent schedule Part C | charges in addition to rent | parking (2021: 8×$40, 15×$50; grid Line 24 "L$40-50") | empty, carried from 2025 | team wrong |
| 10 | rent schedule Part B | "Cooking" | — | checked = included in rent (2021 unchecked) while the tenant UA still carries gas | open |
| 11 | tenant notice `.docx` | agency name | "Department of **Housing and Urban** Development" | "Department of **Urban Housing and** Development" | cosmetic |
| 12 | tenant notice | supplemental notice | its own text promises 15 days' notice on material change in the comment period; rents changed 4 May, inside the 16 Apr–16 May window | none in folder | open |
| 13 | `03. RCS Owners Checklist….pdf` | PDF `/Title` | this property | `Exhibit 2 - RCS Owners Checklist - **New Horizons** 3.25.24.pdf` | cosmetic |
| 14 | revised grid Line 7, Comp #2 | Yr Built/Renovated | "1927 / 2015" per its own data sheet p.60 | "1927" | cosmetic |
| 15 | live folder | filing state | the superseded 13 Apr study and unsigned package marked or archived | both unlabelled beside the 4 May revision | cosmetic |
| 16 | owner cert (signed 5/29) item 6 | written evaluation of tenant comments | on file | not in folder | open |

**#5 and #7 contradict each other across two documents**: the filed study's certification
says *Temporary*, and the checklist ticks the licence-copy box that only applies to a
temporary licence — while the appraiser's own answer on the same page is *No*. Friendship
Court and Woodbury Oakwood both carry the mirror-image of this (checklist ticked *against*
the certification). Three properties now.

### Patterns explicitly ABSENT

SAFMR divergence: **none**. Glyph substitution: **none** — `IL060048014` reads with digit
zeros in the text layer of all 19 PDFs and at 600 dpi on the CA letter, where `07111112` is
also unambiguous. Foreign names inside the study body or the executed package body:
**none** — a grep of all 33 sibling property names returned zero hits (the contamination is
in the *transmittal*, #1). Incomplete grids: **none** — all four at pp.34/40/46/52, Lines
5/44/46 populated, "prepared: Manually" ticked, signed 5/4/2026. Year-built/age
contradiction: **none**. UA current/proposed swap: **none**. CA refusal letter: **none in
the folder** — only the appraiser's response to a memo that is itself absent.

### Instrument notes

- **The separator mechanism was found here** — see M8 above. Read `/AP`, not pixels.
- **Authoritative files:** governing study = `Revised RCS - …IL.pdf` (4 May). Filed package
  = `Crossroads_of_East_Ravenswood_-_RCS_Package.pdf` (Docusign, 17 Apr). Executed schedule
  = `EXECUTED 2026-Rent Schedule…IL060048014.pdf` (owner 6/8, CA 6/10) — flattened, 0
  AcroForm fields; values read from the unsigned twin's widgets and verified to match.
- **Identifiers, since the folder has no code:** HAP contract **IL060048014**; REMS
  **800005826**; CA Exhibit A FHA **07111112**; the RCS states FHA **N/A**; the HAP contract
  (eff. 1 Jul 2016) puts IL060048014 in its FHA box and gives expiring S8 project no.
  **071-11211**. Appraiser IL cert 553.003053; CVS file 26.082-K.
- **Could not determine:** the true FHA project number — **three different values are in the
  record and none is corroborated**; whether the Woodland Towers letter was transmitted (no
  receipt, but the CA did act on the revised rents and no Crossroads-named replacement
  exists); whether tenants got a supplemental notice; whether Part B "Cooking" or the gas UA
  component is the error.

---

## Findings — Market Square (75568), 2026 - RCS

**SHOULD/FILED only — no sweep record.** The most consequential package in this wave: the
CA first ruled it **failed** the 150% test, then reversed.

### The CA held this package over the cap, then concurred after a re-dating

Workbook and all three revisions cite the same SAFMR — **$1,600** (ZIP 06111, 1BR, "HUD
2026"). **No study-vs-workbook divergence.** 150% = $2,400.

| | conclusion | % of SAFMR | headroom |
|---|--:|--:|--:|
| governing (21 Nov) | $2,325 | 145.31% | **$75/unit/mo**, 3.13%; gross $174,375 vs $180,000 |
| **as filed** (7 Oct) | $2,375 | 148.44% | **$25/unit/mo** — nearly zero |

**But the CA's first review (20 Oct 2025) held the applicable SAFMR was the FY2025 Revised,
effective 27 Apr 2025 = $1,400** — reproducing HUD's own table on p.3 of the letter. On that
basis 150% = $2,100 and the filed package sits at **169.6% of SAFMR: a failure.**

The appraiser re-dated the report into FY2026 and the CA concurred with $1,600.
**The report's effective date never moved.** The signed HUD-92273-S8 carries **9/22/2025**
in all three revisions — verified at 600 dpi — and only the certification and transmittal
dates advanced to 21 Nov 2025. If the effective date governs the SAFMR vintage, as the CA's
own first review reasoned, then $2,325 exceeds 150% by **$225/unit/month**.

**Recorded `open`, not as a defect.** Which date fixes the SAFMR vintage is a HUD Chapter 9
question this ledger has not settled, and no HUD source for the FY2026 SAFMR at 06111 exists
in the corpus — $1,600 is asserted by the appraiser and concurred by the CA, while $1,400
for FY2025 Revised is *proven* from HUD's table in the CA's own letter. **It is the largest
open question in the audit so far, and it decides whether a filed package passes.**

### Study selection — the only cycle in this wave where conclusions actually moved

| file | pp | transmittal / cert | Line 46 | letter conclusion |
|---|--:|---|--:|--:|
| `Archive/4 - 25-123 …CT.pdf` | 45 | 24 Sep 2025 | **$2,300** | **$2,375** |
| `Archive/25-123 … CT (updated).pdf` | 52 | 29 Oct 2025 | $2,375 | $2,375 |
| `Archive/25-123 … CT.pdf` | 52 | **21 Nov 2025** | **$2,325** | $2,325 |

**Filenames lie, and here they lie in the worst direction: the un-suffixed file is the
NEWEST, and "(updated)" is the middle one.** Ordering by filename picks the wrong study;
ordering by transmittal date is the only correct rule. All three sit in `Archive/`.

**FILED** = the 24 Sep revision, bound as Exhibit C of the submission (CA received 7 Oct).
**GOVERNS** = the 21 Nov revision, accepted by Doyle for Navigate on 3 Dec.

### Defects

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | **filed** study, HUD-92273-S8 | Line 46 Estimated Market Rent | $2,375 — its own transmittal and reconciliation | **$2,300** | team wrong |
| 2 | filed study, reconciliation | adjusted rent range | $1,912–$2,934 (Line 44 min/max) | "$1,917 - $2,939" | team wrong |
| 3 | all 3 revisions + filed pkg, grid header | "Subject's FHA #" | CT26**H**037003 | **CT26N037003** — N for H, at 1200 dpi the diagonal is unambiguous | team wrong |
| 4 | all revisions + filed, transmittal p.2 | threshold table column head | concluded rent under "RCS Rent" | concluded rent printed under **"SAFMR RENTS"** | team wrong |
| 5 | same table | comparison caption | "RCS gross < **150% of** SAFMR gross" | "RCS GROSS RENT < SAFMR GROSS RENT $174,375<$180,000" — but SAFMR gross is $120,000 | team wrong |
| 6 | `…RS (fully executed).pdf` p.2 | Part H owner certification | 4 Dec 2025, envelope `68757971` — the signing that covers $2,325 | **7 Oct 2025, envelope `8872250A`** — the October signing, paired with a page 1 carrying **December** figures | team wrong |
| 7 | governing study | property manager | one name | Scope of Work: "Ms. Jenna Quennvill (the property manager)"; p.15: "the property manager Ms. Gloria Asare" | team wrong |
| 8 | governing study | SAFMR vintage vs effective date | see above | FY2026 $1,600 retained on an unchanged 9/22/2025 grid date | **open** |
| 9 | owner's checklist, filed pkg p.7 | "Owner's Signature & Date" | signature + date | signature only, **no date** | cosmetic |
| 10 | `Archive/5 - …Tenant Notice v2.pdf` (3 Dec) | body | a post-approval notice | headline announces approval; body retains the full **pre-submission 30-day comment-period** language | team wrong |
| 11 | cover page, all 3 revisions + engagement letter | address | 65 Constance **Leigh** Drive | "65 CONSTANCE **LEIGHT** DRIVE" | cosmetic |
| 12 | study, Primary Market Area | county | Hartford County | "in **Harford** County" | cosmetic |
| 13 | study, unit breakdown TOTAL | rentable area | 41,800 SF | blank ("SF") | cosmetic |
| 14 | Doyle final review, App. 9-5-5 | "Due date for HUD/CA to respond" | 11/6/2025 | **`45967`** — the raw Excel date serial | cosmetic |
| 15 | same | "Second review required" | a second substantive review *was* run (Doyle, 11 Nov) | "No" | open |
| 16 | executed HUD-92458 | Part B Water / Sewer / Trash | grid lines 38–39 record Cold Water Y/Y and Trash Y/Y | unchecked — also unchecked in FY2025, so longstanding | open |
| 17 | executed HUD-92458 | page footers | consistent | p.1 "Page 1 of 2", p.2 "Page 2 of **3**"; p.1 cites a page 3 that does not exist | cosmetic |

**#6 is post-certification alteration, and it is the first confirmed instance.** The
executed schedule pairs a page 1 of December figures with a page 2 bearing the October
signature and the October envelope ID. The owner certified numbers that are not the numbers
on the document. Woodbury Oakwood was checked for this class and came back clean; this one
does not.

**#3 is a new glyph pair.** Not O-for-0 (Westwood, Woodbury, Friendship Court) and not
`CH` for `CA` (Noble Tower) — **N for H**. Three distinct substitution shapes now, across
five properties.

### Patterns explicitly ABSENT

Foreign-document contamination: **none** — every corpus property name and every
`XX##X######` contract pattern was scanned across studies, reviews and the filed bundle;
the only foreign contract numbers sit inside Doyle's own regional UA comparison table, where
they belong. Year-built/age contradiction: **none** (1979 / 46 / grid 1979-2021-2022).
Swapped UAs: **none** (subject UA is $0 throughout). Blank "Grid was prepared" box:
**none**. Missing Effective/Adjusted/Market Rent rows: **none**. Unsigned-copy-live:
**the reverse** — signed copies are the live ones here, the only package in this wave where
that is true. Period-vs-comma separator: **none seen**.

### Instrument notes

- **The FY2026 rent schedules are Print-To-PDF flattenings with zero AcroForm widgets** — a
  pdf-lib walk returns none. The text layer is correct and complete: use `pdftotext -layout`,
  *not* the `/V` path this corpus normally requires. Third distinct rent-schedule instrument
  after fillable-with-`/V` and Docusign-flattened.
- **Retracted before claiming:** the Docusign signature GUID `C93D0577FF8A402` appears on all
  three envelopes, so it is the signer's stable adopted-signature ID and is **not** evidence
  of a pasted signature. Defect #6 rests on the envelope ID and printed date alone.
- dpi: 1200 for `CT26N037003`, 600 for the 9/22/2025 grid date, 110–200 elsewhere.
- **Could not determine:** the true published FY2026 SAFMR for 06111 (no HUD source in the
  corpus); the cover letter's quotation of HAP §5b(2)(b) — the 2021 MUTM contract is an
  image-only scan.

---

## Mechanisms confirmed by this wave

Four new mechanisms clear the two-property bar. Each is stated with every property that
carries it; none claims intent.

### M11 · A CA approval is not evidence the CA's objection was cured — 3 properties

| property | the objection | what the CA then did |
|---|---|---|
| Woodbury Oakwood | refused twice; named the 1930-vs-1960 year-built contradiction in terms | approved at 100% a version still printing **1943** in the narrative and **1960** in both grids |
| Friendship Court | reviewer 28 Oct 2025: *"I **Reject** the RCS for use by HUD"* | executed a Notification of Contract Rents 29 Jan 2026 approving exactly the rejected study's rents. **No re-submission exists in the folder** — which is not proof none occurred |
| **Market Square** | first review 20 Oct 2025 held the package at **169.6% of SAFMR — over the cap** | concurred with the appraiser's higher SAFMR after a re-dating that left the report's effective date unchanged |

**Why it matters to this lane:** the audit's premise is that FILED is evidence and never
referee. This extends it — **CA-approved is not referee either.** Market Square is the sharp
case: the reversal is on the binding threshold test itself.

### M12 · Foreign-property material reaches filed or governing documents — 4 properties

Escalating in severity, which is the part worth noticing:

| property | what | where | filed? |
|---|---|---|---|
| Woodbury Oakwood | Fairview Homes' cover letter + mortgage statement | live folder, two of five unmarked | **no** — near miss |
| Noble Tower | "Hostmark of Village Cove, Poulsbo, WA" subtitle; "Raymond J. Lord Manor" header | **bound into the filed study** | yes |
| Newberry Arms | Friendship Court's 80-unit, $4,775,000 scope/budget — **and a per-unit cost derived from it** | bound into the **governing** revision | governs |
| **Crossroads** | Woodland Towers' **entire transmittal**: name, contract, appraiser, owner entity | **Docusign-executed under penalty of perjury**, sole transmittal for the governing study | governs |

Plus two `/Title` traces of the source document (Crossroads' checklist is titled
*"…New Horizons 3.25.24.pdf"*; Noble Tower's wellness analysis exists under two property
names). **The mechanism is template reuse without renaming**, and it has now been caught at
every stage from "left in the folder" to "signed under penalty of perjury."

### M13 · A unit type over 150% of its own SAFMR, absorbed by the aggregate test — 6 properties, 4 of them concealed

| property | unit | RCS gross | 150% SAFMR | over by | disclosed? |
|---|---|--:|--:|--:|---|
| Friendship Court | 1BR | $1,375 | $1,260 | $115/unit/mo (163.7%) | **yes**, on the study's own summary |
| Newberry Arms | 1BR | $1,175 | $1,170 | $5/unit/mo | **yes** |
| **Marine Terrace** | **3BR** | **$7,028** | **$6,900** | **$128/unit/mo** | **no — masked** |
| **Morh Housing** | **3BR** | **$4,777** | **$4,695** | **$82/unit/mo** ($55,104/yr) | **no — masked twice** |
| **Fairview Homes** | **4BR** | **$3,959** | **$3,840** | **$119/unit/mo** ($28,560/yr) — **over on all three UA sets** | **no — masked** |
| **Oak Center** | **2BR** | **$3,699** | **$3,675** | **$24–28/unit/mo** ($6,720/yr) | **no — masked**, and the *owner's transmittal* certifies the opposite |

The first two **disclose** the overage and rest on the gross test, which is the binding one.
For those this is not a defect but a **product requirement**: the app's 150% check computes
an aggregate, and a reviewer reading only its verdict would not see a unit type over its own
cap.

**The other two are a different finding.** In both, the study's transmittal table compares
*net* RCS rent to the *gross* 150% figure — and that basis gap is precisely the under/over
gap. Morh Housing masks it a second time by netting the 3BR overage against a 4BR surplus
inside the aggregate. So the app's aggregate would not merely hide a disclosed detail; on
either package it would **agree with a filed conclusion that a correct per-unit computation
contradicts.**

**And in both, the owner's workbook fails the same way independently.** Morh Housing states
the mechanism exactly: `MORH Rent Grid Analysis.xlsx` carries "RCS Rents + UA" in column Q
and "150% SAFMR" in column U — **adjacent** — and its `R19` test reads only the aggregate.
The per-unit comparison is not computed wrongly; **both correct figures sit one column apart
and nothing subtracts them.** Marine Terrace's workbook makes the mirror-image basis error,
overstating headroom by $66,618/mo.

**⚠ THE SEVERITY OF THIS MECHANISM RESTS ON AN UNSETTLED REGULATORY QUESTION.**

Oak Center's reader put it correctly: *whether HUD applies the 150% cap per unit type or only
in aggregate* is **not established**. Every overage above is arithmetically certain. Its
regulatory consequence is not.

If HUD's test is aggregate-only, then a per-unit-type overage is not a failure and these are
disclosure defects, not compliance defects. If it is per type, then packages have been filed
and approved over the cap. **This ledger cannot tell you which**, because the current Chapter
9 is not in the corpus (H8) and HUD's own source could not be fetched — the API needs a key
and `huduser.gov` returns HTTP 202 through the proxy.

**Nothing in M13 should be reported to anyone as a compliance failure until that question is
answered.** It is the single highest-value unknown in the audit, and it gates six properties.

**Product consequence, which holds either way:** the 150% check must report per unit type as
well as aggregate, and must print the basis (gross, including UA) on both sides. Under an
aggregate-only rule that is still the right display, because the per-type figure is what four
studies got wrong and three workbooks never computed. Under a per-type rule it is mandatory.

### M14 · The threshold statement — the one sentence that says whether the package passes — is malformed in every Belfry package that prints it: 7 of 9

| property | what it prints | what is wrong | arithmetic |
|---|---|---|---|
| Friendship Court | `$133,744 > $138,060` under a caption reading "<" | **the operator is inverted** — the result is stated backwards | right |
| Newberry Arms | "RCS GROSS RENT < SAFMR GROSS RENT $95,814 <$96,120" | $96,120 is **150% of** SAFMR gross, not SAFMR gross | right |
| Market Square | same caption, `$174,375<$180,000`; concluded rent printed under a **"SAFMR RENTS"** column head | SAFMR gross is $120,000 — the caption omits "150% of" twice over | right |
| **Marine Terrace** | same caption — but compares **net** RCS rent to the **gross** 150% figure | **the bases do not match, and the mismatch is what makes a 3BR overage read as compliant** | **wrong** |
| **Morh Housing** | same caption, `$641,009<$646,905` — while the **same table** defines "TOTAL GROSS SAFMR RENT: **$431,270**" two lines above | as written the sentence asserts $641,009 < $431,270, **which is false**; and its per-unit table is net-against-gross | **wrong** |

Three firms, five properties, one malformed template.

**Morh Housing is the sharpest instance:** the sentence is not merely under-labelled, it is
contradicted by a figure printed two lines above it in the same table. A reviewer who
believed the caption would have to conclude the package fails.

In the first three the arithmetic behind the sentence is correct and **only the sentence is
wrong** — which is the version most likely to survive review, because a reviewer who checks
the numbers finds them right. Marine Terrace is the case where the malformed statement stops
being cosmetic: there the mismatch is *in the computation*, it changes the answer, and the
owner's workbook reproduces it independently in the same direction.

**The distinction to carry forward:** a caption omitting "150% of" is a labelling defect. A
comparison whose two sides are on different bases is a **computational** one, and it looks
identical on the page.

### M15 · The owner's checklist certifies attachments that are not attached — 9 properties

Woodbury Oakwood (Scope of Work unchecked / licence copy checked against a certification of
*no* temporary licence), Friendship Court ("Signed Owner's Checklist" ticked on an unsigned
sheet), Newberry Arms (**both** "Signed Cover Letter" and "Signed Owner's Checklist" ticked
on an unsigned, undated sheet), Crossroads (Scope of Work unchecked though it is at RCS p.1
and in the TOC; licence-copy box checked against a *No* answer on the same page).

**Marine Terrace** is the fifth, and carries it furthest: the checklist is Docusign-signed
but **undated**, and the submittal cover letter bound at pp.4–5 of the filed package —
Appendix 9-2-1, made under penalty of perjury — is **unsigned and undated** while the
checklist beside it certifies the package complete. Market Square's checklist is likewise
signed without a date.

The checklist is Appendix 9-2-2 — the document whose entire function is to assert what the
package contains. **In five of the eight packages read closely enough to check, it asserts
something the package contradicts.**

---

## Findings — Marine Terrace (75922), 2026 - RCS

**SHOULD/FILED only — no sweep record.** The fifth package of the wave, and the one that
turns M13 from a product requirement into a defect class.

### A unit type is over the cap, and the study's own table conceals it

SAFMR is not in dispute: filed study (Belfry 26-052), owner's workbook and the unfiled Doyle
Phase-1 study all use **FY2026 SAFMRs for ZIP 11105 eff. 1 Oct 2025 — 1BR $3,350 / 2BR
$3,670 / 3BR $4,600** (150% = $5,025 / $5,505 / $6,900). Doyle states the vintage explicitly.
**No mismatch.**

The aggregate passes: gross potential **$2,325,168/mo vs $2,431,620/mo** — 95.6% of the
threshold, headroom **$106,452/mo = $241.39/unit/mo (4.38%)**. Per unit type, on the same
gross basis:

| | gross | 150% SAFMR | |
|---|--:|--:|---|
| 1BR | $3,716 | $5,025 | 74% |
| 2BR | $5,302 | $5,505 | 96.3% — $203/unit/mo |
| **3BR** | **$7,028** | **$6,900** | **OVER by $128/unit/mo** |

**The study's transmittal table hides it by changing basis mid-comparison** — putting *net*
RCS rent ($6,850) against the *gross* 150% figure. Net-vs-gross is exactly the difference
between $6,850 and $7,028, and it is the difference between "under" and "over."

**The owner's workbook makes the mirror-image error in the owner's favour**, comparing net
$2,258,550 against gross $2,431,620 and so **overstating headroom by $66,618/mo**.

Friendship Court and Newberry Arms *disclosed* their per-unit overage and rested on the
gross test. This package does not disclose it — the comparison that would show it was taken
on mismatched bases, in two independent documents, both times in the direction that flatters
the result. **That is the escalation, and it is why M13 and M14 are now the same finding.**

### Study selection

| file | transmittal / value date | conclusion 1/2/3BR | signed |
|---|---|---|---|
| `Rent Grids/Doyle …Phase 1, Grids Only, 2-12-2026` | report 2/12/26, eff. 2/11/26 | 2,500 / 3,400 / 3,750 (1BR row 46 reads $2,475) | letter signed, grids unsigned |
| `Rent Grids/Belfry …26-025` | 2/23/26, "date of value February 2026" | 3,550 / 5,115 / 6,800 | **unsigned, undated** |
| `4 - 26-052 - …` | transmittal 4/30/26, value 3/10/26, grids signed 4/10/26 | **3,600 / 5,150 / 6,850** | signed |

A two-phase Belfry engagement (grids $2,000 on 1/29; full RCS $3,000 on 2/27) explains the
two Belfry files. **26-052 was FILED** (Exhibit C, pp.9–69). Conclusions rose $50/$35/$50
between the 2/23 grids and the 4/30 report. **No CA decision or refusal letter exists for
the 2026 cycle** — the only evidence of what governs is the executed schedule (Docusign
7/16/26, executed 7/20/26), which adopts 3,600/5,150/6,850 unchanged.

### Defects

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | cover letter (bound p.1), **both submission filenames, and the Docusign envelope subject** | Section 8 number | `NY36H110071` | **`NY360011071`** | team wrong |
| 2 | submittal cover letter (App. 9-2-1), bound pp.4–5 | owner signature | signed under penalty of perjury | typed name only — **unsigned, undated** | team wrong |
| 3 | owner's checklist, bound p.7 | "Owner's Signature & Date" | signed and dated | Docusign-signed 5/18, **no date** | team wrong |
| 4 | rent schedule Part A | Total Units | 444 — the form says "include non-revenue-producing units" | **441**; the non-revenue 2BR/3-unit row omitted | team wrong |
| 5 | rent schedule Part D row 3 | unit description | "Manager's Unit" | "Supers Unit" — three identical rows | team wrong |
| 6 | **study transmittal p.3 threshold table** | comparison basis | gross vs gross | **net RCS rent vs gross 150% SAFMR — masks 3BR $7,028 > $6,900** | team wrong |
| 7 | same, last row label | caption | "… < **150% OF** SAFMR GROSS RENT" | "RCS GROSS RENT < SAFMR GROSS RENT" | cosmetic |
| 8 | study, Improvements p.11 | year built / renovated | **1982 / 2018** — narrative ×3 and all three grids row 7 | "1949 (Renovated 1985/2017)" | team wrong |
| 9 | study certification p.50 | date | signed and dated | signed, **undated** | team wrong |
| 10 | study signature block p.3 | job no. | 26-052, matching the report | "Job No. **25**-052" | cosmetic |
| 11 | study grids | subject address | one of the HAP addresses | "20-31 Shore Boulevard" merges two; the transmittal omits three more | cosmetic |
| 12 | workbook cols I/M rows 5–6 | $ increase | 2,177 / 52 / 3,418 / 66 | 2,862 / 737 / 4,562 / 1,210 — an `$E$4` anchor error | team wrong |
| 13 | **workbook row 7** | headroom basis | gross, including UA | **net contract rent — overstates headroom $66,618/mo** | team wrong |
| 14 | tenant notice, bound p.77 | where to send comments | the CA address (CGI Federal, Latham NY, Attn B. Brown — supplied in the 5/27 reissue) | "to us at the Office" only | team wrong |
| 15 | package assembly | corrected documents | a re-bound package | the 5/27 checklist, submittal letter and tenant notice exist only as loose PDFs; `Archive/Marine Terrace v2.pdf` is **page-identical to the 5/18 filing** | open |
| 16 | rent schedule Part C | charges in addition to rent | parking $60 surface / $165 garage, per study and grids | blank | open |
| 17 | rent schedule Part B | in-unit W/D | study says "in-unit washers and dryers" | no laundry item ticked | open |
| 18 | cover letter / tenant notice | "5th Year Adjustment" | expiry of the **second** 5-year period (HAP 6/30/2016, 20-yr term) | "5th Year" | cosmetic |
| 19 | cover & submittal letters | legal-rent constraint | Art. XI Schedule C legal rents $2,335/$3,025/$3,498 sit far below the proposed rents; a §610 amendment was requested of HPD 17 Apr 2026 and is unresolved | not mentioned | open |

**#1 is the fifth glyph property and the widest blast radius yet** — the wrong contract
number is on the letter, on *both* submission filenames, and in the Docusign envelope
subject. Everywhere else in the record (UAF, all three grids, study body, HAP, CGI emails)
reads `NY36H110071` correctly.

**#8 is the second year-built contradiction** after Woodbury Oakwood, and it runs the same
way: the narrative and the grids agree with each other, and the Improvements section alone
disagrees.

### A negative result that corrects an earlier finding

The rent schedule's **empty FHA box is correct here** — verified at 600 dpi against the
executed HAP contract p.2, where the FHA number is genuinely blank. The reader went to the
contract instead of inferring from a prior schedule.

**This obliges a correction to Crossroads of East Ravenswood, defect #8**, recorded above as
`team wrong` for a blank FHA box. That row rested on the 2021 schedule having carried a
value — but the same reader also reported that **three different FHA values sit in the
Crossroads record and none is corroborated.** Those two statements cannot both stand.

> **Crossroads #8 is downgraded from `team wrong` to `open`.** Settle it the way Marine
> Terrace did: read the executed HAP contract and see whether an FHA number exists at all.

### Patterns explicitly ABSENT

Foreign contamination: **none** — the "20-24 21st Street" in the Belfry filenames traces to
Related's own engagement request and a real Marine Terrace address, not another property.
Glyph substitution beyond #1: **none**. Incomplete grids: **none** — all three carry rows
5/44/46, signed 4/10/26, "Using HUD's Excel form" ticked. UA swap: **none** — UAF inputs
reconcile exactly to the 2025 executed schedule and the outputs match the 2026 schedule and
the study. Signed-copy-in-archive: **none**. CA reviewer letters: **none exist for 2026.**

### Instrument notes

- All money figures read from **vector text layers**, not OCR. **No separator claim is
  made** — every separator seen was a comma, none load-bearing, nothing re-rendered.
  Consistent with M8's closure.
- **The filed study's grids are 201-ppi raster images** — rendering above ~200 dpi adds
  nothing. The same grids in the unfiled `26-025` are vector text and are the better source
  for grid identifiers. Worth generalising: the *filed* copy is not always the most legible.
- dpi: 1200 for `NY360011071`, 900 for "Job No. 25-052", 600 for the HAP contract, 110–200
  for checkbox states.
- HUD-92458s: doc 5 has live widgets (`/V`); the 7/16 signed and 7/20 executed copies are
  flattened. `pdftotext` returns nothing on any of them.
- `Submission/Archive/Marine Terrace v2.pdf` has a **damaged text layer** (fields extract
  blank) but renders correctly — read as raster. It is a re-save, not a correction.
- **Could not determine:** whether CGI received the 5/27 corrections; whether CGI issued any
  decision; the disposition of the §610 request. No 2026 CA correspondence exists.

---

## H8 · The only HUD guidance in the corpus is the SUPERSEDED 2015 Chapter Nine — and it is misfiled under a submission-package name

Market Square's SAFMR-vintage question is the largest open item in this audit, so I went
looking for HUD's own rule. The corpus contains exactly one copy of the Chapter Nine
material: `75543 - Noble Tower …/2024 - RCS/Archive/Noble Tower - Option 1 Submission
Package.pdf` — 86 pages, Word 2010, dated on disk 14 Aug 2024, already noted at Noble Tower
as "not a submission package."

**It cannot settle the question, because it is the wrong vintage of the guidance.**

| | |
|---|---|
| footer on **every page** | `Chapter Nine - _/_/2015` |
| the test it specifies | **"HUD's Threshold: 140% of Median Gross Rent Estimate"** — Census/ACS median gross rent for the project's ZIP |
| occurrences of "SAFMR" or "Small Area" | **zero** |

This is the pre-March-2023 regime. The entire audit — every 150% computation in this ledger
— rests on the *later* Chapter 9, which replaced the 140% median-gross-rent comparison with
the 150% SAFMR threshold. **The corpus holds no copy of the current guidance.**

### Consequences

1. **Market Square's SAFMR-vintage question stays open, and cannot be closed from inside
   this corpus.** Whether the report's *effective date* or its *transmittal date* fixes the
   SAFMR vintage — the question worth $225/unit/month there — requires the current Chapter 9,
   which is not here. Fetching it is outside this lane; flagging that it is needed is not.
2. **A live hazard for the PM team, independent of anything the app does.** A HUD guide
   specifying the *wrong test* sits in a property folder under a filename that reads like a
   filed submission package. Anyone opening it for guidance is told to compare the project's
   median rent to 140% of Census median gross rent. That test has not applied since March
   2023. It is the same template-reuse-without-renaming mechanism as M12, applied to a
   reference document rather than an exhibit.

### One lead, recorded with its caveat

The 2015 appendices' screening checklist auto-populates two questions this ledger has not
been testing:

> *"Is RCS submitted within 120 days of contract expiration?"*
> *"Is RCS submitted within 90 days of preparation?"*

The second bears directly on Market Square, where the report was re-dated from 24 Sep to
21 Nov 2025 while the signed grid date stayed at 9/22/2025 — roughly 60 days between
preparation and the re-dated transmittal.

**This is a lead, not a rule.** It is read off superseded guidance and must not be applied
to any package until the current Chapter 9 is in hand and the deadline is confirmed to have
survived. Recorded so it is not re-derived, and so nobody mistakes it for settled.

---

## Findings — Morh Housing (75927), 2026 - RCS

**SHOULD/FILED only — no sweep record.** The second confirmed concealment of a per-unit-type
failure, and the one that names the mechanism precisely.

### A 3BR overage, masked twice

SAFMR agreed on both sides (ZIP 94607, "HUD 2026 SAFMR": 3BR $3,130, 4BR $3,710 → 150% =
$4,695 / $5,565; aggregate cap $646,905/mo). **No divergence.**

The study's per-unit-type table captions its left column **"RCS RENTS"** — the *net*
contract rent — and compares it to **"150% SAFMR"**, a *gross* figure. The two tables below
it correctly use gross. Corrected to gross-vs-gross on the study's own UA ($102/$138), under
the **filed** (4 Dec) conclusions:

| | RCS gross | 150% SAFMR | margin/unit/mo |
|---|--:|--:|--:|
| 3BR (56 units) | $4,777 | $4,695 | **−$82 — OVER by 1.75%** |
| 4BR (69 units) | $5,413 | $5,565 | +$152 |
| aggregate | $641,009 | $646,905 | +$5,896 (0.91%) |

**The 3BR overage — $4,592/mo, $55,104/yr — is masked twice:** once by the net-vs-gross
caption, and again by netting against the 4BR surplus inside the aggregate.

**And the wrong UA vintage is in use.** Both study and workbook carry FY2025 UA
($102/$138). The FY2026 UA effective 1 Apr 2026 is **$107/$144** — computed in the property's
own `FY2026 UAF Notice.pdf` and carried by the executed rent schedule and Exhibit A. On the
correct UA the filed 3BR is over by **$87** and aggregate headroom falls to 0.80%.

**The governing (21 Jan) revision cures it.** 3BR $4,582 vs $4,695 (+$113), 4BR $5,244 vs
$5,565 (+$321), aggregate +4.40%. Money moved: −$200/unit 3BR, −$175/unit 4BR =
**−$23,275/mo, −$279,300/yr**. **No CA letter of any kind exists in the folder**, so whether
the revision answered an objection or was volunteered cannot be determined.

### The workbook has the right two columns side by side and never compares them

`MORH Rent Grid Analysis.xlsx` carries column **Q** ("RCS Rents + UA" = $4,777 / $5,413) and
column **U** ("150% SAFMR" = $4,695 / $5,565) **adjacent**. The "Below 150%?" test at `R19`
reads only the aggregate — $641,009 vs $646,905 → YES.

This is the mechanism Marine Terrace also showed, stated exactly: **the per-unit-type
comparison is not wrong in the workbook, it is never performed.** Both figures are present,
correctly computed, one column apart, and no cell subtracts them.

### The threshold sentence is false against its own table

Operator direction is correct (`<`) and the arithmetic is right against $646,905. The
caption is not:

> `RCS GROSS RENT < SAFMR GROSS RENT    $641,009<$646,905`

Two lines above, **the same table defines "TOTAL GROSS SAFMR RENT: $431,270."** As written
the sentence asserts $641,009 < $431,270, which is false. "150% OF" is omitted. Present in
**both** versions. This is the sharpest instance of M14 yet — the document contradicts itself
within one table.

### Study selection

| file | transmittal / cert | 3BR / 4BR |
|---|---|---|
| `Archive/25-063 …` (2pp grid extract, 6/9/2025) | none | not concluded on the pages present |
| `Grids/25-161 … (10.14.25)` (3pp) | none | preliminary Belfry grids |
| `Grids/MORH (Novoco) Preliminary Grids_10.2025` (31pp) | none | **second appraiser** (Novogradac); workbook shows $4,300 / $4,900 |
| `Archive/25-184 …` **≡ `RCS Submission/25-184 …`** (md5 `ac0c0750…`, byte-identical) | **4 Dec 2025** | **$4,675 / $5,275** |
| `25-184 … (Revised 1.21)` (md5 `9a53a9f2…`) | **21 Jan 2026** | **$4,475 / $5,100** |

**FILED:** the 4 Dec study, bound as Exhibit 3 at pp.9–62 of the signed submission (envelope
`BEEC3BD6`, 16–18 Dec 2025). **GOVERNS:** the 21 Jan revision — its rents are on the executed
HUD-92458 (25 Feb 2026), Exhibit A and the tenant notice. The revision also replaced comps 3
and 5 and moved the renovation year 2016→2017. **A second appraiser priced this property**
(Novogradac at $4,300/$4,900), the appraiser-shopping shape first seen at Noble Tower.

### Defects

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | filed study, transmittal p.2 | per-unit-type 150% test, 3BR | gross $4,777 > $4,695 — **FAILS** | `$4,675<$4,695` — net against gross | team wrong |
| 2 | **both** studies, transmittal p.2 | threshold caption | "… < **150% OF** SAFMR GROSS RENT" | "… < SAFMR GROSS RENT" — false against the same table's $431,270 | team wrong |
| 3 | both studies + workbook | utility allowance | $107 / $144 (FY2026 UAF) | $102 / $138 (FY2025) | team wrong |
| 4 | `MORH Rent Grid Analysis.xlsx` | 150% test | per unit type **and** aggregate | aggregate only (`R19`/`R40`) | team wrong |
| 5 | filed grids pp.26 & 34 | "Grid was prepared:" | one box ticked | **both blank** (300 dpi) | team wrong |
| 6 | filed grids | rendering | vector text | 694×887 px raster at **107 dpi** | team wrong |
| 7 | **both studies**, grid signature | date ≥ the figures it certifies | **11/17/2025** on a grid whose research ran to 12/4/2025 — **and unchanged on the 21 Jan revision after comps and rents changed** | post-certification alteration | team wrong |
| 8 | `Owner's Checklist MORH (12.26).pdf` | envelope integrity | a new envelope for re-signed content | **the same envelope `BEEC3BD6`** as the bound 12/16 checklist — but "Scope of Work" is now ticked and the date reads 12/26/2025 | team wrong |
| 9 | bound checklist (pkg p.7) | "Scope of Work" | ticked — the study has a Scope of Assignment at p.1 | unticked | team wrong |
| 10 | bound checklist | date vs cover letter | ≥ 12/18/2025 | dated 12/16/2025 yet certifies a "Signed Cover Letter" executed 12/18/2025 | team wrong |
| 11 | HUD-92458 (executed + both prelims) | FHA Project Number | populated or "N/A" | **blank**, while study and grids print "FHA #: CA39L000088" — which Exhibit A shows is the *S8 contract* number | team wrong |
| 12 | tenant notice (2/2/2026) | inspection address | 741 Filbert St (or 727–737) | **701 Filbert Street** | team wrong |
| 13 | tenant notice | owner signature | signed | blank line under "Signed by managing owner/agent" | team wrong |
| 14 | owner's certification of compliance v2 | signature | signed | blank line; typed name + "2.18.26" only | team wrong |
| 15 | FY2026 UAF notice | owner signature | signed | blank line; date only | team wrong |
| 16 | both studies, cover + transmittal | county | "ALAMEDA COUNTY" | **"ALMEDA COUNTY"** — correct elsewhere in the same document | cosmetic |
| 17 | both `25-184` PDFs | `/Title` metadata | the subject or report name | **"April 14, 2008"** — stale Word template | cosmetic |
| 18 | filed vs governing | year renovated | one value | 2016 (filed, all three places) vs 2017 (governing, all three places) | open |
| 19 | Novogradac preliminary sheet | 4BR unit count | 69 | **70** — raising its 150% divisor to $652,470 | cosmetic |
| 20 | filenames | tenant notice | — | `Archive/…December 2025.pdf` is dated 2/2/2026 and describes the 21 Jan revision | cosmetic |

**#8 is the sharpest document-integrity finding in the audit so far.** A checklist was
re-signed with a box newly ticked and a new date — **under the DocuSign envelope ID of the
already-bound copy.** The envelope is the thing that is supposed to make a signature
non-repudiable; reusing it across changed content is what it exists to prevent.

**#17 is a cross-link.** Friendship Court's study carries the identical stale `/Title`,
`April 14, 2008`. Two properties, two different appraisal firms, one 2008 Word template still
in circulation.

**#11 is the third FHA-box finding** and pulls the same way as Crossroads' (downgraded to
`open` above) and Marine Terrace's (verified *correct*). Here the study prints the S8 contract
number in an FHA field — the same category error as Newberry Arms #10 and Friendship Court #11.

### Patterns explicitly ABSENT

Glyph substitution: **none** — `CA39L000088` is character-identical across ten documents.
Foreign-property material: **none** (the 2008 `/Title` is template residue, not another
property). **No CA or HUD letter of any kind in the 2026 folder** — no approval, no
objection, no decision. Incomplete grids: **none** (lines 44/45/46 populated on all four
grids in both versions). UA current-vs-proposed swap: **none** — both move up, and the
24 CFR 245.410 decrease trigger correctly does not fire. 30-day notice: **clean** — served
2/2 for a 4/1 effective date, and the notice's rent table matches the governing study and
executed schedule exactly. Separator: **no claim made.**

### Instrument notes

- **The filed grid's embedded raster is 107 ppi** (`pdfimages -list`) — rendering above that
  upsamples. Checkbox and line 44/46 verdicts were read at 300 dpi off that upsample and
  stated as such. Third property where the *filed* copy is the least legible one.
- The executed rent schedule is Print-To-PDF with **zero widgets** — read by rendering; the
  two preliminary schedules have text layers and agree on every Part A figure.
- **Could not determine:** whether $3,130/$3,710 are the true published FY2026 SAFMRs for
  94607 (no offline HUD source — **and both sides agree, so a shared error would be
  invisible**); which renovation year is correct; whether the CA ever objected; the
  conclusion on `25-063`, whose two pages stop before grid line 46.

### M16 · Post-certification alteration — the signature no longer covers the page it is on: 2 properties

The class Woodbury Oakwood was checked for and cleared. Two properties do not clear it.

| property | the instrument | what is wrong |
|---|---|---|
| **Market Square** | executed HUD-92458 | page 1 carries **December** figures; page 2's Part H owner certification reads **7 Oct 2025, envelope `8872250A`** — the October signing. The December signing (`68757971`) is on a different document. **The owner certified numbers that are not the numbers on the page.** |
| **Morh Housing** | grid signature | dated **11/17/2025** on a grid whose research ran to **12/4/2025** — and **left unchanged on the 21 Jan revision** after comparables 3 and 5 were replaced and every concluded rent moved |
| **Morh Housing** | owner's checklist | `Owner's Checklist MORH (12.26).pdf` re-signed with "Scope of Work" newly ticked and the date moved to 12/26 — **under the same DocuSign envelope `BEEC3BD6` as the bound 12/16 copy** |

The envelope ID is the mechanism that makes a DocuSign signature non-repudiable: it binds a
signer to a specific document state. **Reusing one across changed content is the precise
failure it exists to prevent**, and Morh Housing does it on the very document whose function
is to certify what the package contains (M15).

Neither reader claims intent, and neither should. What is established is that in both
packages **a signature is affixed to content it demonstrably did not cover**, and in Morh's
case the same is true twice over.

**For the app:** every document it generates carries figures that a human then signs. If the
app can regenerate a document after certification without invalidating the signature block,
it can manufacture this defect. That is a design constraint, not a bug report.

---

## CORRECTION · M14 is ONE firm, not three — and that changes what it means

I recorded M14 as "two firms, three properties," then "three firms, four," then "three
firms, five." **That was wrong each time, and I did not verify it before asserting it.**

Every property carrying the malformed threshold statement is **Belfry Valuation**. Verified
directly — `pdftotext` on the first three pages of each filed study, grepping the firm name:

| property | job no. | firm |
|---|---|---|
| Friendship Court | 25-094 | Belfry Valuation |
| Newberry Arms | 25-095 | Belfry Valuation |
| Market Square | 25-123 | Belfry Valuation |
| Mapleview Towers | 25-175 | Belfry Valuation |
| Morh Housing | 25-184 | Belfry Valuation |
| Marine Terrace | 26-052 | Belfry Valuation |
| Woodland Towers | 26-069 | Belfry Valuation |

The sequential job numbers should have prompted the check before the claim. They did not.

**The same correction applies to the `/Title "April 14, 2008"` cross-link.** I wrote "two
properties, two different appraisal firms, one 2008 Word template still in circulation."
Both were Belfry, and Mapleview's reader found the identical `/Title` on **all** Belfry
PDFs. It is one firm's report template, not a template shared between competitors.

### What the corrected finding is

Weaker as an industry claim, **stronger and far more actionable as a defect report**: a
single appraisal firm's report template prints the mandatory 150% threshold statement
incorrectly, and has done so in **six of the seven** of its studies read here (Mapleview is
the exception — see below). It is one template, one fix, and it is currently in every RCS
that firm files.

**Crossroads of East Ravenswood is the control.** Its governing study is **Cornerstone's**,
and it prints **no** malformed threshold statement. One non-Belfry study read, and the
pattern is absent from it. That is a single data point, not a proof — but it is consistent
with the defect being Belfry's template rather than the industry's.

**What is still unknown:** whether other firms' templates carry it. Doyle, Novogradac, HCVA,
Renzi and VanHazinga all appear in this corpus. **No claim about them is supported.**

---

## Findings — Mapleview Towers (75567), 2026 - RCS

**SHOULD/FILED only — no sweep record.** Twelve candidate documents, the largest
study-selection problem in the corpus — and it resolves cleanly, which is itself the result.

### Study selection: every filename hazard in one package, and FILED = GOVERNS anyway

Ordered by transmittal date read off the page:

| # | file | transmittal | 1BR | kind |
|--:|---|---|--:|---|
| 1 | `Belfry/Engagement …` | 10/21/2025 | — | fee proposal ($4,500) |
| 2 | `Archive/4 - 25-175 … CT **OLD**.pdf` | 11/26/2025 | $3,200 | study |
| 3 | `25-175 … **CLEAR Narrative OLD**.pdf` | 12/08/2025 | $3,200 | study |
| 4 | `Archive/4 - **5**-175 … v2.pdf` | 12/15/2025 | $3,200 | study — **dropped digit in the job number** |
| 5 | `Archive/25-175 … CT.pdf` | 12/30/2025 | $3,200 | study |
| 6 | `Appeal/Exhibits/A - 25-175 …` | 12/30/2025 | $3,200 | **md5-identical to #5** |
| 7–9 | Gill Group reviews ×3 | 12/10/25, 12/19/25, 1/6/26 | — | CA reviews, all rejecting $3,200 |
| 10 | `Archive/25-175**R** … 04.29.26.pdf` | 04/29/2026 | $3,095 | study |
| 11 | `25-175 … **rev v3**.pdf` | **04/30/2026** | **$3,095** | **FILED and GOVERNS** |

**Two different files carry "OLD." The un-suffixed file is the fourth, not the newest. "R"
is the fifth, not the last. "rev v3" is the sixth.** Ordering by filename picks wrong four
different ways in one package.

**A duplicate-identifier trap worth carrying forward:** two *different* Gill Group letters
share the identifier `D4517N2346` — a 12-page 19 Dec review and a 9-page 6 Jan rejection.
Any tool keying documents on that identifier would collapse them.

**FILED = GOVERNS.** Gill accepted $3,095 on 11 May 2026; the executed HUD-92458 (2 Jun) and
Exhibit A carry $3,095. **The first package in this audit with no filed/governing
divergence.**

Money: the failed appeal for $3,200 cost **$105/unit/mo = $126,000/yr**. Against the prior
$2,448 the approved increase is **+$647/unit/mo = +$776,400/yr (+26.4%)**.

### The 150% test here is sound — and the first one that is

SAFMR $2,330 (ZIP 06901), 150% = $3,495; study and workbook agree to the dollar.
**Utility allowance is $0** — heat, hot water, lights and cooking are all in rent, so
Col. 6 gross = Col. 3 = $3,095 and **net equals gross by construction.** There is no basis
gap to make. One unit type, so no per-type failure is possible. Headroom **$400/unit/mo**,
132.8% of SAFMR, $480,000/yr aggregate.

**M13 and M14 are both ABSENT here** — the only Belfry package so far where they are. The
mechanism that prevents them is structural (UA = $0), not editorial, so it does not indicate
the template was fixed.

### Defects

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | **tenant notice bound as Exhibit E of the 4/30/26 package** | proposed rent | $3,095 | **$3,200** — the *rejected* rent; and the notice is dated 12/2/2025 with a comment period that **expired 1 Jan 2026** | team wrong |
| 2 | same | comment address ZIP | 06901 | **06604** (Bridgeport) | team wrong |
| 3 | same | signature | signed | typed name only | team wrong |
| 4 | `HUD 92458 …` (DocuSigned 12/3/25) | rents effective | 04/01/2026 | **04/01/2025** | team wrong |
| 5 | filed study grid | appraiser signature date | 4/29–4/30/2026, when the adjustments changed | **11/12/2025** | team wrong |
| 6 | filed study p.29 | line-7 rule vs application | 1%/decade as stated | 3.5% and 4.5% applied ≈ 1.8–2.3%/decade | team wrong (direction is conservative) |
| 7 | Exhibit A, submittal cover letter | addressee | Navigate, the CA | **self-addressed to Mapleview Towers Preservation, L.P.** — same defect in the December package | team wrong |
| 8 | filed study cert | licence status | current | `RCG.0001843` **"Expires: 04/30/26"**, certified 4/30/2026, accepted 5/11/2026 | open |
| 9 | filed study grid line 37 | "Other Electric" — subject Y, comps N | an adjustment (~$62, CT DOH 1BR) | **$0 on all five comps** — consistent omission, understates market rent | open |
| 10 | effective-age addendum | 2021 rehab cost | actual completed cost | $4,780,000 taken from a document titled **"Proposed Scope/Budget"** dated 4/22/2020 | open |
| 11 | `rev v3.pdf` | ModDate | ≤ 5/1/2026 | **7/6/2026** — after execution and CA acceptance; text identical to the bound copy | open |
| 12 | Gill reviews | running headers / letter date | Dec 2025 / Jan 2026 | "August 31, 2020" and "June 11, 2024" | cosmetic (CA) |
| 13 | studies #2, #3 | letterhead second-page date | 2025 | **"November 26, 2026" / "December 8, 2026"** | cosmetic (superseded) |
| 14 | all Belfry PDFs | `/Title` | — | **"April 14, 2008"** | cosmetic |
| 15 | `HUD Rent Schedule …eff. 04.01.26.pdf` | all fields | filled | **blank template, all zeros**, ModDate 2024 — a decoy file in the live folder | cosmetic |

**#1 is the most consequential.** The tenant notice bound into the April submission states
$3,200 — the rent Gill had rejected three times — and its comment period had closed four
months before the package was filed. The tenants were noticed for a different, higher rent
than the one requested, and had no open window to comment on the one that was.

**#10 repeats New Horizons and Newberry Arms:** a document titled *Proposed Scope/Budget*
cited as an actual cost.

### Patterns explicitly ABSENT

Glyph substitution: **none** — `CT26H037026` literally identical everywhere. Second firm's
rent conclusion: **none**. Incomplete grids: **none**. **False checklist certification:
none** — all 15 ticked App. 9-2-2 items verified present, and the two unticked ones
correctly unticked. **This is the first package to pass M15 cleanly.** Year-built/renovated
contradiction: **none**. Foreign *property* material: **none** — foreign content is confined
to metadata and Gill's stale headers.

**A CA approval is not evidence of cure (M11), fourth instance:** Gill's 11 May acceptance
rests on adjustments whose stated derivation still contradicts the grid (#6) — the exact
ground of Gill's own 6 January rejection.

### Instrument notes

- **Do not read identifiers from `Mapleview RCS.pdf`** — a Print-To-PDF whose text layer
  drops bullets, apostrophes and whole clauses. Use `rev v3.pdf` (vector, text-identical to
  the bound copy) for reading, the DocuSign-executed package for what was filed.
- **90 dpi could not separate `/26` from `/28`** in the licence expiry; 400 dpi could. Recorded
  because that call decides defect #8.
- **Could not determine:** whether $2,330 is the published FY2026 SAFMR for 06901 — **both
  sides agree, so a shared error is invisible**; whether the 7/6/2026 rewrite of `rev v3`
  changed anything (text identical; an incremental-update/trailer scan would settle it).

---

## Findings — Woodland Towers (no folder code), 2026 - RCS

**SHOULD/FILED only — no sweep record.** Dispatched to answer one question.

### The cross-check: the swap was ONE-DIRECTIONAL

**Woodland Towers' package contains no Crossroads material.** Grepped `Crossroads`,
`Ravenswood`, `IL060048014`, `800005826` and `Bjerke` across all 18 PDFs' text layers, all 18
`pdfinfo` metadata blocks, the OOXML `docProps` of three Office files, and OLE headers on
two `.doc` transmittals. **Zero hits** for Crossroads, Ravenswood, `IL060048014`, `800005826`.

`Bjerke` hits three times — all in **Cornerstone's own losing fee bid and rent grids for
Woodland Towers**, correctly naming Woodland Towers throughout. Neither was filed.

**So Crossroads received Woodland Towers' letter, and Woodland Towers received nothing of
Crossroads'.** M12 is not a mutual mix-up; it is one-way contamination.

**Woodland Towers' correct identifiers, for attributing that letter precisely:** contract
`IL06H121046`; iREMS **800006502** (confirmed against the 2020 executed schedule — *not*
800005826, which is Crossroads'); owner Woodland Towers Preservation, L.P.; 306 Pine Lake
Road, Collinsville IL 62234; 104 units, all 1BR; appraiser Aaron M. Zabel, Belfry, job
26-069. **The Crossroads letter's Woodland Towers content is genuine Woodland Towers data** —
it was a real letter for a real property, filed under the wrong one.

### But foreign material is present here too — from a third property

The filed study's section headings at package pp.20 and 22 read **"Site – Park Glen"** and
**"Improvements–Park Glen"**, with bodies that are Woodland Towers.

And the owner's checklist `/Title` is **`Exhibit 2 - RCS Owners Checklist - New Horizons
3.25.24.pdf`** — **byte-for-byte the same `/Title` Crossroads' checklist carries.** Two
properties are filing the same New Horizons-derived checklist template.

### The 150% test: basis gap present, does not flip the answer — but the UA is stale

SAFMR $910 (1BR), 150% = $1,365; study and workbook agree. **The transmittal's headline
table compares net $1,175 to gross $1,365** — the wrong basis, exactly as at Marine Terrace
and Morh. Two tables down the study does it correctly, and the workbook is correct
throughout. **Here the gap does not change the verdict.**

**Both use a stale UA**, though: $83 (2025) where the 2026 UAF signed 30 Apr sets **$89**,
which the rent schedule correctly carries.

| basis | gross/unit | headroom/unit/mo |
|---|--:|--:|
| study headline (net vs gross) | $1,175 | $190 — overstated |
| study/workbook gross @ UA $83 | $1,258 | $107 |
| **correct, @ UA $89** | **$1,264** | **$101** — 92.6% of cap |

One unit type, so no per-type failure is possible. **Passes on every basis.**

### Study selection and the second appraiser

The filed study is **26-069** (letter 20 Apr 2026), the only one transmitted; it governs.
Belfry had already delivered grids `25-227` on 14 Jan concluding the same $1,175, and
**Cornerstone concluded $1,120** on 18 Feb. Filing Belfry's rather than Cornerstone's is
worth **$55/unit/mo = $68,640/yr**. The owner held both conclusions in one workbook before
commissioning the full report from the higher one. **Third property with the
appraiser-shopping shape** (Noble Tower, Morh Housing, Woodland Towers).

### Defects

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | study App. 9-1-4 p.41 | contract number | `IL06H121046` | **`IL06N121046`** — 400 dpi; the diagonal-only glyph matches the N of "Name:" on the same line while the H of "FHA" two characters earlier shows a clear crossbar | team wrong |
| 2 | study transmittal p.2 | SAFMR table ZIP | 62234 | **62568** (Pana IL, Christian County) — once; the narrative has 62234 correctly | team wrong |
| 3 | **filed study, pp.20 & 22** | section headings | Woodland Towers | **"Site – Park Glen" / "Improvements–Park Glen"** | team wrong |
| 4 | study transmittal p.2 | threshold caption | "… < **150% OF** SAFMR GROSS RENT" | "… < SAFMR GROSS RENT · $130,832<$141,960" — **as captioned the claim is false**, SAFMR gross being $94,640 | cosmetic |
| 5 | study transmittal p.2 | headline comparison basis | gross vs gross | **net $1,175 vs gross $1,365** | team wrong |
| 6 | study Improvements p.22 | water | tenant pays electric hot water | "the property owner provides cold **and hot** water" — contradicts grid line 36, the adjustment narrative and Part B | team wrong |
| 7 | study adjustment narrative | cooling | wall A/C present | "**the subject units do not offer cooling units**" — contradicts Improvements, grid line 15 and Part B | team wrong |
| 8 | **study certification p.35** | prior services | disclose Belfry's own 14 Jan 2026 grid `25-227` on this subject | "**We have not provided any appraisal services involving the subject property in the three years preceding**" | team wrong |
| 9 | study App. 9-1-4 ¶3 | prior-service list | list `25-227` | blank | team wrong |
| 10 | study App. 9-1-4 ¶7/¶9 | inspectors / assistance | Zabel **and** Burgess inspected; Walsh and Burgess assisted | names Zabel alone; ¶9 blank — contradicts p.35 and the three-signature block | team wrong |
| 11 | study grid | signature date | ≥ the analysis it certifies | signed **3/26/2026**, but the numerically identical grid was delivered **1/14/2026** | team wrong |
| 12 | owner's checklist | licence copy "only if relying on a temporary licence" | unchecked — App. 9-1-4 answers **N**, permanent licence, no copy attached | **checked** | team wrong |
| 13 | HUD-92458, all three versions | FHA Project Number | populated or expressly N/A | **blank**; NHC put the contract number in Part I's *HAP Contract Number* field, which is the CA's field, not this one | team wrong |
| 14 | study + workbook | UA used in the threshold | $89 (2026 UAF, eff. 7/1/2026) | **$83** (2025) — never re-run at the operative UA | team wrong |
| 15 | **tenant notice** | execution | an executed copy | **`.docx` only, unsigned, undated — no executed tenant notice exists for this cycle** | team wrong |
| 16 | tenant notice | header identifier | 800006502 or none | stray **`914400000`** — matches nothing in ten years of this property's filings | open |
| 17 | tenant notice | agency name | "Housing and Urban Development" | "Department of **Urban Housing and Development**" | cosmetic |
| 18 | study narrative | Neighborhood | a complete sentence | "The subject property's location is considered to be **a.**" — in both package copies | cosmetic |
| 19 | owner's checklist | "Scope of Work" | checked | unchecked | cosmetic |
| 20 | owner's checklist | `/Title` | Woodland Towers | `…RCS Owners Checklist - **New Horizons** 3.25.24.pdf` | cosmetic |
| 21 | study grid line 7 | year-built adjustments | 1%/decade per the stated rule | comps 1–4 are 6–36 years from the 2016 renovation, unadjusted; only comp 5 adjusted | open |
| 22 | study line 31 | non-shelter services funding source | stated per §9-12 / App. 9-1-1 | +$30 to every comp, source never identified — worth $37,440/yr | open |
| 23 | Belfry engagement | scope | an engagement covering report 26-069 | only a **"Market Rent Grids (as-is)"** engagement exists; no 26-069 engagement letter in the folder | open |

**#8 and #9 are the serious pair.** The certification affirms no prior services on this
subject within three years, and Belfry had delivered a rent grid on this subject **three
months earlier** — a grid numerically identical to the one in the filed report. This is a
false statement in the appraiser's own certification, not a clerical slip, and #11 is its
companion: the grid carries a signature date two and a half months after the delivery of the
identical grid.

**#1 is `N` for `H` again** — the same substitution as Market Square's `CT26N037003`, same
firm.

**#17 is the third "Department of Urban Housing and Development"** after Crossroads. Same
tenant-notice template.

### Patterns explicitly ABSENT

Crossroads material: **none, in any form** — the clean negative this reader was sent for.
SAFMR divergence: **none**. Glyph substitution *on the grid*: **none** — at 700 dpi the
zeros of `IL06H121046` match those of "2502-0587" on the same page and are narrower than the
O of "OMB"; the H has a crossbar. The single corruption is #1. Incomplete grids: **none**.
Unsigned-live/signed-in-archive inversion: **none**. **Post-certification alteration: none**
— the only post-execution text is NHC's own Part F and Part I, the CA's fields. 24 CFR 245
sequence: **compliant** (notice 4/30 → period ends 5/30 → certification 6/18 → schedule
signed 7/16 → executed 7/17). CA refusal: **none for this cycle**. Year-built contradiction:
**none**. Rent-schedule arithmetic: **clean**.

### Instrument notes

- **The HUD-92458 needed all three readers.** The unsigned copy has 232 widgets but pdf-lib
  returns **empty `/V` on every one** — the values live only in the appearance streams, so
  `pdftotext -layout` is the correct reader. The signed copy is DocuSign-flattened to one
  widget. The executed copy is Print-To-PDF with zero widgets and 92 bytes of text; the
  reader located its added text by `pdftotext -bbox-layout` coordinates on a 612×792 page to
  prove which HUD field each entry occupies rather than inferring from reading order. **That
  is the right method and should be the default for flattened schedules.**
- **The grid and App. 9-1-4 are image-only scans at 169 and 99 ppi native.** Rendering above
  ~180 dpi upsamples; the N/H call rests on **stroke topology against same-line reference
  glyphs**, not on resolution. Worth stating plainly: 400 and 700 dpi crops of a 99 ppi scan
  add no information, and the finding stands on the comparison, not the magnification.
- The checklist's text layer is the known **offset-ASCII−29** font and unreadable as text;
  checkbox states are visible only in the raster (170 dpi).
- **`qpdf` is not installed in this container**, so a decompressed-stream sweep silently fell
  back to `cat` and **is not evidence**. The cross-check negative rests on the text layers,
  `pdfinfo` metadata and OOXML/OLE property reads, which were run directly. Recorded because
  a silent fallback that still exits 0 is exactly the failure shape this project has shipped
  before.
- **Could not determine:** whether $910 is the published FY2026 SAFMR for 62234 (**both sides
  agree, so a shared error is invisible**); whether 26-069 was a separate engagement or a
  second phase of the grids engagement; the funding source behind the +$30 services
  adjustment; the provenance of `914400000`.

---

## Findings — Fairview Homes (75920), 2025 - RCS

**SHOULD/FILED only — no sweep record.** The second targeted cross-check.

### Both cross-check answers: no reciprocity, and no harm to Fairview

**(a) No Woodbury / Lakeside material in Fairview's package.** Grepped
`woodbury|lakeside|75488|evergreen` case-insensitively across 16 PDFs' text layers, both
`.docx` unzipped, the `.doc` via `strings`, all nine xlsx decompressed, and a raw-byte pass
over every file; plus `pdfinfo` metadata on all 16 and `docProps` on both docx. **Zero hits.**

**(b) Fairview is missing nothing.** The five strays in Woodbury's folder are **md5-identical
to files still sitting in Fairview's own `Archive/Submission/Archive/`** — copies, not moves.
Fairview's *executed* originals are bound into its 74-page executed submission (DocuSign
`096AC106-…`): Exhibit 1 owner cover letter at pp.4–5 signed by David Pearson dated 4/4/2025,
Exhibit 2 checklist signed at pp.6–7, Exhibit 3 the RCS, **Exhibit 4 the Berkadia loan
991063295 at pp.72–74**. The Woodbury copies are the *unsigned* standalone twins.

**So M12 is one-directional in both tested cases.** Crossroads received Woodland Towers'
letter and gave nothing back; Woodbury received copies of Fairview's exhibits and Fairview
lost nothing. The mechanism duplicates outward from a source package; it does not swap.

### A third property carries the same checklist template

`Exhibit 2 - RCS Owners Checklist - Fairview Homes - 05.07.25.pdf` has
`/Title = "Exhibit 2 - RCS Owners Checklist - New Horizons 3.25.24.pdf"`, Author `mwyckoff`,
created 2024-04-15 — **identical to the `/Title` on Crossroads' and Woodland Towers'
checklists.**

**This is a second, separate template lineage, and the distinction matters:**

| lineage | trace | whose document | properties |
|---|---|---|---|
| appraiser's report template | `/Title = "April 14, 2008"` | **Belfry's** | Friendship Court, Morh Housing, Mapleview (all Belfry PDFs) |
| owner's checklist template | `/Title = "…New Horizons 3.25.24.pdf"`, author `mwyckoff` | **the owner/PM side's** | Crossroads, Woodland Towers, Fairview Homes |

The checklist is the owner's certification, not the appraiser's. Three properties filing from
one 2024 New Horizons clone is a finding about how *Related's* packages are assembled, and
it is independent of anything Belfry does.

### The 4BR is over its own cap on every basis

SAFMR (ZIP 07103): $1,790 / $2,250 / $2,560 — **identical** in study and workbook. Caps
$2,685 / $3,375 / $3,840; aggregate 150% GPR $433,875/mo.

The study's per-unit table (`25-007` p.3) prints `$2,450<$2,685`, `$3,275<$3,375`,
`$3,825<$3,840` — **net RCS rent against the gross 150% figure**, the same basis error as
Marine Terrace, Morh and Woodland Towers. Adding the UA — which the study's *own next table*
does — flips the 4BR:

| basis (UA source) | 2BR | 3BR | 4BR | aggregate |
|---|--:|--:|--:|--:|
| study, UA 76/91/131 | 2,526 (−159) | 3,366 (−9) | **3,956 (+116 OVER)** | +5,465 |
| workbook 4/3/25, UA 76/122/122 | 2,526 (−159) | **3,397 (+22 OVER)** | **3,947 (+107 OVER)** | +3,475 |
| **approved 5/7/25, UA 81/114/134** | 2,531 (−154) | **3,389 (+14 OVER)** | **3,959 (+119 OVER)** | +3,570 |

**Aggregate passes on all three; the 4BR exceeds its own cap on all three** — $119 × 20 units
= **$2,380/mo, $28,560/yr** at the approved UAs — and the 3BR on two of three.

**And three different UA sets feed the same test** across study, workbook and executed
schedule. That is a new sub-finding: the per-unit verdict here depends on which UA set you
pick, and the package contains three.

### Study selection — no divergence, but a $339,000/yr firm choice

| file | transmittal | conclusions |
|---|---|---|
| `Archive/Submission/Archive/Exhibit 3 - 25-007 …` | **3 Apr 2025** | 2,450 / 3,275 / 3,825 |
| `Archive/Belfry RCS/25-007R … (REVISED RCS).pdf` | **24 Apr 2025** | **unchanged** |

**FILED and GOVERNS: 25-007** — NJHMFA approved 19 May 2025 "based on 100% of Owner's RCS."
**Money moved by the divergence: $0.** 25-007R only adds a CoStar comparable-selection
justification and nudges grid line-44 adjusted rents; the conclusions and the entire SAFMR
table are byte-identical. No transmittal of 25-007R exists in the folder.

Earlier churn: **Renzi's grids (4 Dec 2024) concluded 2,350/3,000/3,600 = $387,750/mo**
against Belfry's $416,000/mo — **+$28,250/mo, +$339,000/yr** from filing Belfry.
**Fourth appraiser-shopping property** (Noble Tower, Morh, Woodland Towers, Fairview).

### Defects

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | rent schedule eff. 5/7/25, HUD-9637 Exhibit A p.4 | 4BR gross rent | $3,959.00 — matches the approval letter and HUD-92458 p.2 | **$3,950.00** | team wrong |
| 2 | RCS certification p.52 | Zabel's NJ licence | `TP018-25`, per the transmittal, App. 9-1-4 and the attached permit | **`TP10608`** | team wrong |
| 3 | **App. 9-1-4** | "Did you prepare the RCS under a temporary license?" | **Yes** — a NJ Temporary Visiting Practice Permit `TP018-25` (26 Feb–26 Aug 2025) is attached directly below it | **blank** | team wrong |
| 4 | App. 9-1-4 | "Permanent License No. / Issuing State" | Illinois Cert. Gen. `553.002682` | **`TP018-25` / New Jersey** — a temporary permit in the permanent field | team wrong |
| 5 | transmittal to NJHMFA | governing instrument | the Basic Renewal Contract executed 27 Apr 2015 — the source of the §5b(2) text it quotes | "HAP contract … dated **03/25/2009**", which runs to 2029 with a March anniversary | team wrong |
| 6 | RCS p.13 unit table | non-revenue unit type | **2BR** — HUD-92458 Parts A and D say "Superintendent Unit / 2 BR" in both FY2024 and FY2025 | 3BR; and NRA 121,128 sf vs 121,008 | team wrong |
| 7 | owner's checklist | "Scope of Work" | checked — the study carries a Scope of Assignment at p.1 | unchecked | cosmetic |
| 8 | tenant notice 4/30/25 | column header | "Proposed Rent" — the column holds the new rent | **"RCS Increase"** over $2,450/$3,275/$3,825 | team wrong |
| 9 | tenant notice | 24 CFR 245 sequence | notice of *intention to submit*, served before submission | dated 4/30/25 and says "**on April 4th, 2025 we submitted**" | team wrong |
| 10 | tenant notice | signature date | ≥ the notice date | signed **29 April**, notice dated 30 April | cosmetic |
| 11 | NJHMFA transmittal p.1 | letter date | May 23, **2025** | "May 23, **2024**" | cosmetic (CA) |
| 12 | NJHMFA transmittal p.1 | addressee | Robert **Delaney** | "Robert **Delancy**" | cosmetic (CA) |
| 13 | transmittal | CA contact | Nagy **Srinivasulu** | "Nagy **Srinivaulu**" | cosmetic |
| 14 | grids (exec pp.35/43/51) | signature date | ≥ the date of last data | signed **3/6/2025** while the Scope says data researched through **3 Apr 2025** | open |
| 15 | 25-007R grids | signature date vs revised figures | re-dated on revision | still 3/6/2025 over line-44 figures changed 24 Apr | open (unfiled) |
| 16 | rent effective date vs approvals | sequence | — | rents effective **5/7/25**; CA decision **5/19/25**; the 30-day comment window ran to ~5/30/25 | open |

**#3 and #4 are the sharpest pair.** The appraiser worked under a **temporary** NJ practice
permit — the permit is physically attached to the form — and the form's temporary-licence
question is **blank** while the temporary number is typed into the *permanent* licence field.
This connects the checklist licence-box findings at Woodbury, Crossroads and Woodland Towers,
where the box was ticked against a **No** answer: here the answer should have been **Yes**,
and was not given at all. **On this package the checklist box would have been correct.**

**#9 and #16 are a 24 CFR 245 sequence problem**, not a clerical one: the tenant notice
announces a submission already made, and the rents took effect before both the CA's decision
and the close of the comment window.

### Patterns explicitly ABSENT

Woodbury/Lakeside material: **none** — the negative this reader was sent for. SAFMR
divergence: **none**. Glyph substitution in `NJ390013022`: **none** — checked character by
character at 400 dpi across the transmittal, Exhibit 1, both studies, the 92458 and Exhibit
A. Year-built contradiction: **none** (1980 / renovated 2015 / age 45, consistent across
narrative, Improvements and all three grids). Incomplete grids: **none** — all three signed,
dated, "Using HUD's Excel form" ticked, Adjusted Rent and Estimated Market Rent present.
CA refusal: **none in this folder**, so there is no cured/uncured objection to test.

### Instrument notes

- **A self-correction worth copying.** The temporary permit's address reads "Fairview Homes,
  **298 18th Ave.**" — at 100 dpi the reader took it for "16th" and flagged a mismatch, then
  re-rendered at 400 dpi and withdrew it. The site is bounded by 17th Ave north and 18th Ave
  south. **The withdrawn finding is recorded here because a reader who had stopped at 100 dpi
  would have shipped it.**
- `Fairview Homes Rent Schedule eff. 5.7.25.pdf` is Print-To-PDF with pp.2–3 **rasterised —
  zero widgets and zero text layer**; read at 150 dpi and cross-checked against the 19 May
  approval packet.
- The checklist text layer is the **offset-ASCII−29** font (`$SSHQGL[` = `Appendix`) and
  carries **no checkbox state at all** — box states read from a 110 dpi raster.
- **Could not determine:** whether 25-007R was ever transmitted or why it was produced;
  whether tenant rent portions actually changed on 5/7/2025; **which of the three UA sets the
  CA applied to its own 150% screen** — the approval letter states no SAFMR arithmetic.

---

## Findings — Oak Center (75926), 2026 - RCS

**SHOULD/FILED only — no sweep record.** Belfry, job 25-183.

### The tightest aggregate in the corpus, and a 2BR over its own cap

Governing study (revised 21 Jan 2026): owner's gross renewal potential **$281,487/mo** vs
150% of SAFMR gross **$291,420/mo** — headroom $9,933/mo, **$130.70/unit/mo, 3.41%**. The
aggregate is computed **gross-to-gross and is correct in basis**. On the UAs the CA actually
approved (FY2026 $39/$53/$57/$65/$70, not the FY2025 set the study used) it is $9,866/mo.
**Passes either way.**

**Per unit type it does not.** The page-two table compares net RCS rent to the gross 150%
figure. On a consistent gross basis: 1BR −$21, **2BR $3,699 vs $3,675 → over by $24**,
3BR/3BR-TH/4BR clear. On approved FY2026 UAs the 2BR overage is **$28/unit/mo, $6,720/yr**.

**The arithmetic of the concealment is exact here:** the printed 2BR margin is $25 and the
omitted UA is $49. **The basis gap is twice the margin** — it is precisely what makes the row
read as compliant.

**And the filed version printed the overage on its own page.** Filed v1's page two reads
`2BR $4,050 > $3,675`, and its aggregate headroom was **$108/mo in total — $1.42/unit/mo**,
the tightest aggregate margin in this corpus by an order of magnitude. It was filed anyway.

### A third workbook with the two columns adjacent and never compared

`Oak Center Rent Grid Analysis - 10.25.xlsx` uses the **correct gross basis** and computes
**only the aggregate**. It holds `Q29 = $3,699` and `U29 = $3,675` **adjacent** and never
subtracts them — the identical shape as Morh Housing's `Q`/`U`, and the third workbook in
this pattern after Morh and Marine Terrace.

It also counts **7** 3BR units (including the non-revenue manager's unit) on both sides,
inflating headroom by $333/mo, and inflates "Current GPR" by $3,911/mo against the FY2025
executed schedule's 6 Section 8 3BR units.

### THE FIRST SAFMR DIVERGENCE IN THE CORPUS — three sets in one workbook

Every package read until now had the study and the workbook agreeing on SAFMR. This one
carries **three different sets**:

| source | 1BR / 2BR / 3BR / 4BR |
|---|---|
| Belfry study | $2,010 / $2,450 / $3,130 / $3,710 |
| Novogradac report | $1,920 / $2,340 / $3,010 / $3,560 |
| the workbook's own "Novoco" sheet | **$2,201 / $2,682 / $3,432 / $4,077** — **+9.5%** over Belfry's |

Which is HUD's published FY2026 figure is **open**, and it is not a small question: the
spread between the lowest and highest set moves the cap by roughly 14%.

### Study selection

| file | transmittal | 1BR/2BR/3BR/3BR-TH/4BR |
|---|---|---|
| `Archive/25-062 …` | grids only, **undated** signature line | 3,000 / 3,525 / 4,100 / 4,275 / 4,935 |
| `Grids/25-160 … (10.14)` | grids only, **undated** signature line | 2,950 / 4,050 / 4,475 / 4,675 / 4,900 |
| `Grids/Oak Center (Novoco) Preliminary Grids` | 28 Oct 2025, **self-declared non-HUD-compliant** | 2,750 / 3,450 / 4,000 / 4,100 / 4,850 |
| `Archive/25-183 … (v1)` ≡ `RCS Submission/Archive/…` (md5 `a1ec9edd`) | **4 Dec 2025** | 2,950 / 4,050 / 4,500 / 4,675 / 4,900 |
| `25-183 … (revised 1.21)` | **21 Jan 2026** | 2,950 / 3,650 / 4,300 / 4,550 / 4,900 |

**FILED:** v1, bound pp.9–86 of the signed submission (DocuSign `E4241B09`, 16 Dec 2025).
**GOVERNS:** the 21 Jan revision — the executed FY2026 HUD-92458 carries its rents, Branch
Chief signature 9 Apr 2026. **Money moved: −$9,825/mo = −$117,900/yr.**

### Defects

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | **owner's transmittal** | 150% assertion | qualified — the 2BR type exceeds | "**The Project's gross rent does not exceed 150% of the SAFMR**", unqualified | team wrong |
| 2 | study v1 + revised, p.2 | per-type basis | gross vs gross | net vs gross | team wrong |
| 3 | study v1 + revised, p.2 | threshold caption | "…150% OF SAFMR GROSS RENT" | "…SAFMR GROSS RENT" — as written asserts $281,487 < $194,280, false | team wrong |
| 4 | both studies, Improvements | year built | 1971 (the 2021 RCS says "built in 1971/2016") | 1971 / age 54 in Improvements, **1992/2016** and **1992/2017** on grid line 7, and five narratives say "reportedly built in 1992" | team wrong |
| 5 | both, unit breakdown | Section 8 total | 76 | **77** — the column sums to 76 | team wrong |
| 6 | both, unit breakdown | caption | "excluding one **three**-bedroom unit" | "one **two**-bedroom unit" | team wrong |
| 7 | **v1, all five grids** | "Grid was prepared:" | one box ticked | **both blank** (the revision ticks "Using HUD's Excel form") | team wrong |
| 8 | revised, all five grids | appraiser signature date | ≥ 21 Jan 2026 | **11/17/2025** — on grids whose comps 3 and 5 were replaced and which carry **Jan-26** lease dates | team wrong |
| 9 | revised, Scope | research window | past 4 Dec 2025 | "researched from October 30, 2025 through December 4, 2025" while the grids carry Jan-26 data | team wrong |
| 10 | revised study | revision disclosure | state that it is a revision | **no occurrence of "revis-" anywhere**; effective date still 11/17/2025 | team wrong |
| 11 | both, certification | prior services | disclose `25-062` (Jun 2025) and `25-160` (Oct 2025) | "We have not provided any appraisal services involving the subject property in the three years preceding" | **open** — a same-engagement reading is possible |
| 12 | owner's cert. of compliance, both copies | project no. | `CA39L000090` | **`CA39L000060`** — 6 for 9 | team wrong |
| 13 | owner's cert. (signed) | project name | Oak Center 1 | **N/A** | team wrong |
| 14 | owner's cert. (signed) | signature date | ≤ envelope completion | typed **3.30.2026**; DocuSign ModDate and mtime **3/26/2026** | team wrong |
| 15 | checklist | "Scope of Work" | ticked | unticked | cosmetic |
| 16 | checklist | appraiser's licence | tick only if temporary | **ticked**; Zabel holds permanent CA Certified General #3014035 | cosmetic |
| 17 | FY2026 executed RS p.1 | FHA project number | `CA39L000090` | blank | team wrong |
| 18 | tenant notice, Dec 2025 | 3BR proposed rent | $4,500 (v1 study) | **$4,475** — from the `25-160` grids | team wrong (superseded) |
| 19 | tenant notice, **both copies** | signature | signed | **unsigned** | team wrong |
| 20 | `Archive/…Tenant Notice…December 2025.pdf` | identity | the December notice | **is the 2 Feb 2026 revised notice** | cosmetic |
| 21 | workbook, both sheets | SAFMR | one ZIP, one FY, one table | **three different sets** — see above | open |
| 22 | study `/Title`, `/Author` | metadata | Oak Center / Belfry | `/Title` "April 14, 2008", `/Author` "**Mark Burgess**" — named nowhere in this report | cosmetic |
| 23 | cover page | county | Alameda | "ALMEDA COUNTY" — 1 of 47 occurrences | cosmetic |

**#1 is the finding.** The *owner* certifies without qualification that the project's gross
rent does not exceed 150% of SAFMR, while one unit type does. Every other instance of M13 is
an appraiser's table; this one is the owner's own assertion to the CA.

**#8 shares Morh Housing's exact signature date, 11/17/2025** — two different Belfry
properties, both revised in January, both carrying grids signed 17 Nov 2025.

**#23 repeats Morh Housing's "ALMEDA COUNTY".** Same firm, same typo, two Oakland properties.

### Two readers disagreed, and the more cautious one is right

Woodland Towers' reader called the identical prior-services certification **`team wrong`**;
Oak Center's called it **`open`**, on the ground that a grid delivered under the same
engagement may not be a separate "appraisal service."

**`open` is the better call, and Woodland Towers' row is downgraded to match.** The
distinction turns on what "appraisal services involving the subject property" means under
USPAP's disclosure obligation when the prior product is a phase of the same assignment —
which this ledger has not established. The underlying facts are solid at both properties and
are unchanged; only the verdict moves.

### Patterns explicitly ABSENT

Foreign-property material: **none** — every page of the 100-page package and the 13-page debt
exhibit is subject-only; the only foreign metadata is the stale `/Title` and `/Author`.
Glyph substitution in `CA39L000090`: **none** across 14 instances — the one identifier defect
is the digit error at #12. UA current-vs-proposed swap: **none**. Incomplete grids: **none**.
Unsigned-live inversion: **none** for owner documents (the tenant notice is the exception,
#19). Byte-identical duplicate masquerading as a revision: **none** — the only md5 collision
is v1 stored in two archive folders. **No CA or HUD letter of any kind exists in the cycle** —
nothing documents *why* the study was revised.

### Instrument notes

- The filed grid's embedded image is natively **107 ppi** (694×889) — 200 dpi upsamples it.
  Every figure quoted was legible, but **a finer glyph call than `1992/2016` would not be
  safe from that copy.** Fourth property where the filed copy is the least legible.
- **A documented attempt to close H8's question, and why it failed:** HUD's API returns
  `{"error":"Unauthenticated"}` without a key, and `huduser.gov` `.xlsx` downloads return
  **HTTP 202 through the proxy**. The published FY2026 SAFMR for 94607 could not be fetched.
  This is the concrete blocker on the SAFMR-vintage and SAFMR-value questions.
- **Also open, and it constrains M13 (see below): whether HUD applies the 150% cap per unit
  type or only in aggregate.** The overage is arithmetically certain; its regulatory
  consequence is not.

---

## Mechanism roll-up after the second reading wave

The counts in the M-headings above are updated; this block records what the second wave
added and, where a claim moved, why.

### M12 — restructured into two distinct lineages

The original framing ("foreign material reaches filed or governing documents") conflated two
things the second wave separated:

**(a) Foreign content bound into a document — 5 properties**

| property | what | where | filed? |
|---|---|---|---|
| Woodbury Oakwood | Fairview's cover letter + mortgage statement | live folder | **no** |
| Noble Tower | "Hostmark of Village Cove, Poulsbo WA"; "Raymond J. Lord Manor" | filed study | yes |
| Newberry Arms | Friendship Court's 80-unit budget **and a per-unit cost derived from it** | governing revision | governs |
| Crossroads | Woodland Towers' **entire transmittal**, DocuSign-executed | governing study's sole transmittal | governs |
| **Woodland Towers** | **"Site – Park Glen" / "Improvements–Park Glen"** section headings | **filed study** | yes |

**(b) Template lineage in metadata — two separate templates, 6 properties**

| template | trace | whose | properties |
|---|---|---|---|
| appraiser's report | `/Title "April 14, 2008"`, `/Author "Mark Burgess"` | **Belfry's** | Friendship Court, Morh, Mapleview, Oak Center (and all Belfry PDFs) |
| **owner's checklist** | `/Title "…RCS Owners Checklist - New Horizons 3.25.24.pdf"`, author `mwyckoff` | **the owner/PM side's** | **Crossroads, Woodland Towers, Fairview Homes** |

The second lineage is the more interesting one: it is the *owner's* certification document,
cloned from a 2024 New Horizons file, filed under three different properties. That is a
finding about how Related's packages are assembled and is independent of any appraiser.

**Both tested cross-checks came back one-directional.** Woodland Towers holds nothing of
Crossroads'; Fairview holds nothing of Woodbury's, and the Woodbury strays are md5-identical
*copies* of files Fairview still has, whose executed originals are properly bound into
Fairview's own submission. **The mechanism duplicates outward from a source package; it does
not swap.**

### M14 — one firm, and the denominator now matters

Nine Belfry packages read. **Seven print the malformed threshold statement** (Friendship
Court, Newberry Arms, Market Square, Marine Terrace, Morh, Woodland Towers, Oak Center).
Two do not: **Mapleview**, where the utility allowance is $0 so net equals gross by
construction and there is no basis to mismatch; and **Fairview**, whose per-unit table
carries the basis error but whose caption was not separately reported.

The exception proves the shape: Mapleview is clean **structurally, not editorially**. Nothing
suggests the template was fixed.

**Crossroads remains the only non-Belfry study read, and it is clean.** One data point.

### M15 — 9 properties

Woodbury Oakwood, Friendship Court, Newberry Arms, Market Square, Crossroads, Marine
Terrace, Woodland Towers, Fairview Homes, Oak Center. **Mapleview is the only package to
pass it cleanly** — all fifteen ticked items verified present, both unticked ones correctly
unticked.

Fairview inverts the usual shape and is worth separating: elsewhere the licence-copy box is
**ticked against a "No" answer**; at Fairview the appraiser genuinely worked under a NJ
**temporary** practice permit — physically attached to the form — the temporary-licence
question is **blank**, and the temporary number is typed into the *permanent* licence field.
**There the box would have been correct.**

### A new observation: appraiser shopping is now 4 properties

Noble Tower (4 quotes, $1,000/unit spread), Morh Housing (Belfry vs Novogradac), Woodland
Towers (Belfry $1,175 vs Cornerstone $1,120 — **+$68,640/yr** from filing the higher), Oak
Center (Belfry vs Novogradac), Fairview Homes (Belfry vs Renzi — **+$339,000/yr**). In each,
two or more conclusions were held in one owner's workbook before the higher was commissioned
as the full report. **No intent is claimed and none should be** — commissioning competing
scopes is ordinary. It is recorded because the spread is large relative to the margins these
packages clear the cap by.

### What the second wave did NOT find

No new glyph shape beyond `N`-for-`H` (Market Square, Woodland Towers — both Belfry) and a
digit error (`CA39L000060` for `…090`). **No thousands-separator claim was made by any of the
five readers**, which is M8 holding. No post-certification alteration beyond the two already
recorded — Woodland Towers was checked and came back explicitly clean.

---

# THREE-WAY CLOSURES — the OURS leg landed (night-1, 89 packages)

The Mac swept 89 packages against the app frozen at `ccc4568`. I have SHOULD for 28 of them.
This block closes what the sources support and says plainly what they do not.

## First: most of the "differences" are not defects

**304 rows have a value on both sides that differ.** Classified:

| class | rows | what it is |
|---|--:|---|
| unit-type label (`1BR/1BA` vs `1-Bedroom` / `1BR` / `1B-Elderly`) | **120** | the app synthesises a type string; the filed doc uses free text. **Not a defect on either side.** |
| **money or allowance** | **76** | **the actual signal** |
| row alignment / count | 43 | extractor misalignment, see H9 |
| checklist heading whitespace / curly apostrophe | 18 | normalisation |
| `property.name` | 13 | mixed; at least one is an un-decoded ASCII−29 string |
| everything else | 34 | scattered |

**46% of the adjudicable set is normalisation noise.** Any headline built on "2,156 values
differing" or even "285 both-sides differences" overstates the finding by roughly a factor of
four. The number that matters is **76**.

## H9 · The extractor, not the app — four separate harness bugs the sweep exposed

**(a) A one-row offset in THEIRS, across at least four packages.** Marine Terrace 2026 is the
clearest: `THEIRS unit.1.rent 3600` is OURS' unit.0, `THEIRS unit.2 5150` is OURS' unit.1,
`THEIRS unit.3 6850` is OURS' unit.2, and OURS' unit.3 is empty. Same shape at Peterson
Plaza, Marine Terrace 2021 and Morh Housing. **These rows are not disagreements; they are the
same values read one row apart.**

**(b) OURS is offset at Westwood Village 2025**, the other direction: OURS `1120,1120,1570,
1570,1850` against THEIRS `930,1120,1120,1570`. Ours drops the first value. So the offset bug
exists on **both** sides and cannot be assumed to be the filed document's fault.

**(c) A comma parsed as a decimal point.** Marine Terrace 2021 yields `THEIRS unit.1.gross
2.078` and `unit.3.rent 3.000` — these are `2,078` and `3,000`. **This is M8's mechanism
biting our own reader**: the separator question was closed for *documents*, but `extract.js`
is still mis-parsing it.

**(d) The ASCII−29 decode is applied inconsistently.** Oceanport's checklist yields THEIRS
`2FHDQSRUW6HQLRU&LWL]HQV`, which decodes to `OceanportSeniorCitizens` — **matching OURS
except for a trailing contract number.** The decode ran on Lansing Manor and Holly House and
did not run here. A known trap, half-handled.

**Every one of these manufactures false differences.** They must be fixed before any
difference count is quoted to anyone.

## M7 confirmed at scale — the app still does not build a package

**39 of 89 packages produced nothing comparable at all.** Among the 28 I have sources for,
`notGenerated` runs to 4–8 documents each; `coverLetter`, `rcsStudy`, `notes` and `sections`
are absent in nearly all of them. Three of my read packages produced **nothing**:

| package | status |
|---|---|
| Crossroads of East Ravenswood 2026 | **BLOCKED** — app generated nothing comparable |
| Woodland Towers 2026 | **BLOCKED** — app generated nothing comparable |
| North Park 2025 | **BLOCKED** — no document the filed package also has |

**These are BLOCKED, not done.** No verdict is possible on them.

## Verdicts closed

### app RIGHT, team WRONG — the app caught a filed defect (3)

| package | evidence |
|---|---|
| **Marine Terrace 2026** | `total.units` OURS **444**, THEIRS **441**. My hand read (defect #4) found the filed Part A omits the non-revenue 2BR/3-unit row and should read 444. **The app produced the correct number.** Its gross figures `3716 / 5302 / 7028` also reproduce my hand-computed gross exactly — including the **$7,028** 3BR that M13 turns on. |
| **Mapleview Towers 2026** | `unit.0.proposed` OURS **3095**, THEIRS **3200**. $3,095 is the filed *and* governing conclusion; **$3,200 is the rent Gill rejected three times**, which the team nonetheless bound into the package as the tenant notice (my defect #1). **App right, team wrong.** |
| **Oak Center 2026** | OURS `3650 / 4300 / 4550` = the **governing** 21 Jan revision. THEIRS `4050 / 4475 / 4675` = the **superseded filed v1**. The app read the study that governs; the filed package did not. |

**Morh Housing 2026** is the same shape — OURS `4475 / 5100` is the governing 21 Jan revision,
THEIRS `4675 / 5275` the filed 4 Dec study — but its `unit.2` rows are row-shifted (H9a), so
**I am recording the study-selection call as correct and leaving the UA rows open.**

### app WRONG (3)

| package | evidence | money |
|---|---|--:|
| **Noble Tower 2024** | OURS `total.contract_rent` **604,500**, THEIRS **636,675**. Both divide by the same 195 units: OURS used **$3,100/unit**, the filed used **$3,265**. $3,265 is the study's conclusion. **$3,100 is HCVA's quote** — one of the four competing numbers in the owner's appraiser-shopping workbook. **The app took a rejected bidder's figure instead of the study conclusion.** Not a row offset: the unit count is identical on both sides. | **−$32,175/mo** |
| **Market Square 2026** | OURS **2,375**, THEIRS **2,325**. $2,375 is the *filed* 24 Sep study; **$2,325 is the 21 Nov revision that governs**. The app picked the superseded study — the H5 failure, made concrete. | $50/unit/mo |
| **Westwood Village 2025** | OURS' SAFMR column is offset one row against THEIRS (H9b). The app's own reader is misaligned. | — |

Noble Tower is the most serious finding in this block. **It is the first case where the app
selected a number that exists nowhere in the filed package** — not a stale study, not a
mis-read row, but a losing bid sitting in the same workbook.

### both wrong / the package contradicts itself (1)

**Friendship Court 2026** — OURS UA `61 / 85 / 100 / 107` is the **study's** set; THEIRS
`66.02 / 82.07 / 108.91 / 124.47` is the **workbook's**. My hand read found a **third** set on
the executed schedule (`65 / 83 / 105 / 118`) and could not reproduce it from any support in
the folder (defect #6). Neither leg is wrong; **the package genuinely carries three utility
allowance sets** and the app picked one of the real ones.

### Already closed earlier, unchanged

Colonial Village 2026 (the new record shows only a $1 rounding difference on UA/gross),
Northcross 2024, Riverwood 2025, Westwood Village 2020.

## Not closed — and why

**Thirteen packages have a sweep record and a SHOULD, and I am NOT issuing a verdict**:
Circle Park, Oceanport Gardens, Lansing Manor, Clinton Manor, Holly House, Peterson Plaza,
Burt Farms I, Sycamore Green, New Horizons, Oaks on North Plaza, Hampshire House, Woodbury
Oakwood, Noble Tower's remaining rows.

Their money rows are real (Lansing UA 85 vs 116; Holly House 61/64 vs 38/53; Sycamore SAFMR
990/1230 vs 1050/1310; New Horizons proposed 3150/4000/4350/5450 vs 3500/4300/5000/6000), but
**adjudicating them requires matching each figure against the specific SHOULD values in that
property's section above, and several sit inside the H9 offset.** Calling them now would be
guessing which leg is displaced. They need one focused pass each, after H9(a)–(d) are fixed —
because the fix will retire an unknown fraction of them outright.

**H7 confirmed as predicted, at cost:** the Mac swept both folders for Colonial Village,
Riverwood, Lansing Manor and Fairview Homes. Four packages driven twice, four extra
`ZZ-CORPUS-*` properties written to the live account.

---

## The blocked half, adjudicated — 52 is a DEFECT, not an inventory error

The open question on night-1 was whether the 52 blocked packages are real filed packages or
staging debris. **They are overwhelmingly real.** Adjudicated against the corpus:

| bucket | count | what it is |
|---|--:|---|
| **real filed package, app produced nothing comparable** | **39** | **a genuine app defect** |
| cycle carries no filed documents at all | 8 | correctly blocked — nothing existed to compare |
| no manifest cycle (Village Court, null) | 1 | inventory |
| **duplicate-copy collision — see H10** | **4** | harness |

**39 of 52 — 75% — is the app failing on a package that has filed documents to compare
against.** Several carry the full set: North Park 2025 (5 documents), Riverwood 2020 (4),
Burt Farms I 2019 (4), Ebony Gardens 2018 (4), Oak Center 2021, Morh Housing 2021, Northgate
Terrace, Mapleview 2020, Westwood Village 2020, Shiloh Village, The Pines.

**The "Cherry Garden cohort" is not staging debris.** The uncoded folders carry 1–7 filed
documents each, and two spot-checks on disk settle it:

- `Gates Manor - Section 8/2026 - RCS/` — **`Gates Manor - RCS Submission Package (signed).pdf`**, a signed Appendix 2, the RCS analysis workbook, a tenant notice, and `RCS`/`RCS Package`/`UAF` subfolders.
- `Manhattan Plaza - Section 8/2022/` — **`MP_Fully Executed RS 2022.pdf`**, a signed rent schedule, owner's checklist, cover letter, 30-day notice, Exhibit A, compliance certificate, and the CA's final Mark-to-Comp notification as a saved `.msg`.

These are complete filed packages. The missing code prefix is a **folder-naming state**
(H7: a rename migration caught mid-flight), not a signal about content.

### The honest read against my earlier deflation

Last block I cut the "2,156 differing values" headline down to 76 real money rows, because
46% of it was label formatting. **This one does not deflate.** Taking 39 out of 52 and adding
the 39-of-89 that generated nothing at all, **M7 is confirmed at scale and it is the
dominant finding of the whole sweep**: the app does not build a package. Comparing the
values it does produce is secondary to that.

## H10 · A package that compares fine from one folder produces nothing from its byte-identical twin

Four packages were swept twice under H7's duplicate folders. **In every case the coded path
compared and the uncoded path produced nothing:**

| package | coded folder | uncoded twin |
|---|--:|--:|
| Colonial Village 2026 (RCS) | **88 compared** | **0** |
| Riverwood 2025 - RCS | **26 compared** | **0** |
| Lansing Manor 2026 - RCS | **87 compared** | **0** |
| Fairview Homes 2025 - RCS | **109 compared** | **0** |

**The inputs are byte-identical** — H7 established that by `cmp` on the file trees, differing
only in Excel lock files. So the documents cannot explain it. Something in processing the
*second* copy of the same property fails, and the most likely candidate is a collision on
the derived property name in the live account — which is exactly the surface `10ff2fa` just
rewrote for cleanup.

**Consequence:** these 4 are not app failures on those packages, and they should come out of
any blocked count. They are the second cost of the duplicate manifest entries, after the
wasted Mac time and the extra `ZZ-CORPUS-*` records. **Dedupe the manifest and this class
disappears.**

**Worth testing directly on the Mac when convenient:** drive one property twice in a single
run under two names and see whether the second produces nothing. If it does, H10 is a live
bug in the driver that has nothing to do with the corpus — it would fire on any re-run.

---

# ⚠ MAJOR CORRECTION — I had the governing rule wrong, and I could have checked it all along

H8 said the current Chapter 9 "cannot be closed from inside this corpus." That was true of the
corpus and **false of this container**: `WebFetch`/`WebSearch` were available the whole time
and I never loaded them. I marked the question as gating six properties and left it open for a
day. The guidebook took four minutes to fetch.

**Source now in the repo:** `docs/lanes/reference/hud-ch9-150-percent.md` — verbatim extract of
the **Section 8 Renewal Guidebook, March 2023**, 174pp, from hud.gov.

## There are TWO different 150% rules and I conflated them

| | **Section 9-14** | **Section 3-4 / 3-5** |
|---|---|---|
| name | Mandatory Market Rent **Threshold** | 150 Percent Rent **Cap** |
| basis | 150% of **SAFMR** | 150% of **FMR** |
| applies to | all contracts except MTM | **only MUTM under Option One-A** |
| consequence | **HUD commissions its own third-party RCS** | **an actual cap on the renewal rent** |

**Everywhere this ledger says "the cap," "over the cap," "clears the cap," "headroom under the
150% cap," it means the 9-14 threshold — which is not a cap.** Exceeding it does not make a
package non-compliant and does not cap anything. It triggers HUD ordering its own study
(9-14.C). The margins I recorded are still meaningful — they are the distance before HUD
commissions a competing appraisal, which is a real commercial event — but the word was wrong
and the word carried a claim.

## M13 IS WRONG — there is no per-unit-type test

Section 9-14.B, verbatim:

> **Step 1:** *"…compute the gross renewal rent for the subject project's assisted units by
> multiplying the RCS rent by the number of units for each renewal type, and by calculating a
> monthly total gross rent."*
>
> **Step 3:** *"…compare the gross renewal rent determined under Step 1, with the SAFMR gross
> rent for the relevant zip code as determined under Step 2."*

HUD's own worked example totals two unit sizes into one Gross Renewal Rent ($127,875) and
compares it to one 150%-of-SAFMR figure ($144,900). **The test is aggregate and unit-weighted.
No per-bedroom-size comparison exists in the procedure.**

**So the six per-unit-type "overages" in M13 are not compliance failures.** Friendship Court's
1BR, Newberry Arms' 1BR, Marine Terrace's 3BR, Morh Housing's 3BR, Fairview Homes' 4BR and
Oak Center's 2BR — **every one of those packages passes the actual test in aggregate**, which
this ledger already verified property by property.

**M13 is downgraded** from "gates six properties, the highest-value unknown in the audit" to:
*several studies print a per-unit-type table HUD does not require, and compute it on a
mismatched basis.* That is a presentation defect in an optional table. The two-property bar is
met, but the severity was mine and it was invented.

**M14 survives and is now better grounded**, because gross is defined: Step 1 says *"Include
the most recent Utility Allowance in the calculation."* A comparison of net against gross is
wrong on the binding test. But **at aggregate level only Marine Terrace's workbook does it**
($2,258,550 net vs $2,431,620 gross) — Morh, Woodland Towers and Oak Center compute the
aggregate correctly and err only in the optional per-type table. **One property at aggregate
is below the bar; recorded as a single instance, not a mechanism.**

## M17 · Stale utility allowance in the threshold computation — 2 properties, with a citation

Section 9-14.B Step 1, verbatim:

> *"Include the most recent Utility Allowance in the calculation as indicated. **If the Utility
> Allowance is being adjusted concurrently with the HAP renewal, the new Utility Allowance
> amount should be used.**"*

| property | used | should have used | concurrent? |
|---|---|---|---|
| **Morh Housing** | FY2025 $102 / $138 | **FY2026 $107 / $144** | yes — the FY2026 UAF notice is in the same package and the executed schedule carries it |
| **Woodland Towers** | 2025 $83 | **2026 $89** | yes — UAF signed 30 Apr 2026, effective 7/1/2026, and the rent schedule carries $89 |

**This one is real, it is a mechanism at two properties, and it now has a rule behind it
rather than my inference.** Neither package re-ran the threshold at the allowance that takes
effect with the renewal. Both still pass, so no outcome changes — but the computation as filed
is not the computation the guidebook specifies.

## Noble Tower may be under the OTHER rule, and nobody has tested it

Noble Tower's folder holds `Noble Tower - Option 1 RCS Submission Package.pdf` and an
`Option 1 Submission Package`. **If it renewed under MUTM Option One-A, Section 3-4 applies a
genuine cap — at 150% of FMR, not SAFMR** — and the renewal rent must be *the lesser of*
comparable market rent or 150% of FMR.

**That test has never been run on this corpus.** It needs the FY2024 **FMR** (not SAFMR) for
the Oakland market area. Given Noble Tower's $5/unit margin against the SAFMR *threshold*, and
that it is the property where the app took a losing bidder's $3,100, this is the highest-value
open item now. **Recorded as open. I have not established that Noble Tower is Option One-A —
only that its filenames say "Option 1."**

## One observation about HUD's own document

The worked example in 9-14.B is internally inconsistent. The 1BR row shows **50 units** at a
SAFMR of **$610**, and prints a Gross Rent Potential of **$36,600** — which requires 60 units
($610 × 50 = $30,500). The subtotals follow $36,600, so the printed total ($96,600) and the
150% figure ($144,900) are consistent with each other and with the error. The owner's half of
the same example uses 50 units for the 1BR.

Not a finding about the corpus. Recorded because anyone reconciling a study against HUD's
example will hit it, and because it is the sort of thing this lane exists to catch.

---

# Adjudication wave — four parked packages closed

Each of these was parked because its money rows sat inside the H9 row-offset and calling
them would have been guessing which leg was displaced. A focused reader per package, sent
at the specific rows rather than at the package, settles all four.

## Peterson Plaza (75917) 2025 — **app wrong**, and all six rows are ONE defect

The offset hypothesis was **wrong**, and testing it rather than confirming it is what found
the real bug. The app is **missing a whole unit type**, and the gap makes every row below it
read as an offset.

True mix, agreed by workbook and executed schedule: **5 types / 189 units**, with a single
2BR/1BA **"Senior"** unit (742 sf, $2,700) sitting **third** in both documents. Part D is
empty and rent loss is $0 — it is revenue-producing, not a manager's unit.

**Mechanism, with a line number.** `RCSParse.readLetter` assembles that row's numbers onto
the *designation* baseline — `2BR /1BA` at y=241, its values at y=236 with `Senior` — so the
roster row parses as type `"Senior"` with no bedroom count. Then **`app.js:1579`**:

```js
const _b = rcsBrOf(u); if (!_b) return;   // a shape the form cannot express
```

drops it. What survives is 100 / 30 / 42 / 16 — **OURS, key for key**.

**Consequence: the app's record is 188 units and $429,050/mo against the filed 189 and
$431,750 — $2,700/month, $32,400/year short.**

| key | verdict |
|---|---|
| `unit.2.units` 42 vs 1 · `unit.2.proposed` 2650 vs 2700 · `unit.3.units` 16 vs 42 · `unit.3.proposed` 3250 vs 2650 · `unit.3.ua` 131 vs 111 · `unit.3.safmr` 2700 vs 2100 | **app wrong — one dropped row, six symptoms** |

Every OURS figure is *correct for its own unit type*; only the ordinal is wrong.
`unit.2.ua`/`unit.2.safmr` never surfaced because both 2BR rows share 111/2100.

**This is a repair I own.** It is general by code reading — `app.js:1579` discards **any**
unit whose designation carries no bedroom count — not by one property. Caveat the reader
stated plainly: OURS was reconstructed from the app's code paths over the real inputs, not
from a driven record. **Re-driving 75917 and dumping the unit rows would confirm it**, and
the sweep log should be checked for which schedule was uploaded, since a widget-bearing copy
reads all five rows and would mask the bug.

## Sycamore Green (75453) 2025 — **app wrong** on source selection (H5), outcome-neutral

Four revisions of one study, all naming "HUD **2025** SAFMR", all sharing one date of value
(20 Sep 2024) and one grid signature — **neither ever moved**, unlike Market Square.

| file | transmittal | SAFMR 1BR/2BR | UA |
|---|---|---|---|
| v1 | 25 Sep 2024 | **1,050 / 1,310** | 42 / 50 |
| v2 | 30 Oct 2024 | **990 / 1,230** | 42 / 50 |
| v3 | 3 Dec 2024 | **1,050 / 1,310** | 51 / 64 |
| v4 | 17 Dec 2024 | **990 / 1,230** | 51 / 64 |

**v3 = v1 + the UA fix with the SAFMR fix LOST.** A revision that regressed a correction it
had already made. Only v4 carries both. **All three submission PDFs embed v1**, as does the
owner's January workbook.

**The app read v2 or v4 — a revision the team never filed.** Its extraction is faithful; the
selection is wrong. Outcome-neutral: gross renewal rent $283,196 clears 150% under both sets
($343,530 and $365,610).

Two further defects in every revision: the narrative names 1BR $1,050 / 2BR **$1,300** while
the table beside it prints $1,310, and the narrative was never updated when the table changed.

## Lansing Manor (75500) 2026 — **team wrong**; the app matched the filed package

Three real figures, three documents: **116** the old allowance, **85** the owner's proposed
figure *and what the filed study says*, **99** what HUD/MMAM approved.

The disagreeing leg is the owner's `Senior World - RCS Analysis.xlsx`, **still carrying 116
after the team themselves revised the filed study to 85**. The app's 85 matches the submitted
package. Aggregate passes at every figure (131,280 / 129,580 / 128,180 against 156,000).

## Holly House (75564) 2025 — **both wrong**, and the app's leg is the faithful one

61/64 and 38/53 are **not** a current/proposed pair. They are different methods and vintages:
**61/64** is the UAF-factor route certified 25 Mar 2025 — what the appraiser used and what was
actually submitted; **38/53** is the triennial baseline computed in May and **back-pasted into
the impact workbook 13 minutes after the UA workbook was modified, after submission**. The
real current/proposed pair is 48/51 → **40/51**.

The app faithfully transcribed the filed study, so this is not a parsing defect. Aggregate
passes on all three ($92,300 / $93,022 / $92,296 against $96,120).

## M17 gains two more properties — 4 total

Both packages above computed the threshold on an allowance superseded by one taking effect
**with the renewal**, which HUD 9-14.B Step 1 forbids:

| property | computed on | operative | effective |
|---|---|---|---|
| Morh Housing | $102 / $138 | $107 / $144 | 1 Apr 2026 |
| Woodland Towers | $83 | $89 | 1 Jul 2026 |
| **Lansing Manor** | 116 (workbook) / 85 (study) | **99** | **2 Feb 2026** |
| **Holly House** | 61 / 64 | **40 / 51** | **24 Sep 2025** |

**No outcome changes at any of the four.** The mechanism is real and the arithmetic is not
the point — the point is that four packages ran the mandatory test on a number the guidebook
says is the wrong one.

---

## Oaks on North Plaza (75544), 2025 — **app wrong**, and it is NOT the Peterson defect

The reader was sent to test whether `app.js:1579` drops a row here too. **It does not** —
every row in this study's roster carries a bedroom count (`1 BR / 1 BA Apt`,
`2 BR / 1 BA TH ADA`, …; `ADA`/`TH`/`Apt` are always suffixes after a full spec), so
`rcsBrOf` never returns empty. **Testing the hypothesis rather than assuming it is what
found a second, different defect.**

**What actually happens.** The filed ordering is correct and agreed by three sources — the
workbook, the executed HUD-92458 and the study's roster all carry the same six rows in the
same order, 1BR first and 3BR-ADA last, 62 units, $121,105/mo. Part D is empty and rent loss
is 0, so there is no non-revenue row.

The app's own record reads:

| | app row | app label | filed row |
|---|--:|---|---|
| 0 | 14 | `2BR/1BA` | 1 BR — 14 units |
| 1 | 6 | `2BR/1BAADA` | 2 BR/1 BA — 6 |
| 2 | 1 | `2BR/1.5BA` | 2 BR/1 BA-ADA — 1 |
| 3 | 34 | `3BR` | 2 BR/1.5 BA — 34 |
| 4 | 6 | `3BR/1.5BAADA` | 3BR — 6 |
| 5 | **14** | `1BR/1BA` | 3 BR-ADA — **1** |

The **counts and current rents are the filed rows 0–4 verbatim** — the app read them
correctly. But **the type labels sit one row above the numbers they belong to**, and the
1BR row was **appended as row 5 instead of claiming row 0**, duplicating its 14 units and
**overwriting the 3BR-ADA row entirely**.

**Consequence: the app's workbook totals 75 units against a true 62** — 13 phantom units,
the 14-unit 1BR counted twice — and it is short the 3BR-ADA row's 1 unit, $1,198/mo current
and $2,325/mo proposed. Its current-rent potential computes to $90,724 against the filed
$91,922.

### M18 · The app's unit rows are claimed positionally, and a roster that does not line up corrupts them — 2 properties

| property | failure | result |
|---|---|---|
| **Peterson Plaza** | a roster row parses with no bedroom count and `app.js:1579` **drops** it | 188 units vs 189; **$32,400/yr short** |
| **Oaks on North Plaza** | a roster row fails to claim its form row and is **appended**, duplicating one row and overwriting another | **75 units vs 62**; the 3BR-ADA row destroyed |

Opposite symptoms, one seam: **which form row a study roster row claims.** One drops, one
duplicates, and in both cases every individual figure the app read was *correct* — only the
row it landed on was wrong. That is the signature of positional claiming with no key.

**This is a repair I own**, and the two properties clear the plan's two-property bar without
needing a code reading to generalise it. **Neither is diagnosed to a line yet on the Oaks
side**: the likely trigger is that the prior rent schedule the app reads is a poor scan whose
OCR yields `1 6R`, `3 613`, `2 l BA` — a bedroom-parse failure that would break positional
claiming — but that is a hypothesis, not a finding. **Re-running the sweep for 75544 with the
roster and `rcsBrOf` output logged per schedule row would settle it**, and that is the
Mac's step 4.

**A live trap recorded for the next reader:** the study's own "Subject Property Unit Mix"
table (~p.15) lists 1BR as **16** units and **omits both ADA rows**. Any reader or parser
that prefers that table over the roster gets a different, wrong mix.

---

## New Horizons (75474), 2024 — **both wrong**, and the two legs fail for opposite reasons

Read against the executed federal form itself (both HUD-92458 copies are flattened — 0
widgets, 0 `/V` — so the governing figures came off the raster and the CA's `Exhibit A`).

### The rent leg: THEIRS is not a filed document at all

| file | date | conclusions 1/2/3/4BR |
|---|---|---|
| `archive/Renzi/24-014 … GRIDS.pdf` | 23 Jan 2024 | **3,500 / 4,300 / 5,000 / 6,000** |
| `archive/JLL/… 1-26-24.pdf` | 26 Jan | 2,800 / 3,800 / 4,100 / 5,300 |
| `archive/JLL/… 3-12-24.pdf` | 11 Mar | 3,150 / 4,000 / 4,350 / 5,450 |
| **`Submission/Exhibit 3 - JLL … 3-26-24.pdf` — FILED** | 25–26 Mar | **3,150 / 4,000 / 4,350 / 5,450** |
| `Submission/(REVISED) … 4-12-24.pdf` | 12 Apr | same |

**GOVERNS:** the executed HUD-92458 eff. 1 Jul 2024 and the CA's Exhibit A — 3,150 / 4,000 /
4,350 / 5,450, monthly potential $197,200.

**OURS is right. THEIRS matches the `Renzi & JLL` workbook's Renzi block, rows 10–13, cols E
and O — all eight values exactly** — and Renzi's study was **rejected and never bound**; the
executed submission cites only JLL's job number.

**So this is H5 inverted: the never-filed study is on the COMPARATOR's side, not ours.**
That is a harness finding and a sharp one — the FILED leg is supposed to be evidence, and
here it read a *workbook block* rather than a filed document. Money if anyone acted on it:
**+$21,500/mo, +$258,000/yr** (the workbook's own `L40` reads −258,000).

**The Renzi set would have FAILED the threshold** — $226,242 against $205,095, over by
$21,147. The filed JLL set passes with $353 of headroom.

### The UA leg: the app used a superseded allowance

OURS `132 / 138 / 151 / 140` is the **FY2023** UAF conclusion (signed 26 Apr 2023).
`Exhibit 5 - New Horizons UAF.pdf`, signed 18 Jan 2024, applies the FY2024 factors
**effective 1 Jul 2024 — the same date as the rent increase**, so 9-14.B Step 1 requires
**149 / 156 / 171 / 158**.

| set | aggregate gross | vs $205,095 |
|---|--:|---|
| app — correct rents, **stale UA** | $203,870 | passes, headroom **$1,225** |
| governing | $204,742 | passes, headroom **$353** |
| Renzi | $226,242 | **fails by $21,147** |

**The outcome does not flip, but the app overstates its own headroom 3.5×** — $1,225 where
the truth is $353. On a threshold that decides whether HUD commissions its own study, a
margin misreported by that factor is the defect, not the pass/fail.

### The adder is real here and irrelevant to this gap

`E26 = 2800+F26`, `F26 = 225` (and `=3800+225`, `=4100+225`, `=5300+225`) — a flat $225
what-if on the 26 Jan JLL draft, present only in the 27 Jan workbook and superseded by
hard-typed figures in the 12 Mar copy. **Neither disputed set is pre- or post-adder**; the
gap runs +350/+300/+650/+550 and is simply two different appraisers. **M10 stands as
recorded and is not evidence here.**

### M17 reaches 5 properties

| property | computed on | operative | effective |
|---|---|---|---|
| Morh Housing | $102 / $138 | $107 / $144 | 1 Apr 2026 |
| Woodland Towers | $83 | $89 | 1 Jul 2026 |
| Lansing Manor | 116 / 85 | **99** | 2 Feb 2026 |
| Holly House | 61 / 64 | **40 / 51** | 24 Sep 2025 |
| **New Horizons** | **132/138/151/140** (FY2023) | **149/156/171/158** | **1 Jul 2024** |

New Horizons is the first where the stale allowance **materially misstates the margin**
rather than merely using the wrong input.

### Open, and cheap to close

The reader inferred THEIRS from an exact 8-of-8 match to the Renzi block. **Reading the
manifest entry for this cycle would confirm which file it labelled "filed"** — that is one
lookup and it converts an inference into a fact. Also open: whether the app's UA is a
carried-over 2023 per-cycle value or a parse of the 12 Mar draft. The 4BR discriminates —
the app has 140, which is the 2023 UAF; the draft used 139 — **pointing to carry-over**,
which would make this a per-cycle-staleness bug rather than a parse bug.

**One for the team's file, not ours:** the 2024 UAF's "Previous Year" 4BR electric reads
$88.00 where the 2023 UAF concluded $89.00. Carrying $89 yields UA 159, not 158. The CA
approved 158, so 158 governs; the $1 is theirs.

---

## Six verdicts closed on the H9 classes — no defect on either leg

These six have an OURS leg, a SHOULD, and no money row that survives H9. Recorded as
verdicts rather than left parked, because "not adjudicated" and "adjudicated to nothing"
are different states and the ledger should not confuse them.

| package | what the differences were | verdict |
|---|---|---|
| **Circle Park** 2026 | unit-type labels only (`1BR/1BAElderly` vs `1B-Elderly`, etc.) — 5 rows, no money | **cosmetic** |
| **Clinton Manor** 2026 | unit-type labels only (`1BR/1BA` vs `1-Bedroom`) — 4 rows | **cosmetic** |
| **Burt Farms I** 2024 | one label + the checklist heading's curly apostrophe | **cosmetic** |
| **Woodbury Oakwood** 2026 | checklist `property.name`: OURS `LakesideApartments`, THEIRS **empty** — the filed checklist's name field did not extract | **harness (H9d)** |
| **Oceanport** 2024 | `property.name` THEIRS `2FHDQSRUW6HQLRU&LWL]HQV` — **decodes to `OceanportSeniorCitizens`, matching OURS** but for a trailing contract number. `unit.*.type` THEIRS reads `OceanportUrbanRenewalPreservation`, `30HudsonYards,72`, `NewYork,NY10001`, `Attn:Mr.ZacSilber` | **harness (H9a + H9d)** |
| **Hampshire House** 2024 | `unit.0.type` THEIRS `30HudsonYards72`, `unit.0.units` THEIRS `ndFloor` | **harness (H9a)** |

**Oceanport and Hampshire House are the same harness bug, and it is worth naming precisely:
the extractor read the COVER LETTER as the rent schedule's unit table.** `30 Hudson Yards`,
`72nd Floor`, `Attn: Mr. Zac Silber`, `Dear Mr. Silber` are the owner's address block landing
in `unit.N.type`. No verdict about the app or the team can be drawn from those rows — the
comparison never reached a rent schedule.

**Woodbury's empty `property.name` is the ASCII−29 decode failing to an empty string rather
than to mojibake**, which is the more dangerous shape: mojibake announces itself, an empty
string reads as "the filed document has no value here."

That closes every package that has both a sweep record and a SHOULD.

---

# Reading wave — Ebony Gardens, Gates Manor, Southport Mews, Walden

Four unread properties, checked against sources. Each passes the aggregate 150% test; the
findings are documents wrong against their own sources, and two mechanisms grow sharply.

## Ebony Gardens (75566), 2025 - RCS — Belfry, job 25-053

Aggregate passes: RCS gross $566,876/mo vs 150% SAFMR $597,465 — **under by $213.91/unit/mo**.
Both sides gross, agree cell-for-cell. Study selection: **four revisions, the un-suffixed
`RCS - 25-053` is the OLDEST and the job-numbered `Revised RCS - 25-053` is the NEWEST**;
Oct 29 governs, +$225,900/yr entirely in the 24 three-bedroom units.

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | study p3 | threshold caption | "< **150% OF** SAFMR" | "< SAFMR GROSS RENT" — words assert $566,876<$398,310, false | team wrong |
| 2 | study p2 | per-bedroom table | none exists (§9-14.B) | prints one, net-vs-gross | team wrong |
| 3 | study p26 | year built | 1982 (2018 Tobin RCS) | "2005 (Renovated 2021)", age "20 years" | team wrong |
| 4 | study p63 | prior-services cert | disclose the May 2025 RCS + Apr grids | "have not provided any…in the three years preceding" | team wrong |
| 5 | checklist | licence-copy box | unchecked (temp licence = N) | **checked** | team wrong |
| 6 | study + workbook | 3BR UA | $125/$135 (executed 92458, monotone) | $129/$125 (small > large) | team wrong |
| 7 | HUD-92458 Part B | parking as a service | checked (incl. in rent) | unchecked | team wrong |
| 8 | study `/Title` | metadata | Ebony Gardens | **"April 14, 2008", author Mark Burgess** | cosmetic |
| 9 | `Rent Analysis.xlsx` | G2/M2 headers | Ebony Gardens | **"Renzi - As Is" / "Renzi"** | open |

**M17 (stale UA):** the executed 92458 adopts $100/$121/$135/$125; the study computed on
$96/$117/$129/$125. Concurrent adjustment, immaterial to the aggregate. **Absent:** glyph
substitution (`NY36H108040` clean ×15), incomplete grid, foreign property bound into the
filed package.

## Gates Manor (uncoded, contract IL06H121063), 2026 - RCS — Belfry, job 26-121

51 × 1BR, one type. Passes: 51 × ($2,725+$33) = $140,658 vs 150% SAFMR $178,245 — **under by
$736.99/unit/mo**. One study revision, the two candidates byte-identical. Rent movement
requested +$503,064/yr.

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | **`RCS Analysis.xlsx` Sheet1** | whose grids | Gates Manor | **"Crossroads of East Ravenswood — Belfry Rent Grids", 124 units, live** | team wrong |
| 2 | checklist `/Title` | metadata | Gates Manor | **"…RCS Owners Checklist - New Horizons 3.25.24.pdf", author mwyckoff** | team wrong |
| 3 | study transmittal | UA in 150% test | $33 (new UAF) | $31 (superseded) | team wrong |
| 4 | study transmittal | threshold caption | "< **150% of** SAFMR" | "< SAFMR GROSS RENT $140,556<$178,245" | team wrong |
| 5 | **HUD-92273-S8 grid** | "Subject's FHA #" | IL06H121063 | **IL06004814** — matches nothing else in the package | team wrong |
| 6 | **Appendix 2** | form variant | rent-increase cert (245.310) | the **UA-DECREASE** variant, certifying a decrease while the UA *increases* $31→$33 | team wrong |
| 7 | study | year built | one value | Improvements **1976**, grid line 7 **1979**, age "50 years" (only fits 1976) | team wrong |
| 8 | study narrative p26 | ZIP | 60091 | **600091** | team wrong |
| 9 | study | property name | Gates Manor | "GATE MANOR APARTMENTS" (title, transmittal, Neighborhood) | team wrong |
| 10 | tenant notice | comment address | 1135 Wilmette Ave | **11135** Wilmette Ave; agency "Urban Housing and Development" | team wrong / cosmetic |

**M17 (stale UA):** $31 vs concurrent $33. **Absent:** glyph substitution (only the `600091`
digit error and the unrelated `IL06004814`); foreign material *bound into the transmitted
package* (the Crossroads/New-Horizons leaks are in the component workbook and checklist,
neither bound in — zero hits in the signed package).

## Southport Mews (uncoded, contract NY360017014), 2025 — Renzi/Belfry, job 24-490

Passes: SHOULD gross $181,929/mo vs 150% SAFMR $266,085 — **under by $1,314.94/unit/mo**.
Study selection: **un-suffixed file is the newest, "v2" is the older**; both conclude the
same; +$382,284/yr by the cycle. The grids on the filed study return **4 characters** to
`pdftotext` — text-layer-only reading would call them blank; they are fully present at raster.

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | study letter p2 | UA | $86/118/183/240 (concurrent, 1/1/2025) | **$38/72/107/175 (FY2024)** — superseded by the very renewal it supports | team wrong |
| 2 | study letter p2 | total gross renewal | $181,929 | $178,183 | team wrong |
| 3 | `RCS Comparison.xlsx` E7 | owner-side basis | gross (rent+UA) | **$172,425 net, no UA column** — net-vs-gross | team wrong |
| 4 | **tenant notice** (bound pkg p78) | property in the operative sentence | Southport Mews | **"Luther Towers Apartments"** | team wrong |
| 5 | **cover letter** (filed) | appraiser identity | Renzi & Associates | **"Gill Group"/"Gil Group", Jana Jones, Dexter MO** | team wrong |
| 6 | cover letter (filed) | required certs | 30-day + perjury warning | both absent (present only in v2) | team wrong |
| 7 | grids ×4 (filed) | "Grid was prepared" | one box checked | both blank | team wrong |
| 8 | study cert p58 | date | dated | **undated** | team wrong |
| 9 | HUD-92458 + Exhibit A | FHA Project No. | populated | blank on every copy, both cycles | team wrong |
| 10 | `RCS Comparison.xlsx` rows 19-24 | foreign properties | — | **"Ebony Gardens", "Armory Plaza" columns** | open |

**M17 (stale UA):** the sharpest yet — an $8,388/mo gap between the FY2024 allowance used and
the concurrent one, $44,952/yr, still short of flipping the aggregate. **Absent:** glyph
substitution (`NY360017014` clean ×11); checklist `/Title` empty (author `mwyckoff`, **no**
New Horizons); malformed threshold sentence (**caption correct here** — the operator and
"150% OF" are both right).

## Walden (The Cedars) (75921, contract NY360002009), 2025 - RCS — Belfry, job 25-020

Passes with room: RCS gross $201,310/mo vs 150% SAFMR $209,790 — **under by $96.36/unit/mo**.
**Does NOT carry the stale-UA defect** — study, Exhibit A and executed 92458 all use the new
45/53/75/96. Study selection: a Renzi-engaged Zabel grid (`24-578`, Oct 2024) and a
Belfry-engaged Zabel full RCS (`25-020`, Feb 2025, +9.1% on the 3BR); only 25-020 filed.

| # | document | field | SHOULD | FILED | verdict |
|--:|---|---|---|---|---|
| 1 | **Exhibit 4, Evidence of Debt Service** (loose + executed pp.80-82) | whose loan | Walden | **"WEST HAVERSTRAW SENIOR HOUSING", 119 Walnut Hill, loan 402372** — DocuSign-executed | team wrong |
| 2 | cert p60 + App. 9-1-4 ¶3 | prior services | disclose Zabel's own Oct 2024 grids on this subject | "have not provided any…in the three years preceding" | team wrong |
| 3 | checklist | licence-copy box | unchecked (temp licence = N) | **checked** | team wrong |
| 4 | RCS p3 / checklist | 150% comparison | an express aggregate sentence | box checked; RCS has only a per-bedroom net-vs-gross table, no comparison sentence | team wrong |
| 5 | 30-day owner's cert | signature date | after the period closes (~5/1) | one copy signed **4/22** (premature) | team wrong |
| 6 | Exhibit 2 `/Title` | metadata | Walden | **"…RCS Owners Checklist - New Horizons 3.25.24.pdf", mwyckoff** | cosmetic |
| 7 | Exhibit 1 | addressee | HUD/CA (CGI) | **"Walden Preservation, L.P." — addressed to itself** | cosmetic |
| 8 | grids "Subject's FHA #" | — | 012GL005 | NY360002009 (the contract number) | cosmetic |

**Absent:** stale-UA defect (uses the new allowance correctly — the negative that makes M17 a
real pattern rather than universal); glyph substitution; year-built contradiction; incomplete
grid; foreign text in the transmittal itself.

## Mechanism updates from this wave

**M12 — foreign material — two new sub-findings, both stronger than a single stray file:**

1. **West Haverstraw's debt-service exhibit appears in TWO properties** — Southport Mews'
   Exhibit 4 and Walden's Exhibit 4 are both West Haverstraw Senior Housing's loan, and
   Walden's is **DocuSign-executed** as its own. One foreign exhibit, two filed packages.
2. **The owner-side New Horizons checklist template reaches 5 properties** — Crossroads,
   Woodland Towers, Fairview Homes, **Gates Manor, Walden** — all `/Title "…New Horizons
   3.25.24.pdf"`, author `mwyckoff`. Plus Gates Manor's workbook carrying **Crossroads'**
   rent grids, and Southport's carrying **Ebony Gardens + Armory Plaza** columns. The
   owner-side artifacts are assembled by copying a neighbour's file and editing in place.

**M17 — stale UA in the threshold — now 7 properties:** Morh Housing, Woodland Towers,
Lansing Manor, Holly House, **Ebony Gardens, Gates Manor, Southport Mews**. Walden is the
clean control — it used the concurrent allowance, so the pattern is a real error and not a
universal one. Southport is the widest gap ($44,952/yr). **None flips its aggregate.**

**M14 — malformed threshold, Belfry template — Ebony Gardens and Gates Manor added.**
Southport (Renzi/Belfry mix) prints the caption **correctly**, and Walden prints **no
comparison sentence at all** — two more shapes of the same missing-or-wrong aggregate
statement.

---

## THREE-WAY — Peterson Plaza (75917), 2025 - RCS — driven from the container, M18 corrected

First package driven end to end from the cloud container through the relay, both fill
orders, with the prior rent schedule uploaded. This supersedes the reconstruction the M18
entry rested on.

**SHOULD** (reader, from the sources): 5 unit types / 189 units, including a single 2BR/1BA
**"Senior"** unit at $2,700. Filed total $431,750/mo.

**OURS** (this drive, rs-first, 5 files generated):

| unit row | units | rent | extension |
|---|--:|--:|--:|
| 1 BR / 1 BA | 100 | 2,050 | 205,000 |
| 1 BR / 1 BA | 30 | 2,025 | 60,750 |
| **2 BR (the Senior row)** | **1** | **blank** | **blank** |
| 2 BR / 1 BA | 42 | 2,650 | 111,300 |
| 3 BR / 1.5 BA | 16 | 3,250 | 52,000 |
| **Total Units** | **189** | | **$429,050** |

**FILED**: 189 units, $431,750 (Senior priced at $2,700).

**Verdict: NOT the app defect I recorded.** The row is **not dropped** — the app produces
**189 units**, the Senior row present. Its rent is **blank**, because the study's "Senior"
line carries no bedroom count to match that row (the unplaceable-priced-line case), so the
app declines to guess a rent it cannot determine. The gap is $2,700/mo, and it manifests as
a **visible blank cell**, not a silently wrong number and not a missing row. My M18
score-blocker flags the package with "a priced line the study prices that no unit row
claims." **Blank + flag is defensible behavior**, not a defect.

### M18 downgraded

The original entry ("app silently drops a unit row, 188 vs 189, $32,400/yr short") was a
**reconstruction from code paths without a prior rent schedule uploaded**. Driven with the
prior RS — which supplies the unit roster — the count is **189, correct**, and the defect is
a single **unpriced** row, visible and flagged. The "188/dropped" outcome only occurs when
no prior schedule is available to supply the roster; even then the app now flags it (the
score-blocker). **M18 is reclassified from "produces a wrong schedule silently" to "leaves an
unmatchable rent blank and flags the package" — a product-appropriate response to ambiguous
input, not a bug.** The score-blocker (test_db 205) stays: it is what makes the blank
non-silent.

### What this drive also proved

- **The container drives the live app end to end through the relay** — property found by
  `ra_property_code`, tracker-dated 2025-09-01, cycle created, both orders, reopen after
  reload, cleanup by cycle, account 234 → 234. The write path is production-proven now, not
  just probe-proven.
- **Provenance reached the states the two-pass drive was meant to force** — a single drive
  with the prior RS uploaded recorded `{database:2, overridden:1, this-cycle:89, new:101}`.
  The prior schedule supplies on-file (blue) and overridden (orange) values, so the states
  the team works in are exercised without a separate save-then-redrive pass. This is a
  cheaper route to the same coverage the run doc wanted from two passes.
