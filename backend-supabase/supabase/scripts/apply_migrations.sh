#!/usr/bin/env bash
set -euo pipefail

MIGRATIONS_FOLDER=${1:-./migrations}
SUPABASE_URL=${SUPABASE_URL:-}
SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-}

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables." >&2
  exit 1
fi

echo "Applying SQL migrations from $MIGRATIONS_FOLDER"

for f in $(ls "$MIGRATIONS_FOLDER"/*.sql | sort); do
  echo "Applying $f"
  sql=$(cat "$f" | sed 's/"/\\"/g' | jq -Rs '{q: .}')
  curl -sS -X POST "$SUPABASE_URL/rest/v1/rpc/sql" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "$sql" | jq .
done

echo "Done. Verify migration results in your Supabase dashboard or via psql."
