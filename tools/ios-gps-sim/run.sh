#!/usr/bin/env bash
# Convenience wrapper: sets up the venv on first run, then forwards arguments.
#   ./run.sh doctor
#   ./run.sh serve
#   ./run.sh set 19.0760 72.8777
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "creating virtualenv..."
  python3 -m venv .venv
  ./.venv/bin/pip install --quiet --upgrade pip
  ./.venv/bin/pip install --quiet -r requirements.txt
fi

exec ./.venv/bin/python -m gpssim "$@"
