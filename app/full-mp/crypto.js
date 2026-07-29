/* crypto.js — the primitives a PDF's standard security handler needs, and
   nothing else. Dependency-free and browser-safe: the app ships as one HTML
   file, so `require` and WebCrypto are both out. WebCrypto in particular cannot
   do the no-padding AES-128-CBC that revision 6 key derivation runs 64+ times,
   which is why this is hand-rolled rather than delegated.

   Every function here is checked against node's crypto or a published test
   vector in test_crypto.js. Cryptography that is nearly right is wrong, and
   silently so — a bad key yields plausible bytes, not an error.

   Exposed as window.RCSCrypto: md5, sha256, sha384, sha512, rc4,
   aesDecryptCBC, aesEncryptCBCNoPad. */
(function(){
'use strict';

/* ---- helpers ---- */
function u8(a){return a instanceof Uint8Array?a:new Uint8Array(a);}
function concat(list){let n=0;list.forEach(a=>n+=a.length);const o=new Uint8Array(n);let i=0;
  list.forEach(a=>{o.set(a,i);i+=a.length;});return o;}

/* ---- MD5 (RFC 1321) — key derivation for revisions 2..4 ---- */
const MD5_S=[7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
             5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
             4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
             6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
const MD5_K=(function(){const k=new Uint32Array(64);
  for(let i=0;i<64;i++)k[i]=(Math.floor(Math.abs(Math.sin(i+1))*4294967296))>>>0;return k;})();
function md5(msg){
  msg=u8(msg);
  const len=msg.length, bitLen=len*8;
  const padded=new Uint8Array((((len+8)>>6)+1)<<6);
  padded.set(msg); padded[len]=0x80;
  const dv=new DataView(padded.buffer);
  dv.setUint32(padded.length-8, bitLen>>>0, true);
  dv.setUint32(padded.length-4, Math.floor(bitLen/4294967296), true);
  let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
  const M=new Uint32Array(16);
  for(let off=0;off<padded.length;off+=64){
    for(let i=0;i<16;i++)M[i]=dv.getUint32(off+i*4,true);
    let A=a0,B=b0,C=c0,D=d0;
    for(let i=0;i<64;i++){
      let F,g;
      if(i<16){F=(B&C)|(~B&D);g=i;}
      else if(i<32){F=(D&B)|(~D&C);g=(5*i+1)&15;}
      else if(i<48){F=B^C^D;g=(3*i+5)&15;}
      else{F=C^(B|~D);g=(7*i)&15;}
      F=(F+A+MD5_K[i]+M[g])>>>0;
      A=D;D=C;C=B;
      B=(B+((F<<MD5_S[i])|(F>>>(32-MD5_S[i]))))>>>0;
    }
    a0=(a0+A)>>>0;b0=(b0+B)>>>0;c0=(c0+C)>>>0;d0=(d0+D)>>>0;
  }
  const out=new Uint8Array(16), odv=new DataView(out.buffer);
  odv.setUint32(0,a0,true);odv.setUint32(4,b0,true);odv.setUint32(8,c0,true);odv.setUint32(12,d0,true);
  return out;
}

/* ---- SHA-256 (revision 5/6) ---- */
const K256=new Uint32Array([
0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function sha256(msg){
  msg=u8(msg);
  const len=msg.length,bitLen=len*8;
  const padded=new Uint8Array((((len+8)>>6)+1)<<6);
  padded.set(msg);padded[len]=0x80;
  const dv=new DataView(padded.buffer);
  dv.setUint32(padded.length-8,Math.floor(bitLen/4294967296));
  dv.setUint32(padded.length-4,bitLen>>>0);
  let H=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const w=new Uint32Array(64);
  const rr=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let off=0;off<padded.length;off+=64){
    for(let i=0;i<16;i++)w[i]=dv.getUint32(off+i*4);
    for(let i=16;i<64;i++){
      const s0=rr(w[i-15],7)^rr(w[i-15],18)^(w[i-15]>>>3);
      const s1=rr(w[i-2],17)^rr(w[i-2],19)^(w[i-2]>>>10);
      w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
    }
    let [a,b,c,d,e,f,g,h]=H;
    for(let i=0;i<64;i++){
      const S1=rr(e,6)^rr(e,11)^rr(e,25);
      const ch=(e&f)^(~e&g);
      const t1=(h+S1+ch+K256[i]+w[i])>>>0;
      const S0=rr(a,2)^rr(a,13)^rr(a,22);
      const mj=(a&b)^(a&c)^(b&c);
      const t2=(S0+mj)>>>0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    H[0]=(H[0]+a)>>>0;H[1]=(H[1]+b)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+h)>>>0;
  }
  const out=new Uint8Array(32),odv=new DataView(out.buffer);
  for(let i=0;i<8;i++)odv.setUint32(i*4,H[i]);
  return out;
}

/* ---- SHA-512 / SHA-384, on 32-bit halves (revision 6's hash loop) ---- */
const K512=[
'428a2f98d728ae22','7137449123ef65cd','b5c0fbcfec4d3b2f','e9b5dba58189dbbc','3956c25bf348b538',
'59f111f1b605d019','923f82a4af194f9b','ab1c5ed5da6d8118','d807aa98a3030242','12835b0145706fbe',
'243185be4ee4b28c','550c7dc3d5ffb4e2','72be5d74f27b896f','80deb1fe3b1696b1','9bdc06a725c71235',
'c19bf174cf692694','e49b69c19ef14ad2','efbe4786384f25e3','0fc19dc68b8cd5b5','240ca1cc77ac9c65',
'2de92c6f592b0275','4a7484aa6ea6e483','5cb0a9dcbd41fbd4','76f988da831153b5','983e5152ee66dfab',
'a831c66d2db43210','b00327c898fb213f','bf597fc7beef0ee4','c6e00bf33da88fc2','d5a79147930aa725',
'06ca6351e003826f','142929670a0e6e70','27b70a8546d22ffc','2e1b21385c26c926','4d2c6dfc5ac42aed',
'53380d139d95b3df','650a73548baf63de','766a0abb3c77b2a8','81c2c92e47edaee6','92722c851482353b',
'a2bfe8a14cf10364','a81a664bbc423001','c24b8b70d0f89791','c76c51a30654be30','d192e819d6ef5218',
'd69906245565a910','f40e35855771202a','106aa07032bbd1b8','19a4c116b8d2d0c8','1e376c085141ab53',
'2748774cdf8eeb99','34b0bcb5e19b48a8','391c0cb3c5c95a63','4ed8aa4ae3418acb','5b9cca4f7763e373',
'682e6ff3d6b2b8a3','748f82ee5defb2fc','78a5636f43172f60','84c87814a1f0ab72','8cc702081a6439ec',
'90befffa23631e28','a4506cebde82bde9','bef9a3f7b2c67915','c67178f2e372532b','ca273eceea26619c',
'd186b8c721c0c207','eada7dd6cde0eb1e','f57d4f7fee6ed178','06f067aa72176fba','0a637dc5a2c898a6',
'113f9804bef90dae','1b710b35131c471b','28db77f523047d84','32caab7b40c72493','3c9ebe0a15c9bebc',
'431d67c49c100d4c','4cc5d4becb3e42b6','597f299cfc657e2a','5fcb6fab3ad6faec','6c44198c4a475817'
].map(h=>[parseInt(h.slice(0,8),16)>>>0,parseInt(h.slice(8),16)>>>0]);

function sha512core(msg,is384){
  msg=u8(msg);
  const H=(is384?['cbbb9d5dc1059ed8','629a292a367cd507','9159015a3070dd17','152fecd8f70e5939',
                  '67332667ffc00b31','8eb44a8768581511','db0c2e0d64f98fa7','47b5481dbefa4fa4']
                :['6a09e667f3bcc908','bb67ae8584caa73b','3c6ef372fe94f82b','a54ff53a5f1d36f1',
                  '510e527fade682d1','9b05688c2b3e6c1f','1f83d9abfb41bd6b','5be0cd19137e2179'])
    .map(h=>[parseInt(h.slice(0,8),16)>>>0,parseInt(h.slice(8),16)>>>0]);
  const len=msg.length,bitLen=len*8;
  const padded=new Uint8Array((((len+16)>>7)+1)<<7);
  padded.set(msg);padded[len]=0x80;
  const dv=new DataView(padded.buffer);
  dv.setUint32(padded.length-8,Math.floor(bitLen/4294967296));
  dv.setUint32(padded.length-4,bitLen>>>0);
  const add=(a,b)=>{const lo=(a[1]>>>0)+(b[1]>>>0);
    return [((a[0]+b[0]+(lo>4294967295?1:0))>>>0),(lo>>>0)];};
  const rotr=(x,n)=>{ if(n===32)return [x[1],x[0]];
    if(n<32)return [((x[0]>>>n)|(x[1]<<(32-n)))>>>0,((x[1]>>>n)|(x[0]<<(32-n)))>>>0];
    n-=32;return [((x[1]>>>n)|(x[0]<<(32-n)))>>>0,((x[0]>>>n)|(x[1]<<(32-n)))>>>0];};
  const shr=(x,n)=>{ if(n<32)return [x[0]>>>n,((x[1]>>>n)|(x[0]<<(32-n)))>>>0];
    return [0,x[0]>>>(n-32)];};
  const xor=(a,b)=>[(a[0]^b[0])>>>0,(a[1]^b[1])>>>0];
  const w=new Array(80);
  for(let off=0;off<padded.length;off+=128){
    for(let i=0;i<16;i++)w[i]=[dv.getUint32(off+i*8),dv.getUint32(off+i*8+4)];
    for(let i=16;i<80;i++){
      const s0=xor(xor(rotr(w[i-15],1),rotr(w[i-15],8)),shr(w[i-15],7));
      const s1=xor(xor(rotr(w[i-2],19),rotr(w[i-2],61)),shr(w[i-2],6));
      w[i]=add(add(add(w[i-16],s0),w[i-7]),s1);
    }
    let a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for(let i=0;i<80;i++){
      const S1=xor(xor(rotr(e,14),rotr(e,18)),rotr(e,41));
      const ch=[((e[0]&f[0])^(~e[0]&g[0]))>>>0,((e[1]&f[1])^(~e[1]&g[1]))>>>0];
      const t1=add(add(add(add(h,S1),ch),K512[i]),w[i]);
      const S0=xor(xor(rotr(a,28),rotr(a,34)),rotr(a,39));
      const mj=[((a[0]&b[0])^(a[0]&c[0])^(b[0]&c[0]))>>>0,((a[1]&b[1])^(a[1]&c[1])^(b[1]&c[1]))>>>0];
      const t2=add(S0,mj);
      h=g;g=f;f=e;e=add(d,t1);d=c;c=b;b=a;a=add(t1,t2);
    }
    const v=[a,b,c,d,e,f,g,h];
    for(let i=0;i<8;i++)H[i]=add(H[i],v[i]);
  }
  const out=new Uint8Array(64),odv=new DataView(out.buffer);
  for(let i=0;i<8;i++){odv.setUint32(i*8,H[i][0]);odv.setUint32(i*8+4,H[i][1]);}
  return is384?out.slice(0,48):out;
}
const sha512=m=>sha512core(m,false);
const sha384=m=>sha512core(m,true);

/* ---- RC4 (revisions 2..4 with /CFM /V2) ---- */
function rc4(key,data){
  key=u8(key);data=u8(data);
  const S=new Uint8Array(256);
  for(let i=0;i<256;i++)S[i]=i;
  for(let i=0,j=0;i<256;i++){
    j=(j+S[i]+key[i%key.length])&255;
    const t=S[i];S[i]=S[j];S[j]=t;
  }
  const out=new Uint8Array(data.length);
  for(let k=0,i=0,j=0;k<data.length;k++){
    i=(i+1)&255;j=(j+S[i])&255;
    const t=S[i];S[i]=S[j];S[j]=t;
    out[k]=data[k]^S[(S[i]+S[j])&255];
  }
  return out;
}

/* ---- AES ---- */
const SBOX=new Uint8Array(256), INV=new Uint8Array(256);
(function(){
  let p=1,q=1;
  do{
    p=(p^(p<<1)^(p&0x80?0x1b:0))&255;
    q^=q<<1;q^=q<<2;q^=q<<4;q&=255;if(q&0x80)q^=0x09;
    const x=(q^((q<<1)|(q>>>7))^((q<<2)|(q>>>6))^((q<<3)|(q>>>5))^((q<<4)|(q>>>4)))&255^0x63;
    SBOX[p]=x;INV[x]=p;
  }while(p!==1);
  SBOX[0]=0x63;INV[0x63]=0;
})();
const xt=a=>((a<<1)^(a&0x80?0x1b:0))&255;
function mul(a,b){let r=0;while(b){if(b&1)r^=a;a=xt(a);b>>=1;}return r&255;}
function expandKey(key){
  key=u8(key);
  const Nk=key.length/4, Nr=Nk+6, w=new Array(4*(Nr+1));
  for(let i=0;i<Nk;i++)w[i]=[key[4*i],key[4*i+1],key[4*i+2],key[4*i+3]];
  let rcon=1;
  for(let i=Nk;i<4*(Nr+1);i++){
    let t=w[i-1].slice();
    if(i%Nk===0){
      t=[SBOX[t[1]]^rcon,SBOX[t[2]],SBOX[t[3]],SBOX[t[0]]];
      rcon=xt(rcon);
    }else if(Nk>6&&i%Nk===4){
      t=[SBOX[t[0]],SBOX[t[1]],SBOX[t[2]],SBOX[t[3]]];
    }
    w[i]=w[i-Nk].map((v,j)=>v^t[j]);
  }
  return {w,Nr};
}
function addRoundKey(s,w,r){for(let c=0;c<4;c++)for(let j=0;j<4;j++)s[c*4+j]^=w[r*4+c][j];}
function encryptBlock(block,ks){
  const s=Uint8Array.from(block);
  addRoundKey(s,ks.w,0);
  for(let round=1;round<=ks.Nr;round++){
    for(let i=0;i<16;i++)s[i]=SBOX[s[i]];
    // ShiftRows (state is column-major: s[col*4+row])
    for(let r=1;r<4;r++){
      const tmp=[s[r],s[4+r],s[8+r],s[12+r]];
      for(let c=0;c<4;c++)s[c*4+r]=tmp[(c+r)&3];
    }
    if(round!==ks.Nr){
      for(let c=0;c<4;c++){
        const a0=s[c*4],a1=s[c*4+1],a2=s[c*4+2],a3=s[c*4+3];
        s[c*4]  =mul(a0,2)^mul(a1,3)^a2^a3;
        s[c*4+1]=a0^mul(a1,2)^mul(a2,3)^a3;
        s[c*4+2]=a0^a1^mul(a2,2)^mul(a3,3);
        s[c*4+3]=mul(a0,3)^a1^a2^mul(a3,2);
      }
    }
    addRoundKey(s,ks.w,round);
  }
  return s;
}
function decryptBlock(block,ks){
  const s=Uint8Array.from(block);
  addRoundKey(s,ks.w,ks.Nr);
  for(let round=ks.Nr-1;round>=0;round--){
    for(let r=1;r<4;r++){
      const tmp=[s[r],s[4+r],s[8+r],s[12+r]];
      for(let c=0;c<4;c++)s[c*4+r]=tmp[(c-r+4)&3];
    }
    for(let i=0;i<16;i++)s[i]=INV[s[i]];
    addRoundKey(s,ks.w,round);
    if(round!==0){
      for(let c=0;c<4;c++){
        const a0=s[c*4],a1=s[c*4+1],a2=s[c*4+2],a3=s[c*4+3];
        s[c*4]  =mul(a0,14)^mul(a1,11)^mul(a2,13)^mul(a3,9);
        s[c*4+1]=mul(a0,9)^mul(a1,14)^mul(a2,11)^mul(a3,13);
        s[c*4+2]=mul(a0,13)^mul(a1,9)^mul(a2,14)^mul(a3,11);
        s[c*4+3]=mul(a0,11)^mul(a1,13)^mul(a2,9)^mul(a3,14);
      }
    }
  }
  return s;
}
/* PDF streams carry the IV as the first 16 bytes, then PKCS#7 padding. */
function aesDecryptCBC(key,data,ivIncluded){
  key=u8(key);data=u8(data);
  const ks=expandKey(key);
  let iv,body;
  if(ivIncluded===false){iv=new Uint8Array(16);body=data;}
  else{iv=data.slice(0,16);body=data.slice(16);}
  const n=body.length-(body.length%16);
  const out=new Uint8Array(n);
  let prev=iv;
  for(let off=0;off<n;off+=16){
    const ct=body.slice(off,off+16);
    const pt=decryptBlock(ct,ks);
    for(let i=0;i<16;i++)pt[i]^=prev[i];
    out.set(pt,off);
    prev=ct;
  }
  if(!n)return out;
  const pad=out[n-1];
  return (pad>=1&&pad<=16&&pad<=n)?out.slice(0,n-pad):out;
}
/* Revision 6 runs AES-128-CBC ENCRYPT with no padding, 64+ times. */
function aesEncryptCBCNoPad(key,iv,data){
  key=u8(key);data=u8(data);
  const ks=expandKey(key);
  const out=new Uint8Array(data.length);
  let prev=u8(iv);
  for(let off=0;off+16<=data.length;off+=16){
    /* A COPY, explicitly. Buffer.prototype.slice returns a view, not a copy, so
       XORing in place here rewrote the caller's plaintext -- invisible in the
       browser, where Uint8Array.slice does copy, and corrupting under node.
       Never mutate a slice you did not allocate. */
    const blk=new Uint8Array(data.subarray(off,off+16));
    for(let i=0;i<16;i++)blk[i]^=prev[i];
    const ct=encryptBlock(blk,ks);
    out.set(ct,off);
    prev=ct;
  }
  return out;
}

const API={md5,sha256,sha384,sha512,rc4,aesDecryptCBC,aesEncryptCBCNoPad,concat,_expandKey:expandKey,
           _encryptBlock:encryptBlock,_decryptBlock:decryptBlock};
if(typeof window!=='undefined')window.RCSCrypto=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})();
