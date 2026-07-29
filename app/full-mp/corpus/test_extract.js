/* test_extract.js — the extract seam, against a real filed package and against
   our own generator's output.

   The four traps this suite exists to keep shut, each already confirmed in the
   Colonial Village package and each SILENT if it reopens:

   1. HUD-92458 values are not in the text layer. Extracting text from the
      filed rent schedule returns the blank template's boilerplate — no
      property name, no rent. Two empty forms then compare as a perfect match
      and a green sweep proves nothing. Checks below assert that the text layer
      does NOT carry "1850" and that the facts record DOES.
   2. copyPages drops the AcroForm dictionary (233 fields -> 0) while keeping
      the annotations, so a document must never be split in order to read its
      fields. Asserted directly.
   3. The filed checklist page is drawn in a font encoded at ASCII-29, so the
      raw text reads "2ZQHU V0DWHULDOV". It has to be decoded — and a decoder
      that also fires on clean text corrupts every other document, so a clean
      ALL-CAPS page is asserted to come through untouched.
   4. Our generated documents have no word spacing inside justified paragraphs
      ("AsoutlinedintheRenewal"). Every extracted value is therefore stored
      whitespace-free, so the two sides are comparable at all. */
const fs=require('fs'),path=require('path');
const D=path.join(__dirname,'..')+path.sep;              // app/full-mp/
const X=require('./extract.js');

const MIN_CHECKS=120;                 // the count this file is known to run to the end
let n=0,fails=0,verdict=null;
const BAR='='.repeat(68);
function fail(msg,err){
  fails++;console.log('  X '+msg+(err?': '+(err&&err.message||err):''));
  if(err&&err.stack)console.log(String(err.stack).split('\n').slice(1,4).join('\n'));}
function eq(label,got,want){n++;
  const a=JSON.stringify(got),b=JSON.stringify(want);
  if(a===b)console.log('  + '+label);else fail(label+': got '+a+' want '+b);}
const T=(label,v)=>eq(label,!!v,true);
function finish(){
  console.log('\n'+BAR);
  if(fails){verdict='X EXTRACT SUITE FAILED ('+n+' checks ran, '+fails+' failed)';
    console.log('  XXX  EXTRACT SUITE FAILED  XXX');
    console.log('  '+fails+' of '+n+' checks failed - see the X lines above');}
  else if(n<MIN_CHECKS){fails=1;verdict='X EXTRACT SUITE FAILED (only '+n+' of '+MIN_CHECKS+' checks ran)';
    console.log('  XXX  EXTRACT SUITE FAILED  XXX');
    console.log('  only '+n+' of the expected '+MIN_CHECKS+' checks ran - the suite died partway, or checks were deleted without lowering MIN_CHECKS on purpose');}
  else verdict='+ ALL '+n+' EXTRACT CHECKS PASSED';
  console.log(fails?(BAR+'\n'):'');console.log(verdict);
  process.exit(fails?1:0);}

const FILED=path.join(D,'..','..','_archive','colonial-village-example','Manual RCS Package (PDF).pdf');
if(!fs.existsSync(FILED)){
  console.log('\n'+BAR+'\n  !!! EXTRACT SUITE SKIPPED - no filed package at '+FILED+'\n'+BAR);
  console.log('! EXTRACT SUITE SKIPPED (no corpus)');process.exit(0);}
const read=p=>new Uint8Array(fs.readFileSync(p));

