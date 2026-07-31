/* shots.js — a photograph of the real app, not a description of it.

   WHY THIS EXISTS. Twice on this project an audit asserted something about the
   form's interior — a cell's colour, its provenance, whether a control shows
   focus — from reading app.js, and twice it was wrong. The standing rule became
   "drive the real bundle". But the driver we had (test_browser.js) only ever
   asks the DOM questions; nobody had ever LOOKED at the rendered page. A
   getBoundingClientRect cannot see two colours that are the same colour, a
   label overlapping the value beside it, or a control whose focus state is
   invisible. A picture can.

   HOW. Exactly the boot test_browser.js uses — cdplib.js builds a bundle,
   serves it on loopback, drives a real headless chromium over CDP — plus
   Page.captureScreenshot. Element-scoped: a clip framed on getBoundingClientRect
   at 2x, so a reviewer can read the text in one cell rather than squint at a
   1440px page.

   THE STATES ARE DRIVEN, NOT DRAWN. Every provenance colour below is reached
   through the app's own doors (__editCell / __saveField / __setRsParsed +
   __rsFill) and painted by the app's own painter. A screenshot of a div someone
   styled by hand proves nothing at all.

   Run:  node app/full-mp/shots.js [outdir]        (default app/full-mp/_shots)
   Output: PNGs + index.md, every path printed absolute. */

const {sleep,withApp,findChrome}=require('./cdplib.js');
const fs=require('fs'),path=require('path');

const OUT=path.resolve(process.argv[2]||path.join(__dirname,'_shots'));
const SCALE=2;                      /* retina, so 11px helper text is readable */
const shots=[];

/* ── capture ────────────────────────────────────────────────────────────── */
async function png(c,name,title,what,clip){
  const r=await c.send('Page.captureScreenshot',
    Object.assign({format:'png'},clip?{clip,captureBeyondViewport:true}:{}));
  const file=path.join(OUT,name+'.png');
  const buf=Buffer.from(r.data,'base64');
  fs.writeFileSync(file,buf);
  /* PNG IHDR: width and height are big-endian at bytes 16 and 20. Reading them
     back is the only way to know the clip produced anything; an off-page clip
     returns a valid, tiny, blank PNG. */
  const w=buf.readUInt32BE(16),h=buf.readUInt32BE(20);
  shots.push({file,name,title,what,w,h,bytes:buf.length});
  console.log(`  ${file}  ${w}x${h}  ${buf.length.toLocaleString()} B  — ${title}`);
  return file;
}
/* the whole page, however tall it is */
async function shotPage(c,name,title,what){
  const d=await c.eval(`return {w:Math.max(document.documentElement.scrollWidth,innerWidth),
    h:Math.min(Math.max(document.documentElement.scrollHeight,innerHeight),6000)}`);
  return png(c,name,title,what,{x:0,y:0,width:d.w,height:d.h,scale:1});
}
/* one element, framed with room around it */
async function shotEl(c,name,title,what,sel,pad){
  pad=pad==null?10:pad;
  const b=await c.eval(`const e=document.querySelector(${JSON.stringify(sel)});
    if(!e)return null; e.scrollIntoView({block:'center'});
    const r=e.getBoundingClientRect();
    return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height};`);
  if(!b||b.w<1||b.h<1){console.log(`  ⚠ SKIPPED ${name}: no element for ${sel}`);
    shots.push({file:null,name,title,what,w:0,h:0,bytes:0,missing:sel});return null;}
  return png(c,name,title,what,{x:Math.max(0,b.x-pad),y:Math.max(0,b.y-pad),
    width:b.w+pad*2,height:b.h+pad*2,scale:SCALE});
}
/* a rectangle spanning several elements — a cell plus the menu that drops out
   of it, which is absolutely positioned and so falls outside the cell's box */
async function shotSpan(c,name,title,what,sels,pad){
  pad=pad==null?12:pad;
  const b=await c.eval(`const ss=${JSON.stringify(sels)};
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,found=0;
    for(const s of ss){const e=document.querySelector(s); if(!e)continue;
      const r=e.getBoundingClientRect(); if(r.width<1&&r.height<1)continue; found++;
      x0=Math.min(x0,r.left+scrollX); y0=Math.min(y0,r.top+scrollY);
      x1=Math.max(x1,r.right+scrollX); y1=Math.max(y1,r.bottom+scrollY);}
    return found?{x:x0,y:y0,w:x1-x0,h:y1-y0}:null;`);
  if(!b){console.log(`  ⚠ SKIPPED ${name}: none of ${sels.join(', ')}`);
    shots.push({file:null,name,title,what,w:0,h:0,bytes:0,missing:sels.join(', ')});return null;}
  return png(c,name,title,what,{x:Math.max(0,b.x-pad),y:Math.max(0,b.y-pad),
    width:b.w+pad*2,height:b.h+pad*2,scale:SCALE});
}

/* Exactly what fills the window, with no clip at all. The clipped shots above
   are in PAGE coordinates, and a position:sticky bar renders wherever the
   scroll happens to have put it — so a clip can invent an overlap that no user
   ever sees, and can equally hide one. Anything about sticky chrome has to be
   decided on one of these. */
async function shotViewport(c,name,title,what){
  /* NO clip. A clip is resolved in PAGE coordinates, so {x:0,y:0} photographs
     the top of the document however far down the window has scrolled — which
     silently made three "window" shots identical on the first run of this
     block. Passing no clip is the only way to get the window itself. */
  return png(c,name,title,what,null);
}
/* The rail is `position:sticky`, so it belongs to the window-true family: a
   clipped shot is resolved in PAGE coordinates and would draw the rail wherever
   scroll 0 would have put it, not where the reader is looking at it. These are
   therefore uncropped windows — but at deviceScaleFactor 2, because the thing
   under review is a 2px focus ring and a 38px indicator, and at 1x a reviewer
   is squinting at exactly the pixels the shot exists to show. */
