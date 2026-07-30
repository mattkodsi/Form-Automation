/* test_shots.js — the screenshot sweep, held to producing pictures.

   WHY. shots.js exists so a human can LOOK at the form instead of reasoning
   about it from app.js. A sweep that silently framed nothing would be worse
   than no sweep: a directory of 39 valid, blank, 200-byte PNGs reads as
   success. So this suite runs the real sweep into a temporary directory and
   asks of every file it wrote: is it a PNG, is it big enough to hold an image,
   and are its dimensions those of a thing on a page?

   It also names the shots that must exist. The sweep discovers most of its
   subjects (every card in #sections, whichever cell is virgin), so a rename or
   a dropped view would otherwise just quietly reduce the count.

   No chromium means NOTHING WAS RENDERED. That is a failure with a non-zero
   exit, not a skip that reads as a pass — the entire value of the file is that
   it renders. */

const cp=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const {findChrome}=require('./cdplib.js');

const MIN_CHECKS=83;    /* 2026-07-30: the sweep's first suite — 46 images plus 37 named
                           and structural checks. Adding checks? Raise this. */
let n=0,fails=0,verdict=null;
const BAR='═'.repeat(68);
function fail(msg,err){
  verdict='fail';process.exitCode=1;
  console.log('\n'+BAR);
  console.log('  ✗✗✗  SHOTS SUITE FAILED — DO NOT SHIP  ✗✗✗');
  console.log('  '+msg);
  if(err)console.log(String(err&&err.stack||err).replace(/^/gm,'  '));
  console.log(BAR);
  console.log(`✗ SHOTS SUITE FAILED (${n} checks ran, ${fails} failed)`);
}
function pass(){verdict='pass';console.log(`\n✓ ALL ${n} SHOTS CHECKS PASSED\n`);}
function finish(){
  if(fails)return fail(`${fails} of ${n} checks failed — see the ✗ lines above`);
  if(n<MIN_CHECKS)return fail(`only ${n} of the expected ${MIN_CHECKS} checks ran — the suite died partway, or checks were deleted without lowering MIN_CHECKS on purpose`);
  pass();
}
process.on('exit',()=>{if(verdict===null)fail(`the run ended without a verdict after ${n} of ${MIN_CHECKS} checks — it died partway`);});
process.on('uncaughtException',e=>{fail('uncaught exception',e);process.exit(1);});

