#!/usr/bin/env bash
# Serve every lane at once, so you can put them side by side in the browser.
#
#   bash serve.sh          start (or restart) all lanes
#   bash serve.sh stop     stop them
#
# Each lane is its own PORT, which means its own browser origin — so a sign-in
# in one does NOT carry to the others. That is deliberate: it keeps a redesign
# you are poking at from writing to the same session as your real work. Add
# ?selftest=1 to any URL to get seeded fake data and skip signing in entirely.
set -u
G=/Users/owner/Desktop/github
LANES=("main:$G/Form-Automation:8080" "redesign:$G/Form-Automation-UI:8081" "audit:$G/Form-Automation-AUDIT:8082")

stop_all(){ for l in "${LANES[@]}"; do p="${l##*:}"
    pid=$(lsof -ti tcp:"$p" 2>/dev/null)
    [ -n "$pid" ] && kill $pid 2>/dev/null && echo "  stopped ${l%%:*} (port $p)"
  done; }

if [ "${1:-start}" = "stop" ]; then echo "stopping:"; stop_all; exit 0; fi

echo "starting lanes:"; stop_all >/dev/null 2>&1; sleep 0.4
for l in "${LANES[@]}"; do
  name="${l%%:*}"; rest="${l#*:}"; dir="${rest%:*}"; port="${rest##*:}"
  if [ ! -f "$dir/index.html" ]; then echo "  ~ $name SKIPPED — no index.html at $dir"; continue; fi
  ( cd "$dir" && nohup python3 -m http.server "$port" >/tmp/serve-$name.log 2>&1 & )
done
sleep 1
echo
printf '  %-9s %-34s %s\n' LANE URL BRANCH
for l in "${LANES[@]}"; do
  name="${l%%:*}"; rest="${l#*:}"; dir="${rest%:*}"; port="${rest##*:}"
  [ -f "$dir/index.html" ] || continue
  br=$(git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null)
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$port/index.html")
  printf '  %-9s %-34s %s  [HTTP %s]\n' "$name" "http://localhost:$port/index.html" "$br" "$code"
done
echo
echo "  live (deployed from main):  https://packageautomation.run.place"
echo "  append ?selftest=1 for seeded data with no sign-in"
echo "  stop with:  bash serve.sh stop"
