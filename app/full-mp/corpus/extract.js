/* extract.js — document bytes -> a `facts` record of VARIABLE data only.
   The middle seam of the corpus loop: whatever produced a document, ours or
   the PM team's, this turns it into the same shape so the two can be compared.

   extractFacts(bytes, docType) -> {docType, pages, values, boilerplate, notes}
     docType: coverLetter | submittalLetter | checklist | rentSchedule
              | tenantNotice | analysisXlsx | combinedPackage
   For combinedPackage the return is a map of docType -> that record, because a
   filed package is one PDF holding all of them.

   `values` holds only what changes property to property: names, numbers, dates,
   people. Prose goes to `boilerplate`, normalised and with its digits and its
   extracted values removed, so a difference there is template drift and is
   reported as such rather than as a mismatch.

   ---------------------------------------------------------------------------
   FOUR TRAPS. Each was confirmed on the filed Colonial Village package, and
   each is silently wrong — a green result proving nothing — if it is missed.

   1. A HUD-92458's values are NOT in the text layer. Extracting text from the
      filed rent schedule returns the blank template's captions: no project
      name, no rent, no total. The figures live in the widget annotations' /V.
      Two empty forms then compare as a perfect match. So the schedule is read
      from annotations, and test_extract asserts the text layer is empty of
      them.
   2. copyPages DROPS the AcroForm dictionary (233 fields -> 0) while keeping
      the annotations, so a document must never be split in order to read its
      fields. Nothing here splits: the page range is carried alongside the
      original document and the annotations are walked in place, resolving /T
      and /V through /Parent when a widget is only a kid.
   3. The filed checklist page is drawn in a font encoded at ASCII-29 —
      "2ZQHU V0DWHULDOV" is "Owner's Materials". It is decoded per text run and
      only where decoding demonstrably reads better as English, because a
      decoder that also fires on clean text corrupts every other document. An
      ALL-CAPS page is exactly what a naive scorer wrecks, so the scoring is by
      dictionary coverage rather than by letter case.
   4. Our generated documents have no word spacing inside justified paragraphs
      ("AsoutlinedintheRenewal"), because the layout engine draws every word
      with its own operator. Runs on a line are therefore joined with nothing at
      all, and EVERY extracted value is stored with its whitespace removed. That
      is the only canonical form the two sides share.

   Node only, no dependencies: the repo's vendored pdf-lib, the app's own text
   extractor out of app.js, and node's zlib for the workbook. */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),zlib=require('zlib');
const APP=path.join(__dirname,'..');

/* ------------------------------------------------------------------ boot --
   app.js is a browser file. Give it just enough DOM to load, then take the one
   function we need out of it. Using the app's own extractor rather than a
   second one is the point: if the reader changes, this changes with it. */
let _P=null,_app=null;
function ensureApp(){
  if(_app)return _app;
  if(!global.CSS)global.CSS={escape:s=>s};
  const mem={};
  const mk=id=>({id:id||'',style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},
    setAttribute(){},getAttribute(){return'';},appendChild(){},addEventListener(){},closest(){return null;},
    parentElement:null,querySelector(){return null;},querySelectorAll(){return[];},innerHTML:'',textContent:'',
    onclick:null,value:'',checked:false,focus(){},select(){},setSelectionRange(){},files:[]});
  const w=global.window=global.window||{};
  if(!w.addEventListener)w.addEventListener=function(){};
  if(!w.localStorage)w.localStorage={getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=v;},removeItem:k=>{delete mem[k];}};
  if(w.scrollY==null)w.scrollY=0; if(!w.scrollTo)w.scrollTo=function(){};
  if(!global.document){const els={};
    global.document={getElementById:id=>els[id]||(els[id]=mk(id)),querySelector:()=>null,querySelectorAll:()=>[],
      createElement:()=>mk(),addEventListener(){},body:{classList:{toggle(){},contains(){return false;}}}};}
  _P=w.PDFLib=w.PDFLib||global.PDFLib||require(path.join(APP,'lib','pdf-lib.min.js'));
  global.PDFLib=global.PDFLib||_P;
  /* pid-scoped: a fixed name means a concurrent run loads another run's build. */
  const tmp=path.join(os.tmpdir(),'rcs_extract.'+process.pid+'.js');
  fs.writeFileSync(tmp,['templates.js','core.js','score.js','db.js','app.js','ocr.js','rcs.js']
    .map(x=>fs.readFileSync(path.join(APP,x),'utf8')).join('\n')
    /* tier-3 OCR bills per page against Azure. It can never run from here. */
    +'\nocrHalf=function(){return Promise.resolve(null);};\n'
    +'if(typeof module!=="undefined")Object.assign(module.exports,{__rsTextPageAt:rsTextPageAt,'
    +'__rsFieldRects:rsFieldRects,__rsMapRects:rsMapRects});\n');
  try{ _app=require(tmp); } finally { try{fs.rmSync(tmp,{force:true});}catch(e){} }
  return _app;
}
function PL(){ ensureApp(); return _P; }

async function loadDoc(bytes){
  const P=PL();
  return await P.PDFDocument.load(bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),
    {ignoreEncryption:true,throwOnInvalidObject:false,parseSpeed:Infinity,updateMetadata:false});
}

/* ------------------------------------------------------- canonical forms --
   canon(): the form every value is stored in. Whitespace is removed outright
   (trap 4), and a value that is nothing but a number loses its $ and commas so
   "1,850" and "1850" are the same fact. "(646) 767-4439" keeps its shape. */
function canon(v){
  let s=String(v==null?'':v).replace(/\s+/g,'').trim();
  if(/\d/.test(s)&&/^\$?-?[\d,]+(\.\d+)?$/.test(s))s=s.replace(/[$,]/g,'');
  return s;
}
/* normProse(): for wording only. Non-alphanumerics go, because a curly quote,
   an en dash and a word space are all things one side has and the other has
   not. */
function normProse(s){ return String(s==null?'':s).toLowerCase().replace(/[^a-z0-9]+/g,''); }

/* ------------------------------------------------- the ASCII-29 encoding --
   Confirmed on the filed checklist: every glyph sits 29 below its ASCII code,
   so a space is \x03 and an apostrophe is \n. A run is a candidate only if
   every one of its characters lands back inside printable ASCII — which alone
   rules out any run containing a lowercase b..z, i.e. all ordinary prose. */
