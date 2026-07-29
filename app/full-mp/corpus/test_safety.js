/* The rails that make unattended running safe. If any of these stops being
   true, the night must not proceed.

   Each check exists because the failure it guards is silent: a committed cache
   leaks real contract numbers into git with no error; a push from main is a
   production deploy that looks exactly like any other push; and tier-3 OCR
   bills per page while reporting nothing unusual when it fires.

   ON BILLING, read this before trusting checks 1-3. They no longer mean "the
   corpus cannot spend money" -- that was true only while the harness drove the
   app through ?selftest=1, which never constructs a Supabase client. The real
   driver signs in as Matt and DELIBERATELY bills: 27 of 34 executed schedules
   are flattened to vector outlines and OCR is the only way to read them. What
   these three still buy is narrower and still worth having -- that the spend
   has exactly ONE route off this machine (ocr.js -> supaClient.functions.invoke
   -> the ocr-rs edge function), so "how many pages did we pay for" is a
   question with one place to look and one place to cap. A direct fetch added to
   ocr.js would move billing somewhere nothing is counting; that is the failure
   these guard now. */
const fs=require('fs'),path=require('path'),cp=require('child_process');
const MIN_CHECKS=10;
let n=0,fails=0,skips=0;
const T=(l,v)=>{n++;if(!v){fails++;console.log('  X '+l);}else console.log('  + '+l);};
/* Loudly, never as a pass -- the house convention from test_browser.js. A
   machine without the Drive mount can still gate everything else. */
const SKIP=(l,why)=>{skips++;console.log('  ~ SKIPPED: '+l+'  ('+why+')');};
const ROOT=path.resolve(__dirname,'..','..','..');
const MP=path.join(ROOT,'app','full-mp');

/* 1-2. Tier 3 spends through one door. ocrHalf's only route off this machine
   is the Supabase edge function, so every billable page passes a single choke
   point that can be counted and capped. Asserted, not assumed. */
