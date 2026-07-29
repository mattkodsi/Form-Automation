/* corpus/drive.js — the drive seam: one property + one fill order → the package
   on disk, produced by the real app the way a person produces it.

   WHY IT IS BUILT THIS WAY. The three things this seam exists to exercise are the
   two parsers and the generator. Every shortcut past them turns the run into a
   test of the shortcut:

     · `__setRsParsed` / `__setRcsParsed` write a parse RESULT into the app. They
       are how test_browser.js seeds a state cheaply, and they are exactly wrong
       here — they skip `parseRsPdf`, `parseRcsPdf` and `unlockPdf`, which are
       three of the four things under test. So the bytes go in through
       `DOM.setFileInputFiles` against the real `#rsFile` / `#rcsFile`, and the
       app's own `onchange` handlers do the reading.
     · a fixed bundle path in the shared temp directory means a concurrent run
       rebuilds the file THIS run is serving, and the page silently becomes
       somebody else's code — a green run that tested nothing. Hence the pid.
     · tier 3 (Azure Document Intelligence) BILLS PER PAGE. Under `?selftest=1`
       the app never constructs a Supabase client, so `ocrHalf` cannot reach the
       network. That is asserted here rather than assumed, and a reported tier of
       `ocr` is a fatal error, not a warning.

   THE DOWNLOAD. `dlPackageFolder` builds a zip in the page and hands it to an
   anchor with a `download` attribute. We ask chromium to write downloads to a
   per-run directory and click the real button. We ALSO wrap
   `URL.createObjectURL` + `HTMLAnchorElement.click` so the same bytes can be
   pulled back over CDP if headless chromium declines to write the file. The
   wrapper calls straight through, so the real path is still attempted; only when
   nothing lands on disk do we use the captured blob, and every result produced
   that way carries `weakerTest: true`. A labelled weaker test beats a blocked
   night; an unlabelled one is worse than either.

   The zip is STORED, never deflated (see buildZip in xlsx.js), so it is unpacked
   here with a dozen lines of DataView rather than a dependency.

   Run one by hand:
     node app/full-mp/corpus/drive.js <corpusRoot> <cacheRoot> <corpus.json> <propertyCodeOrName> <order>
   e.g.
     node app/full-mp/corpus/drive.js "$CORPUS" _archive/corpus-cache \
          app/full-mp/corpus/corpus.json "Colonial Village" rs-first
*/

const cp = require('child_process'), http = require('http'), fs = require('fs'),
      os = require('os'), path = require('path'), net = require('net');

const SRC = path.join(__dirname, '..');            // app/full-mp
const REPO = path.join(SRC, '..', '..');           // repo root
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

