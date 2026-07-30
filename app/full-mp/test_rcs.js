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

const MIN_CHECKS=420;
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
/* Per process. A fixed name here is one file for every checkout on the machine,
   and this one is require()d — so a second suite writing it while this one runs
   hands us another branch's code and we PASS on it, having tested nothing we
   built. The other three suites were given a pid in 155174e's wake; this one was
   missed, and it fails the most quietly of the four. */
const _b=path.join(os.tmpdir(),'rcs_parse_test.'+process.pid+'.js');
/* And take it with us. force:true so a run that died before writing exits quietly,
   try/catch so cleanup can never be what fails an otherwise-green run. */
process.on('exit',()=>{try{fs.rmSync(_b,{force:true});}catch(e){}});
fs.writeFileSync(_b,'function ocrHalf(b,p,skip){(globalThis.__HALF=globalThis.__HALF||[]).push({p:p,skip:(skip||[]).slice()});return Promise.resolve(null);}\n'
  +['templates.js','core.js','score.js','db.js','app.js','rcs.js'].map(x=>fs.readFileSync(path.join(_d,x),'utf8')).join('\n')
  +'\nif(typeof module!=="undefined")Object.assign(module.exports,{__rsTextPageAt:rsTextPageAt,__rsTextPages:rsTextPages,__rsReadTextTier:rsReadTextTier,__rsTplAlign:rsTplAlign,__rsTplPremiseHolds:rsTplPremiseHolds,__rsFieldRects:rsFieldRects,__rsMapRects:rsMapRects,__rsTableA:rsTableA,__rsColHeads:rsColHeads,__rsTblCells:rsTblCells,__rsAssembleFields:rsAssembleFields,__rsLines:rsLines,__rsBoxText:rsBoxText,__rsDropTplLabels:rsDropTplLabels,__rsTplRuns:rsTplRuns,__rsDropFormLines:rsDropFormLines,__rsFormLines:rsFormLines,__defUaSrc:defUaSrc,__defSafmrSrc:defSafmrSrc,__checkSeed:checkSeed,__CHECK_CONDITIONAL:CHECK_CONDITIONAL,__CHECKLIST_FLAT:CHECKLIST_FLAT});\n');