const ocr=fs.readFileSync(path.join(MP,'ocr.js'),'utf8');
T('ocr.js makes no direct network call of its own',
  (ocr.match(/\bfetch\s*\(|XMLHttpRequest|require\(['"]https?['"]\)/g)||[]).length===0);
T('ocr.js reaches Azure only through supaClient.functions.invoke',
  /supaClient[\s\S]{0,40}functions[\s\S]{0,20}invoke/.test(ocr));

/* 3. Selftest boot does not construct a Supabase client, so a run driven
   through the hatch still cannot reach Supabase at all -- the isolation the
   app documents. The corpus driver does not use the hatch; it signs in. */
const app=fs.readFileSync(path.join(MP,'app.js'),'utf8');
T('the selftest hatch routes the data layer to the local stub, not Supabase',
  /selftest/.test(app)&&/__localDb/.test(app));

/* 4. The cache is derived from Drive and holds real contract numbers. */
const gi=fs.readFileSync(path.join(ROOT,'.gitignore'),'utf8');
T('_archive/corpus-cache/ is gitignored',/^_archive\/corpus-cache\/?\s*$/m.test(gi));

/* 5. Never on main: on this repo a push to main is a deploy. */
const br=cp.execSync('git rev-parse --abbrev-ref HEAD',{cwd:ROOT}).toString().trim();
T('not working on main (got "'+br+'")',br!=='main');

/* 6. The Drive mount is read-only to us. Prove we can see it before a night
   of runs discovers otherwise at 3am. */
const CORPUS=process.env.CORPUS||path.join(process.env.HOME,
  'Library/CloudStorage/GoogleDrive-mfkodsi@gmail.com/My Drive/RCS Package Samples');
let dirs=null;try{dirs=fs.readdirSync(CORPUS).filter(x=>!x.startsWith('.'));}catch(e){}
if(dirs===null)SKIP('the corpus mount is readable','no Drive mount on this machine; set CORPUS to check it');
else T('the corpus mount is readable ('+dirs.length+' property folders)',dirs.length>=30);

/* 7. The decryptor the corpus depends on is the one we ship. */
T('pdfdecrypt.js and crypto.js are present in the app source',
  fs.existsSync(path.join(MP,'pdfdecrypt.js'))&&fs.existsSync(path.join(MP,'crypto.js')));

/* 8-11. ONE PROPERTY, ONE DRIVE — the rail that keeps the Azure bill honest.
   sweep.js calls driveOne once per fill order; driveBoth is what costs money,
   and driveOne is supposed to run it once and serve the second order from a
   memo. That held for a single property and broke under --jobs 2: the memo was
   one module-level slot, so two workers overwrote each other mid-await and
   every property was driven twice. A two-property probe created FOUR records.
   The bill is the smaller harm — the two fill orders then came from two
   different runs, so the sweep's highest-severity finding, "the same inputs in
   two orders produced different packages", was measuring run-to-run variance.
   Asserted with a stub rather than a browser, because the property under test
   is a call count. */
const drive=require('./drive.js');
const mkOpts=(name,extra)=>Object.assign({
  propertyFolder:name,studyPath:'s.pdf',priorRsPath:'r.pdf',
  outRoot:'/tmp/x',corpusRoot:'/c',cacheRoot:'/k'},extra||{});
const fakeBoth=(name,calls,delay)=>{
  const o=mkOpts(name);
  o.__driveBoth=()=>{calls.n++;return new Promise(res=>setTimeout(()=>res({
    property:name,code:name,folder:name,orders:{'rs-first':{outDir:'/tmp/a',files:['a']},
    'rcs-first':{outDir:'/tmp/b',files:['b']}},warnings:[],errors:[]}),delay));};
  return o;};

(async()=>{
  /* Both orders of ONE property: the memo's original job. */
  drive._resetMemo();
  let c1={n:0};
  const o1=fakeBoth('P1',c1,10);
  await drive.driveOne(Object.assign({},o1,{order:'rs-first'}));
  await drive.driveOne(Object.assign({},o1,{order:'rcs-first'}));
  T('two fill orders of one property drive it once',c1.n===1);

  /* THE REGRESSION: two properties interleaved, exactly as --jobs 2 runs them.
     With a single slot this reports 4. */
  drive._resetMemo();
  const cA={n:0},cB={n:0};
  const oA=fakeBoth('PA',cA,40),oB=fakeBoth('PB',cB,40);
  const runBoth=o=>(async()=>{
    await drive.driveOne(Object.assign({},o,{order:'rs-first'}));
    await drive.driveOne(Object.assign({},o,{order:'rcs-first'}));})();
  await Promise.all([runBoth(oA),runBoth(oB)]);
  T('two properties driven concurrently cost one drive each, not two',
    cA.n===1&&cB.n===1);

  /* A second caller arriving while the first is still running must join it. */
  drive._resetMemo();
  const cC={n:0};
  const oC=fakeBoth('PC',cC,40);
  await Promise.all([drive.driveOne(Object.assign({},oC,{order:'rs-first'})),
                     drive.driveOne(Object.assign({},oC,{order:'rcs-first'}))]);
  T('simultaneous callers for one property share the run already in flight',cC.n===1);

  /* A failure is remembered too, or a property that dies late costs two OCRs. */
  drive._resetMemo();
  let fn=0;
  const oF=mkOpts('PF');
  oF.__driveBoth=()=>{fn++;return Promise.reject(new Error('boom'));};
  let e1=null,e2=null;
  try{await drive.driveOne(Object.assign({},oF,{order:'rs-first'}));}catch(e){e1=e;}
  try{await drive.driveOne(Object.assign({},oF,{order:'rcs-first'}));}catch(e){e2=e;}
  T('a failed property is not driven again for its second order',fn===1&&e1===e2&&!!e1);
  drive._resetMemo();
  verdict();
})();

function verdict(){
if(!fails&&n<MIN_CHECKS){
  console.log('\nX SAFETY SUITE FAILED - only '+n+' of the expected '+MIN_CHECKS+' checks ran');
  process.exitCode=1;
}else{
  console.log('\n'+(fails?('X SAFETY SUITE FAILED ('+fails+' of '+n+')')
                        :('+ ALL '+n+' SAFETY CHECKS PASSED'+(skips?('  ('+skips+' skipped loudly)'):''))));
  process.exitCode=fails?1:0;
}
}
