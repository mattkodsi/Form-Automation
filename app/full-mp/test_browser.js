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
const MIN_CHECKS=53;
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
const BUNDLE=path.join(os.tmpdir(),'rcs_browser_bundle.html');
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
  const proc=cp.spawn(bin,['--headless=new','--remote-debugging-port='+dp,'--user-data-dir='+ud,
    '--no-first-run','--no-default-browser-check','--disable-gpu','--window-size='+width+','+height,'about:blank'],
    {stdio:['ignore','ignore','pipe']});
  let buf='';proc.stderr.on('data',d=>{buf+=d;});
  const getj=p=>new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:dp,path:p},r=>{
    let b='';r.on('data',d=>b+=d);r.on('end',()=>{try{res(JSON.parse(b));}catch(e){rej(e);}});}).on('error',rej);});
  let list=null;
  for(let i=0;i<120;i++){try{list=await getj('/json/list');if(list.some(t=>t.type==='page'))break;}catch(e){}await sleep(150);}
  if(!list){proc.kill();srv.close();throw new Error('devtools never answered\n'+buf);}
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
  finally{try{ws.close();}catch(e){}proc.kill();srv.close();}
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

    /* ─────────────────────────────────────────────────────────────────────
       5. The conflict buttons — AUDIT-BACKLOG §E, "verified only in source,
       never reached in a browser", because the seeded record has no conflict.
       Synthesise one. Rule 14: the flag must not outlive the condition. */
    console.log('\n── the conflict buttons, reached at last ──────────────');
    for(const C of [
      {name:'unit type', btn:'[data-typ]', seed:`window.__t.__edit('units.0.br_rcs','3BR');window.__t.__edit('units.0.ba_rcs','2BA');`, flag:'units.0.type_reviewed'},
      {name:'unit count',btn:'[data-num]', seed:`window.__t.__edit('units.0.num_rcs','77');`, flag:'units.0.num_reviewed'},
    ]){
      await openForm();
      await c.eval(`${C.seed}window.__t.__renderBody();return 1;`);
      await sleep(280);
      const btns=await c.eval(`return [...document.querySelectorAll('#viewForm ${C.btn}')].map(b=>b.textContent.trim())`);
      eq(`${C.name}: the conflict renders both ways out`,btns.length,2);
      await c.eval(`const b=[...document.querySelectorAll('#viewForm ${C.btn}')].find(x=>x.getAttribute('${C.btn.slice(1,-1)}')==='rcs')
        ||document.querySelector('#viewForm ${C.btn}');b.click();return 1;`);
      await sleep(250);
      eq(`${C.name}: resolving it clears the conflict`,
         await c.eval(`return document.querySelectorAll('#viewForm ${C.btn}').length`),0);
      eq(`${C.name}: and the flag does not outlive it`,
         await c.eval(`return window.__t.getVal('${C.flag}')||''`),'');
    }

    /* ─────────────────────────────────────────────────────────────────────
       6. The unit-type cell's sub-cells. A sub-value marks itself; the cell's
       own bar answers for the whole cell. */
    console.log('\n── the unit type cell ─────────────────────────────────');
    await openForm();
    await c.eval(`const t=window.__t;
      t.__edit('units.0.br','1BR');t.__edit('units.0.ba','1BA');t.__edit('units.0.desig','E');
      await t.__saveCell('units.0.br');await t.__saveCell('units.0.ba');await t.__saveCell('units.0.desig');
      t.__renderBody();return 1;`);
    await sleep(320);
    const barOf=async k=>c.eval(`const e=document.querySelector('#viewForm [data-trigfor="${k}"]');
      if(!e)return 'missing';return /linear-gradient/.test(getComputedStyle(e).backgroundImage)?'bar':'none';`);
    eq('settled: bedroom carries no bar',await barOf('units.0.br'),'none');
    eq('settled: designation carries no bar',await barOf('units.0.desig'),'none');
    await c.eval(`window.__t.__edit('units.0.desig','F');window.__t.__renderBody();return 1;`);
    await sleep(280);
    eq('changed: the designation marks itself',await barOf('units.0.desig'),'bar');
    eq('changed: bedroom still does not',await barOf('units.0.br'),'none');

    const dividers=await c.eval(`
      const px=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);
        return [+r.width.toFixed(2),+r.height.toFixed(2),s.backgroundColor];};
      const u=[...document.querySelectorAll('#viewForm .rbox.brba .utdiv')].map(px);
      const a=[...document.querySelectorAll('#viewForm .fbox.addr .adiv')].map(px);
      return {u,a};`);
    eq('the unit cell draws two dividers',dividers.u.length,2);
    eq('both identical to each other',dividers.u[0],dividers.u[1]);
    eq('and to the rule the address uses',dividers.u[0],dividers.a[0]);

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
       10. Nothing threw along the way. */
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
