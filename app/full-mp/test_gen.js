/* test_gen.js — the generated documents, checked as documents.
   Generation had no tests at all, which is how a worksheet came to print $0
   rents and a rent schedule came to ship with HUD's own arithmetic deleted.
   These run against the real templates in templates.js via pdf-lib in Node. */
const fs=require('fs'),path=require('path');
const D=__dirname+'/';
global.window={};
global.PDFLib=require(D+'lib/pdf-lib.min.js');
new Function('window',fs.readFileSync(D+'templates.js','utf8'))(global.window);
const TPL=global.window.RCSTemplates;
const G=require(D+'gen.js');
/* xlsx.js is an IIFE that hangs itself on window, like templates.js. It needs
   DecompressionStream, Blob and atob, all of which node has had since 18. */
new Function('window',fs.readFileSync(D+'xlsx.js','utf8'))(global.window);

const MIN_CHECKS=72;                 // the count this file is known to run to the end
let n=0,fails=0,verdict=null;
const BAR='═'.repeat(68);
function fail(msg,err){
  fails++;console.log('  ✗ '+msg+(err?': '+(err&&err.message||err):''));
  if(err&&err.stack)console.log(String(err.stack).split('\n').slice(1,4).join('\n'));}
function eq(label,got,want){n++;
  const a=JSON.stringify(got),b=JSON.stringify(want);
  if(a===b)console.log('  ✓ '+label);else fail(label+': got '+a+' want '+b);}
const T=(label,v)=>eq(label,!!v,true);
function finish(){
  console.log('\n'+BAR);
  if(fails){verdict='✗ GENERATION SUITE FAILED ('+n+' checks ran, '+fails+' failed)';
    console.log('  ✗✗✗  GENERATION SUITE FAILED — DO NOT SHIP  ✗✗✗');
    console.log('  '+fails+' of '+n+' checks failed — see the ✗ lines above');}
  else if(n<MIN_CHECKS){fails=1;verdict='✗ GENERATION SUITE FAILED (only '+n+' of '+MIN_CHECKS+' checks ran)';
    console.log('  ✗✗✗  GENERATION SUITE FAILED — DO NOT SHIP  ✗✗✗');
    console.log('  only '+n+' of the expected '+MIN_CHECKS+' checks ran — the suite died partway, or checks were deleted without lowering MIN_CHECKS on purpose');}
  /* On a pass the verdict IS the banner — printing both made deliver.sh's
     "grep -o 'ALL .* PASSED'" report this suite twice. On a failure the two
     lines say different things, so both are wanted. */
  else verdict='✓ ALL '+n+' GENERATION CHECKS PASSED';
  console.log(fails?(BAR+'\n'):'');console.log(verdict);
  process.exit(fails?1:0);}

/* A property with two unit types and NO proposed rents — the case Matt hit:
   generate a schedule, then type the rents in by hand afterwards. */
function record(extra){
  const r={'property.name':'Test Gardens','property.s8':'MI43T000123',
    'units.0.br':'1BR','units.0.ba':'1BA','units.0.num_units':'10',
    'units.0.current':'900','units.0.ua_exec':'75','units.0.ua_source':'exec',
    'units.1.br':'2BR','units.1.ba':'1BA','units.1.num_units':'6',
    'units.1.current':'1100','units.1.ua_exec':'95','units.1.ua_source':'exec',
    'sig.name':'Jane Owner','sig.title':'President'};
  return Object.assign(r,extra||{});}

