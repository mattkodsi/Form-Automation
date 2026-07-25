# Setting up tier-3 OCR (scanned rent schedules)

Two steps, both yours — the key must never pass through git, `index.html`, or a
chat transcript.

## 1. Create the Azure resource

Azure Portal → **Create a resource** → search **Document Intelligence** → Create.

- Pricing tier: **F0 (Free)**
- Region: anything close to you

When it deploys, open **Keys and Endpoint** and copy **KEY 1** and the **Endpoint**
(it looks like `https://<name>.cognitiveservices.azure.com/`).

What F0 gives you: 500 pages/month, free, forever. A renewal uses two or three.
Its two limits are already designed around in the code — it reads only the first
two pages of any file (so the app sends one page per request), and files must be
under 4MB (a single scanned page is far smaller).

## 2. Put them in Supabase Vault

Supabase Studio → **SQL Editor** → paste this, replacing the two placeholders,
and run it. This is the same pattern as the existing `hud_api_token`.

```sql
-- store the two values as Vault secrets
select vault.create_secret('PASTE_ENDPOINT_HERE', 'azure_di_endpoint', 'Azure Document Intelligence endpoint');
select vault.create_secret('PASTE_KEY_HERE',      'azure_di_key',      'Azure Document Intelligence key');

-- service-role-only reader, mirroring public.get_hud_token()
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

To rotate the key later:

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'azure_di_key'),
  'NEW_KEY_HERE');
```

**After any rotation, redeploy the function** (step 3). `ocr-rs` caches the endpoint
and key in module scope after its first Vault lookup, so a warm isolate will keep
using the old key until it is replaced.

## Switching to Related's Azure account later

Start on your own Azure subscription — nothing in the code names a tenant, so this
is not a decision you are locked into.

- **This app:** create the DI resource in Related's subscription, run the two
  `vault.update_secret` calls above with the new endpoint and key, redeploy `ocr-rs`.
  No code change and no rebuild of `index.html`.
- **Kinley's Azure port:** independent of all of the above. His build patches the
  call to `/api/ocr-rs` on Related's App Service (`RA-PORT.md`, anchor 3b), so he
  supplies his own Document Intelligence resource inside Related's tenancy and never
  touches this Vault or this key.

One caveat while you are on a personal subscription: real owner and tenant documents
transit *your* Azure account. That is fine for the example schedules in
`Reference & Research/`; move to Related's resource before running live properties.

## 3. Deploy the function

```bash
supabase functions deploy ocr-rs --project-ref plgegtosqwehriqecaui
```

## Checking it works

Upload a scanned rent schedule in Section 1. You should see *"No digital text in
this copy — reading it as a scanned image (page 1 of N)"*, then a parsed result
labelled as read by OCR.

If it says the copy is a scan it could not read, that is the honest failure: the
values it recovered did not reconcile against the schedule's own printed total,
so it refused to fill the form rather than guess. That gate is deliberate.
