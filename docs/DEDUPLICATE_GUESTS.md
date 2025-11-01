# Guest Deduplication Guide

## Overview

The system now prevents duplicate guest profiles at multiple levels:
1. **Database constraint**: Unique index on normalized guest names (case-insensitive)
2. **API-level checks**: GET and POST endpoints deduplicate before returning/creating
3. **Client-side backup**: Import scripts include additional deduplication

## Current Duplicate Situation

If you're seeing duplicate guests in the UI, you need to:

1. **Apply the migration** to clean up existing duplicates:
   ```bash
   npx wrangler d1 migrations apply sji-app-db --remote
   ```

2. **Manually deduplicate** existing data (if migration doesn't catch all):
   ```bash
   npx wrangler d1 execute sji-app-db --remote --file scripts/deduplicate_guests.sql
   ```

## How It Works

### Database Level
- Unique index: `idx_guest_profiles_name_unique` on `LOWER(TRIM(name))`
- Migration `0006` removes duplicates before applying the constraint

### API Level
- **GET `/api/guest-profiles`**: Returns only one guest per unique name (keeps oldest)
- **POST `/api/guest-profiles`**: Checks for existing guest before creating, returns existing if found

### Import Script Level
- `sync_guest_profiles()` performs case-insensitive matching before creating
- Uses normalized names to prevent duplicates

## Testing

After applying migrations, verify:
```bash
# Check guest count
npx wrangler d1 execute sji-app-db --remote --command "SELECT COUNT(*) as total, COUNT(DISTINCT LOWER(TRIM(name))) as unique_names FROM guest_profiles"

# Should show: total == unique_names (no duplicates)
```

## Future Prevention

All new guest creation will automatically:
1. Check for existing guest with same name (case-insensitive)
2. Return existing guest instead of creating duplicate
3. Apply database constraint if somehow bypassed

