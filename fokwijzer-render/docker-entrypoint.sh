#!/bin/sh
# Start De Fokwijzer. Draait de container als root (zoals op Render), dan wordt de datamap
# eerst aan de gebruiker "node" gegeven en draait de app daarna zonder root-rechten.
set -e
DATA_DIR="${DATA_DIR:-/data}"
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR"
  exec setpriv --reuid=node --regid=node --init-groups node server/index.js
fi
exec node server/index.js
