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

const MIN_CHECKS=20;                 // the count this file is known to run to the end
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
  else{verdict='✓ ALL '+n+' GENERATION CHECKS PASSED';console.log('  ✓ ALL '+n+' GENERATION CHECKS PASSED');}
  console.log(BAR+'\n');console.log(verdict);
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

  finish();
})().catch(e=>fail('the suite threw before reaching its verdict',e));
