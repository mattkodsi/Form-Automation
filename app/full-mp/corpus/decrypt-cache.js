/* Unlocked copies of the corpus, made with OUR decryptor.

   Twenty of the filed studies carry a PDF standard security handler with an
   empty user password -- the kind Adobe writes when someone ticks "restrict
   editing". pdf-lib cannot open them, so the manifest recorded twenty read
   errors and the corpus quietly lost the firms those studies came from.

   This uses ../pdfdecrypt.js, the code the app itself ships, and not MuPDF.
   That is deliberate: a corpus unlocked by a tool we do not ship would prove
   the tool, not the app. If a study opens here, it opens for Matt.

   Nothing is written under the Drive mount. Every output goes to the cache,
   which is gitignored -- these files carry real contract numbers and rents.

   Usage:
     node decrypt-cache.js <corpusRoot> <cacheDir> <corpus.json> [--all]

   Default scans the manifest's readErrors. --all additionally walks every
   file the manifest names, which catches a locked document that happened to
   parse well enough not to error. */
const fs=require('fs'),path=require('path');
global.window=global.window||{};
global.window.RCSCrypto=require(path.join(__dirname,'..','crypto.js'));
const D=require(path.join(__dirname,'..','pdfdecrypt.js'));

/* Every file the manifest names, as {property, folder, rel}. */
function manifestFiles(man){
  const out=[];
  for(const p of man.properties){
    for(const c of (p.cycles||[])){
      for(const s of (c.studies||[]))out.push({property:p.name,folder:p.folder,rel:s.file});
      for(const k of Object.keys(c.docs||{}))
        for(const d of c.docs[k])out.push({property:p.name,folder:p.folder,rel:d.file});
    }
  }
  return out;
}

async function decryptToCache(root,cache,manifestPath,opts){
  opts=opts||{};
  const man=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const folderOf={};man.properties.forEach(p=>{folderOf[p.name]=p.folder;});

  /* readErrors first -- these are the twenty we know are broken -- then, with
     --all, everything else. Dedup by destination so a file named twice is
     read once. */
  const queue=[];const seen=new Set();
  const push=(property,rel)=>{
    const folder=folderOf[property];if(!folder)return;
    const key=folder+'|'+rel;if(seen.has(key))return;seen.add(key);
    queue.push({property,folder,rel});
  };
  for(const e of (man.readErrors||[]))push(e.property,e.file);
  const known=queue.length;
  if(opts.all)for(const f of manifestFiles(man))push(f.property,f.rel);

  let ok=0,failed=0,plain=0,cached=0;const failures=[];
  for(let i=0;i<queue.length;i++){
    const q=queue[i];
    const src=path.join(root,q.folder,q.rel), dst=path.join(cache,q.folder,q.rel);
    const label=path.basename(q.rel).slice(0,54);
    if(fs.existsSync(dst)){cached++;continue;}
    let bytes;
    try{bytes=new Uint8Array(fs.readFileSync(src));}
    catch(err){failed++;failures.push({file:q.rel,why:'unreadable: '+err.code});
      console.log('  X unreadable  '+label);continue;}
    if(!D.isEncrypted(bytes)){plain++;
      /* Not an error under --all: most of the corpus is unlocked. It IS
         notable for a readErrors entry, because then the read failed for some
         other reason and decryption will not save it. */
      if(i<known){failed++;failures.push({file:q.rel,why:'not encrypted; read failed for another reason'});
        console.log('  ? not encrypted, so decryption cannot fix it: '+label);}
      continue;}
    let r;
    try{r=await D.decrypt(bytes);}
    catch(err){failed++;failures.push({file:q.rel,why:'threw: '+err.message});
      console.log('  X threw      '+label+': '+String(err.message).slice(0,50));continue;}
    if(!r.ok){failed++;failures.push({file:q.rel,why:r.reason});
      console.log('  X '+String(r.reason).slice(0,10).padEnd(11)+label);continue;}
    fs.mkdirSync(path.dirname(dst),{recursive:true});
    fs.writeFileSync(dst,Buffer.from(r.bytes));
    ok++;
    console.log('  + R'+r.info.R+' '+String(r.info.CFM||'-').padEnd(7)+label);
  }
  return {ok,failed,plain,cached,known,scanned:queue.length,failures};
}

module.exports={decryptToCache,manifestFiles};

if(require.main===module){
  const [root,cache,man]=process.argv.slice(2);
  const all=process.argv.includes('--all');
  if(!root||!cache||!man){
    console.log('usage: node decrypt-cache.js <corpusRoot> <cacheDir> <corpus.json> [--all]');
    process.exit(2);
  }
  decryptToCache(root,cache,man,{all}).then(r=>{
    console.log('\nscanned '+r.scanned+' ('+r.known+' known-bad)  decrypted '+r.ok
      +'  already cached '+r.cached+'  unencrypted '+r.plain+'  failed '+r.failed);
    if(r.failures.length){
      console.log('\nfailures:');
      r.failures.forEach(f=>console.log('  '+f.why+'  <-  '+f.file));
    }
    process.exitCode=r.failed?1:0;
  }).catch(e=>{console.error(e);process.exit(1);});
}