const SHIFT=29;
function shiftDecode(s){let o='';for(let i=0;i<s.length;i++)o+=String.fromCharCode(s.charCodeAt(i)+SHIFT);return o;}
function shiftDecodable(s){
  if(!s)return false; let any=false;
  for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);
    if(c<0x03||c>0x7e-SHIFT)return false;
    if(c!==0x20)any=true;}
  return any;
}
/* Scoring is by DICTIONARY COVERAGE, not by letter case. "RENT COMPARABILITY
   STUDY" decodes to lowercase gibberish, so any scorer that rewards lowercase
   would decode a perfectly clean page and corrupt it. Coverage also survives
   the missing word spacing: "schecklistforrcssubmission" scores as well as
   "s checklist for rcs submission" does. */
const DICT=('the of and to in is are for that this with not or be from all any each such which shall may will can'
 +' have has had was were been it its as at by on an a we our us you your they their there when where who whom what'
 +' about after before during under over between into within without through above below other than only if but'
 +' owner owners ownership entity project property properties rent rents rental market comparable comparables'
 +' study report appraiser appraisal valuation firm materials checklist signature signed date dated page pages'
 +' appendix published march april june july august september october november december january february'
 +' letter cover scope repair work description describing subject identification neighborhood narrative selection'
 +' locator map grid primary unit units type types explaining adjustments adjustment conclusions conclusion'
 +' explanations profiles certification certify copy license relying upon temporary mandatory threshold'
 +' computation gross comparison notice residents resident section number contract housing federal urban'
 +' development department dear best regards submitted respectfully information contact request increase'
 +' approval approve permissible maximum tenant tenants payment assistance payments management office'
 +' schedule effective total current proposed requested allowance utility utilities equipment services'
 +' partnership limited general corporation individual trust joint tenancy common name title president'
 +' vice principal partner enclosed please find required renewal policy content concluded includes material'
 +' chapter nine accurately describe treat funding sources family relationship identity interest between'
 +' principals subjects agent manage projects used selection neither compensation contingent reporting'
 +' predetermined direction knowledge meets conditions regarding absence financial employment fee paid'
 +' receive side agreement consideration following person point decision address questions staff talk'
 +' directly written provided below discontinue service inform writing days termination undersigned penalty'
 +' perjury true correct warning anyone knowingly submits false claim makes statement criminal civil'
 +' penalties including confinement years fines administrative send final correspondence rather'
 +' expiration period term administrator compare existing area anniversary make monthly reasonably'
 +' determined accordance requirements necessary set sizes result negative decrease positive'
 +' outlined intention submit plan take note important long continue eligible under guidelines'
 +' generally affects receive subsidy proposed needed reasons fifth year adjustment increases'
 +' available during normal business hours inspection copying legal representatives acting group'
 +' comments preparing change material period remainder applicable longer inspect changed'
 +' transmitted evaluation upward downward disapprove reviewing advises notified allowable effect'
 +' least served lease community manager street city state photographs photo color'
 +' bedroom bedrooms bathroom bath baths apartment apartments building buildings site sites'
 +' comparability transmittal including identification'
 +' safmr hud rcs ocaf hap gpr').split(/\s+/).filter(Boolean);
/* Only words of three letters and up count as coverage. Two-letter words are
   everywhere by accident: "ADDENDA" shift-decodes to "^aabka^", which is 60%
   covered by the word "a" alone, and at that bar the decoder fired on five
   clean pages of the appraiser's report. */
const DICT_BY_LEN=DICT.filter(w=>w.length>=3).sort((a,b)=>b.length-a.length);
function coverage(s){
  const low=s.toLowerCase();
  const letters=(low.match(/[a-z]/g)||[]).length;
  if(!letters)return 0;
  const hit=new Array(low.length).fill(false);
  for(const w of DICT_BY_LEN){
    let i=low.indexOf(w);
    while(i>=0){ for(let k=0;k<w.length;k++)hit[i+k]=true; i=low.indexOf(w,i+1); }
  }
  let c=0; for(let i=0;i<low.length;i++) if(hit[i]&&/[a-z]/.test(low[i]))c++;
  return c/letters;
}
function textScore(s){
  const n=s.length||1;
  let bad=0,dig=0;
  for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);
    if((c<0x20&&c!==0x09&&c!==0x0a&&c!==0x0d)||c>0x7e)bad++;
    else if(c>=0x30&&c<=0x39)dig++;}
  /* Digits are legitimate content ("2026"); shifting them yields letters that
     cover nothing, so this is what keeps a date from being "decoded". */
  return coverage(s)+0.9*(dig/n)-1.2*(bad/n);
}
/* The bar for decoding a run on its own is deliberately high. A short all-caps
   run decodes into something that contains a two-letter word by pure accident
   ("OLONIAL" -> "lilkf^i", which holds "if"), and at a low bar that is enough
   to wreck the small-caps heading of a perfectly clean letter — it did, on 23
   pages, before these floors went in. So a run is only decoded when the result
   is mostly dictionary English AND is far better than what was there. Runs too
   short to judge are left to the line pass. */
const DEC_MIN_COVER=0.55, DEC_MIN_GAIN=0.30, DEC_MIN_LEN=3;
function maybeDecode(s){
  if(!shiftDecodable(s))return {s:s,dec:false};
  if(s.replace(/\s/g,'').length<DEC_MIN_LEN)return {s:s,dec:false};
  const d=shiftDecode(s);
  if((d.match(/[A-Za-z]/g)||[]).length<4)return {s:s,dec:false};
  if(coverage(d)<DEC_MIN_COVER)return {s:s,dec:false};
  return (textScore(d)-textScore(s))>=DEC_MIN_GAIN?{s:d,dec:true}:{s:s,dec:false};
}

/* --------------------------------------------------------------- layout --
   Runs carry x/y, so lines can be rebuilt properly. Runs on a line are joined
   with NOTHING: the filed documents already carry their own spaces inside a
   run, and ours have none to recover (trap 4). `cells` keeps the runs apart,
   which is how a table row is read on both sides. */