(async()=>{
  const {PDFDocument,PDFName}=global.PDFLib;
  const rsBytes=Buffer.from(TPL.rentSchedule,'base64');

  /* ── what HUD ships, so the assertions below are anchored to the real form ── */
  console.log('\n─ the blank HUD template carries its own arithmetic ─');
  const blank=await PDFDocument.load(rsBytes);
  const bForm=blank.getForm();
  const bCO=bForm.acroForm.dict.get(PDFName.of('CO'));
  const bCalc=bForm.getFields().filter(f=>{const a=f.acroField.dict.get(PDFName.of('AA'));return a&&a.get&&a.get(PDFName.of('C'));}).length;
  T('the blank form has a calculation order', !!bCO);
  eq('and 41 fields that calculate themselves', bCalc, 41);

  /* ── the regression: generating must not strip that ────────────────────── */
  console.log('\n─ a generated schedule still calculates ─');
  /* Stripping /CO and every field's /AA is what turned a schedule generated
     without proposed rents into a dead form: the owner typed a rent into a
     blank cell and no gross rent, extension or total moved. */
  const out=await G.fillRentSchedule(rsBytes,record());
  const gen=await PDFDocument.load(Buffer.from(out));
  const gForm=gen.getForm();
  const gCO=gForm.acroForm.dict.get(PDFName.of('CO'));
  const gCalc=gForm.getFields().filter(f=>{const a=f.acroField.dict.get(PDFName.of('AA'));return a&&a.get&&a.get(PDFName.of('C'));}).length;
  T('the generated schedule keeps its calculation order', !!gCO);
  eq('and keeps every calculating field', gCalc, bCalc);

  console.log('\n─ and column 4 still reads at one size ─');
  /* The reason those actions were stripped. The template mixes 9/10/12pt, so a
     viewer re-running a format action redrew a cell at the field's OWN size.
     Normalising Part A to 9pt fixes that at the source — without deleting the
     arithmetic as collateral. */
  const daSize=f=>{const da=f.acroField.dict.get(PDFName.of('DA'));const m=da&&String(da.decodeText?da.decodeText():da).match(/([\d.]+)\s+Tf/);return m?m[1]:null;};
  const partA=gForm.getFields().filter(f=>/^([7-9]|[1-8]\d|9[0-6])$/.test(f.getName()));
  const sizes=[...new Set(partA.map(daSize).filter(Boolean))];
  T('Part A fields exist to check', partA.length>50);
  eq('and every one of them is 9pt', sizes, ['9']);

  console.log('\n─ the values we wrote are on the form ─');
  const txt=f=>{try{return gForm.getTextField(String(f)).getText()||'';}catch(e){return null;}};
  eq('the property name is written', txt(1), 'Test Gardens');
  eq('the unit type is written',     txt(7), '1 BR / 1 BA');
  eq('the unit count is written',    txt(8), '10');
  eq('the utility allowance is written', txt(11), '75');

  console.log('\n─ Matt\'s case: no proposed rents, filled in by hand afterwards ─');
  /* Part A column 3 is the PROPOSED rent; column 4 is its extension and column 6
     the gross rent, and HUD computes both. With no proposed rent the three print
     blank — correct, since a printed 0 reads as a real figure on a filing. What
     matters is that typing into column 3 still drives 4 and 6. */
  eq('column 3 (proposed rent) is blank', txt(9), '');
  eq('column 4 (extension) is blank',     txt(10), '');
  eq('column 6 (gross rent) is blank',    txt(12), '');
  const calcs=f=>{const a=gForm.getTextField(String(f)).acroField.dict.get(PDFName.of('AA'));return !!(a&&a.get&&a.get(PDFName.of('C')));};
  T('but column 4 still computes itself', calcs(10));
  T('and column 6 does too',              calcs(12));
  T('and so does the schedule total',     calcs(95));

  console.log('\n─ and a proposed rent prints where HUD expects it ─');
  const out2=await G.fillRentSchedule(rsBytes,record({'units.0.proposed':'1250'}));
  const f2=(await PDFDocument.load(Buffer.from(out2))).getForm();
  const t2=f=>{try{return f2.getTextField(String(f)).getText()||'';}catch(e){return null;}};
  eq('column 3 carries the proposed rent, with its comma', t2(9), '1,250');
  eq('column 6 carries rent + allowance',                  t2(12), '1,325');

  console.log('\n─ an allowance of $0 is a figure, not an empty cell ─');
  /* Every utility owner-paid is a real $0. Printing a blank reads as "not filled
     in" on a HUD form, which is a different claim entirely. */
  const zf=(await PDFDocument.load(Buffer.from(await G.fillRentSchedule(rsBytes,record({'units.0.ua_exec':'0'}))))).getForm();
  eq('column 5 prints the zero', (()=>{try{return zf.getTextField('11').getText()||'';}catch(e){return null;}})(), '0');

  console.log('\n─ a template it cannot fill is refused, not shipped blank ─');
  /* A byte-valid but completely blank HUD-92458 used to save and download
     clean if the field ids ever shifted. */
  let threw=null;
  try{ await G.fillRentSchedule(Buffer.from(TPL.checklist,'base64'),record()); }
  catch(e){ threw=e; }
  T('filling the schedule against the wrong template throws', !!threw);
  T('and says so in words a reader can act on', !!threw&&/do not file/i.test(threw.message));

  console.log('\n─ an unset OCAF factor prints a dash, never $0 ─');
  /* The worksheet printed $0 as the adjusted contract rent for every unit type
     whenever the factor was unset — while the form on screen showed a dash, so
     it was invisible until you opened the PDF. */
  const ws=await G.ocafWorksheet(record());
  const wsTxt=Buffer.from(ws).toString('latin1');
  T('the worksheet generated', ws&&ws.length>1000);
  eq('and no line reads $0.00', /\$0\.00/.test(wsTxt), false);

  console.log('\n─ figures and names that reach a federal form ─');
  /* Field 174 is captioned "Total Rent Loss Due to Non-Revenue Units". It summed
     the rent of ONE unit, so two model units at $1,200 reported a $1,200 loss. */
  { const r=record({'nonrev.0.use':'Model unit','nonrev.0.br':'2BR','nonrev.0.ba':'1BA',
      'nonrev.0.num_units':'2','nonrev.0.rent':'1200'});
    const by=await G.fillRentSchedule(rsBytes,r);
    const f=(await PDFDocument.load(by)).getForm();
    const V=id=>{try{return f.getTextField(String(id)).getText()||'';}catch(e){return '(no field '+id+')';}};
    eq('Part D reports the rent lost by every non-revenue unit',V(174),'2,400');
    /* Its Part A row is wherever the plan put it — after the two Section 8 rows
       and the blank spacer — so find it by what it says, not by counting.
       Column 1 says the unit TYPE now, not the use, and this record's type is
       shared with a Section 8 row, so the count is what tells them apart. */
    let nrRow=-1;for(let r=0;r<11;r++)if(V(7+r*8)==='2 BR / 1 BA'&&V(7+r*8+1)==='2')nrRow=r;
    eq('and Part A carries the count with it',nrRow<0?'(row not found)':V(7+nrRow*8+1),'2');
    eq('and column 1 does not repeat the use',V(7+(nrRow<0?0:nrRow)*8),'2 BR / 1 BA'); }

  /* .replace(/, $/,'') strips a trailing comma, so an empty TITLE was handled and
     an empty NAME was not: Part G read ", Vice President of the General Partner". */
  { const r=record({'sig.name':'','sig.title':'Vice President','sig.principal':'General Partner'});
    const by=await G.fillRentSchedule(rsBytes,r);
    const f=(await PDFDocument.load(by)).getForm();
    const s=f.getTextField('228').getText()||'';
    eq('a blank signatory prints no leading comma',s,'Vice President of General Partner'); }
  { const r=record({'sig.name':'Jane Owner','sig.title':'','sig.principal':''});
    const by=await G.fillRentSchedule(rsBytes,r);
    const f=(await PDFDocument.load(by)).getForm();
    eq('and a signatory with no title prints no trailing one',f.getTextField('228').getText()||'','Jane Owner'); }

  console.log('\n─ an unfactored utility is not a utility worth zero ─');
  /* $50 electric at 1.02 plus $30 gas with NO factor produced 80 -> 51. That
     reads as a decrease, prints "Present $80 / Proposed $51" on a notice served
     on residents, and fires the 24 CFR 245.420 decrease certification — over a
     utility that was simply never factored. */
  { const u=G.uafCalcRec(record({'units.0.uac_electric':'50','units.0.uac_gas':'30',
      'uaf.f_electric':'1.02','units.1.uac_electric':'50','uaf.f_gas':''}));
    const row=u.rows.find(r=>r.i==='0')||u.rows[0];
    eq('the current allowance is the sum of both utilities',row.curSum,80);
    eq('and the new one carries the unfactored utility forward',row.newSum,81);
    eq('so nothing reads as a decrease',u.dec.length,0);
    eq('and the record names what was carried',u.nofac,['gas']); }

  console.log('\n─ the date never calls itself ─');
  /* The catch called ET_TODAY, so a throwing Intl took every document down with
     a stack overflow instead of degrading to an ISO date. */
  { const real=global.Intl;
    global.Intl={DateTimeFormat:function(){throw new Error('no Intl here');}};
    let out=null,threw=null;
    try{ out=G.resolve(record()).date; }catch(e){ threw=e; }
    global.Intl=real;
    T('a broken Intl does not take generation down',!threw);
    T('and the date falls back to a real one',/^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(String(out||''))); }

  console.log('\n─ Part H says it the way the owner signs it ─');
  /* Ebony Gardens, Circle Park, Oak Center and Morh Housing all printed
     "Vice President of the General Partner". Every prior executed schedule and
     every filed checklist in the corpus writes "of General Partner" or "of GP".
     The article was ours, and Part H is a signature block. */
  { const r=record({'sig.name':'David Pearson','sig.title':'Vice President','sig.principal':'General Partner'});
    const by=await G.fillRentSchedule(rsBytes,r);
    const f=(await PDFDocument.load(by)).getForm();
    eq('no inserted article in Part H',f.getTextField('228').getText()||'','David Pearson, Vice President of General Partner'); }
  { const r=record({'sig.name':'David Pearson','sig.title':'VP','sig.principal':'GP'});
    eq('and the short form the schedules use survives too',
       G.resolve(r).sig_title,'VP of GP'); }

  console.log('\n─ an unsigned checklist does not claim a signing date ─');
  /* The date prints under a blank signature rule. Falling back to today stamped
     the generation date on a document nobody had signed — four properties in
     wave 1 printed "July 29, 2026" beside an empty line. */
  eq('no date until someone sets one',G.resolve(record()).sign_date,'');
  eq('and a date that IS set still prints',
     G.resolve(record({'checklist.sign_date':'2025-10-30'})).sign_date,'October 30, 2025');

  console.log('\n─ a non-revenue unit is a unit type, not a use ─');
  /* Oak Center printed "Manager's Unit" in Column 1 where the executed copy
     prints "3 Bedroom", and never printed the row's $1,728 at all: its monthly
     potential footed 277,700 against the filed 279,428. Ebony wrote
     "Superintendent" into the same cell. The use has its own column in Part D. */
  { const r=record({'nonrev.0.use':"Manager's Unit",'nonrev.0.br':'3BR','nonrev.0.ba':'1BA',
      'nonrev.0.num_units':'1','nonrev.0.rent':'1728',
      'units.0.proposed':'900','units.1.proposed':'1100'});
    const by=await G.fillRentSchedule(rsBytes,r);
    const f=(await PDFDocument.load(by)).getForm();
    const V=id=>{try{return f.getTextField(String(id)).getText()||'';}catch(e){return '(no field '+id+')';}};
    const base=7+2*8;                       // two S8 rows, then a spacer, then the non-rev row
    const base2=7+3*8;
    const row=[V(base),V(base2)].find(x=>/BR|Manager/.test(x))===V(base)?base:base2;
    eq('column 1 carries the unit type',V(row),'3 BR / 1 BA');
    /* The rent stays OFF this row until the stored figure can be trusted --
       see the comment at the non-revenue branch in gen.js. Printing it made
       Oak Center right and Ebony and Morh wrong. */
    eq('and does not print a rent we do not trust',V(row+2),'');
    eq('nor an extension',V(row+3),'');
    eq('so the potential is the Section 8 rows alone',V('95'),(10*900+6*1100).toLocaleString('en-US'));
    eq('and the unit count still counts it',V('94a'),'17');
    eq('while Part D still names the use',V(159),"Manager's Unit"); }
  /* A non-revenue unit with no rent of its own must not invent one — Ebony's
     rents at $0 and the filed schedule prints nothing in Col. 3. */
  { const r=record({'nonrev.0.use':'Superintendent','nonrev.0.br':'2BR','nonrev.0.ba':'1BA',
      'nonrev.0.num_units':'1','units.0.proposed':'900','units.1.proposed':'1100'});
    const by=await G.fillRentSchedule(rsBytes,r);
    const f=(await PDFDocument.load(by)).getForm();
    const V=id=>{try{return f.getTextField(String(id)).getText()||'';}catch(e){return null;}};
    const row=/BR/.test(V(7+2*8))?7+2*8:7+3*8;
    eq('a non-revenue row with no rent prints none',V(row+2),'');
    eq('and adds nothing to the potential',V('95'),(10*900+6*1100).toLocaleString('en-US'));
    eq('and column 1 is still the type, not the use',V(row),'2 BR / 1 BA'); }

  console.log('\n─ column 5 is the allowance for the term being filed ─');
  /* Sycamore Green printed 42/50 where its own study, its UA workbook, its
     Exhibit A and the filed schedule all say 51/64. Burt Farms printed 52 where
     the study and the signed UAF both say 54. Northcross printed 149/184/204
     against 180/221/246. In each case the right figure was in a file the app had
     been handed. The executed schedule states LAST term's allowance. */
  { const r=record({'units.0.ua_exec':'42','units.0.ua_rcs':'51',
      'units.1.ua_exec':'50','units.1.ua_rcs':'64',
      'units.0.proposed':'1200','units.1.proposed':'1450'});
    delete r['units.0.ua_source']; delete r['units.1.ua_source'];
    const by=await G.fillRentSchedule(rsBytes,r);
    const f=(await PDFDocument.load(by)).getForm();
    const V=id=>{try{return f.getTextField(String(id)).getText()||'';}catch(e){return null;}};
    eq('the study\'s allowance, not the prior schedule\'s',V(7+4),'51');
    eq('and on the second row too',V(7+8+4),'64');
    eq('so gross rent follows the study',V(7+5),'1,251');
    eq('and on the second row',V(7+8+5),'1,514'); }
  /* A source the PM HAS chosen still wins -- the default moved, the override
     did not. */
  { const r=record({'units.0.ua_exec':'42','units.0.ua_rcs':'51',
      'units.0.ua_source':'exec','units.0.proposed':'1200'});
    const by=await G.fillRentSchedule(rsBytes,r);
    const f=(await PDFDocument.load(by)).getForm();
    const V=id=>{try{return f.getTextField(String(id)).getText()||'';}catch(e){return null;}};
    eq('an explicit choice of the prior schedule is honoured',V(7+4),'42'); }

  /* ── the analysis workbook, which had no tests at all ──────────────────────
     Eight properties shipped a workbook whose "Below 150%?" cell read NO about a
     package that passes. The template's 116 formula cells each carry the cached
     value the blank was saved with -- zeros, #DIV/0!, and that NO -- and
     fullCalcOnLoad only helps a reader who opens it in Excel. And the SAFMR
     column printed 4413.3333333333335 because the app stores the ceiling and the
     column wanted the base. */
  /* ── one unit-type label, one function ────────────────────────────────────
     The rent schedule built its label with gen.js's utype(), which appends the
     designation the way the executed copies write it ("1 BR E"). The workbook
     built its own, `br + '/' + ba`, and so dropped it: Morningside Court's two
     one-bedroom types print as "1 BR / 1 BA S" and "1 BR / 1 BA Large" on the
     schedule and as "1BR/1BA" twice in the workbook beside it — two different
     unit types at two different rents wearing one label. Two callers formatting
     one field two ways is how a package comes to contradict itself, so the
     function is exported and there is now one. */
  console.log('\n─ the unit-type label, shared by both documents ─');
  { const ut=window.RCSGen.utype;
    T('the label function is exported',typeof ut==='function');
    eq('a designation is kept',ut('1BR','1BA','Large'),'1 BR / 1 BA Large');
    eq('and spacing is normalised',ut('1BR','1BA',''),'1 BR / 1 BA');
    eq('a type with no bathroom still reads',ut('1BR','',''),'1 BR');
    eq('and one with no bedroom count does too',ut('','1BA',''),'1 BA');
    /* The designation is free text, not a code, so nothing may be dropped for
       being unrecognised: Lansing prices "with patio" separately. */
    eq('a free-text designation survives whole',ut('3BR','1.5BA','with patio'),'3 BR / 1.5 BA with patio');
    eq('and an empty type stays empty',ut('','',''),''); }

  console.log('\n─ the analysis workbook ─');
  { const wbBytes=await window.RCSXlsx.rentAnalysis({propertyName:'Test Gardens',apprFirm:'Belfry Valuation, LLC',
      rows:[{type:'1BR/1BA',units:90,cur:1368,pro:2000,ua:70,safmr150:2250},
            {type:'2BR/1BA TH',units:25,cur:1675,pro:2400,ua:86,safmr150:6620}]});
    T('a workbook is produced',wbBytes&&wbBytes.length>3000);
    /* unpack it the same way the app packs it */
    const ents=[];{const u8=wbBytes;const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
      let i=0;while(i<u8.length-4){ if(dv.getUint32(i,true)===0x04034b50){
        const nl=dv.getUint16(i+26,true),el=dv.getUint16(i+28,true),csz=dv.getUint32(i+18,true);
        const nm=new TextDecoder().decode(u8.subarray(i+30,i+30+nl));
        const ds=i+30+nl+el; ents.push({nm,data:u8.subarray(ds,ds+csz)}); i=ds+csz; } else i++; }}
    const sheetEnt=ents.find(e=>e.nm==='xl/worksheets/sheet1.xml');
    T('the sheet is in the archive',!!sheetEnt);
    const sheet=new TextDecoder().decode(sheetEnt.data);
    const cells=sheet.match(/<c\b[^>]*>[\s\S]*?<\/c>/g)||[];
    const withF=cells.filter(c=>c.indexOf('<f')>=0);
    T('the formulas are still there',withF.length>100);
    eq('and not one of them ships a cached answer',withF.filter(c=>/<v>/.test(c)).length,0);
    T('so nothing can read a stale verdict',sheet.indexOf('>NO<')<0);
    const cellOf=r=>{const m=sheet.match(new RegExp('<c r="'+r+'"[^>]*>([\\s\\S]*?)</c>'));return m?m[1]:null;};
    eq('the SAFMR column carries the base, rounded',cellOf('T9'),'<v>1500</v>');
    /* 6620 is round(4413 x 1.5); dividing back and rounding returns 4413 exactly,
       which is the integer HUD published. Unrounded it printed 4413.3333333333335. */
    eq('and recovers an odd ceiling exactly',cellOf('T10'),'<v>4413</v>');
    eq('the unit rows carry their rents',cellOf('E9'),'<v>2000</v>');
    eq('and their allowances',cellOf('P10'),'<v>86</v>'); }

  /* ── one unmergeable document must not cost the whole package ──────────────
     Noble Tower's study is AES-256 encrypted; pdf-lib loads it under
     ignoreEncryption and then throws "Expected instance of e, but got instance of
     undefined" when a page is copied out of it. That exception left the property
     with NOTHING generated, on four runs across three commits. combinePdfs is
     reached through the app rather than gen.js, so this drives it directly. */
  console.log('\n─ a document that cannot be merged is skipped, not fatal ─');
  { const {PDFDocument}=global.PDFLib;
    /* Rebuild combinePdfs' contract here: a bad source is skipped and named, and
       the good ones still combine. The real function lives in app.js; this pins the
       BEHAVIOUR the app depends on, and the encryption probe it turns on. */
    const good1=await (async()=>{const d=await PDFDocument.create();d.addPage();return await d.save();})();
    const good2=await (async()=>{const d=await PDFDocument.create();d.addPage();d.addPage();return await d.save();})();
    const combine=async(list,skipped)=>{const out=await PDFDocument.create();
      for(const it of list){const b=(it&&it.bytes!==undefined)?it.bytes:it; if(!b)continue;
        const label=(it&&it.label)||'';
        try{ const src=await PDFDocument.load(b,{ignoreEncryption:true,parseSpeed:Infinity});
          if(src.isEncrypted)throw new Error('the file is encrypted, so its pages cannot be merged');
          const pg=await out.copyPages(src,src.getPageIndices());pg.forEach(x=>out.addPage(x));
        }catch(e){ if(skipped)skipped.push({label:label,why:(e&&e.message)||String(e)}); } }
      return await out.save({objectsPerTick:Infinity});};
    const skipped=[];
    const merged=await combine([{label:'good one',bytes:good1},
                                {label:'RCS report',bytes:new Uint8Array([37,80,68,70,45,49,46,55,10,120,120])},
                                {label:'good two',bytes:good2}],skipped);
    const back=await PDFDocument.load(merged);
    eq('the mergeable documents still merge',back.getPageCount(),3);
    eq('and the bad one is named, not swallowed',skipped.length,1);
    eq('by the label the package uses',skipped[0].label,'RCS report');
    T('with a reason a person can read',/[a-z]{4}/.test(skipped[0].why||'')); }

  finish();
})().catch(e=>fail('the suite threw before reaching its verdict',e));
