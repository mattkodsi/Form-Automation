/* core.js — six operations on keyed cells, via an async storage adapter.
   Save writes ALL keys (incl. empty) and records db_value, so clears/unchecks
   persist and later edits register as overrides. */
function makeStore(adapter, FIELDS) {
  // saved_at is stamped in New York too, so an evening save is not dated tomorrow
  const today = () => { try { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } };
  /* origin + pinned are the provenance overhaul (2026-08-05). `origin` REMEMBERS
     where a value came from — 'typed' when a person keyed it, 'database' when it
     was read off file, and the source tags app.js stamps for a bulk fill ('rs',
     'rcs', 'hud', 'carried', …). `pinned` records that a person DELIBERATELY
     chose the value — true when they typed it or clicked a source row, false for
     a bulk fill or a carry. Both persist in the stored cell (the adapter is a
     plain JSON store, so db[key] carries them for free) and both survive a save.
     The old badge GUESSED provenance by comparing value to db_value; this lets a
     later reader ASK the cell instead. Nothing reads them yet — that is a later
     step — so every op sets sane defaults and existing behaviour is unchanged. */
  const blank = () => ({ value:'', source:'new', saved_at:null, prior_value:null, prior_source:null, db_value:null, origin:null, pinned:false });
  return {
    FIELDS,
    getDb: () => adapter.getDb(),
    clearDb: () => adapter.clearDb(),
    emptyForm(){ const f={}; for(const {key} of FIELDS) f[key]=blank(); return f; },
    async fillForm(){ const db=await adapter.getDb(); const f=this.emptyForm();
      for(const key of Object.keys(db)){ const r=db[key]; if(!r||r.value==null) continue;
        // A record saved blank keeps db_value:'' so the cell can still say it is
        // ON FILE and empty on purpose (provColors reads exactly that pair) rather
        // than looking like a cell nobody has reached. Entering into it is still
        // NEW data, not an override — see editForm below, and note that a full
        // save writes every key including the empty ones, so the other reading
        // would turn the whole form amber the first time anyone typed in it.
        if(r.value==='') f[key]={value:'',source:'new',saved_at:r.saved_at,prior_value:null,prior_source:null,db_value:'',origin:(r.origin||null),pinned:!!r.pinned};
        else f[key]={value:r.value,source:'database',saved_at:r.saved_at,prior_value:null,prior_source:null,db_value:r.value,origin:(r.origin||'database'),pinned:!!r.pinned}; }
      return f; },
    editForm(form,key,v){ if(!form[key]) form[key]=blank(); const cur=form[key], onFile=cur.db_value;
      // Explicit shape, not a {...cur} spread: any ad-hoc flag a caller stamped onto
      // the cell (e.g. app.js's fromParse) does NOT survive a plain edit by default —
      // only the caller re-stamping it right after this call keeps it alive. That's
      // what lets a manual retype correctly drop a stale "parsed" annotation.
      // A plain edit is a person typing: origin 'typed', pinned true. A caller
      // driving a bulk fill re-stamps both right after (see the fromParse note
      // above) — that is how a machine-filled cell reads 'rs'/'rcs' and unpinned.
      if(onFile!=null && onFile!==''){ if(v===onFile) form[key]={value:v,source:'database',saved_at:cur.saved_at,prior_value:null,prior_source:null,db_value:cur.db_value,origin:'typed',pinned:true};
        else form[key]={value:v,source:'overridden',saved_at:cur.saved_at,prior_value:onFile,prior_source:'database',db_value:cur.db_value,origin:'typed',pinned:true}; }
      else form[key]={value:v,source:'new',saved_at:cur.saved_at,prior_value:null,prior_source:null,db_value:cur.db_value,origin:'typed',pinned:true}; return form; }, // entering into a blank field is new data, never an override
    revertForm(form,key){ const cur=form[key]; if(!cur||cur.source!=='overridden') return false;
      const v=cur.prior_value; // reverting to a saved blank shows as empty/new, not "on file"
      form[key]={value:v,source:(v==null||v==='')?'new':(cur.prior_source||'database'),saved_at:cur.saved_at,prior_value:null,prior_source:null,db_value:cur.db_value,origin:(v==null||v==='')?null:'database',pinned:false}; return true; },
    async saveField(form,key){ const db=await adapter.getDb(); const fc=form[key]||blank(); const v=fc.value; db[key]={value:(v==null?'':v),source:'database',saved_at:today(),origin:fc.origin||null,pinned:!!fc.pinned}; await adapter.saveDb(db); form[key]={value:db[key].value,source:db[key].value===''?'new':'database',saved_at:db[key].saved_at,prior_value:null,prior_source:null,db_value:db[key].value,origin:db[key].origin,pinned:db[key].pinned}; return form; },
    /* Batch form of saveField: one adapter round-trip (=> one backend push)
       for a group of keys saved together (contact fills, address groups). */
    async saveFields(form,keys){ const db=await adapter.getDb();
      /* A cell that has never been touched is blank, not a crash. editForm has
         always guarded this way; save did not, and a group is routinely widened
         (coupledKeys) to keys the user never entered — a utility allowance
         switched to Custom carries a *_custom and a *_reviewed that may not
         exist yet. Saving then threw "Cannot read properties of undefined", and
         the form told the user the save had FAILED. */
      for(const key of keys){ const fc=form[key]||blank(); const v=fc.value; db[key]={value:(v==null?'':v),source:'database',saved_at:today(),origin:fc.origin||null,pinned:!!fc.pinned}; }
      await adapter.saveDb(db);
      for(const key of keys) form[key]={value:db[key].value,source:db[key].value===''?'new':'database',saved_at:db[key].saved_at,prior_value:null,prior_source:null,db_value:db[key].value,origin:db[key].origin,pinned:db[key].pinned};
      return form; },
    /* Lock persistence is a DIFFERENT measure from the value's save-state: pinning
       or releasing a source choice must NOT commit the value or move the cell's
       provenance colour. savePin flips ONLY `pinned` on the stored cell, leaving
       value / db_value / source / saved_at exactly as they were. If the value was
       never saved (no db entry) it just sets the working flag, and the pin rides
       along the next time the value itself is saved. */
    async savePin(form,key,pinned){ const db=await adapter.getDb();
      if(db[key]){ db[key].pinned=!!pinned; await adapter.saveDb(db); }
      if(form[key]) form[key].pinned=!!pinned; return form; },
    async saveToDb(form){ const db=await adapter.getDb();
      for(const key of Object.keys(form)){ const fc=form[key]||blank(); const v=fc.value; db[key]={value:(v==null?'':v),source:'database',saved_at:today(),origin:fc.origin||null,pinned:!!fc.pinned}; }
      await adapter.saveDb(db);
      for(const key of Object.keys(form)) form[key]={value:db[key].value,source:db[key].value===''?'new':'database',saved_at:db[key].saved_at,prior_value:null,prior_source:null,db_value:db[key].value,origin:db[key].origin,pinned:db[key].pinned};
      return form; },
  };
}
if (typeof module !== 'undefined') module.exports = { makeStore };
