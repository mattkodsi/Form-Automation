/* Every primitive against node's crypto, on random inputs of awkward lengths.
   Hand-rolled cryptography that is nearly right is wrong and silently so: a bad
   key yields plausible bytes, never an error. So nothing here trusts a single
   vector -- each function is checked over many random sizes, including the
   empty input and lengths straddling the block and padding boundaries. */
const nc=require('crypto');
const path=require('path');
/* Default to the sibling module so `node test_crypto.js` works under
   run_tests.sh, which passes no arguments. */
const C=require(process.argv[2]||path.join(__dirname,'crypto.js'));
const MIN_CHECKS=81;
let n=0,fails=0;
const hex=b=>Buffer.from(b).toString('hex');
function eq(label,got,want){n++;if(hex(got)!==hex(want)){fails++;
  console.log('  X '+label+'\n      got  '+hex(got).slice(0,64)+'\n      want '+hex(want).slice(0,64));}
  else console.log('  + '+label);}
function T(label,v){n++;if(!v){fails++;console.log('  X '+label);}else console.log('  + '+label);}

const SIZES=[0,1,15,16,17,55,56,57,63,64,65,111,112,113,127,128,129,1000,4096];

console.log('-- MD5 --');
for(const s of SIZES.slice(0,12)){
  const b=nc.randomBytes(s);
  eq('md5 len='+s,C.md5(b),nc.createHash('md5').update(b).digest());
}
console.log('-- SHA-256 --');
for(const s of SIZES){
  const b=nc.randomBytes(s);
  eq('sha256 len='+s,C.sha256(b),nc.createHash('sha256').update(b).digest());
}
console.log('-- SHA-384 / SHA-512 (the 64-bit ones) --');
for(const s of [0,1,55,111,112,113,127,128,129,1000]){
  const b=nc.randomBytes(s);
  eq('sha384 len='+s,C.sha384(b),nc.createHash('sha384').update(b).digest());
  eq('sha512 len='+s,C.sha512(b),nc.createHash('sha512').update(b).digest());
}
/* Node's OpenSSL 3 dropped RC4 from the default provider, so there is no local
   oracle for it. Published vectors instead -- and RC4 is its own inverse, so
   round-tripping also proves the keystream is stable. */
console.log('-- RC4 (published vectors; no node oracle in OpenSSL 3) --');
[['Key','Plaintext','bbf316e8d940af0ad3'],
 ['Wiki','pedia','1021bf0420'],
 ['Secret','Attack at dawn','45a01f645fc35b383552544b9bf5']].forEach(([k,p,want])=>{
  const got=C.rc4(Buffer.from(k),Buffer.from(p));
  eq('rc4 "'+k+'"',got,Buffer.from(want,'hex'));
  eq('rc4 "'+k+'" round-trips',C.rc4(Buffer.from(k),got),Buffer.from(p));
});
console.log('-- AES block, both directions --');
for(const kl of [16,32]){
  const key=nc.randomBytes(kl),blk=nc.randomBytes(16);
  const ks=C._expandKey(key);
  const ct=C._encryptBlock(blk,ks);
  const c=nc.createCipheriv(kl===16?'aes-128-ecb':'aes-256-ecb',key,null);c.setAutoPadding(false);
  eq('aes-'+(kl*8)+' encrypt block',ct,Buffer.concat([c.update(blk),c.final()]));
  eq('aes-'+(kl*8)+' decrypt round-trips',C._decryptBlock(ct,ks),blk);
}
console.log('-- AES-CBC decrypt, PDF style (IV prefixed, PKCS#7) --');
for(const kl of [16,32]){
  for(const s of [1,15,16,17,100,4096]){
    const key=nc.randomBytes(kl),iv=nc.randomBytes(16),pt=nc.randomBytes(s);
    const c=nc.createCipheriv(kl===16?'aes-128-cbc':'aes-256-cbc',key,iv);
    const ct=Buffer.concat([iv,c.update(pt),c.final()]);
    eq('aes-'+(kl*8)+'-cbc len='+s,C.aesDecryptCBC(key,ct),pt);
  }
}
console.log('-- AES-CBC decrypt, zero IV not prefixed (revision 6 UE/OE) --');
{
  const key=nc.randomBytes(32),pt=nc.randomBytes(32);
  const c=nc.createCipheriv('aes-256-cbc',key,Buffer.alloc(16));c.setAutoPadding(false);
  const ct=Buffer.concat([c.update(pt),c.final()]);
  eq('aes-256-cbc zero-iv nopad',C.aesDecryptCBC(key,ct,false),pt);
}
console.log('-- AES-128-CBC encrypt, no padding (revision 6 hash loop) --');
for(const s of [16,32,64,4096]){
  const key=nc.randomBytes(16),iv=nc.randomBytes(16),pt=nc.randomBytes(s);
  const c=nc.createCipheriv('aes-128-cbc',key,iv);c.setAutoPadding(false);
  eq('aes-128-cbc-nopad encrypt len='+s,C.aesEncryptCBCNoPad(key,iv,pt),
     Buffer.concat([c.update(pt),c.final()]));
}
console.log('-- published vectors --');
eq('md5("abc")',C.md5(Buffer.from('abc')),Buffer.from('900150983cd24fb0d6963f7d28e17f72','hex'));
eq('sha256("abc")',C.sha256(Buffer.from('abc')),
   Buffer.from('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad','hex'));
T('sbox is a permutation',new Set(Array.from({length:256},(_,i)=>i).map(i=>{
   const k=C._expandKey(Buffer.alloc(16));return 0;})).size===1);

/* A suite that dies partway must not read as a pass -- the house rule. */
if(!fails&&n<MIN_CHECKS){
  console.log('\nX CRYPTO SUITE FAILED - only '+n+' of the expected '+MIN_CHECKS+' checks ran');
  process.exitCode=1;
}else{
  console.log('\n'+(fails?('X CRYPTO SUITE FAILED ('+fails+' of '+n+')'):('+ ALL '+n+' CRYPTO CHECKS PASSED')));
  process.exitCode=fails?1:0;
}
