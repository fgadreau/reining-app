#!/usr/bin/env bash
set -euo pipefail

status_url="http://127.0.0.1:9875/"
no_open=false

if [[ "${1:-}" == "--no-open" ]]; then
  no_open=true
fi

systemctl --user daemon-reload
systemctl --user restart showscore-relay.service

relay_ready=false
for _attempt in {1..30}; do
  if curl --fail --silent --max-time 1 http://127.0.0.1:9875/api/status >/dev/null; then
    relay_ready=true
    break
  fi
  sleep 0.25
done

if [[ "$no_open" == "false" ]]; then
  xdg-open "$status_url" >/dev/null 2>&1 &
fi

if [[ "$relay_ready" != "true" ]]; then
  echo "Le relais ShowScore n’a pas répondu. Consultez :" >&2
  echo "journalctl --user -u showscore-relay.service -n 50" >&2
  exit 1
fi