/* ── chromium ───────────────────────────────────────────────────────────── */
function findChrome() {
  const cands = [];
  const pw = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  const dirs = fs.existsSync(pw) ? fs.readdirSync(pw) : [];
  for (const d of dirs.filter(x => /headless_shell/.test(x)))
    cands.push(path.join(pw, d, 'chrome-headless-shell-mac-arm64/chrome-headless-shell'),
               path.join(pw, d, 'chrome-headless-shell-linux64/chrome-headless-shell'));
  for (const d of dirs.filter(x => /^chromium-/.test(x)))
    cands.push(path.join(pw, d, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
               path.join(pw, d, 'chrome-linux/chrome'));
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
        this.logs.push((m.params.args || []).map(a => a.value || a.description || '').join(' '));
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.logs.push('EXCEPTION ' + ((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text));
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

async function withApp(fn, { width = 1280, height = 1000, downloadPath } = {}) {
  const bin = findChrome();
  if (!bin) throw new Error('no chromium binary found — install one (npx playwright install chromium). This is not a pass.');
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
  const proc = cp.spawn(bin, ['--headless=new', '--remote-debugging-port=' + dp, '--user-data-dir=' + ud,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
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
  c.downloadOk = false;
  if (downloadPath) {
    fs.mkdirSync(downloadPath, { recursive: true });
    /* Browser.setDownloadBehavior is the modern one and works over a page
       session; Page.setDownloadBehavior is the deprecated fallback. Whether
       EITHER is honoured in this chromium build is the question the fallback
       path exists to answer, so record which one was accepted rather than
       assuming the answer. */
    try { await c.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath, eventsEnabled: true }); c.downloadOk = 'Browser'; }
    catch (e) {
      try { await c.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath }); c.downloadOk = 'Page'; }
      catch (e2) { c.downloadOk = false; }
    }
  }
  c.boot = async () => {
    await c.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html?selftest=1` });
    for (let i = 0; i < 200; i++) {
      const ok = await c.eval('return !!(window.__t&&window.__t.__firstPid&&window.__t.__firstPid())').catch(() => false);
      if (ok) return true;
      await sleep(150);
    }
    throw new Error('the app never booted under ?selftest=1');
  };
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: PRELUDE });
  await c.boot();
  try { return await fn(c); }
  finally { try { ws.close(); } catch (e) {} proc.kill(); srv.close(); rmUd(); }
}

/* ── the prelude: the billing tripwire, and the download grab ───────────── */
/* Installed with Page.addScriptToEvaluateOnNewDocument so it is in place
   BEFORE the bundle's own script runs — which is the only moment at which a
   Supabase client could be constructed, and the only moment at which the first
   request could leave.
      · The tripwire records every network call whose URL is not our own
        loopback server, and wraps supabase.createClient so an attempt to build
        a client is recorded too. `ocrHalf` reaches Azure ONLY through
        supaClient.functions.invoke (ocr.js:197-198, 233, 254), which is
        eventually an HTTP request — so an empty tripwire is positive evidence
        that nothing was billed, where "window.supabase is undefined" would
        merely have been a guess about a global that the bundle vendors anyway.
      · The grab WRAPS, never replaces: the original createObjectURL and the
        original anchor click both still run, so the genuine download is still
        attempted. It only keeps a reference to the same Blob so the bytes stay
        reachable over CDP if chromium writes nothing to disk. */
const PRELUDE = `(function(){
  window.__net=[];
  const local=u=>{try{const s=String(u);
    return /^(blob:|data:|about:)/.test(s)||/^https?:\\/\\/(127\\.0\\.0\\.1|localhost)(:|\\/|$)/.test(s)||s.charAt(0)==='/'||!/^[a-z]+:/i.test(s);
  }catch(e){return false;}};
  const _f=window.fetch;
  if(_f)window.fetch=function(u){const s=(u&&u.url)||u;if(!local(s))window.__net.push('fetch '+s);return _f.apply(this,arguments);};
  const _o=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){if(!local(u))window.__net.push('xhr '+u);return _o.apply(this,arguments);};
  const _ws=window.WebSocket;
  if(_ws)window.WebSocket=function(u){if(!local(u))window.__net.push('ws '+u);return new _ws(...arguments);};
  Object.defineProperty(window,'__supaGuard',{value:true});
  const guard=()=>{try{
    if(window.supabase&&window.supabase.createClient&&!window.supabase.__wrapped){
      const _c=window.supabase.createClient;
      window.supabase.createClient=function(){window.__net.push('supabase.createClient');return _c.apply(this,arguments);};
      window.supabase.__wrapped=true;}
  }catch(e){}};
  const iv=setInterval(guard,5); setTimeout(()=>clearInterval(iv),8000); guard();

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

/* ── the sequence ───────────────────────────────────────────────────────── */
const J = v => JSON.stringify(v);

async function settleDir(dir, quietMs = 3000, maxMs = 180000) {
  const snap = () => {
    let fs_ = [];
    try { fs_ = fs.readdirSync(dir); } catch (e) { return ''; }
    return fs_.map(n => { let s = 0; try { s = fs.statSync(path.join(dir, n)).size; } catch (e) {} return n + ':' + s; }).sort().join('|');
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

/* Upload one PDF through the REAL file input, and wait for the app's own
   handler to finish reading it. The settle signal is the app's own record of
   the upload (rsRemember / rcsRemember write it into the cycle the instant the
   parse returns) — not a DOM shape that could look the same before and after. */
async function uploadThrough(c, { inputId, filePath, cid, getter, label, timeoutMs = 240000 }) {
  const warnings = [];
  const oid = await c.handle(`document.getElementById(${J(inputId)})`);
  if (!oid) throw new Error('no #' + inputId + ' in the page — is the form open?');
  await c.send('DOM.setFileInputFiles', { files: [filePath], objectId: oid });

  /* setFileInputFiles is documented to fire `change`, and does in current
     chromium — but the whole point of this file is that the app's handler
     runs, so verify it rather than trust it, and dispatch a real bubbling
     change event if nothing moved. Either way it is the app's handler. */
  let started = false;
  for (let i = 0; i < 12; i++) {
    started = await c.eval(`const d=window.__t.__db();const r=d.${getter}(${J(cid)})||{};
      return !!(r.name)||!!document.querySelector('#viewForm .spin');`);
    if (started) break;
    await sleep(150);
  }
  if (!started) {
    warnings.push(label + ': setFileInputFiles did not fire change; dispatched one');
    await c.eval(`const el=document.getElementById(${J(inputId)});
      el.dispatchEvent(new Event('change',{bubbles:true}));return 1;`);
  }

  const t0 = Date.now();
  let rec = null;
  while (Date.now() - t0 < timeoutMs) {
    rec = await c.eval(`const d=window.__t.__db();const r=d.${getter}(${J(cid)})||{};
      return {name:r.name||'',kind:r.kind||'',via:r.via||'',units:(r.parsed&&r.parsed.units)?r.parsed.units.length:0,
              busy:!!document.querySelector('#viewForm .spin')};`);
    if (rec.name && !rec.busy) break;
    await sleep(300);
  }
  if (!rec || !rec.name) throw new Error(label + ': the app never recorded the upload within ' + (timeoutMs / 1000) + 's');
  return { rec, warnings };
}

async function clickApply(c, id, label) {
  const there = await c.eval(`return !!document.getElementById(${J(id)});`);
  if (!there) return { clicked: false, warning: label + ': #' + id + ' never appeared — nothing was applied to the form' };
  await c.eval(`document.getElementById(${J(id)}).click();return 1;`);
  await sleep(600);
  return { clicked: true, warning: null };
}

async function driveOne(opts) {
  const {
    propertyFolder, studyPath, priorRsPath, order,
    outRoot, corpusRoot, cacheRoot,
    propertyCode, propertyName,
  } = opts;
  if (order !== 'rs-first' && order !== 'rcs-first') throw new Error('order must be "rs-first" or "rcs-first", got ' + J(order));

  const warnings = [], errors = [];
  /* Prefer a decrypted copy in the cache at the same relative path; the corpus
     is the fallback, and is only ever read. Both are copied into a pid-scoped
     scratch directory before chromium sees them, so nothing under the Drive
     mount is ever opened for write and a streaming mount cannot surprise us. */
  const resolveIn = rel => {
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

  const rs = resolveIn(priorRsPath), study = resolveIn(studyPath);
  if (priorRsPath && !rs) errors.push('prior rent schedule not found on disk: ' + priorRsPath);
  if (studyPath && !study) errors.push('study not found on disk: ' + studyPath);
  if (rs && rs.fromCache) warnings.push('rent schedule read from the decrypted cache');
  if (study && study.fromCache) warnings.push('study read from the decrypted cache');

  const code = propertyCode || 'unknown';
  const outDir = path.join(outRoot, String(code), order);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const dlDir = path.join(os.tmpdir(), 'rcs-drive-dl.' + process.pid + '.' + Date.now());

  const result = await withApp(async c => {
    let tier = null, weakerTest = false, files = [], pkgText = [], missing = null;

    /* the two structural assertions this whole night rests on */
    const boot = await c.eval(`return {api:!!window.__t, apiAlias:!!window.__API,
      dec:!!(window.RCSPdfDecrypt&&window.RCSPdfDecrypt.decrypt&&window.RCSPdfDecrypt.isEncrypted),
      gen:!!window.RCSGen, lib:!!window.PDFLib, xl:!!(window.RCSXlsx&&window.RCSXlsx.makeZip),
      wire:!!window.__grab&&!!window.__net, net:(window.__net||[]).slice(),
      title:document.title.slice(0,8)};`);
    /* app.js:4589 publishes the selftest surface as window.__t; there is no
       window.__API in the browser (that name is the CommonJS export at
       app.js:4588). Both are reported so the difference is on the record. */
    if (!boot.api) throw new Error('window.__t absent — the app did not boot under ?selftest=1');
    if (!boot.dec) throw new Error('window.RCSPdfDecrypt absent — the decryptor is not in the bundle under test');
    if (!boot.gen || !boot.lib) throw new Error('RCSGen/PDFLib absent — the generator is not in the bundle under test');
    if (!boot.xl) throw new Error('RCSXlsx.makeZip absent — the packager is not in the bundle under test');
    if (!boot.wire) throw new Error('the prelude did not install — the billing tripwire is not armed. Refusing to run.');
    /* The 'SELFTEST — ' prefix is written INSIDE the if(SELFTEST) branch, which
       returns at app.js:4482 — three lines before the only createClient call in
       the app (app.js:4485). So the title is proof, not decoration: it can only
       be there if supaClient was never assigned, and ocrHalf returns null
       without one (ocr.js:233). */
    if (boot.title !== 'SELFTEST') throw new Error('the page is not in selftest mode (title "' + boot.title + '") — a Supabase client may exist and tier 3 could bill. Refusing to run.');
    if (boot.net.length) throw new Error('network calls left the page before the run started: ' + boot.net.join(', '));
    if (!boot.apiAlias) warnings.push('window.__API is not defined in the browser; the selftest surface is window.__t (app.js:4589)');

    /* a fresh property and a fresh RCS package, so nothing the selftest seed
       holds can be mistaken for something a parser supplied */
    const made = await c.eval(`const db=window.__t.__db();
      /* THE PROPERTY NAME IS DATA THE APP PRINTS, NOT A RUN LABEL. Tagging it
         '[75500 rs-first]' put the harness's own bookkeeping into every
         generated document, so property.name mismatched the filed package on
         every property in the sweep -- 34 rows of pure noise. Each run gets its
         own chromium profile and its own stub database, so the name never
         needed to be unique in the first place. */
      const nm=${J(propertyName || 'Corpus property')};
      const r=await db.createProperty(nm);
      const pid=r&&(r.pid||r.id)||r;
      await window.__t.__openForm(pid);
      const cy=await window.__t.__newCycle({full:true,programs:['rcs'],label:'CORPUS'});
      const cid=(cy&&(cy.cid||cy.id))||cy;
      await window.__t.__openCycleForm(pid,cid);
      return {pid,cid};`);
    await sleep(700);
    const cid = made.cid;

    const doRs = async () => {
      if (!rs) { errors.push('no rent schedule to upload'); return; }
      const u = await uploadThrough(c, { inputId: 'rsFile', filePath: rs.tmp, cid, getter: 'getCycleRs', label: 'rent schedule' });
      u.warnings.forEach(w => warnings.push(w));
      /* parseRsPdf answers with a PAIR, and the two halves mean different
         things: `kind:'fields'` is "values came out", `via` is which tier they
         came from ('' = the AcroForm, 'text' = the text layer, 'ocr' = Azure).
         `kind:'text'` with a null parse is the opposite of `via:'text'` — it
         means the page had text and none of it was a value. Collapsing those
         two into the word "text" would have reported this run as a successful
         tier-2 read when nothing was read at all. */
      tier = u.rec.kind === 'fields' ? (u.rec.via || 'fields') : 'unreadable:' + (u.rec.kind || 'none');
      if (u.rec.via === 'ocr')
        throw new Error('FATAL: parseRsPdf reported tier "ocr" — tier 3 bills per page and must be unreachable under selftest');
      if (u.rec.kind !== 'fields') warnings.push('rent schedule was not readable (kind=' + u.rec.kind + ') — no values were applied');
      const a = await clickApply(c, 'rsApply', 'rent schedule');
      if (a.warning) warnings.push(a.warning);
    };
    const doRcs = async () => {
      if (!study) { errors.push('no study to upload'); return; }
      const u = await uploadThrough(c, { inputId: 'rcsFile', filePath: study.tmp, cid, getter: 'getCycleRcs', label: 'study' });
      u.warnings.forEach(w => warnings.push(w));
      if (!u.rec.units) warnings.push('the study parsed to zero unit types — no values were applied from it');
      const a = await clickApply(c, 'rcsApply', 'study');
      if (a.warning) warnings.push(a.warning);
    };

    if (order === 'rs-first') { await doRs(); await doRcs(); }
    else { await doRcs(); await doRs(); }

    await c.eval('window.__t.__renderBody();return 1;');
    await sleep(300);

    /* The parsers have now run. Nothing may have left the page: an entry here
       means the ladder reached tier 3 and Azure was billed. */
    const net = await c.eval('return (window.__net||[]).slice();');
    if (net.length) throw new Error('FATAL: external network calls during the parse — tier 3 may have billed: ' + net.join(', '));

    /* ── generate ─────────────────────────────────────────────────────── */
    await c.eval(`document.getElementById('bGenerate').click();return 1;`);
    /* The letterhead confirmation is a real modal with a real cost — the notice
       prints a generated header without one — so its text is recorded as a
       warning before the button is pressed, never clicked blindly past. */
    for (let i = 0; i < 30; i++) {
      const dlg = await c.eval(`const s=document.getElementById('scrim');
        if(!s||!s.classList.contains('open'))return null;
        const d=document.getElementById('dialog');
        return {t:(d.querySelector('.dlg-t')||{}).textContent||'',cls:d.className,
                ok:!!document.getElementById('dlgOk'),folder:!!document.getElementById('dlFolder')};`);
      if (dlg && !/\bpkg\b/.test(dlg.cls) && dlg.ok) {
        const body = await c.eval(`const d=document.getElementById('dialog');
          return ((d.querySelector('.dlg-b')||{}).textContent||'').slice(0,400);`);
        warnings.push('modal before generation: ' + dlg.t + ' — ' + body);
        await c.eval(`document.getElementById('dlgOk').click();return 1;`);
      }
      if (dlg && /\bpkg\b/.test(dlg.cls)) break;
      await sleep(400);
    }

    /* The dialog's six rows say which documents are ready and, for each one that
       is not, what it is short of. That is the most useful sentence the whole
       run produces when the package comes back incomplete, and throwing it away
       would leave "1 of 6" with no way to ask why. */
    const pkg = await c.eval(`const d=document.getElementById('dialog');
      const s=document.getElementById('scrim');
      if(!s||!s.classList.contains('open')||!/\\bpkg\\b/.test(d.className))return null;
      return {head:((d.querySelector('.dlg-b')||{}).textContent||''),
              folder:!!document.getElementById('dlFolder'),
              rows:(d.innerText||'').split('\\n').map(x=>x.trim()).filter(Boolean).slice(0,60),
              status:(document.getElementById('status')||{}).textContent||''};`);
    if (!pkg) {
      const st = await c.eval(`return (document.getElementById('status')||{}).textContent||'';`);
      errors.push('the package dialog never opened. Status bar said: ' + J(st));
      return { outDir, files: [], tier, warnings, errors, weakerTest, order, pkgText, missing, dialogs: c.dialogs, console: c.logs.slice(0, 20) };
    }
    warnings.push('package dialog: ' + pkg.head.trim());
    pkgText = pkg.rows;
    /* WHICH fields each blocked document is short of. The dialog says "4 fields
       short"; this says which four. When a package comes back at 1 of 6 that is
       the difference between a number to shrug at and a list to act on, and it
       is the app's own answer (docMissing, app.js:4534 __docMissing) rather than
       a guess reconstructed from the record. */
    missing = await c.eval(`const o={};
      ['cover','owner','checklist','schedule','notice'].forEach(i=>{try{o[i]=window.__t.__docMissing(i);}catch(e){o[i]=['<'+e.message+'>'];}});
      return o;`);
    if (!pkg.folder) {
      errors.push('no "Download the RCS Package folder" button — the app produced no ready documents');
      return { outDir, files: [], tier, warnings, errors, weakerTest, order, pkgText, missing, dialogs: c.dialogs, console: c.logs.slice(0, 20) };
    }

    await c.eval(`document.getElementById('dlFolder').click();return 1;`);
    const landed = await settleDir(dlDir);
    const zips = landed.filter(n => /\.zip$/i.test(n));
    let zipBuf = null;
    if (zips.length) {
      zipBuf = fs.readFileSync(path.join(dlDir, zips[0]));
    } else {
      /* the fallback, and it is labelled */
      const n = await c.eval('return (window.__grab||[]).length;');
      if (!n) {
        errors.push('nothing downloaded and nothing captured — the folder button produced no blob at all');
        return { outDir, files: [], tier, warnings, errors, weakerTest: true, order, pkgText, missing, dialogs: c.dialogs, console: c.logs.slice(0, 20) };
      }
      zipBuf = await pullGrab(c, n - 1);
      weakerTest = true;
      warnings.push('chromium wrote no file to the download directory (setDownloadBehavior=' + c.downloadOk +
                    '); the package bytes were pulled out of the page instead — weakerTest');
    }

    /* The app names its documents after the property, and a property may be
       called "Lansing Manor / Senior World" — so a member name straight from
       the zip turns "04. Lansing Manor / Senior World - RCS Report.pdf" into a
       DIRECTORY called "04. Lansing Manor " holding a file called "Senior World
       - RCS Report.pdf". It writes without error and looks fine in a listing,
       which is the worst kind of wrong. `name` stays what the app generated,
       because that is what the comparison must match against; `file` is what
       landed. */
    for (const m of unzipStored(zipBuf)) {
      const name = m.name.replace(/^RCS Package\//, '');
      const file = name.replace(/[/\\]/g, '-');
      fs.writeFileSync(path.join(outDir, file), m.data);
      files.push({ name, file, bytes: m.data.length });
      if (file !== name) warnings.push('the document name contains a path separator and was written as ' + J(file));
    }

    return { outDir, files, tier, warnings, errors, weakerTest, order, pkgText, missing, dialogs: c.dialogs, console: c.logs.slice(0, 20) };
  }, { downloadPath: dlDir });

  try { fs.rmSync(dlDir, { recursive: true, force: true }); } catch (e) {}

  const meta = Object.assign({
    property: propertyName || null, code, folder: propertyFolder,
    studyPath: studyPath || null, priorRsPath: priorRsPath || null,
    at: new Date().toISOString(),
  }, result);
  try { fs.writeFileSync(path.join(outDir, '_drive.json'), JSON.stringify(meta, null, 1)); } catch (e) {}
  return meta;
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

module.exports = { driveOne, pickCycle, pickStudy, findProperty, unzipStored };

/* ── standalone ─────────────────────────────────────────────────────────── */
if (require.main === module) {
  const [corpusRoot, cacheRoot, manPath, key, order, outRootArg] = process.argv.slice(2);
  if (!corpusRoot || !manPath || !key || !order) {
    console.log('usage: node drive.js <corpusRoot> <cacheRoot> <corpus.json> <propertyCodeOrName> <rs-first|rcs-first> [outRoot]');
    process.exit(2);
  }
  const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  const prop = findProperty(man, key);
  if (!prop) { console.log('no property matching ' + J(key) + ' in ' + manPath); process.exit(2); }
  const cyc = pickCycle(prop);
  if (!cyc) { console.log(prop.name + ' has no cycles'); process.exit(2); }
  const outRoot = outRootArg || path.join(REPO, '_archive', 'corpus-cache', '_out');
  console.log(prop.name + ' (' + prop.code + ')  ' + cyc.cycleLabel + '  order=' + order);
  console.log('  study   : ' + (pickStudy(cyc) || '(none)'));
  console.log('  priorRs : ' + (cyc.priorRs || '(none)'));
  driveOne({
    propertyFolder: prop.folder, propertyCode: prop.code, propertyName: prop.name,
    studyPath: pickStudy(cyc), priorRsPath: cyc.priorRs, order,
    outRoot, corpusRoot, cacheRoot: cacheRoot && cacheRoot !== '-' ? cacheRoot : null,
  }).then(r => {
    console.log('\noutDir : ' + r.outDir);
    console.log('tier   : ' + r.tier);
    console.log('weaker : ' + !!r.weakerTest);
    console.log('files  : ' + r.files.length);
    r.files.forEach(f => console.log('   ' + String(f.bytes).padStart(9) + '  ' + f.name));
    if (r.warnings.length) { console.log('warnings:'); r.warnings.forEach(w => console.log('   ! ' + w)); }
    if (r.errors.length) { console.log('errors:'); r.errors.forEach(w => console.log('   X ' + w)); }
    console.log(r.errors.length ? '\nX DRIVE FAILED' : '\n+ drive ok (' + r.files.length + ' files)');
    process.exitCode = r.errors.length ? 1 : 0;
  }).catch(e => {
    console.log('\nX DRIVE THREW: ' + (e && e.stack || e));
    process.exitCode = 1;
  });
}
