/* score.js — how far along a package is, and what is holding it.

   ONE computation, three readers. The property ring used to be `completenessOf`
   in the data layer: ten durable keys, counted, and never reconciled with what a
   document actually needs. So a property read 100% with the draft rent schedule
   and the tenant notice unbuildable — reported 2026-07-28. The requirements it
   never saw were sig.title, poc.name, the appraiser, the FHA number, the
   rents-effective date, the unit mix and the proposed rents.

   This file holds the requirement tables and the arithmetic, as a pure function
   of a `read(key) -> string`. app.js passes its own `get`; db.js and
   db.supabase.js pass a read over the dominant cycle's cells. Neither can answer
   differently from the other, which is the whole point.

   THE LADDER. Three gates, and a gate must be COMPLETE before the score leaves
   it, so every boundary means exactly one thing:

       0-30    Profile    30 = this is a real property record
      30-70    Buildable  70 = every document in this package has its source
      70-100   Clean     100 = nothing left to enter

   Every value is a multiple of 5 (about twenty are reachable). Inside a gate the
   score is capped one step below the top: you never see 70 without having earned
   what 70 says. */
(function(){
'use strict';

const numf=v=>{const n=parseFloat(String(v||'').replace(/[^0-9.\-]/g,''));return isNaN(n)?0:n;};
/* A schedule that prints "N/A" for the FHA number is telling us there ISN'T one.
   Storing that is right; counting it as a filled field is not. */
const NA_RE=/^(n\/?a|n\.a\.?|none|null|tbd|-{1,3})$/i;
const hasReal=(read,k)=>{const v=String(read(k)==null?'':read(k)).trim();return v!==''&&!NA_RE.test(v);};

/* ── the resolvers the requirement tables need ──────────────────────────────
   Each one mirrors its namesake in app.js. They are here rather than passed in
   because the menu and the launcher score a record with no form loaded, and a
   score that could only be computed with the form open would be a second
   computation again. test_browser.js pins these against app.js's own on a live
   form — if one is edited and the other is not, that check fails. */
const dateEffResolved=read=>{const src=read('rent_schedule.date_eff_source')||(read('rent_schedule.date_eff_rs')?'rs':'custom');
  return src==='custom'?(read('rent_schedule.date_eff_custom')||read('rent_schedule.date_rents_effective')):read('rent_schedule.date_eff_rs');};
const ocafFactorResolved=read=>{const src=read('ocaf.factor_src')||(read('ocaf.factor_pub')?'fr':'custom');
  return src==='custom'?numf(read('ocaf.factor_custom')):numf(read('ocaf.factor_pub'));};
const uaHas=(read,k)=>{const v=read(k);return v!==''&&v!=null;};
const defUaSrc=(read,i)=>uaHas(read,'units.'+i+'.ua_exec')?'exec':(uaHas(read,'units.'+i+'.ua_rcs')?'rcs':'custom');
const uaResolvedOf=(read,i)=>{const src=read('units.'+i+'.ua_source')||defUaSrc(read,i);
  if(src==='rcs')return numf(read('units.'+i+'.ua_rcs'));
  if(src==='custom')return numf(read('units.'+i+'.ua_custom'));
  return numf(read('units.'+i+'.ua_exec'));};
const defSafmrSrc=(read,i)=>{const h=numf(read('units.'+i+'.safmr_hud')),r=numf(read('units.'+i+'.safmr_rcs'));return h>0?'hud':(r>0?'rcs':'custom');};
const safmrResolvedOf=(read,i)=>{const src=read('units.'+i+'.safmr_source')||defSafmrSrc(read,i);
  const sh=numf(read('units.'+i+'.safmr_hud')),sr=numf(read('units.'+i+'.safmr_rcs')),sc=numf(read('units.'+i+'.safmr_custom'));
  return src==='custom'?sc:(src==='rcs'?(sr||sh):(sh||sr));};
const UAF_UTILS=['oil','gas','electric','water'];
function uafFigures(read,units){   // {any, dec} — the two facts the UAF documents turn on
  let any=false,dec=0;
  (units||[]).forEach(i=>{
    let cur=0,neu=0;
    UAF_UTILS.forEach(u=>{const c=numf(read('units.'+i+'.uac_'+u)),f=numf(read('uaf.f_'+u));
      cur+=c;neu+=(c>0&&f>0)?Math.round(c*f):0;});
    if(cur>0)any=true;
    if(cur>0&&neu>0&&neu<cur)dec++;});
  return {any:any,dec:dec};}
const unitsCounted=(read,units)=>(units||[]).some(i=>numf(read('units.'+i+'.num_units'))>0);

/* ── what each document requires ────────────────────────────────────────────
   Moved here from app.js unchanged. Every entry names the hole it leaves on the
   page, and every one was audited against what gen.js ACTUALLY prints. */
const DOC_REQS={
  /* Signature block, and a closing sentence that tells the CA who to call. */
  cover:[['property.name','property name',2],['property.s8','Section 8 number',2],
         ['ca.name','CA contact name',4],['ca.org','CA organization',4],
         ['poc.name','point of contact',3],
         ['sig.name','signatory name',3],['sig.title','signatory title',3]],
  /* Certification 2 names the appraiser, 7 names the point of contact, and the
     owner signs the lot under penalty of perjury — so each is required, not
     merely suggested. The firm alone left "The RCS appraiser's (, Smith & Co)". */
  owner:[['property.name','property name',2],['property.s8','Section 8 number',2],
         ['ca.name','CA contact name',4],['ca.org','CA organization',4],
         ['owner.entity_name','ownership entity',2],
         ['appr.name','appraiser name',5],['appr.firm','appraisal firm',5],
         ['poc.name','point of contact',3],
         ['sig.name','signatory name',3],['sig.title','signatory title',3]],
  /* The property name prints 18pt across the head of the form. */
  checklist:[['property.name','property name',2],
             ['sig.name','signatory name',3],['sig.title','signatory title',3]],
  /* HUD-92458's header block: name, FHA number, the date the rents take effect
     (checked separately, it is a resolved value not a plain key), the mortgagor
     entity in Part F, and the Part G signature. The FHA number is its own field
     on this form and is NOT the Section 8 number. */
  schedule:[['property.name','property name',2],
            ['owner.entity_name','ownership entity',2],
            ['sig.name','signatory name',3],['sig.title','signatory title',3]],
  /* ── the OCAF / UAF year ────────────────────────────────────────────────
     Every one of these carries a signature block under a false-claims warning,
     so the signatory is required on each. The published factor is required
     rather than suggested: without it every line from (N) to (R) prints a dash
     and Step 3 lists the CURRENT rents under "Adjusted contract rents". */
  ocafws:[['property.name','property name',2],['property.s8','Section 8 number',2],
          ['sig.name','signatory name',3],['sig.title','signatory title',3]],
  exhibita:[['property.name','property name',2],['property.s8','Section 8 number',2],
            ['sig.name','signatory name',3],['sig.title','signatory title',3]],
  /* Written only for a floating rate, and its whole subject is the comparison —
     with neither figure it certifies a determination it did not make. */
  dsevid:[['property.name','property name',2],['property.s8','Section 8 number',2],
          ['sig.name','signatory name',3],['sig.title','signatory title',3]],
  uafcert:[['property.name','property name',2],['property.s8','Section 8 number',2],
           ['sig.name','signatory name',3],['sig.title','signatory title',3]],
  /* Served on residents under 24 CFR 245.420. The contract administrator is
     named in five of its sentences, and it is signed by the sender. */
  uanotice:[['property.name','property name',2],['ca.org','CA organization',4],
            ['tenant.sender_name','tenant-notice sender name',9]],
  /* Addressed to the CA by name, and headed by the ownership entity — which
     printed "[Ownership Entity Name]" in the letterhead when we held none. */
  tcert:[['property.name','property name',2],['property.s8','Section 8 number',2],
         ['owner.entity_name','ownership entity',2],
         ['ca.name','CA contact name',4],['ca.org','CA organization',4],
         ['sig.name','signatory name',3],['sig.title','signatory title',3]],
  /* The property name is the notice's subject — it appears in six sentences. */
  notice:[['property.name','property name',2],
          ['ca.org','CA organization',4],['tenant.sender_name','tenant-notice sender name',9]],
};

/* Every requirement a document has, each carrying whether it is met — not only
   the unmet ones. The score needs the denominator: "3 of 12 blockers left" and
   "how far into this gate" are unanswerable from a list of what is missing. */
function docReqs(read,ctx,id){
  ctx=ctx||{};const units=ctx.units||[];
  const out=(DOC_REQS[id]||[]).map(x=>({key:x[0],label:x[1],sec:x[2],ok:hasReal(read,x[0])}));
  const add=(key,label,sec,ok)=>out.push({key:key,label:label,sec:sec,ok:!!ok});
  const counted=unitsCounted(read,units);
  /* Resolved values and row conditions: not a plain lookup, so not a plain key. */
  if(id==='schedule'){
    add('units','at least one unit type with a count',6,counted);
    add('rent_schedule.date_eff_custom','date the rents take effect',6,!!String(dateEffResolved(read)||'').trim());}
  if(id==='ocafws'||id==='exhibita'||id==='dsevid'){
    add('units','at least one unit type with a count',6,counted);
    if(counted)add('units.0.current','current contract rents',6,units.some(i=>numf(read('units.'+i+'.current'))>0));
    if(id!=='dsevid')add('ocaf.factor_custom','the published OCAF factor',10,ocafFactorResolved(read)>0);
    if(id==='dsevid')add('ocaf.ds_t12','a trailing-12 or forward-12 debt service figure',10,
      numf(read('ocaf.ds_t12'))>0||numf(read('ocaf.ds_f12'))>0);
    add('rent_schedule.date_eff_custom','date the rents take effect',6,!!String(dateEffResolved(read)||'').trim());}
  if(id==='uafcert'||id==='uanotice'){
    add('uaf.f_electric','at least one utility allowance factor',11,UAF_UTILS.some(u=>numf(read('uaf.f_'+u))>0));
    add('units.0.uac_electric','the current allowance broken down by utility',11,uafFigures(read,units).any);}
  if(id==='notice'){
    add('units','at least one unit type with a count',6,counted);
    /* A notice served under 24 CFR 245 exists to state the increase. With no
       proposed rent its Requested Rent column prints empty down the page. */
    if(counted)add('units.0.proposed','proposed rents',6,units.some(i=>hasReal(read,'units.'+i+'.proposed')));}
  return out;}

/* Blockers stop a document being written; caveats do not, but they change what
   it says. The management street is the clearest case: the notice generates
   without it and simply never tells a tenant where to inspect the materials. */
function docCaveatReqs(read,ctx,id){
  ctx=ctx||{};const units=ctx.units||[];const out=[];
  const dim=(k,label,sec)=>out.push({key:k,label:label,sec:sec,ok:hasReal(read,k)});
  const add=(key,label,sec,ok)=>out.push({key:key,label:label,sec:sec,ok:!!ok});
  /* The addressee block on both letters is filtered before printing, so a
     missing line vanishes silently rather than printing blank — which is why
     these are caveats and not blockers. */
  /* The FHA number is NOT required, and requiring it was a dead end rather than
     merely strict. Plenty of Section 8 properties carry no FHA-insured mortgage
     and their rent schedule prints "N/A" in that box — and hasReal() reads N/A
     as not-an-answer, by design, so such a property could never satisfy it even
     by entering exactly what its own document says. The draft rent schedule was
     permanently un-generatable and the package could never reach ready.

     So: a caveat, and satisfied by anything entered INCLUDING N/A. This is the
     one place that departs from hasReal, because the question here is not "do we
     know the number" but "has somebody said what goes in the box" — and N/A is
     an answer to that. */
  if(id==='schedule')add('property.fha','FHA number',2,String(read('property.fha')||'').trim()!=='');
  if(id==='cover'||id==='owner'){dim('ca.position','CA contact position',4);dim('ca.addr_street','CA street address',4);}
  if(id==='cover')add('poc.phone','a phone or email for the point of contact',3,hasReal(read,'poc.phone')||hasReal(read,'poc.email'));
  /* Certification 8 promises the appraiser's contact details "below", then
     prints nothing at all when we hold none of them. */
  if(id==='owner'){dim('poc.email','point-of-contact email',3);dim('poc.phone','point-of-contact phone',3);
    dim('appr.addr_street','appraiser street address',5);dim('appr.email','appraiser email',5);dim('appr.phone','appraiser phone',5);}
  if(id==='checklist'){const n=ctx.checklistLen||24;let any=false;
    for(let i=0;i<n;i++)if(read('check.'+i)==='1'){any=true;break;}
    add('','no checklist item is ticked',8,any);}
  /* Proposed rents are SUGGESTED here and REQUIRED on the notice, deliberately.
     The schedule is a form the owner may want blank on purpose. */
  if(id==='schedule'){
    add('','proposed rents',6,units.some(i=>hasReal(read,'units.'+i+'.proposed')));
    dim('owner.entity_type','ownership entity type',2);}
  if(id==='notice'){
    const onProp=(read('tenant.mgmt_source')||'property')==='property';
    const street=String((onProp?read('property.addr_street'):read('tenant.mgmt_street'))||'').trim();
    add(onProp?'property.addr_street':'tenant.mgmt_street','management street address',onProp?2:9,!!street);}
  return out;}

const docMissing=(read,ctx,id)=>docReqs(read,ctx,id).filter(x=>!x.ok).map(x=>({key:x.key,label:x.label,sec:x.sec}));
const docWarns=(read,ctx,id)=>docCaveatReqs(read,ctx,id).filter(x=>!x.ok).map(x=>({key:x.key,label:x.label,sec:x.sec}));

/* ── what is in the package ─────────────────────────────────────────────────
   The package's contents were described in four places — the card's RCS branch
   (with computed ticks), the card's OCAF/UAF branch (plain strings, no
   readiness computed at all, which is FORM-RULES §15 exactly), and the two
   generate runs. A score derived from a fifth list would drift from all four.
   This is that list; everything else reads it. */
function packageDocs(ctx){
  ctx=ctx||{};const has=p=>(ctx.programs&&ctx.programs.length?ctx.programs:['rcs']).indexOf(p)>=0;
  const D=[],doc=(id,label,produce,required)=>D.push({id:id,label:label,produce:produce,required:required!==false});
  if(has('rcs')){
    doc('cover','Cover letter (CA)','generate');
    doc('owner','Owner cover letter','generate');
    doc('checklist','Owner’s checklist','generate');
    /* Document 04 is an upload, not a generation — but it is still one of the
       six. Scoring it as a caveat would let the ring promise a complete package
       with no study in it. */
    doc('rcs','RCS report','upload');
    doc('schedule','Draft rent schedule','generate');
    doc('notice','Tenant notice','generate');
    return D;}
  if(has('ocaf')){
    doc('ocafws','OCAF worksheet (per HUD-9625)','generate');
    doc('exhibita','Revised Exhibit A','generate');
    if(/floating/i.test(ctx.rateType||''))doc('dsevid','Debt-service determination (T-12 / F-12)','generate');}
  if(has('uaf'))doc('uafcert','UAF certification / breakdown','generate');
  doc('schedule','Revised rent schedule'+(has('ocaf')&&has('uaf')?' (merged OCAF + UAF)':''),'generate');
  /* Offered only where there IS a decrease: with none there is nothing to serve.
     Listing them anyway would put a document in the package that the generate
     run correctly refuses to write, and hold the score under 70 forever. */
  if(has('uaf')&&ctx.uafDec>0){
    doc('uanotice','30-day tenant notice (UA decrease)','generate');
    doc('tcert','Tenant-comment certification','generate');}
  /* The CA's auto-OCAF package is filed with the package but does not block it —
     the generate run says so with a warning, not a blocker. */
  if(has('ocaf'))doc('capkg','CA package (uploaded)','upload',false);
  return D;}

const uploadHeld=(ctx,id)=>id==='rcs'?!!ctx.hasStudy:(id==='capkg'?!!ctx.hasCaPkg:false);

/* ── the arithmetic ─────────────────────────────────────────────────────────
   Round to 5, then cap one step below the gate's top: a gate is left only when
   it is finished, so 30, 70 and 100 each carry exactly one meaning. */
const round5=n=>Math.round(n/5)*5;
function gateScore(floor,ceil,done,total){
  if(!total||done>=total)return ceil;
  if(done<=0)return floor;
  const raw=floor+(ceil-floor)*(done/total);
  return Math.max(floor,Math.min(ceil-5,round5(raw)));}

function dedupe(items){   // by key where there is one, else by label
  const seen=Object.create(null),out=[];
  items.forEach(x=>{const k=x.key?('k:'+x.key):('l:'+x.label);if(seen[k])return;seen[k]=1;out.push(x);});
  return out;}

function packageScore(read,ctx){
  ctx=ctx||{};
  const units=ctx.units||[];
  if(!ctx.uafDec&&(ctx.programs||[]).indexOf('uaf')>=0)ctx=Object.assign({},ctx,{uafDec:uafFigures(read,units).dec});

  /* Gate 1 — is this a real property record? */
  const addrKeys=['property.addr_street','property.addr_city','property.addr_state','property.addr_zip'];
  const g1=[
    {key:'property.name',label:'property name',sec:2,ok:hasReal(read,'property.name')},
    {key:'property.s8',label:'Section 8 number',sec:2,ok:hasReal(read,'property.s8')},
    {key:'property.addr_street',label:'property address',sec:2,ok:addrKeys.every(k=>hasReal(read,k))},
    {key:'owner.entity_name',label:'ownership entity',sec:2,ok:hasReal(read,'owner.entity_name')},
    {key:'units',label:'at least one unit type with a count',sec:6,ok:unitsCounted(read,units)},
  ];
  const g1done=g1.filter(x=>x.ok).length;
  /* Gate 1's keys do not count twice — the documents ask for most of them too. */
  const owned={};g1.forEach(x=>{owned['k:'+x.key]=1;});addrKeys.forEach(k=>{owned['k:'+k]=1;});

  const docs=packageDocs(ctx).map(d=>{
    if(d.produce==='upload')return Object.assign({},d,{ready:uploadHeld(ctx,d.id),reqs:[]});
    const reqs=docReqs(read,ctx,d.id);
    return Object.assign({},d,{ready:reqs.every(r=>r.ok),reqs:reqs});});

  /* Gate 2 — every document in the package has its source. */
  let g2=[];
  docs.forEach(d=>{
    if(d.produce==='upload'){if(d.required)g2.push({key:'@'+d.id,label:d.id==='rcs'?'the completed RCS report (document 04)':'the CA package',sec:1,ok:d.ready});return;}
    d.reqs.forEach(r=>{if(!owned['k:'+r.key])g2.push(r);});});
  g2=dedupe(g2.map(r=>Object.assign({},r)));
  const g2done=g2.filter(x=>x.ok).length;

  /* Gate 3 — nothing left to enter. */
  let g3=[];
  docs.forEach(d=>{if(d.produce==='upload'){if(!d.required)g3.push({key:'@'+d.id,label:'the CA package (filed with the package)',sec:1,ok:d.ready});return;}
    docCaveatReqs(read,ctx,d.id).forEach(w=>{if(!owned['k:'+w.key])g3.push(w);});});
  units.forEach(i=>{
    const ek='units.'+i+'.ua_exec',rk='units.'+i+'.ua_rcs';
    if(uaHas(read,ek)&&uaHas(read,rk)&&numf(read(ek))!==numf(read(rk)))
      g3.push({key:'units.'+i+'.ua_reviewed',label:'utility allowance conflict, unit type '+(i+1),sec:6,ok:read('units.'+i+'.ua_reviewed')==='1'});
    const sh=numf(read('units.'+i+'.safmr_hud')),sr=numf(read('units.'+i+'.safmr_rcs'));
    if(sh>0&&sr>0&&sh!==sr)
      g3.push({key:'units.'+i+'.safmr_reviewed',label:'150% SAFMR conflict, unit type '+(i+1),sec:6,ok:read('units.'+i+'.safmr_reviewed')==='1'});
    const br=read('units.'+i+'.br'),ba=read('units.'+i+'.ba'),brR=read('units.'+i+'.br_rcs'),baR=read('units.'+i+'.ba_rcs');
    if(((brR!==''&&brR!=null)||(baR!==''&&baR!=null))&&((brR&&brR!==br)||(baR&&baR!==ba)))
      g3.push({key:'units.'+i+'.type_reviewed',label:'unit type conflict, unit type '+(i+1),sec:6,ok:read('units.'+i+'.type_reviewed')==='1'});
    const nR=read('units.'+i+'.num_rcs');
    if((nR!==''&&nR!=null)&&numf(nR)!==numf(read('units.'+i+'.num_units')))
      g3.push({key:'units.'+i+'.num_reviewed',label:'unit count conflict, unit type '+(i+1),sec:6,ok:read('units.'+i+'.num_reviewed')==='1'});});
  if((ctx.programs||['rcs']).indexOf('rcs')>=0)
    g3.push({key:'units.0.safmr_custom',label:'a 150% SAFMR for every unit type',sec:6,
      ok:units.filter(i=>numf(read('units.'+i+'.num_units'))>0).every(i=>safmrResolvedOf(read,i)>0)});
  g3.push({key:'@letterhead',label:'the property letterhead',sec:1,ok:!!ctx.hasLetterhead});
  g3=dedupe(g3);
  const g3done=g3.filter(x=>x.ok).length;

  const blockers=g2.filter(x=>!x.ok),caveats=g3.filter(x=>!x.ok);
  let pct,gate;
  if(g1done<g1.length){pct=gateScore(0,30,g1done,g1.length);gate='profile';}
  else if(blockers.length){pct=gateScore(30,70,g2done,g2.length);gate='buildable';}
  else if(caveats.length){pct=gateScore(70,100,g3done,g3.length);gate='clean';}
  else {pct=100;gate='ready';}

  return {pct:pct,gate:gate,
    docs:docs.map(d=>({id:d.id,label:d.label,produce:d.produce,required:d.required,ready:d.ready,
      missing:d.produce==='upload'?(d.ready?[]:[{key:'@'+d.id,label:'not uploaded yet',sec:1}]):d.reqs.filter(r=>!r.ok).map(r=>({key:r.key,label:r.label,sec:r.sec}))})),
    docsReady:docs.filter(d=>d.ready).length, docsTotal:docs.length,
    blockers:blockers.map(x=>({key:x.key,label:x.label,sec:x.sec})),
    caveats:caveats.map(x=>({key:x.key,label:x.label,sec:x.sec})),
    profile:{done:g1done,total:g1.length,
      /* Named, because "3 of 5" is not something anyone can act on. */
      missing:g1.filter(x=>!x.ok).map(x=>({key:x.key,label:x.label,sec:x.sec}))},
    buildable:{done:g2done,total:g2.length},
    clean:{done:g3done,total:g3.length}};}

/* The sentence under the ring. The number moves on fields; this moves on
   documents, because with a dozen blockers across forty points a single field
   is worth 3.3 points and some edits will not move the ring at all. */
function scoreCaption(s){
  if(!s)return '';
  if(s.gate==='profile')return 'Property profile — '+s.profile.done+' of '+s.profile.total+' basics on file';
  if(s.gate==='buildable')return s.docsReady+' of '+s.docsTotal+' documents ready';
  if(s.gate==='clean')return 'Every document has its source · '+s.caveats.length+' item'+(s.caveats.length===1?'':'s')+' left';
  return 'Ready to generate';}

const API={
  packageScore:packageScore, packageDocs:packageDocs, scoreCaption:scoreCaption,
  docReqs:docReqs, docCaveatReqs:docCaveatReqs, docMissing:docMissing, docWarns:docWarns,
  gateScore:gateScore, hasReal:hasReal, uafFigures:uafFigures, DOC_REQS:DOC_REQS, NA_RE:NA_RE};
if(typeof window!=="undefined")window.RCSScore=API;
if(typeof module!=="undefined")module.exports=API;
})();
