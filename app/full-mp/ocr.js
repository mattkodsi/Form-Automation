/* ============ Tier 3: a scanned schedule, read by OCR ============
   The recognition itself runs server-side (supabase/functions/ocr-rs -> Azure
   Document Intelligence). It cannot run inside the edge function — Supabase caps
   a request at 2s of CPU and OCR needs seconds per page — and it has no business
   in the browser either, where it would mean shipping ~6MB of wasm to a one-file
   app. So everything below is geometry: putting Azure's words back onto the
   boxes of our own blank template, then handing the result to the same
   rsAssembleFields (and the same totals gate) tiers 1 and 2 already use.

   A sheet never lands square on the glass, so the words come back shifted and
   slightly rescaled. We recover that by matching label text the blank form
   always prints ("Refrigerator", "Corporation", ...) against those same labels
   in our template, then fitting one scale + offset through the pairs. The
   anchors are read out of the template at runtime, never hand-measured, so a
   HUD form revision that moves the labels moves the anchors with it. */

/* Why the last scan came back empty, in the endpoint's own words. Every failure
   below used to collapse into one null, and the form then said "could not be
   read" — which is what it says for a page with nothing on it, for a page Azure
   declined, and for a page that simply took too long. Three different problems,
   one useless sentence, and no way for the reader to know that trying again
   might work. */
let OCR_WHY='';
function ocrWhy(){return OCR_WHY;}
const OCR_MAXPAGES=4;                  // template is 3 pages; leave room for a cover sheet
const OCR_MINPAIRS=8;                  // fewer matched labels than this is a guess, not a fit:
                                       // four alone will sit perfectly on the WRONG template page
const OCR_MAXRESID=6;                  // template points; a good fit lands well under 2
const OCR_PADX=4, OCR_PADY=2;          // OCR jitter allowance around a field box
const OCR_LINE=3;                      // words within this many points share a line
const OCR_TOKEN=/^[A-Za-z][A-Za-z0-9.\-\/]{3,}$/;  // long enough to be worth trusting as an anchor
/* Every checkbox on the form, by field id: Part B's equipment / utilities / services
   and their write-in flags, then Part G's entity type. A tick is a drawn glyph, and
   OCR duly reports it as a letter — a mark in the "Other" box came back as "K" and
   put "Other (specify)" in a form whose entity type is Limited Partnership. So words
   are barred from these boxes entirely; only Azure's selection marks may set them. */
const OCR_CHECKBOX=[99,100,101,102,103,104,105, 116,118,120,122,124, 129,130,131,132,141,142,
  106,108,110,112,114, 133,135,137,139,143,145, 126, 198,199,200,201,202,203,204];

let _ocrTpl=null;
async function ocrTemplate(){ // blank template -> per page {w,h,anchors}
  if(_ocrTpl)return _ocrTpl;
  const b64=window.RCSTemplates&&window.RCSTemplates.rentSchedule;if(!b64)return null;
  const bin=atob(b64);const tb=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)tb[i]=bin.charCodeAt(i);
  const doc=await window.PDFLib.PDFDocument.load(tb,{parseSpeed:Infinity});
  const runs=await rsTextPages(doc);
  _ocrTpl=doc.getPages().map((p,i)=>{const sz=p.getSize();
    // A run's FIRST token begins exactly at the run's origin, so its position is
    // known rather than inferred; later tokens would have to be guessed at from
    // character widths, and that error would go straight into the fit.
    const c=new Map();
    (runs[i]||[]).forEach(r=>{const t=String(r.s).trim().split(/\s+/)[0]||'';
      if(!OCR_TOKEN.test(t))return;const k=t.toLowerCase();
      if(!c.has(k))c.set(k,[]);c.get(k).push(r);});
    const anchors={};c.forEach((v,k)=>{if(v.length===1)anchors[k]={x:v[0].x,y:v[0].y};});
    // every run, kept whole, so a scanned word can be recognized as the form's
    // own printed label rather than something the PM typed (see ocrDropLabels)
    const labels=(runs[i]||[]).map(r=>({x:r.x,y:r.y,t:String(r.s).toLowerCase().split(/\s+/).filter(Boolean)}));
    return {w:sz.width,h:sz.height,anchors:anchors,labels:labels};});
  return _ocrTpl;}

