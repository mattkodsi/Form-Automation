#!/usr/bin/env node
/* signin.js -- MATT RUNS THIS, NOT ME.

   The tier-3 OCR endpoint checks the JWT's role claim and refuses anything that
   is not `authenticated`, so the corpus harness needs a real session. This asks
   for the password in YOUR terminal, with echo off, posts it straight to
   Supabase, and keeps only the tokens that come back. The password is never
   written down, never passed as an argument (which would put it in your shell
   history), and never seen by me.

   The session file lands in the gitignored cache. Tokens expire in an hour; the
   refresh token in it lets the harness renew without asking again.

     node app/full-mp/corpus/signin.js
*/
const fs=require('fs'),path=require('path'),readline=require('readline');
const ROOT=path.resolve(__dirname,'..','..','..');
const CFG=fs.readFileSync(path.join(ROOT,'app','full-mp','config.js'),'utf8');
const URL_=(CFG.match(/SUPABASE_URL\s*=\s*'([^']+)'/)||[])[1];
const ANON=(CFG.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)||[])[1];
const OUT=path.join(ROOT,'_archive','corpus-cache','.session.json');

function ask(q,hidden){
  return new Promise(res=>{
    const rl=readline.createInterface({input:process.stdin,output:process.stdout,terminal:true});
    if(!hidden)return rl.question(q,a=>{rl.close();res(a.trim());});
    /* echo off: overwrite what the terminal would have shown */
    const onData=()=>{ if(rl.line.length)readline.moveCursor(process.stdout,-rl.line.length,0),
      readline.clearLine(process.stdout,1),process.stdout.write(q); };
    process.stdin.on('data',onData);
    rl.question(q,a=>{process.stdin.removeListener('data',onData);rl.close();process.stdout.write('\n');res(a.trim());});
  });
}

(async()=>{
  if(!URL_||!ANON){console.error('could not read SUPABASE_URL / ANON key from config.js');process.exit(1);}
  console.log('Signing in to '+URL_);
  console.log('This is only used to let the corpus harness call the OCR endpoint.\n');
  const email=(await ask('email [mfkodsi@gmail.com]: '))||'mfkodsi@gmail.com';
  const password=await ask('password (not shown, not stored): ',true);
  if(!password){console.error('no password given; nothing done');process.exit(1);}

  const r=await fetch(URL_.replace(/\/+$/,'')+'/auth/v1/token?grant_type=password',{
    method:'POST',
    headers:{'apikey':ANON,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
  });
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.access_token){
    console.error('\nsign-in failed ('+r.status+'): '+(j.error_description||j.msg||j.error||'unknown'));
    process.exit(1);
  }
  /* Only the tokens. Never the password. */
  const sess={access_token:j.access_token,refresh_token:j.refresh_token,
              expires_at:Math.floor(Date.now()/1000)+(j.expires_in||3600),
              email:(j.user&&j.user.email)||email};
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(sess,null,1),{mode:0o600});
  /* Prove the token carries what the edge function demands, rather than
     assuming it: the function rejects anything whose role is not
     'authenticated', and finding that out here beats finding it out 54 OCR
     calls into a sweep. */
  let role='';
  try{role=JSON.parse(Buffer.from(sess.access_token.split('.')[1],'base64').toString()).role||'';}catch(e){}
  console.log('\nsigned in as '+sess.email);
  console.log('token role: '+role+(role==='authenticated'?'  (the OCR endpoint will accept this)'
                                                        :'  <-- the OCR endpoint will REFUSE this'));
  console.log('written to '+path.relative(ROOT,OUT)+'  (gitignored, mode 600)');
})().catch(e=>{console.error(e.message);process.exit(1);});
