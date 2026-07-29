#!/usr/bin/env node
/* ocr-cache.js -- tier 3, run in node, cached.

   WHY NOT IN THE BROWSER. The selftest boot deliberately never constructs a
   Supabase client, and app.js says why: "the isolation is structural, not a
   permission that could be misconfigured." Handing the headless harness real
   credentials would trade that guarantee for convenience. So the OCR runs here
   instead, using THE APP'S OWN ocr.js -- its page splitting, its template
   geometry, its field placement -- with only the network transport swapped for
   a plain fetch carrying a real session. What the app would compute is what
   gets computed; the browser still cannot reach Supabase at all.

   CACHED, because the same schedule is otherwise read twice per property (once
   per fill order) and Azure's free tier allows roughly one request a second
   across the whole subscription. Caching halves the calls -- and it removes OCR
   nondeterminism from the fill-order comparison, which would otherwise show up
   as a difference between the orders that is really a difference between two
   scans of the same page.

   usage:
     node ocr-cache.js <corpusRoot> <cacheDir> <corpus.json> [--only NAME] [--limit N]
*/
global.CSS={escape:s=>s};
const mem={};
global.window={addEventListener:()=>{},localStorage:{getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=v;},removeItem:k=>{delete mem[k];}},scrollY:0,scrollTo(){}};
function mk(id){return {id:id||'',style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},setAttribute(){},getAttribute(){return'';},appendChild(){},addEventListener(){},closest(){return null;},parentElement:null,querySelector(){return null;},querySelectorAll(){return[];},innerHTML:'',textContent:'',onclick:null,value:'',checked:false,focus(){},select(){},setSelectionRange(){},files:[]};}
const els={};
global.document={getElementById:id=>els[id]||(els[id]=mk(id)),querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>mk(),addEventListener(){},body:{classList:{toggle(){},contains(){return false;}}}};

const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..','..','..');
const APP=path.join(ROOT,'app','full-mp');
(0,eval)(fs.readFileSync(path.join(APP,'lib/pdf-lib.min.js'),'utf8'));
global.window.PDFLib=global.window.PDFLib||globalThis.PDFLib;

const argv=process.argv.slice(2);
const flag=(n,d)=>{const i=argv.indexOf('--'+n);return i>=0?argv[i+1]:d;};
const pos=[];for(let i=0;i<argv.length;i++){const a=argv[i];
  if(a.startsWith('--')){if(['only','limit'].includes(a.slice(2)))i++;continue;}pos.push(a);}
const [CORPUS,CACHE,MANIFEST]=pos;
if(!CORPUS||!CACHE||!MANIFEST){
  console.log('usage: node ocr-cache.js <corpusRoot> <cacheDir> <corpus.json> [--only NAME] [--limit N]');
  process.exit(2);
}
const ONLY=flag('only',''),LIMIT=+flag('limit',0)||0;
const OUT=path.join(CACHE,'_ocr');
fs.mkdirSync(OUT,{recursive:true});

/* ---- the session Matt made with signin.js ------------------------------- */
const SESSF=path.join(CACHE,'.session.json');
if(!fs.existsSync(SESSF)){
  console.error('No session at '+SESSF);
  console.error('Run:  node app/full-mp/corpus/signin.js');
  process.exit(3);
}
let SESS=JSON.parse(fs.readFileSync(SESSF,'utf8'));
const CFG=fs.readFileSync(path.join(APP,'config.js'),'utf8');
const SUPA_URL=(CFG.match(/SUPABASE_URL\s*=\s*'([^']+)'/)||[])[1].replace(/\/+$/,'');
const ANON=(CFG.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)||[])[1];