async function pageLines(doc,i){
  const app=ensureApp();
  let runs=[]; try{ runs=(await app.__rsTextPageAt(doc,i))||[]; }catch(e){ runs=[]; }
  const dec=runs.map(r=>{const m=maybeDecode(String(r.s==null?'':r.s));return {s:m.s,dec:m.dec,x:r.x,y:r.y};});
  const buckets=[];
  dec.forEach(r=>{ let b=null;
    for(const q of buckets) if(Math.abs(q.y-r.y)<=1.5){b=q;break;}
    if(!b){b={y:r.y,runs:[]};buckets.push(b);} b.runs.push(r); });
  buckets.sort((a,b)=>b.y-a.y);
  const out=buckets.map(b=>{ const rs=b.runs.slice().sort((p,q)=>p.x-q.x);
    return {y:b.y,runs:rs,text:rs.map(r=>r.s).join(''),
            cells:rs.map(r=>r.s.trim()).filter(s=>s!=='')}; });
  /* Second pass. A run too short to judge on its own ("2ZQH") sits on a line
     whose neighbours decoded confidently; decode it when doing so makes the
     WHOLE line read better. Confined to lines that already decoded, so it can
     never reach a clean page. */
  out.forEach(l=>{
    if(!l.runs.some(r=>r.dec))return;
    l.runs.forEach((r,ix)=>{
      if(r.dec||!shiftDecodable(r.s))return;
      const now=l.runs.map(q=>q.s).join('');
      const alt=l.runs.map((q,k)=>k===ix?shiftDecode(q.s):q.s).join('');
      if(textScore(alt)>textScore(now)){r.s=shiftDecode(r.s);r.dec=true;}
    });
    l.text=l.runs.map(r=>r.s).join('');
    l.cells=l.runs.map(r=>r.s.trim()).filter(s=>s!=='');
  });
  return out;
}
/* Which pages carried the encoding at all. The suite asserts this is exactly
   the checklist page and nothing else — that is the guard on trap 3. */
async function shiftedPages(doc){
  const out=[];
  for(let i=0;i<doc.getPageCount();i++){
    const ls=await pageLines(doc,i);
    if(ls.some(l=>l.runs.some(r=>r.dec)))out.push(i);
  }
  return out;
}

/* ---------------------------------------------------------- annotations --
   Walked in place on the original document (trap 2). A widget that is only a
   kid carries neither /T nor /V of its own, so both are resolved up the
   /Parent chain. */
