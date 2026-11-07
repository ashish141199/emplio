#!/bin/sh
# First run only: makes the account Emplio uses in Gitea, and keeps its token where Emplio can read it.
set -eu
[ -s /secrets/gitea_token ] && exit 0
out="$(su-exec git gitea admin user create --config /data/gitea/conf/app.ini --admin --username employee0 --random-password --email bot@emplio.local --must-change-password=false --access-token)"
printf '%s' "$out" | grep -oE '[0-9a-f]{40}' | head -n1 > /secrets/gitea_token
[ -s /secrets/gitea_token ] || { echo "no token in Gitea's answer" >&2; exit 1; }
