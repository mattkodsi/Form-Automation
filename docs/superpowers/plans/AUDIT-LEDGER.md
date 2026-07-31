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