/* ---- our own side: generate the five documents with the real generator ---- */
global.window=global.window||{};
global.PDFLib=require(D+'lib/pdf-lib.min.js');
new Function('window',fs.readFileSync(D+'templates.js','utf8'))(global.window);
new Function('window',fs.readFileSync(D+'xlsx.js','utf8'))(global.window);
const TPL=global.window.RCSTemplates, G=require(D+'gen.js');
/* Colonial Village's real figures, so ours and theirs are the same package. */
const REC={
 'property.name':'Colonial Village','property.s8':'OH10M000236','property.fha':'OH10-M000-236',
 'tenant.property_alias':'White Oak Townhomes',
 'owner.entity_name':'Colonial Village Preservation, L.P.','owner.entity_type':'Limited Partnership',
 'ca.name':'Muriel Jones','ca.org':'CGI Federal Assisted Housing Services Corporation',
 'poc.name':'Matthew Kim','poc.phone':'(646) 767-4439','poc.email':'makim@related.com',
 'appr.name':'Aaron M. Zabel','appr.firm':'Belfry Valuation','appr.phone':'(708) 500-2380',
 'appr.email':'azabel@belfryvaluation.com','appr.addr_street':'PO BOX 8140',
 'appr.addr_city':'Bartlett','appr.addr_state':'IL','appr.addr_zip':'60103',
 'sig.name':'David Pearson','sig.title':'Vice President','sig.principal':'General Partner',
 'cycle.submission_date':'2026-07-07','tenant.date_of_notice':'2026-07-07','checklist.sign_date':'2026-07-01',
 'rent_schedule.date_eff_source':'custom','rent_schedule.date_eff_custom':'2026-10-01',
 'property.addr_street':'3641 Irving Street','property.addr_city':'Cincinnati',
 'property.addr_state':'OH','property.addr_zip':'45220',
 'tenant.sender_name':'Dionna Wallington','tenant.sender_title':'Community Manager',
 'units.0.br':'2BR','units.0.ba':'1BA','units.0.num_units':'32','units.0.current':'1147','units.0.proposed':'1850','units.0.ua_exec':'160',
 'units.1.br':'3BR','units.1.ba':'1BA','units.1.num_units':'33','units.1.current':'1407','units.1.proposed':'2400','units.1.ua_exec':'171',
 'principals.0.name':'Colonial Village Preservation GP, LLC','principals.0.title':'General Partner',
 'check.0':'1','check.1':'1','check.5':'1'};