async function shotWindow2x(c,w,h,name,title,what){
  await c.send('Emulation.setDeviceMetricsOverride',
    {width:w,height:h,deviceScaleFactor:2,mobile:false});
  await sleep(260);
  const f=await png(c,name,title,what,null);
  await c.send('Emulation.setDeviceMetricsOverride',
    {width:w,height:h,deviceScaleFactor:1,mobile:false});
  await sleep(200);
  return f;
}
async function viewport(c,w,h){
  await c.send('Emulation.setDeviceMetricsOverride',
    {width:w,height:h,deviceScaleFactor:1,mobile:false});
  await sleep(200);
}

/* ── the sweep ──────────────────────────────────────────────────────────── */
/* What the eye is meant to be able to do with each shot is written into
   index.md beside it, because a directory of PNGs named 06.png tells a reviewer
   nothing about what he is supposed to be looking for. */
const measured={};

async function sweep(c){
  const pid=await c.eval('return window.__t.__firstPid()');
  if(!pid)throw new Error('the selftest database seeded no property — nothing to photograph');

  /* ═══ WIDE ═══════════════════════════════════════════════════════════ */
  await viewport(c,1440,960);

  console.log('\n── the four views, wide (1440) ──────────────────────────');
  await c.eval('window.__t.openMenu();return 1');await sleep(400);
  await shotPage(c,'01-view-menu-1440','Property gallery (#viewMenu)',
    'The home page. Look for: card alignment, the filter rail, whether long property names wrap or clip, the completeness rings.');
  await shotEl(c,'02-menu-card','A single property card',
    'One card at 2x. Look for: text fitting its card, the ring legible, the status line readable.','#menuGrid > *',6);

  await c.eval(`window.__t.openLauncher(${JSON.stringify(pid)});return 1`);await sleep(450);
  await shotPage(c,'03-view-launcher-1440','Property launcher (#viewLauncher)',
    'Property summary, package list, letterhead. Look for: the package rows, the score ring, buttons that fit their labels.');

  await c.eval("const b=document.getElementById('bContacts');if(b)b.click();return 1");await sleep(400);
  await shotPage(c,'04-view-contacts-1440','Contacts (#viewContacts)',
    'The PM contact directory. Look for: column alignment, empty-state wording, action buttons.');

  await c.eval(`await window.__t.__openForm(${JSON.stringify(pid)});return 1`);await sleep(700);
  await shotPage(c,'05-view-form-1440','The RCS form (#viewForm)',
    'The whole form, top to bottom. Look for: the section rail against the cards, the source key, the footer.');

  console.log('\n── the chrome around the form ───────────────────────────');
  await shotEl(c,'06-command-center','Command-center bar (#ccbar)',
    'The thin bar above the header. Look for: whether its text is legible at that height, and whether it says anything useful.',
    '#viewForm #ccbar',0);
  await shotEl(c,'06b-form-header','Form header (.hdr)',
    'Property name, programme and the RCS/OCAF/UAF/BBRA pills. Look for: overlap between the name, the pills and the buttons.',
    '#viewForm .hdr',0);
  await shotSpan(c,'07-cc-cards','The command-center cards (#cc)',
    'The document cards. Look for: equal heights, clipped labels, the progress language.',['#cc'],8);
  await shotEl(c,'08-section-rail','Section rail + SOURCE KEY',
    'The left rail. Look for: the four legend swatches — are any two the same colour? — and whether the wording fits.',
    '#viewForm .rail',6);
  await shotEl(c,'09-footer','The form footer',
    'Update / Generate / Revert and the unsaved tag. Look for: buttons colliding at width, the unsaved dot.',
    '#viewForm .footer',6);

  /* the nine sections, each framed on its own card */
  console.log('\n── the nine sections, individually ──────────────────────');
  const cards=await c.eval(`return [...document.querySelectorAll('#sections .card')]
    .map((c,i)=>({i,title:(c.querySelector('.ctitle')||{}).textContent||'?'}));`);
  measured.sectionCount=cards.length;
  for(const s of cards){
    const nm='10-section-'+String(s.i+1).padStart(2,'0')+'-'+
      s.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    await shotEl(c,nm,'Section '+(s.i+1)+': '+s.title,
      'The whole card at 2x. Look for: label/value overlap, a column narrower than its content, helper text that runs under a control.',
      `#sections .card:nth-of-type(${s.i+1})`,6);
  }

  /* ═══ PROVENANCE ════════════════════════════════════════════════════ */
  /* Every state below is REACHED, then photographed. The measured colours are
     read off the live element afterwards and written into index.md, so the
     claim "these two are the same blue" is a number and not an impression. */
  console.log('\n── the provenance colours, on real cells ────────────────');
  /* The cell has to be one the seeded record has NEVER saved, or the ladder
     starts at 'overridden' and the grey of a new cell is never seen at all —
     which is exactly what the first run of this sweep did. Ask the record which
     of its cells is virgin rather than picking one by name. */
  const K=await c.eval(`const f=window.__t.__form();
    return Object.keys(f).find(k=>document.querySelector('[data-box="'+k+'"]')
      && (f[k].db_value===''||f[k].db_value==null) && !f[k].value
      && (document.querySelector('[data-box="'+k+'"]').querySelector('input'))
      && !window.__t.__srcTags(k))||null;`);
  if(!K)throw new Error('no virgin cell in the seeded record — the provenance ladder cannot start');
  measured.provCell=K;
  const SEL='[data-box="'+K+'"]';
  const paint=async()=>c.eval(`const e=document.querySelector('${SEL}');
    if(!e)return null;const cs=getComputedStyle(e);
    return {src:window.__t.srcOf('${K}'),bg:cs.backgroundColor,bar:cs.borderLeftColor,
      val:(e.querySelector('input')||{}).value||''};`);

  /* auto-calculated FIRST, while the cell is still untouched. CLR has five
     entries; grep the whole of app/full-mp and 'auto-calculated' appears on
     exactly one line — its own definition. Nothing ever assigns it, so there is
     no door to drive. Put the source on the live record and fire the app's OWN
     repaint (__paintCell, the one a keystroke uses) — real pixels from the real
     painter — and note in the index that it had to be forced. */
  await c.eval(`const f=window.__t.__form();f['${K}'].value='1,234';
    f['${K}'].source='auto-calculated';window.__t.__paintCell('${K}');return 1`);
  await sleep(200);
  measured.prov_auto_calculated=await paint();
  await shotEl(c,'24-prov-auto-calculated','Provenance: AUTO-CALCULATED (forced — nothing in the app assigns it)',
    'CLR["auto-calculated"], painted by the app\u2019s own paintCell. Hold this beside 21-prov-database.',SEL,30);

  await c.eval(`await window.__t.__openForm(${JSON.stringify(pid)});return 1`);await sleep(700);
  await c.eval(`window.__t.__editCell('${K}','Marshall & Stevens');window.__t.__renderBody();return 1`);
  await sleep(300);
  measured.prov_new=await paint();
  await shotEl(c,'20-prov-new','Provenance: NEW (typed, never saved)',
    'CLR.new \u2014 a grey #64748b rule on the inset surface every cell sits on. Typed into, never saved.',SEL,30);

  await c.eval(`await window.__t.__saveField('${K}');window.__t.__renderBody();return 1`);
  await sleep(300);
  measured.prov_database=await paint();
  await shotEl(c,'21-prov-database','Provenance: DATABASE (on file)',
    'CLR.database \u2014 a blue #2563eb rule, same surface. The same cell, after a real save: the RULE is the whole of what changed.',SEL,30);

  await c.eval(`window.__t.__editCell('${K}','Cushman & Wakefield');window.__t.__renderBody();return 1`);
  await sleep(300);
  measured.prov_overridden=await paint();
  await shotEl(c,'22-prov-overridden','Provenance: OVERRIDDEN',
    'CLR.overridden \u2014 an amber #b45309 rule AND a wash (#fbf1e6). One of the two states that wants your hands.',SEL,30);

  /* this-cycle: fill the form from the captured Azure reading of White Oak's
     executed schedule \u2014 the same fixture test_browser.js drives \u2014 and take the
     first cell the parse actually wrote. */
  const scan=JSON.parse(fs.readFileSync(path.join(__dirname,'fixture_rs_scan.json'),'utf8'));
  const rec=await c.eval('return await window.__t.ocrMapPages('+JSON.stringify(scan)+')');
  await c.eval('window.__t.__setRsParsed('+JSON.stringify(rec)+');window.__t.__rsFill();window.__t.__renderBody();return 1');
  await sleep(600);
  const tc=await c.eval(`const f=window.__t.__form();
    const k=Object.keys(f).find(k=>f[k]&&f[k].source==='this-cycle'&&document.querySelector('[data-box="'+k+'"]'));
    if(!k)return null;const e=document.querySelector('[data-box="'+k+'"]');const cs=getComputedStyle(e);
    return {key:k,src:'this-cycle',bg:cs.backgroundColor,bar:cs.borderLeftColor,sel:'[data-box="'+k+'"]'};`);
  measured.prov_this_cycle=tc;
  if(tc)await shotEl(c,'23-prov-this-cycle','Provenance: THIS-CYCLE ('+tc.key+')',
    'CLR["this-cycle"] \u2014 a teal #0f766e rule AND a wash (#e9f5f2). Filled from the uploaded rent schedule, unsaved.',tc.sel,30);
  else console.log('  \u26a0 no this-cycle cell after the parse');

  await shotEl(c,'25-source-key-swatches','The SOURCE KEY legend, magnified',
    'Four rules for five states, drawn the way the cells now draw them. Look for: whether any two are distinguishable, and what is missing.',
    '#viewForm .rail .key',6);

  /* ═══ INTERACTIVE STATES ═══════════════════════════════════════════ */
  console.log('\n── the interactive states ───────────────────────────────');
  await c.eval(`await window.__t.__openForm(${JSON.stringify(pid)});return 1`);await sleep(700);

  /* a text cell with the caret in it */
  await c.eval(`const i=document.querySelector('[data-k="poc.name"]');i.focus();return 1`);
  await sleep(250);
  await shotEl(c,'30-cell-focused-input','A text cell with focus',
    'The point of contact input, focused. Look for: is there ANY visible focus indication on the cell?',
    '[data-box="poc.name"]',10);

  /* A dropdown trigger reached the way a keyboard user reaches it. Programmatic
     .focus() and a Tab press are not the same thing to CSS \u2014 :focus-visible
     fires on one and can be withheld from the other \u2014 and the question here is
     precisely what a keyboard user sees. So: click into a text box, then press
     real Tab keys until a .uatrigger holds focus. */
  const trigSel='[data-trigfor="owner.entity_type"]';
  await c.eval(`const i=document.querySelector('[data-k="owner.entity_name"]');
    if(i){i.scrollIntoView({block:'center'});i.click();i.focus();}return 1`);
  await sleep(200);
  let tabs=0,landed=false;
  for(;tabs<12;tabs++){
    await c.key('Tab');
    landed=await c.eval(`const a=document.activeElement;
      return !!(a&&a.classList&&a.classList.contains('uatrigger'));`);
    if(landed)break;
  }
  measured.tabsToTrigger=landed?tabs+1:null;
  const focused=landed?'document.activeElement':null;
  measured.trigFocusRing=await c.eval(`const t=${landed?'document.activeElement':`document.querySelector('${trigSel}')`};
    if(!t)return null;const cs=getComputedStyle(t);
    return {reachedByTab:${landed},which:t.getAttribute('data-trigfor')||t.title||'(unnamed)',
      outline:cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor,
      boxShadow:cs.boxShadow,border:cs.borderColor,background:cs.backgroundColor};`);
  /* A trigger can be a 24px chevron, which framed on its own is unreadable.
     Mark its enclosing cell so the frame shows the control IN the cell it
     belongs to — that is where a ring would have to be visible. */
  await c.eval(`document.querySelectorAll('[data-shotmark]').forEach(e=>e.removeAttribute('data-shotmark'));
    const t=document.querySelector('#viewForm .uatrigger:focus')||document.querySelector('${trigSel}');
    if(t){const cell=t.closest('[data-box]')||t.closest('.field')||t;cell.setAttribute('data-shotmark','1');}
    return 1;`);
  await shotSpan(c,'31-dropdown-trigger-focused','A source dropdown trigger holding real keyboard focus',
    'Reached by pressing Tab, not by script, and framed in its cell. Look for: a focus ring. If you cannot see one here, neither can a keyboard user.',
    ['[data-shotmark]','#viewForm .uatrigger:focus'],14);
  /* and the same cell with nothing focused, so the two can be held side by side */
  await c.eval(`document.activeElement&&document.activeElement.blur&&document.activeElement.blur();return 1`);
  await sleep(200);
  await shotSpan(c,'31b-dropdown-trigger-unfocused','The same cell with focus removed',
    'The control of 31 with nothing focused. Any difference between these two IS the focus indication.',
    ['[data-shotmark]'],14);

  /* the same dropdown, open \u2014 the menu is absolutely positioned, so the frame
     has to span the cell and the menu together */
  await c.eval(`const t=document.querySelector('${trigSel}');t.scrollIntoView({block:'center'});t.click();return 1`);
  await sleep(350);
  await shotSpan(c,'32-dropdown-open','A source dropdown, open',
    'The menu over the form. Look for: options readable, dimmed "not available" rows, whether the menu hides the value it belongs to.',
    ['.uadrop.open','.uadrop.open .uamenu'],14);
  await c.eval("document.querySelectorAll('.uadrop.open').forEach(d=>d.classList.remove('open'));return 1");
  await sleep(200);

  /* the conflict buttons — seeded exactly as test_browser.js seeds them */
  await c.eval(`window.__t.__edit('units.0.ua_exec','31');
    window.__t.__edit('units.0.ua_rcs','34');
    window.__t.__edit('units.0.ua_reviewed','');
    window.__t.__renderBody();return 1`);
  await sleep(450);
  const uaok=await c.eval("return !!document.querySelector('[data-uaok]')");
  measured.conflictSeeded=uaok;
  measured.conflictColour=await c.eval(`
    const box=document.querySelector('[data-uaok]');
    if(!box)return null;
    /* The approve button lives in a note UNDER the cell, not inside it, so
       closest() walks past the row and finds nothing. Go via the row. */
    const row=box.closest('.urow')||box.closest('.pdrow');
    const cell=row?row.querySelector('.rbox.uacell'):null;
    if(!cell)return null;const cs=getComputedStyle(cell);
    /* and a cell in the same column that is NOT in conflict, to compare */
    const others=[...document.querySelectorAll('#viewForm .ucards .urow')]
      .map(r=>r.querySelector('.rbox.uacell')).filter(Boolean);
    const calm=others.find(e=>e!==cell);
    const key=CSS.escape?null:null;
    return {conflict:{bg:cs.backgroundColor,bar:cs.borderLeftColor,
             key:cell.getAttribute('data-box')},
            calm:calm?{bg:getComputedStyle(calm).backgroundColor,
             bar:getComputedStyle(calm).borderLeftColor}:null};`);
  if(measured.conflictColour)console.log('  conflict cell paints '+JSON.stringify(measured.conflictColour.conflict));
  if(uaok){
    await shotSpan(c,'33-conflict-buttons','A utility-allowance conflict, with its buttons',
      'Two sources disagree ($31 vs $34). Look for: is it obvious which number wins, and what each button does?',
      ['[data-uaok]'],90);
    await shotEl(c,'34-conflict-row','The whole unit row carrying the conflict',
      'The conflict in its context. Look for: the row growing, cells squeezed, the note wrapping.',
      '#viewForm .ucards .urow',8);
  }else console.log('  ⚠ no conflict control appeared to photograph');

  /* the unsaved footer, which only exists while something is dirty */
  await shotEl(c,'35-footer-dirty','The footer with unsaved changes',
    'The dirty state. Look for: the unsaved tag against the buttons.','#viewForm .footer',6);

  /* ═══ STICKY CHROME, AS THE WINDOW SEES IT ═════════════════════════ */
  /* The command bar and the footer are both sticky. Whether either one sits ON
     TOP of the form is the kind of thing a clipped screenshot will lie about in
     either direction, so it is settled here on window-true captures and on
     measured overlap in pixels. */
  console.log('\n── the sticky chrome, measured ──────────────────────────');
  const stick=async(label)=>{
    const o=await c.eval(`
      const R=e=>e?e.getBoundingClientRect():null;
      const bar=R(document.getElementById('ccbar'));
      const hdr=R(document.querySelector('#viewForm .hdr'));
      const foot=R(document.querySelector('#viewForm .footer'));
      const over=(a,b)=>(!a||!b)?0:Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      /* whichever card header is nearest the top of the window right now */
      let head=null,best=1e9;
      document.querySelectorAll('#sections .card .chead').forEach(h=>{
        const r=h.getBoundingClientRect();const d=Math.abs(r.top);
        if(r.bottom>0&&d<best){best=d;head=h;}});
      /* and whatever control is closest above the footer */
      let hit=null;
      if(foot)document.querySelectorAll('#sections [data-box],#sections .cb').forEach(e=>{
        const r=e.getBoundingClientRect();
        if(r.top<foot.bottom&&r.bottom>foot.top)hit=hit||(e.getAttribute('data-box')||'a checkbox');});
      return {scrollY:Math.round(scrollY),
        barOverHeader:Math.round(over(bar,head&&head.getBoundingClientRect())),
        headerText:head?(head.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40):null,
        barOverHdr:Math.round(over(bar,hdr)),
        footOver:hit,
        dirty:window.__t.isDirty(),
        unsavedShown:(()=>{const u=document.getElementById('unsavedTag');
          if(!u)return 'no element';const cs=getComputedStyle(u);
          const r=u.getBoundingClientRect();
          return cs.display==='none'?'display:none':(r.width<1?'zero width':'shown '+Math.round(r.width)+'px');})()};`);
    measured.sticky=measured.sticky||{};measured.sticky[label]=o;
    console.log('  '+label+': '+JSON.stringify(o));
    return o;};

  await c.eval(`await window.__t.__openForm(${JSON.stringify(pid)});return 1`);await sleep(700);
  await stick('form @1440, scrolled to top');
  await shotViewport(c,'36-window-top-1440','The window at 1440, scrolled to the top',
    'What actually fills the screen when the form opens. Look for: the command bar sitting on the header, and how much of the form is left.');
  /* The rail looks like navigation — ten numbered rows with tick/warn icons
     under a SECTIONS kicker, in the place a table of contents goes. Ask whether
     it IS one before photographing it as one: does a row carry a handler, a
     cursor, a role, an href? Then press it and see whether anything moves. */
  measured.rail=await c.eval(`
    const it=document.querySelector('#rail .railitem');
    if(!it)return null;
    const cs=getComputedStyle(it);
    const before=Math.round(scrollY);
    const target=[...document.querySelectorAll('#rail .railitem')]
      .find(e=>/Rents/.test(e.textContent||''));
    if(target)target.click();
    return {count:document.querySelectorAll('#rail .railitem').length,
      cursor:cs.cursor,tag:it.tagName,role:it.getAttribute('role'),
      href:it.getAttribute('href'),tabindex:it.getAttribute('tabindex'),
      onclick:!!it.onclick,dataAttrs:[...it.attributes].map(a=>a.name).join(','),
      scrollBefore:before,scrollAfter:Math.round(scrollY)};`);
  await sleep(400);
  console.log('  rail: '+JSON.stringify(measured.rail));
  /* Scroll so a section header is hard against the top of the window — the one
     position where a sticky bar would cover it — and photograph that. */
  await c.eval(`const cards=[...document.querySelectorAll('#sections .card')];
    const t=cards.find(x=>/Rents/.test((x.querySelector('.ctitle')||{}).textContent||''));
    if(t)window.scrollTo(0,t.getBoundingClientRect().top+scrollY-2);return 1;`);
  await sleep(500);
  await stick('a section header at the top of the window');
  await shotViewport(c,'37-window-section-at-top-1440','The window with a section header hard against the top',
    'The one scroll position where a sticky bar could cover a section title. Look for: is the title readable?');
  /* and the bottom, where the sticky footer meets the last row */
  await c.eval('window.scrollTo(0,document.body.scrollHeight);return 1');await sleep(500);
  await stick('scrolled to the bottom');
  await shotViewport(c,'38-window-bottom-1440','The window scrolled to the bottom',
    'Where the sticky footer meets the last row of the form. Look for: a control hidden behind the footer.');
  /* ── the rail as NAVIGATION ─────────────────────────────────────────────
     The rail is the one part of the form whose whole job is to be looked at.
     Three positions of the indicator, a row holding focus and the same row
     without it, and the window immediately after a jump — because "the heading
     cleared the bar" is a number in test_browser.js and a picture here, and
     only the picture answers "does it look right". */
  console.log('\n── the rail: the indicator, focus, and a jump ───────────');
  const railGeo=await c.eval(`
    const cards=[...document.querySelectorAll('#sections .card')];
    const tall=cards.slice().sort((a,b)=>b.getBoundingClientRect().height-a.getBoundingClientRect().height)[0];
    return {tallTop:tall?Math.round(tall.getBoundingClientRect().top+scrollY):null,
      tallTitle:tall?((tall.querySelector('.ctitle')||{}).textContent||'').trim():null,
      rows:[...document.querySelectorAll('#rail .railitem')].map(e=>e.getAttribute('data-rsec'))};`);

  /* A picture cannot be asserted on, but the state it was taken in can. These
     three readings are what let test_shots.js tell "the indicator moved" from
     "three photographs of the same thing". */
  measured.railStates={};
  const railState=async(label)=>{
    const o=await c.eval(`
      const on=document.querySelector('#rail .railitem.on');
      const bar=document.getElementById('railbar');
      const cards=[...document.querySelectorAll('#sections .card')];
      /* whichever card is actually filling the middle of the window */
      const mid=innerHeight/2;
      const seen=cards.filter(e=>{const r=e.getBoundingClientRect();return r.top<mid&&r.bottom>mid;})
        .map(e=>((e.querySelector('.ctitle')||{}).textContent||'').trim());
      return {scrollY:Math.round(scrollY),
        lit:on?String(on.getAttribute('data-rsec')):null,
        litLabel:on?(on.textContent||'').replace(/\s+/g,' ').trim():null,
        ariaCurrent:on?on.getAttribute('aria-current'):null,
        barTop:bar?Math.round(bar.getBoundingClientRect().top-document.getElementById('rail').getBoundingClientRect().top):null,
        barHeight:bar?Math.round(bar.getBoundingClientRect().height):null,
        fillingTheWindow:seen.join(' / ')||'—'};`);
    measured.railStates[label]=o;
    console.log('  '+label+': '+JSON.stringify(o));
    return o;};

  await c.eval('window.scrollTo(0,0);return 1');await sleep(700);
  await railState('indicator @ top of the form');
  await shotWindow2x(c,1440,960,'50-rail-indicator-top','The rail with the form at the top',
    'The indicator at rest on the first section. Look for: does the marked row read as "you are here" rather than as a hover, and does a row read as pressable at all?');

  await c.eval(`window.scrollTo(0,${railGeo.tallTop?railGeo.tallTop+120:1200});return 1`);await sleep(700);
  await railState('indicator @ the tallest section');
  await shotWindow2x(c,1440,960,'51-rail-indicator-middle','The rail partway down the form',
    'The indicator on the tallest section. Look for: the bar aligned to its row, and whether the rest of the rail still reads as a list you could jump around.');

  await c.eval('window.scrollTo(0,document.documentElement.scrollHeight);return 1');await sleep(800);
  await railState('indicator @ the bottom');
  await shotWindow2x(c,1440,960,'52-rail-indicator-bottom','The rail with the form scrolled to the bottom',
    'The indicator at the foot. Look for: WHICH row is lit against which section actually fills the window — this is where a scroll-spy lies.');

  /* Focus, by real Tab presses. :focus-visible is the state under review and a
     programmatic focus() does not raise it, so these two shots are the only
     honest way to ask whether the ring is there. Same scroll, same everything —
     the ONLY difference between 53 and 53b is which element holds focus, which
     is what makes comparing the two files meaningful. */
  await c.eval(`window.scrollTo(0,0);document.getElementById('bFill').focus();return 1`);
  await sleep(300);
  let rlTabs=0;
  while(rlTabs<12&&!(await c.eval(`const a=document.activeElement;
      return !!(a&&a.classList&&a.classList.contains('railitem'))`))){
    await c.key('Tab',{wait:60});rlTabs++;}
  for(let i=0;i<3;i++)await c.key('Tab',{wait:60});   /* land mid-rail, not on row 1 */
  measured.railFocus=await c.eval(`const a=document.activeElement;
    const other=[...document.querySelectorAll('#rail .railitem')].find(e=>e!==a);
    const S=e=>{const s=getComputedStyle(e);return {outline:s.outlineStyle+' '+s.outlineWidth+' '+s.outlineColor,
      offset:s.outlineOffset,shadow:s.boxShadow,bg:s.backgroundColor};};
    return {reachedByTab:!!(a&&a.classList&&a.classList.contains('railitem')),
      row:a?(a.textContent||'').trim():null,
      /* gated on it BEING a rail row: an <input> reached by Tab matches
         :focus-visible perfectly well, so an ungated reading reports a rail
         focus ring on source whose rail is ten inert DIVs. */
      focusVisible:!!(a&&a.classList&&a.classList.contains('railitem')&&a.matches&&a.matches(':focus-visible')),
      focused:a?S(a):null,unfocused:other?S(other):null};`);
  console.log('  rail focus: '+JSON.stringify(measured.railFocus));
  await shotWindow2x(c,1440,960,'53-rail-row-focused','A rail row holding keyboard focus',
    'Reached by real Tab presses, so :focus-visible applies. Look for: a ring you can actually SEE, and whether it is distinguishable from the active-section marking beside it.');
  await c.eval('if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();return 1');
  await sleep(300);
  await shotWindow2x(c,1440,960,'53b-rail-row-unfocused','The same window with nothing focused',
    'The control for the shot above: identical scroll, identical state, focus removed. If this file and 53 are the same bytes, the focus ring does not exist.');

  /* A jump, photographed where it lands. The bar is HIDDEN at scrollY 0 and
     slides in during the scroll, so this is the frame where a wrong offset
     shows up as a title tucked under the bar. */
  measured.ccbarHeights=measured.ccbarHeights||{};
  measured.ccbarHeights['1440']=await c.eval(`window.scrollTo(0,1200);
    await new Promise(r=>setTimeout(r,500));
    const b=document.getElementById('ccbar');const r=b.getBoundingClientRect();
    const chips=[...b.querySelectorAll('.bchip')].filter(e=>e.offsetParent!==null);
    return {h:+r.height.toFixed(2),chips:chips.length,
      lines:[...new Set(chips.map(e=>Math.round(e.getBoundingClientRect().top)))].length,
      text:(b.textContent||'').replace(/\s+/g,' ').trim().slice(0,120)};`);
  console.log('  ccbar @1440: '+JSON.stringify(measured.ccbarHeights['1440']));

  await c.eval(`window.scrollTo(0,0);return 1`);await sleep(600);
  await c.eval(`const rr=[...document.querySelectorAll('#rail .railitem')];
    const t=rr[Math.min(rr.length-1,Math.max(0,Math.floor(rr.length/2)))];if(t)t.click();return 1;`);
  await sleep(1400);
  await stick('immediately after a jump from the top');
  await shotWindow2x(c,1440,960,'54-window-after-jump-1440','The window immediately after a jump from scrollY 0',
    'The command bar was hidden when this jump started and slid in during it. Look for: is the section title clear of the bar, or tucked under it?');

  /* dirty, so the unsaved tag has every reason to be on screen */
  await c.eval(`window.scrollTo(0,0);return 1`);await sleep(300);
  await c.eval(`window.__t.__editCell('poc.name','Somebody Else');window.__t.__renderBody();return 1`);
  await sleep(400);
  const dirtyState=await stick('dirty');
  await shotEl(c,'39-footer-when-dirty','The footer while the record is genuinely dirty',
    'isDirty() is true here. Look for: whether anything on the footer says so.','#viewForm .footer',6);

  /* ═══ NARROW ════════════════════════════════════════════════════════ */
  /* 860px is inside the smallest of the five breakpoints (900/1050/1180/1260/
     1340). Truncation and overlap live here, never at 1440. */
  console.log('\n── narrow (860px, inside the last breakpoint) ───────────');
  await viewport(c,860,960);
  await c.eval('window.__t.__renderBody();return 1');await sleep(500);
  /* A page wider than its own viewport is a horizontal scrollbar, and the one
     thing a screenshot of the page CANNOT show is that it had to be widened to
     take the picture. Measure it. */
  const overflow=async(label)=>{const o=await c.eval(
    `return {doc:document.documentElement.scrollWidth,vw:innerWidth,
      /* Name the widest LEAF. An ancestor is always at least as wide as the
         child that overflows it, so reporting the ancestor names a container
         and not the thing a reader can see running off the edge. */
      widest:(()=>{let w=0,sel='',txt='';
        document.querySelectorAll('body *').forEach(e=>{
          if(e.children.length)return;
          const r=e.getBoundingClientRect();if(r.width<1&&r.height<1)return;
          if(r.right>w){w=r.right;
            sel=e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.className&&e.className.baseVal===undefined?'.'+String(e.className).split(' ').filter(Boolean).slice(0,2).join('.'):'');
            txt=(e.textContent||e.value||'').trim().slice(0,24);}});
        return {right:Math.round(w),sel,txt};})()};`);
    measured.overflow=measured.overflow||{};measured.overflow[label]=o;
    if(o.doc>o.vw+1)console.log(`  \u26a0 ${label}: the document is ${o.doc}px wide in an ${o.vw}px viewport (+${o.doc-o.vw}) \u2014 widest leaf ${o.widest.sel} “${o.widest.txt}” ends at ${o.widest.right}`);
    return o;};
  await overflow('form @860');
  await shotPage(c,'40-view-form-860','The form at 860px',
    'The whole form, narrow. Look for: the rail collapsing, two columns becoming one, controls overrunning their cells.');
  await shotEl(c,'41-command-center-860','The header bar at 860px',
    'Look for: the property name colliding with the program pills.','#viewForm .hdr',0);
  await shotEl(c,'42-footer-860','The footer at 860px',
    'Look for: three buttons and a tag on one line at 860px.','#viewForm .footer',6);
  await shotEl(c,'43-rents-860','Rents & unit mix at 860px',
    'The widest section in the form. Look for: clipped numbers, dropdowns squeezed to nothing.',
    '#viewForm .ucards',6);
  /* Window-true at 860 as well. Everything above this line in the narrow pass
     is a tall page clip, and a tall page clip draws position:sticky chrome
     wherever the scroll left it — which looks exactly like a bar rendering in
     the middle of Part B. These two settle it. */
  await c.eval('window.scrollTo(0,0);return 1');await sleep(300);
  await shotViewport(c,'46-window-top-860','The window at 860, scrolled to the top',
    'What actually fills an 860px window. Look for: the command bar wrapping, and how much room the form has left.');
  await c.eval(`const cards=[...document.querySelectorAll('#sections .card')];
    const t=cards.find(x=>/Part B/.test((x.querySelector('.ctitle')||{}).textContent||''));
    if(t)window.scrollTo(0,t.getBoundingClientRect().top+scrollY-2);return 1;`);
  await sleep(400);
  await stick('a section header at the top, @860');
  await shotViewport(c,'47-window-partb-860','The window at 860 with Part B at the top',
    'Look for: the command bar over the section title, and whether the checkbox columns still line up.');

  await c.eval('window.__t.openMenu();return 1');await sleep(450);
  await overflow('menu @860');
  await c.eval(`await window.__t.__openForm(${JSON.stringify(pid)});return 1`);await sleep(700);
  await c.eval('window.scrollTo(0,0);return 1');await sleep(500);
  await shotWindow2x(c,860,900,'55-rail-860','The rail at 860, where it stops being sticky',
    'Below 1050px the rail is a table of contents at the top of the page rather than a sticky column. Look for: does it still read as navigation in that position, and does the indicator still mark a row?');
  await c.eval('window.scrollTo(0,1200);return 1');await sleep(600);
  measured.ccbarHeights=measured.ccbarHeights||{};
  measured.ccbarHeights['860']=await c.eval(`const b=document.getElementById('ccbar');
    const r=b.getBoundingClientRect();
    const chips=[...b.querySelectorAll('.bchip')].filter(e=>e.offsetParent!==null);
    return {h:+r.height.toFixed(2),chips:chips.length,
      lines:[...new Set(chips.map(e=>Math.round(e.getBoundingClientRect().top)))].length,
      text:(b.textContent||'').replace(/\s+/g,' ').trim().slice(0,120)};`);
  console.log('  ccbar @860: '+JSON.stringify(measured.ccbarHeights['860']));
  await shotWindow2x(c,860,900,'56-ccbar-860','The command bar at 860, scrolled',
    'The bar used to wrap to five lines here. Look for: one line, and whether the chips are still readable once their labels collapse to icons.');
  await c.eval('window.__t.openMenu();return 1');await sleep(450);
  await shotViewport(c,'48-window-menu-860','The gallery window at 860',
    'Look for: the filter strip running off the right edge with nothing to say so.');
  await shotPage(c,'44-view-menu-860','The property gallery at 860px',
    'Look for: the rail turning into a horizontal strip, cards reflowing, the toolbar wrapping.');
  await c.eval(`window.__t.openLauncher(${JSON.stringify(pid)});return 1`);await sleep(450);
  await overflow('launcher @860');
  await shotPage(c,'45-view-launcher-860','The launcher at 860px',
    'Look for: package rows wrapping, the letterhead block, buttons stacking.');

  /* what the page said while all that happened */
  measured.consoleErrors=c.logs.slice();
  return measured;
}