function ocrWords(pg,tpl){ // Azure words -> template-sized space, PDF's y direction
  const sx=tpl.w/(pg.width||1), sy=tpl.h/(pg.height||1);
  return (pg.words||[]).map(w=>{const p=w.poly||[];const xs=[],ys=[];
    for(let i=0;i+1<p.length;i+=2){xs.push(p[i]);ys.push(p[i+1]);}
    if(!xs.length)return null;
    const x0=Math.min.apply(null,xs),x1=Math.max.apply(null,xs);
    const y0=Math.min.apply(null,ys),y1=Math.max.apply(null,ys);
    // Azure measures down from the top-left, a PDF up from the bottom-left.
    // Normalising by the reported page size first means the fit below only has
    // to absorb the scan's own stretch, so its 0.8-1.25 sanity range stays
    // meaningful whether Azure reported inches (PDF input) or pixels (image).
    return {s:String(w.s||''),x0:x0*sx,x1:x1*sx,y0:(pg.height-y1)*sy,y1:(pg.height-y0)*sy};
  }).filter(Boolean);}

const ocrX=(f,x,y)=>f.c*x-f.s*y+f.tx, ocrY=(f,x,y)=>f.s*x+f.c*y+f.ty;
function ocrMarks(pg,tpl){ // Azure selection marks -> centres in template-sized space
  const sx=tpl.w/(pg.width||1), sy=tpl.h/(pg.height||1);
  return (pg.marks||[]).map(m=>{const p=m.poly||[];const xs=[],ys=[];
    for(let i=0;i+1<p.length;i+=2){xs.push(p[i]);ys.push(p[i+1]);}
    if(!xs.length)return null;
    const cx=(Math.min.apply(null,xs)+Math.max.apply(null,xs))/2;
    const cy=(Math.min.apply(null,ys)+Math.max.apply(null,ys))/2;
    return {on:!!m.on,x:cx*sx,y:(pg.height-cy)*sy};}).filter(Boolean);}

function ocrFit(pairs){ // least squares similarity: tpl = scale*rotate(doc) + shift
  const n=pairs.length;if(n<OCR_MINPAIRS)return null;
  let mdx=0,mdy=0,mtx=0,mty=0;
  pairs.forEach(p=>{mdx+=p.dx;mdy+=p.dy;mtx+=p.tx;mty+=p.ty;});
  mdx/=n;mdy/=n;mtx/=n;mty/=n;
  let nc=0,ns=0,den=0;
  pairs.forEach(p=>{const dx=p.dx-mdx,dy=p.dy-mdy,tx=p.tx-mtx,ty=p.ty-mty;
    nc+=dx*tx+dy*ty; ns+=dx*ty-dy*tx; den+=dx*dx+dy*dy;});
  if(!(den>0))return null;
  // Rotation is carried, not assumed away: a sheet lands askew on the glass as
  // often as not, and a degree over a letter page is several points at the edges
  // — enough to walk a value into its neighbor's box.
  const c=nc/den, s=ns/den;
  const f={c:c,s:s,tx:mtx-(c*mdx-s*mdy),ty:mty-(s*mdx+c*mdy),a:Math.hypot(c,s),n:n};
  const rs=pairs.map(p=>Math.hypot(ocrX(f,p.dx,p.dy)-p.tx,ocrY(f,p.dx,p.dy)-p.ty)).sort((x,y)=>x-y);
  f.resid=rs[rs.length>>1];return f;}

