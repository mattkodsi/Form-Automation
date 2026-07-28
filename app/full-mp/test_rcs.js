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

const MIN_CHECKS=140;
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
    ['belfry-fairview-homes.pdf',    [1,2,3]],   // an extra unit type pushed its SAFMR table onto a third page
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


  /* ================= what each study actually yields =================
     Every number below was read off the document by eye first. If the parser
     and this table ever disagree, one of them is wrong and neither may be
     changed to match the other without opening the PDF. */
  const EXPECT=[
   {f:'belfry-colonial-village.pdf',firm:'belfry',s8:'OH10M000236',
    name:'Colonial Village',street:'3641 Irving Street',city:'Cincinnati',state:'OH',zip:'45220',
    appr:'Belfry Valuation, LLC',who:'Aaron M. Zabel',phone:'7085002380',email:'azabel@belfryvaluation.com',
    tot:{grossRenewal:149195,grossSafmrBase:104870,grossSafmr150:157305,verdict:'pass'},
    units:[['2BR/1BA',32,790,1850,161,2085,1390],['3BR/1BA',33,1008,2400,171,2745,1830]]},
   {f:'belfry-fairview-homes.pdf',firm:'belfry',s8:'NJ390013022',
    name:'Fairview Homes',street:'86 17th Avenue',city:'Newark',state:'NJ',zip:'07103',
    appr:'Belfry Valuation, LLC',phone:'7085002380',email:'azabel@belfryvaluation.com',
    tot:{grossRenewal:428410,grossSafmrBase:289250,grossSafmr150:433875,verdict:'pass'},
    units:[['2BR/1BA',45,768,2450,76,2685,1790],['3BR/2BA',70,888,3275,91,3375,2250],['4BR/2BA',20,1176,3825,131,3840,2560]]},
   {f:'belfry-gates-manor.pdf',firm:'belfry',s8:'IL06H121063',
    name:'Gate Manor Apartments',street:'1135 Wilmette Avenue',city:'Wilmette',state:'IL',zip:'60091',
    appr:'Belfry Valuation, LLC',phone:'7085002380',email:'azabel@belfryvaluation.com',
    tot:{grossRenewal:140556,grossSafmrBase:118830,grossSafmr150:178245,verdict:'pass'},
    units:[['1BR/1BA',51,650,2725,31,3495,2330]]},
   {f:'belfry-lansing-manor.pdf',firm:'belfry',s8:'MI330005001',
    name:'Lansing Manor / Senior World',street:'5600 Mall Drive West',city:'Lansing',state:'MI',zip:'48917',
    appr:'Belfry Valuation, LLC',phone:'7085002380',email:'azabel@belfryvaluation.com',
    tot:{grossRenewal:128180,grossSafmrBase:104000,grossSafmr150:156000,verdict:'pass'},
    units:[['1BR/1BA without patio',32,575,1190,85,1560,1040],['1BR/1BA with patio',68,575,1200,85,1560,1040]]},
   {f:'belfry-woodland-towers.pdf',firm:'belfry',s8:'IL06H121046',
    name:'Woodland Towers Apartments',street:'306 Pine Lake Road',city:'Collinsville',state:'IL',zip:'62234',
    appr:'Belfry Valuation, LLC',phone:'7085002380',email:'azabel@belfryvaluation.com',
    tot:{grossRenewal:130832,grossSafmrBase:94640,grossSafmr150:141960,verdict:'pass'},
    units:[['1BR/1BA',104,528,1175,83,1365,910]]},
   /* Cornerstone prints the 150% SAFMR only as a TOTAL, never per unit type.
      Its per-type column is the BASE. safmr stays empty rather than being
      derived, because arithmetic of ours is not a value the study stated. */
   {f:'cornerstone-crossroads.pdf',firm:'cornerstone',s8:'IL060048014',
    name:'Crossroads of East Ravenswood',street:'1614 West Wilson Avenue',city:'Chicago',state:'IL',zip:'60640',
    appr:'CORNERSTONE VALUATION SERVICES',phone:'2624425492',email:'kyle@CornerstoneVS.com',
    tot:{grossRenewal:297773,grossSafmrBase:297780,grossSafmr150:446670,verdict:'pass'},
    units:[['1 BR / 1 BA',31,818,1870,61,3060,2040],['2 BR / 1 BA',66,927,2305,76,3450,2300],
           ['3 BR / 2 BA',21,928,2815,103,4440,2960],['4 BR / 2 BA',6,1188,3150,98,5145,3430]],derived:true},
   {f:'cornerstone-golden-link.pdf',firm:'cornerstone',s8:'UT99T855002',
    name:'Golden Link Manor',street:'1132 24th Street',city:'Ogden',state:'UT',zip:'84401',
    appr:'CORNERSTONE VALUATION SERVICES',phone:'2624425492',email:'kyle@CornerstoneVS.com',
    tot:{grossRenewal:47400,grossSafmrBase:34500,grossSafmr150:51750,verdict:'pass'},
    units:[['1 BR / 1 BA',30,537,1580,0,1725,1150]],derived:true},
  ];
  for(const E of EXPECT){
    const rd=await reader(path.join(FIX,E.f));
    const r=await R.readLetter(rd);
    const tag=E.f.replace('.pdf','').replace(/^(belfry|cornerstone)-/,'');
    const S=r.scalars;
    eq(`${tag}: firm recognised`,r.firm,E.firm);
    eq(`${tag}: section 8 number`,S['property.s8'],E.s8);
    eq(`${tag}: NEVER an FHA number`,S['property.fha'],undefined);
    eq(`${tag}: property`,[S['property.name'],S['property.addr_street'],S['property.addr_city'],S['property.addr_state'],S['property.addr_zip']],
                          [E.name,E.street,E.city,E.state,E.zip]);
    eq(`${tag}: appraiser firm`,S['appr.firm'],E.appr);
    eq(`${tag}: appraiser phone and e-mail`,[S['appr.phone'],S['appr.email']],[E.phone,E.email]);
    if(E.who)eq(`${tag}: appraiser name`,S['appr.name'],E.who);
    eq(`${tag}: the addressee never becomes the contact`,S['poc.name'],undefined);
    eq(`${tag}: totals`,r.totals,E.tot);
    eq(`${tag}: unit count`,r.units.length,E.units.length);
    E.units.forEach(function(u,i){
      const g=r.units[i]||{};
      eq(`${tag}: unit ${i+1} ${u[0]}`,[g.type,g.count,g.sf,g.proposed,g.ua,g.safmr,g.safmr_base],u);
    });
    /* A ceiling the study printed is read; one it did not is derived from the
       SAFMR it did print, and flagged as derived either way. */
    r.units.forEach(function(g,i){eq(`${tag}: unit ${i+1} ceiling ${E.derived?'derived':'as printed'}`,!!g.safmr_derived,!!E.derived);});
    LE(`${tag}: pages read`,rd.hits,4);
  }

  /* The document that argues with itself, and the two rows that must not merge. */
  const fv=await R.readLetter(await reader(path.join(FIX,'belfry-fairview-homes.pdf')));
  T('a self-contradicting unit type is reported',fv.warnings.some(w=>/3BR\/2BA/.test(w)&&/3BR\/1\.5BA/.test(w)));
  const ln=await R.readLetter(await reader(path.join(FIX,'belfry-lansing-manor.pdf')));
  eq('two rows of the same bedrooms and baths stay two',ln.units.length,2);
  T('and they keep different rents',ln.units[0].proposed!==ln.units[1].proposed);

  /* Belfry's 150% ceiling must be 1.5x the base it printed. */
  const cvr=await R.readLetter(await reader(path.join(FIX,'belfry-colonial-village.pdf')));
  cvr.units.forEach(function(u,i){eq(`colonial-village: unit ${i+1} ceiling is 1.5x its base`,u.safmr,Math.round(u.safmr_base*1.5));});
  eq('a clean study warns about nothing',cvr.warnings,[]);
  /* The derivation is only ever applied where the study is silent — never over
     a figure it actually printed. */
  cvr.units.forEach(function(u,i){eq(`colonial-village: unit ${i+1} ceiling was printed, not derived`,u.safmr_derived,false);});
  const cr=await R.readLetter(await reader(path.join(FIX,'cornerstone-crossroads.pdf')));
  cr.units.forEach(function(u,i){eq(`crossroads: unit ${i+1} derived ceiling is 1.5x its base`,u.safmr,Math.round(u.safmr_base*1.5));});

  /* Helpers that earned their own checks. */
  eq('a county belongs in no cell',R._splitCityStateZip('Cincinnati, Hamilton County, Ohio 45220'),{city:'Cincinnati',state:'OH',zip:'45220'});
  eq('a doubled place name still resolves',R._splitCityStateZip('New York, New York 10001'),{city:'New York',state:'NY',zip:'10001'});
  eq('"N/A" is not a section 8 number',R._s8From('FHA Project No.: N/A'),'');
  eq('the hyphenated printing reduces to the same value',R._s8From("Subject's FHA #: OH10-M000-236"),'OH10M000236');
  eq('a spelled-out grid heading parses',R.parseType('Two Bedroom').br,2);
  eq('a spaced type parses',[R.parseType('1 BR / 1 BA').br,R.parseType('1 BR / 1 BA').ba],[1,1]);

  finish();
})().catch(e=>{fail('the suite threw',e);process.exit(1);});
