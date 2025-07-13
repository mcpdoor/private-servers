#!/bin/bash
set -e

SERVICE=${SERVICE:-google-maps}

echo "Starting service: $SERVICE"

case "$SERVICE" in
  google-maps)
    exec node dist/google-maps/src/index.js
    ;;
  airtable)
    exec node dist/airtable/src/index.js
    ;;
  brave-search)
    exec node dist/brave-search/src/index.js
    ;;
  *)
    echo "Unknown service: $SERVICE"
    exit 1
    ;;
esac 