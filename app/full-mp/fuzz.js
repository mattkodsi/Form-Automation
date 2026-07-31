/* fuzz.js — the randomized interaction storm.

   The deterministic sweeps (test_browser.js, --full) drive one of every kind of
   control in a FIXED order. This file drives them in a RANDOM order, seeded, so
   different permutations and interleavings — edit, escape, enter, save, revert,
   clear, dropdown, checkbox, re-render, boundary — run on every invocation. The
   classes it hunts are the ones this project has actually shipped: phantom-dirty
   side-effect keys, false "unsaved changes", saves that drop a coupled key,
   provenance painted a colour no state can mean, and escapes that revert the
   wrong cell. A different seed every run is the point: the storm that finds
   nothing today can find something tomorrow, and every run's seed is recorded so
   a failure replays.

   It runs anywhere the app runs, because the bundle is plain concatenated
   scripts: `form`, `FORMSNAP`, `isDirty()`, `_undoChain`, `_pending` are page
   globals in the LIVE signed-in app exactly as under ?selftest=1. Nothing here
   touches window.__t except the optional boundary episode, which callers enable
   only where the doors exist.

   THE ORACLES NEVER TRUST THE APP'S OWN VERDICT. dirtyTruth() recomputes the
   form-vs-snapshot diff key by key in the page; isDirty() and the footer tag are
   then held to agreeing with it. An isDirty() that lies is a defect this file
   must catch (test_fuzz.js plants exactly that), so it cannot also be the judge.

   Episode types, each ending at a REST STATE with an oracle:
     escape   — random mutating actions, then Escape until _undoChain and
                _pending are spent; the form must then equal the pre-episode
                snapshot exactly, key by key.
     save     — random actions sprinkled with Enter commits, then the footer's
                "Update property profile"; dirtyTruth must come back empty, the
                footer tag off, no error dialog. The new record becomes baseline.
     revertAll— the footer's "Revert to saved"; dirtyTruth must be empty after.
     boundary — (doors only) save, leave the form, reopen it: dirtyTruth must be
                empty on arrival — a form that opens dirty is the phantom-dirty
                class — and a sample of saved values must have survived.

   After every episode: the colour scan. Every visible [data-box] paints a
   background from the CLR palette or a colour already present at storm start
   (the baseline self-calibrates because sections differ in chrome). A colour
   never seen before is a violation: it is how "a third colour nobody chose"
   (FORM-RULES §11, M62) looks to a machine.

   Exports: mulberry32, storm(c, opts), withBundle (boot a PREBUILT bundle —
   test_fuzz.js serves its deliberately broken builds through this).

   CLI:  node app/full-mp/fuzz.js [--seed N] [--episodes N] [--edits N] [--quiet]
         Boots the selftest app, fills from the bundled fixture the way
         test_browser.js does, storms, and exits 1 on any violation. */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),net=require('net'),cp=require('child_process');
const {sleep,findChrome,CDP,withApp}=require('./cdplib.js');

/* The CLR palette, read from app.js at require time so the oracle and the app
   cannot drift apart. If the shape ever changes this throws loudly — a colour
   oracle running against a guessed palette would report fiction. */
function palette(){
  const src=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
  const m=src.match(/const CLR=\{([^}]+)\}/);
  if(!m)throw new Error('fuzz.js: could not find const CLR={…} in app.js — the colour oracle has no palette');
  const hex=[...m[1].matchAll(/'#([0-9a-f]{6})'/gi)].map(x=>x[1]);
  if(hex.length<6)throw new Error('fuzz.js: CLR parse found only '+hex.length+' colours');
  return hex.map(h=>'rgb('+parseInt(h.slice(0,2),16)+', '+parseInt(h.slice(2,4),16)+', '+parseInt(h.slice(4,6),16)+')');
}

