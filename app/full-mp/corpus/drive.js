/* corpus/drive.js — the drive seam: one property, one browser session, BOTH
   fill orders, produced by the real signed-in app the way a person produces it.

   WHAT CHANGED, AND WHY IT HAD TO. This file used to boot the app at
   `?selftest=1`. That flag is a structural safety guarantee — app.js returns
   inside `if(SELFTEST)` three lines before the only `createClient` call in the
   program, so the selftest page can never reach Supabase and therefore can
   never reach Azure — and it buys that safety by running the app against a
   localStorage stub with test hooks hanging off `window.__t`. Every run was
   therefore a run of a different program from the one Matt opens. It also meant
   tier 3 was unreachable, so the only way to feed an unreadable schedule to the
   form was to inject a parse RESULT from a side cache: the exact shortcut the
   rest of this file exists to avoid.

   So the app is now booted with NO flag, signed in as the real user, against
   the real database. `window.__t` does not exist here (app.js attaches it only
   under SELFTEST) and no attempt is made to bring it back: everything is driven
   through the DOM the way a hand drives it — the New-property dialog, the
   Start-new-package dialog, the two hidden file inputs, the two "Fill form
   from …" buttons, Generate, and the package dialog's download.

   THE ONE-UPLOAD RULE, WHICH IS THE WHOLE DESIGN. Tier 3 (Azure Document
   Intelligence) bills per page, and only 7 of 34 filed schedules are readable
   without it. Two fill orders used to mean two browser sessions, two uploads
   and two OCR bills for one property — and worse, two DIFFERENT readings of the
   same page, so any disagreement between the orders could always have been a
   disagreement between two scans.

   `rsRemember()` (app.js:1031) is what makes one upload enough. The instant a
   parse returns, the app writes {name, kind, via, at, parsed} into the CYCLE —
   the reading, not the PDF bytes. `rsRecall()` reads it back on every
   `openCycleForm`. Form field values, by contrast, live in memory until
   somebody presses "Update property profile". So a page reload against the same
   cycle gives you, by the app's own design and with no help from us:

       · both uploads still attached, still carrying their parsed readings;
       · a completely empty form.

   That is exactly the state the second fill order needs, and it is reached by
   pressing F5. Both facts are ASSERTED after the reload (step 6). If the form
   came back holding order A's values, order B is measuring contamination; if an
   upload was dropped, order B is measuring nothing at all. Either one is
   reported as an error rather than folded quietly into a result that looks like
   the other 33.

   ONE THING THE RELOAD DOES NOT RESTORE, and it is an app defect this loop
   found on its first night: document 04 of the package IS the study PDF, passed
   through byte for byte, but `rcsRecall()` answers `bytes:null`. So a reopened
   package builds document 04 out of nothing — the combined PDF silently loses
   it and the folder download dies with "Cannot read properties of null". Step
   6b re-attaches the STUDY (never the schedule) so the second order can still
   be produced, asserts that doing so billed no OCR, and says all of this out
   loud in the warnings. See reattachStudy's note at step 6b.

   THE PROPERTY NAME. These runs create real records in a real account, so they
   must be findable and removable afterwards. Every property this file creates
   is named `ZZ-CORPUS-<code>-<stamp>`, and `cleanup()` deletes exactly the rows
   whose name starts with that prefix. Note the consequence for the comparison:
   `property.name` reaches the generated documents from the FORM, and
   `rsFillFromParsed` overwrites it with whatever the schedule prints
   (app.js:1844-1848) — so on a readable schedule the documents carry the real
   name and only the record carries the prefix. On a schedule too poor to yield
   a name the documents carry the prefix, and `nameIsPrefix` says so on the
   result rather than leaving the comparator to rediscover it as 34 mismatches.

   THE DOWNLOAD. `dlPackageFolder` builds a zip in the page and hands it to an
   anchor with a `download` attribute. We ask chromium to write downloads to a
   per-order directory and click the real button. We ALSO wrap
   `URL.createObjectURL` + `HTMLAnchorElement.click` so the same bytes can be
   pulled back over CDP if headless chromium declines to write the file. The
   wrapper calls straight through, so the real path is still attempted; only
   when nothing lands on disk do we use the captured blob, and every result
   produced that way carries `weakerTest: true`. A labelled weaker test beats a
   blocked night; an unlabelled one is worse than either.

   The zip is STORED, never deflated (see buildZip in xlsx.js), so it is
   unpacked here with a dozen lines of DataView rather than a dependency.

   A pid-scoped bundle path, because a fixed one in the shared temp directory
   means a concurrent run rebuilds the file THIS run is serving and the page
   silently becomes somebody else's code — a green run that tested nothing.

   Run one by hand:
     node app/full-mp/corpus/drive.js <corpusRoot> <cacheRoot> <corpus.json> <propertyCodeOrName> [outRoot]
   Remove every record these runs made:
     node app/full-mp/corpus/drive.js --cleanup --prefix ZZ-CORPUS-
*/

const cp = require('child_process'), http = require('http'), fs = require('fs'),
      os = require('os'), path = require('path'), net = require('net');

const SRC = path.join(__dirname, '..');            // app/full-mp
const REPO = path.join(SRC, '..', '..');           // repo root
const SESSION_DEFAULT = path.join(REPO, '_archive', 'corpus-cache', '.session.json');
/* A property-year this rig cannot reproduce — the portfolio has no such
   property, or the tracker cannot date that year. Distinct from Error so a
   sweep can report it as skipped-and-counted rather than as a failure of the
   app, and loudly either way: silence is what lets a thinning schedule read
   as a clean run. */
class SkipRun extends Error { constructor(m) { super(m); this.name = 'SkipRun'; this.skipped = true; } }
const NAME_PREFIX = 'ZZ-CORPUS-';

/* ── the created-property ledger ────────────────────────────────────────────
   THE PREFIX IS NOT A HANDLE. A scratch property is created as
   ZZ-CORPUS-<code>-<stamp>, and then the app does exactly what it is supposed
   to do: a readable rent schedule supplies the real property name, the form
   saves it, and the prefix is GONE. `--cleanup --prefix ZZ-CORPUS-` then
   reports zero with total honesty while the records sit in the live account
   under names like "Oak Center 1" and "Peterson Plaza Apartments",
   indistinguishable from the real portfolio.

   Measured on 2026-07-31: an 89-package sweep left 18 such records behind, and
   cleanup reported 0. They had to be found by creation date and deleted by
   hand. The storm had flagged the rename hours earlier — property.name holding
   the real name over a ZZ-CORPUS db_value — and it was dismissed as a harness
   artifact.

   So every property this driver creates is written down HERE, by id, the
   moment it exists. An id cannot be renamed. The prefix sweep stays as a
   second net for records whose id was never recorded (a crash between the
   create and the write), but the ledger is the primary handle. */
const CREATED_LOG = path.join(REPO, '_archive', 'corpus-cache', '.created-properties.json');
function readCreated() {
  try { const j = JSON.parse(fs.readFileSync(CREATED_LOG, 'utf8')); return Array.isArray(j) ? j : []; }
  catch (e) { return []; }
}
function recordCreated(id, name) {
  if (!id) return;
  try {
    const all = readCreated();
    if (all.some(x => x.id === id)) return;
    all.push({ id, name: name || null, at: new Date().toISOString() });
    fs.mkdirSync(path.dirname(CREATED_LOG), { recursive: true });
    fs.writeFileSync(CREATED_LOG, JSON.stringify(all, null, 1), { mode: 0o600 });
  } catch (e) { /* never let bookkeeping fail a run — the prefix net still applies */ }
}
/* A cycle carries no name of ours, so the ledger is the ONLY handle cleanup
   has on it. That is why this one THROWS where recordCreated() swallows: a
   silent bookkeeping failure here leaks a cycle into the live portfolio that
   nothing can find again. Fail the run instead. */
function recordCreatedCycle(cycleId, propertyId, label) {
  if (!cycleId) throw new Error('refusing to continue: the app produced no cycle id to record, and an unrecorded cycle cannot be cleaned up');
  const all = readCreated();
  if (all.some(x => x.id === cycleId)) return;
  all.push({ kind: 'cycle', id: cycleId, propertyId: propertyId || null, name: label || null, at: new Date().toISOString() });
  fs.mkdirSync(path.dirname(CREATED_LOG), { recursive: true });
  fs.writeFileSync(CREATED_LOG, JSON.stringify(all, null, 1), { mode: 0o600 });
}

function forgetCreated(ids) {
  try {
    const gone = new Set(ids);
    fs.writeFileSync(CREATED_LOG, JSON.stringify(readCreated().filter(x => !gone.has(x.id)), null, 1), { mode: 0o600 });
  } catch (e) {}
}

/* ── the rail that used to live only in a test ───────────────────────────
   A sweep signs into Matt's LIVE account and writes ZZ-CORPUS-* properties
   into it, and on this repo a push to main is a deploy. So a sweep must not
   run from main. That rule existed only as an assertion inside
   corpus/test_safety.js, which means it never stopped a single sweep — it
   stopped the TEST SUITE, and once the corpus tooling landed on main it made
   run_tests.sh (and so deliver.sh) permanently red on the one branch we ship
   from. A rule enforced somewhere other than the point of action is not
   enforced; this is that rule moved to the point of action.

   CORPUS_BRANCH overrides the branch lookup so the suite can drive this exact
   path instead of asserting a copy of it. CORPUS_ALLOW_MAIN=1 is the
   deliberate override, named for what it costs. */
