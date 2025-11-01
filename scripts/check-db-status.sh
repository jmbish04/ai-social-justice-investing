#!/bin/bash
# Check D1 database migration status
# Usage: ./scripts/check-db-status.sh [--remote|--local]

set -e

DB_NAME="sji-app-db"
LOCATION="${1:---remote}"

echo "📊 Checking D1 database migration status..."
echo "Database: $DB_NAME"
echo "Location: ${LOCATION#--}"
echo ""

if [ "$LOCATION" = "--remote" ]; then
  echo "🔍 Remote database status:"
  npx wrangler d1 migrations list "$DB_NAME" --remote
elif [ "$LOCATION" = "--local" ]; then
  echo "🔍 Local database status:"
  npx wrangler d1 migrations list "$DB_NAME" --local
else
  echo "Checking both local and remote..."
  echo ""
  echo "=== REMOTE DATABASE ==="
  npx wrangler d1 migrations list "$DB_NAME" --remote || true
  echo ""
  echo "=== LOCAL DATABASE ==="
  npx wrangler d1 migrations list "$DB_NAME" --local || true
fi

