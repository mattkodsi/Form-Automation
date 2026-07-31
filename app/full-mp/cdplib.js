/* cdplib.js — the headless-chromium machinery, shared.

   It was written inside test_browser.js and lived there alone: build our own
   bundle, serve it on a loopback port, drive a real chromium over the Chrome
   DevTools Protocol using node's own WebSocket and nothing else. shots.js needs
   exactly the same boot in order to PHOTOGRAPH the page that suite drives, and
   two copies of a boot sequence is two things to keep true. So it moved here
   verbatim; test_browser.js requires it and is otherwise untouched.

   Nothing in here asserts. The verdict machinery, MIN_CHECKS and every check
   stayed in the suite that owns them. */

const cp=require('child_process'),http=require('http'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net');

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
/* …and per PURPOSE: the screenshot sweep and the key suite may run at the
   same moment out of run_tests.sh, and one name would have them serving each
   other's build. */
const _BUNDLES=new Set();
function bundlePath(tag){const p=path.join(os.tmpdir(),'rcs_'+(tag||'browser')+'_bundle.'+process.pid+'.html');_BUNDLES.add(p);return p;}
/* The pid above keeps parallel worktrees off each other's bundle (610fe58); it does
   not clean up after itself, and a few hundred of these had piled up in the temp
   directory. Take ours with us. force:true so a run that never got as far as
   writing the file still exits quietly, and the try/catch so cleanup can never be
   the thing that fails an otherwise-green run. */
process.on('exit',()=>{for(const p of _BUNDLES){try{fs.rmSync(p,{force:true});}catch(e){}}});
function buildBundle(BUNDLE){
  cp.execFileSync('bash',[path.join(__dirname,'build.sh'),BUNDLE],{stdio:['ignore','ignore','pipe']});
  const n=fs.statSync(BUNDLE).size;
  if(n<500000)throw new Error('built bundle is implausibly small ('+n+' bytes)');
  return n;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function findChrome(){
  /* an explicit override wins over any search */
  if(process.env.CHROME_PATH){
    try{fs.accessSync(process.env.CHROME_PATH,fs.constants.X_OK);return process.env.CHROME_PATH;}catch(e){}
  }
  const cands=[];
  /* Playwright's browser root moves by platform and by container: the mac
     cache, the linux cache, and PLAYWRIGHT_BROWSERS_PATH where an image
     pre-installs one elsewhere. Look in all of them. Looking only in the mac
     path left every browser-driven suite dark inside a linux container, and a
     suite that cannot find a browser reports a SKIP -- so the hole was silent. */
  const roots=[process.env.PLAYWRIGHT_BROWSERS_PATH,
               path.join(os.homedir(),'Library/Caches/ms-playwright'),
               path.join(os.homedir(),'.cache/ms-playwright')].filter(Boolean);
  for(const pw of roots){
  const dirs=fs.existsSync(pw)?fs.readdirSync(pw):[];
  for(const d of dirs.filter(x=>/headless_shell/.test(x)))
    cands.push(path.join(pw,d,'chrome-headless-shell-mac-arm64/chrome-headless-shell'),
               path.join(pw,d,'chrome-headless-shell-linux64/chrome-headless-shell'),
               path.join(pw,d,'chrome-linux/headless_shell'));
  for(const d of dirs.filter(x=>/^chromium-/.test(x)))
    cands.push(path.join(pw,d,'chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
               path.join(pw,d,'chrome-linux/chrome'));
  }
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

async function withApp(fn,{width=1280,height=900,tag='browser',quiet=false}={}){
  const bin=findChrome();
  if(!bin)return {skipped:'no chromium binary found'};
  const BUNDLE=bundlePath(tag);
  const _bytes=buildBundle(BUNDLE);
  if(!quiet)console.log(`  (built a fresh bundle: ${_bytes.toLocaleString()} bytes)`);
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
  /* chromium will not start as root with its sandbox on, which is how CI
     containers run. Only add the flag when we ARE root -- a dev machine keeps
     the sandbox it already had. */
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
  c.port=port;c.bundle=BUNDLE;
  await c.reload();
  try{return await fn(c);}
  finally{try{ws.close();}catch(e){}proc.kill();srv.close();rmUd();}
}


module.exports={sleep,findChrome,CDP,withApp,buildBundle,bundlePath};