const OCR_BIN=8, OCR_TIGHT=4;    // shift-vote grid, then the inlier band, in points
function ocrRegister(words,anchors){ // -> transform onto the template, or null
  // A dense form repeats its own labels — "Unit", "Number" and "Date" each head
  // several columns, and this template prints some labels twice a couple of
  // points apart to fake bold. So every occurrence becomes a candidate and the
  // transform is the one the most candidates agree on. Insisting instead that a
  // label be unique threw away all 40 anchors on a real schedule.
  const cand=[];
  words.forEach(w=>{const t=w.s.trim();if(!OCR_TOKEN.test(t))return;
    const a=anchors[t.toLowerCase()];if(a)cand.push({dx:w.x0,dy:w.y0,tx:a.x,ty:a.y});});
  if(cand.length<OCR_MINPAIRS){
    OCR_WHY='The scan came back, but only '+cand.length+' of the blank form\u2019s printed labels were recognised on the page (it needs '+OCR_MINPAIRS+' to line the page up).';
    return null;}
  // Vote for a shift on a coarse grid: the true correspondences pile into one
  // bin while the mismatched ones scatter. Scale is left to least squares below.
  const votes=new Map();
  cand.forEach(p=>{const k=Math.round((p.tx-p.dx)/OCR_BIN)+':'+Math.round((p.ty-p.dy)/OCR_BIN);
    votes.set(k,(votes.get(k)||0)+1);});
  let bk=null,bv=0;votes.forEach((v,k)=>{if(v>bv){bv=v;bk=k;}});
  if(!bk){OCR_WHY='The scan came back, but its '+cand.length+' recognised labels did not agree on where the page sits.';return null;}
  const kp=bk.split(':'),sx=+kp[0]*OCR_BIN,sy=+kp[1]*OCR_BIN;
  let f=ocrFit(cand.filter(p=>Math.abs(p.tx-p.dx-sx)<=OCR_BIN*2&&Math.abs(p.ty-p.dy-sy)<=OCR_BIN*2));
  if(!f){OCR_WHY='The scan came back and '+cand.length+' labels were recognised, but the page could not be squared with the blank form \u2014 it may be rotated or cropped.';return null;}
  for(let it=0;it<3;it++){ // re-select inliers against the fit, then refit
    const k2=cand.filter(p=>Math.hypot(ocrX(f,p.dx,p.dy)-p.tx,ocrY(f,p.dx,p.dy)-p.ty)<=OCR_TIGHT);
    if(k2.length<OCR_MINPAIRS)break;
    const f2=ocrFit(k2);if(!f2)break;f=f2;}
  // decline rather than misplace: an implausible size, more than ~5deg of skew,
  // or a fit the anchors themselves do not sit on is not worth filling a form from
  if(f.a<0.8||f.a>1.25){OCR_WHY='The page was read, but it sits at '+Math.round(f.a*100)+'% of the blank form\u2019s size, which is too far off to place values onto it.';return null;}
  if(Math.abs(f.s/f.a)>0.09){OCR_WHY='The page was read, but it is skewed on the page (about '+Math.round(Math.atan(f.s/f.a)*180/Math.PI)+'\u00b0), which is too far off to place values onto it.';return null;}
  if(f.resid>OCR_MAXRESID){OCR_WHY='The page was read and squared with the blank form, but the printed labels do not sit where the form puts them (they are out by about '+f.resid.toFixed(1)+' points), so the values could not be placed with confidence.';return null;}
  return f;}

function ocrDropLabels(words,labels,f){ // the form's own printed text is not an entered value
  // Tier 2 tells a label from a value by depth — values sit in the flattened
  // field's XObject, the blank form's labels in the page stream. A scan carries
  // no such signal. But registration lands a printed label back on the very run
  // it was printed from, so a word matching that run's own text, on that run's
  // own baseline and at or right of its origin, is the form talking, not the PM.
  return words.filter(w=>{
    const t=w.s.trim().toLowerCase();if(!t)return false;
    if(/^[_\-–—.]+$/.test(t))return false;   // a printed rule to write on, not writing
    const X=ocrX(f,w.x0,w.y0), Y=ocrY(f,w.x0,w.y0);
    for(let i=0;i<labels.length;i++){const L=labels[i];
      if(Math.abs(Y-L.y)>3.5||X<L.x-4)continue;
      if(L.t.indexOf(t)>=0)return false;}
    return true;});}

