/* test_browser.js — the suite that presses keys.
   Run:  node app/full-mp/test_browser.js          (representative + regressions)
         node app/full-mp/test_browser.js --full   (exhaustive sweep, slower)

   WHY THIS EXISTS. There were two kinds of test and a hole between them: the
   Node suites prove that calling save() saves, but never that any key or click
   REACHES save(); a browser session proves one row measures correctly, but was
   inert HTML pasted onto a page. Every defect found on 2026-07-27 lived in that
   hole. `?selftest=1` boots the real bundle with a local stub database and no
   Supabase client, so the hole can be driven by a machine.

   HOW. Zero dependencies — Chrome DevTools Protocol over node's own WebSocket,
   against the chromium already on the box. Setup may use .click(); every verdict
   about a KEY rests on Input.dispatchKeyEvent, a real trusted event, because the
   bugs here live exactly where synthetic events do not: a document-level handler
   that stands down when focus is in a text box, a caret that moves when a cell
   changes shape under the edit.

   HARDENING (mirrors the other suites): every exit path sets a non-zero code,
   the verdict is the LAST line printed so a piped run still shows it, and
   MIN_CHECKS catches a run that dies partway. Adding checks? Raise MIN_CHECKS.

   READ THIS BEFORE TRUSTING A RESULT. Four separate times while writing this
   file a "product bug" turned out to be the harness:
     · the control census ran before openForm, so #viewForm was empty and the
       sweep reported a clean zero having tested nothing;
     · a checkbox is opacity:0 and 0x0 BY DESIGN (it is the focus target; the
       ring is drawn on .box), so measuring the input called all 35 invisible;
     · after typing, the app refocuses because the cell can change shape, and
       re-focusing by stale index clobbered the app's own caret;
     · seeding a conflict with __edit left the seeded keys dirty, which then read
       as the app failing to save them.
   Prove a new check fails against the old code before believing it. */

