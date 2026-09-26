#!/usr/bin/env bash
# Local smoke of the improvement loop against wrangler dev (http://localhost:8787).
set -euo pipefail
ORIGIN="${ORIGIN:-http://localhost:8787}"
COOKIE="$(mktemp)"
COOKIE2="$(mktemp)"
trap 'rm -f "$COOKIE" "$COOKIE2"' EXIT
SLUG="smoke-$(date +%s)"
if [[ -z "${DEV_LOGIN_SECRET:-}" ]]; then
  echo "Set DEV_LOGIN_SECRET to the value in workers/platform/.dev.vars" >&2
  exit 1
fi
LOGIN_BODY=$(DEV_LOGIN_SECRET="$DEV_LOGIN_SECRET" python3 -c 'import json,os; print(json.dumps({"secret": os.environ["DEV_LOGIN_SECRET"]}))')

LOGIN=$(curl -sS -c "$COOKIE" -b "$COOKIE" -H 'Content-Type: application/json' -H "Origin: $ORIGIN" \
  -d "$LOGIN_BODY" "$ORIGIN/api/auth/dev-login")
CSRF=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["csrfToken"])' <<<"$LOGIN")
PID=$(curl -sS -c "$COOKIE" -b "$COOKIE" -H 'Content-Type: application/json' -H "Origin: $ORIGIN" -H "X-CSRF-Token: $CSRF" \
  -d "{\"name\":\"Smoke\",\"slug\":\"$SLUG\",\"purpose\":\"Smoke test\",\"audience\":\"Builders\",\"liveUrl\":\"https://example.com\",\"visibility\":\"public\"}" \
  "$ORIGIN/api/projects" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
RID=$(curl -sS -c "$COOKIE" -b "$COOKIE" -H 'Content-Type: application/json' -H "Origin: $ORIGIN" -H "X-CSRF-Token: $CSRF" \
  -d '{"label":"v0","sourceUrl":"https://example.com","commitSha":"deadbeef"}' \
  "$ORIGIN/api/projects/$PID/releases" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
curl -sS -c "$COOKIE" -b "$COOKIE" -H 'Content-Type: application/json' -H "Origin: $ORIGIN" -H "X-CSRF-Token: $CSRF" \
  -d '{}' "$ORIGIN/api/projects/$PID/releases/$RID/runs" >/dev/null
FID=$(curl -sS -c "$COOKIE" -b "$COOKIE" "$ORIGIN/api/projects/$PID/releases/$RID" | python3 -c 'import json,sys; print(json.load(sys.stdin)["findings"][0]["id"])')
curl -sS -c "$COOKIE" -b "$COOKIE" -X PATCH -H 'Content-Type: application/json' -H "Origin: $ORIGIN" -H "X-CSRF-Token: $CSRF" \
  -d '{"state":"accepted","expectedVersion":1}' "$ORIGIN/api/projects/$PID/findings/$FID" >/dev/null
CID=$(curl -sS -c "$COOKIE" -b "$COOKIE" -H 'Content-Type: application/json' -H "Origin: $ORIGIN" -H "X-CSRF-Token: $CSRF" \
  -d "{\"findingIds\":[\"$FID\"],\"baseSha\":\"deadbeef\"}" "$ORIGIN/api/projects/$PID/changes" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
curl -sS -c "$COOKIE" -b "$COOKIE" -H 'Content-Type: application/json' -H "Origin: $ORIGIN" -H "X-CSRF-Token: $CSRF" \
  -d '{}' "$ORIGIN/api/projects/$PID/changes/$CID/export" >/dev/null
echo "OK project=$PID release=$RID finding=$FID change=$CID slug=$SLUG"