function currentBranch(){
  if(process.env.CORPUS_BRANCH) return process.env.CORPUS_BRANCH;
  try{ return cp.execSync('git rev-parse --abbrev-ref HEAD',
    {cwd:__dirname,stdio:['ignore','pipe','ignore']}).toString().trim(); }
  catch(e){ return ''; }
}
function refuseOnMain(branch){ return String(branch).trim()==='main'; }
function assertNotMain(what){
  if(process.env.CORPUS_ALLOW_MAIN==='1') return;
  const br=currentBranch();
  if(refuseOnMain(br)){
    console.error('REFUSING: '+what+' must not run on main.');
    console.error('  A sweep writes '+NAME_PREFIX+'* properties into the LIVE account,');
    console.error('  and on this repo a push to main is a deploy.');
    console.error('  Check out a working branch, or set CORPUS_ALLOW_MAIN=1 to override.');
    process.exit(2);
  }
}
const ORDERS = ['rs-first', 'rcs-first'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const J = v => JSON.stringify(v);

/* ── the bundle, pid-scoped ─────────────────────────────────────────────── */
const BUNDLE = path.join(os.tmpdir(), 'rcs_drive_bundle.' + process.pid + '.html');
const SCRATCH = path.join(os.tmpdir(), 'rcs_drive_in.' + process.pid);
process.on('exit', () => {
  try { fs.rmSync(BUNDLE, { force: true }); } catch (e) {}
  try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch (e) {}
});
function buildBundle() {
  cp.execFileSync('bash', [path.join(SRC, 'build.sh'), BUNDLE], { stdio: ['ignore', 'ignore', 'pipe'] });
  const n = fs.statSync(BUNDLE).size;
  if (n < 500000) throw new Error('built bundle is implausibly small (' + n + ' bytes)');
  return n;
}

/* ── the account ────────────────────────────────────────────────────────── */
/* config.js is the app's own connection setting, so the harness and the page
   can never disagree about which project they are talking to. */
function supaConfig() {
  const cfg = fs.readFileSync(path.join(SRC, 'config.js'), 'utf8');
  const url = (cfg.match(/SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1];
  const anon = (cfg.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/) || [])[1];
  if (!url || !anon) throw new Error('could not read SUPABASE_URL / SUPABASE_ANON_KEY from app/full-mp/config.js');
  const ref = url.replace(/^https?:\/\//, '').split('.')[0];
  /* supabase-js derives its storage key as `sb-${hostname.split('.')[0]}-auth-token`
     (SupabaseClient constructor, lib/supabase.min.js). Deriving it the same way
     from the same string is the only thing that keeps this true if the project
     ever moves. */
  return { url: url.replace(/\/+$/, ''), anon, ref, storageKey: 'sb-' + ref + '-auth-token' };
}

class NoSession extends Error {}

/* The tokens signin.js wrote, refreshed if they have gone stale. No password is
   ever here: signin.js is the only thing that sees one, it asks in Matt's own
   terminal with echo off, and it keeps only what comes back. */
async function loadSession(sessionFile) {
  const f = sessionFile || SESSION_DEFAULT;
  const how = '\n  Sign in first — it asks for the password in YOUR terminal and never stores it:\n'
            + '      node app/full-mp/corpus/signin.js\n';
  /* A CLOUD RUNNER HAS NO SESSION FILE. It gets a fresh clone and nothing else:
     the cache the file lives in is gitignored, and signin.js cannot run because
     there is no terminal to type a password into. So a refresh token may arrive
     through the environment instead. It is exchanged for an access token by the
     very same refresh call below — the token is written to disk only if the
     directory already exists, because on the runner it does not and a missing
     cache must not be the thing that fails the run. */
  let s = null;
  const envTok = (process.env.RCS_SUPABASE_REFRESH_TOKEN || '').trim();
  if (!fs.existsSync(f)) {
    if (!envTok) throw new NoSession('no signed-in session at ' + f
      + '\n  and RCS_SUPABASE_REFRESH_TOKEN is not set in the environment.' + how);
    /* expires_at 0 forces the refresh path, which is what turns the token into a
       usable session. */
    s = { access_token: 'env', refresh_token: envTok, expires_at: 0, email: '' };
  } else {
    try { s = JSON.parse(fs.readFileSync(f, 'utf8')); }
    catch (e) { throw new NoSession('the session file at ' + f + ' is not readable JSON.' + how); }
  }
  if (!s || !s.access_token || !s.refresh_token)
    throw new NoSession('the session file at ' + f + ' carries no access/refresh token.' + how);

  const cfg = supaConfig();
  const left = (s.expires_at || 0) - Math.floor(Date.now() / 1000);
  if (left > 300) return { sess: s, refreshed: false, file: f, secondsLeft: left };

  const r = await fetch(cfg.url + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST', headers: { apikey: cfg.anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: s.refresh_token }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token)
    throw new NoSession('the stored session expired ' + Math.abs(left) + 's ago and the refresh token was refused ('
      + r.status + ': ' + (j.error_description || j.msg || j.error || 'unknown') + ').' + how);
  const ns = {
    access_token: j.access_token,
    refresh_token: j.refresh_token || s.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
    email: (j.user && j.user.email) || s.email || '',
  };
  try { fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, JSON.stringify(ns, null, 1), { mode: 0o600 }); }
  catch (e) { /* a runner with a read-only or absent cache still has its session in memory */ }
  return { sess: ns, refreshed: true, file: f, secondsLeft: (j.expires_in || 3600) };
}

/* ── chromium ───────────────────────────────────────────────────────────── */
function findChrome() {
  /* an explicit override wins over any search */
  if (process.env.CHROME_PATH) {
    try { fs.accessSync(process.env.CHROME_PATH, fs.constants.X_OK); return process.env.CHROME_PATH; } catch (e) {}
  }
  const cands = [];
  /* Same search as cdplib.js findChrome -- see the note there. The corpus
     driver needs a browser too, so this copy has to know the same roots. */
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH,
                 path.join(os.homedir(), 'Library/Caches/ms-playwright'),
                 path.join(os.homedir(), '.cache/ms-playwright')].filter(Boolean);
  for (const pw of roots) {
  const dirs = fs.existsSync(pw) ? fs.readdirSync(pw) : [];
  for (const d of dirs.filter(x => /headless_shell/.test(x)))
    cands.push(path.join(pw, d, 'chrome-headless-shell-mac-arm64/chrome-headless-shell'),
               path.join(pw, d, 'chrome-headless-shell-linux64/chrome-headless-shell'),
               path.join(pw, d, 'chrome-linux/headless_shell'));
  for (const d of dirs.filter(x => /^chromium-/.test(x)))
    cands.push(path.join(pw, d, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
               path.join(pw, d, 'chrome-linux/chrome'));
  }
  cands.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
             '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  return cands.find(p => { try { fs.accessSync(p, fs.constants.X_OK); return true; } catch (e) { return false; } }) || null;
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.waits = new Map(); this.logs = []; this.dialogs = [];
    ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id && this.waits.has(m.id)) {
        const { res, rej } = this.waits.get(m.id); this.waits.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        this.logs.push((m.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 300));
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.logs.push('EXCEPTION ' + String((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description)
          || m.params.exceptionDetails.text).slice(0, 300));
      } else if (m.method === 'Page.javascriptDialogOpening') {
        /* The app does not use window.alert/confirm, but a native dialog left
           open freezes the renderer and every later eval times out with no
           explanation. Record the text (it is evidence), then dismiss. */
        this.dialogs.push(m.params.message || '');
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      }
    });
  }
  send(method, params) {
    const id = ++this.id;
    return new Promise((res, rej) => { this.waits.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('EVAL: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text) + '\n--- expr ---\n' + expr);
    return r.result.value;
  }
  /* an objectId, for the DOM-domain calls that cannot take an expression */
  async handle(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr });
    if (r.exceptionDetails) throw new Error('HANDLE: ' + expr);
    return r.result.objectId || null;
  }
}

/* ── the prelude ────────────────────────────────────────────────────────── */
/* Installed with Page.addScriptToEvaluateOnNewDocument so it runs BEFORE the
   bundle's own script on every navigation, including the reload.

   · THE SESSION. supabase-js reads its session out of localStorage under
     `sb-<ref>-auth-token` and accepts anything carrying access_token,
     refresh_token and expires_at (`_isValidSession`). Writing the tokens there
     before app.js runs makes `getSession()` succeed and the DOMContentLoaded
     handler go straight to boot() — the same path a returning browser takes,
     and no sign-in form is ever touched. This is why `?selftest=1` is NOT set:
     that flag returns before createClient and would make the whole exercise a
     test of the stub again.
   · THE NETWORK LOG. Every non-loopback request, method and path, query string
     stripped. It is how a run proves what it billed: the OCR endpoint appears
     exactly as often as a document needed scanning, and never after the reload.
     `__inflight` counts requests still in the air, because the data layer
     pushes writes through a promise queue with no DOM signal, and reloading on
     top of an unflushed cycle upsert is precisely how an upload goes missing.
   · THE GRAB. It WRAPS, never replaces: the original createObjectURL and the
     original anchor click both still run, so the genuine download is still
     attempted. It only keeps a reference to the same Blob so the bytes stay
     reachable over CDP if chromium writes nothing to disk. */
function prelude(storageKey, sess) {
  const stored = JSON.stringify({
    access_token: sess.access_token, refresh_token: sess.refresh_token,
    expires_at: sess.expires_at,
    expires_in: Math.max(60, (sess.expires_at || 0) - Math.floor(Date.now() / 1000)),
    token_type: 'bearer',
  });
  return `(function(){
  try{localStorage.setItem(${J(storageKey)},${J(stored)});}catch(e){}
  window.__net=[];window.__inflight=0;window.__errs=[];
  const local=u=>{try{const s=String(u);
    return /^(blob:|data:|about:)/.test(s)||/^https?:\\/\\/(127\\.0\\.0\\.1|localhost)(:|\\/|$)/.test(s)||s.charAt(0)==='/'||!/^[a-z]+:/i.test(s);
  }catch(e){return false;}};
  const note=(m,u)=>{try{if(!local(u))window.__net.push(String(m||'GET').toUpperCase()+' '+String(u).split('?')[0]);}catch(e){}};
  const _f=window.fetch;
  if(_f)window.fetch=function(u,o){const s=(u&&u.url)||u;note((o&&o.method)||(u&&u.method)||'GET',s);
    window.__inflight++;
    const done=()=>{window.__inflight=Math.max(0,window.__inflight-1);};
    return _f.apply(this,arguments).then(r=>{done();return r;},e=>{done();throw e;});};
  const _o=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){note(m,u);return _o.apply(this,arguments);};
  window.addEventListener('error',e=>{try{window.__errs.push(String(e.message||e).slice(0,240));}catch(x){}});
  window.addEventListener('unhandledrejection',e=>{try{window.__errs.push('REJECTED '+String((e.reason&&e.reason.message)||e.reason).slice(0,240));}catch(x){}});

  window.__grab=[];
  const _map=new Map();
  const _oc=URL.createObjectURL.bind(URL);
  URL.createObjectURL=function(b){const u=_oc(b);try{_map.set(u,b);}catch(e){}return u;};
  const _click=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){
    try{if(this.download&&_map.has(this.href))window.__grab.push({name:this.download,blob:_map.get(this.href)});}catch(e){}
    return _click.apply(this,arguments);};
  window.__grabSize=i=>window.__grab[i].blob.size;
  window.__grabB64=async(i,off,len)=>{
    const b=window.__grab[i].blob.slice(off,off+len);
    const u=new Uint8Array(await b.arrayBuffer());
    let s='';for(let j=0;j<u.length;j++)s+=String.fromCharCode(u[j]);
    return btoa(s);};
})();`;
}

async function pullGrab(c, i) {
  const size = await c.eval(`return window.__grabSize(${i});`);
  const CH = 1500000;                      // a multiple of 3, so base64 chunks concatenate
  const parts = [];
  for (let off = 0; off < size; off += CH)
    parts.push(Buffer.from(await c.eval(`return await window.__grabB64(${i},${off},${CH});`), 'base64'));
  const out = Buffer.concat(parts);
  if (out.length !== size) throw new Error('grabbed ' + out.length + ' of ' + size + ' bytes');
  return out;
}

/* ── the zip the app builds is STORED, so unpack it here ────────────────── */
function unzipStored(buf) {
  const out = [];
  let i = 0;
  while (i + 30 <= buf.length) {
    if (buf.readUInt32LE(i) !== 0x04034b50) break;
    const method = buf.readUInt16LE(i + 8);
    const size = buf.readUInt32LE(i + 18);
    const nlen = buf.readUInt16LE(i + 26), elen = buf.readUInt16LE(i + 28);
    const name = buf.slice(i + 30, i + 30 + nlen).toString('utf8');
    const start = i + 30 + nlen + elen;
    if (method !== 0) throw new Error('zip member "' + name + '" is compressed (method ' + method + '); this unpacker only reads STORED');
    out.push({ name, data: buf.slice(start, start + size) });
    i = start + size;
  }
  if (!out.length) throw new Error('no zip members found — the captured bytes are not the package folder');
  return out;
}

/* ── page-side expressions ──────────────────────────────────────────────── */
/* Every one of these reads the DOM the app actually renders. None of them
   touches window.__t, which does not exist outside ?selftest=1. */
const EX_VIEW = `const V=['Auth','Menu','Launcher','Form','Contacts'];
  for(let i=0;i<V.length;i++){const e=document.getElementById('view'+V[i]);if(e&&e.style.display!=='none')return V[i];}
  return '(none)';`;

