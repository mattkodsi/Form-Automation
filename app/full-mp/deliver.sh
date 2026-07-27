#!/usr/bin/env bash
# deliver.sh — safe rebuild + verified delivery of the multi-property app.
#
# Builds the app in the sandbox, gates on syntax + EVERY test suite (via
# run_tests.sh — add new suites there, not here), copies the result to the ROOT
# deliverable index.html, then verifies the copy landed intact. The final cmp
# guards the documented mounted-folder truncation gotcha: if the big file tears
# mid-copy, this fails loudly instead of shipping a corrupt app.
#
# Usage:  bash app/full-mp/deliver.sh
set -euo pipefail

d="$(cd "$(dirname "$0")" && pwd)"          # app/full-mp
root="$(cd "$d/../.." && pwd)"              # project root
deliverable="$root/index.html"
tmp="$(mktemp -d)"; build="$tmp/app.html"
trap 'rm -rf "$tmp"' EXIT

echo "1/5  syntax check (every JS the build concatenates)…"
for f in config.js core.js db.js db.supabase.js app.js ocr.js gen.js xlsx.js; do node --check "$d/$f"; done
echo "     ✓ syntax OK"

echo "2/5  test suites (run_tests.sh)…"
if ! bash "$d/run_tests.sh" > "$tmp/test.out" 2>&1; then
  # only the ✗ lines: the failed checks and the banner, not 130 passing ones
  echo "     ✗ tests FAILED — not delivering:"; grep '✗' "$tmp/test.out" | tail -20 | sed 's/^/     /'
  echo "       (full output: bash $d/run_tests.sh)"; exit 1
fi
grep -o 'ALL .* PASSED' "$tmp/test.out" | sed 's/^/     ✓ /'

echo "3/5  build in sandbox…"
bash "$d/build.sh" "$build" >/dev/null
[ -s "$build" ] || { echo "     ✗ build produced an empty file"; exit 1; }
echo "     ✓ built ($(wc -c <"$build") bytes)"

echo "4/5  deliver to root…"
cp "$build" "$deliverable"

echo "5/5  verify the copy landed intact…"
if cmp -s "$build" "$deliverable"; then
  echo "     ✓ delivered + verified:"
  echo "       $deliverable"
else
  echo "     ✗ mismatch after copy (possible truncation) — re-run deliver.sh"; exit 1
fi

echo "Done. Open the file in your browser to QA."
