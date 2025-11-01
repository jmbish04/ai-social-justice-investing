# Database Management Guide

This guide explains how to manage your D1 database migrations, import data, and keep your database up to date.

## 📊 Database Info

- **Database Name**: `sji-app-db`
- **Binding**: `DB` (in wrangler.toml)
- **Database ID**: `34b476f8-1f88-4062-816d-2acfb3449a7d`

## 🔍 Check Migration Status

### Quick Status Check

```bash
# Check remote (production) database
npm run db:status

# Check local database
npm run db:status:local

# Check both
npm run db:check
```

### Manual Check

```bash
# Remote
npx wrangler d1 migrations list sji-app-db --remote

# Local
npx wrangler d1 migrations list sji-app-db --local
```

## 🚀 Apply Migrations

### Apply to Production (Remote)

```bash
# Apply all pending migrations to production
npm run db:migrate

# Or directly:
npx wrangler d1 migrations apply sji-app-db --remote
```

### Apply to Local Database

```bash
# Apply all pending migrations locally
npm run db:migrate:local

# Or directly:
npx wrangler d1 migrations apply sji-app-db --local
```

## 📋 Migration Files

Your migrations are located in the `migrations/` directory:

- `0001_create_core_tables.sql` - Core tables (threads, messages, ideas)
- `0002_create_guest_tables.sql` - Guest profiles and episode guests
- `0003_create_podcast_production_tables.sql` - Podcast production tables
- `0004_add_research_and_pairings_tables.sql` - Research entries and pairings
- `2025-10-30_add_podcast_tables.sql` - Transcripts and audio versions

## ✅ Verify Database is Up to Date

### Step 1: Check Current Status

```bash
npm run db:status
```

Expected output if up to date:
```
✅ No migrations to apply!
```

If there are pending migrations, you'll see:
```
Migrations to be applied:
┌───────────────────────────────────────────┐
│ Name                                      │
├───────────────────────────────────────────┤
│ 0001_create_core_tables.sql               │
│ ...
└───────────────────────────────────────────┘
```

### Step 2: Apply Pending Migrations

If there are pending migrations:

```bash
npm run db:migrate
```

### Step 3: Verify Tables Exist

Query the database to verify tables:

```bash
# List all tables in remote database
npx wrangler d1 execute sji-app-db --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

# Check specific table structure
npx wrangler d1 execute sji-app-db --remote \
  --command "PRAGMA table_info(episodes);"
```

## 🔄 Complete Update Workflow

### For Production (Remote)

```bash
# 1. Check status
npm run db:status

# 2. Apply migrations if needed
npm run db:migrate

# 3. Verify (optional)
npx wrangler d1 execute sji-app-db --remote \
  --command "SELECT COUNT(*) as episode_count FROM episodes;"
```

### For Local Development

```bash
# 1. Check local status
npm run db:status:local

# 2. Apply migrations locally
npm run db:migrate:local

# 3. Verify (optional)
npx wrangler d1 execute sji-app-db --local \
  --command "SELECT COUNT(*) as episode_count FROM episodes;"
```

## 🆕 Creating New Migrations

When you need to add new database changes:

1. **Create migration file** in `migrations/` directory:
   ```bash
   # Format: YYYY-MM-DD_description.sql or 000N_description.sql
   touch migrations/0005_add_new_feature.sql
   ```

2. **Write SQL** in the migration file:
   ```sql
   -- Add your SQL changes here
   CREATE TABLE IF NOT EXISTS new_table (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     created_at INTEGER NOT NULL
   );
   ```

3. **Test locally first**:
   ```bash
   npm run db:migrate:local
   ```

4. **Apply to production**:
   ```bash
   npm run db:migrate
   ```

## 🔍 Query Database

### Execute SQL Queries

```bash
# Remote database
npx wrangler d1 execute sji-app-db --remote \
  --command "SELECT * FROM episodes LIMIT 5;"

# Local database
npx wrangler d1 execute sji-app-db --local \
  --command "SELECT * FROM episodes LIMIT 5;"
```

### Execute from File

```bash
# Remote
npx wrangler d1 execute sji-app-db --remote \
  --file path/to/query.sql

# Local
npx wrangler d1 execute sji-app-db --local \
  --file path/to/query.sql
```

## 🐛 Troubleshooting

### "No migrations to apply!"

✅ **This is good!** Your database is up to date.

### "Migration failed"

1. Check the error message
2. Verify the SQL syntax
3. Check if tables already exist
4. Use `IF NOT EXISTS` in CREATE statements
5. Check for conflicts with existing data

### "Database not found"

Verify your database name in `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "sji-app-db"
database_id = "34b476f8-1f88-4062-816d-2acfb3449a7d"
```

### Reset Local Database (Development Only)

⚠️ **Warning**: This deletes all local data!

```bash
# Delete local database (if needed)
rm -f .wrangler/state/v3/d1/*/database.sqlite

# Reapply all migrations
npm run db:migrate:local
```

## 📚 Common Queries

### Check Table Counts

```bash
npx wrangler d1 execute sji-app-db --remote --command "
  SELECT 
    'episodes' as table_name, COUNT(*) as count FROM episodes
  UNION ALL
  SELECT 'guest_profiles', COUNT(*) FROM guest_profiles
  UNION ALL
  SELECT 'transcripts', COUNT(*) FROM transcripts
  UNION ALL
  SELECT 'audio_versions', COUNT(*) FROM audio_versions;
"
```

### Check Latest Records

```bash
npx wrangler d1 execute sji-app-db --remote --command "
  SELECT id, title, created_at 
  FROM episodes 
  ORDER BY created_at DESC 
  LIMIT 5;
"
```

## 📥 Importing Data

### Import JSON Data Files

Import the initial data from JSON files in `src/data/`:

```bash
# Import to local development API
npm run import:json

# Import to production API
npm run import:json:remote

# Or with custom URL
python3 scripts/import_json_data.py --base-url https://social-investing.hacolby.workers.dev

# Dry run (see what would be imported)
python3 scripts/import_json_data.py --dry-run

# Import specific data types
python3 scripts/import_json_data.py --skip-research  # Skip research entries
python3 scripts/import_json_data.py --skip-pairings  # Skip pairings
```

The script imports:
- `episodes.json` → `episodes` table
- `research.json` → `research_entries` table  
- `pairings.json` → `pairings` table

### Import Gemini Deep Research

Import detailed research data from Gemini Deep Research markdown:

```bash
python3 scripts/import_gemini_research.py --generate-all
# Or use npm script:
npm run import:gemini
```

See `docs/DEPLOYMENT.md` for complete import workflow.

## 🔗 Related Commands

```bash
npm run db:migrate        # Apply migrations to production
npm run db:migrate:local  # Apply migrations locally
npm run db:status          # Check remote status
npm run db:status:local    # Check local status
npm run db:check           # Check both locations
npm run import:json        # Import JSON data files (local)
npm run import:json:remote # Import JSON data files (production)
```

---

## 📝 Quick Reference

**Update Production Database:**
```bash
npm run db:migrate
```

**Check if Up to Date:**
```bash
npm run db:status
```

**View Database Tables:**
```bash
npx wrangler d1 execute sji-app-db --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table';"
```