async function pageAnnots(doc,i){
  const P=PL(),out={};
  const pg=doc.getPages()[i]; if(!pg)return out;
  let an=null; try{ an=pg.node.Annots(); }catch(e){}
  if(!an||typeof an.size!=='function')return out;
  const L=(d,nm)=>{ try{ return d.lookup(P.PDFName.of(nm)); }catch(e){ return null; } };
  for(let k=0;k<an.size();k++){
    let d=null; try{ d=an.lookup(k,P.PDFDict); }catch(e){}
    if(!d)continue;
    let t=L(d,'T'),v=L(d,'V'),node=d,guard=0;
    while((t==null||v==null)&&guard++<8){
      const par=L(node,'Parent'); if(!par||typeof par.lookup!=='function')break;
      if(t==null)t=L(par,'T'); if(v==null)v=L(par,'V'); node=par; }
    if(t==null||v==null)continue;
    let name; try{ name=t.decodeText?t.decodeText():String(t); }catch(e){ continue; }
    let val;  try{ val=v.decodeText?v.decodeText():String(v); }catch(e){ val=''; }
    val=String(val).replace(/^\//,'');
    out[String(name)]=val;
  }
  return out;
}
async function rangeAnnots(doc,from,to){
  const all={};
  for(let i=from;i<=to;i++){ const a=await pageAnnots(doc,i); Object.keys(a).forEach(k=>{ if(all[k]==null)all[k]=a[k]; }); }
  return all;
}
/* A HUD-92458 that was printed rather than saved has no widgets left at all —
   an executed schedule scanned back from the CA is the usual case. The app
   already reads those, by laying our own blank template's field rectangles over
   the page and taking whatever text falls inside each box. Reuse that, so a
   flattened copy is read by the same field ids as a live one and there is still
   only one map. Never a substitute for the widgets: only a fallback when there
   are none. */
async function flattenedFields(doc,from,to){
  const app=ensureApp(); const out={};
  let rects=null; try{ rects=await app.__rsFieldRects(); }catch(e){ return out; }
  if(!rects||!Object.keys(rects).length)return out;
  for(let i=from;i<=to;i++){
    let runs=[]; try{ runs=(await app.__rsTextPageAt(doc,i))||[]; }catch(e){ continue; }
    let got={}; try{ got=app.__rsMapRects(runs,rects,i-from)||{}; }catch(e){ got={}; }
    /* A blank HUD-92458 prints its own signature and write-in rules as rows of
       underscores, and those land inside the field boxes. Taking them would
       report "__________________" as an entered utility. */
    Object.keys(got).forEach(k=>{ const v=String(got[k]||'');
      if(!/[A-Za-z0-9]/.test(v))return;
      if(out[k]==null)out[k]=v; });
  }
  /* Accept this reading only if it found the form's substance. An image-only
     scan of a filled schedule has a text layer holding nothing but the blank
     form's captions, and half a dozen stray captions are not a rent schedule —
     reporting them would be worse than reporting nothing. */
  if(!out['1']&&!out[String(RS_ROW_BASE)])return {};
  return out;
}

/* ----------------------------------------------- HUD-92458 field id map --
   Taken from gen.js's fillRentSchedule. There must be exactly one map: if we
   WRITE field 9 then we must READ field 9, or the comparison is between two
   different documents. Change one, change both. */
const RS_SCALARS={'1':'property.name','2':'property.fha','3':'rent_schedule.date_eff',
  '4':'rent_schedule.eff_month','5':'rent_schedule.eff_day','6':'rent_schedule.eff_year',
  '94a':'total.units','95':'total.contract_rent','96':'total.annual',
  '197':'owner.entity_name','205':'owner.entity_type_other',
  '174':'nonrev.total_rent','228':'sig.name_title'};
const RS_ROW_BASE=7, RS_ROW_STRIDE=8, RS_ROWS=11;
const RS_COLS=['type','units','rent','extension','ua','gross'];
const RS_ENTITY={'198':'Individual','199':'Corporation','200':'General Partnership',
  '201':'Limited Partnership','202':'Joint Tenancy/Tenants in Common','203':'Trust','204':'Other (specify)'};
const RS_EQUIP=[99,100,101,102,103,104,105];
const RS_UTIL=[116,118,120,122,124], RS_FUEL=[117,119,121,123,125];
const RS_SERVICE=[129,130,131,132,141,142];
const RS_EQ_SLOTS=[[106,107],[108,109],[110,111],[112,113],[114,115]];
const RS_SV_SLOTS=[[133,134],[135,136],[137,138],[139,140],[143,144],[145,146]];
const RS_D_USE=[159,162,165,168,171], RS_D_TYPE=[160,163,166,169,172], RS_D_RENT=[161,164,167,170,173];
const RS_G_L=[206,208,210,212,214,216,218,220,222,224,226];
const RS_G_R=[207,209,211,213,215,217,219,221,223,225,227];
const ticked=v=>v!=null&&v!==''&&String(v).toLowerCase()!=='off';

function rentScheduleValues(A,notes,flat){
  const V={},put=(k,v)=>{ const c=canon(v); if(c!=='')V[k]=c; };
  Object.keys(RS_SCALARS).forEach(id=>{ if(A[id]!=null)put(RS_SCALARS[id],A[id]); });
  /* Part A. Only a row with a unit type is a row: the blank template ships with
     '0' already sitting in three columns of all eleven, so reading every cell
     would report ten phantom unit types at $0. */
  let r2=0;
  for(let r=0;r<RS_ROWS;r++){
    const base=RS_ROW_BASE+r*RS_ROW_STRIDE;
    const type=canon(A[String(base)]||'');
    if(!type)continue;
    RS_COLS.forEach((c,k)=>put('unit.'+r2+'.'+c,A[String(base+k)]));
    V['unit.'+r2+'.row']=String(r);
    r2++;
  }
  Object.keys(RS_ENTITY).forEach(id=>{ if(ticked(A[id]))put('owner.entity_type',RS_ENTITY[id]); });
  RS_EQUIP.forEach((id,k)=>{ if(ticked(A[id]))V['partb.equipment.'+k]='1'; });
  RS_UTIL.forEach((id,k)=>{ if(ticked(A[id]))V['partb.utilities.'+k]='1'; });
  RS_FUEL.forEach((id,k)=>put('partb.fuel.'+k,A[id]));
  if(ticked(A[126]))V['partb.writein.u1.on']='1';
  put('partb.writein.u1',A[127]); put('partb.writein.u1.fuel',A[1125]);
  RS_SERVICE.forEach((id,k)=>{ if(ticked(A[id]))V['partb.services.'+k]='1'; });
  RS_EQ_SLOTS.forEach((s,k)=>{ if(ticked(A[s[0]]))V['partb.writein.e'+(k+1)+'.on']='1'; put('partb.writein.e'+(k+1),A[s[1]]); });
  RS_SV_SLOTS.forEach((s,k)=>{ if(ticked(A[s[0]]))V['partb.writein.s'+(k+1)+'.on']='1'; put('partb.writein.s'+(k+1),A[s[1]]); });
  let d=0; RS_D_USE.forEach((id,k)=>{ const use=canon(A[id]||''),ty=canon(A[RS_D_TYPE[k]]||''),rt=canon(A[RS_D_RENT[k]]||'');
    if(!use&&!ty)return; put('nonrev.'+d+'.use',use); put('nonrev.'+d+'.type',ty); put('nonrev.'+d+'.rent',rt); d++; });
  let g=0; RS_G_L.forEach((id,k)=>{ const nm=canon(A[id]||''),tt=canon(A[RS_G_R[k]]||'');
    if(!nm&&!tt)return; put('principals.'+g+'.name',nm); put('principals.'+g+'.title',tt); g++; });
  if(!Object.keys(A).length)notes.push('no values could be read from this rent schedule: it carries no widget annotations, and its text layer holds only the blank form\'s captions. A HUD-92458 keeps none of its figures in the text layer, so this is silence, not a blank schedule');
  else if(!flat)notes.push('values read from widget /V annotations in place; the text layer of a HUD-92458 is the blank template and carries none of them');
  return V;
}

/* ------------------------------------------------------------- letters --- */
const isBlank=s=>!String(s||'').trim();
const DATE_LINE=/^([A-Z][a-z]+\d{1,2},\d{4})$/;
/* Addresses and numbers are read from the RUNS, never from the squashed page.
   With the whitespace gone there is no left boundary, and "767-4439 or
   makim@related.com. Best Regards" collapses into one string that matches an
   e-mail pattern end to end. A run is the finest unit the page actually has. */
const EMAIL=/(^|[^A-Za-z0-9._%+\-])([A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,6})(?![A-Za-z0-9\-])/;
const PHONE=/(^|[^\d])(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})(?![\d])/;
/* Scanned per line, over the line's runs AND its assembled text, because
   neither alone is enough: our own paragraphs put each word in its own run, so
   the e-mail is a run of its own and the line has no space before it; the filed
   letters split "(646) 767-4439" across three runs at the hyphens, so only the
   assembled line holds the whole number. Matches are deduplicated within a
   line, and document order is preserved so "first" means the PM's and "last"
   means the appraiser's. */
function scanAll(lines,re){
  const out=[];
  lines.forEach(l=>{
    const seen={};
    l.runs.map(r=>r.s).concat([l.text]).forEach(src=>{
      let t=String(src);
      for(let guard=0;guard<12;guard++){ const m=t.match(re); if(!m)break;
        if(!seen[m[2]]){seen[m[2]]=1;out.push(m[2]);}
        t=t.slice(m.index+m[0].length); } });
  });
  return out;
}