function mulberry32(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/* Values a real user (or a real paste) puts in a cell. The point is breadth of
   SHAPE, not length: money with and without its sign, dates in two conventions,
   whitespace, negatives, a non-numeric string where a number goes. */
const VALUES=['','0','1','7','42','129','1234','2050','2,050','$1,234','1850','3/1/2026','2026-03-01','abc','N/A','-5','999999','1.5','  '];

const J=v=>JSON.stringify(v);

/* ── the storm ──────────────────────────────────────────────────────────── */
async function storm(c,opts={}){
  const seed=(opts.seed==null?1:opts.seed)>>>0;
  const rng=mulberry32(seed);
  const episodes=opts.episodes||8;
  const maxEdits=opts.maxEdits||5;
  const quiet=!!opts.quiet;
  const doors=!!opts.doors;               // window.__t available (selftest)
  const log=opts.log||(quiet?()=>{}:m=>console.log(m));
  const realKeys=typeof c.key==='function';
  const actions=[],violations=[];
  const counts={edits:0,escapes:0,enters:0,saves:0,revertAlls:0,drops:0,clicks:0,boundaries:0,colourScans:0,episodes:0};
  const act=a=>{actions.push(a);};
  const vio=(kind,msg,evidence)=>{violations.push({kind,msg,seed,evidence:evidence||null,after:actions.slice(-14)});log('  ✗ ['+kind+'] '+msg);};

  /* truth helpers + error trap, installed once, mode-independent */
  await c.eval(`
    if(!window.__fz){
      window.__fz={errs:[]};
      window.addEventListener('error',e=>window.__fz.errs.push('page error: '+(e.message||e.type)));
      window.addEventListener('unhandledrejection',e=>window.__fz.errs.push('unhandledrejection: '+String((e.reason&&e.reason.message)||e.reason).slice(0,200)));
      window.__fz.snap=function(){const o={};for(const k of Object.keys(form)){const v=form[k]&&form[k].value;o[k]=(v==null?'':String(v));}return o;};
      window.__fz.dirtyTruth=function(){if(!FORMSNAP)return[];const ks=new Set(Object.keys(form).concat(Object.keys(FORMSNAP)));const out=[];for(const k of ks){const fv=form[k]?(form[k].value==null?'':String(form[k].value)):'';const sv=FORMSNAP[k]?(FORMSNAP[k].value==null?'':String(FORMSNAP[k].value)):'';if(fv!==sv)out.push(k);}return out;};
      window.__fz.rest=function(){return (typeof _undoChain==='undefined'?0:_undoChain.length)+((typeof _pending!=='undefined'&&_pending&&_pending.length)?1:0);};
    } return 1;`);

  const snap=()=>c.eval('return window.__fz.snap();');
  /* A VIOLATION MUST BE DIAGNOSABLE WITHOUT A RE-RUN. Naming a key says a cell
     is wrong; it does not say HOW. Seed 42's first save-left-dirt reproduced
     reliably inside the storm and not at all from a hand-built minimal case,
     which is precisely the situation where "units.4.num_units" alone is worth
     nothing. So every violation about specific keys carries those keys' whole
     cell records — value, source, db_value and what the snapshot holds — which
     is the difference between a lead and a finding. */
  const cellEvidence=keys=>c.eval(`const out={};
    for(const k of ${J(keys)}){
      const f=form[k],s=(typeof FORMSNAP!=='undefined'&&FORMSNAP)?FORMSNAP[k]:null;
      out[k]={form:f?{value:f.value,source:f.source,db_value:f.db_value,prior_value:f.prior_value}:null,
              snap:s?{value:s.value,source:s.source,db_value:s.db_value}:null,
              onScreen:!![...document.querySelectorAll('#viewForm [data-k],#viewForm [data-trigfor],#viewForm [data-box]')]
                .find(e=>e.offsetParent&&(e.getAttribute('data-k')===k||e.getAttribute('data-trigfor')===k||e.getAttribute('data-box')===k))};
    } return out;`);
  const dirtyTruth=()=>c.eval('return window.__fz.dirtyTruth();');
  const drainErrs=()=>c.eval('const e=window.__fz.errs;window.__fz.errs=[];return e;');
  const diffSnaps=(a,b)=>{const ks=new Set(Object.keys(a).concat(Object.keys(b)));const out=[];for(const k of ks){if((a[k]||'')!==(b[k]||''))out.push(k+': '+J(a[k]||'')+' -> '+J(b[k]||''));}return out;};

  /* the colour oracle's baseline: whatever the app paints BEFORE the storm is
     legal by observation; the CLR palette is legal by definition; anything else
     that appears DURING the storm was caused by it. */
  const CLRBG=palette();
  const scanColours=()=>c.eval(`
    const seen=new Set();
    document.querySelectorAll('#viewForm [data-box], #viewForm .uatrigger, #viewForm input[data-k]').forEach(el=>{
      if(!el.offsetParent)return;
      seen.add(getComputedStyle(el).backgroundColor);
    });
    return [...seen];`);
  /* WHEN the baseline is taken decides what the oracle can see. Taken here, it
     is taken AFTER the caller has filled the form from a document — so a defect
     that paints during a fill is already in the baseline and legal forever. The
     honest baseline is an untouched form, which only the caller can capture, so
     it is passed in; scanning now is the fallback for callers that do not care.
     Measured: a planted magenta went entirely unreported until the baseline
     moved ahead of the fill. */
  const legal=new Set(CLRBG.concat(['rgb(255, 255, 255)','rgba(0, 0, 0, 0)']));
  for(const col of (opts.baseColours&&opts.baseColours.length?opts.baseColours:await scanColours()))legal.add(col);

  const pick=arr=>arr[Math.floor(rng()*arr.length)];

  const controlsOf=()=>c.eval(`
    const out=[];const vis=el=>!!el.offsetParent;
    const push=(sel,kind)=>{document.querySelectorAll(sel).forEach((el,i)=>{if(vis(el))out.push({sel:sel,i:i,kind:kind});});};
    push('#viewForm input[data-k]','text');
    push('#viewForm input[data-srcedit]','text');
    push('#viewForm [data-cb]','click');
    push('#viewForm .uatrigger[data-trigfor]','drop');
    push('#viewForm [data-fuel]','click');
    push('#viewForm [data-fuel3]','click');
    push('#viewForm [data-wibox]','click');
    push('#viewForm [data-csclear]','click');
    return out;`);

  const focusNth=(sel,i)=>c.eval(`const e=document.querySelectorAll(${J(sel)})[${i}];if(!e||!e.offsetParent)return 0;e.focus();if(e.select)e.select();return 1;`);
  const clickNth=(sel,i)=>c.eval(`const e=document.querySelectorAll(${J(sel)})[${i}];if(!e||!e.offsetParent)return 0;e.click();return 1;`);
  const keyPress=async k=>{
    if(realKeys){await c.key(k);return;}
    await c.eval(`const t=document.activeElement||document.body;
      const ev=new KeyboardEvent('keydown',{key:${J(k)},bubbles:true,cancelable:true});t.dispatchEvent(ev);return 1;`);
    await sleep(60);
  };
  const typeValue=async v=>{
    if(realKeys&&v!==''&&v.length<=8&&!/^\s+$/.test(v)){await c.type(v);return;}
    await c.eval(`const e=document.activeElement;if(!e||e.tagName!=='INPUT')return 0;
      e.value=${J(v)};e.dispatchEvent(new Event('input',{bubbles:true}));return 1;`);
    await sleep(40);
  };

  /* one random mutating action drawn from the live repertoire */
  const oneAction=async controls=>{
    if(!controls.length)return;
    const ctl=pick(controls);
    if(ctl.kind==='text'){
      if(!await focusNth(ctl.sel,ctl.i))return;
      const v=pick(opts.values&&opts.values.length?opts.values:VALUES);
      await typeValue(v);
      counts.edits++;act('type '+J(v)+' into '+ctl.sel+'['+ctl.i+']');
    }else if(ctl.kind==='drop'){
      if(!await clickNth(ctl.sel,ctl.i))return;
      counts.drops++;act('open dropdown '+ctl.i);
      await sleep(70);
      if(rng()<0.65){
        const n=await c.eval(`const m=document.querySelectorAll('.uadrop.open .uaopt');return m.length;`);
        if(n>0){const j=Math.floor(rng()*n);
          await c.eval(`const m=document.querySelectorAll('.uadrop.open .uaopt');if(m[${j}])m[${j}].click();return 1;`);
          counts.clicks++;act('pick menu row '+j+' of '+n);}
      }else{await keyPress('Escape');counts.escapes++;act('escape the open menu');}
    }else{
      if(!await clickNth(ctl.sel,ctl.i))return;
      counts.clicks++;act('click '+ctl.sel+'['+ctl.i+']');
    }
    await sleep(50);
  };

  /* spend the undo chain; stop BEFORE an Escape with nothing left would reach
     requestExit(). Overshoot is guarded anyway: close whatever opened. */
  const escapeToRest=async()=>{
    for(let i=0;i<80;i++){
      const open=await c.eval(`return document.querySelector('.uadrop.open')?1:0;`);
      const rest=await c.eval('return window.__fz.rest();');
      if(!open&&rest===0)break;
      await keyPress('Escape');counts.escapes++;act('escape ('+rest+' left)');
    }
    await c.eval(`const s=document.getElementById('scrim');
      if(s&&s.classList.contains('open')&&typeof closeModal==='function')closeModal();return 1;`);
  };

  /* A save may legitimately ask a question — "Delete 1 unit type with no unit
     count?" is the app doing its job, not a defect. The storm answers the way a
     user does: a random button. Only a dialog that REPORTS a failure is a
     violation. Returns {answered, cancelled} so the caller knows whether the
     save it clicked actually went through. */
  const answerDialog=async label=>{
    const d=await c.eval(`const s=document.getElementById('scrim');
      if(!s||!s.classList.contains('open'))return null;
      const dlg=document.getElementById('dialog');
      const btns=[...(dlg?dlg.querySelectorAll('button'):[])].map(b=>b.textContent.trim());
      return {text:(dlg?dlg.textContent:'').slice(0,200),btns:btns};`);
    if(!d)return {answered:false,cancelled:false};
    if(/fail|error|could not|unable/i.test(d.text))
      vio('dialog-reports-failure',label+': '+J(d.text.slice(0,140)));
    const j=Math.floor(rng()*Math.max(1,d.btns.length));
    await c.eval(`const dlg=document.getElementById('dialog');
      const b=dlg?dlg.querySelectorAll('button')['+j+']:null;
      if(b)b.click();else if(typeof closeModal==='function')closeModal();return 1;`);
    const cancelled=/cancel|back|no\b/i.test(d.btns[j]||'');
    counts.dialogs=(counts.dialogs||0)+1;
    act('dialog '+J((d.text||'').slice(0,60))+' -> answered '+J(d.btns[j]||'(closed)'));
    await sleep(200);
    return {answered:true,cancelled};
  };

  const settleSave=async label=>{
    let cancelled=false;
    for(let i=0;i<50;i++){
      const ans=await answerDialog(label||'during save');
      if(ans.answered&&ans.cancelled)cancelled=true;
      const d=await dirtyTruth();
      if(!d.length)return {left:d,cancelled};
      await sleep(120);
    }
    return {left:await dirtyTruth(),cancelled};
  };

  /* the checks every episode ends with */
  const postChecks=async label=>{
    const errs=await drainErrs();
    errs.forEach(e=>vio('page-error',label+': '+e));
    const truth=await dirtyTruth();
    const said=await c.eval(`return {fn:(typeof isDirty==='function')?!!isDirty():null,
      tag:(function(){const t=document.getElementById('unsavedTag');return t?t.classList.contains('on'):null;})()};`);
    if(said.fn!==null&&said.fn!==(truth.length>0))
      vio('false-dirty-verdict',label+': isDirty() says '+said.fn+' but the form differs from its snapshot on '+truth.length+' key(s): '+truth.slice(0,5).join(', '),
          await cellEvidence(truth.slice(0,5)));
    if(said.tag!==null&&said.tag!==(truth.length>0))
      vio('footer-disagrees',label+': the footer tag shows '+(said.tag?'"unsaved"':'clean')+' while the truth is '+(truth.length?truth.length+' dirty key(s): '+truth.slice(0,5).join(', '):'clean'));
    counts.colourScans++;
    for(const col of await scanColours())
      if(!legal.has(col))
        vio('new-colour',label+': a cell painted '+col+', a colour neither in CLR nor present before the storm');
  };

  /* ── the episodes ─────────────────────────────────────────────────────── */
  /* opts.kinds / opts.values exist for ONE caller: test_fuzz.js, which must aim
     a storm at a single oracle to prove that oracle fires on a planted defect.
     A proof that relies on a random walk happening to visit the right episode is
     not a proof. Production passes neither. */
  const kinds=(opts.kinds&&opts.kinds.length?opts.kinds:['escape','escape','save','revertAll'].concat(doors?['boundary']:[]));
  for(let ep=0;ep<episodes;ep++){
    counts.episodes++;
    const kind=pick(kinds);
    await answerDialog('stray dialog at episode start');
    /* THE EPISODE BOUNDARY MUST BE A REAL WALL, or the escape oracle indicts the
       harness. Escape walks a RUN of edits (FORM-RULES 12) and a run does not
       stop because this file started counting a new episode: seed 42 reported
       two keys of "residue" that were an earlier episode's edits being correctly
       unwound. So spend whatever the last episode left BEFORE the snapshot is
       taken, and only then is a later difference this episode's doing. */
    await escapeToRest();
    const S0=await snap();
    const controls=await controlsOf();
    act('— episode '+(ep+1)+'/'+episodes+' ['+kind+'] '+controls.length+' controls on screen');
    const n=1+Math.floor(rng()*maxEdits);

    if(kind==='escape'){
      for(let i=0;i<n;i++)await oneAction(controls);
      await escapeToRest();
      const S1=await snap();
      const diff=diffSnaps(S0,S1);
      if(diff.length)
        vio('escape-left-residue','after escaping every edit to rest, '+diff.length+' key(s) still differ from the pre-episode form: '+diff.slice(0,5).join(' · '),
            await cellEvidence(diff.slice(0,5).map(d=>d.split(':')[0])));
      await postChecks('escape episode');
    }

    else if(kind==='save'){
      for(let i=0;i<n;i++){
        await oneAction(controls);
        if(rng()<0.3){await keyPress('Enter');counts.enters++;act('enter (commit)');}
      }
      await c.eval(`const b=document.getElementById('bSave');if(b)b.click();return 1;`);
      counts.saves++;act('click Update property profile');
      const sv=await settleSave('save episode');
      /* a save the storm itself cancelled leaves dirt on purpose — assert
         cleanliness only when the save was allowed through */
      if(!sv.cancelled&&sv.left.length)
        vio('save-left-dirt','after "Update property profile" settled, '+sv.left.length+' key(s) still differ from the snapshot: '+sv.left.slice(0,6).join(', '),
            await cellEvidence(sv.left.slice(0,6)));
      await postChecks('save episode');
    }

    else if(kind==='revertAll'){
      for(let i=0;i<n;i++)await oneAction(controls);
      await c.eval(`const b=document.getElementById('bFillFooter');if(b)b.click();return 1;`);
      counts.revertAlls++;act('click Revert to saved');
      await sleep(250);
      const truth=await dirtyTruth();
      if(truth.length)
        vio('revert-left-dirt','after "Revert to saved", '+truth.length+' key(s) still differ from the snapshot: '+truth.slice(0,6).join(', '),
            await cellEvidence(truth.slice(0,6)));
      await postChecks('revertAll episode');
    }

    else if(kind==='boundary'){
      counts.boundaries++;
      await c.eval(`const b=document.getElementById('bSave');if(b)b.click();return 1;`);
      counts.saves++;act('save before the boundary');
      const bsv=await settleSave('boundary save');
      if(bsv.cancelled){act('boundary save was cancelled by the storm; crossing anyway with dirt is a user choice the app must survive');}
      const before=await snap();
      const keys=Object.keys(before).filter(k=>before[k]!=='').slice(0,12);
      await c.eval(`const t=window.__t;const pid=t.__firstPid();await t.__openForm(pid);return 1;`);
      act('left the form and reopened it');
      await sleep(300);
      const truth=await dirtyTruth();
      if(truth.length)
        vio('opens-dirty','a freshly reopened form differs from its own snapshot on '+truth.length+' key(s): '+truth.slice(0,5).join(', ')+' — the phantom-dirty class',
            await cellEvidence(truth.slice(0,5)));
      if(!bsv.cancelled){
        const after=await snap();
        const lost=keys.filter(k=>(after[k]||'')!==before[k]);
        if(lost.length)
          vio('boundary-lost-values',lost.length+' saved value(s) did not survive leaving and reopening the form: '+lost.slice(0,5).map(k=>k+' '+J(before[k])+' -> '+J(after[k]||'')).join(' · '));
      }
      await postChecks('boundary episode');
    }
  }

  return {seed,episodes,actions,violations,counts,realKeys};
}

/* ── boot a PREBUILT bundle ─────────────────────────────────────────────────
   cdplib.withApp always builds from the live sources — right for every suite
   that tests the app as it is. test_fuzz.js needs the opposite: serve a bundle
   built from DELIBERATELY BROKEN sources and prove the storm sees the break.
   Same boot, different file; mirrors cdplib and stays beside the storm that
   needs it. */
async function withBundle(bundleFile,fn,{width=1280,height=900}={}){
  const bin=findChrome();
  if(!bin)return {skipped:'no chromium binary found'};
  const srv=await new Promise(res=>{const s=http.createServer((rq,rs)=>fs.readFile(bundleFile,(e,b)=>{
      if(e){rs.writeHead(404);rs.end();}else{rs.writeHead(200,{'content-type':'text/html'});rs.end(b);}}));
    s.listen(0,'127.0.0.1',()=>res(s));});
  const port=srv.address().port;
  const dp=await new Promise(r=>{const t=net.createServer();t.listen(0,'127.0.0.1',()=>{const p=t.address().port;t.close(()=>r(p));});});
  const ud=fs.mkdtempSync(path.join(os.tmpdir(),'rcs-fuzz-'));
  const rmUd=()=>{try{fs.rmSync(ud,{recursive:true,force:true});}catch(e){}};
  /* see the note in cdplib.js -- root cannot keep the sandbox */
  const rootFlags=(process.getuid&&process.getuid()===0)?['--no-sandbox','--disable-dev-shm-usage']:[];
  const proc=cp.spawn(bin,['--headless=new','--remote-debugging-port='+dp,'--user-data-dir='+ud,
    '--no-first-run','--no-default-browser-check','--disable-gpu',...rootFlags,'--window-size='+width+','+height,'about:blank'],
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
  c.port=port;
  await c.reload();
  try{return await fn(c);}
  finally{try{ws.close();}catch(e){}proc.kill();srv.close();rmUd();}
}

/* open the first property's form and fill it from the bundled fixture, the way
   test_browser.js does — so source-backed cells, dropdown source rows and the
   parse state are all live before the storm starts. */
async function colourBaseline(c){
  return await c.eval(`const seen=new Set();
    document.querySelectorAll('#viewForm [data-box], #viewForm .uatrigger, #viewForm input[data-k]').forEach(el=>{
      if(el.offsetParent)seen.add(getComputedStyle(el).backgroundColor);});
    return [...seen];`);
}

async function primeSelftest(c){
  const pid=await c.eval('return window.__t.__firstPid()');
  await c.eval(`await window.__t.__openForm(${J(pid)});return 1`);
  await sleep(200);
  /* before the fill, deliberately — see the baseline note in storm() */
  const baseColours=await colourBaseline(c);
  const fixture=path.join(__dirname,'fixture_rs_scan.json');
  if(fs.existsSync(fixture)){
    const scan=JSON.parse(fs.readFileSync(fixture,'utf8'));
    const rec=await c.eval('return await window.__t.ocrMapPages('+JSON.stringify(scan)+')');
    if(rec)await c.eval('window.__t.__setRsParsed('+JSON.stringify(rec)+');window.__t.__rsFill();window.__t.__renderBody();return 1');
    await sleep(150);
  }
  return {pid,baseColours};
}

module.exports={mulberry32,storm,withBundle,primeSelftest,colourBaseline,palette,VALUES};

/* ── CLI ────────────────────────────────────────────────────────────────── */
if(require.main===module){
  const argv=process.argv.slice(2);
  const opt=(n,d)=>{const i=argv.indexOf('--'+n);return i>=0?+argv[i+1]:d;};
  const seed=opt('seed',(Date.now()^(process.pid<<12))>>>0);
  const episodes=opt('episodes',10);
  const maxEdits=opt('edits',5);
  (async()=>{
    const r=await withApp(async c=>{
      const {baseColours}=await primeSelftest(c);
      console.log('storm: seed '+seed+', '+episodes+' episodes (replay with --seed '+seed+')');
      return await storm(c,{seed,episodes,maxEdits,doors:true,baseColours});
    },{tag:'fuzz'});
    if(r&&r.skipped){console.log('SKIPPED (loudly): '+r.skipped);process.exit(3);}
    const lf=(i=>i>=0?argv[i+1]:null)(argv.indexOf('--log'));
    if(lf){require('fs').writeFileSync(lf,JSON.stringify({seed,counts:r.counts,violations:r.violations,actions:r.actions},null,1));console.log('full log -> '+lf);}
    console.log('\nactions : '+r.actions.length);
    console.log('counts  : '+JSON.stringify(r.counts));
    if(r.violations.length){
      console.log('\n'+r.violations.length+' VIOLATION(S):');
      r.violations.forEach(v=>{console.log('  ✗ ['+v.kind+'] '+v.msg);v.after.slice(-6).forEach(a=>console.log('      · '+a));});
      console.log('\nX THE STORM FOUND '+r.violations.length+' VIOLATION(S) — seed '+seed);
      process.exit(1);
    }
    console.log('\n+ the storm found nothing — seed '+seed+', '+r.counts.edits+' edits, '+r.counts.escapes+' escapes, '+r.counts.saves+' saves');
  })().catch(e=>{console.error(e);process.exit(1);});
}
