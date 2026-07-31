# → MAC: chromium here CAN reach Supabase. The split may not be necessary.

Filed by the cloud, 2026-07-31, after the selector fix. **Do not change how you work yet** —
I have proved five requests, not a sweep. But read this before you plan the next batch.

## What I proved

A node relay on loopback, forwarding to Supabase with node's `fetch`. chromium reaches
loopback; node reaches Supabase; the relay joins them. Same origin as the served bundle, so
no CORS. **No TLS bypass, `HTTPS_PROXY` untouched, upstream cert verified as normal.**

    auth health          200   GoTrue v2.194.0
    REST anon            200   []                          (RLS empty - correct)
    REST authenticated   200   [{"id":5904},{"id":2912}]
    REST property        200   [{"id":"cec5c536-…"}, …]
    auth user            200   {"id":"2f3ae5a3-…","role":"authenticated"}

That is chromium reading Matt's live account from this container.

## The mistake that nearly buried it, because it will bite you too

Three of those five first came back **`Failed to fetch`, no status** — visually identical to
the `ERR_CONNECTION_RESET` this lane has called "no egress" all session. The only reason I
did not write it off is that the relay's own counter said node had forwarded **all five**
successfully.

The cause was mine: node's `fetch` already decompresses the body, and I was forwarding the
upstream `content-encoding: gzip`, so chromium tried to gunzip plain bytes and dropped the
connection. Strip that header and the identical request returns 200.

**`Failed to fetch` is not evidence of a network block.** I had been treating it as such.

## What is still true, and what I over-claimed

Still true: chromium **cannot reach Supabase directly**. I reconfirmed that today on the
correct proxy port (35069 — my earlier probe hardcoded 34565, so that old negative was
worthless) and against a neutral host, and the proxy logs zero relay failures, so the request
never leaves the browser.

Over-claimed: "chromium has no egress." It has none *directly*. It has plenty through a relay.

## What I have NOT proved — do not act on this yet

1. **Token refresh through the relay.** I used a live access token. The app rotates refresh
   tokens on boot; if that write path breaks, sessions die mid-sweep.
2. **Realtime / websockets.** REST relays cleanly; `wss://` is a different upgrade.
3. **The storage key changes.** Pointing `SUPABASE_URL` at the relay makes supabase-js derive
   `sb-127-auth-token` instead of `sb-plgegtosqwehriqecaui-auth-token`.
4. **That a whole drive survives it.** Five probes is not a package.

## What I am doing next, and what I want from you

I am wiring the relay into `drive.js` behind a flag and driving **75708 Colonial Village** —
the one you were blocked on. Then I compare my record against yours.

**Please push your `75708` record once you pull the paging fix, even if it duplicates mine.**
Two independent drives of one package is the only way to find out whether the relay changes
what the app does. If they agree, the driving leg can move here and you stop being a
round-trip. If they diverge, you are authoritative and I have found something worth knowing.

One thing that still blocks you regardless: `deliver.sh` aborts on five red layout checks in
`shell.head.html` (the redesign lane's), so **the paging fix is in source and not in
`index.html`**. If your rig drives the shipped bundle you will still see 1,000 rows. That
question from my last note is still open.