/* renderSources() emits '<div class="srcgrid">'+rs+rcs+'</div>' (app.js:1950),
   so row 0 is the executed rent schedule and row 1 the study. .sfname holds the
   placeholder until a file is read and the file's own name after; .spin is the
   reading indicator; .sfacts holds #rsApply / #rcsApply / #upRs / #upRcs. */
const EX_TILES = `const rows=[].slice.call(document.querySelectorAll('#sections .srcgrid > .srcrow'));
  const one=r=>r?{name:((r.querySelector('.sfname')||{}).textContent||'').trim(),
                  state:((r.querySelector('.sfmeta')||{}).textContent||'').trim(),
                  sub:((r.querySelector('.sfsub')||{}).textContent||'').trim(),
                  spin:!!r.querySelector('.spin'),
                  acts:[].slice.call(r.querySelectorAll('.sfacts button')).map(b=>b.id||(b.textContent||'').trim())}:null;
  return {n:rows.length,rs:one(rows[0]),rcs:one(rows[1]),
          status:((document.getElementById('status')||{}).textContent||'').trim()};`;

/* The form as the screen shows it. Text cells carry data-k and checkboxes carry
   data-cb (app.js:918/919/936/490). Fuel chips and write-in boxes are neither
   and are not compared; the question this feeds is "did order A's values
   survive the reload", and every value a fill writes lands in one of these
   two. */
const EX_SNAP = `const o={};
  document.querySelectorAll('#sections [data-k]').forEach(n=>{
    if(!('value' in n))return; const k=n.getAttribute('data-k');
    const v=String(n.value==null?'':n.value);
    if(o[k]==null||o[k]==='')o[k]=v;});
  document.querySelectorAll('#sections input[data-cb]').forEach(n=>{o['cb:'+n.getAttribute('data-cb')]=n.checked?'1':'';});
  return o;`;

/* What PROVENANCE the form actually reached, as a histogram over the store's
   own source values. Read-only, and it exists to settle a claim rather than
   decorate the record: the run order argues that no audit run has ever
   exercised the states Matt's team works in, because a package created against
   a blank property makes every cell read `new` — grey — and never `database`
   (on file, blue) or `overridden` (orange). Nothing measured that. Now every
   record says so in one field, which means the two-pass change can be shown to
   have worked instead of assumed to have. */
const EX_PROV = `const o={};
  try{
    if(typeof form==='undefined'||!form)return {err:'no form binding'};
    for(const k in form){const c=form[k];
      if(!c||typeof c!=='object')continue;
      const s=String((c.source==null?'':c.source));
      if(!s)continue; o[s]=(o[s]||0)+1;}
  }catch(e){return {err:String((e&&e.message)||e)};}
  return o;`;

const EX_QUIET = `return {inflight:window.__inflight|0,net:(window.__net||[]).length};`;

/* activePid / activeCid are the app's own top-level bindings (app.js:75). The
   bundle is plain concatenated script — not a module, not an IIFE — so they are
   reachable by name. This is a READ for the record and never a way to drive
   anything: every navigation below goes through the DOM, and after the reload
   the ids the DOM route lands on are checked against these. */
const EX_IDS = `return {pid:(typeof activePid==='undefined'?null:activePid),
                        cid:(typeof activeCid==='undefined'?null:activeCid)};`;

const EX_PROPNAME = `const i=document.querySelector('#sections [data-k="property.name"]');
  return i?String(i.value||''):'';`;

/* What the app RECORDED about each upload, which the tile only paraphrases.
   Two things are wanted and neither is legible on screen:

   · kind + via. parseRsPdf answers with a PAIR and the halves mean different
     things: `kind:'fields'` is "values came out", `via` is which tier they came
     from ('' = the AcroForm, 'text' = the text layer, 'ocr' = Azure).
     `kind:'text'` with a null parse is the OPPOSITE of `via:'text'` — it means
     the page had text and none of it was a value. Reading the tier off the
     tile's prose could not tell those apart, and counting OCR REQUESTS is no
     better: ocrHalf is also called to read tick boxes on a page whose values the
     text tier read perfectly well, so "Azure was called" is not "the values came
     from Azure". This is the app's own answer to the question actually asked.
   · hasBytes. rsRecall/rcsRecall return bytes:null by design — the reading is
     persisted with the cycle, the PDF is not (app.js:1037, app.js:1404). The
     tile looks identical either way, and it is the difference between a package
     folder that downloads and one that does not (see step 6b). */
const EX_UPLOAD_STATE = `const one=u=>u?{name:u.name||'',stored:!!u.stored,hasBytes:!!(u.bytes&&u.bytes.length),
    kind:u.kind==null?null:String(u.kind),via:u.via==null?null:String(u.via),why:String(u.why||''),
    units:(u.parsed&&u.parsed.units)?u.parsed.units.length:0,
    halfB:!!(u.parsed&&u.parsed.halfB)}:null;
  return {rs:one(typeof _rsUpload==='undefined'?null:_rsUpload),
          rcs:one(typeof _rcsUpload==='undefined'?null:_rcsUpload)};`;

/* ── waiting ────────────────────────────────────────────────────────────── */
async function waitFor(c, expr, { timeout = 30000, poll = 250, label = 'a condition', onTick = null } = {}) {
  const t0 = Date.now();
  let ticks = 0;
  for (;;) {
    const v = await c.eval('return (' + expr + ');');
    if (v) return v;
    if (Date.now() - t0 >= timeout) throw new Error('timed out after ' + Math.round((Date.now() - t0) / 1000) + 's waiting for ' + label);
    if (onTick && ++ticks % 40 === 0) await onTick(Math.round((Date.now() - t0) / 1000));
    await sleep(poll);
  }
}
/* The data layer pushes writes through a promise queue with no DOM signal, so
   "the screen moved on" is not "the row is in the database". Reloading on top
   of an unflushed cycle upsert is exactly how an upload would go missing, and
   createProperty's insert and createCycle's insert sit in DIFFERENT queues
   (db.supabase.js:194 keys one on the pid and the other on 'cy'+cid), so the
   cycle can outrun the row it points at. A person takes seconds between those
   dialogs; this waits for the same quiet. */
async function awaitQuiet(c, { timeout = 60000, quietMs = 900 } = {}) {
  const t0 = Date.now();
  let since = 0;
  while (Date.now() - t0 < timeout) {
    const s = await c.eval(EX_QUIET);
    if (s.inflight === 0) { if (!since) since = Date.now(); if (Date.now() - since >= quietMs) return true; }
    else since = 0;
    await sleep(150);
  }
  return false;
}

async function settleDir(dir, quietMs = 3000, maxMs = 180000) {
  const snap = () => {
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { return ''; }
    return names.map(n => { let s = 0; try { s = fs.statSync(path.join(dir, n)).size; } catch (e) {} return n + ':' + s; }).sort().join('|');
  };
  const t0 = Date.now();
  let last = snap(), lastAt = Date.now();
  while (Date.now() - t0 < maxMs) {
    await sleep(400);
    const now = snap();
    if (now !== last) { last = now; lastAt = Date.now(); continue; }
    const pending = last.split('|').some(x => /\.crdownload:/.test(x));
    if (!pending && Date.now() - lastAt >= quietMs) break;
  }
  return (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter(n => !/\.crdownload$/.test(n));
}
/* WHERE chromium put it, not where we asked it to. Browser.setDownloadBehavior
   is set again before every order, and a build that quietly ignores the second
   call keeps writing to the first order's directory — which looks from inside
   the second order exactly like a download that never happened. So the whole
   run's download tree is searched, and a file found under the wrong order is
   reported as that, not as nothing. */
function findZips(root, sinceMs) {
  const out = [];
  const walk = d => {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.zip$/i.test(e.name)) continue;
      let st = null; try { st = fs.statSync(p); } catch (e2) { continue; }
      if (sinceMs && st.mtimeMs < sinceMs - 2000) continue;
      out.push({ file: p, dir: d, name: e.name, bytes: st.size, mtimeMs: st.mtimeMs });
    }
  };
  walk(root);
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/* ── the browser session ────────────────────────────────────────────────── */
async function withApp(fn, { sessionFile, width = 1280, height = 1000, log = () => {} } = {}) {
  const bin = findChrome();
  if (!bin) throw new Error('no chromium binary found — install one (npx playwright install chromium). This is not a pass.');
  const cfg = supaConfig();
  const { sess, refreshed, file, secondsLeft } = await loadSession(sessionFile);
  log('session : ' + (sess.email || '(unknown user)') + (refreshed ? ' (refreshed)' : '')
    + ', ' + Math.round(secondsLeft / 60) + ' min left  [' + path.relative(REPO, file) + ']');

  buildBundle();
  const srv = await new Promise(res => {
    const s = http.createServer((rq, rs) => fs.readFile(BUNDLE, (e, b) => {
      if (e) { rs.writeHead(404); rs.end(); } else { rs.writeHead(200, { 'content-type': 'text/html' }); rs.end(b); }
    }));
    s.listen(0, '127.0.0.1', () => res(s));
  });
  const port = srv.address().port;
  const dp = await new Promise(r => { const t = net.createServer(); t.listen(0, '127.0.0.1', () => { const p = t.address().port; t.close(() => r(p)); }); });
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'rcs-drive-cdp-'));
  const rmUd = () => { try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) {} };
  /* see the note in cdplib.js -- root cannot keep the sandbox */
  const rootFlags = (process.getuid && process.getuid() === 0) ? ['--no-sandbox', '--disable-dev-shm-usage'] : [];
  const proc = cp.spawn(bin, ['--headless=new', '--remote-debugging-port=' + dp, '--user-data-dir=' + ud,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', ...rootFlags,
    '--window-size=' + width + ',' + height, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let buf = ''; proc.stderr.on('data', d => { buf += d; });
  const getj = p => new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: dp, path: p }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej);
  });
  let list = null;
  for (let i = 0; i < 120; i++) { try { list = await getj('/json/list'); if (list.some(t => t.type === 'page')) break; } catch (e) {} await sleep(150); }
  if (!list) { proc.kill(); srv.close(); rmUd(); throw new Error('devtools never answered\n' + buf); }
  const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const c = new CDP(ws);
  await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('DOM.enable');
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: prelude(cfg.storageKey, sess) });

  c.url = `http://127.0.0.1:${port}/index.html`;
  c.downloadOk = false;
  c.setDownloadDir = async dir => {
    fs.mkdirSync(dir, { recursive: true });
    /* Browser.setDownloadBehavior is the modern one and works over a page
       session; Page.setDownloadBehavior is the deprecated fallback. Whether
       EITHER is honoured in this chromium build is the question the fallback
       path exists to answer, so record which one was accepted rather than
       assuming the answer. */
    try { await c.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir, eventsEnabled: true }); c.downloadOk = 'Browser'; return; }
    catch (e) {}
    try { await c.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dir }); c.downloadOk = 'Page'; }
    catch (e) { c.downloadOk = false; }
  };

  /* Load, and refuse to continue anywhere but the property gallery. #viewAuth
     is the DEFAULT view in shell.head.html — every other view carries
     style="display:none" — so "we are still on the sign-in screen" is also what
     a boot() that threw looks like. Both are fatal, and the page's own error
     text says which. */
  c.load = async label => {
    await c.send('Page.navigate', { url: c.url });
    try {
      await waitFor(c, `(function(){const m=document.getElementById('viewMenu');return !!(m&&m.style.display!=='none');})()`,
        { timeout: 60000, label: 'the property gallery (' + (label || 'boot') + ')' });
    } catch (e) {
      const d = await c.eval(`return {view:(function(){${EX_VIEW}})(),
        authErr:((document.getElementById('authErr')||{}).textContent||''),
        errs:(window.__errs||[]).slice(0,6),net:(window.__net||[]).slice(0,10)};`).catch(() => ({}));
      throw new Error('the signed-in app never reached the property gallery (' + (label || 'boot') + ').'
        + '\n  view now  : ' + d.view
        + '\n  sign-in error text : ' + J(d.authErr || '')
        + '\n  page errors : ' + J(d.errs || [])
        + '\n  requests  : ' + J(d.net || [])
        + '\n  A JWT/401 here means the stored session is not valid for this project — re-run signin.js.');
    }
    return true;
  };

  try { return await fn(c); }
  finally { try { ws.close(); } catch (e) {} proc.kill(); srv.close(); rmUd(); }
}