async function freshToken(){
  if(SESS.expires_at&&SESS.expires_at-60>Math.floor(Date.now()/1000))return SESS.access_token;
  const r=await fetch(SUPA_URL+'/auth/v1/token?grant_type=refresh_token',{
    method:'POST',headers:{'apikey':ANON,'Content-Type':'application/json'},
    body:JSON.stringify({refresh_token:SESS.refresh_token})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.access_token)throw new Error('session expired and could not be refreshed — run signin.js again');
  SESS={access_token:j.access_token,refresh_token:j.refresh_token,
        expires_at:Math.floor(Date.now()/1000)+(j.expires_in||3600),email:SESS.email};
  fs.writeFileSync(SESSF,JSON.stringify(SESS,null,1),{mode:0o600});
  return SESS.access_token;
}

/* ---- the app, with only the transport replaced -------------------------- */
const _b=path.join(os.tmpdir(),'rcs_ocr.'+process.pid+'.js');
process.on('exit',()=>{try{fs.rmSync(_b,{force:true});}catch(e){}});
fs.writeFileSync(_b,['templates.js','core.js','score.js','db.js','app.js','ocr.js','rcs.js']
  .map(x=>fs.readFileSync(path.join(APP,x),'utf8')).join('\n')
  /* supaClient is only ever tested for presence before the call; the call
     itself is what we are replacing, so a truthy stand-in is enough and no
     real client is ever constructed. */
  +'\nsupaClient={__node:true};\n'
  +'ocrAnalyze=async function(u8){return await global.__ocrPost(u8);};\n'
  +'if(typeof module!=="undefined")Object.assign(module.exports,'
  +'{__ocrParseRs:ocrParseRs,__ocrWhy:()=>OCR_WHY,__parseRsPdf:parseRsPdf});\n');

let CALLS=0,THROTTLES=0,BYTES=0;
global.__ocrPost=async function(u8){
  const b64=Buffer.from(u8).toString('base64');
  BYTES+=b64.length;
  for(let attempt=0;attempt<4;attempt++){
    const tok=await freshToken();
    CALLS++;
    const r=await fetch(SUPA_URL+'/functions/v1/ocr-rs',{
      method:'POST',
      headers:{'apikey':ANON,'Authorization':'Bearer '+tok,'Content-Type':'application/json'},
      body:JSON.stringify({pdf:b64})});
    if(r.status===429||r.status===504){
      THROTTLES++;
      const wait=2000*(attempt+1);
      process.stderr.write('      throttled ('+r.status+'), waiting '+(wait/1000)+'s\n');
      await new Promise(res=>setTimeout(res,wait));
      continue;
    }
    const j=await r.json().catch(()=>null);
    if(!r.ok)throw new Error((j&&j.error)||('OCR endpoint returned '+r.status));
    /* F0 allows about one request per second across the subscription. Pace
       ourselves rather than discovering the limit as a 429. */
    await new Promise(res=>setTimeout(res,1100));
    return j;
  }
  throw new Error('rate limited four times in a row');
};
const app=require(_b);

/* ---- run ---------------------------------------------------------------- */
const man=JSON.parse(fs.readFileSync(MANIFEST,'utf8'));
const resolveIn=(folder,rel)=>{
  const c=path.join(CACHE,folder,rel);
  return fs.existsSync(c)?c:path.join(CORPUS,folder,rel);
};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex').slice(0,16);

(async()=>{
  let props=man.properties.filter(p=>(p.cycles||[]).some(c=>c.wave===1&&c.priorRs));
  if(ONLY)props=props.filter(p=>p.name.toLowerCase().includes(ONLY.toLowerCase()));
  if(LIMIT)props=props.slice(0,LIMIT);
  console.log('session: '+SESS.email+'   properties: '+props.length+'\n');

  let done=0,already=0,read=0,failed=0,skipped=0;
  for(const p of props){
    const c=p.cycles.find(x=>x.wave===1);
    const abs=resolveIn(p.folder,c.priorRs);
    let bytes;try{bytes=new Uint8Array(fs.readFileSync(abs));}catch(e){
      console.log('  X '+p.name+': unreadable file');failed++;continue;}
    const dst=path.join(OUT,sha(Buffer.from(bytes))+'.json');
    done++;
    if(fs.existsSync(dst)){already++;
      console.log('  = '+String(done).padStart(2)+'/'+props.length+' '+p.name.padEnd(26)+'cached');continue;}

    /* Tier 1 and 2 first, exactly as the app tries them. Only a schedule the
       app genuinely cannot read is worth paying Azure for. */
    let pre=null;try{pre=await app.__parseRsPdf(bytes);}catch(e){}
    if(pre&&pre.parsed&&(pre.parsed.units||[]).length){
      fs.writeFileSync(dst,JSON.stringify({tier:pre.kind,via:'text',parsed:pre.parsed,
        property:p.name,file:c.priorRs},null,1));
      skipped++;
      console.log('  . '+String(done).padStart(2)+'/'+props.length+' '+p.name.padEnd(26)
        +'readable without OCR ('+pre.kind+') — not billed');
      continue;
    }

    process.stdout.write('  > '+String(done).padStart(2)+'/'+props.length+' '+p.name.padEnd(26)+'OCR… ');
    const t0=Date.now();
    let parsed=null,why='';
    try{parsed=await app.__ocrParseRs(bytes);}catch(e){why=e.message||String(e);}
    if(!why)why=app.__ocrWhy()||'';
    const secs=Math.round((Date.now()-t0)/1000);
    if(parsed&&(parsed.units||[]).length){
      fs.writeFileSync(dst,JSON.stringify({tier:'ocr',via:'ocr',parsed,property:p.name,
        file:c.priorRs,seconds:secs},null,1));
      read++;
      console.log('read '+parsed.units.length+' unit row(s) in '+secs+'s');
    }else{
      failed++;
      console.log('NOT READ in '+secs+'s'+(why?(' — '+why.slice(0,90)):''));
    }
  }
  console.log('\n'+'='.repeat(60));
  console.log('properties          : '+done);
  console.log('already cached      : '+already);
  console.log('readable without OCR: '+skipped+'   (no Azure call made)');
  console.log('read by OCR         : '+read);
  console.log('still unreadable    : '+failed);
  console.log('Azure calls made    : '+CALLS+'   throttled: '+THROTTLES
    +'   sent: '+(BYTES/1048576).toFixed(1)+' MB');
  console.log('cache               : '+OUT);
})().catch(e=>{console.error('\n'+e.message);process.exit(1);});
