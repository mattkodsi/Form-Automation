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
# The corpus sweep rig was pared down (2026-08-01) to three tools, kept only for
# what native tooling cannot do and run by hand, not from this suite:
# corpus/ocr-cache.js (the app's own OCR pipeline over scans), corpus/rdiff.js
# (pixel-diff of two rendered PDFs; the look.js rasteriser is now folded into it)
# and corpus/drive.js (drive the real signed-in app). Their former test suites
# (test_safety/compare/extract/look) were removed with the tools they tested.
#
# test_shots.js drives the same headless chromium and PHOTOGRAPHS the app -
# the one question the DOM cannot answer is what the rendering looks like.
# It fails loudly where no chromium is installed rather than skipping: a
# screenshot suite that renders nothing has verified nothing.
# test_fuzz.js proves the randomized interaction storm (fuzz.js) by planting
# defects in copies of these very sources, building them, and requiring the
# storm to name each break — then requiring silence on the clean build with the
# identical seed. A fuzzer that has never caught a planted defect is a
# random-number generator with a log file.
suites="test_crypto.js test_db.js test_interactions.js smoke_combined.js test_gen.js test_rcs.js test_hap.js test_browser.js test_shots.js test_fuzz.js"
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
