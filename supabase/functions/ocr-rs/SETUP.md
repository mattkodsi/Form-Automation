# Turning on OCR for scanned rent schedules

Start to finish, assuming you have never used Azure. About 20 minutes.

---

## Will this cost anything?

**No.** But you do have to put a card on file to open the account, so here is the
whole picture:

| | |
|---|---|
| What we use | Azure Document Intelligence, **Free (F0)** tier |
| What it costs | **$0** — 500 pages per month, free, permanently. Not a trial. |
| What you'll actually use | ~2–3 pages per renewal. Call it 10–30 pages a year. |
| Card required? | **Yes**, to create any Azure account. Non-prepaid credit or debit. |
| Will it be charged? | No. You may see a **$1 temporary hold** that drops off. |

Azure will also offer you **$200 of free credit for 30 days**. Ignore it. We don't
need it, and nothing here depends on it. When those 30 days end, the free F0 tier
keeps working — always-free tiers are separate from the trial credit.

**The one way to get billed** is picking the wrong tier: **S0** is pay-as-you-go
(~$1.50 per 1,000 pages). Step 3 below is where you choose. Pick **F0**. If you
ever want to double-check, the Azure portal shows the tier on the resource's
Overview page.

---

## Step 1 — Create an Azure account

1. Go to **https://azure.microsoft.com/free**
2. Click **Start free**.
3. Sign in with a Microsoft account, or make one.
4. Fill in your details. You'll need to verify by **phone** and by **card**.
5. Finish. You'll land in the Azure portal.

Use a work email if this will eventually be Related's; use a personal one if you
just want to get it working now. Either is fine — the account can be swapped later
without touching any code (see the last section).

## Step 2 — Create the Document Intelligence resource

1. In the portal search bar at the top, type **Document Intelligence**.
2. Click it, then click **Create**.

## Step 3 — Fill in the form (this is the important one)

| Field | What to put |
|---|---|
| Subscription | The only one there — likely "Azure subscription 1" |
| Resource group | **Create new** → name it `rcs-ocr` |
| Region | Pick one near you, e.g. **East US** |
| Name | Anything unique, e.g. `rcs-ocr-mk` |
| **Pricing tier** | **Free F0** ← the one that matters |

If **Free F0** is greyed out or missing, it means this subscription already has a
free Document Intelligence resource — you only get one. Either reuse that one, or
delete it first.

Click **Review + create**, then **Create**. Wait about a minute.

## Step 4 — Copy your two values

1. When it finishes, click **Go to resource**.
2. In the left menu, click **Keys and Endpoint**.
3. Copy these two, into a scratch note for a moment:
   - **KEY 1** — a long string of letters and numbers
   - **Endpoint** — looks like `https://rcs-ocr-mk.cognitiveservices.azure.com/`

Treat KEY 1 like a password. Don't paste it into email, chat, or a file in this repo.

## Step 5 — Give them to Supabase

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the block below, replace the two placeholders with what you copied, run it.

```sql
-- store the two values as encrypted Vault secrets
select vault.create_secret('PASTE_ENDPOINT_HERE', 'azure_di_endpoint', 'Azure Document Intelligence endpoint');
select vault.create_secret('PASTE_KEY_HERE',      'azure_di_key',      'Azure Document Intelligence key');

-- a reader only the server may call, mirroring the existing public.get_hud_token()
create or replace function public.get_azure_di()
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare e text; k text;
begin
  if current_setting('request.jwt.claims', true)::jsonb ->> 'role' is distinct from 'service_role' then
    raise exception 'not authorised';
  end if;
  select decrypted_secret into e from vault.decrypted_secrets where name = 'azure_di_endpoint';
  select decrypted_secret into k from vault.decrypted_secrets where name = 'azure_di_key';
  return jsonb_build_object('endpoint', e, 'key', k);
end $$;

revoke all on function public.get_azure_di() from public, anon, authenticated;
```

Then clear the editor so the key isn't left sitting on screen.

## Step 6 — Deploy the function

```bash
supabase functions deploy ocr-rs --project-ref plgegtosqwehriqecaui
```

## Step 7 — Try it

Open the app, go to a property, and upload a **scanned** rent schedule in Section 1.

You should see *"No digital text in this copy — reading it as a scanned image
(page 1 of N). This takes a few moments…"*, then a parsed result marked as read
by OCR. Check the values against the paper before saving — OCR is good, not
perfect, and the app says so.

If it instead tells you the copy is a scan it could not read, that is the honest
answer, not a crash: the numbers it recovered didn't add up to the schedule's own
printed total, so it refused to fill the form rather than guess.

---

## Later: swapping to Related's Azure account

Nothing in the code names an account, so this is not a decision you're stuck with.

- **This app:** create the resource in Related's subscription, then rerun the two
  secrets with the new values and redeploy:

  ```sql
  select vault.update_secret((select id from vault.secrets where name = 'azure_di_endpoint'), 'NEW_ENDPOINT');
  select vault.update_secret((select id from vault.secrets where name = 'azure_di_key'),      'NEW_KEY');
  ```

  **Always redeploy `ocr-rs` afterwards.** It caches the endpoint and key in memory
  after its first lookup, so a warm server keeps using the old key until replaced.

- **Kinley's Azure port:** unaffected by any of this. His build points at
  `/api/ocr-rs` inside Related's own tenancy (`RA-PORT.md`, anchor 3b), so he
  supplies his own resource and never touches this key.

One thing to be deliberate about: while this runs on a personal subscription, real
owner and tenant documents pass through **your** Azure account. That's fine for the
example schedules in `Reference & Research/`. Move to Related's resource before
running live properties through it.

---

## Notes on the free tier

Three F0 limits shaped how this was built, so you don't need to work around them:

- **It only reads the first 2 pages of a file, and drops the rest silently.** So the
  app splits the PDF and sends one page per request. A cover sheet would otherwise
  have cost you the certification page with no error shown.
- **4 MB per file.** A single scanned page is far under this.
- **1 request per second.** The app reads pages one at a time anyway.