/* ── driving the real controls ──────────────────────────────────────────── */
const clickId = (c, id) => c.eval(`const b=document.getElementById(${J(id)});if(!b)throw new Error('no #'+${J(id)}+' to click');b.click();return 1;`);
const hasId = (c, id) => c.eval(`return !!document.getElementById(${J(id)});`);
const statusOf = c => c.eval(`return ((document.getElementById('status')||{}).textContent||'').trim();`);

/* An <input>'s value set from script fires nothing, and the dialogs read .value
   on OK — but the New-property dialog also filters its RA list on 'input', and
   the menu re-renders on it, so the event is dispatched for the same reason a
   person's keystrokes raise it. */
const typeInto = (c, id, v) => c.eval(`const i=document.getElementById(${J(id)});if(!i)throw new Error('no #'+${J(id)});
  i.focus();i.value=${J(v)};i.dispatchEvent(new Event('input',{bubbles:true}));return i.value;`);

/* saveFailedModal and dialogConfirm both render into #dialog behind #scrim. A
   modal left open eats every later click, so anything unexpected is read out
   loud and closed rather than silently waited on. */
async function dismissBlockingModal(c) {
  const d = await c.eval(`const s=document.getElementById('scrim');
    if(!s||!s.classList.contains('open'))return null;
    const g=document.getElementById('dialog');
    return {cls:g.className,text:(g.innerText||'').split('\\n').map(x=>x.trim()).filter(Boolean).slice(0,8).join(' | ')};`).catch(() => null);
  if (!d) return null;
  await c.eval(`const b=document.getElementById('dlgCancel')||document.getElementById('dlgOk');if(b)b.click();
    else document.getElementById('scrim').classList.remove('open');return 1;`).catch(() => {});
  return d.text;
}

/* Upload one PDF through the REAL hidden file input and let the app's own
   onchange handler do the reading — unlockPdf, parseRsPdf and parseRcsPdf are
   three of the four things this seam exists to exercise, and every shortcut
   past them turns the run into a test of the shortcut.

   The settle signal is the app's own source tile: the file's name in .sfname
   with no .spin beside it. That state is unreachable until the handler has
   finished, which a DOM shape that merely "looks different" would not be. */
async function uploadThrough(c, { inputId, filePath, tileKey, label, timeoutMs, log }) {
  const warnings = [];
  const base = path.basename(filePath);
  const oid = await c.handle(`document.getElementById(${J(inputId)})`);
  if (!oid) throw new Error('no #' + inputId + ' in the page — is the form open?');
  const t0 = Date.now();
  await c.send('DOM.setFileInputFiles', { files: [filePath], objectId: oid });

  /* setFileInputFiles is documented to fire `change`, and does in current
     chromium — but the whole point of this file is that the app's handler runs,
     so verify it rather than trust it, and dispatch a real bubbling change
     event if nothing moved. Either way it is the app's handler. */
  let moved = false;
  for (let i = 0; i < 30; i++) {
    const t = await c.eval(EX_TILES);
    const row = t[tileKey] || {};
    if (row.spin || row.name === base || /Reading|Scanning/i.test(t.status)) { moved = true; break; }
    await sleep(150);
  }
  if (!moved) {
    warnings.push(label + ': setFileInputFiles did not fire change; dispatched one');
    await c.eval(`const el=document.getElementById(${J(inputId)});el.dispatchEvent(new Event('change',{bubbles:true}));return 1;`);
  }

  const t = await waitFor(c,
    `(function(){const t=(function(){${EX_TILES}})();const r=t[${J(tileKey)}]||{};
      return (!r.spin&&r.name===${J(base)})?t:null;})()`,
    { timeout: timeoutMs, poll: 500, label: label + ' to finish reading "' + base + '"',
      onTick: async s => { const st = await statusOf(c); log('      … ' + label + ', ' + s + 's — ' + (st || '(no status)').slice(0, 110)); } })
    .catch(async e => {
      const now = await c.eval(EX_TILES).catch(() => null);
      throw new Error(label + ': ' + e.message
        + '\n  tile now : ' + J(now && now[tileKey])
        + '\n  status   : ' + J(now && now.status));
    });
  return { tile: t[tileKey], status: t.status, ms: Date.now() - t0, warnings };
}

async function clickApply(c, id, label) {
  if (!(await hasId(c, id))) return { clicked: false, warning: label + ': #' + id + ' never appeared — nothing was applied to the form' };
  await clickId(c, id);
  /* rsFillFromParsed / rcsFillFromParsed run through renderBody synchronously;
     the SAFMR and factor refreshes they schedule do not, and both write into
     the form. Wait for the page to go quiet so the second fill sees the first
     one settled — which is the whole question the two orders ask. */
  await sleep(400);
  await awaitQuiet(c, { timeout: 30000, quietMs: 700 });
  return { clicked: true, warning: null, status: await statusOf(c) };
}

/* The record parseRsPdf left behind, in the vocabulary the sweep speaks. `kind`
   says whether values came out at all and `via` says which tier produced them,
   and the two must not be collapsed: `kind:'text'` with a null parse is the
   OPPOSITE of `via:'text'`. Reported as the old file reported it — the tier
   name, or `unreadable:<kind>` — so nothing downstream has to learn a new word.
   `halfB` rides along because "Part A came through and Parts F/G did not" is a
   different result from either. */
function tierOf(u) {
  if (!u) return null;
  if (u.kind !== 'fields') return 'unreadable:' + (u.kind || 'none');
  return (u.via || 'fields') + (u.halfB ? ':half' : '');
}

/* ── generate + capture one package ─────────────────────────────────────── */
async function generateAndCapture(c, { outDir, dlDir, dlBase, label, log }) {
  const warnings = [], errors = [];
  const files = [];
  let weakerTest = false, pkgText = [], docRows = null;

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  await c.setDownloadDir(dlDir);

  const grabBefore = await c.eval('return (window.__grab||[]).length;');
  await clickId(c, 'bGenerate');

  /* The letterhead confirmation is a real modal with a real cost — the notice
     prints a generated header without one — so its text is recorded before the
     button is pressed, never clicked blindly past. */
  let pkg = null;
  for (let i = 0; i < 200; i++) {
    const dlg = await c.eval(`const s=document.getElementById('scrim');
      if(!s||!s.classList.contains('open'))return null;
      const d=document.getElementById('dialog');
      return {t:((d.querySelector('.dlg-t')||{}).textContent||''),cls:d.className,
              ok:!!document.getElementById('dlgOk'),folder:!!document.getElementById('dlFolder')};`);
    if (dlg && /\bpkg\b/.test(dlg.cls)) { pkg = dlg; break; }
    if (dlg && dlg.ok) {
      const body = await c.eval(`const d=document.getElementById('dialog');
        return ((d.querySelector('.dlg-b')||{}).textContent||'').slice(0,400);`);
      warnings.push('modal before generation: ' + dlg.t + ' — ' + body);
      await clickId(c, 'dlgOk');
    }
    const st = await statusOf(c);
    if (/^(Cannot generate|Generation failed)/.test(st)) {
      errors.push(label + ': the app refused to generate — ' + st);
      return { outDir, files, weakerTest, pkgText, docRows, warnings, errors };
    }
    await sleep(400);
  }
  if (!pkg) {
    errors.push('the package dialog never opened. Status bar said: ' + J(await statusOf(c)));
    return { outDir, files, weakerTest, pkgText, docRows, warnings, errors };
  }

  /* The dialog's six rows say which documents are ready and, for each one that
     is not, what it is short of. That is the most useful sentence the whole run
     produces when the package comes back incomplete, and throwing it away would
     leave "1 of 6" with no way to ask why. Under ?selftest=1 this came from
     __docMissing; here it is read off the rows themselves — the same answer,
     and the one a person reads. */
  const shown = await c.eval(`const d=document.getElementById('dialog');
    return {head:((d.querySelector('.dlg-b')||{}).textContent||'').trim(),
            rows:[].slice.call(d.querySelectorAll('.gdocs > *')).map(r=>(r.innerText||'').split('\\n').map(x=>x.trim()).filter(Boolean).join(' · ')).slice(0,12),
            all:(d.innerText||'').split('\\n').map(x=>x.trim()).filter(Boolean).slice(0,60)};`);
  warnings.push('package dialog: ' + shown.head);
  pkgText = shown.all; docRows = shown.rows;

  if (!pkg.folder) {
    errors.push('no "Download the RCS Package folder" button — the app produced no ready documents');
    return { outDir, files, weakerTest, pkgText, docRows, warnings, errors };
  }

  const clickedAt = Date.now();
  await clickId(c, 'dlFolder');
  /* dlPackageFolder ENDS by writing to the status bar, whichever way it goes
     (app.js:4126-4139) — "RCS Package folder downloaded …" or "Folder download
     failed: <reason>". That sentence is the app's own account of what happened
     and is worth infinitely more than watching a directory and inferring. A
     directory that stays empty is the same picture whether the zip was written
     somewhere else, the packager threw, or chromium declined; this tells them
     apart. */
  const dlSaid = await waitFor(c,
    `(function(){const s=((document.getElementById('status')||{}).textContent||'');
      return /folder downloaded|Folder download failed|Packager still loading/i.test(s)?s:null;})()`,
    { timeout: 180000, poll: 400, label: 'the folder download to report itself in the status bar' })
    .catch(() => null);
  if (dlSaid && /failed|still loading/i.test(dlSaid)) errors.push(label + ': ' + dlSaid);

  const landed = await settleDir(dlDir);
  const here = landed.filter(n => /\.zip$/i.test(n));
  let zipBuf = null;
  if (here.length) zipBuf = fs.readFileSync(path.join(dlDir, here[0]));
  else {
    const stray = dlBase ? findZips(dlBase, clickedAt).filter(z => path.resolve(z.dir) !== path.resolve(dlDir)) : [];
    if (stray.length) {
      zipBuf = fs.readFileSync(stray[0].file);
      warnings.push('chromium ignored the download directory for this order and wrote to ' + J(stray[0].dir)
        + ' (setDownloadBehavior=' + c.downloadOk + '); the file was taken from there');
      try { fs.rmSync(stray[0].file, { force: true }); } catch (e) {}
    } else {
      const n = await c.eval('return (window.__grab||[]).length;');
      if (n <= grabBefore) {
        errors.push('nothing downloaded and nothing captured — the folder button produced no file and no blob.'
          + '  status: ' + J(dlSaid) + '  ·  setDownloadBehavior=' + c.downloadOk
          + '  ·  ' + J(dlDir) + ' holds ' + J(landed));
        return { outDir, files, weakerTest: true, pkgText, docRows, warnings, errors };
      }
      zipBuf = await pullGrab(c, n - 1);
      weakerTest = true;
      warnings.push('chromium wrote no file to the download directory (setDownloadBehavior=' + c.downloadOk +
                    '); the package bytes were pulled out of the page instead — weakerTest');
    }
  }

  /* The app names its documents after the property, and a property may be
     called "Lansing Manor / Senior World" — so a member name straight from the
     zip turns "04. Lansing Manor / Senior World - RCS Report.pdf" into a
     DIRECTORY called "04. Lansing Manor " holding a file called "Senior World -
     RCS Report.pdf". It writes without error and looks fine in a listing, which
     is the worst kind of wrong. `name` stays what the app generated, because
     that is what the comparison must match against; `file` is what landed. */
  for (const m of unzipStored(zipBuf)) {
    const name = m.name.replace(/^RCS Package\//, '');
    const file = name.replace(/[/\\]/g, '-');
    fs.writeFileSync(path.join(outDir, file), m.data);
    files.push({ name, file, bytes: m.data.length });
    if (file !== name) warnings.push('the document name contains a path separator and was written as ' + J(file));
  }
  /* Close it, so the next step's first click is not swallowed by a live scrim. */
  await c.eval(`const b=document.getElementById('dlgCancel');if(b)b.click();return 1;`).catch(() => {});
  log('    ' + label + ': ' + files.length + ' files' + (weakerTest ? '  (weakerTest)' : ''));
  return { outDir, files, weakerTest, pkgText, docRows, warnings, errors };
}

/* ── inputs off disk ────────────────────────────────────────────────────── */
/* Prefer a decrypted copy in the cache at the same relative path; the corpus is
   the fallback, and is only ever read. Both are copied into a pid-scoped
   scratch directory before chromium sees them, so nothing under the Drive mount
   is ever opened for write and a streaming mount cannot surprise us. */
function makeResolver(corpusRoot, cacheRoot, propertyFolder) {
  return rel => {
    if (!rel) return null;
    const cands = [];
    if (cacheRoot) cands.push(path.join(cacheRoot, propertyFolder, rel));
    cands.push(path.join(corpusRoot, propertyFolder, rel));
    const hit = cands.find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } });
    if (!hit) return null;
    fs.mkdirSync(SCRATCH, { recursive: true });
    const dst = path.join(SCRATCH, path.basename(rel).replace(/[^\w.\- ]+/g, '_'));
    fs.copyFileSync(hit, dst);
    return { src: hit, tmp: dst, fromCache: cacheRoot ? hit.startsWith(path.resolve(cacheRoot)) : false };
  };
}