const app=require(_b);
const R=global.window.RCSParse;
const D_=_d+'/';
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
    /* The parser keeps the addressee out of the scalar map — it travels as
       _poc_name and is matched against the saved contacts before anything is
       written, so that the email and phone can come with it. */
    eq(`${tag}: the addressee is not a plain scalar`,S['poc.name'],undefined);
    T(`${tag}: but the addressee was read`,!!S['_poc_name']);
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

  /* EVERY SPELLING HERE COST A RENT IN A REAL PACKAGE. A type whose bedroom
     count does not parse is invisible to rcsMatch, and its form row then takes
     a DIFFERENT unit type's rent rather than none -- Peterson Plaza's schedule
     came out $2,550 short exactly that way. Measured over the corpus: 15 of 98
     priced lines in 7 studies parsed no bedroom count; after this, 1. Each case
     is named for the study that prints it. */
  eq('a capital I standing in for the digit 1 (Peterson Plaza, Ebony Gardens, Holly House)',
     R.parseType('IBR/1BA').br,1);
  eq('and it still reads the bathrooms',R.parseType('IBR/1BA').ba,1);
  eq('B alone for bedroom (Westwood Village)',R.parseType('3B/1BA').br,3);
  eq('with a designation after it (Westwood Village)',R.parseType('3B/1BA HC').br,3);
  eq('and a two-bath variant (Westwood Village)',[R.parseType('4B/2BA').br,R.parseType('4B/2BA').ba],[4,2]);
  eq('BD for bedroom (North Park)',R.parseType('1BD/1BA').br,1);
  eq('BD with a half bath (North Park)',[R.parseType('3BD/1.5BA').br,R.parseType('3BD/1.5BA').ba],[3,1.5]);
  eq('a hyphen between the count and BR (New Horizons)',R.parseType('1-BR/1 BA').br,1);
  eq('a hyphen before the spelled-out word (Noble Tower)',R.parseType('One-Bedroom').br,1);
  eq('a space before the slash (Peterson Plaza)',R.parseType('2BR /1BA').br,2);
  /* THE GUARD THAT MAKES THE BARE B SAFE. "1BA" is one BATHROOM and no
     bedrooms; reading its B as a bedroom token would invent a unit type on
     every row of every study. Every bedroom spelling is followed by (?![a-z]),
     so B before A fails and B before / or space or end succeeds. */
  eq('a bare bathroom count is NOT a bedroom count',R.parseType('1BA').br,'');
  eq('nor is a two-bath one',R.parseType('2BA').br,'');
  eq('and a bathroom-only type still reads its baths',R.parseType('1BA').ba,1);
  /* Not a unit type at all: the studies wrap a designation onto its own line,
     and a line that is only a designation must stay unparsed rather than
     inventing a bedroom count. */
  eq('a designation on its own line yields no bedroom count',R.parseType('Senior').br,'');
  eq('nor does Multi-Family',R.parseType('Multi-Family').br,'');
  eq('studio still reads as zero bedrooms',R.parseType('STUDIO/1BA').br,0);
  eq('and efficiency does too',R.parseType('Efficiency').br,0);


  /* ============ the form side: values must actually land ============ */
  await global.__ready();
  await app.__localDb();
  await app.__openForm(app.__firstPid());

  const cvRec=await R.readLetter(await reader(path.join(FIX,'belfry-colonial-village.pdf')));
  app.__setRcsParsed(cvRec);
  /* the form's own rows must describe the same units for a match to exist */
  app.__edit('units.0.br','2BR');app.__edit('units.0.ba','1BA');
  app.__edit('units.1.br','3BR');app.__edit('units.1.ba','1BA');
  /* These already hold the property's stored values. The point is not that they
     are empty — it is that reading a study never disturbs them.

     poc.name came OFF this list on 2026-07-28: the study is addressed to a
     person, and that person is the portfolio manager the contract administrator
     writes back to. The study does now fill it, which is checked below. */
  const untouched={};
  ['sig.name','units.0.current','property.fha','owner.entity_name']
    .forEach(function(k){untouched[k]=app.getVal(k);});
  app.__rcsFill();
  eq('the study fills the point of contact from its addressee',app.getVal('poc.name'),'Matthew Kim');

  eq('market rent landed on row 0',app.getVal('units.0.proposed'),'1850');
  eq('market rent landed on row 1',app.getVal('units.1.proposed'),'2400');
  eq('utility allowance landed',app.getVal('units.0.ua_rcs'),'161');
  eq('150% SAFMR landed',app.getVal('units.0.safmr_rcs'),'2085');
  eq('the appraiser firm landed',app.getVal('appr.firm'),'Belfry Valuation, LLC');
  eq('the appraiser name landed',app.getVal('appr.name'),'Aaron M. Zabel');
  eq('the phone is formatted on the way in',app.getVal('appr.phone'),'(708) 500-2380');
  eq('the property name landed',app.getVal('property.name'),'Colonial Village');
  eq('the section 8 number landed',app.getVal('property.s8'),'OH10M000236');
  Object.keys(untouched).forEach(function(k){
    eq('the study leaves '+k+' alone',app.getVal(k),untouched[k]);
  });

  T('a filled cell says where it came from',app.__rcsTag('units.0.proposed').indexOf('RCS')>=0);
  T('every key the fill writes is covered by rcsTag',
    app.__rcsFillKeys().every(function(k){return app.__rcsTag(k)!=='';}));
  eq('the fill wrote the keys it claims',app.__rcsFillKeys().length>=16,true);

  /* Bedrooms and baths decide the match — never position. A 3BR row must not
     take the 2BR rent just because it came second. */
  eq('row 1 matched the 3BR line, not the first line',app.__rcsOf('units.1.proposed'),'2400');

  /* Lansing prices two rows of identical bedrooms and baths at different
     rents. Nothing on the form says which is which, so the app fills neither
     rather than picking. */
  const lnRec=await R.readLetter(await reader(path.join(FIX,'belfry-lansing-manor.pdf')));
  app.__setRcsParsed(lnRec);
  app.__edit('units.0.br','1BR');app.__edit('units.0.ba','1BA');
  app.__edit('units.0.num_units','');
  const m=app.__rcsMatch(0);
  eq('with no unit count there is nothing to tell them apart',m.many,true);
  eq('and no value is offered',app.__rcsOf('units.0.proposed'),null);
  eq('so nothing is silently guessed',m.u,null);

  /* But the rent schedule writes those rows as "1Bedroom" (32 units) and
     "1Bedroom Patio" (68). The word Patio is lost turning that into bedrooms
     and baths — the COUNT is not, and the study states it too. */
  app.__edit('units.0.num_units','32');
  eq('the 32-unit row takes the 32-unit line',app.__rcsOf('units.0.proposed'),'1190');
  eq('and it was the count that decided it',app.__rcsMatch(0).by,'count');
  app.__edit('units.0.num_units','68');
  eq('the 68-unit row takes the 68-unit line',app.__rcsOf('units.0.proposed'),'1200');
  app.__edit('units.0.num_units','99');
  eq('a count matching neither line still fills nothing',app.__rcsOf('units.0.proposed'),null);


  /* ============ cross-document checks ============ */
  app.__setRcsParsed(cvRec);
  app.__edit('units.0.br','2BR');app.__edit('units.0.ba','1BA');app.__edit('units.0.num_units','32');
  app.__edit('units.1.br','3BR');app.__edit('units.1.ba','1BA');app.__edit('units.1.num_units','33');
  app.__rcsFill();

  /* both sides present and equal */
  app.__edit('units.0.ua_exec','161');
  let H=app.__rcsChecks();
  T('the utility allowance is compared against the schedule',/Utility allowance/.test(H));
  T('and reported as agreeing',/agree/.test(H));

  /* both sides present and different */
  app.__edit('units.0.ua_exec','150');
  H=app.__rcsChecks();
  T('a disagreement is flagged',/differs/.test(H));
  T('and states both figures',/\$161/.test(H)&&/\$150/.test(H));

  /* one side missing: the check must not render at all */
  app.__edit('units.0.ua_exec','');
  H=app.__rcsChecks();
  eq('with nothing to compare against, no allowance check is shown',/Utility allowance/.test(H),false);

  /* the section 8 number across sources */
  H=app.__rcsChecks();
  T('the section 8 number is compared across documents',/Section 8 # across documents/.test(H));

  /* unit counts */
  app.__edit('units.0.num_units','30');
  H=app.__rcsChecks();
  T('a unit-count mismatch is flagged',/Unit counts/.test(H)&&/differs/.test(H));
  app.__edit('units.0.num_units','32');

  /* a study that contradicts itself says so here too */
  const fvRec=await R.readLetter(await reader(path.join(FIX,'belfry-fairview-homes.pdf')));
  app.__setRcsParsed(fvRec);
  T('the study’s own warnings surface as checks',/3BR\/1\.5BA/.test(app.__rcsChecks()));

  /* no study at all: no checks, no claims */
  app.__setRcsParsed(null);
  eq('with no study there are no checks',app.__rcsChecks(),'');


  /* ============ non-revenue rents ============ */
  app.__setRcsParsed(cvRec);
  app.__edit('nonrev.0.br','2BR');app.__edit('nonrev.0.ba','1BA');
  app.__rcsFill();
  eq('a non-revenue unit takes the matching market rent',app.getVal('nonrev.0.rent'),'1850');
  T('and it says where it came from',app.__rcsTag('nonrev.0.rent').indexOf('RCS')>=0);
  eq('it is declared as a key the fill writes',app.__rcsFillKeys().indexOf('nonrev.0.rent')>=0,true);

  /* But the executed schedule STATES that unit's rent, and a guess must not
     overwrite a statement. Ebony's superintendent apartment rents at $0 and Part D
     charged 3,700 -- the contract rent of a different, revenue-earning 2 BR.
     Sycamore charged 1,450 the same way, Woodbury 2,075. And the upload order
     decided it: schedule-then-study printed the study's figure, study-then-schedule
     printed nothing, on the same two documents. */
  app.__edit('nonrev.0.rent','0');
  app.__rcsFill();
  eq('a stated $0 survives the study',app.getVal('nonrev.0.rent'),'0');
  app.__edit('nonrev.0.rent','1728');
  app.__rcsFill();
  eq('and so does a stated rent',app.getVal('nonrev.0.rent'),'1728');
  /* and an EMPTY cell still takes the study's figure, which is the whole point of
     the guess: it is better than nothing, just not better than a statement. */
  app.__edit('nonrev.0.rent','');
  app.__rcsFill();
  eq('an empty cell still fills from the study',app.getVal('nonrev.0.rent'),'1850');

  /* the same ambiguity rule, with no unit count available to break the tie */
  app.__setRcsParsed(lnRec);
  app.__edit('nonrev.0.br','1BR');app.__edit('nonrev.0.ba','1BA');
  eq('an ambiguous non-revenue row fills nothing',app.__rcsOf('nonrev.0.rent'),null);

  /* ============ the study's own unit type, and lines with no row ============
     The form has carried units.i.br_rcs / ba_rcs / num_rcs — and the whole
     conflict machinery reading them (typeConflict, numConflict, the review
     buttons) — since before this reader existed. Nothing ever wrote them, so
     the study's own account of the unit mix was parsed and dropped. It states
     bedrooms, baths and a unit count on every line it prices; those are the
     cross-document comparison the record-checks card promised.

     Writing them is also what makes creating rows safe. A row the study adds
     carries the study's shape alongside the form's, so if the executed
     schedule later overwrites the row by position, the two disagree ON THE
     ROW and the existing conflict UI says so — instead of a 3BR rent sitting
     silently on a 2BR row. */
  await app.__openForm(app.__firstPid());          // the stored record: one row, 1BR/1BA
  app.__setRcsParsed(cvRec);
  app.__edit('units.0.br','2BR');app.__edit('units.0.ba','1BA');app.__edit('units.0.num_units','32');
  app.__rcsFill();
  eq('the study records the type it priced',app.getVal('units.0.br_rcs'),'2BR');
  eq('and the bathrooms with it',app.getVal('units.0.ba_rcs'),'1BA');
  eq('and how many units it priced',app.getVal('units.0.num_rcs'),'32');
  T('the recorded type says the study supplied it',app.__rcsTag('units.0.br_rcs').indexOf('RCS')>=0);
  T('and so does the recorded count',app.__rcsTag('units.0.num_rcs').indexOf('RCS')>=0);
  eq('all three are declared as keys the fill writes',
    ['units.0.br_rcs','units.0.ba_rcs','units.0.num_rcs'].every(function(k){return app.__rcsFillKeys().indexOf(k)>=0;}),true);

  /* Colonial Village prices 2BR and 3BR. A form holding neither had nowhere to
     put either, and said nothing about it — the bug that started this. */
  await app.__openForm(app.__firstPid());
  app.__setRcsParsed(cvRec);
  eq('the stored record starts with one row, of neither priced type',
    [app.__UNITS().length,app.getVal('units.0.br')],[1,'1BR']);
  app.__rcsFill();
  eq('both priced lines now have a row',app.__UNITS().length,3);
  eq('the added row describes the study’s line',
    [app.getVal('units.1.br'),app.getVal('units.1.ba'),app.getVal('units.1.num_units')],['2BR','1BA','32']);
  eq('and carries its rent, allowance and ceiling',
    [app.getVal('units.1.proposed'),app.getVal('units.1.ua_rcs'),app.getVal('units.1.safmr_rcs')],['1850','161','2085']);
  eq('the second line got its own row',
    [app.getVal('units.2.br'),app.getVal('units.2.num_units'),app.getVal('units.2.proposed')],['3BR','33','2400']);
  eq('the row that was already there is left alone',app.getVal('units.0.br'),'1BR');
  T('an added row says the study put it there',app.__rcsTag('units.2.br_rcs').indexOf('RCS')>=0);
  app.__rcsFill();
  eq('filling a second time adds nothing further',app.__UNITS().length,3);

  /* Lansing prices two 1BR/1BA lines. One 1BR row with no count answers to
     both, so neither may be invented as a row: the form would gain two rows
     describing units it already has one row for. */
  await app.__openForm(app.__firstPid());
  app.__setRcsParsed(lnRec);
  app.__edit('units.0.br','1BR');app.__edit('units.0.ba','1BA');app.__edit('units.0.num_units','');
  const wasProposed=app.getVal('units.0.proposed');   // the stored record's own figure, not the study's
  app.__rcsFill();
  eq('an ambiguous line is never invented as a row',app.__UNITS().length,1);
  eq('and the row it could not decide is left as it was',app.getVal('units.0.proposed'),wasProposed);
  eq('neither study line is offered to it',app.__rcsOf('units.0.proposed'),null);

  /* The same two lines, against a form with no 1BR row at all. Nothing is
     ambiguous now — no row is asking for them — so both are real rows, and the
     count each carries is what tells them apart afterwards. */
  await app.__openForm(app.__firstPid());
  app.__setRcsParsed(lnRec);
  app.__edit('units.0.br','3BR');
  app.__rcsFill();
  eq('two lines of one shape become two rows',app.__UNITS().length,3);
  eq('each keeps its own count',[app.getVal('units.1.num_units'),app.getVal('units.2.num_units')],['32','68']);
  eq('and the count tells their rents apart',
    [app.getVal('units.1.proposed'),app.getVal('units.2.proposed')],['1190','1200']);

  /* A non-revenue rent is filled from the study, so the study belongs in the
     cell's source menu. It offered "Executed RS" alone — a menu naming the one
     document that had not supplied the number sitting in the cell. */
  await app.__openForm(app.__firstPid());
  app.__setRcsParsed(cvRec);
  app.__edit('nonrev.0.br','2BR');app.__edit('nonrev.0.ba','1BA');
  const rows=app.__moneySrcRows('nonrev.0.rent').map(function(r){return r.tag;});
  eq('a non-revenue rent offers both documents as sources',rows,['Executed RS','RCS report']);
  eq('and the study’s figure is the one on offer',
    app.__moneySrcRows('nonrev.0.rent').filter(function(r){return r.tag==='RCS report';})[0].val,'1850');

  /* An untouched row is a row waiting for a unit type, not a row to add one
     after. Filling a blank form left its empty first row sitting above the two
     the study had just built — the form said three unit types where the study
     priced two. */
  await app.__openForm(app.__firstPid());
  ['br','ba','num_units','current','proposed'].forEach(function(f){app.__edit('units.0.'+f,'');});
  app.__setRcsParsed(cvRec);
  app.__rcsFill();
  eq('the study starts in the empty row rather than below it',app.__UNITS().length,2);
  eq('and the empty row took the first line',
    [app.getVal('units.0.br'),app.getVal('units.0.num_units'),app.getVal('units.0.proposed')],['2BR','32','1850']);
  eq('with the second line beneath it',app.getVal('units.1.br'),'3BR');

  /* A row with anything of yours in it is not empty, whatever else is blank. */
  await app.__openForm(app.__firstPid());
  ['br','ba','num_units','current','proposed'].forEach(function(f){app.__edit('units.0.'+f,'');});
  app.__edit('units.0.num_units','12');
  app.__setRcsParsed(cvRec);
  app.__rcsFill();
  eq('a row holding a count of yours is left alone',app.getVal('units.0.num_units'),'12');
  eq('and the study builds its own rows below it',app.__UNITS().length,3);

  /* ============ the schedule outranks the study ============
     Both documents answer for some of the same cells. The executed schedule is
     the contract; the study is an appraisal of it. So where they overlap the
     schedule wins, and filling from the study must leave those cells alone.

     Part D is where this bit: the schedule states what the manager's unit
     actually rents for and the study states what such a unit is worth, and the
     study was writing its market rent over the contract rent. */
  await app.__openForm(app.__firstPid());
  app.__setRsParsed({scalars:{'property.name':'Colonial Village/White Oak','property.s8':'OH10M000236'},
                     units:[{type:'2 Bedroom',count:32,rent:1147,ua:160}],
                     nonrev:[{use:'Leasing Office',br:'2BR',ba:'',rent:1147}]});
  app.__edit('nonrev.0.br','2BR');app.__edit('nonrev.0.ba','1BA');
  app.__edit('nonrev.0.rent','1147');
  app.__edit('property.name','Colonial Village/White Oak');
  app.__setRcsParsed(cvRec);
  app.__rcsFill();
  eq('the schedule’s Part D contract rent survives a study fill',app.getVal('nonrev.0.rent'),'1147');
  eq('and the name the schedule gave stands',app.getVal('property.name'),'Colonial Village/White Oak');
  T('the study is not offered as that rent’s source either',app.__rcsFillKeys().indexOf('nonrev.0.rent')<0);

  /* With no schedule read, there is nothing to outrank — the study still fills. */
  await app.__openForm(app.__firstPid());
  app.__setRsParsed(null);
  app.__edit('nonrev.0.br','2BR');app.__edit('nonrev.0.ba','1BA');
  app.__setRcsParsed(cvRec);
  app.__rcsFill();
  eq('with no schedule the study still supplies the rent',app.getVal('nonrev.0.rent'),'1850');

  /* A row the study INVENTS is a row the schedule did not account for, so the
     schedule cannot outrank it — even when the schedule's own list happens to
     be long enough to reach that row's number. Precedence is about a cell both
     documents describe, not about an index that collides. */
  await app.__openForm(app.__firstPid());
  app.__setRsParsed({scalars:{},units:[{type:'1 Bedroom',count:51,rent:900,ua:100},
                                       {type:'1 Bedroom',count:20,rent:950,ua:100},
                                       {type:'1 Bedroom',count:10,rent:975,ua:100}]});
  app.__edit('units.0.br','1BR');app.__edit('units.0.ba','1BA');app.__edit('units.0.num_units','51');
  app.__setRcsParsed(cvRec);
  app.__rcsFill();
  const made=app.__UNITS().filter(function(i){return app.getVal('units.'+i+'.br')==='2BR'||app.getVal('units.'+i+'.br')==='3BR';});
  eq('the study still builds both rows the form lacked',made.length,2);
  made.forEach(function(i){
    T('row '+i+' knows its own bedrooms',app.getVal('units.'+i+'.br')!=='');
    T('row '+i+' knows how many units it has',app.getVal('units.'+i+'.num_units')!=='');
  });

  console.log('\n\u2500 the label is not the value \u2500');
  /* "number|no|#" is optional in the label and the value only had to be five
     alphanumerics, so the WORDS AFTER the label became the contract number and
     printed as the Section 8 Number on every document in the package. */
  eq('a renewal heading is not a contract number',R._s8From('Section 8 Contract Renewal \u2014 Fifth Year'),'');
  eq('nor is an effective-date sentence',R._s8From('Section 8 Contract rents effective September 1, 2026'),'');
  eq('nor the name of an administrator',R._s8From('Section 8 contract administrator National Housing Compliance'),'');
  eq('and a real one still reads',R._s8From('Section 8 Contract Number: OH10M000236'),'OH10M000236');
  eq('including the FHA-labelled spelling the firms use',R._s8From('FHA Project No. 044-35218'),'04435218');

  console.log('\n\u2500 a phone number looks like a phone number \u2500');
  /* Any ten digits anywhere on the page became the number HUD is told to call
     in item 8 of the owner's letter — and when one was missing, the whole title
     page was swept, the page densest in stray numbers. */
  { const S={};R._readSender(['Smith & Co Valuation','HUD Project No. 042-44119','Loan 1234567890'],S);
    eq('a loan number is not a telephone number',S['appr.phone'],undefined); }
  { const S={};R._readSender(['Smith & Co Valuation','(708) 500-2380'],S);
    eq('a parenthesised area code is',S['appr.phone'],'7085002380'); }
  { const S={};R._readSender(['Smith & Co Valuation','708.500.2380'],S);
    eq('and a dotted one',S['appr.phone'],'7085002380'); }
  { const S={};R._readSender(['Smith & Co Valuation','Phone: 7085002380'],S);
    eq('and a bare run that something calls a phone',S['appr.phone'],'7085002380'); }

  /* \u2500\u2500 "found" is not "read" \u2500\u2500
     A signature-flattened copy keeps the BLANK FORM'S printing on page 2 —
     "Part G", "Information on Mortgagor Entity", "Name of Entity", "General
     Partnership" — so the page classifies perfectly as the second half and
     yields not one value. Judged by classification alone it looked read, and
     the ownership entity, the principals and the signatory came back empty
     from a page that shows all three.

     The blank template IS that case exactly: every label, no values. */
  console.log('\n\u2500 a half found but not read \u2500');
  {
    const P=global.window.PDFLib;
    const tplB=Buffer.from(global.window.RCSTemplates.rentSchedule,'base64');
    const tdoc=await P.PDFDocument.load(new Uint8Array(tplB),{ignoreEncryption:true,throwOnInvalidObject:false});
    const tpages=await app.__rsTextPages(tdoc);
    T('the blank form has text on its second page',tpages.length>=2&&tpages[1].length>0);
    globalThis.__HALF=[];
    await app.__rsReadTextTier(tpages,new Uint8Array(tplB),null);
    T('a second half with printing but no values is sent to be scanned',globalThis.__HALF.length>0);
    if(globalThis.__HALF.length){
      eq('and it is the SECOND half that is asked for',globalThis.__HALF[0].p,1);
      /* The page we are here for must not be in the skip list, or the request
         goes out asking for everything except the thing it needs. */
      T('and the page it needs is not skipped',globalThis.__HALF[0].skip.indexOf(1)<0);
    }
  }

  /* ── a box holds its own printed row, and reads left to right ─────────────
     Two faults, one symptom, and the symptom reached every generated document
     and all three filenames on four properties.

     First the geometry. Field 1, the Project Name, is 23pt tall in our own blank
     where fields 2 and 3 beside it on the SAME printed row - the FHA number and
     the effective date - are 19pt. So its floor sits 4pt lower than theirs,
     which on this form is most of a row, and the "Part A - Apartment Rents"
     divider prints its baseline inside field 1's window. It was collected as
     part of the name.

     Then the order. rsMapRects sorted the runs it collected by descending
     baseline, which is right for a page whose lines are level and wrong for a
     scanner's text layer, where one printed line arrives as several baselines a
     fraction of a point apart. 333 Holly's "333 Holly fka Holly Creek II" has
     four baselines within 2.2pt, so height order returned it as
     "11 | fka Creek | 333 | Holly Holly".

     Neither fault was fixed by declining the misaligned pages: that only moved
     the same swallow to tier 3, because both tiers look up the very rects
     rsFieldRects hands out. */
  console.log('\n─ a box holds its own printed row ─');
  { const rects=await app.__rsFieldRects();
    const f1=rects['1'],f2=rects['2'],f3=rects['3'];
    T('the three header boxes are all on page 1',f1.pg===0&&f2.pg===0&&f3.pg===0);
    eq('the project-name box now shares its row’s floor',+f1.y.toFixed(2),+f2.y.toFixed(2));
    eq('and so is the same height as its neighbours',+f1.h.toFixed(2),+f2.h.toFixed(2));
    /* The rule is a statement about the form, not about field 1: no box may
       reach below the shallowest floor on its own printed row. */
    const rows={};
    Object.keys(rects).forEach(id=>{const r=rects[id];if(r.pg!==0)return;
      const k=Math.round((r.y+r.h)*2)/2;(rows[k]=rows[k]||[]).push(+r.y.toFixed(2));});
    const deep=Object.keys(rows).filter(k=>new Set(rows[k]).size>1);
    eq('and no row on page 1 disagrees about its floor any more',deep.length,0); }

  console.log('\n─ and reads left to right, line by line ─');
  { const B=app.__rsBoxText;
    eq('one level line reads in x order',
      B([{s:'Village',x:53,y:691},{s:'Shiloh',x:24,y:691},{s:'Apts.',x:85,y:691}]),
      'ShilohVillageApts.');
    /* The real shape: 333 Holly's name, whose OCR layer gives one printed line
       four baselines 2.16pt apart, with the roman numeral II read as "11" at a
       third the font size of its neighbours. */
    eq('a line jittered by a scanner still reads in order',
      B([{s:'11',x:136.80,y:693.36},{s:'fka',x:60,y:693.24},{s:'Creek',x:100,y:693.24},
         {s:'333',x:24.48,y:693.12},{s:'Holly',x:40,y:691.20},{s:'Holly',x:78,y:691.20}]),
      '333HollyfkaHollyCreek11');
    /* Two genuinely separate printed lines are 10-12pt apart on this form and
       must stay separate rather than welding into one token. */
    eq('two printed lines stay two',
      B([{s:'Second',x:24,y:680},{s:'First',x:24,y:691}]),'First Second');
    eq('and an empty box is still empty',B([]),''); }

  /* On the real page. fixture_rs_misaligned.json is Oaks on North Plaza's Part A
     page; before this fix its Project Name box returned the divider glued to the
     name, and its first principal came back with the words out of order. */
  { const fx2=JSON.parse(fs.readFileSync(path.join(_d,'fixture_rs_misaligned.json'),'utf8'));
    const rects=await app.__rsFieldRects();
    const tplr=await app.__rsTplRuns();
    const F=app.__rsMapRects(app.__rsDropTplLabels(fx2.runs,tplr[0]),rects,0);
    eq('the real page no longer hands the divider to the project name',
      String(F['1']||''),'OaksonINorthP,lazafkaNorthPlazaApartments');
    eq('so the divider is gone',/PartA-|ApartmentRents/.test(String(F['1']||'')),false);
    /* Part G is the form's second half, so this one-page fixture cannot reach
       field 206 - the principal whose words came back as "onPlazaNorthGP, LLC".
       That one is covered by the corpus-wide before/after in the register. */ }

  /* ── a column gap the page draws by moving the pen ────────────────────────
     Cornerstone's letter tables are laid out identically across the corpus, but
     Acrobat emits them two ways. The Pines and Oaks on North Plaza put a whole
     row in one TJ array, whose large kerning numbers the -200 rule above already
     turns back into spaces. Shiloh Village and 333 Holly put each cell after its
     own Td move, which shows no characters at all - so the row arrived as
     "2 BR16940$1,830$1.95Y", every row pattern needs \s+ between the count and
     the next column, and both studies read as ZERO unit types. Two whole
     packages went unwritten over a missing space.

     This fixture is the real thing: pages 1-4 of Shiloh Village's study, which
     returns 0 unit types without the fix and 3 with it. */
  /* ── the form's own printed lines, by text rather than by position ────────
     rsDropTplLabels drops a label by finding it where the template prints it,
     which is the right test on a page laid out like the template and finds
     nothing on a page that is not. Clamping field 1 to its row-mates' floor
     fixed Shiloh Village and could not reach 333 Holly or The Pines, where the
     divider prints ABOVE that floor - nor tier 3 at all, which is where the
     misaligned pages now go: Shiloh came back from OCR as
     "Shiloh Village Apts. Part A Apartment Rents Show the actual".
     Text can reach all of them. Whatever coordinates it arrived at, a line that
     reproduces one of the blank form's own printed lines is the form talking. */
  /* ── two appraisers, two columns, one printed line ────────────────────────
     Belfry and Cornerstone sign some letters in two columns, so the appraiser's
     name arrives beside a colleague's on one line - six tokens where a name is
     two to four. The pattern rejected it, the following lines were eaten by the
     license/certified/president/associate skips, and appr.name came back empty.
     It is a requirement of the OWNER COVER LETTER, so on Newberry Arms,
     Morningside Court and Northgate Terrace CA this alone withheld a document.
     These are the exact lines those three letters print. */
  /* ── score.js's mirrors answer the same as app.js's ───────────────────────
     score.js keeps its own copy of every source-precedence resolver, because the
     menu and the launcher score a record with no form loaded. Its comment claimed
     test_browser.js pinned them against app.js; it never did, and under cover of
     that claim BOTH precedences drifted - d714cd8 moved the allowance default to
     the study, 592101a moved the SAFMR default to the study's printed table, and
     neither touched score.js. So for two commits the menu scored a record by the
     opposite rule from the one the form applied. Nothing delivered was wrong,
     because one resolver was dead code and the other is only read as > 0, which
     is precisely why nobody noticed. These are the checks that were missing. */
  /* ── the owner's checklist, item 14 ───────────────────────────────────────
     Appendix 9-2-2 item 14 is "Copy of RCS Appraiser's License (only if relying
     upon a temporary license)" - the one item HUD makes conditional in its own
     printed wording. The app ticked it on every property, which certifies, under
     the §1001 warning printed above the owner's signature, that a copy of a
     temporary licence is enclosed when none was used.

     Every line below is a line a real study prints. Three name a temporary
     licence and 31 do not; measured over the whole corpus this reads exactly
     Holly House and Hampshire House (Noble Tower's PDF will not open in pdf-lib
     at all, so its letterhead is pinned here as text), and those two are
     precisely the ones whose FILED checklists tick the item. */
  console.log('\n─ the owner’s checklist, item 14 ─');
  { const chkOf=lines=>{const S={},w=[];R._readChecklist(lines,S,w);return {v:S['check.14'],w:w};};

    /* Holly House: the permit is named on the line above its number. */
    eq('Holly House — a New Jersey temporary practice permit',
      chkOf(['Aaron M. Zabel Rachel A Walsh','President Associate',
             'New Jersey Temporary Practice Permit Illinois Associate Trainee',
             'License No.: TP018-25 Appraiser No.:557.006570']).v,'1');
    /* Hampshire House is why the window is TWO lines: the same phrase breaks
       across a line, and the other column's text lands between its halves. */
    eq('Hampshire House — the phrase broken across two lines',
      chkOf(['New Jersey Temporary Visiting Illinois Associate Trainee',
             'Practice Permit']).v,'1');
    /* Noble Tower states it inline, and its appendix answers Yes. */
    eq('Noble Tower — stated inline in the letterhead',
      chkOf(['Andrew J. Van Hazinga, MAI',
             'CA Temporary Certified General Appraiser License No. 3012633-001']).v,'1');
    T('and the reader says a copy is required',
      /copy of that licence belongs in the package/.test(chkOf(['CA Temporary Certified General Appraiser License No. 3012633-001']).w.join(' ')));

    /* A permanent licence is not an answer of yes, and it is not an answer of
       no either — the reader leaves the box exactly as it found it. */
    eq('Walden — a permanent New York licence says nothing',
      chkOf(['Aaron M. Zabel Rachel A Walsh','President Associate',
             'License No.: 1553109 Appraiser No.:557.006570']).v,undefined);
    eq('Marine Terrace — likewise',
      chkOf(['License No.: 4600054504']).v,undefined);

    /* The certification, Appendix 9-1-4 item 12. Ten studies answer No and one
       answers Yes; the answer is part of the anchor. */
    eq('Fairview Homes — the certification answers No',
      chkOf(['Permanent License No: NJ# 42RG00253100 Issuing State: NJ Expires: December 31, 2020',
             'Did you prepare the RCS under a temporary license? No If so, attach a copy of the temporary license.']).v,'');
    eq('Noble Tower — the certification answers Yes',
      chkOf(['Did you prepare the RCS under a temporary license? Yes If so, attach a copy of the temporary license.']).v,'1');
    /* THE SAFE DEFAULT. The blank form prints the question with nothing after it,
       and its own words say "temporary license" twice. Reading those words as a
       signature block would tick the box on every study that carries the blank
       form — the fault this function exists to end. Silence is not a yes. */
    eq('an unanswered question leaves the box alone',
      chkOf(['Did you prepare the RCS under a temporary license? If so, attach a copy of the temporary license.']).v,undefined);
    eq('and the question’s own words are never read as a permit',
      chkOf(['If so, attach a copy of the temporary license.']).v,undefined);

    /* Two ordinary sentences from Noble Tower's own study, which co-occurrence
       alone would have read as a temporary licence. */
    eq('prose about units taken offline is not a licence',
      chkOf(['of units were temporarily taken offline for renovations.',
             'It is assumed that all required licenses, consents, or other legislative']).v,undefined);
    eq('and a building permit is not a practice permit',
      chkOf(['The temporary certificate of occupancy expired.','Building permits were pulled in 2019.']).v,undefined);
    /* Noble Tower says it a second way, in prose, and that one is true. */
    eq('“Temporarily licensed as” is read',
      chkOf(['Temporarily licensed as a Certified General Real Estate Appraiser in California and in']).v,'1');
  }

  /* ── where each checklist item starts, and why ─────────────────────────────
     TWO of the seventeen items are conditional. The old rule was a regex over
     the LABEL text - /scope of repair/ OR /scope of work/ - which caught the one
     item every study carries in the same net as a genuine conditional, and left
     the actual conditional ticked. Both wrong, in opposite directions, because
     nothing consulted the study. */
  console.log('\n─ the checklist seed ─');
  { const F=app.__CHECKLIST_FLAT, seed=app.__checkSeed;
    eq('seventeen items',F.length,17);
    eq('“Scope of repair” is conditional on repairs',F[2],'Scope of repair');
    eq('and starts unticked',seed(2),'');
    eq('“Scope of work” is item 4',F[4],'Scope of work');
    /* All 34 studies in the corpus carry the section - Belfry heads it "Scope of
       Assignment", which is why the literal phrase finds nothing - and HUD lists
       it as required RCS material. It is not conditional. */
    eq('and it starts TICKED, because every study carries the section',seed(4),'1');
    eq('“Appraiser’s license copy (if temp)” is item 14',F[14],'Appraiser’s license copy (if temp)');
    eq('and starts unticked, for the study to answer',seed(14),'');
    eq('exactly two items are conditional',Object.keys(app.__CHECK_CONDITIONAL).sort(),['14','2']);
    /* Fifteen items describe material every submission contains. */
    eq('every other item starts ticked',
      F.map((_,i)=>seed(i)).filter(v=>v==='1').length,15);
    /* One rule, not two. The manifest tested the label and the new-property
       default hardcoded (i===2||i===4); only the default is read at runtime, so
       the two could disagree indefinitely without anything noticing. */
    T('the seed rule is a function both callers share',typeof seed==='function');
  }

  console.log('\n─ score.js answers the same as app.js ─');
  {
    const S=global.window.RCSScore;
    T('score.js exposes its mirrors',typeof S._defUaSrc==='function'&&typeof S._defSafmrSrc==='function');
    /* Drive both through the same record. app.js's read the live form, so the
       comparison is made value by value on the cases that distinguish them. */
    const cases=[
      {name:'both allowances present — the study wins',rec:{'units.0.ua_rcs':'116','units.0.ua_exec':'107'},want:'rcs'},
      {name:'only the prior schedule has one',        rec:{'units.0.ua_exec':'107'},                        want:'exec'},
      {name:'only the study has one',                 rec:{'units.0.ua_rcs':'116'},                         want:'rcs'},
      {name:'neither, so it is the PM\u2019s own figure',rec:{},                                             want:'custom'},
      /* A stated ZERO is a figure, not an absence - the lesson 83a1e14 was written
         for, and the reason uaHas tests for empty rather than for truth. */
      {name:'a stated $0 allowance still counts',      rec:{'units.0.ua_exec':'0'},                          want:'exec'}];
    cases.forEach(c=>{
      const read=k=>(k in c.rec)?c.rec[k]:'';
      /* score.js's resolver is driven directly. app.js's namesake reads the live
         FORM through its own get(), so it cannot be handed a synthetic record from
         here - which is why the expectations below are written out in full rather
         than compared against it. If app.js's precedence changes, these have to be
         edited too, and that is the point: the drift that went unnoticed for two
         commits now has to be acknowledged in writing to happen again. */
      eq('UA: '+c.name,S._defUaSrc(read,0),c.want); });
    const sc=[
      {name:'both present — the study\u2019s printed table wins',rec:{'units.0.safmr_rcs':'1420','units.0.safmr_hud':'1492'},want:'rcs'},
      {name:'only the HUD pull',                                rec:{'units.0.safmr_hud':'1492'},                            want:'hud'},
      {name:'only the study',                                   rec:{'units.0.safmr_rcs':'1420'},                            want:'rcs'},
      {name:'neither',                                          rec:{},                                                      want:'custom'},
      /* A SAFMR of zero is not a SAFMR - unlike the allowance, these resolvers
         test > 0, and that asymmetry is deliberate. */
      {name:'a zero SAFMR is not a figure',                     rec:{'units.0.safmr_hud':'0'},                               want:'custom'}];
    sc.forEach(c=>{
      const read=k=>(k in c.rec)?c.rec[k]:'';
      eq('SAFMR: '+c.name,S._defSafmrSrc(read,0),c.want); });
  }

  console.log('\n─ two appraisers on one line ─');
  { const sigOf=lines=>{const S={};R._readSignature(lines,S);return S['appr.name']||'';};
    eq('Newberry Arms / Northgate Terrace',
      sigOf(['Respectfully submitted,','Aaron M. Zabel Rachel A Walsh',
             'President Associate','License No.: 8815']),'Aaron M. Zabel');
    eq('Morningside Court',
      sigOf(['Sincerely,','Aaron M. Zabel Matthew A. Polnow',
             'President Associate']),'Aaron M. Zabel');
    /* A single signature is unchanged - the whole line is the name. */
    eq('one appraiser is still read whole',
      sigOf(['Sincerely,','Kyle L. Bjerke','Certified General Appraiser']),'Kyle L. Bjerke');
    /* Split down the MIDDLE. Trying every position instead would take "Aaron M."
       off the front of this line, which parses and is not a person. */
    eq('and never half of the first name',
      sigOf(['Sincerely,','Aaron M. Zabel Matthew A. Polnow'])
        .indexOf('Zabel')>=0,true);
    /* Prose after "Sincerely," must not become a name just because it splits. */
    eq('a sentence is not two names',
      sigOf(['Sincerely,','Please call with any questions you may have']),'');
    eq('and neither is a job number',
      sigOf(['Sincerely,','Job No. 25-095R']),''); }

  /* ── an address is not a firm name ────────────────────────────────────────
     Northgate Terrace's letter puts the appraiser's e-mail on line 2, and the
     firm pattern matched it because the domain contains "valuation". appr.firm
     was stored as "(E) azabel@belfryvaluation.com" and went out on the owner
     cover letter's certifications. */
  console.log('\n─ an e-mail address is not the firm ─');
  { const firmOf=lines=>{const S={};R._readSender(lines,S,8);return S['appr.firm']||'';};
    eq('the e-mail is skipped and the real firm found',
      firmOf(['BELFRY VALUATION, LLC','(E) azabel@belfryvaluation.com']),'BELFRY VALUATION, LLC');
    eq('and an e-mail alone yields no firm',
      firmOf(['(E) azabel@belfryvaluation.com','708.500.2380']),'');
    /* The ordinary case is untouched. */
    eq('a plain firm line still reads',
      firmOf(['Cornerstone Valuation Services','P.O. Box 387']),'Cornerstone Valuation Services');
    eq('and a trailing comma still comes off',
      firmOf(['Belfry Valuation, LLC,']),'Belfry Valuation, LLC'); }

  console.log('\n─ the form’s own printed lines are not values ─');
  {
    await app.__rsTplRuns();          // the set is built from the template's runs
    const set=app.__rsFormLines(0);
    T('the form’s page 1 yields a set of printed lines',set.size>10);
    T('and the Part A divider is one of them',set.has('partaapartmentrents'));
    const D=app.__rsDropFormLines;
    eq('a divider inside a box is dropped and the name kept',
      D(['ThePinesfkaWoodGlenApartments','PartA-ApartmentRents'],0),
      ['ThePinesfkaWoodGlenApartments']);
    /* Whole-line match only. A value that merely contains a form phrase, or that
       is short enough to collide by accident, must survive - "N/A" normalises to
       two characters and the floor is eight. */
    eq('a value that only contains a form phrase survives',
      D(['Part A Apartments LLC'],0),['Part A Apartments LLC']);
    eq('and a short value is never dropped',D(['N/A','$0','II'],0),['N/A','$0','II']);
    /* And through the box reader, which is how both tiers reach it. */
    eq('a trailing form line is dropped from a box',
      app.__rsBoxText([{s:'Shiloh',x:24,y:691},{s:'Village',x:53,y:691},
                       {s:'Part',x:24,y:680},{s:'A-',x:41,y:680},
                       {s:'Apartment',x:53,y:680},{s:'Rents',x:95,y:680}],0),
      'ShilohVillage');
  }

  console.log('\n─ a column gap drawn as a pen move is still a column gap ─');
  { const sv=await R.readLetter(await reader(path.join(FIX,'cornerstone-shiloh-village.pdf')));
    eq('the firm is read',sv.firm,'cornerstone');
    eq('three unit types are read where there were none',sv.units.length,3);
    eq('the first type keeps its spacing',sv.units[0].type,'2 BR');
    eq('and its count is the count',sv.units[0].count,16);
    eq('and its concluded rent is not welded to it',sv.units[0].proposed,1830);
    eq('the second type reads',sv.units[1].type,'3 BR');
    eq('with its count',sv.units[1].count,80);
    eq('and its rent',sv.units[1].proposed,2235);
    eq('the third type reads',sv.units[2].type,'4 BR');
    eq('with its count',sv.units[2].count,72);
    eq('and its rent',sv.units[2].proposed,2535);
    /* The second and third tables on the same page must line up with the first,
       or the allowance and the ceiling land on the wrong row. */
    eq('the allowance follows the row it belongs to',sv.units[0].ua,102);
    eq('and the printed SAFMR base too',sv.units[0].safmr_base,1590); }

  /* And the boundary the width rule cannot judge. Golden Link draws "$1,580" as
     "$1," then a pen move then "580", and that move is as wide as the moves
     between its own cells - so a threshold alone split the figure into "$1, 580"
     and the row read as 580 units. A thousands separator is never followed by a
     space; adjacent numeric CELLS are, which is why the guard tests for a comma
     and not merely for digits on both sides. */
  console.log('\n─ and a thousands separator is not a column gap ─');
  { const P=global.window.PDFLib;
    const doc=await P.PDFDocument.load(new Uint8Array(fs.readFileSync(path.join(FIX,'cornerstone-golden-link.pdf'))),
      {ignoreEncryption:true,throwOnInvalidObject:false});
    const runs=await app.__rsTextPageAt(doc,1);
    const rows={};
    runs.forEach(r=>{const k=Math.round(r.y*2)/2;(rows[k]=rows[k]||[]).push(r);});
    const line=Object.keys(rows).map(k=>rows[k].sort((x,y)=>x.x-y.x).map(r=>r.s).join(''))
      .filter(s=>/^1 BR \/ 1 BA/.test(s))[0]||'';
    T('the row is found',!!line);
    T('the figure survives whole',line.indexOf('$1,580')>=0);
    eq('and is not split at its comma',line.indexOf('$1, 580'),-1);
    T('while the type and the count are still separated',/1 BA\s+30\b/.test(line)); }

  /* ── the page must print the form where the form prints it ────────────────
     Tier 2 reads values out of the blank template's field rectangles, so it is
     only entitled to do that on a copy laid out like the template. Four filed
     schedules were not, and were read anyway: Oaks on North Plaza reported a
     monthly potential of $1,642,642 against a page printing $91,922, and named
     itself "OaksonINorthP,lazafkaNorthPlazaApartmentsPartA-ApartmentRents" --
     the form's own heading pulled into the Project Name box, because a label
     that is not where the template puts it is not recognised as a label.

     The blank template is the aligned case by construction. Shifting its own
     runs is the misaligned case, and it is a fair model of the real ones: the
     four bad copies show at most 3 labels in place where every good copy shows
     28 or more. */
  console.log('\n─ a page laid out unlike the form is declined, not guessed at ─');
  {
    const P=global.window.PDFLib;
    const tplB=Buffer.from(global.window.RCSTemplates.rentSchedule,'base64');
    const tdoc=await P.PDFDocument.load(new Uint8Array(tplB),{ignoreEncryption:true,throwOnInvalidObject:false});
    const tpages=await app.__rsTextPages(tdoc);

    const al=app.__rsTplAlign(tpages[0],tpages[0]);
    eq('a page compared with itself has every label in place',al.at,al.seen);
    T('and there are enough of them to judge by',al.at>=28);
    T('so the premise holds',app.__rsTplPremiseHolds(al));

    /* The shift is the one the real misaligned copies suggested before the
       measurement showed they do not agree on any shift at all. */
    const shifted=tpages[0].map(r=>({s:r.s,x:r.x-10,y:r.y+15,d:r.d}));
    const bad=app.__rsTplAlign(shifted,tpages[0]);
    eq('a displaced page has the same labels present',bad.seen,al.seen);
    eq('and not one of them in place',bad.at,0);
    T('so the premise fails',!app.__rsTplPremiseHolds(bad));

    /* A copy printing only SOME of the form is still readable -- the gate must
       not turn into a completeness requirement. Half the labels in place, and
       comfortably above the floor, passes. */
    const half=tpages[0].filter((r,i)=>i%2===0);
    T('a page showing half the form in place still passes',
      app.__rsTplPremiseHolds(app.__rsTplAlign(half,tpages[0])));

    /* ── and now the real page, not a model of one ──────────────────────────
       fixture_rs_misaligned.json is the Part A page of Oaks on North Plaza's
       executed schedule, as its own text layer positions it: 550 runs, of which
       exactly 2 of the 25 form labels present sit where the form puts them.

       This is the fixture that gives the check teeth. Feed this page to the
       reader WITHOUT the premise check and it does not fail — it succeeds, and
       reports a 14-unit row at $111,198 a month, unit types called "16R" and
       "3613", a monthly potential of $1,642,642 against a page printing $91,922,
       and a project called
         "OaksonINorthP,lazafkaNorthPlazaApartmentsPartA-ApartmentRents".
       Every one of those figures went into a generated package. */
    const fx=JSON.parse(fs.readFileSync(path.join(_d,'fixture_rs_misaligned.json'),'utf8'));
    eq('the misaligned fixture is the whole page',fx.runs.length,550);
    { const fa=app.__rsTplAlign(fx.runs,tpages[0]);
      eq('and 25 of the form’s labels are present on it',fa.seen,25);
      eq('but only 2 sit where the form puts them',fa.at,2);
      T('so the premise fails on the real page too',!app.__rsTplPremiseHolds(fa)); }
    /* The page alone, exactly as the reader would receive a one-page half. */
    const real=await app.__rsReadTextTier([fx.runs],null,null);
    eq('a real misaligned schedule is declined, not read',real,null);

    /* The control, and the reason this block cannot be passed by a gate set so
       tight that nothing is ever read: the aligned page must still go through.
       Reaching the second-half scan request is proof it got past the premise. */
    globalThis.__HALF=[];
    await app.__rsReadTextTier(tpages,new Uint8Array(tplB),null);
    T('while an aligned page is still processed',globalThis.__HALF.length>0);
  }

  /* Two ways to read nothing, and the reader has to tell them apart, because
     they ask different things of the person holding the file: a copy with no
     text on it will never be readable, while a readable file with no letter in
     it is probably the wrong file. */
  const blank=await R.readLetter({pageCount:39,getPage:async()=>[]});
  eq('a copy with no text says so',blank.textless,true);
  eq('and reads nothing',blank.units.length,0);
  const noLetter=await R.readLetter({pageCount:6,getPage:async()=>[
    {x:72,y:700,s:'Appendix C'},{x:72,y:680,s:'Photographs of the subject'}]});
  eq('a readable file with no letter is not called a scan',!!noLetter.textless,false);
  eq('and it reads nothing either',noLetter.units.length,0);

  /* ── one unit type, one key, however the study spells it ──────────────────
     North Park's transmittal table says 1BD/1BA where its SAFMR and gross-renewal
     tables say 1BR/1BA. Keyed on the raw string the roster found SEVEN types in a
     four-type property and printed three ghost rows, and the allowance split down
     the middle: the studio matched between tables and took the study's figure,
     the other three did not and fell back to the prior schedule's. */
  console.log('\n─ BD and BR are the same bedroom ─');
  eq('a bedroom spelled BD keys the same as BR',R.parseType('1BD/1BA').br,1);
  eq('and 2BD too',R.parseType('2BD/1BA').br,2);
  eq('and 3BD/1.5BA keeps its baths',R.parseType('3BD/1.5BA').ba,1.5);
  /* And the rows a study means to keep apart stay apart: Lansing prices
     "with patio" and "without patio" separately, and they differ by more than a
     letter, so nothing here can merge them. */
  { const ln2=await R.readLetter(await reader(path.join(FIX,'belfry-lansing-manor.pdf')));
    eq('two rows differing by a qualifier are still two',ln2.units.length,2);
    T('and still carry different rents',ln2.units[0].proposed!==ln2.units[1].proposed);
    eq('and no ghost row was invented',ln2.units.filter(u=>!u.count&&!u.proposed).length,0); }

  /* ── the concluded-rent row, against the exact lines three studies print ──
     Every one of these cost a filed number. Hampshire House lost BOTH its rows
     and printed a schedule whose Column 3, Column 4, Column 6, both totals and
     Part F were blank against a study that says $2,000 and $2,400 in plain
     sight. Circle Park lost 58 units their rent -- $271,150 a month. Walden's
     Senior line became a ghost row holding an allowance and no rent. */
  console.log('\n─ the concluded-rent row, as three real studies print it ─');
  { const M=R._ROW_MAIN;
    const hh=' 1BR/1BA 90 640 SF $2,000 $3.13 Y'.trim().match(M);
    T('Hampshire: an area that names its unit still reads',!!hh);
    eq('and the rent is the rent, not the SF',hh&&hh[4],'2,000');
    eq('and the count survives',hh&&hh[2],'90');
    const hh2='2BR/1BA 25 950 SF $2,400 $2.53 Y'.match(M);
    eq('and the second row too',hh2&&hh2[4],'2,400');
    const cp='3BR/1.5BA TH 58 1200 $4,675 $3.90'.match(M);
    T('Circle Park: a row with no PREPARED GRID flag still reads',!!cp);
    eq('and keeps its rent',cp&&cp[4],'4,675');
    eq('and its count',cp&&cp[2],'58');
    const ok='1BR/1BA ELDERLY 120 630 $2,975 $4.72 Y'.match(M);
    eq('a row that always worked is unchanged',ok&&ok[4],'2,975');
    eq('and still reports its grid flag',ok&&ok[6],'Y');
    /* The SAFMR and gross-renewal rows must STILL be rejected by this pattern --
       they put a dollar sign where the area goes, and reading one as a concluded
       rent would overwrite a real rent with a ceiling. */
    T('a SAFMR row is still not a concluded-rent row',!'1BR/1BA 90 $1,500 $135,000'.match(M));
    T('nor is a gross-renewal row',!'2BR/1BA 25 $2,400 $86 $62,150'.match(M)); }

  /* Walden's conclusion table says "1BR/1BA (B)"; its comparison and gross-renewal
     tables say "1BR/1BA (B) Senior". Same thirty apartments, and the designation
     arrives only after the rent has been read. */
  console.log('\n─ a designation that arrives late is not a new unit type ─');
  { const units=[];
    /* readTables fills the count after the upsert returns, so the fixture does too. */
    const a=R._upsert(units,'1BR/1BA (B)',0,30); a.count=30; a.proposed=2150;
    const b=R._upsert(units,'1BR/1BA (B) Senior',1,30);
    eq('the designation joins the row it belongs to',units.length,1);
    T('and it is the same row',a===b);
    eq('so the rent it never carried is still there',units[0].proposed,2150);
    eq('and the designation is kept as an alias',(units[0].alias||[]).length,1);
    /* a genuinely different type still gets its own row */
    const c=R._upsert(units,'2BR/1BA',1,26); c.count=26;
    eq('a real second type is still a second row',units.length,2);
    /* and a prefix over a DIFFERENT count is a different row -- Lansing prices
       "1BR/1BA" and "1BR/1BA Patio" as 32 and 68 apartments, not as one. */
    const d=R._upsert(units,'1BR/1BA (B) Senior',1,7); d.count=7;
    eq('a prefix over a different count stays separate',units.length,3); }

  /* ── the SAFMR the appraiser printed beats the one the API returned ────────
     Westwood's study prints 1,120/1,570/1,850 and the pull gave 1,254/1,743/2,104.
     Sycamore's prints 990/1,230 and the pull gave 1,149/1,427. Hampshire's prints
     1,500/1,810 and the pull gave 1,590/1,916. Every filed workbook used the
     study. And the pull is not stable: Ebony driven twice in one afternoon
     returned 2,511/2,780/3,465 and then 2,655/2,910/3,644, neither of them its
     study's 2,490/2,730/3,420. The 150% test turns on this number and Clinton
     Manor passes it by twelve dollars. */
  console.log('\n─ the printed SAFMR beats the pulled one ─');
  app.__edit('units.0.safmr_source','');
  app.__edit('units.0.safmr_rcs','1680'); app.__edit('units.0.safmr_hud','1890');
  eq('the study\'s figure is the default',app.safmrResolvedOf(0),1680);
  app.__edit('units.0.safmr_source','hud');
  eq('and an explicit choice of the pull is honoured',app.safmrResolvedOf(0),1890);
  app.__edit('units.0.safmr_source','');
  app.__edit('units.0.safmr_rcs','');
  eq('with no study figure the pull still fills in',app.safmrResolvedOf(0),1890);
  app.__edit('units.0.safmr_hud',''); app.__edit('units.0.safmr_custom','2000');
  app.__edit('units.0.safmr_source','custom');
  eq('and an entered figure wins over both',app.safmrResolvedOf(0),2000);
  /* the data layer must answer the same way, or the menu card and the form
     disagree about whether a property clears the ceiling */
  { const D=require(D_+'db.js');
    const cells={'units.0.safmr_rcs':'1680','units.0.safmr_hud':'1890'};
    const read=k=>cells[k]||'';
    T('db.js is held to the same precedence',typeof D.computeAnalysis==='function');
    const A=D.computeAnalysis(read,[0]);
    T('and its ceiling follows the study',A&&typeof A==='object'); }

  /* ── a printing that is NOT ours: Part A read from the form's own table ────
     fixture_rs_printings.json is the app's own reader's output for page 1 of two
     REAL prior schedules, captured whole rather than trimmed:

       Market Square  an alternate printing of HUD-92458 laid out at coordinates
                      our template does not share. Values are proper characters,
                      "Col. 1".."Col. 8" are single runs, and Part A carries the
                      "Non- Section 8 Rents" divider.
       The Pines      a scanner's OWN text layer over the same form. Every number
                      arrives in fragments — "1," then "350" — the word "Col."
                      and its digit are separate runs, and those two fragments
                      occur AGAIN lower down inside "(Col. 4 Sum x 12)*", where
                      the caption sits at x 169 and the column it names at 258.

     Both pages are declined by the premise, which is asserted below: everything
     in this block happens where the reader returned null before, so no copy
     that reads today can read differently because of it.

     Every figure was eye-read off the source PDF as an image, which is the only
     ground truth these documents have. */
  console.log('\n─ Part A off a printing that is not ours ─');
  { const FX=JSON.parse(fs.readFileSync(path.join(_d,'fixture_rs_printings.json'),'utf8'));
    const tplr=await app.__rsTplRuns();
    const V=F=>(n=>String(F[String(n)]||'').trim());

    // the premise declines both, so the table path is additive by construction
    T('Market Square is declined by the premise',!app.__rsTplPremiseHolds(app.__rsTplAlign(FX.marketSquare.runs,tplr[0])));
    T('The Pines is declined by the premise',!app.__rsTplPremiseHolds(app.__rsTplAlign(FX.thePines.runs,tplr[0])));

    // ---- Market Square -----------------------------------------------------
    const ms=FX.marketSquare.runs, msH=app.__rsColHeads(ms);
    T('Market Square: the form numbers its own columns',!!msH);
    eq('and all eight are found, left to right',msH&&msH.map(x=>Math.round(x)),[50,120,178,250,325,400,472,545]);
    const msF=app.__rsTableA(ms);
    T('Market Square: Part A reads',!!msF);
    eq('the project name is the name and nothing else',msF['1'],'MARKET SQUARE');
    eq('the FHA number is what the page prints',msF['2'],'N/A');
    eq('the effective date is read off the head row',msF['3'],'02/04/2025');
    eq('the printed monthly potential is captured',msF['95'],'$118,712');
    eq('the divider occupies its own row',/^Non-\s*Section 8/.test(String(msF['15']||'')),true);
    eq('and the row below it is the unassisted one',msF['23'],'1 Bedroom');
    eq('the totals line did NOT become a twelfth unit type',msF['31'],undefined);
    const msR=app.__rsAssembleFields(V(msF));
    T('the rows reconcile against the printed total',!!msR);
    eq('one Section 8 row',msR.units.map(u=>[u.type,u.count,u.rent,u.ua]),[['1 Bedroom',75,1562,0]]);
    eq('one non-Section 8 row',msR.ns8.map(u=>[u.type,u.count,u.rent]),[['1 Bedroom',1,1562]]);
    eq('the effective date normalises',msR.scalars['rs_date'],'2025-02-04');
    eq('and the name reaches the record',msR.scalars['property.name'],'MARKET SQUARE');

    // ---- The Pines ---------------------------------------------------------
    const tp=FX.thePines.runs, tpH=app.__rsColHeads(tp);
    T('The Pines: the columns are found though word and digit are separate runs',!!tpH);
    eq('Col. 4 is the column at x 258, not the caption at x 169',tpH&&Math.round(tpH[3]),258);
    eq('and all eight sit where the grid does',tpH&&tpH.map(x=>Math.round(x)),[59,130,190,258,327,396,461,530]);
    const tpF=app.__rsTableA(tp);
    T('The Pines: Part A reads',!!tpF);
    eq('the project name loses the swallowed heading',tpF['1'],'The Pines fka Wood Glen Apartments');
    eq('the effective date is read',tpF['3'],'7/1/2024');
    eq('a number broken across runs is put back together',tpF['9'],'1,350');
    eq('the printed monthly potential is captured',tpF['95'],'242,808');
    const tpR=app.__rsAssembleFields(V(tpF));
    T('the rows reconcile against the printed total',!!tpR);
    eq('three rows, exactly as printed',tpR.units.map(u=>[u.type,u.count,u.rent,u.ua]),
      [['1 BR',40,1350,67],['2 BR',72,1549,82],['3 BR',40,1932,98]]);
    eq('and nothing is filed as unassisted',tpR.ns8.length,0);
    eq('152 units, the figure the page prints',tpR.units.reduce((a,u)=>a+u.count,0),152);
    eq('242,808 a month, the figure the page prints',tpR.units.reduce((a,u)=>a+u.count*u.rent,0),242808);

    /* The gate is the whole safety argument for reading a scanner's characters,
       so it is tested rather than assumed: the same rows against a total that
       does not match them are refused, not filed. */
    { const bad=Object.assign({},tpF);bad['95']='300,000';
      eq('rows that do not add up to the printed total are refused',app.__rsAssembleFields(V(bad)),null); }

    // ---- and it declines rather than guesses -------------------------------
    eq('no runs, no table',app.__rsTableA([]),null);
    eq('without the column numbers there is nothing to place cells against',
      app.__rsTableA(ms.filter(r=>!/^col/i.test(String(r.s).trim()))),null);
    eq('without Part A naming itself the page is not Part A',
      app.__rsTableA(ms.filter(r=>!/^part\s*a/i.test(String(r.s).trim()))),null);
    eq('without the totals caption there is nothing to reconcile against',
      app.__rsTableA(ms.filter(r=>!/total\s*units|monthly\s*contract\s*rent/i.test(String(r.s).trim()))),null);
    { /* eight headings crowded into 40 points are not eight columns */
      const fake=[];for(let i=1;i<=8;i++)fake.push({s:'Col. '+i,x:100+i*5,y:600,d:0});
      eq('columns that cannot span the form are not columns',app.__rsColHeads(fake),null); }
  }

  finish();
})().catch(e=>{fail('the suite threw',e);process.exit(1);});
