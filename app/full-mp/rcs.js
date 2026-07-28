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
   the page top to bottom.

   tol=5 is measured, not chosen. Two things sit off their own baseline: a
   small-caps capital rides ~2pt high ("AS IS" arrives at y=118.0 and 120.0),
   and a superscript ordinal rides ~4pt high — Cornerstone writes "1132 24th
   Street" and the "th" lands on its own line, so the address read back as
   "1132 24 Street" with a stray "th" above it. Both merge at 5 (the widest observed is 4.04). Nothing real
   is closer than 7.7pt (the tightest grid row pitch), so 5 cannot weld two
   genuine lines together. */
function lines(runs,tol){
  tol=tol==null?5:tol;
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
/* A contents page prints every section heading in the document, the letter's
   included. It is never itself a letter page. */
const TOC=/tableofcontents/;

/* How far in to look for a letter. A letter that is not in the first dozen
   pages is not a transmittal letter. */
const LETTER_SCAN_CAP=14;
/* How many pages after the heading may still belong to the letter. */
const LETTER_TAIL=2;
/* A closing means the letter is over, so there is no next page to go looking
   at. Belfry signs off "Sincerely / Taylor Reed / ... / Job No. 26-124". */
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
  /* Nothing found is two different situations. A copy that carried no text at
     all on any page opened will never read, whatever we do to it; a copy full
     of text with no letter in it is most likely the wrong file. The caller has
     to be able to say which. */
  if(head<0)return {pages:[],runs:runs,read:read,found:false,
    textless:Object.keys(runs).every(function(i){return !runs[i]||!runs[i].length;})};
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

/* ============================ reading it ============================ */

/* Firms differ in wording, not in bones. Each is a detector and nothing more
   so far; when a third arrives, this is the seam to widen. */
const FIRMS=[{id:'belfry',detect:/belfryvaluation/},
             {id:'cornerstone',detect:/cornerstonevaluationservices/},
             {id:'renzi',detect:/renziassociates/},
             {id:'gill',detect:/gillgroup/}];
function detectFirm(key){for(let i=0;i<FIRMS.length;i++)if(FIRMS[i].detect.test(key))return FIRMS[i].id;return null;}

const ST={alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',colorado:'CO',connecticut:'CT',delaware:'DE',districtofcolumbia:'DC',florida:'FL',georgia:'GA',hawaii:'HI',idaho:'ID',illinois:'IL',indiana:'IN',iowa:'IA',kansas:'KS',kentucky:'KY',louisiana:'LA',maine:'ME',maryland:'MD',massachusetts:'MA',michigan:'MI',minnesota:'MN',mississippi:'MS',missouri:'MO',montana:'MT',nebraska:'NE',nevada:'NV',newhampshire:'NH',newjersey:'NJ',newmexico:'NM',newyork:'NY',northcarolina:'NC',northdakota:'ND',ohio:'OH',oklahoma:'OK',oregon:'OR',pennsylvania:'PA',rhodeisland:'RI',southcarolina:'SC',southdakota:'SD',tennessee:'TN',texas:'TX',utah:'UT',vermont:'VT',virginia:'VA',washington:'WA',westvirginia:'WV',wisconsin:'WI',wyoming:'WY',puertorico:'PR'};
function stAbbr(v){v=String(v||'').trim();if(/^[A-Za-z]{2}$/.test(v))return v.toUpperCase();return ST[norm(v)]||'';}

/* "Cincinnati, Hamilton County, Ohio 45220" -> city/state/zip, county discarded:
   it belongs in no cell. Also handles "Bartlett, IL 60103" and the doubled
   "New York, New York 10001". */
function splitCityStateZip(t){
  const out={city:'',state:'',zip:''};
  t=String(t||'').trim().replace(/,\s*$/,'');
  const z=t.match(/(\d{5})(?:-\d{4})?\s*$/);
  if(z){out.zip=z[1];t=t.slice(0,z.index).trim().replace(/,\s*$/,'');}
  const parts=t.split(',').map(function(x){return x.trim();}).filter(Boolean)
               .filter(function(x){return !/\bcounty\b/i.test(x);});
  if(parts.length>=2){out.state=stAbbr(parts[parts.length-1]);out.city=parts[0];}
  else if(parts.length===1){
    const m=parts[0].match(/^(.*)\s+([A-Za-z]{2})$/);
    if(m&&stAbbr(m[2])){out.city=m[1].trim();out.state=stAbbr(m[2]);}else out.city=parts[0];
  }
  return out;
}
function isoDate(t){
  const MN={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
  const m=String(t||'').toLowerCase().match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if(m&&MN[m[1]])return m[3]+'-'+('0'+MN[m[1]]).slice(-2)+'-'+('0'+m[2]).slice(-2);
  const s2=String(t||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(s2)return s2[3]+'-'+('0'+s2[1]).slice(-2)+'-'+('0'+s2[2]).slice(-2);
  return '';
}

/* THE MISLABELLED NUMBER. Belfry prints the Section 8 contract number under an
   "FHA Project No." label — verified across five of its studies — and Fairview
   labels the same thing "Section 8 Project Number". Cornerstone gets it right
   and says "Section 8 Contract #". All of them mean property.s8. None of them
   is ever written to property.fha, and "N/A" is not a value. */
const S8_LABEL=/(?:fha\s*(?:project\s*)?(?:n[o0]\b|#)|section\s*8\s*(?:contract|project)\s*(?:number|no|#)?)\s*\.?\s*:?\s*#?\s*\[?\s*([A-Za-z0-9][A-Za-z0-9\-]{4,})/i;
function s8From(t){
  const m=String(t||'').match(S8_LABEL);
  if(!m)return '';
  const v=m[1].replace(/[^A-Za-z0-9]/g,'').toUpperCase();
  if(!v||/^N.?A$/i.test(v)||v.length<5)return '';
  if(!/[0-9]/.test(v))return '';   // "RENEWAL", "RENTS", "ADMINISTRATOR" — the words after the label, not the number
  return v;
}

/* The sender block. Belfry stacks firm / street / city-state-zip / (P) / (E)
   under the date; Cornerstone heads the page with its name and keeps its
   contact details on the title page instead. */
const FIRMY=/valuation|appraisal|appraiser|associates|advisors|realty|consulting|group\b/i;
function readSender(txt,S,window){
  let fi=-1;
  for(let i=0;i<Math.min(txt.length,window||8);i++){
    const t=txt[i];
    if(!FIRMY.test(t))continue;
    if(/^re[:\s]/i.test(t))continue;
    if(/^(real estate|nationwide)/i.test(t))continue;      // taglines, not names
    fi=i;S['appr.firm']=t.replace(/,\s*$/,'').trim();break;
  }
  if(fi>=0){
    const a=txt[fi+1]||'',b=txt[fi+2]||'';
    if(/^(p\.?o\.?\s*box|\d)/i.test(a.trim())){
      S['appr.addr_street']=a.replace(/,\s*$/,'').trim();
      const cs=splitCityStateZip(b);
      if(cs.city)S['appr.addr_city']=cs.city;
      if(cs.state)S['appr.addr_state']=cs.state;
      if(cs.zip)S['appr.addr_zip']=cs.zip;
    }
  }
  const joined=txt.join('\n');
  const em=joined.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  if(em)S['appr.email']=em[0];
  const ph=joined.match(/(?:phone|telephone|tel|cell|mobile|direct|office|fax|\bp\b|\bt\b)\s*[:.]?\s*\(?(\d{3})\)?[\s.\-]*(\d{3})[\s.\-]*(\d{4})/i)
    || joined.match(/(?:^|[^\d\-.])\((\d{3})\)\s*[\s.\-]?(\d{3})[\s.\-]?(\d{4})(?!\d)/)
    || joined.match(/(?:^|[^\d\-.])(\d{3})[\s.\-](\d{3})[\s.\-](\d{4})(?!\d)/);
  if(ph)S['appr.phone']=ph[1]+ph[2]+ph[3];
}

/* The subject block: heading, then name, street, city/state/zip, and usually a
   number. Belfry heads it "Market Rental Analysis", Cornerstone "Re: Rent
   Comparability Study" — same four lines under either. */
function readSubject(txt,S,warn){
  const N=txt.map(norm);
  let mi=-1;
  for(let i=0;i<N.length;i++)if(LETTER_HEAD.test(N[i])){mi=i;break;}
  if(mi<0){warn.push('The letter has no subject heading, so the property could not be identified.');return;}
  let nm=(txt[mi+1]||'').trim();
  /* Fairview writes the number inside the name: "Sample Property (Section 8
     Project Number: NJ390013022)". Take the number, then drop the bracket. */
  const par=nm.match(/\(([^)]*)\)\s*$/);
  if(par){const v=s8From(par[1]);if(v)S['property.s8']=v;nm=nm.slice(0,par.index).trim();}
  if(nm)S['property.name']=nm.replace(/,\s*$/,'');
  const st=(txt[mi+2]||'').trim();
  if(st)S['property.addr_street']=st.replace(/,\s*$/,'');
  const cs=splitCityStateZip(txt[mi+3]||'');
  if(cs.city)S['property.addr_city']=cs.city;
  if(cs.state)S['property.addr_state']=cs.state;
  if(cs.zip)S['property.addr_zip']=cs.zip;
  /* The number may be bracketed on its own line, or labelled further down. */
  if(!S['property.s8'])for(let i=mi+1;i<Math.min(txt.length,mi+8);i++){
    const v=s8From(txt[i]);if(v){S['property.s8']=v;break;}
  }
  for(let i=0;i<txt.length;i++){
    const m=txt[i].match(/date\s+of\s+value\s*:?\s*(.+)$/i);
    if(m){const d=isoDate(m[1]);if(d)S['_date_of_value']=d;break;}
  }
  for(let i=0;i<txt.length;i++)if(/^(mr\.|ms\.|mrs\.|dr\.)\s+\S/i.test(txt[i])){S['_poc_name']=txt[i].trim();break;}
}

/* The appraiser who signed it. */
function readSignature(txt,S){
  if(S['appr.name'])return;
  let si=-1;
  for(let i=0;i<txt.length;i++)if(/^(sincerely|respectfully)/i.test(txt[i])){si=i;break;}
  if(si<0)return;
  for(let i=si+1;i<Math.min(si+7,txt.length);i++){
    const t=txt[i].trim();
    if(!t)continue;
    if(/license|certified|job\s*no|^[A-Z]{2,4}\/[A-Z]{2,4}$|president|associate|appraiser/i.test(t))continue;
    if(FIRMY.test(t))continue;                     // the firm's own name, not the person who signed
    if(!/^[A-Z][A-Za-z.'\-]+(\s+[A-Z][A-Za-z.'\-]*){1,3}$/.test(t))continue;
    S['appr.name']=t;return;
  }
}


/* ---------------------------- the tables ---------------------------- */

const WORDNUM={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
/* "2BR/1BA", "1 BR / 1 BA", "Two Bedroom", "1BR/1BA without patio". */
function parseType(t){
  const v=String(t||'').trim(),o={type:v,br:'',ba:''};
  let m=v.match(/(\d+)\s*(?:br\b|bed)/i);
  if(m)o.br=+m[1];
  else{m=v.match(/\b([a-z]+)\s*(?:bedroom|bed\b)/i);if(m&&WORDNUM[m[1].toLowerCase()]!=null)o.br=WORDNUM[m[1].toLowerCase()];}
  if(o.br===''&&/studio|efficiency/i.test(v))o.br=0;
  m=v.match(/(\d+(?:\.\d+)?)\s*(?:ba\b|bath)/i);
  if(m)o.ba=parseFloat(m[1]);
  return o;
}

/* The unit type is NOT one token and the grid flag is NOT always spaced off.
   Lansing prints "1BR/1BA without patio 32 575 $1,190 $2.07 Y" — an ^(\S+)
   type would capture "1BR/1BA" and collapse that row into its "with patio"
   twin, losing a rent. Cornerstone prints "1 BR / 1 BA 31 818 $1,870 $2.29Y",
   the flag welded to the PSF. Hence a lazy type that stops at the first
   standalone integer, and \s* before the flag. */
/* \s* between the type and the count, not \s+: Cornerstone's Sample Property welds
   them — "1 BR / 1 BA30 537 $1,580 $2.94Y" is a 30-unit 1BR of 537 sq ft. The
   type is lazy, so the shortest reading that satisfies the whole row wins and
   "1 BR / 1 BA" is preferred over "1 BR / 1 BA3". */
const ROW_MAIN=/^(.+?)\s*(\d+)\s+([\d,]+)\s+\$([\d,]+)\s+\$?([\d.]+)\s*([YN])\b/i;  // type count sf rent psf grid
const ROW_CS6 =/^(.+?)\s*(\d+)\s+\$([\d,]+)\s+\$([\d,]+)\s+\$([\d,]+)\s+\$([\d,]+)\s*$/; // cornerstone: type count net ua gross monthly
const ROW_5C  =/^(.+?)\s*(\d+)\s+\$([\d,]+)\s+\$([\d,]+)\s+\$([\d,]+)\s*$/;          // belfry: type count rent ua gross
const ROW_CMP =/^(.+?)\s*(\d+)\s+\$([\d,]+)\s+\$([\d,]+)\s+\$[\d,]+\s*[<>]\s*\$[\d,]+/; // belfry: type count rent 150%safmr verdict
const ROW_4C  =/^(.+?)\s*(\d+)\s+\$([\d,]+)\s+\$([\d,]+)\s*$/;                       // both: type count safmrbase gross

/* The type with its bath count removed. Two rows that agree on everything but
   the bathroom are one unit type described twice; two rows that differ by a
   qualifier are genuinely two. */
function typeStem(t){return norm(String(t||'').replace(/\d+(?:\.\d+)?\s*(?:ba\b|bath[a-z]*)/ig,''));}

/* Keyed on the FULL type string first, because Lansing prices "1BR/1BA without
   patio" ($1,190) and "1BR/1BA with patio" ($1,200) as two separate rows and a
   bedrooms+baths key would merge them and lose a rent.

   But a document also disagrees with ITSELF: Fairview's unit table says
   "3BR/2BA" and both its rent tables say "3BR/1.5BA" — same 70 units, same
   $3,275, one unit type written two ways. Matched on the stem plus an
   identical unit count, that merges; "with patio" vs "without patio" does not,
   because the stems differ. */
function upsert(units,type,page,count){
  const k=norm(type);
  for(let i=0;i<units.length;i++)if(norm(units[i].type)===k)return units[i];
  if(count!==''&&count!=null){
    const stem=typeStem(type);
    for(let i=0;i<units.length;i++){
      if(typeStem(units[i].type)===stem&&units[i].count!==''&&Number(units[i].count)===Number(count)){
        units[i].alias=units[i].alias||[];
        if(units[i].alias.indexOf(String(type))<0)units[i].alias.push(String(type));
        return units[i];
      }
    }
  }
  const p=parseType(type);
  const u={type:p.type,br:p.br,ba:p.ba,count:'',sf:'',proposed:'',ua:'',safmr:'',safmr_base:'',psf:'',grid:false,page:page,alias:null,safmr_derived:false};
  units.push(u);return u;
}

function readTables(txt,pi,units,totals,seen){
  let section='';
  txt.forEach(function(t){
    const n=norm(t);
    if(n.indexOf('ownersgrossrenewalpotentialcalculation')>=0){section='owner';return;}
    if(n.indexOf('safmrgrossrenewalpotentialcalculation')>=0||n.indexOf('safmrgrossrentpotentialcalculation')>=0){section='safmr';return;}
    if(n.indexOf('grossrentpotentialcalculation')>=0){section='owner';return;}
    let m;
    if((m=t.match(/total\s+gross\s+renewal\s+rent\s*:?\s*\$([\d,]+)/i))){totals.grossRenewal=money(m[1]);return;}
    if((m=t.match(/total\s+(?:\d{4}\s+)?gross\s+(?:safmr|fmr)\s+rent\s*:?\s*\$([\d,]+)/i))){totals.grossSafmrBase=money(m[1]);return;}
    if((m=t.match(/150%\s*of\s*(?:the\s*)?(?:safmr|fmr)\s+gross\s+rent[^$]*\$([\d,]+)/i))){totals.grossSafmr150=money(m[1]);return;}
    if((m=t.match(/less\s+than\s+150%\s+of\s+the\s+safmr\s+gross\s+rent\s+potential\s+of\s+\$([\d,]+)/i))){if(totals.grossSafmr150==null)totals.grossSafmr150=money(m[1]);return;}
    if((m=t.match(/^total\s*\$([\d,]+)/i))){if(totals.grossRenewal==null)totals.grossRenewal=money(m[1]);return;}
    if((m=t.match(/subject.{0,3}s\s+concluded\s+gross\s+rent[^$]*\$([\d,]+)/i))){totals.grossRenewal=money(m[1]);return;}

    if((m=t.match(ROW_MAIN))){
      const u=upsert(units,m[1],pi,money(m[2]));
      u.count=money(m[2]);u.sf=money(m[3]);u.psf=dec(m[5]);u.grid=/^y$/i.test(m[6]);
      seen.push({type:norm(u.type),rent:money(m[4])});
      if(u.proposed==='')u.proposed=money(m[4]);
      return;
    }
    if((m=t.match(ROW_CS6))){                       // cornerstone gross-rent table
      const u=upsert(units,m[1],pi,money(m[2]));
      if(u.count==='')u.count=money(m[2]);
      u.ua=money(m[4]);
      seen.push({type:norm(u.type),rent:money(m[3])});
      return;
    }
    if((m=t.match(ROW_CMP))){                       // belfry 150% comparison
      const u=upsert(units,m[1],pi,money(m[2]));
      if(u.count==='')u.count=money(m[2]);
      u.safmr=money(m[4]);                          // the 150% ceiling — never table 3
      seen.push({type:norm(u.type),rent:money(m[3])});
      return;
    }
    if(section==='owner'&&(m=t.match(ROW_5C))){     // belfry gross-renewal
      const u=upsert(units,m[1],pi,money(m[2]));
      if(u.count==='')u.count=money(m[2]);
      u.ua=money(m[4]);
      seen.push({type:norm(u.type),rent:money(m[3])});
      return;
    }
    if(section==='safmr'&&(m=t.match(ROW_4C))){     // BASE safmr, not the ceiling
      const u=upsert(units,m[1],pi,money(m[2]));
      u.safmr_base=money(m[3]);
      return;
    }
  });
}

/* ------------------------- the whole reading ------------------------- */

async function readLetter(rd){
  const S={},units=[],totals={},warn=[],seen=[];
  const out={firm:null,scalars:S,units:units,totals:totals,warnings:warn,pages:[],read:[]};
  const found=await findLetter(rd);
  out.pages=found.pages;out.read=found.read;
  if(!found.found){
    out.textless=!!found.textless;
    warn.push(out.textless
      ?'This copy has no readable text, so nothing could be read from it.'
      :'No appraiser’s transmittal letter was found in this document, so nothing was read from it.');
    return out;
  }
  const perPage=found.pages.map(function(i){return {pi:i,txt:lines(found.runs[i]).map(function(l){return l.text;})};});
  out.firm=detectFirm(perPage.map(function(x){return x.txt.map(norm).join('|');}).join('|'));

  readSender(perPage[0].txt,S);
  readSubject(perPage[0].txt,S,warn);
  perPage.forEach(function(x){readSignature(x.txt,S);});
  perPage.forEach(function(x){readTables(x.txt,x.pi,units,totals,seen);});

  /* Cornerstone keeps its address, telephone and e-mail on the title page
     rather than in the letter. One extra page, and ONLY when something is
     actually missing — never as a matter of course. */
  if((!S['appr.email']||!S['appr.phone']||!S['appr.addr_street'])&&rd.pageCount>0){
    const t0=lines(await rd.getPage(0)).map(function(l){return l.text;});
    out.read.push(0);
    const T={};readSender(t0,T,t0.length);   // a title page names the firm far down, under "Prepared By:"
    ['appr.firm','appr.addr_street','appr.addr_city','appr.addr_state','appr.addr_zip','appr.phone','appr.email']
      .forEach(function(k){if(!S[k]&&T[k])S[k]=T[k];});
  }

  /* The market rent is printed more than once. Agreement is verification;
     disagreement is the document arguing with itself, and it says so. */
  units.forEach(function(u){
    const vals=seen.filter(function(x){return x.type===norm(u.type);}).map(function(x){return x.rent;})
                   .filter(function(v){return v!=='';});
    const uniq=vals.filter(function(v,i){return vals.indexOf(v)===i;});
    if(uniq.length>1)warn.push('The study prints more than one market rent for '+u.type+': '+uniq.map(function(v){return '$'+v.toLocaleString('en-US');}).join(' and ')+'. The unit table’s figure was used.');
  });
  /* The 150% ceiling.

     Where the study prints it (Belfry does, per unit type) it is read, and
     checked against the SAFMR the same study printed — 1.5x, exactly, on all
     nine unit types across five studies.

     Where the study prints only a total (Cornerstone does) the per-type
     ceiling is DERIVED from the base. That is not the parser inventing a
     figure: 150% of SAFMR is arithmetic fixed by Chapter Nine, the app already
     stores round(1.5 x base) for the HUD pull in safmr_hud, and Cornerstone
     performs the same multiplication itself at the total level. The flag says
     it was derived so the cell can be honest about where it came from. */
  units.forEach(function(u){
    if(u.safmr!==''&&u.safmr_base!==''){
      if(Math.abs(Math.round(u.safmr_base*1.5)-u.safmr)>2)
        warn.push('For '+u.type+' the study’s 150% SAFMR ($'+u.safmr.toLocaleString('en-US')+') is not 1.5 times the SAFMR it prints ($'+u.safmr_base.toLocaleString('en-US')+').');
    }else if(u.safmr===''&&u.safmr_base!==''&&u.safmr_base>0){
      u.safmr=Math.round(u.safmr_base*1.5);
      u.safmr_derived=true;
    }
  });
  /* Fixed key order. The record is compared, stored and re-read, and a totals
     object whose keys arrive in whatever order the document printed them in
     stringifies differently every time. */
  const T={};
  if(totals.grossRenewal!=null)T.grossRenewal=totals.grossRenewal;
  if(totals.grossSafmrBase!=null)T.grossSafmrBase=totals.grossSafmrBase;
  if(totals.grossSafmr150!=null)T.grossSafmr150=totals.grossSafmr150;
  if(T.grossRenewal!=null&&T.grossSafmr150!=null)T.verdict=T.grossRenewal<T.grossSafmr150?'pass':'fail';
  out.totals=T;
  units.forEach(function(u){
    if(u.alias&&u.alias.length)warn.push('The study calls the same '+u.count+'-unit type both “'+u.type+'” and “'+u.alias.join('” and “')+'”. They were read as one type.');
  });
  if(!units.length)warn.push('The letter’s rent table could not be read, so no rents were taken from it.');
  return out;
}

window.RCSParse={norm:norm,lines:lines,money:money,dec:dec,pageKey:pageKey,
  findLetter:findLetter,readLetter:readLetter,parseType:parseType,
  _splitCityStateZip:splitCityStateZip,_isoDate:isoDate,_s8From:s8From,_detectFirm:detectFirm,_readSender:readSender,
  _caps:{scan:LETTER_SCAN_CAP,tail:LETTER_TAIL},_probeOrder:probeOrder};
})();
