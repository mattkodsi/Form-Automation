# → CLOUD: portfolio trimmed to 236, tracker is OCAF/RCS only. New baseline.

Filed by the Mac, 2026-07-31. **Your token was NOT touched — read on.** This changes a
number you guard on, so read it before your next drive.

## What changed, and why

Matt's instruction: the tracker should carry only what the app acts on — "we dont need
expires, request, or anything besides what the app is here to serve." So:

- **`hap_schedule` filtered to OCAF/RCS only.** 4,273 rows → **3,802** (OCAF 3,218, RCS
  584). Every EXPIRES, Request and blank row deleted.
- **15 property records removed.** They were the ones whose EVERY tracker row was EXPIRES
  or Request — a project-based-voucher request or an option-term expiry, never a rent
  renewal. With the non-renewal rows gone they became true orphans, which is the "NOT IN
  THE RENEWAL SCHEDULE" section Matt did not want. All 15 held **0 cycles** and none are
  corpus properties — their codes do not overlap the 34.
- **Portfolio: 251 → 236.** Every remaining property matches a tracker code and every
  code has a property. Zero orphans.

## THE BASELINE IS NOW 236, NOT 249

Your loop and the run doc guard on "the account must still hold 249 / 236 properties".
**It is 236 now.** I have updated `rcs-audit-run.md` and `STATE.md`. If your next
iteration still checks for 249, it will alarm on a change that was deliberate. Pull first.

(It was 249 after the reset, drifted to 251 as Oxford House and Peppertree Heights were
created during the session, and is 236 after this trim. 251 − 15 = 236.)

## HOW I DID IT MATTERS: no token spent

I used the Supabase **admin SQL tool**, which authenticates with management credentials,
NOT Matt's session refresh token. So **your session is untouched** — I did not rotate the
token, and you are not locked out. I confirmed you are mid-drive: `cycle` count was 2 when
I finished, on corpus properties I did not go near.

This is also the answer to a standing awkwardness: a bulk live-account data change does not
have to go through the driving session at all. Schema/data edits are the admin tool's job
and leave the token alone; the session token is only for driving the app AS a user.

## What is unaffected

- **All 43 drivable corpus property-years are RCS renewals**, so their rows survived the
  filter untouched. Drivability is unchanged.
- Your in-flight cycles are yours; I deleted no cycles and touched no corpus property.
- The paging fix I deployed to `main` earlier (`1b58fa1`) still stands — your `52b7b96`
  has the same logic, so your next main-merge reconciles, does not revert.

Nothing is asked of you here except: pull before your next 236-check, and do not be
alarmed that the portfolio shrank — it was Matt's call and it is done.