function ocrMap(words,rects,tplPg,f){ // registered words -> {fieldId: text}
  const rs=[];for(const id in rects)if(rects[id].pg===tplPg)rs.push({id:id,r:rects[id]});
  const hit={};
  words.forEach(w=>{
    const mx=(w.x0+w.x1)/2, my=(w.y0+w.y1)/2;
    const cx=ocrX(f,mx,my), cy=ocrY(f,mx,my);
    // Part A's rows are 9pt boxes on a 12pt pitch, so a plain "inside?" test with
    // enough slop for OCR jitter would let every row swallow its neighbor. Give
    // each word to the ONE box whose middle it sits nearest instead.
    let best=null,bd=1e9;
    rs.forEach(o=>{const r=o.r;
      if(cx<r.x-OCR_PADX||cx>r.x+r.w+OCR_PADX)return;
      if(cy<r.y-OCR_PADY||cy>r.y+r.h+OCR_PADY)return;
      const d=Math.abs(cy-(r.y+r.h/2));if(d<bd){bd=d;best=o;}});
    if(best)(hit[best.id]=hit[best.id]||[]).push({x:cx,y:cy,s:w.s});});
  const out={};
  Object.keys(hit).forEach(id=>{
    // Reading order, and it has to be by LINE first. Comparing raw y put words
    // that share a line in height order — a word sitting a fraction of a point
    // lower won the comparison — which turned "Willow Woods" into "Woods Willow"
    // and, worse, scrambled the "Non-Section 8" divider until rsRows stopped
    // recognising it and filed every unassisted unit as Section 8.
    const ws=hit[id].slice().sort((a,b)=>b.y-a.y), lines=[];
    ws.forEach(w=>{const L=lines[lines.length-1];
      if(L&&Math.abs(L.y-w.y)<=OCR_LINE)L.w.push(w);else lines.push({y:w.y,w:[w]});});
    const v=lines.map(L=>L.w.sort((a,b)=>a.x-b.x).map(o=>o.s).join(' ')).join(' ').trim();
    if(v)out[id]=v;});
  return out;}

async function ocrSplitPages(bytes,max){
  // Azure's free tier reads only the first two pages of a file and drops the
  // rest SILENTLY, so a cover sheet would cost us the certification page with no
  // error to notice. One page per request sidesteps that, and keeps every
  // request far under the tier's 4MB ceiling.
  const src=await window.PDFLib.PDFDocument.load(bytes,{ignoreEncryption:true,parseSpeed:Infinity});
  const n=Math.min(src.getPageCount(),max),out=[];
  for(let i=0;i<n;i++){const d=await window.PDFLib.PDFDocument.create();
    const cp=await d.copyPages(src,[i]);d.addPage(cp[0]);out.push(await d.save());}
  return out;}

function ocrB64(u8){let s='';   // chunked: one apply() over a whole page blows the stack
  for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));
  return btoa(s);}

async function ocrAnalyze(u8){ // ra-seam: the OCR endpoint
  if(!supaClient)throw new Error('not signed in');
  const r=await supaClient.functions.invoke('ocr-rs',{body:{pdf:ocrB64(u8)}});
  if(r.error){let m='request failed';try{m=(await r.error.context.json()).error||m;}catch(e){m=r.error.message||m;}throw new Error(m);}
  return r.data;}

