/* smoke_combined.js — headless render smoke of the assembled app:
   menu -> launcher -> form, plus exit dirty-detection. Run: node smoke_combined.js */
global.CSS={escape:s=>s};
const mem={};
global.window={addEventListener:(e,cb)=>{if(e==='DOMContentLoaded')global.__ready=cb;},localStorage:{getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=v;},removeItem:k=>{delete mem[k];}},scrollY:0,scrollTo(){}};
const els={};
function mk(id){return {id:id||'',style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},setAttribute(){},getAttribute(){return'';},appendChild(){},addEventListener(){},closest(){return null;},parentElement:null,querySelector(){return null;},querySelectorAll(){return[];},innerHTML:'',textContent:'',onclick:null,value:'',checked:false,focus(){},select(){},files:[]};}
global.document={getElementById:id=>els[id]||(els[id]=mk(id)),querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>mk(),addEventListener(){},body:{classList:{toggle(){},contains(){return false;}}}};
const app=require('./combined.js');
const fail=(m)=>{console.error('  ✗ FAIL',m);process.exit(1);};
(async()=>{
  await global.__ready();               // boots to the MENU
  const grid=els.menuGrid.innerHTML;
  if(!/Gates Manor Apartments/.test(grid)) fail('menu missing Gates');
  if(!/class="pcard"/.test(grid)) fail('menu missing property cards');
  if(!/ringsvg/.test(grid)) fail('menu missing completeness ring');
  if(!/Updated /.test(grid)) fail('menu missing last-updated');
  if(!/newcard/.test(grid)) fail('menu missing New property tile');
  if(/undefined/.test(grid)) fail('undefined leaked into menu');
  if(!/propert/.test(els.menuCount.textContent)) fail('menu count chip: '+els.menuCount.textContent);
  console.log('  ✓ MENU renders cards + ring + last-updated + New tile ('+els.menuCount.textContent.trim()+')');

  const pid=app.__firstPid();
  app.openLauncher(pid);
  const lb=els.launcherBody.innerHTML;
  if(!/Gates Manor Apartments/.test(lb)) fail('launcher missing property name');
  if(!/Choose a program/.test(lb)) fail('launcher missing program picker');
  if(!/>RCS<\/span>/.test(lb)) fail('launcher missing RCS card');
  if(!/Coming soon/.test(lb)) fail('launcher missing coming-soon programs');
  if(!/letterhead/i.test(lb)) fail('launcher missing letterhead slot');
  if(!/PASS|OVER|rents|set up/.test(lb)) fail('launcher missing RCS status line');
  if(!/AFFORDABILITY CHECK/.test(lb)) fail('launcher missing embedded affordability pane');
  if(!/150% ceiling/.test(lb)) fail('affordability pane missing ceiling');
  if(/renewal/i.test(lb)) fail('renewal terminology still present in launcher');
  if(/undefined/.test(lb)) fail('undefined leaked into launcher');
  console.log('  ✓ LAUNCHER renders summary + letterhead + RCS(active) + 3 coming-soon');

  await app.__openForm(pid);            // into the RCS form
  const a=app.analysis();
  if(Math.round(a.pg)!==140556) fail('proposed GPR '+a.pg);
  if(Math.round(a.ceil)!==178245) fail('ceiling '+a.ceil);
  if(els.hdrProp.textContent!=='Gates Manor Apartments') fail('form header name='+els.hdrProp.textContent);
  if(!/RCS Package/.test(els.hdrProgram.textContent)) fail('program label='+els.hdrProgram.textContent);
  const secs=els.sections.innerHTML;
  if(secs.length<2000) fail('form body too short: '+secs.length);
  if(!/150% SAFMR/.test(secs)) fail('SAFMR column missing');
  if(!/ucard/.test(secs)) fail('unit cards missing');
  if(!/Unit type 1/.test(secs)) fail('unit card header missing');
  if(!/Wilmette/.test(secs)) fail('address not rendered');
  if(/undefined/.test(secs)) fail('undefined leaked into form');
  console.log('  ✓ FORM renders unchanged: $140,556/$178,245, header, SAFMR cards, address');

  if(app.isDirty()) fail('freshly opened form should not be dirty');
  app.__edit('property.name','Gates Manor Apartments (edited)');
  if(!app.isDirty()) fail('edit should mark the form dirty (drives the exit prompt)');
  console.log('  ✓ EXIT dirty-detection: clean on open, dirty after an edit');

  console.log('\nSMOKE OK — menu -> launcher -> form render end to end; exit guard works');
})().catch(e=>{console.error('SMOKE FAIL:',e&&e.stack||e);process.exit(1);});