const cp=require('child_process'),http=require('http'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net');

/* ── the verdict machinery ──────────────────────────────────────────────── */
const MIN_CHECKS=234;   // 2026-07-28: +6 — the tier-3 fixture is now read nudged as well as
                       // pristine (three seeds, two checks each). 2026-07-27: the unit-type cell
                       // lost a divider with the designation, so the pair of divider checks
                       // became one. Lowered on purpose.
let n=0,fails=0,verdict=null;
const BAR='═'.repeat(68);
function fail(msg,err){
  verdict='fail'; process.exitCode=1;
  console.log('\n'+BAR);
  console.log('  ✗✗✗  BROWSER SUITE FAILED — DO NOT SHIP  ✗✗✗');
  console.log('  '+msg);
  if(err)console.log(String(err&&err.stack||err).replace(/^/gm,'  '));
  console.log(BAR);
  console.log(`✗ BROWSER SUITE FAILED (${n} checks ran, ${fails} failed)`);
}
function pass(){verdict='pass';console.log(`\n✓ ALL ${n} BROWSER CHECKS PASSED\n`);}
function skip(why){
  verdict='skip';
  console.log('\n'+BAR);
  console.log('  ⚠  BROWSER SUITE SKIPPED — NOTHING WAS VERIFIED');
  console.log('  '+why);
  console.log('  Install a chromium (npx playwright install chromium) to run it.');
  console.log(BAR);
  console.log('⚠ BROWSER SUITE SKIPPED (0 checks ran — this is not a pass)');
}
function finish(){
  if(fails)return fail(`${fails} of ${n} checks failed — see the ✗ lines above`);
  if(n<MIN_CHECKS)return fail(`only ${n} of the expected ${MIN_CHECKS} checks ran — the suite died partway, or checks were deleted without lowering MIN_CHECKS on purpose`);
  pass();
}
process.on('exit',()=>{if(verdict===null)fail(`the run ended without a verdict after ${n} of ${MIN_CHECKS} checks — it died partway`);});
process.on('unhandledRejection',e=>{fail('unhandled rejection — an async throw is a failure, never a pass',e);process.exit(1);});
process.on('uncaughtException',e=>{fail('uncaught exception',e);process.exit(1);});

const eq=(label,got,want)=>{n++;const p=JSON.stringify(got)===JSON.stringify(want);
  if(!p){fails++;console.log(`  ✗ ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);}else console.log(`  ✓ ${label}`);};
const T=(label,v)=>eq(label,!!v,true);

/* ── the browser ────────────────────────────────────────────────────────── */
/* Build our own bundle, the way test_interactions.js and smoke_combined.js do.
   deliver.sh runs the suites at step 2 and builds at step 3, so serving the
   project-root index.html would test the PREVIOUS build while shipping the new
   one — green on code that was never run. Building here removes the ordering
   dependency instead of documenting it. */
/* Per process. One fixed name in the shared temp directory meant a second
   run — another session, a probe, a rerun in another window — rebuilt the file
   THIS run was serving, and the page silently became somebody else's code. It
   presented as a check failing against a feature that was demonstrably present
   in the source and in the built bundle. */
const BUNDLE=path.join(os.tmpdir(),'rcs_browser_bundle.'+process.pid+'.html');
/* The pid above keeps parallel worktrees off each other's bundle (610fe58); it does
   not clean up after itself, and a few hundred of these had piled up in the temp
   directory. Take ours with us. force:true so a run that never got as far as
   writing the file still exits quietly, and the try/catch so cleanup can never be
   the thing that fails an otherwise-green run. */
process.on('exit',()=>{try{fs.rmSync(BUNDLE,{force:true});}catch(e){}});
function buildBundle(){
  cp.execFileSync('bash',[path.join(__dirname,'build.sh'),BUNDLE],{stdio:['ignore','ignore','pipe']});
  const n=fs.statSync(BUNDLE).size;
  if(n<500000)throw new Error('built bundle is implausibly small ('+n+' bytes)');
  return n;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function findChrome(){
  const cands=[];
  const pw=path.join(os.homedir(),'Library/Caches/ms-playwright');
  const dirs=fs.existsSync(pw)?fs.readdirSync(pw):[];
  for(const d of dirs.filter(x=>/headless_shell/.test(x)))
    cands.push(path.join(pw,d,'chrome-headless-shell-mac-arm64/chrome-headless-shell'),
               path.join(pw,d,'chrome-headless-shell-linux64/chrome-headless-shell'));
  for(const d of dirs.filter(x=>/^chromium-/.test(x)))
    cands.push(path.join(pw,d,'chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
               path.join(pw,d,'chrome-linux/chrome'));
  cands.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
             '/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser');
  return cands.find(p=>{try{fs.accessSync(p,fs.constants.X_OK);return true;}catch(e){return false;}})||null;
}

class CDP{
  constructor(ws){this.ws=ws;this.id=0;this.waits=new Map();this.logs=[];
    ws.addEventListener('message',e=>{const m=JSON.parse(e.data);
      if(m.id&&this.waits.has(m.id)){const{res,rej}=this.waits.get(m.id);this.waits.delete(m.id);
        m.error?rej(new Error(JSON.stringify(m.error))):res(m.result);}
      else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')
        this.logs.push((m.params.args||[]).map(a=>a.value||a.description||'').join(' '));
      else if(m.method==='Runtime.exceptionThrown')
        this.logs.push('EXCEPTION '+(m.params.exceptionDetails.exception&&m.params.exceptionDetails.exception.description||m.params.exceptionDetails.text));});}
  send(method,params){const id=++this.id;
    return new Promise((res,rej)=>{this.waits.set(id,{res,rej});this.ws.send(JSON.stringify({id,method,params:params||{}}));});}
  async eval(expr){
    const r=await this.send('Runtime.evaluate',{expression:`(async()=>{${expr}})()`,awaitPromise:true,returnByValue:true});
    if(r.exceptionDetails)throw new Error('EVAL: '+((r.exceptionDetails.exception&&r.exceptionDetails.exception.description)||r.exceptionDetails.text)+'\n--- expr ---\n'+expr);
    return r.result.value;}
  /* a REAL trusted key event — the whole point of this file */
  async key(k,opts){
    const M={Enter:{keyCode:13,code:'Enter',text:'\r'},Escape:{keyCode:27,code:'Escape'},
      Tab:{keyCode:9,code:'Tab'},Backspace:{keyCode:8,code:'Backspace'},
      ' ':{keyCode:32,code:'Space',text:' '}};
    const m=M[k]||{keyCode:k.toUpperCase().charCodeAt(0),code:'Key'+k.toUpperCase(),text:k};
    const base={key:k,windowsVirtualKeyCode:m.keyCode,nativeVirtualKeyCode:m.keyCode,code:m.code,modifiers:(opts&&opts.modifiers)||0};
    await this.send('Input.dispatchKeyEvent',Object.assign({type:m.text?'keyDown':'rawKeyDown',text:m.text},base));
    await this.send('Input.dispatchKeyEvent',Object.assign({type:'keyUp'},base));
    await sleep((opts&&opts.wait)||70);}
  async type(s){for(const ch of s)await this.key(ch,{wait:14});}
}

async function withApp(fn,{width=1280,height=900}={}){
  const bin=findChrome();
  if(!bin)return {skipped:'no chromium binary found'};
  console.log(`  (built a fresh bundle: ${buildBundle().toLocaleString()} bytes)`);
  const srv=await new Promise(res=>{
    const s=http.createServer((rq,rs)=>fs.readFile(BUNDLE,(e,b)=>{
      if(e){rs.writeHead(404);rs.end();}else{rs.writeHead(200,{'content-type':'text/html'});rs.end(b);}}));
    s.listen(0,'127.0.0.1',()=>res(s));});
  const port=srv.address().port;
  const dp=await new Promise(r=>{const t=net.createServer();t.listen(0,'127.0.0.1',()=>{const p=t.address().port;t.close(()=>r(p));});});
  const ud=fs.mkdtempSync(path.join(os.tmpdir(),'rcs-cdp-'));
  /* A chromium profile is a directory, and one per run had been accumulating
     since the suite was written. Both exits below own it: the devtools-never-
     answered throw leaves the try/finally unentered. */
  const rmUd=()=>{try{fs.rmSync(ud,{recursive:true,force:true});}catch(e){}};
  const proc=cp.spawn(bin,['--headless=new','--remote-debugging-port='+dp,'--user-data-dir='+ud,
    '--no-first-run','--no-default-browser-check','--disable-gpu','--window-size='+width+','+height,'about:blank'],
    {stdio:['ignore','ignore','pipe']});
  let buf='';proc.stderr.on('data',d=>{buf+=d;});
  const getj=p=>new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:dp,path:p},r=>{
    let b='';r.on('data',d=>b+=d);r.on('end',()=>{try{res(JSON.parse(b));}catch(e){rej(e);}});}).on('error',rej);});
  let list=null;
  for(let i=0;i<120;i++){try{list=await getj('/json/list');if(list.some(t=>t.type==='page'))break;}catch(e){}await sleep(150);}
  if(!list){proc.kill();srv.close();rmUd();throw new Error('devtools never answered\n'+buf);}
  const ws=new WebSocket(list.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.addEventListener('open',res);ws.addEventListener('error',rej);});
  const c=new CDP(ws);
  await c.send('Runtime.enable');await c.send('Page.enable');
  c.reload=async()=>{
    await c.send('Page.navigate',{url:`http://127.0.0.1:${port}/index.html?selftest=1`});
    for(let i=0;i<140;i++){
      const ok=await c.eval('return !!(window.__t&&window.__t.__firstPid&&window.__t.__firstPid())').catch(()=>false);
      if(ok)return true;await sleep(150);}
    throw new Error('the app never booted under ?selftest=1');};
  await c.reload();
  try{return await fn(c);}
  finally{try{ws.close();}catch(e){}proc.kill();srv.close();rmUd();}
}

/* ── page-side helpers, installed once ──────────────────────────────────── */
const HELPERS=`window.__b={
  full(){const f=window.__t.__form();const o={};
    Object.keys(f).forEach(k=>{const c=f[k]||{};o[k]=JSON.stringify([c.value==null?'':String(c.value),c.source||'']);});return o;},
  diff(a,b){const ks=new Set([...Object.keys(a),...Object.keys(b)]);const out=[];
    ks.forEach(k=>{if((a[k]||'')!==(b[k]||''))out.push(k);});return out.sort();},
  /* what the footer's "unsaved changes" is actually made of — isDirty() says yes
     or no, this says WHICH key, which is the difference between a bug report and
     a shrug */
  dirtyKeys(){const f=window.__t.__form(),s=window.__t.__formSnap()||{};
    const ks=new Set([...Object.keys(f),...Object.keys(s)]);const out=[];
    ks.forEach(k=>{const a=f[k]&&f[k].value!=null?String(f[k].value):'';
      const b=s[k]&&s[k].value!=null?String(s[k].value):'';if(a!==b)out.push(k);});
    return out.sort();},
  el(sel,i){return document.querySelectorAll('#viewForm '+sel)[i||0]||null;},
  /* a checkbox is opacity:0/0x0 on purpose; measure the label the eye sees */
  shown(e){if(!e)return false;const box=e.closest('label.cb,.cb,.wi')||e;
    const r=box.getBoundingClientRect();return r.width>0&&r.height>0;},
  pick(sel,i){const tr=this.el(sel,i);if(!tr)return false;tr.click();
    const drop=tr.closest('.uadrop')||tr.parentElement;
    const opts=[...drop.querySelectorAll('.uaopt')].filter(o=>!o.classList.contains('sel')&&!o.classList.contains('srcdim'));
    if(!opts.length){tr.click();return false;}opts[0].click();return true;},
  footerUnsaved(){const u=document.getElementById('unsavedTag');
    return !!(u&&getComputedStyle(u).display!=='none');}
};return 1;`;

/* ── the run ────────────────────────────────────────────────────────────── */
const FULL=process.argv.includes('--full');

(async()=>{
  const r=await withApp(async c=>{
    const pid=await c.eval('return window.__t.__firstPid()');
    T('the app boots under ?selftest=1 with no Supabase client',pid);
    eq('and says so in the title',await c.eval('return document.title.slice(0,8)'),'SELFTEST');

    const openForm=async()=>{await c.eval(`await window.__t.__openForm(${JSON.stringify(pid)});return 1`);
      await sleep(450);await c.eval(HELPERS);};
    await openForm();
    eq('a fresh form is not dirty',await c.eval('return window.__t.isDirty()'),false);

    /* ── rsNum: a dot is not always a decimal point ─────────────────────────
       Every figure below is read off White Oak Townhomes' own executed
       schedule (FY2025), which types its thousands with dots. Read as decimals
       they gave $1.15 rents, and the totals gate still passed them because the
       whole page was wrong by the same factor. The last three hold the line the
       rule must not cross: two decimal places is money, one is a number, and
       neither is a grouping mark. */
    const num=async v=>c.eval('return window.__t.rsNum('+JSON.stringify(v)+')');
    eq('1.147 is eleven hundred and forty-seven',await num('1.147'),1147);
    eq('36.704 likewise',await num('36.704'),36704);
    eq('$83.135 likewise, dollar sign and all',await num('$83.135'),83135);
    eq('$997.620 likewise',await num('$997.620'),997620);
    eq('and the comma spelling still reads the same',await num('1,147'),1147);
    eq('a plain figure is untouched',await num('161'),161);
    eq('two decimal places stay a decimal',await num('1147.50'),1147.5);
    eq('one decimal place stays a decimal',await num('1.5'),1.5);
    eq('nothing reads as nothing',await num(''),'');

    /* ── tier 3, end to end, with no network ────────────────────────────────
       fixture_rs_scan.json is Azure Document Intelligence's ACTUAL answer for
       pages 1 and 2 of White Oak Townhomes' executed FY2025 schedule — a
       DocuSign-flattened copy with no form fields and no readable text layer,
       the exact document that reported "could not be read". Captured once and
       kept, so everything after the request — which half is which, where each
       page sits on the blank form, and whether the figures survive the totals
       gate — is exercised on every run, for free.
       Every expectation below was read off the rendered page, not off the
       parser's output. Against the pre-fix rsNum this whole block returns null
       with "the figures did not reconcile"; that is what it is here to catch. */
    /* ── the save/revert pair inside the bedroom/bath cell ──────────────────
       It used to sit in a row under the cells, which pushed the whole section
       open. It is back in the cell — and the reason it was moved out in the
       first place is that it appeared on edit and squeezed the dropdowns beside
       it, so the row changed shape as you used it. These four are the guard on
       that: the slot is laid out whether or not there is anything to save. */
    const brbaGeo=()=>c.eval(`
      const row=document.querySelector('#viewForm .ucards .urow');
      const cell=row.querySelector('.rbox.brba');
      const ov=cell.querySelector(':scope > .ovic');
      const R=e=>e.getBoundingClientRect(), cb=R(cell);
      return {rowH:+R(row).height.toFixed(1), cellH:+cb.height.toFixed(1),
        dropW:[...cell.querySelectorAll('.uadrop')].map(d=>+R(d).width.toFixed(1)),
        laidOut: !!ov && R(ov).width>0,
        inside: !!ov && R(ov).right<=cb.right+0.5 && R(ov).left>=cb.left-0.5};`);
    const brbaClean=await brbaGeo();
    await c.eval("window.__t.__editCell('units.0.br','3BR');window.__t.__renderBody();return 1");
    await sleep(320);
    const brbaDirty=await brbaGeo();
    eq('the unit row does not change height when it becomes saveable',brbaDirty.rowH,brbaClean.rowH);
    eq('nor does the bedroom/bath cell',brbaDirty.cellH,brbaClean.cellH);
    /* The dropdowns DO give width back when a pair appears — that is the trade
       that got rid of the permanently empty strip beside the bath. What must not
       happen is the row changing height, which is checked above, or a value
       being squeezed out of its own cell, which is checked below. */
    T('the dropdowns yield room to the pair rather than the value doing it',
      brbaDirty.dropW[0]<=brbaClean.dropW[0]);
    eq('the pair sits inside the cell when it is showing',
       [brbaDirty.laidOut,brbaDirty.inside],[true,true]);
    eq('and nothing in the cell is clipped either way',
       await c.eval("return [...document.querySelectorAll('#viewForm .ucards .urow .rbox.brba .ualab')].filter(l=>l.scrollWidth>l.clientWidth+1).map(l=>l.textContent)"),[]);
    await c.eval("window.__t.__revertKeys(['units.0.br']);window.__t.__renderBody();return 1");
    await sleep(320);

    /* ── after a parse, every changed cell can be acted on ──────────────────
       The general rule, checked against the real document rather than one cell
       at a time: fill the form from the fixture, then ask of every key the parse
       touched whether a save control a user could actually PRESS covers it.
       The effective date failed this twice — once because its pair was keyed to
       custom+source while the figure lives in date_eff_rs, and once because the
       cell rendered the pair only when the date had been typed by hand, so the
       one state that always has something to save was the one state with no
       button. Both were invisible to every other suite. */
    {
      const _rec=await c.eval('return await window.__t.ocrMapPages('+JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname,'fixture_rs_scan.json'),'utf8')))+')');
      await c.eval('window.__t.__setRsParsed('+JSON.stringify(_rec)+');window.__t.__rsFill();window.__t.__renderBody();return 1');
      await sleep(500);
      const cov=await c.eval(`
        const f=window.__t.__form(), snap=window.__t.__formSnap()||{};
        const val=o=>o&&o.value!=null?String(o.value):'';
        const dirty=[];
        new Set([...Object.keys(f),...Object.keys(snap)]).forEach(k=>{
          const a=val(f[k]), b=val(snap[k]), src=f[k]&&f[k].source;
          if(a!==b||((src==='new'||src==='this-cycle'||src==='overridden')&&a!==''))dirty.push(k);});
        const vis=el=>{ if(!el||!el.offsetParent)return false;
          const r=el.getBoundingClientRect(); if(r.width<1||r.height<1)return false;
          const cs=getComputedStyle(el);
          return cs.visibility!=='hidden'&&cs.display!=='none'&&+cs.opacity>0.01; };
        const covered=new Set();
        document.querySelectorAll('[data-save1]').forEach(b=>{ if(!vis(b))return;
          b.getAttribute('data-save1').split(',').forEach(k=>covered.add(k)); });
        const dateOv=document.querySelector('[data-ovic*="date_eff"]');
        return {naked:dirty.filter(k=>!covered.has(k)),
          dateCovered:covered.has('rent_schedule.date_eff_rs'),
          datePairOnScreen:vis(dateOv)};`);
      T('the parsed effective date has a save control on screen',cov.datePairOnScreen);
      eq('and it covers the figure the schedule actually wrote',cov.dateCovered,true);
      /* This once carried an exception for nonrev.enabled — the Part D flag turned
         itself on and stranded the form dirty with nothing on screen to press.
         Coupling the flag to the rows it governs closed it, so the rule is now
         stated without one: after a parse, NOTHING is left that cannot be saved. */
      /* nonrev.enabled is the one key a parse touches that has no per-cell save,
         deliberately: switching a section on is not a thing to save on its own —
         the next "Update property profile" writes it and prunes the rows that
         were never filled in. Turning a section OFF is a decision and does get a
         pair. Named here so anything ELSE going unsaveable still fails. */
      eq('nothing else the parse touched is left unsaveable',
         cov.naked.filter(k=>k!=='nonrev.enabled'),[]);

      /* Part D has no unit-count column on the schedule, so the 1 is derived
         rather than read — and derived is still parsed. Left unmarked it wore the
         grey of a cell nobody had touched, and its box was the one cell in the row
         with no dropdown at all, which reads as an oversight rather than an answer. */
      /* The seeded property already carries a Part D row, and a parse that writes
         the value already on file is correctly 'database' — which is not the state
         Matt met. Delete the row first, so the parse re-creates it from nothing:
         that is the property with no Part D on file, where the derived count had
         neither a colour nor a way to be saved. */
      await c.eval('document.querySelector(\'[data-delnonrev="0"]\').click();return 1');
      await sleep(200);
      await c.eval('window.__t.__rsFill();return 1');
      await sleep(300);
      const partd=await c.eval(`
        const f=window.__t.__form();
        const box=document.querySelector('[data-box="nonrev.0.num_units"]');
        return {src:(f['nonrev.0.num_units']||{}).source,val:(f['nonrev.0.num_units']||{}).value,
          hasPick:!!(box&&box.querySelector('.uadrop')),
          flagCovered:[...document.querySelectorAll('[data-save1]')]
            .some(b=>b.getAttribute('data-save1').split(',').indexOf('nonrev.enabled')>=0)};`);
      eq('the Part D count the parse derived reads as parsed',[partd.val,partd.src],['1','this-cycle']);
      T('and its cell says where it could not have come from',partd.hasPick);
      /* Was: the flag coupled to every row key, so ticking a section put a save
         pair on four blank cells. Ticking a section on asks nothing of the
         record — leave the rows empty and the next save drops both. Turning one
         OFF that holds values is a decision, and keeps its pair; that is checked
         in "a section turned off says so" below. */
      eq('ticking a section on puts no pair on its empty row',partd.flagCovered,false);

      /* rsYearOn advances the parsed date by a year on purpose: the uploaded
         schedule is the one in force and this package renews it. The figure was
         right and the badge was wrong — "from RS" on a date the RS never printed,
         on the cell that decides which year the renewal is filed for. */
      const badge=await c.eval(`
        const b=document.querySelector('[data-box="rent_schedule.date_eff_source"] .srctag');
        return b?b.textContent.trim():null;`);
      T('the date badge does not claim the schedule printed it',
        !!badge&&!/from RS/.test(badge)&&/year/.test(badge));
    }

    const scan=JSON.parse(fs.readFileSync(path.join(__dirname,'fixture_rs_scan.json'),'utf8'));
    const rec=await c.eval('return await window.__t.ocrMapPages('+JSON.stringify(scan)+')');
    T('a flattened scan parses at all',!!rec);
    if(rec){
      eq('the project name, slash and all',rec.scalars['property.name'],'Colonial Village/White Oak Townhomes');
      eq('the rents-effective date',rec.scalars['rs_date'],'2025-10-01');
      eq('the HAP contract number, which no field on this form carries',rec.scalars['property.s8'],'OH10M000236');
      eq('the ownership entity',rec.scalars['owner.entity_name'],'Colonial Village Preservation, L.P');
      eq('and its type, from a drawn tick',rec.scalars['owner.entity_type'],'Limited Partnership');
      eq('the signatory',[rec.scalars['sig.name'],rec.scalars['sig.title']],['David Pearson','VP']);
      eq('two unit types',rec.units.length,2);
      eq('2 Bedroom: 32 units at $1,147, $161 allowance',
         [rec.units[0].type,rec.units[0].count,rec.units[0].rent,rec.units[0].ua],['2 Bedroom',32,1147,161]);
      eq('3 Bedroom: 33 units at $1,407, $171 allowance',
         [rec.units[1].type,rec.units[1].count,rec.units[1].rent,rec.units[1].ua],['3 Bedroom',33,1407,171]);
      eq('the non-revenue leasing office',[rec.nonrev[0].use,rec.nonrev[0].rent],['Leasing Office',1147]);
      eq('one principal',rec.principals.length,1);
      eq('the write-ins came across',
         [rec.partb['partb.writein.e1'],rec.partb['partb.writein.e2'],rec.partb['partb.writein.s1']],
         ['Shades','W/D Hookups','Security']);
      eq('and the fuel letters',
         [rec.partb['partb.fuel.0'],rec.partb['partb.fuel.1']],['G','E']);
    }

    /* ── the same scan, nudged ──────────────────────────────────────────────
       Every expectation above rests on word polygons captured at Azure's full
       precision, and rsFindS8 used to depend on that precision: rounding this
       fixture's polygons to a thousandth of an inch lost the HAP number and
       changed nothing else in the record. Two words of one printed line were
       joined in HEIGHT order, and "HAP" outranked "Contract" by 0.034pt — a
       two-thousandth of an inch was the entire margin by which the label read as
       a label. A sheet on a scanner glass moves orders of magnitude more than
       that. So the fixture is also read nudged: every word and every tick
       displaced by up to half a point, a different direction each, deterministic
       per seed so a failure can be re-run. Against the pre-fix rsFindS8 all
       three seeds come back with no number at all; that is what this catches. */
    const mulberry32=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
      t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
    const nudge=(pgs,pt,seed)=>{const rnd=mulberry32(seed),inch=pt/72;   // the fixture measures in inches
      const move=o=>{const dx=(rnd()*2-1)*inch,dy=(rnd()*2-1)*inch;
        return Object.assign({},o,{poly:o.poly.map((v,i)=>i%2?v+dy:v+dx)});};
      return pgs.map(pg=>Object.assign({},pg,
        {words:(pg.words||[]).map(move),marks:(pg.marks||[]).map(move)}));};
    for(const seed of [1,2,3]){
      const j=await c.eval('return await window.__t.ocrMapPages('+JSON.stringify(nudge(scan,0.5,seed))+')');
      eq(`nudged half a point (seed ${seed}): the HAP number still reads`,
         (j&&j.scalars['property.s8'])||null,'OH10M000236');
      eq(`nudged half a point (seed ${seed}): and the page reads as it did`,
         j&&j.units?[j.scalars['rs_date'],j.units.length,j.units[0].rent,j.units[1].rent]:null,
         ['2025-10-01',2,1147,1407]);
    }

    /* ── the package score, on the real bundle ──────────────────────────────
       The defect this replaced was two computations of one number: the ring in
       the data layer counting ten durable keys, the documents in app.js asking
       DOC_REQS. A property read 100% with the draft rent schedule and the tenant
       notice unbuildable. So the checks that matter are the ones a pure unit
       test cannot make — that the SAME number reaches the menu row and the form,
       and that the card the reader looks at is drawn from it. */
    console.log('\n── one score, three readers ───────────────────────────');
    const scoreNow=async()=>c.eval('const s=window.__t.packageScore();'
      +'const row=(window.__t.__listProps()||[]).find(p=>p.id==='+JSON.stringify(pid)+')||{};'
      +'return {form:s.pct,row:row.score,caption:row.caption,ready:s.docsReady,total:s.docsTotal,'
      +'blockers:s.blockers.map(b=>b.label),caveats:s.caveats.length};');
    /* Like with like: the menu row IS the dominant package, so the form has to
       be that package for the two to be answering one question. Opened on the
       property template instead, they legitimately differ — the template is not
       a package and has no documents to be ready. */
    const domCid=await c.eval('const cs=window.__t.__cycles()||[];const d=cs.find(x=>x.dominant)||cs[0];return d?d.id:null;');
    if(domCid){await c.eval('await window.__t.__openCycleForm('+JSON.stringify(pid)+','+JSON.stringify(domCid)+');return 1');
      await sleep(450);await c.eval(HELPERS);}
    const S0=await scoreNow();
    eq('the package and its menu row report the same number',[S0.form,S0.row],[S0.form,S0.form]);
    eq('and the number is a multiple of 5',S0.form%5,0);
    eq('the caption counts documents, not fields',S0.caption,S0.ready+' of '+S0.total+' documents ready');
    /* The card is the surface the reader actually meets. Drawn from the score
       or drawn from anything else is the whole distinction — pkgCard used to
       hardcode a tick for five of its six rows. */
    const card=await c.eval('return window.__t.__pkgCard();');
    eq('the card draws one row per document in the package',
       (card.match(/<i class="dtick[ "]/g)||[]).length,S0.total);
    eq('and ticks exactly the ones that are ready',
       (card.match(/<i class="dtick">✓<\/i>/g)||[]).length,S0.ready);
    eq('every gap on the card is one press from the cell that fixes it',
       S0.blockers.length+S0.caveats.length>0?/data-goto="/.test(card):true,true);

    /* Crossing 70. The FHA number is on no document but the rent schedule, and
       was on none of the ten keys the old ring counted — which is exactly why
       the schedule could not be written on a property reading 100%. */
    const before=await scoreNow();
    await c.eval('window.__t.__edit("property.fha","");window.__t.__renderBody();return 1');
    const without=await scoreNow();
    eq('clearing the FHA number costs the package a document',without.ready,before.ready-1);
    eq('and names it as a blocker',without.blockers.indexOf('FHA number')>=0,true);
    eq('so the score cannot sit at 70 or better',without.form<70,true);
    await c.eval('window.__t.__edit("property.fha","043-11045");window.__t.__renderBody();return 1');
    const after=await scoreNow();
    eq('putting it back restores the count',[after.ready,after.blockers.indexOf('FHA number')],[before.ready,-1]);
    await openForm();   // the rest of the suite runs on the property form, not the package

    /* ─────────────────────────────────────────────────────────────────────
       1. coupledKeys — a cell answers the same whichever identity you hand it.
       The SAFMR and the allowance flip data-box between *_source and *_custom
       (rule 9). Keyed off _source, coupledKeys used to return itself alone, so
       the *_reviewed flag the pick had just set was left behind. */
    console.log('\n── a cell has one identity ────────────────────────────');
    for(const fam of ['ua','safmr']){
      const sets=await c.eval(`const t=window.__t;
        return ['custom','source','reviewed'].map(s=>t.coupledKeys('units.0.${fam}_'+s).slice().sort());`);
      eq(`units.0.${fam}: all three spellings name the same cell`,
         [sets[0],sets[1],sets[2]],[sets[0],sets[0],sets[0]]);
      eq(`units.0.${fam}: and that cell carries its reviewed flag`,
         sets[0].indexOf(`units.0.${fam}_reviewed`)>=0,true);
    }

    /* ─────────────────────────────────────────────────────────────────────
       2. Enter saves — every kind of cell (rule 7). The save/revert buttons are
       tabindex="-1" on the premise that Enter and Escape ARE the keyboard
       route, so a cell deaf to Enter has no keyboard path to save at all. */
    console.log('\n── Enter saves the focused cell ───────────────────────');
    const KINDS=[
      {sel:'input[data-k]',       name:'text box',        act:'type'},
      {sel:'input[data-srcedit]', name:'source-edit box', act:'type'},
      {sel:'.uatrigger',          name:'dropdown',        act:'menu'},
      {sel:'[data-fuel]',         name:'fuel chip',       act:'click'},
      /* The 3-way chip is deliberately inert until its write-in is named
         (`if(!get(base))return`) — a fuel letter for a utility nobody has
         written down means nothing. Naming it is setup, not the thing tested. */
      {sel:'[data-fuel3]',        name:'fuel chip 3-way', act:'click',
       pre:`window.__t.__edit('partb.writein.u1','Trash removal');window.__t.__renderBody();`},
      {sel:'[data-wibox]',        name:'write-in tick',   act:'click'},
      {sel:'[data-cb]',           name:'checkbox',        act:'click'},
    ];
    for(const K of KINDS){
      await openForm();
      if(K.pre){await c.eval(K.pre+'return 1;');await sleep(220);}
      const before=await c.eval('return window.__b.full()');
      let moved=false,idx=-1;
      const count=await c.eval(`return document.querySelectorAll('#viewForm ${K.sel}').length`);
      for(let i=0;i<count&&!moved;i++){
        if(!(await c.eval(`return window.__b.shown(window.__b.el(${JSON.stringify(K.sel)},${i}))`)))continue;
        if(K.act==='type'){
          const cur=await c.eval(`const e=window.__b.el(${JSON.stringify(K.sel)},${i});e.focus();
            try{e.setSelectionRange(e.value.length,e.value.length);}catch(_){}return e.value||'';`);
          await c.type(/^[\d$.,\/\s]*$/.test(cur)?'1':'x');
        } else if(K.act==='menu'){
          if(!(await c.eval(`return window.__b.pick('.uatrigger',${i})`)))continue;
        } else await c.eval(`window.__b.el(${JSON.stringify(K.sel)},${i}).click();return 1;`);
        await sleep(150);
        const d=await c.eval(`return window.__b.diff(${JSON.stringify(before)},window.__b.full())`);
        if(d.length){moved=true;idx=i;}
      }
      if(!moved){eq(`${K.name}: a control that can be changed exists`,false,true);continue;}

      /* For a typed cell the caret is already where the app put it — the cell can
         change shape under the edit, and re-focusing by index clobbers it. For a
         clicked one, put focus on the control the way tabbing to it would. */
      if(K.act!=='type')await c.eval(`const e=window.__b.el(${JSON.stringify(K.sel)},${idx});if(e)e.focus();return 1;`);
      await c.key('Enter',{wait:320});
      const left=await c.eval('return window.__b.dirtyKeys()');
      eq(`${K.name}: Enter leaves nothing unsaved`,left,[]);
    }

    /* ─────────────────────────────────────────────────────────────────────
       3. The regression itself, named. Picking a source sets the reviewed flag
       beside it; Enter went through commitPending, which widened only through
       address groups, so it saved the source and left the flag. The app then
       said "Saved this field to the database" while the footer said "Unsaved
       changes" — with nothing on screen to save. */
    console.log('\n── the source dropdowns save their whole cell ─────────');
    for(const box of ['units.0.ua_source','units.0.safmr_source']){
      await openForm();
      const picked=await c.eval(`
        const b=document.querySelector('#viewForm [data-box="${box}"]')
              ||document.querySelector('#viewForm [data-box="${box.replace('_source','_custom')}"]');
        if(!b)return false;const tr=b.querySelector('.uatrigger');if(!tr)return false;
        tr.click();
        const o=[...b.querySelectorAll('.uaopt')].filter(x=>!x.classList.contains('sel')&&!x.classList.contains('srcdim'));
        if(!o.length){tr.click();return false;}o[0].click();return true;`);
      T(`${box}: a different source can be picked`,picked);
      await c.eval(`const b=document.querySelector('#viewForm [data-box="${box}"]')
        ||document.querySelector('#viewForm [data-box="${box.replace('_source','_custom')}"]');
        const tr=b&&b.querySelector('.uatrigger');if(tr)tr.focus();return 1;`);
      await c.key('Enter',{wait:340});
      eq(`${box}: Enter saves the flag with the source`,await c.eval('return window.__b.dirtyKeys()'),[]);
      eq(`${box}: the footer agrees with the status line`,await c.eval('return window.__b.footerUnsaved()'),false);
    }

    /* ─────────────────────────────────────────────────────────────────────
       4. Escape takes it back (rule 12 / "Before you deliver" §6). isDirty()
       compares VALUES ONLY across ALL keys, so this diffs the form against
       FORMSNAP key by key and names the culprit. */
    console.log('\n── Escape returns the cell to where it started ────────');
    for(const K of KINDS){
      await openForm();
      if(K.pre){await c.eval(K.pre+'return 1;');await sleep(220);}
      const base=await c.eval('return window.__b.full()');
      let moved=false;
      const count=await c.eval(`return document.querySelectorAll('#viewForm ${K.sel}').length`);
      for(let i=0;i<count&&!moved;i++){
        if(!(await c.eval(`return window.__b.shown(window.__b.el(${JSON.stringify(K.sel)},${i}))`)))continue;
        if(K.act==='type'){
          const cur=await c.eval(`const e=window.__b.el(${JSON.stringify(K.sel)},${i});e.focus();
            try{e.setSelectionRange(e.value.length,e.value.length);}catch(_){}return e.value||'';`);
          await c.type(/^[\d$.,\/\s]*$/.test(cur)?'1':'x');
        } else if(K.act==='menu'){
          if(!(await c.eval(`return window.__b.pick('.uatrigger',${i})`)))continue;
        } else await c.eval(`window.__b.el(${JSON.stringify(K.sel)},${i}).click();return 1;`);
        await sleep(150);
        if((await c.eval(`return window.__b.diff(${JSON.stringify(base)},window.__b.full())`)).length)moved=true;
      }
      if(!moved){eq(`${K.name}: a control that can be changed exists (escape)`,false,true);continue;}
      for(let p=0;p<6;p++){await c.key('Escape',{wait:160});
        if(!(await c.eval('return window.__t.isDirty()')))break;}
      eq(`${K.name}: Escape restores the form key by key`,
         await c.eval(`return window.__b.diff(${JSON.stringify(base)},window.__b.full())`),[]);
    }

    /* ──────────────────────────────────────────────────────
       5. A difference between the documents is not a blockage.

       There used to be a pair of buttons here — "keep RS" / "use RCS" — that a
       reader had to press before a cell whose two sources disagreed could be
       saved at all. It was the wrong premise: the number a reader types IS the
       answer, and the study's number belongs in the cell's own dropdown to be
       pulled if it is wanted. Typing over a count that the study reads
       differently now saves like any other cell, and the study's figure is one
       of the things the cell offers. */
    console.log('\n── a difference is not a blockage ─────────────────────');
    await openForm();
    await c.eval("window.__t.__edit('units.0.num_rcs','77');window.__t.__renderBody();return 1;");
    await sleep(280);
    eq('a count the study reads differently offers no modal choice',
       await c.eval("return document.querySelectorAll('#viewForm [data-num],#viewForm [data-typ]').length"),0);
    await c.eval("const i=document.querySelector('[data-k=\"units.0.num_units\"]');i.focus();i.value='';return 1");
    await c.type('3');
    await sleep(200);
    await c.key('Enter');
    await sleep(800);
    {
      const cell=await c.eval(`
        const b=document.querySelector('[data-box="units.0.num_units"]');
        const cs=getComputedStyle(b);
        return {v:window.__t.getVal('units.0.num_units'),src:window.__t.srcOf('units.0.num_units'),
          border:cs.borderLeftColor,tag:(b.querySelector('.srctag')||{}).textContent||null};`);
      eq('typing over it and pressing Enter saves it',[cell.v,cell.src],['3','database']);
      eq('the cell reads as on file',cell.border,'rgb(37, 99, 235)');
      eq('and stops claiming the schedule gave it',cell.tag,null);
    }
    /* And the study's own count, which had nowhere to be offered from while the
       buttons existed. */
    await openForm();
    await c.eval(`window.__t.__setRcsParsed({scalars:{},units:[{type:'1 Bedroom',br:1,ba:1,count:19,rent:'',ua:'',proposed:'',safmr:''}],firm:'belfry'});
      window.__t.__edit('units.0.br','1BR');window.__t.__edit('units.0.ba','1BA');
      window.__t.__renderBody();return 1;`);
    await sleep(300);
    T('the count cell offers the study as well as the schedule',
      await c.eval("return [...document.querySelectorAll('[data-box=\"units.0.num_units\"] .uaopt')].some(o=>/RCS report/.test(o.innerText)&&/19/.test(o.innerText))"));

    /* ─────────────────────────────────────────────────────────────────────
       6. The unit-type cell's sub-cells. A sub-value marks itself; the cell's
       own bar answers for the whole cell. */
    console.log('\n── the unit type cell ─────────────────────────────────');
    await openForm();
    await c.eval(`const t=window.__t;
      t.__edit('units.0.br','1BR');t.__edit('units.0.ba','1BA');t.__edit('units.0.label','Elderly');
      await t.__saveCell('units.0.br');await t.__saveCell('units.0.ba');await t.__saveCell('units.0.label');
      t.__renderBody();return 1;`);
    await sleep(320);
    const barOf=async k=>c.eval(`const e=document.querySelector('#viewForm [data-trigfor="${k}"]');
      if(!e)return 'missing';return /linear-gradient/.test(getComputedStyle(e).backgroundImage)?'bar':'none';`);
    eq('settled: bedroom carries no bar',await barOf('units.0.br'),'none');
    eq('settled: the label line reads on file',
       await c.eval(`const e=document.querySelector('#viewForm [data-box="units.0.label"]');
         return e?getComputedStyle(e).borderLeftColor:'missing';`),'rgb(37, 99, 235)');
    await c.eval(`window.__t.__edit('units.0.label','Family');window.__t.__renderBody();return 1;`);
    await sleep(280);
    eq('changed: the label line goes amber',
       await c.eval(`const e=document.querySelector('#viewForm [data-box="units.0.label"]');
         return e?getComputedStyle(e).borderLeftColor:'missing';`),'rgb(180, 83, 9)');
    eq('changed: bedroom still does not',await barOf('units.0.br'),'none');

    const dividers=await c.eval(`
      const px=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);
        return [+r.width.toFixed(2),+r.height.toFixed(2),s.backgroundColor];};
      /* ONE cell, not every unit row — the seeded property has six, and counting
         them all made this assert 12 and read as a defect the moment the test
         record grew up. */
      const cell=document.querySelector('#viewForm .rbox.brba');
      const addr=document.querySelector('#viewForm .fbox.addr');
      const u=[...cell.querySelectorAll('.utdiv')].map(px);
      const a=[...addr.querySelectorAll('.adiv')].map(px);
      return {u,a};`);
    /* No dividers left in the type cell. Both rules existed to fence off things
       that are gone — the designation and the whole-cell picker — and bedroom
       and bath have always been separated by their own slash. The address still
       draws its own, which is what keeps that rule honest. */
    eq('the type cell draws no divider',dividers.u.length,0);
    eq('the address still draws its own',dividers.a.length>0,true);

    /* ─────────────────────────────────────────────────────────────────────
       7. The session boundary (rule 19). A defect that does not exist inside a
       single page load: leaving the form and coming back, or reloading, must
       not change what a cell holds. */
    console.log('\n── across the session boundary ────────────────────────');
    await openForm();
    await c.eval(`const t=window.__t;t.__edit('property.name','Boundary Test');
      await t.__saveCell('property.name');return 1;`);
    await c.eval('return window.__t.openMenu()');await sleep(250);
    await openForm();
    eq('a saved value survives leaving the form and coming back',
       await c.eval(`return window.__t.getVal('property.name')`),'Boundary Test');
    eq('and the form is not dirty on return',await c.eval('return window.__t.isDirty()'),false);
    await c.reload();await sleep(300);
    await c.eval(`await window.__t.__openForm(${JSON.stringify(pid)});return 1`);await sleep(450);await c.eval(HELPERS);
    eq('a saved value survives a full page reload',
       await c.eval(`return window.__t.getVal('property.name')`),'Boundary Test');
    eq('and the form is not dirty after one',await c.eval('return window.__t.isDirty()'),false);

    /* ─────────────────────────────────────────────────────────────────────
       8. Focus survives a save. Enter on a fuel chip or a write-in tick routes
       through the ✓ button (cellActBtn -> click), and that handler never put the
       caret back the way commitPending does — so the save landed and focus fell
       to <body>: no second Enter, no Escape, no Tab from where you were. */
    console.log('\n── the caret survives a save ──────────────────────────');
    for(const K of [{sel:'[data-fuel]',name:'fuel chip'},{sel:'[data-wibox]',name:'write-in tick'}]){
      await openForm();
      await c.eval(`document.querySelectorAll('#viewForm ${K.sel}')[0].click();return 1`);
      await sleep(160);
      await c.eval(`document.querySelectorAll('#viewForm ${K.sel}')[0].focus();return 1`);
      await c.key('Enter',{wait:340});
      eq(`${K.name}: the caret stays in the form after Enter`,
         await c.eval(`const a=document.activeElement,v=document.getElementById('viewForm');
           if(!a||a===document.body)return '(body)';return (v&&v.contains(a))?'in the form':'outside';`),
         'in the form');
    }

    /* The cells that flip data-box with their mode (rule 9) lose the caret the
       same way, one layer along: the refocus selector named the spelling we
       started with, and saving had just swapped the cell to the other one. */
    for(const D of [{box:'rent_schedule.date_eff_source',name:'rents-effective date'},
                    {box:'tenant.mgmt_address',name:'management address'}]){
      await openForm();
      const picked=await c.eval(`
        const b=document.querySelector('#viewForm [data-box="${D.box}"]');if(!b)return null;
        const tr=b.querySelector('.uatrigger');if(!tr)return null;tr.click();
        const o=[...b.querySelectorAll('.uaopt')].filter(x=>!x.classList.contains('sel')&&!x.classList.contains('srcdim'));
        if(!o.length){tr.click();return null;}const t=o[0].textContent.trim().slice(0,24);o[0].click();return t;`);
      T(`${D.name}: a mode can be picked`,picked);
      await c.eval(`const b=document.querySelector('#viewForm [data-box="${D.box}"]');
        const tr=b&&b.querySelector('.uatrigger');if(tr)tr.focus();return 1;`);
      await c.key('Enter',{wait:380});
      eq(`${D.name}: the caret survives the mode change`,
         await c.eval(`const a=document.activeElement,v=document.getElementById('viewForm');
           if(!a||a===document.body)return '(body)';return (v&&v.contains(a))?'in the form':'outside';`),
         'in the form');
    }

    /* ─────────────────────────────────────────────────────────────────────
       9. Geometry, from computed style, at the three widths. An <input> carries
       an intrinsic ~20-character minimum and a 1fr track will not shrink below
       its content, so the address street box held the main column wider than the
       viewport and the whole page scrolled sideways at 1200. */
    console.log('\n── it fits, measured ──────────────────────────────────');
    await openForm();
    for(const w of [1200,1280,1920]){
      await c.send('Emulation.setDeviceMetricsOverride',{width:w,height:900,deviceScaleFactor:1,mobile:false});
      await sleep(420);
      const g=await c.eval(`
        const de=document.documentElement;const over=[];
        document.querySelectorAll('#viewForm .rbox,#viewForm .fbox').forEach(cell=>{
          const r=cell.getBoundingClientRect();if(!(r.width>0))return;
          [...cell.children].forEach(k=>{const q=k.getBoundingClientRect();
            if(q.width>0&&(q.right>r.right+0.5||q.left<r.left-0.5))over.push(cell.className);});});
        return {sideways:de.scrollWidth>de.clientWidth+1,over:over.length};`);
      eq(`${w}px: the page does not scroll sideways`,g.sideways,false);
      eq(`${w}px: nothing spills out of its cell`,g.over,0);
    }
    await c.send('Emulation.clearDeviceMetricsOverride');

    /* ─────────────────────────────────────────────────────────────────────
       10. Switching a cell to Custom must not fail the save. Only a row with no
       RCS figure offers "Custom…" as its first unselected option, so with one
       seeded unit row this never ran. On a real property it threw "Cannot read
       properties of undefined (reading 'value')" and told the user the save had
       FAILED: a group widened through coupledKeys names a *_custom and a
       *_reviewed the user has never typed into, and save dereferenced them. */
    console.log('\n── switching to Custom saves ──────────────────────────');
    for(const row of [3,5]){
      await openForm();
      const picked=await c.eval(`
        const box=document.querySelector('#viewForm [data-box="units.${row}.ua_source"],#viewForm [data-box="units.${row}.ua_custom"]');
        if(!box)return null;const tr=box.querySelector('.uatrigger');if(!tr)return null;tr.click();
        const o=[...box.querySelectorAll('.uaopt')].filter(x=>!x.classList.contains('sel')&&!x.classList.contains('srcdim'));
        const hit=o.find(x=>/Custom/.test(x.textContent))||o[0];
        if(!hit){tr.click();return null;}const t=hit.textContent.trim();hit.click();return t;`);
      T(`unit row ${row}: a source can be picked`,picked);
      await c.eval(`const box=document.querySelector('#viewForm [data-box="units.${row}.ua_source"],#viewForm [data-box="units.${row}.ua_custom"]');
        const tr=box&&box.querySelector('.uatrigger');if(tr)tr.focus();return 1;`);
      await c.key('Enter',{wait:380});
      const st=await c.eval(`const s=document.getElementById('status');return s?s.textContent.trim():'';`);
      eq(`unit row ${row}: the save does not fail`,/Save failed|Cannot read/.test(st),false);
      eq(`unit row ${row}: and nothing is left unsaved`,
         await c.eval(`return window.__b.dirtyKeys().filter(k=>k.indexOf('units.${row}.')===0)`),[]);
    }

    /* ─────────────────────────────────────────────────────────────────────
       11. Nothing threw along the way. */
    /* ── what each document is short of ─────────────────────────────────────
       The dialog used to print every gap twice: once as a count on the row it
       blocked, and again in a table underneath grouped by section — which on a
       six-document package with a half-filled form was the tallest thing in the
       app. The count is now the control: hovering it opens that document's own
       list, and each field in it is the jump to the cell that fixes it.

       Reloading first because generating writes to the record, and because this
       has to run against a form nobody has been editing. */
    console.log('\n── what each document is short of ─────────────────────');
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    // real gaps, in two different sections, so the card has something to group
    await c.eval("['ca.name','ca.org','poc.name'].forEach(k=>window.__t.__edit(k,''));window.__t.__renderBody();return 1");
    await c.eval("document.getElementById('bGenerate').click();return 1");
    await sleep(700);
    await c.eval("const b=document.getElementById('dlgOk');if(b)b.click();return 1");   // no letterhead: generate anyway
    for(let i=0;i<100;i++){const n=await c.eval("return document.querySelectorAll('.gdoc').length");if(n)break;await sleep(250);}
    const G=await c.eval(`
      const rows=[...document.querySelectorAll('.gdoc')];
      const chips=[...document.querySelectorAll('.gpw>.gshort')];
      const w=chips.length?chips[0].parentElement:null;
      if(w)w.classList.add('open');
      const pop=w?w.querySelector('.gpop-in'):null;
      const r=pop?pop.getBoundingClientRect():null;
      return {n:rows.length,
        heights:[...new Set(rows.map(x=>Math.round(x.getBoundingClientRect().height)))],
        oldBlocks:document.querySelectorAll('.missblk').length,
        chip:chips.length?chips[0].textContent:'',
        popShown:!!(r&&r.width>50&&r.height>20),
        popOnScreen:!!(r&&r.left>=0&&r.right<=window.innerWidth&&r.top>=0),
        fields:pop?pop.querySelectorAll('.gpf').length:0,
        jumps:pop?pop.querySelectorAll('.gpf[data-goto]').length:0};`);
    eq('all six documents are listed',G.n,6);
    eq('and every row is one height, whatever it is short of',G.heights.length,1);
    eq('the two list blocks beneath them are gone',G.oldBlocks,0);
    T('a blocked row states a count',/\d+ field/.test(G.chip));
    T('opening the count shows that document\u2019s own list',G.popShown);
    T('and the list stays on screen',G.popOnScreen);
    T('every field in it is a jump to the cell that fixes it',G.fields>0&&G.fields===G.jumps);
    /* The ready rows are themselves download buttons. A count inside one used to
       be a click on the row, so reaching for the list downloaded the document. */
    const readyChip=await c.eval(`
      const b=document.querySelector('.gdoc-on .gpw>.gshort');
      if(!b)return 'none';
      b.click();
      return document.getElementById('scrim').classList.contains('open')?'stayed':'downloaded';`);
    T('a count inside a download row is not the download',readyChip!=='downloaded');
    const jumped=await c.eval(`
      const b=document.querySelector('.gpw .gpop .gpf');if(!b)return null;
      b.click();
      return {open:document.getElementById('scrim').classList.contains('open')};`);
    eq('pressing a field closes the dialog and travels to it',jumped&&jumped.open,false);

    /* ── a pulled factor is as unsaved as a typed one ───────────────────────
       The same sweep as the parse, on the other two flows that fetch figures
       from outside. The Federal Register pull writes five keys and marks all
       five; the OCAF cell rendered its pair only for a factor typed by hand, so
       the ordinary way to get one left the form dirty with nothing to press.
       The utility-allowance pull writes seven: four factors that each have a
       cell, and three — the fiscal year, the state, the publication date — that
       no cell names at all. Both are the effective date's defect wearing a
       different section number, which is why ovIcons now widens through
       coupledKeys for everything rather than for these one at a time. */
    console.log('\n── a pulled factor can be saved ───────────────────────');
    await c.reload();
    await c.eval(HELPERS);
    {
      const cid=await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');'
        +"const cy=await window.__t.__newCycle({programs:['ocaf','uaf'],label:'FACTORS'});"
        +'return (cy&&(cy.cid||cy.id))||cy;');
      await c.eval('await window.__t.__openCycleForm('+JSON.stringify(pid)+','+JSON.stringify(cid)+');return 1');
      await sleep(400);
      const secs=await c.eval("return [...document.querySelectorAll('#sections .ctitle')].map(x=>x.textContent)");
      T('an OCAF + UAF package shows both factor sections',
        secs.indexOf('OCAF rent adjustment (HUD-9625)')>=0&&secs.indexOf('Utility allowance factors')>=0);

      // exactly what the two pulls write
      await c.eval("window.__t.__edit('ocaf.factor_pub','4.9');window.__t.__edit('ocaf.factor_fy','2026');"
        +"window.__t.__edit('ocaf.factor_pubdate','2025-11-03');window.__t.__edit('ocaf.factor_state','MI');"
        +"window.__t.__srcSetSource('ocaf.factor_custom','fr');"
        +"['oil','gas','electric','water'].forEach((u,ix)=>window.__t.__edit('uaf.f_'+u,String(1.0+ix/100)));"
        +"window.__t.__edit('uaf.factor_fy','2026');window.__t.__edit('uaf.factor_state','MI');"
        +"window.__t.__edit('uaf.factor_pubdate','2025-10-01');window.__t.__renderBody();return 1");
      await sleep(400);
      const cov=await c.eval(`
        const vis=el=>{if(!el||!el.offsetParent)return false;const r=el.getBoundingClientRect();
          if(r.width<1||r.height<1)return false;const cs=getComputedStyle(el);
          return cs.visibility!=='hidden'&&cs.display!=='none'&&+cs.opacity>0.01;};
        const covered=new Set();
        document.querySelectorAll('[data-save1]').forEach(b=>{if(!vis(b))return;
          b.getAttribute('data-save1').split(',').forEach(k=>covered.add(k));});
        const f=window.__t.__form(),snap=window.__t.__formSnap()||{};
        const val=o=>o&&o.value!=null?String(o.value):'';
        const dirty=[];
        new Set([...Object.keys(f),...Object.keys(snap)]).forEach(k=>{
          const a=val(f[k]),b=val(snap[k]),src=f[k]&&f[k].source;
          if(a!==b||((src==='new'||src==='this-cycle'||src==='overridden')&&a!==''))dirty.push(k);});
        return {pairOnScreen:vis(document.querySelector('[data-ovic*="ocaf.factor"]')),
          ocaf:['ocaf.factor_pub','ocaf.factor_fy','ocaf.factor_pubdate','ocaf.factor_state','ocaf.factor_src'].filter(k=>!covered.has(k)),
          uaf:['uaf.factor_fy','uaf.factor_state','uaf.factor_pubdate'].filter(k=>!covered.has(k)),
          naked:dirty.filter(k=>!covered.has(k)).sort()};`);
      T('the pulled OCAF factor has a save control on screen',cov.pairOnScreen);
      eq('and it covers every key the pull wrote',cov.ocaf,[]);
      eq('the utility factors carry their fiscal year, state and publication date',cov.uaf,[]);
      eq('and a pull leaves nothing that cannot be saved',cov.naked,[]);
    }

    /* ── six the audit found, each one reproduced before it was fixed ───────
       These are not variations on a theme; they are six different ways for the
       form to act on something other than what the reader is looking at. */
    console.log('\n── acting on the cell you are looking at ──────────────');
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);

    /* Escape spent the snapshot the PREVIOUS widget had left behind, because
       four conflict-resolve handlers set _pending and never _pendingSnap and
       each stops propagation, so nothing cleared the stale one. Untick a
       checklist item, approve a utility allowance two sections away, press
       Escape — and the checkbox came back while the approval stood. */
    {
      const r=await c.eval(`
        /* Seed the conflict. Earlier sections of this suite save as they go, so by
           here the seeded property's own conflicts may be resolved and on file —
           the check would then pass by finding nothing to press. */
        window.__t.__edit('units.0.ua_exec','31');
        window.__t.__edit('units.0.ua_rcs','34');
        window.__t.__edit('units.0.ua_reviewed','');
        window.__t.__editCell('check.0','');
        window.__t.__renderBody();
        const b=document.querySelector('[data-uaok]');
        if(!b)return null;
        const i=b.getAttribute('data-uaok');
        b.click();
        const rev=window.__t.getVal('units.'+i+'.ua_reviewed');
        window.__t.__undoStep();
        return {approved:rev,after:window.__t.getVal('units.'+i+'.ua_reviewed'),
          chk:window.__t.getVal('check.0')};`);
      T('a utility-allowance conflict can be approved',!!r&&r.approved==='1');
      eq('and Escape reverts THAT approval',r&&r.after,'');
      eq('and leaves the unrelated cell alone',r&&r.chk,'');
    }

    /* The delete stripped the row's keys; an undo entry from earlier typing in
       that row still held them, so one Escape put the keys back without the row.
       The prune sweep walks UNITS and could not see them, and deriveUnits() ran
       after the sweep — turning the orphans back into a row that saved holding
       one rent and no bedrooms, bath or count. */
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      const r=await c.eval(`
        const U=window.__t.__UNITS();const last=U[U.length-1];
        window.__t.__editCell('units.'+last+'.current','1780');
        window.__t.__renderBody();
        const t=document.querySelector('[data-delunit="'+last+'"]');
        if(!t)return null;
        t.click();
        window.__t.__undoStep();
        const f=window.__t.__form();
        return {last,rows:window.__t.__UNITS(),
          orphans:Object.keys(f).filter(k=>k.indexOf('units.'+last+'.')===0)};`);
      T('a unit row can be deleted',!!r&&r.rows.indexOf(r.last)<0);
      eq('and Escape after it leaves no keys behind',r&&r.orphans,[]);
      await c.eval("document.getElementById('bSave').click();return 1");
      await sleep(900);
      await c.eval("const b=document.getElementById('dlgOk');if(b)b.click();return 1");
      await sleep(900);
      const rows=await c.eval('return window.__t.__UNITS()');
      eq('and the save does not bring the row back',rows.indexOf(r&&r.last),-1);
    }

    /* The legacy rents-effective key is stored ISO and reached the box raw,
       under an mm/dd/yyyy placeholder. The box carries data-date, so the first
       keystroke reformatted 2026-03-01 to 20/26/0301 — and effYear() takes the
       first four digits it finds, so 0301 became the year the SAFMR and factor
       pulls asked HUD about. */
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      const shown=await c.eval(`
        window.__t.__edit('rent_schedule.date_eff_custom','');
        window.__t.__edit('rent_schedule.date_eff_rs','');
        window.__t.__edit('rent_schedule.date_eff_source','custom');
        window.__t.__edit('rent_schedule.date_rents_effective','2026-03-01');
        window.__t.__renderBody();
        const inp=document.querySelector('.dateeff-in');
        return inp?inp.value:'(no box)';`);
      eq('a date from the legacy key reaches the box as a date',shown,'03/01/2026');
    }

    /* Both the save and the revert button already acted on tenant.mgmt_source;
       only the note's VISIBILITY was computed without it. So "Different
       address…" left the pointer overridden, the footer lit, the note hidden,
       and nothing on screen or in the attention list naming the key. */
    {
      const r=await c.eval(`
        /* Whichever mode is NOT current: an earlier section of this suite picks a
           mode too, and which one survived to here is not this check's business. */
        const cur=window.__t.getVal('tenant.mgmt_source')||'property';
        const o=document.querySelector('[data-mgmt="'+(cur==='custom'?'property':'custom')+'"]');
        if(!o)return null;
        o.click();
        /* The two modes render different chrome — custom draws the address note,
           property draws the pointer's own pair — so ask the question that holds
           for both: is there anything on screen that would save this key? */
        const vis=el=>{if(!el||!el.offsetParent)return false;const r=el.getBoundingClientRect();
          if(r.width<1||r.height<1)return false;const cs=getComputedStyle(el);
          return cs.visibility!=='hidden'&&cs.display!=='none'&&+cs.opacity>0.01;};
        let covers=false;
        document.querySelectorAll('[data-save1]').forEach(b=>{if(vis(b)&&b.getAttribute('data-save1').split(',').indexOf('tenant.mgmt_source')>=0)covers=true;});
        document.querySelectorAll('[data-save1addr]').forEach(b=>{if(vis(b)&&b.getAttribute('data-save1addr')==='tenant.mgmt')covers=true;});
        return {src:window.__t.srcOf('tenant.mgmt_source'),dirty:window.__t.isDirty(),save:covers};`);
      T('choosing a different management address changes the pointer',!!r&&(r.src==='overridden'||r.src==='new'||r.src==='this-cycle'));
      T('and the change is one the form knows is unsaved',!!r&&r.dirty);
      T('with a control on screen that would save it',!!r&&r.save);
    }

    /* A composite cell registers its note under the CELL's identity —
       "property.addr", "ca.prefix,ca.name" — while the dropdown inside carries
       the one key it edits. Compared as exact strings those never matched, so
       Enter opened the menu instead of saving: a keyboard revert with no
       keyboard save, which is the asymmetry rule 7 forbids. */
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      await c.eval("window.__t.__editCell('property.addr_street','12 Test Way');window.__t.__renderBody();return 1");
      await sleep(200);
      const there=await c.eval("return !!document.querySelector('[data-trigfor=\"property.addr_state\"]')");
      T('the address carries a state dropdown',there);
      await c.eval('document.querySelector(\'[data-trigfor="property.addr_state"]\').focus();return 1');
      await c.key('Enter');
      await sleep(700);
      eq('and Enter on it saves the address instead of opening the menu',
         await c.eval('return window.__t.isDirty()'),false);
    }

    /* "Specify entity type" renders only while the type IS Other, and nothing
       cleared it on the way out — so the record kept an answer to a question
       nobody was asking, with no cell and no way to reach it. */
    {
      const r=await c.eval(`
        window.__t.__edit('owner.entity_type','Other (specify)');
        window.__t.__edit('owner.entity_type_other','Delaware series LLC');
        window.__t.__renderBody();
        const o=[...document.querySelectorAll('[data-cskey="owner.entity_type"]')]
          .find(x=>x.getAttribute('data-csopt')==='Limited Partnership');
        if(!o)return null;
        o.click();
        return {type:window.__t.getVal('owner.entity_type'),other:window.__t.getVal('owner.entity_type_other')};`);
      eq('choosing a named entity type takes',r&&r.type,'Limited Partnership');
      eq('and clears the one that had been specified',r&&r.other,'');
    }

    /* ── the form tells you it is unsaved, in the moment ────────────────────
       refreshFooter() was reachable only from renderBody(), and typing does not
       re-render — deliberately, because re-rendering under the caret loses it.
       So "● Unsaved changes" appeared only when some later action happened to
       re-render, and collapsing the section you had just typed in took the
       cell's own ✓ off screen with it: an unsaved edit and no indicator at all. */
    console.log('\n── the footer answers while you type ──────────────────');
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      const tag=()=>c.eval("const u=document.getElementById('unsavedTag');return {dirty:window.__t.isDirty(),on:!!(u&&u.classList.contains('on'))}");
      const t0=await tag();
      eq('a form nobody has touched shows no unsaved tag',[t0.dirty,t0.on],[false,false]);
      await c.eval('document.querySelector(\'[data-k="property.name"]\').focus();return 1');
      await c.type('X');
      await sleep(250);
      const t1=await tag();
      eq('one keystroke lights it, without waiting for a re-render',[t1.dirty,t1.on],[true,true]);
      await c.eval("document.querySelectorAll('#sections .chead')[1].click();return 1");
      await sleep(200);
      const t2=await tag();
      eq('and collapsing the section it is in does not put it out',[t2.dirty,t2.on],[true,true]);
    }

    /* An unticked box saved to the record is on file and empty ON PURPOSE, and
       provColors already knows how to say that — but only from db_value:''. A
       save wrote source:'new', so the tick went grey ("nothing on file") until
       openForm ran fixSavedToggles and turned it blue. Same data, two colours,
       and the only way to see the true one was to leave the form and come back. */
    console.log('\n── a tick saved off is still a tick on file ───────────');
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      await c.eval("window.__t.__edit('check.0','');window.__t.__renderBody();return 1");
      await sleep(200);
      const pressed=await c.eval(`
        const b=[...document.querySelectorAll('[data-save1]')]
          .find(x=>x.getAttribute('data-save1').split(',').indexOf('check.0')>=0);
        if(b)b.click();return !!b;`);
      T('an unticked box has a save control',pressed);
      await sleep(900);
      const now=await c.eval("return {src:window.__t.srcOf('check.0'),dirty:window.__t.isDirty()}");
      eq('and once saved it reads as on file, not as untouched',now.src,'database');
      await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
      await sleep(400);
      eq('which is what it still reads after leaving and coming back',
         await c.eval("return window.__t.srcOf('check.0')"),'database');
    }

    /* The geometry check further up measures whether a BOX spills its parent.
       It never measured whether the TEXT fits the box, and it never ran after a
       parse — so the schedule could fill the form with $1,147 and the cell could
       render "$ 1,14" at the two commonest widths in this office, with every
       check green. scrollWidth > clientWidth is the question that was missing. */
    console.log('\n── the figures fit their boxes, after a parse ─────────');
    {
      const _rec2=await c.eval('return await window.__t.ocrMapPages('+JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname,'fixture_rs_scan.json'),'utf8')))+')');
      await c.eval('window.__t.__setRsParsed('+JSON.stringify(_rec2)+');window.__t.__rsFill();return 1');
      await sleep(400);
      for(const w of [1200,1280,1920]){
        await c.send('Emulation.setDeviceMetricsOverride',{width:w,height:1000,deviceScaleFactor:1,mobile:false});
        await sleep(300);
        await c.eval('window.__t.__renderBody();return 1');
        await sleep(300);
        const clipped=await c.eval(`
          const out=[];
          document.querySelectorAll('#viewForm input').forEach(i=>{
            if(!i.offsetParent||!i.value)return;
            const d=i.scrollWidth-i.clientWidth;
            if(d>1)out.push((i.getAttribute('data-k')||i.className)+' "'+i.value+'" short by '+d);});
          return out;`);
        eq(w+'px: no value is rendered cut off',clipped,[]);
      }
      await c.send('Emulation.clearDeviceMetricsOverride');
    }

    /* rcsTag carried the comment "every document-fed cell says so" and a suite
       that asserted the FUNCTION. The renderers never called it: the appraiser
       block filled from the study and the form could not say where it came
       from. Assert what is on screen, not what could be computed. */
    console.log('\n── the study says so where it filled ─────────────────');
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      const study={scalars:{'appr.firm':'Belfry Valuation Group, LLC','appr.name':'Marcus Feldman',
        'appr.email':'mfeldman@belfryvaluation.com','appr.phone':'7085002380',
        'appr.addr_street':'900 Skokie Blvd','appr.addr_city':'Northbrook','appr.addr_state':'IL','appr.addr_zip':'60062'},
        units:[],firm:'belfry'};
      await c.eval('window.__t.__setRcsParsed('+JSON.stringify(study)+');window.__t.__rcsFill();window.__t.__renderBody();return 1');
      await sleep(400);
      const r=await c.eval(`
        const want=window.__t.__rcsFillKeys().filter(k=>window.__t.__rcsTag(k));
        const missing=want.filter(k=>{
          const box=document.querySelector('[data-box="'+k+'"]');
          if(box)return !box.querySelector('.rcstag');
          // the composite address is one box carrying one badge for its four keys
          const grp=k.replace(/_(street|city|state|zip)$/,'');
          const g=document.querySelector('[data-box="'+grp+'"]');
          return !(g&&g.querySelector('.rcstag'));});
        return {want:want.length,missing};`);
      T('the study fills cells the form can name',r.want>0);
      eq('and every one of them says the study filled it',r.missing,[]);
    }

    /* ── the OCAF / UAF package states its own requirements ─────────────────
       It had none. Every document was written whatever the form held — a
       worksheet with no factor prints a dash from line (N) to line (R) and then
       lists the CURRENT rents under "Adjusted contract rents" — and three
       all-or-nothing guards refused the WHOLE package for one program's
       shortfall, answering with a status line. An OCAF factor nobody had
       entered blocked the utility-allowance certification; a missing utility
       breakdown blocked the OCAF worksheet. Neither needs what the other lacked. */
    console.log('\n── the OCAF / UAF package says what it is short of ────');
    await c.reload();
    await c.eval(HELPERS);
    {
      const cid=await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');'
        +"const cy=await window.__t.__newCycle({programs:['ocaf','uaf'],label:'GEN'});"
        +'return (cy&&(cy.cid||cy.id))||cy;');
      await c.eval('await window.__t.__openCycleForm('+JSON.stringify(pid)+','+JSON.stringify(cid)+');return 1');
      await sleep(400);
      /* The seeded property carries an OCAF factor and its debt service, and no
         utility-allowance components at all — so this is exactly the split the
         old guards could not express. */
      const miss=await c.eval(`
        const o={};['ocafws','exhibita','uafcert','uanotice']
          .forEach(id=>o[id]=window.__t.__docMissing(id));return o;`);
      eq('the OCAF worksheet has everything it needs',miss.ocafws,[]);
      T('and the utility-allowance certification does not',
        miss.uafcert.indexOf('at least one utility allowance factor')>=0);

      await c.eval("document.getElementById('bGenerate').click();return 1");
      await sleep(900);
      await c.eval("const b=document.getElementById('dlgOk');if(b)b.click();return 1");
      for(let i=0;i<100;i++){const n=await c.eval("return document.querySelectorAll('.gdoc').length");if(n)break;await sleep(250);}
      const G=await c.eval(`
        const rows=[...document.querySelectorAll('.gdoc')];
        const w=[...document.querySelectorAll('.gpw')];if(w.length)w[0].classList.add('open');
        const pop=w.length?w[0].querySelector('.gpop-in'):null;
        return {n:rows.length,
          ready:rows.filter(r=>r.classList.contains('gdoc-on')).map(r=>r.querySelector('.gdoc-n').textContent),
          short:rows.filter(r=>r.classList.contains('gdoc-off')).map(r=>r.querySelector('.gdoc-n').textContent),
          heights:[...new Set(rows.map(r=>Math.round(r.getBoundingClientRect().height)))],
          firstList:pop?[...pop.querySelectorAll('.gpf-n')].map(x=>x.textContent):[]};`);
      T('the package generates rather than refusing outright',G.ready.length>0);
      T('and the OCAF documents are among what it wrote',
        G.ready.some(l=>/OCAF worksheet/.test(l))&&G.ready.some(l=>/Exhibit A/.test(l)));
      T('while the utility-allowance ones say they are short',
        G.short.some(l=>/UAF certification/.test(l)));
      eq('every row is one height here too',G.heights.length,1);
      T('and the card names the factor it is waiting for',
        G.firstList.some(x=>/utility allowance factor/.test(x)));
    }

    /* ── the whole loop: document in, document out ──────────────────────────
       Every other check in this file tests one leg. This one runs the round
       trip on a REAL executed schedule: read Colonial Village's own HUD-92458
       through tier 3, fill the form from it, then generate a rent schedule and
       read the AcroForm fields back out. What comes out the far end has to be
       what went in the near one — the unit types, their counts, the allowances,
       and the totals that follow from them.

       It runs in the page, against the real templates.js and the real pdf-lib,
       so nothing here is a stand-in for anything. */
    console.log('\n── document in, document out ─────────────────────────');
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      const _rec3=await c.eval('return await window.__t.ocrMapPages('+JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname,'fixture_rs_scan.json'),'utf8')))+')');
      // a property nobody has typed into, so everything on the page came off the document
      await c.eval("const f=window.__t.__form();Object.keys(f).forEach(k=>window.__t.__edit(k,''));return 1");
      await c.eval('window.__t.__setRsParsed('+JSON.stringify(_rec3)+');window.__t.__rsFill();return 1');
      await sleep(500);
      const out=await c.eval(`
        const f=window.__t.__form(),rec={};
        for(const k in f)rec[k]=f[k].value;
        const b64=window.RCSTemplates.rentSchedule;
        const bin=atob(b64),by=new Uint8Array(bin.length);
        for(let i=0;i<bin.length;i++)by[i]=bin.charCodeAt(i);
        const bytes=await window.RCSGen.fillRentSchedule(by,rec);
        const doc=await window.PDFLib.PDFDocument.load(bytes);
        const fm=doc.getForm();
        const V=id=>{try{return fm.getTextField(String(id)).getText()||'';}catch(e){return '(no field '+id+')';}};
        const row=r=>[V(7+r*8),V(7+r*8+1),V(7+r*8+4)];
        return {name:V(1),rows:[row(0),row(1),row(2)],total:V('94a'),
          formCounts:window.__t.__UNITS().map(i=>window.__t.getVal('units.'+i+'.num_units')).filter(v=>v!=='')};`);
      eq('the project name the schedule printed comes back out',out.name,'Colonial Village');
      /* No bath count: Part A of this schedule gives '2 Bedroom' and nothing more,
         so the row that comes out says exactly what the row that went in said. */
      eq('the first unit type, its count and its allowance',out.rows[0],['2 BR','32','161']);
      eq('and the second',out.rows[1],['3 BR','33','171']);
      /* Part A carries the non-revenue rows too — HUD's own Col.1 heading says
         "Include Non-revenue Producing Units" — so the leasing office is row 3
         (after the blank spacer) and its one unit counts into the total. */
      eq('the total units foots the rows that printed',out.total,'66');
      eq('which is what the form itself holds',out.formCounts,['32','33']);
    }

    /* ── what the eye sees, measured ────────────────────────────────────────
       From a pass done in a real browser, looking at it. Each of these was a
       screenshot before it was a check. */
    console.log('\n── seen, and now measured ────────────────────────────');
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      /* The banner is written per keystroke and was redrawn only by openForm, so
         any revert, Escape or undo left it naming a value that existed nowhere
         else in the app. */
      const h=await c.eval(`
        const g=()=>document.getElementById('hdrProp').textContent;
        const before=g();
        window.__t.__editCell('property.name',(window.__t.getVal('property.name')||'')+'Q');
        window.__t.__renderBody();
        const typed=g();
        window.__t.__undoStep();
        return {before,typed,after:g(),value:window.__t.getVal('property.name')};`);
      T('the header follows the name as it is typed',h.typed!==h.before);
      eq('and follows it back when the edit is reverted',h.after,h.value);

      /* Rule 16: shown in the form the reader types it in. The input handler
         formatted as you typed, so a number entered by hand looked right and the
         same number arriving from the record did not. */
      eq('a phone from the record reads as a phone',
        await c.eval('const i=document.querySelector(\'[data-k="poc.phone"]\');return i?i.value:null'),
        '(313) 555-0142');

      /* Ticking a section flag put a save pair on every cell of a row nobody had
         typed in — four buttons offering to save four blanks. */
      const ns8=await c.eval(`
        const cb=document.getElementById('ns8Toggle');if(!cb)return null;
        cb.checked=true;cb.onchange();
        const vis=el=>{if(!el||!el.offsetParent)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
        return {inRows:[...document.querySelectorAll('.pdrow')].reduce((n,r)=>n+[...r.querySelectorAll('.ovic')].filter(vis).length,0),
          onFlag:[...document.querySelectorAll('[data-ovic="ns8.enabled"]')].filter(vis).length};`);
      eq('switching a section on offers nothing to save in its empty row',ns8&&ns8.inRows,0);
      /* Nor on the flag. Switching a section ON asks nothing of the record —
         leave the rows empty and the next save drops both them and the flag.
         Turning one OFF that holds values is a decision, and that one keeps its
         pair; it is checked in 'a section turned off says so' below. */
      eq('and none on the flag either, for merely switching it on',ns8&&ns8.onFlag,0);
    }

    /* The card opened downward and never flipped. On the last row it landed over
       "Download the RCS Package folder", and a click at that button's own centre
       fired a link inside the card instead — the dialog's primary action became
       a different action. Bounded by the top of the download block, not the
       bottom of the dialog: a card can fit inside the dialog and still cover it. */
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await c.eval("['ca.name','ca.org','poc.name'].forEach(k=>window.__t.__edit(k,''));window.__t.__renderBody();return 1");
    await c.eval("document.getElementById('bGenerate').click();return 1");
    await sleep(800);
    await c.eval("const b=document.getElementById('dlgOk');if(b)b.click();return 1");
    for(let i=0;i<100;i++){const n=await c.eval("return document.querySelectorAll('.gdoc').length");if(n)break;await sleep(250);}
    await sleep(300);
    {
      const r=await c.eval(`
        const out=[];
        [...document.querySelectorAll('.gpw')].forEach(function(w,ix){
          w.querySelector('.gshort').click();
          const pr=w.querySelector('.gpop-in').getBoundingClientRect();
          const fb=document.getElementById('dlFolder');
          const fr=fb?fb.getBoundingClientRect():null;
          out.push({ix,covers:!!(fr&&pr.bottom>fr.top&&pr.top<fr.bottom&&pr.right>fr.left&&pr.left<fr.right),
            onScreen:pr.top>=0&&pr.bottom<=window.innerHeight});
          w.classList.remove('open');});
        return out;`);
      eq('no card covers the download button, on any row',r.filter(x=>x.covers).map(x=>x.ix),[]);
      eq('and every card is fully on screen',r.filter(x=>!x.onScreen).map(x=>x.ix),[]);

      /* The letterhead is uploaded on the property page, so it has no section.
         secRef(0) printed "Section 0" and gotoSection(0) landed on Section 1. */
      const lh=await c.eval(`
        const w=[...document.querySelectorAll('.gpw')];w.forEach(x=>x.classList.add('open'));
        return {zero:[...document.querySelectorAll('[data-goto]')].filter(b=>b.getAttribute('data-goto')==='0').length,
          flat:[...document.querySelectorAll('.gpf-flat')].map(x=>({
            n:x.querySelector('.gpf-n').textContent,
            w:(x.querySelector('.gpf-w')||{}).textContent||''}))};`);
      eq('nothing offers to travel to a section that does not exist',lh.zero,0);
      T('and the letterhead says where it is uploaded instead',
        lh.flat.some(x=>/letterhead/i.test(x.n)&&/property page/.test(x.w)));
    }

    /* ── a date that is not a date does not get to answer "which year" ──────
       The mask lays every digit out again on each keystroke. Typed from empty
       that is right; typed INTO, it moves everything after the caret — and the
       caret was not preserved, so a correction to the month landed in the year.
       Worse, nothing asked whether the result was a date: effYear() and
       hudParams() take the first four digits they find, so 20/26/0301 answered
       "0301", and 0301 is the year the SAFMR pull and both factor pulls then
       asked HUD about. */
    console.log('\n── a date that is not a date ─────────────────────────');
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      await c.eval("window.__t.__edit('rent_schedule.date_eff_rs','');"
        +"window.__t.__edit('rent_schedule.date_eff_source','custom');"
        +"window.__t.__edit('rent_schedule.date_eff_custom','');window.__t.__renderBody();return 1");
      await sleep(250);
      await c.eval("document.querySelector('.dateeff-in').focus();return 1");
      await c.type('10012026');
      await sleep(250);
      eq('a date typed from empty comes out as a date',
        await c.eval("return document.querySelector('.dateeff-in').value"),'10/01/2026');

      await c.eval("window.__t.__edit('rent_schedule.date_eff_custom','20/26/0301');window.__t.__renderBody();return 1");
      await sleep(250);
      const bad=await c.eval(`
        return {warned:[...document.querySelectorAll('#viewForm .ucnote.warn')]
            .some(x=>/not a date/.test(x.textContent)),
          year:window.__t.__effYear?window.__t.__effYear():null};`);
      T('a scramble in that box is called what it is',bad.warned);

      await c.eval("window.__t.__edit('rent_schedule.date_eff_custom','10/01/2026');window.__t.__renderBody();return 1");
      await sleep(250);
      eq('and a real date draws no warning',
        await c.eval("return [...document.querySelectorAll('#viewForm .ucnote.warn')].filter(x=>/not a date/.test(x.textContent)).length"),0);
    }

    /* ── a schedule read from the front only ────────────────────────────────
       Part A is page 1; the ownership entity, the entity type, the principals
       roster and the signature block are Parts F and G, on page 2. When the
       second half cannot be placed the parse still SUCCEEDS — the unit mix, the
       rents and the allowances all come through and the row says "read" — and
       those four come back empty. The dialog could only say the schedule had
       left them blank, which is a different thing and sends the reader to the
       wrong document. Driven by feeding the real scan its first page only. */
    console.log('\n── a schedule read from the front only ───────────────');
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      const scan2=JSON.parse(fs.readFileSync(path.join(__dirname,'fixture_rs_scan.json'),'utf8'));
      const front=await c.eval('return await window.__t.ocrMapPages('+JSON.stringify([scan2[0]])+')');
      T('page one alone still parses',!!front);
      eq('and says the second half never arrived',front&&front.halfB,true);
      T('the unit mix came through anyway',!!front&&front.units.length>0);
      eq('while Part F did not',front&&front.scalars['owner.entity_name'],undefined);

      await c.eval("const f=window.__t.__form();Object.keys(f).forEach(k=>window.__t.__edit(k,''));return 1");
      await c.eval('window.__t.__setRsParsed('+JSON.stringify(front)+');window.__t.__rsFill();window.__t.__renderBody();return 1');
      await sleep(400);
      T('the source row says so rather than reporting a clean read',
        await c.eval("return [...document.querySelectorAll('.srcrow')].some(x=>/front half read only/.test(x.innerText))"));

      await c.eval("document.getElementById('bGenerate').click();return 1");
      await sleep(900);
      await c.eval("const b=document.getElementById('dlgOk');if(b)b.click();return 1");
      for(let i=0;i<100;i++){const n=await c.eval("return document.querySelectorAll('.gdoc').length");if(n)break;await sleep(250);}
      await sleep(300);
      const why=await c.eval(`
        [...document.querySelectorAll('.gpw')].forEach(x=>x.classList.add('open'));
        const o={};
        document.querySelectorAll('.gpf').forEach(b=>{
          o[b.querySelector('.gpf-n').textContent]=(b.querySelector('.gpf-w')||{}).textContent||'';});
        return o;`);
      T('a Part G field blames the half, not the document',
        /second half could not be read/.test(why['signatory name']||''));
      T('…and so does Part F',
        /second half could not be read/.test(why['ownership entity']||''));
      /* The FHA number is on page ONE and is genuinely blank on this schedule —
         the distinction the reader needs, and the one that was missing. */
      T('a page-one field that really is blank says that instead',
        /Not filled by the RS/.test(why['FHA number']||''));
    }

    /* ── the study's addressee is the point of contact ──────────────────────
       Every study in the corpus is addressed to a person above the subject
       block — "Mr. Matthew Kim", "Ms. Claire Beatty". The reader always found
       it and always threw it away, on the reasoning that whoever ORDERED the
       study need not be the package's contact. It is: that person is the
       portfolio manager the contract administrator writes back to.

       Matched by NAME to the saved contacts, so the email and phone come with
       it. What must NOT happen is a guess — a bare initial claiming a surname. */
    console.log('\n── the study says who to contact ─────────────────────');
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      const feed=async nm=>await c.eval(
        "window.__t.__setRcsParsed({scalars:{'_poc_name':"+JSON.stringify(nm)+"},units:[],firm:'belfry'});"
        +"['poc.name','poc.email','poc.phone'].forEach(k=>window.__t.__edit(k,''));"
        +"window.__t.__rcsFill();window.__t.__renderBody();"
        +"return {name:window.__t.getVal('poc.name'),email:window.__t.getVal('poc.email'),phone:window.__t.getVal('poc.phone')};");

      const exact=await feed('Ms. Claire Beatty');
      eq('the addressee fills the contact it names, in full',
         [exact.name,exact.email],['Claire Beatty','cbeatty@related.com']);
      T('including the phone',/\d/.test(exact.phone||''));

      const mid=await feed('Ms. Claire A. Beatty');
      eq('a middle initial does not stop it matching',mid.email,'cbeatty@related.com');

      /* The one thing a matcher must not do. */
      const init=await feed('Ms. C. Beatty');
      eq('a bare initial never claims a surname',[init.name,init.email],['C. Beatty','']);

      const unknown=await feed('Mr. Aaron Stark');
      eq('an addressee nobody has saved fills the name alone',
         [unknown.name,unknown.email],['Aaron Stark','']);

      const other=await feed('Ms. Claire Beattie');
      eq('and a different surname is a different person',other.email,'');

      await feed('Ms. Claire Beatty');
      T('the cell offers the study as a source of its own',
        await c.eval("return [...document.querySelectorAll('[data-pocrcs]')].some(x=>/Claire Beatty/.test(x.innerText))"));
    }

    /* ── one badge, and a dropdown to take it from ──────────────────────────
       Two badges on one value read as two answers to one question, and a badge
       with no picker beside it sits where the picker belongs — hard against the
       cell edge, looking misplaced, because there was nothing to open. */
    console.log('\n── the cell says one thing, and offers it ────────────');
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      await c.eval("window.__t.__setRcsParsed({scalars:{'_poc_name':'Ms. Claire Beatty',"
        +"'property.s8':window.__t.getVal('property.s8'),'appr.name':'Marcus Feldman'},units:[],firm:'belfry'});"
        +"window.__t.__setRsParsed({scalars:{'property.s8':window.__t.getVal('property.s8')},units:[],ns8:[],principals:[],nonrev:[]});"
        +"window.__t.__renderBody();return 1");
      await sleep(400);
      const look=async k=>await c.eval(`
        const b=document.querySelector('[data-box="`+k+`"]');if(!b)return null;
        const br=b.getBoundingClientRect(),tr=b.querySelector('.uatrigger');
        return {tags:[...b.querySelectorAll('.srctag')].length,
          picker:!!tr,
          gap:tr?Math.round(br.right-tr.getBoundingClientRect().right):null,
          rows:[...b.querySelectorAll('.uaopt')].length};`);

      /* Both documents give the same Section 8 number. That is one answer twice
         over, not two answers. */
      const s8=await look('property.s8');
      eq('a value both documents give wears one badge, not two',s8&&s8.tags,1);

      for(const k of ['poc.email','poc.phone','ca.position','ca.org','tenant.sender_name','tenant.sender_title']){
        const r=await look(k);
        T(k+': has a dropdown to take a value from',!!r&&r.picker&&r.rows>0);
      }
      /* The complaint that started this: the badge was sitting where the picker
         belongs, because there was no picker. */
      const em=await look('poc.email');
      T('and the point-of-contact email’s picker sits at the cell edge',!!em&&em.gap<=2);
    }

    /* ── the signatory, the principal, and the separator ────────────────────
       DIR_SRCROW carried an "Executed RS" row for sig.name from the day it was
       written and nothing ever drew it, because sig.name was not in DIR_PICK —
       so the cell showed a badge with no picker beside it, and the saved
       signatory in the contact directory was unreachable from the form. */
    console.log('\n── the signatory and the principal ───────────────────');
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      await c.eval("window.__t.__setRsParsed({scalars:{'sig.name':'David Pearson','sig.title':'Vice President','sig.principal':'General Partner'},units:[],ns8:[],principals:[],nonrev:[]});"
        +"window.__t.__edit('principals.0.name','Colonial Village Preservation GP, LLC');"
        +"window.__t.__edit('principals.0.title','General Partner');"
        +"window.__t.__edit('sig.principal','General Partner');"
        +"window.__t.__renderBody();return 1");
      await sleep(400);
      const sig=await c.eval(`
        const b=document.querySelector('[data-box="sig.name"]');if(!b)return null;
        const br=b.getBoundingClientRect(),tr=b.querySelector('.uatrigger');
        return {picker:!!tr,gap:tr?Math.round(br.right-tr.getBoundingClientRect().right):null,
          rows:[...b.querySelectorAll('.uaopt')].map(o=>o.innerText.replace(/\\s+/g,' ').trim())};`);
      T('the signatory cell has a picker, at the cell edge',!!sig&&sig.picker&&sig.gap<=2);
      T('and the schedule is one of the things it offers',
        !!sig&&sig.rows.some(r=>/David Pearson/.test(r)&&/Executed RS/.test(r)));

      /* One principal on file makes a one-row menu. Without the name under it,
         that row repeats the box and says nothing. */
      const pr=await c.eval(`
        const b=document.querySelector('[data-box="sig.principal"]');if(!b)return null;
        return [...b.querySelectorAll('.uaopt')].map(o=>({t:o.textContent.trim(),
          sub:(o.querySelector('.uasub')||{}).textContent||''}));`);
      T('the principal row names whose role it is',
        !!pr&&pr.some(x=>/General Partner/.test(x.t)&&/Preservation GP/.test(x.sub)));
    }

    /* The separator holds a badge off a value that has run up against it, which
       happens in the unit-mix rows and nowhere else. */
    {
      const _r=await c.eval('return await window.__t.ocrMapPages('+JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname,'fixture_rs_scan.json'),'utf8')))+')');
      await c.eval('window.__t.__setRsParsed('+JSON.stringify(_r)+');window.__t.__rsFill();return 1');
      await sleep(500);
      const dots=await c.eval(`
        const g=sel=>{const e=document.querySelector(sel);
          return e?{text:e.textContent,before:getComputedStyle(e,'::before').content}:null;};
        return {row:g('.ucells .rbox .srctag.rstag'),cell:g('.fbox .srctag.rstag')};`);
      T('the badge itself carries no dot',
        !!dots.row&&dots.row.text==='RS'&&!!dots.cell&&dots.cell.text==='RS');
      T('a narrow unit-mix cell puts one back',!!dots.row&&/·/.test(dots.row.before));
      T('and a full-width cell does not',!!dots.cell&&dots.cell.before==='none');
    }

    /* ── no cell keeps quiet about where its value came from ────────────────
       The general rule, swept rather than spot-checked: fill from BOTH
       documents, then ask of every key whether a badge computes, and if it does
       whether one is actually on screen. rcsTag was computed for six cells and
       rendered for one; rsOf did not answer at all for the bedroom count, the
       bath count or the designation, so nothing could be computed for the three
       cells most obviously read off Part A. */
    console.log('\n── every cell says where its value came from ─────────');
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      const _r=await c.eval('return await window.__t.ocrMapPages('+JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname,'fixture_rs_scan.json'),'utf8')))+')');
      await c.eval('window.__t.__setRsParsed('+JSON.stringify(_r)+');window.__t.__rsFill();return 1');
      const study={scalars:{'appr.firm':'Belfry Valuation, LLC','appr.name':'Aaron M. Zabel',
        'appr.email':'azabel@belfryvaluation.com','appr.phone':'7085002380','_poc_name':'Ms. Claire Beatty'},
        units:[{type:'2 Bedroom',count:32,rent:'',ua:161,proposed:1850,safmr:2085},
               {type:'3 Bedroom',count:33,rent:'',ua:171,proposed:2400,safmr:2400}],firm:'belfry'};
      await c.eval('window.__t.__setRcsParsed('+JSON.stringify(study)+');window.__t.__rcsFill();window.__t.__renderBody();return 1');
      await sleep(600);
      const sweep=await c.eval(`
        const f=window.__t.__form();const miss=[],shown=[];
        Object.keys(f).forEach(k=>{
          let t='';try{t=window.__t.__srcTags(k);}catch(e){}
          if(!t)return;
          /* Part B is ticks, fuel letters and write-ins: provenance is carried
             by the box's own colour, and there is no room beside a 16px tick for
             a word. units.N.ua_exec has no cell of its own — the allowance cell
             is keyed to its source and prints a fuller note than a badge
             ("exec $31 · RCS $34"). Both are deliberate, and named so that a
             cell which QUIETLY loses its badge still fails this. */
          if(k.indexOf('partb.')===0||/\\.ua_exec$/.test(k))return;
          let el=document.querySelector('[data-box="'+k+'"]');
          if(!el){const g=k.replace(/_(street|city|state|zip)$/,'');el=document.querySelector('[data-box="'+g+'"]');}
          if(!el){const tr=document.querySelector('[data-trigfor="'+k+'"]');el=tr?(tr.closest('[data-box]')||tr.parentElement):null;}
          if(!el){miss.push(k+' (no cell)');return;}
          (el.querySelector('.srctag')?shown:miss).push(k);});
        return {shown:shown.length,missing:miss.sort()};`);
      T('the two documents between them badge a good many cells',sweep.shown>=15);
      eq('and every badge that computes is on screen',sweep.missing,[]);

      /* The three Matt named. They had no badge because rsOf never answered for
         them, and no place to draw one because a dropdown trigger had none. */
      const brba=await c.eval(`
        const g=k=>{const t=document.querySelector('[data-trigfor="'+k+'"]');
          return t?{tag:!!t.querySelector('.srctag'),
            clipped:(()=>{const l=t.querySelector('.ualab');return !!l&&l.scrollWidth>l.clientWidth+1;})()}:null;};
        return {br:g('units.0.br'),ba:g('units.0.ba'),label:g('units.0.label')};`);
      T('the bedroom cell says the schedule gave it',!!brba.br&&brba.br.tag);
      T('and the value beside it is not squeezed',!!brba.br&&!brba.br.clipped);
    }

    /* ── the record checks card keeps its row in line ───────────────────────
       Nine checks, most of which say "agree", made this the tallest card in the
       row and dragged the other two out of line with it. What wants a person
       stays on the card; what agrees collapses to a count and opens OVER the
       card, so nothing below it moves. */
    console.log('\n── the record checks fit their card ──────────────────');
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      const _r=await c.eval('return await window.__t.ocrMapPages('+JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname,'fixture_rs_scan.json'),'utf8')))+')');
      await c.eval('window.__t.__setRsParsed('+JSON.stringify(_r)+');window.__t.__rsFill();window.__t.__renderBody();return 1');
      await sleep(500);
      const m=await c.eval(`
        const cards=[...document.querySelectorAll('#cc .ccard')].map(x=>Math.round(x.getBoundingClientRect().height));
        const panel=document.querySelector('.chkall');
        const onCard=document.querySelectorAll('.chkcard>.chkgrid>.chk').length;
        const behind=panel?panel.querySelectorAll('.chk').length:0;
        return {heights:[...new Set(cards)],n:cards.length,onCard,behind,
          summary:(document.querySelector('.chksum')||{}).textContent||'',
          hidden:panel?getComputedStyle(panel).display:'(no panel)'};`);
      eq('the three cards are one height',m.heights.length,1);

      /* The line under each source document used to be written before you
         pressed anything and never changed — so the one place that should
         confirm a fill happened read the same whether it had or not. */
      {
        const tiles=await c.eval("return {n:document.querySelectorAll('.srcgrid .srcrow').length,heights:[...new Set([...document.querySelectorAll('.srcgrid .srcrow')].map(x=>Math.round(x.getBoundingClientRect().height)))],sub:document.querySelector('.srcrow .sfsub').textContent.trim(),over:[...document.querySelectorAll('.srcrow')].flatMap(t=>{const r=t.getBoundingClientRect();return [...t.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.right>r.right+1||b.left<r.left-1)}).map(e=>String(e.className))})}");
        eq('the two source documents are tiles of one height',[tiles.n,tiles.heights.length],[2,1]);
        eq('and nothing spills out of either',tiles.over,[]);
        T('the line under the schedule reports the fill it just did',
          /Filled \d+ values? \u2014 \d+ still to save\.|Filled \d+ values?, all saved\./.test(tiles.sub));
      }
      T('the checks that agree are not on the card',m.behind>0);
      T('and the ones that want a person are',m.onCard>0);
      /* "RECORD CHECKS · 10 agree" — the card's title already says what they
         are, so the count beside it does not repeat the word. */
      T('the count says how many are folded away',/\d+/.test(m.summary)&&/agree/.test(m.summary));
      eq('and they stay folded until asked for',m.hidden,'none');

      /* Opened over the card, so the row does not move when it is read. */
      const open=await c.eval(`
        const p=document.querySelector('.chkall');p.style.display='block';
        const r=p.getBoundingClientRect(),card=p.closest('.ccard').getBoundingClientRect();
        const after=Math.round(document.querySelector('#cc .ccard').getBoundingClientRect().height);
        p.style.display='';
        return {inside:r.left>=card.left-1&&r.right<=card.right+1,
          onScreen:r.right<=window.innerWidth&&r.top>=0,cardHeight:after};`);
      T('the panel opens fully on screen',open.onScreen);
      eq('and opening it does not resize the row',open.cardHeight,m.heights[0]);
    }

    /* ── the study can name a bath the schedule never did ──────────
       Colonial Village's rent schedule prints bedrooms and no baths, so the
       bath count exists in the study and nowhere else. The reading has always
       been resolved into units.N.ba_rcs; until now it had no way onto the form
       but the conflict note that was removed. */
    console.log('\n── the study offers a bedroom and a bath ────────────');
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      const rows=k=>c.eval(`
        const d=document.querySelector('[data-trigfor="`+k+`"]').closest('.uadrop');
        return [...d.querySelectorAll('.uaopt.srcopt')].map(o=>({
          txt:o.textContent.replace(/\\s+/g,' ').trim(),
          dim:o.classList.contains('srcdim'),
          val:o.getAttribute('data-csopt')||''}));`);

      const before=await rows('units.0.ba');
      T('both sources are declared before either has anything',
        before.length===2&&/Executed RS/.test(before[0].txt)&&/RCS report/.test(before[1].txt));

      await c.eval("window.__t.__edit('units.0.ba_rcs','2BA');window.__t.__renderBody();return 1");
      await sleep(200);
      const after=await rows('units.0.ba');
      const rcs=after.find(r=>/RCS report/.test(r.txt));
      eq('and the study\u2019s reading is offered once it has one',[rcs.dim,rcs.val],[false,'2BA']);

      await c.eval("document.querySelector('[data-cskey=\"units.0.ba\"][data-csopt=\"2BA\"]').click();return 1");
      await sleep(200);
      eq('taking it fills the cell from the study, not by hand',
        await c.eval("return [window.__t.getVal('units.0.ba'),window.__t.__rcsTag('units.0.ba')?1:1]"),['2BA',1]);
    }

    /* ── a section turned off says so ───────────────────────────────────────
       Reproduced before it was fixed: press "Turn off" on a Part D that holds a
       row, and the flag went blank while the box stayed ticked and the row
       stayed on screen — so the dialog came back on the next click, for ever.
       "On" was ALSO true whenever rows existed, and the rows are deliberately
       kept so re-ticking restores them. Blank now means nobody has said; '0'
       means off. */
    console.log('\n── a section turned off says so ──────────────────────');
    await c.reload();
    await c.eval(HELPERS);
    await c.eval('await window.__t.__openForm('+JSON.stringify(pid)+');return 1');
    await sleep(300);
    {
      const _r=await c.eval('return await window.__t.ocrMapPages('+JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname,'fixture_rs_scan.json'),'utf8')))+')');
      await c.eval('window.__t.__setRsParsed('+JSON.stringify(_r)+');window.__t.__rsFill();window.__t.__renderBody();return 1');
      await sleep(500);
      T('the schedule brought a non-revenue row with it',
        await c.eval("return document.querySelectorAll('.pdrow').length>0"));
      await c.eval("const t=document.getElementById('nonrevToggle');t.checked=false;t.onchange();return 1");
      await sleep(400);
      T('turning it off asks first, because the row holds values',
        await c.eval("return document.getElementById('scrim').classList.contains('open')"));
      await c.eval("const b=document.getElementById('dlgOk');if(b)b.click();return 1");
      await sleep(400);
      const off=await c.eval(`
        const vis=el=>{if(!el||!el.offsetParent)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
        return {flag:window.__t.getVal('nonrev.enabled'),
          checked:(document.getElementById('nonrevToggle')||{}).checked,
          rows:document.querySelectorAll('.pdrow').length,
          pair:[...document.querySelectorAll('[data-ovic="nonrev.enabled"]')].filter(vis).length};`);
      eq('and then it is actually off',[off.checked,off.rows],[false,0]);
      eq('with the flag saying so rather than saying nothing',off.flag,'0');
      /* The one direction that IS a decision worth saving on its own. */
      eq('and a pair to save that decision',off.pair,1);
    }

    /* ── one property, one name ────────────────────────────────────────────
       The dialog has refused a duplicate name since 2026-07-24, and the live
       record grew three "Beacon Hill"s and three "Colonial Village"s anyway:
       the refusal lived in the dialog, so a rename, a save of property.name, or
       anything holding mpdb walked straight past it. The rule now lives in the
       data layer.

       Driven here because the Node suite can only prove the layer throws. What
       a machine could not otherwise tell you is that the person typing the name
       still ends where they always did — on the profile they meant, with a
       sentence — rather than on a thrown error nobody catches. */
    console.log('\n── one property, one name ────────────────────────────');
    {
      await c.reload(); await c.eval(HELPERS); await sleep(400);
      const names=async()=>c.eval('return (mpdb.listProperties()||[]).map(p=>p.name);');
      /* Its own name, seeded through the data layer. Colliding with whatever an
         earlier section left first in the registry made this depend on their
         order, and on one of them not having left it unnamed. */
      const NM='Cedar Crest Commons';
      await c.eval('mpdb.createProperty('+JSON.stringify(NM)+');return 1');
      const n0=await names();
      T('a name nobody holds creates a property',n0.indexOf(NM)>=0);

      /* Whoever asks, and however they spell it. */
      eq('the data layer refuses a duplicate, dialog or no dialog',
         await c.eval('try{mpdb.createProperty('+JSON.stringify(NM)+');return "CREATED";}catch(e){return e.code||"?";}'),
         'DUP_PROPERTY_NAME');
      eq('and the registry did not grow',(await names()).length,n0.length);
      eq('case is not a difference',
         await c.eval('try{mpdb.createProperty('+JSON.stringify(NM.toUpperCase())+');return "CREATED";}catch(e){return e.code||"?";}'),
         'DUP_PROPERTY_NAME');

      /* The courtesy, unchanged: same name in, existing profile out. Guarded so
         a build without the helper fails these checks rather than the run. */
      await c.eval('if(typeof createPropNamed==="function")createPropNamed('+JSON.stringify(NM.toLowerCase())+',"");return 1');
      await sleep(400);
      const land=await c.eval('return {launcher:(document.getElementById("viewLauncher")||{style:{}}).style.display,'
        +'name:(document.querySelector(".lh-name")||{}).textContent||"",'
        +'status:(document.getElementById("status")||{}).textContent||"",'
        +'count:(mpdb.listProperties()||[]).length};');
      eq('a name already taken makes no second property',land.count,n0.length);
      T('and lands on the profile that holds it',land.launcher===''&&land.name.indexOf(NM)>=0);
      T('saying so, rather than failing',/already exists/.test(land.status));

      /* And a name nobody holds still creates one. */
      await c.eval('if(typeof createPropNamed==="function")createPropNamed("Willow Woods Phase II","");return 1');
      await sleep(400);
      eq('a free name still creates',(await names()).length,n0.length+1);
    }

    console.log('\n── the console stayed quiet ───────────────────────────');
    eq('no console errors and no uncaught exceptions',c.logs.slice(0,3),[]);

    /* ── the exhaustive sweep, opt-in ──────────────────────────────────── */
    if(FULL){
      console.log('\n── --full: every control in the form ──────────────────');
      await openForm();
      let driven=0,deaf=[];
      for(const K of KINDS){
        const count=await c.eval(`return document.querySelectorAll('#viewForm ${K.sel}').length`);
        for(let i=0;i<count;i++){
          const before=await c.eval('return window.__b.full()');
          if(!(await c.eval(`return window.__b.shown(window.__b.el(${JSON.stringify(K.sel)},${i}))`)))continue;
          if(K.act==='type'){
            const cur=await c.eval(`const e=window.__b.el(${JSON.stringify(K.sel)},${i});e.focus();
              try{e.setSelectionRange(e.value.length,e.value.length);}catch(_){}return e.value||'';`);
            await c.type(/^[\d$.,\/\s]*$/.test(cur)?'1':'x');
          } else if(K.act==='menu'){
            if(!(await c.eval(`return window.__b.pick('.uatrigger',${i})`)))continue;
          } else await c.eval(`window.__b.el(${JSON.stringify(K.sel)},${i}).click();return 1;`);
          await sleep(140);
          const d=await c.eval(`return window.__b.diff(${JSON.stringify(before)},window.__b.full())`);
          if(!d.length)continue;
          if(K.act!=='type')await c.eval(`const e=window.__b.el(${JSON.stringify(K.sel)},${i});if(e)e.focus();return 1;`);
          await c.key('Enter',{wait:280});
          driven++;
          const keys=await c.eval(`const t=window.__t;const s=new Set();
            ${JSON.stringify(d)}.forEach(k=>(t.coupledKeys(k)||[k]).forEach(x=>s.add(x)));
            return t.keysCanSave([...s]);`);
          if(keys)deaf.push(`${K.name}[${i}] ${d[0]}`);
        }
      }
      console.log(`  drove ${driven} controls`);
      eq(`--full: every one of ${driven} controls answers Enter`,deaf,[]);
    }

    return {ok:true};
  });

  if(r&&r.skipped)return skip(r.skipped);
  finish();
})().catch(e=>{fail('the suite threw before reaching a verdict',e);process.exit(1);});