function reBlock(SQ,V){
  /* "Colonial Village (the “Project”)" — ours drops the curly quotes, so the
     quoting is matched loosely and only the name is taken. */
  for(const s of SQ){ const m=s.match(/^(.*?)\(the.{0,3}Project.{0,3}\)/); if(m&&m[1]){V['property.name']=canon(m[1]);break;} }
  for(const s of SQ){ const m=s.match(/Section8Number:?(.+)$/i); if(m&&m[1]){V['property.s8']=canon(m[1]);break;} }
}
function addresseeBlock(L,SQ,V){
  let di=-1; for(let i=0;i<SQ.length;i++){ if(DATE_LINE.test(SQ[i])){di=i;break;} }
  if(di<0)return;
  V['letter.date']=SQ[di];
  const block=[];
  for(let i=di+1;i<SQ.length;i++){
    if(/^Re:/i.test(SQ[i])||/^Dear/i.test(SQ[i]))break;
    /* A superscript sits on its own baseline: "5th" leaves a two-character
       "th" line between the addressee and the Re: block. */
    if(!isBlank(SQ[i])&&SQ[i].trim().length>=3)block.push(SQ[i]);
  }
  if(!block.length)return;
  V['ca.name']=canon(block[0]);
  /* An organisation name wraps across lines in the filed letters and does not
     in ours; an address line always carries digits. So the organisation is
     every remaining digit-free line, joined. */
  const org=block.slice(1).filter(s=>!/\d/.test(s));
  if(org.length)V['ca.org']=canon(org.join(''));
  const addr=block.slice(1).filter(s=>/\d/.test(s));
  if(addr.length)V['ca.addr']=canon(addr.join(' '));
}
function signature(SQ,V,after,keys){
  let si=-1; for(let i=0;i<SQ.length;i++){ if(after.test(SQ[i])){si=i;} }
  if(si<0)return;
  const rest=[]; for(let i=si+1;i<SQ.length&&rest.length<2;i++) if(!isBlank(SQ[i]))rest.push(SQ[i]);
  if(rest[0])V[keys[0]]=canon(rest[0]);
  if(rest[1])V[keys[1]]=canon(rest[1]);
}
function coverLetterValues(lines,L,SQ,ALL,notes){
  const V={};
  addresseeBlock(L,SQ,V); reBlock(SQ,V);
  const em=scanAll(lines,EMAIL); if(em.length)V['poc.email']=canon(em[0]);
  const ph=scanAll(lines,PHONE); if(ph.length)V['poc.phone']=canon(ph[0]);
  let m=ALL.match(/contact([A-Za-z.'\-]+?)at(?:\(|\d|[A-Za-z0-9._%+\-]+@)/)||ALL.match(/contact([A-Za-z.'\-]+?)\./);
  if(m)V['poc.name']=canon(m[1]);
  signature(SQ,V,/^BestRegards,?$/i,['sig.name','sig.title']);
  notes.push('the point of contact sits inside a justified paragraph, where our own output has no word spacing; it is stored whitespace-free like every other value');
  return V;
}
function submittalLetterValues(lines,L,SQ,ALL,notes){
  const V={};
  /* The ownership entity heads the page in caps, above the date. */
  let di=SQ.findIndex(s=>DATE_LINE.test(s));
  for(let i=0;i<(di<0?SQ.length:di);i++){
    const s=L[i]; if(!s||s.trim().length<6)continue;
    const al=s.replace(/[^A-Za-z]/g,''); if(al.length<6)continue;
    if(al!==al.toUpperCase())continue;
    V['owner.entity_name']=canon(s); break;
  }
  addresseeBlock(L,SQ,V); reBlock(SQ,V);
  /* Certification 2 names appraiser and firm in one parenthetical. */
  let m=ALL.match(/appraiser\S{0,3}\(([^)]{3,90})\)/);
  if(m){ const inner=m[1], c=inner.indexOf(',');
    if(c>0){ V['appr.name']=canon(inner.slice(0,c)); V['appr.firm']=canon(inner.slice(c+1)); }
    else V['appr.name']=canon(inner); }
  /* Certification 7 is the point of contact, certification 8 the appraiser —
     so the first address is the PM's and the last is the appraiser's. */
  const em=scanAll(lines,EMAIL); if(em.length){ V['poc.email']=canon(em[0]); V['appr.email']=canon(em[em.length-1]); }
  const ph=scanAll(lines,PHONE); if(ph.length){ V['poc.phone']=canon(ph[0]); V['appr.phone']=canon(ph[ph.length-1]); }
  signature(SQ,V,/^RespectfullySubmitted,?$/i,['sig.name','sig.title']);
  notes.push('appraiser identity is read from certification 2 and appraiser contact from certification 8');
  return V;
}
function checklistValues(L,SQ,ALL,A,notes){
  const V={};
  for(const s of L){ if(/Checklist\s*for\s*RCS\s*Submission/i.test(s)||/ChecklistforRCSSubmission/i.test(s.replace(/\s+/g,''))){V['heading']=s.trim();break;} }
  if(A['Property Name']!=null)V['property.name']=canon(A['Property Name']);
  if(A['Date']!=null)V['checklist.sign_date']=canon(A['Date']);
  for(let i=0;i<17;i++){ const b=A['Check Box'+(i+1)]; if(b!=null)V['check.'+i]=ticked(b)?'1':'0'; }
  if(!Object.keys(A).length)notes.push('this checklist is flattened — its tick boxes cannot be read, only its printed text');
  /* Flattened (as the filed one is): read the printed values instead. */
  if(V['property.name']==null){
    /* The property name is set 18pt across the head of the form, above the
       Appendix line, and it is the only plain-font run up there. */
    for(const l of L){ if(/Appendix/i.test(l))break;
      if(!isBlank(l)&&!/^[_\s]+$/.test(l)){V['property.name']=canon(l);break;} }
  }
  if(V['checklist.sign_date']==null){
    for(const s of SQ){ const m=s.match(/Date:?(\d{1,2}\/\d{1,2}\/\d{2,4})/); if(m){V['checklist.sign_date']=canon(m[1]);break;} }
  }
  /* The signature the owner prints, which sits between the rule and the date.
     The rule itself is unreliable to key off: on the filed copy it is drawn in
     the shifted font, where an underscore is the letter B and a row of them
     carries no dictionary word to decode by. The date line does not move. */
  let di=-1; for(let i=0;i<SQ.length;i++) if(/^Date:/i.test(SQ[i])){di=i;break;}
  if(di>0){ for(let k=di-1;k>=0;k--){
    const t=(L[k]||'').trim(); if(!t)continue;
    if(/^(.)\1{5,}$/.test(t.replace(/\s/g,'')))continue;      // the signature rule
    V['checklist.signature']=canon(t); break; } }
  return V;
}
const NOTICE_ROW=/^\d+\s*BR/i;
function tenantNoticeValues(lines,L,SQ,ALL,notes){
  const V={};
  let m=ALL.match(/DateofNotice:?([A-Z][a-z]+\d{1,2},\d{4})/);
  if(m)V['notice.date']=canon(m[1]);
  else { const d=SQ.find(s=>DATE_LINE.test(s)); if(d)V['notice.date']=d; }
  m=ALL.match(/permissiblerentsfor(.+?)to([A-Z][^.]{2,90})\./);
  if(m){ V['property.name']=canon(m[1]); V['ca.org']=canon(m[2]); }
  /* The rent table. Cells are separate runs on both sides — the filed notice
     because Word writes them so, ours because each cell is its own operator. */
  let r=0;
  lines.forEach(l=>{
    const c=l.cells; if(c.length<4)return;
    if(!NOTICE_ROW.test(c[0]))return;
    if(!/^\$?[\d,]+$/.test(c[2])||!/^\$?[\d,]+$/.test(c[3]))return;
    V['unit.'+r+'.type']=canon(c[0]); V['unit.'+r+'.units']=canon(c[1]);
    V['unit.'+r+'.current']=canon(c[2]); V['unit.'+r+'.proposed']=canon(c[3]); r++;
  });
  m=ALL.match(/attheManagementOffice,?(.+?),?foraperiodof/); if(m)V['mgmt.line']=canon(m[1]);
  /* The signer closes the page. The filed notice puts name and title on one
     line; ours puts them on two. */
  const tail=[]; for(let i=SQ.length-1;i>=0&&tail.length<3;i--){ if(!isBlank(SQ[i]))tail.push(SQ[i]); }
  tail.reverse();
  const last=tail.filter(s=>s.length<70&&!/\.$/.test(s));
  if(last.length===1&&last[0].indexOf(',')>0){
    V['sender.name']=canon(last[0].slice(0,last[0].indexOf(',')));
    V['sender.title']=canon(last[0].slice(last[0].indexOf(',')+1));
  } else if(last.length>=2){
    V['sender.name']=canon(last[last.length-2]); V['sender.title']=canon(last[last.length-1]);
  }
  notes.push('the notice table is read cell by cell from run positions, not from the line text');
  return V;
}

