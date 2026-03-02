#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-$HOME/.config/ledgerai/cloudflare.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

source "$ENV_FILE"

: "${CF_API_TOKEN:?CF_API_TOKEN is required}"
: "${CF_ZONE_NAME:?CF_ZONE_NAME is required}"
: "${CF_RECORD_NAME:?CF_RECORD_NAME is required}"

GH_OWNER="akshay16803"
GH_REPO="ledgerai"
GH_TARGET="akshay16803.github.io"
GH_CNAME="accounts.niprasha.com"

for cmd in jq gh curl dig; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd"
    exit 1
  fi
done

echo "1) Resolving Cloudflare zone id..."
ZONE_ID="$(curl -sS -X GET "https://api.cloudflare.com/client/v4/zones?name=${CF_ZONE_NAME}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" | jq -r '.result[0].id')"

if [[ -z "$ZONE_ID" || "$ZONE_ID" == "null" ]]; then
  echo "Could not resolve Cloudflare zone id for ${CF_ZONE_NAME}"
  exit 1
fi
echo "   Zone: $ZONE_ID"

echo "2) Upserting CNAME ${CF_RECORD_NAME} -> ${GH_TARGET} (DNS only)..."
REC_JSON="$(curl -sS -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?type=CNAME&name=${CF_RECORD_NAME}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json")"
REC_ID="$(echo "$REC_JSON" | jq -r '.result[0].id // empty')"
REC_CONTENT="$(echo "$REC_JSON" | jq -r '.result[0].content // empty')"
REC_PROXIED="$(echo "$REC_JSON" | jq -r '.result[0].proxied // empty')"

if [[ -n "$REC_ID" ]]; then
  if [[ "$REC_CONTENT" == "$GH_TARGET" && "$REC_PROXIED" == "false" ]]; then
    echo "   Existing CNAME already correct"
  else
    curl -sS -X DELETE "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${REC_ID}" \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      -H "Content-Type: application/json" \
      | jq -e '.success' >/dev/null
    curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "{\"type\":\"CNAME\",\"name\":\"${CF_RECORD_NAME}\",\"content\":\"${GH_TARGET}\",\"ttl\":1,\"proxied\":false}" \
      | jq -e '.success' >/dev/null
  fi
else
  curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"CNAME\",\"name\":\"${CF_RECORD_NAME}\",\"content\":\"${GH_TARGET}\",\"ttl\":1,\"proxied\":false}" \
    | jq -e '.success' >/dev/null
fi
echo "   CNAME upserted"

echo "3) Ensuring GitHub Pages domain and workflow mode..."
gh api -X PUT "repos/${GH_OWNER}/${GH_REPO}/pages" -f cname="${GH_CNAME}" >/dev/null
gh api -X PUT "repos/${GH_OWNER}/${GH_REPO}/pages" -f build_type=workflow >/dev/null
echo "   GitHub Pages configured"

echo "4) DNS verification..."
echo "   dig CNAME: $(dig +short CNAME ${CF_RECORD_NAME} @1.1.1.1 | head -n1)"

echo "5) Checking certificate readiness..."
HEALTH_JSON="$(gh api "repos/${GH_OWNER}/${GH_REPO}/pages/health")"
HTTPS_READY="$(echo "$HEALTH_JSON" | jq -r '.domain.responds_to_https')"
HTTPS_ERR="$(echo "$HEALTH_JSON" | jq -r '.domain.https_error')"
echo "   responds_to_https=${HTTPS_READY} https_error=${HTTPS_ERR}"

if [[ "$HTTPS_READY" == "true" ]]; then
  gh api -X PUT "repos/${GH_OWNER}/${GH_REPO}/pages" -f cname="${GH_CNAME}" -F https_enforced=true >/dev/null
  echo "6) HTTPS is now enforced."
else
  echo "6) Certificate not ready yet. Re-run this script after a few minutes."
fi

echo "Done."
