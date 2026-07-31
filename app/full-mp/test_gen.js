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

const zlib=require('zlib');
/* WHAT A FIELD STORES AND WHAT IT DRAWS ARE DIFFERENT QUESTIONS, and until now
   this file could only ask the first. getText() returns /V — the value HUD's
   AFSimple_Calculate actions parse — while the separators and the "$" a reader
   sees live in the widget's baked appearance stream. Fifteen checks in here
   demanded a comma from /V and got one, and the suite stayed green through a
   defect that made the form miscalculate by a factor of a thousand. This reads
   the appearance, so the two can be asserted apart. */
function apText(form,id){
  /* PDFName is destructured inside the async IIFE below, not here, so reach it
     off the library. Writing `PDFName` bare cost an hour: the ReferenceError went
     into the catch and came back as null, and null read as "the appearance has no
     text" — a broken helper wearing the costume of a real defect. Hence also the
     catch returning its reason rather than null. */
  const PDFName=global.PDFLib.PDFName;
  try{
    const f=form.getTextField(String(id));
    const ctx=f.acroField.dict.context;
    const w=f.acroField.getWidgets()[0];
    let ap=w.dict.get(PDFName.of('AP')); ap=ctx.lookup(ap)||ap;
    if(!ap||!ap.get)return null;
    let n=ap.get(PDFName.of('N')); n=ctx.lookup(n)||n;
    if(!n)return null;
    let bytes=n.contents||(n.getContents&&n.getContents());
    if(!bytes)return null;
    let buf=Buffer.from(bytes);
    const filt=n.dict&&n.dict.get(PDFName.of('Filter'));
    if(filt&&/Fl/.test(String(filt))){
      try{buf=zlib.inflateSync(buf);}catch(e){try{buf=zlib.inflateRawSync(buf);}catch(e2){return '(inflate failed)';}}}
    const s=buf.toString('latin1');
    let out='';
    for(const m of s.matchAll(/<([0-9A-Fa-f\s]*)>\s*Tj|\(((?:[^()\\]|\\.)*)\)\s*Tj/g)){
      if(m[1]!=null){const h=m[1].replace(/\s/g,'');
        for(let i=0;i+1<h.length;i+=2) out+=String.fromCharCode(parseInt(h.substr(i,2),16));}
      else out+=m[2].replace(/\\([()\\])/g,'$1');
    }
    return out;
  }catch(e){ return '(apText failed: '+(e&&e.message||e)+')'; }
}
/* Acrobat reads a field value with AFMakeNumber, which under the US convention
   (sepStyle 0, what this template specifies) takes a comma as a DECIMAL point.
   That is the whole defect in one function: it turns "1,850" into 1.85. */
const afMakeNumber=v=>{ const s=String(v==null?'':v).replace(/[^0-9.,\-]/g,'').replace(/,/g,'.');
  const n=parseFloat(s); return isNaN(n)?0:n; };

