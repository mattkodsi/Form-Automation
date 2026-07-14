@echo off
REM Phase 1 proof - requires Node 22.6+ (built-in SQLite + TypeScript; no installs).
cd /d "%~dp0"
node --experimental-strip-types --experimental-sqlite --no-warnings src\roundtrip.ts
echo.
pause
