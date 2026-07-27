/* test_interactions.js — drives the real store through the save/revert/group
   decisions behind the esc/enter behavior. DOM is stubbed (like smoke_combined).

   HARDENING (2026-07-27). This suite is a documented post-edit gate, and it was
   dead for eleven days before anyone noticed. After the Supabase migration it
   threw on its first await (app.js rightly refuses to boot without Supabase, so
   mpdb was null), printed "TEST ERROR:" and stopped — but deliver.sh only ran
   test_db.js, and running it by hand as `… | tail -2` discards node's exit
   status, because a pipeline reports the LAST command's. So now:
     · every exit path goes through fail() / pass(), and fail() sets a non-zero
       exit code — nothing here calls process.exit(0);
     · the verdict is the LAST line printed, so even `| tail -2` shows it;
     · MIN_CHECKS asserts the run reached the end. A suite that dies partway has
       a short count, and a short count is a failure, not a pass;
     · exit / unhandledRejection / uncaughtException guards mean no throw, sync
       or async, can leave an exit code of 0 behind.
   Adding checks? Raise MIN_CHECKS. Never lower it to make a red run go green. */
global.CSS={escape:s=>s};
const mem={};
global.window={addEventListener:(e,cb)=>{if(e==='DOMContentLoaded')global.__ready=cb;},localStorage:{getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=v;},removeItem:k=>{delete mem[k];}},scrollY:0,scrollTo(){}};
function mk(id){return {id:id||'',style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},setAttribute(){},getAttribute(){return'';},appendChild(){},addEventListener(){},closest(){return null;},parentElement:null,querySelector(){return null;},querySelectorAll(){return[];},innerHTML:'',textContent:'',onclick:null,value:'',checked:false,focus(){},select(){},setSelectionRange(){},files:[]};}
const els={};
global.document={getElementById:id=>els[id]||(els[id]=mk(id)),querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>mk(),addEventListener(){},body:{classList:{toggle(){},contains(){return false;}}}};
const cp=require('child_process'),os=require('os'),path=require('path'),fs=require('fs');

/* ── the verdict machinery ──────────────────────────────────────────────── */
const MIN_CHECKS=87;                 // the count this file is known to run to the end
let n=0,fails=0,verdict=null;
const BAR='═'.repeat(68);
function fail(msg,err){
  verdict='fail'; process.exitCode=1;                       // works from the exit handler too
  console.log('\n'+BAR);
  console.log('  ✗✗✗  INTERACTION SUITE FAILED — DO NOT SHIP  ✗✗✗');
  console.log('  '+msg);
  if(err)console.log(String(err&&err.stack||err).replace(/^/gm,'  '));
  console.log(BAR);
  console.log(`✗ INTERACTION SUITE FAILED (${n} checks ran, ${fails} failed)`);   // last line: survives `| tail -2`
}
function pass(){verdict='pass';console.log(`\n✓ ALL ${n} INTERACTION CHECKS PASSED\n`);}
function finish(){
  if(fails)return fail(`${fails} of ${n} checks failed — see the ✗ lines above`);
  if(n<MIN_CHECKS)return fail(`only ${n} of the expected ${MIN_CHECKS} checks ran — the suite died partway, or checks were deleted without lowering MIN_CHECKS on purpose`);
  pass();
}
// A run that ends without ever reaching finish() died somewhere. Say so, loudly.
process.on('exit',()=>{if(verdict===null)fail(`the run ended without a verdict after ${n} of ${MIN_CHECKS} checks — it died partway`);});
process.on('unhandledRejection',e=>{fail('unhandled rejection — an async throw is a failure, never a pass',e);process.exit(1);});
process.on('uncaughtException',e=>{fail('uncaught exception',e);process.exit(1);});

