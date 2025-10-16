#!/usr/bin/env bash
set -euo pipefail

DATA_DIR=/screeps
DEFAULTS_DIR=/defaults
CLI_BIN=/opt/screeps-cli/node_modules/.bin/screeps

mkdir -p "$DATA_DIR" "$DATA_DIR/logs"

# Ensure @screeps packages are visible to mods
if [ ! -e "$DATA_DIR/node_modules/@screeps" ]; then
  mkdir -p "$DATA_DIR/node_modules"
  ln -s /opt/screeps-cli/node_modules/@screeps "$DATA_DIR/node_modules/@screeps" || true
fi

# Initialize mods.json if missing
if [ ! -f "$DATA_DIR/mods.json" ]; then
  cp -f "$DEFAULTS_DIR/mods.json" "$DATA_DIR/mods.json"
fi

# Initialize .screepsrc if missing
if [ ! -f "$DATA_DIR/.screepsrc" ]; then
  cat >"$DATA_DIR/.screepsrc" <<INI
port = 21025
host = 0.0.0.0
cli_port = 21026
cli_host = localhost
runners_cnt = 1
runner_threads = 4
processors_cnt = 2
logdir = logs
modfile = /screeps/mods.json
assetdir = /screeps/assets
db = db.json
log_console = false
log_rotate_keep = 5
storage_disabled = false
restart_interval = 3600
steam_api_key = 
INI
fi

# Inject STEAM_API_KEY to .screepsrc when provided
if [ -n "${STEAM_API_KEY:-}" ]; then
  if grep -q '^steam_api_key' "$DATA_DIR/.screepsrc"; then
    sed -i "s/^steam_api_key.*/steam_api_key = ${STEAM_API_KEY}/" "$DATA_DIR/.screepsrc"
  else
    echo "steam_api_key = ${STEAM_API_KEY}" >> "$DATA_DIR/.screepsrc"
  fi
fi

echo "Using .screepsrc:" && sed -n '1,120p' "$DATA_DIR/.screepsrc"
echo "Using mods.json:" && cat "$DATA_DIR/mods.json"

exec "$@"
