#!/usr/bin/env bash
set -euo pipefail

relay_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$relay_directory"

if [[ ! -d node_modules/ws ]]; then
  echo "Installation du relais ShowScore…"
  npm ci --omit=dev
fi

if [[ -n "${1:-}" ]]; then
  export SHOWSCORE_RELAY_PUBLIC_HOST="$1"
fi

exec npm start