const eq=(label,got,want)=>{n++;const p=JSON.stringify(got)===JSON.stringify(want);
  if(!p){fails++;console.log(`  ✗ ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);}else console.log(`  ✓ ${label}`);};
const T=(label,v)=>eq(label,!!v,true);

/* ── a chromium is not optional here ────────────────────────────────────── */
if(!findChrome()){
  verdict='fail';
  console.log('\n'+BAR);
  console.log('  ⚠  NO CHROMIUM — NOTHING WAS RENDERED, SO NOTHING WAS VERIFIED');
  console.log('  This suite exists to prove the app can be photographed. Without a');
  console.log('  browser it cannot run at all. Install one:');
  console.log('    npx playwright install chromium');
  console.log(BAR);
  console.log('✗ SHOTS SUITE COULD NOT RUN (0 checks — this is not a pass)');
  process.exit(1);
}

/* ── run the real sweep, into our own directory ─────────────────────────── */
/* Per pid, because run_tests.sh may be running in two worktrees at once and a
   fixed name would have one run deleting the other's output mid-sweep — the
   same fault that had test_browser.js serving somebody else's bundle. */
const OUT=path.join(os.tmpdir(),'rcs_shots_check.'+process.pid);
process.on('exit',()=>{try{fs.rmSync(OUT,{recursive:true,force:true});}catch(e){}});

console.log('── running the sweep (this drives a real browser; ~40s) ──────');
let code=0,out='';
try{
  out=cp.execFileSync('node',[path.join(__dirname,'shots.js'),OUT],
    {encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:1<<24});
}catch(e){code=e.status==null?1:e.status;out=String((e.stdout||'')+(e.stderr||''));}
eq('the sweep exits clean',code,0);
T('and says how many images it wrote',/images written to/.test(out));

/* ── the output directory ───────────────────────────────────────────────── */
T('the output directory exists',fs.existsSync(OUT));
const files=fs.existsSync(OUT)?fs.readdirSync(OUT).sort():[];
const pngs=files.filter(f=>/\.png$/.test(f));
T('an index accompanies the images',files.indexOf('index.md')>=0);
const idx=files.indexOf('index.md')>=0?fs.readFileSync(path.join(OUT,'index.md'),'utf8'):'';
T('the index is a document, not a stub',idx.length>1200);
T('the index names every image it lists',pngs.every(f=>idx.indexOf(f)>=0));
T('the index records the colours measured off the live elements',/background/.test(idx)&&/left bar/.test(idx));
T('the index records what focus computes to',/outline/.test(idx));
T('the index records the horizontal overflow it measured',/Horizontal overflow/.test(idx));
/* Five entries in CLR, five rows. If a state stops being reachable the sweep
   must still account for it rather than quietly photograph four. */
eq('the index accounts for all five CLR states',
   ['new','database','overridden','this_cycle','auto_calculated'].filter(k=>idx.indexOf('| '+k+' |')<0),[]);
T('and says plainly that auto-calculated had to be forced',/No code path assigns it/.test(idx));
T('the sweep reports the console it saw',/## Console/.test(idx));

/* 35 is the floor the brief sets: four views, nine sections, five provenance
   states, four interactive states, and a narrow pass. The sweep discovers the
   section cards, so the exact number moves with the form; this catches a sweep
   that quietly stopped photographing half of it. */
T(`at least 35 images (got ${pngs.length})`,pngs.length>=35);

/* ── every image is an image ────────────────────────────────────────────── */
/* A clip that lands off the page still returns a valid PNG. It is small, it is
   one flat colour, and it is worthless. Both tests below exist because either
   one alone passes on such a file. */
const PNGSIG=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
let dims=[];
for(const f of pngs){
  const b=fs.readFileSync(path.join(OUT,f));
  const okSig=b.length>8&&b.slice(0,8).equals(PNGSIG);
  const w=okSig?b.readUInt32BE(16):0, h=okSig?b.readUInt32BE(20):0;
  dims.push({f,w,h,bytes:b.length});
  T(`${f}: a real PNG of plausible size (${w}x${h}, ${b.length} B)`,
    okSig&&b.length>=900&&w>=40&&h>=40&&w<=12000&&h<=12000);
}
/* One flat rectangle compresses to almost nothing. Anything carrying text or a
   control does not. The threshold is deliberately low — 22 bytes per thousand
   pixels — so it catches "blank" and never "sparse". */
const thin=dims.filter(d=>d.bytes/((d.w*d.h)/1000)<0.9);
eq('no image is a blank rectangle',thin.map(d=>d.f+' ('+d.bytes+' B for '+d.w+'x'+d.h+')'),[]);

/* ── the sweep photographed the things it was built to photograph ───────── */
const has=re=>pngs.some(f=>re.test(f));
T('the property gallery',has(/^01-view-menu/));
T('the launcher',has(/^03-view-launcher/));
T('the contacts view',has(/^04-view-contacts/));
T('the form',has(/^05-view-form/));
T('the command-center bar',has(/^06-command-center/));
T('the section rail and its source key',has(/^08-section-rail/));
T('the footer',has(/^09-footer/));
const secs=pngs.filter(f=>/^10-section-/.test(f));
T(`each form section framed on its own (got ${secs.length})`,secs.length>=9);
T('provenance: new',has(/^20-prov-new/));
T('provenance: database',has(/^21-prov-database/));
T('provenance: overridden',has(/^22-prov-overridden/));
T('provenance: this-cycle',has(/^23-prov-this-cycle/));
T('provenance: auto-calculated',has(/^24-prov-auto-calculated/));
T('a focused text cell',has(/^30-cell-focused/));
T('a dropdown trigger holding focus',has(/^31-dropdown-trigger-focused/));
T('the same control without focus, to compare against',has(/^31b-dropdown-trigger-unfocused/));
T('an open dropdown',has(/^32-dropdown-open/));
T('the conflict controls',has(/^33-conflict/));
T('the narrow form',has(/^40-view-form-860/));
T('the narrow gallery',has(/^44-view-menu-860/));
T('the narrow launcher',has(/^45-view-launcher-860/));

/* The element-scoped shots are the point — a reviewer must be able to read a
   cell. At scale 2 a form cell is at least ~300 device pixels across; a shot
   narrower than that means the clip framed a chevron rather than the control. */
const prov=dims.filter(d=>/^2[0-4]-prov/.test(d.f));
eq('every provenance shot is framed wide enough to read the cell',
   prov.filter(d=>d.w<300).map(d=>d.f+' ('+d.w+'px)'),[]);
/* And the two viewports really were different: the narrow pass must produce
   narrower page shots than the wide one, or the resize never took. */
const wide=dims.find(d=>/^01-view-menu-1440/.test(d.f)), narrow=dims.find(d=>/^44-view-menu-860/.test(d.f));
T('the narrow pass really resized the viewport',wide&&narrow&&narrow.w<wide.w);

finish();
