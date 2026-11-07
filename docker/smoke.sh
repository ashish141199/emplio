#!/usr/bin/env bash
# The whole thing on real Docker: builds and starts it, signs up, then uses a real computer and browser.
# Needs Docker. Leaves nothing behind.
set -euo pipefail
cd "$(dirname "$0")/.."
export OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-not-a-real-key}"
# this source, not the last published images
export EMPLIO_BUILD=1
[ -f .env ] && { echo ".env exists; run this on a clean copy" >&2; exit 1; }
cleanup() {
  docker compose logs --tail=60 app runner gitea-init || true
  docker ps -aq --filter label=emplio.kind | xargs -r docker rm -f || true
  docker compose down -v || true
  docker network ls -q --filter label=emplio.kind=network | xargs -r docker network rm || true
  rm -f .env
}
trap cleanup EXIT
./setup.sh
for i in $(seq 1 90); do curl -fsS http://localhost:4000/health >/dev/null 2>&1 && break; sleep 2; [ "$i" = 90 ] && { echo "API never came up" >&2; exit 1; }; done
for i in $(seq 1 30); do curl -fsS -o /dev/null http://localhost:3000/login && break; sleep 2; [ "$i" = 30 ] && { echo "app never came up" >&2; exit 1; }; done

curl -fsS -X POST -H 'content-type: application/json' -d '{"email":"owner@example.com"}' http://localhost:4000/auth/start
sleep 1
code="$(docker compose logs app | grep -oE 'the sign-in code for owner@example.com is [0-9]{6}' | tail -n1 | grep -oE '[0-9]{6}$')"
[ -n "$code" ] || { echo "no sign-in code in the log" >&2; exit 1; }
[ "$code" != 123456 ] || { echo "fixed sign-in code on a real install" >&2; exit 1; }
curl -fsS -X POST -H 'content-type: application/json' -d "{\"email\":\"owner@example.com\",\"code\":\"$code\"}" -c /tmp/emplio-smoke-cookies http://localhost:4000/auth/verify
curl -fsS -b /tmp/emplio-smoke-cookies http://localhost:4000/auth/me | grep -q owner@example.com
status="$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{"email":"stranger@example.com"}' http://localhost:4000/auth/start)"
[ "$status" = 403 ] || { echo "a stranger could start signing up: $status" >&2; exit 1; }

docker compose exec -T app bun docker/smoke-inside.ts
echo "smoke test passed"
