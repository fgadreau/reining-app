#!/usr/bin/env bash
set -euo pipefail

relay_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$relay_directory"

if ! command -v node >/dev/null 2>&1 && [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # Les applications Linux de ChromeOS ne chargent pas toujours le profil du terminal.
  # Charger nvm ici rend le lancement par icône aussi fiable que le lancement manuel.
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Erreur : Node.js et npm sont introuvables." >&2
  echo "Installez Node.js, puis relancez l’application ShowScore – Relais local." >&2
  exit 1
fi

if [[ ! -d node_modules/ws ]]; then
  echo "Installation du relais ShowScore…"
  npm ci --omit=dev
fi

exec node src/server.mjs