function ocrPageMap(pg,tplPg,tpl,rects){ // one OCR'd page -> {F,s8} against a template page
  if(!pg||!tpl[tplPg])return null;
  const ws=ocrWords(pg,tpl[tplPg]);
  const f=ocrRegister(ws,tpl[tplPg].anchors);if(!f)return null;
  // read Part I before labels are dropped: finding its number depends on first
  // finding the printed label that names it
  const s8=rsFindS8(ws.map(w=>({s:w.s,x:ocrX(f,w.x0,w.y0),y:ocrY(f,w.x0,w.y0)})));
  const F=ocrMap(ocrDropLabels(ws,tpl[tplPg].labels,f),rects,tplPg,f);
  OCR_CHECKBOX.forEach(id=>{delete F[String(id)];});
  // Only a tick Azure reports as SELECTED may turn a box on. An unselected one is
  // left absent rather than written as off, so a scan can add to what is on file
  // but never quietly clear it.
  ocrMarks(pg,tpl[tplPg]).forEach(m=>{if(!m.on)return;
    const cx=ocrX(f,m.x,m.y),cy=ocrY(f,m.x,m.y);
    // exactly one box per tick — the nearest. Setting every box the mark falls
    // within let a single tick, nudged by a degree of skew, switch on a
    // neighboring utility that the schedule leaves off.
    let best=null,bd=1e9;
    OCR_CHECKBOX.forEach(id=>{const r=rects[String(id)];if(!r||r.pg!==tplPg)return;
      if(cx<r.x-OCR_PADX||cx>r.x+r.w+OCR_PADX||cy<r.y-OCR_PADY||cy>r.y+r.h+OCR_PADY)return;
      const d=Math.hypot(cx-(r.x+r.w/2),cy-(r.y+r.h/2));if(d<bd){bd=d;best=id;}});
    if(best!==null)F[String(best)]='X';});
  return {F:F,s8:s8};}

/* A document need not be all text or all picture. Real copies come back with the
   rent roll as text and the certification page rendered as dozens of little
   images — the text tier then reads Part A and silently drops the entity,
   principals, signatory and HAP number. So when the text tier cannot find one
   half of the form, that half alone is sent to be OCR'd. `skip` holds the pages
   the text layer already read, so they are not paid for twice. */
async function ocrHalf(bytes,tplPg,skip,onStep){
  if(!window.PDFLib||!supaClient)return null;
  const tpl=await ocrTemplate();if(!tpl||!tpl[tplPg])return null;
  const rects=await rsFieldRects();if(!Object.keys(rects).length)return null;
  let pages;try{pages=await ocrSplitPages(bytes,OCR_MAXPAGES);}catch(e){return null;}
  const re=tplPg===1?RS_PG1:RS_PG0;
  for(let i=0;i<pages.length;i++){
    if(skip&&skip.indexOf(i)>=0)continue;
    if(onStep)onStep(i+1,pages.length);
    /* Skip the page, do not abandon the document. Azure timed out on page 1 of a
       three-page executed copy and this returned null, so pages 2 and 3 — which
       between them carry both halves of the form — were never even sent. A page
       we could not read is a page we could not read, not a verdict on the rest. */
    let pg=null;try{pg=await ocrAnalyze(pages[i]);}catch(e){OCR_WHY=(e&&e.message)||OCR_WHY;continue;}
    if(!pg||!pg.words||!pg.words.length)continue;
    if(!re.test(pg.words.map(w=>w.s).join(' ')))continue;   // never guess the half
    const got=ocrPageMap(pg,tplPg,tpl,rects);
    if(got)return got;}
  return null;}