/* Keys the app fills in by itself the moment a package opens — the HUD SAFMR
   pull, the checklist defaults, the effective-date row — so a difference in one
   of them across the reload is the app doing its job on the way in, not order A
   leaking through. Anything else is. */
const AUTO_KEYS = /(^cb:check\.\d+$)|(safmr_(hud|custom|source)$)|(^rent_schedule\.date_eff)|(^ocaf\.)|(^uaf\.)/;

function diffSnaps(before, after) {
  const keys = Object.keys(Object.assign({}, before, after)).sort();
  const out = [];
  for (const k of keys) {
    const a = before[k] == null ? '' : before[k], b = after[k] == null ? '' : after[k];
    if (a === b) continue;
    out.push({ key: k, wasAtCreate: a, isNow: b, auto: AUTO_KEYS.test(k) });
  }
  return out;
}

/* ── the run ────────────────────────────────────────────────────────────── */
async function driveBoth(opts) {
  const {
    propertyFolder, studyPath, priorRsPath,
    outRoot, corpusRoot, cacheRoot,
    propertyCode, propertyName,
    sessionFile = null,
    uploadTimeoutMs = 300000,   // tier 3 is polled server-side; 30-120s is normal and 240s happens
    log = () => {},
    /* The interaction storm. Off unless a caller asks for it, and the seed is
       explicit so a run that finds something can be replayed exactly. Callers
       that want a different permutation every run pass a fresh seed; callers
       that want a reproducible one pass a fixed seed. */
    fuzz: fuzzOpts = null,
    /* Which package year this run is. Carried so the output tree and the record
       can say so; a property with a 2026 and a 2021 cycle writes two runs. */
    cycleLabel = null,
  } = opts;

  const warnings = [], errors = [];
  const resolveIn = makeResolver(corpusRoot, cacheRoot, propertyFolder);
  const rs = resolveIn(priorRsPath), study = resolveIn(studyPath);
  if (priorRsPath && !rs) errors.push('prior rent schedule not found on disk: ' + priorRsPath);
  if (studyPath && !study) errors.push('study not found on disk: ' + studyPath);
  if (rs && rs.fromCache) warnings.push('rent schedule read from the decrypted cache');
  if (study && study.fromCache) warnings.push('study read from the decrypted cache');
  if (!rs && !study) throw new Error('neither input is on disk — nothing to drive');

  const code = propertyCode || 'unknown';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
  const runName = NAME_PREFIX + code + '-' + stamp;
  const dlBase = path.join(os.tmpdir(), 'rcs-drive-dl.' + process.pid + '.' + Date.now());

  const meta = await withApp(async c => {
    const orders = {};

    /* ---- 1. the real app, signed in ----------------------------------- */
    await c.load('first boot');
    log('booted  : the property gallery, signed in — not the sign-in screen');

    /* ---- 2. the EXISTING portfolio property, found by ra_property_code ----
       Until 2026-07-31 this created a scratch property. The account now holds
       249 real portfolio records imported from the HAP tracker, so a run must
       find the one it is auditing and add a package to it. Nothing here creates
       a property, which is what lets cleanup() delete only cycles.

       SkipRun, not Error: a property-year the portfolio or the tracker cannot
       supply is not a failure of the app, it is a package this rig cannot
       reproduce. It is reported and counted, never invented. */
    if (!propertyCode) throw new SkipRun('this run carries no ra_property_code, so no portfolio property can be identified');
    const openRes = await c.eval(`
      const code = ${J(String(propertyCode))};
      if (typeof mpdb === 'undefined' || !mpdb.propByRaCode) return { err: 'the data layer exposes no propByRaCode' };
      const pid = mpdb.propByRaCode(code);
      if (!pid) return { err: 'no portfolio property carries ra_property_code ' + code };
      if (typeof openHapProperty === 'function') { await openHapProperty(code); }
      else if (typeof openLauncher === 'function') { openLauncher(pid); }
      else return { err: 'no way to open a property in this build' };
      return { pid: pid };`);
    if (openRes && openRes.err) throw new SkipRun(openRes.err);
    await waitFor(c, `(function(){const v=document.getElementById('viewLauncher');return !!(v&&v.style.display!=='none');})()`,
      { timeout: 20000, label: 'the property page for ' + propertyCode })
      .catch(async e => { const t = await dismissBlockingModal(c); throw new Error(e.message + (t ? '\n  a modal was open: ' + t : '')); });
    await awaitQuiet(c);
    log('opened  : portfolio property ' + propertyCode + ' [' + String(openRes.pid).slice(0, 8) + '…]');

    /* ---- 3. the package for THIS year, off the tracker's own row ---------
       Since main made the renewal schedule definitive, a package created from a
       tracker row renders its program and effective date as LOCKED LINES — there
       is no cyEff input to type into and the package takes the schedule's date.
       So the row must be CHOSEN, because 16 property-years carry more than one.

       targetFor() is the app's own selector: it returns the earliest startable
       row on or after the date given. Asking it as at 1 January of the target
       year therefore yields that year's row if one exists — and if what comes
       back belongs to a different year, the tracker does not carry this one and
       the run skips rather than invent a date. Reusing the app's selector is
       deliberate; a second implementation here could disagree with the app and
       we would be auditing the disagreement. */
    const targetYear = cycleLabel ? String(cycleLabel).match(/\b(19|20)\d{2}\b/) : null;
    if (!targetYear) throw new SkipRun('no four-digit year in the cycle label ' + J(String(cycleLabel)) + ', so no tracker row can be chosen');
    const yr = targetYear[0];
    const pick = await c.eval(`
      const H = window.RCSHap, code = ${J(String(propertyCode))}, yr = ${J(yr)};
      if (!H || !H.targetFor) return { err: 'the HAP tracker seam is not loaded in this build' };
      const rows = (typeof hapAll === 'function') ? hapAll() : null;
      if (!rows || !rows.length) return { err: 'the tracker carries no rows at all' };
      const t = H.targetFor(rows, code, yr + '-01-01');
      if (!t) return { err: 'the tracker carries no startable row for ' + code + ' in or after ' + yr };
      const got = String(t.effective || '').slice(0, 4);
      if (got !== yr) return { err: 'the tracker cannot date ' + code + ' ' + yr + ' — its nearest startable row is ' + t.effective };
      return { effective: t.effective, program: (t.programs && t.programs[0]) || t.program || '', type: t.type || '', deadline: t.deadline || '' };`);
    if (pick && pick.err) throw new SkipRun(pick.err);
    log('tracker : ' + yr + ' row effective ' + pick.effective + (pick.program ? ' (' + pick.program + ')' : ''));

    /* Opened WITH the tracker's prefill, which is what locks the date. Driving
       #bNewCycle bare would open the unprefilled dialog and take a default. */
    await c.eval(`newCycleDialog(${J({ program: pick.program || 'rcs', effective: pick.effective, type: pick.type, deadline: pick.deadline })}); return true;`);
    await waitFor(c, `!!document.getElementById('cyRCS')`, { timeout: 10000, label: 'the Start-new-package dialog' });
    await c.eval(`const r=document.getElementById('cyRCS');r.click();if(!r.checked)r.checked=true;return r.checked;`);
    /* The date is never typed. With a tracker row it is a locked line and there
       is no cyEff to type into; without one this run has already skipped. Typing
       would write rent_schedule.date_eff_source='custom' — an assertion about
       provenance nobody made. */
    await clickId(c, 'dlgOk');
    await waitFor(c, `(function(){const v=document.getElementById('viewForm');return !!(v&&v.style.display!=='none');})()`,
      { timeout: 30000, label: 'the package form' })
      .catch(async e => { const t = await dismissBlockingModal(c); throw new Error(e.message + (t ? '\n  a modal was open: ' + t : '')); });
    await awaitQuiet(c);
    const ids = await c.eval(EX_IDS);
    /* Written down BEFORE anything can rename it. This is the only moment at
       which the id and the fact that WE made it are both known for certain. */
    /* Only the CYCLE. The property is a portfolio record this run did not
       create and must never claim — putting its id in the created-ledger is
       how a future cleanup would come to delete it. */
    recordCreatedCycle(ids.cid, ids.pid, runName);
    log('package : cycle ' + String(ids.cid).slice(0, 8) + '… on property ' + String(ids.pid).slice(0, 8) + '…');

    /* The form as the app opens it, before any document is read. This is what
       "the form came back empty" is measured against in step 6 — a flat list of
       empty strings would fail on the SAFMR the app pulls for itself. */
    const baseline = await c.eval(EX_SNAP);

    /* ---- 4. both uploads, ONCE ---------------------------------------- */
    let rsTile = null, rcsTile = null, rsMs = 0, rcsMs = 0;
    if (rs) {
      log('  uploading the rent schedule: ' + path.basename(rs.tmp));
      const u = await uploadThrough(c, { inputId: 'rsFile', filePath: rs.tmp, tileKey: 'rs', label: 'rent schedule', timeoutMs: uploadTimeoutMs, log });
      u.warnings.forEach(w => warnings.push(w));
      rsTile = u.tile; rsMs = u.ms;
      log('    read in ' + (u.ms / 1000).toFixed(1) + 's — ' + u.tile.state);
    }
    if (study) {
      log('  uploading the study: ' + path.basename(study.tmp));
      const u = await uploadThrough(c, { inputId: 'rcsFile', filePath: study.tmp, tileKey: 'rcs', label: 'study', timeoutMs: uploadTimeoutMs, log });
      u.warnings.forEach(w => warnings.push(w));
      rcsTile = u.tile; rcsMs = u.ms;
      log('    read in ' + (u.ms / 1000).toFixed(1) + 's — ' + u.tile.state);
    }
    /* rsRemember/rcsRemember push the reading into the cycle row. The reload
       below depends on that write having LANDED, not merely been queued. */
    const flushed = await awaitQuiet(c, { timeout: 120000, quietMs: 1500 });
    if (!flushed) warnings.push('the page never went network-quiet after the uploads; a queued cycle write may not have landed before the reload');

    const netAfterUploads = await c.eval('return (window.__net||[]).slice();');
    const ocrCalls = netAfterUploads.filter(x => /functions\/v1\/ocr/.test(x));
    const read = await c.eval(EX_UPLOAD_STATE);
    const tier = tierOf(read.rs);
    const rsVia = read.rs ? (read.rs.via || (read.rs.kind === 'fields' ? 'fields' : null)) : null;
    if (read.rs && read.rs.kind !== 'fields')
      warnings.push('the rent schedule was not readable (kind=' + read.rs.kind + (read.rs.why ? ', ' + read.rs.why : '') + ') — no values can be applied from it');
    if (read.rs && read.rs.halfB)
      warnings.push('only the front half of the rent schedule was read — Parts F and G (ownership entity, principals, signatory) did not come through');
    if (read.rcs && !read.rcs.units)
      warnings.push('the study yielded no unit types — no values can be applied from it');
    /* Requests, not tiers. ocrHalf is also called to read the tick boxes on a
       page whose values the TEXT tier read perfectly well, so this number is
       what was billed and `tier` is where the values came from. They answer
       different questions and are reported separately on purpose. */
    log('  tier: ' + tier + (read.rcs ? ' · study: ' + read.rcs.units + ' unit types' : '')
      + ' · OCR endpoint calls during the uploads: ' + ocrCalls.length);

    /* ---- one order: two clicks, then Generate -------------------------- */
    const runOrder = async order => {
      const w = [], er = [];
      const first = order === 'rs-first' ? ['rsApply', 'rent schedule'] : ['rcsApply', 'study'];
      const second = order === 'rs-first' ? ['rcsApply', 'study'] : ['rsApply', 'rent schedule'];
      for (const pair of [first, second]) {
        const a = await clickApply(c, pair[0], pair[1]);
        if (a.warning) w.push(a.warning); else log('    clicked #' + pair[0]);
      }
      const nameInForm = await c.eval(EX_PROPNAME);
      const ocrBefore = (await c.eval('return (window.__net||[]).slice();')).filter(x => /functions\/v1\/ocr/.test(x)).length;
      const g = await generateAndCapture(c, {
        outDir: path.join(outRoot, String(code), order),
        dlDir: path.join(dlBase, order), dlBase, label: order, log,
      });
      g.warnings.forEach(x => w.push(x)); g.errors.forEach(x => er.push(x));
      return {
        outDir: g.outDir, files: g.files, tier, rsVia,
        weakerTest: g.weakerTest, order, pkgText: g.pkgText, docRows: g.docRows,
        propertyNameInForm: nameInForm, ocrCallsSoFar: ocrBefore,
        warnings: w, errors: er,
        dialogs: c.dialogs.slice(), console: c.logs.slice(0, 20),
      };
    };

    /* ---- 5. order A: RS then study ------------------------------------- */
    log('order A (rs-first) …');
    orders['rs-first'] = await runOrder('rs-first');
    orders['rs-first'].provenance = await c.eval(EX_PROV).catch(e => ({ err: String((e && e.message) || e).slice(0, 120) }));
    log('  provenance: ' + JSON.stringify(orders['rs-first'].provenance));

    /* ---- 6. reload, and prove the state the second order needs --------- */
    log('reloading the page …');
    await c.load('reload');
    /* Back in through the gallery, the way a person returns: search, open the
       card, open the package. The ids that route lands on are then checked
       against the ones from before the reload, so "the same cycle" is a fact
       rather than an assumption. A property with no tracker row is an orphan
       and always shows, and any search query forces the All view
       (renderMenu, app.js:3384), so no lens can hide it. */
    await typeInto(c, 'menuSearch', runName);
    await sleep(500);
    const cardPid = await c.eval(`const q=${J(runName)};
      const b=[].slice.call(document.querySelectorAll('#menuGrid [data-open]'))
        .find(x=>((x.querySelector('.pc-name')||{}).textContent||'').indexOf(q)===0);
      if(!b)return null; b.click(); return b.getAttribute('data-open');`);
    if (!cardPid) throw new Error('after the reload there is no property card named ' + runName + ' — the record never reached the database');
    await waitFor(c, `(function(){const v=document.getElementById('viewLauncher');return !!(v&&v.style.display!=='none');})()`,
      { timeout: 20000, label: 'the property page after the reload' });
    const cyc = await c.eval(`const xs=[].slice.call(document.querySelectorAll('[data-cyopen]'));
      return {n:xs.length,ids:xs.map(x=>x.getAttribute('data-cyopen'))};`);
    if (!cyc.n) throw new Error('after the reload the property has no package — createCycle never landed');
    if (cyc.n !== 1) warnings.push('after the reload the property shows ' + cyc.n + ' packages, expected 1');
    await c.eval(`const b=document.querySelector('[data-cyopen="'+${J(cyc.ids[0])}+'"]');
      if(!b)throw new Error('the package button vanished');b.click();return 1;`);
    await waitFor(c, `(function(){const v=document.getElementById('viewForm');return !!(v&&v.style.display!=='none');})()`,
      { timeout: 30000, label: 'the package form after the reload' });
    await awaitQuiet(c);

    const ids2 = await c.eval(EX_IDS);
    const after = await c.eval(EX_SNAP);
    const tiles2 = await c.eval(EX_TILES);
    const held = await c.eval(EX_UPLOAD_STATE);
    const diffs = diffSnaps(baseline, after);
    const leaked = diffs.filter(d => !d.auto);
    const rsRetained = !rs || !!(tiles2.rs && tiles2.rs.name === path.basename(rs.tmp));
    const rcsRetained = !study || !!(tiles2.rcs && tiles2.rcs.name === path.basename(study.tmp));
    const ocrSinceReload = (await c.eval('return (window.__net||[]).slice();')).filter(x => /functions\/v1\/ocr/.test(x)).length;

    const reopen = {
      propertyIdMatched: ids2.pid === ids.pid, cycleIdMatched: ids2.cid === ids.cid,
      propertyIdFromDom: cardPid, cycleIdFromDom: cyc.ids[0],
      formEmpty: leaked.length === 0, diffs, leaked,
      rsRetained, rcsRetained, rsTile: tiles2.rs, rcsTile: tiles2.rcs,
      held, studyReattached: false,
      ocrCallsSinceReload: ocrSinceReload,
    };
    if (!reopen.propertyIdMatched || !reopen.cycleIdMatched)
      errors.push('after the reload the app is on a DIFFERENT property/package than order A used — the second order would be measuring another record');
    if (!rsRetained)
      errors.push('after the reload the rent-schedule upload is GONE (tile says ' + J(tiles2.rs && tiles2.rs.name)
        + ') — order B has nothing to fill from, and re-uploading would pay for the read twice');
    if (!rcsRetained)
      errors.push('after the reload the study upload is GONE (tile says ' + J(tiles2.rcs && tiles2.rcs.name) + ') — order B has nothing to fill from');
    if (leaked.length)
      errors.push('after the reload the form is NOT empty — ' + leaked.length + ' cell(s) still carry order A: '
        + leaked.slice(0, 6).map(d => d.key + '=' + J(d.isNow)).join(', ') + (leaked.length > 6 ? ' …' : ''));
    if (ocrSinceReload)
      errors.push('the OCR endpoint was called ' + ocrSinceReload + ' more time(s) after the reload — the reading was supposed to be recalled, not re-read');
    log('reopen  : form empty=' + reopen.formEmpty + ' · rs kept=' + rsRetained + ' · study kept=' + rcsRetained
      + ' · same property=' + reopen.propertyIdMatched + ' · same package=' + reopen.cycleIdMatched
      + ' · OCR since reload=' + ocrSinceReload);

    /* ---- 6b. the one thing a reload does NOT restore ------------------- */
    /* DOCUMENT 04 IS THE STUDY PDF ITSELF, PASSED STRAIGHT THROUGH:
         if(_rcsUpload)docs.push({label:'RCS report', …, bytes:_rcsUpload.bytes})
       — app.js:4395, and again at 4335 for the OCAF/UAF package. But
       `rcsRecall()` answers `bytes:null` (app.js:1404), because the reading is
       persisted with the cycle and the PDF deliberately is not. So on a recalled
       package the app pushes a document whose bytes are null, and then:
         · combinePdfs skips it (`if(!b)continue`, app.js:3884) — the combined
           PDF silently comes out WITHOUT the RCS report;
         · buildZip reads data.length — the folder download dies outright with
           "Folder download failed: Cannot read properties of null".
       That is an app defect, and it is not this file's to fix: it means anyone
       who closes a package and comes back to it cannot download its folder. It
       is reported on every run that meets it, in the words the app used.

       The repair here is the smallest one that is honest. Only the STUDY is
       re-attached, and only its bytes are wanted:
         · the study is never OCR'd — #rcsFile's handler calls parseRcsPdf, whose
           only reader is the text layer, so this costs nothing and bills nothing
           (asserted below against the OCR counter);
         · the rent schedule is NOT re-attached, because nothing downstream ever
           reads _rsUpload.bytes — only its parsed reading, which the recall
           restores intact. The expensive document is read exactly once per
           property, which is the whole point of the design.
       An upload does not fill anything; only #rcsApply does. So this puts the
       bytes back and leaves the form as empty as the assertions just found it. */
    if (study && rcsRetained && held.rcs && !held.rcs.hasBytes) {
      /* This WAS the crash report for a live defect: document 04 went into the
         package as null bytes, combinePdfs dropped it silently and buildZip
         threw on f.data.length, so anyone reopening a saved package could not
         download its folder. Fixed 2026-07-29 — the push is now guarded on
         bytes and the row says the file must be re-attached.
         The note stays because the CONDITION it detects has not gone away:
         rcsRecall still returns bytes:null by design (the reading is persisted,
         the PDF deliberately is not), so a reopened package still cannot
         include the study until someone re-attaches it. That is what the
         harness does here, and it is what a real user would do. Worth stating
         on every run so a package that is missing document 04 is never mistaken
         for a package the app declined to build. */
      warnings.push('after reopening, the study is recalled without its bytes (rcsRecall, app.js:1404) — the reading '
        + 'is persisted but the PDF is not, so document 04 cannot be included until the file is re-attached. '
        + 'The harness re-attached it (no OCR, no fill) so both orders produce comparable packages.');
      const before = ocrSinceReload;
      const u = await uploadThrough(c, { inputId: 'rcsFile', filePath: study.tmp, tileKey: 'rcs', label: 'study (re-attached for its bytes)', timeoutMs: uploadTimeoutMs, log });
      u.warnings.forEach(w => warnings.push(w));
      await awaitQuiet(c, { timeout: 60000, quietMs: 1200 });
      const nowOcr = (await c.eval('return (window.__net||[]).slice();')).filter(x => /functions\/v1\/ocr/.test(x)).length;
      if (nowOcr !== before) errors.push('re-attaching the study reached the OCR endpoint ' + (nowOcr - before) + ' time(s) — it must not, and this run has been billed for it');
      const held2 = await c.eval(EX_UPLOAD_STATE);
      reopen.studyReattached = true; reopen.heldAfterReattach = held2;
      const after2 = await c.eval(EX_SNAP);
      const leaked2 = diffSnaps(baseline, after2).filter(d => !d.auto);
      if (leaked2.length) errors.push('re-attaching the study put ' + leaked2.length + ' value(s) into the form; it was supposed to change nothing');
      log('reopen  : study re-attached for its bytes (no OCR: ' + before + ' -> ' + nowOcr + ')');
    } else if (study && held.rcs && !held.rcs.hasBytes) {
      warnings.push('the study was recalled without its bytes and could not be re-attached — document 04 will be missing or the folder download will fail');
    }

    /* ---- 7. order B: study then RS ------------------------------------- */
    if (!rsRetained || !rcsRetained) {
      orders['rcs-first'] = {
        outDir: path.join(outRoot, String(code), 'rcs-first'), files: [], tier, rsVia, order: 'rcs-first',
        skipped: true, warnings: [],
        errors: ['not run: an upload was lost across the reload, so this order could only have been produced by paying for a second read'],
      };
    } else {
      log('order B (rcs-first) …');
      orders['rcs-first'] = await runOrder('rcs-first');
      if (leaked.length) {
        orders['rcs-first'].contaminated = true;
        orders['rcs-first'].errors.push('this order started from a form that still held ' + leaked.length + ' value(s) from the first order — its package is not a clean second reading');
      }
    }

    /* ── the interaction storm ────────────────────────────────────────────
       Both orders have produced their packages; the session is still open and
       the form still holds a real record built from real documents. That is the
       only moment in the whole harness when a randomized interaction pass is
       worth anything: a storm over an EMPTY form exercises empty cells, and the
       defects this project keeps shipping — phantom dirty, a save that drops a
       coupled key, provenance painted twice, a source row that does not survive
       a reopen — all need a form with values and provenance in it.

       Seeded per property and per run, and the seed is recorded, so a storm that
       finds something can be replayed exactly. A different permutation every run
       is the point: the walk that finds nothing today may find something
       tomorrow, and each run is a fresh sample of the interleavings.

       It runs AFTER generation and never before, because it deliberately dirties
       and saves the form: a storm ahead of the documents would be editing the
       package under test. Failures here are recorded, never thrown — the storm
       is an observer of this run, not a gate on it. */
    let fuzz = null;
    if (fuzzOpts && fuzzOpts.episodes > 0) {
      try {
        const { storm, colourBaseline } = require('../fuzz.js');
        const base = await colourBaseline(c);
        log('storm (' + fuzzOpts.episodes + ' episodes, seed ' + fuzzOpts.seed + ') …');
        const r = await storm(c, {
          seed: fuzzOpts.seed, episodes: fuzzOpts.episodes, maxEdits: fuzzOpts.maxEdits || 5,
          quiet: true, doors: false, baseColours: base, log: m => log('  ' + m),
        });
        fuzz = { seed: r.seed, counts: r.counts, violations: r.violations, actions: r.actions };
        log('storm: ' + r.actions.length + ' actions, ' + r.violations.length + ' violation(s)');
        r.violations.forEach(v => warnings.push('storm [' + v.kind + '] ' + v.msg + '  (seed ' + r.seed + ')'));
      } catch (e) {
        fuzz = { seed: fuzzOpts.seed, error: String((e && e.message) || e).slice(0, 200) };
        warnings.push('the interaction storm could not run: ' + fuzz.error);
      }
    }

    const nameUsedInDocs = String((orders['rs-first'] && orders['rs-first'].propertyNameInForm) || runName);
    return {
      fuzz,
      propertyId: ids.pid, cycleId: ids.cid,
      propertyNameUsed: runName,
      propertyNameInDocuments: nameUsedInDocs,
      /* The documents take their name from the FORM, and a readable schedule
         overwrites it (app.js:1844). So this says, plainly, whether the
         comparator is about to see the harness's own label where the filed
         package says the real name. */
      nameIsPrefix: nameUsedInDocs.indexOf(NAME_PREFIX) === 0,
      uploads: {
        rs: rsTile ? { name: rsTile.name, state: rsTile.state, sub: rsTile.sub, ms: rsMs, kind: read.rs && read.rs.kind, via: read.rs && read.rs.via, halfB: !!(read.rs && read.rs.halfB) } : null,
        rcs: rcsTile ? { name: rcsTile.name, state: rcsTile.state, sub: rcsTile.sub, ms: rcsMs, units: read.rcs && read.rcs.units } : null,
        ocrCalls: ocrCalls.length, ocrEndpoints: ocrCalls, tier,
      },
      reopen, orders, warnings, errors,
      console: c.logs.slice(0, 20), dialogs: c.dialogs.slice(),
    };
  }, { sessionFile, log });

  try { fs.rmSync(dlBase, { recursive: true, force: true }); } catch (e) {}

  const out = Object.assign({
    property: propertyName || null, code, folder: propertyFolder,
    cycleLabel: cycleLabel || null,
    studyPath: studyPath || null, priorRsPath: priorRsPath || null,
    at: new Date().toISOString(),
  }, meta);
  /* `warnings` / `errors` are the SAME arrays the run pushed into and handed
     back as meta.warnings / meta.errors — the pre-flight pushes above happen
     before withApp and land in them too. Concatenating the two printed every
     line twice. */
  out.warnings = meta.warnings || warnings;
  out.errors = meta.errors || errors;
  if (out.nameIsPrefix)
    out.warnings.push('the generated documents carry the harness name ' + J(out.propertyNameInDocuments)
      + ' — the schedule supplied no property name to overwrite it, so property.name WILL mismatch the filed package');
  for (const o of ORDERS) {
    const r = out.orders[o];
    if (!r) continue;
    try {
      fs.mkdirSync(r.outDir, { recursive: true });
      const rec = Object.assign({}, out, { orders: undefined, order: o, result: r });
      fs.writeFileSync(path.join(r.outDir, '_drive.json'), JSON.stringify(rec, null, 1));
    } catch (e) {}
  }
  return out;
}