const _d=__dirname,_b=path.join(os.tmpdir(),'rcs_combined_test.js');
fs.writeFileSync(_b,['core.js','db.js','app.js'].map(x=>fs.readFileSync(path.join(_d,x),'utf8')).join('\n'));
const app=require(_b);
const eq=(label,got,want)=>{n++;const p=JSON.stringify(got)===JSON.stringify(want);if(!p){fails++;console.log(`  ✗ ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);}else console.log(`  ✓ ${label}`);};
const T=(label,v)=>eq(label,!!v,true);
(async()=>{
  await global.__ready();
  await app.__localDb();                     // no Supabase in the test env — see __localDb
  const pid=app.__firstPid();
  await app.__openForm(pid);

  console.log('\n─ fieldKeys grouping ─');
  eq('plain field',      app.fieldKeys('property.name'), ['property.name']);
  eq('address group',    app.fieldKeys('property.addr_zip'), ['property.addr_street','property.addr_city','property.addr_state','property.addr_zip']);
  eq('writein label+on', app.fieldKeys('partb.writein.e1'), ['partb.writein.e1','partb.writein.e1.on']);
  eq('util writein +fuel',app.fieldKeys('partb.writein.u1'), ['partb.writein.u1','partb.writein.u1.on','partb.writein.u1.fuel']);

  console.log('\n─ write-in: delete → revert restores label AND checkbox ─');
  eq('e1 label seeded db', app.srcOf('partb.writein.e1'), 'database');
  eq('e1 .on seeded db',   app.srcOf('partb.writein.e1.on'), 'database');
  app.__edit('partb.writein.e1','');            // user deletes text
  app.__edit('partb.writein.e1.on','');         // empty-uncheck side effect
  T('after delete: group canRevert', app.keysCanRevert(app.fieldKeys('partb.writein.e1')));
  T('after delete: label overridden', app.srcOf('partb.writein.e1')==='overridden');
  app.__revert('partb.writein.e1'); app.__revert('partb.writein.e1.on');   // Esc
  eq('revert restores label', app.getVal('partb.writein.e1'), 'Microwave');
  eq('revert restores check', app.getVal('partb.writein.e1.on'), '1');
  eq('revert restores src',   app.srcOf('partb.writein.e1'), 'database');

  console.log('\n─ write-in: Enter saves the WHOLE group (label + .on), not just label ─');
  app.__edit('partb.writein.e1',''); app.__edit('partb.writein.e1.on','');
  for(const k of app.fieldKeys('partb.writein.e1')) await app.__saveField(k);
  eq('label saved empty',   app.getVal('partb.writein.e1'), '');
  eq('.on saved empty',     app.getVal('partb.writein.e1.on'), '');
  /* A cell saved EMPTY is on file but must not paint blue "on file" — an empty
     blue cell reads as data. core.js keeps source 'new' for a saved blank and
     records db_value '' so the clear persists; app.js's offFile() answers the
     on-file question for the exit prompt. saved_at is the proof it was written. */
  eq('label saved-empty stays new',  app.srcOf('partb.writein.e1'), 'new');
  eq('.on saved-empty stays new',    app.srcOf('partb.writein.e1.on'), 'new');
  T('group now clean (no save pending)', !app.keysCanSave(app.fieldKeys('partb.writein.e1')));

  console.log('\n─ new write-in: typed value is "new-dirty" (Enter saves, Esc clears), not revertable ─');
  app.__edit('partb.writein.e3','Gym');
  T('e3 new-dirty', app.keysNewDirty(app.fieldKeys('partb.writein.e3')));
  T('e3 not canRevert', !app.keysCanRevert(app.fieldKeys('partb.writein.e3')));
  T('e3 canSave', app.keysCanSave(app.fieldKeys('partb.writein.e3')));

  console.log('\n─ unit-type BR clear → Esc reverts (the reported bug) ─');
  eq('br seeded db', app.srcOf('units.0.br'), 'database');
  app.__edit('units.0.br','');                  // clearable Backspace/Delete
  T('cleared br is overridden', app.srcOf('units.0.br')==='overridden');
  T('cleared br canRevert', app.keysCanRevert(['units.0.br']));
  app.__revert('units.0.br');                    // Esc → revertPending
  eq('br restored', app.getVal('units.0.br'), '1BR');
  eq('br src restored', app.srcOf('units.0.br'), 'database');

  /* The designation picker beside BR/BA. "No designation" is a real answer, which
     makes its saved blank behave unlike a saved-blank text box, and the schedule
     carries a designation of its own that the picker offers as a source. */
  console.log('\n─ unit designation: options, saved blank, Enter/Escape ─');
  const DK='units.0.desig';
  const chip=()=>app.desigColors(DK)[2];        // the provenance word the cell paints
  eq('four designations plus a blank', app.DESIG.map(d=>d[0]), ['','F','E','D','NE']);
  eq('F is Family',       app.desigName('F'),  'Family');
  eq('NE is Near-elderly',app.desigName('NE'), 'Near-elderly');
  eq('an unknown code names nothing', app.desigName('zz'), '');
  /* The schedule prints the designation, and the picker offers it as a source, so
     what we read out of Column 1 has to be right in both spellings the real
     corpus uses — and a bare letter must only count at the end of the string. */
  eq('reads "1 BR E"',            app.rsParseUnitType('1 BR E').desig,            'E');
  eq('reads "1 BR F"',            app.rsParseUnitType('1 BR F').desig,            'F');
  eq('reads "2 Bedroom, Elderly"',app.rsParseUnitType('2 Bedroom, Elderly').desig,'E');
  eq('reads "3 Bedroom, Family"', app.rsParseUnitType('3 Bedroom, Family').desig, 'F');
  eq('near-elderly beats elderly',app.rsParseUnitType('1 BR Near-Elderly').desig, 'NE');
  eq('an undesignated row stays undesignated', app.rsParseUnitType('2 Bedroom').desig, '');
  eq('a letter mid-word does not designate',   app.rsParseUnitType('2 BR Efficiency').desig, '');
  eq('desig is its own cell (no address/write-in group)', app.fieldKeys(DK), [DK]);
  eq('desig has no coupled source partner',              app.coupledKeys(DK), [DK]);
  // untouched: nothing typed, nothing stored — Enter and Esc are both no-ops
  eq('untouched desig is blank', app.getVal(DK), '');
  T('untouched desig not canSave',   !app.keysCanSave([DK]));
  T('untouched desig not canRevert', !app.keysCanRevert([DK]));
  eq('untouched desig reads New', chip(), 'New');
  // one click = one step through DESIG; nothing is on file yet, so Esc clears rather than reverts
  app.__edit(DK,'F');
  eq('picking Family designates Family', app.getVal(DK), 'F');
  T('first designation is new-dirty (Enter saves)', app.keysNewDirty([DK]));
  T('first designation canSave',    app.keysCanSave([DK]));
  T('first designation not canRevert (nothing on file)', !app.keysCanRevert([DK]));
  await app.__saveField(DK);                    // Enter
  eq('saved desig value', app.getVal(DK), 'F');
  eq('saved desig src',   app.srcOf(DK), 'database');
  eq('saved desig reads On file', chip(), 'On file');
  T('saved desig is clean', !app.keysCanSave([DK]));
  // pick a different designation → override, and Escape puts the saved one back
  app.__edit(DK, 'E');
  eq('picking past the saved value', app.getVal(DK), 'E');
  T('changed desig is overridden', app.srcOf(DK)==='overridden');
  T('changed desig canRevert', app.keysCanRevert([DK]));
  eq('changed desig reads Overridden', chip(), 'Overridden');
  app.__revert(DK);                             // Escape
  eq('Escape restores saved desig', app.getVal(DK), 'F');
  eq('Escape restores desig src',   app.srcOf(DK), 'database');
  /* Picking "No designation" on a SAVED row is an override (amber, revertable),
     not a blank field. */
  app.__edit(DK, '');
  eq('picked no designation', app.getVal(DK), '');
  T('clearing a saved desig is an override', app.srcOf(DK)==='overridden');
  T('cleared desig canRevert', app.keysCanRevert([DK]));
  /* Saving "no designation". core.js keeps source 'new' for any saved blank so
     an empty TEXT box can never paint blue — but a chip is not a text box, and
     once the row is saved the answer is on file like any other. desigColors()
     is what resolves that: db_value matches value, so the chip reads On file. */
  await app.__saveField(DK);
  eq('saved-blank desig value',    app.getVal(DK), '');
  eq('saved-blank desig db_value', app.__cell(DK).db_value, '');
  T('saved-blank desig: db_value matches value (it IS on file)', app.__cell(DK).db_value===app.getVal(DK));
  eq('saved-blank desig keeps src new (core: blanks never paint blue)', app.srcOf(DK), 'new');
  eq('saved-blank desig chip still reads On file', chip(), 'On file');
  T('saved-blank desig is clean — Enter has nothing to save', !app.keysCanSave([DK]));
  T('saved-blank desig has nothing to revert',                !app.keysCanRevert([DK]));
  /* Designating a row that was saved blank. core.js treats a saved blank as
     "nothing on file" for override purposes, so the store calls this new-dirty
     (Enter saves, Escape clears the entry) — while the chip still paints amber,
     because offFile() sees the value drift from the stored blank. */
  app.__edit(DK,'D');
  T('designating a saved-blank row is new-dirty', app.keysNewDirty([DK]));
  T('designating a saved-blank row canSave',      app.keysCanSave([DK]));
  eq('designating a saved-blank row still paints Overridden', chip(), 'Overridden');

  console.log('\n─ money + address: edit→overridden→revert ─');
  eq('current seeded', app.getVal('units.0.current'), '1903');
  app.__edit('units.0.current','2000');
  T('current overridden', app.srcOf('units.0.current')==='overridden');
  T('current canSave', app.keysCanSave(['units.0.current']));
  app.__revert('units.0.current');
  eq('current reverted', app.getVal('units.0.current'), '1903');
  app.__edit('property.addr_zip','99999');
  T('zip overridden→group canRevert', app.keysCanRevert(app.fieldKeys('property.addr_zip')));
  app.fieldKeys('property.addr_zip').forEach(k=>app.__revert(k));
  eq('zip reverted', app.getVal('property.addr_zip'), '60091');

  console.log('\n─ clean field: Enter is a no-op (nothing to save) ─');
  T('untouched sig.name not canSave', !app.keysCanSave(['sig.name']));
  T('untouched sig.name not canRevert', !app.keysCanRevert(['sig.name']));

  console.log('\n─ truly-new custom cell: new-dirty (turns overridable only after save) ─');
  app.__edit('units.0.ua_custom','1500');
  T('ua_custom new-dirty', app.keysNewDirty(['units.0.ua_custom']));
  T('ua_custom not canRevert (nothing on file)', !app.keysCanRevert(['units.0.ua_custom']));

  console.log('\n─ coupled source-selector saves (mgmt + UA/SAFMR/date) ─');
  eq('coupledKeys ua_custom', app.coupledKeys('units.0.ua_custom'), ['units.0.ua_custom','units.0.ua_source']);
  eq('coupledKeys safmr_custom', app.coupledKeys('units.0.safmr_custom'), ['units.0.safmr_custom','units.0.safmr_source']);
  eq('coupledKeys date_eff', app.coupledKeys('rent_schedule.date_eff_custom'), ['rent_schedule.date_eff_custom','rent_schedule.date_eff_source']);
  eq('coupledKeys plain unchanged', app.coupledKeys('property.name'), ['property.name']);
  // mgmt: save a custom address (with its source), then "use property address" must read as OVERRIDE (orange)
  app.__edit('tenant.mgmt_source','custom'); app.__edit('tenant.mgmt_street','123 Main St');
  for(const k of ['tenant.mgmt_street','tenant.mgmt_city','tenant.mgmt_state','tenant.mgmt_zip','tenant.mgmt_source']) await app.__saveField(k);
  T('mgmt_source persisted as custom (database)', app.getVal('tenant.mgmt_source')==='custom'&&app.srcOf('tenant.mgmt_source')==='database');
  app.__edit('tenant.mgmt_source','property');
  T('use property address → OVERRIDDEN (orange, save/revert combo)', app.srcOf('tenant.mgmt_source')==='overridden');
  app.__revert('tenant.mgmt_source');
  T('revert → saved custom restored (blue)', app.getVal('tenant.mgmt_source')==='custom'&&app.srcOf('tenant.mgmt_source')==='database');
  // ua custom: saving the custom value + its source, then switching to exec must read as override
  app.__edit('units.0.ua_source','custom'); app.__edit('units.0.ua_custom','42');
  for(const k of app.coupledKeys('units.0.ua_custom')) await app.__saveField(k);
  T('ua_source persisted as custom', app.getVal('units.0.ua_source')==='custom'&&app.srcOf('units.0.ua_source')==='database');
  app.__edit('units.0.ua_source','exec');
  T('switch UA→exec after saved-custom → overridden (no phantom/blue skip)', app.srcOf('units.0.ua_source')==='overridden');
  finish();
})().catch(e=>fail('the suite threw before reaching its verdict',e));
