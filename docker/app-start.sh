#!/bin/bash
# Runs the database's migrations, then the API and the web app. If either stops, the container stops and restarts.
set -euo pipefail
export GITEA_TOKEN="$(cat /secrets/gitea_token)"
cd /app/backend
bun run db:migrate
bun src/index.ts &
cd /app/frontend
bun run start -p 3000 &
wait -n
exit 1