async function ocrParseRs(bytes,onStep){ // scan -> the tier-1 parsed shape, or null
  OCR_WHY='';
  if(!window.PDFLib||!supaClient)return null;
  const tpl=await ocrTemplate();if(!tpl){OCR_WHY='The blank HUD-92458 template could not be opened, so there was nothing to line the scan up against.';return null;}
  const rects=await rsFieldRects();if(!Object.keys(rects).length){OCR_WHY='The blank form\u2019s field positions could not be read, so a scan cannot be placed onto it.';return null;}
  let pages;try{pages=await ocrSplitPages(bytes,OCR_MAXPAGES);}catch(e){OCR_WHY='The document\u2019s pages could not be separated for scanning.';return null;}
  // Stop as soon as both halves of the form have turned up: on a plain two-page
  // scan that is two pages billed, not four, and nothing is read that we cannot
  // place. Which page is which is never assumed from its position.
  const got=[],txt=[];let pg0=-1,pg1=-1;
  for(let i=0;i<pages.length&&(pg0<0||pg1<0);i++){
    if(onStep)onStep(i+1,pages.length);
    let pg=null;try{pg=await ocrAnalyze(pages[i]);}catch(e){OCR_WHY=(e&&e.message)||OCR_WHY;continue;}
    if(!pg||!pg.words||!pg.words.length)continue;
    /* got[] and txt[] are indexed together and rsClassifyPages answers in that
       index, not the page number — which is why a skipped page must not push a
       placeholder here. */
    got.push(pg);txt.push(pg.words.map(w=>w.s).join(' '));
    const c=rsClassifyPages(txt);pg0=c.pg0;pg1=c.pg1;}
  return ocrPlace(got,pg0,pg1,tpl,rects);}

/* Everything after the network: which half is which, where each page sits on the
   blank form, and whether the figures survive the totals gate. Split out of
   ocrParseRs so a suite can replay a REAL Azure response off disk — the whole of
   tier 3 apart from the request itself, exercised with no network, no session
   and no Azure bill. Every bug this session has been on this side of the wire
   and none of it was reachable from a test. */
function ocrPlace(got,pg0,pg1,tpl,rects){
  if(pg0<0){
    if(!OCR_WHY)OCR_WHY='The scan read '+got.length+' page'+(got.length===1?'':'s')+', but none of them looked like Part A of form HUD-92458.';
    return null;}
  const A=ocrPageMap(got[pg0],0,tpl,rects);
  if(!A){if(!OCR_WHY)OCR_WHY='Part A was found but could not be lined up with the blank form.';return null;}  // Part A is the half we cannot do without
  const B=pg1>=0?ocrPageMap(got[pg1],1,tpl,rects):null;
  const s8=(A&&A.s8)||(B&&B.s8)||'';
  const F=Object.assign({},A.F,B?B.F:{});
  const outp=rsAssembleFields(n=>String(F[String(n)]||'').trim());
  /* The last silent exit. The page can register perfectly and still fail here,
     because rsAssembleFields holds the same totals gate tiers 1 and 2 answer to:
     a unit mix whose counts do not add up is a misread, not a record. Saying so
     is the difference between "the scan failed" and "the scan read the page but
     the numbers did not reconcile" — only one of those is worth retrying. */
  if(!outp){OCR_WHY='The page was read and placed correctly, but the figures it produced did not reconcile (the unit counts or rents did not add up), so they were not applied.';return null;}
  if(s8)outp.scalars['property.s8']=s8;
  return outp;}   // rsPartB is told not to claim definite reads for a positional tier

/* The test seam: canned Azure pages in, the same record out. */
async function ocrMapPages(pgs){
  OCR_WHY='';
  const tpl=await ocrTemplate();if(!tpl){OCR_WHY='The blank HUD-92458 template could not be opened.';return null;}
  const rects=await rsFieldRects();if(!Object.keys(rects).length){OCR_WHY='The blank form\u2019s field positions could not be read.';return null;}
  const got=[],txt=[];let pg0=-1,pg1=-1;
  for(let i=0;i<pgs.length&&(pg0<0||pg1<0);i++){
    const pg=pgs[i];if(!pg||!pg.words||!pg.words.length)continue;
    got.push(pg);txt.push(pg.words.map(w=>w.s).join(' '));
    const c=rsClassifyPages(txt);pg0=c.pg0;pg1=c.pg1;}
  return ocrPlace(got,pg0,pg1,tpl,rects);}