/* ── the per-order entry point sweep.js still calls ─────────────────────── */
/* sweep.js loops `for (const order of ['rs-first','rcs-first']) driveOne(...)`.
   That still works, but NOT by running twice: the first call does both orders in
   one session and the second is served from this memo. One property, one
   browser, one upload, one OCR bill — whichever way it is called. */
/* THE FAILURE IS MEMOISED TOO, and that is the whole point of the guard. A
   throw late in driveBoth — during generation, say, long after Azure has been
   paid — leaves sweep.js's catch to move on to the second order, which finds no
   memo and runs the ENTIRE thing again, schedule upload and OCR included. A
   property that failed would cost two reads instead of one, which is exactly
   the bill this file exists to halve. So the first attempt's outcome is
   recorded whichever way it went, and the second call re-throws the same error
   instead of paying to rediscover it. */
/* A MAP, NOT A SLOT, AND IT HOLDS THE PROMISE RATHER THAN THE RESULT.
   The single-slot version was correct for one property at a time and silently
   wrong the moment sweep.js ran with --jobs 2. Worker A calls driveOne for
   property X and awaits a two-minute driveBoth; worker B, running in the gap,
   calls driveOne for property Y and overwrites the one slot; worker A's second
   order then finds Y's signature, misses, and drives X all over again.
   Measured: a two-property probe created FOUR records and spent 5+3 OCR calls
   on properties that should have cost 3 each. The damage is not only the bill —
   the two "fill orders" then come from two different runs of the app, so any
   disagreement between them is a difference between runs, not between orders,
   and the highest-severity finding in the whole sweep becomes an artifact.
   Keyed by signature so concurrent properties coexist, and storing the in-flight
   promise so a second caller for the SAME signature awaits the run already
   going instead of starting a second one. Outcome is recorded either way: a
   throw is cached and re-thrown, so a property that fails costs one attempt. */