(async()=>{
 try{
  /* ================= the filed package, split into its documents ========== */
  const filed=await X.extractFacts(read(FILED),'combinedPackage');

  eq('the filed package splits into the five documents it contains',
     Object.keys(filed).filter(k=>filed[k]&&filed[k].pages).sort(),
     ['checklist','coverLetter','rcsStudy','rentSchedule','submittalLetter','tenantNotice']);
  eq('the cover letter is page 1',            filed.coverLetter.pages,     [0,0]);
  eq('the submittal letter runs pages 2-3',   filed.submittalLetter.pages, [1,2]);
  eq('the checklist is page 4',               filed.checklist.pages,       [3,3]);
  eq('the appraiser study is pages 5-56',     filed.rcsStudy.pages,        [4,55]);
  eq('the rent schedule is the three HUD-92458 pages', filed.rentSchedule.pages, [56,58]);
  eq('the tenant notice is the last page',    filed.tenantNotice.pages,    [59,59]);

  /* ---- TRAP 1: the rent schedule's values are in the widgets, not the text */
  const rs=filed.rentSchedule.values;
  eq('the filed rent schedule yields a real rent, not blank-template boilerplate', rs['unit.0.rent'],'1850');
  eq('unit 0 type',      rs['unit.0.type'],'2BR');
  eq('unit 0 count',     rs['unit.0.units'],'32');
  eq('unit 0 extension', rs['unit.0.extension'],'59200');
  eq('unit 0 allowance', rs['unit.0.ua'],'160');
  eq('unit 0 gross',     rs['unit.0.gross'],'2010');
  /* The filed schedule types its SECOND row as "1 BR" while the same package's
     tenant notice calls it 3BR. We report what is on the form; diagnosing it is
     the comparison's job, not ours. */
  eq('unit 1 type as filed',  rs['unit.1.type'],'1BR');
  eq('unit 1 rent',           rs['unit.1.rent'],'2400');
  eq('the non-revenue row is kept',  rs['unit.2.type'],'2BRNonRev');
  eq('and there is no fourth row',   rs['unit.3.type'],undefined);
  eq('the filed schedule carries the alias in the project name',
     rs['property.name'],'ColonialVillage/WhiteOakTownhomes');
  eq('the date the rents take effect', rs['rent_schedule.date_eff'],'10/1/2026');
  eq('total units',            rs['total.units'],'66');
  eq('total contract rent',    rs['total.contract_rent'],'138400');
  eq('total annual',           rs['total.annual'],'1660800');
  eq('the mortgagor entity (Part F)', rs['owner.entity_name'],'ColonialVillagePreservation,L.P.');
  eq('the entity type',        rs['owner.entity_type'],'LimitedPartnership');
  eq('the first principal',    rs['principals.0.name'],'ColonialVillagePreservationGP,LLC');
  eq('the signature block (Part G)',  rs['sig.name_title'],'MatthewFinkle,VPofGP');
  eq('a Part D non-revenue use',      rs['nonrev.0.use'],'LeasingOffice');
  eq('a Part B fuel letter',          rs['partb.fuel.0'],'G');
  eq('a Part B equipment write-in',   rs['partb.writein.e1'],'Shades');
  eq('no FHA number was typed on the filed schedule', rs['property.fha'],undefined);
  T ('the facts say where they came from', /annotation/i.test(filed.rentSchedule.notes.join(' ')));

  /* the trap itself, asserted: the text layer of that same page is blank */
  const doc=await X.loadDoc(read(FILED));
  const p56=(await X.pageLines(doc,56)).map(l=>l.text).join(' ');
  T('the rent schedule TEXT layer has no rent in it',  p56.indexOf('1850')<0&&p56.indexOf('1,850')<0);
  T('the rent schedule TEXT layer has no project name',p56.indexOf('Colonial')<0);
  T('the rent schedule TEXT layer is the blank template', /Rent\s*Schedule/i.test(p56.replace(/\s+/g,' ')));

  /* ---- TRAP 2: copyPages drops the AcroForm, so we never split to read ---- */
  const one=await global.PDFLib.PDFDocument.create();
  const [cp]=await one.copyPages(doc,[56]); one.addPage(cp);
  const copied=await global.PDFLib.PDFDocument.load(await one.save());
  eq('the original document still has its 233 AcroForm fields', doc.getForm().getFields().length,233);
  eq('a copyPages extract has none of them - never split to read fields',
     copied.getForm().getFields().length,0);
  T('but the copy still carries the widgets, which is why the loss is silent',
     (await X.pageAnnots(copied,0)) && Object.keys(await X.pageAnnots(copied,0)).length>0);

  /* ---- TRAP 3: the checklist's ASCII-29 font, and only that page ---------- */
  const cl=filed.checklist.values;
  T ('the checklist heading decodes to English, not line noise', /Owner/.test(cl['heading']));
  T ('and the whole heading is readable',   /Checklist.*RCS.*Submission/.test(cl['heading'].replace(/[^A-Za-z ]/g,' ')));
  T ('no control characters survive the decode', !/[\x00-\x08\x0b-\x1f]/.test(cl['heading']));
  eq('the checklist property name',  cl['property.name'],'ColonialVillage');
  eq('the checklist signature date', cl['checklist.sign_date'],'7/1/2026');
  eq('the checklist signature',      cl['checklist.signature'],'DavidPearson,VPofGP');
  T ('a checklist item line decodes too',
     filed.checklist.boilerplate.some(l=>/signedcoverletter/.test(l)));
  /* a clean page must be left alone. Page 5 is ALL CAPS, which is exactly what
     a naive "more lowercase after decoding" scorer would wreck. */
  const p4=(await X.pageLines(doc,4)).map(l=>l.text).join(' ');
  T('an ALL-CAPS page is NOT decoded', p4.indexOf('RENT COMPARABILITY STUDY')>=0);
  T('and its property name survives',  p4.indexOf('COLONIAL VILLAGE')>=0);
  const p0=(await X.pageLines(doc,0)).map(l=>l.text).join(' ');
  T('ordinary prose is NOT decoded',   p0.indexOf('Best Regards,')>=0);
  eq('nothing else in the package is decoded',
     (await X.shiftedPages(doc)),[3]);

  /* ---- the letters and the notice, filed side --------------------------- */
  const cv=filed.coverLetter.values;
  eq('cover: property name',  cv['property.name'],'ColonialVillage');
  eq('cover: Section 8 number',cv['property.s8'],'OH10M000236');
  eq('cover: CA contact',     cv['ca.name'],'MurielJones');
  eq('cover: CA organization',cv['ca.org'],'CGIFederalAssistedHousingServicesCorporation.');
  eq('cover: letter date',    cv['letter.date'],'July7,2026');
  eq('cover: point of contact',cv['poc.name'],'MatthewKim');
  eq('cover: contact email',  cv['poc.email'],'makim@related.com');
  eq('cover: contact phone',  cv['poc.phone'],'(646)767-4439');
  eq('cover: signatory',      cv['sig.name'],'DavidPearson');
  eq('cover: signatory title',cv['sig.title'],'VicePresidentofGeneralPartner');
  T ('cover: the HAP quotation is boilerplate, not a value',
     filed.coverLetter.boilerplate.some(l=>/attheexpirationofeach/.test(l)));
  T ('cover: boilerplate carries no digits', filed.coverLetter.boilerplate.every(l=>!/[0-9]/.test(l)));

  const sl=filed.submittalLetter.values;
  eq('submittal: ownership entity', sl['owner.entity_name'],'COLONIALVILLAGEPRESERVATION,L.P.');
  eq('submittal: appraiser named in certification 2', sl['appr.name'],'AaronM.Zabel');
  eq('submittal: appraisal firm',   sl['appr.firm'],'BelfryValuation');
  eq('submittal: appraiser email (certification 8)', sl['appr.email'],'azabel@belfryvaluation.com');
  eq('submittal: property name',    sl['property.name'],'ColonialVillage');
  eq('submittal: signatory',        sl['sig.name'],'DavidPearson');

  const tn=filed.tenantNotice.values;
  eq('notice: date of notice',  tn['notice.date'],'July7,2026');
  eq('notice: the name residents see', tn['property.name'],'WhiteOakTownhomes');
  eq('notice: contract administrator', tn['ca.org'],'CGIFederal');
  eq('notice: row 0 type',      tn['unit.0.type'],'2BR');
  eq('notice: row 0 units',     tn['unit.0.units'],'32');
  eq('notice: row 0 current',   tn['unit.0.current'],'1147');
  eq('notice: row 0 requested', tn['unit.0.proposed'],'1850');
  eq('notice: row 1 requested', tn['unit.1.proposed'],'2400');
  eq('notice: sender',          tn['sender.name'],'DionnaWallington');
  eq('notice: sender title',    tn['sender.title'],'CommunityManager');

  /* ================= our own generator's output ========================== */
  /* TRAP 4: these documents have no word spacing inside paragraphs. If the
     extractor leans on spaces, every one of these comes back empty. */
  const ours={
    coverLetter:   await X.extractFacts(await G.coverLetter(REC),'coverLetter'),
    submittalLetter:await X.extractFacts(await G.ownerLetter(REC),'submittalLetter'),
    checklist:     await X.extractFacts(await G.fillChecklist(Buffer.from(TPL.checklist,'base64'),REC),'checklist'),
    rentSchedule:  await X.extractFacts(await G.fillRentSchedule(Buffer.from(TPL.rentSchedule,'base64'),REC),'rentSchedule'),
    tenantNotice:  await X.extractFacts(await G.tenantNotice(REC,null,null),'tenantNotice')};

  eq('ours cover: property name survives the missing word spacing', ours.coverLetter.values['property.name'],'ColonialVillage');
  eq('ours cover: Section 8 number',  ours.coverLetter.values['property.s8'],'OH10M000236');
  eq('ours cover: CA contact',        ours.coverLetter.values['ca.name'],'MurielJones');
  eq('ours cover: point of contact',  ours.coverLetter.values['poc.name'],'MatthewKim');
  eq('ours cover: contact email',     ours.coverLetter.values['poc.email'],'makim@related.com');
  eq('ours cover: signatory',         ours.coverLetter.values['sig.name'],'DavidPearson');
  T ('ours cover: the HAP quotation is still recognised as the same boilerplate',
     ours.coverLetter.boilerplate.some(l=>/attheexpirationofeach/.test(l)));

  eq('ours submittal: ownership entity', ours.submittalLetter.values['owner.entity_name'],'COLONIALVILLAGEPRESERVATION,L.P.');
  eq('ours submittal: appraiser',        ours.submittalLetter.values['appr.name'],'AaronM.Zabel');
  eq('ours submittal: firm',             ours.submittalLetter.values['appr.firm'],'BelfryValuation');

  eq('ours checklist: property name',    ours.checklist.values['property.name'],'ColonialVillage');
  eq('ours checklist: box 1 ticked',     ours.checklist.values['check.0'],'1');
  eq('ours checklist: box 3 not ticked', ours.checklist.values['check.2'],'0');
  T ('ours checklist: the template text is NOT shift-decoded', /Owner/.test(ours.checklist.values['heading']));

  const ors=ours.rentSchedule.values;
  eq('ours schedule: the comma comes off the rent', ors['unit.0.rent'],'1850');
  eq('ours schedule: unit type carries the bath count', ors['unit.0.type'],'2BR/1BA');
  eq('ours schedule: the FHA number IS typed',      ors['property.fha'],'OH10-M000-236');
  eq('ours schedule: project name has no alias',    ors['property.name'],'ColonialVillage');
  eq('ours schedule: total units',                  ors['total.units'],'65');

  const otn=ours.tenantNotice.values;
  eq('ours notice: the $ comes off the current rent', otn['unit.0.current'],'1147');
  eq('ours notice: requested rent',   otn['unit.0.proposed'],'1850');
  eq('ours notice: row 1 type',       otn['unit.1.type'],'3BR');
  eq('ours notice: the name residents see', otn['property.name'],'WhiteOakTownhomes');
  eq('ours notice: sender',           otn['sender.name'],'DionnaWallington');

  /* ================= the analysis workbook =============================== */
  const xl=await global.window.RCSXlsx.rentAnalysis({propertyName:'Colonial Village',apprFirm:'Belfry Valuation',
    rows:[{type:'2 BR / 1 BA',units:32,cur:1147,pro:1850,ua:160,safmr150:2400},
          {type:'3 BR / 1 BA',units:33,cur:1407,pro:2400,ua:171,safmr150:3000}]});
  const xf=await X.extractFacts(xl,'analysisXlsx');
  eq('xlsx: property name',      xf.values['property.name'],'ColonialVillage');
  eq('xlsx: appraisal firm',     xf.values['appr.firm'],'BelfryValuation');
  eq('xlsx: row 0 type',         xf.values['unit.0.type'],'2BR/1BA');
  eq('xlsx: row 0 units',        xf.values['unit.0.units'],'32');
  eq('xlsx: row 0 current rent', xf.values['unit.0.current'],'1147');
  eq('xlsx: row 0 RCS rent',     xf.values['unit.0.proposed'],'1850');
  eq('xlsx: row 0 allowance',    xf.values['unit.0.ua'],'160');
  eq('xlsx: row 0 base SAFMR',   xf.values['unit.0.safmr'],'1600');
  eq('xlsx: row 1 RCS rent',     xf.values['unit.1.proposed'],'2400');
  eq('xlsx: and no third row',   xf.values['unit.2.type'],undefined);
  T ('xlsx: formula cells are not reported as data', xf.values['unit.0.gpr']===undefined);

  /* An executed schedule filed as a scan is the case where silence has to be
     LOUD: no widgets, and a text layer holding nothing but the blank form's
     own captions. Reporting the printed signature rules as data, or an empty
     record with no explanation, would both read downstream as "matches". */
  const EX=path.join(D,'..','..','_archive','colonial-village-example','Colonial Village - Executed Rent Schedule.pdf');
  const ex=await X.extractFacts(read(EX),'rentSchedule');
  eq('a flattened executed schedule yields no values at all', Object.keys(ex.values).length,0);
  T ('and says why, rather than reading as an empty schedule',
     /no widget annotations/.test(ex.notes.join(' ')));
  T ('the blank form\'s printed rules are not reported as entered data',
     Object.keys(ex.values).every(k=>!/^_+$/.test(ex.values[k])));

  /* the decoder itself, stated as rules rather than left implicit */
  eq('a shifted run decodes',        X.maybeDecode('6FRSH\u0003RI\u0003:RUN\u0003').s,'Scope of Work ');
  eq('a clean ALL-CAPS run does not',X.maybeDecode('RENT COMPARABILITY STUDY').dec,false);
  eq('nor does a year',              X.maybeDecode('2026').dec,false);
  eq('nor a word whose decode only accidentally reads',
     X.maybeDecode('ADDENDA').dec,false);
  eq('and lowercase prose is not even a candidate',
     X.shiftDecodable('Best Regards, David Pearson'),false);

  /* ================= what the seam refuses to guess ====================== */
  let threw=null; try{ await X.extractFacts(read(FILED),'nonsense'); }catch(e){ threw=e; }
  T('an unknown docType is refused rather than silently returning nothing', !!threw);
 }catch(e){ fail('the suite threw',e); }
 finish();
})();
