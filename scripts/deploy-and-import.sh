#!/bin/bash
# Deployment and import script for production
# Usage: ./scripts/deploy-and-import.sh [--skip-import] [--worker-url URL] [--token TOKEN]

set -e  # Exit on error

SKIP_IMPORT=false
WORKER_URL="${WORKER_URL:-https://social-investing.hacolby.workers.dev}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-import)
      SKIP_IMPORT=true
      shift
      ;;
    --worker-url)
      WORKER_URL="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--skip-import] [--worker-url URL]"
      exit 1
      ;;
  esac
done

echo "🚀 Starting deployment process..."
echo "Worker URL: $WORKER_URL"
echo "Note: All API endpoints are public - no authentication required"
echo ""

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm install

# Step 2: Generate types
echo "📝 Generating TypeScript types..."
npm run types

# Step 3: Build frontend
echo "🏗️  Building frontend..."
npm run build:frontend

# Step 4: Apply database migrations
echo "🗄️  Applying database migrations..."
npm run db:migrate

# Step 5: Deploy worker
echo "☁️  Deploying worker..."
npx wrangler deploy

echo ""
echo "✅ Deployment complete!"
echo ""

# Step 6: Import data (if not skipped)
if [ "$SKIP_IMPORT" = false ]; then
  echo "📥 Importing data..."
  python3 scripts/import_gemini_research.py \
    --base-url "$WORKER_URL" \
    --generate-all
else
  echo "⏭️  Skipping data import (--skip-import flag set)"
fi

echo ""
echo "🎉 All done! Your worker is live at: $WORKER_URL"
echo ""
echo "Quick checks:"
echo "  Health: curl $WORKER_URL/health"
echo "  Episodes: curl $WORKER_URL/api/episodes"
echo "  Guest Profiles: curl $WORKER_URL/api/guest-profiles"