const _memo = new Map();
async function driveOne(opts) {
  const order = opts.order;
  if (ORDERS.indexOf(order) < 0) throw new Error('order must be "rs-first" or "rcs-first", got ' + J(order));
  /* The signature is what makes two orders share one run. It must therefore name
     everything that makes two runs DIFFERENT — including the cycle, now that a
     property can be driven for more than one package year, and the storm's seed,
     because a caller asking for a different permutation is asking for a
     different run and must not be served yesterday's. */
  const sig = [opts.propertyFolder, opts.studyPath, opts.priorRsPath, opts.outRoot, opts.corpusRoot, opts.cacheRoot,
               opts.cycleLabel || '', (opts.fuzz && opts.fuzz.seed) || ''].join(' | ');
  /* The seam exists so the memo can be tested without launching a browser:
     the property this guard protects is "how many times was the expensive
     thing called", which is exactly what a stub can count and a real run
     cannot cheaply assert. Production never passes it. */
  const run = opts.__driveBoth || driveBoth;
  let pending = _memo.get(sig);
  if (!pending) {
    pending = run(opts).then(v => ({ both: v, err: null }), e => ({ both: null, err: e }));
    _memo.set(sig, pending);
  }
  const settled = await pending;
  if (settled.err) throw settled.err;
  const b = settled.both;
  const r = b.orders[order] || {
    outDir: path.join(opts.outRoot, String(b.code), order), files: [],
    warnings: [], errors: ['this order produced nothing'],
  };
  return Object.assign({
    property: b.property, code: b.code, folder: b.folder,
    propertyId: b.propertyId, cycleId: b.cycleId, cycleLabel: b.cycleLabel, fuzz: b.fuzz,
    propertyNameUsed: b.propertyNameUsed, propertyNameInDocuments: b.propertyNameInDocuments,
    nameIsPrefix: b.nameIsPrefix, uploads: b.uploads, reopen: b.reopen,
    studyPath: b.studyPath, priorRsPath: b.priorRsPath, at: b.at,
  }, r, {
    warnings: (b.warnings || []).concat(r.warnings || []),
    errors: (b.errors || []).concat(r.errors || []),
  });
}

/* ── cleanup: remove the CYCLES these runs made ──────────────────────────── */
/* THIS RUNS AGAINST A REAL ACCOUNT HOLDING A REAL PORTFOLIO.

   Until 2026-07-31 a run created a scratch PROPERTY and cleanup deleted
   properties. On 2026-07-31 the account was emptied and rebuilt from the HAP
   tracker: 249 real portfolio properties that must survive every sweep. A run
   no longer creates properties — it finds one that already exists and adds a
   CYCLE to it. So cleanup deletes CYCLES, and there is deliberately no code
   path in this function that can issue a DELETE against /property. The old one
   had exactly that path, and pointed at the portfolio it is not a tidy-up, it
   is data loss.

   Three guards, all deliberate:

   1. Only ids this driver wrote down are eligible. For a property the name
      prefix was a usable second net; for a cycle it is not, because a cycle
      carries no name of ours. The ledger is therefore the ONLY handle, which
      is why recordCreatedCycle() fails loudly instead of swallowing — a
      bookkeeping failure there would leak a cycle nothing can find.
   2. Every candidate is re-checked against the ledger in node before its
      DELETE is issued, never trusted to a server-side filter.
   3. The property count is read before and after and must be identical. If a
      single property row disappears during a cleanup, something is wrong that
      this function cannot see, and it throws rather than report success.

   Deleting a cycle cascades to its own rows the same way the app's own
   delete-package button does. pm_contact is not cycle-scoped and is untouched. */
