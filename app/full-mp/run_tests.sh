#!/usr/bin/env bash
# run_tests.sh — every automated suite, one command, one honest exit code.
#
# Both suites are documented post-edit gates, but only test_db.js was ever wired
# into deliver.sh. So when test_interactions.js broke on the Supabase migration
# it stayed broken for eleven days: the pipeline was still green, and the usual
# manual `node … | tail -2` threw away node's exit status (a pipeline reports the
# LAST command's). Run the suites through here and deliver.sh gets each new one
# for free — add it to the list below, nowhere else.
#
# Exits non-zero if ANY suite fails, and the verdict is the last line printed,
# so it survives being piped.
#
# Usage:  bash app/full-mp/run_tests.sh
set -uo pipefail                       # deliberately NOT -e: run every suite, then report

d="$(cd "$(dirname "$0")" && pwd)"     # app/full-mp
# test_browser.js builds its own bundle and drives it in a real headless
# chromium, pressing real keys. It is the only suite that can see whether a
# keystroke ever REACHES the code the others test. Where no chromium is
# installed it skips loudly — never as a pass.
# The corpus suites live one directory down. They are hermetic: test_extract.js
# reads the filed Colonial Village package committed under _archive/, and
# test_compare.js builds its own fixtures. test_safety.js skips its Drive-mount
# check loudly on a machine that has no mount, so it gates everywhere.
# corpus/test_look.js is the render-and-look instrument (look.js / rdiff.js).
# It builds its own PDFs byte by byte so every coordinate it asserts is one it
# computed, and it skips LOUDLY where poppler is not installed - a missing
# pdftoppm must never read as a pass, because the whole point of these two
# tools is that a check which sees nothing has to say so.
suites="test_crypto.js test_db.js test_interactions.js smoke_combined.js test_gen.js test_rcs.js test_hap.js test_browser.js corpus/test_safety.js corpus/test_compare.js corpus/test_extract.js corpus/test_look.js"
failed=""

for s in $suites; do
  echo "── $s ───────────────────────────────────────────────────────"
  node "$d/$s" || failed="$failed $s"
  echo
done

if [ -z "$failed" ]; then
  echo "✓ every suite passed ($suites)"
else
  echo "✗ FAILED SUITE(S):$failed — do not ship"
  exit 1
fi