/* ── index ──────────────────────────────────────────────────────────────── */
function writeIndex(m){
  const L=[];
  L.push('# Rendered-form screenshot sweep');
  L.push('');
  L.push('Generated by `node app/full-mp/shots.js`. Every image below is the real bundle,');
  L.push('built from `app/full-mp/`, driven through `?selftest=1` in a headless chromium.');
  L.push('Nothing here is a mock-up and no style was set by hand except where a shot says so.');
  L.push('');
  L.push('| # | file | what it shows | px |');
  L.push('|--:|------|---------------|----|');
  shots.forEach((s,i)=>L.push(`| ${i+1} | \`${s.file?path.basename(s.file):'—'}\` | **${s.title}** — ${s.what} | ${s.w}×${s.h} |`));
  L.push('');
  L.push('## Colours measured off the live elements');
  L.push('');
  L.push('| CLR state | cell | source the app reports | background | left bar |');
  L.push('|-----------|------|------------------------|------------|----------|');
  for(const [k,v] of Object.entries(m)){
    if(!/^prov_/.test(k)||!v)continue;
    L.push(`| ${k.replace(/^prov_/,'')} | \`${v.key||m.provCell}\` | ${v.src||''} | \`${v.bg}\` | \`${v.bar}\` |`);
  }
  L.push('');
  L.push('`auto-calculated` had to be forced onto the record: `auto-calculated` appears');
  L.push('exactly once in all of `app/full-mp/` — on the line of `app.js` that defines it.');
  L.push('No code path assigns it, so no cell can reach it in use.');
  L.push('');
  if(m.sticky){
    L.push('## The sticky chrome, measured on window-true captures');L.push('');
    L.push('| state | scrollY | bar over the card header | control behind the footer | dirty | unsaved tag |');
    L.push('|-------|--------:|-------------------------:|---------------------------|:-----:|-------------|');
    for(const [k,o] of Object.entries(m.sticky))
      L.push(`| ${k} | ${o.scrollY} | ${o.barOverHeader}px (${o.headerText||'—'}) | ${o.footOver||'none'} | ${o.dirty} | ${o.unsavedShown} |`);
    L.push('');
  }
  if(m.rail){
    L.push('## The section rail — navigation, or a list?');L.push('');
    L.push('```');
    Object.entries(m.rail).forEach(([k,v])=>L.push(k.padEnd(14)+': '+v));
    L.push('```');
    L.push('');
  }
  if(m.railStates){
    L.push('## The indicator, at the three positions photographed');L.push('');
    L.push('| position | scrollY | row lit | aria-current | bar top / height (within #rail) | section filling the window |');
    L.push('|----------|--------:|---------|--------------|--------------------------------:|----------------------------|');
    for(const [k,o] of Object.entries(m.railStates))
      L.push(`| ${k} | ${o.scrollY} | ${o.litLabel||'**none**'} | ${o.ariaCurrent||'—'} | ${o.barTop==null?'no bar':o.barTop+' / '+o.barHeight} | ${o.fillingTheWindow} |`);
    L.push('');
  }
  if(m.ccbarHeights){
    L.push('## The command bar, measured at both widths');L.push('');
    L.push('| width | height | chips | chip lines |');
    L.push('|-------|-------:|------:|-----------:|');
    for(const [k,o] of Object.entries(m.ccbarHeights))
      L.push(`| ${k}px | ${o.h}px | ${o.chips} | ${o.lines} |`);
    L.push('');
    L.push('It must be ONE height at every width: a jump offset is computed against it.');
    L.push('');
  }
  if(m.railFocus){
    L.push('## The rail row that holds focus, as computed');L.push('');
    L.push('```');
    L.push('rail row reached by real Tab   : '+m.railFocus.reachedByTab);
    L.push('rail row                       : '+m.railFocus.row);
    L.push('rail row matches :focus-visible: '+m.railFocus.focusVisible);
    if(m.railFocus.focused){
      L.push('focused   outline   : '+m.railFocus.focused.outline+'  offset '+m.railFocus.focused.offset);
      L.push('focused   background: '+m.railFocus.focused.bg);
    }
    if(m.railFocus.unfocused){
      L.push('unfocused outline   : '+m.railFocus.unfocused.outline);
      L.push('unfocused background: '+m.railFocus.unfocused.bg);
    }
    L.push('```');
    L.push('');
    L.push('Shots `53-rail-row-focused` and `53b-rail-row-unfocused` are the same window');
    L.push('at the same scroll with only focus changed. Identical bytes would mean the');
    L.push('ring is not drawn — a prior audit on this project found exactly that on a');
    L.push('dropdown trigger, so the images are compared and not merely the styles.');
    L.push('');
  }
  if(m.conflictColour){
    L.push('## A conflicting cell against a calm one, same column');L.push('');
    L.push('```');
    L.push('in conflict ('+m.conflictColour.conflict.key+') : bg '+m.conflictColour.conflict.bg+'  bar '+m.conflictColour.conflict.bar);
    if(m.conflictColour.calm)
      L.push('not in conflict                       : bg '+m.conflictColour.calm.bg+'  bar '+m.conflictColour.calm.bar);
    L.push('CLR.overridden                        : bg rgb(251, 241, 230)  bar rgb(180, 83, 9)');
    L.push('```');
    L.push('');
  }
  if(m.overflow){
    L.push('## Horizontal overflow (document width vs viewport)');L.push('');
    L.push('| view | document | viewport | over by | widest box |');
    L.push('|------|---------:|---------:|--------:|------------|');
    for(const [k,o] of Object.entries(m.overflow))
      L.push(`| ${k} | ${o.doc} | ${o.vw} | ${o.doc-o.vw} | \`${o.widest.sel}\` ends at ${o.widest.right}${o.widest.txt?(' — “'+o.widest.txt+'”'):''} |`);
    L.push('');
  }
  if(m.trigFocusRing){
    L.push('## Focus, as computed on a dropdown trigger holding it');
    L.push('');
    L.push('```');
    L.push('reached by real Tab : '+m.trigFocusRing.reachedByTab+(m.tabsToTrigger?(' (after '+m.tabsToTrigger+' presses)'):''));
    L.push('control             : '+m.trigFocusRing.which);
    L.push('outline             : '+m.trigFocusRing.outline);
    L.push('box-shadow          : '+m.trigFocusRing.boxShadow);
    L.push('border-color        : '+m.trigFocusRing.border);
    L.push('background          : '+m.trigFocusRing.background);
    L.push('```');
    L.push('');
  }
  L.push('## Console');L.push('');
  L.push(m.consoleErrors&&m.consoleErrors.length
    ?('```\n'+m.consoleErrors.join('\n')+'\n```'):'No errors and no uncaught exceptions during the sweep.');
  L.push('');
  const f=path.join(OUT,'index.md');
  fs.writeFileSync(f,L.join('\n'));
  return f;
}

