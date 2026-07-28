/* test_rcs.js — the RCS report reader, against real studies from four firms.
   Fixtures: _archive/rcs-fixtures/ (trimmed to their letter and grid pages) and
   the full 60-page package in _archive/colonial-village-example/.

   THE PAGE BUDGET IS A TEST. A study runs to 115 pages; the letter is two of
   them. Reading more is slow in the browser and, once the scanning tier lands,
   billed per page. If a change makes the reader touch more pages, that is a
   regression and this suite says so.

   Adding checks? Raise MIN_CHECKS. Never lower it to make a red run green. */
global.CSS={escape:s=>s};
const mem={};
global.window={addEventListener:(e,cb)=>{if(e==='DOMContentLoaded')global.__ready=cb;},localStorage:{getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=v;},removeItem:k=>{delete mem[k];}},scrollY:0,scrollTo(){}};
function mk(id){return {id:id||'',style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},setAttribute(){},getAttribute(){return'';},appendChild(){},addEventListener(){},closest(){return null;},parentElement:null,querySelector(){return null;},querySelectorAll(){return[];},innerHTML:'',textContent:'',onclick:null,value:'',checked:false,focus(){},select(){},setSelectionRange(){},files:[]};}
const els={};
global.document={getElementById:id=>els[id]||(els[id]=mk(id)),querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>mk(),addEventListener(){},body:{classList:{toggle(){},contains(){return false;}}}};
const fs=require('fs'),path=require('path'),os=require('os');

const MIN_CHECKS=30;
let n=0,fails=0,verdict=null;
const BAR='='.repeat(68);
function fail(msg,err){
  verdict='fail'; process.exitCode=1;
  console.log('\n'+BAR);
  console.log('  XXX  RCS PARSE SUITE FAILED - DO NOT SHIP  XXX');
  console.log('  '+msg);
  if(err)console.log(String(err&&err.stack||err).replace(/^/gm,'  '));
  console.log(BAR);
  console.log(`X RCS PARSE SUITE FAILED (${n} checks ran, ${fails} failed)`);
}
function pass(){verdict='pass';console.log(`\n+ ALL ${n} RCS PARSE CHECKS PASSED\n`);}
function finish(){
  if(fails)return fail(`${fails} of ${n} checks failed - see the X lines above`);
  if(n<MIN_CHECKS)return fail(`only ${n} of the expected ${MIN_CHECKS} checks ran - the suite died partway`);
  pass();
}
process.on('exit',()=>{if(verdict===null)fail(`the run ended without a verdict after ${n} of ${MIN_CHECKS} checks - it died partway`);});
process.on('unhandledRejection',e=>{fail('unhandled rejection - an async throw is a failure, never a pass',e);process.exit(1);});
process.on('uncaughtException',e=>{fail('uncaught exception',e);process.exit(1);});
const eq=(label,got,want)=>{n++;const p=JSON.stringify(got)===JSON.stringify(want);if(!p){fails++;console.log(`  X ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);}else console.log(`  + ${label}`);};
const T=(label,v)=>eq(label,!!v,true);
const LE=(label,got,max)=>{n++;const p=got<=max;if(!p){fails++;console.log(`  X ${label}: ${got} exceeds the budget of ${max}`);}else console.log(`  + ${label} (${got})`);};

const _d=__dirname;
(0,eval)(fs.readFileSync(path.join(_d,'lib/pdf-lib.min.js'),'utf8'));
global.window.PDFLib=global.window.PDFLib||globalThis.PDFLib;
const _b=path.join(os.tmpdir(),'rcs_parse_test.js');
fs.writeFileSync(_b,['core.js','db.js','app.js','rcs.js'].map(x=>fs.readFileSync(path.join(_d,x),'utf8')).join('\n')
  +'\nif(typeof module!=="undefined")module.exports.__rsTextPageAt=rsTextPageAt;\n');
const app=require(_b);
const R=global.window.RCSParse;
const FIX=path.join(_d,'..','..','_archive','rcs-fixtures');
const PKG=path.join(_d,'..','..','_archive','colonial-village-example','Manual RCS Package (PDF).pdf');

/* A reader that counts every page it is asked for. The count IS the budget. */
async function reader(file){
  const P=global.window.PDFLib;
  const doc=await P.PDFDocument.load(new Uint8Array(fs.readFileSync(file)),{ignoreEncryption:true,throwOnInvalidObject:false});
  const rd={pageCount:doc.getPageCount(),hits:0,
    getPage:async function(i){rd.hits++;return await app.__rsTextPageAt(doc,i);}};
  return rd;
}

(async()=>{
  /* ---- pure helpers ---- */
  eq('norm strips punctuation and case',R.norm('Rent Comparability Grid'),'rentcomparabilitygrid');
  eq('norm survives lost word spacing',R.norm('AsoutlinedintheRenewal'),R.norm('As outlined in the Renewal'));
  eq('money parses a dollar amount',R.money('$1,850'),1850);
  eq('money rounds to whole dollars',R.money('$741.36'),741);
  eq('dec keeps two decimals',R.dec('$2.34'),2.34);
  eq('empty money is empty, not zero',R.money(''),'');

  /* ---- line assembly against a real page ---- */
  const cv=await reader(path.join(FIX,'belfry-colonial-village.pdf'));
  const L=R.lines(await cv.getPage(2));
  T('line assembly rejoins a mid-word split',L.some(l=>l.text==='BELFRY VALUATION'));
  T('line assembly rejoins shattered small caps',L.some(l=>R.norm(l.text)==='ownersgrossrenewalpotentialcalculation'));

  /* ---- the page budget: find the letter, read almost nothing else ---- */
  const CASES=[
    ['belfry-colonial-village.pdf',  [1,2]],
    ['belfry-fairview-homes.pdf',    [1,2]],
    ['belfry-gates-manor.pdf',       [1,2]],
    ['belfry-lansing-manor.pdf',     [1,2]],
    ['belfry-woodland-towers.pdf',   [1,2]],
    ['cornerstone-crossroads.pdf',   [1,2]],
    ['cornerstone-golden-link.pdf',  [1,2]],
  ];
  for(const [f,want] of CASES){
    const rd=await reader(path.join(FIX,f));
    const r=await R.findLetter(rd);
    eq(`${f.replace('.pdf','')}: letter pages`,r.pages,want);
    LE(`${f.replace('.pdf','')}: pages read`,rd.hits,3);
  }

  /* The 60-page renewal package hides the letter behind the owner's cover
     documents. It must still be found, and still cheaply. */
  const pk=await reader(PKG);
  const pr=await R.findLetter(pk);
  eq('package: letter found behind the cover documents',pr.pages,[5,6]);
  LE('package: pages read to find it',pk.hits,4);
  eq('package: total pages available',pk.pageCount,60);

  /* A 115-page study must not cost 115 pages. */
  const cs=await reader(path.join(FIX,'cornerstone-crossroads.pdf'));
  await R.findLetter(cs);
  LE('a study is never read whole',cs.hits,3);

  /* The order pages are TRIED in is what the scanning tier is billed for. */
  eq('page 0 is never tried first',R._probeOrder(60)[0],1);
  eq('the package layout is tried before the tail',R._probeOrder(60).slice(0,4),[1,2,5,6]);
  eq('probe order never exceeds the scan cap',R._probeOrder(115).length,14);
  eq('a short document is not over-probed',R._probeOrder(3),[1,2,0]);

  finish();
})().catch(e=>{fail('the suite threw',e);process.exit(1);});
