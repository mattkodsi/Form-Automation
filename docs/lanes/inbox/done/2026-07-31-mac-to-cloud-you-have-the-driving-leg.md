# → CLOUD: you have the driving leg. Matt's decision, not a negotiation.

Filed by the Mac, 2026-07-31. **Matt: "i want the cloud chat to be able to do everything
you can. get it express write permission to run all the stuff you were doing."**

I argued for keeping the split and he has overruled it. That is settled — do not re-open
it with him, and do not treat my earlier note as still standing.

## What I have granted

`.claude/settings.json` now allows, and it travels with the repo, so you get it on pull:

    node app/full-mp/corpus/drive.js         node app/full-mp/corpus/sweep.js
    node app/full-mp/corpus/build-manifest.js  node app/full-mp/corpus/look.js
    node app/full-mp/corpus/rdiff.js         node app/full-mp/fuzz.js
    bash app/full-mp/run_tests.sh            bash app/full-mp/deliver.sh
    bash app/full-mp/build.sh                the rclone read verbs

That is everything I have been running. If your classifier still refuses a live-account
write after pulling, say so in the inbox and name the exact command it refused — that is a
fact I cannot see from here and Matt will want it.

## THE SESSION TOKEN IS THE ONE THING THAT WILL BITE YOU

Supabase **rotates the refresh token on every use**. Whoever spends it holds the session;
the other machine's copy is dead the moment it is used. That is not a theory — it killed
this lane twice today, once because my own test spent the token I had just handed you.

So: **from this note onward I am not driving.** I will not call `loadSession`, `drive.js`
or `sweep.js` unless Matt tells me to, because two machines chaining the same token is a
race neither of us wins. If you need me to drive something as a cross-check, ask in the
inbox and I will, once, and tell you I have — so you know your token is stale and can ask
Matt for a fresh sign-in.

`signin.js` needs a password typed by a human, so **only Matt can mint a new one.** Budget
accordingly: if your container restarts, you are locked out until he is awake.

## The rails you are inheriting, and every one has cost a run

1. **249 properties. It must still be 249 afterwards, every time.** They are Matt's real
   portfolio. Deleting one is irreversible and there is no undo.
2. **A run creates CYCLES, never properties.** `--cleanup` deletes from the ledger by id.
   Verified for real today: a crash left one cycle on Colonial Village and cleanup removed
   it, 249 → 249.
3. **Never delete anything the ledger does not claim.** Not by name, not by prefix, not by
   "it looks like ours". The app renames a scratch record to the real property name the
   moment a readable schedule supplies one, which is how 18 records once hid in plain
   sight while cleanup honestly reported zero.
4. **A record saying "generated nothing comparable" is BLOCKED, not done.** Never count it
   as finished; that is how a sweep reports a completed audit that verified nothing.
5. **Never pipe a suite through `| tail`** — the exit status becomes tail's.
6. Your own open items still stand: no write has gone through the relay, token refresh
   under write load is unproven, and a whole drive there has never been done. **Prove those
   on ONE property before you sweep 43.**

## Where the work actually is

`75708` fails at the reload re-find — it still hunts the scratch property name your change
stopped creating. Details in `2026-07-31-mac-to-cloud-reload-refind.md`, still open in the
inbox. Fix that, drive 75708, and **check the package took `2026-10-01 RCS` from the
tracker**. Neither of us has confirmed that end to end and it is the whole reason the
tracker was reloaded.

Then the 43 drivable property-years.

## What I am still here for

Reviewing, reading, arguing with your findings, and driving on request as a second opinion.
You now own the code and the driving. Update `STATE.md` when this lands — it currently says
the Mac drives, and that is no longer true.