/* ── run ────────────────────────────────────────────────────────────────── */
/* A missing chromium is not a pass and not a shrug: the whole point of the file
   is that it renders. Say so and exit non-zero. */
(async()=>{
  if(!findChrome()){
    console.log('\n⚠ NO CHROMIUM — NOTHING WAS RENDERED.');
    console.log('  Install one (npx playwright install chromium) and run again.');
    console.log('⚠ SHOTS SWEEP DID NOT RUN (0 images — this is not a success)');
    process.exit(2);
  }
  fs.rmSync(OUT,{recursive:true,force:true});
  fs.mkdirSync(OUT,{recursive:true});
  const m=await withApp(c=>sweep(c),{width:1440,height:960,tag:'shots'});
  if(m&&m.skipped){console.log('⚠ SHOTS SWEEP DID NOT RUN ('+m.skipped+')');process.exit(2);}
  const idx=writeIndex(m);
  const good=shots.filter(s=>s.file&&s.bytes>0);
  console.log('\n'+idx);
  console.log(`\n✓ ${good.length} images written to ${OUT}` +
    (good.length<shots.length?`  (${shots.length-good.length} could not be framed)`:''));
})().catch(e=>{console.error(e);console.log('✗ SHOTS SWEEP FAILED');process.exit(1);});
