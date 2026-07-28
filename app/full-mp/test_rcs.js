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

const MIN_CHECKS=237;
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

  finish();
})().catch(e=>{fail('the suite threw',e);process.exit(1);});