/* ---------------------------------------------------------- boilerplate --
   Everything else on the page, normalised, with the extracted values and every
   digit removed. What remains is wording, so a difference here is template
   drift and never a mismatch. */
function boilerplateOf(lines,values){
  const vals=Object.keys(values).map(k=>normProse(values[k])).filter(v=>v.length>=4).sort((a,b)=>b.length-a.length);
  const out=[];
  lines.forEach(l=>{
    let s=normProse(l.text); if(s.length<12)return;
    vals.forEach(v=>{ if(v)while(s.indexOf(v)>=0)s=s.split(v).join(''); });
    s=s.replace(/[0-9]/g,'');
    if(s.length>=12)out.push(s);
  });
  return out;
}

/* -------------------------------------------------- splitting a package --
   Recognised on the FIRST page of each document, on the normalised text so the
   missing word spacing cannot matter. */
const START=[
  ['coverLetter',      np=>/attheexpirationofeach\d?\w{0,2}yearperiod/.test(np)||/contractrentadjustments/.test(np)],
  ['submittalLetter',  np=>/enclosedpleasefindtheowner/.test(np)],
  ['checklist',        np=>/checklistforrcssubmission/.test(np)],
  ['rentSchedule',     np=>/formhud92458/.test(np)&&/page1of3/.test(np)],
  ['tenantNotice',     np=>/noticetoresidentsofintentiontosubmitarequest/.test(np)]];
/* Which documents run past their first page, and how a later page says it is
   still the same document. Anything that continues nothing is one page, and an
   unmarked page after it belongs to the appraiser's study. */
const CONTINUES={
  rentSchedule:    np=>/formhud92458/.test(np)&&!/page1of3/.test(np),
  submittalLetter: np=>/respectfullysubmitted/.test(np)||/icertifythat/.test(np)||/hudcamaytalkwiththercsappraiser/.test(np),
  rcsStudy:        ()=>true};

async function classifyPages(doc){
  const marks=[];
  for(let i=0;i<doc.getPageCount();i++){
    const np=(await pageLines(doc,i)).map(l=>l.text).map(normProse).join('');
    let hit=null;
    for(const [id,test] of START) if(test(np)){hit=id;break;}
    marks.push({page:i,start:hit,np:np});
  }
  return marks;
}

/* ------------------------------------------------------------- the xlsx --
   The analysis workbook is a zip. No spreadsheet library here either: the
   template's own map (rows 9-19; B type, C units, D current, E RCS rent,
   P allowance, T base SAFMR) is what xlsx.js writes, so it is what we read.
   Formula cells carry a cached 0 because the workbook recalculates on open —
   reading them would report every derived figure as zero. */
