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
# Same trap as the censusapi Worker, which is why that token carries Cache Purge
# too. See ~/.cloudflare/README.md.
#
# Usage:
#   set -a; . ~/.cloudflare/rjwalters/workers-hradtoraed.env; set +a
#   npm run deploy
set -euo pipefail

ZONE_ID=710ff3d1c005e5e9106fc687df29b18a

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is not set." >&2
  echo "  set -a; . ~/.cloudflare/rjwalters/workers-hradtoraed.env; set +a" >&2
  exit 1
fi

npx wrangler deploy

echo "Purging the zone cache..."
response=$(curl -sS -X POST \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}' \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache")

if ! printf '%s' "$response" | grep -q '"success":true'; then
  echo "Cache purge FAILED. The deploy landed, but hradtoraed.com may serve the" >&2
  echo "previous build until the edge copy expires." >&2
  printf '%s\n' "$response" >&2
  exit 1
fi

echo "Purged."

# Prove the domain actually serves what was just built, rather than trusting that
# the purge did its job.
local_js=""
for f in dist/assets/*.js; do local_js="/assets/${f##*/}"; break; done
live_js=$(curl -sS --max-time 20 https://hradtoraed.com/ \
  | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)

if [[ "$local_js" == "$live_js" ]]; then
  echo "Verified: hradtoraed.com is serving ${live_js}"
else
  echo "WARNING: hradtoraed.com serves ${live_js:-<nothing>}, expected ${local_js}." >&2
  echo "Give the edge a moment and re-check before assuming the deploy worked." >&2
  exit 1
fi