const MIN_CHECKS=133;   // 2026-07-31: +2 UAF-precedence checks (UAF>RS>RCS); 2026-07-30 merge union was 131
                        //;                // the count this file is known to run to the end
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
  /* CORRECTED 2026-07-30. These two read getText() — the VALUE — and demanded
     "1,250" there. That was the defect written down as a requirement, and it is
     why the suite stayed green while a property manager who changed a unit count
     watched Col.4 compute 6 instead of 5,550. The comma is still required; it is
     required of the drawn appearance, which is where a reader sees it. */
  eq('column 3 stores the proposed rent as a bare number', t2(9), '1250');
  eq('and draws it with its comma',                   apText(f2,9), '1,250');
  eq('column 6 stores rent + allowance as a bare number', t2(12), '1325');
  eq('and draws that with its comma',                apText(f2,12), '1,325');

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
    eq('Part D reports the rent lost by every non-revenue unit',V(174),'2400');
    eq('and draws it with its comma',apText(f,174),'2,400');
    /* Its Part A row is wherever the plan put it — after the two Section 8 rows
       and the blank spacer — so find it by what it says, not by counting.
       Column 1 says the unit TYPE now, not the use, and this record's type is
       shared with a Section 8 row, so the count is what tells them apart. */
    let nrRow=-1;for(let r=0;r<11;r++)if(V(7+r*8)==='2 BR / 1 BA'&&V(7+r*8+1)==='2')nrRow=r;
    eq('and Part A carries the count with it',nrRow<0?'(row not found)':V(7+nrRow*8+1),'2');
    eq('and column 1 does not repeat the use',V(7+(nrRow<0?0:nrRow)*8),'2 BR / 1 BA'); }

  /* And with NO Part D rows it must still STATE that zero. It wrote '', and the
     "$" is PRINTED on the form outside the box, so every property without a
     non-revenue unit filed a schedule reading "$" against an empty cell. Nothing
     that reads values could see it — both sides compare as empty — so this was
     found by rendering the page. Measured, not reasoned: Willow Woods has no
     Part D rows and its submitted schedule renders "$        0", in the
     DocuSigned copy and in the CA's executed one alike; Colonial Village has one
     row and renders "$    1,147". No filed copy leaves the box empty. 174 is a
     calculated cell — SUM of 161/164/167/170/173 — and HUD ships it holding the
     zero, exactly as 195 and 1156 do. */
  { eq('HUD ships field 174 holding its zero', bForm.getTextField('174').getText(), '0');
    const by=await G.fillRentSchedule(rsBytes,record());
    const f=(await PDFDocument.load(by)).getForm();
    eq('and a schedule with no non-revenue units states that zero, not a blank',
       f.getTextField('174').getText()||'', '0'); }

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

  console.log('\n─ the date on the federal form is the one Related Affordable gave ─');
  /* Field 3 is "Date Rents Will Be Effective", and 4/5/6 are the same date split
     into the three boxes beside it. The date had two possible answers — a year
     after the executed schedule, or one somebody typed — and Kinley's database
     is now a third that outranks both. It is stored in its own key rather than
     laundered through date_eff_custom, whose whole meaning is "the user typed
     this"; a document is the last place that distinction may quietly collapse. */
  { const r=record({'rent_schedule.date_eff_rs':'2026-05-01','rent_schedule.date_eff_source':'rs',
      'rent_schedule.date_eff_ra':'2026-10-01'});
    const by=await G.fillRentSchedule(rsBytes,r);
    const f=(await PDFDocument.load(by)).getForm();
    const V=id=>{try{return f.getTextField(String(id)).getText()||'';}catch(e){return '(no field '+id+')';}};
    eq('the RA date reaches field 3, not the schedule\'s',V(3),'10/01/2026');
    eq('and the month box agrees with it',V(4),'10');
    eq('the day box too',V(5),'01');
    eq('and the year box',V(6),'2026'); }
  /* With no RA answer nothing about the old behaviour may have moved: this is
     the same record minus one key, and it must print what it always printed. */
  { const r=record({'rent_schedule.date_eff_rs':'2026-05-01','rent_schedule.date_eff_source':'rs'});
    const by=await G.fillRentSchedule(rsBytes,r);
    const f=(await PDFDocument.load(by)).getForm();
    const V=id=>{try{return f.getTextField(String(id)).getText()||'';}catch(e){return '(no field '+id+')';}};
    eq('without one, the schedule\'s date prints exactly as before',V(3),'05/01/2026');
    eq('and its year box is unchanged',V(6),'2026'); }

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
    /* UPDATED 2026-07-30 on Matt's instruction: columns 3 and 5 STATE A ZERO.
       These two checks previously asserted a blank, which was the old behaviour.
       The dilemma the gen.js comment spent three properties on was never which
       rent to print here — it was that a non-revenue unit earns no CONTRACT RENT
       and carries no ALLOWANCE. Zero is a fact about the unit rather than a guess
       about the document, which is why it is safe where printing the stored rent
       was not, and why a blank left a reader wondering if a figure was withheld. */
    eq('column 3 states a zero: this unit earns no contract rent',V(row+2),'0');
    eq('and column 5 a zero: it carries no allowance',V(row+4),'0');
    /* CORRECTED 2026-07-30, same day I wrote it. I asserted the extension stays
       blank "because zero times anything is not a claim". The live HUD form
       disagrees: Col. 4 calculates, and a calculated cell reads 0 rather than
       nothing. My reasoning was about what we can assert; the form's is about
       which cells are inputs and which are arithmetic. */
    eq('and the extension calculates to a zero, as the live form does',V(row+3),'0');
    eq('so the potential is the Section 8 rows alone',V('95'),String(10*900+6*1100));
    eq('and draws it with its dollar sign',apText(f,'95'),'$'+(10*900+6*1100).toLocaleString('en-US'));
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
    /* UPDATED 2026-07-30, same instruction. Ebony's non-revenue unit rents at $0,
       and a printed 0 is now what the form says rather than a blank. */
    eq('a non-revenue row states a zero rent rather than nothing',V(row+2),'0');
    eq('and adds nothing to the potential',V('95'),String(10*900+6*1100));
    eq('and column 1 is still the type, not the use',V(row),'2 BR / 1 BA'); }

  /* ── PART D COLUMN 3 IS THE RENT BEING FILED, NOT LAST TERM'S ────────────
     Matt, testing Colonial Village 2026-07-30: its leasing office printed 1,147
     — the figure read off the EXECUTED schedule — where the filing states 1,850.
     nonrev.<i>.rent holds what the prior schedule said; the proposed rent for the
     same unit type lives on its units.<j> row, and that is the contract rent for
     the term being filed. */
  /* ── THE FOUR POTENTIALS CARRY A DOLLAR SIGN, THE COLUMNS DO NOT ──────────
     Every figure below is read off Colonial Village's own executed 2023 schedule
     (800016946_92458 Rent Schedule_10-1-2023 EXECUTED.pdf, page 1). Col. 3 prints
     1,061 and Col. 4 33,952 and Col. 5 129 and Col. 6 1,190 — all bare — while the
     four boxes beneath print $76,918, $923,016, $0 and $0.

     Ours printed all six bare. The 34-property sweep reported agreement anyway,
     because extract.js:96 and compare.js:68 strip `$` from BOTH sides before
     comparing: the comparator compares figures and is blind to presentation. This
     block is the part of that blindness that can be closed cheaply — against the
     template, where the raw field string is readable. */
  /* ── WHAT WE HAND A PM MUST STILL BE A WORKING HUD FORM ──────────────────
     Matt, 2026-07-30: "the RS pdf you generate must actually be calculable, just
     like the original pdf provided by HUD. PMs will download that RS and attempt
     to interact with it as if it's a normal RS form." So the calculation
     machinery is a requirement, not an accident of pdf-lib preserving objects:
     41 AFSimple_Calculate actions, the /CO order they fire in, and the 103 format
     actions. If a refactor ever flattens the form or sets NeedAppearances, this
     is the check that says so. */
  console.log('\n─ the form we hand back still calculates ─');
  { const {PDFName}=global.PDFLib;
    const shape=async bytes=>{ const d=await PDFDocument.load(bytes);
      const af=d.catalog.lookup(PDFName.of('AcroForm'));
      const co=af&&af.lookup?af.lookup(PDFName.of('CO')):null;
      let calc=0,fmt=0;
      d.getForm().getFields().forEach(f=>{ try{ const aa=f.acroField.dict.lookup(PDFName.of('AA'));
        if(aa&&aa.lookup){ if(aa.lookup(PDFName.of('C')))calc++; if(aa.lookup(PDFName.of('F')))fmt++; } }catch(e){} });
      return {co:co&&co.size?co.size():0,calc,fmt,
              need:!!(af&&af.lookup&&af.lookup(PDFName.of('NeedAppearances')))}; };
    const before=await shape(rsBytes);
    const r=record({'units.0.br':'2BR','units.0.ba':'1BA','units.0.num_units':'32','units.0.proposed':'1061'});
    const after=await shape(await G.fillRentSchedule(rsBytes,r));
    eq('HUD ships 41 calculating fields and we hand back 41',after.calc,before.calc);
    eq('the calculation ORDER survives too',after.co,before.co);
    eq('and every format action',after.fmt,before.fmt);
    T('and we never ask the viewer to rebuild appearances',!after.need); }

  console.log('\n─ the four potentials carry a dollar sign ─');
  { const r=record({'units.0.br':'2BR','units.0.ba':'1BA','units.0.num_units':'32','units.0.proposed':'1061',
                    'units.1.br':'3BR','units.1.ba':'1BA','units.1.num_units':'33','units.1.proposed':'1302'});
    const f=(await PDFDocument.load(await G.fillRentSchedule(rsBytes,r))).getForm();
    const V=id=>{try{return f.getTextField(String(id)).getText()||'';}catch(e){return null;}};
    const mo=32*1061+33*1302;
    /* The dollar sign was M64's point and it still holds — of the appearance.
       The value underneath is the number, which is M67's. */
    eq('monthly contract rent potential carries it',apText(f,'95'),'$'+mo.toLocaleString('en-US'));
    eq('and stores it bare',V('95'),String(mo));
    eq('and the yearly one',apText(f,'96'),'$'+(mo*12).toLocaleString('en-US'));
    eq('and stores that bare too',V('96'),String(mo*12));
    /* Not blank. The old reasoning — that a stated zero is a claim we cannot
       support — is wrong about this box: the filed copies print $0. */
    eq('monthly market rent potential states $0 rather than nothing',apText(f,'97'),'$0');
    eq('and the yearly one likewise',apText(f,'98'),'$0');
    eq('each stored as a plain zero',[V('97'),V('98')].join('/'),'0/0');
    /* …and the per-row columns stay bare, which is the half a blanket fix breaks. */
    const b=7+0*8;
    eq('Col. 3 stays bare',apText(f,b+2),'1,061');
    eq('Col. 4 stays bare',apText(f,b+3),(32*1061).toLocaleString('en-US'));
    eq('and both store bare numbers',[V(b+2),V(b+3)].join('/'),'1061/'+(32*1061));
    /* Col. 6 is Col.3 + Col.5, so its figure depends on the fixture's allowance —
       what matters here is that it carries no sign. */
    eq('Col. 6 stays bare',/^\$/.test(apText(f,b+5)||''),false); }

  console.log('\n─ Part D column 3 is the proposed rent for that unit type ─');
  { const r=record({'nonrev.0.use':'Leasing Office','nonrev.0.br':'1BR','nonrev.0.ba':'1BA',
      'nonrev.0.num_units':'1','nonrev.0.rent':'1147',
      'units.0.br':'1BR','units.0.ba':'1BA','units.0.num_units':'10','units.0.proposed':'1850',
      'units.1.br':'2BR','units.1.ba':'1BA','units.1.num_units':'6','units.1.proposed':'2200'});
    const by=await G.fillRentSchedule(rsBytes,r);
    const f=(await PDFDocument.load(by)).getForm();
    const V=id=>{try{return f.getTextField(String(id)).getText()||'';}catch(e){return null;}};
    eq('Part D names the use',V(159),'Leasing Office');
    eq('and prints the PROPOSED rent for its unit type, not the executed one',V(161),'1850');
    eq('drawn with its comma',apText(f,161),'1,850');
    /* The bathroom is what distinguishes two variants of a bedroom count, so a
       type that states one must not match a row that states a different one. */
    const r2=record({'nonrev.0.use':'Model','nonrev.0.br':'2BR','nonrev.0.ba':'1BA',
      'nonrev.0.num_units':'1','nonrev.0.rent':'999',
      'units.0.br':'1BR','units.0.ba':'1BA','units.0.num_units':'10','units.0.proposed':'1850',
      'units.1.br':'2BR','units.1.ba':'1BA','units.1.num_units':'6','units.1.proposed':'2200'});
    const f2=(await PDFDocument.load(await G.fillRentSchedule(rsBytes,r2))).getForm();
    const V2=id=>{try{return f2.getTextField(String(id)).getText()||'';}catch(e){return null;}};
    eq('a two-bedroom non-revenue unit takes the two-bedroom figure',V2(161),'2200');
    /* And with no unit type to match, the stored rent is better than an empty
       column — the filed copies never show one. */
    const r3=record({'nonrev.0.use':'Storage','nonrev.0.br':'4BR','nonrev.0.ba':'2BA',
      'nonrev.0.num_units':'1','nonrev.0.rent':'750',
      'units.0.br':'1BR','units.0.ba':'1BA','units.0.num_units':'10','units.0.proposed':'1850'});
    const f3=(await PDFDocument.load(await G.fillRentSchedule(rsBytes,r3))).getForm();
    const V3=id=>{try{return f3.getTextField(String(id)).getText()||'';}catch(e){return null;}};
    eq('a type no unit row matches falls back to the stored rent',V3(161),'750'); }

  console.log('\n─ column 5 resolves UAF → executed RS → study ─');
  /* The executed rent schedule is the baseline of record and a saved UAF is
     applied on top of it; the appraiser's study allowance is a cross-check, not
     a source the app trusts (Matt, 2026-07-31). So with no UAF the executed
     figure wins over the study, and a saved UAF beats both. The corpus cases
     (Sycamore Green 51/64, Burt Farms 54, Northcross 180/221/246) reach the
     study's number THROUGH a saved UAF applied to the executed baseline, not by
     trusting the study. */
  { const r=record({'units.0.ua_exec':'42','units.0.ua_rcs':'51',
      'units.1.ua_exec':'50','units.1.ua_rcs':'64',
      'units.0.proposed':'1200','units.1.proposed':'1450'});
    delete r['units.0.ua_source']; delete r['units.1.ua_source'];
    const by=await G.fillRentSchedule(rsBytes,r);
    const f=(await PDFDocument.load(by)).getForm();
    const V=id=>{try{return f.getTextField(String(id)).getText()||'';}catch(e){return null;}};
    eq('the executed schedule\'s allowance, not the study\'s',V(7+4),'42');
    eq('and on the second row too',V(7+8+4),'50');
    eq('so gross rent follows the executed schedule',V(7+5),'1242');
    eq('and on the second row',V(7+8+5),'1500');
    eq('and gross rent draws its comma',apText(f,7+5),'1,242'); }
  /* A saved UAF submission is the system of record and beats both. */
  { const r=record({'units.0.ua_exec':'42','units.0.ua_rcs':'51','units.0.ua_uaf':'55',
      'units.0.proposed':'1200'});
    delete r['units.0.ua_source'];
    const by=await G.fillRentSchedule(rsBytes,r);
    const f=(await PDFDocument.load(by)).getForm();
    const V=id=>{try{return f.getTextField(String(id)).getText()||'';}catch(e){return null;}};
    eq('a saved UAF beats the executed schedule and the study',V(7+4),'55');
    eq('and gross rent follows the UAF',V(7+5),'1255'); }
  /* A source the PM HAS chosen still wins -- the default moved, the override did
     not. The study is no longer the default, so choosing it is what proves it. */
  { const r=record({'units.0.ua_exec':'42','units.0.ua_rcs':'51',
      'units.0.ua_source':'rcs','units.0.proposed':'1200'});
    const by=await G.fillRentSchedule(rsBytes,r);
    const f=(await PDFDocument.load(by)).getForm();
    const V=id=>{try{return f.getTextField(String(id)).getText()||'';}catch(e){return null;}};
    eq('an explicit choice of the study is honoured',V(7+4),'51'); }

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
  /* ── a property with two names keeps both on the form ─────────────────────
     Colonial Village's executed schedule prints its Part A project name as
     "Colonial Village/White Oak Townhomes". app.js splits that on the way in
     into property.name plus tenant.property_alias, which is why the tenant
     notice correctly headers "White Oak Townhomes" while every letter uses the
     legal name. Writing back, only the first half reached HUD-92458 - so the one
     form HUD identifies the project by lost half its identity while the record
     held both halves, and the team's own filed draft prints both. */
  console.log('\n─ a property with two names keeps both on the form ─');
  { const two=await G.fillRentSchedule(rsBytes,record(
      {'property.name':'Colonial Village','tenant.property_alias':'White Oak Townhomes'}));
    const f2=(await PDFDocument.load(Buffer.from(two))).getForm();
    eq('the schedule carries both names',
      f2.getTextField('1').getText(),'Colonial Village/White Oak Townhomes');
    /* And a property with one name gains nothing - no stray slash on the form. */
    const one=await G.fillRentSchedule(rsBytes,record({'property.name':'Colonial Village'}));
    const f1=(await PDFDocument.load(Buffer.from(one))).getForm();
    eq('and one name stays one',f1.getTextField('1').getText(),'Colonial Village');
    /* An alias with no name still prints something rather than a bare slash. */
    const al=await G.fillRentSchedule(rsBytes,record(
      {'property.name':'','tenant.property_alias':'White Oak Townhomes'}));
    const fa=(await PDFDocument.load(Buffer.from(al))).getForm();
    eq('and an alias alone is not a slash',fa.getTextField('1').getText(),'White Oak Townhomes'); }

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

  /* ══ THE VALUE IS A NUMBER, AND THE LOOK IS A FORMATTING ═══════════════════
     Matt generated a schedule, opened it in Acrobat and changed one unit count
     from 33 to 3 — the ordinary thing a property manager does. Col.4 read 6
     where it should read 5,550; Col.6 read 162 where it should read 2,010. Both
     are what you get from 3 x 1.85 and 160 + 1.85, because we wrote "1,850"
     into the field VALUE and AFMakeNumber takes that comma for a decimal point.

     The suite could not see it. It asserted that 41 calculating fields exist,
     which is structure, and the structure was perfect the whole time. What
     follows tests the arithmetic those fields will actually do.

     The shape of the fix is not invented here either. Two real filed schedules —
     Colonial Village and Willow Woods, 2025, 232 fields each, different
     preparers — store every numeric value RAW and carry a baked FORMATTED
     appearance: field 9 is "1147" and draws "1,147"; field 95 is "83135" and
     draws "$83,135". Neither sets NeedAppearances. That is what is asserted. */
  console.log('\n─ every numeric field stores a number, not a picture of one ─');
  { const r=record({'units.0.br':'2BR','units.0.ba':'1BA','units.0.num_units':'33',
      'units.0.proposed':'1850','units.0.ua_exec':'160','units.0.ua_source':'exec'});
    const by=await G.fillRentSchedule(rsBytes,r);
    const doc=await PDFDocument.load(by); const f=doc.getForm();
    const V=id=>{try{const v=f.getTextField(String(id)).acroField.dict.get(PDFName.of('V'));
      return v==null?null:(v.decodeText?v.decodeText():String(v));}catch(e){return null;}};

    /* Which fields Acrobat will parse as numbers is read off the template, not
       listed by hand: the ones carrying a format action, the ones that
       calculate, and — the term a format-based rule misses — the ones NAMED AS
       OPERANDS by someone else's calculation. Col.5 carries no format action of
       its own but is summed into Col.6 by SUM(11,9). */
    const tmpl=await PDFDocument.load(rsBytes); const tf=tmpl.getForm();
    const jsOf=(d,which)=>{try{const aa=d.get(PDFName.of('AA'));if(!aa||!aa.get)return null;
      let e=aa.get(PDFName.of(which));if(!e)return null;e=tmpl.context.lookup(e)||e;
      if(!e.get)return null;let j=e.get(PDFName.of('JS'));if(j==null)return null;
      j=tmpl.context.lookup(j)||j;return j.decodeText?j.decodeText():String(j);}catch(e){return null;}};
    const numeric=new Set();
    for(const fl of tf.getFields()){ const d=fl.acroField.dict;
      const F=jsOf(d,'F'), C=jsOf(d,'C');
      if(F&&/AFNumber_Format/.test(F)) numeric.add(fl.getName());
      if(C&&/AFSimple_Calculate/.test(C)){ numeric.add(fl.getName());
        const m=C.match(/new Array\s*\(([^)]*)\)/);
        if(m) for(const q of m[1].split(',')) numeric.add(q.trim().replace(/^"|"$/g,'')); } }
    eq('the template names 112 fields that Acrobat reads as numbers',numeric.size,112);
    T('and Col.5, which no format action covers, is one of them',numeric.has('11'));

    /* The assertion that would have caught this on day one: a stored value must
       round-trip as a number. "1850" does. "1,850" and "$61,050" do not. */
    const bad=[];
    for(const id of numeric){ const v=V(id);
      if(v==null||v==='')continue;
      if(!/^-?\d+(\.\d+)?$/.test(v)) bad.push(id+'='+JSON.stringify(v)); }
    eq('and not one of them stores a comma or a dollar sign',bad.join(', '),'');
    const filled=[...numeric].filter(id=>{const v=V(id);return v!=null&&v!=='';});
    T('with enough of them actually filled for that to mean something',filled.length>=8);

    /* The look survives, which is what M64 and M65 were each about. */
    eq('Col.3 draws its separator',apText(f,9),'1,850');
    eq('Col.4 draws its separator',apText(f,10),'61,050');
    eq('Col.6 draws its separator',apText(f,12),'2,010');
    eq('and the potential draws its dollar sign',apText(f,'95'),'$61,050');
    eq('Col.5 draws bare, as the blank form does with no format action',apText(f,11),'160');

    /* x12 IS HUD'S OWN CONSTANT: PRD("95","x12") is how each monthly potential
       becomes its annual one. We used to blank it, which is invisible until
       something recalculates and then takes BOTH annual potentials to $0. Both
       filed schedules carry "12". */
    eq('HUD\'s hidden x12 multiplier is left holding 12',V('x12'),'12');

    /* FIELD 174 READS ITS ZERO — the calculated cell M65 missed. It ships as "0"
       on the blank form and we used to blank it whenever a property had no
       non-revenue units. Checked against the filed copies first: Willow Woods
       2025, Beacon Hill eff. 08.01.25 and the blank package copy all carry "0"
       here with an empty Part D, and Colonial Village — the one with a Part D row
       — carries its sum. No filed copy prints it blank. */
    { const none=record({'units.0.proposed':'1250'});
      const nf=(await PDFDocument.load(await G.fillRentSchedule(rsBytes,none))).getForm();
      const NV=id=>{try{const v=nf.getTextField(String(id)).acroField.dict.get(PDFName.of('V'));
        return v==null?'(absent)':(v.decodeText?v.decodeText():String(v));}catch(e){return null;}};
      eq('total rent loss reads 0 with no non-revenue units, not blank',NV(174),'0');
      eq('and draws that zero',apText(nf,174),'0');
      /* The "$" beside it is printed on the form, not in the field — 174's format
         action names no currency, so a dollar sign here would be a second one. */
      T('with no dollar sign of its own',!/\$/.test(apText(nf,174)||'')); }
    /* And with a Part D row it foots that row — still raw, still with its comma
       drawn rather than stored. */
    { const one=record({'units.0.br':'2BR','units.0.ba':'1BA','units.0.num_units':'33',
        'units.0.proposed':'1850','nonrev.0.use':"Manager's Unit",
        'nonrev.0.br':'2BR','nonrev.0.ba':'1BA','nonrev.0.num_units':'1'});
      const of=(await PDFDocument.load(await G.fillRentSchedule(rsBytes,one))).getForm();
      const OV=id=>{try{const v=of.getTextField(String(id)).acroField.dict.get(PDFName.of('V'));
        return v==null?'(absent)':(v.decodeText?v.decodeText():String(v));}catch(e){return null;}};
      eq('and with a non-revenue unit it carries the sum, bare',OV(174),'1850');
      eq('drawn with its comma',apText(of,174),'1,850'); }

    console.log('\n─ and now the form computes what Matt would compute ─');
    /* MATT\'S REPRODUCTION, run against the stored values. He changed the unit
       count from 33 to 3; Acrobat then re-runs Col.4 = PRD(8,9) and
       Col.6 = SUM(11,9) over what the fields HOLD. */
    const edited='3';
    const col4=afMakeNumber(edited)*afMakeNumber(V(9));
    const col6=afMakeNumber(V(11))+afMakeNumber(V(9));
    const pot =col4;
    eq('Col. 4 = 3 x 1,850 comes out at 5,550',col4,5550);
    eq('Col. 6 = 1,850 + 160 comes out at 2,010',col6,2010);
    eq('and the monthly contract rent potential at 5,550',pot,5550);
    eq('the annual one follows through HUD\'s own multiplier',pot*afMakeNumber(V('x12')),66600);

    /* And the same reading applied to what we USED to store, so the check above
       cannot quietly pass for the wrong reason. These are the three numbers off
       Matt\'s screenshot. */
    /* These cells specify zero decimals, so what Acrobat DRAWS is the rounded
       figure — 5.55 shows as 6, 161.85 as 162. Those are the two numbers off
       his screenshot, reproduced from the strings we used to store. */
    const shown=x=>Math.round(x);
    eq('while the strings we used to store still read as his 6',
       shown(afMakeNumber(edited)*afMakeNumber('1,850')),6);
    eq('and his 162',shown(afMakeNumber('160')+afMakeNumber('1,850')),162);
    T('so a formatted value and a raw one are not interchangeable',
       afMakeNumber('1,850')!==afMakeNumber('1850')); }

  finish();
})().catch(e=>fail('the suite threw before reaching its verdict',e));