function unzip(u8){
  const buf=Buffer.from(u8.buffer||u8,u8.byteOffset||0,u8.byteLength||u8.length);
  let e=-1; for(let i=buf.length-22;i>=0;i--){ if(buf.readUInt32LE(i)===0x06054b50){e=i;break;} }
  if(e<0)throw new Error('not a zip: no end-of-central-directory record');
  const n=buf.readUInt16LE(e+10); let off=buf.readUInt32LE(e+16); const out={};
  for(let k=0;k<n;k++){
    if(buf.readUInt32LE(off)!==0x02014b50)throw new Error('bad zip central header');
    const method=buf.readUInt16LE(off+10),csz=buf.readUInt32LE(off+20);
    const nl=buf.readUInt16LE(off+28),el=buf.readUInt16LE(off+30),cl=buf.readUInt16LE(off+32),lho=buf.readUInt32LE(off+42);
    const name=buf.slice(off+46,off+46+nl).toString('utf8');
    const lnl=buf.readUInt16LE(lho+26),lel=buf.readUInt16LE(lho+28),ds=lho+30+lnl+lel;
    const raw=buf.slice(ds,ds+csz);
    out[name]=method===8?zlib.inflateRawSync(raw):raw;
    off+=46+nl+el+cl;
  }
  return out;
}
const unesc=s=>String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
function sheetCells(xml){
  const out={};
  const re=/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while((m=re.exec(xml))){
    const ref=m[1],attrs=m[2]||'',body=m[3]||'';
    if(/<f[\s>\/]/.test(body)){ out[ref]={formula:true}; continue; }
    if(/t="inlineStr"/.test(attrs)){ const t=body.match(/<t[^>]*>([\s\S]*?)<\/t>/); if(t)out[ref]={v:unesc(t[1])}; continue; }
    const v=body.match(/<v>([\s\S]*?)<\/v>/);
    if(v)out[ref]={v:unesc(v[1]),shared:/t="s"/.test(attrs)};
  }
  return out;
}
function sharedStrings(xml){
  const out=[];
  const re=/<si>([\s\S]*?)<\/si>/g; let m;
  while((m=re.exec(xml))){
    const parts=[]; const rt=/<t[^>]*>([\s\S]*?)<\/t>/g; let t;
    while((t=rt.exec(m[1])))parts.push(unesc(t[1]));
    out.push(parts.join(''));
  }
  return out;
}
function xlsxFacts(bytes){
  const notes=[],values={};
  const files=unzip(bytes instanceof Uint8Array?bytes:new Uint8Array(bytes));
  const dec=b=>b.toString('utf8');
  const sheet=files['xl/worksheets/sheet1.xml'];
  if(!sheet)throw new Error('this workbook has no xl/worksheets/sheet1.xml — it is not the RCS analysis template');
  const cells=sheetCells(dec(sheet));
  const ss=files['xl/sharedStrings.xml']?sharedStrings(dec(files['xl/sharedStrings.xml'])):[];
  /* The title is one rich-text string: "<property> - <firm> Rent Grid". */
  for(const s of ss){ const m=s.match(/^(.+?)\s+-\s+(.+?)\s+Rent Grid\s*$/); if(m){values['property.name']=canon(m[1]);values['appr.firm']=canon(m[2]);break;} }
  /* WHETHER A CACHED FORMULA RESULT CAN BE TRUSTED IS A PROPERTY OF THE
     WORKBOOK, NOT A CONSTANT. Ours is written with fullCalcOnLoad and every
     derived cell holds a stale 0 until Excel opens it, so reading those would
     invent zeros. The PM team's workbooks have no such flag -- they were saved
     BY Excel, so their cached values are exactly what Excel last computed.
     Refusing both alike made every filed analysis workbook read as empty, and
     an empty filed side turns 14 real values into 14 phantom differences. */
  const wb=files['xl/workbook.xml']?dec(files['xl/workbook.xml']):'';
  const stale=/<calcPr[^>]*fullCalcOnLoad\s*=\s*"1?"/.test(wb)||/fullCalcOnLoad="1"/.test(wb);
  notes.push(stale
    ? 'cached formula results ignored: this workbook declares fullCalcOnLoad, so every derived cell holds a stale 0 until Excel opens it'
    : 'cached formula results used: this workbook does not declare fullCalcOnLoad, so its cached values are what Excel last computed');

  const at=(col,row)=>{ const c=cells[col+row];
    if(!c||c.v==null||c.v==='')return null;
    if(c.formula&&stale)return null;
    return c.shared?(ss[+c.v]==null?null:ss[+c.v]):c.v; };

  /* MAP BY HEADER TEXT, NOT BY COLUMN LETTER. Our generated sheet puts the
     unit rows at row 9 under one layout; the filed sheets start at row 3 under
     another, and Lansing's even carries 'Current Rent' as a header one column
     to the right of the data it labels. A fixed letter map reads whichever of
     those it was written for and silently returns nothing for the other. */
  const COLS='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const WANT=[
    ['type',   /^unit ?type$/i,                        true ],
    ['units',  /^#? ?of ?units$|^units$|^# units$/i,   false],
    ['current',/^current ?rents?$/i,                   false],
    /* Ours says "RCS Rent", the PM team's says "Proposed Rents". Same column. */
    ['proposed',/^(proposed|rcs) ?rents?$/i,           false],
    ['ua',     /^ua$|^utility ?allowance$/i,           false],
    ['safmr',  /^safmr\b|^safmr for/i,                 false],
  ];
  /* the header row is the one naming the most of these */
  let hdrRow=0,hdrScore=0,hdr={};
  for(let row=1;row<=25;row++){
    const found={};let n=0;
    for(const col of COLS){
      const raw=at(col,row); if(raw==null)continue;
      /* Headers carry footnote markers -- ours is literally "RCS Rents*" --
         and stray leading space. Strip those before matching, rather than
         adding one more alternative to every pattern. */
      const t=String(raw).replace(/[\s*†‡]+$/,'').replace(/^\s+/,'').trim();
      for(const [key,re] of WANT)if(re.test(t)){(found[key]=found[key]||[]).push(col);n++;}
    }
    if(n>hdrScore){hdrScore=n;hdrRow=row;hdr=found;}
  }
  if(!hdrRow){notes.push('no header row recognised in this workbook; no unit rows read');
    return {docType:'analysisXlsx',pages:[0,0],values:values,boilerplate:[],notes:notes};}
  notes.push('header row '+hdrRow+', '+hdrScore+' columns recognised');

  /* A header may appear more than once, and may sit beside its data rather
     than above it. Take the first candidate column that actually carries a
     value on the first data row, rather than assuming the label is right. */
  const dataStart=hdrRow+1;
  const rowsRead=[],skipped=[];
  const STOP=/^(monthly|annual|grand)?\s*total/i;
  const typeCols=(hdr.type||[]).concat(['B']);
  let r=0;
  for(let row=dataStart;row<dataStart+25;row++){
    let type=null;
    for(const c of typeCols){const v=at(c,row);if(v!=null&&String(v).trim()!==''){type=String(v).trim();break;}}
    if(type==null||type==='')continue;
    if(STOP.test(type))break;
    /* A ROW THAT NAMES A UNIT TYPE AND THEN COUNTS NOTHING IS A TEMPLATE ROW,
       NOT A UNIT TYPE. Several of the filed workbooks leave a labelled but
       empty first row above the real ones. Taking it shifted every subsequent
       row by one, so our first unit type was compared against their second --
       and that single off-by-one produced most of the corpus's apparent
       disagreements: 69 unit-type rows across 24 properties, plus the counts,
       allowances and rents that travel beside them. A row is real if it counts
       units, or charges rent, or proposes one. */
    const num=key=>{
      for(const c of (hdr[key]||[])){const v=at(c,row);
        if(v!=null&&String(v).trim()!=='')return parseFloat(String(v).replace(/[$,]/g,''))||0;}
      return 0;};
    if(!num('units')&&!num('current')&&!num('proposed')){skipped.push(row);continue;}
    values['unit.'+r+'.type']=canon(type);
    for(const [key] of WANT){
      if(key==='type')continue;
      for(const c of (hdr[key]||[])){
        const v=at(c,row);
        if(v!=null&&String(v).trim()!==''){values['unit.'+r+'.'+key]=canon(v);break;}
      }
    }
    /* WHICH SPREADSHEET ROW A VALUE CAME FROM IS NOT DATA. Ours starts at row
       9 and the PM team's at row 3, so comparing it produced one guaranteed
       false difference per unit type on every property. It belongs in the
       notes, where it helps a human find the cell, not in the values. */
    rowsRead.push(r+'->'+row);
    r++;
  }
  if(rowsRead.length)notes.push('unit rows read from sheet rows '+rowsRead.join(', '));
  if(skipped.length)notes.push('skipped as template rows (a unit type counting no units, no rent, no proposal): sheet row '+skipped.join(', '));
  if(!r)notes.push('header row found but no unit rows beneath it');
  return {docType:'analysisXlsx',pages:[0,0],values:values,boilerplate:[],notes:notes};
}

