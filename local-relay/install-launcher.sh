#!/usr/bin/env bash
set -euo pipefail

relay_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
public_host="${1:-}"
user_home="${SHOWSCORE_RELAY_USER_HOME:-$HOME}"
service_directory="$user_home/.config/systemd/user"
application_directory="$user_home/.local/share/applications"
environment_file="$user_home/.config/showscore-relay.env"

mkdir -p "$service_directory" "$application_directory" "$relay_directory/data"
chmod +x \
  "$relay_directory/start-relay.sh" \
  "$relay_directory/run-relay-service.sh" \
  "$relay_directory/launch-relay-app.sh" \
  "$relay_directory/stop-relay-app.sh"

sed "s|@RELAY_DIRECTORY@|$relay_directory|g" \
  "$relay_directory/systemd/showscore-relay.service.in" \
  > "$service_directory/showscore-relay.service"

sed "s|@RELAY_DIRECTORY@|$relay_directory|g" \
  "$relay_directory/applications/showscore-relay.desktop.in" \
  > "$application_directory/showscore-relay.desktop"
chmod 755 "$application_directory/showscore-relay.desktop"

if [[ -n "$public_host" ]]; then
  printf 'SHOWSCORE_RELAY_PUBLIC_HOST=%s\n' "$public_host" > "$environment_file"
elif [[ ! -f "$environment_file" ]]; then
  printf '%s\n' '# SHOWSCORE_RELAY_PUBLIC_HOST=192.168.0.10' > "$environment_file"
fi
chmod 600 "$environment_file"

systemctl --user daemon-reload
systemctl --user enable showscore-relay.service

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$application_directory" >/dev/null 2>&1 || true
fi

echo "Application installée : ShowScore – Relais local"
echo "Adresse publique configurée : ${public_host:-conservée dans $environment_file}"
