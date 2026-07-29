#!/usr/bin/env python3
"""Decrypt the permissions-locked studies into a local cache.

These carry an empty USER password -- /P is restrictive but opening needs no
secret -- so this removes a restriction the owner already granted us, it does
not defeat one. Anyone can open these files by double-clicking them; only
pdf-lib cannot, because it has no decryption at all.

usage: decrypt.py <corpus-root> <cache-dir> <manifest.json>
"""
import json, os, sys
import fitz  # PyMuPDF

root, cache, manifest_path = sys.argv[1], sys.argv[2], sys.argv[3]
man = json.load(open(manifest_path))
folder_of = {p["name"]: p["folder"] for p in man["properties"]}

ok = fail = 0
for e in man.get("readErrors", []):
    folder = folder_of.get(e["property"])
    if not folder:
        continue
    src = os.path.join(root, folder, e["file"])
    dst = os.path.join(cache, folder, e["file"])
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    try:
        doc = fitz.open(src)
        if doc.needs_pass:                      # a real user password would stop here
            if not doc.authenticate(""):
                print("  NEEDS PASSWORD  " + e["file"][:70]); fail += 1; continue
        doc.save(dst, encryption=fitz.PDF_ENCRYPT_NONE, garbage=3, deflate=True)
        n = doc.page_count
        doc.close()
        print("  ok  %3d pages  %s" % (n, os.path.basename(e["file"])[:62]))
        ok += 1
    except Exception as ex:
        print("  FAIL  %s  -- %s" % (os.path.basename(e["file"])[:52], ex)); fail += 1

print("\ndecrypted %d, failed %d -> %s" % (ok, fail, cache))
