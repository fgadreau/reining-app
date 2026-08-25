#!/usr/bin/env bash
set -euo pipefail

repository="${SHOWSCORE_RELAY_REPOSITORY:-fgadreau/reining-app}"
release_ref="${SHOWSCORE_RELAY_RELEASE_REF:-main}"
user_home="${SHOWSCORE_RELAY_USER_HOME:-$HOME}"
install_directory="${SHOWSCORE_RELAY_INSTALL_DIR:-$user_home/local-relay}"
public_host="${1:-}"
temporary_directory="$(mktemp -d)"

cleanup() {
  rm -rf -- "$temporary_directory"
}
trap cleanup EXIT

archive_url="${SHOWSCORE_RELAY_ARCHIVE_URL:-https://codeload.github.com/$repository/tar.gz/refs/heads/$release_ref}"
archive_path="$temporary_directory/showscore.tar.gz"

echo "Téléchargement de la dernière version du relais ShowScore…"
curl --fail --location --silent --show-error "$archive_url" --output "$archive_path"
tar -xzf "$archive_path" -C "$temporary_directory"

source_directory="$(find "$temporary_directory" -mindepth 2 -maxdepth 2 -type d -name local-relay -print -quit)"
if [[ -z "$source_directory" || ! -f "$source_directory/package.json" ]]; then
  echo "Erreur : le paquet téléchargé ne contient pas le relais ShowScore." >&2
  exit 1
fi

# Valider et préparer toutes les dépendances avant d'arrêter le relais actif.
npm --prefix "$source_directory" ci --omit=dev

if systemctl --user is-active --quiet showscore-relay.service 2>/dev/null; then
  systemctl --user stop showscore-relay.service
fi

mkdir -p "$install_directory"
cp -a "$source_directory/." "$install_directory/"

if [[ -n "$public_host" ]]; then
  "$install_directory/install-launcher.sh" "$public_host"
else
  "$install_directory/install-launcher.sh"
fi

"$install_directory/launch-relay-app.sh" --no-open

relay_version="$(node -p "require('$install_directory/package.json').version")"
echo "Relais ShowScore $relay_version installé et démarré."
echo "Vérification : http://127.0.0.1:9874/"
