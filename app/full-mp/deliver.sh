#!/usr/bin/env bash
# deliver.sh — safe rebuild + verified delivery of the multi-property app.
#
# Builds the app in the sandbox, gates on syntax + the data-layer test suite,
# copies the result to the ROOT deliverable, then verifies the copy landed
# intact. The final cmp guards the documented mounted-folder truncation gotcha:
# if the big file tears mid-copy, this fails loudly instead of shipping a
# corrupt app.
#
# Usage:  bash app/full-mp/deliver.sh
set -euo pipefail

d="$(cd "$(dirname "$0")" && pwd)"          # app/full-mp
root="$(cd "$d/../.." && pwd)"              # project root
deliverable="$root/RCS Renewal — Multi-property (open in browser).html"
tmp="$(mktemp -d)"; build="$tmp/app.html"
trap 'rm -rf "$tmp"' EXIT

echo "1/5  syntax check (core, db, app, gen)…"
for f in core.js db.js app.js gen.js; do node --check "$d/$f"; done
echo "     ✓ syntax OK"

echo "2/5  data-layer tests (test_db.js)…"
if ! node "$d/test_db.js" > "$tmp/test.out" 2>&1; then
  echo "     ✗ tests FAILED — not delivering:"; tail -20 "$tmp/test.out"; exit 1
fi
echo "     ✓ $(grep -o 'ALL .* PASSED' "$tmp/test.out" | head -1)"

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
