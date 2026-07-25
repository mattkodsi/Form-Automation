// Supabase Edge Function: ocr-rs
// Reads one page of a SCANNED executed rent schedule (HUD-92458) — tier 3, for
// copies that carry no form fields and no digital text at all.
//
// This function does NOT do the OCR. It cannot: Edge Functions get 2s of CPU per
// request and 256MB, and a WASM OCR engine needs seconds of CPU per page (the
// same wall SheetJS hit when it wouldn't boot here). So it is a thin proxy to
// Azure Document Intelligence, and every second it spends is async I/O, which
// the CPU limit does not count.
//
// prebuilt-LAYOUT, not prebuilt-read: layout also returns selectionMarks with a
// selected/unselected state. Without those, checkboxes are invisible to us — a
// tick is a drawn glyph, and OCR reports it as a stray letter ("K" in the
// entity-type "Other" box), which is worse than not reading it at all.
//
// The endpoint + key stay server-side: AZURE_DI_ENDPOINT / AZURE_DI_KEY env
// secrets if set, else Supabase Vault via a service-role-only RPC. They must
// never ship in index.html or git.
//
// ONE PAGE PER CALL, by the client's design: Azure's free (F0) tier reads only
// the first two pages of a document and drops the rest SILENTLY, so a cover
// sheet would cost the certification page with no error to notice. The client
// (app/full-mp/ocr.js, ocrSplitPages) splits before calling.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const API_VERSION = '2024-11-30';
const MODEL = 'prebuilt-layout';
const POLL_MS = 900;
const POLL_TRIES = 45;          // ~40s, inside the 150s free-plan wall clock

let DI_ENDPOINT = Deno.env.get('AZURE_DI_ENDPOINT') ?? '';
let DI_KEY = Deno.env.get('AZURE_DI_KEY') ?? '';
async function getAzureDi(): Promise<{ endpoint: string; key: string }> {
  if (DI_ENDPOINT && DI_KEY) return { endpoint: DI_ENDPOINT, key: DI_KEY };
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await admin.rpc('get_azure_di');
  if (error) throw new Error('vault lookup failed: ' + error.message);
  DI_ENDPOINT = data?.endpoint || '';
  DI_KEY = data?.key || '';
  return { endpoint: DI_ENDPOINT, key: DI_KEY };
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const J = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    // Require a signed-in user — the platform's verify_jwt lets the public anon
    // key through, so check the JWT's role claim ourselves.
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    let role = '';
    try { role = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role || ''; } catch (_e) { /* fall through */ }
    if (role !== 'authenticated') return J({ error: 'Sign-in required.' }, 401);

    const { endpoint, key } = await getAzureDi();
    if (!endpoint || !key) return J({ error: 'Azure Document Intelligence is not configured on the server.' }, 500);

    const { pdf } = await req.json();
    if (!pdf || typeof pdf !== 'string') return J({ error: 'No page to read.' }, 400);
    // F0 rejects anything over 4MB; say so plainly rather than relaying Azure's error
    if (pdf.length > 5_400_000) return J({ error: 'That page is too large to read (4MB limit).' }, 413);

    const base = endpoint.replace(/\/+$/, '');
    const start = await fetch(
      `${base}/documentintelligence/documentModels/${MODEL}:analyze?api-version=${API_VERSION}`,
      {
        method: 'POST',
        headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Source: pdf }),
      },
    );
    if (start.status !== 202) {
      const t = await start.text().catch(() => '');
      return J({ error: `Azure declined the page (${start.status}).`, detail: t.slice(0, 300) }, 502);
    }
    const op = start.headers.get('operation-location') || start.headers.get('Operation-Location');
    if (!op) return J({ error: 'Azure accepted the page but returned no result location.' }, 502);

    let result: any = null;
    for (let i = 0; i < POLL_TRIES; i++) {
      await sleep(POLL_MS);
      const r = await fetch(op, { headers: { 'Ocp-Apim-Subscription-Key': key } });
      const j = await r.json().catch(() => null);
      const st = j?.status;
      if (st === 'succeeded') { result = j; break; }
      if (st === 'failed') return J({ error: 'Azure could not read that page.' }, 502);
    }
    if (!result) return J({ error: 'Azure did not finish reading that page in time.' }, 504);

    // Hand back only what the geometry needs. The raw response is large and
    // mostly paragraphs/tables/styles the client has no use for.
    const page = result?.analyzeResult?.pages?.[0] || {};
    return J({
      width: page.width ?? 0,
      height: page.height ?? 0,
      unit: page.unit ?? '',
      angle: page.angle ?? 0,
      words: (page.words || []).map((w: any) => ({ s: w.content, poly: w.polygon })),
      marks: (page.selectionMarks || []).map((m: any) => ({ on: m.state === 'selected', poly: m.polygon })),
    });
  } catch (e) {
    return J({ error: (e as Error).message || 'OCR request failed.' }, 500);
  }
});
