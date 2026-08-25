#!/usr/bin/env bash
set -euo pipefail

relay_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "${1:-}" ]]; then
  export SHOWSCORE_RELAY_PUBLIC_HOST="$1"
fi

exec "$relay_directory/run-relay-service.sh"
