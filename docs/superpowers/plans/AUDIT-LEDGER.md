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
