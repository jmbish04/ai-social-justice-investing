# Deployment & Import Guide

This guide covers how to deploy updates and import data after deployment.

## 🚀 Deployment Process

### Step 1: Deploy Worker & Apply Migrations

The deployment script automatically builds the frontend, applies database migrations, and deploys the worker:

```bash
npm run deploy
```

This runs:
1. `npm run build` - Builds frontend assets
2. `npm run db:migrate` - Applies D1 migrations to production
3. `wrangler deploy` - Deploys the Worker

### Step 2: Apply Migrations Manually (if needed)

If you need to run migrations separately or have new migrations:

```bash
# Apply migrations to production database
npm run db:migrate

# Or use the direct command
npx wrangler d1 migrations apply sji-app-db --remote
```

### Step 3: Verify Deployment

All API endpoints are publicly accessible (no authentication required).

---

## 📥 Importing Data After Deployment

### Option 1: Import via Script (Recommended)

Use the import script to upload Gemini research data to your deployed worker:

```bash
# Run import (generates types, creates guests, episodes)
# URL is hardcoded to production, or use npm script:
npm run import:gemini

# Or directly:
python3 scripts/import_gemini_research.py --generate-all

# To use local dev server instead:
python3 scripts/import_gemini_research.py --start-dev --generate-all
```

### Option 2: Import with Specific Options

```bash
# Import without generating transcripts/audio
python3 scripts/import_gemini_research.py --skip-transcript --skip-audio

# Import and generate transcripts/audio for all episodes (default)
python3 scripts/import_gemini_research.py --generate-all
```

### Option 3: Manual API Calls

You can also import data manually using the API:

```bash
# Set your production URL
export API_URL="https://social-investing.hacolby.workers.dev/api"

# Create a guest profile
curl -X POST "$API_URL/guest-profiles" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Guest Name",
    "persona_description": "Description here...",
    "expertise": "AI Ethics",
    "tone": "Visionary",
    "background": "Background info"
  }'

# Create an episode
curl -X POST "$API_URL/episodes" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Episode Title",
    "description": "Episode description..."
  }'

# Add guest to episode
curl -X POST "$API_URL/episodes/{episodeId}/guests" \
  -H "Content-Type: application/json" \
  -d '{
    "guestProfileId": "guest-profile-id"
  }'
```

---

## 🔄 Workflow: Deploy + Migrate + Import

### Complete Deployment Workflow

```bash
# 1. Make sure you're on the latest code
git pull origin main

# 2. Install/update dependencies
npm install

# 3. Generate TypeScript types
npm run types

# 4. Deploy (builds, migrates, deploys)
npm run deploy

# 5. Import your data
npm run import:gemini
# Or directly:
python3 scripts/import_gemini_research.py --generate-all

# 7. Verify deployment
curl https://social-investing.hacolby.workers.dev/health
```

---

## 📊 Database Migrations

### List Pending Migrations

```bash
npx wrangler d1 migrations list sji-app-db --remote
```

### Apply Specific Migration

```bash
# Apply migrations up to a specific version
npx wrangler d1 migrations apply sji-app-db --remote --to <version>
```

### Rollback (if needed)

D1 doesn't support automatic rollbacks, but you can manually:

1. Create a new migration that reverses changes
2. Apply the new migration

---

## 🔍 Verify Deployment

### Check Worker Status

```bash
# View logs in real-time
npm run tail

# Check worker status
npx wrangler deployments list
```

### Test Endpoints

```bash
# Health check
curl https://social-investing.hacolby.workers.dev/health

# List episodes
curl https://social-investing.hacolby.workers.dev/api/episodes

# List guest profiles
curl https://social-investing.hacolby.workers.dev/api/guest-profiles
```

### Verify Database

```bash
# Query D1 database
npx wrangler d1 execute sji-app-db --remote --command "SELECT COUNT(*) FROM episodes;"
npx wrangler d1 execute sji-app-db --remote --command "SELECT COUNT(*) FROM guest_profiles;"
```

---

## 🔐 Environment Variables & Secrets

### Environment Variables

Variables in `wrangler.toml` are automatically included.

---

## 🐛 Troubleshooting

### Migration Errors

If migrations fail:

```bash
# Check migration status
npx wrangler d1 migrations list sji-app-db --remote

# See detailed migration output
npx wrangler d1 migrations apply sji-app-db --remote --verbose
```

### Import Script Errors

```bash
# Test connection to production API
curl https://social-investing.hacolby.workers.dev/api/guest-profiles

# Test API endpoint (no authentication required)
curl https://social-investing.hacolby.workers.dev/api/episodes
```

### Type Generation

If TypeScript errors occur after deployment:

```bash
# Regenerate types
npm run types

# Verify types file
cat worker-configuration.d.ts
```

---

## 📝 Post-Deployment Checklist

- [ ] Worker deployed successfully
- [ ] Database migrations applied
- [ ] API endpoints accessible (public, no auth required)
- [ ] Data imported (guests, episodes)
- [ ] Health endpoint responding
- [ ] API endpoints accessible
- [ ] Frontend assets loading
- [ ] Types regenerated

---

## 🔗 Useful Commands Reference

```bash
# Deployment
npm run deploy              # Full deployment (build + migrate + deploy)
npm run build               # Build frontend only
npm run db:migrate          # Apply migrations to production
npm run types               # Generate TypeScript types

# Development
npm run dev                 # Start local dev server
npm run db:migrate:local    # Apply migrations to local database

# Data Import
python3 scripts/import_gemini_research.py --help  # See all options

# Monitoring
npm run tail                # Stream production logs
npx wrangler deployments list  # List deployments
```

---

## 🎯 Quick Reference

**Deploy Everything:**
```bash
npm run deploy && \
python3 scripts/import_gemini_research.py \
  --base-url https://social-investing.hacolby.workers.dev \
  --generate-all
```

**Check Status:**
```bash
curl https://social-investing.hacolby.workers.dev/health && \
npx wrangler d1 execute sji-app-db --remote --command "SELECT COUNT(*) FROM episodes;"
```

