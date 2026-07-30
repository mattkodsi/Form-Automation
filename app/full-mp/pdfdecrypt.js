/* pdfdecrypt.js — turn a permissions-locked PDF into a plain one.

   These files carry an EMPTY user password: /P restricts what a viewer will
   let you do, but opening needs no secret, which is why Preview shows them
   instantly. pdf-lib has no decryption at all, and its ignoreEncryption flag
   does not skip encryption -- it defers the failure to the page tree, which is
   why the symptom arrives as "Expected instance of e, but got instance of
   undefined" rather than as anything about a password.

   HOW, AND WHY THIS WAY
   Rather than parse cross-reference tables and streams, we scan the raw bytes
   for "N G obj ... endobj" and rewrite each object in place. Two consequences,
   both good:
     - Objects hidden inside an /ObjStm never need expanding. Their container's
       stream is decrypted while still Flate-compressed, and pdf-lib expands it
       afterwards -- so this file needs no inflate implementation at all.
     - A damaged cross-reference table cannot stop us; the scan is what PDF
       repair tools do.

   Three things must NOT be decrypted, and each is a real corruption if missed:
     - the /Encrypt dictionary itself (its /O /U /OE /UE are stored plain),
     - cross-reference streams (never encrypted, by specification),
     - a metadata stream when /EncryptMetadata is false.

   Exposed as window.RCSPdfDecrypt.{isEncrypted, decrypt}. */
