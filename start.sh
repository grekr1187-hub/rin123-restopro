#!/bin/sh
set -eu

if [ -n "${RP_B64:-}" ]; then
  echo "$RP_B64" | base64 -d | tar -xz
fi

exec node server.mjs
