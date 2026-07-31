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
