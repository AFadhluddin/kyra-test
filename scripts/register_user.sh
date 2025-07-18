#!/usr/bin/env bash
# scripts/register_user.sh
# Usage: ./scripts/register_user.sh  [email]  [password]  [api_base]

set -euo pipefail

EMAIL="${1:-qa@example.com}"
PASS="${2:-secret}"
API="${3:-http://127.0.0.1:8000/api/v1}"

echo "📨  Registering $EMAIL ..."
curl -s -o /dev/null -w "  → HTTP %{http_code}\n" -X POST "$API/register" \
     -H "Content-Type: application/json" \
     -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
|| true   # ignore error if user already exists

echo "🔑  Logging in ..."
TOKEN=$(curl -s -X POST "$API/login" \
         -H "Content-Type: application/json" \
         -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | jq -r .access_token)

if [[ "$TOKEN" == "null" || -z "$TOKEN" ]]; then
  echo "❌  Login failed – check email/password."
  exit 1
fi

echo "✅  Access token:"
echo "$TOKEN"
