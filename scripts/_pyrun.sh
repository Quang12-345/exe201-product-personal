#!/usr/bin/env sh
# Cross-platform Python launcher for AI log hooks.
# Tries python3 -> python -> py -3 on PATH; on Windows, falls back to common
# Python install locations because Git Bash launched by some hooks gets a
# stripped PATH that omits the Windows Python directory.
# Designed to be called as: sh scripts/_pyrun.sh <script> [args...]
#
# Exits 0 silently if no Python is found; hooks must never block the AI tool.
set -u

PY_BIN=""
PY_ARG=""

if command -v python3 >/dev/null 2>&1 && python3 -c "import sys" >/dev/null 2>&1; then
  PY_BIN=python3
elif command -v python >/dev/null 2>&1 && python -c "import sys" >/dev/null 2>&1; then
  PY_BIN=python
elif command -v py >/dev/null 2>&1 && py -3 -c "import sys" >/dev/null 2>&1; then
  PY_BIN=py
  PY_ARG=-3
else
  # PATH lookup failed or hit a WindowsApps stub; probe common installs.
  for cand in \
    /c/Users/*/AppData/Local/Programs/Python/Python*/python.exe \
    "/c/Program Files/Python"*/python.exe \
    "/c/Program Files (x86)/Python"*/python.exe \
    /c/Python*/python.exe; do
    if [ -x "$cand" ] && "$cand" -c "import sys" >/dev/null 2>&1; then
      PY_BIN="$cand"
      break
    fi
  done
fi

[ -n "$PY_BIN" ] || exit 0

if [ -n "$PY_ARG" ]; then
  exec "$PY_BIN" "$PY_ARG" "$@"
else
  exec "$PY_BIN" "$@"
fi
