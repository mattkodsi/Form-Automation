/* rcs.js — reads the appraiser's completed RCS study.  window.RCSParse
   ------------------------------------------------------------------
   PURE: pages in, parsed record out. No DOM, no store, no network — which is
   what makes it testable in Node against real PDFs.

   It does not get its own PDF engine, and it does not take a finished array of
   pages either. It takes a READER — {pageCount, getPage(i)} — and pulls only
   the pages it needs. A study runs to 115 pages; the letter that carries every
   value the form wants is two of them. Interpreting the other 113 is work
   nobody asked for, and when the scanned-document tier arrives it is money:
   OCR bills per page, so the page list this module settles on is the bill.

   THE ONE FACT EVERYTHING RESTS ON: runs fragment mid-word. The letterhead
   arrives as "BELFRY VA"+"LUATION"; a phone number as "("+"708"+") "+"500"+
   "-"+"2380". Nothing may be matched against a single run. Everything matches
   against an assembled line, and every anchor goes through norm() — because
   re-exporting the same document destroys word spacing, drops curly quotes,
   and shifts every y coordinate. Absolute y is never an anchor. */
(function(){
'use strict';

/* Casefold and strip every non-alphanumeric. The only form in which document
   text may be compared to an expected string. */
function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');}

/* Runs -> baselines. y is PDF space (origin bottom-left), so descending y walks
   the page top to bottom. tol=2 because a small-caps capital sits ~2pt above
   its own word ("AS IS" arrives at y=118.0 and y=120.0). */
function lines(runs,tol){
  tol=tol==null?2:tol;
  const rows=[];
  (runs||[]).slice().sort(function(a,b){return (b.y-a.y)||(a.x-b.x);}).forEach(function(r){
    if(!r||!r.s)return;
    let row=null;
    for(let i=0;i<rows.length;i++)if(Math.abs(rows[i].y-r.y)<=tol){row=rows[i];break;}
    if(row)row.runs.push(r);else rows.push({y:r.y,runs:[r]});
  });
  return rows.map(function(q){
    q.runs.sort(function(a,b){return a.x-b.x;});
    return {y:q.y,text:q.runs.map(function(r){return r.s;}).join('').replace(/\s+/g,' ').trim(),runs:q.runs};
  }).filter(function(q){return q.text;});
}

function money(s){const t=String(s==null?'':s).replace(/[^0-9.]/g,'');if(!t)return '';const n=parseFloat(t);return isFinite(n)?Math.round(n):'';}
function dec(s){const t=String(s==null?'':s).replace(/[^0-9.]/g,'');if(!t)return '';const n=parseFloat(t);return isFinite(n)?Math.round(n*100)/100:'';}

/* A page's whole text, normalized, for anchor testing. */
function pageKey(runs){return lines(runs).map(function(l){return norm(l.text);}).join('|');}

/* The transmittal letter names itself differently per firm: Belfry heads its
   subject block "Market Rental Analysis", Cornerstone writes "Re: Rent
   Comparability Study". Either opens a letter. */
const LETTER_HEAD=/marketrentalanalysis|rerentcomparabilitystudy/;
/* The tables, which may sit on the letter's first page or its second. */
const LETTER_TABLE=/estimatesofmarketrent|grossrenewalpotentialcalculation|grossrentpotentialcalculation|totalgrossrenewalrent|150ofsafmrgrossrent|safmrgrossrent/;
/* A grid names itself twice over: the HUD form title and the subject's FHA cell. */
const GRID=/rentcomparabilitygrid/;
/* A contents page prints every section heading in the document, the letter's
   included. It is never itself a letter page. */
const TOC=/tableofcontents/;

/* How far in to look for a letter. A letter that is not in the first dozen
   pages is not a transmittal letter. */
const LETTER_SCAN_CAP=14;
/* How many pages after the heading may still belong to the letter. */
const LETTER_TAIL=2;
/* A closing means the letter is over, so there is no next page to go looking
   at. Belfry signs off "Sincerely / Aaron M. Zabel / ... / Job No. 26-124". */
const LETTER_END=/sincerely|respectfullysubmitted|jobno/;
/* PROBE ORDER, NOT PAGE ORDER. Measured over eight real documents the letter
   begins at index 1 in every standalone study and at 5 in a full renewal
   package, where the owner's cover documents come first. Page 0 is a title
   page and has never once been the letter. Reading 0,1,2,3 in order therefore
   spends its first probe on the one page that is never the answer — free in
   the text tier, but the scanning tier is billed per page, so the order the
   pages are TRIED in is the thing that costs money. */
const LETTER_PRIORS=[1,2,5,6,3,4,0];
function probeOrder(n){
  const out=[];
  LETTER_PRIORS.forEach(function(i){if(i<n&&out.indexOf(i)<0)out.push(i);});
  for(let i=0;i<n&&out.length<LETTER_SCAN_CAP;i++)if(out.indexOf(i)<0)out.push(i);
  return out.slice(0,Math.min(n,LETTER_SCAN_CAP));
}

/* Find the letter and read ONLY it. Returns the pages actually interpreted so
   the caller can report — and, when the scanning tier arrives, bill — honestly. */
async function findLetter(rd){
  const runs={},read=[];
  const get=async function(i){if(runs[i]===undefined){runs[i]=await rd.getPage(i);read.push(i);}return runs[i];};
  const order=probeOrder(rd.pageCount);
  let head=-1;
  for(let p=0;p<order.length;p++){
    const i=order[p];
    const k=pageKey(await get(i));
    if(TOC.test(k))continue;                                       // a contents page lists the letter's own heading
    if(LETTER_HEAD.test(k)||LETTER_TABLE.test(k)){head=i;break;}   // stop the moment it is found
  }
  if(head<0)return {pages:[],runs:runs,read:read,found:false};
  /* The tail must carry TABLES, not merely the heading again. The 60-page
     renewal package puts its table of contents two pages after the letter, and
     that page prints "MARKET RENTAL ANALYSIS ....... 17" as an entry — enough
     to look like the letter continuing, and it swallowed the contents page. */
  const pages=[head];
  for(let j=1;j<=LETTER_TAIL&&head+j<rd.pageCount;j++){
    const k=pageKey(await get(head+j));
    if(TOC.test(k))break;
    if(!LETTER_TABLE.test(k))break;
    pages.push(head+j);
    if(LETTER_END.test(k))break;      // signed off: nothing after this is letter
  }
  return {pages:pages,runs:runs,read:read,found:true};
}

/* Grids are scattered through the body and are corroboration, not the source —
   so they are never read unless asked for, and even then only the pages that
   are grids. `limit` caps how many are taken (one per unit type is plenty). */
async function findGrids(rd,limit){
  const runs={},read=[],pages=[];
  limit=limit||8;
  for(let i=0;i<rd.pageCount&&pages.length<limit;i++){
    const r=await rd.getPage(i);read.push(i);
    if(GRID.test(pageKey(r))){pages.push(i);runs[i]=r;}
  }
  return {pages:pages,runs:runs,read:read};
}

window.RCSParse={norm:norm,lines:lines,money:money,dec:dec,pageKey:pageKey,
  findLetter:findLetter,findGrids:findGrids,
  _caps:{scan:LETTER_SCAN_CAP,tail:LETTER_TAIL},_probeOrder:probeOrder};
})();
