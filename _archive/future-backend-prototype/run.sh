#!/usr/bin/env bash
# Phase 1 proof — requires Node 22.6+ (built-in SQLite + TypeScript; no installs).
cd "$(dirname "$0")"
node --experimental-strip-types --experimental-sqlite --no-warnings src/roundtrip.ts
