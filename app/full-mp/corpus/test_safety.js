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
const MIN_CHECKS=6;
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

if(!fails&&n<MIN_CHECKS){
  console.log('\nX SAFETY SUITE FAILED - only '+n+' of the expected '+MIN_CHECKS+' checks ran');
  process.exitCode=1;
}else{
  console.log('\n'+(fails?('X SAFETY SUITE FAILED ('+fails+' of '+n+')')
                        :('+ ALL '+n+' SAFETY CHECKS PASSED'+(skips?('  ('+skips+' skipped loudly)'):''))));
  process.exitCode=fails?1:0;
}