(function(){
'use strict';
const C=(typeof window!=='undefined'&&window.RCSCrypto)||(typeof require!=='undefined'&&require('./crypto.js'));

const PAD=new Uint8Array([0x28,0xBF,0x4E,0x5E,0x4E,0x75,0x8A,0x41,0x64,0x00,0x4E,0x56,
                          0xFF,0xFA,0x01,0x08,0x2E,0x2E,0x00,0xB6,0xD0,0x68,0x3E,0x80,
                          0x2F,0x0C,0xA9,0xFE,0x64,0x53,0x69,0x7A]);
const enc=s=>{const o=new Uint8Array(s.length);for(let i=0;i<s.length;i++)o[i]=s.charCodeAt(i)&255;return o;};
const dec=b=>{let s='';for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return s;};
const cat=C.concat;

/* Inflate, for cross-reference streams only -- they are small, and by
   specification never encrypted. Object streams are left compressed: we
   decrypt their bytes and let pdf-lib expand them, which is why this file
   needs no inflate of its own beyond this.
   DecompressionStream in the browser, zlib under node. */
async function inflate(bytes,raw){
  if(typeof DecompressionStream!=='undefined'){
    const ds=new DecompressionStream(raw?'deflate-raw':'deflate');
    const st=new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(st).arrayBuffer());
  }
  const zlib=require('zlib');
  return new Uint8Array(raw?zlib.inflateRawSync(bytes):zlib.inflateSync(bytes));
}
/* PNG predictors, as used by nearly every cross-reference stream. */
function unpredict(data,colors,bpc,columns){
  const bpp=Math.ceil(colors*bpc/8), rowLen=Math.ceil(colors*bpc*columns/8);
  const rows=Math.floor(data.length/(rowLen+1));
  const out=new Uint8Array(rows*rowLen);
  let prev=new Uint8Array(rowLen);
  for(let r=0;r<rows;r++){
    const ft=data[r*(rowLen+1)];
    const row=data.slice(r*(rowLen+1)+1,r*(rowLen+1)+1+rowLen);
    const cur=new Uint8Array(rowLen);
    for(let i=0;i<rowLen;i++){
      const a=i>=bpp?cur[i-bpp]:0, b=prev[i], c=i>=bpp?prev[i-bpp]:0, x=row[i];
      let v;
      if(ft===0)v=x; else if(ft===1)v=x+a; else if(ft===2)v=x+b;
      else if(ft===3)v=x+((a+b)>>1);
      else if(ft===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
                      v=x+((pa<=pb&&pa<=pc)?a:(pb<=pc?b:c));}
      else v=x;
      cur[i]=v&255;
    }
    out.set(cur,r*rowLen);prev=cur;
  }
  return out;
}

/* ---- tiny helpers over the raw byte string ---- */
function findAll(hay,re){const out=[];let m;re.lastIndex=0;while((m=re.exec(hay)))out.push(m);return out;}

/* A PDF string is either ( ... ) with escapes and balanced parens, or < ... >
   hex. Dictionaries open with << so a hex string is never two angle brackets. */
function scanStrings(s,from,to){
  const out=[];
  let i=from;
  while(i<to){
    const c=s[i];
    if(c==='('){
      const start=i;let depth=1;i++;
      while(i<to&&depth>0){
        if(s[i]==='\\'){i+=2;continue;}
        if(s[i]==='(')depth++;
        else if(s[i]===')')depth--;
        i++;
      }
      out.push({start,end:i,hex:false});
      continue;
    }
    if(c==='<'&&s[i+1]!=='<'){
      const start=i;i++;
      while(i<to&&s[i]!=='>')i++;
      i++;
      out.push({start,end:i,hex:true});
      continue;
    }
    if(c==='<'&&s[i+1]==='<'){i+=2;continue;}
    i++;
  }
  return out;
}
function unescapeLiteral(raw){           // raw includes the surrounding parens
  const body=raw.slice(1,-1);const out=[];
  for(let i=0;i<body.length;i++){
    let ch=body[i];
    if(ch!=='\\'){out.push(ch.charCodeAt(0)&255);continue;}
    const n=body[++i];
    if(n===undefined)break;
    if(n==='n')out.push(10);else if(n==='r')out.push(13);else if(n==='t')out.push(9);
    else if(n==='b')out.push(8);else if(n==='f')out.push(12);
    else if(n==='('||n===')'||n==='\\')out.push(n.charCodeAt(0));
    else if(n>='0'&&n<='7'){let o=n;while(o.length<3&&body[i+1]>='0'&&body[i+1]<='7')o+=body[++i];out.push(parseInt(o,8)&255);}
    else if(n==='\n')continue;
    else out.push(n.charCodeAt(0)&255);
  }
  return new Uint8Array(out);
}
function unhex(raw){                     // raw includes < >
  const h=raw.slice(1,-1).replace(/[^0-9A-Fa-f]/g,'');
  const p=h.length%2?h+'0':h;
  const o=new Uint8Array(p.length/2);
  for(let i=0;i<o.length;i++)o[i]=parseInt(p.substr(i*2,2),16);
  return o;
}
/* Always re-emit as a hex string: no escaping rules to get wrong, and binary
   ciphertext-turned-plaintext often contains parens and backslashes. */
const toHexString=b=>{let s='<';for(let i=0;i<b.length;i++)s+=(b[i]<16?'0':'')+b[i].toString(16);return s+'>';};

/* ---- the encryption dictionary ---- */
function dictValue(d,key){
  const m=new RegExp('\\/'+key+'\\s*(\\d+\\s+\\d+\\s+R|\\/[A-Za-z0-9]+|-?\\d+|true|false|<[^>]*>|\\([^)]*\\))').exec(d);
  return m?m[1].trim():null;
}
/* Cut a balanced << >> sub-dictionary out, so a key inside it cannot be
   mistaken for the same key at the top level. */
function cutSubDict(body,name){
  const at=body.indexOf('/'+name);
  if(at<0)return body;
  let i=body.indexOf('<<',at);
  if(i<0)return body;
  let depth=0,j=i;
  for(;j<body.length-1;j++){
    if(body[j]==='<'&&body[j+1]==='<'){depth++;j++;}
    else if(body[j]==='>'&&body[j+1]==='>'){depth--;j++;if(!depth){j++;break;}}
  }
  return body.slice(0,at)+body.slice(j);
}
function parseEncryptDict(body){
  const V=parseInt(dictValue(body,'V')||'0',10);
  const R=parseInt(dictValue(body,'R')||'0',10);
  const P=parseInt(dictValue(body,'P')||'0',10);
  /* THE KEY LENGTH IS NOT THE FIRST /Length IN THE DICTIONARY. A V4 dictionary
     opens with /CF<</StdCF<</CFM/AESV2/Length 16>>>>, and that 16 is the crypt
     filter's length in BYTES, while the document's own /Length 128 is in BITS.
     Reading the first match gave a 2-byte key, a plausible-looking derivation,
     and 175 of 175 streams that would not inflate. Cut /CF out first. */
  const top=cutSubDict(body,'CF');
  let Length=parseInt(dictValue(top,'Length')||'40',10);
  if(Length<=16)Length*=8;               // a stray byte-length, normalised
  const em=dictValue(body,'EncryptMetadata');
  const strs=scanStrings(body,0,body.length);
  const grab=key=>{
    const at=body.indexOf('/'+key);
    if(at<0)return null;
    const s=strs.find(x=>x.start>=at&&x.start<at+key.length+40);
    if(!s)return null;
    const raw=body.slice(s.start,s.end);
    return s.hex?unhex(raw):unescapeLiteral(raw);
  };
  let CFM=null;
  const cfm=/\/CFM\s*\/(\w+)/.exec(body);
  if(cfm)CFM=cfm[1];
  return {V,R,P,Length,CFM,
          encryptMetadata:em!=='false',
          O:grab('O'),U:grab('U'),OE:grab('OE'),UE:grab('UE')};
}

/* ---- Algorithm 2: the file key for revisions 2..4, empty user password ---- */
function keyR234(e,idBytes){
  const n=(e.R===2)?5:Math.max(5,Math.floor(e.Length/8));
  const pbytes=new Uint8Array(4);
  new DataView(pbytes.buffer).setInt32(0,e.P,true);
  const parts=[PAD,(e.O||new Uint8Array(32)).slice(0,32),pbytes,idBytes||new Uint8Array(0)];
  if(e.R>=4&&!e.encryptMetadata)parts.push(new Uint8Array([0xFF,0xFF,0xFF,0xFF]));
  let key=C.md5(cat(parts));
  if(e.R>=3)for(let i=0;i<50;i++)key=C.md5(key.slice(0,n));
  return key.slice(0,n);
}
/* ---- Algorithm 2.B: revision 6's iterated hash ---- */
function hash2B(password,salt,udata,isR6){
  let K=C.sha256(cat([password,salt,udata||new Uint8Array(0)]));
  if(!isR6)return K;
  let i=0,E=null;
  for(;;){
    const K1=[];
    for(let j=0;j<64;j++)K1.push(password,K,udata||new Uint8Array(0));
    const data=cat(K1);
    E=C.aesEncryptCBCNoPad(K.slice(0,16),K.slice(16,32),data);
    let sum=0;for(let j=0;j<16;j++)sum+=E[j];
    const mod=sum%3;
    K=(mod===0)?C.sha256(E):(mod===1)?C.sha384(E):C.sha512(E);
    i++;
    if(i>=64&&E[E.length-1]<=i-32)break;
  }
  return K.slice(0,32);
}
/* ---- Algorithm 2.A: the file key for revisions 5 and 6 ---- */
function keyR56(e){
  const pw=new Uint8Array(0);                        // empty user password
  const U=e.U||new Uint8Array(48);
  const valSalt=U.slice(32,40), keySalt=U.slice(40,48);
  const isR6=e.R===6;
  const check=hash2B(pw,valSalt,null,isR6);
  const ok=dec(check.slice(0,32))===dec(U.slice(0,32));
  const ikey=hash2B(pw,keySalt,null,isR6);
  if(!e.UE)return {key:null,ok:false};
  const fileKey=C.aesDecryptCBC(ikey,e.UE,false);    // zero IV, no padding
  return {key:fileKey.slice(0,32),ok};
}

/* ---- per-object key (revisions <= 4) ---- */
function objectKey(fileKey,num,gen,isAES){
  const ext=new Uint8Array([num&255,(num>>8)&255,(num>>16)&255,gen&255,(gen>>8)&255]);
  const parts=[fileKey,ext];
  if(isAES)parts.push(new Uint8Array([0x73,0x41,0x6C,0x54]));   // "sAlT"
  const k=C.md5(cat(parts));
  return k.slice(0,Math.min(fileKey.length+5,16));
}

/* ---- the cross-reference chain -------------------------------------------
   We need this for one reason: objects living inside an /ObjStm never appear
   as "N G obj" anywhere in the file, so a scan cannot see them and a classic
   xref table cannot describe them. Their entries are type 2 -- (container,
   index) -- and dropping them is what produced "Invalid object ref: 3610 0 R"
   from pdf-lib. We read the original entries and carry the type-2 ones through
   unchanged, rewriting only the type-1 offsets we moved. */
async function readXref(s){
  const entries={};                       // num -> {t,a,b}; first writer wins
  const put=(n,e)=>{if(entries[n]===undefined)entries[n]=e;};
  const seen=new Set();
  const last=s.lastIndexOf('startxref');
  if(last<0)return entries;
  let start=parseInt((s.slice(last+9).match(/\d+/)||['-1'])[0],10);

  while(start>=0&&start<s.length&&!seen.has(start)){
    seen.add(start);
    let next=-1;
    if(/^\s*xref/.test(s.slice(start,start+12))){
      /* classic table */
      let p=s.indexOf('xref',start)+4;
      for(;;){
        const r=/^\s*(\d+)\s+(\d+)\s*/.exec(s.slice(p,p+48));
        if(!r)break;
        const first=+r[1],count=+r[2];
        p+=r[0].length;
        for(let i=0;i<count;i++){
          const em=/(\d{10})\s(\d{5})\s([nf])/.exec(s.substr(p,20));
          if(em)put(first+i,em[3]==='n'?{t:1,a:+em[1],b:+em[2]}:{t:0,a:0,b:0});
          p+=20;
        }
        if(/^\s*trailer/.test(s.slice(p,p+16)))break;
      }
      const tr=s.indexOf('trailer',p);
      const trailer=tr>=0?s.slice(tr,tr+3000):'';
      /* A hybrid file hides its compressed entries behind /XRefStm. */
      const xs=/\/XRefStm\s+(\d+)/.exec(trailer);
      if(xs)await readXrefStreamAt(s,+xs[1],put);
      const pv=/\/Prev\s+(\d+)/.exec(trailer);
      next=pv?+pv[1]:-1;
    }else{
      next=await readXrefStreamAt(s,start,put);
    }
    start=next;
  }
  return entries;
}
async function readXrefStreamAt(s,at,put){
  const om=/(\d+)\s+(\d+)\s+obj\b/.exec(s.slice(at,at+64));
  if(!om)return -1;
  const bodyAt=at+om.index+om[0].length;
  const sm=/\bstream\r?\n?/.exec(s.slice(bodyAt,bodyAt+8192));
  if(!sm)return -1;
  const dict=s.slice(bodyAt,bodyAt+sm.index);
  if(!/\/Type\s*\/XRef\b/.test(dict))return -1;
  const lenM=/\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
  const dataAt=bodyAt+sm.index+sm[0].length;
  let raw;
  if(lenM)raw=enc(s.substr(dataAt,+lenM[1]));
  else{const es=s.indexOf('endstream',dataAt);raw=enc(s.slice(dataAt,es<0?dataAt:es));}
  let data;
  try{ data=/\/FlateDecode/.test(dict)?await inflate(raw):raw; }catch(e){ return -1; }
  const dp=/\/DecodeParms\s*<<([^>]*)>>/.exec(dict);
  if(dp&&/\/Predictor\s+(\d+)/.test(dp[1])){
    const pred=+(/\/Predictor\s+(\d+)/.exec(dp[1])[1]);
    if(pred>=10){
      const cols=+((/\/Columns\s+(\d+)/.exec(dp[1])||[0,1])[1]);
      const bpc=+((/\/BitsPerComponent\s+(\d+)/.exec(dp[1])||[0,8])[1]);
      data=unpredict(data,1,bpc,cols);
    }
  }
  const wm=/\/W\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(dict);
  if(!wm)return -1;
  const W=[+wm[1],+wm[2],+wm[3]], rec=W[0]+W[1]+W[2];
  const size=+((/\/Size\s+(\d+)/.exec(dict)||[0,0])[1]);
  let index=[0,size];
  const im=/\/Index\s*\[([\d\s]+)\]/.exec(dict);
  if(im)index=im[1].trim().split(/\s+/).map(Number);
  const readN=(off,n)=>{let v=0;for(let i=0;i<n;i++)v=v*256+data[off+i];return v;};
  let off=0;
  for(let k=0;k+1<index.length;k+=2){
    const first=index[k],count=index[k+1];
    for(let i=0;i<count&&off+rec<=data.length;i++,off+=rec){
      const t=W[0]===0?1:readN(off,W[0]);
      const a=readN(off+W[0],W[1]);
      const b=W[2]?readN(off+W[0]+W[1],W[2]):0;
      put(first+i,{t,a,b});
    }
  }
  const pv=/\/Prev\s+(\d+)/.exec(dict);
  return pv?+pv[1]:-1;
}

function isEncrypted(bytes){
  const head=dec(bytes.slice(0,Math.min(bytes.length,4096)));
  const tail=dec(bytes.slice(Math.max(0,bytes.length-4096)));
  return /\/Encrypt\b/.test(head)||/\/Encrypt\b/.test(tail)||/\/Encrypt\s+\d+\s+\d+\s+R/.test(dec(bytes));
}

async function decrypt(bytes){
  const s=dec(bytes);
  const encRef=/\/Encrypt\s+(\d+)\s+(\d+)\s+R/.exec(s);
  if(!encRef)return {ok:false,reason:'no /Encrypt reference in the trailer'};
  const encNum=parseInt(encRef[1],10);

  const idm=/\/ID\s*\[\s*<([0-9A-Fa-f\s]*)>/.exec(s);
  const idBytes=idm?unhex('<'+idm[1]+'>'):new Uint8Array(0);

  /* every "N G obj" in the file */
  const objs=findAll(s,/(\d+)\s+(\d+)\s+obj\b/g).map(m=>({num:+m[1],gen:+m[2],at:m.index,bodyAt:m.index+m[0].length}));
  if(!objs.length)return {ok:false,reason:'no objects found'};
  /* An object runs to the start of the next one. Searching for 'endobj'
     inside what may be binary stream data finds a coincidence, not a
     terminator. */
  objs.forEach((o,i)=>{ o.end=(i+1<objs.length)?objs[i+1].at:s.length; });

  /* Integer objects, so an indirect /Length can be resolved. */
  const lengthOf={};
  for(const o of objs){
    const m=/^\s*(\d+)\s*$/.exec(s.slice(o.bodyAt,Math.min(o.end,o.bodyAt+40)).replace(/endobj[\s\S]*$/,''));
    if(m)lengthOf[o.num]=+m[1];
  }

  const xref=await readXref(s);
  const encObj=objs.find(o=>o.num===encNum);
  if(!encObj)return {ok:false,reason:'/Encrypt object '+encNum+' not found'};
  const e=parseEncryptDict(s.slice(encObj.bodyAt,encObj.end));
  if(e.R>=5&&!e.UE)return {ok:false,reason:'revision '+e.R+' without /UE'};

  let fileKey,validated=true;
  if(e.R>=5){const r=keyR56(e);fileKey=r.key;validated=r.ok;}
  else fileKey=keyR234(e,idBytes);
  if(!fileKey)return {ok:false,reason:'could not derive a file key'};

  const isAES=e.CFM==='AESV2'||e.CFM==='AESV3'||e.R>=5;
  const cipher=(key,data)=>isAES?C.aesDecryptCBC(key,data):C.rc4(key,data);

  /* ---- rewrite ---- */
  const out=[];
  out.push(enc('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n'));
  let pos=out[0].length;
  const offsets={};
  let maxNum=0, streams=0, strings=0;

  for(const o of objs){
    maxNum=Math.max(maxNum,o.num);
    let body=s.slice(o.bodyAt,o.end).replace(/endobj\s*$/,'');
    const skip=(o.num===encNum)||/\/Type\s*\/XRef\b/.test(body);

    /* Split dictionary from stream payload, and trust /Length over any marker
       search. Stream bytes are arbitrary binary: they can and do contain the
       literal "endobj" and "endstream", so locating the end by searching for
       either truncates the stream and corrupts the file. Length is
       authoritative; the markers are only a fallback for a broken one. */
    const sm=/\bstream\r?\n?/.exec(body);
    let dictPart=body, raw=null;
    if(sm){
      const dataStart=sm.index+sm[0].length;
      dictPart=body.slice(0,sm.index);
      let len=null;
      const dl=/\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dictPart);
      if(dl)len=+dl[1];
      else{
        const il=/\/Length\s+(\d+)\s+\d+\s+R/.exec(dictPart);
        if(il&&lengthOf[+il[1]]!==undefined)len=lengthOf[+il[1]];
      }
      if(len===null||dataStart+len>body.length){
        const es=body.lastIndexOf('endstream');
        len=(es>dataStart)?es-dataStart:0;
      }
      raw=body.substr(dataStart,len);
    }

    if(!skip){
      const key=(e.R>=5)?fileKey:objectKey(fileKey,o.num,o.gen,isAES);
      /* strings inside the dictionary */
      const found=scanStrings(dictPart,0,dictPart.length);
      if(found.length){
        let rebuilt='',last=0;
        for(const f of found){
          const rawStr=dictPart.slice(f.start,f.end);
          const plainIn=f.hex?unhex(rawStr):unescapeLiteral(rawStr);
          let plain;
          try{plain=cipher(key,plainIn);}catch(err){plain=plainIn;}
          rebuilt+=dictPart.slice(last,f.start)+toHexString(plain);
          last=f.end;strings++;
        }
        dictPart=rebuilt+dictPart.slice(last);
      }
      /* the stream payload, still compressed -- pdf-lib inflates it later */
      if(raw!==null){
        const isMeta=/\/Type\s*\/Metadata\b/.test(dictPart);
        if(!(isMeta&&!e.encryptMetadata)){
          let plain;
          try{plain=cipher(key,enc(raw));}catch(err){plain=enc(raw);}
          raw=dec(plain);streams++;
        }
        dictPart=dictPart.replace(/\/Length\s+\d+\s+\d+\s+R/,'/Length '+raw.length)
                         .replace(/\/Length\s+\d+(?!\s+\d+\s+R)/,'/Length '+raw.length);
        if(!/\/Length/.test(dictPart))dictPart=dictPart.replace(/>>\s*$/,'/Length '+raw.length+'>>');
      }
    }

    const text=(raw!==null)
      ? dictPart+'stream\n'+raw+'\nendstream\n'
      : dictPart;
    const chunk=enc(o.num+' '+o.gen+' obj\n'+text+'\nendobj\n');
    offsets[o.num]=pos;
    out.push(chunk);pos+=chunk.length;
  }

  /* A cross-reference STREAM, not a table, and uncompressed so we need no
     deflate. A table cannot express a type-2 entry, and type-2 is how every
     object inside an /ObjStm is reached -- writing a table is what made
     pdf-lib report "Invalid object ref" for objects that were present and
     correct all along. Entries we did not move are carried through verbatim. */
  const rootm=/\/Root\s+(\d+)\s+(\d+)\s+R/.exec(s);
  if(!rootm)return {ok:false,reason:'no /Root in the trailer'};
  const xrefNum=maxNum+1, size=xrefNum+1, xrefPos=pos;
  let carried=0;
  const rec=new Uint8Array(size*7);
  for(let i=0;i<size;i++){
    let t=0,a=0,b=65535;
    if(i===xrefNum){t=1;a=xrefPos;b=0;}
    else if(offsets[i]!==undefined){t=1;a=offsets[i];b=0;}
    else if(xref[i]&&xref[i].t===2){t=2;a=xref[i].a;b=xref[i].b;carried++;}
    const o=i*7;
    rec[o]=t;
    rec[o+1]=(a>>>24)&255;rec[o+2]=(a>>>16)&255;rec[o+3]=(a>>>8)&255;rec[o+4]=a&255;
    rec[o+5]=(b>>>8)&255;rec[o+6]=b&255;
  }
  const id=idm?idm[1].replace(/\s/g,''):null;
  const xdict='<</Type/XRef/Size '+size+'/W[1 4 2]/Root '+rootm[1]+' '+rootm[2]+' R'
    +(id?'/ID[<'+id+'><'+id+'>]':'')+'/Length '+rec.length+'>>';
  out.push(enc(xrefNum+' 0 obj\n'+xdict+'\nstream\n'));
  out.push(rec);
  out.push(enc('\nendstream\nendobj\nstartxref\n'+xrefPos+'\n%%EOF\n'));
  return {ok:true,bytes:cat(out),validated,
          info:{R:e.R,V:e.V,CFM:e.CFM,objects:objs.length,streams,strings,carriedType2:carried}};
}

const API={isEncrypted,decrypt,_keyR234:keyR234,_keyR56:keyR56,_parseEncryptDict:parseEncryptDict,_hash2B:hash2B};
if(typeof window!=='undefined')window.RCSPdfDecrypt=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})();