async function cleanup(sessionFile, opts) {
  const dryRun = !!(opts && opts.dryRun);
  const log = (opts && opts.log) || console.log;
  const { sess } = await loadSession(sessionFile);
  const cfg = supaConfig();
  const H = { apikey: cfg.anon, Authorization: 'Bearer ' + sess.access_token, 'Content-Type': 'application/json' };

  async function countProperties(when) {
    const r = await fetch(cfg.url + '/rest/v1/property?select=id', {
      headers: Object.assign({}, H, { Prefer: 'count=exact', Range: '0-0' }) });
    if (!r.ok) throw new Error('could not count properties ' + when + ' (' + r.status + '): ' + (await r.text()).slice(0, 200));
    const cr = r.headers.get('content-range') || '';
    const n = Number(String(cr).split('/')[1]);
    if (!Number.isFinite(n)) throw new Error('could not read a property count from content-range ' + J(cr));
    return n;
  }

  const before = await countProperties('before cleanup');
  log('signed in as ' + (sess.email || '(unknown)') + ' — ' + before + ' properties in the account');

  const ledger = readCreated();
  const cycles = ledger.filter(x => x.kind === 'cycle' && x.id);
  const legacy = ledger.filter(x => x.kind !== 'cycle');

  /* Entries from before this change name PROPERTIES. They are never deleted
     here. They are reported so a human can see them, and forgotten once the
     row is gone, so the file cannot grow forever. */
  if (legacy.length) {
    log(legacy.length + ' legacy property-scoped ledger entries — NOT eligible for deletion, listed only:');
    legacy.forEach(x => log('    legacy property ' + J(x.name || '(unnamed)') + '  [' + x.id + ']'));
  }

  if (!cycles.length) {
    log('no cycles recorded by this driver — nothing to delete');
    const after0 = await countProperties('after cleanup');
    if (after0 !== before) throw new Error('the property count moved from ' + before + ' to ' + after0 + ' during a cleanup that deleted nothing');
    return { matched: 0, deleted: 0, failed: [], ids: [], propertiesBefore: before, propertiesAfter: after0 };
  }

  /* Which of them still exist. A ledger entry with no row is already gone. */
  const ids = cycles.map(x => x.id);
  const q = cfg.url + '/rest/v1/cycle?select=id,property_id,label&id=in.(' + ids.map(encodeURIComponent).join(',') + ')';
  const r = await fetch(q, { headers: H });
  if (!r.ok) throw new Error('could not list cycles (' + r.status + '): ' + (await r.text()).slice(0, 200));
  const rows = await r.json();
  const present = new Set(rows.map(c => c.id));
  const vanished = ids.filter(id => !present.has(id));
  if (vanished.length) {
    log(vanished.length + ' recorded cycles are already gone');
    if (!dryRun) forgetCreated(vanished);
  }
  if (!rows.length) {
    const after0 = await countProperties('after cleanup');
    if (after0 !== before) throw new Error('the property count moved from ' + before + ' to ' + after0 + ' during a cleanup that deleted nothing');
    return { matched: 0, deleted: 0, failed: [], ids: [], propertiesBefore: before, propertiesAfter: after0 };
  }

  const ledgerIds = new Set(ids);
  rows.forEach(c => log('  ' + (dryRun ? 'would delete' : 'DELETE     ') + '  cycle ' + c.id
    + '  ' + J(c.label || '(no label)') + '  on property ' + c.property_id));
  if (dryRun) return { matched: rows.length, deleted: 0, failed: [], ids: rows.map(c => c.id), dryRun: true, propertiesBefore: before, propertiesAfter: before };

  const failed = [];
  let deleted = 0;
  for (const c of rows) {
    if (!ledgerIds.has(c.id)) { failed.push({ id: c.id, why: 'the created-cycle ledger does not claim this row' }); continue; }
    const d = await fetch(cfg.url + '/rest/v1/cycle?id=eq.' + encodeURIComponent(c.id), { method: 'DELETE', headers: H });
    if (d.ok) deleted++; else failed.push({ id: c.id, why: d.status + ': ' + (await d.text()).slice(0, 160) });
  }
  forgetCreated(rows.map(c => c.id));

  const after = await countProperties('after cleanup');
  log(deleted + ' cycles deleted' + (failed.length ? ', ' + failed.length + ' FAILED' : '')
    + ' — properties ' + before + ' → ' + after);
  failed.forEach(f => log('  X ' + f.id + ' — ' + f.why));
  if (after !== before)
    throw new Error('CLEANUP DELETED A PROPERTY. The count moved from ' + before + ' to ' + after
      + '. This function never issues a DELETE against /property, so something else did — stop and investigate before driving again.');
  return { matched: rows.length, deleted, failed, ids: rows.map(c => c.id), propertiesBefore: before, propertiesAfter: after };
}

/* ── manifest helpers, so the CLI and sweep.js pick the same inputs ─────── */
function pickCycle(prop) {
  return (prop.cycles || []).find(c => c.wave === 1) || (prop.cycles || [])[0] || null;
}
function pickStudy(cycle) {
  if (!cycle) return null;
  if (cycle.chosenStudy) return cycle.chosenStudy.file || cycle.chosenStudy;
  const s = (cycle.studies || [])[0];
  return s ? s.file : null;
}
function findProperty(man, key) {
  const k = String(key).toLowerCase();
  return man.properties.find(p => String(p.code).toLowerCase() === k)
      || man.properties.find(p => String(p.name).toLowerCase() === k)
      || man.properties.find(p => String(p.name).toLowerCase().indexOf(k) >= 0)
      || null;
}

module.exports = {
  driveBoth, driveOne, cleanup, loadSession, supaConfig,
  _resetMemo: () => _memo.clear(),
  pickCycle, pickStudy, findProperty, unzipStored, tierOf, diffSnaps,
  readCreated, recordCreated, recordCreatedCycle, forgetCreated, CREATED_LOG, SkipRun,
  NAME_PREFIX, ORDERS,
  currentBranch, refuseOnMain, assertNotMain,
};

/* ── standalone ─────────────────────────────────────────────────────────── */
if (require.main === module) {
  assertNotMain('drive.js');
  const argv = process.argv.slice(2);
  const flag = n => argv.indexOf(n) >= 0;
  const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const die = m => { console.log(m); process.exit(2); };

  if (flag('--cleanup')) {
    cleanup(opt('--session'), { prefix: opt('--prefix') || NAME_PREFIX, dryRun: flag('--dry-run') })
      .then(r => { process.exitCode = (r.failed && r.failed.length) ? 1 : 0; })
      .catch(e => { console.log((e instanceof NoSession ? '' : 'X CLEANUP THREW: ') + (e.message || e)); process.exitCode = e instanceof NoSession ? 2 : 1; });
  } else {
    const pos = argv.filter((a, i) => a.charAt(0) !== '-' && argv[i - 1] !== '--prefix' && argv[i - 1] !== '--session');
    const [corpusRoot, cacheRoot, manPath, key, outRootArg] = pos;
    if (!corpusRoot || !manPath || !key)
      die('usage: node drive.js <corpusRoot> <cacheRoot> <corpus.json> <propertyCodeOrName> [outRoot] [--session FILE]\n'
        + '       node drive.js --cleanup [--prefix ' + NAME_PREFIX + '] [--dry-run]\n'
        + '\nBoth fill orders run in ONE signed-in browser session, and each document is uploaded exactly once.');
    const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
    const prop = findProperty(man, key);
    if (!prop) die('no property matching ' + J(key) + ' in ' + manPath);
    const cyc = pickCycle(prop);
    if (!cyc) die(prop.name + ' has no cycles');
    const outRoot = outRootArg || path.join(REPO, '_archive', 'corpus-cache', '_out');
    console.log(prop.name + ' (' + prop.code + ')  ' + (cyc.cycleLabel || ''));
    console.log('  study   : ' + (pickStudy(cyc) || '(none)'));
    console.log('  priorRs : ' + (cyc.priorRs || '(none)'));
    driveBoth({
      propertyFolder: prop.folder, propertyCode: prop.code, propertyName: prop.name,
      studyPath: pickStudy(cyc), priorRsPath: cyc.priorRs,
      outRoot, corpusRoot, cacheRoot: cacheRoot && cacheRoot !== '-' ? cacheRoot : null,
      sessionFile: opt('--session'), log: console.log,
    }).then(r => {
      console.log('\nproperty : ' + r.propertyNameUsed + '   [' + r.propertyId + ']');
      console.log('package  : ' + r.cycleId);
      console.log('documents are named : ' + J(r.propertyNameInDocuments) + (r.nameIsPrefix ? '   <-- the harness label, not the real name' : ''));
      console.log('uploads  : rs=' + J(r.uploads.rs && r.uploads.rs.state) + ' in ' + (((r.uploads.rs || {}).ms || 0) / 1000).toFixed(1) + 's'
        + '  ·  study=' + J(r.uploads.rcs && r.uploads.rcs.state) + ' in ' + (((r.uploads.rcs || {}).ms || 0) / 1000).toFixed(1) + 's');
      console.log('tier     : ' + r.uploads.tier);
      console.log('OCR      : ' + r.uploads.ocrCalls + ' call(s) during the uploads, ' + r.reopen.ocrCallsSinceReload + ' after the reload');
      console.log('reopen   : form empty=' + r.reopen.formEmpty + ' · rs kept=' + r.reopen.rsRetained + ' · study kept=' + r.reopen.rcsRetained
        + ' · same property=' + r.reopen.propertyIdMatched + ' · same package=' + r.reopen.cycleIdMatched);
      console.log('           recalled with bytes: rs=' + J(r.reopen.held && r.reopen.held.rs && r.reopen.held.rs.hasBytes)
        + ' study=' + J(r.reopen.held && r.reopen.held.rcs && r.reopen.held.rcs.hasBytes)
        + (r.reopen.studyReattached ? '  -> study re-attached for its bytes (no OCR)' : ''));
      if (r.reopen.diffs.length) {
        console.log('           cells that moved across the reload:');
        r.reopen.diffs.slice(0, 14).forEach(d => console.log('             ' + (d.auto ? '(auto) ' : 'LEAKED ') + d.key + '  ' + J(d.wasAtCreate) + ' -> ' + J(d.isNow)));
      }
      for (const o of ORDERS) {
        const x = r.orders[o]; if (!x) continue;
        console.log('\n' + o + '  ->  ' + x.outDir);
        console.log('  tier  : ' + x.tier + (x.weakerTest ? '   (weakerTest)' : '') + (x.skipped ? '   (SKIPPED)' : ''));
        console.log('  files : ' + x.files.length);
        x.files.forEach(f => console.log('     ' + String(f.bytes).padStart(9) + '  ' + f.name));
        (x.warnings || []).forEach(w => console.log('   ! ' + w));
        (x.errors || []).forEach(w => console.log('   X ' + w));
      }
      if (r.warnings.length) { console.log('\nwarnings:'); r.warnings.forEach(w => console.log('   ! ' + w)); }
      if (r.errors.length) { console.log('\nerrors:'); r.errors.forEach(w => console.log('   X ' + w)); }
      const bad = r.errors.length || ORDERS.some(o => r.orders[o] && (r.orders[o].errors || []).length);
      console.log(bad ? '\nX DRIVE FAILED' : '\n+ drive ok — both orders, one upload each');
      console.log('  the record it made is still in the account; remove it with:');
      console.log('    node app/full-mp/corpus/drive.js --cleanup --prefix ' + NAME_PREFIX);
      process.exitCode = bad ? 1 : 0;
    }).catch(e => {
      if (e instanceof NoSession) { console.log('\n' + e.message); process.exitCode = 2; return; }
      console.log('\nX DRIVE THREW: ' + (e && e.stack || e));
      process.exitCode = 1;
    });
  }
}
