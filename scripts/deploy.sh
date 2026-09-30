#!/usr/bin/env bash
#
# Deploy the built site, then purge the zone cache.
#
# The purge is not optional. Cloudflare caches index.html at the zone edge, and
# index.html is the one file whose name never changes while its contents do --
# it is what points at the content-hashed bundles. Without a purge, a deploy
# succeeds, the Worker serves the new build on workers.dev, and hradtoraed.com
# keeps handing out the *previous* build's asset hashes until the edge copy
# expires. It looks exactly like a deploy that did not happen.
#
# Any Worker served through a Cloudflare zone has this trap.
#
# Needs, in the environment:
#   CLOUDFLARE_API_TOKEN   Workers Scripts:Write, plus Cache Purge on the zone
#   CLOUDFLARE_ZONE_ID     the zone to purge
#   SITE_URL               optional, defaults to https://hradtoraed.com
set -euo pipefail

SITE_URL="${SITE_URL:-https://hradtoraed.com}"

for var in CLOUDFLARE_API_TOKEN CLOUDFLARE_ZONE_ID; do
  if [[ -z "${!var:-}" ]]; then
    echo "${var} is not set. Export it, or source whatever holds your" >&2
    echo "deploy credentials, before running this." >&2
    exit 1
  fi
done

npx wrangler deploy

echo "Purging the zone cache..."
response=$(curl -sS -X POST \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}' \
  "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache")

if ! printf '%s' "$response" | grep -q '"success":true'; then
  echo "Cache purge FAILED. The deploy landed, but the site may serve the" >&2
  echo "previous build until the edge copy expires." >&2
  printf '%s\n' "$response" >&2
  exit 1
fi

echo "Purged."

# Prove the domain actually serves what was just built, rather than trusting that
# the purge did its job.
#
# With retries: a purge returns before it has propagated to every edge, so
# checking immediately reports a stale bundle that is correct seconds later. A
# check that cries wolf on every deploy is one people stop reading.
local_js=""
for f in dist/assets/*.js; do local_js="/assets/${f##*/}"; break; done

for attempt in 1 2 3 4 5; do
  live_js=$(curl -sS --max-time 20 "${SITE_URL}/" \
    | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true)

  if [[ "$local_js" == "$live_js" ]]; then
    echo "Verified: ${SITE_URL} is serving ${live_js}"
    exit 0
  fi

  if (( attempt < 5 )); then
    echo "  edge still on ${live_js:-<nothing>}, waiting (${attempt}/5)..."
    sleep 4
  fi
done

echo "FAILED: ${SITE_URL} serves ${live_js:-<nothing>}, expected ${local_js}." >&2
echo "The deploy landed but the edge is still serving an older build." >&2
exit 1
