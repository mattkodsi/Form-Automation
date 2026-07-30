/* app.js — the whole RCS package form (Rich Review v4), on the keyed-cell store. */
const STATES='AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const BR_OPTS=['Studio','1BR','2BR','3BR','4BR','5BR']; const BA_OPTS=['1BA','1.5BA','2BA','2.5BA','3BA'];
/* What a schedule prints after the bedroom count is the unit's LABEL. HUD
   defines nothing here — the 92458 only asks you to show "other features that
   cause rents to vary" — and the corpus takes it at its word: "E" and "F" at
   Beacon Hill, "Elderly" and "Family" at Willow Woods, "Patio" at Lansing
   Manor. 4350.3 supplies the idea behind the common ones, units "designated for
   specific family types, such as those who are elderly or disabled", with the
   reserved quantity a set-aside — but it is one example of the field, not its
   definition. So this is free text, and the count beside it is the set-aside. */
/* HUD's Part A unit type is ONE free-text column, so the form keeps it as one.
   An enum of four could only hold two of the four things the corpus actually
   prints: "1 BR E" and "2 Bedroom, Elderly" matched, "1Bedroom Patio" did not —
   the parser kept the bedroom count and threw "Patio" away, and the generated
   schedule then printed Lansing Manor's two 1-bedroom types identically at
   different rents. These four are autocomplete entries and nothing more; any
   text is valid, and what the schedule said is what the schedule gets back. */
const LABEL_HINTS=['Elderly','Family','Disabled','Near-elderly'];
/* Measured against the real template: the printed unit-type box is 105pt wide
   and the text sets at 9pt Helvetica, where "1 BR / 1 BA Near-elderly" runs
   98.7pt. Past roughly this many characters HUD's box clips without saying so,
   so the form says so instead. A warning, never a limit — the rule is that a
   label is free text. */
const LABEL_PRINT_MAX=24;
/* One place decides what a click advances the chip to, so the handler and the
   suite that guards it cannot drift: '' -> F -> E -> D -> NE -> '' . */
const ENTITY_TYPES=['Individual','Corporation','General Partnership','Limited Partnership','Joint Tenancy/Tenants in Common','Trust','Other (specify)'];
const FIELD_SECTIONS=[
  {n:2,title:'Property',fields:[{k:'property.name',label:'Property name',col:0},{k:'tenant.property_alias',label:'Also known to tenants as',col:0},{k:'property.addr',label:'Address',col:0,type:'addr'},{k:'owner.entity_name',label:'Ownership entity',col:1},{k:'owner.entity_type',label:'Entity type',col:1,type:'select',opts:ENTITY_TYPES},{type:'pair',col:1,items:[{k:'property.s8',label:'Section 8 #'},{k:'property.fha',label:'FHA #'}]}]},
  {n:3,title:'Point of contact & signatory',fields:[{k:'poc.name',label:'Point of contact',col:0},{k:'poc.email',label:'Email',col:0},{k:'poc.phone',label:'Phone',col:0,type:'phone'},{k:'sig.name',label:'Signatory',col:1},{k:'sig.title',label:'Signatory title',col:1,type:'sigtitle'}]},
  {n:4,title:'Contract administrator',fields:[{k:'ca.name',label:'Name',col:0,prefix:'ca.prefix'},{k:'ca.position',label:'Position',col:0},{k:'ca.org',label:'CA organization',col:1},{k:'ca.addr',label:'CA address',col:1,type:'caaddr'}]},
  {n:5,title:'Appraiser',fields:[{k:'appr.name',label:'Appraiser name',col:0},{k:'appr.firm',label:'Appraisal company',col:0},{k:'appr.addr',label:'Appraiser address',col:0,type:'appraddr'},{k:'appr.email',label:'Email',col:1},{k:'appr.phone',label:'Phone',col:1,type:'phone'}]},
  {n:9,title:'Tenant notice',fields:[{k:'tenant.sender_name',label:'Sender — name',col:0},{k:'tenant.sender_title',label:'Sender — title',col:0},{k:'tenant.mgmt_address',label:'Management address',col:1,type:'mgmtaddr'}]},
];
const ADDR=['property.addr_street','property.addr_city','property.addr_state','property.addr_zip'];
const CA_ADDR=['ca.addr_street','ca.addr_city','ca.addr_state','ca.addr_zip'];
const MGMT_ADDR=['tenant.mgmt_street','tenant.mgmt_city','tenant.mgmt_state','tenant.mgmt_zip'];
const APPR_ADDR=['appr.addr_street','appr.addr_city','appr.addr_state','appr.addr_zip'];
const ADDR_GROUPS={'property.addr':ADDR,'ca.addr':CA_ADDR,'tenant.mgmt':MGMT_ADDR,'appr.addr':APPR_ADDR};
const PARTB={equipment:['Range','Refrigerator','Air Conditioner','Disposal','Dishwasher','Carpet','Drapes'],utilities:['Heating','Cooling','Hot Water','Cooking','Lights, etc.'],services:['Parking','Laundry','Swimming Pool','Tennis Courts','Nursing Care','Linen/Maid Service']};
const CHECKLIST_FLAT=['Signed cover letter','Signed owner’s checklist','Scope of repair','Appraiser’s transmittal letter','Scope of work','Subject description (+ photos)','Subject’s market area ID','Neighborhood description','Selection-of-comparables narrative','Locator map (subject + comps)','Rent comparability grid (per type)','Adjustments & conclusions narrative','Comparable profiles (+ photo)','Appraiser’s certification','Appraiser’s license copy (if temp)','Gross rents computation (project + SAFMR)','Gross rents vs SAFMR comparison'];
const SECTION_TITLES={1:'Source documents',2:'Property',3:'Point of contact & signatory',4:'Contract administrator',5:'Appraiser',6:'Rents & unit mix',7:'Items included in rent (Part B)',8:"Owner’s checklist",9:'Tenant notice',10:'OCAF rent adjustment (HUD-9625)',11:'Utility allowance factors',12:'Principals'};
/* HUD publishes exactly four UAF categories per state (UtilAllow_FY file). */
const UAF_UTILS=[['oil','Oil'],['gas','Natural Gas'],['electric','Electric'],['water','Water / Sewer / Trash']];
const D='database',T='this-cycle',O='overridden';
const SEED={ // key manifest only — the VALUES are never read (ALL_KEYS below feeds the store), so no sample data ships in the public bundle
  'property.name':['',D],'property.addr_street':['',D],'property.addr_city':['',D],'property.addr_state':['',D],'property.addr_zip':['',D],'property.fha':['',D],'property.s8':['',D],
  'owner.entity_name':['',D],'owner.entity_type':['',D],'owner.entity_type_other':['',D],
  'poc.name':['',D],'poc.email':['',D],'poc.phone':['',D],
  'sig.name':['',D],'sig.title':['',D],'sig.principal':['',D],'principals.0.name':['',D],'principals.0.title':['',D],
  'ca.org':['',D],'ca.prefix':['',D],'ca.name':['',D],'ca.position':['',D],
  'ca.addr_street':['',D],'ca.addr_city':['',D],'ca.addr_state':['',D],'ca.addr_zip':['',D],
  'appr.firm':['',T],'appr.name':['',T],'appr.email':['',T],'appr.phone':['',T],'appr.addr_street':['',T],'appr.addr_city':['',T],'appr.addr_state':['',T],'appr.addr_zip':['',T],
  'units.0.br':['',D],'units.0.ba':['',D],'units.0.label':['',D],'units.0.num_units':['',D],'units.0.current':['',T],'units.0.proposed':['',T],
  'units.0.ua_exec':['',T],'units.0.ua_rcs':['',T],'units.0.ua_source':['',T],'units.0.ua_reviewed':['',T],'units.0.ua_custom':['',T],
  'units.0.safmr_rcs':['',T],'units.0.safmr_hud':['',T],'units.0.safmr_source':['',T],'units.0.safmr_reviewed':['',T],
  'rent_schedule.date_eff_rs':['',T],'rent_schedule.date_eff_source':['',T],'rent_schedule.date_eff_custom':['',T],'rent_schedule.date_rents_effective':['',T],
  'tenant.sender_name':['',D],'tenant.sender_title':['',D],'tenant.mgmt_source':['',D],'tenant.property_alias':['',D],
  'tenant.mgmt_street':['',D],'tenant.mgmt_city':['',D],'tenant.mgmt_state':['',D],'tenant.mgmt_zip':['',D],
  'ocaf.g':['',T],'ocaf.rate_type':['',D],'ocaf.ds_annual':['',D],'ocaf.ds_t12':['',T],'ocaf.ds_f12':['',T],
  'ocaf.factor_pub':['',T],'ocaf.factor_fy':['',T],'ocaf.factor_pubdate':['',T],'ocaf.factor_src':['',T],'ocaf.factor_custom':['',T],
  'uaf.f_oil':['',T],'uaf.f_gas':['',T],'uaf.f_electric':['',T],'uaf.f_water':['',T],'uaf.factor_fy':['',T],'uaf.factor_pubdate':['',T],'uaf.factor_state':['',T],'ocaf.factor_state':['',T],
  'units.0.uac_oil':['',T],'units.0.uac_gas':['',T],'units.0.uac_electric':['',T],'units.0.uac_water':['',T],
};
const PB_CHECK={'Range':1,'Refrigerator':1,'Carpet':1,'Heating':1,'Hot Water':1,'Cooking':1,'Parking':1};
const PB_FUEL={0:'G',1:'',2:'G',3:'G',4:''};
Object.entries(PARTB).forEach(([g,items])=>items.forEach((it,i)=>{SEED['partb.'+g+'.'+i]=[PB_CHECK[it]?'1':'',D];}));
Object.entries(PB_FUEL).forEach(([i,f])=>SEED['partb.fuel.'+i]=[f,D]);
['e1','e2','e3','e4','e5','u1','s1','s2','s3','s4','s5','s6'].forEach(id=>{SEED['partb.writein.'+id]=['',D];SEED['partb.writein.'+id+'.on']=['',D];});
SEED['partb.writein.u1.fuel']=['',D];
CHECKLIST_FLAT.forEach((it,i)=>{const off=/scope of repair/i.test(it)||/scope of work/i.test(it);SEED['check.'+i]=[off?'':'1',D];});
const ALL_KEYS=Object.keys(SEED).map(k=>({key:k}));

let mpdb=null, activePid=null, activeCid=null, _cyFresh=null;
const bridge={getDb:async()=>mpdb?(activeCid?mpdb.getFlatCycle(activeCid):mpdb.getFlat(activePid)):{},saveDb:async(m)=>{_cyFresh=null;return activeCid?mpdb.saveFlatCycle(activeCid,m):mpdb.saveFlat(activePid,m);},clearDb:async()=>{}};
const store=makeStore(bridge,ALL_KEYS);
let form=store.emptyForm(); let UNITS=[0]; let NONREV=[]; let NS8=[]; let PRINCIPALS=[0]; let _undoStack=[]; let _undoNR=[]; let _undoLI=[]; let _undoPR=[]; let _pending=null,_refocusSel=null,_pendingSnap=null; let _rcsUpload=null; let _rcsBusy=null; let _rsUpload=null; let _rsArm=false;let _rsBusy=null;   // while set, the upload row shows what is being read
let _dlgEnter=null;                  // while a dialog is open, Enter presses its primary button

const CLR={database:['#2563eb','#e8f0fe','On file'],'this-cycle':['#0f766e','#e9f5f2','API / this package'],overridden:['#b45309','#fbf1e6','Overridden'],'auto-calculated':['#2563eb','#e8f0fe','Auto-calc'],'new':['#64748b','#f6f7f9','New']};
/* Dates are stamped in New York, not UTC. toISOString() rolls over at 7 or 8pm
   Eastern, so a package generated in the evening was dated tomorrow — and the
   tenant notice's date is what starts the 30-day comment clock. */
const TODAY=(()=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}catch(e){return new Date().toISOString().slice(0,10);}})();
const el=id=>document.getElementById(id); const get=k=>form[k]?form[k].value:'';
const numf=v=>{const n=parseFloat(String(v||'').replace(/[^0-9.\-]/g,''));return isNaN(n)?0:n;};
const money=n=>'$'+Math.round(n).toLocaleString('en-US');
const money2=n=>'$'+(+n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
function sMoney(n){n=Math.round(n);return(n<0?'-$':'+$')+Math.abs(n).toLocaleString('en-US');}
function sPct(n){n=Math.round(n);return(n<0?'-':'+')+Math.abs(n)+'%';}
function sK(n){const a=Math.abs(n),sg=(n<0?'-$':'+$');return a>=1e6?sg+(a/1e6).toFixed(1)+'M':(a>=1000?sg+Math.round(a/1000)+'K':sg+Math.round(a));}   // no "$0K" — below a thousand, say the number
/* A fall is not good news dressed in green. Sign drives the color on every lift
   figure — teal for a rise, red for a fall, grey for exactly nothing — and the
   caption follows it, so a decrease is never captioned "increase". */
const liftClr=n=>n>0?'#0f766e':(n<0?'#b91c1c':'#64748b');
const liftWord=n=>n<0?'decrease':'increase';
/* ---- display formatting -------------------------------------------------
   Every figure this product shows is formatted at the point of display; the
   record keeps the raw value so parsing, comparison and generation are
   untouched. A units column reading 1689 looks like a database dump, and the
   authority of a document that files with HUD is that its numbers read exact. */
function fmtNum(n){const v=String(n==null?'':n).trim();if(!v)return '';
  const neg=v.charAt(0)==='-',d=v.replace(/[^0-9.]/g,'');if(!d)return '';
  const parts=d.split('.');
  return (neg?'-':'')+parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,',')+(parts[1]?('.'+parts[1]):'');}
/* Ten digits, or eleven led by a country code, get the shape. Anything else is
   shown verbatim — inventing a format for a number we cannot read would assert
   a phone number where the record holds something else. */
function fmtPhone(v){const s=String(v==null?'':v).trim();if(!s)return '';
  let d=s.replace(/\D/g,'');if(d.length===11&&d.charAt(0)==='1')d=d.slice(1);
  if(d.length!==10)return s;
  return '('+d.slice(0,3)+') '+d.slice(3,6)+'-'+d.slice(6);}
function fmtEmail(v){return String(v==null?'':v).trim().toLowerCase();}
function fmtDate(d){if(!d)return '';const p=String(d).split('-');return p.length===3?p[1]+'/'+p[2]+'/'+p[0]:d;}
function fmtPhoneInput(x){const d=String(x).replace(/\D/g,'').slice(0,10);if(!d)return '';if(d.length<4)return '('+d;if(d.length<7)return '('+d.slice(0,3)+') '+d.slice(3);return '('+d.slice(0,3)+') '+d.slice(3,6)+'-'+d.slice(6);}
function cleanNum(x){return String(x==null?'':x).replace(/[^0-9]/g,'');}
function fmtMoney(x){const d=cleanNum(x);return d?(+d).toLocaleString('en-US'):'';}
function fmtDateInput(x){const d=String(x==null?'':x).replace(/\D/g,'').slice(0,8);if(!d)return '';let o=d.slice(0,2);if(d.length>=3)o+='/'+d.slice(2,4);if(d.length>=5)o+='/'+d.slice(4,8);return o;}
const clamp=n=>Math.max(0,Math.min(100,n));
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const setStatus=t=>{el('status').textContent=t||'';};
const srcOf=k=>form[k]?form[k].source:'new';
const markCycle=k=>{if(form[k]&&form[k].source==='new')form[k].source='this-cycle';};
function saveFailed(e){if(dupNameModal(e))return;setStatus('\u26a0 Save failed \u2014 this change is NOT in the database yet. Check your connection and try again. ('+((e&&e.message)||e)+')');}
function saveFailedModal(e){if(dupNameModal(e))return;dialogConfirm('Save failed','The change did not reach the database \u2014 check your connection and try again.<div class="sub" style="margin-top:7px;color:#8791a5">'+esc((e&&e.message)||e)+'</div>','OK',false,function(){});}
/* A name already taken is not a failed save, and must not be reported as one.

   Every save path in this file ends at saveFailed() or saveFailedModal(), so
   the interception goes there rather than at eight call sites — and a caller
   that only knows how to say "check your connection" would otherwise say it
   about a refusal that has nothing to do with the connection.

   Stopping the save is only half the job. The name being typed is usually the
   right one and the OTHER property is usually the stale twin, so the way out —
   give this one a name of its own — is in the dialog, with a suggestion that is
   already free. */
function freeName(base){
  const taken=(mpdb?(mpdb.listProperties()||[]):[]).map(p=>String(p.name||'').trim().toLowerCase());
  const b=String(base||'').trim();
  for(let i=2;i<60;i++){const c=b+' '+i;if(taken.indexOf(c.toLowerCase())<0)return c;}
  return b;}
function dupNameModal(e){
  if(!(e&&e.code==='DUP_PROPERTY_NAME'))return false;
  const other=(mpdb?(mpdb.listProperties()||[]):[]).find(p=>p.id===e.pid);
  const nm=e.dupName||(other&&other.name)||'';
  modal('<div class="dlg-t">That name is already taken</div>'
    +'<div class="dlg-sub">Another property is already called \u201c'+esc(nm)+'\u201d. Two properties under one name is how the record came to hold three of some of them \u2014 so this one needs a name of its own.</div>'
    +'<div class="dlg-field"><label>Call this property</label><input id="dlgIn" autocomplete="off" value="'+esc(freeName(nm))+'"></div>'
    +'<div class="dlg-row"><button class="btn" id="dlgOther">Open the other one</button><span class="dlg-sp"></span><button class="btn p" id="dlgOk">Use this name</button></div>');
  const inp=el('dlgIn');if(inp){inp.focus();if(inp.select)inp.select();}
  _dlgEnter=()=>{const b=el('dlgOk');if(b)b.click();};
  el('dlgOther').onclick=()=>{closeModal();if(other)openLauncher(other.id);};
  el('dlgOk').onclick=async()=>{
    const v=((el('dlgIn')||{}).value||'').trim();if(!v)return;
    closeModal();
    const onForm=el('viewForm')&&el('viewForm').style&&el('viewForm').style.display!=='none';
    if(onForm){
      /* Put the new name in the cell rather than saving behind his back: the
         press that failed was a save, and the next one should be his. */
      form=store.editForm(form,'property.name',v);renderFormHeader();renderBody();
      setStatus('Named \u201c'+v+'\u201d \u2014 save again to commit it.');
    }else{
      try{await mpdb.renameProperty(activePid,v);renderLauncher();setStatus('Renamed to \u201c'+v+'\u201d.');}
      catch(err){saveFailed(err);}
    }};
  return true;}
let DBSNAP={};let FORMSNAP=null; // isDirty compares against THIS, a snapshot taken after boot-time defaults (e.g. the owner's checklist) are applied — not the raw db read, so auto-applied defaults never masquerade as unsaved edits
async function refreshSnap(){DBSNAP=await bridge.getDb();}
/* A cell saved EMPTY is still on file. core.js can only call that "new", because
   db_value:'' is all it has to go on — so changing it looked like first-time entry
   even though revert has somewhere to go back to. After one "Update property
   profile" every untouched key is saved empty, which made this the normal case,
   not an edge one: a utility allowance typed over its Executed-RS value showed
   gray with a save button and no way back. Deviation from a saved value is an
   override, whether or not that saved value was blank. */
function offFile(k){const c=form[k];return !!(c&&c.db_value!=null&&String(c.value==null?'':c.value)!==String(c.db_value));}
/* A source-backed cell (utility allowance, 150% SAFMR, effective date, OCAF
   factor) is displayed through two bookkeeping keys — *_source and *_custom —
   and on an older record NEITHER was ever written: source has db_value null and
   custom is absent from the record entirely. The figure the cell actually shows
   lives in *_hud / *_exec / *_rs, which IS saved. Judging the cell by the two
   keys alone therefore gave it no memory: a saved HUD ceiling went grey the
   moment you edited it, Escape found nothing marked overridden and emptied the
   cell instead of putting the ceiling back, and retyping the very figure on file
   still read as first-time entry. Ask the CELL what is on file instead. */
function srcCellState(cusKey){
  const sp=(typeof srcSpec==='function')?srcSpec(cusKey):null; if(!sp)return null;
  const onSrc=srcOnFileSrc(sp).name;
  const cu=form[sp.cusKey];const onCus=String((cu&&cu.db_value)||'');
  const onVal=onSrc==='custom'?onCus:String(sp.resolve(onSrc)||'');
  const curSrc=get(sp.srcKey)||sp.fallback;
  const cur=curSrc==='custom'?String(get(sp.cusKey)||''):String(sp.resolve(curSrc)||'');
  if(onVal==='')return cur===''?'':'new';        // nothing on file for this cell yet
  return cur===onVal?'database':'overridden';}
/* Put a source-backed cell back to the pair that is on file. revertForm can only
   undo a key it marked 'overridden', which is exactly what these cells lack. */
function srcOnFileSrc(sp){const c=form[sp.srcKey];
  /* Two answers, deliberately: the NAME resolves the on-file figure, the WRITE is
     what the record actually held. On a record that never stored a source the
     write is blank — putting "hud" there instead would be a change of its own and
     left the form dirty after returning a cell to the figure on file. */
  const stored=(c&&c.db_value!=null&&c.db_value!=='')?c.db_value:'';
  return {name:stored||sp.fallback, write:stored};}
function srcRevertCell(cusKey){
  const sp=(typeof srcSpec==='function')?srcSpec(cusKey):null; if(!sp)return false;
  const o=srcOnFileSrc(sp);
  const cu=form[sp.cusKey];const onCus=String((cu&&cu.db_value)||'');
  const wantCus=o.name==='custom'?onCus:'';
  if(String(get(sp.srcKey)||'')===o.write&&String(get(sp.cusKey)||'')===wantCus)return false;
  form=store.editForm(form,sp.srcKey,o.write);
  form=store.editForm(form,sp.cusKey,wantCus);
  return true;}
function modeOf(kk){const keys=Array.isArray(kk)?kk:[kk];let _db=false;
  for(const k of keys){const st=srcCellState(k);if(st!=null){if(st==='overridden')return 'over';if(st==='new')return 'new';if(st==='database')_db=true;}}
  /* Judged on the figure alone a source-backed cell can read "on file" while its
     POINTER has moved: pick a different source and the cell painted amber with
     its pair still hidden, so the change could be neither saved nor reverted.
     An override anywhere in the pair outranks the figure's own verdict. */
  if(keys.some(k=>srcOf(k)==='overridden')||keys.some(offFile))return 'over';
  if(_db)return '';if(keys.some(k=>srcOf(k)==='new'&&get(k)!==''&&get(k)!=null))return 'new';if(keys.some(k=>srcOf(k)==='this-cycle'))return 'cycle';return '';}
/* The pair shows for every key its own press would save. The click handler has
   always widened through coupledKeys before saving; the RENDER did not, so a
   cell could be keyed to one name, be dirty in another, and show nothing —
   which is how a parsed effective date, a pulled OCAF factor and the fiscal
   year behind a utility factor each came to be unsaveable in turn. Widening
   here fixes the family rather than the members: what is shown and what is
   saved are now computed from the same set. */
function ovIcons(kk){const keys=[];(Array.isArray(kk)?kk:[kk]).forEach(function(k){coupledKeys(k).forEach(function(x){if(keys.indexOf(x)<0)keys.push(x);});});const j=keys.join(',');const m=modeOf(keys);
  // A parsed value is exactly as unsaved as a typed one, so it gets the same badge.
  // It costs no more room either: cycle, like new, has nothing to revert TO, so the
  // CSS hides the revert arrow and only the tick shows. (An earlier attempt left
  // that rule out, so both buttons rendered and overflowed the tighter cells.)
  return `<span class="ovic" data-ovic="${j}" data-mode="${m}" style="display:${m?'inline-flex':'none'}"><button class="miniic rv" data-rev="${j}" title="Revert to on-file">↺</button><button class="miniic sv" data-save1="${j}" title="Save this field to the database">✓</button></span>`;}

/* ---- program-driven sections: a cycle's program picks its form ---------- */
function cycleProgs(){if(activeCid&&mpdb){const cy=mpdb.listCycles(activePid).find(c=>c.id===activeCid);if(cy&&cy.programs.length)return cy.programs;}return ['rcs'];}
function hasProg(p){return cycleProgs().indexOf(p)>=0;}
function visibleSections(){const pr=cycleProgs();const has=p=>pr.indexOf(p)>=0;
  if(has('rcs'))return has('uaf')?[1,2,12,3,4,5,6,7,11,8,9]:[1,2,12,3,4,5,6,7,8,9]; // UAF follows Part B: included-in-rent utilities determine what is tenant-paid                 // the classic RCS flow
  if(has('ocaf')&&has('uaf'))return [1,2,12,3,4,6,10,7,11,9];  // rents -> worksheet -> UA -> Part B -> tenant notice
  if(has('ocaf'))return [1,2,12,3,4,6,10,7];
  return [1,2,12,3,4,6,7,11,9];                                // UAF-only
}
let _secPos={};
function computeSecPos(){_secPos={};visibleSections().forEach((n,ix)=>_secPos[n]=ix+1);}
function secRef(n){return 'Section '+(_secPos[n]||n);}
function deriveUnits(){const u=new Set([0]),nr=new Set(),lh=new Set(),pr=new Set([0]);Object.keys(form).forEach(k=>{let m=k.match(/^units\.(\d+)\./);if(m)u.add(+m[1]);m=k.match(/^nonrev\.(\d+)\./);if(m)nr.add(+m[1]);m=k.match(/^ns8\.(\d+)\./);if(m)lh.add(+m[1]);m=k.match(/^principals\.(\d+)\./);if(m)pr.add(+m[1]);});UNITS=[...u].sort((a,b)=>a-b);NONREV=[...nr].sort((a,b)=>a-b);NS8=[...lh].sort((a,b)=>a-b);PRINCIPALS=[...pr].sort((a,b)=>a-b);}

function defUaSrc(i){return uaHas('units.'+i+'.ua_exec')?'exec':(uaHas('units.'+i+'.ua_rcs')?'rcs':'custom');}
function defSafmrSrc(i){const h=numf(get('units.'+i+'.safmr_hud')),r=numf(get('units.'+i+'.safmr_rcs'));return h>0?'hud':(r>0?'rcs':'custom');}
function uaResolvedOf(i){const src=get('units.'+i+'.ua_source')||defUaSrc(i);if(src==='rcs')return numf(get('units.'+i+'.ua_rcs'));if(src==='custom')return numf(get('units.'+i+'.ua_custom'));return numf(get('units.'+i+'.ua_exec'));}
/* A property with every utility owner-paid has a real $0 allowance. Testing
   >0 threw it away: the schedule's own $0 was unreadable, a $0-vs-$50
   disagreement was not a disagreement, and the RCS workbook's 150% column came
   through blank. The file already knows the right test — has(), below. */
function uaHas(k){const v=get(k);return v!==''&&v!=null;}
function uaConflict(i){const ek='units.'+i+'.ua_exec',rk='units.'+i+'.ua_rcs';return uaHas(ek)&&uaHas(rk)&&numf(get(ek))!==numf(get(rk));}   // two sources disagreeing — an absent RCS figure is not a disagreement
function uaReviewedOf(i){return get('units.'+i+'.ua_reviewed')==='1';}
function uaUnresolved(i){return uaConflict(i)&&!uaReviewedOf(i);}
/* HUD tests the 150% ceiling against the GROSS rent — contract rent plus the
   utility allowance. The aggregate PASS/OVER and the figure printed on the
   92458 always did; the per-unit chip, the over-ceiling counter and the
   Section 6 pill compared the contract rent alone, so a unit type could show a
   green tick on its own row while pushing the property over the ceiling. */
function grossOf(i){return numf(get('units.'+i+'.proposed'))+uaResolvedOf(i);}
function overCeiling(i){const r=safmrResolvedOf(i);return r>0&&numf(get('units.'+i+'.proposed'))>0&&grossOf(i)>=r;}
function safmrResolvedOf(i){const src=get('units.'+i+'.safmr_source')||defSafmrSrc(i);const sh=numf(get('units.'+i+'.safmr_hud')),sr=numf(get('units.'+i+'.safmr_rcs')),sc=numf(get('units.'+i+'.safmr_custom'));return src==='custom'?sc:(src==='rcs'?(sr||sh):(sh||sr));}
function safmrConflictOf(i){const sh=numf(get('units.'+i+'.safmr_hud')),sr=numf(get('units.'+i+'.safmr_rcs'));return sh>0&&sr>0&&sh!==sr;}
function safmrReviewedOf(i){return get('units.'+i+'.safmr_reviewed')==='1';}
function safmrUnresolved(i){return safmrConflictOf(i)&&!safmrReviewedOf(i);}
function analysis(){let cg=0,pg=0,tot=0,sc=0,sp=0,nd=0,cgC=0,pgC=0,ceilC=0,tTot=0,tPr=0,ceil=0,safmrMissing=false,safmrConflict=false,safmrOver=0;
  UNITS.forEach(i=>{const n=numf(get('units.'+i+'.num_units')),cur=numf(get('units.'+i+'.current')),pro=numf(get('units.'+i+'.proposed')),ua=uaResolvedOf(i);const safmr=safmrResolvedOf(i);
    cg+=(cur+ua)*n;pg+=(pro+ua)*n;tot+=n;if(safmr>0){ceil+=safmr*n;if(overCeiling(i))safmrOver++;}else if(n>0)safmrMissing=true;if(safmrConflictOf(i))safmrConflict=true;
    if(n>0)tTot++;
    if(cur>0&&pro>0){sc+=cur*n;sp+=pro*n;nd+=n;cgC+=(cur+ua)*n;pgC+=(pro+ua)*n;if(safmr>0)ceilC+=safmr*n;tPr++;}});   // comparable rows only — see computeAnalysis in db.js
  const perUnit=nd?(sp-sc)/nd:0;const pct=sc?Math.round((sp-sc)/sc*100):0;
  const safmrHave=UNITS.filter(i=>safmrResolvedOf(i)>0).length;   // a ceiling needs both a SAFMR and a unit count
  const countsMissing=tot<=0&&UNITS.length>0;
  return{cg,pg,ceil,headroom:ceil-pg,pass:(ceil>0&&pg<ceil),perUnit,dMo:pgC-cgC,dYr:(pgC-cgC)*12,priced:nd,cgC,pgC,ceilC,tTot,tPr,pct,tot,safmrMissing,safmrConflict,safmrOver,safmrHave,countsMissing};}

function ovBtns(k){return `<button class="revert" data-rev="${k}">↺ revert</button><button class="save1" data-save1="${k}">✓ save this field</button>`;}
function overText(keys){return keys.some(k=>form[k]&&form[k].fromParse)?'parsed — changed from stored record':'changed from stored record';}
function ovNote(kk){const keys=Array.isArray(kk)?kk:[kk];const j=keys.join(',');const m=modeOf(keys);return `<div class="ovnote" data-ov="${j}" data-mode="${m}" style="display:${m?'flex':'none'}"><span class="om-over">${overText(keys)}</span><span class="om-new">new — not saved yet</span><span class="om-cycle">parsed — not saved yet</span>${ovBtns(j)}</div>`;}
function addrKeys(box){const ks=(ADDR_GROUPS[box]||ADDR).slice();if(box==='tenant.mgmt')ks.push('tenant.mgmt_source');return ks;}
function ovNoteAddr(box){const keys=addrKeys(box);const m=modeOf(keys);return `<div class="ovnote" data-ov="${box}" data-mode="${m}" style="display:${m?'flex':'none'}"><span class="om-over">${overText(keys)}</span><span class="om-new">new — not saved yet</span><span class="om-cycle">parsed — not saved yet</span><button class="revert" data-revaddr="${box}">↺ revert</button><button class="save1" data-save1addr="${box}">✓ save this field</button></div>`;}
/* claim = a value a source row prepended above this list already offers. Two rows
   showing the selected background for one answer reads as two answers, so the
   source row wins it — the same rule the designation's "· RS" badge reads. */
/* A key inside a composite address gets no badge of its own: the address is
   ONE cell with one note, one save and one badge at its right edge, and the
   state is no more separately sourced than the street, the city or the ZIP. */
function csDrop(key,options,ph,cls,clearable,tint,claim,subs){const cur=get(key);const has=cur!==''&&cur!=null;const lab=has?cur:(ph||'—');const _cl=(claim!=null&&claim!==''&&claim===cur);const menu=options.map(o=>'<div class="uaopt'+((o===cur&&!_cl)?' sel':'')+'" data-csopt="'+esc(o)+'" data-cskey="'+key+'">'+esc(o)+((subs&&subs[o])?'<span class="uasub">'+esc(subs[o])+'</span>':'')+'</div>').join('');/* Five of these cells offered a ✕ and three did not, with no visible rule —
     and all nine have always cleared from the keyboard with Backspace, so the
     mouse was the odd one out. One pattern: if it holds a value, it can be
     cleared where you are looking at it. */
  const clr=(has&&clearable!==false)?'<span class="csclear" data-csclear="'+key+'" title="Clear">✕</span>':'';return '<div class="uadrop cs '+(cls||'')+(has?' clearable':'')+'"><div class="uatrigger" tabindex="0" data-trigfor="'+key+'"'+(tint?' style="'+tint+'"':'')+'><span class="ualab">'+esc(lab)+'</span>'+(groupOf(key)?'':srcTags(key))+clr+'<span class="cvx">▾</span></div><div class="uamenu">'+menu+'</div></div>';}
function dateEffResolved(){const src=get('rent_schedule.date_eff_source')||(get('rent_schedule.date_eff_rs')?'rs':'custom');return src==='custom'?(get('rent_schedule.date_eff_custom')||get('rent_schedule.date_rents_effective')):get('rent_schedule.date_eff_rs');}
function dateEffCell(){const rs=get('rent_schedule.date_eff_rs');const src=get('rent_schedule.date_eff_source')||(rs?'rs':'custom');
  /* Whichever key answers, it reaches the box in the form the reader types into
     it. The legacy key is stored ISO, and raw ISO in a data-date box is not just
     ugly: the first keystroke reformats 2026-03-01 to 20/26/0301, and 0301 is
     then the year the SAFMR and factor pulls ask HUD about. */
  const _c0=get('rent_schedule.date_eff_custom')||get('rent_schedule.date_rents_effective');
  const custom=/^\d{4}-\d{2}-\d{2}$/.test(String(_c0||''))?fmtDate(_c0):_c0;
  const rsLab=rs?(fmtDate(rs)+' · a year after the RS'):'— · no RS date parsed';
  const lab=(src==='custom')?('<input class="uac-in dateeff-in" data-date="1" data-k="rent_schedule.date_eff_custom" value="'+esc(custom)+'" placeholder="mm/dd/yyyy" autocomplete="off">'):(rs?('<input class="uac-in srcedit" data-srcedit="dateeff" data-date="1" value="'+esc(fmtDate(rs))+'"><span class="srctag long">· a year after the RS</span>'):('<span class="ualab">'+esc(rsLab)+'</span>'));
  let state,c;if(src==='custom'){c=modeOf(['rent_schedule.date_eff_custom','rent_schedule.date_eff_source'])==='over'?provColors('overridden','rent_schedule.date_eff_source'):cellColors('rent_schedule.date_eff_custom');}else{state=rs?srcOf('rent_schedule.date_eff_rs'):'new';c=provColors(state,'rent_schedule.date_eff_source');}
  const boxKey=(src==='custom')?'rent_schedule.date_eff_custom':'rent_schedule.date_eff_source';
  const menu='<div class="uamenu">'+srcOptRow('data-deffopt="rs"',rs?esc(fmtDate(rs)):'','A year after the executed RS',src==='rs')+'<div class="uaopt'+(src==='custom'?' sel':'')+'" data-deffopt="custom">Custom…</div></div>';
  /* Silence would let 20/26/0301 sit in the box looking like a date that had
     been entered on purpose. Everything downstream now ignores it, so the cell
     is the only place left that can say why nothing happened. */
  const _bad=(src==='custom')&&String(custom||'').trim()!==''&&!dateParts(custom);
  return `<div class="field"><div class="flabel">Date rents will be effective</div>${_bad?'<div class="ucnote warn" style="margin:0 0 4px">\u26a0 That is not a date \u2014 enter it as mm/dd/yyyy.</div>':''}<div class="fbox uacell" data-box="${boxKey}" style="background:${c[1]};border-left-color:${c[0]}"><div class="uadrop" style="flex:1;min-width:0"><div class="uatrigger" tabindex="0">${lab}<span class="cvx">▾</span></div>${menu}</div>${ovIcons(['rent_schedule.date_eff_custom','rent_schedule.date_eff_source','rent_schedule.date_eff_rs'])}</div></div>`;}
const POC_PICK_KEYS=['poc.name','poc.email','poc.phone'];
function pocSelectContact(ct){form=store.editForm(form,'poc.name',ct.name||'');form=store.editForm(form,'poc.email',ct.email||'');form=store.editForm(form,'poc.phone',fmtPhoneInput(ct.phone||''));
  POC_PICK_KEYS.forEach(k=>{if(form[k])form[k].fromPick=true;});}
// The name cell's save/revert buttons bundle the whole contact group ONLY while
// the pick is still intact (the name key itself still carries fromPick — a plain
// edit through store.editForm drops it by default, see core.js). Once the user
// hand-types over the name (or it was never picked), this narrows to just the
// name's own scope — matching what the Enter key already saves for that field —
// so saving the name never silently commits/discards an unrelated in-progress
// edit to email or phone.
function pocSaveKeys(){return (form['poc.name']&&form['poc.name'].fromPick)?POC_PICK_KEYS.filter(k=>form[k]&&form[k].fromPick):['poc.name'];}
function pocNote(){const m=modeOf('poc.name');const j=pocSaveKeys().join(',');return `<div class="ovnote" data-ov="poc.name" data-mode="${m}" style="display:${m?'flex':'none'}"><span class="om-over">${overText(['poc.name'])}</span><span class="om-new">new — not saved yet</span><span class="om-cycle">parsed — not saved yet</span><button class="revert" data-rev="${j}">↺ revert</button><button class="save1" data-save1="${j}">✓ save this field</button></div>`;}
function pocCell(){const k='poc.name';const contacts=(mpdb?mpdb.listContacts():[]);const cur=get(k);const c=cellColors(k);
  const nvp=raVal('poc.name');
  const _rp=rcsOf('poc.name');
  const navRow=(nvp?'<div class="uaopt srcopt" data-pocra="1">'+esc(nvp)+'<span class="uasub">Related Affordable</span></div>':'<div class="uaopt srcopt srcdim">\u2014<span class="uasub">Related Affordable \u00b7 not available</span></div>')
    +(_rp?('<div class="uaopt srcopt'+(String(_rp)===String(cur)?' sel':'')+'" data-pocrcs="1">'+esc(_rp)+'<span class="uasub">RCS report \u00b7 addressed to</span></div>')
        :'<div class="uaopt srcopt srcdim">\u2014<span class="uasub">RCS report \u00b7 not available</span></div>');
  const menu='<div class="uamenu">'+navRow+contacts.map(ct=>'<div class="uaopt" data-pocopt="'+esc(ct.id)+'">'+esc(ct.name)+(ct.email?'<span class="uasub">'+esc(ct.email)+'</span>':'')+'</div>').join('')+'</div>';
  const pick='<div class="uadrop pocpick"><div class="uatrigger" tabindex="0" title="Pick a saved contact"><span class="cvx">&#9662;</span></div>'+menu+'</div>';
  return `<div class="field"><div class="flabel">Point of contact</div><div class="fbox poccell" data-box="${k}" style="background:${c[1]};border-left-color:${c[0]}"><input class="pocname-in" data-k="poc.name" value="${esc(cur)}" placeholder="Type a name, or pick a saved contact" autocomplete="off">${srcTags('poc.name')}${pick}</div>${pocNote()}</div>`;}
/* Saved-contact pickers (appraiser / CA) — same mechanics as the
   PM point-of-contact cell: picking a saved contact fills its whole section as
   a pending change (Enter commits every filled cell, Esc restores what was
   there, clicking anywhere else annuls the pending group), and the name cell's
   revert / save-this-field buttons act on every autofilled key. */
function dirAddrLine(c){return [c.addr_street,c.addr_city,[c.addr_state,c.addr_zip].filter(Boolean).join(' ')].filter(s=>s&&String(s).trim()).join(', ');}
function caDir(modeKeys,sub){return {kind:'ca',one:'contract administrator',
  keys:['ca.prefix','ca.name','ca.position','ca.org','ca.addr_street','ca.addr_city','ca.addr_state','ca.addr_zip'],
  modeKeys:modeKeys,
  apply:ct=>dirFill([['ca.prefix',ct.prefix],['ca.name',ct.name],['ca.position',ct.title],['ca.org',ct.org],['ca.addr_street',ct.addr_street],['ca.addr_city',ct.addr_city],['ca.addr_state',ct.addr_state],['ca.addr_zip',ct.addr_zip]]),
  sub:sub};}
const DIR_PICK={
 'appr.name':{kind:'appraiser',one:'appraiser',keys:['appr.name','appr.firm','appr.email','appr.phone','appr.addr_street','appr.addr_city','appr.addr_state','appr.addr_zip'],modeKeys:['appr.name'],
  apply:ct=>dirFill([['appr.name',ct.name],['appr.firm',ct.firm],['appr.email',ct.email],['appr.phone',fmtPhoneInput(ct.phone||'')],['appr.addr_street',ct.addr_street],['appr.addr_city',ct.addr_city],['appr.addr_state',ct.addr_state],['appr.addr_zip',ct.addr_zip]]),
  sub:ct=>[ct.firm,dirAddrLine(ct)].filter(Boolean).join(' \u00b7 ')||ct.email||''},
 'ca.name':caDir(['ca.prefix','ca.name'],ct=>[ct.title,ct.org,dirAddrLine(ct)].filter(Boolean).join(' \u00b7 ')),
 /* The same entry, reached from the cell you happen to be looking at. Each
    row's subtitle leads with what THIS cell will take from it. */
 'sig.name':{kind:'signatory',one:'signatory',keys:['sig.name','sig.title'],modeKeys:['sig.name'],
  apply:ct=>dirFill([['sig.name',ct.name],['sig.title',ct.title]]),
  sub:ct=>[ct.title,ct.org].filter(Boolean).join(' \u00b7 ')},
 'ca.position':caDir(['ca.position'],ct=>[ct.title,ct.org].filter(Boolean).join(' · ')),
 'ca.org':caDir(['ca.org'],ct=>[ct.org,ct.title].filter(Boolean).join(' \u00b7 ')),
};
function dirFill(pairs){pairs.forEach(p=>{form=store.editForm(form,p[0],p[1]||'');if(form[p[0]])form[p[0]].fromPick=true;});}
function dirList(kind){return (mpdb&&mpdb.listDir)?mpdb.listDir(kind):[];}
function dirSaveKeys(fk){const P=DIR_PICK[fk];return (form[fk]&&form[fk].fromPick)?P.keys.filter(k=>form[k]&&form[k].fromPick):fieldKeys(fk);}
function dirNote(fk){const P=DIR_PICK[fk];const m=modeOf(P.modeKeys);const j=dirSaveKeys(fk).join(',');return `<div class="ovnote" data-ov="${P.modeKeys.join(',')}" data-mode="${m}" style="display:${m?'flex':'none'}"><span class="om-over">${overText(P.modeKeys)}</span><span class="om-new">new \u2014 not saved yet</span><span class="om-cycle">parsed \u2014 not saved yet</span><button class="revert" data-rev="${j}">\u21ba revert</button><button class="save1" data-save1="${j}">\u2713 save this field</button></div>`;}
function dirCell(f){const k=f.k;const P=DIR_PICK[k];const list=dirList(P.kind);const cur=get(k);
  const c=f.prefix?groupColors([f.prefix,f.k]):cellColors(k);const nameTint=(f.prefix&&partHot(k))?tintStyle(k):'';
  const pre=f.prefix?csDrop(f.prefix,['Ms.','Mr.','Dr.','Mx.'],'\u2014','csnarrow',true,partHot(f.prefix)?tintStyle(f.prefix):''):'';
  const _dr=DIR_SRCROW[k];const _drv=_dr?_dr.val():null;
  const srcRow=!_dr?'':(_drv!=null&&_drv!==''
    ?('<div class="uaopt srcopt'+(String(_drv)===String(cur)?' sel':'')+'" data-srck="'+k+'" data-srcv="'+esc(_drv)+'" data-srctag="'+esc(_dr.tag)+'">'+esc(srcDisp(k,_drv))+'<span class="uasub">'+esc(_dr.tag)+'</span></div>')
    :('<div class="uaopt srcopt srcdim">\u2014<span class="uasub">'+esc(_dr.tag)+' \u00b7 not available</span></div>'));
  /* Drawn even with nothing in it. A cell with no dropdown where its
     neighbours have one reads as an oversight; a dimmed row saying the list is
     empty is a shorter answer than wondering. */
  const _none=!srcRow&&!list.length;
  const menu='<div class="uamenu">'+(_none?('<div class="uaopt srcopt srcdim">\u2014<span class="uasub">No saved '+esc(P.one)+'</span></div>'):(srcRow+list.map(ct=>{const s=P.sub(ct);return '<div class="uaopt" data-dirid="'+esc(ct.id)+'" data-dirfor="'+k+'">'+esc(ct.name)+(s?'<span class="uasub">'+esc(s)+'</span>':'')+'</div>';}).join('')))+'</div>';
  const pick='<div class="uadrop pocpick"><div class="uatrigger" tabindex="0" title="Pick a saved '+esc(P.one)+'"><span class="cvx">&#9662;</span></div>'+menu+'</div>';
  return `<div class="field"><div class="flabel">${f.label}</div><div class="fbox poccell" data-box="${k}" style="background:${c[1]};border-left-color:${c[0]}">${pre}<input class="pocname-in" type="text" data-k="${k}" style="${nameTint}" value="${esc(cur)}" placeholder="Type a name, or pick a saved ${esc(P.one)}" autocomplete="off">${srcTags(k)}${pick}</div>${dirNote(k)}</div>`;}
/* ====== External-source dropdowns (Related Affordable / RS / RCS) ======
   Sourced options sit at the top of each cell's dropdown in precedence order;
   a source with no data is a dimmed "\u2014 \u00b7 not available" row, never
   an error. (Spec history: _archive/Kinley/NAVIGATOR-SOURCING-SPEC.md.)
   No Related Affordable (RA) platform provider ships in this build. The RA
   integration plugs in by setting window.RASource before boot:
     listProperties() -> [{id, name}]   portfolio for the New-property picker
     value(flatKey)   -> string|null    the active property's value for a form
                                        flat key (the spec \u00a73 cells)
   value() is called synchronously on every render, so the provider should
   fetch a snapshot when the form opens (copy ensureHudSafmr()'s lifecycle),
   answer from that snapshot, and call renderBody() when fresh data lands.
   Executed-RS / RCS-report rows stay "not available" until document parsing
   lands (still a stub); they render now so all three sources light up
   uniformly. The form never writes back to the RA platform. */
function raProps(){try{const p=window.RASource;const l=(p&&p.listProperties)?p.listProperties():[];return Array.isArray(l)?l:[];}catch(e){return [];}}
function raVal(k){try{const p=window.RASource;const v=(p&&p.value)?p.value(k):null;return (v==null||v==='')?null:String(v);}catch(e){return null;}}
/* Rule 16 belongs to the row builder, not to its callers — see rule 17. The UA
   and SAFMR menus formatted at their own call sites and so looked right, which
   is exactly how every other source row was missed: srcPick printed whatever
   string it was handed, so a row offered "1027" directly beneath a cell reading
   "$ 1,027". The same figure in two conventions reads as a rendering fault.

   Display only. data-srcv stays RAW, because clicking the row writes that value
   into the cell — a formatted one would put "$1,027" into the field. */
const SRC_MONEY=/^(units\.\d+\.(current|proposed|ua_exec|ua_rcs|ua_custom|safmr_rcs|safmr_hud|safmr_custom)|nonrev\.\d+\.rent|ns8\.\d+\.avg_rent)$/;
const SRC_COUNT=/^(units|ns8|nonrev)\.\d+\.num_units$/;
function srcDisp(k,v){
  if(v==null||v==='')return v;
  if(SRC_MONEY.test(k)){const f=fmtMoney(v);return f?('$'+f):String(v);}   // a value we cannot read as a number prints as it came
  if(SRC_COUNT.test(k)){const f=fmtMoney(v);return f||String(v);}          // separators, no currency
  if(/\.phone$/.test(k))return fmtPhone(v)||String(v);
  if(/\.email$/.test(k))return fmtEmail(v);
  return v;}
function srcOptRow(attrs,val,tag,sel){const _c='uaopt srcopt'+(sel?' sel':'');return val?('<div class="'+_c+'" '+attrs+'>'+val+'<span class="uasub">'+esc(tag)+'</span></div>'):('<div class="'+_c+' srcdim">\u2014<span class="uasub">'+esc(tag)+' \u00b7 not available</span></div>');}
function srcPick(k,rows){
  const menu='<div class="uamenu">'+rows.map(r=> r.val!=null
    ?'<div class="uaopt srcopt" data-srck="'+k+'" data-srcv="'+esc(r.val)+'" data-srctag="'+esc(r.tag)+'">'+esc(srcDisp(k,r.val))+'<span class="uasub">'+esc(r.tag)+'</span></div>'
    :'<div class="uaopt srcopt srcdim">\u2014<span class="uasub">'+esc(r.tag)+' \u00b7 not available</span></div>').join('')+'</div>';
  return '<div class="uadrop pocpick"><div class="uatrigger" tabindex="0" title="Pull from a source"><span class="cvx">&#9662;</span></div>'+menu+'</div>';
}
/* Per-cell source rows in precedence order (spec \u00a73). val:null renders dim. */
const SRCPICK_ROWS={
 'property.name':()=>[{tag:'Executed RS',val:rsVal('property.name')},{tag:'Related Affordable',val:raVal('property.name')},{tag:'RCS report',val:rcsVal('property.name')}],
 'property.fha':()=>[{tag:'Executed RS',val:rsVal('property.fha')},{tag:'Related Affordable',val:raVal('property.fha')}],
 'property.s8':()=>[{tag:'Executed RS',val:rsVal('property.s8')},{tag:'RCS report',val:rcsVal('property.s8')}],
 'owner.entity_type_other':()=>[{tag:'Executed RS',val:rsVal('owner.entity_type_other')}],
 'owner.entity_name':()=>[{tag:'Executed RS',val:rsVal('owner.entity_name')},{tag:'Related Affordable',val:raVal('owner.entity_name')}],
 'sig.title':()=>[{tag:'Executed RS',val:rsVal('sig.title')}],
 /* rcsOf, not rcsVal: the study gives a NAME, and the email and phone come from
    the saved contact that name matches. */
 'poc.email':()=>[{tag:'RCS report',val:rcsOf('poc.email')}],
 'poc.phone':()=>[{tag:'RCS report',val:rcsOf('poc.phone')}],
 /* The sender of the tenant notice is a person at the management company, whom
    no document names — the platform does. */
 'tenant.sender_name':()=>[{tag:'Related Affordable',val:raVal('tenant.sender_name')}],
 'tenant.sender_title':()=>[{tag:'Related Affordable',val:raVal('tenant.sender_title')}],
 'appr.firm':()=>[{tag:'RCS report',val:rcsVal('appr.firm')}],
 'appr.email':()=>[{tag:'RCS report',val:rcsVal('appr.email')}],
 'appr.phone':()=>[{tag:'RCS report',val:rcsVal('appr.phone')?fmtPhoneInput(rcsVal('appr.phone')):null}],
 'tenant.sender_name':()=>[{tag:'Related Affordable',val:raVal('tenant.sender_name')}],
};
/* Address groups: one dropdown pulls the whole street/city/state/zip group. */
const SRCGROUP={
 'property.addr':()=>{const st=raVal('property.addr_street'),ci=raVal('property.addr_city'),sa=raVal('property.addr_state'),zp=raVal('property.addr_zip');
   return [{tag:'Related Affordable',apply:(st||ci||sa||zp)?{'property.addr_street':st||'','property.addr_city':ci||'','property.addr_state':sa||'','property.addr_zip':zp||''}:null},{tag:'RCS report',apply:(function(){const cs=rcsVal('property.addr_street'),cc=rcsVal('property.addr_city'),ct=rcsVal('property.addr_state'),cz=rcsVal('property.addr_zip');return (cs||cc||ct||cz)?{'property.addr_street':cs||'','property.addr_city':cc||'','property.addr_state':ct||'','property.addr_zip':cz||''}:null;})()}];},
 'appr.addr':()=>{const s=rcsVal('appr.addr_street'),c=rcsVal('appr.addr_city'),t=rcsVal('appr.addr_state'),z=rcsVal('appr.addr_zip');
   return [{tag:'RCS report',apply:(s||c||t||z)?{'appr.addr_street':s||'','appr.addr_city':c||'','appr.addr_state':t||'','appr.addr_zip':z||''}:null}];},
};
function srcGroupPick(box){const rows=SRCGROUP[box]().map((r,ix)=> r.apply
  ?'<div class="uaopt srcopt" data-srcgrp="'+box+'" data-srcgix="'+ix+'">'+esc(r.apply[Object.keys(r.apply)[0]])+'\u2026<span class="uasub">'+esc(r.tag)+'</span></div>'
  :'<div class="uaopt srcopt srcdim">\u2014<span class="uasub">'+esc(r.tag)+' \u00b7 not available</span></div>').join('');
  return '<div class="uadrop pocpick"><div class="uatrigger" tabindex="0" title="Pull from a source"><span class="cvx">&#9662;</span></div><div class="uamenu">'+rows+'</div></div>';}
/* Dim source rows atop the existing contact-picker menus (spec \u00a73 notes). */
/* tag names the source; val fetches it. It was a bare tag string, rendered
   unconditionally as "not available" — so the signatory's name sat dim while
   the parser had had the answer since the upload, and the title beside it
   offered the same value live. */
const DIR_SRCROW={'appr.name':{tag:'RCS report',val:()=>rcsVal('appr.name')},'sig.name':{tag:'Executed RS',val:()=>rsVal('sig.name')}};
/* Every document that can supply this cell, in precedence order — not one tag
   guessed per key. A non-revenue rent is filled from the STUDY (the appraiser
   prices the unit whatever it is used for), yet its menu named the schedule
   alone: the one document that had not supplied the figure in the cell.
   srcPick renders a row with val:null as "not available", so an absent source
   still shows, and still says which document it would have come from. */
function moneySrcRows(k){
  let m;
  if((m=k.match(/^units\.(\d+)\.current$/)))return [{tag:'Executed RS',val:rsUnit(+m[1],'rent')}];
  if((m=k.match(/^units\.(\d+)\.proposed$/)))return [{tag:'RCS report',val:rcsUnitVal(+m[1],'proposed')}];
  if((m=k.match(/^nonrev\.(\d+)\.rent$/)))return [{tag:'Executed RS',val:rsFamVal('nonrev',+m[1],'rent')},{tag:'RCS report',val:rcsNonrevVal(+m[1])}];
  if((m=k.match(/^ns8\.(\d+)\.avg_rent$/)))return [{tag:'Executed RS',val:rsFamVal('ns8',+m[1],'rent')}];
  return [];}
function dimPick(tag){return '<div class="uadrop pocpick"><div class="uatrigger" tabindex="0" title="Source"><span class="cvx">&#9662;</span></div><div class="uamenu"><div class="uaopt srcopt srcdim">\u2014<span class="uasub">'+esc(tag)+' \u00b7 not available</span></div></div></div>';}
/* ================== end external-source dropdowns ================== */
function refreshPrincipalOpts(){ // the list is built at render time; keep it current while typing
  const box=document.querySelector('[data-box="sig.principal"]');const menu=box&&box.querySelector('.uamenu');if(!menu)return;
  const _opts=sigPrincipalOpts();const _rp=rsVal('sig.principal');
  const _dupe=_rp!=null&&_opts.some(o=>o.trim().toLowerCase()===_rp.trim().toLowerCase());
  const _cur=get('sig.principal');const _hd=(_rp!=null&&!_dupe&&_rp===_cur);
  const head=(_rp!=null&&!_dupe)?('<div class="uaopt srcopt'+(_hd?' sel':'')+'" data-cskey="sig.principal" data-csopt="'+esc(_rp)+'">'+esc(_rp)+'<span class="uasub">Executed RS</span></div>')
    :(_dupe?'':'<div class="uaopt srcopt srcdim">\u2014<span class="uasub">Executed RS \u00b7 not available</span></div>');
  menu.innerHTML=head+_opts.map(o=>'<div class="uaopt'+((o===_cur&&!_hd)?' sel':'')+'" data-csopt="'+esc(o)+'" data-cskey="sig.principal">'+esc(o)+'</div>').join('');
  menu.querySelectorAll('[data-csopt]').forEach(o=>o.addEventListener('click',e=>{e.stopPropagation();
    const ck=o.getAttribute('data-cskey');_pendingSnap=snapPend([ck]);form=store.editForm(form,ck,o.getAttribute('data-csopt'));
    _pending=[ck];_refocusSel='[data-trigfor="'+ck+'"]';renderBody();}));}
/* option -> the principal it belongs to, keyed by the value the option itself
   carries, so the two lists cannot drift apart. */
function sigPrincipalSubs(){const m={};PRINCIPALS.forEach(i=>{
  const t=(get('principals.'+i+'.title')||'').trim(),n=(get('principals.'+i+'.name')||'').trim();
  const v=t||n;if(v&&!m[v]&&n&&n!==v)m[v]=n;});return m;}
function sigPrincipalOpts(){const o=[];PRINCIPALS.forEach(i=>{const t=(get('principals.'+i+'.title')||'').trim(),n=(get('principals.'+i+'.name')||'').trim();const v=t||n;if(v&&o.indexOf(v)<0)o.push(v);});return o;}
function sigTitleCell(f){const c=cellColors('sig.title');const pk='sig.principal';const pc=cellColors(pk);
  const _rp=rsVal('sig.principal');const _opts=sigPrincipalOpts();
  // the schedule's own principal is already one of the list options once Part G
  // has been parsed — showing it a second time as its own "Executed RS" row just
  // duplicates the same value under a different label.
  const _dupe=_rp!=null&&_opts.some(o=>o.trim().toLowerCase()===_rp.trim().toLowerCase());
  const _pcur=get(pk);const _pcl=(_rp!=null&&!_dupe&&_rp===_pcur);
  const dim=(_rp!=null&&!_dupe)?('<div class="uaopt srcopt'+(_pcl?' sel':'')+'" data-cskey="'+pk+'" data-csopt="'+esc(_rp)+'">'+esc(_rp)+'<span class="uasub">Executed RS</span></div>')
    :(_dupe?'':'<div class="uaopt srcopt srcdim">\u2014<span class="uasub">Executed RS \u00b7 not available</span></div>');
  /* Whose role it is. With one principal on file the list is a single row, and
     without this it repeats the box and tells the reader nothing. */
  let dd=csDrop(pk,_opts,'Select\u2026','',true,'',_pcl?_rp:null,sigPrincipalSubs());
  dd=dd.replace('<div class="uamenu">','<div class="uamenu">'+dim);
  return `<div class="fpair sigpair"><div class="field"><div class="flabel">${f.label}</div><div class="fbox" data-box="sig.title" style="background:${c[1]};border-left-color:${c[0]}"><input type="text" data-k="sig.title" value="${esc(get('sig.title'))}" autocomplete="off">${srcTags('sig.title')}${srcPick('sig.title',SRCPICK_ROWS['sig.title']())}</div>${ovNote('sig.title')}</div><div class="ofthe">of the</div><div class="field"><div class="flabel">Principal</div><div class="fbox seldrop" data-box="${pk}" style="background:${pc[1]};border-left-color:${pc[0]}">${dd}</div>${ovNote(pk)}</div></div>`;}
function fieldCell(f){if(f.type==='sigtitle')return sigTitleCell(f);if(f.type==='pair')return '<div class="fpair">'+f.items.map(fieldCell).join('')+'</div>';if(f.type==='addr')return addrCell();if(f.type==='caaddr')return caAddrCell();if(f.type==='appraddr')return apprAddrCell();if(f.type==='mgmtaddr')return mgmtCell();if(f.type==='select')return selectCell(f);if(f.k==='poc.name')return pocCell();if(DIR_PICK[f.k])return dirCell(f);
  const s=form[f.k]||{value:'',source:'new'};
  const c=f.prefix?groupColors([f.prefix,f.k]):cellColors(f.k);
  const pre=f.prefix?csDrop(f.prefix,['Ms.','Mr.','Dr.','Mx.'],'—','csnarrow',true,partHot(f.prefix)?tintStyle(f.prefix):''):'';
  return `<div class="field"><div class="flabel">${f.label}</div><div class="fbox" data-box="${f.k}" style="background:${c[1]};border-left-color:${c[0]}">${pre}<input type="text" data-k="${f.k}" style="${f.prefix&&partHot(f.k)?tintStyle(f.k):''}"${f.type==='phone'?' data-phone="1" inputmode="tel" maxlength="14"':''} value="${esc(f.type==='phone'?fmtPhoneInput(s.value):s.value)}" autocomplete="off">${srcTags(f.k)}${SRCPICK_ROWS[f.k]?srcPick(f.k,SRCPICK_ROWS[f.k]()):''}</div>${ovNote(f.prefix?[f.prefix,f.k]:f.k)}</div>`;}
function addrCell(){return compAddrCell(ADDR,'property.addr','Address');}
function caAddrCell(){return compAddrCell(CA_ADDR,'ca.addr','CA address');}
function apprAddrCell(){return compAddrCell(APPR_ADDR,'appr.addr','Appraiser address');}
function selectCell(f){const c=cellColors(f.k);const _et=f.k==='owner.entity_type';
  const _ecur=_et?get(f.k):'';const _rsET=_et?rsVal('owner.entity_type'):null;const nv=_et?raVal('owner.entity_type'):null;
  const _rsSel=!!(_rsET&&_rsET===_ecur),_nvSel=!!(nv&&nv===_ecur&&!_rsSel);   // precedence order: the schedule answers first
  let dd=csDrop(f.k,f.opts,f.ph||'Select…','',false,'',(_rsSel||_nvSel)?_ecur:null);
  if(_et){
    const navRows=(_rsET?'<div class="uaopt srcopt'+(_rsSel?' sel':'')+'" data-cskey="owner.entity_type" data-csopt="'+esc(_rsET)+'">'+esc(_rsET)+'<span class="uasub">Executed RS</span></div>':'<div class="uaopt srcopt srcdim">\u2014<span class="uasub">Executed RS \u00b7 not available</span></div>')
      +(nv?'<div class="uaopt srcopt'+(_nvSel?' sel':'')+'" data-cskey="owner.entity_type" data-csopt="'+esc(nv)+'">'+esc(nv)+'<span class="uasub">Related Affordable</span></div>'
          :'<div class="uaopt srcopt srcdim">\u2014<span class="uasub">Related Affordable \u00b7 not available</span></div>');
    dd=dd.replace('<div class="uamenu">','<div class="uamenu">'+navRows);}
  const sel=`<div class="field"><div class="flabel">${f.label}</div><div class="fbox seldrop" data-box="${f.k}" style="background:${c[1]};border-left-color:${c[0]}">${dd}</div>${ovNote(f.k)}</div>`;
  if(f.k==='owner.entity_type'&&get(f.k)==='Other (specify)'){const ok='owner.entity_type_other';const oc=cellColors(ok);
    const other=`<div class="field"><div class="flabel">Specify entity type</div><div class="fbox" data-box="${ok}" style="background:${oc[1]};border-left-color:${oc[0]}"><input type="text" data-k="${ok}" value="${esc(get(ok))}" placeholder="e.g. Limited Liability Company" autocomplete="off">${srcPick(ok,SRCPICK_ROWS[ok]())}</div>${ovNote(ok)}</div>`;
    return '<div class="fpair etpair">'+sel+other+'</div>';}
  return sel;}
/* One badge for one cell. The address is four keys but a single box with a
   single note and a single save, so four badges would be four answers to one
   question — and would not fit in the row. It claims the study only when every
   part the address actually holds came from the study and matches it: a
   half-match is a difference, and rule 15 says an indicator computes. */
function addrRcsTag(keys){
  const held=keys.filter(k=>String(get(k)||'').trim()!=='');
  if(!held.length)return '';
  return held.every(k=>rcsTag(k))?'<span class="srctag rcstag">RCS</span>':'';}
function compAddrCell(keys,box,label){const c=groupColors(keys);const parts=addrParts(keys,c);
  const ti=i=>{const t=addrPartStyle(parts[i]);return t?(';'+t):'';};
  const dv=i=>addrDivStyle(parts[i],parts[i+1]);
  return `<div class="field"><div class="flabel">${label}</div><div class="fbox addr" data-box="${box}" style="background:${addrBody(keys,c)};border-left-color:${c[0]}">
     <input type="text" data-k="${keys[0]}" value="${esc(get(keys[0]))}" placeholder="Street" style="flex:3${ti(0)}"><span class="adiv" data-adiv="0" style="${dv(0)}"></span>
     <input type="text" data-k="${keys[1]}" value="${esc(get(keys[1]))}" placeholder="City" style="flex:1.15${ti(1)}"><span class="adiv" data-adiv="1" style="${dv(1)}"></span>
     ${csDrop(keys[2],STATES,'ST','csnarrow',false,addrPartStyle(parts[2]))}<span class="adiv" data-adiv="2" style="${dv(2)}"></span>
     <input type="text" data-k="${keys[3]}" value="${esc(get(keys[3]))}" placeholder="ZIP" style="width:${(box==='property.addr'||box==='appr.addr')?'47px':'64px'}${ti(3)}">${addrRcsTag(keys)}${SRCGROUP[box]?srcGroupPick(box):''}</div>
   ${ovNoteAddr(box)}</div>`;}
function mgmtCell(){const src=get('tenant.mgmt_source')||'property';const propHas=ADDR.some(k=>get(k)!=='');
  if(src==='custom'){const c=groupColors(MGMT_ADDR);const parts=addrParts(MGMT_ADDR,c);
    const ti=i=>{const t=addrPartStyle(parts[i]);return t?(';'+t):'';};
    const dv=i=>addrDivStyle(parts[i],parts[i+1]);
    return `<div class="field"><div class="flabel">Management address <span class="mgmtswitch" data-mgmt="property">↺ use property address</span></div><div class="fbox addr" data-box="tenant.mgmt" style="background:${addrBody(MGMT_ADDR,c)};border-left-color:${c[0]}">
       <input type="text" data-k="tenant.mgmt_street" value="${esc(get('tenant.mgmt_street'))}" placeholder="Street" style="flex:3${ti(0)}"><span class="adiv" data-adiv="0" style="${dv(0)}"></span>
       <input type="text" data-k="tenant.mgmt_city" value="${esc(get('tenant.mgmt_city'))}" placeholder="City" style="flex:1.15${ti(1)}"><span class="adiv" data-adiv="1" style="${dv(1)}"></span>
       ${csDrop('tenant.mgmt_state',STATES,'ST','csnarrow',false,addrPartStyle(parts[2]))}<span class="adiv" data-adiv="2" style="${dv(2)}"></span>
       <input type="text" data-k="tenant.mgmt_zip" value="${esc(get('tenant.mgmt_zip'))}" placeholder="ZIP" style="width:64px${ti(3)}"></div>
     ${ovNoteAddr('tenant.mgmt')}</div>`;}
  const pretty=propHas?(get('property.addr_street')+', '+get('property.addr_city')+' '+get('property.addr_state')+' '+get('property.addr_zip')).replace(/\s+/g,' ').replace(/^,\s*/,'').trim():'';
  const inner=propHas?('<span class="mgmtprop">'+esc(pretty)+'</span><span class="srctag">· property</span>'):('<span class="mgmtph">Set the property address in Section 2, or pick a different address</span>');
  const menu='<div class="uamenu"><div class="uaopt'+(src==='property'?' sel':'')+'" data-mgmt="property">Use property address</div><div class="uaopt'+(src==='custom'?' sel':'')+'" data-mgmt="custom">Different address…</div></div>';
  // mirroring the property address: report that address's record, since that is what prints
  const ovSrc=srcOf('tenant.mgmt_source')==='overridden';const c=ovSrc?CLR.overridden:groupColors(ADDR);
  return '<div class="field"><div class="flabel">Management address</div><div class="fbox mgmtcell" data-box="tenant.mgmt_address" style="background:'+c[1]+';border-left-color:'+c[0]+'"><div class="uadrop"><div class="uatrigger" tabindex="0"><span class="ualab">'+inner+'</span><span class="cvx">▾</span></div>'+menu+'</div>'+(ovSrc?ovIcons('tenant.mgmt_source'):'')+'</div></div>';}
function renderFieldSection(sec){const cols=[[],[]];sec.fields.forEach(f=>cols[f.col].push(fieldCell(f)));
  const n=Math.max(cols[0].length,cols[1].length),rows=[];
  for(let i=0;i<n;i++){rows.push(cols[0][i]||'<div></div>');rows.push(cols[1][i]||'<div></div>');}
  return card(sec.n,sectionPill(sec.n),`<div class="cols">${rows.join('')}</div>`);}
function principalHasData(i){return ['name','title'].some(s=>{const v=get('principals.'+i+'.'+s);return v!==''&&v!=null;});}
function renderPrincipals(){
  const rows=PRINCIPALS.map(i=>{const nk='principals.'+i+'.name',tk='principals.'+i+'.title';const nc=cellColors(nk),tc=cellColors(tk);
    return `<div class="prinrow"><div class="field"><div class="fbox" data-box="${nk}" style="background:${nc[1]};border-left-color:${nc[0]}"><input type="text" data-k="${nk}" value="${esc(get(nk))}" autocomplete="off">${rsTag(nk)}${srcPick(nk,[{tag:'Executed RS',val:rsPrin(i,'name')}])}</div>${ovNote(nk)}</div><div class="field"><div class="fbox" data-box="${tk}" style="background:${tc[1]};border-left-color:${tc[0]}"><input type="text" data-k="${tk}" value="${esc(get(tk))}" autocomplete="off">${rsTag(tk)}${srcPick(tk,[{tag:'Executed RS',val:rsPrin(i,'title')}])}</div>${ovNote(tk)}</div><div class="urx">${PRINCIPALS.length>1?`<button class="trash" data-delprin="${i}" title="Delete">\u2715</button>`:''}</div></div>`;}).join('');
  return card(12,sectionPill(12),`<div class="pbnote">The principals comprising the ownership entity, as they appear in Part G of the rent schedule. The signatory title in ${secRef(3)} selects its principal from this list.</div><div class="prinhead"><span>Principal name</span><span>Title</span><span></span></div>${rows}<div class="addrow" id="prinAdd">+ Add principal</div>${_undoPR.length?(' <span class="addrow ghostlink" id="undoPrin">\u21a9 Undo delete'+(_undoPR.length>1?(' ('+_undoPR.length+')'):'')+'</span><button class="undocommit" id="undoPrinC" title="Keep deletions \u2014 dismiss undo">\u2713</button>'):''}`);}

/* Provenance has two axes and one implementation. The EDGE reports the record:
   blue once a cell has been saved, teal when filled from a source this package,
   amber when changed since the save, gray when nothing was ever recorded. The
   BODY reports the content: tinted when the cell holds a value, gray when empty.
   Every painter — text cell, address group, checkbox, chip — comes through here,
   because the rule kept breaking when each path carried its own copy of it. */
function provColors(state,key){const c=CLR[state]||CLR.new;
  if(state==='new'&&key&&form[key]&&form[key].value===''&&form[key].db_value==='')return [CLR.database[0],c[1],c[2]]; // saved, and STILL saved empty
  return c;}
function cellColors(k){return (srcOf(k)!=='overridden'&&offFile(k))?provColors('overridden',k):provColors(srcOf(k),k);}
function boxColor(k){return cellColors(k);}
function moneyBox(k,noIcons){const c=boxColor(k);const _rows=moneySrcRows(k);
  const pick=_rows.length?srcPick(k,_rows):'';
  return `<div class="rbox money" data-box="${k}" style="background:${c[1]};border-left-color:${c[0]}"><span class="cur">$</span><input type="text" data-money="1" data-k="${k}" value="${esc(fmtMoney(get(k)))}">${srcTags(k)}${pick}${noIcons?'':ovIcons(k)}</div>`;}
function numBox(k,ph,noIcons){const c=boxColor(k);
  /* Counts are numbers and get separators like every other number (rule 16).
     NOT via a blanket data-money: this same box renders Part D's "use" text and
     the UAF factors, and cleanNum strips the decimal point out of 1.039. */
  const _cnt=SRC_COUNT.test(k);
  const _mc=k.match(/^ns8\.(\d+)\.num_units$/),_mu=k.match(/^nonrev\.(\d+)\.use$/);
  const _rv=_mc?rsFamVal('ns8',+_mc[1],'count'):(_mu?rsFamVal('nonrev',+_mu[1],'use'):null);
  /* Part D has no unit-count column on the schedule — each row is one named
     space — so this cell can never be sourced from it. It still shows the
     dimmed row rather than nothing at all: a cell with no dropdown reads as an
     oversight, and "not available" is a shorter answer than wondering. */
  const _mn=k.match(/^nonrev\.(\d+)\.num_units$/);
  const _rsCell=!!(_mc||_mu||_mn);   // non-Section-8 counts and Part D uses come off the schedule too
  return `<div class="rbox" data-box="${k}" style="background:${c[1]};border-left-color:${c[0]}"><input type="text"${_cnt?' data-money="1"':''} data-k="${k}" value="${esc(_cnt?fmtMoney(get(k)):get(k))}" placeholder="${esc(ph||'')}">${rsTag(k)}${_rv!=null?srcPick(k,[{tag:'Executed RS',val:_rv}]):(_rsCell?dimPick('Executed RS'):'')}${noIcons?'':ovIcons(k)}</div>`;}
function brbaBox(brK,baK){const c=groupColors([brK,baK]);
  const withRs=(k,opts,ph)=>{const d=csDrop(k,opts,ph,'',true,partHot(k)?tintStyle(k):'',rsBrBa(k));
    const row=rsCsRow(k)||'<div class="uaopt srcopt srcdim">\u2014<span class="uasub">Executed RS \u00b7 not available</span></div>';
    return d.replace('<div class="uamenu">','<div class="uamenu">'+row);};
  return `<div class="rbox brba" data-box="${brK}" style="background:${c[1]};border-left-color:${c[0]}">${withRs(brK,BR_OPTS,'BR')}<span class="slash">/</span>${withRs(baK,BA_OPTS,'BA')}</div>`;}
function uaBox(i){const src=get('units.'+i+'.ua_source')||defUaSrc(i),exec=get('units.'+i+'.ua_exec'),rcs=get('units.'+i+'.ua_rcs'),custom=get('units.'+i+'.ua_custom');
  const hasAny=numf(exec)>0||numf(rcs)>0||numf(custom)>0;
  const lab=src==='rcs'?('$<input class="uac-in srcedit" data-srcedit="ua" data-si="'+i+'" data-money="1" value="'+esc(fmtMoney(rcs))+'"><span class="srctag">· RCS</span>'):(src==='custom'?('$<input class="uac-in" data-money="1" data-k="units.'+i+'.ua_custom" value="'+esc(fmtMoney(custom))+'" placeholder="0">'):('$<input class="uac-in srcedit" data-srcedit="ua" data-si="'+i+'" data-money="1" value="'+esc(fmtMoney(exec))+'"><span class="srctag">· RS</span>'));
/* Typing here does not edit the cell you can see: it switches the source to
   custom and writes a *_custom key that has never been saved. Judged on that key
   alone the edit looks like first-time entry — gray, no revert — and Escape then
   "clears" it, leaving a custom source with no value and a blank cell. The source
   key is the one that knows an on-file value was displaced, so the badge carries
   both: coupledKeys already saves and reverts them together. */
  let state,c;if(src==='custom'){const _st=srcCellState('units.'+i+'.ua_custom');c=provColors(_st==='overridden'?'overridden':(_st==='database'?'database':'new'),'units.'+i+'.ua_source');}else{state=hasAny?srcOf(src==='rcs'?('units.'+i+'.ua_rcs'):('units.'+i+'.ua_exec')):'new';const overSrc=srcOf('units.'+i+'.ua_source')==='overridden';const _cs=srcCellState('units.'+i+'.ua_custom');if(_cs==='overridden')state='overridden';else if(_cs==='database'&&state==='new')state='database';if(uaUnresolved(i)||overSrc)state='overridden';c=provColors(state,'units.'+i+'.ua_source');}const boxKeyUA=src==='custom'?('units.'+i+'.ua_custom'):('units.'+i+'.ua_source');
  const menu='<div class="uamenu">'+srcOptRow('data-uaopt="exec" data-uai="'+i+'"',(exec!==''&&exec!=null)?('$'+fmtMoney(exec)):'','Executed RS',src==='exec')+srcOptRow('data-uaopt="rcs" data-uai="'+i+'"',(rcs!==''&&rcs!=null)?('$'+fmtMoney(rcs)):'','RCS report',src==='rcs')+'<div class="uaopt'+(src==='custom'?' sel':'')+'" data-uaopt="custom" data-uai="'+i+'">Custom…</div></div>';
  return '<div class="rbox uacell" data-box="'+boxKeyUA+'" style="background:'+c[1]+';border-left-color:'+c[0]+'"><div class="uadrop"><div class="uatrigger" tabindex="0"><span class="ualab">'+lab+'</span><span class="cvx">▾</span></div>'+menu+'</div></div>';}
function uaNoteCell(i){const conf=uaConflict(i),overSrc=srcOf('units.'+i+'.ua_source')==='overridden';if(!conf&&!overSrc)return '';const ex=get('units.'+i+'.ua_exec'),rc=get('units.'+i+'.ua_rcs');
  if(conf&&uaUnresolved(i))return '<div class="ucnote warn">⚠ exec '+money(numf(ex))+' · RCS '+money(numf(rc))+' <span class="pick"><button class="urev sv" data-uaok="'+i+'">approve '+money(uaResolvedOf(i))+'</button></span></div>';
  const src=get('units.'+i+'.ua_source')||defUaSrc(i);const chosen=src==='rcs'?'the study':(src==='custom'?'your own figure':'the executed schedule');
  return '<div class="ucnote ok">✓ '+chosen+(src==='custom'?'':' ('+money(uaResolvedOf(i))+')')+'</div>';}
function typeConflict(i){const br=get('units.'+i+'.br'),ba=get('units.'+i+'.ba'),brR=get('units.'+i+'.br_rcs'),baR=get('units.'+i+'.ba_rcs');const has=(brR!==''&&brR!=null)||(baR!==''&&baR!=null);return has&&((brR&&brR!==br)||(baR&&baR!==ba));}
function typeReviewedOf(i){return get('units.'+i+'.type_reviewed')==='1';}
function typeUnresolved(i){return typeConflict(i)&&!typeReviewedOf(i);}
function numConflict(i){const nR=get('units.'+i+'.num_rcs');return (nR!==''&&nR!=null)&&numf(nR)!==numf(get('units.'+i+'.num_units'));}
function numReviewedOf(i){return get('units.'+i+'.num_reviewed')==='1';}
function numUnresolved(i){return numConflict(i)&&!numReviewedOf(i);}
/* Every save/revert in a unit row now sits BELOW the row, under the column it
   belongs to — see unitActs. Inside these cells the icon pair squeezed the
   controls it sat beside, and the row changed shape the moment it was edited. */
function unitTypeCell(i){const brK='units.'+i+'.br',baK='units.'+i+'.ba';const conf=false;const c=groupColors([brK,baK]);
  const withRs=(k,opts,ph)=>{const d=csDrop(k,opts,ph,'',!/\.br$/.test(k)&&!modeOf(k),(!conf&&partHot(k))?tintStyle(k):'',rsBrBa(k));const row=rsCsRow(k)||'<div class="uaopt srcopt srcdim">\u2014<span class="uasub">Executed RS \u00b7 not available</span></div>';
    return d.replace('<div class="uamenu">','<div class="uamenu">'+row+rcsCsRow(k));};
  return `<div class="utwrap"><div class="rbox brba" data-box="${brK}" style="background:${c[1]};border-left-color:${c[0]}">${withRs(brK,BR_OPTS,'BR')}${ovIcons(brK)}<span class="slash">/</span>${withRs(baK,BA_OPTS,'BA')}${ovIcons(baK)}</div>`
    +`${labelLine(i)}</div>`;}
function unitCountCell(i){const k='units.'+i+'.num_units';const c=cellColors(k);const rv=rsUnit(i,'count');
  /* The study counts the units too, and had nowhere to be offered from — the
     only way to take its number was the conflict buttons that are now gone. */
  const cv=rcsUnitVal(i,'count');
  // The schedule is where this number comes from, so the cell says so whether or
  // not one is loaded right now — dimmed when there is nothing to pull, exactly as
  // the rent beside it does. Rendering nothing left the column looking as though
  // it had no source at all the moment the upload went out of session.
  return `<div class="rbox" data-box="${k}" style="background:${c[1]};border-left-color:${c[0]}"><input type="text" data-money="1" data-k="${k}" value="${esc(fmtMoney(get(k)))}">${srcTags(k)}${(rv!=null||cv!=null)?srcPick(k,[{tag:'Executed RS',val:rv},{tag:'RCS report',val:cv}]):dimPick('Executed RS')}</div>`;}
/* The study's reading lives in the cell's dropdown now; a difference is not a
   thing to be resolved before the row can be saved. */
function typeNote(i){return '';}
function _typeNoteUnused(i){if(!typeConflict(i))return '';const br=get('units.'+i+'.br'),ba=get('units.'+i+'.ba'),brR=get('units.'+i+'.br_rcs')||br,baR=get('units.'+i+'.ba_rcs')||ba;
  if(typeUnresolved(i))return '<div class="ucnote warn">⚠ RS '+br+'/'+ba+' · RCS '+brR+'/'+baR+' <span class="pick"><button class="urev" data-typ="rs" data-ci="'+i+'">keep RS</button><button class="urev sv" data-typ="rcs" data-ci="'+i+'">use RCS</button></span></div>';
  return '<div class="ucnote ok">✓ RS · '+br+'/'+ba+'</div>';}
function numNote(i){return '';}
function _numNoteUnused(i){if(!numConflict(i))return '';const n=get('units.'+i+'.num_units'),nR=get('units.'+i+'.num_rcs');
  if(numUnresolved(i))return '<div class="ucnote warn">⚠ RS '+n+' · RCS '+nR+' <span class="pick"><button class="urev" data-num="rs" data-ci="'+i+'">keep RS</button><button class="urev sv" data-num="rcs" data-ci="'+i+'">use RCS</button></span></div>';
  return '<div class="ucnote ok">✓ RS · '+n+'</div>';}
function safmrBox(i){const src=get('units.'+i+'.safmr_source')||defSafmrSrc(i),hud=get('units.'+i+'.safmr_hud'),rcs=get('units.'+i+'.safmr_rcs'),custom=get('units.'+i+'.safmr_custom');
  const hasAny=numf(hud)>0||numf(rcs)>0||numf(custom)>0;
  const lab=src==='rcs'?('$<input class="uac-in srcedit" data-srcedit="safmr" data-si="'+i+'" data-money="1" value="'+esc(fmtMoney(rcs))+'"><span class="srctag">· RCS</span>'):(src==='custom'?('$<input class="uac-in" data-money="1" data-k="units.'+i+'.safmr_custom" value="'+esc(fmtMoney(custom))+'" placeholder="0">'):('$<input class="uac-in srcedit" data-srcedit="safmr" data-si="'+i+'" data-money="1" value="'+esc(fmtMoney(hud))+'"><span class="srctag">· HUD</span>'));
  let state,c;if(src==='custom'){const _st=srcCellState('units.'+i+'.safmr_custom');c=provColors(_st==='overridden'?'overridden':(_st==='database'?'database':'new'),'units.'+i+'.safmr_source');}else{state=hasAny?srcOf(src==='rcs'?('units.'+i+'.safmr_rcs'):('units.'+i+'.safmr_hud')):'new';const overSrc=srcOf('units.'+i+'.safmr_source')==='overridden';const _cs=srcCellState('units.'+i+'.safmr_custom');if(_cs==='overridden')state='overridden';else if(_cs==='database'&&state==='new')state='database';if(safmrUnresolved(i)||overSrc)state='overridden';c=provColors(state,'units.'+i+'.safmr_source');}const boxKeySA=src==='custom'?('units.'+i+'.safmr_custom'):('units.'+i+'.safmr_source');
  const menu='<div class="uamenu">'+srcOptRow('data-safmropt="hud" data-safmri="'+i+'"',(hud!==''&&hud!=null)?('$'+fmtMoney(hud)):'','HUD API',src==='hud')+srcOptRow('data-safmropt="rcs" data-safmri="'+i+'"',(rcs!==''&&rcs!=null)?('$'+fmtMoney(rcs)):'','RCS report',src==='rcs')+'<div class="uaopt'+(src==='custom'?' sel':'')+'" data-safmropt="custom" data-safmri="'+i+'">Custom…</div></div>';
  return '<div class="rbox uacell" data-box="'+boxKeySA+'" style="background:'+c[1]+';border-left-color:'+c[0]+'"><div class="uadrop"><div class="uatrigger" tabindex="0"><span class="ualab">'+lab+'</span><span class="cvx">▾</span></div>'+menu+'</div></div>';}
function safmrNote(i){const res=safmrResolvedOf(i),hud=numf(get('units.'+i+'.safmr_hud')),rcs=numf(get('units.'+i+'.safmr_rcs'));
  if(safmrUnresolved(i))return '<div class="ucnote warn">⚠ HUD '+money(hud)+' · RCS '+money(rcs)+' <span class="pick"><button class="urev sv" data-safmrok="'+i+'">approve '+money(res)+'</button></span></div>';
  if(res>0){const pro=numf(get('units.'+i+'.proposed'));const gr=grossOf(i);const ok=gr<res;
    // the figure shown is the one being judged: rent + allowance, as HUD compares it
    if(pro>0)return '<div class="ucnote '+(ok?'ok':'warn')+'">'+(ok?'✓ ':'✗ ')+money(gr)+(ok?' < ':' ≥ ')+money(res)+' · 150% SAFMR'+(uaResolvedOf(i)>0?' (rent + UA)':'')+'</div>';return '<div class="ucnote ok">150% SAFMR $'+res.toLocaleString()+'</div>';}
  /* Name what is missing, in the cell that is empty because of it. The pull is
     keyed to the PROPERTY's ZIP in section 2 — HUD's rents are per the building's
     own location — and an appraiser address filled in below is easy to read as
     having supplied one. "Needed for the 150% test" is true of a cell nobody can
     act on; the blockers were already computed for the analysis card, three
     hundred lines up, and were simply never offered to the row. */
  if(numf(get('units.'+i+'.num_units'))>0){const _b=hudBlockerNames();
    return '<div class="ucnote warn">⚠ '+(_b?'the 150% test needs the '+esc(_b):'needed for the 150% test')+'</div>';}
  return '';}
/* Rent-schedule capacity. Part A prints 11 rows: the Section 8 rows, then
   (when non-S8 units exist) a banner row + those rows; non-rev rows print in
   Part D, which holds 5. Warn whenever a generated document would trim data. */
function rsCapacity(){
  const R=UNITS.filter(i=>numf(get('units.'+i+'.num_units'))||numf(get('units.'+i+'.proposed'))||get('units.'+i+'.br')||get('units.'+i+'.ba')).length;
  const L=get('ns8.enabled')==='1'?NS8.filter(i=>get('ns8.'+i+'.br')||get('ns8.'+i+'.ba')||get('ns8.'+i+'.avg_rent')||numf(get('ns8.'+i+'.num_units'))>0).length:0;
  const N=NONREV.filter(i=>get('nonrev.'+i+'.use')||get('nonrev.'+i+'.br')||get('nonrev.'+i+'.ba')||get('nonrev.'+i+'.rent')||numf(get('nonrev.'+i+'.num_units'))>0).length;
  /* Part A's eleven rows are filled by the ladder gen.js actually walks: the
     Section 8 rows, then — when there are non-Section 8 units — a banner row and
     those rows, then a blank spacer and the non-revenue rows. Over eleven it
     drops the spacer, then drops the non-revenue rows from Part A, and only then
     truncates. This counted the first two of those three and never the
     non-revenue rows, so ten unit types plus two non-revenue rows overflowed in
     silence: the form reported no capacity problem, and the generated schedule
     printed a Total Units that was short by those units. Mirror the ladder. */
  const _rows=(spacer,withNr)=>R+(L?1+L:0)+((withNr&&N)?((spacer?1:0)+N):0);
  let _len=_rows(true,true),nrOffA=false;
  if(_len>11)_len=_rows(false,true);
  if(_len>11){_len=_rows(false,false);nrOffA=N>0;}
  const cut=Math.max(0,_len-11);
  const nrOver=Math.max(0,N-5);
  const msgs=[],flags=[];
  if(nrOffA){msgs.push('Rent schedule Part A holds 11 rows and your unit types fill them, so the '+N+' non-revenue row'+(N===1?'':'s')+' will be left off Part A. They still print in Part D \u2014 but the generated form\u2019s Total Units then counts only the rows on the page.');
    flags.push(N+' non-revenue row'+(N===1?'':'s')+' pushed off rent schedule Part A');}
  if(cut){msgs.push('Too many unit types \u2014 rent schedule Part A holds 11 rows'+(L?(' and your '+R+' Section 8 + banner + '+L+' non-Section 8 rows need '+(R+1+L)):'')+'. The last '+cut+' row'+(cut>1?'s':'')+' will be left off the generated rent schedule, and its totals will cover only the rows that printed.');
    flags.push(cut+' unit-type row'+(cut>1?'s':'')+' over the rent schedule\u2019s 11-row limit');}
  if(nrOver){msgs.push('Rent schedule Part D holds 5 non-revenue rows \u2014 the last '+nrOver+' will be left off (and out of the Part D rent total).');
    flags.push(nrOver+' non-revenue unit'+(nrOver>1?'s':'')+' over Part D\u2019s 5 rows');}
  return {R,L,N,cut,nrOver,msgs,flags};
}
function capNote(){const c=rsCapacity();if(!c.msgs.length)return '';return '<div class="ucnote warn" style="display:block;margin:0 0 10px">\u26a0 '+c.msgs.map(esc).join('<br>')+'</div>';}
function refreshFlags(){document.querySelectorAll('[data-pill]').forEach(p=>{const n=+p.getAttribute('data-pill');const st=sectionStatus(n);p.className='pill '+(st==='warn'?'warn':'ok');p.textContent=st==='warn'?'review':'confirmed';});renderRail();renderAttention();}
function unitCard(i,pos){const trash=UNITS.length>1?`<button class="trash" data-delunit="${i}" title="Delete this unit type">✕</button>`:'';
  const _c=numf(get('units.'+i+'.current')),_p=numf(get('units.'+i+'.proposed'));const _d=_p-_c,_pc=_c>0?Math.round(_d/_c*100):0;
  const metric=(_c>0&&_p>0)?`<span class="ucmetric" data-metric="${i}" style="color:${_d>=0?'#166534':'#b91c1c'}">${sMoney(_d)} · ${sPct(_pc)}</span>`:`<span class="ucmetric" data-metric="${i}"></span>`;
  /* The compact .ovic pair inside the cell squeezed the bed/bath dropdowns from
     96px to 70px the moment it appeared, so a row changed shape once edited and
     "2BR" collided with its own clear icon. Roomy cells put save/revert in the
     note row beneath instead, which is what the rest of the form already does. */
  /* One compact pair per column, directly under the cell it acts on. Nothing is
     wider than its column, so no row changes shape when it is edited. */
  /* Always the pair. Offering save/revert on the pointer alone gave buttons that
     changed nothing you could see, because the figure lives in the other key. */
  const uaKeys=coupledKeys('units.'+i+'.ua_custom');
  const saKeys=coupledKeys('units.'+i+'.safmr_custom');
  /* Each column carries its OWN cell, pair and note, stacked.

     They used to be three grids one under another — every cell, then every
     pair, then every note — so the height of the tallest column set where the
     next band started for all of them. Column one is the tallest (it carries
     the label line and now two pairs), which pushed the 150% SAFMR reading two
     bands clear of the figure it describes, and left every pair floating a
     label's height below the box it acts on. A column that grows now grows
     alone. `.uracts` stays on each pair so cellActBtn still finds it (rule 10). */
  const col=(cell,act,note)=>'<div class="ucol">'+cell+(act?'<div class="uracts ucolacts">'+act+'</div>':'')+(note||'')+'</div>';
  const metricCell=metric?'<div class="urnmetric">'+metric+'</div>':'';
  return '<div class="urow"><div class="ucells'+(hasProg('rcs')?'':' noprop')+'">'
    /* column one carries no band of its own: bedroom/bath keep their pair INSIDE
       the box and the label keeps its own in the label line, so nothing under
       this column adds height to the row. */
    +col(unitTypeCell(i),'',typeNote(i))
    +col(unitCountCell(i),ovIcons('units.'+i+'.num_units'),numNote(i))
    +col(moneyBox('units.'+i+'.current',1),ovIcons('units.'+i+'.current'),'')
    /* The increase belongs beside the buttons that commit it, not a line
       below them: it is what you read to decide whether to press the tick. It
       shares the act row and wraps to its own line only when the column is too
       narrow to hold both — which is the layout it used to have unconditionally. */
    +col(moneyBox('units.'+i+'.proposed',1),ovIcons('units.'+i+'.proposed')+metricCell,'')
    +col(uaBox(i),ovIcons(uaKeys),uaNoteCell(i))
    +(hasProg('rcs')?col(safmrBox(i),ovIcons(saKeys),safmrNote(i)):'')
    +'<div class="urx">'+trash+'</div>'
    +'</div></div>';
}
function renderRents(){
  const cards=UNITS.map((i,pos)=>unitCard(i,pos)).join('');
  /* '1' on, '0' off, '' nobody has said — and only the last of those falls back
     to "there are rows", for records saved before the flag existed. While blank
     and "rows exist" meant the same thing, turning the section off could not
     take: the rows are kept on purpose so re-ticking restores them, so the
     section switched itself back on and the dialog repeated. */
  const nrOn=get('nonrev.enabled')==='1'||(get('nonrev.enabled')===''&&NONREV.length>0);
  let pd=`<div class="pdhead"><label class="ns8flag"><input type="checkbox" id="nonrevToggle"${nrOn?' checked':''}><span>This property has non-revenue units (Part D)</span></label>${(!nrOn&&NONREV.some(i=>nonrevHasData(i)||numf(get('nonrev.'+i+'.num_units'))>0))?ovIcons('nonrev.enabled'):''}${nrOn?' <span class="sub">manager’s unit, model, etc. — excluded from rent totals</span>':''}</div>`;
  if(nrOn){
    if(NONREV.length){const _np=hasProg('rcs')?'':' noprop',_xc=hasProg('rcs')?7:6;
    pd+=`<div class="rgh${_np}"><span style="grid-column:1">Unit type</span><span style="grid-column:2">Units</span><span style="grid-column:3">Contract rent</span><span style="grid-column:4/6">Use</span></div>`+NONREV.map(i=>`<div class="pdrow${_np}"><div style="grid-column:1">${brbaBox('nonrev.'+i+'.br','nonrev.'+i+'.ba')}</div><div style="grid-column:2">${numBox('nonrev.'+i+'.num_units','',1)}</div><div style="grid-column:3">${moneyBox('nonrev.'+i+'.rent',1)}</div><div style="grid-column:4/6">${numBox('nonrev.'+i+'.use',"e.g. Manager’s unit",1)}</div><div class="urx" style="grid-column:${_xc}"><button class="trash" data-delnonrev="${i}" title="Delete">✕</button></div><div class="uracts${_np}"><div style="grid-column:1"><span class="ua-br">${ovIcons('nonrev.'+i+'.br')}</span><span class="ua-sl"></span><span class="ua-ba">${ovIcons('nonrev.'+i+'.ba')}</span></div><div style="grid-column:2">${ovIcons('nonrev.'+i+'.num_units')}</div><div style="grid-column:3">${ovIcons('nonrev.'+i+'.rent')}</div><div style="grid-column:4/6">${ovIcons('nonrev.'+i+'.use')}</div></div></div>`).join('');}
    pd+=`<div class="addrow" id="addNonrev">+ Add non-revenue unit</div>`;
  }
  pd+=undoBits('NR');
  const lhOn=get('ns8.enabled')==='1';
  let lh=`<div class="pdhead"><label class="ns8flag"><input type="checkbox" id="ns8Toggle"${lhOn?' checked':''}><span>This property has non-Section 8 revenue producing units</span></label>${(!lhOn&&NS8.some(i=>ns8HasData(i)||numf(get('ns8.'+i+'.num_units'))>0))?ovIcons('ns8.enabled'):''}${lhOn?' <span class="sub">entered as unit type and average rent, as shown on the rent schedule</span>':''}</div>`;
  if(lhOn){
    if(NS8.length){const _np2=hasProg('rcs')?'':' noprop',_xc2=hasProg('rcs')?7:6;
    lh+=`<div class="rgh${_np2}"><span style="grid-column:1">Unit type</span><span style="grid-column:2">Units</span><span style="grid-column:3">Average unit rent</span></div>`+NS8.map(i=>`<div class="pdrow${_np2}"><div style="grid-column:1">${brbaBox('ns8.'+i+'.br','ns8.'+i+'.ba')}</div><div style="grid-column:2">${numBox('ns8.'+i+'.num_units','',1)}</div><div style="grid-column:3">${moneyBox('ns8.'+i+'.avg_rent',1)}</div><div class="urx" style="grid-column:${_xc2}"><button class="trash" data-delns8="${i}" title="Delete">✕</button></div><div class="uracts${_np2}"><div style="grid-column:1"><span class="ua-br">${ovIcons('ns8.'+i+'.br')}</span><span class="ua-sl"></span><span class="ua-ba">${ovIcons('ns8.'+i+'.ba')}</span></div><div style="grid-column:2">${ovIcons('ns8.'+i+'.num_units')}</div><div style="grid-column:3">${ovIcons('ns8.'+i+'.avg_rent')}</div></div></div>`).join('');}
    lh+=`<div class="addrow" id="addNs8">+ Add non-Section 8 unit type</div>`;
  }
  lh+=undoBits('LI');
  /* The key used to sit above the grid as its own row and was the busiest thing
     in the section for four letters. Part B's fuel chips carry no legend either —
     a coded chip explains itself where it is used. The codes live on the column
     header's tooltip, each chip names its own designation, and clicking one says
     it in the status line. */
  /* Above the grid the key was a row every unit had to be read past. Here it uses
     width the date field already leaves empty, so it costs nothing vertically and
     is out of the way while still being on screen. Muted: it is a reference, not
     a control, and the sentence explaining it lives on the header's tooltip. */
  /* The old note enumerated four letters because a chip of four letters needed
     explaining. Free text does not — the column says what it holds. */
  const LABEL_HEAD_TIP='Whatever the rent schedule prints after the bedroom and bath counts \u2014 Elderly, Family, Patio, anything. It prints after the unit size on the schedule.';
  const rgHead=`<div class="rgh"><span title="${esc(LABEL_HEAD_TIP)}">Unit type <em class="hsub">br / ba \u00b7 label</em></span><span>Units</span><span>Current rent</span><span>Proposed rent</span><span>Utility allowance</span>${hasProg('rcs')?(function(){const st=pullBtnState('safmr');return '<span class="safmrhead">150% SAFMR<button class="urev hudbtn'+st.cls+'" id="pullSafmr"'+st.dis+' title="'+esc(st.why||'Re-pull 150% ceilings from HUD for this property’s ZIP')+'">⤓ HUD</button></span>';})():''}<span></span></div>`;
  return card(6,sectionPill(6),`<div class="reseff">${dateEffCell()}</div>${capNote()}<div class="ucards${hasProg('rcs')?'':' noprop'}">${UNITS.length?rgHead:''}${cards}</div><div class="addrow" id="addUnit">+ Add unit type</div>${_undoStack.length?(' <span class="addrow ghostlink" id="undoUnit">↩ Undo delete'+(_undoStack.length>1?(' ('+_undoStack.length+')'):'')+'</span><button class="undocommit" id="undoCommit" title="Keep deletions — dismiss undo">✓</button>'):''}<div class="partd">${lh}</div><div class="partd">${pd}</div>`);}

const SAFMR_BR_KEY={'Studio':'efficiency','1BR':'br1','2BR':'br2','3BR':'br3','4BR':'br4'};
let _hud={key:'',data:null,inflight:null};let _hudTimer=null;
function scheduleHudRefresh(){clearTimeout(_hudTimer);_hudTimer=setTimeout(()=>{ensureHudSafmr({});},900);}
function hudCeil(rents,br){let base=0;const bk=SAFMR_BR_KEY[br];
  if(bk)base=numf(rents[bk]);
  else{const m=String(br).match(/^(\d+)BR/);const n=m?+m[1]:0;if(n>4)base=numf(rents.br4)*(1+0.15*(n-4));} // HUD rule: >4BR = 4BR FMR +15% per extra bedroom
  return base>0?String(Math.round(base*1.5)):'';}
function andJoin(arr){ // Oxford comma: "a, b, and c" — not "a, b and c"
  if(arr.length<=1)return arr[0]||'';
  if(arr.length===2)return arr[0]+' and '+arr[1];
  return arr.slice(0,-1).join(', ')+', and '+arr[arr.length-1];}
function hudZipMissing(){const p=hudParams();return p.zip.length!==5&&!(p.street&&p.city&&p.state);}
function hudBlockers(){ // everything a SAFMR pull needs, not just the first thing missing
  const out=[];
  if(hudZipMissing())out.push('the property ZIP in '+secRef(2));
  if(!dateEffResolved())out.push('the date rents will be effective in '+secRef(6));
  const nb=UNITS.filter(i=>!get('units.'+i+'.br')).length;
  if(nb)out.push('the bedroom size on '+nb+' unit type'+(nb>1?'s':'')+' in '+secRef(6));
  return out;}
function hudBlockerText(){const b=hudBlockers();if(!b.length)return '';
  return 'add '+andJoin(b);}
function hudBlockerNames(){ // the card and the cell have room for the names, not the sentence
  const b=[];if(hudZipMissing())b.push('ZIP');
  if(!dateEffResolved())b.push('effective date');
  if(UNITS.some(i=>!get('units.'+i+'.br')))b.push('bedroom size');
  return andJoin(b);}
function hudBlockerShort(){const n=hudBlockerNames();return n?('add the '+n):'';}
function hudParams(){const zip=String(get('property.addr_zip')||'').replace(/\D/g,'').slice(0,5);
  const _dp=dateParts(dateEffResolved());const year=_dp?_dp.y:(new Date()).getFullYear();
  return{zip,year,street:get('property.addr_street'),city:get('property.addr_city'),state:get('property.addr_state')};}
function applyHudSafmr(){if(!_hud.data)return 0;const rents=_hud.data.zip_rents||_hud.data.area_rents;if(!rents)return 0;
  let changed=0;UNITS.forEach(i=>{const br=get('units.'+i+'.br');if(!br)return;const v=hudCeil(rents,br);
    if(v&&get('units.'+i+'.safmr_hud')!==v){form=store.editForm(form,'units.'+i+'.safmr_hud',v);markCycle('units.'+i+'.safmr_hud');changed++;}});
  return changed;}
function renderKeepFocus(){const ae=document.activeElement;const k=ae&&ae.getAttribute?ae.getAttribute('data-k'):null;const pos=(k&&ae.selectionStart!=null)?ae.selectionStart:null;renderBody();
  if(k){const ni=document.querySelector('[data-k="'+k+'"]');if(ni){ni.focus({preventScroll:true});try{const L=pos==null?(ni.value||'').length:pos;ni.setSelectionRange(L,L);}catch(e){}}}}
function hudStatus(n){const d=_hud.data;if(!d)return;
  /* Say where the figure came from, not how HUD's program works. "area-wide FMR"
     already tells you it is not your own ZIP's rent; the clause explaining that
     Hillsdale County is not a Small Area FMR zone was answering a question nobody
     asked, on the one line that has to read at a glance. And nothing filled needs
     no announcement — silence already says the ceilings did not move. */
  const srcNote=d.zip_rents?('ZIP '+d.zip):(d.smallarea?'area-wide FMR · ZIP not listed':'area-wide FMR');
  // Say the year only when HUD told us one — the FMR endpoint returns it only
  // when a year was asked for, and "HUD FYundefined" was reaching the screen.
  // And call them 150% ceilings, not SAFMR ceilings: outside a Small Area zone
  // the ceiling comes from the area FMR, so "not a SAFMR zone — SAFMR ceilings
  // are up to date" was contradicting itself in the same breath.
  setStatus((d.year?('HUD FY'+d.year+' · '):'HUD FMR · ')+d.area_name+' · '+srcNote+(n?(' — filled the 150% ceiling for '+n+' unit type'+(n===1?'':'s')+'. Review, then “Update property profile”.'):''));}
async function ensureHudSafmr(opts){opts=opts||{};const manual=!!opts.manual;
  if(!hasProg('rcs'))return; // the 150% SAFMR threshold is an RCS instrument
  if(!supaClient){if(manual)setStatus('HUD SAFMR pull needs the hosted backend — sign in first.');return;}
  if(manual)_hud={key:'',data:null,inflight:null}; // manual click = force a fresh pull
  const p=hudParams();
  if(p.zip.length!==5&&!(p.street&&p.city&&p.state)){if(manual)setStatus('Enter the property ZIP (or full address) in Section 2 first — HUD SAFMRs are looked up by ZIP.');return;}
  const key=p.zip+'|'+p.year;
  if(_hud.key===key&&_hud.data){const n=applyHudSafmr();if(n)renderKeepFocus();if(manual||n)hudStatus(n);return;}
  if(_hud.inflight===key)return;
  _hud.inflight=key;
  const b0=el('pullSafmr');if(b0)b0.disabled=true;
  try{
    const r=await supaClient.functions.invoke('hud-safmr',{body:{street:p.street,city:p.city,state:p.state,zip:p.zip,year:p.year}});
    if(r.error){let m='request failed';try{m=(await r.error.context.json()).error||m;}catch(e){m=r.error.message||m;}throw new Error(m);}
    const d=r.data||{};if(d.error)throw new Error(d.error);
    if(!(d.zip_rents||d.area_rents))throw new Error('HUD returned no rent data for this area.');
    _hud={key:key,data:d,inflight:null};
    const pNow=hudParams();if(pNow.zip+'|'+pNow.year!==key)return; // form/property changed while fetching — cache it, don't apply
    const n=applyHudSafmr();if(n)renderKeepFocus();hudStatus(n);
  }catch(e){_hud.inflight=null;if(manual)setStatus('HUD SAFMR pull failed: '+(e&&e.message?e.message:e));}
  finally{const b=el('pullSafmr');if(b)b.disabled=false;}
}

function undoBits(fam){const st=fam==='LI'?_undoLI:_undoNR;if(!st.length)return '';const id=fam==='LI'?'undoNs8':'undoNonrev';return ' <span class="addrow ghostlink" id="'+id+'">↩ Undo delete'+(st.length>1?(' ('+st.length+')'):'')+'</span><button class="undocommit" id="'+id+'C" title="Keep deletions — dismiss undo">✓</button>';}
function provColor(k){return cellColors(k)[0];}
function boxStyle(k){const c=Array.isArray(k)?groupColors(k):cellColors(k);return 'color:'+c[0]+';border-color:'+c[0]+';background:'+c[1];}
/* The label sits under the type cell, in the type cell's own column, and costs
   nothing vertically until it holds something — a property that labels nothing
   reads exactly as it did before. It colours itself from its own key (rule 4)
   and takes the same save/revert pair as every other cell in the row. */
function labelLine(i){const k='units.'+i+'.label';const v=get(k)||'';
  const c=cellColors(k);
  const printed=[get('units.'+i+'.br'),get('units.'+i+'.ba')].filter(Boolean).join(' / ')+(v?' '+v:'');
  const over=printed.length>LABEL_PRINT_MAX;
  const rsv=rsBrBa(k);const fromRs=!!(v&&rsv&&String(rsv)===String(v));
  /* The same menu every other cell in this form uses, not the browser's own.
     A native datalist draws a black system triangle and a system popup, which
     is a second dropdown grammar on one screen — and rule 1 applies here too:
     the schedule and the RCS report are declared as sources whether or not
     either has anything to offer, and render dimmed when they do not. The four
     words below them are suggestions; any text is still valid. */
  const rsRow=rsCsRow(k)||'<div class="uaopt srcopt srcdim">\u2014<span class="uasub">Executed RS \u00b7 not available</span></div>';
  const rcsRow='<div class="uaopt srcopt srcdim">\u2014<span class="uasub">RCS report \u00b7 not available</span></div>';
  const hints=LABEL_HINTS.map(o=>'<div class="uaopt'+(o===v?' sel':'')+'" data-csopt="'+esc(o)+'" data-cskey="'+k+'">'+esc(o)+'</div>').join('');
  return '<div class="ulabline" data-box="'+k+'" style="background:'+c[1]+';border-left-color:'+c[0]+'">'
    +'<input class="ulab-in" data-k="'+k+'" value="'+esc(v)+'" placeholder="add a label" autocomplete="off" spellcheck="false">'
    +(fromRs?'<span class="srctag">\u00b7 RS</span>':'')
    +(over?'<span class="ulabwarn" title="'+esc('The schedule prints \u201c'+printed+'\u201d, which is wider than the box on the form.')+'">clips when printed</span>':'')
    +ovIcons(k)
    +'<div class="uadrop cs ulabdrop"><div class="uatrigger" tabindex="0" data-trigfor="'+k+'"><span class="cvx">\u25be</span></div>'
    +'<div class="uamenu">'+rsRow+rcsRow+hints+'</div></div>'
    +'</div>';}
/* The unit type is ONE fact — the schedule states it as one string, "1 BR / 1 BA E" —
   and the form splits it only to make it editable. Provenance belongs to the
   fact: the group is the schedule's while every part of it still is, and one
   edit anywhere makes the whole type the user's. The label is the rest of that
   same string and answers for itself, on its own line, under the counts. */
/* Every cell the schedule feeds says so, by the same rule: the figure the cell
   holds is still the figure the schedule printed. One function, so a new
   schedule-fed cell cannot quietly ship without its badge the way the unit
   count and the current rent did. */
function rsOf(k){
  let m=k.match(/^units\.(\d+)\.current$/);      if(m)return rsUnit(+m[1],'rent');
  m=k.match(/^units\.(\d+)\.num_units$/);        if(m)return rsUnit(+m[1],'count');
  m=k.match(/^nonrev\.(\d+)\.(rent|num_units|use)$/); if(m)return rsFamVal('nonrev',+m[1],m[2]==='num_units'?'count':m[2]);
  m=k.match(/^ns8\.(\d+)\.(avg_rent|num_units)$/);    if(m)return rsFamVal('ns8',+m[1],m[2]==='avg_rent'?'rent':'count');
  /* rsOffers and rsBrBa have always known these; rsOf did not ask them, so no
     badge could be computed for the bedroom count, the bath count or the
     designation — the three cells most obviously read off Part A. */
  m=k.match(/^units\.(\d+)\.(br|ba|label)$/);         if(m)return rsBrBa(k);
  m=k.match(/^units\.(\d+)\.ua_exec$/);               if(m)return rsUnit(+m[1],'ua');
  m=k.match(/^(nonrev|ns8)\.(\d+)\.(br|ba)$/);        if(m)return rsFamVal(m[1],+m[2],m[3]);
  m=k.match(/^principals\.(\d+)\.(name|title)$/);       if(m)return rsPrin(+m[1],m[2]);
  if(k.indexOf('partb.')===0){const P=_rsUpload&&_rsUpload.parsed&&_rsUpload.parsed.partb;const v=P?P[k]:null;return (v==null||v==='')?null:String(v);}
  return rsVal(k);}
function rsTag(k){
  const v=get(k); if(v===''||v==null)return '';
  const r=rsOf(k); if(r==null||r==='')return '';
  const num=/^(units|ns8|nonrev)\.\d+\.(current|proposed|num_units|rent|avg_rent)$/.test(k);
  const same=num?(numf(v)===numf(r)):(String(v)===String(r));
  return same?'<span class="srctag rstag">RS</span>':'';}
/* What the renderers ask for. rsTag and rcsTag stay pure — the suites assert
   each of them on its own — and this decides which of the two is drawn. */
function srcTags(k){
  const r=rsTag(k),c=rcsTag(k);
  if(r&&c)return '<span class="srctag rstag" title="The rent schedule and the RCS study both give this value">RS</span>';
  return r||c;}
/* The whole fact, offered as one answer — the twin of srcGroupPick on an
   address. The sub-cells keep their own Executed RS rows so a type can still be
   mixed: the schedule right about the bathroom, wrong about the bedroom. */
function utGroupPick(i){
  const t=rsUnit(i,'type');const on=typeFromRs(i);
  const row=t!=null
    ?'<div class="uaopt srcopt'+(on?' sel':'')+'" data-utgrp="'+i+'">'+esc(t)+'<span class="uasub">Executed RS</span></div>'
    :'<div class="uaopt srcopt srcdim">—<span class="uasub">Executed RS · not available</span></div>';
  return '<div class="uadrop pocpick utgrp">'+(on?'<span class="srctag rstag">RS</span>':'')
    +'<div class="uatrigger" tabindex="0" title="Pull the whole unit type from a source"><span class="cvx">&#9662;</span></div>'
    +'<div class="uamenu">'+row+'</div></div>';}
function typeFromRs(i){
  const same=k=>{const v=get(k),r=rsBrBa(k);const hv=v!==''&&v!=null,hr=r!=null&&r!=='';
    return hv===hr&&(!hv||String(v)===String(r));};
  if(rsUnit(i,'type')==null)return false;                       // no schedule row to claim it
  return ['br','ba','label'].every(p=>same('units.'+i+'.'+p));}
function fuelChip(k,three){const v=get(k);const has=v!==''&&v!=null;const c=cellColors(k);const cls=three?'fuel3':'fuel';return '<span tabindex="0" class="'+cls+(has?'':' empty')+'" data-fuel'+(three?'3':'')+'="'+k+'" style="color:'+c[0]+';border-color:'+c[0]+';background:'+c[1]+'">'+(has?esc(v):'-')+'</span>';}
function cbx(k,label){const on=get(k)==='1';return `<label class="cb"><input type="checkbox" data-cb="${k}" ${on?'checked':''}><span class="box" style="${boxStyle(k)}">${on?'✓':''}</span><span class="cbt">${esc(label)}</span>${ovIcons(k)}</label>`;}
function pbUtil(i,label){const on=get('partb.utilities.'+i)==='1';return `<div class="cb utrow"><label class="cbmain"><input type="checkbox" data-cb="partb.utilities.${i}" ${on?'checked':''}><span class="box" style="${boxStyle('partb.utilities.'+i)}">${on?'✓':''}</span><span class="cbt ut">${label}</span></label>${fuelChip('partb.fuel.'+i,false)}${ovIcons(['partb.utilities.'+i,'partb.fuel.'+i])}</div>`;}
function writein(id,hasFuel){const val=get('partb.writein.'+id);const on=get('partb.writein.'+id+'.on')==='1';const state=!val?'empty':(on?'checked':'unchecked');
  const ks=hasFuel?['partb.writein.'+id,'partb.writein.'+id+'.on','partb.writein.'+id+'.fuel']:['partb.writein.'+id,'partb.writein.'+id+'.on'];
  const f=hasFuel?fuelChip('partb.writein.'+id+'.fuel',true):'';
  // The tick carried the color while the TEXT beside it carried the edit, so a
  // rewritten write-in kept reading as on file. Color the pair, as brbaBox does.
  const attr=hasFuel?` data-util="1"`:` data-wion="partb.writein.${id}.on"`;
  return `<span class="cb wi ${state}${hasFuel?' util':''}"><span tabindex="0" class="box wibox" data-wibox="partb.writein.${id}" style="${boxStyle(ks)}">${on?'✓':''}</span><input type="text" class="witext" data-k="partb.writein.${id}"${attr} placeholder="write-in…" value="${esc(val)}" style="${partHot('partb.writein.'+id)?tintStyle('partb.writein.'+id):''}">${f}${ovIcons(ks)}</span>`;}
function renderPartB(){const eq=PARTB.equipment,sv=PARTB.services;
  return card(7,sectionPill(7),`<div class="pbnote">Pre-printed items are checked directly; dashed slots accept write-ins.</div>
  <div class="pbgrp">Equipment / furnishings</div><div class="cols3"><div>${cbx('partb.equipment.0',eq[0])}${cbx('partb.equipment.1',eq[1])}${cbx('partb.equipment.2',eq[2])}${cbx('partb.equipment.3',eq[3])}</div>
    <div>${cbx('partb.equipment.4',eq[4])}${cbx('partb.equipment.5',eq[5])}${cbx('partb.equipment.6',eq[6])}${writein('e1')}</div>
    <div>${writein('e2')}${writein('e3')}${writein('e4')}${writein('e5')}</div></div>
  <div class="pbgrp">Utilities (included · fuel type)</div><div class="cols3"><div>${pbUtil(0,'Heating')}${pbUtil(1,'Cooling')}</div><div>${pbUtil(2,'Hot Water')}${pbUtil(3,'Cooking')}</div><div>${pbUtil(4,'Lights, etc.')}${writein('u1',true)}</div></div>
  <div class="pbgrp">Services / facilities</div><div class="cols3"><div>${cbx('partb.services.0',sv[0])}${cbx('partb.services.1',sv[1])}${cbx('partb.services.2',sv[2])}${cbx('partb.services.3',sv[3])}</div>
    <div>${writein('s1')}${writein('s2')}${writein('s3')}${writein('s4')}</div>
    <div>${cbx('partb.services.4',sv[4])}${cbx('partb.services.5',sv[5])}${writein('s5')}${writein('s6')}</div></div>`);}
function renderChecklist(){const F=CHECKLIST_FLAT;const item=n=>{const on=get('check.'+n)==='1';return `<label class="cb"><input type="checkbox" data-cb="check.${n}" ${on?'checked':''}><span class="box" style="${boxStyle('check.'+n)}">${on?'✓':''}</span><span class="cbt">${F[n]}</span>${ovIcons('check.'+n)}</label>`;};
  const grp=(t,arr)=>`<div class="clhead">${t}</div>${arr.map(item).join('')}`;
  const left=grp("Owner’s Materials",[0,1,2])+grp("RCS Materials",[3,4,5,6,7,8]);const right=grp("RCS Materials, continued",[9,10,11,12,13,14])+grp("Mandatory Market Rent Threshold",[15,16]);
  let sel=0;for(let j=0;j<F.length;j++)if(get('check.'+j)==='1')sel++;
  return card(8,sectionPill(8),`<div class="cltop"><b>${sel} of ${F.length} selected</b><span class="clbtns"><button class="mini" id="clAll">✓ Check all</button><button class="mini" id="clNone">Clear</button></span></div><div class="cols2"><div>${left}</div><div>${right}</div></div>`);}
function srcDocLabel(){
  if(hasProg('rcs'))return{title:'Completed RCS report',sub:'Upload the appraiser’s completed study (PDF) — document 04 of the package. Kept for this session only.',need:true};
  if(hasProg('ocaf'))return{title:'CA’s auto-OCAF package',sub:'Upload the CA’s auto-OCAF letter and Exhibit A to check against the worksheet below. Kept for this session only.',need:true};
  return{title:'CA’s UAF certification / UA sheet',sub:'Some contract administrators provide a pre-filled certification or worksheet. Upload it here for reference.',need:false};}
/* ============ Executed-RS parsing (HUD-92458 is a template form) ============
   Tier 1: the PDF still carries its AcroForm fields (our drafts, PM-completed
   fills) -> read values by the same field ids fillRentSchedule writes.
   Tier 2 (next phase): signature-flattened text copies -> positional text.
   Tier 3: scans -> no digital text; the app says so instead of guessing. */
const rsFuelOf=v=>{v=String(v||'').trim().toUpperCase();return /^[EFG]$/.test(v)?v:'';};
function rsPartB(V,definite){ // ids are gen.js's Part B map, read back the way it writes
  // CHK marks a DEFINITE read (on or off). Only tier 1 may claim one: a form field
  // literally says checked or unchecked. Reading position, an absent tick means only
  // that nothing was found there — on this Beacon Hill copy the ticks are not text at
  // all — so tiers 2 and 3 may switch a box ON but must never report one as off.
  const out={};const CHK={};
  [99,100,101,102,103,104,105].forEach((id,k)=>{const v=!!V(id);out['partb.equipment.'+k]=v?'1':'';CHK['partb.equipment.'+k]=1;});
  [116,118,120,122,124].forEach((id,k)=>{const v=!!V(id);out['partb.utilities.'+k]=v?'1':'';CHK['partb.utilities.'+k]=1;});
  [117,119,121,123,125].forEach((id,k)=>{const f=rsFuelOf(V(id));if(f)out['partb.fuel.'+k]=f;});
  [129,130,131,132,141,142].forEach((id,k)=>{const v=!!V(id);out['partb.services.'+k]=v?'1':'';CHK['partb.services.'+k]=1;});
  out._checked=definite?CHK:{};
  /* A write-in only exists because somebody wrote it on the form, so when the tick
     beside it cannot be read — tiers 2 and 3 see a drawing, not a glyph — take the
     writing as evidence the item is included. Leaving the box clear is not the safe
     option here: saving CLEARS the text of any write-in whose box is not ticked
     (clearUncheckedWriteins), so a half-read write-in silently loses what it read. */
  const wiOn=(cb,t)=>V(cb)?'1':(!definite&&t?'1':'');
  [[106,107],[108,109],[110,111],[112,113],[114,115]].forEach((p,ix)=>{const t=V(p[1]);
    if(t){out['partb.writein.e'+(ix+1)]=t;const o=wiOn(p[0],t);if(o)out['partb.writein.e'+(ix+1)+'.on']=o;}});
  [[133,134],[135,136],[137,138],[139,140],[143,144],[145,146]].forEach((p,ix)=>{const t=V(p[1]);
    if(t){out['partb.writein.s'+(ix+1)]=t;const o=wiOn(p[0],t);if(o)out['partb.writein.s'+(ix+1)+'.on']=o;}});
  const u1=V(127);if(u1){out['partb.writein.u1']=u1;const o1=wiOn(126,u1);if(o1)out['partb.writein.u1.on']=o1;
    const uf=rsFuelOf(V(1125));if(uf)out['partb.writein.u1.fuel']=uf;}
  return out;}
function rsSigOf(str,known){ // "David Pearson, Vice President of General Partner"
  str=String(str||'').trim();
  // a title itself can contain "of" ("Director of Operations"); when we already
  // know the real principal names (Part G), prefer the split whose tail matches
  // one of them over always taking the first " of ".
  if(known&&known.length){const re=/\s+of\s+(?:the\s+)?/gi;let m;
    while((m=re.exec(str))){const head=str.slice(0,m.index),tail=str.slice(m.index+m[0].length);
      const c=head.match(/^(.+?),\s*(.+)$/);if(!c)continue;
      if(known.some(k=>String(k||'').trim().toLowerCase()===tail.trim().toLowerCase()))
        return{name:c[1].trim(),title:c[2].trim(),principal:tail.trim()};}}
  const m=str.match(/^(.+?),\s*(.+?)\s+of\s+(?:the\s+)?(.+)$/);
  return m?{name:m[1].trim(),title:m[2].trim(),principal:m[3].trim()}:null;}
function rsSigInto(outp,partH){
  const known=outp.principals.map(p=>p.name).concat(outp.principals.map(p=>p.title)).filter(Boolean);
  let sig=rsSigOf(partH,known);
  // Part H is often left blank and the signatory written into a Part G row instead;
  // such a row names a person and carries no title of its own.
  if(!sig)for(let i=0;i<outp.principals.length;i++){const p=outp.principals[i];
    if(!p.title){const c=rsSigOf(p.name,known);if(c){sig=c;break;}}}
  if(!sig)return;
  // whichever half of the form carried it, the signatory is not also a principal
  const same=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
  outp.principals=outp.principals.filter(p=>{if(p.title)return true;const c=rsSigOf(p.name);return !(c&&same(c.name,sig.name));});
  outp.scalars['sig.name']=sig.name;outp.scalars['sig.title']=sig.title;outp.scalars['sig.principal']=sig.principal;}
function rsPrin(i,f){try{const p=_rsUpload&&_rsUpload.parsed&&_rsUpload.parsed.principals;const r=p&&p[i];const v=r&&r[f];return (v==null||v==='')?null:String(v);}catch(e){return null;}}
function rsUnit(i,f){try{const u=_rsUpload&&_rsUpload.parsed&&_rsUpload.parsed.units;const r=u&&u[i];const v=r&&r[f];return (v==null||v===''||v===0)?null:String(v);}catch(e){return null;}}
function rsUnitBr(i){const t=rsUnit(i,'type');if(t==null)return null;const bb=rsParseUnitType(t);return bb.br||null;}
function rsUnitLabel(i){const t=rsUnit(i,'type');if(t==null)return null;return rsParseUnitType(t).label||null;}
function rsFamRow(fam,i){try{const arr=_rsUpload&&_rsUpload.parsed&&_rsUpload.parsed[fam];return arr&&arr[i]||null;}catch(e){return null;}}
function rsFamVal(fam,i,f){const r=rsFamRow(fam,i);const v=r&&r[f];return (v==null||v===''||v===0)?null:String(v);}
function rsBrBa(k){let m=String(k||'').match(/^units\.(\d+)\.(br|ba|label)$/);
  if(m){const t=rsUnit(+m[1],'type');if(t==null)return null;const bb=rsParseUnitType(t);
    return (m[2]==='br'?bb.br:(m[2]==='ba'?bb.ba:bb.label))||null;}
  m=String(k||'').match(/^ns8\.(\d+)\.(br|ba)$/); // ns8 rows carry a combined "type" string, like Section 8 rows
  if(m){const t=rsFamVal('ns8',+m[1],'type');if(t==null)return null;const bb=rsParseUnitType(t);return (m[2]==='br'?bb.br:bb.ba)||null;}
  m=String(k||'').match(/^nonrev\.(\d+)\.(br|ba)$/); // Part D rows already carry br/ba split, no parsing needed
  if(m)return rsFamVal('nonrev',+m[1],m[2]);
  return null;}
function rsCsRow(k){const v=rsBrBa(k);   // the schedule's own unit type, offered like any other source
  return v?('<div class="uaopt srcopt'+((String(get(k)==null?'':get(k))===String(v))?' sel':'')+'" data-cskey="'+k+'" data-csopt="'+esc(v)+'">'+esc(v)+'<span class="uasub">Executed RS</span></div>'):'';}
function rcsBrBa(k){const m=String(k||'').match(/^units\.(\d+)\.(br|ba)$/);
  if(!m)return null;const sk='units.'+m[1]+'.'+m[2]+'_rcs';
  const st=get(sk);if(st!==''&&st!=null)return String(st);
  const lv=rcsOf(sk);return (lv==null||lv==='')?null:String(lv);}
function rcsCsRow(k){const v=rcsBrBa(k);
  return v?('<div class="uaopt srcopt'+((String(get(k)==null?'':get(k))===String(v))?' sel':'')+'" data-cskey="'+k+'" data-csopt="'+esc(v)+'">'+esc(v)+'<span class="uasub">RCS report</span></div>')
          :'<div class="uaopt srcopt srcdim">\u2014<span class="uasub">RCS report \u00b7 not available</span></div>';}
function rsVal(k){try{const p=_rsUpload&&_rsUpload.parsed;const v=p&&p.scalars?p.scalars[k]:null;return (v==null||v==='')?null:String(v);}catch(e){return null;}}
/* The reading outlives the page that made it. _rsUpload was a plain variable
   set on upload and cleared on every form open, so every source row that reads
   rsVal()/rsUnit()/rsBrBa() went dim on refresh — or merely on leaving the form
   and coming back — while rows backed by a real saved field (units.N.ua_exec,
   written by rsFillFromParsed) survived. One menu, two stories, no visible rule.
   The reading is stored with its package; the PDF bytes are not, because nothing
   downstream reads _rsUpload.bytes and a schedule is a megabyte the record does
   not need. */
function rsRemember(){if(!(activeCid&&mpdb&&mpdb.setCycleRs))return;const u=_rsUpload;
  const doc=u?{name:u.name,kind:u.kind,via:u.via,at:u.at,parsed:u.parsed}:{};
  try{Promise.resolve(mpdb.setCycleRs(activeCid,doc)).catch(()=>{});}catch(e){}}
function rsRecall(){if(!(activeCid&&mpdb&&mpdb.getCycleRs))return null;
  let d=null;try{d=mpdb.getCycleRs(activeCid);}catch(e){return null;}
  if(!d||!d.name)return null;
  return {name:d.name,bytes:null,kind:d.kind||'scan',via:d.via,parsed:d.parsed||null,at:d.at||'',stored:true};}
/* ===================== the RCS study, read =====================
   The reader is in rcs.js and is pure. This is the app side of it: pull the
   pages it asks for, keep the reading with the package, and answer the source
   dropdowns. It mirrors the rs* family above, function for function. */
async function parseRcsPdf(bytes){
  if(!(window.PDFLib&&window.RCSParse))return null;
  let doc=null;
  try{doc=await window.PDFLib.PDFDocument.load(bytes,{ignoreEncryption:true,throwOnInvalidObject:false});}catch(e){return null;}
  const rd={pageCount:doc.getPageCount(),getPage:function(i){return rsTextPageAt(doc,i);}};
  try{return await window.RCSParse.readLetter(rd);}catch(e){return null;}
}
function rcsVal(k){try{const p=_rcsUpload&&_rcsUpload.parsed;const v=p&&p.scalars?p.scalars[k]:null;return (v==null||v==='')?null:String(v);}catch(e){return null;}}
/* The study is addressed to a person: "Mr. Matthew Kim" above the subject
   block. That person is the portfolio manager the contract administrator writes
   back to — the package's point of contact. */
function rcsPocName(){const v=rcsVal('_poc_name');if(!v)return null;
  return String(v).replace(/^\s*(mr|mrs|ms|miss|dr|mx)\.?\s+/i,'').replace(/[.,:;]+$/,'').trim()||null;}
function nameParts(x){
  const t=String(x||'').replace(/^\s*(mr|mrs|ms|miss|dr|mx)\.?\s+/i,'').replace(/[.,]+$/,'').trim().split(/\s+/).filter(Boolean);
  if(!t.length)return null;
  const nm=v=>String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');
  return {first:nm(t[0]),last:nm(t[t.length-1])};}
/* Same surname, and first names that agree as far as the shorter one goes.
   Two characters minimum: "M." must not claim every Kim in the book. */
function pocMatchRcs(){
  const name=rcsPocName();
  if(!name)return {name:null,contact:null,many:false};
  const a=nameParts(name);
  if(!a||!a.last)return {name:name,contact:null,many:false};
  let list=[];try{list=(mpdb&&mpdb.listContacts)?mpdb.listContacts():[];}catch(e){}
  const hits=list.filter(ct=>{const b=nameParts(ct&&ct.name);
    if(!b||!b.last||b.last!==a.last)return false;
    if(b.first===a.first)return true;
    const n=Math.min(a.first.length,b.first.length);
    return n>=2&&a.first.slice(0,n)===b.first.slice(0,n);});
  return {name:name,contact:hits.length===1?hits[0]:null,many:hits.length>1};}

/* Match a form row to a study line on bedrooms and baths — never on position,
   which would put a 2BR rent on a 3BR row.

   When TWO study lines answer to one form row the answer is not "pick one".
   Lansing Manor prices "1BR/1BA without patio" at $1,190 and "1BR/1BA with
   patio" at $1,200: same bedrooms, same baths, different rents, and nothing on
   the form says which row is which. So an ambiguous match fills nothing and
   says so. */
/* The form spells a zero-bedroom unit "Studio" and the study states a number,
   so the two vocabularies have to meet somewhere. Here — once — because
   matching a row and building one must never disagree about what a line is.
   A shape the form has no word for returns '', and a line the form cannot
   express is a line it will not invent a row for. */
function rcsBrOf(u){const b=u&&u.br;if(b==null||b==='')return '';const t=(Number(b)===0)?'Studio':(String(b)+'BR');return BR_OPTS.indexOf(t)>=0?t:'';}
function rcsBaOf(u){const b=u&&u.ba;if(b==null||b==='')return '';const t=String(b)+'BA';return BA_OPTS.indexOf(t)>=0?t:'';}
function rcsMatch(i){
  const p=_rcsUpload&&_rcsUpload.parsed;if(!p||!p.units)return {u:null,many:false,all:[]};
  const br=String(get('units.'+i+'.br')||''),ba=String(get('units.'+i+'.ba')||'');
  if(!br)return {u:null,many:false,all:[]};
  /* Indices, not just the lines: the fill needs to know which lines are spoken
     for before it can tell which are homeless. */
  const ix=[];p.units.forEach(function(u,j){
    if(rcsBrOf(u)!==br)return;
    if(ba){const _b=rcsBaOf(u);if(_b&&_b!==ba)return;}
    ix.push(j);});
  const hit=ix.map(function(j){return p.units[j];});
  /* Two study lines, one form row — but the unit COUNT usually tells them
     apart. The rent schedule writes Lansing's rows as "1Bedroom" (32) and
     "1Bedroom Patio" (68); the form keeps the counts even though the word
     "Patio" is lost turning that into bedrooms and baths. The study prices
     "1BR/1BA without patio" for 32 units and "with patio" for 68. Counts are a
     hard number both documents state on their own, so they decide it. */
  if(hit.length>1){
    const n=numf(get('units.'+i+'.num_units'));
    if(n>0){
      const byIx=ix.filter(function(j){return Number(p.units[j].count)===n;});
      if(byIx.length===1)return {u:p.units[byIx[0]],many:false,by:'count',idx:byIx[0],all:ix};
    }
    return {u:null,many:true,types:hit.map(function(u){return u.type;}),all:ix};
  }
  return {u:hit[0]||null,many:false,idx:ix.length?ix[0]:-1,all:ix};
}
function rcsUnitVal(i,field){
  const m=rcsMatch(i);if(!m.u)return null;
  const v=m.u[field];return (v==null||v==='')?null:String(v);
}
/* A non-revenue unit is priced by its shape like any other: the appraiser
   valued the unit, not what it is used for. Same ambiguity rule — two study
   lines answering to one row fills nothing, and a non-revenue row carries no
   unit count to break the tie with. */
function rcsNonrevVal(i){
  const p=_rcsUpload&&_rcsUpload.parsed;if(!p||!p.units)return null;
  const br=String(get('nonrev.'+i+'.br')||''),ba=String(get('nonrev.'+i+'.ba')||'');
  if(!br)return null;
  const hit=p.units.filter(function(u){
    if(rcsBrOf(u)!==br)return false;
    if(ba){const _b=rcsBaOf(u);if(_b&&_b!==ba)return false;}
    return true;});
  if(hit.length!==1)return null;
  const v=hit[0].proposed;return (v==null||v==='')?null:String(v);
}
/* RS > RCS. Both documents answer for some of the same cells, and where they
   overlap the executed schedule wins: it is the contract, the study is an
   appraisal of it. Part D is where this bit — the schedule states what the
   manager's unit actually rents for, the study states what such a unit is
   worth, and the study was writing its market rent over the contract rent.

   "Offers" means the schedule's own reading, not the cell: a value the reading
   supplies outranks the study whether or not it has been written yet, so the
   order the two documents happen to be uploaded in cannot change the result. */
function rsOffers(k){
  let m=String(k||'').match(/^units\.(\d+)\.(br|ba|label)$/);
  if(m)return rsBrBa(k)!=null;
  m=String(k||'').match(/^units\.(\d+)\.(num_units|current)$/);
  if(m)return rsUnit(+m[1],m[2]==='num_units'?'count':'rent')!=null;
  m=String(k||'').match(/^(nonrev|ns8)\.(\d+)\.(rent|avg_rent|use|br|ba|num_units)$/);
  if(m){const f=(m[3]==='avg_rent')?'rent':(m[3]==='num_units'?'count':m[3]);
    return rsFamVal(m[1],+m[2],f)!=null;}
  return rsVal(k)!=null;
}
function rcsOf(k){
  if(k==='poc.name'||k==='poc.email'||k==='poc.phone'){
    const p=pocMatchRcs();
    if(!p.name)return null;
    if(k==='poc.name')return p.contact?p.contact.name:p.name;
    if(!p.contact)return null;                       // no contact, no details to offer
    if(k==='poc.email')return p.contact.email||null;
    return p.contact.phone?fmtPhone(p.contact.phone):null;}
  let m=k.match(/^units\.(\d+)\.proposed$/);   if(m)return rcsUnitVal(+m[1],'proposed');
  m=k.match(/^units\.(\d+)\.ua_rcs$/);         if(m)return rcsUnitVal(+m[1],'ua');
  m=k.match(/^units\.(\d+)\.safmr_rcs$/);      if(m)return rcsUnitVal(+m[1],'safmr');
  m=k.match(/^nonrev\.(\d+)\.rent$/);          if(m)return rcsNonrevVal(+m[1]);
  /* The study's side of the unit mix. The form has held these three cells, and
     the conflict machinery that reads them, since before this parser existed. */
  m=k.match(/^units\.(\d+)\.br_rcs$/);        if(m){const q=rcsMatch(+m[1]);return q.u?(rcsBrOf(q.u)||null):null;}
  m=k.match(/^units\.(\d+)\.ba_rcs$/);        if(m){const q=rcsMatch(+m[1]);return q.u?(rcsBaOf(q.u)||null):null;}
  m=k.match(/^units\.(\d+)\.num_rcs$/);       if(m)return rcsUnitVal(+m[1],'count');
  return rcsVal(k);
}
/* FORM-RULES: every document-fed cell says so. This must cover every key
   rcsFillFromParsed writes — the suite asserts exactly that. */
function rcsTag(k){
  const v=get(k); if(v===''||v==null)return '';
  const r=rcsOf(k); if(r==null||r==='')return '';
  const num=/^(units\.\d+\.(proposed|ua_rcs|safmr_rcs|num_rcs)|nonrev\.\d+\.rent)$/.test(k);
  /* The study gives ten bare digits and the cell holds "(708) 500-2380". Compared
     as strings those differ, so the one cell whose value is reformatted on the
     way in would have shown no source tag at all. */
  const same=num?(numf(v)===numf(r))
    :(k==='appr.phone'?String(v).replace(/\D/g,'')===String(r).replace(/\D/g,'')
    :String(v)===String(r));
  return same?'<span class="srctag rcstag">RCS</span>':'';
}
/* Declared, not inferred, so the suite can assert rcsTag covers every one. */
const RCS_SCALARS=['appr.firm','appr.name','appr.email','appr.phone','appr.addr_street','appr.addr_city','appr.addr_state','appr.addr_zip',
                   'property.name','property.addr_street','property.addr_city','property.addr_state','property.addr_zip','property.s8'];
function rcsFillKeys(){
  const ks=RCS_SCALARS.concat(['poc.name','poc.email','poc.phone']);
  (UNITS||[]).forEach(function(i){['proposed','ua_rcs','safmr_rcs','br_rcs','ba_rcs','num_rcs'].forEach(function(f){ks.push('units.'+i+'.'+f);});});
  (NONREV||[]).forEach(function(i){ks.push('nonrev.'+i+'.rent');});
  /* A key the schedule answers for is not one the study fills, so it is not one
     the study may claim a source badge on either (rule 15: an indicator
     computes, it never asserts). */
  return ks.filter(function(k){if(rsOffers(k))return false;const r=rcsOf(k);return r!=null&&r!=='';});
}
function rcsFillFromParsed(){
  const P=_rcsUpload&&_rcsUpload.parsed;if(!P)return;
  deriveUnits();          // a row added since the last render is still a row to fill
  const _wrote=[];
  const mark=k=>{markCycle(k);if(form[k])form[k].fromParse=true;if(_wrote.indexOf(k)<0)_wrote.push(k);};
  const put=(k,v)=>{if(v!=null&&v!==''){form=store.editForm(form,k,String(v));mark(k);}};
  const setk=(k,v)=>{if(rsOffers(k))return;put(k,v);};      // RS > RCS — see rsOffers

  /* The study carries none of these, so none is ever sourced from it: the FHA
     effective date, the contract administrator.

     The addressee IS written, and is handled below rather than here: it is a
     person's name, not a scalar, and it is worth more once matched against the
     contact list. */
  RCS_SCALARS.forEach(function(k){if(k!=='appr.phone')setk(k,P.scalars[k]);});
  if(P.scalars['appr.phone'])setk('appr.phone',fmtPhoneInput(P.scalars['appr.phone']));
  /* The addressee, and the contact it names. Where the name matches exactly one
     saved contact the email and phone come with it; where it matches none, or
     more than one, only the name is written — the study told us who, not how to
     reach them. */
  { const pm=pocMatchRcs();
    if(pm.name){
      setk('poc.name',pm.contact?pm.contact.name:pm.name);
      if(pm.contact){setk('poc.email',pm.contact.email);
        if(pm.contact.phone)setk('poc.phone',fmtPhoneInput(pm.contact.phone));}} }

  let ambiguous=0;
  const claimed=new Set(),ambig=new Set();
  (UNITS||[]).forEach(function(i){
    const m=rcsMatch(i);
    if(m.many){ambiguous++;(m.all||[]).forEach(function(j){ambig.add(j);});return;}
    if(!m.u)return;
    if(m.idx>=0)claimed.add(m.idx);
    if(m.u.proposed!=='')setk('units.'+i+'.proposed',m.u.proposed);
    if(m.u.ua!=='')setk('units.'+i+'.ua_rcs',m.u.ua);
    if(m.u.safmr!=='')setk('units.'+i+'.safmr_rcs',m.u.safmr);
    /* What the STUDY says this row is. The form's own br/ba/num_units keep
       coming from the executed schedule; these sit beside them so the two can
       be compared instead of one quietly overwriting the other. */
    const _b=rcsBrOf(m.u),_a=rcsBaOf(m.u);
    if(_b)setk('units.'+i+'.br_rcs',_b);
    if(_a)setk('units.'+i+'.ba_rcs',_a);
    if(m.u.count!=='')setk('units.'+i+'.num_rcs',m.u.count);
  });

  /* A line the form has no row for used to fill nothing and say nothing — the
     3BR half of a two-type study vanishing because the schedule had not been
     read yet. It brings its row with it now.

     Never for an AMBIGUOUS line: where one row already answers to two lines,
     adding both would describe the same units twice. And the new row carries
     the study's shape as well as the form's, so a schedule that later
     overwrites it by position produces a visible conflict, not a silent one. */
  /* An untouched row is a row waiting for a unit type, not one to add another
     after. A blank form filled from a study kept its empty first row above the
     rows the study had just built, so the form claimed one more unit type than
     the study priced. "Untouched" means every cell you could have typed in is
     still empty — a row carrying a count of yours is yours, not a spare. */
  const spare=(UNITS||[]).filter(function(i){
    return ['br','ba','num_units','current','proposed','label'].every(function(f){
      return String(get('units.'+i+'.'+f)||'')==='';});});
  let added=[];
  (P.units||[]).forEach(function(u,j){
    if(claimed.has(j)||ambig.has(j))return;
    const _b=rcsBrOf(u);if(!_b)return;            // a shape the form cannot express
    const reuse=spare.length?spare.shift():-1;
    const ni=reuse>=0?reuse:((UNITS.length?Math.max.apply(null,UNITS):-1)+1);
    const _a=rcsBaOf(u);
    /* put, not setk: a row the study is INVENTING is one the schedule did not
       account for, so the schedule cannot outrank it. Going through setk here
       meant a schedule whose own list merely reached this row's number blocked
       the new row's bedrooms and count — building a row that knew nothing about
       itself. Precedence is about a cell both documents describe, not about an
       index that collides. The schedule still wins the moment it fills. */
    put('units.'+ni+'.br',_b);if(_a)put('units.'+ni+'.ba',_a);
    if(u.count!=='')put('units.'+ni+'.num_units',u.count);
    put('units.'+ni+'.br_rcs',_b);if(_a)put('units.'+ni+'.ba_rcs',_a);
    if(u.count!=='')put('units.'+ni+'.num_rcs',u.count);
    if(u.proposed!=='')put('units.'+ni+'.proposed',u.proposed);
    if(u.ua!=='')put('units.'+ni+'.ua_rcs',u.ua);
    if(u.safmr!=='')put('units.'+ni+'.safmr_rcs',u.safmr);
    if(reuse<0)UNITS.push(ni);added.push(u.type||_b);
  });

  (NONREV||[]).forEach(function(i){const v=rcsNonrevVal(i);if(v)setk('nonrev.'+i+'.rent',v);});

  deriveUnits();renderBody();scheduleHudRefresh();
  const n=rcsFillKeys().length;
  _rcsFill=fillRecord(_rcsUpload,_wrote);  setStatus('Form filled from the RCS study — '+n+' value'+(n===1?'':'s')+' marked “RCS report”.'
    +(added.length?' Added '+added.length+' unit row'+(added.length===1?'':'s')+' the study prices and the form did not have ('+added.join(', ')+') — check the count and type against the executed schedule.':'')
    +(ambiguous?' '+ambiguous+' unit row'+(ambiguous===1?'':'s')+' matched more than one line in the study and '+(ambiguous===1?'was':'were')+' left for you — the study prices them separately and the form cannot tell which is which.':'')
    +' Review the highlighted cells, then “Update property profile”.');
}
/* ===================== real cross-document checks =====================
   These chips used to restate what was typed in, which reads as verification
   the app never performed. With a study parsed there are two independent
   records of the same facts, so they can finally be compared.

   A check renders ONLY when both sides exist. One-sided silence is honest;
   a green tick that compared nothing is not. */
function rcsChecks(){
  const P=_rcsUpload&&_rcsUpload.parsed;if(!P)return '';
  const out=[];const M=v=>'$'+Number(v).toLocaleString('en-US');
  const lab=i=>esc(get('units.'+i+'.br')||('row '+(i+1)));

  /* The Section 8 number, across every document that carries one. Belfry
     prints it under an "FHA Project No." label and Gates Manor's own grid
     disagrees with its own letter, so this is not a formality. */
  const N=v=>String(v).replace(/[^A-Za-z0-9]/g,'').toUpperCase();
  const src=[['the study',rcsVal('property.s8')],['the schedule',rsVal('property.s8')],['on file',get('property.s8')]]
    .filter(function(x){return x[1];});
  if(src.length>1){
    const agree=src.every(function(x){return N(x[1])===N(src[0][1]);});
    out.push(chk(agree?'ok':'warn','Section 8 # across documents',
      agree?('agrees · '+src.map(function(x){return x[0];}).join(', '))
           :src.map(function(x){return esc(x[1])+' per '+x[0];}).join(' · ')));
  }

  /* Utility allowance: the study against the executed schedule. */
  let same=0;const diff=[];
  (UNITS||[]).forEach(function(i){
    const r=numf(get('units.'+i+'.ua_rcs')),e=numf(get('units.'+i+'.ua_exec'));
    if(r>0&&e>0){if(r===e)same++;else diff.push(lab(i)+' '+M(r)+' vs '+M(e));}});
  if(same||diff.length)out.push(chk(diff.length?'warn':'ok','Utility allowance · study vs schedule',
    diff.length?('differs — '+diff.join(' · ')):(same+' unit type'+(same===1?'':'s')+' agree')));

  /* The 150% ceiling: the study against the HUD pull. */
  let ssame=0;const sdiff=[];
  (UNITS||[]).forEach(function(i){
    const r=numf(get('units.'+i+'.safmr_rcs')),h=numf(get('units.'+i+'.safmr_hud'));
    if(r>0&&h>0){if(r===h)ssame++;else sdiff.push(lab(i)+' '+M(r)+' vs '+M(h));}});
  if(ssame||sdiff.length)out.push(chk(sdiff.length?'info':'ok','150% SAFMR · study vs HUD',
    sdiff.length?('differs — '+sdiff.join(' · ')+' · the HUD pull is used')
                :(ssame+' unit type'+(ssame===1?'':'s')+' agree')));

  /* Unit counts: the study against the record. */
  const cdiff=[];let csame=0;
  (UNITS||[]).forEach(function(i){
    const mt=rcsMatch(i);if(!mt.u||mt.u.count==='')return;
    const n=numf(get('units.'+i+'.num_units'));if(!(n>0))return;
    if(Number(mt.u.count)===n)csame++;else cdiff.push(lab(i)+' '+mt.u.count+' vs '+n);});
  if(csame||cdiff.length)out.push(chk(cdiff.length?'warn':'ok','Unit counts · study vs record',
    cdiff.length?('differs — '+cdiff.join(' · ')):(csame+' unit type'+(csame===1?'':'s')+' agree')));

  /* The appraiser's own 150% conclusion against ours. Compared, never
     substituted — and only when we have a ceiling of our own to compare with. */
  if(P.totals&&P.totals.grossRenewal!=null&&P.totals.grossSafmr150!=null){
    const a=analysis();
    if(a&&a.ceil>0){
      const theirs=P.totals.grossRenewal<P.totals.grossSafmr150;
      out.push(chk(theirs===a.pass?'ok':'warn','150% test · study vs our figures',
        'the study: '+M(P.totals.grossRenewal)+' against '+M(P.totals.grossSafmr150)
        +' · ours: '+M(a.pg)+' against '+M(a.ceil)));
    }
  }

  /* Anything the study could not say cleanly about itself. */
  (P.warnings||[]).forEach(function(w){out.push(chk('info','The study',esc(w)));});
  return out.join('');
}
/* The reading outlives the page that made it, exactly as the schedule's does. */
function rcsRemember(){if(!(activeCid&&mpdb&&mpdb.setCycleRcs))return;const u=_rcsUpload;
  const doc=u?{name:u.name,at:u.at,parsed:u.parsed}:{};
  try{Promise.resolve(mpdb.setCycleRcs(activeCid,doc)).catch(()=>{});}catch(e){}}
function rcsRecall(){if(!(activeCid&&mpdb&&mpdb.getCycleRcs))return null;
  let d=null;try{d=mpdb.getCycleRcs(activeCid);}catch(e){return null;}
  if(!d||!d.name)return null;
  return {name:d.name,bytes:null,parsed:d.parsed||null,at:d.at||'',stored:true};}
function rsNum(v){let s=String(v==null?'':v).replace(/[^0-9.,\-]/g,'');
  /* A dot is not always a decimal point. These schedules are typed by hand and
     real copies use both conventions: White Oak's prints 1.147 / 36.704 /
     $83.135 where another prints 1,147 / 36,704 / $83,135. Money and unit counts
     never carry three decimal places, so a separator followed by exactly three
     digits is a grouping mark whichever mark it is.
     Read as a decimal it was silent: every rent came through as $1.15, and the
     totals gate below still passed it, because every figure on the page was
     wrong by the same factor. A gate that only checks internal consistency
     cannot catch an error that scales the whole page. */
  if(/^-?\d{1,3}(?:[.,]\d{3})+$/.test(s))s=s.replace(/[.,]/g,'');
  else s=s.replace(/,/g,'');
  const n=parseFloat(s);return isFinite(n)?n:'';}
function rsDateISO(v){v=String(v||'').trim();let m=v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);if(m)return m[3]+'-'+('0'+m[1]).slice(-2)+'-'+('0'+m[2]).slice(-2);m=v.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return v.slice(0,10);const MN={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};m=v.toLowerCase().match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);if(m&&MN[m[1]])return m[3]+'-'+('0'+MN[m[1]]).slice(-2)+'-'+('0'+m[2]).slice(-2);return '';}
function rsYearOn(iso){const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?((+m[1])+1)+'-'+m[2]+'-'+m[3]:'';}   // the uploaded schedule is the one in force; this package renews it
function rsParseUnitType(t){t=String(t||'');let br='',ba='';if(/studio|efficiency/i.test(t))br='Studio';else{const m=t.match(/(\d+)\s*(?:br\b|bed)/i);if(m&&BR_OPTS.indexOf(m[1]+'BR')>=0)br=m[1]+'BR';else{const bare=t.trim().match(/^(\d+)$/);if(bare&&BR_OPTS.indexOf(bare[1]+'BR')>=0)br=bare[1]+'BR';}}const b=t.match(/(\d+(?:\.\d+)?)\s*(?:ba\b|bath)/i);if(b&&BA_OPTS.indexOf(b[1]+'BA')>=0)ba=b[1]+'BA';
  /* Both spellings appear across the real corpus: "1 BR E" / "1 BR F" at Beacon
     Hill, "1 Bedroom, Elderly" / "1 Bedroom, Family" at Willow Woods. A bare
     letter counts only at the very end of the string, so an F inside a word can
     never designate a row. */
  /* Whatever the column says beyond the counts IS the label, verbatim. Beacon
     Hill keeps "E" and Willow Woods keeps "Elderly" — the two documents really
     do say different things, and a filing that echoes its source is worth more
     than one that normalises it. Bedrooms and baths are parsed exactly as
     before: the SAFMR pull, the ceiling maths and the RCS row matching all key
     off br, and none of that may move. */
  let label=String(t)
    .replace(/studio|efficiency/ig,'')
    .replace(/\d+\s*(?:br\b|bedrooms?\b|beds?\b)/ig,'')
    .replace(/\d+(?:\.\d+)?\s*(?:ba\b|bathrooms?\b|baths?\b)/ig,'')
    .replace(/[\s,\/\u2013\u2014-]+/g,' ')
    .trim();
  if(/^\d+$/.test(label))label='';        // a bare number is the bedroom count, not a label
  return {br:br,ba:ba,label:label};} // Part D's Type column is sometimes just the bedroom count with no BR/bath suffix
function rsReadFields(pdfForm){
  const V=n=>{try{const v=pdfForm.getTextField(String(n)).getText();return v==null?'':String(v).trim();}catch(e){return '';}};
  const CB=n=>{try{return pdfForm.getCheckBox(String(n)).isChecked();}catch(e){return false;}};
  const outp={scalars:{},units:[],ns8:[],principals:[]};
  if(V(1))outp.scalars['property.name']=V(1);
  if(V(2))outp.scalars['property.fha']=V(2);
  let dt=rsDateISO(V(3));if(!dt&&V(4)&&V(6))dt=rsDateISO(V(4)+'/'+(V(5)||'1')+'/'+V(6));if(dt)outp.scalars['rs_date']=dt;
  if(V(197))outp.scalars['owner.entity_name']=V(197);
  const ET={'198':'Individual','199':'Corporation','200':'General Partnership','201':'Limited Partnership','202':'Joint Tenancy/Tenants in Common','203':'Trust'};
  Object.keys(ET).forEach(n=>{if(CB(n))outp.scalars['owner.entity_type']=ET[n];});
  if(CB('204')){outp.scalars['owner.entity_type']='Other (specify)';if(V(205))outp.scalars['owner.entity_type_other']=V(205);}
  [206,208,210,212,214,216,218,220,222,224,226].forEach(id=>{const nm=V(id),tt=V(id+1);if(nm||tt)outp.principals.push({name:nm,title:tt});});
  const R=rsRows(V);outp.units=R.units;outp.ns8=R.ns8;
  outp.nonrev=rsPartD(V);
  rsSigInto(outp,V(228));
  outp.partb=rsPartB(n=>{const t=V(n);return t||(CB(n)?'1':'');},true); // tier 1 reads real field states
  return outp;}
/* ---- Tier 2: positioned text for copies that no longer carry form fields ----
   Interprets the page content streams (q/Q + cm stack, Tm/Td/TD/T*, Tj/TJ/quote)
   and follows every `Do` into its form XObject — where a signature-flattened copy
   keeps the values it used to hold in fields. Runs come out in page coordinates
   and are matched against the template's own field rectangles. Hex strings decode
   through the font's ToUnicode map when it has one, covering CID-encoded copies. */
async function rsInflate(seg){let e=seg.length;while(e>0&&(seg[e-1]===10||seg[e-1]===13||seg[e-1]===32))e--;seg=seg.slice(0,e);
  const ds=new DecompressionStream('deflate');const w=ds.writable.getWriter();
  const pr=new Response(ds.readable).arrayBuffer();
  /* Both ends of the stream reject when the bytes are malformed, and the caller
     can only await one of them. The other went unhandled — a console error in
     the browser, and a hard exit under node, on a real signed schedule that has
     one bad stream among sixty good ones. */
  pr.catch(()=>{});
  try{await w.write(seg);await w.close();}catch(err){try{w.releaseLock();}catch(e2){}throw err;}
  return new TextDecoder('latin1').decode(await pr);}
function rsMul(a,b){return [a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3],a[4]*b[0]+a[5]*b[2]+b[4],a[4]*b[1]+a[5]*b[3]+b[5]];}
async function rsStreamText(s){const P=window.PDFLib;if(!s||!s.dict)return '';
  let f=s.dict.get(P.PDFName.of('Filter'));f=f?String(f):'';
  const raw=s.contents||(s.getContents&&s.getContents());if(!raw)return '';
  if(/Flate/.test(f)){try{return await rsInflate(raw);}catch(e){return '';}}
  return f?'':new TextDecoder('latin1').decode(raw);}
function rsToUni(txt){const map={};let m; // ToUnicode CMap -> {charCodeHex: character}
  const bc=/beginbfchar([\s\S]*?)endbfchar/g;
  while((m=bc.exec(txt))){const pr=/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;let p;
    while((p=pr.exec(m[1])))map[p[1].toLowerCase()]=String.fromCharCode(parseInt(p[2].slice(0,4),16));}
  const br=/beginbfrange([\s\S]*?)endbfrange/g;
  while((m=br.exec(txt))){const rr=/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;let p;
    while((p=rr.exec(m[1]))){const a=parseInt(p[1],16),b=parseInt(p[2],16),c=parseInt(p[3].slice(0,4),16);
      for(let i=a;i<=b&&i-a<512;i++)map[i.toString(16).padStart(p[1].length,'0').toLowerCase()]=String.fromCharCode(c+i-a);}}
  return map;}
async function rsFontMaps(res){const P=window.PDFLib,out={};if(!res)return out;
  let fd=null;try{fd=res.lookup(P.PDFName.of('Font'));}catch(e){}
  if(!fd||!fd.keys)return out;
  for(const k of fd.keys()){let f=null;try{f=fd.lookup(k);}catch(e){}
    if(!f||!f.get)continue;
    const ent={uni:null,bytes:/Type0/.test(String(f.get(P.PDFName.of('Subtype'))||''))?2:1};
    try{const tu=f.lookup(P.PDFName.of('ToUnicode'));if(tu&&tu.dict)ent.uni=rsToUni(await rsStreamText(tu));}catch(e){}
    out[k.asString().replace(/^\//,'')]=ent;}
  return out;}
async function rsRuns(txt,ctx){ // content stream -> ctx.runs [{s,x,y,d}] in page space
  const P=window.PDFLib;
  let cm=ctx.ctm.slice(),stack=[],tm=null,tlm=null,TL=0,font=null;
  const fonts=await rsFontMaps(ctx.res);
  const emit=str=>{if(!str)return;const m=rsMul(tm||[1,0,0,1,0,0],cm);ctx.runs.push({s:str,x:+m[4].toFixed(2),y:+m[5].toFixed(2),d:ctx.depth});};
  const deLit=b=>b.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g,(mm,g)=>{if(g==='n')return'\n';if(g==='r')return'\r';if(g==='t')return'\t';if(g==='b')return'\b';if(g==='f')return'\f';if(/^[0-7]+$/.test(g))return String.fromCharCode(parseInt(g,8));return g;});
  const deHex=h=>{h=h.replace(/\s+/g,'').toLowerCase();const fi=font&&fonts[font]?fonts[font]:null;
    const step=(fi?fi.bytes===2:(h.length>=4&&/^00/.test(h)))?4:2;let o='';
    for(let i=0;i+step-1<h.length;i+=step){const cd=h.substr(i,step);
      o+=(fi&&fi.uni&&fi.uni[cd]!=null)?fi.uni[cd]:String.fromCharCode(parseInt(cd,16));}
    return o;};
  const re=/\((?:[^()\\]|\\.)*\)|<[0-9A-Fa-f\s]*>|\[(?:[^\[\]\\()]|\((?:[^()\\]|\\.)*\))*\]\s*TJ|\/[^\s\/\[\]<>(){}]+|[-.0-9]+|[A-Za-z'*"]+/g;
  let m,nums=[],lastStr=null,lastName=null;
  while((m=re.exec(txt))){const t=m[0];
    if(t[0]==='('){lastStr=deLit(t.slice(1,-1));continue;}
    if(t[0]==='<'){lastStr=deHex(t.slice(1,-1));continue;}
    if(t[0]==='/'){lastName=t.slice(1);continue;}
    /* A TJ array's numbers are horizontal displacements in thousandths of an em.
       Small ones are kerning inside a word; large negative ones are the visual
       gaps BETWEEN table cells, and dropping them welds a whole row into one
       string ("1 BR / 1 BA31818$1,870$2.29" — is that 31 units of 818 sq ft, or
       318 of 18?). Restore a gap as a space so the row can be read; -200 sits
       between the kerning population (0..-99) and the column gaps (-500..-6000)
       measured across the corpus. */
    if(t[0]==='['){const parts=[];const ri=/\((?:[^()\\]|\\.)*\)|<[0-9A-Fa-f\s]*>|-?[0-9.]+/g;let mm;
      while((mm=ri.exec(t))){const p=mm[0];
        if(p[0]==='(')parts.push(deLit(p.slice(1,-1)));
        else if(p[0]==='<')parts.push(deHex(p.slice(1,-1)));
        else if(parseFloat(p)<=-200)parts.push(' ');}
      emit(parts.join(''));nums=[];lastStr=null;continue;}
    if(/^[-.0-9]+$/.test(t)){nums.push(parseFloat(t));continue;}
    switch(t){
      case 'q':stack.push(cm.slice());break;
      case 'Q':cm=stack.pop()||ctx.ctm.slice();break;
      case 'cm':if(nums.length>=6)cm=rsMul(nums.slice(-6),cm);break;
      case 'Tf':font=lastName;break;
      case 'BT':tm=[1,0,0,1,0,0];tlm=tm.slice();break;
      case 'ET':tm=null;break;
      case 'Tm':if(nums.length>=6){tlm=nums.slice(-6);tm=tlm.slice();}break;
      case 'Td':if(nums.length>=2){tlm=rsMul([1,0,0,1,nums[nums.length-2],nums[nums.length-1]],tlm||[1,0,0,1,0,0]);tm=tlm.slice();}break;
      case 'TD':if(nums.length>=2){TL=-nums[nums.length-1];tlm=rsMul([1,0,0,1,nums[nums.length-2],nums[nums.length-1]],tlm||[1,0,0,1,0,0]);tm=tlm.slice();}break;
      case 'T*':tlm=rsMul([1,0,0,1,0,-TL],tlm||[1,0,0,1,0,0]);tm=tlm.slice();break;
      case 'TL':if(nums.length)TL=nums[nums.length-1];break;
      case 'Tj':emit(lastStr);lastStr=null;break;
      case "'":tlm=rsMul([1,0,0,1,0,-TL],tlm||[1,0,0,1,0,0]);tm=tlm.slice();emit(lastStr);lastStr=null;break;
      case 'Do':{ // a flattened field's value lives in the form XObject drawn here
        if(!lastName||ctx.depth>=8||!ctx.res)break;
        let xo=null;try{xo=ctx.res.lookup(P.PDFName.of('XObject'));}catch(e){}
        if(!xo)break;let sub=null;try{sub=xo.lookup(P.PDFName.of(lastName));}catch(e){}
        if(!sub||!sub.dict||String(sub.dict.get(P.PDFName.of('Subtype'))||'')!=='/Form')break;
        if(ctx.seen.has(sub))break;ctx.seen.add(sub);
        let mtx=[1,0,0,1,0,0];try{const mv=sub.dict.lookup(P.PDFName.of('Matrix'));if(mv&&mv.size&&mv.size()===6)mtx=[0,1,2,3,4,5].map(i=>mv.lookup(i).asNumber());}catch(e){}
        let r2=ctx.res;try{const rr=sub.dict.lookup(P.PDFName.of('Resources'));if(rr)r2=rr;}catch(e){}
        await rsRuns(await rsStreamText(sub),{res:r2,ctm:rsMul(mtx,cm),depth:ctx.depth+1,runs:ctx.runs,seen:ctx.seen});
        ctx.seen.delete(sub);break;}
    }
    nums=[];}
  return ctx.runs;}
/* One page's runs. Split out of rsTextPages so a reader can pull ONE page and
   stop: an RCS study runs to 115 pages, and interpreting every one of them to
   find a two-page letter is work nobody needs. It also decides what a scan
   would cost — the OCR tier bills per page, so it must never be handed a whole
   report when three pages carry the answer. */
async function rsTextPageAt(doc,i){const pgs=doc.getPages();if(i<0||i>=pgs.length)return [];
  const pg=pgs[i],runs=[];
  let res=null;try{res=pg.node.Resources();}catch(e){}
  let cs=null;try{cs=pg.node.Contents();}catch(e){}
  let txt='';
  if(cs&&cs.size&&cs.lookup){for(let k=0;k<cs.size();k++)txt+=(await rsStreamText(cs.lookup(k)))+'\n';}
  else if(cs)txt=await rsStreamText(cs);
  try{await rsRuns(txt,{res:res,ctm:[1,0,0,1,0,0],depth:0,runs:runs,seen:new Set()});}catch(e){}
  return runs;}
async function rsTextPages(doc){const out=[]; // one run list per page, in page order
  const n=doc.getPages().length;
  for(let i=0;i<n;i++)out.push(await rsTextPageAt(doc,i));
  return out;}
let _rsRectCache=null;
async function rsFieldRects(){ // field id -> {pg,x,y,w,h} from our own template
  if(_rsRectCache)return _rsRectCache;
  const b64=window.RCSTemplates&&window.RCSTemplates.rentSchedule;if(!b64)return {};
  const bin=atob(b64);const tb=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)tb[i]=bin.charCodeAt(i);
  const doc=await window.PDFLib.PDFDocument.load(tb,{parseSpeed:Infinity});const pf=doc.getForm();const pgs=doc.getPages();
  const map={};pf.getFields().forEach(f=>{try{const w=f.acroField.getWidgets()[0];const r=w.getRectangle();let pg=-1;pgs.forEach((p,i)=>{if(p.ref===w.P())pg=i;});map[f.getName()]={pg:pg,x:r.x,y:r.y,w:r.width,h:r.height};}catch(e){}});
  _rsRectCache=map;return map;}
function rsMapRects(pageRuns,rects,tplPg){ // one page's runs -> {fieldId: text}
  const out={};if(!pageRuns)return out;
  // A flattened copy draws its values inside form XObjects (depth > 0) while the
  // blank form's printed labels stay in the page stream. When a page carries any
  // such content, read only that — otherwise a label sitting inside a field's box
  // would be mistaken for an entered value.
  const deep=pageRuns.filter(r=>r.d>0);const runs=deep.length?deep:pageRuns;
  for(const id in rects){const rc=rects[id];if(rc.pg!==tplPg)continue;
    const inside=runs.filter(r=>r.x>=rc.x-2&&r.x<=rc.x+rc.w+2&&r.y>=rc.y-1&&r.y<=rc.y+rc.h);
    const v=inside.sort((a,b)=>(b.y-a.y)||(a.x-b.x)).map(r=>r.s).join('').trim();
    if(v)out[id]=v;}
  return out;}
function rsPartD(V){ // Part D non-revenue-producing space: gen.js's dUse/dType/dRent ids
  const dUse=[159,162,165,168,171],dType=[160,163,166,169,172],dRent=[161,164,167,170,173];
  const out=[];
  for(let r=0;r<5;r++){const use=V(dUse[r]),ty=V(dType[r]),rent=V(dRent[r]);
    if(!(use||ty||rent))continue;const bb=rsParseUnitType(ty);
    out.push({use:use,br:bb.br,ba:bb.ba,rent:rsNum(rent)});}
  return out;}
function rsRows(V){ // Part A rows, in order -> Section 8 rows and non-Section 8 rows
  const out={units:[],ns8:[]};let ns=false;
  for(let r=0;r<11;r++){const b=7+r*8;const t=V(b);const n=rsNum(V(b+1)),cr=rsNum(V(b+2)),ua=rsNum(V(b+4));
    // Any spacing or dash between the words: our own generator writes "Non- Section 8",
    // which a single-character class did not match. Checked across the whole row too,
    // since a copy may carry the marker in a column other than the first.
    const rowTxt=[t,V(b+1),V(b+2),V(b+3),V(b+4),V(b+5)].join(' ');
    if(/non[\s\-\u2010-\u2015]*section\s*8/i.test(rowTxt)){ns=true;continue;} // divider: rows below it are unassisted
    if(cr===''||cr<=0)continue;
    if(ns)out.ns8.push({type:t,count:n,rent:cr});
    else out.units.push({type:t,count:n,rent:cr,ua:ua});}
  return out;}
/* Each half of the schedule is used only when a page identifies itself as that
   half. Guessing ("page 2 must be the certification page") reads one page's text
   through the other's field boxes and invents entity and principal values. Tier 3
   classifies OCR'd pages by the same two tests. */
const RS_PG0=/Contract Rent|Utility|Number of.{0,3}Units/i, RS_PG1=/Mortgagor Entity|Owner Certification|Part G/i;
function rsClassifyPages(joined){ // page texts -> which one is Part A, which is Part G
  let pg0=-1,pg1=-1;
  joined.forEach((tx,i)=>{if(pg0<0&&RS_PG0.test(tx))pg0=i;if(pg1<0&&RS_PG1.test(tx))pg1=i;});
  if(pg1===pg0)pg1=-1;
  return {pg0:pg0,pg1:pg1};}
/* Field-id accessor in, the tier-1 parsed shape out — or null when the rows don't
   reconcile against the schedule's own printed total. Shared by tier 2 (positional
   text) and tier 3 (OCR): that gate is the only thing standing between a misread
   number and a silently wrong form, so both tiers must run the very same one. */
function rsAssembleFields(V){
  const outp={scalars:{},units:[],ns8:[],principals:[]};
  if(V(1))outp.scalars['property.name']=V(1);
  if(V(2))outp.scalars['property.fha']=V(2);
  let dt=rsDateISO(V(3));
  if(!dt&&V(4)&&V(6))dt=rsDateISO(V(4)+'/'+(V(5)||'1')+'/'+V(6));
  if(dt)outp.scalars['rs_date']=dt;
  if(V(197))outp.scalars['owner.entity_name']=V(197);
  // a flattened checkbox keeps no value — the drawn mark inside its box is all that remains
  const ET={'198':'Individual','199':'Corporation','200':'General Partnership','201':'Limited Partnership','202':'Joint Tenancy/Tenants in Common','203':'Trust'};
  Object.keys(ET).forEach(n=>{if(V(n))outp.scalars['owner.entity_type']=ET[n];});
  if(V(204)){outp.scalars['owner.entity_type']='Other (specify)';if(V(205))outp.scalars['owner.entity_type_other']=V(205);}
  [206,208,210,212,214,216,218,220,222,224,226].forEach(id=>{const nm=V(id),tt=V(id+1);if(nm||tt)outp.principals.push({name:nm,title:tt});});
  const R=rsRows(V);outp.units=R.units;outp.ns8=R.ns8;
  outp.nonrev=rsPartD(V);
  rsSigInto(outp,V(228));
  outp.partb=rsPartB(V,false);
  // quality gate: the rows must reconcile against the schedule's own printed total
  const tot=rsNum(V(95));const all=outp.units.concat(outp.ns8);
  const sum=all.reduce((a,u)=>a+(u.count&&u.rent?u.count*u.rent:0),0);
  const ok=outp.units.length>0&&(tot===''||Math.abs(sum-tot)<=Math.max(2,all.length));
  return ok?outp:null;}
/* Part I's HAP contract number IS the property's Section 8 number, and the
   template carries NO field for it — the contract administrator writes it on the
   line under the printed label. So it is found by that label instead of by a box:
   locate "HAP Contract Number", then read the band directly beneath it, stopping
   short of the "Date" column that shares the row. Works off any positioned text,
   so tiers 1, 2 and 3 all use it. */
// two letters then alphanumerics, and it MUST carry a digit: without that last
// requirement the label's own word "CONTRACT" parses as a contract number
const RS_S8=/^[A-Z]{2}(?=[0-9A-Z]*[0-9])[0-9A-Z]{5,12}$/;
/* How much a scan may wander and still be read. A page is de-skewed by
   registration before it gets here, so what is left is per-word jitter: OCR
   corner estimates, descenders dropping a word's box below its neighbours', and
   the fit's own residual. RS_LINE is the widest such wander two words on ONE
   printed line may show; it stays well under Part I's ~11.9pt row pitch so the
   value line beneath the label can never be swallowed into it. RS_BAND is how
   far below the label the written number may sit — one row, with most of a
   second row's slack. */
const RS_LINE=5, RS_BAND=20;
function rsLines(runs,tol){ // positioned runs -> one entry per printed line
  const rs=runs.slice().sort((a,b)=>b.y-a.y||a.x-b.x),out=[];
  rs.forEach(r=>{const L=out[out.length-1];
    if(L&&Math.abs(L.y-r.y)<=tol){L.r.push(r);L.x=Math.min(L.x,r.x);}
    else out.push({y:r.y,x:r.x,r:[r]});});
  /* A line reads LEFT TO RIGHT, not in whatever order the y-sort left it in.
     Joining in sort order made the line's text depend on hairline differences in
     word height: on the fixture scan "HAP" sat 0.034pt above "Contract", and
     that 0.034pt — a two-thousandth of an inch — was the entire margin by which
     the label read "HAP Contract Number" rather than "Number Contract HAP".
     Rounding the fixture's polygons to a thousandth of an inch swapped them and
     the contract number stopped being found; a real scan wanders far more than
     that. Sorting each line by x removes the dependency instead of widening it. */
  out.forEach(L=>{L.t=L.r.slice().sort((a,b)=>a.x-b.x).map(r=>String(r.s)).join(' ');});
  return out;}
function rsFindS8(runs){
  if(!runs||!runs.length)return '';
  // the label arrives as one run from a PDF and as three words from OCR, so match
  // it on the joined line rather than on any single run
  const lab=rsLines(runs,RS_LINE).find(L=>/HAP\s*Contract\s*Number/i.test(L.t));
  if(!lab)return '';
  /* Drop the label's own words by identity rather than by sitting half a point
     clear of them: at RS_LINE the label line is up to RS_LINE points deep, so a
     y-only cut either keeps its lower words or eats the value along with them. */
  const own=new Set(lab.r);
  const band=runs.filter(r=>!own.has(r)&&r.y>lab.y-RS_BAND&&r.y<lab.y&&r.x>=lab.x-12&&r.x<lab.x+460);
  for(const L of rsLines(band,RS_LINE)){
    const whole=L.t.replace(/\s+/g,'').toUpperCase();   // a number split across runs
    if(RS_S8.test(whole))return whole;
    for(const tok of L.t.toUpperCase().split(/\s+/))if(RS_S8.test(tok))return tok;}
  return '';}
function rsS8FromPages(pages){ // the label names itself, so no page guessing needed
  for(const rs of (pages||[])){const v=rsFindS8(rs);if(v)return v;}return '';}
function rsS8FromFields(pdfForm){
  // Real schedules often DO carry a field for Part I even though our blank
  // template has none, so its value is invisible to a read by template field id.
  // Fall back to the document's own fields — accepted only when exactly one holds
  // something contract-number shaped, so nothing else can be mistaken for it.
  const hit=[];
  try{(pdfForm.getFields()||[]).forEach(f=>{let t='';
    try{t=f.getText?f.getText():'';}catch(e){}
    const v=String(t||'').replace(/\s+/g,'').toUpperCase();
    if(RS_S8.test(v)&&hit.indexOf(v)<0)hit.push(v);});}catch(e){}
  return hit.length===1?hit[0]:'';}
let _rsTplRuns=null;
async function rsTplRuns(){ // the blank template's own printed text, read once
  if(_rsTplRuns)return _rsTplRuns;
  const b64=window.RCSTemplates&&window.RCSTemplates.rentSchedule;if(!b64)return null;
  const bin=atob(b64);const tb=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)tb[i]=bin.charCodeAt(i);
  const doc=await window.PDFLib.PDFDocument.load(tb,{parseSpeed:Infinity});
  _rsTplRuns=await rsTextPages(doc);return _rsTplRuns;}
function rsDropTplLabels(runs,tplRuns){
  /* The form's own printed text is not an entered value. Depth alone cannot tell
     them apart here: this copy draws everything at depth 0, so "Heating ________"
     — printed 2pt right of its checkbox and pulled in by the mapper's slop — read
     as a ticked box, while the real ticks, being drawings rather than text, read
     as nothing. A copy prints its labels where the blank form prints them (median
     offset measured at 0.0pt over 84 matches), so identical text in the same spot
     is the form talking. */
  if(!runs)return [];
  return runs.filter(r=>{
    const t=String(r.s).trim();if(!t)return false;
    if(/^[_\-–—.]+$/.test(t))return false;   // a rule to write on, not writing
    if(!tplRuns)return true;
    for(let i=0;i<tplRuns.length;i++){const L=tplRuns[i];
      if(Math.abs(r.y-L.y)>4||Math.abs(r.x-L.x)>4)continue;
      if(String(L.s).trim()===t)return false;}
    return true;});}
async function rsReadTextTier(pages,bytes,onStep){ // flattened copy -> same parsed shape as tier 1, or null
  if(!pages||!pages.length)return null;
  const rects=await rsFieldRects();if(!Object.keys(rects).length)return null;
  const {pg0,pg1}=rsClassifyPages(pages.map(rs=>rs.map(r=>r.s).join(' ')));
  if(pg0<0)return null;
  const tplr=await rsTplRuns();
  const clean=(rs,tp)=>rsDropTplLabels(rs,tplr&&tplr[tp]);
  const F=Object.assign(rsMapRects(clean(pages[pg0],0),rects,0),pg1>=0?rsMapRects(clean(pages[pg1],1),rects,1):{});
  let s8=rsS8FromPages(pages);
  // Ticks are often drawings rather than glyphs — this copy's Part B boxes hold no
  // text whatsoever — so a page that reads perfectly well can still be blind to
  // every checkbox on it. When not one is found, ask Azure for that page's
  // selection marks and take ONLY the boxes from it; the values stay with the
  // text layer, which reads them better than OCR does.
  if(bytes&&typeof ocrHalf==='function'&&typeof OCR_CHECKBOX!=='undefined'
     &&!OCR_CHECKBOX.some(id=>rects[String(id)]&&rects[String(id)].pg===0&&F[String(id)])){
    let ticks=null;try{ticks=await ocrHalf(bytes,0,[],(i,n)=>onStep&&onStep(i,n,'ticks'));}catch(e){}
    if(ticks){
      OCR_CHECKBOX.forEach(id=>{const k=String(id);
        if(rects[k]&&rects[k].pg===0&&ticks.F[k])F[k]=ticks.F[k];});
      // The page has been read anyway, so take anything else it found that the
      // text layer left blank — on a copy whose values are drawn rather than
      // typed, that is the difference between a filled box and an empty one.
      // It only ever FILLS: where the text layer has a value that value stands,
      // because it is the document's own characters, while OCR is a reading of
      // them and can turn 1027 into 1O27. A recognized guess must not be allowed
      // to overwrite the thing it was guessing at.
      Object.keys(ticks.F).forEach(k=>{if(rects[k]&&rects[k].pg===0&&!F[k])F[k]=ticks.F[k];});}}
  // A copy can be text on one page and pictures on the next — a rent roll that
  // reads fine over a certification page rendered as dozens of little images.
  // Rather than drop the entity, principals, signatory and HAP number, send just
  // that half to be OCR'd; the pages already read as text are not sent again.
  /* Was the half FOUND, or was anything READ off it? A flattened copy's page 2
     still carries the blank form's own printing — "Part G", "Name of Entity",
     "General Partnership" — so it classifies perfectly and yields no values at
     all. Judged by classification alone it looked read, and the entity, the
     principals and the signatory came back empty from a page that shows them. */
  const bIds=Object.keys(rects).filter(k=>rects[k]&&rects[k].pg===1);
  let gotB=pg1>=0&&bIds.some(k=>String(F[k]||'').trim()!=='');
  if(!gotB&&bytes&&typeof ocrHalf==='function'){
    /* Every page already read AS TEXT is skipped — except the one we are here
       for. When the second half was classified and came back empty, it is
       precisely the page that has to be sent. */
    const skip=[];pages.forEach((rs,i)=>{if(i!==pg1&&rs.length>=15)skip.push(i);});
    let add=null;try{add=await ocrHalf(bytes,1,skip,(i,n)=>onStep&&onStep(i,n,'fill'));}catch(e){}
    /* Fill, never overwrite — the same rule the tick merge above states: where
       the text layer has a value that value stands, because it is the
       document's own characters, and OCR is a reading of them. */
    if(add){Object.keys(add.F).forEach(k=>{if(!String(F[k]||'').trim())F[k]=add.F[k];});
      if(!s8&&add.s8)s8=add.s8;gotB=true;}}
  const outp=rsAssembleFields(n=>String(F[String(n)]||'').trim());
  if(outp&&s8)outp.scalars['property.s8']=s8;
  if(outp&&!gotB)outp.halfB=true;
  return outp;}
async function parseRsPdf(bytes,onStep){
  const doc=await window.PDFLib.PDFDocument.load(bytes,{ignoreEncryption:true,parseSpeed:Infinity});
  let n=0,pf=null;try{pf=doc.getForm();n=pf.getFields().length;}catch(e){}
  if(n>10){const pf1=rsReadFields(pf);
    // Part I has no field on any revision of this form, so even a fully-fielded
    // copy only carries its HAP contract number as printed text.
    if(!pf1.scalars['property.s8']){try{const tp=await rsTextPages(doc);const v=rsS8FromPages(tp)||rsS8FromFields(pf);if(v)pf1.scalars['property.s8']=v;}catch(e){}}
    return {kind:'fields',parsed:pf1};}
  let pages=null;try{pages=await rsTextPages(doc);}catch(e){}
  const runs=pages?pages.reduce((a,p)=>a+p.length,0):0;
  const scan=async()=>{let oc=null;try{oc=await ocrParseRs(bytes,(i,n)=>onStep&&onStep(i,n,'scan'));}catch(e){}return oc;};
  if(runs<15){ // nothing to read on the page itself: tier 3 sends it out to be OCR'd
    const oc=await scan();
    return oc?{kind:'fields',parsed:oc,via:'ocr'}:{kind:'scan',parsed:null,why:ocrWhy()};}
  let tp=null;try{tp=await rsReadTextTier(pages,bytes,onStep);}catch(e){}
  if(tp)return {kind:'fields',parsed:tp,via:'text'};
  /* Text on the page and none of it the values — so OCR, which the runs<15 gate
     alone would never have reached. An e-signed copy is that gate's worst case:
     signing flattens every entered figure into artwork the extractor cannot
     recover, while leaving the blank form's own printing behind. Colonial
     Village's schedule carries 287 text runs and not one of them is a value, so
     the page reads as maximally readable and yields nothing. "Is there text on
     it" was never the question. "Did we manage to read any of it" is. */
  const oc=await scan();
  return oc?{kind:'fields',parsed:oc,via:'ocr'}:{kind:'text',parsed:null,why:ocrWhy()};}
function rsFillFromParsed(){const P=_rsUpload&&_rsUpload.parsed;if(!P)return;
  const _wrote=[];
  const mark=k=>{markCycle(k);if(form[k])form[k].fromParse=true;if(_wrote.indexOf(k)<0)_wrote.push(k);};   // came from the schedule, not typed — tags an override as "parsed", not just "changed", in its note text
  const setk=(k,v)=>{if(v!=null&&v!==''){form=store.editForm(form,k,String(v));mark(k);}};
  { const pn=P.scalars['property.name'];
    if(pn&&pn.indexOf('/')>=0){const parts=pn.split('/').map(x=>x.trim()).filter(Boolean);
      if(parts.length===2){setk('property.name',parts[0]);setk('tenant.property_alias',parts[1]);}
      else setk('property.name',pn);}
    else setk('property.name',pn); }
  setk('property.fha',P.scalars['property.fha']);
  setk('property.s8',P.scalars['property.s8']);
  setk('owner.entity_name',P.scalars['owner.entity_name']);
  setk('owner.entity_type',P.scalars['owner.entity_type']);
  setk('owner.entity_type_other',P.scalars['owner.entity_type_other']);
  if(P.scalars['rs_date']){const nx=rsYearOn(P.scalars['rs_date']);
    if(nx){form=store.editForm(form,'rent_schedule.date_eff_rs',nx);mark('rent_schedule.date_eff_rs');
      if(!get('rent_schedule.date_eff_custom')){srcSetSource('rent_schedule.date_eff_custom','rs');mark('rent_schedule.date_eff_source');}}}
  setk('sig.name',P.scalars['sig.name']);setk('sig.title',P.scalars['sig.title']);setk('sig.principal',P.scalars['sig.principal']);
  if(P.partb){const CHK=P.partb._checked||{};
    Object.keys(P.partb).forEach(k=>{if(k==='_checked')return;
      if(CHK[k]){form=store.editForm(form,k,P.partb[k]);mark(k);} // a definite on/off read: write it either way
      else setk(k,P.partb[k]);});} // write-ins / fuel: only write what was actually found
  P.principals.forEach((p,ix)=>{setk('principals.'+ix+'.name',p.name);setk('principals.'+ix+'.title',p.title);});
  P.units.forEach((u,ix)=>{const bb=rsParseUnitType(u.type);setk('units.'+ix+'.br',bb.br);setk('units.'+ix+'.ba',bb.ba);setk('units.'+ix+'.label',bb.label);
    setk('units.'+ix+'.num_units',u.count);setk('units.'+ix+'.current',u.rent);
    if(u.ua!==''&&u.ua>0){setk('units.'+ix+'.ua_exec',u.ua);if(!get('units.'+ix+'.ua_source')){srcSetSource('units.'+ix+'.ua_custom','exec');mark('units.'+ix+'.ua_source');}}});
  if(P.ns8&&P.ns8.length){form=store.editForm(form,'ns8.enabled','1');mark('ns8.enabled');
    P.ns8.forEach((u,ix)=>{const bb=rsParseUnitType(u.type);setk('ns8.'+ix+'.br',bb.br);setk('ns8.'+ix+'.ba',bb.ba);
      setk('ns8.'+ix+'.num_units',u.count);setk('ns8.'+ix+'.avg_rent',u.rent);});}
  if(P.nonrev&&P.nonrev.length){form=store.editForm(form,'nonrev.enabled','1');mark('nonrev.enabled');
    P.nonrev.forEach((u,ix)=>{setk('nonrev.'+ix+'.use',u.use);setk('nonrev.'+ix+'.br',u.br);setk('nonrev.'+ix+'.ba',u.ba);
      if(u.rent!==''&&u.rent>0)setk('nonrev.'+ix+'.rent',u.rent);
      /* Part D has no unit-count field on the schedule (each row is one named
         space), so 1 is derived rather than read — and derived is still parsed,
         the same way the effective date is derived by adding a year. Marked, it
         paints as this-cycle and its pair can save it; unmarked it wore the grey
         of an untouched cell and could not be saved at all. */
      if(get('nonrev.'+ix+'.num_units')===''){form=store.editForm(form,'nonrev.'+ix+'.num_units','1');mark('nonrev.'+ix+'.num_units');}});}
  _rsFill=fillRecord(_rsUpload,_wrote);
  deriveUnits();renderBody();scheduleHudRefresh();scheduleFactorRefresh();
  setStatus('Form filled from the executed rent schedule \u2014 review the highlighted values, then \u201cUpdate property profile\u201d.');}
/* A fill is remembered against the FILE it came from, so replacing the
   document — or opening another property — leaves nothing behind claiming a
   fill that did not happen here. */
function fillRecord(up,keys){return up?{name:up.name||'',n:keys.length,keys:keys.slice()}:null;}
function fillNote(rec,up){
  if(!rec||!up||rec.name!==(up.name||''))return null;
  const left=rec.keys.filter(k=>form[k]&&form[k].source!=='database').length;
  const n=rec.n+' value'+(rec.n===1?'':'s');
  return left?('Filled '+n+' \u2014 '+left+' still to save.'):('Filled '+n+', all saved.');}
/* One tile per document, the same shape whichever state it is in, so the two
   sit level and the section does not reflow as a file is read. */
function srcTile(o){
  return '<div class="srcrow'+(o.dim?' dim':'')+'">'
    +o.icon
    +'<div class="sftext">'
      +'<b class="sfname" title="'+esc(o.name)+'">'+esc(o.name)+'</b>'
      +'<div class="sfmeta"><span class="'+o.stateCls+'">'+o.state+'</span></div>'
      +'<div class="sfsub">'+o.sub+'</div>'
    +'</div>'
    +'<div class="sfacts">'+(o.acts||'')+'</div>'
    +'</div>';}
let _rsFill=null,_rcsFill=null;
function renderSources(){
  const up=_rcsUpload;const sl=srcDocLabel();
  const _rp=up&&up.parsed,_rn=(_rp&&_rp.units)?_rp.units.length:0;
  const _rfirm=_rp&&_rp.firm==='belfry'?'Belfry Valuation':(_rp&&_rp.firm==='cornerstone'?'Cornerstone Valuation Services':null);
  const SPIN='<span class="spin" aria-hidden="true"></span>',OK='<span class="ok">\u2713</span>',
        MUT='<span class="mut">\u25cb</span>',WARN='<span class="warn">'+WARNICON+'</span>';
  const rcs=_rcsBusy
    ?srcTile({icon:SPIN,name:_rcsBusy.name,state:'reading\u2026',stateCls:'parsed',
              sub:'Reading the appraiser\u2019s transmittal letter.'})
    :up
    ?srcTile({icon:OK,name:up.name,
              state:_rn?('read \u00b7 '+(_rfirm||'study')+' \u00b7 '+_rn+' unit type'+(_rn===1?'':'s')):'uploaded \u00b7 not read',
              stateCls:'parsed',
              sub:_rn?(fillNote(_rcsFill,up)||'The values are ready to apply.')
                    :((up.parsed&&up.parsed.textless)?'This copy is a scan, so no values could be read. Enter them by hand below.'
                                                     :'No appraiser\u2019s letter was found in this file. Check that it is the complete study.'),
              acts:(_rn?'<button class="btn sm teal" id="rcsApply">Fill form from study</button>':'')
                   +'<button class="btn sm" id="upRcs">Replace</button>'})
    :srcTile({icon:MUT,dim:!sl.need,name:sl.title,state:sl.need?'not uploaded':'optional',
              stateCls:sl.need?'missing':'parsed',sub:esc(sl.sub),
              acts:'<button class="btn sm" id="upRcs">Upload PDF</button>'});
  const ru=_rsUpload;let rs;
  if(_rsBusy)rs=srcTile({icon:SPIN,name:_rsBusy.name||'Rent schedule',
      state:_rsBusy.note||'reading\u2026',stateCls:'parsed',
      sub:esc(_rsBusy.sub||'Reading the schedule\u2019s form fields and printed text.')});
  else if(!ru)rs=srcTile({icon:MUT,name:'Current executed rent schedule',state:'not uploaded',stateCls:'missing',
      sub:'Fills the unit mix, rents, utility allowances, ownership entity and principals.',
      acts:'<button class="btn sm" id="upRs">Upload PDF</button>'});
  else if(ru.kind==='fields'){const p=ru.parsed;const _half=!!(p&&p.halfB);
    /* The half-read warning is about the FILE, so it stays with the file; the
       fill line is about the form, and replaces the sentence that used to be
       there whether or not anything had been filled. */
    rs=srcTile({icon:_half?WARN:OK,name:ru.name,
      state:_half?'front half read only':(ru.at?('read '+niceDate(ru.at)):'read'),
      stateCls:_half?'missing':'parsed',
      sub:(_half?'Part A came through; Parts F and G \u2014 the ownership entity, the principals and the signatory \u2014 did not. Replace with a clearer copy, or enter those by hand. ':(ru.via==='ocr'?'Scanned \u2014 check the values against the document. ':''))
          +(fillNote(_rsFill,ru)||'No values have been applied to the form yet.'),
      acts:'<button class="btn sm teal" id="rsApply">Fill form from RS</button><button class="btn sm" id="upRs">Replace</button>'});}
  else rs=srcTile({icon:WARN,name:ru.name,state:'could not be read',stateCls:'missing',
      sub:ru.why?(esc(ru.why)+' Enter the values below.')
                :(ru.kind==='text'?'Enter the values below.':'Scanned, but the values could not be read. Enter them below.'),
      acts:'<button class="btn sm" id="upRs">Replace</button>'});
  const foot=`<input type="file" id="rcsFile" accept="application/pdf,.pdf" style="display:none"><input type="file" id="rsFile" accept="application/pdf,.pdf" style="display:none">`;
  /* The executed rent schedule comes first: it is the document that fills the
     form, and the one every package needs. The RCS study is second because it
     is the package's own new evidence, and in an OCAF or UAF year there is no
     study at all. */
  return card(1,sectionPill(1),'<div class="srcgrid">'+rs+rcs+'</div>'+foot);}

function sectionKeys(n){if(n===10)return ['ocaf.g','ocaf.rate_type','ocaf.ds_annual','ocaf.ds_t12','ocaf.ds_f12','ocaf.factor_pub','ocaf.factor_custom','ocaf.factor_src'];
  if(n===11)return ['uaf.f_oil','uaf.f_gas','uaf.f_electric','uaf.f_water'].concat(UNITS.flatMap(i=>UAF_UTILS.map(u=>'units.'+i+'.uac_'+u[0])));
  if(n===12)return PRINCIPALS.flatMap(i=>['principals.'+i+'.name','principals.'+i+'.title']);
  if(n===6)return UNITS.flatMap(i=>['units.'+i+'.br','units.'+i+'.ba','units.'+i+'.num_units','units.'+i+'.current','units.'+i+'.proposed','units.'+i+'.ua_source','units.'+i+'.safmr_source']);const fs=FIELD_SECTIONS.find(s=>s.n===n);return fs?fs.fields.flatMap(f=>f.type==='sigtitle'?['sig.title','sig.principal']:f.type==='pair'?f.items.map(x=>x.k):f.type==='addr'?ADDR:(f.type==='caaddr'?CA_ADDR:(f.type==='appraddr'?APPR_ADDR:(f.type==='mgmtaddr'?MGMT_ADDR:(f.prefix?[f.prefix,f.k]:[f.k]))))):[];}
/* A section nobody has filled in is not "confirmed". The status only ever asked
   whether something was overridden or in conflict, so a brand-new property showed
   ten green "confirmed" chips over an entirely empty form — on a compliance tool
   that invites signing off work that was never done. Emptiness now reads as its
   own state, ahead of every other test. */
function sectionEmpty(n){const ks=sectionKeys(n);if(!ks.length)return false;
  return !ks.some(k=>{const v=get(k);return v!=null&&String(v).trim()!=='';});}
function sectionStatus(n){if(n!==1&&sectionEmpty(n))return 'empty';
  if(n===1)return _rcsUpload?'ok':((hasProg('rcs')||hasProg('ocaf'))?'warn':'ok');
  if(n===10){if(sectionKeys(10).some(k=>srcOf(k)==='overridden'))return'warn';const C=ocafCalc();return(C.F>0&&C.R>0)?'ok':'warn';}
  if(n===11){if(sectionKeys(11).some(k=>srcOf(k)==='overridden'))return'warn';const A=uafAnalysis();if(A.mismatch.length)return'warn';const hasF=UAF_UTILS.some(u=>numf(get('uaf.f_'+u[0]))>0);return(hasF&&A.any)?'ok':'warn';}const over=sectionKeys(n).some(k=>srcOf(k)==='overridden');if(n===6&&(UNITS.some(uaUnresolved)||UNITS.some(i=>srcOf('units.'+i+'.ua_source')==='overridden')||(hasProg('rcs')&&(UNITS.some(safmrUnresolved)||UNITS.some(i=>srcOf('units.'+i+'.safmr_source')==='overridden')||UNITS.some(overCeiling)))||rsCapacity().msgs.length>0))return'warn';return over?'warn':'ok';}
function sectionPill(n){const st=sectionStatus(n);
  if(st==='empty')return '<span class="pill empty" data-pill="'+n+'">not started</span>';
  return st==='warn'?'<span class="pill warn" data-pill="'+n+'">review</span>':'<span class="pill ok" data-pill="'+n+'">confirmed</span>';}
function card(n,pill,body){return `<div class="card"><div class="chead"><span class="cnum">${_secPos[n]||n}</span><span class="ctitle">${SECTION_TITLES[n]}</span>${pill}<span class="chev">▾</span></div><div class="cbody">${body}</div></div>`;}


/* ================== OCAF (Section 10) — transparent HUD-9625 ==================
   Three steps shown live, never a black box (like the SAFMR gauge):
   F annual S8 potential -> carve out the debt-service share (J,K,L) ->
   inflate only the operating portion by the published factor (N,O) ->
   P = L + O, and line Q TAKES P (the RCS cap is not applied — manager's rule,
   confirmed in the wild: CA-filled worksheets show Q = P, "RCS Expires: N/A").
   R = Q ÷ F rounded to 3 decimals, applied per unit type, rounded to dollars. */
/* Pull-button lifecycle: gray = the pull is impossible right now (missing
   inputs; the reason is shown), normal = ready, green = pulled and current. */
function apiPrereq(api){
  if(api==='safmr'){const p=hudParams();return (p.zip.length===5||(p.street&&p.city&&p.state))?{ok:true}:{ok:false,why:'Needs the property ZIP or full address ('+secRef(2)+')'};}
  if(!get('property.addr_state'))return {ok:false,why:'Needs the property state ('+secRef(2)+')'};
  if(!effYear())return {ok:false,why:'Needs the effective date ('+secRef(6)+')'};
  return {ok:true};
}
function pullBtnState(api){
  const pre=apiPrereq(api);if(!pre.ok)return {cls:' off',dis:' disabled',why:pre.why};
  let done=false;
  if(api==='safmr')done=UNITS.some(i=>numf(get('units.'+i+'.safmr_hud'))>0);
  if(api==='ocaf')done=!!get('ocaf.factor_pub')&&String(get('ocaf.factor_fy'))===String(effYear())&&get('ocaf.factor_state')===(get('property.addr_state')||'');
  if(api==='uaf')done=UAF_UTILS.some(u=>get('uaf.f_'+u[0]))&&String(get('uaf.factor_fy'))===String(effYear())&&get('uaf.factor_state')===(get('property.addr_state')||'');
  return {cls:done?' done':'',dis:'',why:''};
}
function refreshIfPrereq(keys){if((Array.isArray(keys)?keys:[keys]).some(k=>/^property\.addr_|^rent_schedule\.date_eff/.test(String(k)))){scheduleHudRefresh();scheduleFactorRefresh();}}
let _facTimer=null;
function scheduleFactorRefresh(){clearTimeout(_facTimer);_facTimer=setTimeout(()=>{if(hasProg('ocaf'))pullOcafFactor({auto:true});if(hasProg('uaf'))pullUafFactors({auto:true});},900);}
/* mm/dd/yyyy or yyyy-mm-dd, and a real month and day. 20/26/0301 is neither,
   and it used to answer "which year" with 0301 — the year the SAFMR pull and
   both factor pulls then asked HUD about. */
function dateParts(v){
  const s=String(v==null?'':v).trim();
  let m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); let mo,d,y;
  if(m){mo=+m[1];d=+m[2];y=+m[3];}
  else{m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;y=+m[1];mo=+m[2];d=+m[3];}
  if(!(mo>=1&&mo<=12)||!(d>=1&&d<=31)||!(y>=1900&&y<=2200))return null;
  return {y:y,m:mo,d:d};}
function effYear(){const p=dateParts(dateEffResolved());return p?String(p.y):'';}
function ocafFactorResolved(){const src=get('ocaf.factor_src')||(get('ocaf.factor_pub')?'fr':'custom');return src==='custom'?numf(get('ocaf.factor_custom')):numf(get('ocaf.factor_pub'));}
function ocafK(){const rt=get('ocaf.rate_type')||'Fixed rate';if(/floating/i.test(rt)){const t=numf(get('ocaf.ds_t12')),f=numf(get('ocaf.ds_f12'));return (t>0&&f>0)?Math.min(t,f):(t||f);}return numf(get('ocaf.ds_annual'));}
function ocafCalc(){let e=0;UNITS.forEach(i=>{e+=numf(get('units.'+i+'.num_units'))*numf(get('units.'+i+'.current'));});
  const F=e*12,G=numf(get('ocaf.g'));
  let h=0;if(get('ns8.enabled')==='1')NS8.forEach(i=>{h+=numf(get('ns8.'+i+'.num_units'))*numf(get('ns8.'+i+'.avg_rent'));});
  const H=h*12,I=F+G+H,J=I>0?F/I:0,K=ocafK(),L=J*K,M=F-L;
  const pct=ocafFactorResolved(),N=pct>0?1+pct/100:0,O=M*N,P=L+O,Q=P;
  const R=(F>0&&N>0)?Math.round(Q/F*1000)/1000:0;   // HUD-9625 rounds the increase factor to 3 decimals
  return{e,F,G,H,I,J,K,L,M,pct,N,O,P,Q,R};}
function ocafFactorCell(){const pub=get('ocaf.factor_pub'),fy=get('ocaf.factor_fy');
  const src=get('ocaf.factor_src')||(pub?'fr':'custom');const custom=get('ocaf.factor_custom');
  const lab=(src==='custom')
    ?('<input class="uac-in" data-k="ocaf.factor_custom" value="'+esc(custom)+'" placeholder="4.9" style="width:78px"><span class="srctag">% · custom</span>')
    :(pub?('<span class="ualab">'+esc(pub)+'%<span class="srctag long" style="margin-left:6px">· FY'+esc(fy)+' Federal Register</span></span>'):('<span class="ualab" style="color:#8791a5">— pull or enter the factor</span>'));
  let state,c;if(src==='custom'){const _st=srcCellState('ocaf.factor_custom');c=provColors(_st==='overridden'?'overridden':(_st==='database'?'database':'new'),'ocaf.factor_src');}else{state=pub?srcOf('ocaf.factor_pub'):'new';const _cs=srcCellState('ocaf.factor_custom');if(_cs==='overridden')state='overridden';else if(_cs==='database'&&state==='new')state='database';c=provColors(state,'ocaf.factor_src');}
  const boxKey=(src==='custom')?'ocaf.factor_custom':'ocaf.factor_src';
  const menu='<div class="uamenu">'+srcOptRow('data-ocfopt="fr"',pub?esc(pub+'% · FY'+fy):'','Federal Register',src==='fr')+'<div class="uaopt'+(src==='custom'?' sel':'')+'" data-ocfopt="custom">Custom…</div></div>';
  /* Not gated on src==='custom'. That guard is the one the effective date
     carried: it showed the pair only for a value typed by hand, so the state
     that ALWAYS has something to save — a factor just pulled from the Federal
     Register — was the state with no button. ovIcons hides itself when there is
     nothing to save, so the guard bought nothing. */
  return '<div class="rbox uacell" data-box="'+boxKey+'" style="background:'+c[1]+';border-left-color:'+c[0]+';max-width:330px;flex:0 1 auto"><div class="uadrop" style="flex:1;min-width:0"><div class="uatrigger" tabindex="0">'+lab+'<span class="cvx">▾</span></div>'+menu+'</div>'+ovIcons(coupledKeys('ocaf.factor_custom'))+'</div>';}
function renderOcaf(){const C=ocafCalc();
  const rt=get('ocaf.rate_type')||'Fixed rate';const fl=/floating/i.test(rt);
  const fy=get('ocaf.factor_fy'),pd=get('ocaf.factor_pubdate');const st=get('property.addr_state');
  const head='<div class="ocpull"><b>Published OCAF</b>'+ocafFactorCell()
    +(function(){const bs=pullBtnState('ocaf');return '<button class="urev hudbtn'+bs.cls+'" id="pullOcaf"'+bs.dis+' title="'+esc(bs.why||'Pull the published OCAF notice from the Federal Register')+'">⤓ Federal Register</button>'
    +'<span class="sub">'+(bs.why?esc(bs.why):(fy?('FY'+esc(fy)+(st?' · '+esc(st):'')+(pd?' · published '+esc(fmtDateLong(pd)):'')):'latest published notice; enter the factor manually if the current year’s is not yet available'))+'</span></div>';})();
  const ds='<div class="pbgrp">Owner-certified inputs</div><div class="ocds">'
    +('<div class="field"><div class="flabel">Debt rate type</div><div class="rateswitch'+(fl?' fl':'')+'" id="rateSwitch"><div class="rs-thumb"></div><button type="button" class="rs-opt'+(fl?'':' on')+'" data-rt="Fixed rate">Fixed rate</button><button type="button" class="rs-opt'+(fl?' on':'')+'" data-rt="Floating rate">Floating rate</button></div>'+ovNote('ocaf.rate_type')+'</div>')
    +(fl?('<div class="field"><div class="flabel">Trailing-12 debt service</div>'+moneyBox('ocaf.ds_t12')+'</div><div class="field"><div class="flabel">Forward-12 debt service</div>'+moneyBox('ocaf.ds_f12')+'</div>')
        :('<div class="field"><div class="flabel">Annual debt service (P&amp;I + MIP)</div>'+moneyBox('ocaf.ds_annual')+'</div>'))
    +'<div class="field"><div class="flabel">Non-expiring S8 potential (line G)</div>'+moneyBox('ocaf.g')+'</div></div>'
    +(fl?'<div class="pbnote">Line K uses the <b>lesser</b> of the trailing-12-month and forward-12-month debt service, anchored to the rent effective date.</div>'
        :'<div class="pbnote">Confirm the annual debt service against the loan payment history, which accompanies the submission as supporting documentation.</div>');
  const L=(code,lab,val)=>'<div class="ocline"><span class="occode">'+code+'</span><span class="oclab">'+lab+'</span><span class="ocval" data-ocl="'+code+'">'+val+'</span></div>';
  const ws='<div class="pbgrp">HUD-9625 worksheet — computed live</div><div class="ocwork">'
    +L('E','Monthly Section 8 rent potential — units × current rents ('+secRef(6)+')',money(C.e))
    +L('F','Annual expiring Section 8 potential (E × 12)',money(C.F))
    +L('G','Annual potential, non-expiring Section 8 contracts',money(C.G))
    +L('H','Annual potential, non-Section 8 units ('+secRef(6)+' non-S8 rows × 12)',money(C.H))
    +L('I','Total project rent potential (F + G + H)',money(C.I))
    +L('J','Section 8 share of the project (F ÷ I)',C.I>0?C.J.toFixed(4):'—')
    +L('K','Annual debt service'+(fl?' — lesser of T-12 / F-12':''),C.K>0?money2(C.K):'—')
    +L('L','Section 8 share of debt service (J × K)',money2(C.L))
    +L('M','Section 8 potential less debt share (F − L)',money2(C.M))
    +L('N','OCAF factor',C.N>0?'× '+C.N.toFixed(3):'—')
    +L('O','Operating portion inflated (M × N)',money2(C.O))
    +L('P','Adjusted contract rent potential (L + O)',money2(C.P))
    +L('Q','Line Q takes P — the RCS-comparable cap is not applied',money2(C.Q))
    +L('R','<b>Increase factor (Q ÷ F, 3 decimals)</b>',C.R>0?'<b>'+C.R.toFixed(3)+'</b>':'—')
    +'</div>';
  const nr='<div class="pbgrp">Resulting rents — current × R, rounded to whole dollars</div>'
    +UNITS.map(i=>{const cur=numf(get('units.'+i+'.current'));const n=numf(get('units.'+i+'.num_units'));const br=get('units.'+i+'.br')||'—';const ba=get('units.'+i+'.ba');
      const nv=(cur>0&&C.R>0)?Math.round(cur*C.R):0;
      return '<div class="ocnrrow"><span style="flex:0 0 110px;font-weight:700">'+esc(br+(ba?'/'+ba:''))+'</span><span style="flex:0 0 78px;color:#8791a5">'+(n?(n+' unit'+(n===1?'':'s')):'—')+'</span><span>'+(cur>0?money(cur):'—')+' → <b data-ocnr="'+i+'">'+(nv?money(nv):'—')+'</b>'+(nv&&cur?' <span style="color:#166534">('+sMoney(nv-cur)+')</span>':'')+'</span></div>';}).join('')
    +'<div style="margin-top:10px"><button class="btn teal" id="ocafApply">Apply as proposed rents → '+secRef(6)+'</button></div>';
  const warn=(!C.F)?'<div class="ucnote warn" style="display:block;margin:0 0 10px">⚠ The worksheet requires the unit mix and current contract rents ('+secRef(6)+').</div>':'';
  return card(10,sectionPill(10),warn+head+ds+ws+nr);}
function refreshOcafLines(k){if(k&&!/^(ocaf|units|ns8)\./.test(k))return;if(!document.querySelector('[data-ocl]'))return;const C=ocafCalc();
  const M={E:money(C.e),F:money(C.F),G:money(C.G),H:money(C.H),I:money(C.I),J:C.I>0?C.J.toFixed(4):'—',K:C.K>0?money2(C.K):'—',L:money2(C.L),M:money2(C.M),N:C.N>0?'× '+C.N.toFixed(3):'—',O:money2(C.O),P:money2(C.P),Q:money2(C.Q),R:C.R>0?'<b>'+C.R.toFixed(3)+'</b>':'—'};
  document.querySelectorAll('[data-ocl]').forEach(x=>{const c=x.getAttribute('data-ocl');if(M[c]!=null)x.innerHTML=M[c];});
  UNITS.forEach(i=>{const cur=numf(get('units.'+i+'.current'));const nv=(cur>0&&C.R>0)?Math.round(cur*C.R):0;const b=document.querySelector('[data-ocnr="'+i+'"]');if(b)b.textContent=nv?money(nv):'—';});}
async function pullOcafFactor(opts){opts=opts||{};const auto=!!opts.auto;
  if(!supaClient){if(!auto)setStatus('The OCAF pull needs the hosted backend — sign in first.');return;}
  if(auto){if(get('ocaf.factor_src')==='custom')return; // the user opted out of the pull
    if(!apiPrereq('ocaf').ok)return;
    if(get('ocaf.factor_pub')&&String(get('ocaf.factor_fy'))===String(effYear())&&get('ocaf.factor_state')===(get('property.addr_state')||''))return;} // already current
  const b0=el('pullOcaf');if(b0)b0.disabled=true;if(!auto)setStatus('Pulling the OCAF notice from the Federal Register…');
  try{const r=await supaClient.functions.invoke('ocaf-factor',{body:{year:effYear()||undefined}});
    if(r.error){let m='request failed';try{m=(await r.error.context.json()).error||m;}catch(e){m=r.error.message||m;}throw new Error(m);}
    const d=r.data||{};if(d.error)throw new Error(d.error);
    const stt=get('property.addr_state');let v=(stt&&d.factors&&d.factors[stt]!=null)?d.factors[stt]:null;let usedNat=false;
    if(v==null&&d.national!=null){v=d.national;usedNat=true;}
    if(v==null)throw new Error('No factor for state '+(stt||'(none)')+' in the FY'+d.fy+' notice.');
    if(auto&&String(d.fy)!==String(effYear())){setStatus('The FY'+effYear()+' OCAF isn’t published yet — latest is FY'+d.fy+'. Pull it manually, or enter a custom factor.');return;}
    form=store.editForm(form,'ocaf.factor_pub',String(v));form=store.editForm(form,'ocaf.factor_fy',String(d.fy||''));form=store.editForm(form,'ocaf.factor_pubdate',String(d.publication_date||''));form=store.editForm(form,'ocaf.factor_state',usedNat?'US':stt);srcSetSource('ocaf.factor_custom','fr');['ocaf.factor_pub','ocaf.factor_fy','ocaf.factor_pubdate','ocaf.factor_state','ocaf.factor_src'].forEach(markCycle);
    renderBody();
    setStatus('FY'+d.fy+' OCAF '+(usedNat?'(national average — set the property state in '+secRef(2)+' for the state factor)':('for '+stt))+': '+v+'% — published '+fmtDateLong(d.publication_date)+'. Review, then “Update property profile”.');
  }catch(e){if(!auto)setStatus('OCAF pull failed: '+(e&&e.message?e.message:e));}
  finally{const b=el('pullOcaf');if(b)b.disabled=false;}}
async function ocafApplyRents(){const C=ocafCalc();
  if(!(C.R>0)){setStatus('Enter the OCAF factor and debt service first — the increase factor (R) drives the new rents.');return;}
  let n=0;UNITS.forEach(i=>{const cur=numf(get('units.'+i+'.current'));if(cur>0){const nv=String(Math.round(cur*C.R));if(get('units.'+i+'.proposed')!==nv){form=store.editForm(form,'units.'+i+'.proposed',nv);n++;}}});
  if(n){renderBody();setStatus('Filled proposed rents for '+n+' unit type'+(n===1?'':'s')+' at ×'+C.R.toFixed(3)+' — review, then “Update property profile”.');}
  else setStatus('Proposed rents already match the OCAF calculation.');}

/* ================== UAF (Section 11) — per-utility, always ==================
   Each utility is factored separately (HUD publishes one factor per utility per
   state) and rounded to whole dollars BEFORE summing; only tenant-paid
   utilities belong here. A decrease in any unit type's total UA derives the
   30-day tenant notice + tenant-comment certification into the package. */
function uafRow(i){const parts=UAF_UTILS.map(x=>{const u=x[0],label=x[1];const cur=numf(get('units.'+i+'.uac_'+u));const f=numf(get('uaf.f_'+u));const raw=(cur>0&&f>0)?cur*f:0;return{u,label,cur,f,raw,rounded:raw?Math.round(raw):0};});
  const curSum=parts.reduce((s,p)=>s+p.cur,0);const newSum=parts.reduce((s,p)=>s+p.rounded,0);
  return{parts,curSum,newSum};}
function uafAnalysis(){let any=false;const dec=[],mismatch=[];
  UNITS.forEach(i=>{const r=uafRow(i);if(r.curSum>0)any=true;const ua=uaResolvedOf(i);
    if(r.curSum>0&&ua>0&&Math.round(r.curSum)!==Math.round(ua))mismatch.push(i);
    if(r.curSum>0&&r.newSum>0&&r.newSum<r.curSum)dec.push(i);});
  return{any,dec,mismatch};}
function fmtFactor(f){return f>0?String(Math.round(f*10000)/10000):'—';}
function uafResHtml(i){const r=uafRow(i);if(!(r.curSum>0))return '';
  const p=r.parts.filter(x=>x.cur>0);
  const calc=p.map(x=>money(x.cur)+' × '+(x.f>0?fmtFactor(x.f):'?')+(x.raw?(' = '+money2(x.raw)+' → <b>'+money(x.rounded)+'</b>'):'')).join(' &nbsp;·&nbsp; ');
  const ua=uaResolvedOf(i);
  const mis=(ua>0&&Math.round(r.curSum)!==Math.round(ua))?' <span style="color:#b45309">⚠ components total '+money(r.curSum)+' ≠ current UA '+money(ua)+' ('+secRef(6)+')</span>':'';
  const tot=r.newSum>0?('Total: '+money(r.curSum)+' → <b>'+money(r.newSum)+'</b>'+(r.newSum<r.curSum?' <span style="color:#b45309">(decrease)</span>':'')):'';
  return calc+(tot?'<br>'+tot:'')+mis;}
function renderUaf(){
  const fy=get('uaf.factor_fy'),pd=get('uaf.factor_pubdate');const st=get('property.addr_state');
  const head='<div class="ocpull"><b>Published UAFs</b>'
    +(function(){const bs=pullBtnState('uaf');return '<button class="urev hudbtn'+bs.cls+'" id="pullUaf"'+bs.dis+' title="'+esc(bs.why||'Pull this state’s utility allowance factors from HUD USER')+'">⤓ HUD USER</button>'
    +'<span class="sub">'+(bs.why?esc(bs.why):(fy?('FY'+esc(fy)+(st?' · '+esc(st):'')+(pd?' · file dated '+esc(fmtDateLong(pd)):'')):'one factor per utility, published by state'))+'</span></div>';})();
  const fCells='<div class="uffrow">'+UAF_UTILS.map(x=>'<div class="field"><div class="flabel">'+x[1]+' factor</div>'+numBox('uaf.f_'+x[0],'1.039')+'</div>').join('')+'</div>';
  const note='<div class="pbnote">Enter each unit type’s current utility allowance by utility, for <b>tenant-paid utilities only</b> — utilities included in rent are not adjusted. Each utility is adjusted and rounded to the whole dollar before the total is summed.</div>';
  const rows=UNITS.map(i=>{const br=get('units.'+i+'.br')||'—';const ba=get('units.'+i+'.ba');const n=numf(get('units.'+i+'.num_units'));
    const cells=UAF_UTILS.map(x=>'<div class="field"><div class="flabel">'+x[1]+'</div>'+moneyBox('units.'+i+'.uac_'+x[0])+'</div>').join('');
    return '<div class="uafunit"><div class="uafname">'+esc(br+(ba?'/'+ba:''))+(n?' <span style="color:#8791a5;font-weight:400">· '+n+' unit'+(n===1?'':'s')+'</span>':'')+'</div><div class="uafcells">'+cells+'</div><div class="uafres" data-uafres="'+i+'">'+uafResHtml(i)+'</div></div>';}).join('');
  const A=uafAnalysis();
  const banner='<div id="uafBanner">'+(A.any?(A.dec.length
    ?'<div class="ucnote warn" style="display:block;margin:10px 0 0">⚠ UA decrease for '+A.dec.length+' unit type'+(A.dec.length>1?'s':'')+' — the 30-day tenant notice and the owner’s tenant-comment certification are required in the package.</div>'
    :'<div class="ucnote ok" style="display:block;margin:10px 0 0">✓ No UA decreases — no tenant notice required.</div>'):'')+'</div>';
  const apply='<div style="margin-top:12px"><button class="btn teal" id="uafApply">Apply new UAs → '+secRef(6)+'</button></div>';
  return card(11,sectionPill(11),note+head+fCells+'<div class="pbgrp">Current UA components × factors</div>'+rows+banner+apply);}
function refreshUafLines(k){if(k&&!/^(uaf|units)\./.test(k))return;if(!document.getElementById('uafBanner'))return;
  UNITS.forEach(i=>{const x=document.querySelector('[data-uafres="'+i+'"]');if(x)x.innerHTML=uafResHtml(i);});
  const A=uafAnalysis();const bn=document.getElementById('uafBanner');
  bn.innerHTML=A.any?(A.dec.length
    ?'<div class="ucnote warn" style="display:block;margin:10px 0 0">⚠ UA decrease for '+A.dec.length+' unit type'+(A.dec.length>1?'s':'')+' — the 30-day tenant notice and the owner’s tenant-comment certification are required in the package.</div>'
    :'<div class="ucnote ok" style="display:block;margin:10px 0 0">✓ No UA decreases — no tenant notice required.</div>'):'';}
async function pullUafFactors(opts){opts=opts||{};const auto=!!opts.auto;
  if(!supaClient){if(!auto)setStatus('The UAF pull needs the hosted backend — sign in first.');return;}
  if(auto){const any=UAF_UTILS.some(u=>get('uaf.f_'+u[0]));const pulled=!!get('uaf.factor_fy');
    if(any&&!pulled)return; // factors were entered by hand — leave them alone
    if(!apiPrereq('uaf').ok)return;
    if(any&&pulled&&String(get('uaf.factor_fy'))===String(effYear())&&get('uaf.factor_state')===(get('property.addr_state')||''))return;} // already current
  const b0=el('pullUaf');if(b0)b0.disabled=true;if(!auto)setStatus('Pulling utility allowance factors from HUD USER…');
  try{const r=await supaClient.functions.invoke('uaf-factor',{body:{year:effYear()||undefined}});
    if(r.error){let m='request failed';try{m=(await r.error.context.json()).error||m;}catch(e){m=r.error.message||m;}throw new Error(m);}
    const d=r.data||{};if(d.error)throw new Error(d.error);
    const stt=get('property.addr_state');const rec=(stt&&d.factors&&d.factors[stt])||d.national;
    if(!rec)throw new Error('No factors for state '+(stt||'(none)')+' in the FY'+d.fy+' file.');
    const usedNat=!(stt&&d.factors&&d.factors[stt]);
    if(auto&&String(d.fy)!==String(effYear())){setStatus('The FY'+effYear()+' UAFs aren’t published yet — latest is FY'+d.fy+'. Pull them manually, or enter the factors.');return;}
    const r4=x=>String(Math.round((+x||0)*10000)/10000);
    form=store.editForm(form,'uaf.f_oil',r4(rec.oil));form=store.editForm(form,'uaf.f_gas',r4(rec.gas));form=store.editForm(form,'uaf.f_electric',r4(rec.electric));form=store.editForm(form,'uaf.f_water',r4(rec.water));
    form=store.editForm(form,'uaf.factor_fy',String(d.fy||''));form=store.editForm(form,'uaf.factor_state',usedNat?'US':stt);
    const lm=d.last_modified?new Date(d.last_modified):null;
    form=store.editForm(form,'uaf.factor_pubdate',(lm&&!isNaN(lm))?lm.toISOString().slice(0,10):'');
    ['uaf.f_oil','uaf.f_gas','uaf.f_electric','uaf.f_water','uaf.factor_fy','uaf.factor_state','uaf.factor_pubdate'].forEach(markCycle);
    renderBody();
    setStatus('FY'+d.fy+' UAFs '+(usedNat?'(U.S. — set the property state in '+secRef(2)+' for the state factors)':('for '+stt))+': oil '+r4(rec.oil)+' · gas '+r4(rec.gas)+' · electric '+r4(rec.electric)+' · water/sewer/trash '+r4(rec.water)+'. Review, then “Update property profile”.');
  }catch(e){if(!auto)setStatus('UAF pull failed: '+(e&&e.message?e.message:e));}
  finally{const b=el('pullUaf');if(b)b.disabled=false;}}
async function uafApplyUas(){let n=0;
  /* A utility whose factor never arrived contributes 0 to the new total but its
     full amount to the old one. Applying that writes an allowance short by the
     whole component, reports it as a DECREASE — which is a 30-day notice to
     residents that was never warranted — and prints $0 to them as the proposed
     figure. Refuse until every priced utility has a factor. */
  const gaps=[];UNITS.forEach(i=>{uafRow(i).parts.forEach(p=>{if(p.cur>0&&!(p.f>0)&&gaps.indexOf(p.label)<0)gaps.push(p.label);});});
  if(gaps.length){setStatus('Cannot apply: no published factor for '+gaps.join(', ')+'. Pull the factors, or enter one by hand, before applying.');return;}
  UNITS.forEach(i=>{const r=uafRow(i);if(r.curSum>0&&r.newSum>0){srcEditKey('units.'+i+'.ua_custom',String(r.newSum));form=store.editForm(form,'units.'+i+'.ua_reviewed','1');n++;}});
  if(n){renderBody();setStatus('Set the new UA for '+n+' unit type'+(n===1?'':'s')+' (as the custom UA source in '+secRef(6)+') — review, then “Update property profile”.');}
  else setStatus('Enter UA components and factors first.');}

/* Keep the interaction point visually still: content above the form (the
   command cards + attention banner) can grow/shrink on any edit — measure the
   focused element before the mutation and counter-scroll the drift after. */
function holdAnchor(fn){let a=document.activeElement;if(!(a&&a!==document.body&&a.getBoundingClientRect&&document.contains(a)))a=null;if(!a&&_lastClickNode&&document.contains(_lastClickNode)&&(Date.now()-_lastClickAt)<2000)a=_lastClickNode;const ok=!!a;const t=ok?a.getBoundingClientRect().top:0;fn();if(ok&&document.contains(a)){const d=a.getBoundingClientRect().top-t;if(d)window.scrollBy(0,d);}}
function renderCommand(){holdAnchor(_renderCommand);}
function _renderCommand(){const a=analysis();const pCur=a.ceil>0?clamp(a.cg/a.ceil*100):0,pPro=a.ceil>0?clamp(a.pg/a.ceil*100):0;
  const conf=UNITS.filter(uaConflict).length,unres=UNITS.filter(uaUnresolved).length;
  const nmOk=hasReal('property.name'),fhaOk=hasReal('property.fha'),s8Ok=hasReal('property.s8'),sigOk=hasReal('sig.name');
  const uaHave=UNITS.some(i=>numf(get('units.'+i+'.ua_exec'))>0||numf(get('units.'+i+'.ua_rcs'))>0||numf(get('units.'+i+'.ua_custom'))>0);
  const ua=!uaHave?['warn','not entered — '+secRef(6)]:(conf===0?['ok',(hasProg('rcs')&&UNITS.some(i=>numf(get('units.'+i+'.ua_exec'))>0&&numf(get('units.'+i+'.ua_rcs'))>0))?'exec & RCS agree':'as entered']:(unres===0?['ok','UA conflicts resolved per unit type']:['warn',unres+' of '+conf+' unit type'+(conf>1?'s':'')+' need'+(unres===1?'s':'')+' a UA source']));
  const uaStrip=()=>{const U=uafAnalysis();let dMo=0,types=0;UNITS.forEach(i=>{const r=uafRow(i);if(r.curSum>0&&r.newSum>0){types++;dMo+=numf(get('units.'+i+'.num_units'))*(r.newSum-r.curSum);}});
    return `<div class="lift"><b>UTILITY ALLOWANCE CHANGE</b><div class="liftnums"><span><b class="teal">${types}</b><i>unit type${types===1?'':'s'}</i></span><span><b style="color:${liftClr(dMo)}">${sMoney(dMo)}</b><i>UA /mo across units</i></span><span><b style="color:${U.dec.length?'#b45309':'#166534'}">${U.dec.length}</b><i>decrease${U.dec.length===1?'':'s'}</i></span></div></div>`;};
  let card1;
  if(hasProg('rcs')){
    /* With no proposed rent on any type, a.pg is nothing but utility allowance, so
       the ceiling test "passes" by default and the gauge draws a proposed bar out of
       thin air. Say the test hasn't run yet instead of awarding it a green PASS. */
    const priced=a.priced>0;
    /* Price only some of the unit types and the test must cover only those. Run
       over the whole property and the unpriced types bring a ceiling nothing is
       weighed against, which inflates the headroom — one type priced out of two
       reported $131,720 of room that did not exist. */
    const partial=priced&&a.tPr<a.tTot;
    const CG=partial?a.cgC:a.cg,PG=partial?a.pgC:a.pg,CEIL=partial?a.ceilC:a.ceil;
    const PASS=CEIL>0&&PG<CEIL,HEAD=CEIL-PG;
    const gCur=CEIL>0?clamp(CG/CEIL*100):0,gPro=CEIL>0?clamp(PG/CEIL*100):0;
    card1=`<div class="ccard afford"><div class="cck">AFFORDABILITY PROOF</div><div class="cctitle">${a.ceil>0?(priced?('Proposed rents '+(PASS?'clear':'exceed')+' the 150% SAFMR ceiling'+(partial?' for the '+a.tPr+' of '+a.tTot+' unit types priced so far':'')):'Enter the proposed rents to run the 150% test'):(a.countsMissing&&a.safmrHave?'Add the unit counts to run the 150% test':'Enter or pull a SAFMR to run the 150% test')}</div><div class="ccsub">Monthly gross rent potential (rent + UA)</div>
     <div class="afrow"><div class="afbar">
        <div class="gauge">${gaugeSegs(priced?gCur:pCur,priced?gPro:0)}<div class="oend"></div></div>
        <div class="glabels"><div class="gl l"><b style="color:#2f7d57">${money(priced?CG:a.cg)}</b><i>current</i></div><div class="gl c"><b style="color:${priced?'#47a377':'#94a3b8'}">${priced?money(PG):'—'}</b><i>proposed</i></div><div class="gl r"><b>${(priced?CEIL:a.ceil)>0?money(priced?CEIL:a.ceil):'—'}</b><i>150% ceiling · HUD SAFMR</i>${partial?`<i class="amber">⚠ ${a.tTot-a.tPr} unit type${a.tTot-a.tPr===1?'':'s'} not priced yet</i>`:''}${a.safmrConflict?`<i class="amber">⚠ RCS differs on ≥1 type</i>`:(a.safmrMissing?`<i class="amber">⚠ SAFMR needed</i>`:(a.countsMissing&&a.safmrHave?`<i class="amber">⚠ unit counts needed</i>`:''))}</div></div>
       </div>
       ${(a.ceil>0&&priced)?`<div class="passbox" style="background:${PASS?'#dcfce7':'#fee2e2'};color:${PASS?'#166534':'#b91c1c'};border-color:${PASS?'#86efac':'#fca5a5'}">${PASS?'✓ PASS':'✗ OVER'}<small>${money(Math.abs(HEAD))} ${PASS?'headroom':'over'}${partial?' · so far':''}</small></div>`:`<div class="passbox" style="background:#f1f4f9;color:#64748b;border-color:#d7deea">${a.ceil>0?'Proposed rents needed':(a.countsMissing&&a.safmrHave?'Unit counts needed':'SAFMR needed')}<small>${a.ceil>0?('enter them in '+secRef(6)):(a.countsMissing&&a.safmrHave?('add the number of units in '+secRef(6)):(hudBlockerShort()||'enter or pull from HUD'))}</small></div>`}</div>
     <div class="lift"><b>RCS increase over the current rent roll</b>${!priced?`<div class="liftnote">The lift appears once proposed rents are entered in ${secRef(6)}.</div>`:`<div class="liftnums"><span><b style="color:${liftClr(a.pct)}">${sPct(a.pct)}</b><i>${liftWord(a.pct)}</i></span><span><b style="color:${liftClr(a.perUnit)}">${sMoney(a.perUnit)}</b><i>per unit</i></span><span><b style="color:${liftClr(a.dMo)}">${sMoney(a.dMo)}</b><i>per month</i></span><span><b style="color:${liftClr(a.dYr)}">${sK(a.dYr)}</b><i>per year</i></span></div>`}</div>
   </div>`;
  } else {
    const C=ocafCalc();let dMo=0,units=0;UNITS.forEach(i=>{const n=numf(get('units.'+i+'.num_units')),cur=numf(get('units.'+i+'.current'));if(n&&cur&&C.R>0){dMo+=n*(Math.round(cur*C.R)-cur);units+=n;}});
    const ocafBits=hasProg('ocaf')
      ?`<div class="cctitle">${C.R>0?('OCAF applies ×'+C.R.toFixed(3)+' to current contract rents'):'Complete the OCAF worksheet — factor and debt service'}</div><div class="ccsub">${C.pct>0?('Published ×'+C.N.toFixed(3)+(get('ocaf.factor_fy')?' (FY'+esc(get('ocaf.factor_fy'))+')':'')+' → ×'+(C.R>0?C.R.toFixed(3):'—')+' effective after the debt-service carve-out'):'Pull the published factor from the Federal Register, or enter it manually ('+secRef(10)+').'}</div>
        <div class="lift"><b>OCAF increase over the current rent roll</b><div class="liftnums"><span><b style="color:${liftClr(C.R>0?C.R-1:0)}">${C.R>0?((C.R>=1?'+':'')+((C.R-1)*100).toFixed(1)+'%'):'—'}</b><i>${C.R>0&&C.R<1?'decrease':'increase'}</i></span><span><b style="color:${liftClr(dMo)}">${units?sMoney(dMo/units):'+$0'}</b><i>per unit avg</i></span><span><b style="color:${liftClr(dMo)}">${sMoney(dMo)}</b><i>per month</i></span><span><b style="color:${liftClr(dMo)}">${sK(dMo*12)}</b><i>per year</i></span></div></div>`
      :`<div class="cctitle">Utility allowance factor adjustment</div><div class="ccsub">Tenant-paid utility allowances, adjusted by the published state factors. Contract rents are not affected.</div>`;
    card1=`<div class="ccard afford"><div class="cck">${esc(cycleProgs().map(x=>PROG_NAMES[x]||x).join(' + '))} ADJUSTMENT</div>${ocafBits}${hasProg('uaf')?uaStrip():''}</div>`;
  }
  el('cc').innerHTML=`
   ${card1}
   ${(function(){const _all=`
     ${chk(nmOk?'ok':'warn','Property name',nmOk?esc(get('property.name')):('missing — '+secRef(2)))}${chk(s8Ok?'ok':'warn','Section 8 #',s8Ok?esc(get('property.s8')):('missing — '+secRef(2)))}${chk(fhaOk?'ok':'info','FHA #',fhaOk?esc(get('property.fha')):((get('property.fha')||'').trim()?'the schedule says “'+esc(get('property.fha'))+'” — no number to print':'none on file — fills page 1 of the rent schedule'))}${chk(sigOk?'ok':'warn','Signatory (Part H)',sigOk?(esc(get('sig.name'))+(get('sig.title')?' · '+esc(get('sig.title'))+(get('sig.principal')?' of the '+esc(get('sig.principal')):''):'')):('missing — '+secRef(3)))}
     ${chk(ua[0],'Utility allowance',ua[1])}${hasProg('rcs')?chk((a.safmrMissing||a.ceil<=0)?'warn':(a.safmrOver?'warn':(a.safmrConflict?'info':'ok')),'SAFMR (150% ceiling)',a.safmrMissing?'enter or pull SAFMR per unit type':(a.ceil<=0?(a.countsMissing&&a.safmrHave?'no ceiling yet — unit counts needed':'no ceiling yet'):(a.safmrOver?(a.safmrOver+' type'+(a.safmrOver>1?'s':'')+' over 150% SAFMR'):(a.safmrConflict?'HUD vs RCS differ — using HUD':(UNITS.every(i=>(get('units.'+i+'.safmr_source')||defSafmrSrc(i))==='hud')?'per unit type · HUD':'per unit type'))))):''}${(()=>{const c=rsCapacity();return c.msgs.length?chk('warn','Rent schedule capacity',esc(c.flags.join(' · '))):'';})()}${rcsChecks()}`;
   /* .chk never nests, and chk() is its only producer, so the concatenation
      splits back into items on its own opening tag. */
   const _items=_all.split('<div class="chk"').filter(x=>x.trim()).map(x=>'<div class="chk"'+x);
   const _attn=_items.filter(x=>!/data-st="ok"/.test(x));
   const _ok=_items.filter(x=>/data-st="ok"/.test(x));
   const _n=_ok.length;
   /* Inside the grid: an odd number of things wanting attention leaves a cell
      empty, and this is what belongs in it. Two columns, so it lands bottom
      right when the count is odd and starts a fresh row when it is even —
      either way the card has no band of its own to carry. */
   const _more=_n?('<div class="chkmore" tabindex="0">'
        +'<div class="chksum"><span class="ok">\u2713</span> '+_n
        +(_attn.length?' agree':' \u2014 all agree')+'</div>'
        +'<div class="chkall"><div class="chkgrid">'+_ok.join('')+'</div></div></div>'):'';
   return '<div class="ccard chkcard"><div class="cckrow"><div class="cck">RECORD CHECKS</div>'+_more+'</div>'
     +(_attn.length?('<div class="chkgrid">'+_attn.join('')+'</div>'):'')
     +'</div>';})()}
   ${pkgCard()}`;}
function pkgCard(){
  const S=packageScore();
  /* Every row's tick is computed, for every program. The OCAF/UAF card used to
     list its documents as plain strings with no readiness at all — a card
     asserting its documents are in the package without asking whether one of
     them could be written, which is FORM-RULES §15 exactly. A hollow ring
     rather than an empty slot: grey text alone left the reader to notice an
     absence, and an absence is the thing hardest to notice. */
  const rows=S.docs.map(d=>{
    const t=d.ready?'':' class="draft-off" title="Needs '+esc(d.missing.map(x=>x.label).join(', '))+'"';
    return '<span'+t+'><i class="dtick'+(d.ready?'':' pend')+'">'+(d.ready?'\u2713':'\u25cb')+'</i>'+esc(d.label)+'</span>';}).join('');
  /* A row for a document the package is BUILT from, as against one it
     produces. Both sources are named whether or not either is loaded — the
     same rule the cells follow — so an absent schedule reads as a thing not
     done yet rather than a thing that does not exist. */
  const srcRow=(name,file,note,have)=>'<div class="pksrcrow'+(have?'':' off')+'">'
    +'<i class="pktick'+(have?'':' pend')+'">'+(have?'\u2713':'\u25cb')+'</i>'
    +'<span class="pksrcn">'+esc(name)+'</span>'
    +'<span class="pksrcf" title="'+esc(file||note)+'">'+esc(file||note)+'</span></div>';
  /* In an RCS year the study is document 04 and has a name of its own. In an
     OCAF or UAF year there is no study, and srcDocLabel says what stands in
     its place — and whether the package needs one at all. */
  const sl=srcDocLabel();
  const second=hasProg('rcs')
    ? srcRow('RCS report',_rcsUpload?_rcsUpload.name:'',_rcsUpload?'':'not uploaded yet \u2014 it is document 04',!!_rcsUpload)
    : srcRow(sl.title,_rcsUpload?_rcsUpload.name:'',_rcsUpload?'':(sl.need?'not uploaded yet':'optional'),!!_rcsUpload);
  /* The headline answers the card's own question. It used to repeat the
     study's source row, which the reader had already read one line down. The
     total comes off S.docs, because an OCAF year does not have six. */
  const ready=S.docs.filter(d=>d.ready).length,total=S.docs.length;
  const head=(total&&ready===total)?('All '+total+' documents ready'):(ready+' of '+total+' ready to generate');
  /* What is holding it, on the card, one press from the cell that fixes it.
     A ring that says 55% and a card that says four of six are ready both leave
     the same question — this answers it without opening the generate dialog. */
  return '<div class="ccard"><div class="cck">THIS PACKAGE</div>'
    /* The ring counted percent and the headline counts documents, so the card
       showed "5" beside "0 of 6 ready to generate" — two scales on one line,
       read as a contradiction. The sentence is the useful one: it names the
       unit, and the list underneath is already the detail. The percentage is
       kept in the title for anyone who wants it. */
    +'<div class="cctitle" style="font-size:15px" title="'+esc(S.pct+'% complete')+'">'+head+'</div>'
    +'<div class="pksrc">'+srcRow('Executed rent schedule',_rsUpload?_rsUpload.name:'',_rsUpload?'':'not uploaded yet',!!_rsUpload)+second+'</div>'
    +'<div class="drafts">'+rows+'</div>'
    /* The gap list came off. It was three named fields, a heading, and two
       disclosure lines, and it tripled a card that sets the height of the two
       beside it — for information already on the card: every unready document
       row above carries title="Needs …" naming exactly what it is short of,
       and the generate dialog lists the same fields with a link to each cell.
       Three ways of saying it was two too many. */
    +'<div class="wb">Documents are generated from the form exactly as shown. Save with \u201cUpdate property profile\u201d before generating.</div></div>';}

/* "N/A" is an answer to what the FHA number IS, not a filled field. The test
   lives in score.js now, with the tables that use it; this is its binding to
   the open form. */
function hasReal(k){return window.RCSScore.hasReal(get,k);}
const WARNICON='<svg class="wicon" viewBox="0 0 24 24" aria-hidden="true">'
  +'<path d="M12 3.4 22.2 20.6H1.8Z" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/>'
  +'<path d="M12 9.7v4.3" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>'
  +'<circle cx="12" cy="17.4" r="1.2" fill="currentColor"/></svg>';
function chk(st,name,note){const ic=st==='warn'?WARNICON:(st==='info'?'ⓘ':'✓');const cl=st==='warn'?'warn':(st==='info'?'info':'ok');return `<div class="chk" data-st="${cl}"><span class="${cl}">${ic}</span><div><b>${name}</b><div class="sub">${note}</div></div></div>`;}

function isStateKey(k){return /\.(ua_reviewed|safmr_reviewed|type_reviewed|num_reviewed|ua_custom|safmr_custom)$/.test(k)||k==='tenant.mgmt_source'||k==='poc.mode'||/^poc\.custom_/.test(k)||k==='rent_schedule.date_eff_source'||k==='rent_schedule.date_eff_custom'||k==='ocaf.factor_src'||k==='ocaf.factor_custom';}
function overrideCount(){const grouped=new Set();for(const b in ADDR_GROUPS)ADDR_GROUPS[b].forEach(k=>grouped.add(k));UNITS.forEach(i=>{grouped.add('units.'+i+'.br');grouped.add('units.'+i+'.ba');});
  for(let i=0;i<5;i++){grouped.add('partb.utilities.'+i);grouped.add('partb.fuel.'+i);}
  const wiBases=new Set();Object.keys(form).forEach(k=>{const m=k.match(/^partb\.writein\.([a-z0-9]+)(\.on|\.fuel)?$/);if(m){grouped.add(k);wiBases.add(m[1]);}});
  let c=Object.keys(form).filter(k=>form[k].source==='overridden'&&!isStateKey(k)&&!grouped.has(k)&&k!=='nonrev.enabled'&&k!=='ns8.enabled').length;
  for(const b in ADDR_GROUPS)if(ADDR_GROUPS[b].some(k=>srcOf(k)==='overridden'))c++;
  UNITS.forEach(i=>{if(srcOf('units.'+i+'.br')==='overridden'||srcOf('units.'+i+'.ba')==='overridden')c++;});
  for(let i=0;i<5;i++){if(srcOf('partb.utilities.'+i)==='overridden'||srcOf('partb.fuel.'+i)==='overridden')c++;}
  wiBases.forEach(b=>{if(srcOf('partb.writein.'+b)==='overridden'||srcOf('partb.writein.'+b+'.on')==='overridden'||srcOf('partb.writein.'+b+'.fuel')==='overridden')c++;});
  return c;}
/* Current is the dark band, proposed the light one. When the proposal comes in
   BELOW today's rents the light band used to be given a negative width and so
   vanished, leaving the card printing a proposed figure the bar never showed.
   Draw it over the dark band instead: a decrease reads as light green sitting
   inside dark green. */
function gaugeSegs(pCur,pPro){const down=pPro<pCur;
  return '<div class="seg dark" style="width:'+pCur+'%"></div>'
    +'<div class="seg light'+(down?' over':'')+'" style="left:'+(down?0:pCur)+'%;width:'+(down?pPro:pPro-pCur)+'%"></div>';}
function attnFlags(){const f=[];const u=UNITS.filter(uaUnresolved).length;if(u)f.push(u+' UA conflict'+(u>1?'s':'')+' to resolve');const sf=hasProg('rcs')?UNITS.filter(safmrUnresolved).length:0;if(sf)f.push(sf+' SAFMR conflict'+(sf>1?'s':'')+' to resolve');const A=analysis();if(hasProg('rcs')){if(A.safmrMissing)f.push(hudBlockerText()?('To pull SAFMRs, '+hudBlockerText()):'SAFMR needed for the 150% test');if(!A.safmrMissing&&A.countsMissing&&A.safmrHave)f.push('Unit counts are needed for the 150% test ('+secRef(6)+')');if(A.safmrOver)f.push(A.safmrOver+' unit type'+(A.safmrOver>1?'s':'')+' over 150% SAFMR');}rsCapacity().flags.forEach(x=>f.push(x));const ov=overrideCount();if(ov)f.push(ov+' unsaved override'+(ov>1?'s':''));if(srcOf('nonrev.enabled')==='overridden')f.push('Non-revenue units turned '+(get('nonrev.enabled')==='1'?'on':'off')+' \u2014 saves with your next \u201cUpdate property profile\u201d');if(srcOf('ns8.enabled')==='overridden')f.push('Non-Section 8 units turned '+(get('ns8.enabled')==='1'?'on':'off')+' \u2014 saves with your next \u201cUpdate property profile\u201d');if(!_rcsUpload&&(hasProg('rcs')||hasProg('ocaf')))f.push((hasProg('rcs')?'The completed RCS report isn’t uploaded':'The CA’s auto-OCAF package isn’t uploaded')+' ('+secRef(1)+')');
  if(hasProg('ocaf')){if(!(ocafFactorResolved()>0))f.push('OCAF factor needed — pull or enter it ('+secRef(10)+')');if(!(ocafK()>0))f.push('Annual debt service needed for the OCAF worksheet ('+secRef(10)+')');}
  if(hasProg('uaf')){const UA=uafAnalysis();const hasF=UAF_UTILS.some(u=>numf(get('uaf.f_'+u[0]))>0);
    if(!hasF)f.push('UAF factors needed — pull or enter them ('+secRef(11)+')');
    if(!UA.any)f.push('Current UA components per unit type needed ('+secRef(11)+')');
    if(UA.mismatch.length)f.push(UA.mismatch.length+' unit type'+(UA.mismatch.length>1?'s':'')+' — UA components don’t total the current UA');
    if(UA.dec.length)f.push('UA decrease detected — tenant notice + comment certification join the package');}
  return f;}
function renderRail(){const vis=visibleSections();const st={};vis.forEach(n=>st[n]=(n===7?'ok':sectionStatus(n)));let conf=0;vis.forEach(n=>{if(st[n]!=='warn')conf++;});const need=vis.length-conf;
  el('rail').innerHTML=vis.map(n=>`<div class="railitem"><span class="ri ${st[n]==='warn'?'warn':'ok'}">${st[n]==='warn'?'!':'✓'}</span><span class="rname">${_secPos[n]||n}. ${SECTION_TITLES[n]}</span></div>`).join('');
  el('railprog').innerHTML=`<b>${conf} of ${vis.length} confirmed</b>${need?`<div class="warnt">${need} section${need===1?"":"s"} still to confirm</div>`:''}<div class="track sm"><div style="width:${conf/vis.length*100}%;background:#166534"></div></div>`;
  const fl=attnFlags();el('railattn').style.display=fl.length?'block':'none';el('railattn').innerHTML=fl.length?`⚠ <b>${fl.length} thing${fl.length===1?"":"s"} to look at</b>${fl.map(x=>`<div class="sub" style="margin-top:6px">${x}</div>`).join('')}`:'';}
function renderAttention(){/* the section rail carries the attention list; the old top banner duplicated it */}

function renderBar(){const a=analysis();const conf=UNITS.filter(uaConflict).length,unres=UNITS.filter(uaUnresolved).length;const uaOk=conf===0||unres===0;
 const bc=(st,l)=>{const ic=st==='warn'?'⚠':(st==='info'?'ⓘ':'✓');const c=st==='warn'?'#b45309':(st==='info'?'#2563eb':'#166534');return `<span class="bchip"><b style="color:${c}">${ic}</b> ${l}</span>`;};
 const chks=`${bc(hasReal('property.name')?'ok':'warn','Name')}${bc(hasReal('property.s8')?'ok':'warn','Section 8 #')}${bc(hasReal('sig.name')?'ok':'warn','Signatory')}${bc(uaOk?'ok':'warn','UA')}`;
 if(!hasProg('rcs')){
   const C=ocafCalc();let dMo=0;UNITS.forEach(i=>{const n=numf(get('units.'+i+'.num_units')),cur=numf(get('units.'+i+'.current'));if(n&&cur&&C.R>0)dMo+=n*(Math.round(cur*C.R)-cur);});
   const U=uafAnalysis();let uaMo=0;UNITS.forEach(i=>{const r=uafRow(i);if(r.curSum>0&&r.newSum>0)uaMo+=numf(get('units.'+i+'.num_units'))*(r.newSum-r.curSum);});
   const left=(hasProg('ocaf')?('<b>×'+(C.R>0?C.R.toFixed(3):'—')+'</b> effective factor · <b>'+sMoney(dMo)+'</b> rent /mo'):'')
     +(hasProg('uaf')?((hasProg('ocaf')?' · ':'')+'<b>'+sMoney(uaMo)+'</b> UA /mo'+(U.dec.length?' · <b style="color:#b45309">'+U.dec.length+' UA decrease'+(U.dec.length>1?'s':'')+'</b>':'')):'');
   const ready=hasProg('ocaf')?(C.R>0):(U.rows?U.rows.length>0:false);
   const readyTxt=hasProg('ocaf')?(C.R>0?'✓ worksheet ready':'worksheet incomplete'):((uafAnalysis().any)?'✓ UA computed':'UA components needed');
   el('ccbar').innerHTML=`<div class="bl"><div class="mn">${left}</div></div><div class="bchks">${chks}</div><div class="bpass" style="color:${ready?'#166534':'#64748b'}">${readyTxt}</div>`;
   return;
 }
 const pCur=a.ceil>0?clamp(a.cg/a.ceil*100):0,pPro=a.ceil>0?clamp(a.pg/a.ceil*100):0;
 const priced=a.priced>0,partial=priced&&a.tPr<a.tTot;
 const CG=partial?a.cgC:a.cg,PG=partial?a.pgC:a.pg,CEIL=partial?a.ceilC:a.ceil;
 const PASS=CEIL>0&&PG<CEIL,HEAD=CEIL-PG;
 const gCur=CEIL>0?clamp(CG/CEIL*100):0,gPro=CEIL>0?clamp(PG/CEIL*100):0;
 el('ccbar').innerHTML=`<div class="bl"><div class="minigauge">${gaugeSegs(priced?gCur:pCur,priced?gPro:0)}<div class="oend"></div></div><div class="mn"><b style="color:#2f7d57">${money(priced?CG:a.cg)}</b> current · <b style="color:${priced?'#47a377':'#94a3b8'}">${priced?money(PG):'—'}</b> proposed · <b>${(priced?CEIL:a.ceil)>0?money(priced?CEIL:a.ceil):'—'}</b> ceiling${priced?' · <b style="color:'+liftClr(a.pct)+'">'+sPct(a.pct)+'</b> RCS '+(a.pct===0?'change':liftWord(a.pct)):''}${partial?' · <b style="color:#b45309">'+(a.tTot-a.tPr)+' type'+(a.tTot-a.tPr===1?'':'s')+' unpriced</b>':''}</div><div class="bpass" style="color:${(a.ceil>0&&priced)?(PASS?'#166534':'#b91c1c'):'#64748b'}">${(a.ceil>0&&priced)?((PASS?'✓ PASS':'✗ OVER')+' · '+money(Math.abs(HEAD))):(a.ceil>0?'proposed rents needed':'SAFMR needed')}</div></div><div class="bchks">${chks}${bc(a.safmrMissing||a.safmrOver?'warn':(a.safmrConflict?'info':'ok'),'SAFMR')}</div>`;}
/* A "reviewed" flag exists only to silence a warning about a conflict. When the
   conflict itself goes away — a figure retyped, a source switched, a row cleared —
   the flag is meaningless, and it was the last thing on the form still differing
   from the record: the footer said "unsaved changes" with nothing on screen to
   show for it. Clear it, but only when the record does not already hold it; a
   saved flag matches the record, and un-setting one would make a form dirty the
   moment it opened. */
function syncReviewed(){const held=k=>{const c=form[k];return !!(c&&c.db_value==='1');};
  const drop=(k,live)=>{if(get(k)==='1'&&!live&&!held(k))form=store.editForm(form,k,'');};
  UNITS.forEach(i=>{drop('units.'+i+'.ua_reviewed',uaConflict(i));drop('units.'+i+'.safmr_reviewed',safmrConflictOf(i));
    drop('units.'+i+'.type_reviewed',typeConflict(i));drop('units.'+i+'.num_reviewed',numConflict(i));});}
function renderBody(){syncReviewed();const _sy=window.scrollY;const _anchorSel=(_refocusSel&&!_mouseFocus)?_refocusSel:(((Date.now()-_lastClickAt)<2000)?_lastClickSel:null);let _anchorTop=null;if(_anchorSel){try{const _ac=document.querySelector(_anchorSel);if(_ac)_anchorTop=_ac.getBoundingClientRect().top;}catch(e){}}computeSecPos();const _SR={1:renderSources,2:()=>renderFieldSection(FIELD_SECTIONS[0]),3:()=>renderFieldSection(FIELD_SECTIONS[1]),4:()=>renderFieldSection(FIELD_SECTIONS[2]),5:()=>renderFieldSection(FIELD_SECTIONS[3]),6:renderRents,7:renderPartB,8:renderChecklist,9:()=>renderFieldSection(FIELD_SECTIONS[4]),10:renderOcaf,11:renderUaf,12:renderPrincipals};el('sections').innerHTML=visibleSections().map(n=>_SR[n]()).join('');
  renderFormHeader();wireBody();renderCommand();renderBar();renderRail();renderAttention();refreshFooter();
  if(_refocusSel&&!_mouseFocus){try{const _f=document.querySelector(_refocusSel);if(_f&&_f.focus){_f.focus({preventScroll:true});if(/^(INPUT|TEXTAREA)$/.test(_f.tagName)&&typeof _f.setSelectionRange==='function'){const _L=(_f.value||'').length;try{_f.setSelectionRange(_L,_L);}catch(_e){}}}}catch(e){}}_refocusSel=null;
  if(_anchorSel&&_anchorTop!=null){try{const _a2=document.querySelector(_anchorSel);if(_a2){const _nt=_a2.getBoundingClientRect().top;window.scrollTo(0,window.scrollY+(_nt-_anchorTop));}else window.scrollTo(0,_sy);}catch(e){try{window.scrollTo(0,_sy);}catch(_z){}}}else{try{window.scrollTo(0,_sy);}catch(e){}}}
async function commitPending(){if(!_pending||!_pending.length)return;const keys=_pending;_pending=null;if(handleZeroUnitCommit(keys))return;for(const _pk of ['poc.phone','appr.phone'])if(keys.indexOf(_pk)>=0){const _d=(get(_pk)||'').replace(/\D/g,'');if(_d.length!==0&&_d.length!==10){setStatus('Enter a complete 10-digit phone before saving.');return;}}keys.forEach(k=>{const m=k.match(/^partb\.writein\.(e1|e2|e3|e4|e5|s1|s2|s3|s4|s5|s6)(\.on)?$/);if(m)clearUncheckedWriteins([m[1]]);});const _sk=[];keys.forEach(k=>{const gb=groupOf(k);(gb?ADDR_GROUPS[gb]:coupledKeys(k)).forEach(kk=>{if(_sk.indexOf(kk)<0)_sk.push(kk);});});try{form=await store.saveFields(form,_sk);}catch(e){saveFailed(e);return;}await refreshSnap();snapForm(_sk);_pendingSnap=null;clearUndoChain();_refocusSel=refocusSelForKey(keys[0]);renderBody();setStatus('Saved this field to the database.');}
/* A cell's save/revert pair sits in one of three places: inside the cell for a
   roomy one (.ovic), beside it for a plain text field (.ovnote), or below the row
   under its own column for a unit row (.uracts). Escape and Enter have to reach
   all three, or the cells whose pair happens to sit elsewhere have no keyboard
   route to save or revert at all — which was every unit row once the pair moved
   out from inside the cell. */
/* A two-part cell (bedroom / bath) shares ONE data-box, so a
   lookup from the bath resolved to the bedroom's pair: Enter saved the wrong
   sub-cell and Escape reverted it. The trigger knows its own key — take it. */
function cellActBtn(cell,sel,mode,key){if(!cell)return null;
  const m=mode?('[data-mode="'+mode+'"]'):'[data-mode]:not([data-mode=""])';
  const inIc=cell.querySelector('.ovic'+m+' '+sel);if(inIc)return inIc;
  const box=key||(cell.getAttribute&&cell.getAttribute('data-box'));if(!box)return null;
  const cands=[box];
  const own=cell.getAttribute&&cell.getAttribute('data-box'); if(own&&cands.indexOf(own)<0)cands.push(own);
  const grp=groupOf(box); if(grp&&cands.indexOf(grp)<0)cands.push(grp);
  const notes=document.querySelectorAll('.ovnote'+m);
  for(let ci=0;ci<cands.length;ci++)
    for(let i=0;i<notes.length;i++){
      const ks=(notes[i].getAttribute('data-ov')||'').split(',');
      if(ks.indexOf(cands[ci])>=0){const b=notes[i].querySelector(sel);if(b)return b;}}
  const row=cell.closest?cell.closest('.urow,.pdrow'):null;
  if(row){const list=row.querySelectorAll('.uracts .ovic'+m);
    for(let i=0;i<list.length;i++){const ks=(list[i].getAttribute('data-ovic')||'').split(',');
      if(ks.indexOf(box)>=0){const b=list[i].querySelector(sel);if(b)return b;}}}
  return null;}
function revertCellIfOver(cell,key){const b=cellActBtn(cell,'[data-rev],[data-revaddr]','over',key);if(b){b.click();return true;}return false;}
function isToggleKey(k){return /^(check\.\d+|partb\.(equipment|utilities|services)\.\d+|partb\.fuel\.\d+|partb\.writein\.[a-z0-9]+\.(on|fuel))$/.test(k);}
function fixSavedToggles(only){const ks=only&&only.length?only:Object.keys(DBSNAP||{});ks.forEach(k=>{if(isToggleKey(k)&&DBSNAP&&DBSNAP[k]){const dv=(DBSNAP[k]&&DBSNAP[k].value!=null)?DBSNAP[k].value:'';form[k]={value:dv,source:'database',saved_at:(DBSNAP[k]&&DBSNAP[k].saved_at)||null,prior_value:null,prior_source:null,db_value:dv};}});}
function snapOf(keys){const s={};keys.forEach(k=>{s[k]=form[k]?Object.assign({},form[k]):null;});return s;}
/* ── Escape walks back a RUN of edits, one cell per press ──────────────────
   _pending + _pendingSnap were a one-deep undo: the last click-driven edit and
   the snapshot it displaced. Change a dozen cells and eleven of those snapshots
   were already gone, so Escape could only ever reach the twelfth. The snapshot
   therefore moves into a stack, and the stack is what Escape walks.

   The unit is the CELL, not the keystroke. A text box pushes one entry, on the
   first character typed into it since the last push for that cell, so a press
   undoes a whole entry rather than a letter. "That cell" is fieldKeys widened
   through coupledKeys — the same grouping the save/revert pair already uses —
   so an address is one entry and a utility allowance carries its source key
   with it.

   Anything that commits ends the run: Enter, the ✓ button, Update property
   profile. Nothing may unwind past a save, so those clear the stack outright
   rather than trying to rewrite it. */
let _undoChain=[];
function undoSig(keys){return keys.slice().sort().join('|');}
function undoScope(k){const ks=[];fieldKeys(k).forEach(kk=>coupledKeys(kk).forEach(x=>{if(ks.indexOf(x)<0)ks.push(x);}));return ks;}
/* Snapshot a cell before it changes — unless the top of the stack is already
   this cell, in which case that earlier snapshot is the one Escape should get
   back to. Returns the snapshot, so _pendingSnap and the stack entry are the
   SAME object: that identity is how revertPending knows which entry its press
   just spent, and it is what keeps two clicks on one dropdown to one Escape. */
function pushUndo(keys){const sig=undoSig(keys);const top=_undoChain[_undoChain.length-1];
  if(top&&top.sig===sig)return top.snap;
  const snap=snapOf(keys);_undoChain.push({sig:sig,snap:snap,keys:keys.slice()});return snap;}
function snapPend(keys){return pushUndo(keys);}
function pushCellUndo(k){return pushUndo(undoScope(k));}
function clearUndoChain(){_undoChain=[];}
/* Reverting a cell is not another edit to walk back — it is the end of that
   cell's run. Pushing the revert made Escape RE-APPLY the value the user had
   just explicitly undone, because a cell edited twice leaves an entry holding
   the intermediate value that the revert cannot reach. So the revert forgets
   every entry that touches those keys and Escape walks on to the cell before. */
function undoForget(keys){_undoChain=_undoChain.filter(e=>!e.keys.some(k=>keys.indexOf(k)>=0));}
function undoDrop(snap){const top=_undoChain[_undoChain.length-1];if(top&&top.snap===snap)_undoChain.pop();}
/* Restoring puts the whole CELL back — provenance and all, since source,
   prior_value and db_value ride along in the snapshot. That matters most for
   the source-backed cells (utility allowance, 150% SAFMR, rents-effective
   date, OCAF factor): they are judged as a cell rather than key by key, so
   rebuilding one from its individual keys is what once left it grey instead of
   amber, and emptied it instead of putting the figure on file back. */
function restoreSnap(snap){let any=false;
  Object.keys(snap).forEach(k=>{const b=snap[k];const nv=form[k]?form[k].value:undefined;const bv=b?b.value:undefined;
    if(b)form[k]=b;else delete form[k];if(bv!==nv)any=true;});
  return any;}
function undoMsg(){const n=_undoChain.length;
  return n?('Reverted your last change. Press Escape again to walk back the '+n+' change'+(n>1?'s':'')+' before it.'):'Reverted your last change.';}
/* One press, one cell. An entry whose value never actually moved — the same
   option picked twice, or a cell already put back by its own revert button —
   is silently spent and the next one taken, so a press always shows something. */
function undoStep(){while(_undoChain.length){const e=_undoChain.pop();
    const any=restoreSnap(e.snap);
    _pending=null;_pendingSnap=null;                 // the pending edit's entry IS this one
    if(!any)continue;
    refreshIfPrereq(e.keys);_refocusSel=refocusSelForKey(e.keys[0]);renderBody();setStatus(undoMsg());return true;}
  return false;}
/* Restore a whole set of cells to what is on file. store.revertForm only knows
   how to undo an OVERRIDE, and a cell saved empty reads as "new", so a *_custom
   key the user typed into was left holding that typing after its partner had
   already reverted. The cell looked untouched while the form was still dirty —
   which is what put a "Save changes before leaving?" in front of a form nobody
   had visibly changed — and saving would have quietly persisted the stray value. */
function revertKeys(keys){undoForget(keys);let any=false;
  for(const k of keys){if(srcRevertCell(k))any=true;}      // source-backed cells revert as a cell

  keys.forEach(k=>{if(store.revertForm(form,k)){any=true;return;}
    const c=form[k];if(!c||c.db_value==null)return;
    if(String(c.value==null?'':c.value)!==String(c.db_value)){form=store.editForm(form,k,c.db_value);any=true;}});
  return any;}
function fieldKeys(k){if(k==='ca.name')return ['ca.prefix','ca.name'];const gb=groupOf(k);if(gb)return ADDR_GROUPS[gb].slice();if(k.indexOf('partb.writein.')===0&&k.indexOf('.',14)<0){const ks=[k,k+'.on'];if(k.slice(14)==='u1'||(k+'.fuel') in form)ks.push(k+'.fuel');return ks;}return [k];}
/* The reviewed flag rides with the pair. Left out, the ↺ button put the figure
   back and stranded the flag set — so the ⚠ conflict banner stayed hidden on a
   value nobody had approved, and the flag was the last thing holding the form
   dirty. Escape got this right; only the button missed it. */
/* A cell answers the same set whichever of its identities you hand it.
   The utility allowance and the 150% SAFMR each flip data-box between a
   *_source and a *_custom key depending on mode (rule 9), so the cell reached
   through the dropdown used to widen to itself alone — and the *_reviewed flag
   the pick had just set was left behind. Enter then said "Saved this field to
   the database" while the footer said "Unsaved changes", with nothing on screen
   to save. Keyed off _custom the same press saved all three. */
/* A source-backed cell is every key it shows, not only the ones you can type
   into. The allowance paints itself from whichever key holds the FIGURE —
   ua_exec when the schedule supplied it, ua_rcs when the study did — so a
   parsed figure left the cell painted unsaved with its pair hidden: no tick to
   save it, no arrow to put it back, and Enter and Escape reaching neither.
   The figure keys belong to the cell, so they are coupled to it (rule 17: the
   rule belongs to the operation, not to the button) and the pair is built from
   this list rather than a second one that could drift from it. */
function coupledKeys(k){const m=k.match(/^(units\.\d+)\.(ua|safmr)_(custom|source|reviewed)$/);
  if(m){const b=m[1]+'.'+m[2];const figs=m[2]==='ua'?[b+'_exec',b+'_rcs']:[b+'_rcs',b+'_hud'];
    return [k].concat([b+'_custom',b+'_source',b+'_reviewed'].concat(figs).filter(x=>x!==k));}
  /* The date the schedule wrote is the third cell of the source-backed shape,
     after the utility allowance and the 150% ceiling: the figure lives in
     date_eff_rs while the pair was keyed to custom+source alone. A parsed date
     therefore painted itself green, correctly, and offered nothing to press —
     and the cell went further and rendered the pair ONLY when the date had been
     typed by hand, so the one state that always has something to save was the
     one state with no button. */
  if(/^rent_schedule\.date_eff_(custom|source|rs)$/.test(k))
    return [k].concat(['rent_schedule.date_eff_custom','rent_schedule.date_eff_source','rent_schedule.date_eff_rs'].filter(x=>x!==k));
  const OCAF_F=['ocaf.factor_custom','ocaf.factor_src','ocaf.factor_pub','ocaf.factor_fy','ocaf.factor_pubdate','ocaf.factor_state'];
  if(OCAF_F.indexOf(k)>=0)return [k].concat(OCAF_F.filter(x=>x!==k));
  /* Each utility factor has its own cell and its own pair; the fiscal year, the
     state and the publication date that came down with them have none. They ride
     with whichever factor is saved — the provenance of a figure is part of it. */
  if(/^uaf\.f_(oil|gas|electric|water)$/.test(k))
    return [k,'uaf.factor_fy','uaf.factor_state','uaf.factor_pubdate'];
  return [k];}
function keysCanRevert(keys){return keys.some(k=>srcOf(k)==='overridden');}
function keysNewDirty(keys){return !keysCanRevert(keys)&&keys.some(k=>(srcOf(k)==='new'||srcOf(k)==='this-cycle')&&String(get(k)==null?'':get(k)).trim()!=='');} // a parsed cell is unsaved too, so Enter and the tick must both reach it
function keysCanSave(keys){return keysCanRevert(keys)||keysNewDirty(keys);}
function refocusSelForKey(k){if(/^(check\.\d+|partb\.(equipment|utilities|services)\.\d+)$/.test(k))return '[data-cb="'+k+'"]';const w=k.match(/^(partb\.writein\.[a-z0-9]+)\.on$/);if(w)return '[data-wibox="'+w[1]+'"]';const gb=groupOf(k);if(gb)return '[data-box="'+gb+'"] input,[data-box="'+gb+'"] .uatrigger';/* Name the whole cell, not one of its spellings. The allowance and the SAFMR
     flip data-box between *_source and *_custom with the mode (rule 9), and
     saving can change that mode — so a selector built from the key we started
     with pointed at a box that had just stopped existing, and the caret fell to
     <body>. coupledKeys knows both names; ask it. */
  if(k.indexOf('tenant.mgmt')===0)return '[data-box="tenant.mgmt_address"] .uatrigger,[data-box="tenant.mgmt_address"] input,[data-box="tenant.mgmt"] input,[data-k="'+k+'"]';
  return coupledKeys(k).map(function(x){return '[data-trigfor="'+x+'"],[data-box="'+x+'"] .uatrigger,[data-k="'+x+'"],[data-fuel="'+x+'"],[data-fuel3="'+x+'"],[data-wibox="'+x+'"],[data-cb="'+x+'"]';}).join(',');}
function revertPending(){if(!_pending||!_pending.length)return false;const keys=_pending;const snap=_pendingSnap;_pending=null;_pendingSnap=null;let any=false;if(snap){any=restoreSnap(snap);undoDrop(snap);}else{keys.forEach(k=>{const gb=groupOf(k);if(revertKeys(gb?ADDR_GROUPS[gb]:coupledKeys(k)))any=true;});}if(any){refreshIfPrereq(keys);_refocusSel=refocusSelForKey(keys[0]);renderBody();}setStatus(undoMsg());return true;}
function aggSrc(keys){if(keys.some(k=>srcOf(k)==='overridden'))return'overridden';if(keys.some(k=>srcOf(k)==='database'))return'database';if(keys.some(k=>srcOf(k)==='this-cycle'))return'this-cycle';return'new';}
function groupOf(k){for(const b in ADDR_GROUPS){if(ADDR_GROUPS[b].indexOf(k)>=0)return b;}return null;}
function partHot(k){const s=srcOf(k);return s==='overridden'||(s==='new'&&get(k)!==''&&get(k)!=null);}
function baseSrc(keys){const cold=keys.filter(k=>!partHot(k));return aggSrc(cold.length?cold:keys);}
function groupColors(keys){const a=baseSrc(keys);   // provColors over a group of cells
  return provColors(a,keys.filter(k=>form[k]&&form[k].db_value==='')[0]);}
/* An address is one box over several cells. When every part holds a value the box
   carries the color, which is the common case and stays clean. When only some do,
   the box goes neutral and the color moves onto the parts that actually hold
   something — so an empty street never reads as "on file", and the divider gaps and
   the group's source picker, which belong to no single part, are never tinted. */
function addrFilled(keys){return keys.every(k=>get(k)!==''&&get(k)!=null&&!partHot(k));}
function addrBody(keys,c){return addrFilled(keys)?c[1]:CLR.new[1];}
function partTint(k,keys,c){ // one style for every part, input or dropdown (non-address groups: uniform radius, no neighbor merge)
  if(partHot(k))return tintStyle(k);
  if(keys&&!addrFilled(keys)&&get(k)!==''&&get(k)!=null&&c&&c[1]!==CLR.new[1])return 'background:'+c[1]+';border-radius:6px';
  return '';}
function tintStyle(k){const c=cellColors(k);return 'background:linear-gradient('+c[0]+','+c[0]+') no-repeat left 4px center/3px 60%,'+c[1]+';border-radius:6px';} // inset bar, not an inset shadow: shadows bend around the pill radius into a "(" crescent
function applyTint(inp,k,keys,c){const t=partTint(k,keys,c);
  if(t){inp.style.cssText+=';'+t;}
  else{inp.style.background='transparent';}inp.style.boxShadow='none';} // live-paint twin of tintStyle — keep the two in lockstep
/* Address groups (4 parts in a row) get their own tint model: a part's fill is null
   (box background shows through) unless it's individually hot or individually filled
   while the group as a whole isn't. Adjacent parts sharing the same fill merge —
   the shared edge loses its radius and the divider between them adopts the fill —
   so two "on file" parts in a row read as one continuous bar, not a string of pills. */
function tintFill(k,keys,c){if(partHot(k))return cellColors(k)[1];
  if(keys&&!addrFilled(keys)&&get(k)!==''&&get(k)!=null&&c&&c[1]!==CLR.new[1])return c[1];
  return null;}
function addrParts(keys,c){const STATE_I=2; // the state dropdown carries its own hard border (border-right in CSS) — never round a corner toward it
  return keys.map((k,i)=>{const fill=tintFill(k,keys,c);if(!fill)return null;
  return {fill,bar:partHot(k)?cellColors(k)[0]:null,
    leftJoin:(i>0&&tintFill(keys[i-1],keys,c)===fill)||i===STATE_I||i-1===STATE_I,
    rightJoin:(i<keys.length-1&&tintFill(keys[i+1],keys,c)===fill)||i===STATE_I||i+1===STATE_I};});}
function addrPartStyle(p){if(!p)return '';const L=p.leftJoin?'0':'6px',R=p.rightJoin?'0':'6px';
  const bg=p.bar?('linear-gradient('+p.bar+','+p.bar+') no-repeat left 4px center/3px 60%,'+p.fill):p.fill;
  return 'background:'+bg+';border-radius:'+L+' '+R+' '+R+' '+L;}
function addrDivStyle(pL,pR){return (pL&&pR&&pL.fill===pR.fill)?('background:'+pL.fill):'';}
function paintAddrPart(elm,p){if(p){elm.style.cssText+=';'+addrPartStyle(p);}
  else{elm.style.background='transparent';elm.style.borderRadius='';}elm.style.boxShadow='none';}
function paintGroup(b){const keys=ADDR_GROUPS[b];const c=groupColors(keys);const parts=addrParts(keys,c);const box=document.querySelector('[data-box="'+b+'"]');
  if(box){box.style.background=addrBody(keys,c);box.style.borderLeftColor=c[0];
    keys.forEach((k,i)=>{const el=box.querySelector('input[data-k="'+k+'"],[data-trigfor="'+k+'"]');if(el)paintAddrPart(el,parts[i]);
      const dEl=box.querySelector('[data-adiv="'+i+'"]');if(dEl)dEl.style.background=addrDivStyle(parts[i],parts[i+1]);});}
  const ov=document.querySelector('[data-ov="'+b+'"]');if(ov){const m=modeOf(keys);ov.setAttribute('data-mode',m);ov.style.display=m?'flex':'none';}}
function paintCaName(){const keys=['ca.prefix','ca.name'];const c=groupColors(keys);const box=document.querySelector('[data-box="ca.name"]');
  if(box){box.style.background=c[1];box.style.borderLeftColor=c[0];const inp=box.querySelector('input[data-k="ca.name"]');
    if(inp)applyTint(inp,'ca.name');}
  const ov=document.querySelector('.ovnote[data-ov="ca.prefix,ca.name"]');if(ov){const m=modeOf(keys);ov.setAttribute('data-mode',m);ov.style.display=m?'flex':'none';}}
function paintCell(k){const gb=groupOf(k);if(gb)return paintGroup(gb);if(k==='ca.name'||k==='ca.prefix')return paintCaName();const s=form[k];if(!s)return;
  /* A *_custom cell is half of a pair, and the SOURCE key is the one that knows an
     on-file value was displaced. Painting from this key alone turned an emptied
     override gray — disagreeing with the badge sitting in the same cell, which has
     always read the pair. That is why the first keystroke came out orange (a full
     re-render, through uaBox) and the second gray (a repaint, through here). */
  const _ck=coupledKeys(k);
  // modeOf, not srcOf: a source key saved BLANK reads as "new" even once it has
  // been changed, so testing for 'overridden' left an emptied override gray while
  // the badge beside it correctly said otherwise.
  /* And for a source-backed cell ask srcCellState, the same question the full
     render asks. Without this the repaint still judged the cell by this key's own
     history: typing your way back to the figure on file left the cell grey until
     something else forced a full re-render. */
  const _cs=srcCellState(k);
  const _sr=_cs?(_cs==='overridden'?'overridden':(_cs==='database'?'database':'new'))
    :(_ck.length>1&&modeOf(_ck)==='over')?'overridden'
    :(offFile(k)&&s.source!=='overridden')?'overridden'
    :((k==='rent_schedule.date_rents_effective'&&s.source==='database')?'this-cycle':s.source);
  // The blue "on file" edge belongs to a cell saved empty and STILL empty. Without
  // the value test it painted blue over whatever was being typed into it.
  const c=CLR[_sr]||CLR.new;const _bl=(_sr==='new'&&s.db_value===''&&String(s.value==null?'':s.value)==='')?CLR.database[0]:c[0];const box=document.querySelector('[data-box="'+k+'"]');if(box){box.style.background=c[1];box.style.borderLeftColor=_bl;}
  // A write-in's color lives on its tick, which is keyed data-wibox rather than
  // data-box, so this repaint used to skip it entirely and the cell only changed
  // color on a full re-render.
  const _wm=k.match(/^(partb\.writein\.[a-z0-9]+)(?:\.on|\.fuel)?$/);
  if(_wm){const wb=document.querySelector('[data-wibox="'+_wm[1]+'"]');
    if(wb){const wks=[_wm[1],_wm[1]+'.on'];if(form[_wm[1]+'.fuel'])wks.push(_wm[1]+'.fuel');
      const wc=groupColors(wks);wb.style.color=wc[0];wb.style.borderColor=wc[0];wb.style.background=wc[1];}
    // and the tint on the text itself: a group box keeps its base color and marks
    // the changed part, so without this a rewritten write-in showed no change at all
    const wt=document.querySelector('input.witext[data-k="'+_wm[1]+'"]');
    if(wt)wt.setAttribute('style',partHot(_wm[1])?tintStyle(_wm[1]):'');}const ov=document.querySelector('[data-ov="'+k+'"]');if(ov){const m=modeOf(k);ov.setAttribute('data-mode',m);ov.style.display=m?'flex':'none';}document.querySelectorAll('[data-ovic]').forEach(o=>{const ks=o.getAttribute('data-ovic').split(',');if(ks.indexOf(k)>=0){const m=modeOf(ks);o.setAttribute('data-mode',m);o.style.display=m?'inline-flex':'none';}});}
function clearUncheckedWriteins(ids){ids.forEach(id=>{if(get('partb.writein.'+id)&&get('partb.writein.'+id+'.on')!=='1'){form=store.editForm(form,'partb.writein.'+id,'');form=store.editForm(form,'partb.writein.'+id+'.on','');}});}
function wireArrowNav(){document.querySelectorAll('.fbox:not(.uacell),.rbox:not(.uacell)').forEach(cell=>{const items=[...cell.querySelectorAll('input[data-k],.uatrigger')];if(items.length<2)return;items.forEach((it,idx)=>{it.addEventListener('keydown',e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;const isInput=/^(INPUT|TEXTAREA)$/.test(it.tagName);if(isInput){const v=(it.value||'');const at0=it.selectionStart===0&&it.selectionEnd===0;const atE=it.selectionStart===v.length&&it.selectionEnd===v.length;if(e.key==='ArrowLeft'&&!at0)return;if(e.key==='ArrowRight'&&!atE)return;}else{const dd=it.closest('.uadrop');if(dd&&dd.classList.contains('open'))dd.classList.remove('open');}const ni=e.key==='ArrowRight'?items[idx+1]:items[idx-1];if(!ni)return;e.preventDefault();ni.focus({preventScroll:true});if(/^(INPUT|TEXTAREA)$/.test(ni.tagName)){try{const L=(ni.value||'').length;const pos=e.key==='ArrowRight'?0:L;ni.setSelectionRange(pos,pos);}catch(_e){}}});});});}
/* Typing into a cell that sits beside a source dropdown (utility allowance,
   150% SAFMR, rents-effective date, OCAF factor) used to pin it to "custom" on
   the first keystroke and leave it pinned. Press space and delete it again and
   the visible figure was identical while ua_source AND ua_custom had both moved
   — the form was dirty with nothing on screen to show for it, and leaving asked
   to save. Worse, the rule has to be keyed off the FIELD, not the widget: the
   moment a cell flips to custom it re-renders as a plain _custom input, so a fix
   living only in the source-edit widget never sees you type your way back.

   srcSpec is the single place that knows a custom key's partner source key and
   how to read the figure each non-custom source holds. */
function srcSpec(k){
  let m=k.match(/^units\.(\d+)\.ua_custom$/);
  if(m)return{srcKey:'units.'+m[1]+'.ua_source',cusKey:k,fallback:defUaSrc(m[1]),names:['exec','rcs'],
    resolve:ss=>cleanNum(get('units.'+m[1]+'.ua_'+(ss==='rcs'?'rcs':'exec')))};
  m=k.match(/^units\.(\d+)\.safmr_custom$/);
  if(m)return{srcKey:'units.'+m[1]+'.safmr_source',cusKey:k,fallback:defSafmrSrc(m[1]),names:['hud','rcs'],
    resolve:ss=>cleanNum(get('units.'+m[1]+'.safmr_'+(ss==='rcs'?'rcs':'hud')))};
  if(k==='rent_schedule.date_eff_custom')return{srcKey:'rent_schedule.date_eff_source',cusKey:k,
    fallback:'rs',names:['rs'],resolve:()=>fmtDate(get('rent_schedule.date_eff_rs'))};
  if(k==='ocaf.factor_custom')return{srcKey:'ocaf.factor_src',cusKey:k,names:['fr'],
    fallback:(get('ocaf.factor_pub')?'fr':'custom'),resolve:ss=>ss==='fr'?String(get('ocaf.factor_pub')||''):''};
  return null;
}
/* Writes a source-backed cell. Returns false if k isn't one, so callers fall
   through to a plain edit. Matching what is on file restores the on-file source
   rather than staying pinned to custom. */
/* A figure is only "custom" when it differs from every source we hold. Type
   $1,146 while HUD publishes $1,146 and the cell is a HUD cell — there is no
   sense in which that is a hand-entered figure, and storing it as one is what
   dropped the badge, drifted the pointer away from the record, and produced a
   save/revert pair that could not change anything on screen. Prefer the source
   already selected, then the one on file, then the natural order. */
function srcMatchName(sp,val){
  if(val==='')return '';
  const seen=[],order=[];
  [get(sp.srcKey)||sp.fallback, srcOnFileSrc(sp).name].concat(sp.names||[]).forEach(n=>{
    if(n&&n!=='custom'&&seen.indexOf(n)<0){seen.push(n);order.push(n);}});
  for(const n of order){if(String(sp.resolve(n)||'')===String(val))return n;}
  return '';}
/* Picking a source from the dropdown goes through the same rule: choosing the
   one already on file writes what the record holds — usually blank — rather than
   the literal name, so it does not register as a change. */
function srcSetSource(cusKey,chosen){
  const sp=srcSpec(cusKey); if(!sp)return false;
  const o=srcOnFileSrc(sp);
  form=store.editForm(form,sp.srcKey,chosen===o.name?o.write:chosen);
  if(chosen!=='custom')form=store.editForm(form,sp.cusKey,'');
  return true;}
function srcEditKey(k,val){
  const sp=srcSpec(k); if(!sp)return false;
  const o=srcOnFileSrc(sp);const onSrc=o.name;
  const cu=form[sp.cusKey];const onCus=String((cu&&cu.db_value)||'');
  const onVal=onSrc==='custom'?onCus:String(sp.resolve(onSrc)||'');
  const match=srcMatchName(sp,String(val));
  if(onVal!==''&&String(val)===onVal){
    form=store.editForm(form,sp.srcKey,o.write);
    form=store.editForm(form,sp.cusKey,onSrc==='custom'?onCus:'');
  }else if(match){                       // equals a source we hold — that IS its source
    form=store.editForm(form,sp.srcKey,match===o.name?o.write:match);
    form=store.editForm(form,sp.cusKey,'');
  }else{
    form=store.editForm(form,sp.srcKey,'custom');
    form=store.editForm(form,sp.cusKey,val);
  }
  return true;
}
function wireBody(){
  document.querySelectorAll('input[data-k]').forEach(inp=>{const k=inp.getAttribute('data-k'),wion=inp.getAttribute('data-wion');
    inp.addEventListener('input',()=>{pushCellUndo(k);let v=inp.value;if(inp.getAttribute('data-phone')){v=fmtPhoneInput(v);inp.value=v;}else if(inp.getAttribute('data-money')){v=cleanNum(v);inp.value=fmtMoney(v);}else if(inp.getAttribute('data-date')){
      /* Keep the caret where the reader left it. The mask lays the digits out
         again from scratch, which moves every character after the one just
         typed — so without this a correction to the month left the caret in the
         year, and the next keystroke landed there. Counted in DIGITS, not
         characters, because the slashes move too. */
      const _before=String(inp.value).slice(0,inp.selectionStart||0).replace(/\D/g,'').length;
      v=fmtDateInput(v);inp.value=v;
      let _n=0,_i=0;for(;_i<v.length&&_n<_before;_i++)if(/\d/.test(v[_i]))_n++;
      try{inp.setSelectionRange(_i,_i);}catch(e){}
    }const _spb=srcSpec(k),_srcWas=_spb?String(get(_spb.srcKey)||''):null;
      if(!srcEditKey(k,v))form=store.editForm(form,k,v);
      if(_spb&&String(get(_spb.srcKey)||'')!==_srcWas){
        const _now=get(_spb.srcKey)||_spb.fallback;
        _refocusSel=_now==='custom'?('[data-k="'+_spb.cusKey+'"]')
          :('[data-box="'+_spb.srcKey+'"] .srcedit');
        renderBody();return;}
      if(k==='property.name'&&el('hdrProp'))el('hdrProp').textContent=(v||'(unnamed property)');if(k==='property.addr_zip')scheduleHudRefresh();
      if(wion){const on=v.length>0;form=store.editForm(form,wion,on?'1':'');const cbEl=inp.closest('.cb');if(cbEl){cbEl.classList.remove('empty','unchecked','checked');cbEl.classList.add(!v?'empty':(on?'checked':'unchecked'));const bx=cbEl.querySelector('.box');if(bx){bx.textContent=on?'✓':'';bx.style.color=provColor(wion);}}}else if(inp.getAttribute('data-util')){if(v===''){form=store.editForm(form,k+'.on','');form=store.editForm(form,k+'.fuel','');}const cbEl=inp.closest('.cb');const stillOn=v!==''&&get(k+'.on')==='1';if(cbEl){cbEl.classList.remove('empty','unchecked','checked');cbEl.classList.add(!v?'empty':(stillOn?'checked':'unchecked'));const bx=cbEl.querySelector('.box');if(bx){bx.textContent=stillOn?'✓':'';bx.style.color=provColor(k+'.on');}const f3=cbEl.querySelector('[data-fuel3]');if(f3){const fk=k+'.fuel',fv=get(fk),fhas=fv!==''&&fv!=null,fc=CLR[fhas?srcOf(fk):'new']||CLR.new;f3.textContent=fhas?fv:'-';f3.style.color=fc[0];f3.style.borderColor=fc[0];f3.style.background=fc[1];}}}
      paintCell(k);refreshFlags();refreshFooter();if(/^principals\.\d+\.(name|title)$/.test(k))refreshPrincipalOpts();if(/^units\.|^nonrev\./.test(k)){renderCommand();renderBar();const mm=k.match(/^units\.(\d+)\.(current|proposed)$/);if(mm){const ui=mm[1],me=document.querySelector('[data-metric="'+ui+'"]');if(me){const cc=numf(get('units.'+ui+'.current')),pp=numf(get('units.'+ui+'.proposed'));if(cc>0&&pp>0){me.textContent=sMoney(pp-cc)+' · '+sPct(Math.round((pp-cc)/cc*100));me.style.color=(pp-cc)>=0?'#166534':'#b91c1c';}else me.textContent='';}}}refreshOcafLines(k);refreshUafLines(k);if(/^property\.addr_|^rent_schedule\.date_eff/.test(k)){scheduleHudRefresh();scheduleFactorRefresh();}setStatus('Editing — on-file changes show Overridden until you Update or Revert.');});inp.addEventListener('keydown',async e=>{if(e.key!=='Enter'&&e.key!=='Escape')return;const _keys=fieldKeys(k);if(_pending&&_pending.length&&_pending.indexOf(k)>=0){e.preventDefault();e.stopPropagation();if(e.key==='Escape')revertPending();else commitPending();return;}if(e.key==='Escape'){
      /* Expand to the coupled pair before deciding. Typing in a UA / SAFMR / date
         cell writes a *_custom key that has never held anything, so judged on that
         key alone there is nothing to revert — and Escape fell through to "clear
         your unsaved entry", wiping the custom value while leaving the source on
         Custom. The cell then showed an empty Custom field, and only a SECOND
         Escape (reaching the document handler, which does read the pair) put the
         saved value back. */
      if(_undoChain.length&&undoStep()){e.preventDefault();e.stopPropagation();return;}
      const _rk=[];_keys.forEach(kk=>coupledKeys(kk).forEach(x=>{if(_rk.indexOf(x)<0)_rk.push(x);}));
      /* Restore the whole set, not just the parts that count as overrides. Gating
         on keysCanRevert meant that when the _source partner had been saved blank
         — which after one "Update property profile" is every untouched key — the
         edit fell through to "clear your unsaved entry", which wiped the custom
         value and left the source on Custom. The cell showed empty, and the
         allowance it had been displaying resolved to 0 for the 150% test and for
         every generated document. */
      if(revertKeys(_rk)){e.preventDefault();e.stopPropagation();refreshIfPrereq(_rk);_refocusSel='[data-k="'+k+'"]';renderBody();setStatus(String(get(k)==null?'':get(k)).trim()!==''?'Reverted your change to the on-file value.':'Cleared your unsaved entry.');}else if(srcOf(k)==='new'&&(inp.value||'')!==''){e.preventDefault();e.stopPropagation();const _clr=groupOf(k)?[k]:_keys;_clr.forEach(kk=>store.editForm(form,kk,''));_refocusSel='[data-k="'+k+'"]';renderBody();setStatus('Cleared your unsaved entry.');}return;}e.preventDefault();if(_keys.length===1&&/^principals\.\d+\./.test(_keys[0])){const pi=+_keys[0].match(/^principals\.(\d+)\./)[1];if(!principalHasData(pi)){if(PRINCIPALS.length>1){Object.keys(form).forEach(kk=>{if(kk.indexOf('principals.'+pi+'.')===0)delete form[kk];});PRINCIPALS=PRINCIPALS.filter(x=>x!==pi);renderBody();setStatus('Empty principal row removed.');}return;}}if(handleZeroUnitCommit(_keys))return;if(k==='poc.phone'||k==='appr.phone'){const _d=(inp.value||'').replace(/[^0-9]/g,'');if(_d.length!==0&&_d.length!==10){setStatus('Enter a complete 10-digit phone before saving.');return;}}if(!keysCanSave(_keys))return;_keys.forEach(kk=>{if(kk.indexOf('partb.writein.')===0&&kk.indexOf('.',14)<0&&kk.slice(14)!=='u1')clearUncheckedWriteins([kk.slice(14)]);});const _sk=[];_keys.forEach(kk=>coupledKeys(kk).forEach(x=>{if(_sk.indexOf(x)<0)_sk.push(x);}));if(groupOf(k)==='tenant.mgmt'&&_sk.indexOf('tenant.mgmt_source')<0)_sk.push('tenant.mgmt_source');try{form=await store.saveFields(form,_sk);}catch(e){saveFailed(e);return;}await refreshSnap();snapForm(_sk);clearUndoChain();_pending=null;_pendingSnap=null;_refocusSel='[data-k="'+k+'"]';renderBody();setStatus('Saved this field to the database.');});if(wion)inp.addEventListener('focus',()=>{if(inp.value&&get(wion)!=='1'){form=store.editForm(form,wion,'1');const cb=inp.closest('.cb');if(cb){cb.classList.remove('unchecked','empty');cb.classList.add('checked');const bx=cb.querySelector('.box');if(bx)bx.textContent='✓';}}});});
  document.querySelectorAll('select[data-k]').forEach(sel=>{const k=sel.getAttribute('data-k');sel.addEventListener('change',()=>{pushCellUndo(k);form=store.editForm(form,k,sel.value);paintCell(k);renderRail();renderAttention();});});
  document.querySelectorAll('input[data-cb]').forEach(c=>{const k=c.getAttribute('data-cb');c.addEventListener('change',()=>{_pendingSnap=snapPend([k]);form=store.editForm(form,k,c.checked?'1':'');_pending=[k];_refocusSel='[data-cb="'+k+'"]';renderBody();});});
  document.querySelectorAll('[data-fuel]').forEach(fl=>fl.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const k=fl.getAttribute('data-fuel');const cur=(form[k]&&form[k].value)||'';const nx=cur===''?'E':(cur==='E'?'F':(cur==='F'?'G':''));_pendingSnap=snapPend([k]);form=store.editForm(form,k,nx);_pending=[k];_refocusSel='[data-fuel="'+k+'"]';renderBody();}));
  document.querySelectorAll('[data-fuel3]').forEach(fl=>fl.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const k=fl.getAttribute('data-fuel3');const base=k.slice(0,k.lastIndexOf('.fuel'));if(!get(base))return;const cur=(form[k]&&form[k].value)||'';const nx=cur===''?'E':(cur==='E'?'F':(cur==='F'?'G':''));_pendingSnap=snapPend([k]);form=store.editForm(form,k,nx);_pending=[k];_refocusSel='[data-fuel3="'+k+'"]';renderBody();}));
  document.querySelectorAll('[data-wibox]').forEach(bx=>bx.addEventListener('click',e=>{e.preventDefault();const base=bx.getAttribute('data-wibox');if(!get(base))return;const on=get(base+'.on')==='1';_pendingSnap=snapPend([base+'.on']);form=store.editForm(form,base+'.on',on?'':'1');_pending=[base+'.on'];_refocusSel='[data-wibox="'+base+'"]';renderBody();}));
  document.querySelectorAll('button[data-rev]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const _ks=b.getAttribute('data-rev').split(',');const _rv=[];_ks.forEach(k=>coupledKeys(k).forEach(x=>{if(_rv.indexOf(x)<0)_rv.push(x);}));revertKeys(_rv);refreshIfPrereq(_ks);renderBody();setStatus('Reverted to the on-file value.');}));
  document.querySelectorAll('button[data-revaddr]').forEach(b=>b.addEventListener('click',()=>{const _box=b.getAttribute('data-revaddr');const g=addrKeys(_box);revertKeys(g);refreshIfPrereq(g);renderBody();setStatus('Address reverted.');}));
  document.querySelectorAll('button[data-save1]').forEach(b=>b.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();const keys=[];b.getAttribute('data-save1').split(',').forEach(_k=>coupledKeys(_k).forEach(x=>{if(keys.indexOf(x)<0)keys.push(x);}));if(handleZeroUnitCommit(keys))return;for(const _pk of ['poc.phone','appr.phone'])if(keys.indexOf(_pk)>=0){const _d=(get(_pk)||'').replace(/\D/g,'');if(_d.length!==0&&_d.length!==10){setStatus('Enter a complete 10-digit phone before saving.');return;}}keys.forEach(k=>{const m=k.match(/^partb\.writein\.(e1|e2|e3|e4|e5|s1|s2|s3|s4|s5|s6)(\.on)?$/);if(m)clearUncheckedWriteins([m[1]]);});try{form=await store.saveFields(form,keys);}catch(e){saveFailed(e);return;}await refreshSnap();fixSavedToggles(keys);snapForm(keys);clearUndoChain();_pending=null;_pendingSnap=null;
    /* Put the caret back where it was. commitPending has always done this; the
       button never did, and Enter on a fuel chip, a write-in tick or a dropdown
       routes THROUGH the button (cellActBtn -> click). So the save landed and
       focus fell to <body>: no second Enter, no Escape, no Tab from where you
       were — the same dead end that made Enter unreachable in the first place. */
    _refocusSel=refocusSelForKey(keys[0]);renderBody();setStatus('Saved just that field to the database.');}));
  document.querySelectorAll('button[data-save1addr]').forEach(b=>b.addEventListener('click',async()=>{const _box=b.getAttribute('data-save1addr');const ks=addrKeys(_box);try{form=await store.saveFields(form,ks);}catch(e){saveFailed(e);return;}await refreshSnap();snapForm(ks);clearUndoChain();_pending=null;_pendingSnap=null;renderBody();setStatus('Saved the address to the database.');}));
  document.querySelectorAll('.uatrigger').forEach(t=>{const d=t.closest('.uadrop');if(!d)return;
    const tog=()=>{const open=d.classList.contains('open');document.querySelectorAll('.uadrop.open').forEach(x=>x.classList.remove('open'));if(!open)d.classList.add('open');};
    const openIt=()=>{document.querySelectorAll('.uadrop.open').forEach(x=>x.classList.remove('open'));d.classList.add('open');};
    // a dim source row offers nothing to choose, so arrowing onto it is a dead stop
    const opts=()=>[...d.querySelectorAll('.uaopt')].filter(o=>!o.classList.contains('srcdim'));
    const setHl=idx=>{const o=opts();o.forEach(x=>x.classList.remove('hl'));if(o[idx]){o[idx].classList.add('hl');o[idx].scrollIntoView({block:'nearest'});}};
    t.addEventListener('click',e=>{e.stopPropagation();tog();});
    t.addEventListener('focus',()=>{});
    t.addEventListener('keydown',e=>{if(e.target!==t)return;const o=opts();
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!d.classList.contains('open'))openIt();let hi=o.findIndex(x=>x.classList.contains('hl'));hi=e.key==='ArrowDown'?(hi+1>=o.length?0:hi+1):(hi<=0?o.length-1:hi-1);setHl(hi);return;}
      if(e.key==='Enter'){e.preventDefault();e.stopPropagation();const hl=d.querySelector('.uaopt.hl');if(d.classList.contains('open')&&hl){hl.click();}else if(d.classList.contains('open')){d.classList.remove('open');}else if(_pending&&_pending.length){commitPending();}else{const _sv=cellActBtn(d.closest('[data-box]'),'[data-save1],[data-save1addr]',null,t.getAttribute('data-trigfor'));if(_sv)_sv.click();else tog();}return;}
      if((e.key==='Backspace'||e.key==='Delete')&&d.classList.contains('cs')){e.preventDefault();const _co=d.querySelector('.uaopt[data-cskey]');const _ck=t.getAttribute('data-trigfor')||(_co&&_co.getAttribute('data-cskey'))||null;if(_ck){_pendingSnap=snapPend([_ck]);form=store.editForm(form,_ck,'');_pending=[_ck];_refocusSel='[data-trigfor="'+_ck+'"]';renderBody();}return;}if(e.key==='Escape'){if(d.classList.contains('open')){e.preventDefault();e.stopPropagation();d.classList.remove('open');}return;}if(e.key==='Tab'){d.classList.remove('open');return;}
      if(/^[a-zA-Z0-9]$/.test(e.key)){e.preventDefault();if(!d.classList.contains('open'))openIt();d._buf=((d._buf||'')+e.key).toUpperCase();clearTimeout(d._bufT);d._bufT=setTimeout(()=>{d._buf='';},800);let idx=o.findIndex(x=>x.textContent.trim().toUpperCase().startsWith(d._buf));if(idx<0&&d._buf.length>1){d._buf=e.key.toUpperCase();idx=o.findIndex(x=>x.textContent.trim().toUpperCase().startsWith(d._buf));}setHl(idx);return;}
    });});
  document.querySelectorAll('.uaopt').forEach(o=>o.addEventListener('click',e=>{e.stopPropagation();const i=o.getAttribute('data-uai');if(i===null)return;const v=o.getAttribute('data-uaopt');_pendingSnap=snapPend(['units.'+i+'.ua_source','units.'+i+'.ua_custom','units.'+i+'.ua_reviewed']);srcSetSource('units.'+i+'.ua_custom',v);if(uaConflict(i))form=store.editForm(form,'units.'+i+'.ua_reviewed','1');_pending=['units.'+i+'.ua_source'];_refocusSel='[data-box="units.'+i+'.ua_source"] .uatrigger';renderBody();setStatus('UA source set — conflict resolved.');}));document.querySelectorAll('[data-mgmt]').forEach(o=>o.addEventListener('click',e=>{e.stopPropagation();_pendingSnap=snapPend(['tenant.mgmt_source']);form=store.editForm(form,'tenant.mgmt_source',o.getAttribute('data-mgmt'));_pending=['tenant.mgmt_source'];_refocusSel='[data-box="tenant.mgmt_address"] .uatrigger';renderBody();}));document.querySelectorAll('[data-csopt]').forEach(o=>o.addEventListener('click',e=>{e.stopPropagation();const _ck=o.getAttribute('data-cskey');const _cb=o.closest('[data-box]');const _cv=o.getAttribute('data-csopt');
    const _cks=[_ck];
    if(_ck==='owner.entity_type'&&_cv!=='Other (specify)'&&String(get('owner.entity_type_other')||'')!=='')_cks.push('owner.entity_type_other');
    _pendingSnap=snapPend(_cks);form=store.editForm(form,_ck,_cv);
    if(_cks.length>1)form=store.editForm(form,'owner.entity_type_other','');   // snapshotted together, so Escape brings the pair back
    _pending=_cks;_refocusSel='[data-trigfor="'+_ck+'"]';renderBody();if(/\.br$/.test(_ck))scheduleHudRefresh();if(_ck==='property.addr_state'){scheduleHudRefresh();scheduleFactorRefresh();}}));document.querySelectorAll('[data-utgrp]').forEach(o=>o.addEventListener('click',e=>{e.stopPropagation();
    const i=o.getAttribute('data-utgrp');const t=rsUnit(i,'type');if(t==null)return;
    const bb=rsParseUnitType(t);const ks=['units.'+i+'.br','units.'+i+'.ba','units.'+i+'.label'];
    _pendingSnap=snapPend(ks);
    form=store.editForm(form,ks[0],bb.br||'');form=store.editForm(form,ks[1],bb.ba||'');form=store.editForm(form,ks[2],bb.label||'');
    ks.forEach(k=>{if(form[k])form[k].fromParse=true;});
    _pending=ks;_refocusSel='[data-box="units.'+i+'.br"] .utgrp .uatrigger';renderBody();scheduleHudRefresh();
    setStatus('Unit type taken from the executed rent schedule.');}));
  document.querySelectorAll('[data-csclear]').forEach(x=>x.addEventListener('click',e=>{e.stopPropagation();e.preventDefault();const _cc=x.getAttribute('data-csclear');_pendingSnap=snapPend([_cc]);form=store.editForm(form,_cc,'');_pending=[_cc];_refocusSel='[data-trigfor="'+_cc+'"]';renderBody();setStatus('Cleared to blank.');}));document.querySelectorAll('[data-uaok]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const _rk='units.'+b.getAttribute('data-uaok')+'.ua_reviewed';_pendingSnap=pushCellUndo(_rk);form=store.editForm(form,_rk,'1');_pending=[_rk];renderBody();setStatus('UA conflict resolved — approved the shown value.');}));document.querySelectorAll('[data-safmropt]').forEach(o=>o.addEventListener('click',e=>{e.stopPropagation();const i=o.getAttribute('data-safmri'),v=o.getAttribute('data-safmropt');_pendingSnap=snapPend(['units.'+i+'.safmr_source','units.'+i+'.safmr_custom','units.'+i+'.safmr_reviewed']);srcSetSource('units.'+i+'.safmr_custom',v);if(safmrConflictOf(i))form=store.editForm(form,'units.'+i+'.safmr_reviewed','1');_pending=['units.'+i+'.safmr_source'];_refocusSel='[data-box="units.'+i+'.safmr_source"] .uatrigger';renderBody();setStatus('SAFMR source set.');}));
  document.querySelectorAll('[data-safmrok]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const _rk='units.'+b.getAttribute('data-safmrok')+'.safmr_reviewed';_pendingSnap=pushCellUndo(_rk);form=store.editForm(form,_rk,'1');_pending=[_rk];renderBody();setStatus('SAFMR conflict resolved.');}));
  document.querySelectorAll('[data-typ]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const i=b.getAttribute('data-ci'),w=b.getAttribute('data-typ');const _tk=['units.'+i+'.br','units.'+i+'.ba','units.'+i+'.type_reviewed'];_pendingSnap=pushUndo(_tk);_pending=_tk;if(w==='rcs'){const brR=get('units.'+i+'.br_rcs'),baR=get('units.'+i+'.ba_rcs');if(brR)form=store.editForm(form,'units.'+i+'.br',brR);if(baR)form=store.editForm(form,'units.'+i+'.ba',baR);}form=store.editForm(form,'units.'+i+'.type_reviewed','1');renderBody();setStatus('Unit type resolved — using '+(w==='rcs'?'RCS':'RS')+'.');}));
  document.querySelectorAll('[data-num]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const i=b.getAttribute('data-ci'),w=b.getAttribute('data-num');const _nk=['units.'+i+'.num_units','units.'+i+'.num_reviewed'];_pendingSnap=pushUndo(_nk);_pending=_nk;if(w==='rcs'){const nR=get('units.'+i+'.num_rcs');if(nR)form=store.editForm(form,'units.'+i+'.num_units',nR);}form=store.editForm(form,'units.'+i+'.num_reviewed','1');renderBody();setStatus('Units resolved — using '+(w==='rcs'?'RCS':'RS')+'.');}));
  document.querySelectorAll('.uac-in,.mgmt-in').forEach(inp=>{inp.addEventListener('mousedown',e=>e.stopPropagation());inp.addEventListener('click',e=>e.stopPropagation());});
  /* This box edits a cell that can change SHAPE under the edit: typing a figure
     equal to the source snaps it out of Custom, and in source mode the input
     carries data-srcedit and no data-k. Two things followed from ignoring that.

     It never set _pending (rule 5), so Enter had nothing to commit — the cell
     went amber with a ✓ beside it and the keyboard did nothing at all. And it
     refocused on [data-k], which stops existing the moment the snap happens, so
     the caret vanished as the value landed. */
  document.querySelectorAll('.srcedit').forEach(inp=>{inp.addEventListener('input',()=>{
    const fam=inp.getAttribute('data-srcedit'),i=inp.getAttribute('data-si');let key,val,sel;
    if(fam==='dateeff'){val=fmtDateInput(inp.value);key='rent_schedule.date_eff_custom';
      _pendingSnap=pushCellUndo(key);srcEditKey(key,val);scheduleHudRefresh();
      sel='[data-k="'+key+'"],[data-srcedit="dateeff"]';}
    else{val=cleanNum(inp.value);key='units.'+i+'.'+fam+'_custom';
      _pendingSnap=pushCellUndo(key);srcEditKey(key,val);
      sel='[data-k="'+key+'"],[data-srcedit="'+fam+'"][data-si="'+i+'"]';}
    _pending=coupledKeys(key);
    renderBody();
    const ni=document.querySelector(sel);
    if(ni){ni.focus({preventScroll:true});try{const L=(ni.value||'').length;ni.setSelectionRange(L,L);}catch(e){}}});
    /* Rule 7: Enter saves the focused cell, for EVERY kind of cell. The
       document handler stands down whenever focus is in a text box, on the
       premise that the box has its own Enter — which only [data-k] inputs had.
       Focus sat in one of these and Enter fell straight through the gap. */
    inp.addEventListener('keydown',async e=>{
      if(e.key==='Enter'){e.preventDefault();e.stopPropagation();
        const fam=inp.getAttribute('data-srcedit'),i=inp.getAttribute('data-si');
        const key=fam==='dateeff'?'rent_schedule.date_eff_custom':('units.'+i+'.'+fam+'_custom');
        const ks=coupledKeys(key); if(!keysCanSave(ks))return;
        try{form=await store.saveFields(form,ks);}catch(err){saveFailed(err);return;}
        await refreshSnap();snapForm(ks);clearUndoChain();_pending=null;_pendingSnap=null;
        _refocusSel='[data-srcedit="'+fam+'"]'+(i==null?'':'[data-si="'+i+'"]');
        renderBody();setStatus('Saved this field to the database.');return;}
      if(e.key==='Escape'){if(_pending&&_pending.length){e.preventDefault();e.stopPropagation();revertPending();}}});});
  document.querySelectorAll('[data-srck]').forEach(o=>o.addEventListener('click',e=>{e.stopPropagation();const k=o.getAttribute('data-srck'),_tg=o.getAttribute('data-srctag')||'source';_pendingSnap=snapPend([k]);form=store.editForm(form,k,o.getAttribute('data-srcv'));
    /* A pulled figure is not typed-in data. Into an empty cell it reads as this
       package's own — green, "not saved yet" — rather than plain new; over an
       on-file one it stays an override, but the note says PARSED changed rather
       than just changed. Without this the green state was unreachable from any
       per-cell pull, and the wording blamed the user for the schedule's figure. */
    markCycle(k);if(/\bRS\b|RCS/.test(_tg)&&form[k])form[k].fromParse=true;
    _pending=[k];_refocusSel='[data-k="'+k+'"]';renderBody();setStatus('Pulled from '+_tg+'.');}));
  document.querySelectorAll('[data-srcgrp]').forEach(o=>o.addEventListener('click',e=>{e.stopPropagation();const box=o.getAttribute('data-srcgrp');const r=SRCGROUP[box]()[+o.getAttribute('data-srcgix')];if(!r||!r.apply)return;const keys=Object.keys(r.apply);_pendingSnap=snapPend(keys);keys.forEach(k=>{form=store.editForm(form,k,r.apply[k]);});_pending=keys.slice();_refocusSel='[data-box="'+box+'"] input';renderBody();setStatus('Address pulled from '+r.tag+'.');}));
  document.querySelectorAll('[data-pocra]').forEach(o=>o.addEventListener('click',e=>{e.stopPropagation();const nm=raVal('poc.name');if(!nm)return;const saved=(mpdb?mpdb.listContacts():[]).find(x=>((x.name||'').trim().toLowerCase()===nm.trim().toLowerCase()));const c={name:nm,email:raVal('poc.email')||(saved&&saved.email)||'',phone:raVal('poc.phone')||(saved&&saved.phone)||''};_pendingSnap=snapPend(['poc.name','poc.email','poc.phone']);pocSelectContact(c);_pending=['poc.name','poc.email','poc.phone'];_refocusSel='[data-box="poc.name"] .pocname-in';renderBody();setStatus('POC pulled from Related Affordable.');}));
  document.querySelectorAll('[data-pocrcs]').forEach(o=>o.addEventListener('click',e=>{e.stopPropagation();
    const pm=pocMatchRcs();if(!pm.name)return;
    _pendingSnap=snapPend(POC_PICK_KEYS);
    if(pm.contact)pocSelectContact(pm.contact);
    else form=store.editForm(form,'poc.name',pm.name);
    _pending=POC_PICK_KEYS.slice();_refocusSel='[data-box="poc.name"] .pocname-in';
    renderBody();setStatus(pm.contact?'Point of contact taken from the study\u2019s addressee.':'Point of contact taken from the study \u2014 no saved contact of that name, so the email and phone are still to enter.');}));
  document.querySelectorAll('[data-pocopt]').forEach(o=>o.addEventListener('click',e=>{e.stopPropagation();const ct=mpdb.listContacts().find(x=>x.id===o.getAttribute('data-pocopt'));_pendingSnap=snapPend(['poc.name','poc.email','poc.phone']);if(ct)pocSelectContact(ct);_pending=['poc.name','poc.email','poc.phone'];_refocusSel='[data-box="poc.name"] .pocname-in';renderBody();}));
  document.querySelectorAll('[data-dirid]').forEach(o=>o.addEventListener('click',e=>{e.stopPropagation();const fk=o.getAttribute('data-dirfor');const P=DIR_PICK[fk];const ct=dirList(P.kind).find(x=>x.id===o.getAttribute('data-dirid'));_pendingSnap=snapPend(P.keys);if(ct)P.apply(ct);_pending=P.keys.slice();_refocusSel='[data-box="'+fk+'"] .pocname-in';renderBody();}));
  document.querySelectorAll('[data-deffopt]').forEach(o=>o.addEventListener('click',e=>{e.stopPropagation();_pendingSnap=snapPend(['rent_schedule.date_eff_custom','rent_schedule.date_eff_source']);srcSetSource('rent_schedule.date_eff_custom',o.getAttribute('data-deffopt'));_pending=['rent_schedule.date_eff_source'];_refocusSel='[data-box="rent_schedule.date_eff_source"] .uatrigger';renderBody();scheduleHudRefresh();scheduleFactorRefresh();}));
  document.querySelectorAll('[data-ocfopt]').forEach(o=>o.addEventListener('click',e=>{e.stopPropagation();_pendingSnap=snapPend(['ocaf.factor_custom','ocaf.factor_src']);srcSetSource('ocaf.factor_custom',o.getAttribute('data-ocfopt'));_pending=['ocaf.factor_src'];_refocusSel='[data-box="ocaf.factor_src"] .uatrigger';renderBody();}));
  const _rsw=el('rateSwitch');
  if(_rsw)_rsw.querySelectorAll('.rs-opt').forEach(b=>b.onclick=()=>{
    const v=b.getAttribute('data-rt');if(v===(get('ocaf.rate_type')||'Fixed rate'))return;
    _rsw.classList.toggle('fl',/floating/i.test(v));
    _rsw.querySelectorAll('.rs-opt').forEach(x=>x.classList.toggle('on',x===b));
    pushCellUndo('ocaf.rate_type');form=store.editForm(form,'ocaf.rate_type',v);_pending=['ocaf.rate_type'];
    setTimeout(()=>{renderBody();refreshOcafLines();},210); // let the thumb finish sliding before the inputs swap
  });
  const _po=el('pullOcaf');if(_po)_po.onclick=pullOcafFactor;
  const _pu=el('pullUaf');if(_pu)_pu.onclick=pullUafFactors;
  const _oa=el('ocafApply');if(_oa)_oa.onclick=ocafApplyRents;
  const _ua=el('uafApply');if(_ua)_ua.onclick=uafApplyUas;
  document.querySelectorAll('[data-delunit]').forEach(b=>b.addEventListener('click',()=>{const i=+b.getAttribute('data-delunit');const wasEmpty=!unitHasData(i)&&numf(get('units.'+i+'.num_units'))<=0;const snap={};Object.keys(form).forEach(k=>{if(k.indexOf('units.'+i+'.')===0){snap[k]=form[k];delete form[k];}});undoForget(Object.keys(snap));UNITS=UNITS.filter(x=>x!==i);if(wasEmpty){renderBody();setStatus('Empty unit type removed.');}else{_undoStack.push({i,snap});renderBody();setStatus('Unit type deleted — undo available below.');}}));
  document.querySelectorAll('[data-delnonrev]').forEach(b=>b.addEventListener('click',()=>{const i=+b.getAttribute('data-delnonrev');const hadData=nonrevHasData(i)||numf(get('nonrev.'+i+'.num_units'))>0;const snap={};Object.keys(form).forEach(k=>{if(k.indexOf('nonrev.'+i+'.')===0){snap[k]=form[k];delete form[k];}});undoForget(Object.keys(snap));NONREV=NONREV.filter(x=>x!==i);const flagCell=form['nonrev.enabled'];if(!NONREV.length)form=store.editForm(form,'nonrev.enabled','');if(hadData){_undoNR.push({i,snap,flag:flagCell});renderBody();setStatus('Non-revenue unit deleted — undo available below.');}else{renderBody();setStatus(NONREV.length?'Empty non-revenue unit removed.':'Last non-revenue unit removed — Part D section turned off.');}}));
  document.querySelectorAll('[data-delns8]').forEach(b=>b.addEventListener('click',()=>{const i=+b.getAttribute('data-delns8');const hadData=ns8HasData(i)||numf(get('ns8.'+i+'.num_units'))>0;const snap={};Object.keys(form).forEach(k=>{if(k.indexOf('ns8.'+i+'.')===0){snap[k]=form[k];delete form[k];}});undoForget(Object.keys(snap));NS8=NS8.filter(x=>x!==i);const flagCell=form['ns8.enabled'];if(!NS8.length)form=store.editForm(form,'ns8.enabled','');if(hadData){_undoLI.push({i,snap,flag:flagCell});renderBody();setStatus('Non-Section 8 unit type deleted — undo available below.');}else{renderBody();setStatus(NS8.length?'Empty non-Section 8 unit type removed.':'Last non-Section 8 unit type removed — section turned off.');}}));
  const add=el('addUnit');if(add)add.onclick=()=>{_undoStack=[];const nx=(UNITS.length?Math.max.apply(null,UNITS):-1)+1;form=store.editForm(form,'units.'+nx+'.br','');UNITS.push(nx);renderBody();setStatus('');};
  const addn=el('addNonrev');if(addn)addn.onclick=()=>{_undoNR=[];NONREV.push(NONREV.length?Math.max.apply(null,NONREV)+1:0);renderBody();setStatus('');};
  document.querySelectorAll('[data-delprin]').forEach(b=>b.addEventListener('click',()=>{const i=+b.getAttribute('data-delprin');const hadData=principalHasData(i);const snap={};Object.keys(form).forEach(k=>{if(k.indexOf('principals.'+i+'.')===0){snap[k]=form[k];delete form[k];}});undoForget(Object.keys(snap));PRINCIPALS=PRINCIPALS.filter(x=>x!==i);if(!PRINCIPALS.length)PRINCIPALS=[0];if(hadData){_undoPR.push({i,snap});renderBody();setStatus('Principal deleted \u2014 undo available below.');}else{renderBody();setStatus('Empty principal row removed.');}}));
  const pa=el('prinAdd');if(pa)pa.onclick=()=>{_undoPR=[];PRINCIPALS.push((PRINCIPALS.length?Math.max.apply(null,PRINCIPALS):-1)+1);renderBody();setStatus('');};
  const nt=el('nonrevToggle');if(nt)nt.onchange=()=>{
    if(!nt.checked&&NONREV.some(i=>nonrevHasData(i)||numf(get('nonrev.'+i+'.num_units'))>0)){
      nt.checked=true;
      dialogConfirm('Turn off non-revenue units?','The section still holds '+NONREV.length+' row'+(NONREV.length>1?'s':'')+' with values. Turned off, the rows are left out of every generated document, and your next \u201cUpdate property profile\u201d removes them for good \u2014 re-check the box before saving to bring them back.','Turn off',true,()=>{form=store.editForm(form,'nonrev.enabled','0');renderBody();setStatus('Non-revenue units off \u2014 the hidden rows are removed on your next Update property profile.');});
      return;}
    if(!nt.checked){NONREV.forEach(i=>Object.keys(form).forEach(k=>{if(k.indexOf('nonrev.'+i+'.')===0)delete form[k];}));NONREV=[];}
    form=store.editForm(form,'nonrev.enabled',nt.checked?'1':'');
    if(nt.checked&&!NONREV.length){_undoNR=[];NONREV=[0];}
    renderBody();setStatus('');};
  const lt=el('ns8Toggle');if(lt)lt.onchange=()=>{
    if(!lt.checked&&NS8.some(i=>numf(get('ns8.'+i+'.num_units'))>0)){lt.checked=true;setStatus('Delete the non-Section 8 rows first to turn this section off.');return;}
    if(!lt.checked&&NS8.some(ns8HasData)){
      lt.checked=true;
      dialogConfirm('Turn off non-Section 8 units?','The section still holds '+NS8.length+' row'+(NS8.length>1?'s':'')+' with values. Turned off, the rows are left out of every generated document, and your next \u201cUpdate property profile\u201d removes them for good \u2014 re-check the box before saving to bring them back.','Turn off',true,()=>{form=store.editForm(form,'ns8.enabled','0');renderBody();setStatus('Non-Section 8 units off \u2014 the hidden rows are removed on your next Update property profile.');});
      return;}
    form=store.editForm(form,'ns8.enabled',lt.checked?'1':'');
    if(lt.checked&&!NS8.length){_undoLI=[];form=store.editForm(form,'ns8.0.br','');NS8=[0];}
    renderBody();setStatus(lt.checked?'Non-Section 8 units on — they print on the rent schedule between Section 8 revenue and non-revenue units.':'');};
  const addl=el('addNs8');if(addl)addl.onclick=()=>{_undoLI=[];const nx=(NS8.length?Math.max.apply(null,NS8):-1)+1;form=store.editForm(form,'ns8.'+nx+'.br','');NS8.push(nx);renderBody();setStatus('');};
  const phs=el('pullSafmr');if(phs)phs.onclick=()=>{ensureHudSafmr({manual:true});};
  const upR=el('upRcs');if(upR)upR.onclick=()=>{const f=el('rcsFile');if(f)f.click();};
  const rf=el('rcsFile');if(rf)rf.onchange=()=>{const f=rf.files&&rf.files[0];if(!f)return;
    if(_rcsBusy){setStatus('Still reading the last study \u2014 one moment.');rf.value='';return;}
    f.arrayBuffer().then(async buf=>{const b=new Uint8Array(buf);
      if(!(b.length>4&&b[0]===0x25&&b[1]===0x50&&b[2]===0x44&&b[3]===0x46)){setStatus('That file isn\u2019t a PDF \u2014 upload the completed RCS report as a PDF.');rf.value='';return;}
      /* A 52-page valuation report is not a 3-page form. Reading it is fast
         because only the letter is read, but the row still says so rather than
         sitting unchanged while it happens. */
      _rcsBusy={name:f.name};renderBody();setStatus('Reading the RCS study\u2026');
      let r=null;try{r=await parseRcsPdf(b);}catch(e){r=null;}finally{_rcsBusy=null;}
      _rcsUpload={name:f.name,bytes:b,parsed:r,at:new Date().toISOString()};rf.value='';
      rcsRemember();renderBody();
      const nu=r&&r.units?r.units.length:0;
      setStatus(nu
        ?('RCS study read \u2014 '+(r.firm==='belfry'?'Belfry Valuation':r.firm==='cornerstone'?'Cornerstone Valuation Services':'the study')+', '+nu+' unit type'+(nu===1?'':'s')+' from page'+(r.pages.length===1?' ':'s ')+r.pages.map(x=>x+1).join(' and ')+'. Use \u201cFill form from study\u201d in '+secRef(1)+' to apply it.')
        :((r&&r.textless)
          ?'The study was uploaded as a scanned copy, so no values could be read from it. It still goes in as document 04.'
          :'The study was uploaded, but no appraiser\u2019s letter was found in it. It still goes in as document 04.'));
    });};
  const rap=el('rcsApply');if(rap)rap.onclick=()=>rcsFillFromParsed();
  const upS=el('upRs');if(upS)upS.onclick=()=>{const f=el('rsFile');if(f)f.click();};
  const sf=el('rsFile');if(sf)sf.onchange=()=>{const f=sf.files&&sf.files[0];if(!f)return;
    if(_rsBusy){setStatus('Still reading the last rent schedule \u2014 one moment.');sf.value='';return;} // OCR takes seconds; a second upload mid-flight would race the first
    f.arrayBuffer().then(async buf=>{const b=new Uint8Array(buf);
      if(!(b.length>4&&b[0]===0x25&&b[1]===0x50&&b[2]===0x44&&b[3]===0x46)){setStatus('That file isn\u2019t a PDF \u2014 upload the executed rent schedule as a PDF.');sf.value='';return;}
      setStatus('Reading the rent schedule\u2026');
      // Tiers 1 and 2 are instant, so the row would flick past; OCR takes seconds
      // per page, and without a visible row the upload line just sat there
      // unchanged until the whole thing finished. The row now says what is
      // happening and re-renders on every step.
      const busy=(note,sub)=>{_rsBusy={name:f.name,note:note,sub:sub};renderBody();};
      /* Three different jobs used to share one sentence, and it described only
         the rarest of them. On a copy whose page 1 reads perfectly well it still
         announced "no digital text on this page", which is simply untrue: the
         text layer had just supplied every figure, and Azure was being asked for
         the tick marks alone. Each caller now says which job it is. */
      /* The row says one of two things, because there are only two a reader needs:
         it is reading text, or it is scanning. Which OCR call is running, and why,
         is our business and not theirs. The status bar stays granular - that line
         is a live progress report and can afford the detail. */
      const SCANNING='Scanning the document as an image. This takes a few moments.';
      const SHORT={ticks:'scanning the tick boxes',fill:'scanning for anything the text missed',scan:'scanning the whole document'};
      const step=(i,n,why)=>{const w=why||'scan';busy('Reading page '+i+' of '+n+'\u2026',SCANNING);
        setStatus('Rent schedule \u2014 '+SHORT[w]+' (page '+i+' of '+n+')\u2026');};
      busy('Reading…','Reading the document’s text.');
      let r;try{r=await parseRsPdf(b,step);}catch(e){r={kind:'scan',parsed:null};}finally{_rsBusy=null;}
      _rsUpload={name:f.name,bytes:b,kind:r.kind,via:r.via,why:r.why||'',parsed:r.parsed,at:new Date().toISOString()};sf.value='';_rsArm=(r.kind==='fields'&&!!r.parsed);rsRemember();renderBody();
      setStatus(r.kind==='fields'
        ?((r.via==='ocr'?'Rent schedule scanned — check the values against the document. ':'Rent schedule read. ')+'Press Enter to fill the form, or use “Fill form from RS” in '+secRef(1)+'.')
        :((r.why?r.why+' ':'')+'The values in this copy could not be read — enter them by hand below.'));});};
  const ra=el('rsApply');if(ra)ra.onclick=()=>rsFillFromParsed();
  const uu=el('undoUnit');if(uu)uu.onclick=()=>{if(!_undoStack.length)return;const e=_undoStack.pop();Object.keys(e.snap).forEach(k=>{form[k]=e.snap[k];});if(UNITS.indexOf(e.i)<0)UNITS.push(e.i);UNITS.sort((a,b)=>a-b);renderBody();setStatus('Unit type restored.');};
  const uc=el('undoCommit');if(uc)uc.onclick=()=>{_undoStack=[];renderBody();setStatus('Deletions kept.');};
  const up=el('undoPrin');if(up)up.onclick=()=>{if(!_undoPR.length)return;const e=_undoPR.pop();Object.keys(e.snap).forEach(k=>{form[k]=e.snap[k];});if(PRINCIPALS.indexOf(e.i)<0)PRINCIPALS.push(e.i);PRINCIPALS.sort((a,b)=>a-b);renderBody();setStatus('Principal restored.');};
  const upc=el('undoPrinC');if(upc)upc.onclick=()=>{_undoPR=[];renderBody();setStatus('Deletions kept.');};
  const un=el('undoNonrev');if(un)un.onclick=()=>{if(!_undoNR.length)return;const e=_undoNR.pop();Object.keys(e.snap).forEach(k=>{form[k]=e.snap[k];});if(e.flag)form['nonrev.enabled']=e.flag;else form=store.editForm(form,'nonrev.enabled','1');if(NONREV.indexOf(e.i)<0)NONREV.push(e.i);NONREV.sort((a,b)=>a-b);renderBody();setStatus('Non-revenue unit restored.');};
  const unc=el('undoNonrevC');if(unc)unc.onclick=()=>{_undoNR=[];renderBody();setStatus('Deletions kept.');};
  const ul=el('undoNs8');if(ul)ul.onclick=()=>{if(!_undoLI.length)return;const e=_undoLI.pop();Object.keys(e.snap).forEach(k=>{form[k]=e.snap[k];});if(e.flag)form['ns8.enabled']=e.flag;else form=store.editForm(form,'ns8.enabled','1');if(NS8.indexOf(e.i)<0)NS8.push(e.i);NS8.sort((a,b)=>a-b);renderBody();setStatus('Non-Section 8 unit type restored.');};
  const ulc=el('undoNs8C');if(ulc)ulc.onclick=()=>{_undoLI=[];renderBody();setStatus('Deletions kept.');};
  const all=el('clAll'),none=el('clNone');const _clk=()=>CHECKLIST_FLAT.map((_,j)=>'check.'+j);const _cset=v=>{const ks=_clk();pushUndo(ks);ks.forEach(k=>{form=store.editForm(form,k,v);});_pending=ks;renderBody();};
  if(all)all.onclick=()=>_cset('1');if(none)none.onclick=()=>_cset('');
  /* Enter and Space work these the way they work a checkbox; Escape is left to
     bubble, so it reaches the undo run like every other cell's Escape does. */
  document.querySelectorAll('[data-fuel],[data-fuel3],[data-wibox]').forEach(el=>el.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;e.preventDefault();e.stopPropagation();
    if(e.key===' '){el.click();return;}
    const _sv=cellActBtn(el.closest('.cb,.wi,.utrow,[data-box]'),'[data-save1],[data-save1addr]');if(_sv)_sv.click();else if(_pending&&_pending.length)commitPending();else el.click();}));
  document.querySelectorAll('.chead').forEach(h=>h.addEventListener('click',()=>{h.parentElement.classList.toggle('collapsed');refreshFooter();}));
  document.querySelectorAll('.miniic,.revert,.save1,.urev,.undocommit,.csclear').forEach(b=>b.setAttribute('tabindex','-1'));wireArrowNav();
}

/* ============================ NAVIGATION ==============================
   Menu (property gallery) -> Launcher (pick a program) -> Form (RCS).
   ONE current record per property; leaving the form asks to save or discard.
   The RCS form itself (everything above) is unchanged. */

document.addEventListener('click',e=>{document.querySelectorAll('.uadrop.open').forEach(x=>x.classList.remove('open'));
  /* .gpw is the generate dialog's count, .chkmore the record-checks summary.
     A press inside one is that card's own business; a press anywhere else ends
     it, which is what a reader expects of anything they pinned open. */
  if(!(e.target&&e.target.closest&&e.target.closest('.gpw,.chkmore,.gpmore')))
    document.querySelectorAll('.gpw.open,.chkmore.open,.gpmore.open').forEach(x=>{x.classList.remove('open');if(x.blur)x.blur();});if(_pending&&!(e.target&&e.target.closest&&e.target.closest('.uaopt,[data-cb],.cb,[data-fuel],[data-fuel3],[data-wibox],[data-mgmt],[data-csopt],.uatrigger'))){_pending=null;_pendingSnap=null;}});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){const _p=document.querySelectorAll('.gpw.open,.chkmore.open,.gpmore.open');
    if(_p.length){_p.forEach(x=>{x.classList.remove('open');if(x.blur)x.blur();});e.stopPropagation();return;}}const vis=v=>{const x=el('view'+v);return x&&x.style&&x.style.display!=='none';};if(e.key==='Tab'){_pending=null;_pendingSnap=null;_rsArm=false;return;}if(e.key==='Enter'){const ae=document.activeElement;const inText=!!ae&&/^(INPUT|TEXTAREA)$/.test(ae.tagName)&&ae.type!=='checkbox';
    if(_dlgEnter&&el('scrim')&&el('scrim').classList.contains('open')){e.preventDefault();_dlgEnter();return;}
    if(_rsArm&&!inText){const ra=el('rsApply');if(ra){e.preventDefault();_rsArm=false;ra.click();return;}}
    if(!inText&&_pending&&_pending.length){e.preventDefault();commitPending();}return;}if(e.key!=='Escape')return;if(el('scrim')&&el('scrim').classList&&el('scrim').classList.contains('open')){closeModal();_pending=null;_pendingSnap=null;return;}const openD=document.querySelector('.uadrop.open');if(openD){e.preventDefault();openD.classList.remove('open');return;}if(vis('Form')){if(_pending&&_pending.length){e.preventDefault();revertPending();return;}if(_undoChain.length&&undoStep()){e.preventDefault();return;}const ae=document.activeElement;const cell=(ae&&ae.closest)?ae.closest('[data-box],.cb,.wi'):null;if(cell){let _sel=null;if(ae.getAttribute){if(ae.getAttribute('data-k'))_sel='[data-k="'+ae.getAttribute('data-k')+'"]';else if(ae.getAttribute('data-cb'))_sel='[data-cb="'+ae.getAttribute('data-cb')+'"]';else if(ae.classList&&ae.classList.contains('uatrigger'))_sel=ae.getAttribute('data-trigfor')?('[data-trigfor="'+ae.getAttribute('data-trigfor')+'"]'):('[data-box="'+(cell.getAttribute('data-box')||'')+'"] .uatrigger');}_refocusSel=_sel;if(revertCellIfOver(cell,(ae.getAttribute&&ae.getAttribute('data-trigfor'))||null)){e.preventDefault();return;}_refocusSel=null;}requestExit();return;}if(vis('Launcher')||vis('Contacts')){openMenu();}});
let _mouseFocus=false,_lastClickSel=null,_lastClickNode=null,_lastClickAt=0;
document.addEventListener('mousedown',e=>{_mouseFocus=true;_rsArm=false;setTimeout(()=>{_mouseFocus=false;},60);
  const t=e.target;_lastClickSel=null;_lastClickNode=(t&&t.getBoundingClientRect)?t:null;_lastClickAt=Date.now();
  if(!t||!t.closest)return;
  // a click's anchor: the cell it hit; else the checkbox its label wraps; else the section card; else the footer
  const attrSel=()=>{const A=['data-cb','data-wibox','data-fuel','data-fuel3','data-box'];for(let i=0;i<A.length;i++){const n=t.closest('['+A[i]+']');if(n)return '['+A[i]+'="'+n.getAttribute(A[i])+'"]';}return null;};
  let sel=attrSel();
  if(!sel){const lb=t.closest('.cb,.wi,.utrow');const inner=lb&&lb.querySelector('[data-cb],[data-wibox]');if(inner)sel=inner.hasAttribute('data-cb')?('[data-cb="'+inner.getAttribute('data-cb')+'"]'):('[data-wibox="'+inner.getAttribute('data-wibox')+'"]');}
  if(!sel){const cd=t.closest('#sections .card');if(cd){const all=[].slice.call(document.querySelectorAll('#sections .card'));const i=all.indexOf(cd);if(i>=0)sel='#sections .card:nth-child('+(i+1)+')';}}
  if(!sel&&t.closest('.footer'))sel='.footer';
  _lastClickSel=sel;
},true);
window.addEventListener('scroll',()=>{const s=window.scrollY>150;if(s!==document.body.classList.contains('scrolled'))document.body.classList.toggle('scrolled',s);});
/* The save bar is position:sticky, so it is held against the foot of the window
   while there is form below it and comes to rest in the flow once you reach the
   end. There is no CSS state for "no longer stuck", so measure it: while sticky
   is holding it, its bottom edge sits on the bottom of the window. Resting, it
   sits above it, and the corners round. */
function syncFooterRest(){const f=document.querySelector('#viewForm .footer');if(!f)return;
  f.classList.toggle('rest',f.getBoundingClientRect().bottom<=window.innerHeight-1);}
window.addEventListener('scroll',syncFooterRest,{passive:true});
window.addEventListener('resize',syncFooterRest);

/* menuView: which rail view the home page is showing. Empty means "not chosen
   yet", which renderMenu resolves to the first non-empty view and writes back —
   so the app opens on whatever is actually actionable. The Name / Recently
   saved sort is gone with sortMode: every rail view is a deadline question, so
   order inside one is by deadline, and a control that fights that is a control
   that hides the late one. */
let activeProgram='RCS';let menuView='';let menuLens='mine';let pmName='';
function show(v){['Auth','Menu','Launcher','Form','Contacts'].forEach(V=>{const e=el('view'+V);if(e)e.style.display=(v===V)?'':'none';});window.scrollTo(0,0);}

/* ---- small helpers for the menu -------------------------------------- */
/* The ring was one amber for everything short of complete and navy at 100, so
   a record with nothing in it and a package one field away from generating
   looked the same at a glance — which is the glance the gallery exists for.
   It runs red to green now, the hue walking 0° to 145° with the score. The
   lightness dips through the yellows around 55°, where a hue at a constant
   lightness goes pale enough on white to stop reading as a colour at all. */
function ringColor(pct){const p=Math.max(0,Math.min(100,pct))/100;
  /* Squared, not linear. A straight walk from red to green put 65 at a hue of
     94 degrees — full green for a package that cannot generate four of its six
     documents. The curve holds the low half in red and orange, spends the
     middle in amber, and only turns green as the score approaches complete,
     which is the only place green means anything. */
  const h=Math.round(145*p*p);
  const sat=Math.round(72-p*14);
  /* The hue barely moves across the bottom third — a 10 and a 25 are both
     "nothing usable yet" — so the lightness carries the change there: deep at
     the empty end, brighter as it fills. The dip through the yellows near 55
     stays; a hue held at one lightness goes pale enough on white to stop
     reading as a colour at all. */
  const lig=Math.round(40+p*8-Math.max(0,1-Math.abs(h-55)/38)*7);
  return 'hsl('+h+','+sat+'%,'+lig+'%)';}
/* A property's record is either sufficient to build a package from or it is
   short specific fields. That is a state, not a percentage: there is no such
   thing as a property being 65% of a property. The chip names what is missing,
   and says nothing at all when nothing is. */
/* The launcher only. On the menu this hung a "needs" off rows whose whole
   subject is when a renewal is owed and how big the job is — a demand for
   something nobody had asked for yet, on a page nobody opens to fill a
   profile. Where it belongs is the property's own page, next to the fields it
   is talking about. */
function profileChip(p){
  const m=(p&&p.profile&&p.profile.missing)||[];
  if(!m.length)return '';
  const names=m.map(x=>x.label);
  /* "4 missing from the profile" named nothing. The count was the whole chip
     and the four labels lived in a title attribute, so the one question it
     provoked — which four? — was the one it would not answer without a hover
     nobody knows to try. It says them. */
  const shown=names.length<=3?andJoin(names):(names.slice(0,2).join(', ')+' and '+(names.length-2)+' more');
  return '<span class="pchip" title="'+esc('Missing: '+andJoin(names))+'">Needs '
    +esc(shown)+'</span>';}
function ringSvg(pct,size){size=size||36;const r=size/2-3;const c=2*Math.PI*r;const off=c*(1-Math.max(0,Math.min(100,pct))/100);const col=ringColor(pct);
  return '<svg class="ringsvg" width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'"><circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="#e9edf4" stroke-width="3.4"/><circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="'+col+'" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" transform="rotate(-90 '+size/2+' '+size/2+')"/><text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" font-size="'+(size<44?10:12.5)+'" font-weight="700" fill="#33405c">'+pct+'</text></svg>';}
function niceDate(d){if(!d)return '—';const m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];const p=String(d).slice(0,10).split('-');if(p.length!==3)return d;return m[(+p[1])-1]+' '+(+p[2])+', '+p[0];}
function relTime(iso){if(!iso)return '—';const s=String(iso);if(s.indexOf('T')<0)return niceDate(s);const then=new Date(s);if(isNaN(then))return niceDate(s);const now=new Date();const d=(now-then)/1000;if(d<45)return 'just now';if(d<3600)return Math.max(1,Math.round(d/60))+'m ago';if(d<86400)return then.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});return niceDate(s);}
function updTitle(iso){if(!iso)return '';const s=String(iso);const base='Updated '+niceDate(s);if(s.indexOf('T')<0)return base;const t=new Date(s);return isNaN(t)?base:base+' at '+t.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}

/* ---- generic modal (used for exit, new/rename, delete) --------------- */
function modal(html,cls){_dlgEnter=null;const d=el('dialog');d.className='dialog'+(cls?' '+cls:'');d.innerHTML=html;el('scrim').classList.add('open');}
function closeModal(){_dlgEnter=null;el('scrim').classList.remove('open');}
function dialogInput(title,label,value,okLabel,onOk,extra){ // extra:{label,value,hint} adds a second field; onOk gets (value, extraValue)
  modal('<div class="dlg-t">'+esc(title)+'</div><div class="dlg-field"><label>'+esc(label)+'</label><input id="dlgIn" value="'+esc(value||'')+'" autocomplete="off"></div>'
    +(extra?'<div class="dlg-field"><label>'+esc(extra.label)+'</label><input id="dlgIn2" value="'+esc(extra.value||'')+'" autocomplete="off">'+(extra.hint?'<div class="dlg-hint">'+esc(extra.hint)+'</div>':'')+'</div>':'')
    +'<div class="dlg-row"><button class="btn" id="dlgCancel">Cancel</button><span class="dlg-sp"></span><button class="btn p" id="dlgOk">'+esc(okLabel||'Save')+'</button></div>');
  const go=e=>{if(e.key==='Enter'){e.preventDefault();el('dlgOk').click();}else if(e.key==='Escape')closeModal();};
  const inp=el('dlgIn');if(inp&&inp.focus){inp.focus();if(inp.select)inp.select();inp.addEventListener('keydown',go);}
  const in2=el('dlgIn2');if(in2)in2.addEventListener('keydown',go);
  el('dlgCancel').onclick=closeModal;el('dlgOk').onclick=()=>{const v=(el('dlgIn').value||'').trim();const v2=in2?(in2.value||'').trim():undefined;closeModal();onOk(v,v2);};
}
function dialogConfirm(title,body,okLabel,danger,onOk){
  modal('<div class="dlg-t">'+esc(title)+'</div><div class="dlg-b">'+body+'</div><div class="dlg-row"><button class="btn" id="dlgCancel">Cancel</button><span class="dlg-sp"></span><button class="btn '+(danger?'danger':'p')+'" id="dlgOk">'+esc(okLabel||'OK')+'</button></div>');
  el('dlgCancel').onclick=closeModal;el('dlgOk').onclick=()=>{closeModal();onOk();};
}

/* ---- MENU: the property gallery -------------------------------------- */
function openMenu(){activeCid=null;renderWho();renderMenu();show('Menu');}
/* ====== The HAP tracker on the home page ==============================
   The tracker is the catalogue: 249 properties, each with a next renewal and
   the manager who owns it. The app's own records are the WORK — they come into
   existence the first time someone opens a property, and are joined back by the
   tracker's property code.

   Which means the menu shows two populations, and they must not be confused
   with one another: properties the tracker knows about, and records made before
   the tracker existed (or by hand) that carry no code. The second group is shown
   under its own heading rather than matched by name, because matching names
   across two systems is how one firm's Beacon Hill becomes another's. */
function hapAll(){
  try{
    const H=window.RCSHap;if(!H)return null;
    const src=(window.HAPSource&&window.HAPSource.rows)?window.HAPSource.rows():[];
    if(!src||!src.length)return null;
    if(!_hapCache||_hapCache.src!==src.length){const n=H.normalize(src);_hapCache={src:src.length,rows:n.rows};}
    return _hapCache.rows;
  }catch(e){return null;}
}
let _hapCache=null;
/* The counts the last render put on the rail. A suite asserts the badge and the
   grid agree without having to scrape two DOMs for one number. */
let _menuCounts={};
/* One-shot, per session. See the scroll block at the end of renderMenu. */
/* Closed on load: the page opens on what is coming, not on what is behind. */
let _pastOpen=false;
/* Wired once for the life of the page, not once per render. */
let _menuWheel=false;
/* Open or close the past-due drawer, holding everything below it still.
   Anchored on the live panel and not on the drawer's own height: offsetHeight
   excludes margins, and opening changes two of them (the banner sheds its 14px
   and the drawer brings 40px), so measuring the drawer left the panel 26px from
   where it had been. Measuring the thing that must not move cannot drift,
   whatever the boxes above it do. */
function _togglePast(){
  const anchor=()=>{
    const g=el('menuGrid');if(!g||!g.querySelector)return null;
    const a=g.querySelector('.mgrid.rows.live')||g.querySelector('.zhead');
    return (a&&a.getBoundingClientRect)?a.getBoundingClientRect().top:null;};
  const before=anchor();
  _pastOpen=!_pastOpen;
  renderMenu();
  if(before==null||typeof window==='undefined'||typeof window.scrollTo!=='function')return;
  const after=anchor();
  if(after==null)return;
  const d=Math.round(after-before);
  if(d)window.scrollTo({top:Math.max(0,(window.pageYOffset||0)+d)});
}

/* One card's worth of fact per tracker property, merged with the app record if
   one exists yet. */
function hapProperties(){
  const H=window.RCSHap,rows=hapAll();
  if(!H||!rows)return [];
  const today=mpdb&&mpdb.today?mpdb.today():new Date().toISOString().slice(0,10);
  const scope=H.inScope(rows),byCode={};
  rows.forEach(r=>{if(scope[r.code]&&!byCode[r.code])byCode[r.code]=r;});
  /* Hoisted out of the map below. listProperties() runs packageScore() for every
     property it returns, so calling it once per tracker code was 229 full score
     computations per render on the real portfolio. */
  const byId={};(mpdb.listProperties()||[]).forEach(r=>{byId[r.id]=r;});
  return Object.keys(byCode).map(code=>{
    const any=byCode[code],t=H.targetFor(rows,code,today);
    const pid=(mpdb&&mpdb.propByRaCode)?mpdb.propByRaCode(code):null;
    const rec=pid?(byId[pid]||null):null;
    /* Only when a record exists. Most tracker properties have none yet, so this
       is a handful of listCycles calls per render rather than 229 — and each one
       runs dominantCycleId plus a sort. */
    const act=H.actionFor(rows,code,pid?(mpdb.listCycles(pid)||[]):[],today);
    /* The row the CARD is about. Normally the target — but where an unrecognised
       increase type sits in front of the target, the card must be about THAT
       row, or the three parts of it describe three different renewals: a pill
       reading OCAF, a countdown to an OCAF two years out, and a button naming a
       type due in ten weeks. The unreadable row is the next event, so it is the
       one the card counts down to. */
    const d=(act.kind==='unsupported')?{type:act.type,effective:act.effective,deadline:act.deadline}
           :(t?{type:t.type,effective:t.effective,deadline:t.deadline}:null);
    return {
      id:pid||('hap:'+code), code:code, hap:true, started:!!pid,
      name:(rec&&rec.name)||any.name, alias:(rec&&rec.alias)||'',
      fha:(rec&&rec.fha)||'—', city_state:(rec&&rec.city_state)||'',
      /* The schedule carries a unit count, so a property the app has never
         opened still knows how big the job is. Reading only the record printed
         "0 units" on every unstarted row — a figure, and wrong. */
      total_units:(rec&&rec.total_units)||(+String(any.units||'').replace(/[^0-9]/g,'')||0),
      unit_types:(rec&&rec.unit_types)||0,
      completeness:rec?rec.completeness:0, updated_at:(rec&&rec.updated_at)||'',
      /* Carried, not recomputed. Without these two the profile chip and the
         card's hover caption were dead on every scheduled property — the chip
         showed on records with no tracker code and nowhere else, which read as
         "only uncoded records have gaps". */
      profile:(rec&&rec.profile)||null, caption:(rec&&rec.caption)||'',
      /* The pill shows an unrecognised increase type verbatim rather than going
         blank: "displayed verbatim, never silently dropped" applies to the pill
         as much as to the button. */
      pm:any.pm, program:d?d.type:'', deadline:d?d.deadline:'',
      effective:d?d.effective:'', band:d?H.bandOf(d.deadline,today):'undated',
      status:H.statusFor(rows,code,today), days:d?H.daysBetween(today,d.deadline):null,
      action:act,
    };
  });
}

/* The launcher's action and the card's action are the same fact, so they are the
   same derivation. Two renderers computing one answer separately is how one of
   them ends up wrong and only the second is ever seen (FORM-RULES 13). */
function hapForPid(pid){return hapProperties().find(x=>x.id===pid)||null;}

/* The words for it. Copy lives here, not in hap.js: a data module that owns
   prose is a data module nobody can restyle. */
function actionLabel(a){
  if(!a)return '';
  if(a.kind==='start')      return 'Start '+a.year+' '+a.type;
  if(a.kind==='continue')   return 'Continue '+a.year+' '+a.type;
  if(a.kind==='view')       return 'View '+a.year+' package';
  if(a.kind==='awaiting'||a.kind==='gap') return 'Start a package';
  /* The unrecognised type goes in the button text, in quotation marks, so
     verbatim-ness is visible on the card and not only in a tooltip. */
  if(a.kind==='unsupported')
    return String(a.type||'').trim()
      ? ('Start '+a.year+' “'+a.type+'”')
      /* A blank type is not a new value to show verbatim — there is nothing to
         show. Naming the absence is the honest form of the same rule. */
      : ('The '+a.year+' row states no increase type');
  return '';                                  // 'expiring' and 'none' offer nothing to press
}
function actionReason(a){
  if(!a)return '';
  if(a.kind==='unsupported'&&!String(a.type||'').trim())
    return 'The renewal schedule has a row effective '+fmtDateLong(a.effective)
      +' with no increase type on it. Until the schedule says what kind of increase it is, '
      +'there is nothing to start from it.';
  if(a.kind==='unsupported')
    return 'The renewal schedule calls the next increase “'+a.type+'”, effective '
      +fmtDateLong(a.effective)+'. This app builds OCAF and RCS packages, so there is nothing '
      +'to start from that row.';
  /* Stated as the fact it is. The tracker records a date, not an outcome: it
     does not know whether the contract renews, so neither do we, and neither
     "finished" nor "awaiting the next schedule" would be honest. */
  if(a.kind==='expiring')
    return 'The renewal schedule ends here: the HAP contract expires '+fmtDateLong(a.effective)
      +(a.contractExp&&a.contractExp!==a.effective?' (the contract record says '+fmtDateLong(a.contractExp)+')':'')
      +'. There is no further OCAF or RCS scheduled, so there is nothing to start. If the '
      +'contract is renewed, the schedule will carry it again.';
  if(a.kind==='gap')
    return 'The renewal schedule stops at an option-term expiry on '+fmtDateLong(a.effective)
      +', but the contract runs to '+fmtDateLong(a.contractExp)+' — so this is a gap in the '
      +'schedule rather than a contract ending. Starting a package here asks you for the '
      +'program and the effective date.';
  if(a.kind==='awaiting')
    return 'The renewal schedule has no further OCAF or RCS for this property, and does not '
      +'end on a contract expiry — it simply stops. Starting a package here asks you for '
      +'the program and the effective date.';
  if(a.kind==='view')return 'This package has been generated. Opening it reopens the form.';
  return '';
}
/* Text only — no chevron, no arrow glyph, no icon. smoke_combined.js asserts no
   <svg> appears anywhere inside #menuGrid; that check is what keeps the
   completion ring off a property card, and an arrow here would fail it with a
   message about rings. A record with no tracker row gets no button at all: it
   already sits under its own "Not in the renewal schedule" heading, and its
   action is #bNewCycle on the launcher. */
function actionBtnHtml(p,short){
  const a=p.hap&&p.action;if(!a||a.kind==='none')return '';
  let lab=actionLabel(a);if(!lab)return '';
  if(short){const m=lab.match(/^(\S+)\s+(\d{4})\b/);lab=m?(m[1]+' '+m[2]):lab.split(' ')[0];}
  const why=actionReason(a);
  /* The reason hangs on the WRAPPER. A disabled <button> swallows its own
     tooltip in Firefox and Safari, and "disabled, with a reason" is the one
     branch the design demands a reason for — so on two of three browsers the
     reason was unreachable exactly where it mattered. */
  return '<div class="pc-act"'+(why?' title="'+esc(why)+'"':'')+'><button class="btn sm p pc-go" data-pact="'+esc(p.code)+'"'
    +(a.disabled?' disabled':'')+'>'+esc(lab)+'</button></div>';
}

/* ---- the figures line IS the filter -------------------------------------
   One partition of the portfolio, stated once. The rail asked the same
   question in a second vocabulary and got a different answer: "Needs you"
   welded past-their-date onto due-within-30 and then subtracted whatever had
   a package open, so on a portfolio where an overdue row means the package
   already went in, its headline counted 20 finished properties as work — and
   that view opened by default.

   These five are the bands the list is grouped by, so every figure is
   countable on the page beneath it, they are disjoint, and they sum to the
   total. Chronological order, no editorial: the strip reports when things are
   due, it does not rank them by how much they should worry you. */
/* The total leads. It is the view the page opens on, and reading the strip
   left to right should start with what you are looking at and then break it
   down, not arrive at it after four qualifications. */
const MENU_VIEWS=[
 {k:'all',    t:'properties',          c:''},
 {k:'past',   t:'past due to HUD',     c:''},
 {k:'now',    t:'due within 30 days',  c:'now'},
 {k:'later',  t:'later',               c:'soon'},
 {k:'undated',t:'not in the schedule', c:''},
];
function _bandNow(){return (window.RCSHap&&window.RCSHap._bandDays&&window.RCSHap._bandDays.now)||30;}
/* The words live here, not in a click handler (FORM-RULES 17): the lede under
   the heading and the copy shown when a view is empty are two halves of one
   explanation and must be edited together. Every empty state names the next
   place to look, because a chosen view that later empties STAYS chosen — which
   is the point, but reads as a bug to anyone who has not been told. */
function menuViewCopy(k){
  const N=_bandNow();
  const M={
   now:{lede:'Due in the next '+N+' days. Earliest first.',
        empty:'Nothing is due in the next '+N+' days.'},
   /* Not an alarm, and the lede says why \u2014 twice over. The tracker carries
      the deadline, not the filing, so a date in the past usually means the
      package went in and the row has not caught up. And the band is STRUCTURAL:
      HUD wants the paperwork about four months before the rents move, so every
      property spends those four months here whether or not anything is late.
      It drains on its own as each increase date arrives. */
   past:{lede:'The date HUD wanted the paperwork by has passed, and the rents have not moved yet \u2014 a window every property passes through, since the tracker sets that date about four months ahead of the increase.',
        empty:'Nothing is past its date.'},
   later:{lede:'Due more than '+N+' days out. Earliest first.',
        empty:'Nothing further out is waiting.'},
   /* Three reasons, not two. The schedule can end on the contract's own expiry,
      it can simply stop, or the record can carry no tracker code at all — and a
      lede that named only the last two read as though an expiring contract were
      a data problem. */
   undated:{lede:'No renewal scheduled — the schedule ends at a contract expiry, it stops without one, or the record is not in the schedule at all.',
        empty:'Every property has a date.'},
   all:{lede:'Every property: those in the schedule by deadline, then the records the schedule does not carry.',
        empty:'No properties yet.'},
  };
  return M[k]||M.all;
}

/* First match wins, in rail order.

   In flight and Done for the year come from `action`, NOT from a second look at
   the property's cycles. Matching a package to the renewal it belongs to is one
   rule — exact effective date first, year+program as a fallback, suppressed
   where a year holds two startable rows of the same program — and it lives in
   hap.js where the real corpus can hold it to account. A copy here would be a
   second implementation that drifts: the first draft of it had neither the exact
   match nor the concurrency guard, so on Luther Towers the rail and the button
   would have disagreed about whether the September package existed.

   Undated is disjoint from the rest for free: deadline is computed from
   effective whenever due is missing, so an undated property is one with no row
   to be about — awaiting, a gap, or an expiring contract — and none of those can
   have a matching package. */
const MONTHS=['January','February','March','April','May','June','July',
              'August','September','October','November','December'];
/* The strip's buckets and the list's group headings are the same function, so
   they cannot disagree. When they were two functions they did: the strip said
   one property was undated while the rail said two. */
/* One axis, and every division on it is a point in time. `past`/`now`/`later`
   survive as STRIP FILTERS \u2014 they are disjoint and they still sum \u2014 but none of
   them is a group any more: a group heading on this page names a month, and a
   month tiles the schedule where a state does not. Before this, all 83 overdue
   properties shared one heading called "Past their date", which put five months
   of the calendar under a heading that was not a date, and rendered them BELOW
   the rows due in thirty days \u2014 later dates above earlier ones on a list whose
   whole claim is that it runs in date order. */
function bandOf(p){
  const d=p.hap?p.days:null;
  if(!p.hap||d==null||!p.deadline)return {view:'undated',rank:9,key:'none',label:'No renewal scheduled'};
  const iso=String(p.deadline).slice(0,10).split('-');
  return {view:(d<0?'past':(d<=30?'now':'later')),rank:0,
          key:'m'+iso[0]+iso[1],label:MONTHS[(+iso[1])-1]+' '+iso[0],behind:d<0};
}
function _menuToday(){try{return (mpdb&&mpdb.today)?mpdb.today():new Date().toISOString().slice(0,10);}
  catch(e){return new Date().toISOString().slice(0,10);}}
/* Each figure is a button. The number you press is the number of rows you get
   — the invariant the whole strip rests on, and the one the suite asserts. */
function figuresHtml(counts,view){
  return MENU_VIEWS.map(v=>{const C=menuViewCopy(v.k);
    return '<button class="fig'+(v.c?' '+v.c:'')+(v.k===view?' on':'')+(counts[v.k]?'':' zero')
      +'" data-view="'+v.k+'"'+(v.k===view?' aria-current="true"':'')
      +' title="'+esc(C.lede)+'"><b>'+fmtNum(counts[v.k])+'</b> '
      +esc(v.k==='all'&&counts.all===1?'property':v.t)+'</button>';}).join('');
}

/* The deadline, said the way a person would say it. */
function dueLine(p){
  const a=p.action;
  /* "Awaiting the next schedule" once covered every property with no future
     startable row. It asserts a next schedule, and for the 125 whose schedule
     ends on their contract's own expiry there is no evidence of one — so each
     of the three shapes says only what the tracker actually holds. */
  /* Neutral, not amber. Amber on this line means "due within 30 days"; a
     contract expiry is a fact about the contract, not a countdown, and painting
     every one of them amber regardless of when it falls would be an indicator
     asserting rather than computing (FORM-RULES 15). What says there is nothing
     to do here is the absence of an action button. */
  if(a&&a.kind==='expiring')return '<div class="pc-due ok">Contract expires '+esc(fmtDateShort(a.effective))+'</div>';
  /* A gap is a CONTRADICTION, and the line has to carry both halves or it
     reads as a wind-down. "No renewal scheduled after Apr 1, 2027" printed the
     horizon and hid the reason: the tracker's last row is an EXPIRES in 2027
     while its own Contract Exp column runs to 2045. Naming only the first date
     said "this property is ending" about a property with eighteen years of
     contract left, and gave no hint why the row still has a live Start. */
  if(a&&a.kind==='gap')return '<div class="pc-due ok">Schedule ends '+esc(fmtDateShort(a.effective))
    +(a.contractExp?(' &middot; contract runs to '+esc(fmtDateShort(a.contractExp))):'')+'</div>';
  if(p.status==='awaiting-schedule')return '<div class="pc-due ok">Awaiting the next schedule</div>';
  if(!p.deadline)return '<div class="pc-due ok">No date scheduled</div>';
  const d=p.days;
  if(d==null)return '<div class="pc-due ok">No date scheduled</div>';
  /* Overdue is not an alarm. Matt: "anything overdue has already been
     completed" — the tracker carries the deadline, not the filing, so a past
     date means the package went in and the row has not caught up. Shouting
     "119 days late" in red across a hundred and three rows buried the handful
     that are genuinely live. It states the date and stops there. */
  if(d<0)return '<div class="pc-due past">Was due '+esc(fmtDateShort(p.deadline))+'</div>';
  if(d<=30)return '<div class="pc-due now">'+esc(fmtDateShort(p.deadline))+' · '+d+' day'+(d===1?'':'s')+' left</div>';
  return '<div class="pc-due ok">'+esc(fmtDateShort(p.deadline))+' · '+d+' days</div>';
}
function fmtDateShort(iso){
  const m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const p=String(iso||'').slice(0,10).split('-');
  return p.length===3?(m[(+p[1])-1]+' '+(+p[2])+(p[0]!==String(new Date().getFullYear())?', '+p[0]:'')):String(iso||'');
}

/* Who you are, in the tracker's vocabulary. Asked once; the names offered are
   the ones the tracker actually contains, so there is no mapping to drift. */
function pickWhoDialog(){
  const H=window.RCSHap,rows=hapAll();
  const names=(H&&rows)?H.managers(rows):[];
  if(!names.length){setStatus('The renewal schedule has not loaded, so there are no names to choose from.');return;}
  /* The same condition the list itself filters on. Asking only whether the
     lens is 'all' left the picker marking nothing as current on a page whose
     eyebrow already read \u201call managers\u201d \u2014 no name chosen is showing
     everyone, and the picker has to say the same thing the page does. */
  const _everyone=(menuLens==='all'||!pmName);
  const _cur=nm=>_everyone?(nm==='*'):(nm===pmName);
  const _row=(k,lab)=>'<div class="uaopt'+(_cur(k)?' cur':'')+'" data-who="'+esc(k)+'">'
    +esc(lab)+(_cur(k)?'<span class="uasub">current</span>':'')+'</div>';
  const rowsHtml=_row('*','Everyone')+names.map(nm=>_row(nm,nm)).join('');
  modal('<div class="dlg-t">Whose properties should the list show?</div>'
    +'<div class="lh-note" style="margin-bottom:12px">These are the managers named in the renewal schedule. '
    +'Choosing a name also records who you are.</div>'
    +'<div id="whoList" class="wholist">'+rowsHtml+'</div>'
    +'<div class="dlg-row"><button class="btn" id="dlgCancel">Cancel</button><span class="dlg-sp"></span></div>','desk');
  el('dlgCancel').onclick=closeModal;
  document.querySelectorAll('[data-who]').forEach(r=>r.onclick=async()=>{
    const nm=r.getAttribute('data-who');closeModal();
    /* The bands are not the same shape for one manager as for the portfolio, so
       the chosen view is released rather than left pointing at a bucket that
       only emptied because the scope moved. */
    menuView='';
    if(nm==='*'){menuLens='all';renderWho();renderMenu();return;}
    menuLens='mine';pmName=nm;renderWho();renderMenu();
    try{if(mpdb&&mpdb.setPmName)await mpdb.setPmName(nm);}catch(e){saveFailedModal(e);}
  });
}
function renderWho(){
  const w=el('menuWho');if(!w)return;
  w.textContent=(menuLens==='all')?'All portfolios':(pmName||'Choose a portfolio');
  w.classList.toggle('unset',menuLens!=='all'&&!pmName);
  w.title=(menuLens==='all')?'Showing every manager\u2019s properties — click to choose one'
    :(pmName?('Showing '+pmName+'\u2019s properties — click to change'):'Choose whose properties to show');
}

/* Opening a tracker property for the first time is what brings its record into
   existence. Everything downstream — cycles, the form, generation — already
   works on a record, so this is the only new step. */
/* ============================ DEV ONLY ==================================
   TEMPORARY. This exists to clear the records left over from before the
   tracker became the source of truth, and it goes away once that is done.
   To remove it: set DEV_PURGE to false and delete this function, the
   `#orphPurge` heading button in renderMenu, its one-line wiring below the
   [data-pact] loop, and the .olist/.orow rules in shell.head.html. The
   purge-guard checks in smoke_combined.js go with it.
   ======================================================================== */
const DEV_PURGE=true;
/* Removing records is the user's decision, so the app's whole job is to make
   it an informed one. "13 records" is not something anyone can decide on: these
   are the only copy of whatever was entered by hand, nothing in the tracker
   will recreate them, and one of them may be the one holding a finished
   package. So the confirm lists them and says what each one holds. */
function purgeOrphans(list){
  if(!list||!list.length)return;
  const cyOf=p=>((mpdb&&mpdb.listCycles&&p.id)?(mpdb.listCycles(p.id)||[]):[]);
  const rows=list.map(p=>{
    const n=cyOf(p).length,bits=[];
    if(n)bits.push(fmtNum(n)+' package'+(n===1?'':'s'));
    if(p.total_units)bits.push(fmtNum(p.total_units)+' units');
    if(p.completeness)bits.push(Math.round(p.completeness*100)+'% complete');
    return '<div class="orow"><b>'+esc(p.name||'(unnamed)')+'</b><span>'
      +esc(bits.length?bits.join(' \u00b7 '):'nothing saved')+'</span></div>';}).join('');
  const held=list.filter(p=>cyOf(p).length).length;
  dialogConfirm('Remove '+fmtNum(list.length)+' record'+(list.length===1?'':'s'),
    '<div class="dlg-sub">The renewal schedule does not carry these, so nothing will bring them back. This cannot be undone.</div>'
    +'<div class="olist">'+rows+'</div>'
    +(held?('<div class="dlg-sub" style="margin-top:9px"><b>'+fmtNum(held)+'</b> of them hold '
      +(held===1?'a package':'packages')+'. Those go too.</div>'):''),
    'Remove them',true,async()=>{
      /* Stop at the first failure rather than carrying on. A partial sweep that
         reported success would leave the menu disagreeing with the database. */
      for(let i=0;i<list.length;i++){
        try{await mpdb.deleteProperty(list[i].id);}
        catch(e){setStatus('');saveFailedModal(e);openMenu();return;}
      }
      setStatus('Removed '+fmtNum(list.length)+' record'+(list.length===1?'':'s')+' the schedule does not carry.');
      openMenu();
    });
}
async function openHapProperty(code){
  const p=hapProperties().find(x=>x.code===code);
  if(!p)return;
  let pid=(mpdb&&mpdb.propByRaCode)?mpdb.propByRaCode(code):null;
  if(!pid){
    try{const r=await mpdb.createProperty(p.name,code);pid=r&&r.pid;}
    catch(e){
      /* The building is already in the record under this name, carrying no
         tracker code — imported by hand, or named before the code existed. The
         schedule's row and that record are the same property, so the code goes
         onto it. Reporting "that name is taken" here made every such property
         unopenable: the only route in was the one that refused. */
      if(e&&e.code==='DUP_PROPERTY_NAME'&&e.pid){
        pid=e.pid;
        try{if(mpdb.setRaCode)await mpdb.setRaCode(pid,code);}catch(_){}
      }else{saveFailedModal(e);return;}
    }
  }
  if(pid)openLauncher(pid);
  return pid;                    // callers chain a package action onto the record it just made
}
/* The card's one action. Every branch goes through the record first, because a
   tracker property has no pid until somebody opens it, and every step after this
   one — the dialog, the cycle, the form — is keyed on activePid. Cancelling the
   dialog therefore leaves you on the launcher, which is somewhere sensible. */
async function primaryActionClick(code){
  const p=hapProperties().find(x=>x.code===code);if(!p)return;
  const a=p.action;
  /* Belt and braces on top of the disabled attribute — a disabled <button>
     fires no click, but the rule reads at the decision site instead of having
     to be inferred from markup. */
  if(!a||a.disabled)return;
  const pid=await openHapProperty(code);if(!pid)return;
  if(a.kind==='view'||a.kind==='continue'){
    if(a.cid){await openCycleForm(a.cid);return;}
    /* the cycle vanished between render and click — fall through to the dialog
       rather than open nothing */
  }
  if(a.kind==='start')
    return newCycleDialog({program:(a.programs[0]||''),effective:a.effective,type:a.type,deadline:a.deadline});
  return newCycleDialog();       // awaiting / gap: the schedule has nothing to prefill, so ask
}
function renderMenu(){
  const q=((el('menuSearch')&&el('menuSearch').value)||'').toLowerCase();
  const hp=hapProperties();
  const lensed=hp.filter(p=>menuLens==='all'||!pmName||p.pm===pmName);
  const orphans=(mpdb.listProperties()||[]).filter(p=>!hp.some(h=>h.id===p.id));
  const all=hp.length?lensed.concat(orphans.map(p=>Object.assign({},p,{hap:false}))):(mpdb.listProperties()||[]);
  /* The rail is conditional on the tracker having supplied properties. With
     none \u2014 ?selftest=1, the node harnesses, any pre-tracker deployment, and the
     RA port, whose build does not concatenate hap.js at all \u2014 the page keeps the
     flat grid it had. That is what stops an empty rail rendering where there are
     no bands to sort into. */
  const hasRail=hp.length>0;
  /* ONE pass. Every count and every card filter reads p._view; the predicate is
     never asked a second time. Counted over the lensed set but BEFORE the search
     query: the lens changes whose work it is, so a manager reading "12" must
     find 12 cards, while search is a find-within and a rail that renumbers under
     the cursor as you type is a moving target. */
  const counts={};
  MENU_VIEWS.forEach(v=>{counts[v.k]=0;});
  if(hasRail)all.forEach(p=>{p._band=bandOf(p);p._view=p._band.view;counts[p._view]++;counts.all++;});
  /* Resolved only while unset. A view chosen explicitly and then emptied STAYS
     chosen and shows its empty state \u2014 finishing the last item in Needs you
     should show you an empty Needs you, not teleport you somewhere else. */
  /* The page opens on everything. The two zones already put what is live at
     the top, so opening pre-filtered hid the portfolio to answer a question
     nobody had asked yet. A view chosen explicitly and then emptied STAYS
     chosen and shows its empty state. */
  if(hasRail&&!menuView)menuView='all';
  /* Searching forces All without overwriting the stored view, so clearing the
     box returns you where you were and "I know it exists, where is it?" cannot
     happen inside a filtered view. */
  const view=q?'all':menuView;
  const inView=p=>!hasRail||view==='all'||p._view===view;
  const props=all.filter(inView).filter(p=>!q||(p.name+' '+(p.alias||'')+' '+p.fha+' '+(p.city_state||'')).toLowerCase().indexOf(q)>=0);
  if(q){const _sc=p=>{const nm=String(p.name||'').toLowerCase();if(nm.startsWith(q))return 0;if(nm.split(/\s+/).some(w=>w.startsWith(q)))return 1;if(nm.indexOf(q)>=0)return 2;const al=String(p.alias||'').toLowerCase();if(al.startsWith(q)||al.split(/\s+/).some(w=>w.startsWith(q)))return 3;return 4;};props.sort((a,b)=>_sc(a)-_sc(b)||String(a.name||'').localeCompare(String(b.name||'')));}
  else if(hasRail)props.sort((a,b)=>String(a.deadline||'9999-99-99').localeCompare(String(b.deadline||'9999-99-99'))||String(a.name||'').localeCompare(String(b.name||'')));
  _menuCounts=counts;
  if(el('menuCount')){
    /* A record with no tracker code is assigned to nobody, so counting it among
       the properties assigned to you overstates your own workload. */
    const tracked=all.filter(p=>p.hap),other=all.length-tracked.length;
    const bits=[];
    if(hasRail){
      /* Scope only. "Needs you" in the rail is the count of what wants doing,
         and it is NOT the same number as overdue+now \u2014 the ones already in
         flight are excluded from it. Printing both under one name is how two
         numbers end up disagreeing in public. */
      bits.push(tracked.length+(tracked.length===1?' property':' properties')+(menuLens==='mine'&&pmName?' assigned to you':''));
      if(menuLens==='mine'&&pmName)bits.push(hp.length+' in the portfolio');
      if(other)bits.push(other+' not in the schedule');
    }else{
      const need=all.filter(p=>p.completeness<1).length;
      bits.push(all.length+(all.length===1?' property':' properties'));
      if(need)bits.push(need+' need'+(need===1?'s':'')+' review');
    }
    /* ---- the figures line ----
       Every figure here is countable on the page below it: the bands are the
       same ones the list is grouped by, so "21 due within 30 days" is the
       length of the band headed "Due within 30 days" and nothing else. They are
       disjoint and they sum to the total. A count the reader cannot verify by
       looking is worse than no count, because they cannot tell whether the
       figure or the grouping is wrong. */
    if(hasRail){
      /* Over every property, not only the tracked ones. Counted over the
         tracked subset the four buckets came to 229 beside a total that
         printed 230, and the rail one column away called two properties
         undated where this line called one — the same word, two answers,
         on one screen. A record the schedule does not carry is undated;
         that is what undated means. */
      el('menuCount').innerHTML=figuresHtml(counts,view);
      document.querySelectorAll('#menuCount [data-view]').forEach(b=>b.onclick=()=>{
        menuView=b.getAttribute('data-view');renderMenu();});
    }else el('menuCount').textContent=bits.join('  \u00b7  ');
  }
  /* Whose work this is, said once, where the control that changes it lives. */
  if(el('menuEyebrow'))el('menuEyebrow').textContent=
    'Portfolio'+(hasRail?((menuLens==='all'||!pmName)?' \u00b7 all managers':' \u00b7 '+pmName):'');
  renderWho();
  if(el('menuLede'))el('menuLede').textContent=hasRail?menuViewCopy(view).lede:'';
  /* The card is a CONTAINER holding two sibling buttons, not a button with
     another inside it. A <button> nested in a <button> is invalid: the parser
     closes the outer element and re-parents the inner one as a sibling, so the
     card loses its bottom half in a real browser while every innerHTML-regex
     assertion still sees exactly what was emitted. Siblings also mean no
     stopPropagation anywhere — and a stopPropagation guarding against a DOM
     shape is the first thing to break when the shape changes — and both halves
     are tab-reachable. */
  const card=(p,_band)=>{const pct=Math.round(p.completeness*100);
    const al=(p.alias||'').trim();const showAl=al&&al.toLowerCase()!==String(p.name||'').trim().toLowerCase();
    /* The gallery is read by scanning it — six cards, and the eye is looking
       for a name and a ring. A sentence under every one of them is a line of
       small grey text per card that nobody reads six of. The caption still
       says what the ring counts; it says it on hover, where a reader who
       wants it asks for it. */
    /* A row with no type still gets a pill — saying so. Rendering nothing put
       the card's most important fact (we cannot read this row) nowhere. */
    const _pg=p.hap?(String(p.program||'').trim()||(p.action&&p.action.kind==='unsupported'?'no type stated':'')):'';
    const prog=_pg?('<span class="pc-prog'+(_pg==='OCAF'?' ocaf':_pg==='RCS'?'':' unk')+'">'+esc(_pg)+'</span>'):'';
    const body='<button class="pc-body" data-open="'+p.id+'"'+(p.caption?' title="'+esc(p.caption)+'"':'')+'><div class="pc-top"><div class="pc-name">'+esc(p.name)+(showAl?'<span class="pc-alias">&ldquo;'+esc(al)+'&rdquo;</span>':'')+'</div></div>'
      +'<div class="pc-meta">'+(p.hap?(esc(p.pm||'Unassigned')+(p.city_state?' &middot; '+esc(p.city_state):'')):(esc(p.fha)+(p.city_state?' &middot; '+esc(p.city_state):'')))+'</div>'
      +(p.hap?dueLine(p):'')
      /* The ledger printed a "Rents effective" header over an empty column. */
      /* Only where the column's own header is true of it. For an expiring or
         abandoned schedule p.action.effective is a CONTRACT EXPIRY, and
         printing it under "Rents effective" restated the due cell one column
         over as a different fact. */
      +'<div class="pc-eff">'+((p.hap&&p.action&&p.action.effective&&p.action.kind!=='expiring'&&p.action.kind!=='gap')?esc(fmtDateShort(p.action.effective)):'')+'</div>'
      +'<div class="pc-div"></div>'
      +'<div class="pc-foot">'+prog
      /* Always the unit count. "Not started" stood here instead, which is the
         progress question the row's own button already answers — and it took
         the slot the size of the job belongs in. */
      +'<span class="pc-units">'+(p.total_units?(fmtNum(p.total_units)+' unit'+(p.total_units===1?'':'s')+(p.unit_types?' &middot; '+p.unit_types+' type'+(p.unit_types===1?'':'s'):'')):'')+'</span>'
      +(p.hap&&!p.started?'':'<span class="pc-upd" title="'+esc(updTitle(p.updated_at))+'">Updated '+relTime(p.updated_at)+'</span>')+'</div></button>';
    /* Short on EVERY row. The full label repeats the programme \u2014 "Start 2026
       OCAF" beside a Program column already reading OCAF \u2014 and it only ever
       differed because rows inside thirty days used to live in a panel with
       twice the width. One label, and the column that holds it is the same on
       every row of one table. */
    return '<div class="pcard"'+(_band?' data-band="'+esc(_band)+'"':'')+'>'+body+actionBtnHtml(p,true)+'</div>';};
  /* A "+ New property" tile sitting inside "Needs you" would imply it belongs to
     that band. #bNewProperty in the toolbar is always there, so the tile appears
     only where it means what it looks like. */
  const newTile='<button class="pcard newcard" id="tileNew"><span class="plus">+</span><span>New property</span></button>';
  const empty='<div class="mempty">No properties match &ldquo;'+esc(q)+'&rdquo;. <span class="link" id="mClear">Clear search</span></div>';
  const viewEmpty='<div class="mempty">'+esc(menuViewCopy(view).empty)+'</div>';
  /* Two populations, and they must be told apart on sight: mixed together, a
     record with no renewal date reads as a property with nothing due. */
  const _tr=props.filter(p=>p.hap),_or=props.filter(p=>!p.hap);
  /* ---- three zones ----
     What is coming leads the page. Behind it, a drawer.

     The flat single-list version this replaces was honest about the calendar and
     wrong about the job: it opened on eighty rows of what is behind, and the
     twenty-one that can actually be worked today sat somewhere down the middle
     of one very long scroll. Matt: "i want those upcoming ones to go back to
     being prominent and taking up the top of the page like it used to be".

     So: a banner saying how many are past due (closed), the live panel, then the
     ledger by month. Opening the banner inserts the past rows between it and the
     panel and compensates the scroll by the height that appeared, so nothing
     below moves — the list comes to exist above you, to scroll up into.

     rank is 0 for everything dated and 9 for everything off the axis, so the
     sort is month order and then the deadline order `props` already carries. */
  const _banded=_tr.map(p=>({p:p,b:p._band||bandOf(p)}));
  _banded.sort((a,b)=>(a.b.rank-b.b.rank)
    ||String(a.b.key).localeCompare(String(b.b.key))
    ||(_tr.indexOf(a.p)-_tr.indexOf(b.p)));
  /* Month headings, emitted over whichever subset a zone holds. Each zone runs
     its own key, so a month split across two of them is named in both: the
     ledger's "August 2026" stands over the August rows the live panel did not
     take, under a zone heading that already said which thirty days it took. */
  const _zone=list=>{let k=null;return list.map(x=>{
    const h=(x.b.key!==k)?('<div class="mgroup">'+esc(x.b.label)+'</div>'):'';
    k=x.b.key;return h+card(x.p,x.b.behind?'past':(x.p.days<=30?'now':'later'));}).join('');};
  const _cols='<div class="mcols"><span>Property</span><span>Program</span>'
    +'<span>Due to HUD</span><span>Rents effective</span><span class="r">Units</span>'
    +'<span></span></div>';
  const _pastRows=_banded.filter(x=>x.b.key!=='none'&&x.b.behind);
  const _liveRows=_banded.filter(x=>x.b.key!=='none'&&!x.b.behind&&x.p.days<=30);
  const _restRows=_banded.filter(x=>x.b.key!=='none'&&!x.b.behind&&x.p.days>30);
  const _offRows=_banded.filter(x=>x.b.key==='none');
  const _pl=n=>fmtNum(n)+(n===1?' property':' properties');

  /* ---- zone 1: the drawer ----
     A drawer only where it has something to hide. Filtered TO what is past, the
     rows ARE the list, and a banner over them would be a control that closes the
     view you just chose. */
  const _drawer=(view!=='past'&&_pastRows.length>0);
  const _pastHtml=_pastRows.length?((_drawer?('<button class="mpast'+(_pastOpen?' open':'')
      +'" id="mPast" aria-expanded="'+(_pastOpen?'true':'false')+'">'
      +'<span class="mp-n">'+(_pastOpen?'\u2191 ':'')+'<b>'+fmtNum(_pastRows.length)
      +'</b> past due to HUD</span>'
      +'<span class="mp-a">'+(_pastOpen?'Hide':'Show them')+'</span></button>'):'')
    +'<div class="mpastwrap" id="mPastWrap"'+((_drawer&&!_pastOpen)?' hidden':'')+'>'
      +'<div class="mgrid rows">'+_cols+_zone(_pastRows)+'</div></div>'):'';

  /* ---- zone 2: what is coming ----
     "Due to HUD by Jul 31" over a row due Aug 1 is a heading asserting something
     its members do not share. The band is a window, so the heading names it. */
  const _liveHtml=_liveRows.length?('<div class="zhead"><h3>Due within '+_bandNow()
      +' days</h3><span>'+_pl(_liveRows.length)+' &middot; earliest deadline first</span></div>'
    +'<div class="mgrid rows live">'+_zone(_liveRows)+'</div>'):'';

  /* ---- zone 3: the rest of the schedule, by month ---- */
  const _restN=_restRows.length+_offRows.length+_or.length;
  const _restHtml=_restN?('<div class="zhead"><h3>'+(_liveRows.length?'Further out':'The schedule')
      +'</h3><span>'+_pl(_restN)+(_restRows.length?' &middot; earliest deadline first':'')+'</span></div>'
    +'<div class="mgrid rows">'+_cols+_zone(_restRows)
    /* Off the axis, so below every month rather than inside the last one — a
       property with no deadline cannot sit on a deadline timeline. */
    +(_offRows.length?('<div class="mgroup">'+esc(_offRows[0].b.label)+'</div>'
      +_offRows.map(x=>card(x.p,'none')).join('')):'')
    /* Named whenever it has members, because the heading carries the only control
       that removes them. Sweeping is offered HERE and nowhere else: the group
       above is IN the schedule and merely has nothing ahead of it, so a sweep
       that took both would delete live properties. */
    +(_or.length?('<div class="mgroup"><span>Not in the renewal schedule</span>'
        +(DEV_PURGE?('<button class="txtbtn del" id="orphPurge">Remove '
          +(_or.length===1?'this record':'these '+fmtNum(_or.length)+' records')+'</button>'):'')
        +'</div>'+_or.map(p=>card(p,'none')).join('')):'')
    +'</div>'):'';
  const _body=_pastHtml+_liveHtml+_restHtml;
  el('menuGrid').className='mzones';
  el('menuGrid').innerHTML=_body+(q&&!props.length?empty:'')
    +((hasRail&&!q&&!props.length)?viewEmpty:'')
    +((!q&&(!hasRail||view==='all'))?newTile:'');
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{const v=b.getAttribute('data-open');
    if(v.indexOf('hap:')===0)openHapProperty(v.slice(4));else openLauncher(v);});
  /* No e.stopPropagation(): the two buttons are siblings, and adding one would
     be a lie about the structure. */
  document.querySelectorAll('[data-pact]').forEach(b=>b.onclick=()=>primaryActionClick(b.getAttribute('data-pact')));
  if(el('orphPurge'))el('orphPurge').onclick=()=>purgeOrphans(_or);
  /* ---- opening the drawer ----
     Compensating the scroll is the whole trick. Inserting eighty rows above the
     live panel would otherwise shove it off the bottom of the screen; measuring
     what appeared and scrolling by exactly that keeps every pixel below the
     banner where it was, and leaves the past list above the viewport for the
     reader to scroll up into.

     Scrolling up while already at the top opens it too — the gesture a PM reaches
     for without being told. Guarded on the wheel pointing up AND the page being
     at the top, so it cannot fire mid-list. */
  const _pb=el('mPast');
  if(_pb)_pb.onclick=()=>_togglePast();
  if(!_menuWheel&&typeof window!=='undefined'&&window.addEventListener){
    _menuWheel=true;
    window.addEventListener('wheel',e=>{
      if(_pastOpen)return;
      const v=el('viewMenu');
      if(!v||v.style.display==='none')return;
      if(e.deltaY<-4&&(window.pageYOffset||0)<=0&&el('mPast'))_togglePast();
    },{passive:true});
  }

  /* Wired here rather than in boot(): the rail is rebuilt on every render, so a
     one-time wiring would go stale on the first click. Clearing the search is
     deliberate — search forces the All view, and a stale query would silently
     override the row just clicked. */
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{
    menuView=b.getAttribute('data-view');
    if(el('menuSearch'))el('menuSearch').value='';renderMenu();});
  const tn=el('tileNew');if(tn)tn.onclick=createProperty;
  const mc=el('mClear');if(mc)mc.onclick=()=>{if(el('menuSearch'))el('menuSearch').value='';renderMenu();};
}
function existingPropByName(nm){nm=String(nm||'').trim().toLowerCase();if(!nm)return null;try{return (mpdb.listProperties()||[]).find(p=>String(p.name||'').trim().toLowerCase()===nm)||null;}catch(e){return null;}}
/* Naming a property something already taken opens that property instead of
   making a twin of it. That is a courtesy, and it always was: the rule itself
   now lives in the data layer (assertNameFree in db.js / db.supabase.js /
   db.cosmos.js), because a check that only runs in this dialog only covers the
   people who came through this dialog. Both readings end in the same place —
   the profile you meant — so the catch says what the pre-check says. */
function createPropNamed(v,pickedId){
  const ex=existingPropByName(v);
  if(ex){openLauncher(ex.id);setStatus('\u201c'+v+'\u201d already exists \u2014 opened its profile.');return;}
  let r;
  try{r=mpdb.createProperty(v,pickedId||'');}
  catch(e){
    if(e&&e.code==='DUP_PROPERTY_NAME'&&e.pid){openLauncher(e.pid);setStatus('\u201c'+v+'\u201d already exists \u2014 opened its profile.');return;}
    saveFailedModal(e);return;}
  openLauncher(r.pid);
}
function createProperty(){
  const props=raProps();
  if(!props.length){dialogInput('New property','Property name','','Create',nm=>{createPropNamed((nm||'').trim(),'');});return;}
  const rows=props.map(p=>'<div class="uaopt" data-raprop="'+esc(p.name)+'" data-rapid="'+esc(p.id==null?'':String(p.id))+'" style="padding:9px 12px;cursor:pointer">'+esc(p.name)+'<span class="uasub">Related Affordable</span></div>').join('');
  modal('<div class="dlg-t">New property</div><div class="dlg-field"><label>Property name</label><input id="dlgIn" autocomplete="off" placeholder="Type a name, or pick a Related Affordable property"></div>'
    +'<div style="margin:10px 0 4px;font-size:11px;font-weight:700;letter-spacing:.4px;color:#8791a5">RELATED AFFORDABLE PROPERTIES \u2014 TYPE ABOVE TO FILTER</div>'
    +'<div id="srcList" style="max-height:200px;overflow:auto;border:1px solid #e0e5ee;border-radius:8px">'+rows+'</div>'
    +'<div class="dlg-row"><button class="btn" id="dlgCancel">Cancel</button><span class="dlg-sp"></span><button class="btn p" id="dlgOk">Create</button></div>');
  const inp=el('dlgIn'),list=el('srcList');let pickedId='';
  const filter=()=>{const q=(inp.value||'').trim().toLowerCase();let vis=0;
    const score=n=>{const s=n.toLowerCase();if(!q)return 0;if(s.startsWith(q))return 0;if(s.split(/\s+/).some(w=>w.startsWith(q)))return 1;if(s.indexOf(q)>=0)return 2;return 3;};
    const rows=[...list.querySelectorAll('[data-raprop]')];
    rows.forEach(r=>{r._sc=score(r.getAttribute('data-raprop'));const on=r._sc<3;r.style.display=on?'':'none';if(on)vis++;});
    rows.slice().sort((x,y)=>x._sc-y._sc||x.getAttribute('data-raprop').localeCompare(y.getAttribute('data-raprop'))).forEach(r=>list.appendChild(r));
    list.style.display=vis?'':'none';};
  inp.addEventListener('input',()=>{pickedId='';filter();});inp.focus();
  list.querySelectorAll('[data-raprop]').forEach(r=>r.onclick=()=>{inp.value=r.getAttribute('data-raprop');pickedId=r.getAttribute('data-rapid')||'';filter();inp.focus();});
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();el('dlgOk').click();}else if(e.key==='Escape')closeModal();});
  el('dlgCancel').onclick=closeModal;
  el('dlgOk').onclick=()=>{const v=(el('dlgIn').value||'').trim();closeModal();
    /* pickedId = the picked RA master-registry id. The Supabase adapter ignores
       the 2nd arg today; the RA port's createProperty(name, raMasterId) uses it
       for the read-only prefill. */
    createPropNamed(v,pickedId);};
}

/* ---- LAUNCHER: property summary + program picker --------------------- */
function openLauncher(pid){activePid=pid;activeCid=null;renderLauncher();show('Launcher');}
function docIcon(){return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c86a2" stroke-width="1.6" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';}
/* On this desk a colour means a deadline, a link or a thing that is done, and
   an increase is none of those — it is the ordinary case, so it is ink. A
   DECREASE is worth naming, and gets the stamp. Separate from liftClr (teal /
   red / slate), which the FORM still speaks and which this pass does not touch. */
const deskClr=n=>n<0?'var(--stamp)':(n>0?'var(--i1)':'var(--i4)');
function rcsAffPane(a){
  if(!a.total_units)return '<div class="aff-empty">Add unit types &amp; rents to see the affordability check.</div>';
  if(a.safmr_missing||!a.ceiling)return '<div class="aff-empty">Enter a 150% SAFMR to run the affordability check.</div>';
  if(!a.priced)return '<div class="aff-empty">Enter the proposed rents to run the affordability check.</div>';
  const partial=a.types_priced<a.types_total;
  const CG=partial?a.cg_priced:a.current_gpr,PG=partial?a.pg_priced:a.proposed_gpr,CEIL=partial?a.ceil_priced:a.ceiling;
  const PASS=CEIL>0&&PG<CEIL,HEAD=CEIL-PG;
  const pCur=CEIL>0?clamp(CG/CEIL*100):0,pPro=CEIL>0?clamp(PG/CEIL*100):0;const dMo=a.delta_mo,dYr=a.delta_yr;
  return '<div class="aff"><div class="aff-top"><span class="aff-k">AFFORDABILITY CHECK</span><span class="aff-pass '+(PASS?'ok':'over')+'">'+(PASS?'&#10003; PASS':'&#10007; OVER')+' &middot; '+money(Math.abs(HEAD))+(PASS?' headroom':' over')+(partial?' &middot; '+a.types_priced+' of '+a.types_total+' types priced':'')+'</span></div>'
    +'<div class="aff-body"><div class="aff-left"><div class="aff-gauge">'+gaugeSegs(pCur,pPro)+'<div class="oend"></div></div>'
      +'<div class="aff-anchors"><span><b>'+money(CG)+'</b><i>current</i></span><span><b>'+money(PG)+'</b><i>proposed</i></span><span><b>'+money(CEIL)+'</b><i>150% ceiling</i></span></div></div>'
    +'<div class="aff-right"><span><b style="color:'+deskClr(a.pct)+'">'+sPct(a.pct)+'</b><i>'+liftWord(a.pct)+'</i></span><span><b style="color:'+deskClr(a.per_unit)+'">'+sMoney(a.per_unit)+'</b><i>per unit</i></span><span><b style="color:'+deskClr(dMo)+'">'+sMoney(dMo)+'</b><i>per month</i></span><span><b style="color:'+deskClr(dYr)+'">'+sK(dYr)+'</b><i>/yr</i></span></div></div></div>';}
/* ---- CYCLES: property-page cards + create picker ----------------------
   A cycle is a complete frozen snapshot (see CYCLES-OCAF-UAF-DESIGN.md).
   The dominant cycle (latest effective date; rent-setting beats UAF-only)
   is elevated, feeds the summary, and is the only cycle whose durable
   saves update the property record. */
const PROG_NAMES={rcs:'RCS',ocaf:'OCAF',uaf:'UAF'};
const MONTHS_LONG=['January','February','March','April','May','June','July','August','September','October','November','December'];
function fmtDateLong(v){v=String(v||'').trim();let y,m,dd;let g=v.match(/^(\d{4})-(\d{2})-(\d{2})/);if(g){y=+g[1];m=+g[2];dd=+g[3];}else{g=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(g){m=+g[1];dd=+g[2];y=+g[3];}}
  return (m>=1&&m<=12)?(MONTHS_LONG[m-1]+' '+dd+', '+y):v;}
function progChips(list){return (list||[]).map(x=>'<span class="cychip">'+(PROG_NAMES[x]||String(x).toUpperCase())+'</span>').join('');}
function cyclePane(c){
  if(c.programs.indexOf('rcs')>=0)return rcsAffPane(mpdb.cycleAnalysis(c.id));
  const G=window.RCSGen;if(!G)return '';
  const cells=mpdb.getFlatCycle(c.id);const rec={};for(const k in cells)rec[k]=cells[k].value;
  let rows='';
  if(c.programs.indexOf('ocaf')>=0){const C=G.ocafCalcRec(rec);let dMo=0;(C.rows||[]).forEach(r=>{if(r.n&&r.c&&C.R>0)dMo+=r.n*(Math.round(r.c*C.R)-r.c);});
    rows+=C.R>0?('<div class="aff-top"><span class="aff-k">OCAF</span><span class="aff-pass ok">\u00d7'+C.R.toFixed(3)+' effective \u00b7 '+sMoney(dMo)+'/mo \u00b7 '+sK(dMo*12)+'/yr</span></div>')
              :'<div class="aff-top"><span class="aff-k">OCAF</span><span class="aff-pass over">worksheet incomplete \u2014 open the package</span></div>';}
  if(c.programs.indexOf('uaf')>=0){const U=G.uafCalcRec(rec);let uaMo=0;U.rows.forEach(r=>{uaMo+=(r.n||0)*(r.newSum-r.curSum);});
    rows+=U.rows.length?('<div class="aff-top"><span class="aff-k">UAF</span><span class="aff-pass '+(U.dec.length?'over':'ok')+'">'+U.rows.length+' unit type'+(U.rows.length>1?'s':'')+' \u00b7 '+sMoney(uaMo)+' UA/mo'+(U.dec.length?' \u00b7 '+U.dec.length+' decrease'+(U.dec.length>1?'s':''):'')+'</span></div>')
              :'<div class="aff-top"><span class="aff-k">UAF</span><span class="aff-pass over">UA components not entered \u2014 open the package</span></div>';}
  return '<div class="aff">'+rows+'</div>';
}
/* The tracker's answer to "what is next here", on the property's own page. It
   goes through hapForPid -> hapProperties -> actionFor, the same derivation the
   card uses, so the two cannot disagree about what the button says.

   The reason sentence is shown as prose here, not only as a title: the card has
   no room for it, the profile does, and an unrecognised increase type or an
   expiring contract is exactly the thing that needs reading properly. */
function nextUpHtml(){
  const p=hapForPid(activePid);if(!p||!p.action||p.action.kind==='none')return '';
  const a=p.action,lab=actionLabel(a),why=actionReason(a);
  /* One fact line, then the deadline underneath it — and the deadline line only
     where there IS a renewal to count down to. Printing both for an expiring
     contract said "Contract expires March 17, 2025" twice, one line under the
     other, because .nu-v and dueLine were both answering "what is next". */
  const scheduled=!!(a.effective&&a.year);
  const v=scheduled?esc(a.type+' · effective '+fmtDateLong(a.effective))
    :a.kind==='expiring'?esc('Contract expires '+fmtDateLong(a.effective))
    :a.kind==='gap'?esc('Schedule ends '+fmtDateLong(a.effective)+(a.contractExp?(' \u2014 the contract runs to '+fmtDateLong(a.contractExp)):''))
    :'Not scheduled';
  return '<div class="nextup"><div class="nu-l">'
    +'<div class="nu-k">NEXT RENEWAL</div>'
    +'<div class="nu-v">'+v+'</div>'
    +(scheduled?dueLine(p):'')
    +(why?'<div class="lh-note">'+esc(why)+'</div>':'')+'</div>'
    +(lab?'<button class="btn p" id="nuGo"'+(a.disabled?' disabled':'')+'>'+esc(lab)+'</button>':'')+'</div>';
}
function cyclesHtml(){
  const cs=mpdb.listCycles(activePid);
  const btn='<button class="btn p" id="bNewCycle" style="margin-bottom:10px">+ Start new package</button>';
  if(!cs.length)return btn+'<div class="lh-note">No packages yet \u2014 start one to work on this property\u2019s renewal.</div>';
  return btn+cs.map(c=>{
    const gen=c.generated&&c.generated.at;
    return '<div class="cycard'+(c.dominant?' dom':'')+'" data-cyopen="'+c.id+'">'
      +'<div class="cy-h">'+progChips(c.programs)+'<b class="cy-t">'+esc(c.label||'(no year)')+(c.effective_date?' \u00b7 effective '+esc(fmtDateLong(c.effective_date)):'')+'</b>'
      +(c.dominant?'<span class="cy-dom">current \u00b7 sets the property record</span>':'')
      +'<span class="cy-st'+(gen?' ok':'')+'">'+(gen?'Package generated':'Draft')+'</span></div>'
      +cyclePane(c)
      +'<div class="cy-act"><button class="txtbtn del" data-cydel="'+c.id+'">Delete</button></div></div>';
  }).join('');
}
function wireCycles(){
  /* Wrapped, not passed by reference: newCycleDialog now takes a prefill, and a
     bare handler would hand it the click event. */
  const b=el('bNewCycle');if(b)b.onclick=()=>newCycleDialog();
  const nu=el('nuGo');if(nu)nu.onclick=()=>{const h=hapForPid(activePid);if(h)primaryActionClick(h.code);};
  document.querySelectorAll('[data-cyopen]').forEach(x=>x.onclick=()=>openCycleForm(x.getAttribute('data-cyopen')));
  document.querySelectorAll('[data-cydel]').forEach(x=>x.onclick=(e)=>{e.stopPropagation();const id=x.getAttribute('data-cydel');
    dialogConfirm('Delete package','This permanently removes the package and its saved data. The property record is untouched.','Delete',true,async()=>{try{await mpdb.deleteCycle(id);renderLauncher();}catch(e){saveFailedModal(e);}});});
}
function bootstrapFirstCycle(p){
  // migration: an existing single-record property becomes its own cycle #1
  window.__cyBoot=window.__cyBoot||{};
  if(mpdb.listCycles(activePid).length||window.__cyBoot[activePid])return;
  if(!(p&&p.total_units>0))return;   // real unit data = a record worth migrating; a fresh name-only property is not
  window.__cyBoot[activePid]=1;
  const m=mpdb.getFlat(activePid);
  const eff=(m['rent_schedule.date_rents_effective']&&m['rent_schedule.date_rents_effective'].value)||'';
  const yr=(String(eff).match(/(\d{4})/)||[])[1]||String(new Date().getFullYear());
  const pid=activePid;
  mpdb.createCycle(pid,{full:true,programs:['rcs'],label:yr,effective_date:eff})
    .then(()=>{if(activePid===pid)renderLauncher();})
    .catch(e=>saveFailedModal(e));
}
/* `pre` is the tracker's answer, handed in by the card's Start button:
   {program, effective, type, deadline}. It PRE-FILLS this dialog rather than
   bypassing it.

   Why a dialog and not a silent createCycle. createCycle writes
   rent_schedule.date_eff_source='custom' and date_eff_custom=<date> for any
   effective_date it is given (db.js / db.supabase.js), and 'custom' means "the
   user typed this". Starting silently would therefore have the app assert a
   hand-entered date for a value nobody ever saw — the silent overwrite the
   design's Provenance section forbids, dressed up as a feature — and would make
   a second path to package creation, which FORM-RULES 17 says has already failed
   four times. One confirming click, on a dialog that shows the date and names
   where it came from, is what is honest under the cell model as it stands. The
   real fix is a rent_schedule.date_eff_hap source row with its own dropdown
   entry, provenance colour and _reviewed grammar; that is its own unit of work.

   UAF is deliberately not pre-ticked: the tracker's Next UA Baseline column is
   empty on all 2853 rows, so it has no opinion about utility allowances and
   asserting one would be inventing data. */
function newCycleDialog(pre){
  let effPh='';try{const _cys=(mpdb.listCycles(activePid)||[]).filter(c=>c.effective_date);
    if(_cys.length){const d=String(_cys.map(c=>String(c.effective_date)).sort().pop());const m=d.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)effPh=m[2]+'/'+m[3]+'/'+((+m[1])+1);}}catch(e){}
  /* Two cards for one question. A year sets its rents by a market study or by
     the published factor, never both, and the old dialog enforced that by
     quietly unticking whichever you had ticked first — a rule you could only
     learn by watching it happen to you. */
  const card=(id,tag,name,sub)=>'<label class="cypg" for="'+id+'">'
    +'<input type="radio" name="cyprog" id="'+id+'">'
    +'<span class="cyc-tag">'+tag+'</span>'
    +'<span class="cyc-n">'+name+'</span>'
    +'<span class="cyc-s">'+sub+'</span></label>';
  modal('<div class="dlg-t">Start new package</div>'
    +'<div class="dlg-sub">'+esc((((mpdb.listProperties()||[]).find(p=>p.id===activePid))||{}).name||'')+(effPh?(' \u00b7 the next one after '+esc(String(effPh).slice(-4))):'')+'</div>'
    +((pre&&pre.effective)?'<div class="lh-note" style="margin:-4px 0 12px">'+esc('The renewal schedule has this as an '+(pre.type||'')+' effective '+fmtDateLong(pre.effective)+'.')+'</div>':'')
    +'<div class="dlg-field"><label>How are the rents being set?</label>'
    +'<div class="cypgs">'+card('cyRCS','RCS','Market reset','A rent comparability study sets the rents. Every fifth year.')
                            +card('cyOCAF','OCAF','Factor adjustment','HUD\u2019s published operating-cost factor sets the rents.')+'</div></div>'
    +'<div class="dlg-field"><label class="cyaddl">And alongside it</label>'
    +'<label class="cyopt cyadd"><input type="checkbox" id="cyUAF"> <span><b>UAF</b> \u2014 revise the utility allowances in the same package</span></label></div>'
    +'<div class="dlg-field"><label>Rents effective (mm/dd/yyyy)</label><input id="cyEff" autocomplete="off" value="'+esc((pre&&pre.effective)?fmtDate(pre.effective):effPh)+'" placeholder="'+esc(effPh)+'"></div>'
    +'<div class="autherr" id="cyErr"></div>'
    +'<div class="dlg-row"><button class="btn" id="dlgCancel">Cancel</button><span class="dlg-sp"></span><button class="btn p" id="dlgOk">Create</button></div>');
  const rcs=el('cyRCS'),ocaf=el('cyOCAF'),uaf=el('cyUAF'),err=el('cyErr');
  if(pre&&pre.program==='ocaf'&&ocaf)ocaf.checked=true;
  else if(pre&&pre.program==='rcs'&&rcs)rcs.checked=true;
  const ce=el('cyEff');if(ce)ce.addEventListener('input',()=>{ce.value=fmtDateInput(ce.value);});
  _dlgEnter=()=>{const ok=el('dlgOk');if(ok)ok.click();};
  /* One radio group. The exclusion is the control's own, not a pair of
     handlers reaching across to each other. */
  el('dlgCancel').onclick=closeModal;
  el('dlgOk').onclick=async()=>{
    const programs=[];if(rcs.checked)programs.push('rcs');if(ocaf.checked)programs.push('ocaf');if(uaf.checked)programs.push('uaf');
    if(!rcs.checked&&!ocaf.checked){err.textContent='Choose how the rents are being set \u2014 a market reset or a factor adjustment.';return;}
    const eff=fmtDateInput((el('cyEff').value||'').trim())||effPh;   // left blank, the package takes the date shown in gray: a year on from the last one
    const label=(eff.match(/(\d{4})/)||[])[1]||String(new Date().getFullYear());
    closeModal();
    try{const r=await mpdb.createCycle(activePid,{programs,label,effective_date:eff});renderLauncher();await openCycleForm(r.cid);_cyFresh=r.cid;}catch(e){saveFailedModal(e);}
  };
}
async function openCycleForm(cid){
  activeCid=cid;_cyFresh=null;
  const cy=mpdb.listCycles(activePid).find(c=>c.id===cid);
  activeProgram=cy?cy.programs.map(x=>PROG_NAMES[x]||x).join(' + '):'RCS';
  _undoStack=[];_undoNR=[];_undoLI=[];_undoPR=[];_undoChain=[];_rcsUpload=null;_rsUpload=null;_rsArm=false;
  await mpdb.setActive(activePid);_rsUpload=rsRecall();_rcsUpload=rcsRecall();await refreshSnap();form=await store.fillForm();
  fixSavedToggles();applyChecklistDefaults();deriveUnits();snapForm();renderFormHeader();renderBody();
  show('Form');window.scrollTo(0,0);
  if(cy&&cy.dominant&&cy.programs.indexOf('rcs')>=0)ensureHudSafmr({});   // auto-pull: dominant RCS cycles only
  if(cy&&cy.programs.indexOf('ocaf')>=0)pullOcafFactor({auto:true});      // year-verified; empty fields only
  if(cy&&cy.programs.indexOf('uaf')>=0)pullUafFactors({auto:true});
}
function renderLauncher(){
  const p=mpdb.listProperties().find(x=>x.id===activePid);if(!p){openMenu();return;}
  const _al=(p.alias||'').trim();const _showAl=_al&&_al.toLowerCase()!==String(p.name||'').trim().toLowerCase();
  const pct=Math.round(p.completeness*100);const a=mpdb.propertyAnalysis(activePid);const lh=mpdb.getLetterhead(activePid);
  const _domCy=mpdb.listCycles(activePid).find(c=>c.dominant);
  const rcsLine=(_domCy&&_domCy.programs.indexOf('rcs')<0)?(_domCy.programs.map(x=>PROG_NAMES[x]||x).join(' + ')+' package &middot; see the package card below'):((a.total_units&&a.proposed_gpr)?((a.pass?'PASS':'OVER')+' &middot; '+sPct(a.pct)+' &middot; '+money(a.proposed_gpr)+'/mo'):(a.total_units?'rents not entered yet':'set up units &amp; rents'));
  const soon=(code,name)=>'<div class="progcard soon"><div class="pg-h"><span class="pg-code">'+code+'</span><span class="soonchip">Coming soon</span></div><div class="pg-name">'+name+'</div></div>';
  const lhIsPdf=String(lh.data||'').indexOf('data:application/pdf')===0;
  const lhSub=lh.data?(lhIsPdf?'PDF letterhead &middot; the tenant notice prints on it full-page':'Property letterhead &middot; reused on every package'):'<span style="color:#b4552d">Not print-ready &mdash; re-upload the letterhead (PDF, PNG or JPG) so it prints on the tenant notice</span>';
  const letter=lh.name
    ?'<div class="letter has"><div class="lh-doc">'+(lh.thumb?'<img src="'+esc(lh.thumb)+'">':docIcon())+'</div><div class="lh-info"><b>'+esc(lh.name)+'</b><i>'+lhSub+'</i></div><div class="lh-act"><button class="btn sm" id="lhReplace">Replace</button><button class="btn sm" id="lhRemove">Remove</button></div></div>'
    :'<div class="letter empty"><div class="lh-doc">'+docIcon()+'</div><div class="lh-info"><b>Add the property letterhead</b><i>Used on the tenant notice &middot; PDF, PNG or JPG, kept with the property</i></div><button class="btn sm" id="lhAdd">Upload</button></div>';
  el('launcherBody').innerHTML=
    '<div class="lhead"><div class="lh-left"><div class="lh-name">'+esc(p.name)+(_showAl?'<span class="lh-alias">&ldquo;'+esc(_al)+'&rdquo;</span>':'')+'</div>'
      +'<div class="lh-meta">'+esc(p.fha)+(p.city_state?' &middot; '+esc(p.city_state):'')+(p.total_units?' &middot; '+fmtNum(p.total_units)+' units':'')+'</div>'
      +(p.entity?'<div class="lh-entity">'+esc(p.entity)+'</div>':'')+'</div>'
      +'<div class="lh-right"><div class="lh-tools"><button class="txtbtn" id="pRename">Rename</button><span class="dotsep">&middot;</span><button class="txtbtn del" id="pDelete">Delete</button></div><div class="lh-prof">'+(profileChip(p)||'<span class="pchip ok">Profile complete</span>')+'</div></div></div>'
    +'<div class="lsec"><div class="lsec-t">Property letterhead</div>'+letter+'<div class="lh-note">The uploaded letterhead appears on the tenant notice. All other letterheads are built into the document templates.</div><input type="file" id="lhFile" accept="image/*,.pdf,application/pdf" style="display:none"></div>'
    +'<div class="lsec"><div class="lsec-t">Packages</div>'+nextUpHtml()+cyclesHtml()+'<div class="progrow" style="margin-top:10px">'+soon('BBRA','Budget-Based Rent Adjustment')+'</div></div>';
  wireCycles();
  bootstrapFirstCycle(p);
  el('pRename').onclick=async()=>{
    // The tenant-facing name lives with the property, not the package, so it is
    // editable from here rather than only inside a form.
    let alias='';try{const fl=await mpdb.getFlat(activePid);alias=(fl&&fl['tenant.property_alias']&&fl['tenant.property_alias'].value)||'';}catch(e){}
    dialogInput('Rename property','Property name',p.name,'Save',async (nm,al)=>{if(!nm)return;
      try{await mpdb.renameProperty(activePid,nm);
        if(al!==undefined&&al!==alias)await mpdb.saveFlat(activePid,{'tenant.property_alias':{value:al,source:'database'}});
        renderLauncher();}catch(e){saveFailedModal(e);}},
      {label:'Also known to tenants as',value:alias,hint:'Optional \u2014 used on the tenant notice when residents know the property by another name.'});};
  el('pDelete').onclick=()=>dialogConfirm('Delete property','This permanently removes <b>'+esc(p.name)+'</b> and its stored record.','Delete',true,async()=>{try{await mpdb.deleteProperty(activePid);openMenu();}catch(e){saveFailedModal(e);}});
  wireLetterhead();
}
function wireLetterhead(){
  const file=el('lhFile');const pick=()=>file&&file.click&&file.click();
  ['lhAdd','lhReplace'].forEach(id=>{const b=el(id);if(b)b.onclick=pick;});
  const rm=el('lhRemove');if(rm)rm.onclick=()=>dialogConfirm('Remove the letterhead?','The stored letterhead is deleted \u2014 the tenant notice will fall back to a generated header (property name + management address) until a new one is uploaded.','Remove',true,async()=>{try{await mpdb.setLetterhead(activePid,'','','');renderLauncher();}catch(e){saveFailedModal(e);}});
  if(file)file.onchange=()=>{const f=file.files&&file.files[0];if(!f)return;file.value='';
    if(f.type==='application/pdf'||/\.pdf$/i.test(f.name)){
      if(f.size>4*1024*1024){dialogConfirm('Letterhead','This PDF is over 4 MB. Export a lighter letterhead PDF (or a PNG/JPG) and upload that.','OK',false,()=>{});return;}
      const rd=new FileReader();rd.onload=async e=>{const u=String(e.target.result||'');
        if(u.indexOf('data:application/pdf')!==0){dialogConfirm('Letterhead','That file could not be read as a PDF.','OK',false,()=>{});return;}
        try{await mpdb.setLetterhead(activePid,f.name,'',u);renderLauncher();}catch(e){saveFailedModal(e);}};
      rd.readAsDataURL(f);return;}
    if(!/^image\//.test(f.type)){dialogConfirm('Letterhead','Upload the letterhead as a PDF, PNG or JPG. (Word files: use File \u2192 Save As \u2192 PDF once, then upload that.)','OK',false,()=>{});return;}
    const rd=new FileReader();rd.onload=e=>makeRender(e.target.result,render=>makeThumb(e.target.result,async t=>{try{await mpdb.setLetterhead(activePid,f.name,t,render);renderLauncher();}catch(e){saveFailedModal(e);}}));rd.readAsDataURL(f);};
}
function makeThumb(dataUrl,cb){try{const img=new Image();img.onload=()=>{const s=Math.min(1,120/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);cb(c.toDataURL('image/jpeg',0.72));};img.onerror=()=>cb('');img.src=dataUrl;}catch(e){cb('');}}
/* print-quality letterhead render — normalized to PNG (gen.js embeds PNG only) */
function makeRender(dataUrl,cb){try{const img=new Image();img.onload=()=>{
  // Print quality: keep up to 3000px on the long side (~270 dpi on letter paper),
  // stepping down only if the encoded PNG would get unreasonably heavy to store.
  const caps=[3000,2200,1500]; let out='';
  for(const cap of caps){ const s=Math.min(1,cap/Math.max(img.width,img.height));
    const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(img.width*s)); c.height=Math.max(1,Math.round(img.height*s));
    c.getContext('2d').drawImage(img,0,0,c.width,c.height); out=c.toDataURL('image/png');
    if(out.length<=5500000) break; }
  cb(out);};img.onerror=()=>cb('');img.src=dataUrl;}catch(e){cb('');}}

/* ---- FORM: open the RCS form for the active property ----------------- */
function nonrevHasData(i){return ['use','br','ba','rent'].some(s=>{const v=get('nonrev.'+i+'.'+s);return v!==''&&v!=null;});}
function ns8HasData(i){return ['br','ba','avg_rent'].some(s=>{const v=get('ns8.'+i+'.'+s);return v!==''&&v!=null;});}
function handleZeroUnitCommit(keys){const zk=keys.find(k=>/^(units|nonrev|ns8)\.\d+\.num_units$/.test(k));
  if(!zk||numf(get(zk))>0)return false;
  const m=zk.match(/^(units|nonrev|ns8)\.(\d+)\./);const fam=m[1],i=+m[2];
  if(fam==='units'&&i===UNITS[0]){setStatus('Cannot commit zero units to the database — the first unit type needs a unit count.');return true;}
  const label=fam==='units'?'unit type':(fam==='nonrev'?'non-revenue unit':'non-Section 8 unit type');
  dialogConfirm('Delete this '+label+' with no unit count?','This row has no unit count. Go back and enter one, or accept — accepting removes this '+label+' and its data from the database. This cannot be undone after saving.','Delete & save',true,async()=>{try{
    Object.keys(form).forEach(k=>{if(k.indexOf(fam+'.'+i+'.')===0)delete form[k];});
    if(fam==='units')UNITS=UNITS.filter(x=>x!==i);
    else if(fam==='nonrev'){NONREV=NONREV.filter(x=>x!==i);if(!NONREV.length){form=store.editForm(form,'nonrev.enabled','');form=await store.saveField(form,'nonrev.enabled');}}
    else{NS8=NS8.filter(x=>x!==i);if(!NS8.length){form=store.editForm(form,'ns8.enabled','');form=await store.saveField(form,'ns8.enabled');}}
    if(mpdb)await(activeCid?mpdb.pruneCycleCells(activeCid,UNITS,NONREV,NS8,PRINCIPALS):mpdb.pruneUnitRows(activePid,UNITS,NONREV,NS8,PRINCIPALS));
    await refreshSnap();renderBody();setStatus('Zero-unit '+label+' deleted and saved.');
  }catch(e){saveFailed(e);renderBody();}});
  return true;}
function unitHasData(i){return ['br','ba','current','proposed','ua_exec','ua_rcs','ua_custom','safmr_hud','safmr_rcs','safmr_custom'].some(s=>{const v=get('units.'+i+'.'+s);return v!==''&&v!=null;});}
function countlessUnits(){return UNITS.filter(i=>numf(get('units.'+i+'.num_units'))<=0);}
async function saveNow(afterSave,fixFirst){clearUncheckedWriteins(['e1','e2','e3','e4','e5','s1','s2','s3','s4','s5','s6']);
  const first=UNITS[0];const fk='units.'+first+'.num_units';let firstFix='';
  if(fixFirst){const c=form[fk];
    if(c&&c.db_value!=null&&c.db_value!==''){store.revertForm(form,fk);firstFix='reverted to its last saved count';}
    else{form=store.editForm(form,fk,'');firstFix='left blank';}}
  /* BEFORE the sweep, not after. A key with no row is invisible to a sweep that
     walks UNITS, and deriveUnits() at the end then turned that same key back
     into a row — which is how a deleted unit type returned holding one figure. */
  deriveUnits();
  countlessUnits().filter(i=>!(fixFirst&&i===first)).forEach(i=>Object.keys(form).forEach(k=>{if(k.indexOf('units.'+i+'.')===0)delete form[k];}));
  NONREV.filter(i=>numf(get('nonrev.'+i+'.num_units'))<=0).forEach(i=>Object.keys(form).forEach(k=>{if(k.indexOf('nonrev.'+i+'.')===0)delete form[k];}));
  PRINCIPALS.filter(i=>!principalHasData(i)).forEach(i=>Object.keys(form).forEach(k=>{if(k.indexOf('principals.'+i+'.')===0)delete form[k];}));
  if(get('ns8.enabled')!=='1'){Object.keys(form).forEach(k=>{if(/^ns8\.\d+\./.test(k))delete form[k];});NS8=[];} // section off: its hidden rows go
  if(get('nonrev.enabled')!=='1'){Object.keys(form).forEach(k=>{if(/^nonrev\.\d+\./.test(k))delete form[k];});NONREV=[];}
  NS8.filter(i=>numf(get('ns8.'+i+'.num_units'))<=0).forEach(i=>Object.keys(form).forEach(k=>{if(k.indexOf('ns8.'+i+'.')===0)delete form[k];}));
  if(!Object.keys(form).some(k=>/^nonrev\.\d+\./.test(k))&&get('nonrev.enabled')==='1')form=store.editForm(form,'nonrev.enabled','');
  if(!Object.keys(form).some(k=>/^ns8\.\d+\./.test(k))&&get('ns8.enabled')==='1')form=store.editForm(form,'ns8.enabled','');
  deriveUnits();
  try{form=await store.saveToDb(form);if(mpdb)await(activeCid?mpdb.pruneCycleCells(activeCid,UNITS,NONREV,NS8,PRINCIPALS):mpdb.pruneUnitRows(activePid,UNITS,NONREV,NS8,PRINCIPALS));}
  catch(e){saveFailed(e);return;}
  await refreshSnap();fixSavedToggles();deriveUnits();if(firstFix==='left blank'&&form[fk])form[fk].source='new';snapForm();clearUndoChain();_pending=null;_pendingSnap=null;if(afterSave)afterSave();
  if(firstFix)setStatus('Saved — but zero units cannot be committed: the first unit type\u2019s count was '+firstFix+'.');}
function requestSave(afterSave){
  const first=UNITS[0];const fk='units.'+first+'.num_units';
  const firstZero=numf(get(fk))<=0&&(unitHasData(first)||String(get(fk)==null?'':get(fk)).trim()!=='');
  const mu=countlessUnits().filter(unitHasData).filter(i=>i!==first);
  const mn=NONREV.filter(i=>numf(get('nonrev.'+i+'.num_units'))<=0).filter(nonrevHasData);
  const ml=get('ns8.enabled')==='1'?NS8.filter(i=>numf(get('ns8.'+i+'.num_units'))<=0).filter(ns8HasData):[];
  const total=mu.length+mn.length+ml.length;
  if(total){const parts=[];if(mu.length)parts.push(mu.length+' revenue');if(mn.length)parts.push(mn.length+' non-revenue');if(ml.length)parts.push(ml.length+' non-Section 8');
    dialogConfirm('Delete '+total+' unit type'+(total>1?'s':'')+' with no unit count?','Saving will remove '+parts.join(', ')+' row'+(total>1?'s that have':' that has')+' entered data but no unit count. This cannot be undone after saving.','Save anyway',true,()=>saveNow(afterSave,firstZero));}
  else saveNow(afterSave,firstZero);}
// New-property checklist default: all §8 boxes on except Scope of repair(2) & Scope of work(4),
// applied as source 'new' (gray/unsaved) only when the property has never saved a checklist.
function applyChecklistDefaults(){if(Object.keys(DBSNAP).some(k=>/^check\.\d+$/.test(k)))return;for(let i=0;i<17;i++)form=store.editForm(form,'check.'+i,(i===2||i===4)?'':'1');}
async function openForm(program){activeProgram=program||'RCS';_undoStack=[];_undoNR=[];_undoLI=[];_undoPR=[];_undoChain=[];_rcsUpload=null;_rsUpload=null;_rsArm=false;await mpdb.setActive(activePid);await refreshSnap();form=await store.fillForm();fixSavedToggles();applyChecklistDefaults();deriveUnits();snapForm();renderFormHeader();renderBody();show('Form');window.scrollTo(0,0);ensureHudSafmr({});}
function renderFormHeader(){
  if(el('hdrProp'))el('hdrProp').textContent=(get('property.name')||'(unnamed property)');
  if(el('hdrProgram'))el('hdrProgram').textContent=activeProgram+' Package';
  const cy=activeCid&&mpdb?mpdb.listCycles(activePid).find(c=>c.id===activeCid):null;
  const wrap=document.querySelector('.progs');
  if(wrap&&cy){
    const on=p=>cy.programs.indexOf(p)>=0;
    const EXCL='RCS and OCAF never share a package \u2014 remove the other first';
    const pill=(p,dis,title)=>'<span class="prog '+(on(p)?'on':'off')+(dis?' dis':'')+'"'+(dis?'':' data-progpill="'+p+'"')+' title="'+title+'">'+PROG_NAMES[p]+'</span>';
    const rcsDis=!on('rcs')&&on('ocaf'), ocafDis=!on('ocaf')&&on('rcs');
    wrap.innerHTML=pill('rcs',rcsDis,rcsDis?EXCL:(on('rcs')?'Remove the RCS from this package':'Add an RCS to this package'))
      +pill('ocaf',ocafDis,ocafDis?EXCL:(on('ocaf')?'Remove the OCAF from this package':'Add an OCAF to this package'))
      +pill('uaf',false,on('uaf')?'Remove the UAF from this package':'Add a UAF to this package')
      +'<span class="prog off dis" title="Coming soon">BBRA</span>';
    wrap.querySelectorAll('[data-progpill]').forEach(x=>x.onclick=()=>toggleCycleProg(x.getAttribute('data-progpill')));
  }
}
async function toggleCycleProg(p){
  if(!activeCid)return;
  const cy=mpdb.listCycles(activePid).find(c=>c.id===activeCid);if(!cy)return;
  const has=cy.programs.indexOf(p)>=0;
  if(!has&&p==='rcs'&&cy.programs.indexOf('ocaf')>=0){setStatus('RCS and OCAF never share a package \u2014 remove the OCAF first.');return;}
  if(!has&&p==='ocaf'&&cy.programs.indexOf('rcs')>=0){setStatus('RCS and OCAF never share a package \u2014 remove the RCS first.');return;}
  const programs=has?cy.programs.filter(x=>x!==p):cy.programs.concat([p]);
  if(!programs.length){setStatus('A package needs at least one program.');return;}
  try{await mpdb.setCyclePrograms(activeCid,programs);}catch(e){saveFailedModal(e);return;}
  activeProgram=programs.map(x=>PROG_NAMES[x]||x).join(' + ');
  renderFormHeader();renderBody();
  setStatus((has?PROG_NAMES[p]+' removed from this package.':PROG_NAMES[p]+' added to this package.'));
  if(!has&&p==='ocaf')pullOcafFactor({auto:true});
  if(!has&&p==='uaf')pullUafFactors({auto:true});
  if(!has&&p==='rcs')ensureHudSafmr({});
}

/* ---- EXIT: save or discard, then back to the menu -------------------- */
/* Re-baseline only what was actually written. Called bare, this snapshot took
   EVERY key at its current in-memory value — so saving one field with Enter also
   declared every other pending edit "already saved". isDirty() went quiet, the
   unsaved-changes tag went out, and leaving discarded that work without asking. */
function snapForm(keys){if(!FORMSNAP||!keys||!keys.length){FORMSNAP=snapOf(Object.keys(form));return;}
  const s=snapOf(keys);Object.keys(s).forEach(k=>{FORMSNAP[k]=s[k];});}
function isDirty(){if(!FORMSNAP)return false;const keys=new Set([...Object.keys(form),...Object.keys(FORMSNAP)]);for(const k of keys){const fv=form[k]?(form[k].value==null?'':String(form[k].value)):'';const sv=FORMSNAP[k]?(FORMSNAP[k].value==null?'':String(FORMSNAP[k].value)):'';if(fv!==sv)return true;}return false;}
function refreshFooter(){const t=el('unsavedTag');if(t)t.classList.toggle('on',isDirty());syncFooterRest();}
function requestExit(){if(isDirty())openExit();else exitForm();}
/* Where the exit flow should land. Leaving the form normally goes back to the
   property; the home button sets this so the SAME prompt — unsaved edits, an
   unsaved package — carries you all the way out instead. */
let _exitTo=null;
async function exitForm(){
  // a cycle created this session and never saved is deleted on the way out
  if(activeCid&&_cyFresh===activeCid){const cid=activeCid;_cyFresh=null;try{await mpdb.deleteCycle(cid);}catch(e){}}
  const to=_exitTo;_exitTo=null;
  if(to==='menu')openMenu();else openLauncher(activePid);
}
/* The masthead is a home button everywhere except the sign-in screen. From the
   form it asks about unsaved work first, exactly as the exit control does. */
function goHome(){
  const fv=el('viewForm');
  if(fv&&fv.style&&fv.style.display!=='none'){_exitTo='menu';requestExit();return;}
  _exitTo=null;openMenu();
}
function wireHome(){document.querySelectorAll('#viewMenu .brand,#viewLauncher .brand,#viewContacts .brand,#viewForm .hdr>div:first-child').forEach(b=>{
  b.classList.add('homebtn');b.setAttribute('role','button');b.setAttribute('tabindex','0');
  b.setAttribute('title','Back to all properties');
  b.onclick=goHome;
  b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();goHome();}};});}
function openExit(){const nm=get('property.name')||'this property';
  const fresh=activeCid&&_cyFresh===activeCid;
  const body=fresh?'This package was never saved \u2014 leaving without saving deletes it.':'You have unsaved edits to <b>'+esc(nm)+'</b>. Save them to the database so they pre-fill your next submission, or discard them and keep the last saved record.';
  modal('<div class="dlg-t">Save changes before leaving?</div><div class="dlg-b">'+body+'</div><div class="dlg-row"><button class="btn" id="dlgKeep">Keep editing</button><span class="dlg-sp"></span><button class="btn danger" id="dlgDiscard">'+(fresh?'Delete package':'Discard changes')+'</button><button class="btn p" id="dlgSave">Save &amp; exit</button></div>');
  el('dlgKeep').onclick=()=>{_exitTo=null;closeModal();};
  el('dlgDiscard').onclick=async()=>{form=await store.fillForm();await refreshSnap();fixSavedToggles();deriveUnits();snapForm();clearUndoChain();closeModal();await exitForm();setStatus('');};
  el('dlgSave').onclick=()=>requestSave(()=>{closeModal();openLauncher(activePid);});
}

/* ---- generation (client-side, offline via pdf-lib) ------------------- */
const LOGO_B64="iVBORw0KGgoAAAANSUhEUgAAA0MAAAC8CAYAAAC67HW+AAAACXBIWXMAAC4jAAAuIwF4pT92AAAQpklEQVR4nO3dTXLcRpoG4A8T3lNzAmpOIHqHnconMOcE4iyxavoEgk5geVXLpk4w1Ama3NWuqRN06QRDngCzKJRbkkVJRCYKKOTzRDCa7nBmpSQLxJtf/lRd1wUAAEBp/mPqAQAAAExBGAIAAIokDAEAAEUShgAAgCIJQwAAQJGEIQAAoEjCEAAAUCRhCAAAKJIwBAAAFEkYAgAAiiQMAQAARRKGAACAIglDAABAkYQhAACgSMIQAABQJGEIAAAokjAEAAAUSRgCAACKJAwBAABFEoYAAIAiCUMAAECRhCEAAKBIwhAAAFAkYQgAACiSMAQAABRJGAIAAIokDAEAAEUShgAAgCIJQwAAQJGEIQAAoEjCEAAAUCRhCAAAKJIwBAAAFEkYAgAAiiQMAQAARRKGAACAIglDAABAkYQhAACgSMIQAABQJGEIAAAokjAEAAAUSRgCAACKJAwBAABFEoYAAIAiCUMAAECRhCEAAKBIwhAAAFAkYQgAACiSMAQAABRJGAIAAIokDAEAAEUShgAAgCIJQwAAQJGEIQAAoEjCEAAAUCRhCAAAKNJPUw/gkKq6OYuIZ1OP40hsu816O/UgAABgLEWFoYh4GxEvpx7EkXgTEe2hP7Sqm1VE/OPQnzuiDxFx339/039/FxF33WZ9/1ijOVjgn0WSbrOucvZX1U0bEa8HNv+l26xv8o2GVFXdXETE3zN09Z9TPxuqurkJPytT3Xab9SpHR1XddDn6WYisz74j+jn3ELt3h+j/d/8uce9nQbrSwhAc2otPvv/s5aKqm4+xe5hdR8SNShwctTZTP5cZ+wKW4ST+/Q7x5btExG7i9S52k67eJ55IGILpnPZfv0ZEVHXzIXbVy+upZ4aBH9dXhU4zdXdZ1c1bzwDgCV70X68i/pxsvY6Iq26zvvtWQxygAHPyInbLbLZV3bRV3djfBsehzdjXSeyqQwBDnUbE3yLin1Xd7N8pnk88ptkShmB+TmK3l+SuqpvzqQcDPC5zVWjv0mQIkMlp7N4p/lXVzZVQ9FfCEMzXaUT8b1U3b6ceCPCodoQ+VYeAMbwKoegvhCGYv79VdXM19SCAz41UFdpTHQLGsg9FluSHMATH4pVABLPTjti36hAwtv2S/LOpBzIlYQiOx6v+bhpgYiNXhfZUh4CxncbuoIViJ1+EITgur0ufwYGZaA/wGScR4RAV4BB+L3UFijAEx8eBCjChA1WF9toDfQ5AkUvyhSE4Pi+rullNPQgoWHvAzzrtwxfAIRQXiH6aegCQ0buIuJrw85/3XxERzyLirP/nMWaQLyPiZoR+c3mICLdesziJVaF30d8Q/0RtHPbZNoe/u89j+O/zx4jYZhvJMHP4PYyIuJ16AJndTz2AT4zx39mz2F3APrVXVd1Et1lfTD2QQxCGWJJtt1nfTD2IL/UboFexW/s/5EXoa36t6uZZt1nP6QfDp+66zXo19SBgBBcD272P3STGeez2Aj3FaVU3F91mfTXws5+k26wn30jdHxbzemDzq26zbvON5nh5Do9q9P/OPlkFcha7oLTqv3/qM2SIV1Xd3HWb9eKX5gtDMLI+sFxHxHV/WksbEX/L0PV5TFsJg6L0LyYvBzZ/223W91XdXMdxVIeAiX0ywXvz6f/fX5h6Fv+eaB1rD+PvVd3cdJv1XCqdo7BnCA6o26zv+1nXX2K3lCzFKn1EwBO0A9vdfvJSM7QPe4eAiIjoNuttt1lfd5v1ZbdZP4+InyPij9gt3cvteulH/AtDMIH+xSj1yFxHbMOBJFaF2v033Wa9jd3eoaR+APa6zfruk2D0P5E3FJ3Gwi+AFoZgIn0gGvpSFDGPTZZQinZgu49f2cs4tK/Tqm7cOwQ8qtusr/pQ9Fukr0DZe90vzVskYQimlbQxcckPJ5iLXFWhvb469H5gf4ueoQXy6A8+OIuID5m6bDP1MzvCEEyo35SYUs5+nmkowOPage0+fuMEuKETIe4ZA35Iv7foLNJWoey9WuoErDAE09tOPQDg63JXhfb6pXND74B5tF+AL/X3BeUIRIusTAtDML2bqQcAPKod2O7hB+4FGtq36hDwJH0gSr2E9yJ9JPMjDAHAV6TeK/S9f6GvDg1dz98ObAeU6zzSDlU4WeIhLsIQAHxdO7DdQ/z4niB7h4CD6C+BT13qJgwB2T2fegDA51KrQv1Lx3f1S+mGHqLSDmwHFCrxmRMhDAEjSLk89YdeuIAnaxPaPrXaM/SzVIeAIdqEtidV3Szq0ndhCCZU1c2zSLg8tT+aG8gosSr07kerQnv9TO3QdfwXA9sBhUp85kRErPKMZB6EIZhWytrdXBepAZ9rJ2g7dO/QYu/+AEZ1ndB2lWsQcyAMwUT6qlBKGFIVgswyVIW2A9u+jeEzte3AdkC5UsLQ81yDmIOfph4AlKgPQjcRcZLQzU2WwYzj2RHuZbi37JBIW3Y2tLoT3WZ9X9XN24h4PaD5q6pu2oQgxkId4XN4f+Q847tJaDt4ef8cCUNwYP3Gw6tIf5ikzOqM7UVE/GPqQTzRbSys9M/T9MvNXg1sfpshTA8NQxG76tBF4uezPMf2HI6IqKYeQAn6CZiPEXE6pH1VN2dLmUC0TA4OpKqbVVU3VxHxz0gPQk/epA18VztR24j48w6QdwOb2zsEPNU2oe2zXIOYmsoQZNYvgTuL3YPirP9aRdqSuC9dZewLipehKnSTaShtwjjaUB0CftxdDN8jKQzBDL2u6mboEpNjkvPFC9hpE9oO3iv0pW6z3lZ18y6GBSJ7h4CnSFlhchbzXq7/wyyTg+NzMfUAYEkSq0Ifu8069wtBSrhqcw0CoATCEByXN2Z9Ibt2orZf1W9Kvh3Y/LxfqgvwPTdTD2AOLJOb1i+WO/EEt91m3U49CFiSDFWhq3yj+Uwbw04CO4nd/WVtzsEALJXKEByHDxFxPvUgYIHahLbZ9gp9qZ8oG1odulQdAvgxwhDM34eIWDlKG/JKrAo9xPinOg4NW/vqEADfIQzBvL0PQQjG0ia0fTv238v+YIaPA5urDgHfczb1AOZAGIJ5eoiI37rN+lwQgvwyVIVGWyL3hXZgO9Uh4HtMmIQDFGapqpvV1GOIiK1TyybzPiIu/f7DqNqEtleHmqToNuurqm7aiDgd0PyyqpvRK1hAkW6mHkAuwtA8DTlBKLc34TSiQ3sXu6U3d1MPJIOPMf5+ity2Uw+Aw0isCkUcriq010bE3we0c7Icb6YeALO2mnoAcyAMwXQeYjezch0R1wubvd06BpwZaxPavpugansduwB2MqCtMFQwz2G+I2WZ3DbXIKYmDMHhPMTuxWQbliHCJDJUhdo8I/lx3WZ9X9XN24h4PaD5SVU3FyPehwQcof6AlRdD2y/pHUYYYkluY7w1rGcR8WtiHycR8cxFuzCpNrH9v6q6yTGOQ2rj+JatAuNaJbT9kGsQcyAMsSQ3Yy4JqOrmLhJmUXq/V3Vzs5B9QXBU+pnQEi8vPlUdAr6wSmi7qHcYR2vDjzuP3VK3VNfu/4BJXMawfTdL0E49AGBWUiaGhCEoUb8+9iJDV6dhyQocVD8BUfK9O6dV3VxMPQhgelXdnMew4/r3bjINZRaEIXiC/kb4PzJ09WtVNyW/mMGhlVwV2munHgAwCynvHw9LW+ovDMETdZv1ZeTZPPh7VTdnGfoBvkFV6E+qQ1C4qm5WEfEyoYvrTEOZDWEIhrkI+4fgWKgK/Vs79QCAafTvG1eJ3QhDQERfIs4x02z/EIxIVegvTvuZYaA8byNtr9BDv11gUYQhGKg/pvZdhq7sH4LxqAr9VTv1AIDD6pfIplw4HbELU4sjDEEa+4dgplSFHvVSdQjK0Qehv2fo6ipDH7MjDEGCbrO+D/uHYK5UhR7XTj0AYHxV3bSRJwi9668YWRxhCBL1+4faDF2dxgI3JsIUVIW+S3UIFqyqm2dV3dxExOtMXbaZ+pmdn6YeACxBt1m/7V8sfk3s6mVVN223Wbfpo4KipVSFHuJ4blh/FhEvBrZtI2KVbSTALPTVoJyV8TdLrQpFCEOQ00XsXqBSTmqJiHhd1c1Nt1nfJI8ICpShKnTZH5Aye/2v9f8GNn9Z1c3KswaOX/8suIjdsy/1PeRTH2OhByfsWSYHmfT7h84zdWf/EAyXVBU6liAU8edzJ+VUyzbTUIAJVHVzXtXNVewmRX6PvEEoIuKif84slsoQZNRt1ndV3fwWuwdSipPY7R9aJQ8KCpKhKnSMM6BtDD8y92VVN2f93kdg5vol+fuvlyN/3B8lVI6FIcis3z90HukPKfuHeMxZVTdTj2EM2wzr0lP3Ch1dGOo2621VN+9j+J7Fy9gtrwEm9snBJs8iYn/lxioinkf+qs+33HabdRGH0AhDMI7ziNhG+ubFY90/9LKqm27qQYzgl5n8WaRWHufqTaQv27pIaHt1xMtB3sbwMPSqn3jZZhwPM7DQ5/CbmUwSvq7qJtdJbXPzIfIt+589e4ZgBPYPweH1FwumzJweXVVorw/ptwldtHlGAhy5DxGxOuKJoScThmAk/cvJmwxd7fcPAd/WJrRdwoWCVwltX1V18zzTOIDjVFwQihCGYFR9KT9ltnbvZX9vAPAVGapCbZ6RTKc/Be9jQhdtnpEAR6jIIBQhDMEhXMRuY3aq126Mh0e1CW1vF1AV2msT2qoOQZn+6DbrsxKDUIQwBKPrX7IuMnVn/xB8QVXoM9eRNvnSZhoHMH8PEfHfpZwa9xhhCA6g26yvI+KPDF3ZPwR/1Sa0/TCTEwKz6Gd2Uw6CUB2CMryLiOf9+0nRhCE4kH7m5UOGruwfgl7JJ8h9Q+qvqehZYli424j4udusL0pdFvclYQgO6zzsH4Kc2oS2H/tDBxalf8F5l9DFheW4sDjvY3dX3qrbrO+mHsycCENwQPYPQT72Cn1Tm9D2JFSHYAk+xm6J/n91m/X5kpYE5yQMwYH163NTZm337B+idG1C24dY8N+ffuLlfUIXlyZb4CjtA9DP3Wb9vNusLxd0WuYofpp6AFCoy4g4i4gXif28rOqm7e8zgmLk2CtUwHr5txHx68C2++pQm200wBhuI+Ku/7oRfJ6utDA0tzWSj/0gznFJZ6rtRJ97H8N//duM4xhVt1nf9y9zOTZvr6q6ORthDXDKn8VS5Xx53obf3y9tn/DvriLt92+JByd8ptusb6q6eRcRzwd2cZZxOE+1jQJ+Fvwgz4nPbTP2dUw/57b9133s3mfv7f3Jo+q6buoxAAAAHJw9QwAAQJGEIQAAoEjCEAAAUCRhCAAAKJIwBAAAFEkYAgAAiiQMAQAARRKGAACAIglDAABAkYQhAACgSMIQAABQJGEIAAAokjAEAAAUSRgCAACKJAwBAABFEoYAAIAiCUMAAECRhCEAAKBIwhAAAFAkYQgAACiSMAQAABRJGAIAAIokDAEAAEUShgAAgCIJQwAAQJGEIQAAoEjCEAAAUCRhCAAAKJIwBAAAFEkYAgAAiiQMAQAARRKGAACAIglDAABAkYQhAACgSMIQAABQJGEIAAAokjAEAAAUSRgCAACKJAwBAABFEoYAAIAiCUMAAECRhCEAAKBIwhAAAFAkYQgAACiSMAQAABRJGAIAAIokDAEAAEUShgAAgCIJQwAAQJGEIQAAoEjCEAAAUCRhCAAAKJIwBAAAFEkYAgAAivT/tqNfP0iEke0AAAAASUVORK5CYII=";
function b64ToBytes(b64){if(!b64)return null;try{const bin=atob(b64);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a;}catch(e){return null;}}
function dlFile(bytes,name,mime){const blob=new Blob([bytes],{type:mime||'application/octet-stream'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1500);}
function dlPdf(bytes,name){dlFile(bytes,name,'application/pdf');}
function formRec(){const rec={};for(const k in form)rec[k]=form[k].value;return rec;}
function dataUrlToBytes(u){try{const i=String(u||'').indexOf(',');if(i<0)return null;return b64ToBytes(u.slice(i+1));}catch(e){return null;}}
async function combinePdfs(list){const {PDFDocument}=window.PDFLib;const out=await PDFDocument.create();for(const b of list){if(!b)continue;const src=await PDFDocument.load(b,{ignoreEncryption:true,parseSpeed:Infinity});const pages=await out.copyPages(src,src.getPageIndices());pages.forEach(p=>out.addPage(p));}return await out.save({objectsPerTick:Infinity});}
/* What each document cannot be written without. Generating regardless produced
   real sentences like "submitting to in support of our request", "Dear ,", and a
   bare "7." — a package that looks finished and is not. Anything short of its
   requirements is offered as blocked, naming exactly what it needs, rather than
   generated broken. Optional details (a half-entered address, a missing phone)
   are NOT listed: those degrade cleanly. */
/* Required vs suggested, audited document by document against what gen.js
   ACTUALLY prints — not against what seemed obvious. REQUIRED means the document
   is wrong or unfileable without it; SUGGESTED (docWarns) means it still files
   but says less. Every entry below names the hole it leaves on the page.

   The old table was thin enough that all five letters could generate with an
   empty signature block, because only the checklist asked for a signatory. */
/* The requirement tables, the caveats and the score itself live in score.js —
   one computation the form, the menu and the launcher all read, because the ring
   used to answer to ten durable keys while the documents answered to this table,
   and a property could read 100% with two documents unbuildable. These wrappers
   are all that is left here: they bind the score to THIS form's reader. */
function scoreCtx(){
  let lh=null;try{lh=mpdb&&mpdb.getLetterhead?mpdb.getLetterhead(activePid):null;}catch(e){}
  return {programs:cycleProgs(),units:UNITS,checklistLen:CHECKLIST_FLAT.length,
    hasLetterhead:!!(lh&&lh.name),hasStudy:!!_rcsUpload,hasCaPkg:!!_rcsUpload,
    rateType:get('ocaf.rate_type'),uafDec:uafAnalysis().dec.length};}
function docMissing(id){return window.RCSScore.docMissing(get,scoreCtx(),id);}
function docWarns(id){return window.RCSScore.docWarns(get,scoreCtx(),id);}
function packageScore(){return window.RCSScore.packageScore(get,scoreCtx());}
function packageDocs(){return window.RCSScore.packageDocs(scoreCtx());}
/* Go to the cell that fixes a gap — the one whose name was clicked, not just the
   section holding it. Landing on a section and focusing whatever input came
   first meant "CA organization" could put the cursor in the CA contact name.

   It rests a third of the way down rather than centred: you are about to work
   DOWNWARD through the section, so the space below the field is the useful
   space, and a third also clears the sticky command bar without wasting the top
   of the screen. scrollIntoView cannot express that, so the offset is computed. */
const GOTO_FRACTION=1/3;
function gotoSection(n,key){
  const vs=visibleSections();const i=vs.indexOf(n);
  const cards=document.querySelectorAll('#sections .card');const card=cards[i>=0?i:0];
  if(!card)return;
  card.classList.remove('collapsed');
  let target=null;
  if(key){try{target=card.querySelector('[data-k="'+CSS.escape(key)+'"]')||document.querySelector('[data-k="'+CSS.escape(key)+'"]');}catch(e){}}
  const box=target?(target.closest('[data-box]')||target):card;
  const top=box.getBoundingClientRect().top+window.scrollY;
  window.scrollTo({top:Math.max(0,top-window.innerHeight*GOTO_FRACTION),behavior:'smooth'});
  // a moment of emphasis, so it is obvious which cell you were sent to
  box.classList.add('gotohl');setTimeout(()=>box.classList.remove('gotohl'),1500);
  if(target)setTimeout(()=>{try{target.focus({preventScroll:true});}catch(e){}},420);
}
/* Shared by both package dialogs — the RCS one and the OCAF/UAF one — because
   a reader should not have to learn two answers to the same question.

   WHERE IT WAS SUPPOSED TO COME FROM, answered per field rather than in
   general. "Ownership entity" still empty after reading a schedule that
   carries it is a different problem from "CA organization", which no document
   has ever carried — and the dialog presented both as the same blank, which is
   how an afternoon went into asking why the sources had not filled cells the
   sources do not hold. It names the source when one is loaded and has the
   value, names the document when one would hold it but none is uploaded, and
   says plainly when nothing but a person will ever fill it. */
const RS_CARRIES=/^(units$|property\.(name|fha|s8)|owner\.entity|sig\.(name|title|principal)|principals\.|rent_schedule\.date_eff|units\.\d+\.(br|ba|label|num_units|current|ua_exec)|ns8\.|nonrev\.)/;
const RCS_CARRIES=/^(appr\.|poc\.|units\.\d+\.(proposed|ua_rcs|safmr_rcs|num_rcs|br_rcs|ba_rcs))/;
/* Part F (ownership entity and type) and Part G (principals, signature) are
   on the second half of HUD-92458. Everything else the schedule gives us —
   the name, the FHA number, the effective date, the whole unit mix — is on
   the first. */
const RS_PAGE2=/^(owner\.entity|sig\.|principals\.)/;
const whyShort=(k,own)=>{
  if(own)return own;      // an entry that already knows its own answer
  if(!k)return '';
  let v=null;try{v=rsVal(k);}catch(e){}
  try{if((v==null||v==='')&&rsOffers(k))v='\u2713';}catch(e){}
  if(v!=null&&v!=='')return 'On the RS \u2014 press \u201cFill form from RS\u201d';
  let c=null;try{c=rcsOf(k);}catch(e){}
  if(c!=null&&c!=='')return 'In the study \u2014 press \u201cFill form from study\u201d';
  if(RS_CARRIES.test(k)){
    if(!_rsUpload)return 'On the RS \u2014 none uploaded yet';
    /* Parts F and G sit on the second half of the form. If that half was never
       placed, the field is not blank on the document — we never read it. */
    if(RS_PAGE2.test(k)&&_rsUpload.parsed&&_rsUpload.parsed.halfB)
      return 'On the RS \u2014 its second half could not be read';
    return 'Not filled by the RS \u2014 enter by hand';}
  if(RCS_CARRIES.test(k))return _rcsUpload?'Not filled by the study \u2014 enter by hand':'In the study \u2014 none uploaded yet';
  /* The commonest answer by far, and printed on every line it turned the
     card into six copies of one sentence — which is how the dialog got too
     full in the first place. Silence here IS the answer: a field with no
     note is a field only a person can fill, and the ones that DO carry a
     note are the ones worth reading. */
  return '';
};
const gpf=(x,cls)=>{
  const w=whyShort(x.key,x.why)||(x.sec?(SECTION_TITLES[x.sec]||secRef(x.sec)):'');
  const body='<span class="gpf-n">'+esc(x.label)+'</span>'+(w?'<span class="gpf-w">'+esc(w)+'</span>':'');
  /* No section means no journey. The letterhead is uploaded on the property
     page, and an entry offering to travel to "Section 0" landed on Section 1,
     which is not where it lives. */
  if(!x.sec)return '<span class="gpf gpf-flat'+(cls||'')+'">'+body+'</span>';
  return '<button class="gpf'+(cls||'')+'" data-goto="'+x.sec+'" data-gotok="'+esc(x.key||'')+'" title="Go to '+esc(secRef(x.sec))+'">'+body+'</button>';};
/* One popover per document, on the count itself. Six rows of fixed height say
   which documents you can take away; what each one is short of is one hover
   behind the number, where it does not have to compete with that answer. */
const pop=(req,sug)=>{
  if(!req.length&&!sug.length)return '';
  return '<span class="gpw"><button type="button" class="gshort'+(req.length?'':' gshort-s')+'" aria-haspopup="true">'
    +(req.length?((req.length===1?'1 field':req.length+' fields')+' short'):(sug.length+' suggested'))
    +'</button><div class="gpop"><div class="gpop-in">'
    +(req.length?'<div class="gpop-h">Required</div><div class="gpop-l">'+req.map(x=>gpf(x,'')).join('')+'</div>':'')
    +(sug.length?'<div class="gpop-h'+(req.length?' gpop-h2':'')+'">Suggested</div><div class="gpop-l">'+sug.map(x=>gpf(x,' gpf-s')).join('')+'</div>':'')
    +'</div></div></span>';};

/* One row per document: a tick and a download, or a dash and the count that
   opens its list. Shared for the same reason the popover is. */
function gdocRows(ORDER,byLabel,blkBy,warnOf,extraWarn,gapOf){
  return ORDER.map(function(lab){const hit=byLabel[lab];
    const req=hit?[]:(gapOf?gapOf(lab):((blkBy[lab]||{}).missing||[]));
    const sug=[].concat(((warnOf||{})[lab])||((blkBy[lab]||{}).warns)||[],(extraWarn||{})[lab]||[]);
    if(hit)return '<div class="gdoc gdoc-on" role="button" tabindex="0" data-dldoc="'+hit.i+'" title="Download '+esc(lab)+'"><span class="gtick">\u2713</span>'
      +'<span class="gdoc-n">'+esc(lab)+'</span><span class="gdoc-need">'+pop([],sug)+'</span>'
      +'<span class="gdoc-a">Download</span></div>';
    return '<div class="gdoc gdoc-off"><span class="gtick gtick-off">\u2013</span>'
      +'<span class="gdoc-n">'+esc(lab)+'</span>'
      +'<span class="gdoc-need">'+pop(req,sug)+'</span></div>';}).join('');}
/* The rows are download buttons and the counts sit inside them, so reaching for
   a list used to download the document. Wired once, for both dialogs. */
function wirePkgRows(docs){
  document.querySelectorAll('[data-dldoc]').forEach(function(b){
    const go=function(){const d=docs[+b.getAttribute('data-dldoc')];dlPdf(d.bytes,d.file+'.pdf');};
    const inPop=function(e){return !!(e.target&&e.target.closest&&e.target.closest('.gpw'));};
    b.onclick=function(e){if(inPop(e))return;go();};
    b.onkeydown=function(e){if(inPop(e))return;if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();go();}};});
  const placePop=function(w){
    const p=w.querySelector('.gpop');if(!p)return;
    p.classList.remove('gpop-up');
    const inner=p.querySelector('.gpop-in');if(!inner)return;
    /* Measured with the card laid out. A hidden element has no height, and the
       press route adds .open only AFTER this runs — so measuring what is on
       screen at the time gave zero, and the flip never fired. */
    inner.style.maxHeight='';
    let h=inner.offsetHeight;
    if(!h){const d=p.style.display;p.style.display='block';h=inner.offsetHeight;p.style.display=d;}
    const r=w.getBoundingClientRect();
    /* Downward is bounded by the top of the DOWNLOAD block, not the bottom of
       the dialog: the dialog's bottom is below its own buttons, so a card can
       fit inside the dialog and still land on the primary action. Upward is
       bounded by the top of the window — flipping up was half an answer, and on
       a short window the card then ran off the top behind the browser chrome,
       which is worse than covering a button. */
    const act=document.getElementById('dlFolder')||document.querySelector('#dialog .gpair')||document.querySelector('#dialog .dlg-row');
    const dlg=document.getElementById('dialog');
    const floor=Math.min(act?act.getBoundingClientRect().top:(dlg?dlg.getBoundingClientRect().bottom:window.innerHeight),window.innerHeight);
    const below=floor-r.bottom-10, above=r.top-10;
    const up=h>below&&above>below;
    if(up)p.classList.add('gpop-up');
    /* Capped to the room on the side it took, so it is always whole on screen.
       .gpop-in scrolls inside itself when a document is short of more fields
       than the window has height for. */
    const room=Math.max(120,Math.floor(up?above:below));
    if(h>room)inner.style.maxHeight=room+'px';};
  document.querySelectorAll('.gpw').forEach(function(w){
    w.addEventListener('mouseenter',function(){placePop(w);});
    w.addEventListener('focusin',function(){placePop(w);});});
  /* The gap list's tail pins the same way the checks summary does. */
  document.querySelectorAll('.chkmore,.gpmore').forEach(function(m){m.addEventListener('click',function(e){
    e.stopPropagation();
    const on=m.classList.contains('open');
    document.querySelectorAll('.chkmore.open,.gpmore.open').forEach(function(x){x.classList.remove('open');});
    if(!on)m.classList.add('open');else m.blur();});});
  document.querySelectorAll('.gpw>.gshort').forEach(function(b){b.addEventListener('click',function(e){
    e.preventDefault();e.stopPropagation();
    const w=b.parentElement;const on=w.classList.contains('open');
    document.querySelectorAll('.gpw.open').forEach(function(x){x.classList.remove('open');});
    if(!on){w.classList.add('open');placePop(w);}});});
  document.querySelectorAll('[data-goto]').forEach(function(b){b.onclick=function(e){
    e.preventDefault();e.stopPropagation();closeModal();
    gotoSection(+b.getAttribute('data-goto'),b.getAttribute('data-gotok')||'');};});}
function showPackageModal(nm,docs,combined,missingRcs,missingLh,capMsgs,blocked,warnOf){
  /* All six documents stay on the surface: which ones exist and which do not is
     the whole point of the dialog, and folding it away meant the only way to
     learn it was to go looking. What each one is short of sits on its own row,
     and the field names themselves are the links — naming the thing you must go
     and type is clearer than a separate "Section 4" button beside it, and one
     field blocking three documents shows up as three mentions, which is true. */
  const ORDER=[['Cover letter (CA)'],['Owner cover letter'],["Owner's checklist"],
               ['RCS report'],['Draft rent schedule'],['Tenant notice']];
  const byLabel={};docs.forEach((d,i)=>{byLabel[d.label]={doc:d,i:i};});
  const blkBy={};(blocked||[]).forEach(b=>{blkBy[b.label]=b;});
  const nReady=ORDER.filter(o=>byLabel[o[0]]).length, nGap=ORDER.length-nReady;

  /* One kind of amber, one place. A caveat is not a different colour of problem,
     it is a different sentence: REQUIRED blocks the document, SUGGESTED means it was
     written without something. The letterhead belongs here as well — it only
     ever affected the tenant notice — so nothing document-specific is left
     stranded at the foot of the dialog in a second shade. */
  const extraWarn={};
  if(missingLh)extraWarn['Tenant notice']=[{label:'A letterhead for the notice',sec:0,
    why:'On the property page \u2014 without one the notice prints a generated header'}];
  /* A field that blocks three documents used to be printed three times. True,
     and it turned a six-row dialog into forty links on rows that grew to 156px
     — so the one thing the dialog exists to say, which of the six you can take
     away, was buried under the reasons you cannot. Each gap is now counted ONCE,
     in one block below, and the row it blocks says only how many it is short.
     All six rows stay 46px whatever is missing. */
  const gapOf=lab=>{const b=blkBy[lab];
    if(b)return (b.missing||[]);
    return byLabel[lab]?[]:[{key:'',label:'the RCS report, uploaded in '+secRef(1),sec:1}];};
  const sugOf=lab=>[].concat(((warnOf||{})[lab])||((blkBy[lab]||{}).warns)||[],extraWarn[lab]||[]);
  /* The whole row is the download, not the word "Download": a 46px-tall row
     whose only target was eight characters of text at the far right. */
  const rows=gdocRows(ORDER.map(o=>o[0]),byLabel,blkBy,warnOf,extraWarn,gapOf);


  const notes=[].concat(capMsgs||[]);
  const noteHtml=notes.length?'<div class="gnotes">'+notes.map(m=>'<div class="gnote">⚠ '+esc(m)+'</div>').join('')+'</div>':'';
  const folderIcon='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
  // stacked sheets: one file holding all of them
  const pdfIcon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto"><path d="M8 3h7l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M15 3v5h5"/><path d="M4 7v12a2 2 0 0 0 2 2h10" opacity=".45"/></svg>';
  // a sheet with a grid: the workbook
  const xlIcon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>';

  modal('<div class="dlg-t">Package generated</div>'
    +'<div class="dlg-b">'+esc(nm)+' · '+(nGap?nReady+' of '+ORDER.length+' ready · <b style="color:#b45309">'+nGap+' need'+(nGap===1?'s':'')+' more information</b>':'all '+ORDER.length+' documents ready')+'</div>'
    +'<div class="gdocs">'+rows+'</div>'
    +noteHtml
    /* Everything you can leave with, at the end. The folder is the whole package
       as separate named files; the two beneath it are the single-file forms of
       it — one merged PDF and the workbook — so they sit together as a pair. */
    +(nReady?('<button class="gprim" id="dlFolder">'+folderIcon+'<span><span class="gprim-t">Download the RCS Package folder</span>'
      +'<span class="gprim-s">'+(nReady+2)+' files \u2014 '+(nReady===1?'the document':'each of the '+nReady+' documents')+', the combined PDF, and the workbook</span></span></button>'
      +'<div class="gpair"><button class="btn gsub" id="dlCombined">'+pdfIcon+'RCS Package PDF</button>'
      +'<button class="btn gsub gsub-x" id="dlXlsx">'+xlIcon+'Rent Analysis</button></div>'):'')
    +'<div class="dlg-row"><span class="dlg-sp"></span><button class="btn" id="dlgCancel">Close</button></div>','pkg');
  el('dlgCancel').onclick=closeModal;
  const cbn=el('dlCombined');if(cbn)cbn.onclick=()=>dlPdf(combined,nm+' - RCS Package.pdf');
  const xb=el('dlXlsx');if(xb)xb.onclick=()=>genRentAnalysis();
  const fb=el('dlFolder');if(fb)fb.onclick=()=>dlPackageFolder(nm,docs,combined);
  /* Hover opens a count's list; a press pins it, because a touch screen has no
     hover and a keyboard reaches the chip before it reaches the list. */
  wirePkgRows(docs);
}

async function dlPackageFolder(nm,docs,combined){
  if(!(window.RCSXlsx&&window.RCSXlsx.makeZip)){setStatus('Packager still loading \u2014 try again in a moment.');return;}
  try{setStatus('Packing the RCS Package folder\u2026');
    const files=[{name:'RCS Package/'+nm+' - RCS Package.pdf',data:combined}];
    docs.forEach(d=>files.push({name:'RCS Package/'+d.file+'.pdf',data:d.bytes}));
    let xlNote='';
    try{files.push({name:'RCS Package/'+nm+' - RCS Analysis.xlsx',data:await buildRentAnalysisBytes()});
      if(UNITS.length>11)xlNote=' Note: the Excel template holds 11 unit types \u2014 '+(UNITS.length-11)+' extra row(s) were left off the workbook.';}
    catch(e){xlNote=' (the Rent Analysis workbook could not be built: '+((e&&e.message)||e)+')';}
    dlFile(window.RCSXlsx.makeZip(files),nm+' - RCS Package.zip','application/zip');
    setStatus('RCS Package folder downloaded \u2014 the combined report, each document, and the Rent Analysis workbook, all in one folder.'+xlNote);
  }catch(e){setStatus('Folder download failed: '+((e&&e.message)||e));}}
function buildRentAnalysisBytes(){
  const nn=v=>{const n=numf(v);return n>0?n:null;};
  const rows=UNITS.map(i=>({type:(get('units.'+i+'.br')||'')+(get('units.'+i+'.ba')?'/'+get('units.'+i+'.ba'):''),
    units:nn(get('units.'+i+'.num_units')),cur:nn(get('units.'+i+'.current')),pro:nn(get('units.'+i+'.proposed')),
    ua:uaHas('units.'+i+'.ua_exec')||uaHas('units.'+i+'.ua_rcs')||uaHas('units.'+i+'.ua_custom')?uaResolvedOf(i):null,safmr150:safmrResolvedOf(i)>0?safmrResolvedOf(i):null}));
  return window.RCSXlsx.rentAnalysis({propertyName:get('property.name')||'Property',apprFirm:get('appr.firm')||'',rows});}
async function genRentAnalysis(){
  if(!window.RCSXlsx){setStatus('Excel generator still loading \u2014 try again in a moment.');return;}
  try{setStatus('Building the Rent Analysis workbook\u2026');
    const N=get('property.name')||'Property';
    dlFile(await buildRentAnalysisBytes(),N+' - RCS Analysis.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setStatus('Rent Analysis workbook downloaded.'+(UNITS.length>11?' Note: the template holds 11 unit types \u2014 '+(UNITS.length-11)+' extra row(s) were left off.':''));
  }catch(e){setStatus('Excel generation failed: '+((e&&e.message)||e));}
}
async function genPackage(){
  if(!hasProg('rcs')){await genOcafUafPackage();return;}
  if(!(window.RCSGen&&window.PDFLib)){setStatus('Generator still loading - try again in a moment.');return;}
  if(numf(get('units.'+UNITS[0]+'.num_units'))<=0){setStatus('Cannot generate the package with zero units — the first unit type needs a unit count.');return;}
  let hasLh=false;try{const L=(mpdb&&activePid)?mpdb.getLetterhead(activePid):null;hasLh=!!(L&&L.data);}catch(e){}
  if(!hasLh){const alias=get('tenant.property_alias')||get('property.name')||'the property name';
    dialogConfirm('No letterhead uploaded','The tenant notice will print with a generated header \u2014 the Related logo, \u201c'+esc(alias)+'\u201d, and the management address. A letterhead can be uploaded on the property page.','Generate anyway',false,()=>{__genPackageRun();});return;}
  await __genPackageRun();
}
/* Find where the letterhead's header art ends: scan the top half of the
   page image for the lowest row with ink; the notice starts just below it. */
function measureLetterheadDrop(dataUrl){return new Promise(res=>{try{
  const img=new Image();
  img.onload=()=>{try{
    if(img.height<img.width){res(null);return;} // banners are placed, not underlaid
    const W=306,H=396,c=document.createElement('canvas');c.width=W;c.height=H;
    const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,H);g.drawImage(img,0,0,W,H);
    const half=Math.floor(H*0.5);const d=g.getImageData(0,0,W,half).data;let low=-1;
    for(let y=0;y<half;y++){let cnt=0;for(let x=0;x<W;x++){const i=(y*W+x)*4;
      if(d[i+3]>40&&(d[i]<235||d[i+1]<235||d[i+2]<235)){if(++cnt>=3)break;}}
      if(cnt>=3)low=y;}
    if(low<0){res(null);return;}
    res(Math.min(340,Math.max(110,Math.round((low/H)*792)+36)));
  }catch(e){res(null);}};
  img.onerror=()=>res(null);img.src=dataUrl;
}catch(e){res(null);}});}
/* PDF letterheads: find the header's bottom edge without rasterizing. Walk
   page 1's drawing operators with transform tracking and take the lowest
   painted text / image / dark path that lives in the top half of the page
   (full-height borders and page backgrounds are excluded by construction). */
async function measurePdfLetterheadDrop(bytes){ try{
  const PD=window.PDFLib; const doc=await PD.PDFDocument.load(bytes,{parseSpeed:Infinity});
  const page=doc.getPage(0); const ph=page.getHeight()||792; const ctx=doc.context;
  const deref=o=>{ try{ return (o==null)?o:(ctx.lookup(o)||o); }catch(e){ return o; } }; // lookup passes non-refs through (min build mangles class names)
  const bstr=u8=>{ let s='';for(let i=0;i<u8.length;i++)s+=String.fromCharCode(u8[i]);return s; };
  const streamText=s0=>{ const s=deref(s0); if(!s)return '';
    try{ return bstr(PD.decodePDFRawStream(s).decode()); }
    catch(e){ try{ return bstr(s.contents||s.getContents()); }catch(_){ return ''; } } };
  const contentsOf=nd=>{ let c=deref(nd.Contents?nd.Contents():null); if(!c)return '';
    if(c.asArray) return c.asArray().map(streamText).join('\n');
    return streamText(c); };
  const lex=s=>{ const out=[]; let i=0; const n=s.length;
    while(i<n){ const c=s[i];
      if(c==='%'){ while(i<n&&s[i]!=='\n')i++; continue; }
      if(c==='('){ let d=1;i++; while(i<n&&d>0){ if(s[i]==='\\')i++; else if(s[i]==='(')d++; else if(s[i]===')')d--; i++; } out.push({t:'str'}); continue; }
      if(c==='<'){ if(s[i+1]==='<'){ let d=1;i+=2; while(i<n&&d>0){ if(s[i]==='<'&&s[i+1]==='<'){d++;i+=2;continue;} if(s[i]==='>'&&s[i+1]==='>'){d--;i+=2;continue;} i++; } out.push({t:'dict'}); continue; }
        i++; while(i<n&&s[i]!=='>')i++; i++; out.push({t:'str'}); continue; }
      if(c==='['){ out.push({t:'['}); i++; continue; }
      if(c===']'){ out.push({t:']'}); i++; continue; }
      if(c==='/'){ let j=i+1; while(j<n&&!/[\s\/\[\]()<>{}%]/.test(s[j]))j++; out.push({t:'name',v:s.slice(i+1,j)}); i=j; continue; }
      if(/\s/.test(c)){ i++; continue; }
      let j=i; while(j<n&&!/[\s\/\[\]()<>%]/.test(s[j]))j++;
      const w=s.slice(i,j); i=j;
      if(w==='ID'){ const e=s.indexOf('EI',i); i=(e<0)?n:e+2; out.push({t:'op',v:'EI'}); continue; }
      if(/^[+\-.0-9]/.test(w)&&!isNaN(parseFloat(w))) out.push({t:'num',v:parseFloat(w)});
      else out.push({t:'op',v:w});
    } return out; };
  const mul=(m,q)=>[m[0]*q[0]+m[1]*q[2], m[0]*q[1]+m[1]*q[3], m[2]*q[0]+m[3]*q[2], m[2]*q[1]+m[3]*q[3], m[4]*q[0]+m[5]*q[2]+q[4], m[4]*q[1]+m[5]*q[3]+q[5]];
  const apply=(m,x,y)=>({x:m[0]*x+m[2]*y+m[4], y:m[1]*x+m[3]*y+m[5]});
  const wOf=st=>{ const ns=st.filter(t=>t.t==='num').map(t=>t.v);
    if(ns.length===4) return 1-Math.min(1,(ns[0]+ns[1]+ns[2])/3+ns[3]);
    if(ns.length===3) return (ns[0]+ns[1]+ns[2])/3;
    if(ns.length===1) return ns[0];
    return 0; };
  let best=null;
  const note2=(yMin,yMax)=>{ if(!(isFinite(yMin)&&isFinite(yMax)))return;
    if(yMax<ph*0.55)return;            // footer / body content
    if(yMin<ph*0.45)return;            // spans deep into the page: bg or border
    best=(best==null)?yMin:Math.min(best,yMin); };
  const scan=(code,res,ctm0,depth)=>{ if(depth>4||!code)return;
    const toks=lex(code); let stack=[]; let ctm=ctm0.slice(); const gsk=[];
    let tm=null,tlm=null,tl=0,fs=0,trm=0,fill={w:0},stroke={w:0},path=[];
    const num=k=>{ const v=stack[stack.length-k]; return (v&&v.t==='num')?v.v:0; };
    const pushPt=(x,y)=>{ path.push(apply(ctm,x,y)); };
    for(const tk of toks){
      if(tk.t!=='op'){ stack.push(tk); if(stack.length>24)stack.shift(); continue; }
      const op=tk.v;
      switch(op){
        case 'q': gsk.push({ctm:ctm.slice(),fill:{w:fill.w},stroke:{w:stroke.w}}); break;
        case 'Q': { const g0=gsk.pop(); if(g0){ ctm=g0.ctm; fill=g0.fill; stroke=g0.stroke; } break; }
        case 'cm': ctm=mul([num(6),num(5),num(4),num(3),num(2),num(1)],ctm); break;
        case 'BT': tm=[1,0,0,1,0,0]; tlm=tm.slice(); break;
        case 'ET': tm=null; break;
        case 'Tf': fs=num(1); break;
        case 'Tm': tlm=[num(6),num(5),num(4),num(3),num(2),num(1)]; tm=tlm.slice(); break;
        case 'Td': tlm=mul([1,0,0,1,num(2),num(1)],tlm||[1,0,0,1,0,0]); tm=tlm.slice(); break;
        case 'TD': tl=-num(1); tlm=mul([1,0,0,1,num(2),num(1)],tlm||[1,0,0,1,0,0]); tm=tlm.slice(); break;
        case 'TL': tl=num(1); break;
        case 'T*': tlm=mul([1,0,0,1,0,-tl],tlm||[1,0,0,1,0,0]); tm=tlm.slice(); break;
        case 'Tr': trm=num(1); break;
        case "'": case '"': tlm=mul([1,0,0,1,0,-tl],tlm||[1,0,0,1,0,0]); tm=tlm.slice();
        /* fall through */
        case 'Tj': case 'TJ': {
          if(tm&&trm!==3&&trm!==7&&fill.w<0.85){ const M=mul(tm,ctm); const p0=apply(M,0,0),p1=apply(M,0,fs||10);
            const h=Math.abs(p1.y-p0.y)||10; note2(p0.y-0.25*h,p0.y+0.78*h); }
          break; }
        case 'g': fill={w:num(1)}; break;
        case 'G': stroke={w:num(1)}; break;
        case 'rg': fill={w:(num(3)+num(2)+num(1))/3}; break;
        case 'RG': stroke={w:(num(3)+num(2)+num(1))/3}; break;
        case 'k': fill={w:1-Math.min(1,(num(4)+num(3)+num(2))/3+num(1))}; break;
        case 'K': stroke={w:1-Math.min(1,(num(4)+num(3)+num(2))/3+num(1))}; break;
        case 'sc': case 'scn': fill={w:wOf(stack)}; break;
        case 'SC': case 'SCN': stroke={w:wOf(stack)}; break;
        case 'm': case 'l': pushPt(num(2),num(1)); break;
        case 'c': pushPt(num(6),num(5)); pushPt(num(4),num(3)); pushPt(num(2),num(1)); break;
        case 'v': case 'y': pushPt(num(4),num(3)); pushPt(num(2),num(1)); break;
        case 're': { const x=num(4),yy=num(3),w2=num(2),h2=num(1); pushPt(x,yy); pushPt(x+w2,yy); pushPt(x,yy+h2); pushPt(x+w2,yy+h2); break; }
        case 'n': path=[]; break;
        case 'f': case 'F': case 'f*': case 'b': case 'b*': case 'B': case 'B*': case 'S': case 's': {
          const stroking=(op==='S'||op==='s'); const both=(op[0]==='b'||op[0]==='B');
          const dark=stroking?(stroke.w<0.85):(fill.w<0.85||(both&&stroke.w<0.85));
          if(dark&&path.length){ let mn=1e9,mx=-1e9; path.forEach(p=>{mn=Math.min(mn,p.y);mx=Math.max(mx,p.y);}); note2(mn,mx); }
          path=[]; break; }
        case 'Do': { const nt=stack[stack.length-1]; const xn=(nt&&nt.t==='name')?nt.v:null;
          if(xn&&res){ try{ const xod=deref(res.get?res.get(PD.PDFName.of('XObject')):null);
            const xo=xod?deref(xod.get(PD.PDFName.of(xn))):null;
            if(xo&&xo.dict){ const sub=String(xo.dict.get(PD.PDFName.of('Subtype'))||'');
              if(/Image/.test(sub)){ const cs=[apply(ctm,0,0),apply(ctm,1,0),apply(ctm,0,1),apply(ctm,1,1)];
                let mn=1e9,mx=-1e9; cs.forEach(p=>{mn=Math.min(mn,p.y);mx=Math.max(mx,p.y);}); note2(mn,mx); }
              else if(/Form/.test(sub)&&depth<4){ let M=ctm; const mt=deref(xo.dict.get(PD.PDFName.of('Matrix')));
                if(mt&&mt.asArray){ const a=mt.asArray().map(x2=>{ const d2=deref(x2); return (d2&&d2.asNumber)?d2.asNumber():(parseFloat(String(d2))||0); }); if(a.length===6)M=mul(a,ctm); }
                const r2=deref(xo.dict.get(PD.PDFName.of('Resources')))||res;
                scan(streamText(xo),r2,M,depth+1); } } }catch(e){} }
          break; }
      }
      stack=[];
    } };
  scan(contentsOf(page.node), deref(page.node.Resources?page.node.Resources():null), [1,0,0,1,0,0], 0);
  if(best==null) return null;
  return Math.min(360,Math.max(110,Math.round(((ph-best)/ph)*792)+36));
}catch(e){ return null; } }
async function genOcafUafPackage(){
  if(!(window.RCSGen&&window.PDFLib)){setStatus('Generator still loading - try again in a moment.');return;}
  const A=uafAnalysis();
  const needsNotice=hasProg('uaf')&&A.dec.length>0;
  let hasLh=false;try{const L=(mpdb&&activePid)?mpdb.getLetterhead(activePid):null;hasLh=!!(L&&L.data);}catch(e){}
  if(needsNotice&&!hasLh){const alias=get('tenant.property_alias')||get('property.name')||'the property name';
    dialogConfirm('No letterhead uploaded','The utility allowance decrease requires the 30-day tenant notice. Without a letterhead it will print with a generated header — the Related logo, “'+esc(alias)+'”, and the management address.','Generate anyway',false,()=>{__genOcafUafRun();});return;}
  await __genOcafUafRun();
}
async function __genOcafUafRun(){
  const T=window.RCSTemplates||{};
  try{ setStatus('Generating package...'); const logo=b64ToBytes(LOGO_B64);
    const C=ocafCalc(),A=uafAnalysis();
    const rec=formRec();
    // the revised RS carries this cycle's rents: OCAF derives them from R when
    // "Apply as proposed rents" wasn't pressed; a UAF-only cycle keeps current rents
    UNITS.forEach(i=>{const cur=numf(get('units.'+i+'.current'));if(cur>0&&!(numf(get('units.'+i+'.proposed'))>0))rec['units.'+i+'.proposed']=String((hasProg('ocaf')&&C.R>0)?Math.round(cur*C.R):cur);});
    let lh=null; try{ const L=(mpdb&&activePid)?mpdb.getLetterhead(activePid):null;
      if(L&&L.data){const by=dataUrlToBytes(L.data);if(by)lh=(String(L.data).indexOf('data:application/pdf')===0)?{pdf:by}:{png:by};}
      if(lh&&lh.png){const dr=await measureLetterheadDrop(L.data);if(dr)lh.drop=dr;}
      if(lh&&lh.pdf){const dr=await measurePdfLetterheadDrop(lh.pdf);if(dr)lh.drop=dr;} }catch(e){}
    const N=get('property.name')||'Property';
    const tag=cycleProgs().filter(p=>p!=='rcs').map(x=>PROG_NAMES[x]||x).join(' + ')||'OCAF';
    /* Blocked rather than written wrong — the same gate the RCS package has
       had, and the reason it exists: a worksheet with no factor prints a dash
       on every line from (N) to (R) and then lists the CURRENT rents under
       "Adjusted contract rents". It looks finished. */
    const docs=[],blocked=[],order=[];const warnOf={};
    let dn=0; const pre=()=>{dn++;return ('0'+dn).slice(-2)+'. ';};
    const add=async(id,label,base,make)=>{
      order.push(label);
      const m=docMissing(id),w=docWarns(id);
      if(w.length)warnOf[label]=w;
      if(m.length){blocked.push({label:label,missing:m,warns:w});return;}
      docs.push({label:label,file:pre()+N+' - '+base,bytes:await make()});};
    if(hasProg('ocaf')){
      await add('ocafws','OCAF worksheet (per HUD-9625)','OCAF Worksheet',()=>window.RCSGen.ocafWorksheet(rec));
      await add('exhibita','Revised Exhibit A','Revised Exhibit A',()=>window.RCSGen.exhibitA(rec));
      if(/floating/i.test(get('ocaf.rate_type')||''))
        await add('dsevid','Debt-service determination (T-12 / F-12)','Debt Service Determination',()=>window.RCSGen.dsEvidence(rec));
    }
    if(hasProg('uaf'))await add('uafcert','UAF certification / breakdown','UAF Certification',()=>window.RCSGen.uafCert(rec));
    if(T.rentSchedule)await add('schedule','Revised rent schedule'+(hasProg('ocaf')&&hasProg('uaf')?' (merged OCAF + UAF)':''),'Revised Rent Schedule',()=>window.RCSGen.fillRentSchedule(b64ToBytes(T.rentSchedule),rec));
    /* Offered whenever the package is a UAF one. Gated on A.dec.length alone it
       simply was not there when there was no decrease — which is right — but it
       was also not there when the allowances had not been entered yet, and
       nothing said so. docMissing('uanotice') says which of the two it is. */
    if(hasProg('uaf')){
      await add('uanotice','30-day tenant notice (UA decrease)','UA Decrease Tenant Notice',()=>window.RCSGen.uaTenantNotice(rec,lh,logo));
      await add('tcert','Tenant-comment certification','Tenant Comment Certification',()=>window.RCSGen.tenantCommentCert(rec));
    }
    if(_rcsUpload){order.push('CA package (uploaded)');docs.push({label:'CA package (uploaded)',file:pre()+N+' - CA Package (as received)',bytes:_rcsUpload.bytes});}
    const combined=docs.length?await combinePdfs(docs.map(d=>d.bytes)):null;
    const warns=[];
    if(hasProg('ocaf')&&!_rcsUpload)warns.push('The CA’s auto-OCAF package isn’t uploaded — add it in '+secRef(1)+' for the file.');
    if(needsDerivedRents(C))warns.push('Proposed rents were derived from the worksheet (×'+C.R.toFixed(3)+') — use “Apply as proposed rents” + “Update property profile” to save them.');
    if(hasProg('uaf')&&A.mismatch.length)warns.push(A.mismatch.length+' unit type'+(A.mismatch.length>1?'s':'')+': UA components don’t total the current UA.');
    showOcafUafModal(N,tag,docs,combined,warns,blocked,warnOf,order);
    try{ if(activeCid&&mpdb)await mpdb.setCycleGenerated(activeCid,docs.map(d=>d.label)); }catch(e){}
    setStatus('Package generated \u2014 '+docs.length+' document'+(docs.length===1?'':'s')+(blocked.length?', '+blocked.length+' still missing information.':'.'));
  }catch(e){ setStatus('Generation failed: '+((e&&e.message)||e)); }
}
function needsDerivedRents(C){return hasProg('ocaf')&&C.R>0&&UNITS.some(i=>numf(get('units.'+i+'.current'))>0&&!(numf(get('units.'+i+'.proposed'))>0));}
function showOcafUafModal(nm,tag,docs,combined,warns,blocked,warnOf,order){
  /* The same six-row shape the RCS package uses, for the same reason: which
     documents you can take away is the dialog's subject, and what each one is
     short of belongs one hover behind its count rather than in a list beneath. */
  const byLabel={};docs.forEach((d,i)=>{byLabel[d.label]={doc:d,i:i};});
  const blkBy={};(blocked||[]).forEach(b=>{blkBy[b.label]=b;});
  const ORDER=(order&&order.length)?order:docs.map(d=>d.label);
  const nReady=ORDER.filter(l=>byLabel[l]).length,nGap=ORDER.length-nReady;
  const rows=gdocRows(ORDER,byLabel,blkBy,warnOf,null,null);
  const noteHtml=(warns||[]).length?'<div class="gnotes">'+warns.map(m=>'<div class="gnote">\u26a0 '+esc(m)+'</div>').join('')+'</div>':'';
  const folderIcon='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
  const pdfIcon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto"><path d="M8 3h7l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M15 3v5h5"/><path d="M4 7v12a2 2 0 0 0 2 2h10" opacity=".45"/></svg>';
  modal('<div class="dlg-t">Package generated</div>'
    +'<div class="dlg-b">'+esc(nm)+' \u00b7 '+esc(tag)+' \u00b7 '+(nGap?nReady+' of '+ORDER.length+' ready \u00b7 <b style="color:#b45309">'+nGap+' need'+(nGap===1?'s':'')+' more information</b>':'all '+ORDER.length+' documents ready')+'</div>'
    +'<div class="gdocs">'+rows+'</div>'
    +noteHtml
    +(nReady?('<button class="gprim" id="dlFolder">'+folderIcon+'<span><span class="gprim-t">Download the '+esc(tag)+' Package folder</span>'
      +'<span class="gprim-s">'+(nReady+1)+' files \u2014 '+(nReady===1?'the document':'each of the '+nReady+' documents')+' and the combined PDF</span></span></button>'
      +'<div class="gpair"><button class="btn gsub" id="dlCombined">'+pdfIcon+esc(tag)+' Package PDF</button></div>'):'')
    +'<div class="dlg-row"><span class="dlg-sp"></span><button class="btn" id="dlgCancel">Close</button></div>','pkg');
  el('dlgCancel').onclick=closeModal;
  const cbn=el('dlCombined');if(cbn)cbn.onclick=()=>dlPdf(combined,nm+' - '+tag+' Package.pdf');
  const fb=el('dlFolder');if(fb)fb.onclick=()=>{
    if(!(window.RCSXlsx&&window.RCSXlsx.makeZip)){setStatus('Packager still loading — try again in a moment.');return;}
    try{ const folder=tag+' Package';
      const files=[{name:folder+'/'+nm+' - '+tag+' Package.pdf',data:combined}];
      docs.forEach(d=>files.push({name:folder+'/'+d.file+'.pdf',data:d.bytes}));
      dlFile(window.RCSXlsx.makeZip(files),nm+' - '+tag+' Package.zip','application/zip');
      setStatus(tag+' Package folder downloaded.');
    }catch(e){setStatus('Folder download failed: '+((e&&e.message)||e));}};
  wirePkgRows(docs);
}
async function __genPackageRun(){
  const T=window.RCSTemplates||{};
  try{ setStatus('Generating package...'); const rec=formRec(); const logo=b64ToBytes(LOGO_B64);
    let lh=null; try{ const L=(mpdb&&activePid)?mpdb.getLetterhead(activePid):null;
      if(L&&L.data){const by=dataUrlToBytes(L.data);if(by)lh=(String(L.data).indexOf('data:application/pdf')===0)?{pdf:by}:{png:by};}
      if(lh&&lh.png){const dr=await measureLetterheadDrop(L.data);if(dr)lh.drop=dr;}
      if(lh&&lh.pdf){const dr=await measurePdfLetterheadDrop(lh.pdf);if(dr)lh.drop=dr;} }catch(e){}
    const N=get('property.name')||'Property'; const docs=[],blocked=[];
    const warnOf={};
    const add=async(id,label,file,make)=>{const m=docMissing(id),w=docWarns(id);
      if(w.length)warnOf[label]=w;
      if(m.length){blocked.push({label:label,missing:m,warns:w});return;}
      docs.push({label:label,file:file,bytes:await make()});};
    await add('cover','Cover letter (CA)','01. '+N+' - Cover Letter',()=>window.RCSGen.coverLetter(rec,logo));
    await add('owner','Owner cover letter','02. '+N+' - RCS Owner Cover Letter',()=>window.RCSGen.ownerLetter(rec));
    if(T.checklist)await add('checklist',"Owner's checklist","03. "+N+" - RCS Owner's Checklist",()=>window.RCSGen.fillChecklist(b64ToBytes(T.checklist),rec));
    if(_rcsUpload)docs.push({label:'RCS report',file:'04. '+N+' - RCS Report',bytes:_rcsUpload.bytes});
    if(T.rentSchedule)await add('schedule','Draft rent schedule','05. '+N+' - Draft Rent Schedule',()=>window.RCSGen.fillRentSchedule(b64ToBytes(T.rentSchedule),rec));
    await add('notice','Tenant notice','06. '+N+' - RCS Tenant Notice',()=>window.RCSGen.tenantNotice(rec,lh,logo));
    const combined=docs.length?await combinePdfs(docs.map(d=>d.bytes)):null;
    let _lhOk=false;try{const L2=(mpdb&&activePid)?mpdb.getLetterhead(activePid):null;_lhOk=!!(L2&&L2.data);}catch(e){}
    showPackageModal(get('property.name')||'Property',docs,combined,!_rcsUpload,!_lhOk,rsCapacity().msgs,blocked,warnOf);
    try{ if(activeCid&&mpdb)await mpdb.setCycleGenerated(activeCid,docs.map(d=>d.label)); }catch(e){}
    setStatus('Package generated \u2014 '+docs.length+' document'+(docs.length===1?'':'s')+(blocked.length?', '+blocked.length+' still missing information.':'.')+(_rcsUpload?'':' The RCS report (document 04) is missing \u2014 upload it in Section 1 to include it.'));
  }catch(e){ setStatus('Generation failed: '+((e&&e.message)||e)); }
}
/* ---- boot ------------------------------------------------------------- */
let supaClient=null;
function showAuthScreen(){show('Auth');const btn=el('authSignIn'),em=el('authEmail'),pw=el('authPassword'),err=el('authErr');if(err)err.textContent='';
  const go=async()=>{if(err)err.textContent='';const email=((em&&em.value)||'').trim(),password=(pw&&pw.value)||'';if(!email||!password){if(err)err.textContent='Enter your email and password.';return;}
    btn.disabled=true;btn.textContent='Signing in\u2026';const{error}=await supaClient.auth.signInWithPassword({email,password});btn.disabled=false;btn.textContent='Sign in';
    if(error){if(err)err.textContent=error.message||'Sign-in failed.';return;}if(pw)pw.value='';await boot();};
  if(btn)btn.onclick=go;[em,pw].forEach(f=>{if(f)f.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();go();}};});if(em)em.focus();}
async function boot(){
  if(!mpdb)mpdb=await makeSupabaseDb(supaClient);   // selftest hands us a local one
  if(!window.HAPSource)window.HAPSource={rows:()=>{try{return (mpdb&&mpdb.hapRows)?mpdb.hapRows():[];}catch(e){return [];}}};
  try{pmName=(mpdb&&mpdb.getPmName)?mpdb.getPmName():'';}catch(e){pmName='';}
  const ms=el('menuSearch');if(ms)ms.addEventListener('input',renderMenu);
  const bn=el('bNewProperty');if(bn)bn.onclick=createProperty;
  const who=el('menuWho');if(who)who.onclick=pickWhoDialog;
  const be=el('bExit');if(be)be.onclick=requestExit;
  wireHome();
  const _revertToSaved=async()=>{form=await store.fillForm();await refreshSnap();fixSavedToggles();deriveUnits();snapForm();renderBody();setStatus('Reverted to the last saved record.');};
  const bf=el('bFill');if(bf)bf.onclick=_revertToSaved;
  const bff=el('bFillFooter');if(bff)bff.onclick=_revertToSaved;
  const bs=el('bSave');if(bs)bs.onclick=()=>requestSave(()=>{renderBody();setStatus('Saved '+relTime(new Date().toISOString())+'.');});
  const bg=el('bGenerate');if(bg)bg.onclick=genPackage;const lb=el('bLauncherBack');if(lb)lb.onclick=openMenu;
  const bc=el('bContacts');if(bc)bc.onclick=openContacts; const cb2=el('bContactsBack');if(cb2)cb2.onclick=openMenu;
  const so=el('bSignOut');if(so)so.onclick=async()=>{if(supaClient)await supaClient.auth.signOut();};
  const sc=el('scrim');if(sc&&sc.addEventListener)sc.addEventListener('click',e=>{if(e.target===sc)closeModal();});
  openMenu();
}
const SELFTEST=(typeof location!=='undefined')&&/[?&]selftest=1(&|$)/.test(location.search||'');
/* A property worth testing against.

   The stub record used to be a bare name, and the first-run migration rightly
   refused to build a package for it ("real unit data = a record worth
   migrating"). So every sweep drove a form whose controls existed but whose
   conditional halves never ran: no unit rows past the first, no 150% analysis,
   no rent arithmetic, and no package to hang a program off. A test property
   that holds no data tests the empty case only, and says nothing about the one
   Matt actually opens.

   Six unit types across two buildings, a utility allowance conflict on one row
   (exec 31 vs RCS 34) so the resolve path is reachable, and a SAFMR high enough
   on 3BR to exercise the 150% ceiling. Runs once — if the record already holds
   units, it is left alone, so a session's edits survive a reload. */
async function selftestSeed(){
  const ps=mpdb.listProperties();
  /* .pid, not .id: createProperty returns {pid} in all three adapters. The bug
     was dormant only because makeDb always seeds a demo property, so this branch
     never ran — and adding a coded property to the seed below is exactly the
     change that would have woken it. */
  const pid=ps.length?ps[0].id:(await mpdb.createProperty('Beacon Hill Apartments')).pid;
  /* Seed once per browser profile, not once per property: makeDb already ships a
     demo record with a single unit row, so keying off "has any units" meant the
     seed never ran at all. The marker also keeps a reload from wiping edits made
     during a session, which is exactly what rule 19 measures. */
  try{if(window.localStorage.getItem('rcs_selftest_seeded')==='1')return;}catch(e){}
  const U=[
    {br:'1BR',ba:'1BA',n:24,cur:1045,pro:1146,ua:31,uaR:34,safmr:1420,label:'Elderly'},
    {br:'2BR',ba:'1BA',n:36,cur:1240,pro:1362,ua:38,safmr:1690,label:'Elderly'},
    {br:'2BR',ba:'2BA',n:18,cur:1310,pro:1438,ua:38,safmr:1690,label:'Family'},
    {br:'3BR',ba:'2BA',n:12,cur:1495,pro:1641,ua:47,safmr:2180,label:'Family'},
    {br:'3BR',ba:'2.5BA',n:6,cur:1560,pro:1712,ua:47,safmr:2180,label:'Family'},
    {br:'4BR',ba:'2BA',n:4,cur:1780,pro:1954,ua:55,safmr:2455,label:'Family'},
  ];
  const m={
    'property.name':'Beacon Hill Apartments','property.alias':'Beacon Hill',
    'property.addr_street':'1450 Woodward Avenue','property.addr_city':'Detroit',
    'property.addr_state':'MI','property.addr_zip':'48226',
    'property.fha':'044-35218','property.s8':'MI16-T851-004',
    'property.total_units':String(U.reduce((a,u)=>a+u.n,0)),
    'owner.entity_name':'Beacon Hill Preservation LP','owner.entity_type':'Limited Partnership',
    'principals.0.name':'Dana Whitfield','principals.0.title':'Managing Member',
    'poc.name':'Dana Whitfield','poc.email':'dwhitfield@relatedaffordable.com','poc.phone':'3135550142',
    'ca.name':'Alicia Moreno','ca.prefix':'Ms.','ca.position':'Contract Specialist',
    'ca.org':'Michigan State Housing Development Authority',
    'ca.addr_street':'735 East Michigan Avenue','ca.addr_city':'Lansing','ca.addr_state':'MI','ca.addr_zip':'48912',
    'appr.name':'Grant Sheridan','appr.firm':'Sheridan Valuation Group',
    'appr.email':'gsheridan@sheridanvg.com','appr.phone':'3135550188',
    'appr.addr_street':'220 Larned Street','appr.addr_city':'Detroit','appr.addr_state':'MI','appr.addr_zip':'48226',
    'sig.name':'Dana Whitfield','sig.title':'Managing Member',
    'tenant.sender_name':'Dana Whitfield','tenant.sender_title':'Managing Member',
    'rent_schedule.date_rents_effective':'2026-03-01',
    'ocaf.factor_pub':'1.042','ocaf.ds_annual':'412000','ocaf.ds_t12':'408500','ocaf.ds_f12':'415000',
  };
  U.forEach((u,i)=>{
    m['units.'+i+'.br']=u.br; m['units.'+i+'.ba']=u.ba; m['units.'+i+'.label']=u.label;
    m['units.'+i+'.num_units']=String(u.n);
    m['units.'+i+'.current']=String(u.cur); m['units.'+i+'.proposed']=String(u.pro);
    m['units.'+i+'.ua_exec']=String(u.ua);
    if(u.uaR)m['units.'+i+'.ua_rcs']=String(u.uaR);       // one real conflict to resolve
    m['units.'+i+'.safmr_hud']=String(u.safmr);
  });
  m['nonrev.0.br']='1BR'; m['nonrev.0.ba']='1BA'; m['nonrev.0.num_units']='1';
  m['nonrev.0.rent']='0'; m['nonrev.0.use']='Manager\u2019s unit';
  /* saveFlat stores CELLS and reads map[k].value — handed bare strings it wrote
     every key as empty, which still created the keys, so six unit rows rendered
     with nothing in them and the analysis read zero. */
  const cells={};Object.keys(m).forEach(k=>{cells[k]={value:m[k]};});
  await mpdb.saveFlat(pid,cells);
  await mpdb.setActive(pid);
  /* One tracker property, deliberately with NO record behind it: pressing Start
     on its card has to run openHapProperty -> createProperty -> the dialog ->
     createCycle, and that whole sequence is what the browser suite drives. */
  try{await mpdb._setHapRows([
    {'Property Code':'ST001','Property Name':'Selftest Gardens','Portfolio Mgr':'Claire Beatty',
     'Increase Type':'OCAF','Rent Increase':'01/01/2030','Due to HUD':'09/01/2029'},
  ]);}catch(e){}
  try{window.localStorage.setItem('rcs_selftest_seeded','1');}catch(e){}
}
window.addEventListener('DOMContentLoaded',async()=>{
  /* ?selftest=1 — a clickable form with no sign-in and no live data, so the
     things only a human could check (does Enter save? does the badge fit?) can
     be checked by a machine instead.

     It NEVER builds a Supabase client. That is the whole safety argument: the
     isolation is structural, not a permission that could be misconfigured. It
     writes to its own localStorage key, and the real record is unreachable from
     here because no connection to it is ever opened. */
  if(SELFTEST){
    mpdb=await makeDb(localAdapter('rcs_selftest'));
    await selftestSeed();
    await boot();
    document.title='SELFTEST — '+document.title;
    return;
  }
  if(!(window.supabase&&window.SUPABASE_URL&&window.SUPABASE_ANON_KEY)){const e=el('authErr');if(e)e.textContent='Supabase is not configured.';show('Auth');return;}
  supaClient=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
  supaClient.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')showAuthScreen();});
  const{data:{session}}=await supaClient.auth.getSession();
  if(!session){showAuthScreen();return;}
  await boot();
});
function openContacts(){renderContacts();show('Contacts');}
const DIR_SECTIONS=[
 {kind:'appraiser',title:'Appraisers',one:'appraiser',add:'+ Add appraiser',
  rows:[[['name','Name']],[['firm','Company']],[['addr_street','Street']],[['addr_city','City'],['addr_state','State',STATES,'nrw'],['addr_zip','ZIP',null,'nrw']],[['email','Email']],[['phone','Phone']]],
  sub:c=>[c.firm,dirAddrLine(c),fmtEmail(c.email),c.phone?fmtPhone(c.phone):''].filter(Boolean).join('  \u00b7  ')},
 {kind:'ca',title:'Contract administrators',one:'contract administrator',add:'+ Add contract administrator',
  rows:[[['prefix','Prefix',['Ms.','Mr.','Dr.','Mx.'],'nrw'],['name','Name']],[['title','Position']],[['org','Organization']],[['addr_street','Street']],[['addr_city','City'],['addr_state','State',STATES,'nrw'],['addr_zip','ZIP',null,'nrw']]],
  sub:c=>[c.title,c.org,dirAddrLine(c)].filter(Boolean).join('  \u00b7  ')},
];
function renderContacts(){const list=mpdb.listContacts();
  const pmRows=list.map(c=>'<div class="crow2"><div class="cc-main"><div class="cc-name">'+esc(c.name||'(unnamed)')+'</div><div class="cc-sub">'+esc(fmtEmail(c.email)||'\u2014')+'  \u00b7  '+esc(c.phone?fmtPhone(c.phone):'\u2014')+'</div></div><button class="txtbtn" data-ced="'+c.id+'">Edit</button><span class="dotsep">\u00b7</span><button class="txtbtn del" data-cdel="'+c.id+'">Delete</button></div>').join('');
  let html='<div class="lhead" style="display:block"><div class="lh-name">Contacts</div><div class="lh-meta">Shared across all properties. Picking a saved contact on a property fills that part of the form.</div></div>';
  html+='<div class="lsec"><div class="lsec-t">PM contacts</div><div class="clist">'+(pmRows||'<div class="mempty">No contacts yet.</div>')+'</div><div class="addrow" id="cAdd">+ Add PM contact</div></div>';
  DIR_SECTIONS.forEach(S=>{const rows=dirList(S.kind).map(c=>'<div class="crow2"><div class="cc-main"><div class="cc-name">'+esc(((c.prefix?c.prefix+' ':'')+(c.name||'')).trim()||'(unnamed)')+'</div><div class="cc-sub">'+esc(S.sub(c)||'\u2014')+'</div></div><button class="txtbtn" data-dired="'+c.id+'" data-dkind="'+S.kind+'">Edit</button><span class="dotsep">\u00b7</span><button class="txtbtn del" data-dirdel="'+c.id+'" data-dkind="'+S.kind+'">Delete</button></div>').join('');
    html+='<div class="lsec"><div class="lsec-t">'+S.title+'</div><div class="clist">'+(rows||'<div class="mempty">None saved yet.</div>')+'</div><div class="addrow" data-diradd="'+S.kind+'">'+S.add+'</div></div>';});
  el('contactsBody').innerHTML=html;
  const a=el('cAdd');if(a)a.onclick=()=>contactDialog(null);
  document.querySelectorAll('[data-ced]').forEach(b=>b.onclick=()=>contactDialog(mpdb.listContacts().find(x=>x.id===b.getAttribute('data-ced'))));
  document.querySelectorAll('[data-cdel]').forEach(b=>b.onclick=()=>{const id=b.getAttribute('data-cdel');const c=mpdb.listContacts().find(x=>x.id===id);dialogConfirm('Delete contact','Remove <b>'+esc(c?c.name:'this contact')+'</b> from PM contacts?','Delete',true,async()=>{try{await mpdb.deleteContact(id);renderContacts();}catch(e){saveFailedModal(e);}});});
  document.querySelectorAll('[data-diradd]').forEach(b=>b.onclick=()=>dirDialog(b.getAttribute('data-diradd'),null));
  document.querySelectorAll('[data-dired]').forEach(b=>b.onclick=()=>dirDialog(b.getAttribute('data-dkind'),dirList(b.getAttribute('data-dkind')).find(x=>x.id===b.getAttribute('data-dired'))));
  document.querySelectorAll('[data-dirdel]').forEach(b=>b.onclick=()=>{const id=b.getAttribute('data-dirdel');const S=DIR_SECTIONS.find(x=>x.kind===b.getAttribute('data-dkind'));const c=dirList(S.kind).find(x=>x.id===id);dialogConfirm('Delete '+S.one,'Remove <b>'+esc(c&&c.name?c.name:'this contact')+'</b> from '+S.title.toLowerCase()+'?','Delete',true,async()=>{try{await mpdb.deleteDir(id);renderContacts();}catch(e){saveFailedModal(e);}});});}
function dirDialog(kind,c){const S=DIR_SECTIONS.find(x=>x.kind===kind);c=c||{};const FLDS=S.rows.flat();
  const cell=f=>{const v=f[0]==='phone'&&c[f[0]]?fmtPhoneInput(c[f[0]]):(c[f[0]]||'');
    const inner=f[2]?('<select id="dc_'+f[0]+'">'+[''].concat(f[2]).map(o=>'<option value="'+esc(o)+'"'+(String(v)===o?' selected':'')+'>'+(o===''?'\u2014':esc(o))+'</option>').join('')+'</select>')
      :('<input id="dc_'+f[0]+'" value="'+esc(v)+'" autocomplete="off">');
    return '<div class="dlg-field'+(f[3]?' '+f[3]:'')+'"><label>'+esc(f[1])+'</label>'+inner+'</div>';};
  modal('<div class="dlg-t">'+(c.id?'Edit ':'Add ')+esc(S.one)+'</div>'+S.rows.map(row=>row.length>1?('<div class="dlg-2">'+row.map(cell).join('')+'</div>'):cell(row[0])).join('')+'<div class="dlg-row"><button class="btn" id="dlgCancel">Cancel</button><span class="dlg-sp"></span><button class="btn p" id="dlgOk">Save</button></div>');
  const pp=el('dc_phone');if(pp&&pp.addEventListener)pp.addEventListener('input',()=>{pp.value=fmtPhoneInput(pp.value);});
  FLDS.forEach(f=>{const ff=el('dc_'+f[0]);if(ff&&ff.addEventListener)ff.addEventListener('keydown',ev=>{if(ev.key!=='Enter')return;ev.preventDefault();const d=pp?(pp.value||'').replace(/\D/g,''):'';if(!pp||d.length===0||d.length===10)el('dlgOk').click();});});
  el('dlgCancel').onclick=closeModal;
  el('dlgOk').onclick=async()=>{const patch={};FLDS.forEach(f=>{patch[f[0]]=(el('dc_'+f[0]).value||'').trim();});closeModal();try{if(c.id)await mpdb.updateDir(c.id,patch);else await mpdb.addDir(kind,patch);renderContacts();}catch(e){saveFailedModal(e);}};}
function contactDialog(c){c=c||{};
  modal('<div class="dlg-t">'+(c.id?'Edit contact':'Add contact')+'</div><div class="dlg-field"><label>Name</label><input id="ccN" value="'+esc(c.name||'')+'" autocomplete="off"></div><div class="dlg-field"><label>Email</label><input id="ccE" value="'+esc(c.email||'')+'" autocomplete="off"></div><div class="dlg-field"><label>Phone</label><input id="ccP" value="'+esc(c.phone?fmtPhoneInput(c.phone):'')+'" autocomplete="off"></div><div class="dlg-row"><button class="btn" id="dlgCancel">Cancel</button><span class="dlg-sp"></span><button class="btn p" id="dlgOk">Save</button></div>');
  { const pp=el('ccP'); if(pp){ pp.value=fmtPhoneInput(pp.value||''); if(pp.addEventListener) pp.addEventListener('input',()=>{ pp.value=fmtPhoneInput(pp.value); }); } }
  ['ccN','ccE','ccP'].forEach(id=>{const ff=el(id);if(ff&&ff.addEventListener)ff.addEventListener('keydown',ev=>{if(ev.key!=='Enter')return;ev.preventDefault();const d=(el('ccP').value||'').replace(/\D/g,'');if(d.length===0||d.length===10)el('dlgOk').click();});});
  el('dlgCancel').onclick=closeModal;
  el('dlgOk').onclick=async()=>{const patch={name:(el('ccN').value||'').trim(),email:(el('ccE').value||'').trim(),phone:(el('ccP').value||'').trim()};closeModal();try{if(c.id)await mpdb.updateContact(c.id,patch);else await mpdb.addContact(patch);renderContacts();}catch(e){saveFailedModal(e);}};}
/* Lazily, by name: ocr.js is NOT in the bundle test_interactions and
   smoke_combined build for node, so naming these in the object literal threw a
   ReferenceError at load and took three suites down with zero checks run. An
   arrow defers the lookup to the call, which only ever happens in the browser
   suite, which has the whole bundle. */
const __API={LABEL_HINTS,rsParseUnitType,rsNum,ocrMapPages:(p)=>ocrMapPages(p),ocrWhy:()=>ocrWhy(),fmtPhone,fmtPhoneInput,fmtDate,sMoney,sPct,sK,analysis,uaResolvedOf,uaConflict,uaUnresolved,renderMenu,renderLauncher,openMenu,openForm,openLauncher,ringSvg,niceDate,isDirty,overrideCount,isStateKey,attnFlags,pbUtil,clearUncheckedWriteins,srcOf:(k)=>srcOf(k),__openForm:(pid)=>{activePid=pid;return openForm('RCS');},__openCycleForm:(pid,cid)=>{activePid=pid;return openCycleForm(cid);},__renderBody:()=>renderBody(),__docMissing:(id)=>docMissing(id).map(x=>x.label),__docWarns:(id)=>docWarns(id).map(x=>x.label),__edit:(k,v)=>{form=store.editForm(form,k,v);},getVal:(k)=>get(k),modeOf:(kk)=>modeOf(kk),fieldKeys:(k)=>fieldKeys(k),keysCanSave:(ks)=>keysCanSave(ks),keysCanRevert:(ks)=>keysCanRevert(ks),keysNewDirty:(ks)=>keysNewDirty(ks),__revert:(k)=>store.revertForm(form,k),coupledKeys:(k)=>coupledKeys(k),__firstPid:()=>{const ps=mpdb?mpdb.listProperties():[];return ps.length?ps[0].id:null;},__listProps:()=>(mpdb?mpdb.listProperties():[]),__cycles:()=>(mpdb?mpdb.listCycles(activePid):[]),packageScore:()=>packageScore(),packageDocs:()=>packageDocs(),scoreCtx:()=>scoreCtx(),__pkgCard:()=>pkgCard(),__boxes:(i)=>({ua:uaBox(i),safmr:safmrBox(i)}),__saveField:async(k)=>{form=await store.saveField(form,k);},__set:(f,u)=>{form=f;UNITS=u;},__cell:(k)=>form[k],
  /* The whole record, and the snapshot isDirty() measures against. The round-trip
     sweep needs a key-by-key diff (FORM-RULES "Before you deliver" 6): isDirty()
     compares VALUES ONLY, so a hidden side-effect key strands the form dirty with
     nothing on screen and no way to name the culprit from outside. */
  __form:()=>form, __formSnap:()=>FORMSNAP,
  /* Packages carry the programs (rcs / ocaf / uaf), and the pills that toggle them
     only render once a package is open — so a sweep across program combinations
     needs the ids. */
  __cids:()=>(mpdb?mpdb.listCycles(activePid):[]).map(c=>c.id),
  /* The selftest property carries no unit data, so the first-run migration
     rightly refuses to invent a package for it — and without a package there
     are no program pills to drive. Make one. */
  __newCycle:(o)=>mpdb.createCycle(activePid,Object.assign({full:true,programs:['rcs'],label:'TEST'},o||{})),
  __progsOf:(cid)=>{const c=(mpdb?mpdb.listCycles(activePid):[]).find(x=>x.id===cid);return c?c.programs.slice():[];},
__setRcsParsed:(rec)=>{_rcsUpload={name:'study.pdf',bytes:null,parsed:rec,at:''};},
__rcsFill:()=>rcsFillFromParsed(),/* The same door for the rent schedule. Filling FROM a parse is the state where
     the save affordances have to be right — every cell it touches is unsaved by
     definition — and it was the one state no suite could set up. Passing null
     clears the reading, which is how a test says "no schedule was ever read".
     kind:'fields' matches what parseRsPdf returns for a readable copy. */
  __setRsParsed:(rec)=>{_rsUpload=rec?{name:'rs.pdf',bytes:null,kind:'fields',parsed:rec,at:''}:null;},
  /* The whole ladder, on real bytes: which tier answered, and with what. The
     only way to ask that question of a document without a Supabase session. */
  __parseRsPdf:(by,onStep)=>parseRsPdf(by,onStep),
  __rsFill:()=>rsFillFromParsed(),__UNITS:()=>UNITS.slice(),__moneySrcRows:(k)=>moneySrcRows(k),__rcsChecks:()=>rcsChecks(),__rcsTag:(k)=>rcsTag(k),__rsTag:(k)=>rsTag(k),__srcTags:(k)=>srcTags(k),__rcsFillKeys:()=>rcsFillKeys(),__rcsMatch:(i)=>rcsMatch(i),__rcsOf:(k)=>rcsOf(k),
  /* The undo run. __editCell is the text box's input handler in miniature —
     push the cell, then write it the way that handler does — so a suite can
     build a run of edits without synthesising DOM events. */
  __editCell:(k,v)=>{pushCellUndo(k);if(!srcEditKey(k,v))form=store.editForm(form,k,v);},
  /* The three writers a suite cannot reach through the DOM: the one that puts a
     source-backed cell back on its own source, the one that reverts a group to a
     saved blank, and the sweep that drops a conflict flag whose conflict is gone. */
  money,money2,__srcSetSource:(ck,ch)=>srcSetSource(ck,ch),__revertKeys:(ks)=>revertKeys(ks),__syncReviewed:()=>syncReviewed(),
  __undoDepth:()=>_undoChain.length,__undoStep:()=>undoStep(),__clearUndo:()=>clearUndoChain(),__undoScope:(k)=>undoScope(k),
  /* …and __saveCell is Enter in that same box: save the cell's keys, re-baseline
     them, end the run. The three calls, and their order, are the handler's. */
  __saveCell:async(k)=>{const ks=undoScope(k);form=await store.saveFields(form,ks);await refreshSnap();snapForm(ks);clearUndoChain();},
  /* Tests boot without Supabase, and the DOMContentLoaded handler rightly refuses
     to start without it — which left this suite calling openForm() against a null
     mpdb and dying before its first assertion. Give it the local adapter instead
     of loosening the real boot. */
  __localDb:async()=>{mpdb=await makeDb(localAdapter('rcs_test'));return mpdb;},
  /* The home page's rail. __seedHap clears _hapCache because that cache keys on
     ROW COUNT alone — reseeding a different tracker with the same number of rows
     would otherwise serve the old bands, which is harmless in production (the
     table is read once at boot) and silently wrong in any suite that seeds
     twice. */
  __db:()=>mpdb,
  __seedHap:async(rows)=>{_hapCache=null;await mpdb._setHapRows(rows);},
  __menuView:()=>menuView,
  __setMenuView:(v)=>{menuView=v;renderMenu();},
  __menuCounts:()=>Object.assign({},_menuCounts),
  __hapProps:()=>hapProperties(),
  /* The route that was unreachable: a record already in the registry under
     the schedule's own name, carrying no tracker code. */
  __openHap:(code)=>openHapProperty(code),
  __fmt:{num:fmtNum,phone:fmtPhone,email:fmtEmail,date:fmtDate}};
if(typeof module!=='undefined')module.exports=__API;
if(SELFTEST)window.__t=__API;   // browser gets the identical surface, flag-gated
