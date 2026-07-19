#!/bin/sh
set -eu

if [ "$(id -u)" = "0" ]; then
  mkdir -p /data/tts-cache /data/data/mp3
  chown -R node:node /data
  exec gosu node:node "$@"
fi

exec "$@"
