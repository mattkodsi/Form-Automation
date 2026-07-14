/* test_interactions.js — drives the real store through the save/revert/group
   decisions behind the esc/enter behavior. DOM is stubbed (like smoke_combined). */
global.CSS={escape:s=>s};
const mem={};
global.window={addEventListener:(e,cb)=>{if(e==='DOMContentLoaded')global.__ready=cb;},localStorage:{getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=v;},removeItem:k=>{delete mem[k];}},scrollY:0,scrollTo(){}};
function mk(id){return {id:id||'',style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},setAttribute(){},getAttribute(){return'';},appendChild(){},addEventListener(){},closest(){return null;},parentElement:null,querySelector(){return null;},querySelectorAll(){return[];},innerHTML:'',textContent:'',onclick:null,value:'',checked:false,focus(){},select(){},setSelectionRange(){},files:[]};}
const els={};
global.document={getElementById:id=>els[id]||(els[id]=mk(id)),querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>mk(),addEventListener(){},body:{classList:{toggle(){},contains(){return false;}}}};
const cp=require('child_process'),os=require('os'),path=require('path'),fs=require('fs');
const _d=__dirname,_b=path.join(os.tmpdir(),'rcs_combined_test.js');
fs.writeFileSync(_b,['core.js','db.js','app.js'].map(x=>fs.readFileSync(path.join(_d,x),'utf8')).join('\n'));
const app=require(_b);
let n=0,fails=0;
const eq=(label,got,want)=>{n++;const p=JSON.stringify(got)===JSON.stringify(want);if(!p){fails++;console.log(`  ✗ ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);}else console.log(`  ✓ ${label}`);};
const T=(label,v)=>eq(label,!!v,true);
(async()=>{
  await global.__ready();
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
  eq('label now database',  app.srcOf('partb.writein.e1'), 'database');
  eq('.on now database',    app.srcOf('partb.writein.e1.on'), 'database');
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
  console.log(`\n${fails===0?'✓ ALL '+n+' INTERACTION CHECKS PASSED':'✗ '+fails+' / '+n+' FAILED'}\n`);
  process.exit(fails?1:0);
})().catch(e=>{console.error('TEST ERROR:',e&&e.stack||e);process.exit(1);});