/* ------------------------------------------------------------ assembly --- */
const PDF_TYPES=['coverLetter','submittalLetter','ownerLetter','checklist','rentSchedule','tenantNotice','rcsStudy'];
async function factsForRange(doc,docType,from,to){
  const notes=[],lines=[];
  for(let i=from;i<=to;i++){ const ls=await pageLines(doc,i); ls.forEach(l=>lines.push(l)); }
  const L=lines.map(l=>l.text);
  const SQ=L.map(s=>s.replace(/\s+/g,''));
  const ALL=SQ.join('');
  let values={};
  if(docType==='rentSchedule'){
    let A=await rangeAnnots(doc,from,to),flat=false;
    if(!Object.keys(A).length){
      A=await flattenedFields(doc,from,to);
      if(Object.keys(A).length)notes.push('no widgets on this schedule: it was read by laying our blank HUD-92458\'s field boxes over the page, the same way the app reads an executed copy');
      flat=true;
    }
    values=rentScheduleValues(A,notes,flat);
  }
  else if(docType==='coverLetter')  values=coverLetterValues(lines,L,SQ,ALL,notes);
  else if(docType==='submittalLetter'||docType==='ownerLetter') values=submittalLetterValues(lines,L,SQ,ALL,notes);
  else if(docType==='checklist')    values=checklistValues(L,SQ,ALL,await rangeAnnots(doc,from,to),notes);
  else if(docType==='tenantNotice') values=tenantNoticeValues(lines,L,SQ,ALL,notes);
  else if(docType==='rcsStudy')     notes.push('the appraiser study is an upload, not a document we generate; it is carried as a page range only');
  const bp=docType==='rcsStudy'?[]:boilerplateOf(lines,values);
  return {docType:docType==='ownerLetter'?'submittalLetter':docType,pages:[from,to],values:values,boilerplate:bp,notes:notes};
}

async function combinedPackage(bytes){
  const doc=await loadDoc(bytes);
  const marks=await classifyPages(doc);
  const notes=[];
  const secs=[];
  marks.forEach(m=>{
    const cur=secs[secs.length-1];
    if(m.start){ secs.push({type:m.start,from:m.page,to:m.page}); return; }
    const c=cur&&CONTINUES[cur.type];
    if(c&&c(m.np)){ cur.to=m.page; return; }
    if(cur&&cur.type==='rcsStudy'){ cur.to=m.page; return; }
    secs.push({type:'rcsStudy',from:m.page,to:m.page});
  });
  const out={notes:notes,sections:secs.map(s=>({docType:s.type,pages:[s.from,s.to]}))};
  for(const s of secs){
    const f=await factsForRange(doc,s.type,s.from,s.to);
    if(out[f.docType]){ out[f.docType].notes.push('a second '+f.docType+' was found at pages '+(s.from+1)+'-'+(s.to+1)+' and ignored'); notes.push('more than one '+f.docType+' in this package'); continue; }
    out[f.docType]=f;
  }
  ['coverLetter','submittalLetter','checklist','rentSchedule','tenantNotice'].forEach(t=>{
    if(!out[t])notes.push('no '+t+' was recognised in this package');});
  return out;
}

const KNOWN=PDF_TYPES.concat(['analysisXlsx','combinedPackage']);
async function extractFacts(bytes,docType){
  if(KNOWN.indexOf(docType)<0)
    throw new Error('extractFacts: unknown docType '+JSON.stringify(docType)+' (expected one of '+KNOWN.join(', ')+')');
  const u8=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  if(docType==='analysisXlsx')return xlsxFacts(u8);
  if(u8[0]===0x50&&u8[1]===0x4b)
    throw new Error('extractFacts: these bytes are a zip, not a PDF — did you mean docType "analysisXlsx"?');
  if(docType==='combinedPackage')return await combinedPackage(u8);
  const doc=await loadDoc(u8);
  return await factsForRange(doc,docType,0,doc.getPageCount()-1);
}

module.exports={extractFacts,canon,normProse,loadDoc,pageLines,pageAnnots,rangeAnnots,
  shiftedPages,shiftDecode,shiftDecodable,maybeDecode,textScore,boilerplateOf,
  RS_SCALARS,RS_ROW_BASE,RS_ROW_STRIDE,RS_COLS,KNOWN};
